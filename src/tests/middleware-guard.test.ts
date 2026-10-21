// src/tests/middleware-guard.test.ts
//
// Guarda do middleware quando NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
// estão ausentes (prévia/ambiente sem Supabase). Propriedade de segurança-chave:
//
//   • Caminho saudável (env presente) → comportamento EXATAMENTE como antes
//     (getUser + lookup de org → cookie x-organization-id). Zero regressão.
//   • Env ausente + PRODUÇÃO → falha FECHADA (fail-closed):
//       - API privada (/api/*)  → 503 "Authentication service is not configured";
//       - página privada        → redirect p/ /login (nunca finge autenticação);
//       - rotas públicas        → seguem renderizando (shell público).
//   • Env ausente + NÃO-prod → preview renderiza (200), mas NUNCA libera dado
//     privado: as APIs ainda validam auth no próprio fluxo (getAuthenticatedUser).
//
// Uma configuração ausente pode BLOQUEAR funcionalidades, mas não pode LIBERAR
// acesso privado. Este teste trava essa propriedade.

import { NextRequest } from 'next/server';

// Mockamos os dois módulos de auth/DB para que o caminho de "env ausente" rode
// SEM tocar Supabase/Prisma, e para inspecionar o caminho saudável de forma isolada.
jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));
jest.mock('../../src/lib/supabase/server', () => ({ createServiceRoleClient: jest.fn() }));

const { createServerClient } = jest.requireMock('@supabase/ssr');
const { createServiceRoleClient } = jest.requireMock('../../src/lib/supabase/server');
const { middleware } = require('../../middleware');

// NODE_ENV é tipado como read-only em alguns @types/node — escrevemos via alias com cast.
const env = process.env as Record<string, string | undefined>;

function req(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`);
}

describe('middleware guard — Supabase ausente (fail-closed)', () => {
  const saved = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    node: process.env.NODE_ENV,
  };
  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = saved.url;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = saved.anon;
    env.NODE_ENV = saved.node;
  });

  function clearEnv() {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }

  it('produção + API privada → 503 (não libera, degrada fechado)', async () => {
    clearEnv();
    env.NODE_ENV = 'production';
    const res = await middleware(req('/api/crm/contacts'));
    expect(res.status).toBe(503);
    expect(await res.text()).toMatch(/not configured/i);
  });

  it('produção + página privada → redirect p/ /login', async () => {
    clearEnv();
    env.NODE_ENV = 'production';
    const res = await middleware(req('/dashboard'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('produção + landing pública → passa (200)', async () => {
    clearEnv();
    env.NODE_ENV = 'production';
    expect((await middleware(req('/'))).status).toBe(200);
  });

  it('produção + rotas públicas de auth/onboarding → passam', async () => {
    clearEnv();
    env.NODE_ENV = 'production';
    for (const p of [
      '/login',
      '/register',
      '/forgot-password',
      '/reset-password',
      '/verify-email',
      '/onboarding/success',
      '/onboarding/error',
    ]) {
      expect((await middleware(req(p))).status).toBe(200);
    }
  });

  it('produção + /testcenter (fora da lista pública) → redirect p/ /login (seguro)', async () => {
    clearEnv();
    env.NODE_ENV = 'production';
    const res = await middleware(req('/testcenter'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('não-prod + env ausente + qualquer rota → renderiza (200) p/ preview; API ainda valida no fluxo', async () => {
    clearEnv();
    env.NODE_ENV = 'development';
    for (const p of ['/dashboard', '/api/crm/contacts', '/testcenter']) {
      expect((await middleware(req(p))).status).toBe(200);
    }
  });
});

describe('middleware caminho saudável — env presente (sem regressão)', () => {
  const saved = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    node: process.env.NODE_ENV,
  };
  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = saved.url;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = saved.anon;
    env.NODE_ENV = saved.node;
    jest.resetAllMocks();
  });

  it('env presente + usuário com org → define x-organization-id (httpOnly, sameSite=strict)', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-test';
    env.NODE_ENV = 'test';
    (createServerClient as jest.Mock).mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    });
    (createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [{ organizationId: 'org-abc' }] }),
        }),
      }),
    });

    const res = await middleware(req('/dashboard'));
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('x-organization-id=org-abc');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toMatch(/SameSite=strict/i); // Next serializa como "strict"
  });

  it('env presente + usuário em MULTIPLAS orgs → define a 1ª, sem lançar (regressão maybeSingle)', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-test';
    env.NODE_ENV = 'test';
    (createServerClient as jest.Mock).mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    });
    (createServiceRoleClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [{ organizationId: 'org-first' }, { organizationId: 'org-second' }],
          }),
        }),
      }),
    });

    const res = await middleware(req('/dashboard'));
    expect(res.status).toBe(200);
    // Antes do fix, maybeSingle() lançava (2 linhas) e o catch engolia → sem cookie.
    expect(res.headers.get('set-cookie') ?? '').toContain('x-organization-id=org-first');
  });

  it('env presente + sem usuário → response neutra, sem cookie de org', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-test';
    env.NODE_ENV = 'test';
    (createServerClient as jest.Mock).mockReturnValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    });
    (createServiceRoleClient as jest.Mock).mockReturnValue({ from: jest.fn() });

    const res = await middleware(req('/dashboard'));
    expect(res.status).toBe(200);
    expect((res.headers.get('set-cookie') ?? '')).not.toContain('x-organization-id');
  });
});
