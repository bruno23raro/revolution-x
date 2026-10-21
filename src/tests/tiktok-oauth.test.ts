// FASE 2 · slice 4 — Testes do OAuth do TikTok (módulo puro) + do resolver
// com decrypt (fronteira: taskQueue / encryption mockados, oauth e resolver REAIS).
//
// Estratégia: o módulo `auth/oauth` é puro (fetch injetável) → testamos com
// fake fetch (sem rede), usando o shape SNAKE da API do TikTok (`access_token`,
// …). O resolver `resolveTenantTikTokAccess` depende de `listMemory` (taskQueue)
// + `decryptToken` (encryption) → mockamos só essas fronteiras;
// `TaskQueueUnavailableError` fica REAL p/ `instanceof` de verdade.

import {
  generatePkce,
  generateOAuthState,
  buildTikTokAuthUrl,
  exchangeTikTokCode,
  refreshTikTokToken,
  TikTokOAuthError,
  DEFAULT_TIKTOK_SCOPES,
  type TikTokOAuthConfig,
} from '@/integrations/tiktok/auth/oauth';
import {
  resolveTenantTikTokAccess,
  listTikTokAccounts,
  saveTikTokOAuthTokens,
} from '@/integrations/tiktok/resolveAccess';
import type { PrismaClient } from '@prisma/client';
import { listMemory, saveMemory, TaskQueueUnavailableError } from '@/lib/taskQueue';
import type { OrgScope } from '@/lib/taskQueue';
import { decryptToken } from '@/lib/encryption';

jest.mock('@/lib/taskQueue', () => ({
  listMemory: jest.fn(),
  saveMemory: jest.fn(),
  TaskQueueUnavailableError: jest.requireActual('@/lib/taskQueue').TaskQueueUnavailableError,
}));
jest.mock('@/lib/encryption', () => ({
  encryptToken: jest.fn(),
  decryptToken: jest.fn(),
}));

// fake fetch mínimo: só os campos que oauth.ts lê (ok/status/json).
const fakeFetch =
  (status: number, body: unknown): typeof fetch =>
  (async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;

// Shape SNAKE da resposta da API do TikTok (o que exchangeTikTokCode lê).
const exchangeBody = {
  access_token: 'AT',
  refresh_token: 'RT',
  open_id: 'OID',
  scope: 'video.publish,user.info.basic',
  expires_in: 86400,
  refresh_expires_in: 31536000,
};

const fakeClient = { __fake: 'client' } as unknown as PrismaClient;
const scope: OrgScope = { organizationId: 'org-1', userId: 'user-1' };

const Cfg: TikTokOAuthConfig = {
  clientKey: 'key',
  clientSecret: 'secret',
  redirectUri: 'http://localhost/api/auth/callback/tiktok',
};

// ============================================================================
// oauth.ts (módulo puro)
// ============================================================================

describe('oauth.ts (módulo puro)', () => {
  it('generatePkce: verifier + challenge S256 (base64url, sem padding)', () => {
    const { verifier, challenge } = generatePkce();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(verifier.length).toBeGreaterThanOrEqual(32);
  });

  it('generateOAuthState: não vazio e base64url', () => {
    expect(generateOAuthState()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('buildTikTokAuthUrl: authorize v2 com PKCE + escopos padrão', () => {
    const url = buildTikTokAuthUrl(Cfg, 'STATE', 'CHALLENGE');
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://www.tiktok.com/v2/auth/authorize/');
    expect(u.searchParams.get('client_key')).toBe('key');
    expect(u.searchParams.get('response_type')).toBe('code');
    expect(u.searchParams.get('scope')).toBe(DEFAULT_TIKTOK_SCOPES.join(','));
    expect(u.searchParams.get('state')).toBe('STATE');
    expect(u.searchParams.get('code_challenge')).toBe('CHALLENGE');
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    expect(u.searchParams.get('redirect_uri')).toBe(Cfg.redirectUri);
  });

  it('exchangeTikTokCode: 200 → converte shape SNAKE da API p/ TikTokTokenSet', async () => {
    const r = await exchangeTikTokCode(Cfg, 'CODE', 'VER', fakeFetch(200, exchangeBody));
    expect(r).toEqual({
      accessToken: 'AT',
      refreshToken: 'RT',
      openId: 'OID',
      scope: 'video.publish,user.info.basic',
      expiresIn: 86400,
      refreshExpiresIn: 31536000,
    });
  });

  it('exchangeTikTokCode: HTTP 400 + error → lança TOKEN_EXCHANGE_FAILED (c/ description)', async () => {
    await expect(
      exchangeTikTokCode(
        Cfg,
        'CODE',
        'VER',
        fakeFetch(400, { error: 'invalid_grant', error_description: 'código inválido' }),
      ),
    ).rejects.toMatchObject({ code: 'TOKEN_EXCHANGE_FAILED', message: 'código inválido' });
  });

  it('exchangeTikTokCode: 200 sem access_token → lança TikTokOAuthError', async () => {
    await expect(exchangeTikTokCode(Cfg, 'CODE', 'VER', fakeFetch(200, {}))).rejects.toBeInstanceOf(
      TikTokOAuthError,
    );
  });

  it('refreshTikTokToken: 200 → novo set (retém o refresh passado se a API não devolver)', async () => {
    const r = await refreshTikTokToken(
      Cfg,
      'RT',
      fakeFetch(200, { access_token: 'AT2', expires_in: 86400 }),
    );
    expect(r.accessToken).toBe('AT2');
    expect(r.refreshToken).toBe('RT');
    expect(r.expiresIn).toBe(86400);
  });

  it('refreshTikTokToken: falha → TOKEN_REFRESH_FAILED', async () => {
    await expect(
      refreshTikTokToken(
        Cfg,
        'RT',
        fakeFetch(401, { error: 'invalid_grant', error_description: 'refresh revogado' }),
      ),
    ).rejects.toMatchObject({ code: 'TOKEN_REFRESH_FAILED', message: 'refresh revogado' });
  });
});

// ============================================================================
// resolveTenantTikTokAccess — decrypt (fronteira taskQueue + encryption)
// ============================================================================

describe('resolveTenantTikTokAccess (decrypt OAuth vs manual)', () => {
  // Linha de AgentMemory em shape camelCase (como saveTikTokOAuthTokens grava).
  const row = (value: Record<string, unknown>) =>
    [{ key: 'integration:tiktok', value } as unknown as Awaited<ReturnType<typeof listMemory>>[number]];

  const oauthBlock = {
    oauthTokenSet: {
      accessToken: 'ENC',
      refreshToken: 'RT',
      openId: 'OID',
      scope: 'video.publish',
      expiresIn: 86400,
      refreshExpiresIn: 31536000,
      // "agora" → token fresco (tokenExpired=false, independent do relógio do teste)
      obtainedAt: new Date().toISOString(),
    },
  };

  beforeEach(() => {
    jest.mocked(listMemory).mockReset();
    jest.mocked(decryptToken).mockReset();
  });

  it('OAuth presente: descriptografa o access salvo (NUNCA devolve o ciphertext)', async () => {
    jest.mocked(listMemory).mockResolvedValue(row({ accessToken: 'ENC', ...oauthBlock }));
    jest.mocked(decryptToken).mockReturnValue('PLAIN');

    const r = await resolveTenantTikTokAccess(fakeClient, scope);

    expect(decryptToken).toHaveBeenCalledWith('ENC');
    expect(r).toEqual({
      ok: true,
      access: { accessToken: 'PLAIN' },
      hasClientKey: false,
      hasClientSecret: false,
      oauth: expect.objectContaining({ accessToken: 'ENC', openId: 'OID', refreshToken: 'RT' }),
      tokenExpired: false,
      selectedAccount: { openId: 'OID', source: 'oauth' },
      accountCount: 1,
    });
  });

  it('manual (sem oauthTokenSet): usa o token salvo PLANO, sem chamar decrypt', async () => {
    jest.mocked(listMemory).mockResolvedValue(row({ accessToken: 'MANUAL' }));

    const r = await resolveTenantTikTokAccess(fakeClient, scope);

    expect(decryptToken).not.toHaveBeenCalled();
    expect(r.ok && r.access.accessToken).toBe('MANUAL');
    expect(r.ok && r.oauth).toBeNull();
  });

  it('decrypt lança (chave ausente/corrompida) → reason decrypt_failed', async () => {
    jest.mocked(listMemory).mockResolvedValue(row({ accessToken: 'ENC', ...oauthBlock }));
    jest.mocked(decryptToken).mockImplementation(() => {
      throw new Error('META_TOKEN_ENCRYPTION_KEY missing');
    });

    const r = await resolveTenantTikTokAccess(fakeClient, scope);
    expect(r).toEqual({ ok: false, reason: 'decrypt_failed' });
  });

  it('token vazio → no_token', async () => {
    jest.mocked(listMemory).mockResolvedValue(row({ accessToken: '   ' }));
    expect(await resolveTenantTikTokAccess(fakeClient, scope)).toEqual({ ok: false, reason: 'no_token' });
  });

  it('sem integração gravada → not_connected', async () => {
    jest.mocked(listMemory).mockResolvedValue([]);
    expect(await resolveTenantTikTokAccess(fakeClient, scope)).toEqual({ ok: false, reason: 'not_connected' });
  });

  it('listMemory lançando TaskQueueUnavailableError REAL → queue_unavailable', async () => {
    jest.mocked(listMemory).mockRejectedValue(new TaskQueueUnavailableError('tabela ausente'));
    expect(await resolveTenantTikTokAccess(fakeClient, scope)).toEqual({ ok: false, reason: 'queue_unavailable' });
  });
});

// ============================================================================
// MULTICONTAS — seleção por openId / padrão determinístico / account_not_found
// ============================================================================

describe('resolveTenantTikTokAccess (multicontas via accounts[])', () => {
  // Bloco oauth reutilizável (obtidoAt fixo → determinístico, independente do relógio).
  const oauthFor = (openId: string, obtainedAt: string, token = 'ENC') => ({
    accessToken: token,
    refreshToken: 'RT',
    openId,
    scope: 'video.publish',
    expiresIn: 86400,
    refreshExpiresIn: 31536000,
    obtainedAt,
  });

  const twoAccounts = {
    clientKey: 'key',
    accounts: [
      { openId: 'OID_A', source: 'oauth', accessToken: 'ENC_A', oauthTokenSet: oauthFor('OID_A', '2026-01-01T00:00:00.000Z', 'ENC_A') },
      { openId: 'OID_B', source: 'oauth', accessToken: 'ENC_B', oauthTokenSet: oauthFor('OID_B', '2026-06-01T00:00:00.000Z', 'ENC_B') },
    ],
  };

  beforeEach(() => {
    jest.mocked(listMemory).mockReset();
    jest.mocked(saveMemory).mockReset();
    jest.mocked(decryptToken).mockReset();
  });

  it('padrão determinístico: escolhe a conta mais recente (OID_B) e reporta accountCount=2', async () => {
    jest.mocked(listMemory).mockResolvedValue([
      { key: 'integration:tiktok', value: twoAccounts } as unknown as Awaited<ReturnType<typeof listMemory>>[number],
    ]);
    jest.mocked(decryptToken).mockImplementation((c) => `PLAIN_${c}`);

    const r = await resolveTenantTikTokAccess(fakeClient, scope);

    expect(r).toMatchObject({
      ok: true,
      selectedAccount: { openId: 'OID_B', source: 'oauth' },
      accountCount: 2,
    });
    expect(r.ok && r.access.accessToken).toBe('PLAIN_ENC_B');
  });

  it('seleção explícita por openId escolhe a conta pedida (OID_A)', async () => {
    jest.mocked(listMemory).mockResolvedValue([
      { key: 'integration:tiktok', value: twoAccounts } as unknown as Awaited<ReturnType<typeof listMemory>>[number],
    ]);
    jest.mocked(decryptToken).mockImplementation((c) => `PLAIN_${c}`);

    const r = await resolveTenantTikTokAccess(fakeClient, scope, 'OID_A');

    expect(r).toMatchObject({ ok: true, selectedAccount: { openId: 'OID_A', source: 'oauth' }, accountCount: 2 });
    expect(r.ok && r.access.accessToken).toBe('PLAIN_ENC_A');
  });

  it("ref 'default' explicito → mesma semântica de conta padrão (OID_B)", async () => {
    jest.mocked(listMemory).mockResolvedValue([
      { key: 'integration:tiktok', value: twoAccounts } as unknown as Awaited<ReturnType<typeof listMemory>>[number],
    ]);
    jest.mocked(decryptToken).mockImplementation((c) => `PLAIN_${c}`);

    const r = await resolveTenantTikTokAccess(fakeClient, scope, 'default');
    expect(r.ok && r.selectedAccount?.openId).toBe('OID_B');
  });

  it('openId desconhecido → account_not_found (não vaza segredos)', async () => {
    jest.mocked(listMemory).mockResolvedValue([
      { key: 'integration:tiktok', value: twoAccounts } as unknown as Awaited<ReturnType<typeof listMemory>>[number],
    ]);

    expect(await resolveTenantTikTokAccess(fakeClient, scope, 'OID_X')).toEqual({ ok: false, reason: 'account_not_found' });
  });

  it('listTikTokAccounts devolve metadados por conta, NUNCA segredos', async () => {
    // obtainedAt fresco (relógio real) → tokenExpired=false em ambas.
    const now = new Date().toISOString();
    const freshAccounts = {
      clientKey: 'key',
      accounts: [
        { openId: 'OID_A', source: 'oauth', accessToken: 'ENC_A', oauthTokenSet: oauthFor('OID_A', now, 'ENC_A') },
        { openId: 'OID_B', source: 'oauth', accessToken: 'ENC_B', oauthTokenSet: oauthFor('OID_B', now, 'ENC_B') },
      ],
    };
    jest.mocked(listMemory).mockResolvedValue([
      { key: 'integration:tiktok', value: freshAccounts } as unknown as Awaited<ReturnType<typeof listMemory>>[number],
    ]);

    const list = await listTikTokAccounts(fakeClient, scope);
    expect(list).toEqual([
      { openId: 'OID_A', source: 'oauth', obtainedAt: now, tokenExpired: false },
      { openId: 'OID_B', source: 'oauth', obtainedAt: now, tokenExpired: false },
    ]);
    // Nenhum campo de segredo vaza para a UI.
    expect(JSON.stringify(list)).not.toContain('ENC_');
    expect(JSON.stringify(list)).not.toContain('PLAIN_');
  });

  it('listTikTokAccounts: tenant sem integração → [] (e não lança em queue_unavailable)', async () => {
    jest.mocked(listMemory).mockResolvedValue([]);
    expect(await listTikTokAccounts(fakeClient, scope)).toEqual([]);
    jest.mocked(listMemory).mockRejectedValue(new TaskQueueUnavailableError('x'));
    expect(await listTikTokAccounts(fakeClient, scope)).toEqual([]);
  });
});

// ============================================================================
// saveTikTokOAuthTokens — merge não-sobrepóente (preserva as demais contas)
// ============================================================================

describe('saveTikTokOAuthTokens (merge multicontas)', () => {
  beforeEach(() => {
    jest.mocked(listMemory).mockReset();
    jest.mocked(saveMemory).mockReset();
  });

  it('nova conta por openId: acrescenta, PRESERVA as demais e atualiza o campo legado p/ a mais recente', async () => {
    jest.mocked(listMemory).mockResolvedValue([
      {
        key: 'integration:tiktok',
        value: {
          accounts: [
            { openId: 'OID_A', source: 'oauth', accessToken: 'ENC_A', oauthTokenSet: { openId: 'OID_A', obtainedAt: '2026-01-01T00:00:00.000Z' } },
          ],
        },
      } as unknown as Awaited<ReturnType<typeof listMemory>>[number],
    ]);
    jest.mocked(saveMemory).mockResolvedValue(undefined);

    await saveTikTokOAuthTokens(fakeClient, scope, {
      accessToken: 'NEW',
      refreshToken: 'RT_B',
      openId: 'OID_B',
      scope: 'video.publish',
      expiresIn: 86400,
      refreshExpiresIn: 31536000,
    } as never, 'ENC_B');

    expect(saveMemory).toHaveBeenCalledTimes(1);
    const [, , , , value] = jest.mocked(saveMemory).mock.calls[0] as unknown as [unknown, unknown, string, string, Record<string, unknown>];
    const accounts = value.accounts as Array<Record<string, unknown>>;
    expect(accounts).toHaveLength(2);
    // OID_A preservado intacto; OID_B adicionado com o novo ciphertext.
    expect(accounts[0].openId).toBe('OID_A');
    expect(accounts[0].accessToken).toBe('ENC_A');
    expect(accounts[1].openId).toBe('OID_B');
    expect(accounts[1].accessToken).toBe('ENC_B');
    // Legado aponta para a conta mais recente (a recém-gravada).
    expect(value.accessToken).toBe('ENC_B');
  });

  it('mesmo openId existente: ATUALIZA in place (não duplica), mesmo contagem', async () => {
    jest.mocked(listMemory).mockResolvedValue([
      {
        key: 'integration:tiktok',
        value: {
          accounts: [
            { openId: 'OID_A', source: 'oauth', accessToken: 'ENC_A_OLD', oauthTokenSet: { openId: 'OID_A', obtainedAt: '2026-01-01T00:00:00.000Z' } },
          ],
        },
      } as unknown as Awaited<ReturnType<typeof listMemory>>[number],
    ]);
    jest.mocked(saveMemory).mockResolvedValue(undefined);

    await saveTikTokOAuthTokens(fakeClient, scope, {
      accessToken: 'NEW',
      refreshToken: 'RT',
      openId: 'OID_A',
      scope: 'video.publish',
      expiresIn: 86400,
      refreshExpiresIn: 31536000,
    } as never, 'ENC_A_NEW');

    const value = jest.mocked(saveMemory).mock.calls[0][4] as unknown as Record<string, unknown>;
    const accounts = value.accounts as Array<Record<string, unknown>>;
    expect(accounts).toHaveLength(1);
    expect(accounts[0].openId).toBe('OID_A');
    expect(accounts[0].accessToken).toBe('ENC_A_NEW'); // refresh/sobrescreve a MESMA entrada
  });

  it('tenant vazio (sem integração): cria accounts[] com a primeira conta', async () => {
    jest.mocked(listMemory).mockResolvedValue([]);
    jest.mocked(saveMemory).mockResolvedValue(undefined);

    await saveTikTokOAuthTokens(fakeClient, scope, {
      accessToken: 'NEW',
      refreshToken: 'RT',
      openId: 'OID_C',
      scope: 'video.publish',
      expiresIn: 86400,
      refreshExpiresIn: 31536000,
    } as never, 'ENC_C');

    const value = jest.mocked(saveMemory).mock.calls[0][4] as unknown as Record<string, unknown>;
    const accounts = value.accounts as Array<Record<string, unknown>>;
    expect(accounts).toHaveLength(1);
    expect(accounts[0].openId).toBe('OID_C');
  });
});
