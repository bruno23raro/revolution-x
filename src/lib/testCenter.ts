// Centro de Testes — catálogo de TODAS as partes do site + estado derivado.
//
// Núcleo PURO e testável (mesmo padrão de house: injeção de dados, NUNCA
// lança, degradação honesta). A página `app/testcenter/page.tsx` é fina:
// só coleta o sinal vivo das APIs read-only existentes e delega aqui a
// derivação do status de cada parte.
//
// Segurança: nenhum segredo; cada entrada aponta para uma rota REAL do app
// (link = redirecionamento do tester). Áreas protegidas exigem login; áreas
// admin/owner exigem o papel — e o estado reflete isso (locked), nunca finge.
//
// Sondas read-only (a página produz e injeta em `signals`):
//   • /api/auth/session            → autenticado? (dados próprios, sem segredo)
//   • GET /api/cron/tiktok         → 405 sem segredo (rota viva; POST exige
//                                     x-cron-secret — nunca disparado aqui)
//   • /api/integrations/health     → só estado dos provedores (nunca o segredo)

import type { ProbeStatus } from '@/integrations/providers';

export type GroupId = 'publico' | 'plataforma' | 'integracoes' | 'admin' | 'api';

export interface PartDef {
  id: string;
  label: string;
  group: GroupId;
  kind: 'page' | 'api';
  /** página: rota navegável; api: endpoint (mostrado como chip, não navigado). */
  href: string;
  /** exige papel admin/owner. */
  adminOnly?: boolean;
  /** exige login. */
  protected?: boolean;
  /** descrição curta para o tester. */
  note?: string;
}

export const GROUPS: { id: GroupId; label: string }[] = [
  { id: 'publico', label: 'Público' },
  { id: 'plataforma', label: 'Plataforma (exige login)' },
  { id: 'integracoes', label: 'Integrações & canais' },
  { id: 'admin', label: 'Administração (admin/owner)' },
  { id: 'api', label: 'APIs (sondas read-only)' },
];

/**
 * Catálogo estático de TODAS as partes user-facing do app + as sondas read-only.
 * Cada `href` é uma rota real — nenhum link apontando para 404.
 */
export const PARTS: PartDef[] = [
  // ===== Público (funciona sem login) =====
  { id: 'home', label: 'Página inicial', group: 'publico', kind: 'page', href: '/', note: 'Landing' },
  { id: 'login', label: 'Login', group: 'publico', kind: 'page', href: '/login' },
  { id: 'register', label: 'Cadastro', group: 'publico', kind: 'page', href: '/register' },
  { id: 'forgot', label: 'Recuperar senha', group: 'publico', kind: 'page', href: '/forgot-password' },
  { id: 'reset', label: 'Redefinir senha', group: 'publico', kind: 'page', href: '/reset-password' },
  { id: 'verify', label: 'Verificar e-mail', group: 'publico', kind: 'page', href: '/verify-email' },
  { id: 'onb_success', label: 'Onboarding · sucesso', group: 'publico', kind: 'page', href: '/onboarding/success' },
  { id: 'onb_error', label: 'Onboarding · erro', group: 'publico', kind: 'page', href: '/onboarding/error' },

  // ===== Plataforma (exige login; dados isolados por tenant) =====
  { id: 'dashboard', label: 'Dashboard', group: 'plataforma', kind: 'page', href: '/dashboard', protected: true },
  { id: 'crm', label: 'CRM · visão geral', group: 'plataforma', kind: 'page', href: '/crm', protected: true },
  { id: 'crm_contacts', label: 'CRM · contatos', group: 'plataforma', kind: 'page', href: '/crm/contacts', protected: true },
  { id: 'crm_leads', label: 'CRM · leads', group: 'plataforma', kind: 'page', href: '/crm/leads', protected: true },
  { id: 'crm_deals', label: 'CRM · deals', group: 'plataforma', kind: 'page', href: '/crm/deals', protected: true },
  { id: 'crm_pipelines', label: 'CRM · pipelines', group: 'plataforma', kind: 'page', href: '/crm/pipelines', protected: true },
  { id: 'reports', label: 'Relatórios', group: 'plataforma', kind: 'page', href: '/reports', protected: true },
  { id: 'calendar', label: 'Calendário', group: 'plataforma', kind: 'page', href: '/calendar', protected: true },
  { id: 'publisher', label: 'Publisher', group: 'plataforma', kind: 'page', href: '/publisher', protected: true },
  { id: 'video', label: 'Vídeo', group: 'plataforma', kind: 'page', href: '/video', protected: true },
  { id: 'account', label: 'Meu perfil', group: 'plataforma', kind: 'page', href: '/account', protected: true },

  // ===== Integrações & canais (admin/owner) =====
  { id: 'integrations', label: 'Hub de integrações', group: 'integracoes', kind: 'page', href: '/integrations', adminOnly: true },
  { id: 'whatsapp', label: 'WhatsApp Business', group: 'integracoes', kind: 'page', href: '/whatsapp', adminOnly: true },
  { id: 'instagram', label: 'Instagram', group: 'integracoes', kind: 'page', href: '/instagram', adminOnly: true },
  { id: 'facebook', label: 'Facebook', group: 'integracoes', kind: 'page', href: '/facebook', adminOnly: true },
  {
    id: 'tiktok',
    label: 'TikTok',
    group: 'integracoes',
    kind: 'page',
    href: '/tiktok',
    adminOnly: true,
    note: 'publicar/agendar + card “Agendados” (executor FASE 4)',
  },

  // ===== Administração (admin/owner) =====
  { id: 'admin_chat', label: 'Centro IA · chat', group: 'admin', kind: 'page', href: '/admin/chat', adminOnly: true },
  { id: 'admin_tasks', label: 'Tarefas', group: 'admin', kind: 'page', href: '/admin/tasks', adminOnly: true },
  { id: 'admin_memory', label: 'Memória', group: 'admin', kind: 'page', href: '/admin/memory', adminOnly: true },
  { id: 'admin_settings', label: 'Configurações', group: 'admin', kind: 'page', href: '/admin/settings', adminOnly: true },

  // ===== APIs — sondas read-only (funcionando?) =====
  {
    id: 'api_session',
    label: 'API · sessão',
    group: 'api',
    kind: 'api',
    href: '/api/auth/session',
    note: 'GET; devolve auth/role/organizationId (dados próprios, sem segredo)',
  },
  {
    id: 'api_health',
    label: 'API · health de integrações',
    group: 'api',
    kind: 'api',
    href: '/api/integrations/health',
    adminOnly: true,
    note: 'GET; apenas o estado dos provedores, nunca o segredo',
  },
  {
    id: 'cron_tiktok',
    label: 'API · gatilho do cron TikTok',
    group: 'api',
    kind: 'api',
    href: '/api/cron/tiktok',
    adminOnly: true,
    note: 'POST + header x-cron-secret (env CRON_SECRET). GET responde 405 sem segredo — sonda de vida, nunca dispara.',
  },
];

export interface SessionLike {
  authenticated: boolean;
  role: string | null;
  organizationId: string | null;
}

export interface PartStatus extends PartDef {
  status: ProbeStatus;
  detail?: string;
  /** true quando exige login/papel e o usuário atual não cumpre. */
  locked: boolean;
}

export interface TestCenterView {
  authenticated: boolean;
  role: string | null;
  isAdmin: boolean;
  organizationId: string | null;
  parts: PartStatus[];
  counts: { total: number; live: number; locked: number; problems: number };
}

/** Sinais vivos que a página coleta das APIs read-only e injeta aqui. */
export type Signals = Record<string, { status: ProbeStatus; detail?: string }>;

/**
 * Deriva a visão do Centro de Testes a partir da sessão + sinais vivos.
 * NUNCA lança: sessão ausente, sinal ausente ou inválido viram estado honesto.
 */
export function buildTestCenterView(
  session: SessionLike | null,
  signals: Signals = {},
): TestCenterView {
  const authenticated = Boolean(session?.authenticated);
  const role = session?.role ?? null;
  const isAdmin = role === 'admin' || role === 'owner';

  const parts: PartStatus[] = PARTS.map((p) => {
    // Sonda API viva com sinal: usa o status real (mas fica "locked" se o
    // usuário não tem o papel que a rota exige — nunca mostra dado que não vê).
    if (p.kind === 'api' && signals[p.id]) {
      const sig = signals[p.id];
      const locked = Boolean(p.adminOnly) && !isAdmin;
      // Se a rota exige papel e o usuário não tem: estado "skipped" e detalhe
      // só com a info pública que ele já tem direito de ver (nunca o payload).
      const detail = locked
        ? sig.detail
          ? `exige papel admin/owner (rota respondeu ${sig.detail})`
          : 'exige papel admin/owner'
        : sig.detail;
      return { ...p, status: locked ? 'skipped' : sig.status, detail, locked };
    }

    // Páginas: a rota é catalogada (link real, sem 404) → "ok"; mas o gate
    // reflete o que o usuário CONSEGUE acessar.
    let locked = false;
    let status: ProbeStatus = 'ok';
    let detail: string | undefined = p.note;
    if (p.adminOnly && !isAdmin) {
      locked = true;
      status = 'skipped';
      detail = 'exige papel admin/owner';
    } else if (p.protected && !authenticated) {
      locked = true;
      status = 'skipped';
      detail = 'exige login';
    }
    return { ...p, status, detail, locked };
  });

  const live = parts.filter((x) => x.status === 'ok').length;
  const lockedCount = parts.filter((x) => x.locked).length;
  const problems = parts.filter((x) => x.status === 'error' || x.status === 'not_configured').length;

  return {
    authenticated,
    role,
    isAdmin,
    organizationId: session?.organizationId ?? null,
    parts,
    counts: { total: parts.length, live, locked: lockedCount, problems },
  };
}

/** Agrupa as partes na ordem dos grupos (para render). NUNCA lança. */
export function groupParts(parts: PartStatus[]): { group: GroupId; label: string; items: PartStatus[] }[] {
  return GROUPS.map((g) => ({
    group: g.id,
    label: g.label,
    items: parts.filter((p) => p.group === g.id),
  })).filter((g) => g.items.length > 0);
}

/** ids de todas as partes — útil para auditoria/completude. */
export function partIds(): string[] {
  return PARTS.map((p) => p.id);
}
