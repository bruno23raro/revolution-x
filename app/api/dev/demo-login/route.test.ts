import { POST } from './route';

// Mock do Next.js cookies
const mockCookies = {
  set: jest.fn(),
  get: jest.fn(),
};

jest.mock('next/headers', () => ({
  cookies: () => Promise.resolve(mockCookies),
}));

jest.mock('@/lib/demoMode', () => ({
  demoModeEnabled: jest.fn(),
  isDemoToken: jest.fn(),
  decodeDemoToken: jest.fn(),
  DEMO_IDENTITIES: {
    USER_ID: '00000000-0000-0000-0000-000000000001',
    ORG_ID: '00000000-0000-0000-0000-000000000002',
    EMAIL: 'demo@revolutionx.dev',
  },
}));

describe('POST /api/dev/demo-login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Segurança - Produção e Demo Desativado', () => {
    it('retorna 403 quando demo mode está desativado', async () => {
      const { demoModeEnabled } = jest.requireMock('@/lib/demoMode');
      (demoModeEnabled as jest.Mock).mockReturnValue(false);

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('demo_mode_disabled');
    });
  });

  describe('Fluxo de Login Demo', () => {
    it('configura cookies e retorna usuário demo quando demo mode está habilitado', async () => {
      const { demoModeEnabled } = jest.requireMock('@/lib/demoMode');
      (demoModeEnabled as jest.Mock).mockReturnValue(true);

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.demo).toBe(true);
      expect(data.user.id).toBe('00000000-0000-0000-0000-000000000001');
      expect(data.user.email).toBe('demo@revolutionx.dev');
      expect(data.user.organizationId).toBe('00000000-0000-0000-0000-000000000002');
      expect(data.user.role).toBe('admin');
    });

    it('define cookies de sessão sb:token e sb-refresh-token', async () => {
      const { demoModeEnabled } = jest.requireMock('@/lib/demoMode');
      (demoModeEnabled as jest.Mock).mockReturnValue(true);

      await POST();

      expect(mockCookies.set).toHaveBeenCalledWith(
        'sb:token',
        expect.stringMatching(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/), // JWT format
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        })
      );
      expect(mockCookies.set).toHaveBeenCalledWith(
        'sb-refresh-token',
        expect.stringContaining('demo_refresh_'),
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        })
      );
    });

    it('define cookie x-organization-id', async () => {
      const { demoModeEnabled } = jest.requireMock('@/lib/demoMode');
      (demoModeEnabled as jest.Mock).mockReturnValue(true);

      await POST();

      expect(mockCookies.set).toHaveBeenCalledWith(
        'x-organization-id',
        '00000000-0000-0000-0000-000000000002',
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        })
      );
    });
  });
});