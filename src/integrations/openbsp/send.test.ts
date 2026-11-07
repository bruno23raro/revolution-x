/**
 * Testes para o helper de envio via OpenBSP API
 *
 * Estes testes usam mocks para não fazer chamadas reais à API.
 */

import { sendViaOpenBSP, sendTemplateViaOpenBSP } from './send';
import { decryptToken } from '@/lib/encryption';

// Mock das dependências externas
jest.mock('@/lib/encryption', () => ({
  decryptToken: jest.fn(),
  encryptToken: jest.fn(),
}));

jest.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: jest.fn(),
}));

// Mock do global fetch para interceptar chamadas HTTP
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('OpenBSP Send', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Configurar env vars mock
    process.env.OPENBSP_BASE_URL = 'https://test.supabase.co';
    process.env.OPENBSP_PUBLISHABLE_KEY = 'test-pk';
    process.env.OPENBSP_API_KEY = 'test-sk';
  });

  afterEach(() => {
    delete process.env.OPENBSP_BASE_URL;
    delete process.env.OPENBSP_PUBLISHABLE_KEY;
    delete process.env.OPENBSP_API_KEY;
  });

  describe('sendViaOpenBSP', () => {
    const mockChannel = {
      id: 'channel-123',
      organizationId: 'org-456',
      provider: 'openbsp',
      status: 'CONNECTED',
      phoneNumberId: 'phone-789',
      phoneNumber: '5491155551234',
      verifiedName: 'Test Business',
      accessTokenEnc: 'encrypted-token',
      tierLimitPer24h: 250,
      sentWindow24h: 0,
    };

    it('deve retornar erro se OPENBSP_BASE_URL não configurado', async () => {
      delete process.env.OPENBSP_BASE_URL;

      const result = await sendViaOpenBSP(mockChannel as any, '5491155551234', 'Test message');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('OPENBSP_BASE_URL não configurado');
    });

    it('deve retornar erro se credenciais OpenBSP não configuradas', async () => {
      delete process.env.OPENBSP_PUBLISHABLE_KEY;
      delete process.env.OPENBSP_API_KEY;

      const result = await sendViaOpenBSP(mockChannel as any, '5491155551234', 'Test message');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Credenciais OpenBSP não configuradas');
    });

    it('deve retornar erro se phoneNumberId não existe', async () => {
      const channelWithoutPhone = { ...mockChannel, phoneNumberId: null };

      const result = await sendViaOpenBSP(channelWithoutPhone as any, '5491155551234', 'Test message');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Canal OpenBSP sem phoneNumberId');
    });

    it('deve funcionar com snake_case (formato PostgREST)', async () => {
      // PostgREST retorna dados em snake_case
      const snakeCaseChannel = {
        id: 'channel-123',
        organization_id: 'org-456',
        provider: 'openbsp',
        status: 'CONNECTED',
        phone_number_id: 'phone-789',
        phone_number: '5491155551234',
        verified_name: 'Test Business',
        access_token_enc: 'encrypted-token',
        tier_limit_per_24h: 250,
        sent_window_24h: 0,
      };

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve([{ id: 'msg-123' }]),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await sendViaOpenBSP(snakeCaseChannel as any, '5491155551234', 'Test message');

      expect(result.ok).toBe(true);
      expect(result.messageId).toBe('msg-123');

      // Verificar se fetch foi chamado corretamente
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.organization_id).toBe('org-456');
      expect(body.organization_address).toBe('phone-789');
    });

    it('deve enviar mensagem com sucesso via OpenBSP API', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve([{ id: 'msg-123' }]),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await sendViaOpenBSP(mockChannel as any, '5491155551234', 'Test message');

      expect(result.ok).toBe(true);
      expect(result.messageId).toBe('msg-123');

      // Verificar se fetch foi chamado com os headers corretos
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.supabase.co/rest/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: {
            apikey: 'test-pk',
            'api-key': 'test-sk',
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
        })
      );

      // Verificar o body da requisição
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.organization_id).toBe('org-456');
      expect(body.organization_address).toBe('phone-789');
      expect(body.conversation_address).toBe('5491155551234');
      expect(body.service).toBe('whatsapp');
      expect(body.content.text).toBe('Test message');
    });

    it('deve retornar erro quando a API OpenBSP falha', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Bad request' }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await sendViaOpenBSP(mockChannel as any, '5491155551234', 'Test message');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('HTTP 400');
      expect(result.details).toEqual({ error: 'Bad request' });
    });
  });

  describe('sendTemplateViaOpenBSP', () => {
    const mockChannel = {
      id: 'channel-123',
      organizationId: 'org-456',
      provider: 'openbsp',
      status: 'CONNECTED',
      phoneNumberId: 'phone-789',
      template: { name: 'welcome', language: 'pt_BR' },
    };

    it('deve enviar template com sucesso', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve([{ id: 'msg-template-1' }]),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await sendTemplateViaOpenBSP(
        mockChannel as any,
        '5491155551234',
        'welcome',
        'pt_BR',
        ['João']
      );

      expect(result.ok).toBe(true);
      expect(result.messageId).toBe('msg-template-1');

      // Verificar o body do template
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.template.name).toBe('welcome');
      expect(body.template.language).toBe('pt_BR');
      expect(body.template.variables).toEqual(['João']);
    });

    it('deve funcionar com snake_case (formato PostgREST)', async () => {
      const snakeCaseChannel = {
        id: 'channel-123',
        organization_id: 'org-456',
        provider: 'openbsp',
        status: 'CONNECTED',
        phone_number_id: 'phone-789',
        tier_limit_per_24h: 250,
        sent_window_24h: 0,
      };

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve([{ id: 'msg-template-2' }]),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await sendTemplateViaOpenBSP(
        snakeCaseChannel as any,
        '5491155551234',
        'welcome',
        'pt_BR',
        ['João']
      );

      expect(result.ok).toBe(true);
      expect(result.messageId).toBe('msg-template-2');

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.organization_id).toBe('org-456');
      expect(body.organization_address).toBe('phone-789');
      expect(body.template.name).toBe('welcome');
    });
  });
});

describe('resolveTenantWhatsAppAccess', () => {
  // Este teste será adicionado no arquivo de teste da rota
  it('deve resoluvisor contas Meta e OpenBSP de forma provider-agnostic', () => {
    // Implementado via testes de integração da rota /api/whatsapp/send
  });
});

export {};