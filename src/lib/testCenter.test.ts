// src/lib/testCenter.test.ts
//
// Centro de Testes — núcleo puro: catálogo completo + derivação de estado.
// Prova: (1) o catálogo cobre TODAS as partes reais sem hrefs quebrados;
// (2) o gate (login/papel) é honesto — nunca mostra parte que o usuário não vê;
// (3) sinais vivos das APIs read-only alimentam o status sem segredo;
// (4) NUNCA lança (sessão/sinal ausentes → estado degrado).

import { buildTestCenterView, groupParts, PARTS, partIds, Signals } from './testCenter';

const noSession = null;
const anon = { authenticated: false, role: null, organizationId: null };
const member = { authenticated: true, role: 'member', organizationId: 'org1' };
const owner = { authenticated: true, role: 'owner', organizationId: 'org1' };
const admin = { authenticated: true, role: 'admin', organizationId: 'org1' };

function statusOf(view: ReturnType<typeof buildTestCenterView>, id: string) {
  return view.parts.find((p) => p.id === id);
}

describe('catálogo (PARTS)', () => {
  it('ids únicos', () => {
    const ids = partIds();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todo href é rota interna (começa com /, sem esquema/hostname)', () => {
    for (const p of PARTS) {
      expect(p.href.startsWith('/')).toBe(true);
      expect(p.href).not.toMatch(/^[a-z]+:\/\//i); // não URL externa
    }
  });

  it('cobre as partes user-facing-chave do app (completude mínima)', () => {
    const ids = new Set(partIds());
    for (const required of [
      'home', 'login', 'register',
      'dashboard', 'crm', 'crm_deals', 'crm_pipelines', 'reports',
      'integrations', 'whatsapp', 'instagram', 'facebook', 'tiktok',
      'admin_chat', 'admin_tasks', 'admin_memory', 'admin_settings',
      'api_session', 'api_health', 'cron_tiktok',
    ]) {
      expect(ids.has(required)).toBe(true);
    }
  });

  it('grupos contêm apenas itens do próprio grupo (sem vazamento)', () => {
    const view = buildTestCenterView(owner);
    for (const g of groupParts(view.parts)) {
      for (const item of g.items) {
        expect(item.group).toBe(g.group);
      }
    }
  });
});

describe('gate de login / papel', () => {
  it('parte pública: nunca locked (mesmo sem sessão)', () => {
    const view = buildTestCenterView(noSession);
    for (const p of view.parts.filter((x) => x.group === 'publico')) {
      expect(p.locked).toBe(false);
      expect(p.status).toBe('ok');
    }
  });

  it('parte protegida: locked p/ anônimo, aberta p/ logado', () => {
    const anonView = buildTestCenterView(anon);
    expect(statusOf(anonView, 'dashboard')!.locked).toBe(true);
    expect(statusOf(anonView, 'dashboard')!.status).toBe('skipped');

    const memberView = buildTestCenterView(member);
    expect(statusOf(memberView, 'dashboard')!.locked).toBe(false);
    expect(statusOf(memberView, 'dashboard')!.status).toBe('ok');
  });

  it('parte adminOnly: locked p/ member mesmo logado; aberta p/ owner/admin', () => {
    const memberView = buildTestCenterView(member);
    expect(statusOf(memberView, 'integrations')!.locked).toBe(true);
    expect(statusOf(memberView, 'admin_chat')!.status).toBe('skipped');

    for (const s of [owner, admin]) {
      const view = buildTestCenterView(s);
      expect(statusOf(view, 'integrations')!.locked).toBe(false);
      expect(statusOf(view, 'admin_settings')!.status).toBe('ok');
    }
  });

  it('sem sessão → tudo protegido/admin fica locked; público segue vivo', () => {
    const view = buildTestCenterView(noSession);
    expect(view.counts.locked).toBeGreaterThan(0);
    expect(view.counts.live).toBeGreaterThan(0);
    expect(statusOf(view, 'home')!.status).toBe('ok');
    expect(statusOf(view, 'dashboard')!.locked).toBe(true);
  });
});

describe('sinais vivos das APIs read-only', () => {
  it('API não-admin com sinal ok mostra o sinal (sem segredo)', () => {
    const signals: Signals = { api_session: { status: 'ok', detail: 'authenticated' } };
    const view = buildTestCenterView(member, signals);
    expect(statusOf(view, 'api_session')!.status).toBe('ok');
    expect(statusOf(view, 'api_session')!.detail).toContain('authenticated');
  });

  it('API adminOnly: sinal ignorado p/ quem não tem papel (locked), usado p/ admin', () => {
    const signals: Signals = { api_health: { status: 'error', detail: 'HTTP 500' } };
    const memberView = buildTestCenterView(member, signals);
    expect(statusOf(memberView, 'api_health')!.locked).toBe(true);
    expect(statusOf(memberView, 'api_health')!.status).toBe('skipped');

    const adminView = buildTestCenterView(admin, signals);
    expect(statusOf(adminView, 'api_health')!.locked).toBe(false);
    expect(statusOf(adminView, 'api_health')!.status).toBe('error');
  });

  it('sinal de erro conta como "problems" nas contagens', () => {
    const signals: Signals = { api_session: { status: 'error', detail: 'HTTP 500' } };
    const view = buildTestCenterView(owner, signals);
    expect(view.counts.problems).toBe(1);
  });

  it('sinal ausente não lança: página cai p/ "ok" catalogado', () => {
    const view = buildTestCenterView(owner, {});
    expect(statusOf(view, 'cron_tiktok')).toBeDefined();
    expect(statusOf(view, 'cron_tiktok')!.status).toBe('ok'); // catalogada
  });
});

describe('degradação honesta / invariância', () => {
  it('não quebra com sessão parcial (role nulo) nem com sinal malfiado', () => {
    const weird: Signals = { api_session: { status: 'skipped' } as unknown as Signals[string] };
    const view = buildTestCenterView({ authenticated: true, role: null, organizationId: null }, weird);
    expect(view.isAdmin).toBe(false);
    expect(view.parts.length).toBe(PARTS.length);
  });

  it('contagens batem com o total de partes', () => {
    for (const s of [noSession, anon, member, owner, admin]) {
      const view = buildTestCenterView(s);
      expect(view.counts.total).toBe(PARTS.length);
      expect(view.counts.live + view.counts.problems).toBeLessThanOrEqual(view.counts.total);
      expect(view.parts.length).toBe(view.counts.total);
    }
  });
});
