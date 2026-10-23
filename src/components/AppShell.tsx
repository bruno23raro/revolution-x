'use client';

// FASE 14 — Shell de navegação vertical (seção 14): sidebar à esquerda para
// TODAS as rotas autenticadas + topbar mobile. Substitui <AppNav /> nas
// páginas internas; as páginas passam a renderizar <AppShell>{conteúdo}</AppShell>.
//
//  * grupos reais com links REAIS (sem links falsos — cada href existe em app/);
//  * estado ativo com aria-current="page" (match por prefixo: /campaigns/[id]
//    mantém "Campanhas" ativo);
//  * administração visível apenas para role admin|owner (mesma regra do AppNav);
//  * menu mobile com overlay, fechamento por Esc e foco para acessibilidade;
//  * só lê /api/auth/session — nenhum segredo exposto no front-end.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface Session {
  authenticated: boolean;
  role: string | null;
  organizationId: string | null;
  user: { id: string; email: string | null; email_verified: boolean };
}

interface NavItem {
  label: string;
  href: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Cada href existe em app/ — nenhum link falso (§14: "Não crie links falsos.").
const GROUPS: NavGroup[] = [
  {
    label: 'Visão geral',
    items: [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Agenda', href: '/calendar' },
      { label: 'Vídeo', href: '/video' },
      { label: 'Publicação', href: '/publisher' },
    ],
  },
  {
    label: 'Contatos',
    items: [
      { label: 'Contatos', href: '/crm/contacts' },
      { label: 'Importação CSV', href: '/crm/contacts/import' },
    ],
  },
  {
    label: 'CRM',
    items: [
      { label: 'Visão geral', href: '/crm' },
      { label: 'Leads', href: '/crm/leads' },
      { label: 'Negociações', href: '/crm/deals' },
      { label: 'Pipelines', href: '/crm/pipelines' },
    ],
  },
  {
    label: 'Campanhas e disparos',
    items: [{ label: 'Campanhas', href: '/campaigns' }],
  },
  {
    label: 'Canais e integrações',
    items: [
      { label: 'WhatsApp', href: '/whatsapp' },
      { label: 'Instagram', href: '/instagram' },
      { label: 'Facebook', href: '/facebook' },
      { label: 'TikTok', href: '/tiktok' },
      { label: 'Integrações', href: '/integrations' },
    ],
  },
  {
    label: 'IA e modelos',
    items: [
      { label: 'IA e modelos', href: '/ai' },
      { label: 'Centro IA', href: '/admin/chat' },
    ],
  },
  {
    label: 'Relatórios',
    items: [{ label: 'Relatórios', href: '/reports' }],
  },
  {
    label: 'Configurações',
    items: [
      { label: 'Meu perfil', href: '/account' },
      { label: 'Centro de testes', href: '/testcenter' },
    ],
  },
];

// Somente admin/owner (mesma regra de AppNav).
const ADMIN_GROUP: NavGroup = {
  label: 'Administração',
  items: [
    { label: 'Tarefas', href: '/admin/tasks' },
    { label: 'Memória', href: '/admin/memory' },
    { label: 'Configuração', href: '/admin/settings' },
  ],
};

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SideLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`block rounded-lg px-3 py-1.5 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
        active
          ? 'border border-purple-500/30 bg-purple-600/20 text-white'
          : 'border-transparent text-gray-300 hover:bg-white/5 hover:text-white transition-colors'
      }`}
    >
      {item.label}
    </Link>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/session')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setSession(d);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setSession(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const authed = Boolean(session?.authenticated);
  const isAdmin = session?.role === 'admin' || session?.role === 'owner';
  const groups: NavGroup[] = authed ? [...GROUPS, ...(isAdmin ? [ADMIN_GROUP] : [])] : [];

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // Acessibilidade (§14): Esc fecha o menu mobile + trava o scroll do body
  // enquanto o drawer está aberto. Como o drawer declara aria-modal="true",
  // o foco fica contido nele (Tab/Shift+Tab em ciclo) e é devolvido ao botão
  // de origem ao fechar — WCAG 2.1.2 (no keyboard trap perdido/fujão).
  useEffect(() => {
    if (!mobileOpen) return;
    const opener = document.activeElement as HTMLElement | null;
    const FOCUSABLE =
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const drawer = drawerRef.current;
      if (!drawer) return;
      const items = Array.from(drawer.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === drawer
      );
      if (items.length === 0) {
        e.preventDefault();
        drawer.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === drawer)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (!drawer.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawerRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      if (opener && typeof opener.focus === 'function') opener.focus();
    };
  }, [mobileOpen]);

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* continua o redirecionamento mesmo se a chamada falhar */
    }
    closeMobile();
    router.push('/login');
    router.refresh();
  };

  const sidebarNav = loading ? (
    <span className="px-3 text-xs text-gray-300">carregando…</span>
  ) : authed ? (
    <div className="space-y-4 px-3">
      {groups.map((g) => (
        <div key={g.label}>
          <div className="px-3 pb-1 text-[10px] uppercase tracking-wider text-gray-300">
            {g.label}
          </div>
          <div className="space-y-1">
            {g.items.map((it) => (
              <SideLink key={it.href} item={it} pathname={pathname} onNavigate={closeMobile} />
            ))}
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="px-3 text-xs text-gray-300">
      Área pública
      <div className="mt-3">
        <Link
          href="/login"
          onClick={closeMobile}
          className="block rounded-lg bg-purple-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
        >
          Entrar
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#05020A]">
      {/* ── Sidebar (desktop, vertical à esquerda) ─────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-white/10 bg-[#08040F] md:flex">
        <div className="flex h-14 shrink-0 items-center px-4">
          <Link
            href="/dashboard"
            className="text-base font-extrabold tracking-tight text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            Revolution X
          </Link>
        </div>
        <nav aria-label="Menu principal (desktop)" className="flex-1 overflow-y-auto py-4">
          {sidebarNav}
        </nav>
        <div className="shrink-0 border-t border-white/10 p-3">
          {authed ? (
            <>
              <div
                className="truncate text-xs text-gray-300"
                title={session?.user.email ?? undefined}
              >
                {session?.user.email ?? '…'}
              </div>
              <button
                onClick={logout}
                className="mt-2 w-full rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-gray-300 transition hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              >
                Sair
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="block w-full rounded-lg bg-purple-600 px-3 py-1.5 text-center text-xs font-semibold text-white hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              Entrar
            </Link>
          )}
        </div>
      </aside>

      {/* ── Topbar (mobile) ────────────────────────────────────────────── */}
      <header aria-label="Cabeçalho" className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/10 bg-[#08040F]/95 px-4 backdrop-blur md:hidden">
        <button
          aria-label="Abrir menu"
          aria-controls="rx-mobile-menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((o) => !o)}
          className="rounded-lg p-2 text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
        >
          <span className="block mb-1 h-0.5 w-5 bg-current" />
          <span className="block mb-1 h-0.5 w-5 bg-current" />
          <span className="block h-0.5 w-5 bg-current" />
        </button>
        <Link href="/dashboard" className="text-sm font-extrabold tracking-tight text-white">
          Revolution X
        </Link>
        <div className="flex items-center gap-2">
          {authed ? (
            <button
              onClick={logout}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/5"
            >
              Sair
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700"
            >
              Entrar
            </Link>
          )}
        </div>
      </header>

      {/* ── Drawer mobile ──────────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="Fechar menu"
            onClick={closeMobile}
            className="absolute inset-0 h-full w-full cursor-default bg-black/60"
          />
          <div
            ref={drawerRef}
            id="rx-mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            tabIndex={-1}
            className="absolute inset-y-0 left-0 w-72 max-w-[85%] overflow-y-auto bg-[#08040F] p-4 focus:outline-none"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-extrabold text-white">Revolution X</span>
              <button
                aria-label="Fechar menu"
                onClick={closeMobile}
                className="rounded-lg p-1.5 text-gray-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              >
                ✕
              </button>
            </div>
            <nav aria-label="Menu principal (celular)" className="pb-8">
              {sidebarNav}
            </nav>
          </div>
        </div>
      )}

      {/* ── Conteúdo da página (desloçado pela sidebar no desktop) ────── */}
      <main aria-label="Conteúdo principal" className="md:pl-60">{children}</main>
    </div>
  );
}
