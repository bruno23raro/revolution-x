'use client';

// Navegação principal compartilhada (FASE 2).
//
// Um menu consistente em todas as páginas internas:
//  - mostra itens por papel (admin/owner veem o bloco administrativo);
//  - só aponta para páginas reais (sem links quebrados);
//  - estado não logado → mostra "Entrar";
//  - responsiva (menu recolhível no mobile);
//  - isolamento de organização é mantido pelas próprias rotas de API.
//
// Não expõe segredos; só lê /api/auth/session (dados próprios do usuário).

import { useEffect, useState } from 'react';
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

const BASE: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'CRM', href: '/crm' },
  { label: 'Relatórios', href: '/reports' },
];

const CRM_SUB: NavItem[] = [
  { label: 'Contatos', href: '/crm/contacts' },
  { label: 'Leads', href: '/crm/leads' },
  { label: 'Deals', href: '/crm/deals' },
];

const ADMIN: NavItem[] = [
  { label: 'Centro IA', href: '/admin/chat' },
  { label: 'Tarefas', href: '/admin/tasks' },
  { label: 'Memória', href: '/admin/memory' },
  { label: 'Integrações', href: '/integrations' },
  { label: 'WhatsApp', href: '/whatsapp' },
  { label: 'Instagram', href: '/instagram' },
  { label: 'Config', href: '/admin/settings' },
];

const SELF: NavItem[] = [{ label: 'Meu perfil', href: '/account' }];

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`block px-3 py-1.5 rounded-lg text-sm transition ${
        active
          ? 'text-white bg-purple-600/20 border border-purple-500/30'
          : 'text-gray-400 border border-transparent hover:text-white hover:bg-white/5'
      }`}
    >
      {item.label}
    </Link>
  );
}

export default function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

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

  const isAdmin = session?.role === 'admin' || session?.role === 'owner';
  const authed = Boolean(session?.authenticated);
  const close = () => setOpen(false);

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* continua o redirecionamento mesmo se a chamada falhar */
    }
    close();
    router.push('/login');
    router.refresh();
  };

  const groups: Array<{ label: string; items: NavItem[] }> = [];
  if (authed) {
    groups.push({ label: 'Visão geral', items: BASE });
    groups.push({ label: 'CRM', items: CRM_SUB });
    if (isAdmin) groups.push({ label: 'Administração', items: ADMIN });
    groups.push({ label: 'Conta', items: SELF });
  }

  return (
    <header className="sticky top-0 z-40 w-full bg-[#08040F]/95 backdrop-blur border-b border-white/10">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="text-base font-extrabold tracking-tight text-white" onClick={close}>
          Revolution X
        </Link>

        {/* Desktop */}
        <nav className="hidden md:flex items-center gap-1 flex-wrap">
          {loading ? (
            <span className="text-xs text-gray-500 px-2">carregando…</span>
          ) : authed ? (
            groups.map((g) => (
              <div key={g.label} className="flex items-center gap-1 mx-1 border-l border-white/10 pl-2">
                <span className="text-[10px] uppercase tracking-wider text-gray-600 w-14 shrink-0">{g.label}</span>
                {g.items.map((it) => (
                  <NavLink key={it.href} item={it} active={pathname === it.href} />
                ))}
              </div>
            ))
          ) : (
            <span className="text-xs text-gray-500">Área pública</span>
          )}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {authed ? (
            <>
              <span className="text-xs text-gray-500 truncate max-w-[160px]" title={session?.user.email ?? undefined}>
                {session?.user.email ?? '…'}
              </span>
              <button
                onClick={logout}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-white/15 text-gray-300 hover:text-white hover:bg-white/5"
              >
                Sair
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700"
            >
              Entrar
            </Link>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 text-gray-300"
          aria-label="Abrir menu"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="block w-5 h-0.5 bg-current mb-1" />
          <span className="block w-5 h-0.5 bg-current mb-1" />
          <span className="block w-5 h-0.5 bg-current" />
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden border-t border-white/10 bg-[#08040F] px-4 py-3 space-y-3">
          {authed && (
            <div className="text-xs text-gray-500 truncate">{session?.user.email}</div>
          )}
          {loading ? (
            <p className="text-xs text-gray-500">Carregando seu menu…</p>
          ) : (
            groups.map((g) => (
              <div key={g.label}>
                <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">{g.label}</div>
                <div className="grid grid-cols-2 gap-1">
                  {g.items.map((it) => (
                    <NavLink key={it.href} item={it} active={pathname === it.href} onNavigate={close} />
                  ))}
                </div>
              </div>
            ))
          )}
          <div className="pt-1 border-t border-white/10">
            {authed ? (
              <button
                onClick={logout}
                className="w-full px-3 py-2 text-sm rounded-lg border border-white/15 text-gray-300 hover:bg-white/5"
              >
                Sair
              </button>
            ) : (
              <Link href="/login" onClick={close} className="block w-full text-center px-3 py-2 text-sm rounded-lg bg-purple-600 text-white">
                Entrar
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
