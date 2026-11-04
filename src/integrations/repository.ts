// FASE 1 — Camada de acesso a dados (Repository)
// Todas as funções recebem workspace_id explícito

import type { SupabaseClient } from '@supabase/supabase-js';
import type { IntegrationRow, Channel, ConnectionMode, Provider } from './types';

/** Erro tipado para transição de status inválida */
export class InvalidStatusTransitionError extends Error {
  constructor(
    public readonly fromStatus: string,
    public readonly toStatus: string,
    public readonly reason: string
  ) {
    super(`Transição inválida: ${fromStatus} → ${toStatus} (${reason})`);
    this.name = 'InvalidStatusTransitionError';
  }
}

/** Erro tipado para violação de constraint única */
export class DuplicateIntegrationError extends Error {
  constructor(
    public readonly workspaceId: string,
    public readonly channel: Channel,
    public readonly connectionMode: ConnectionMode
  ) {
    super(`Já existe integração ${channel}/${connectionMode} ativa neste workspace`);
    this.name = 'DuplicateIntegrationError';
  }
}

interface UpsertConnectionInput {
  workspaceId: string;
  channel: Channel;
  provider: Provider;
  connectionMode: ConnectionMode;
  externalAccountId?: string;
  externalAccountLabel?: string;
  credentialsRef?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  metaAccountId?: string;
  metaAccountName?: string;
  phoneNumber?: string;
  wabaId?: string;
  meta?: Record<string, unknown>;
}

interface SetStatusInput {
  integrationId: string;
  workspaceId: string;
  status: IntegrationRow['status'];
  statusReason?: string;
  lastError?: string;
}

interface LogEventInput {
  integrationId: string;
  workspaceId: string;
  userId: string;
  event: string;
  payload?: Record<string, unknown>;
}

/**
 * Busca integração por canal (retorna a primeira ativa, não arquivada)
 */
export async function getByChannel(
  client: SupabaseClient,
  workspaceId: string,
  channel: Channel
): Promise<IntegrationRow | null> {
  const { data, error } = await client
    .from('integrations')
    .select('*')
    .eq('user_id', workspaceId)
    .eq('channel', channel)
    .is('deleted_at', null)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data as IntegrationRow | null;
}

/**
 * Busca todas as integrações de um workspace
 */
export async function getAllByWorkspace(
  client: SupabaseClient,
  workspaceId: string
): Promise<IntegrationRow[]> {
  const { data, error } = await client
    .from('integrations')
    .select('*')
    .eq('user_id', workspaceId)
    .is('deleted_at', null)
    .neq('status', 'archived')
    .order('channel', { ascending: true });

  if (error) throw error;
  return (data ?? []) as IntegrationRow[];
}

/**
 * Cria ou atualiza conexão (upsert por constraint única)
 * Valida constraint única antes de inserir
 */
export async function upsertConnection(
  client: SupabaseClient,
  input: UpsertConnectionInput
): Promise<IntegrationRow> {
  // Verificar constraint única antes
  const { data: existing } = await client
    .from('integrations')
    .select('id')
    .eq('user_id', input.workspaceId)
    .eq('channel', input.channel)
    .eq('connection_mode', input.connectionMode)
    .is('deleted_at', null)
    .neq('status', 'archived')
    .single();

  if (existing) {
    // Atualizar registro existente
    const { data, error } = await client
      .from('integrations')
      .update({
        provider: input.provider,
        external_account_id: input.externalAccountId,
        external_account_label: input.externalAccountLabel,
        credentials_ref: input.credentialsRef,
        access_token: input.accessToken,
        refresh_token: input.refreshToken,
        expires_at: input.expiresAt,
        meta_account_id: input.metaAccountId,
        meta_account_name: input.metaAccountName,
        phone_number: input.phoneNumber,
        waba_id: input.wabaId,
        meta: input.meta ?? {},
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) throw error;
    return data as IntegrationRow;
  }

  // Inserir novo
  const { data, error } = await client
    .from('integrations')
    .insert({
      user_id: input.workspaceId,
      channel: input.channel,
      provider: input.provider,
      connection_mode: input.connectionMode,
      status: 'pending_credentials',
      external_account_id: input.externalAccountId,
      external_account_label: input.externalAccountLabel,
      credentials_ref: input.credentialsRef,
      access_token: input.accessToken,
      refresh_token: input.refreshToken,
      expires_at: input.expiresAt,
      meta_account_id: input.metaAccountId,
      meta_account_name: input.metaAccountName,
      phone_number: input.phoneNumber,
      waba_id: input.wabaId,
      meta: input.meta ?? {},
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') { // unique_violation
      throw new DuplicateIntegrationError(input.workspaceId, input.channel, input.connectionMode);
    }
    throw error;
  }

  return data as IntegrationRow;
}

/**
 * Atualiza status da integração com validação de transição
 * Sempre grava last_checked_at/last_error_at e emite evento
 */
export async function setStatus(
  client: SupabaseClient,
  input: SetStatusInput
): Promise<IntegrationRow> {
  // Buscar estado atual
  const { data: current, error: fetchError } = await client
    .from('integrations')
    .select('status, external_account_id')
    .eq('id', input.integrationId)
    .eq('user_id', input.workspaceId)
    .single();

  if (fetchError) throw fetchError;
  if (!current) {
    throw new Error(`Integração ${input.integrationId} não encontrada`);
  }

  // Validar transição inválida: connected → connected de outra conta sem desconectar
  if (
    current.status === 'connected' &&
    input.status === 'connected' &&
    input.statusReason?.includes('nova_conta')
  ) {
    throw new InvalidStatusTransitionError(
      current.status,
      input.status,
      'Desconecte a conta atual antes de conectar outra'
    );
  }

  // Preparar update
  const now = new Date().toISOString();
  const updateData: Record<string, unknown> = {
    status: input.status,
    updated_at: now,
  };

  if (input.statusReason) {
    updateData.status_reason = input.statusReason;
  }

  if (input.lastError) {
    updateData.last_error = input.lastError;
    updateData.last_error_at = now;
  }

  // last_checked_at sempre atualizado em mudança de status
  updateData.last_checked_at = now;

  // Aplicar update
  const { data, error } = await client
    .from('integrations')
    .update(updateData)
    .eq('id', input.integrationId)
    .eq('user_id', input.workspaceId)
    .select('*')
    .single();

  if (error) throw error;

  // Emitir evento de auditoria
  await logEvent(client, {
    integrationId: input.integrationId,
    userId: input.workspaceId,
    workspaceId: input.workspaceId,
    event: `status_changed_to_${input.status}`,
    payload: {
      from_status: current.status,
      to_status: input.status,
      status_reason: input.statusReason,
      last_error: input.lastError,
    },
  });

  return data as IntegrationRow;
}

/**
 * Arquiva integração (soft delete)
 */
export async function archive(
  client: SupabaseClient,
  workspaceId: string,
  integrationId: string,
  reason: string
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await client
    .from('integrations')
    .update({
      status: 'archived',
      status_reason: reason,
      deleted_at: now,
      updated_at: now,
    })
    .eq('id', integrationId)
    .eq('user_id', workspaceId);

  if (error) throw error;

  await logEvent(client, {
    integrationId,
    userId: workspaceId,
    workspaceId,
    event: 'disconnection',
    payload: { reason, archived: true },
  });
}

/**
 * Registra evento em integration_events
 */
export async function logEvent(
  client: SupabaseClient,
  input: LogEventInput
): Promise<void> {
  const { error } = await client
    .from('integration_events')
    .insert({
      integration_id: input.integrationId,
      user_id: input.userId,
      workspace_id: input.workspaceId,
      event: input.event,
      payload: input.payload ?? {},
    });

  if (error) throw error;
}

/**
 * Busca eventos de auditoria de uma integração
 */
export async function getEvents(
  client: SupabaseClient,
  workspaceId: string,
  integrationId: string,
  limit = 50
): Promise<Array<{
  id: string;
  integration_id: string;
  workspace_id: string;
  event: string;
  payload: Record<string, unknown>;
  created_at: string;
}>> {
  const { data, error } = await client
    .from('integration_events')
    .select('*')
    .eq('integration_id', integrationId)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    integration_id: string;
    workspace_id: string;
    event: string;
    payload: Record<string, unknown>;
    created_at: string;
  }>;
}