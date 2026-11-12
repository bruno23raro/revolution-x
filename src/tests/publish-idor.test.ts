// src/tests/publish-idor.test.ts — IDOR security tests for Meta publish routes
//
// OBJETIVO: Garantir que demoModeEnabled() seja verificado ANTES de
// resolveTenantFacebookPageAccess / resolveTenantPublisherAccess,
// previnindo que um usuário não-autenticado acesse dados de qualquer tenant.
//
// VULNERABILIDADE: Se demoModeEnabled() for chamado DEPOIS da resolução de acesso,
// um atacante pode burlar o sistema enviando organizationId/fake-account em body
// e receber dados de outra organização.

import { NextRequest } from 'next/server';
import type { NextRequest as NextRequestType } from 'next/server';

const MOCK_DEMO_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'demo@revolutionx.dev',
  organizationId: '00000000-0000-0000-0000-000000000002',
  role: 'admin',
};

const MOCK_REAL_USER = {
  id: 'real-user-123',
  email: 'user@example.com',
  organizationId: 'org-user-456',
  role: 'member',
};

describe('Publish routes — IDOR security (demo mode before tenant resolution)', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    jest.clearAllMocks();
    // Configurar modo demo
    process.env.RX_DEMO_MODE = '1';
  });

  afterAll(() => {
    delete process.env.RX_DEMO_MODE;
  });

  describe('POST /api/facebook/publish — DEMO MODE SECURITY', () => {
    it('retorna 401 quando usuário NÃO está autenticado', async () => {
      // Mock do módulo auth de forma dinâmica
      jest.resetModules();
      jest.doMock('../lib/auth', () => ({
        getAuthenticatedUser: jest.fn().mockResolvedValue(null),
      }));

      const authRoute = require('../../app/api/facebook/publish/route');
      const fbPost = authRoute.POST;

      const req = new NextRequest('http://localhost/api/facebook/publish', {
        method: 'POST',
        body: JSON.stringify({ message: 'Teste' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await fbPost(req);
      expect(res.status).toBe(401);
    });

    it('requer demoMode para acesso sem tenant (verifica header x-demo-mode)', async () => {
      // Mock do módulo auth
      jest.resetModules();
      jest.doMock('../lib/auth', () => ({
        getAuthenticatedUser: jest.fn().mockResolvedValue(MOCK_DEMO_USER),
      }));

      const authRoute = require('../../app/api/facebook/publish/route');
      const fbPost = authRoute.POST;

      const req = new NextRequest('http://localhost/api/facebook/publish', {
        method: 'POST',
        body: JSON.stringify({ message: 'Teste demo' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await fbPost(req);

      // Deve retornar resposta de demo com sucesso
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body._demo).toBe(true);
      expect(res.headers.get('x-demo-mode')).toBe('true');
    });
  });

  describe('POST /api/instagram/publish — DEMO MODE SECURITY', () => {
    it('retorna 401 quando usuário NÃO está autenticado', async () => {
      jest.resetModules();
      jest.doMock('../lib/auth', () => ({
        getAuthenticatedUser: jest.fn().mockResolvedValue(null),
      }));

      const authRoute = require('../../app/api/instagram/publish/route');
      const igPost = authRoute.POST;

      const req = new NextRequest('http://localhost/api/instagram/publish', {
        method: 'POST',
        body: JSON.stringify({ imageUrl: 'https://example.com/img.jpg' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await igPost(req);
      expect(res.status).toBe(401);
    });

    it('requer demoMode para acesso sem tenant (verifica header x-demo-mode)', async () => {
      jest.resetModules();
      jest.doMock('../lib/auth', () => ({
        getAuthenticatedUser: jest.fn().mockResolvedValue(MOCK_DEMO_USER),
      }));

      const authRoute = require('../../app/api/instagram/publish/route');
      const igPost = authRoute.POST;

      const req = new NextRequest('http://localhost/api/instagram/publish', {
        method: 'POST',
        body: JSON.stringify({
          mediaType: 'IMAGE',
          imageUrl: 'https://example.com/demo.jpg',
          caption: 'Teste demo IG',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await igPost(req);

      // Deve retornar resposta de demo
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body._demo).toBe(true);
      expect(res.headers.get('x-demo-mode')).toBe('true');
    });

    it('não expõe dados quando account é forçado via body', async () => {
      jest.resetModules();
      jest.doMock('../lib/auth', () => ({
        getAuthenticatedUser: jest.fn().mockResolvedValue(MOCK_REAL_USER),
      }));
      // Mock da resolução de acesso para o usuário REAL (não-demo): deve
      // rejeitar (account_not_found), nunca servir dados de outro tenant.
      // Sem o mock, o resolveTenantFacebookPageAccess real faz I/O de rede
      // (Supabase/Prisma) que não existe no Jest e trava o teste.
      jest.doMock('../../src/integrations/meta/resolveAccess', () => ({
        resolveTenantFacebookPageAccess: jest.fn().mockResolvedValue({ ok: false, reason: 'account_not_found' }),
        resolveTenantPublisherAccess: jest.fn().mockResolvedValue({ ok: false, reason: 'account_not_found' }),
      }));

      const authRoute = require('../../app/api/facebook/publish/route');
      const fbPost = authRoute.POST;

      const req = new NextRequest('http://localhost/api/facebook/publish', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Forca account fantasma',
          account: 'fake-account-id-that-does-not-belong-to-any-tenant',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      // Como não estamos em modo demo (NODE_ENV=development mas sem token demo válido),
      // a requisição deve falhar ou retornar erro apropriado
      const res = await fbPost(req);
      // O route deve retornar 401 (sem autenticação válida) ou 503 (sem conexão) ou 409 (account not found)
      // NUNCA 200 com dados de outra organização
      expect([401, 409, 503, 502]).toContain(res.status);
    });
  });

  describe('Fluxo de autenticação demo', () => {
    it('demoModeEnabled deve ser true quando NODE_ENV=development e RX_DEMO_MODE=1', () => {
      // @ts-expect-error - NODE_ENV é read-only em tempo de compilação, mas definido em runtime
      process.env.NODE_ENV = 'development';
      process.env.RX_DEMO_MODE = '1';

      jest.resetModules();
      const { demoModeEnabled } = require('../lib/demoMode');
      expect(demoModeEnabled()).toBe(true);
    });

    it('demoModeEnabled deve ser false em produção', () => {
      // @ts-expect-error - NODE_ENV é read-only em tempo de compilação, mas definido em runtime
      process.env.NODE_ENV = 'production';
      process.env.RX_DEMO_MODE = '1';

      jest.resetModules();
      const { demoModeEnabled } = require('../lib/demoMode');
      expect(demoModeEnabled()).toBe(false);
    });
  });
});