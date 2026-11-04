// FASE 1 — Testes de cobertura da fábrica de adaptadores e capacidades

import { createIntegrationAdapter, checkAdapterReadiness, generateDiagnosticReport, cardDiagnosticSummary } from './adapter-factory';
import { IntegrationAdapter, IntegrationRow, Channel, Provider, ConnectionMode, UnsupportedIntegrationError, ArchivedIntegrationError, MetaOAuthDisabledError } from './types';
import { OfficialWhatsAppAdapter } from './openbsp/adapter';
import { MetaOAuthAdapter } from './meta/oauth-adapter';
import { supports } from './capabilities';

describe('Fase 1 - Factory de Adaptadores', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      from: () => ({
        select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }),
      }),
    };
  });

  describe('createIntegrationAdapter', () => {
    const validRow: IntegrationRow = {
      id: 'test-id',
      user_id: 'user-1',
      workspace_id: 'user-1',
      channel: 'whatsapp' as Channel,
      provider: 'openbsp' as Provider,
      connection_mode: 'official' as ConnectionMode,
      status: 'disconnected',
      status_reason: null,
      last_checked_at: null,
      last_error_at: null,
      external_account_id: null,
      external_account_label: null,
      credentials_ref: null,
      access_token: null,
      refresh_token: null,
      expires_at: null,
      meta_account_id: null,
      meta_account_name: null,
      phone_number: null,
      waba_id: null,
      meta: {},
      deleted_at: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      mode: 'OFFICIAL',
    };

    it('deve criar adaptador OfficialWhatsAppAdapter para whatsapp:openbsp', () => {
      const adapter = createIntegrationAdapter(validRow, mockClient);
      expect(adapter).toBeInstanceOf(OfficialWhatsAppAdapter);
    });

    it('deve lançar ArchivedIntegrationError quando registro está arquivado', () => {
      const archivedRow = { ...validRow, deleted_at: new Date().toISOString() };
      expect(() => createIntegrationAdapter(archivedRow, mockClient)).toThrow(ArchivedIntegrationError);
    });

    it('deve lançar UnsupportedIntegrationError para whatsapp:evolution com modo não-oficial', () => {
      // whatsapp:evolution passa no validateProviderMode (evolution + non_official é coerente)
      // mas não há factory registrada no ADAPTER_REGISTRY (implementado nas Fases 3-5)
      const row: IntegrationRow = {
        ...validRow,
        provider: 'evolution' as Provider,
        connection_mode: 'non_official' as ConnectionMode,
      };
      expect(() => createIntegrationAdapter(row, mockClient)).toThrow(UnsupportedIntegrationError);
    });

    it('deve bloquear adaptador quando deleted_at preenchido', () => {
      const rowWithDeleted: IntegrationRow = {
        ...validRow,
        deleted_at: new Date().toISOString(),
      };
      expect(() => createIntegrationAdapter(rowWithDeleted, mockClient)).toThrow(ArchivedIntegrationError);
    });

    it('deve lançar Error para provider inválido (openbsp em Instagram)', () => {
      // validateProviderMode lança Error antes do check de MetaOAuth
      const row: IntegrationRow = {
        ...validRow,
        channel: 'instagram' as Channel,
        provider: 'openbsp' as Provider,
        connection_mode: 'official' as ConnectionMode,
      };
      expect(() => createIntegrationAdapter(row, mockClient)).toThrow(Error);
    });
  });

  describe('checkAdapterReadiness', () => {
    it('deve retornar ready: true quando needsCredentials for false', () => {
      const adapter = {
        capabilities: () => ({ needsCredentials: false } as any),
      } as any;
      const result = checkAdapterReadiness(adapter as any);
      expect(result).toEqual({ ready: true });
    });

    it('deve retornar pending quando não há credenciais', () => {
      const adapter = {
        capabilities: () => ({ needsCredentials: true }),
        hasCredentials: () => false,
      } as any;
      const result = checkAdapterReadiness(adapter as any);
      expect(result).toEqual({ ready: false, pending: 'Credenciais não configuradas' });
    });
  });

  describe('generateDiagnosticReport', () => {
    it('deve gerar relatório para whatsapp oficial OpenBSP', () => {
      const report = generateDiagnosticReport('whatsapp', 'openbsp', 'official');
      expect(report.mode).toBe('OFFICIAL');
      expect(report.provider).toBe('openbsp');
      expect(report.needsApiOfficial).toBe(true);
    });

    it('deve gerar relatório para instagram OAuth oficial', () => {
      const report = generateDiagnosticReport('instagram', 'oauth_meta', 'official');
      expect(report.mode).toBe('OFFICIAL');
      expect(report.provider).toBe('oauth_meta');
    });
  });

  describe('cardDiagnosticSummary', () => {
    it('deve resumir cartão whatsapp OpenBSP oficial', () => {
      const summary = cardDiagnosticSummary('whatsapp', 'openbsp', 'official');
      expect(summary.modeBadge).toBe('OFICIAL');
      expect(summary.providerLabel).toBe('OpenBSP');
      expect(summary.needsCredentials).toBe(true);
    });

    it('deve resumir cartão whatsapp Evolution manual', () => {
      const summary = cardDiagnosticSummary('whatsapp', 'evolution', 'non_official');
      expect(summary.modeBadge).toBe('MANUAL');
      expect(summary.providerLabel).toBe('Evolution');
    });

    it('deve resumir cartão instagram OAuth oficial', () => {
      const summary = cardDiagnosticSummary('instagram', 'oauth_meta', 'official');
      expect(summary.modeBadge).toBe('OFICIAL');
      expect(summary.providerLabel).toBe('Meta OAuth');
    });

    it('deve resumir cartão instagram session login manual', () => {
      const summary = cardDiagnosticSummary('instagram', undefined, 'non_official');
      expect(summary.modeBadge).toBe('MANUAL');
      expect(summary.providerLabel).toBe('Session Login');
    });

    it('deve resumir cartão facebook OAuth oficial', () => {
      const summary = cardDiagnosticSummary('facebook', 'oauth_meta', 'official');
      expect(summary.modeBadge).toBe('OFICIAL');
      expect(summary.providerLabel).toBe('Meta OAuth');
    });
  });
});