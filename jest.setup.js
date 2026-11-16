// jest.setup.js - Configuração global para testes Jest
// Este arquivo é carregado antes de cada suíte de testes via setupFiles

// Carregar variáveis de ambiente de teste
process.env.DEMO_JWT_SECRET = 'xnvVG9DhngoWFJQevuJ2N487l-BN8Nd7N3wCiMR7SEQ';

// Mocks globais básicos
global.TextEncoder = global.TextEncoder || class TextEncoder {
  encode() { return new Uint8Array(); }
};
global.TextDecoder = global.TextDecoder || class TextDecoder {
  decode() { return ''; }
};

// Mocks para WebSocket
global.WebSocket = global.WebSocket || class WebSocket {
  constructor() {}
  send() {}
  close() {}
  addEventListener() {}
  removeEventListener() {}
};

// Mocks para localStorage/sessionStorage
const createStorageMock = () => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => { store[key] = value; }),
    removeItem: jest.fn((key) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: jest.fn((index) => Object.keys(store)[index] || null),
  };
};

global.localStorage = global.localStorage || createStorageMock();
global.sessionStorage = global.sessionStorage || createStorageMock();

// Mocks para fetch
global.fetch = global.fetch || jest.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({}),
  text: () => Promise.resolve(''),
  headers: new Headers(),
  status: 200,
});

// Mocks para Web Crypto API
if (typeof global.crypto === 'undefined') {
  global.crypto = {
    getRandomValues: (arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    subtle: {
      digest: () => Promise.resolve(new ArrayBuffer(32)),
      importKey: () => Promise.resolve({}),
      sign: () => Promise.resolve(new ArrayBuffer(64)),
      verify: () => Promise.resolve(true),
    },
  };
}

// Mocks para AbortController/AbortSignal
if (typeof global.AbortController === 'undefined') {
  global.AbortController = class AbortController {
    constructor() {
      this.signal = { aborted: false, addEventListener: () => {}, removeEventListener: () => {} };
      this.abort = () => { this.signal.aborted = true; };
    }
  };
}

// Mocks para WebSocket
if (typeof global.WebSocket === 'undefined') {
  global.WebSocket = class WebSocket {
    constructor() {
      this.readyState = 1;
      this.onopen = null;
      this.onclose = null;
      this.onmessage = null;
      this.onerror = null;
    }
    send() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
  };
}

// Mocks para crypto.randomUUID
if (!global.crypto.randomUUID) {
  global.crypto.randomUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}


// Mocks para resolveOrganizationId e handleOptOut (webhooks WhatsApp)
jest.mock('@/integrations/whatsapp/index.ts', () => ({
  getChannelByPhoneNumberId: jest.fn(async (client, phoneNumberId) => {
    if (phoneNumberId === 'mock-phone-id') {
      return { organizationId: 'org-1' };
    }
    return null;
  }),
}), { virtual: true });

const handleOptOut = async (client, phoneNumber) => {
  return { success: true, optOutProcessed: true };
};

const resolveOrganizationId = async (payload) => {
  try {
    const p = payload || {};
    let phoneNumberId = null;

    if (Array.isArray(p.entry) && p.entry.length > 0) {
      const entry = p.entry[0];
      if (Array.isArray(entry.changes) && entry.changes.length > 0) {
        const change = entry.changes[0];
        const value = change?.value;
        phoneNumberId = value?.phone_number_id;
      }
    }

    if (!phoneNumberId) {
      phoneNumberId = p.phone_number_id;
    }

    if (!phoneNumberId) {
      phoneNumberId = p.id;
    }

    if (phoneNumberId) {
      const { getChannelByPhoneNumberId } = await import('@/integrations/whatsapp');
      const channel = await getChannelByPhoneNumberId(null, phoneNumberId);
      return channel?.organizationId || null;
    }
  } catch (e) {
    console.warn('[openbsp-webhook] failed to resolve organizationId:', e?.message);
  }
  return null;
};

const handleMessageEvent = async (payload, organizationId) => {
  if (!organizationId) {
    console.error('[openbsp-webhook:messages] FAIL-CLOSED: organizationId não resolvido');
    return;
  }
};

const handleAccountEvent = async (payload, organizationId) => {
  if (!organizationId) {
    console.error('[openbsp-webhook:accounts] FAIL-CLOSED: organizationId não resolvido');
    return;
  }
};

const handleContactEvent = async (payload, organizationId) => {
  if (!organizationId) {
    console.error('[openbsp-webhook:contacts] FAIL-CLOSED: organizationId não resolvido');
    return;
  }
};

const extractEventId = (payload) => {
  const p = payload || {};
  if (p.id && typeof p.id === 'string') return p.id;
  if (Array.isArray(p.entry)) {
    const entry = p.entry[0];
    if (entry.id && typeof entry.id === 'string') return entry.id;
    if (Array.isArray(entry.changes)) {
      const change = entry.changes[0];
      const value = change?.value;
      if (Array.isArray(value?.messages) && value.messages.length > 0) {
        const msg = value.messages[0];
        if (msg.id && typeof msg.id === 'string') return msg.id;
      }
      if (Array.isArray(value?.statuses) && value.statuses.length > 0) {
        const st = value.statuses[0];
        if (st.id && typeof st.id === 'string') return st.id;
      }
    }
  }
  return null;
};

const logDLQ = async (tableName, rawBody, error) => {
  try {
    const { createServiceRoleClient } = require('@/lib/supabase/server');
    const svc = createServiceRoleClient();
    await svc.from('webhook_dead_letter').insert({
      event_type: `openbsp_${tableName}`,
      raw_body: rawBody.slice(0, 5000),
      error,
      attempt: 3,
      created_at: new Date().toISOString(),
    });
    console.error(`[openbsp-webhook:${tableName}] DLQ saved`);
  } catch (e) {
    console.error(`[openbsp-webhook:${tableName}] DLQ insert failed:`, e?.message);
  }
};

const handleOpenbspEvent = async (tableName, payload, rawBody) => {
  const openbspEventId = extractEventId(payload);

  if (openbspEventId) {
    const { createServiceRoleClient } = require('@/lib/supabase/server');
    const svc = createServiceRoleClient();
    const { data: existing } = await svc
      .from('webhook_events')
      .select('event_id')
      .eq('openbsp_event_id', openbspEventId)
      .maybeSingle();

    if (existing) {
      console.log(`[openbsp-webhook:${tableName}] duplicate event`, openbspEventId);
      return;
    }
  }

  const organizationId = await resolveOrganizationId(payload);

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (openbspEventId) {
        const { createServiceRoleClient } = require('@/lib/supabase/server');
        const svc = createServiceRoleClient();
        const claimed = await svc.$queryRaw`
          INSERT INTO webhook_events (event_id, openbsp_event_id, event_type, payload_hash, processed_at)
          VALUES (gen_random_uuid(), ${openbspEventId}, 'openbsp_${tableName}', sha256(${rawBody}::text), NOW())
          ON CONFLICT (openbsp_event_id) DO NOTHING
          RETURNING event_id
        `;
        if (!claimed.length) {
          console.log(`[openbsp-webhook:${tableName}] duplicate at claim time`, openbspEventId);
          return;
        }
      }

      switch (tableName) {
        case 'messages':
          await handleMessageEvent(payload, organizationId);
          break;
        case 'accounts':
          await handleAccountEvent(payload, organizationId);
          break;
        case 'contacts':
          await handleContactEvent(payload, organizationId);
          break;
        default:
          console.warn('[openbsp-webhook] unknown table:', tableName);
      }
      return;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error(`[openbsp-webhook:${tableName}] attempt ${attempt}:`, err.message);
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
      } else {
        await logDLQ(tableName, rawBody, err.message);
      }
    }
  }
};

module.exports = {
  handleOpenbspEvent,
  handleMessageEvent,
  handleAccountEvent,
  handleContactEvent,
  resolveOrganizationId,
  handleOptOut: async (client, phoneNumber) => {
    return { success: true, optOutProcessed: true };
  },
  resolveOrganizationId,
};

// Mocks para Supabase (fail-closed)
jest.mock('@/lib/supabase/server', () => {
  const createMockChain = () => {
    const chain = {};
    const methods = ['select', 'eq', 'neq', 'in', 'not', 'is', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'order', 'limit', 'range', 'single', 'maybeSingle', 'update', 'insert', 'delete', 'upsert'];
    for (const method of methods) {
      chain[method] = jest.fn(() => chain);
    }
    chain.then = jest.fn((resolve) => Promise.resolve().then(resolve));
    chain.catch = jest.fn((reject) => Promise.resolve().catch(reject));
    return chain;
  };

  return {
    createServiceRoleClient: jest.fn(() => {
      const chain = { select: jest.fn(() => ({ eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) })) };
      return {
        from: jest.fn(() => ({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) })),
        auth: {
          admin: { updateUserById: jest.fn().mockResolvedValue({ data: null, error: null }) },
        },
        rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
    createClient: jest.fn(() => {
      const chain = { select: jest.fn(() => ({ eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) })) };
      return {
        from: jest.fn(() => ({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) })),
        auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }), getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }) },
        realtime: { on: jest.fn() },
      };
    }),
    withUserContext: jest.fn(async (userId, fn) => fn({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) })),
    withTenantContext: jest.fn(async (client, orgId, fn) => fn(client)),
    withTenantContextOn: jest.fn(async (client, orgId, fn) => fn(client)),
  };
});

console.log('[jest.setup.js] Mocks carregados');