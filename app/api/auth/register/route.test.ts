// app/api/auth/register/route.test.ts
//
// Rota de cadastro: prova o P4-2 (registro-zumbi). Onboarding de falha →
// compensação com `admin.auth.admin.deleteUser` (melhor esforço, nunca
// mascara o erro original) e 500 honesto — usuário NÃO fica com sessão
// GoTrue válida mas sem public."User" (getAuthenticatedUser → null → bloqueio
// permanente). Caminho feliz segue 201; faltas de campo / erro de signUp seguem 400.
//
// Mock da fronteira Supabase (src/lib/supabase/server) e do admin service-role:
// zero rede, zero banco no jest.

import { POST } from './route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createServiceRoleClient: jest.fn(),
}));

const { createClient, createServiceRoleClient } = jest.requireMock('@/lib/supabase/server') as {
  createClient: jest.Mock;
  createServiceRoleClient: jest.Mock;
};

const signupUser = (over: Record<string, unknown> = {}) => ({
  user: {
    id: 'u1',
    email: 'nova@exemplo.com',
    email_confirmed_at: null,
    user_metadata: {},
    app_metadata: {},
    ...over,
  },
});

/**
 * Admin mock configurável: onboarding (inserts por tabela) + compensação
 * (deleteUser + deletes de resíduo público por tabela). `builders` expõe os
 * spies de insert/delete/eq por tabela para as asserts de limpeza.
 */
function setupAdmin(opts: {
  /** Erro de insert aplicado a TODAS as tabelas (fallback). */
  onboardingError?: { code: string; message: string };
  /** Erro de insert POR tabela — vence `onboardingError` quando presente. `null` = ok. */
  tableInsertError?: Partial<Record<'User' | 'Organization' | 'OrganizationMember', { code: string; message: string } | null>>;
  /** Implementação de `deleteUser` (padrão: sucesso). */
  deleteUser?: jest.Mock;
}) {
  type Tbl = 'User' | 'Organization' | 'OrganizationMember';
  const builders: Record<string, { insert: jest.Mock; delete: jest.Mock; eq: jest.Mock }> = {};
  const from = jest.fn((table: string) => {
    if (!builders[table]) {
      const eq = jest.fn();
      const insert = jest.fn(async () => {
        const tErr = opts.tableInsertError?.[table as Tbl];
        return { error: tErr !== undefined ? tErr : (opts.onboardingError ?? null) };
      });
      const del = jest.fn(() => ({ eq }));
      builders[table] = { insert, delete: del, eq };
    }
    return { insert: builders[table].insert, delete: builders[table].delete };
  });
  const deleteUser =
    opts.deleteUser ?? jest.fn(async () => ({ error: null }));
  const admin = {
    from,
    auth: { admin: { deleteUser } },
  };
  createServiceRoleClient.mockReturnValue(admin);
  return { from, deleteUser, builders, admin };
}

function signUpOk() {
  createClient.mockResolvedValue({
    auth: { signUp: jest.fn(async () => ({ data: signupUser(), error: null })) },
  });
}

const mkReq = (body: unknown) =>
  new NextRequest('http://localhost/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/auth/register', () => {
  it('campos ausentes → 400 missing_fields (nada toca o admin)', async () => {
    const res = await POST(mkReq({ email: 'nova@exemplo.com' })); // sem name/password
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'missing_fields' });
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });

  it('signUp com erro → 400 registration_failed (onboarding não chega a rodar) + erro rastreado no log', async () => {
    createClient.mockResolvedValue({
      auth: { signUp: jest.fn(async () => ({ data: null, error: { code: '23505', message: 'email em uso' } })) },
    });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(mkReq({ name: 'N', email: 'nova@exemplo.com', password: 'segredo' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'registration_failed' });
    expect(createServiceRoleClient).not.toHaveBeenCalled();
    // Diagnóstico sem segredo/PII: metadados do erro GoTrue no runtime log (hPanel).
    expect(spy).toHaveBeenCalledWith(
      '[register] GoTrue signUp failed:',
      expect.objectContaining({ code: '23505' }),
    );
    spy.mockRestore();
  });

  it('caminho feliz: onboarding ok → 201, deleteUser E deletes públicos NÃO chamados', async () => {
    signUpOk();
    const { deleteUser, builders } = setupAdmin({});
    const res = await POST(mkReq({ name: 'N', email: 'nova@exemplo.com', password: 'segredo' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user).toMatchObject({ id: 'u1', email: 'nova@exemplo.com' });
    expect(deleteUser).not.toHaveBeenCalled();
    // onboarding saudável não toca a compensação: nenhuma linha pública é apagada.
    expect(builders['User'].delete).not.toHaveBeenCalled();
    expect(builders['Organization'].delete).not.toHaveBeenCalled();
    expect(builders['OrganizationMember'].delete).not.toHaveBeenCalled();
  });

  it('P4-2: onboarding falhou + rollback ok → 500 onboarding_rolled_back', async () => {
    signUpOk();
    const { deleteUser } = setupAdmin({
      onboardingError: { code: '42P01', message: 'db fora' },
      deleteUser: jest.fn(async () => ({ error: null })),
    });
    const res = await POST(mkReq({ name: 'N', email: 'nova@exemplo.com', password: 'segredo' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'registration_failed', detail: 'onboarding_rolled_back' });
    // Compensação remove o usuário meia-calça de GoTrue pelo id:
    expect(deleteUser).toHaveBeenCalledWith('u1');
  });

  it('P4-2: onboarding falhou + rollback FALHOU → 500 onboarding_residual (resposta não quebra)', async () => {
    signUpOk();
    const { deleteUser } = setupAdmin({
      onboardingError: { code: '42P01', message: 'db fora' },
      deleteUser: jest.fn(async () => {
        throw new Error('admin auth fora do ar');
      }),
    });
    const res = await POST(mkReq({ name: 'N', email: 'nova@exemplo.com', password: 'segredo' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'registration_failed', detail: 'onboarding_residual' });
    // Tentou compensar (1×) mas o rollback falhou → estado residual, logado sem segredos:
    expect(deleteUser).toHaveBeenCalledTimes(1);
  });

  it('P4-2: onboarding PARCIAL (User ok, Organization falha) → 500 + resíduo público limpo', async () => {
    // Cenário que quebra re-registro: public."User" já criada (e-mail UNIQUE),
    // mas Organization falha. A compensação precisa apagar a linha órfã de
    // public."User" (GoTrue não tem cascade p/ ela) — senão o e-mail fica
    // permanentemente bloqueado.
    signUpOk();
    const { deleteUser, builders } = setupAdmin({
      tableInsertError: { User: null, Organization: { code: '42P01', message: 'db fora no org' } },
    });
    const res = await POST(mkReq({ name: 'N', email: 'nova@exemplo.com', password: 'segredo' }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'registration_failed', detail: 'onboarding_rolled_back' });
    // matou o GoTrue (meta principal):
    expect(deleteUser).toHaveBeenCalledWith('u1');
    // limpou o resíduo público que onboarding criou ANTES de falhar (child → parent):
    expect(builders['OrganizationMember'].delete).toHaveBeenCalled();
    expect(builders['Organization'].delete).toHaveBeenCalled();
    expect(builders['User'].delete).toHaveBeenCalled();
    // ... apagou EXATAMENTE as linhas que onboarding criou/gerou (orgId threadado na falha):
    const orgId = builders['Organization'].insert.mock.calls[0][0].id;
    expect(orgId).toBeDefined();
    expect(builders['Organization'].eq).toHaveBeenCalledWith('id', orgId);
    expect(builders['User'].eq).toHaveBeenCalledWith('id', 'u1');
    expect(builders['OrganizationMember'].eq).toHaveBeenCalledWith('userId', 'u1');
  });
});
