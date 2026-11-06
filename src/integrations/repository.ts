// FASE 1 — Camada de acesso a dados (Repository)
// Todas as funções recebem workspace_id explícito
// Integração com DatabaseAdapter para injeção de contexto de tenant

import type { DatabaseAdapter, TenantContext, QueryOptions } from '../db/types';
import type { IntegrationRow, Channel, ConnectionMode, Provider } from './types';
import { DatabaseContextError } from '../db/types';

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
  adapter: DatabaseAdapter,
  workspaceId: string,
  channel: Channel,
  tenant?: TenantContext
): Promise<IntegrationRow | null> {
  const resolvedTenant = tenant ?? { type: 'org', id: workspaceId };
  if (!resolvedTenant?.id) {
    throw new DatabaseContextError(resolvedTenant);
  }
  const data = await adapter.findMany<IntegrationRow>('integration', {
    channel,
    user_id: workspaceId,
  }, { orderBy: 'created_at', orderDirection: 'desc', limit: 1 });
  return data?.[0] ?? null;
}

/**
 * Busca todas as integrações de um workspace
 */
export async function getAllByWorkspace(
  adapter: DatabaseAdapter,
  workspaceId: string,
  tenant?: TenantContext
): Promise<IntegrationRow[]> {
  const resolvedTenant = tenant ?? { type: 'org', id: workspaceId };
  if (!resolvedTenant?.id) {
    throw new DatabaseContextError(resolvedTenant);
  }
  const rows = await adapter.findMany<IntegrationRow>('integration', {
    user_id: workspaceId,
    is_archived: false,
  });
  return rows ?? [];
}

/**
 * Cria ou atualiza conexão (upsert por constraint única)
 * Valida constraint única antes de inserir
 */
export async function upsertConnection(
  adapter: DatabaseAdapter,
  input: UpsertConnectionInput,
  tenant?: TenantContext
): Promise<IntegrationRow> {
  const resolvedTenant = tenant ?? { type: 'org', id: input.workspaceId };
  if (!resolvedTenant?.id) {
    throw new DatabaseContextError(resolvedTenant);
  }

  // Verificar constraint única antes
  const existing = await adapter.findMany<IntegrationRow>('integration', {
    where: {
      user_id: input.workspaceId,
      channel: input.channel,
      connection_mode: input.connectionMode,
    },
    limit: 1,
  });

  if (existing?.[0]) {
    // Atualizar registro existente
    const updated = await adapter.update<IntegrationRow>('integration', {
      id: existing[0].id,
    }, {
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
    }, resolvedTenant);

    if (!updated) {
      throw new Error('Update failed');
    }
    return updated as IntegrationRow;
  }

  // Inserir novo
  const created = await adapter.create<IntegrationRow>('integration', {
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
  }, resolvedTenant);

  if (!created) {
    throw new Error('Create failed');
  }

  return created as IntegrationRow;
}

/**
 * Atualiza status da integração com validação de transição
 * Sempre grava last_checked_at/last_error_at e emite evento
 */
export async function setStatus(
  adapter: DatabaseAdapter,
  workspaceId: string,
  input: SetStatusInput,
  tenant?: TenantContext
): Promise<IntegrationRow> {
  const resolvedTenant = tenant ?? { type: 'org', id: workspaceId };
  if (!resolvedTenant?.id) {
    throw new DatabaseContextError(resolvedTenant);
  }

  // Buscar estado atual usando adapter
  const currentRows = await adapter.findMany<IntegrationRow>('integration', {
    where: { id: input.integrationId, user_id: workspaceId },
    limit: 1,
  });
  if (!currentRows?.[0]) {
    throw new Error(`Integração ${input.integrationId} não encontrada`);
  }
  const current = currentRows[0];

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

  // Aplicar update via adapter
  const updated = await adapter.update<IntegrationRow>('integration', {
    id: input.integrationId,
  }, updateData, resolvedTenant);

  if (!updated) {
    throw new Error('Update failed');
  }

  // Emitir evento de auditoria
  await logEvent(adapter, workspaceId, {
    integrationId: input.integrationId,
    workspaceId,
    userId: workspaceId,
    event: `status_changed_to_${input.status}`,
    payload: {
      from_status: current.status,
      to_status: input.status,
      status_reason: input.statusReason,
      last_error: input.lastError,
    },
  });

  return updated as IntegrationRow;
}

/**
 * Arquiva integração (soft delete)
 */
export async function archive(
  adapter: DatabaseAdapter,
  workspaceId: string,
  integrationId: string,
  reason: string,
  tenant?: TenantContext
): Promise<void> {
  const resolvedTenant = tenant ?? { type: 'org', id: workspaceId };
  if (!resolvedTenant?.id) {
    throw new DatabaseContextError(resolvedTenant);
  }
  const now = new Date().toISOString();

  await adapter.update<IntegrationRow>('integration', {
    id: integrationId,
  }, {
    status: 'archived',
    status_reason: reason,
    deleted_at: now,
    updated_at: now,
  }, resolvedTenant);

  await logEvent(adapter, workspaceId, {
    integrationId,
    workspaceId,
    userId: workspaceId,
    event: 'disconnection',
    payload: { reason, archived: true },
  });
}

/**
 * Registra evento em integration_events
 */
export async function logEvent(
  adapter: DatabaseAdapter,
  workspaceId: string,
  input: LogEventInput,
  tenant?: TenantContext
): Promise<void> {
  const resolvedTenant = tenant ?? { type: 'org', id: workspaceId };
  if (!resolvedTenant?.id) {
    throw new DatabaseContextError(resolvedTenant);
  }
  // Use direct insert pattern for integration_events
  await adapter.create('integration_events', {
    integration_id: input.integrationId,
    workspace_id: workspaceId,
    event: input.event,
    payload: input.payload ?? {},
  }, resolvedTenant);
}

/**
 * Busca eventos de auditoria de uma integração
 */
export async function getEvents(
  adapter: DatabaseAdapter,
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
  const rows = await adapter.findMany('integration_events', {
    where: {
      integration_id: integrationId,
      workspace_id: workspaceId,
    },
    orderBy: 'created_at',
    orderDirection: 'desc',
    limit,
  });
  return (rows ?? []) as Array<{
    id: string;
    integration_id: string;
    workspace_id: string;
    event: string;
    payload: Record<string, unknown>;
    created_at: string;
  }>;
}