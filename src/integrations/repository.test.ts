// FASE 1 — Testes do repositório (mock DatabaseAdapter)
// Estratégia: criar objeto DatabaseAdapter com métodos que retornam promessas diretas

import type { DatabaseAdapter, TenantContext } from '../db/types';
import {
  getByChannel,
  getAllByWorkspace,
  upsertConnection,
  setStatus,
  archive,
  logEvent,
  getEvents,
} from './repository';
import { IntegrationRow, Channel } from './types';

type Row = Record<string, unknown>;

// Create typed jest mocks for DatabaseAdapter
function makeMockAdapter(callHistory: Array<{ method: string; args: unknown[] }> = []): DatabaseAdapter {
  const mockFindMany = jest.fn(async () => []);
  const mockFindUnique = jest.fn(async () => null);
  const mockCreate = jest.fn() as unknown as DatabaseAdapter['create'];
  const mockUpdate = jest.fn() as unknown as DatabaseAdapter['update'];
  const mockDelete = jest.fn() as unknown as DatabaseAdapter['delete'];
  const mockTransaction = jest.fn() as unknown as DatabaseAdapter['transaction'];

  return {
    findMany: mockFindMany,
    findUnique: mockFindUnique,
    create: mockCreate,
    update: mockUpdate,
    delete: mockDelete,
    transaction: mockTransaction,
  };
}

// ===================== TESTES =====================

describe('Fase 1 - Repository', () => {
  describe('getByChannel', () => {
    const integration: IntegrationRow = {
      id: 'test-id',
      user_id: 'user-1',
      workspace_id: 'user-1',
      channel: 'whatsapp' as Channel,
      provider: 'openbsp' as any,
      connection_mode: 'official' as any,
      status: 'connected',
      mode: 'OFFICIAL',
      deleted_at: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    } as IntegrationRow;

    it('busca integração ativa por canal', async () => {
      const adapter = makeMockAdapter();
      (adapter.findMany as jest.Mock).mockResolvedValue([integration]);

      const result = await getByChannel(adapter, 'user-1', 'whatsapp' as Channel);
      expect(result).not.toBeNull();
      expect(result?.channel).toBe('whatsapp');
      expect(result?.mode).toBe('OFFICIAL');
    });

    it('retorna null quando integração não encontrada', async () => {
      const adapter = makeMockAdapter();
      (adapter.findMany as jest.Mock).mockResolvedValue([]);

      const result = await getByChannel(adapter, 'user-1', 'instagram' as Channel);
      expect(result).toBeNull();
    });
  });

  describe('getAllByWorkspace', () => {
    it('retorna array vazio quando não há integrações', async () => {
      const adapter = makeMockAdapter();
      (adapter.findMany as jest.Mock).mockResolvedValue([]);

      const result = await getAllByWorkspace(adapter, 'user-1');
      expect(result).toEqual([]);
    });

    it('retorna array com integrações', async () => {
      const rows: Row[] = [
        { id: 'int-1', user_id: 'user-1', channel: 'whatsapp', status: 'connected' },
        { id: 'int-2', user_id: 'user-1', channel: 'instagram', status: 'pending_credentials' },
      ];
      const adapter = makeMockAdapter();
      (adapter.findMany as jest.Mock).mockResolvedValue(rows);

      const result = await getAllByWorkspace(adapter, 'user-1');
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.id)).toEqual(['int-1', 'int-2']);
    });
  });

  describe('upsertConnection', () => {
    const baseInput = {
      workspaceId: 'user-1',
      channel: 'whatsapp' as Channel,
      provider: 'openbsp' as any,
      connectionMode: 'official' as any,
      externalAccountId: 'waba-123',
      externalAccountLabel: 'Central Da Black01',
      credentialsRef: 'ref-1',
      accessToken: 'token-1',
      refreshToken: 'ref-refresh-1',
      expiresAt: '2025-01-01T00:00:00Z',
      metaAccountId: 'meta-1',
      metaAccountName: 'Meta Account',
      phoneNumber: '+551199999-8888',
      wabaId: 'waba-1',
      meta: { key: 'value' },
    };

    it('insere nova conexão quando não existe registro ativo', async () => {
      const adapter = makeMockAdapter();
      // Não encontrou existente, então cria novo
      (adapter.findMany as jest.Mock).mockResolvedValue([]);
      (adapter.create as jest.Mock).mockResolvedValue({ id: 'new-id', provider: 'openbsp', channel: 'whatsapp', status: 'pending_credentials' });

      const result = await upsertConnection(adapter, baseInput);
      expect(result).toBeDefined();
      expect(result?.id).toBe('new-id');
      expect(result?.provider).toBe('openbsp');
    });

    it('atualiza conexão existente quando constraint já existe', async () => {
      const adapter = makeMockAdapter();
      // Encontrou existente
      (adapter.findMany as jest.Mock).mockResolvedValue([{ id: 'existing-id', provider: 'old' }]);
      (adapter.update as jest.Mock).mockResolvedValue({ id: 'existing-id', provider: 'new-provider', channel: 'whatsapp', status: 'connected' });

      const result = await upsertConnection(adapter, { ...baseInput, provider: 'new-provider' as any });
      expect(result).toBeDefined();
      expect(result?.provider).toBe('new-provider');
    });
  });

  describe('setStatus', () => {
    it('atualiza status da integração', async () => {
      const adapter = makeMockAdapter();
      // await 1: fetch estado atual
      (adapter.findMany as jest.Mock).mockResolvedValue([{ status: 'connecting', external_account_id: 'ea-1' }]);
      // await 2: update
      (adapter.update as jest.Mock).mockResolvedValue({ id: 'test-id', status: 'connected' });
      // await 3: logEvent insert
      (adapter.create as jest.Mock).mockResolvedValue({});

      const result = await setStatus(adapter, 'user-1', {
        integrationId: 'test-id',
        workspaceId: 'user-1',
        status: 'connected' as any,
        statusReason: 'conta_verificada',
        lastError: undefined,
      });
      expect(result).toBeDefined();
      expect(result?.status).toBe('connected');
    });

    it('lança InvalidStatusTransitionError ao conectar nova conta sem desconectar', async () => {
      const adapter = makeMockAdapter();
      // Estado atual já é 'connected'
      (adapter.findMany as jest.Mock).mockResolvedValue([{ status: 'connected', external_account_id: 'ea-1' }]);

      await expect(
        setStatus(adapter, 'user-1', {
          integrationId: 'test-id',
          workspaceId: 'user-1',
          status: 'connected' as any,
          statusReason: 'troca_para_nova_conta',
        })
      ).rejects.toThrow('Desconecte a conta atual');
    });
  });

  describe('archive', () => {
    it('arquiva integração (soft delete + evento)', async () => {
      const adapter = makeMockAdapter();
      // update
      (adapter.update as jest.Mock).mockResolvedValue({});
      // logEvent
      (adapter.create as jest.Mock).mockResolvedValue({});

      const result = await archive(adapter, 'user-1', 'test-id', 'motivo teste');
      expect(result).toBeUndefined();
    });
  });

  describe('logEvent', () => {
    it('registra evento em integration_events', async () => {
      const adapter = makeMockAdapter();
      (adapter.create as jest.Mock).mockResolvedValue({ id: 'event-1' });

      const result = await logEvent(adapter, 'user-1', {
        integrationId: 'test-id',
        workspaceId: 'user-1',
        userId: 'user-1',
        event: 'connection_success',
        payload: { success: true },
      });
      expect(result).toBeUndefined();
      expect(adapter.create).toHaveBeenCalledWith('integration_events', expect.objectContaining({
        integration_id: 'test-id',
        workspace_id: 'user-1',
        event: 'connection_success',
      }), expect.anything());
    });
  });

  describe('getEvents', () => {
    it('retorna eventos de uma integração', async () => {
      const adapter = makeMockAdapter();
      const events = [
        { id: 'event-1', event: 'connection_success', workspace_id: 'user-1', integration_id: 'test-id', created_at: '2024-01-01T10:00:00Z' },
        { id: 'event-2', event: 'connection_lost', workspace_id: 'user-1', integration_id: 'test-id', created_at: '2024-01-01T11:00:00Z' },
      ];
      (adapter.findMany as jest.Mock).mockResolvedValue(events);

      const result = await getEvents(adapter, 'user-1', 'test-id', 50);
      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({ event: 'connection_success' }),
        expect.objectContaining({ event: 'connection_lost' }),
      ]));
    });

    it('retorna array vazio quando não há eventos', async () => {
      const adapter = makeMockAdapter();
      (adapter.findMany as jest.Mock).mockResolvedValue([]);

      const result = await getEvents(adapter, 'user-1', 'test-id', 50);
      expect(result).toEqual([]);
    });
  });
});
