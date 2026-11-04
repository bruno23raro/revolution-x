// FASE 6 (placeholder) — Adaptador OAuth Meta para Instagram e Facebook
// Fica atrás da flag ENABLE_META_OAUTH. Quando desligado, o card cai no modo session_login.

import type { IntegrationAdapter } from '../types';

export class MetaOAuthAdapter implements IntegrationAdapter {
  private channel: string;
  private client: any;

  constructor(client: any, channel: string) {
    this.client = client;
    this.channel = channel;
  }

  matches(channel: string, provider?: string, connectionMode?: string): boolean {
    const ch = (channel || '').toLowerCase().trim();
    const pr = (provider || 'oauth_meta').toLowerCase().trim();
    const cm = (connectionMode || 'OFFICIAL').toUpperCase().trim();
    // Apenas OFFICIAL com o adaptador OAuth
    return ch === 'instagram' || ch === 'facebook' || (pr === 'oauth_meta' && cm === 'OFFICIAL');
  }

  async connect(organizationId: string, metadata?: Record<string, unknown>): Promise<{
    success: boolean;
    status: 'CONNECTING' | 'CONNECTED' | 'ERROR' | 'REAUTH_REQUIRED';
    reason?: string;
    data?: {
      wabaId?: string;
      phoneNumberId?: string;
      displayName?: string;
      external_account_id?: string;
      external_account_label?: string;
    };
  }> {
    // Verifica se flag ENABLE_META_OAUTH está ligada
    // Se desligado, retorna erro orientando para o modo session_login
    return {
      success: false,
      status: 'ERROR',
      reason: 'ENABLE_META_OAUTH desligado. Use modo session_login ou habilite a flag para OAuth.',
    };
  }

  async disconnect(): Promise<{
    success: boolean;
    status: 'DISCONNECTED';
  }> {
    return {
      success: true,
      status: 'DISCONNECTED',
    };
  }

  async status(): Promise<{
    success: boolean;
    status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  }> {
    return {
      success: true,
      status: 'DISCONNECTED',
    };
  }

  async send(data: any): Promise<{
    success: boolean;
    error?: string;
  }> {
    return {
      success: false,
      error: 'OAuth Meta send não implementado — usar quando flag ENABLE_META_OAUTH estiver ligada',
    };
  }

  capabilities(): Record<string, unknown> {
    return {
      name: `MetaOAuthAdapter (${this.channel})`,
      needsCredentials: true,
      neededCredentialName: () => 'META_APP_ID, META_APP_SECRET, flag ENABLE_META_OAUTH',
      supportedFeatures: [
        'dm_via_graph',
        'comentarios_via_graph',
        'insights',
        'selecao_pagina_facebook',
      ],
      requiresFlag: 'ENABLE_META_OAUTH',
    };
  }

  hasCredentials(): boolean {
    return false; // Credenciais vêm das env vars, não do banco
  }

  neededCredentialName(): string {
    return 'META_APP_ID, META_APP_SECRET, ENABLE_META_OAUTH';
  }
}

// Export factory function
export function createMetaOAuthAdapter(client: any, channel: string): MetaOAuthAdapter {
  return new MetaOAuthAdapter(client, channel);
}