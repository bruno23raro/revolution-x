// FASE 2 · slice 4 — Testes das ROTAS OAuth do TikTok (callback + refresh).
//
// As rotas importam o `GET`/`POST` e recebem um NextRequest de verdade
// (cookies via header `cookie`). Mockamos SOMENTE as fronteiras de módulo:
//   • @/lib/auth, @/lib/prisma, @/lib/encryption (encrypt/decrypt fake)
//   • @/lib/taskQueue  → TaskQueueUnavailableError REAL (p/ `instanceof`)
//   • @/integrations/tiktok/resolveAccess (save + resolver fake)
//   • @/integrations/tiktok/auth/oauth (exchange/refresh fake + TikTokOAuthError REAL)
// A rede (open.tiktokapis.com) NUNCA entra: a API é mockada na fronteira.

import { NextRequest } from 'next/server';
import { getAuthenticatedUser, getAllOrganizationMemberships } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encryptToken } from '@/lib/encryption';
import { TaskQueueUnavailableError } from '@/lib/taskQueue';
import {
  resolveTenantTikTokAccess,
  saveTikTokOAuthTokens,
  type ResolveTikTokResult,
  type TikTokOAuthState,
} from '@/integrations/tiktok/resolveAccess';
import {
  exchangeTikTokCode,
  refreshTikTokToken,
  TikTokOAuthError,
  type TikTokTokenSet,
} from '@/integrations/tiktok/auth/oauth';
// Rotas por CAMINHO RELATIVO (o alias @/api não existe no tsconfig; ts-jest
// não passaria no type-check). De src/tests/ → ../../ = raiz.
import { GET as callbackGet } from '../../app/api/auth/callback/tiktok/route';
import { POST as refreshPost } from '../../app/api/integrations/tiktok/refresh-token/route';

jest.mock('@/lib/auth', () => ({
  getAuthenticatedUser: jest.fn(),
  getAllOrganizationMemberships: jest.fn(),
}));
jest.mock('@/lib/prisma', () => ({
  prisma: { __prisma: true },
}));
jest.mock('@/lib/encryption', () => ({
  encryptToken: jest.fn(),
  decryptToken: jest.fn(),
}));
// TaskQueueUnavailableError REAL p/ o `instanceof` das rotas bater de verdade.
jest.mock('@/lib/taskQueue', () => ({
  saveMemory: jest.fn(),
  listMemory: jest.fn(),
  TaskQueueUnavailableError: jest.requireActual('@/lib/taskQueue').TaskQueueUnavailableError,
}));
jest.mock('@/integrations/tiktok/resolveAccess', () => ({
  resolveTenantTikTokAccess: jest.fn(),
  saveTikTokOAuthTokens: jest.fn(),
}));
// TikTokOAuthError REAL p/ `instanceof` no branch de fail do exchange/refresh.
jest.mock('@/integrations/tiktok/auth/oauth', () => ({
  exchangeTikTokCode: jest.fn(),
  refreshTikTokToken: jest.fn(),
  TikTokOAuthError: jest.requireActual('@/integrations/tiktok/auth/oauth').TikTokOAuthError,
}));

const user = { id: 'user-1', email: 'a@b.c', organizationId: 'org-1', role: 'owner' };
const tokens: TikTokTokenSet = {
  accessToken: 'NEW_AT',
  refreshToken: 'NEW_RT',
  openId: 'OID',
  scope: 'video.publish,user.info.basic',
  expiresIn: 86400,
  refreshExpiresIn: 31536000,
};
const oauth: TikTokOAuthState = {
  accessToken: 'ENC',
  refreshToken: 'RT',
  openId: 'OID',
  scope: 'video.publish',
  expiresIn: 86400,
  refreshExpiresIn: 31536000,
  obtainedAt: '2026-10-19T00:00:00.000Z',
};
const resolvedOk = (o: TikTokOAuthState | null): ResolveTikTokResult => ({
  ok: true,
  access: { accessToken: 'X' },
  hasClientKey: true,
  hasClientSecret: true,
  oauth: o,
  tokenExpired: false,
});

const setEnv = (on: boolean) => {
  if (on) {
    process.env.TIKTOK_CLIENT_KEY = 'k';
    process.env.TIKTOK_CLIENT_SECRET = 's';
  } else {
    delete process.env.TIKTOK_CLIENT_KEY;
    delete process.env.TIKTOK_CLIENT_SECRET;
  }
};

let consoleErr: jest.SpyInstance;
beforeEach(() => {
  consoleErr = jest.spyOn(console, 'error').mockImplementation(() => {});
  setEnv(false);
  jest.mocked(getAuthenticatedUser).mockReset();
  jest.mocked(getAllOrganizationMemberships).mockReset();
  jest.mocked(resolveTenantTikTokAccess).mockReset();
  jest.mocked(saveTikTokOAuthTokens).mockReset();
  jest.mocked(exchangeTikTokCode).mockReset();
  jest.mocked(refreshTikTokToken).mockReset();
  jest.mocked(encryptToken).mockReset();
});
afterEach(() => {
  consoleErr.mockRestore();
});

const cb = (query: string, cookie?: string): NextRequest =>
  new NextRequest(`http://localhost/api/auth/callback/tiktok${query}`, {
    method: 'GET',
    headers: cookie ? { cookie } : {},
  });

// ============================================================================
// GET /api/auth/callback/tiktok
// ============================================================================
describe('GET /api/auth/callback/tiktok', () => {
  const cookie = 'tiktok_oauth_state=STATE; tiktok_oauth_verifier=VERIFIER';

  it('sucesso: troca, cifra, persiste no tenant e limpa cookies → /onboarding/success', async () => {
    setEnv(true);
    jest.mocked(getAuthenticatedUser).mockResolvedValue(user as never);
    jest.mocked(exchangeTikTokCode).mockResolvedValue(tokens);
    jest.mocked(encryptToken).mockReturnValue('ENC');
    jest.mocked(saveTikTokOAuthTokens).mockResolvedValue(undefined);

    const res = await callbackGet(cb('?code=CODE&state=STATE', cookie));

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/onboarding/success');
    expect(exchangeTikTokCode).toHaveBeenCalledWith(
      { clientKey: 'k', clientSecret: 's', redirectUri: 'http://localhost/api/auth/callback/tiktok' },
      'CODE',
      'VERIFIER',
    );
    expect(saveTikTokOAuthTokens).toHaveBeenCalledWith(
      prisma,
      { organizationId: 'org-1', userId: 'user-1' },
      tokens,
      'ENC',
    );
    expect(res.headers.get('set-cookie') ?? '').toContain('Max-Age=0');
  });

  it('parâmetro ?error → oauth_error (NUNCA prossegue)', async () => {
    const res = await callbackGet(cb('?error=access_denied&state=STATE', cookie));
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toBe('/onboarding/error');
    expect(loc.searchParams.get('reason')).toBe('oauth_error');
    expect(loc.searchParams.get('detail')).toBe('access_denied');
  });

  it('sem state → state_missing; sem code → code_missing', async () => {
    let res = await callbackGet(cb('?code=CODE', cookie));
    expect(new URL(res.headers.get('location')!).searchParams.get('reason')).toBe('state_missing');
    res = await callbackGet(cb('?state=STATE', cookie));
    expect(new URL(res.headers.get('location')!).searchParams.get('reason')).toBe('code_missing');
  });

  it('state do query ≠ cookie (CSRF) → state_invalid', async () => {
    const res = await callbackGet(cb('?code=CODE&state=DIFFERENT', cookie));
    expect(new URL(res.headers.get('location')!).searchParams.get('reason')).toBe('state_invalid');
    expect(exchangeTikTokCode).not.toHaveBeenCalled();
  });

  it('verifier (PKCE) ausente no cookie → pkce_missing', async () => {
    const res = await callbackGet(
      cb('?code=CODE&state=STATE', 'tiktok_oauth_state=STATE'), // sem verifier
    );
    expect(new URL(res.headers.get('location')!).searchParams.get('reason')).toBe('pkce_missing');
  });

  it('TIKTOK_CLIENT_KEY/SECRET ausentes → config_missing', async () => {
    // setEnv(false) já no beforeEach
    const res = await callbackGet(cb('?code=CODE&state=STATE', cookie));
    expect(new URL(res.headers.get('location')!).searchParams.get('reason')).toBe('config_missing');
    expect(getAuthenticatedUser).not.toHaveBeenCalled();
  });

  it('sem sessão → not_authenticated', async () => {
    setEnv(true);
    jest.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const res = await callbackGet(cb('?code=CODE&state=STATE', cookie));
    expect(new URL(res.headers.get('location')!).searchParams.get('reason')).toBe('not_authenticated');
    expect(exchangeTikTokCode).not.toHaveBeenCalled();
  });

  it('falha no exchange → token_exchange_failed (detail = code do TikTokOAuthError REAL)', async () => {
    setEnv(true);
    jest.mocked(getAuthenticatedUser).mockResolvedValue(user as never);
    jest.mocked(exchangeTikTokCode).mockRejectedValue(
      new TikTokOAuthError('grant inválido', 'TOKEN_EXCHANGE_FAILED'),
    );
    const res = await callbackGet(cb('?code=CODE&state=STATE', cookie));
    const loc = new URL(res.headers.get('location')!);
    expect(loc.searchParams.get('reason')).toBe('token_exchange_failed');
    expect(loc.searchParams.get('detail')).toBe('TOKEN_EXCHANGE_FAILED');
    expect(saveTikTokOAuthTokens).not.toHaveBeenCalled();
  });

  it('encryptToken lança → encryption_failed', async () => {
    setEnv(true);
    jest.mocked(getAuthenticatedUser).mockResolvedValue(user as never);
    jest.mocked(exchangeTikTokCode).mockResolvedValue(tokens);
    jest.mocked(encryptToken).mockImplementation(() => {
      throw new Error('sem META_TOKEN_ENCRYPTION_KEY');
    });
    const res = await callbackGet(cb('?code=CODE&state=STATE', cookie));
    expect(new URL(res.headers.get('location')!).searchParams.get('reason')).toBe('encryption_failed');
  });

  it('persistência: TaskQueueUnavailableError REAL → queue_unavailable', async () => {
    setEnv(true);
    jest.mocked(getAuthenticatedUser).mockResolvedValue(user as never);
    jest.mocked(exchangeTikTokCode).mockResolvedValue(tokens);
    jest.mocked(encryptToken).mockReturnValue('ENC');
    jest.mocked(saveTikTokOAuthTokens).mockRejectedValue(new TaskQueueUnavailableError('fila fora'));
    const res = await callbackGet(cb('?code=CODE&state=STATE', cookie));
    const loc = new URL(res.headers.get('location')!);
    expect(loc.searchParams.get('reason')).toBe('queue_unavailable');
    expect(loc.searchParams.get('detail')).toBe('fila fora');
  });

  it('persistência: erro genérico → db_error', async () => {
    setEnv(true);
    jest.mocked(getAuthenticatedUser).mockResolvedValue(user as never);
    jest.mocked(exchangeTikTokCode).mockResolvedValue(tokens);
    jest.mocked(encryptToken).mockReturnValue('ENC');
    jest.mocked(saveTikTokOAuthTokens).mockRejectedValue(new Error('disk full'));
    const res = await callbackGet(cb('?code=CODE&state=STATE', cookie));
    expect(new URL(res.headers.get('location')!).searchParams.get('reason')).toBe('db_error');
  });
});

// ============================================================================
// POST /api/integrations/tiktok/refresh-token
// ============================================================================
describe('POST /api/integrations/tiktok/refresh-token', () => {
  const req = (): NextRequest =>
    new NextRequest('http://localhost/api/integrations/tiktok/refresh-token', { method: 'POST' });

  const asAdmin = () => jest.mocked(getAuthenticatedUser).mockResolvedValue(user as never);

  it('401 sem sessão', async () => {
    jest.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const res = await refreshPost(req());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('409 not_connected (resolver: nada gravado)', async () => {
    asAdmin();
    jest.mocked(resolveTenantTikTokAccess).mockResolvedValue({ ok: false, reason: 'not_connected' } as never);
    const res = await refreshPost(req());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'not_connected' });
  });

  it('503 queue_unavailable (fila fora)', async () => {
    asAdmin();
    jest.mocked(resolveTenantTikTokAccess).mockResolvedValue({ ok: false, reason: 'queue_unavailable' } as never);
    const res = await refreshPost(req());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'queue_unavailable' });
  });

  it('409 no_refresh_token (resolver ok, mas cadastro manual sem refresh)', async () => {
    asAdmin();
    jest.mocked(resolveTenantTikTokAccess).mockResolvedValue(resolvedOk(null));
    const res = await refreshPost(req());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'no_refresh_token' });
  });

  it('503 config_missing (env ausente, há refresh_token)', async () => {
    asAdmin();
    jest.mocked(resolveTenantTikTokAccess).mockResolvedValue(resolvedOk(oauth));
    // setEnv(false)
    const res = await refreshPost(req());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'config_missing' });
  });

  it('502 refresh_failed (API rejeitou; detail = code do TikTokOAuthError REAL)', async () => {
    setEnv(true);
    asAdmin();
    jest.mocked(resolveTenantTikTokAccess).mockResolvedValue(resolvedOk(oauth));
    jest.mocked(refreshTikTokToken).mockRejectedValue(
      new TikTokOAuthError('refresh revogado', 'TOKEN_REFRESH_FAILED'),
    );
    const res = await refreshPost(req());
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'refresh_failed', detail: 'TOKEN_REFRESH_FAILED' });
    expect(refreshTikTokToken).toHaveBeenCalledWith({ clientKey: 'k', clientSecret: 's', redirectUri: '' }, 'RT');
  });

  it('503 encryption_failed (re-cifra lança)', async () => {
    setEnv(true);
    asAdmin();
    jest.mocked(resolveTenantTikTokAccess).mockResolvedValue(resolvedOk(oauth));
    jest.mocked(refreshTikTokToken).mockResolvedValue(tokens);
    jest.mocked(encryptToken).mockImplementation(() => {
      throw new Error('sem key');
    });
    const res = await refreshPost(req());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'encryption_failed' });
  });

  it('503 queue_unavailable ao persistir (TaskQueueUnavailableError REAL)', async () => {
    setEnv(true);
    asAdmin();
    jest.mocked(resolveTenantTikTokAccess).mockResolvedValue(resolvedOk(oauth));
    jest.mocked(refreshTikTokToken).mockResolvedValue(tokens);
    jest.mocked(encryptToken).mockReturnValue('ENC');
    jest.mocked(saveTikTokOAuthTokens).mockRejectedValue(new TaskQueueUnavailableError('fila fora'));
    const res = await refreshPost(req());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'queue_unavailable' });
  });

  it('500 db_error ao persistir (erro genérico)', async () => {
    setEnv(true);
    asAdmin();
    jest.mocked(resolveTenantTikTokAccess).mockResolvedValue(resolvedOk(oauth));
    jest.mocked(refreshTikTokToken).mockResolvedValue(tokens);
    jest.mocked(encryptToken).mockReturnValue('ENC');
    jest.mocked(saveTikTokOAuthTokens).mockRejectedValue(new Error('disk full'));
    const res = await refreshPost(req());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'db_error' });
  });

  it('200 ok: renova, re-cifra e persiste no tenant', async () => {
    setEnv(true);
    asAdmin();
    jest.mocked(resolveTenantTikTokAccess).mockResolvedValue(resolvedOk(oauth));
    jest.mocked(refreshTikTokToken).mockResolvedValue(tokens);
    jest.mocked(encryptToken).mockReturnValue('ENC');
    jest.mocked(saveTikTokOAuthTokens).mockResolvedValue(undefined);

    const res = await refreshPost(req());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, expiresIn: 86400 });
    expect(saveTikTokOAuthTokens).toHaveBeenCalledWith(
      prisma,
      { organizationId: 'org-1', userId: 'user-1' },
      tokens,
      'ENC',
    );
  });
});
