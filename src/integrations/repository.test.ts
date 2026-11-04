// FASE 1 — Testes de cobertura do repositório (mock Supabase SDK method chaining)
//
// Estratégia do mock: em vez de imitar a hierarquia de classes do SDK, criamos
// um objeto genérico de cadeia onde TODO método (eq, is, neq, order, limit,
// select, insert, update, single, maybeSingle...) retorna o próprio objeto, e
// o objeto é "thenable" — ao ser aguardado (await), consome o próximo resultado
// da fila FIFO configurada por from(). Isso torna qualquer cadeia válida:
//   from().select().eq().eq().is().neq().order().limit().single()  -> await -> r1
//   from().update({...}).eq().eq().select().single()               -> await -> r2
//   from().insert({...})                                           -> await -> r3
// Cada teste configura a fila de resultados na ordem exata dos awaits que a
// função sob teste executa (ver comentários em cada teste).

import { SupabaseClient } from '@supabase/supabase-js';
import {
  getByChannel,
  getAllByWorkspace,
  upsertConnection,
  setStatus,
  archive,
  logEvent,
  getEvents
} from './repository';
import { IntegrationRow, Channel } from './types';

type Row = Record<string, unknown>;

// Fila de resultados: cada `await` na cadeia consome o próximo item (FIFO).
// Se a fila acabar, o último resultado é repetido (fallback seguro).
type ResultItem = { data?: unknown; error?: unknown };

function makeChain(queue: ResultItem[]) {
  const chain: Record<string, unknown> = {};
  const passthrough = jest.fn().mockImplementation(() => chain);

  for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'is', 'not', 'in', 'gt', 'lt', 'gte', 'lte', 'like', 'ilike', 'order', 'limit', 'range', 'single', 'maybeSingle']) {
    chain[m] = passthrough;
  }

  chain.then = (
    onFulfilled?: (v: unknown) => unknown,
    onRejected?: (e: unknown) => unknown
  ) => {
    const r = queue.length > 1 ? queue.shift() : (queue[0] ?? {});
    return Promise.resolve(r).then(onFulfilled, onRejected);
  };

  return chain;
}

// Cria um mock de SupabaseClient cuja from() gera uma cadeia nova por chamada,
// consumindo a fila `results` na ordem dos awaits.
function mockClient(results: ResultItem[]): SupabaseClient {
  const queue = [...results];
  return {
    from: jest.fn().mockImplementation(() => makeChain(queue)),
  } as unknown as SupabaseClient;
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
      // 1 await: .single() -> linha encontrada
      const client = mockClient([{ data: integration, error: null }]);
      const result = await getByChannel(client, 'user-1', 'whatsapp' as Channel);
      expect(result).not.toBeNull();
      expect(result?.channel).toBe('whatsapp');
      expect(result?.mode).toBe('OFFICIAL');
    });

    it('retorna null quando integração não encontrada (PGRST116)', async () => {
      // 1 await: .single() -> nenhum registro (código tolera PGRST116)
      const client = mockClient([{ data: null, error: { code: 'PGRST116' } }]);
      const result = await getByChannel(client, 'user-1', 'instagram' as Channel);
      expect(result).toBeNull();
    });

    it('propaga erro inesperado (não-PGRST116)', async () => {
      const boom = { code: '42P01', message: 'table not found' };
      const client = mockClient([{ data: null, error: boom }]);
      await expect(getByChannel(client, 'user-1', 'whatsapp' as Channel)).rejects.toBe(boom);
    });
  });

  describe('getAllByWorkspace', () => {
    it('retorna array vazio quando não há integrações', async () => {
      // 1 await: .order() (sem .single) -> { data: [], error: null }
      const client = mockClient([{ data: [], error: null }]);
      const result = await getAllByWorkspace(client, 'user-1');
      expect(result).toEqual([]);
    });

    it('retorna array com integrações', async () => {
      const rows: Row[] = [
        { id: 'int-1', user_id: 'user-1', channel: 'whatsapp', status: 'connected' },
        { id: 'int-2', user_id: 'user-1', channel: 'instagram', status: 'pending_credentials' },
      ];
      const client = mockClient([{ data: rows, error: null }]);
      const result = await getAllByWorkspace(client, 'user-1');
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
      // await 1: constraint check .single() -> null (nada existente)
      // await 2: .insert().select().single() -> linha nova
      const inserted: Row = { id: 'new-id', provider: 'openbsp', channel: 'whatsapp', status: 'pending_credentials' };
      const client = mockClient([
        { data: null, error: null },
        { data: inserted, error: null },
      ]);

      const result = await upsertConnection(client, baseInput);
      expect(result).toBeDefined();
      expect(result?.id).toBe('new-id');
      expect(result?.provider).toBe('openbsp');
    });

    it('atualiza conexão existente quando constraint já existe', async () => {
      // await 1: constraint check .single() -> { id: 'existing-id' }
      // await 2: .update().eq().select().single() -> linha atualizada
      const updated: Row = { id: 'existing-id', provider: 'new-provider', channel: 'whatsapp', status: 'connected' };
      const client = mockClient([
        { data: { id: 'existing-id' }, error: null },
        { data: updated, error: null },
      ]);

      const result = await upsertConnection(client, { ...baseInput, provider: 'new-provider' as any });
      expect(result).toBeDefined();
      expect(result?.provider).toBe('new-provider');
    });

    it('lança DuplicateIntegrationError em violação de unique (23505) no insert', async () => {
      // await 1: constraint check -> null
      // await 2: insert falha com unique_violation (corrida entre dois upserts)
      const client = mockClient([
        { data: null, error: null },
        { data: null, error: { code: '23505' } },
      ]);

      await expect(upsertConnection(client, baseInput)).rejects.toThrow('Já existe integração');
    });
  });

  describe('setStatus', () => {
    it('atualiza status da integração', async () => {
      // await 1: fetch estado atual -> { status: 'connecting', external_account_id }
      // await 2: .update().eq().eq().select().single() -> linha atualizada
      // await 3: logEvent insert -> ok
      const updated: Row = { id: 'test-id', status: 'connected' };
      const client = mockClient([
        { data: { status: 'connecting', external_account_id: 'ea-1' }, error: null },
        { data: updated, error: null },
        { error: null },
      ]);

      const result = await setStatus(client, {
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
      // await 1: estado atual já é 'connected' -> transição para 'connected' com
      // statusReason contendo 'nova_conta' deve ser bloqueada
      const client = mockClient([
        { data: { status: 'connected', external_account_id: 'ea-1' }, error: null },
      ]);

      await expect(
        setStatus(client, {
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
      // await 1: .update({status:'archived', deleted_at}).eq().eq() -> ok (sem single)
      // await 2: logEvent insert -> ok
      const client = mockClient([{ error: null }, { error: null }]);

      const result = await archive(client, 'user-1', 'test-id', 'motivo teste');
      expect(result).toBeUndefined();
    });

    it('propaga erro do update', async () => {
      const boom = { code: 'PGRST116', message: 'no rows' };
      const client = mockClient([{ error: boom }]);
      await expect(archive(client, 'user-1', 'test-id', 'motivo')).rejects.toBe(boom);
    });
  });

  describe('logEvent', () => {
    it('registra evento em integration_events', async () => {
      // 1 await: .insert({...}) -> { error: null }
      const client = mockClient([{ error: null }]);
      const result = await logEvent(client, {
        integrationId: 'test-id',
        workspaceId: 'user-1',
        userId: 'user-1',
        event: 'connection_success',
        payload: { success: true },
      });
      expect(result).toBeUndefined();
    });

    it('propaga erro do insert', async () => {
      const boom = { code: '23503', message: 'fk violation' };
      const client = mockClient([{ error: boom }]);
      await expect(
        logEvent(client, {
          integrationId: 'x',
          workspaceId: 'user-1',
          userId: 'user-1',
          event: 'e',
        })
      ).rejects.toBe(boom);
    });
  });

  describe('getEvents', () => {
    it('retorna eventos de uma integração', async () => {
      // 1 await: .select().eq().eq().order().limit() -> array de eventos
      const events = [
        { id: 'event-1', event: 'connection_success', workspace_id: 'user-1', integration_id: 'test-id', created_at: '2024-01-01T10:00:00Z' },
        { id: 'event-2', event: 'connection_lost', workspace_id: 'user-1', integration_id: 'test-id', created_at: '2024-01-01T11:00:00Z' },
      ];
      const client = mockClient([{ data: events, error: null }]);

      const result = await getEvents(client, 'user-1', 'test-id', 50);
      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({ event: 'connection_success' }),
        expect.objectContaining({ event: 'connection_lost' }),
      ]));
    });

    it('retorna array vazio quando não há eventos', async () => {
      const client = mockClient([{ data: [], error: null }]);
      const result = await getEvents(client, 'user-1', 'test-id', 50);
      expect(result).toEqual([]);
    });
  });
});