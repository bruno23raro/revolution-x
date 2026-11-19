import { deleteAllChannels, ChannelDecrypted, getChannelDecrypted, getChannelByPhoneNumberId, markChannelConnected, upsertChannelPending, setChannelStatus, bumpSentWindow, WhatsappChannelRow } from '../channelRepo';
import { prisma } from '@/lib/prisma';

// Mock Prisma
const mockDeleteMany = jest.fn();
const mockFindUnique = jest.fn();
const mockFindFirst = jest.fn();
const mockUpsert = jest.fn();
const mockUpdate = jest.fn();
const mockUpdateMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    whatsappChannel: {
      deleteMany: mockDeleteMany,
      findUnique: mockFindUnique,
      findFirst: mockFindFirst,
      upsert: mockUpsert,
      update: mockUpdate,
      updateMany: mockUpdateMany,
    },
    whatsappTemplate: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      findFirst: jest.fn(),
    },
    $executeRaw: jest.fn(),
  },
}));

jest.mock('@/lib/encryption', () => ({ encryptToken: jest.fn((t: string) => 'enc:' + t), decryptToken: jest.fn() }));

describe('channelRepo (Prisma)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('deleteAllChannels', () => {
    it('remove canais para organizationId específico', async () => {
      mockDeleteMany.mockResolvedValue({ count: 1 });

      await deleteAllChannels('org-123');

      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-123' },
      });
    });

    it('usa o organizationId correto e NÃO usa user_id (tenant-safe)', async () => {
      mockDeleteMany.mockResolvedValue({ count: 1 });

      await deleteAllChannels('tenant-abc');

      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: { organizationId: 'tenant-abc' },
      });
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

      mockFindUnique.mockResolvedValue(mockRow as any);
      const { decryptToken } = require('@/lib/encryption');
      decryptToken.mockReturnValue('decrypted-access-token');

      const result = await getChannelDecrypted('org-1');
      expect(result).toBeDefined();
      expect(result?.accessToken).toBe('decrypted-access-token');
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

      mockFindUnique.mockResolvedValue(mockRow as any);

      const result = await getChannelDecrypted('org-2');
      expect(result?.isOpenBSPConnected).toBe(true);
    });

    it('retorna null quando canal não existe', async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await getChannelDecrypted('org-999');
      expect(result).toBeNull();
    });
  });

  describe('markChannelConnected', () => {
    it('atualiza status para CONNECTED com credenciais do plano OpenBSP', async () => {
      mockUpdate.mockResolvedValue({} as any);

      const creds = {
        phoneNumberId: 'phone-123',
        phoneNumber: '+5511999999999',
        verifiedName: 'Loja Teste',
        accessToken: 'access-token-secret',
        wabaId: null,
      };

      await markChannelConnected('org-1', creds);

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        data: expect.objectContaining({
          status: 'CONNECTED',
          phoneNumberId: 'phone-123',
          phoneNumber: '+5511999999999',
          verifiedName: 'Loja Teste',
        }),
      });
    });
  });

  describe('getChannelByPhoneNumberId', () => {
    it('busca canal pelo phone_number_id (roteamento do webhook)', async () => {
      mockFindFirst.mockResolvedValue({ id: 'chan-1' } as any);

      const result = await getChannelByPhoneNumberId('phone-number-123');
      expect(result).toBeDefined();
      expect(result?.id).toBe('chan-1');
    });

    it('retorna null quando webhook não encontrado', async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await getChannelByPhoneNumberId('unknown-phone');
      expect(result).toBeNull();
    });
  });

  describe('upsertChannelPending', () => {
    it('cria ou atualiza canal PENDING com verify_token único', async () => {
      mockUpsert.mockResolvedValue({} as any);

      await upsertChannelPending({
        organizationId: 'org-1',
        verifyToken: 'token-123',
        callbackUrl: 'https://example.com/callback',
        onboardingTokenId: 'token-id-123',
      });

      expect(mockUpsert).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        create: expect.objectContaining({
          organizationId: 'org-1',
          provider: 'openbsp',
          status: 'PENDING',
          verifyToken: 'token-123',
        }),
        update: expect.objectContaining({
          status: 'PENDING',
          verifyToken: 'token-123',
        }),
      });
    });
  });

  describe('setChannelStatus', () => {
    it('atualiza status do canal', async () => {
      mockUpdate.mockResolvedValue({} as any);

      await setChannelStatus('org-1', 'CONNECTED', null);

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        data: { status: 'CONNECTED', lastError: null, updatedAt: expect.any(Date) },
      });
    });
  });

  describe('bumpSentWindow', () => {
    it('incrementa contador de janela 24h', async () => {
      mockUpdateMany.mockResolvedValue({ count: 1 });

      const mockChannel: WhatsappChannelRow = {
        id: 'chan-1',
        organizationId: 'org-1',
        provider: 'openbsp',
        status: 'CONNECTED',
        onboardingTokenId: null,
        callbackUrl: null,
        verifyToken: 'token',
        wabaId: null,
        phoneNumberId: 'phone-1',
        phoneNumber: '+5511999999999',
        verifiedName: 'Test',
        accessTokenEnc: null,
        tierLimitPer24h: 250,
        sentWindow24h: 5,
        windowStartedAt: new Date(Date.now() - 1000),
        lastError: null,
      };

      await bumpSentWindow(mockChannel, 2);

      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        data: {
          sentWindow24h: 7,
          windowStartedAt: mockChannel.windowStartedAt,
          updatedAt: expect.any(Date),
        },
      });
    });
  });
});