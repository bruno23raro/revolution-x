// FASE 1 — Testes de cobertura das capacidades

import {
  supports,
  getFeatures,
  validateProviderMode,
  isMetaOAuthEnabled,
  modeLabel,
  providerLabel
} from './capabilities';
import { Channel, ConnectionMode } from './types';

describe('Fase 1 - Capabilities', () => {
  describe('supports', () => {
    it('deve retornar true para feature suportada no whatsapp oficial', () => {
      expect(supports('whatsapp' as Channel, 'official' as ConnectionMode, 'templates_hsm')).toBe(true);
    });

    it('deve retornar false para feature não suportada', () => {
      expect(supports('whatsapp' as Channel, 'official' as ConnectionMode, 'nonexistent_feature' as any)).toBe(false);
    });

    it('deve retornar true para feature suportada no whatsapp não-oficial', () => {
      expect(supports('whatsapp' as Channel, 'non_official' as ConnectionMode, 'qr_code_login')).toBe(true);
    });

    it('deve retornar false para canal desconhecido', () => {
      expect(supports('unknown' as Channel, 'official' as ConnectionMode, 'anything' as any)).toBe(false);
    });

    it('deve retornar false para modo desconhecido', () => {
      expect(supports('whatsapp' as Channel, 'unknown' as ConnectionMode, 'anything' as any)).toBe(false);
    });
  });

  describe('getFeatures', () => {
    it('deve retornar todas as features do whatsapp official', () => {
      const features = getFeatures('whatsapp' as Channel, 'official' as ConnectionMode);
      expect(features).toContain('templates_hsm');
      expect(features).toContain('messages_template');
      expect(features).toContain('webhooks_status');
    });

    it('deve retornar todas as features do whatsapp non_official', () => {
      const features = getFeatures('whatsapp' as Channel, 'non_official' as ConnectionMode);
      expect(features).toContain('qr_code_login');
      expect(features).toContain('health_check');
    });

    it('deve retornar array vazio para canal desconhecido', () => {
      expect(getFeatures('unknown' as Channel, 'official' as ConnectionMode)).toEqual([]);
    });
  });

  describe('validateProviderMode', () => {
    it('deve lançar erro quando provider for nulo', () => {
      expect(() => validateProviderMode('whatsapp' as Channel, null, 'official' as ConnectionMode)).toThrow();
    });

    it('deve lançar erro quando provider for inválido para modo official', () => {
      expect(() => validateProviderMode('whatsapp' as Channel, 'evolution', 'official' as ConnectionMode)).toThrow();
    });

    it('deve lançar erro quando provider for inválido para modo non_official', () => {
      expect(() => validateProviderMode('whatsapp' as Channel, 'openbsp', 'non_official' as ConnectionMode)).toThrow();
    });

    it('deve lançar erro para canal desconhecido', () => {
      expect(() => validateProviderMode('unknown' as Channel, 'openbsp', 'official' as ConnectionMode)).toThrow();
    });

    it('deve aceitar provider válido para whatsapp official', () => {
      expect(() => validateProviderMode('whatsapp' as Channel, 'openbsp', 'official' as ConnectionMode)).not.toThrow();
    });

    it('deve aceitar provider válido para whatsapp non_official', () => {
      expect(() => validateProviderMode('whatsapp' as Channel, 'evolution', 'non_official' as ConnectionMode)).not.toThrow();
    });
  });

  describe('isMetaOAuthEnabled', () => {
    it('deve retornar true para instagram', () => {
      expect(isMetaOAuthEnabled('instagram' as Channel)).toBe(true);
    });

    it('deve retornar true para facebook', () => {
      expect(isMetaOAuthEnabled('facebook' as Channel)).toBe(true);
    });

    it('deve retornar true para meta', () => {
      expect(isMetaOAuthEnabled('meta' as Channel)).toBe(true);
    });

    it('deve retornar false para whatsapp', () => {
      expect(isMetaOAuthEnabled('whatsapp' as Channel)).toBe(false);
    });
  });

  describe('modeLabel', () => {
    it('deve retornar OFICIAL para modo official', () => {
      expect(modeLabel('official' as ConnectionMode)).toBe('OFICIAL');
    });

    it('deve retornar SEM API para modo non_official', () => {
      expect(modeLabel('non_official' as ConnectionMode)).toBe('SEM API');
    });
  });

  describe('providerLabel', () => {
    it('deve retornar label para openbsp', () => {
      expect(providerLabel('openbsp')).toBe('OpenBSP (WhatsApp Cloud API)');
    });

    it('deve retornar label para evolution', () => {
      expect(providerLabel('evolution')).toBe('Evolution API (QR Code)');
    });

    it('deve retornar label para session_login', () => {
      expect(providerLabel('session_login')).toBe('Login de Sessão (Playwright)');
    });

    it('deve retornar label para oauth_meta', () => {
      expect(providerLabel('oauth_meta')).toBe('OAuth Meta (Graph API)');
    });

    it('deve retornar provider como fallback quando não reconhecido', () => {
      expect(providerLabel('unknown_provider')).toBe('unknown_provider');
    });
  });
});