import { deleteAllChannels, ChannelDecrypted, getChannelDecrypted, getChannelByPhoneNumberId, markChannelConnected } from '../channelRepo';

describe('channelRepo', () => {
  const mockEq = jest.fn().mockResolvedValue({ data: null, error: null });
  const mockDelete = jest.fn().mockReturnValue({ eq: mockEq });
  const mockFrom = jest.fn().mockReturnValue({ delete: mockDelete });
  const mockSelect = jest.fn().mockReturnValue({ eq: mockEq, maybeSingle: mockEq });
  const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
  const mockUpsert = jest.fn().mockResolvedValue({ error: null });
  const mockClient = {
    from: jest.fn().mockImplementation((table) => {
      if (table === 'whatsapp_channels') {
        return {
          delete: mockDelete,
          select: mockSelect,
          update: mockUpdate,
          upsert: mockUpsert,
        };
      }
      return { delete: mockDelete, select: mockSelect, update: mockUpdate, upsert: mockUpsert };
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('deleteAllChannels', () => {
    it('remove canais para organizationId específico', async () => {
      await deleteAllChannels(mockClient as any, 'org-123');

      expect(mockFrom).toHaveBeenCalledWith('whatsapp_channels');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('organizationId', 'org-123');
    });

    it('lança erro se client não estiver disponível', async () => {
      const badClient = null as any;

      await expect(deleteAllChannels(badClient, 'org-456')).rejects.toThrow();
    });

    it('usa o organizationId correto e NÃO usa user_id (tenant-safe)', async () => {
      // Garante que não confundimos organizationId com user_id
      // Esta é a proteção contra IDOR
      await deleteAllChannels(mockClient as any, 'tenant-abc');

      // Verifica que foi chamado com o organizationId correto
      const eqCalls = mockEq.mock.calls;
      const orgCall = eqCalls.find(c => c[0] === 'organizationId');
      expect(orgCall).toBeDefined();
      expect(orgCall![1]).toBe('tenant-abc');

      // Nenhum call deve usar user_id
      const userIdCalls = eqCalls.filter(c => c[0] === 'user_id');
      expect(userIdCalls).toHaveLength(0);
    });
  });

  describe('getChannelDecrypted', () => {
    it('retorna canal com access_token decifrado quando conectado via Meta', async () => {
      const mockRow: WhatsappChannelRow = {
        id: 'chan-1',
        organizationId: 'org-1',
        provider: 'openbsp',
        status: 'CONNECTED',
        onboardingTokenId: null,
        callbackUrl: null,
        verifyToken: 'token',
        wabaId: 'waba-1',
        phoneNumberId: 'phone-1',
        phoneNumber: '+5511999999999',
        verifiedName: 'Loja Teste',
        accessTokenEnc: 'encrypted-token',
        tierLimitPer24h: 250,
        sentWindow24h: 0,
        windowStartedAt: null,
        lastError: null,
      };

      mockClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: mockRow, error: null }),
        }),
      });

      // Este teste requer a função encrypt/decrypt, mockando os imports
      jest.doMock('@/lib/encryption', () => ({
        decryptToken: jest.fn().mockReturnValue('decrypted-access-token'),
      }));

      const result = await getChannelDecrypted(mockClient as any, 'org-1');
      expect(result).toBeDefined();
    });

    it('retorna isOpenBSPConnected = true quando phoneNumberId presente', async () => {
      const mockRow: WhatsappChannelRow = {
        id: 'chan-2',
        organizationId: 'org-2',
        provider: 'openbsp',
        status: 'CONNECTED',
        onboardingTokenId: null,
        callbackUrl: null,
        verifyToken: 'token',
        wabaId: null,
        phoneNumberId: 'phone-123',
        phoneNumber: '+5511888888888',
        verifiedName: 'OpenBSP Store',
        accessTokenEnc: null,
        tierLimitPer24h: 250,
        sentWindow24h: 0,
        windowStartedAt: null,
        lastError: null,
      };

      mockClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: mockRow, error: null }),
        }),
      });

      const result = await getChannelDecrypted(mockClient as any, 'org-2');
      // Se phoneNumberId existe, isOpenBSPConnected deve ser truthy
      expect(result?.isOpenBSPConnected).toBe(true);
    });

    it('retorna null quando canal não existe', async () => {
      mockClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
        }),
      });

      const result = await getChannelDecrypted(mockClient as any, 'org-999');
      expect(result).toBeNull();
    });

    it('verifica tenant isolation - retorna apenas canal do org solicitado', async () => {
      // Garante que getChannelDecrypted não vaza dados de outro tenant
      mockClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockImplementation((col, val) => {
            // O código deve filtrar por organizationId, não user_id
            expect(col).toBe('organizationId');
            expect(val).toBe('org-isolated');
            return Promise.resolve({ data: null, error: null });
          }),
        }),
      });

      await getChannelDecrypted(mockClient as any, 'org-isolated');
    });
  });

  describe('markChannelConnected', () => {
    it('atualiza status para CONNECTED com credenciais do plano OpenBSP', async () => {
      mockClient.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      const creds = {
        phoneNumberId: 'phone-123',
        phoneNumber: '+5511999999999',
        verifiedName: 'Loja Teste',
        accessToken: 'access-token-secret',
        wabaId: null,
      };

      await markChannelConnected(mockClient as any, 'org-1', creds);

      expect(mockClient.from).toHaveBeenCalledWith('whatsapp_channels');
      const updateCall = mockClient.from().update;
      expect(updateCall).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'CONNECTED',
          phoneNumberId: 'phone-123',
          phoneNumber: '+5511999999999',
          verifiedName: 'Loja Teste',
        }),
      );
    });
  });

  describe('getChannelByPhoneNumberId', () => {
    it('busca canal pelo phone_number_id (roteamento do webhook)', async () => {
      mockClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockImplementation((col, val) => {
            expect(col).toBe('phoneNumberId');
            expect(val).toBe('phone-number-123');
            return Promise.resolve({ data: { id: 'chan-1' }, error: null });
          }),
        }),
      });

      const result = await getChannelByPhoneNumberId(mockClient as any, 'phone-number-123');
      expect(result).toBeDefined();
      expect(result?.id).toBe('chan-1');
    });

    it('retorna null quando webhook não encontrado', async () => {
      mockClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockImplementation(() =>
            Promise.resolve({ data: null, error: { code: 'PGRST116' } })
          ),
        }),
      });

      const result = await getChannelByPhoneNumberId(mockClient as any, 'unknown-phone');
      expect(result).toBeNull();
    });
  });
});

// Tipos auxiliares para os testes
interface WhatsappChannelRow {
  id: string;
  organizationId: string;
  provider: string;
  status: string;
  onboardingTokenId: string | null;
  callbackUrl: string | null;
  verifyToken: string;
  wabaId: string | null;
  phoneNumberId: string | null;
  phoneNumber: string | null;
  verifiedName: string | null;
  accessTokenEnc: string | null;
  tierLimitPer24h: number;
  sentWindow24h: number;
  windowStartedAt: string | null;
  lastError: string | null;
}

// Re-exportando para uso nos testes
export type { WhatsappChannelRow };