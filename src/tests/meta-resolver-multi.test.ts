// MULTICONTAS Meta — teste de unidade do resolver (`meta_integrations`).
//
// Fronteira: supabase service_role + encryption mockados; o resolver é REAL.
// Comprova a camada de multicontas: (1) seleção DETERMINÍSTICA por
// `connected_at desc` (o `.limit(1)` não-ordenado antigo devolve ordem
// arbitrária), (2) ancoragem por `accountId` (row id) e (3) `account_not_found`
// quando o id não existe no tenant. Sem rede, sem banco.

import type { PrismaClient } from '@prisma/client';

jest.mock('@/lib/encryption', () => ({
  decryptToken: jest.fn(),
  encryptToken: jest.fn(),
}));
jest.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: jest.fn(),
  createClient: jest.fn(),
}));
// O resolver só usa TaskQueueUnavailableError (p/ o resolver de Ads); demais
// fronteiras (configStore/getProviderConfig) ficam reais para o caso Ads.
jest.mock('@/lib/taskQueue', () => ({
  TaskQueueUnavailableError: jest.requireActual('@/lib/taskQueue').TaskQueueUnavailableError,
}));
jest.mock('@/integrations/configStore', () => ({
  getProviderConfig: jest.fn(),
}));

const { decryptToken } = require('@/lib/encryption');
const { createServiceRoleClient } = require('@/lib/supabase/server');
const { getProviderConfig } = require('@/integrations/configStore');
const {
  resolveTenantMetaAccess,
  resolveTenantPublisherAccess,
  resolveTenantFacebookPageAccess,
  resolveTenantMetaAdsAccess,
} = require('@/integrations/meta/resolveAccess');

const fakeClient = { __fake: 'client' } as unknown as PrismaClient;

// Um "row" de meta_integrations (forma SNAKE real da tabela Supabase).
type Row = {
  id: string;
  provider: string;
  status: string;
  connected_at: string;
  encrypted_access_token?: string | null;
  meta_page_id?: string | null;
  instagram_account_id?: string | null;
  phone_number_id?: string | null;
  whatsapp_business_account_id?: string | null;
};

/**
 * Monta um client service_role fake com a cadeia EXATA do resolver:
 * from().select().eq(org).in(provider).neq(status).order(connected_at desc)
 * [.eq(id)] .limit(1).maybeSingle(). Emula `.limit(1)` + `.maybeSingle()`
 * (devolve a 1ª linha após filtrar+ordenar, ou null).
 */
function fakeService(rows: Row[]) {
  const chain = {
    _id: null as string | null,
    _providers: null as string[] | null,
    select: () => chain,
    eq: (col: string, val: string) => {
      if (col === 'id') chain._id = val;
      // organization_id não filtra aqui (todas as linhas já são do tenant).
      return chain;
    },
    in: (_col: string, val: string[]) => {
      chain._providers = val;
      return chain;
    },
    neq: () => chain, // status != DISCONNECTED
    order: () => chain, // connected_at desc
    limit: () => chain, // limit(1)
    maybeSingle: async () => {
      // Emula o filtro real: organização (já aplicada) + DISCONNECTED + order.
      let out = rows.filter((r) => r.status !== 'DISCONNECTED');
      if (chain._id != null) {
        out = out.filter((r) => r.id === chain._id);
      } else if (chain._providers != null) {
        out = out.filter((r) => chain._providers!.includes(r.provider));
      }
      // Determinístico: o mais recente (connected_at desc, tie-break por id).
      out = [...out].sort((a, b) =>
        (b.connected_at || '').localeCompare(a.connected_at || '') || a.id.localeCompare(b.id),
      );
      const data = out.slice(0, 1)[0] ?? null;
      return { data, error: null };
    },
  };
  const service = { from: () => chain };
  (createServiceRoleClient as jest.Mock).mockReturnValue(service);
  return service;
}

const ORG = 'org-1';

// Dois números de WhatsApp (o mais recente, jan/2026 vs jun/2026).
const TWO_WHATSAPP = (): Row[] => [
  {
    id: 'row-a',
    provider: 'whatsapp',
    status: 'CONNECTED',
    connected_at: '2026-01-01T00:00:00Z',
    encrypted_access_token: 'CIPH_A',
    phone_number_id: 'PN_A',
  },
  {
    id: 'row-b',
    provider: 'whatsapp',
    status: 'CONNECTED',
    connected_at: '2026-06-01T00:00:00Z',
    encrypted_access_token: 'CIPH_B',
    phone_number_id: 'PN_B',
  },
];

beforeEach(() => {
  jest.resetAllMocks();
  (decryptToken as jest.Mock).mockImplementation((c) => `PLAIN_${c}`);
});

describe('resolveTenantMetaAccess (determinístico + ancoragem por conta)', () => {
  it('sem account: devolve a linha MAIS RECENTE (row-b), não arbitrária', async () => {
    fakeService(TWO_WHATSAPP());
    const r = await resolveTenantMetaAccess(ORG);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.row.id).toBe('row-b'); // jun/2026 > jan/2026
    expect(r.access.phoneNumberId).toBe('PN_B');
    expect(decryptToken).toHaveBeenCalledWith('CIPH_B');
  });

  it('accountId ancorando a conta MAIS ANTIGA (row-a) é honrada mesmo não sendo a padrão', async () => {
    fakeService(TWO_WHATSAPP());
    const r = await resolveTenantMetaAccess(ORG, {}, 'row-a');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.row.id).toBe('row-a');
    expect(r.access.phoneNumberId).toBe('PN_A');
    expect(decryptToken).toHaveBeenCalledWith('CIPH_A');
  });

  it('accountId inexistente no tenant → account_not_found', async () => {
    fakeService(TWO_WHATSAPP());
    const r = await resolveTenantMetaAccess(ORG, {}, 'row-zzz');
    expect(r).toEqual({ ok: false, reason: 'account_not_found' });
  });

  it('tenant vazio (sem account) → not_connected; c/ account → account_not_found', async () => {
    fakeService([]);
    expect(await resolveTenantMetaAccess(ORG)).toEqual({ ok: false, reason: 'not_connected' });
    expect(await resolveTenantMetaAccess(ORG, {}, 'row-a')).toEqual({ ok: false, reason: 'account_not_found' });
  });

  it('linhas DISCONNECTED não entram no seletor de conta padrão', async () => {
    fakeService([
      { id: 'row-x', provider: 'whatsapp', status: 'DISCONNECTED', connected_at: '2026-09-01T00:00:00Z', encrypted_access_token: 'CIPH_X', phone_number_id: 'PN_X' },
    ]);
    expect(await resolveTenantMetaAccess(ORG)).toEqual({ ok: false, reason: 'not_connected' });
  });

  it('token vazio → no_token; decrypt lança → decrypt_failed', async () => {
    fakeService([
      { id: 'row-a', provider: 'whatsapp', status: 'CONNECTED', connected_at: '2026-01-01T00:00:00Z', encrypted_access_token: '' },
    ]);
    expect(await resolveTenantMetaAccess(ORG)).toEqual({ ok: false, reason: 'no_token' });

    fakeService(TWO_WHATSAPP());
    (decryptToken as jest.Mock).mockImplementation(() => {
      throw new Error('chave ausente');
    });
    expect(await resolveTenantMetaAccess(ORG)).toEqual({ ok: false, reason: 'decrypt_failed' });
  });
});

describe('resolveTenantPublisherAccess / resolveTenantFacebookPageAccess (âncora + order)', () => {
  const twoPages = (): Row[] => [
    {
      id: 'pg-old',
      provider: 'facebook',
      status: 'CONNECTED',
      connected_at: '2026-02-01T00:00:00Z',
      encrypted_access_token: 'CIPH_OLD',
      meta_page_id: 'PAGE_OLD',
      instagram_account_id: 'IG_OLD',
    },
    {
      id: 'pg-new',
      provider: 'instagram',
      status: 'CONNECTED',
      connected_at: '2026-07-01T00:00:00Z',
      encrypted_access_token: 'CIPH_NEW',
      meta_page_id: 'PAGE_NEW',
      instagram_account_id: 'IG_NEW',
    },
  ];

  it('publisher: padrão = mais recente (pg-new) e honra ancoragem por id', async () => {
    fakeService(twoPages());
    const dflt = await resolveTenantPublisherAccess(ORG);
    expect(dflt.ok).toBe(true);
    if (dflt.ok) expect(dflt.access.instagramUserId).toBe('IG_NEW');

    const pinned = await resolveTenantPublisherAccess(ORG, {}, 'pg-old');
    expect(pinned.ok).toBe(true);
    if (pinned.ok) expect(pinned.access.instagramUserId).toBe('IG_OLD');
  });

  it('facebook page: padrão = mais recente; account_not_found p/ id inexistente', async () => {
    // O resolver de Página ancora em provider facebook/whatsapp → fixture só
    // com facebook (duas PÁGINAS, a mais recente sendo a padrão).
    fakeService([
      {
        id: 'fb-old',
        provider: 'facebook',
        status: 'CONNECTED',
        connected_at: '2026-02-01T00:00:00Z',
        encrypted_access_token: 'CIPH_OLD',
        meta_page_id: 'PAGE_OLD',
      },
      {
        id: 'fb-new',
        provider: 'facebook',
        status: 'CONNECTED',
        connected_at: '2026-07-01T00:00:00Z',
        encrypted_access_token: 'CIPH_NEW',
        meta_page_id: 'PAGE_NEW',
      },
    ]);
    const dflt = await resolveTenantFacebookPageAccess(ORG);
    expect(dflt.ok).toBe(true);
    if (dflt.ok) expect(dflt.access.facebookPageId).toBe('PAGE_NEW');

    const miss = await resolveTenantFacebookPageAccess(ORG, {}, 'nope');
    expect(miss).toEqual({ ok: false, reason: 'account_not_found' });
  });

  it('facebook page sem meta_page_id → no_fb_page (mantém a semântica antiga)', async () => {
    fakeService([
      { id: 'pg', provider: 'facebook', status: 'CONNECTED', connected_at: '2026-05-01T00:00:00Z', encrypted_access_token: 'CIPH', meta_page_id: null },
    ]);
    expect(await resolveTenantFacebookPageAccess(ORG)).toEqual({ ok: false, reason: 'no_fb_page' });
  });
});

describe('resolveTenantMetaAdsAccess (delega a access + adAccountId via configStore)', () => {
  it('conta ancorada + adAccountId presente → ok com o token da conta pedida', async () => {
    fakeService(TWO_WHATSAPP());
    (getProviderConfig as jest.Mock).mockResolvedValue({ adAccountId: 'AD_123' });
    const r = await resolveTenantMetaAdsAccess(fakeClient, { organizationId: ORG, userId: 'u-1' }, {}, 'row-a');
    expect(r).toEqual({ ok: true, access: { accessToken: 'PLAIN_CIPH_A', adAccountId: 'AD_123' } });
  });

  it('sem adAccountId → no_ad_account (contas conectadas, mas ID ausente)', async () => {
    fakeService(TWO_WHATSAPP());
    (getProviderConfig as jest.Mock).mockResolvedValue({});
    const r = await resolveTenantMetaAdsAccess(fakeClient, { organizationId: ORG, userId: 'u-1' });
    expect(r).toEqual({ ok: false, reason: 'no_ad_account' });
  });

  it('accountId inexistente → account_not_found (propagado do resolver base)', async () => {
    fakeService(TWO_WHATSAPP());
    (getProviderConfig as jest.Mock).mockResolvedValue({ adAccountId: 'AD_123' });
    const r = await resolveTenantMetaAdsAccess(fakeClient, { organizationId: ORG, userId: 'u-1' }, {}, 'zzz');
    expect(r).toEqual({ ok: false, reason: 'account_not_found' });
  });
});
