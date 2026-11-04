// FASE 1 — Matriz de capacidades por canal/modo (fonte única de verdade)
// Nenhum componente deve comparar string de provider diretamente

import type { Channel, ConnectionMode, Feature } from './types';

/**
 * Matriz exaustiva: canal → modo → features suportadas
 * Fonte única para decisões de UI e validação de adaptador
 */
export const CAPABILITIES_MATRIX: Record<Channel, Record<ConnectionMode, Feature[]>> = {
  whatsapp: {
    official: [
      'templates_hsm',
      'messages_template',
      'webhooks_status',
      'perfil_comercial',
      'numero_verificado',
      'multi_atendente',
      'janela_24h',
    ],
    non_official: [
      'qr_code_login',
      'qr_code_refresh',
      'qr_expiration_monitor',
      'health_check',
      'messages_template',
      'webhooks_status',
    ],
  },
  instagram: {
    official: [
      'dm_via_graph',
      'comentarios_via_graph',
      'insights',
      'long_lived_token',
      'token_refresh_agendado',
      'pkce_oauth',
      'state_signed',
    ],
    non_official: [
      'sessao_persistida',
      '2fa_checkpoint',
      'validacao_perfil',
      'reconexao_automatica',
      'dm_via_graph',
      'comentarios_via_graph',
    ],
  },
  facebook: {
    official: [
      'dm_via_graph',
      'comentarios_via_graph',
      'insights',
      'selecao_pagina_facebook',
      'long_lived_token',
      'token_refresh_agendado',
      'pkce_oauth',
      'state_signed',
    ],
    non_official: [
      'sessao_persistida',
      '2fa_checkpoint',
      'validacao_perfil',
      'reconexao_automatica',
      'dm_via_graph',
      'comentarios_via_graph',
      'selecao_pagina_facebook',
    ],
  },
  meta: {
    official: [
      'dm_via_graph',
      'comentarios_via_graph',
      'insights',
      'long_lived_token',
      'token_refresh_agendado',
      'pkce_oauth',
      'state_signed',
    ],
    non_official: [
      'sessao_persistida',
      '2fa_checkpoint',
      'validacao_perfil',
      'reconexao_automatica',
      'dm_via_graph',
      'comentarios_via_graph',
    ],
  },
};

/**
 * Provider oficial por canal e modo (exaustivo)
 * Usado pela fábrica para validar coerência
 */
export const OFFICIAL_PROVIDER: Record<Channel, { official: 'openbsp' | 'oauth_meta'; non_official: 'evolution' | 'session_login' }> = {
  whatsapp: { official: 'openbsp', non_official: 'evolution' },
  instagram: { official: 'oauth_meta', non_official: 'session_login' },
  facebook: { official: 'oauth_meta', non_official: 'session_login' },
  meta: { official: 'oauth_meta', non_official: 'session_login' },
};

/**
 * Verifica se uma feature é suportada pelo canal/modo
 * Fonte única — componentes chamam isto, não comparam strings
 */
export function supports(channel: Channel, mode: ConnectionMode, feature: Feature): boolean {
  return CAPABILITIES_MATRIX[channel]?.[mode]?.includes(feature) ?? false;
}

/**
 * Retorna todas as features suportadas para um canal/modo
 */
export function getFeatures(channel: Channel, mode: ConnectionMode): Feature[] {
  return CAPABILITIES_MATRIX[channel]?.[mode] ?? [];
}

/**
 * Valida coerência provider ↔ modo
 * Lança UnsupportedIntegrationError se inválido
 */
export function validateProviderMode(
  channel: Channel,
  provider: string | null,
  connectionMode: ConnectionMode
): void {
  if (!provider) {
    throw new Error(`Provider ausente para ${channel}/${connectionMode}`);
  }

  const expected = OFFICIAL_PROVIDER[channel];
  if (!expected) {
    throw new Error(`Canal desconhecido: ${channel}`);
  }

  const validProvider = connectionMode === 'official'
    ? expected.official
    : expected.non_official;

  if (provider !== validProvider) {
    throw new Error(
      `Provider inválido para ${channel}/${connectionMode}: ` +
      `esperado ${validProvider}, recebeu ${provider}`
    );
  }
}

/**
 * Verifica se OAuth Meta está habilitado para o canal
 */
export function isMetaOAuthEnabled(channel: Channel): boolean {
  return channel === 'instagram' || channel === 'facebook' || channel === 'meta';
}

/**
 * Retorna label amigável do modo
 */
export function modeLabel(mode: ConnectionMode): string {
  return mode === 'official' ? 'OFICIAL' : 'SEM API';
}

/**
 * Retorna label amigável do provider
 */
export function providerLabel(provider: string): string {
  const labels: Record<string, string> = {
    openbsp: 'OpenBSP (WhatsApp Cloud API)',
    evolution: 'Evolution API (QR Code)',
    session_login: 'Login de Sessão (Playwright)',
    oauth_meta: 'OAuth Meta (Graph API)',
  };
  return labels[provider] ?? provider;
}