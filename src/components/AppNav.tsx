'use client';

// Navegação principal compartilhada (FASE 2) — sidebar fixa à esquerda.
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

// Grupos visuais claros com cores distintivas para categorias
const BASE: NavItem[] = [
  { label: 'Dashboard 📊', href: '/dashboard' },
  { label: 'CRM 📋', href: '/crm' },
  { label: 'Relatórios 📈', href: '/reports' },
];

const CRM_SUB: NavItem[] = [
  { label: 'Contatos', href: '/crm/contacts' },
  { label: 'Leads', href: '/crm/leads' },
  { label: 'Deals', href: '/crm/deals' },
];

// Integrações Oficiais — cor verde/azul
const INTEGRATIONS_OFFICIAL: NavItem[] = [
  { label: 'WhatsApp API Oficial 💬', href: '/whatsapp' },
  { label: 'Instagram Business 📸', href: '/instagram' },
  { label: 'Facebook Pages 📘', href: '/facebook' },
  { label: 'TikTok 🎵', href: '/tiktok' },
];

// Ferramentas de Extração — cor laranja/vermelho
const EXTRACTION_TOOLS: NavItem[] = [
  { label: 'Scrapers', href: '/scrapers' },
  { label: 'Extração de Grupos', href: '/group-extraction' },
  { label: 'Disparo em Massa', href: '/mass-sending' },
];

// Integrações adicionais no grupo admin
const ADMIN_INTEGRATIONS: NavItem[] = [
  { label: 'Integrações', href: '/integracoes' },
  { label: 'Hub', href: '/integrations' },
];

const ADMIN: NavItem[] = [
  { label: 'Centro IA', href: '/admin/chat' },
  { label: 'Tarefas', href: '/admin/tasks' },
  { label: 'Memória', href: '/admin/memory' },
  ...ADMIN_INTEGRATIONS,
  { label: 'Config', href: '/admin/settings' },
];

const ADMIN_GROUP = { label: 'Administração', items: ADMIN };

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
      className={`block px-3 py-1.5 rounded-lg text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
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

  // Helper para verificar links ativos (inclui subrotas)
  const isActive = (href: string): boolean => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      {/* Sidebar fixa à esquerda (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-[#08040F] border-r border-white/10 md:flex">
        <div className="h-14 border-b border-white/10 flex items-center px-4 shrink-0">
          <Link href="/dashboard" className="text-base font-extrabold tracking-tight text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500">
            Revolution X
          </Link>
        </div>

        <nav aria-label="Menu principal (desktop)" className="flex-1 overflow-y-auto py-4 px-3">
          {loading ? (
            <span className="text-xs text-gray-400 px-3">carregando…</span>
          ) : authed ? (
            <div className="space-y-6">
              {/* Visão geral */}
              <div>
                <div className="px-3 pb-2 text-[10px] uppercase tracking-wider text-gray-400">Visão geral</div>
                <div className="space-y-1">
                  {BASE.map((it) => (
                    <NavLink key={it.href} item={it} active={isActive(it.href)} />
                  ))}
                </div>
              </div>

              {/* CRM */}
              <div>
                <div className="px-3 pb-2 text-[10px] uppercase tracking-wider text-gray-400">CRM</div>
                <div className="space-y-1">
                  {CRM_SUB.map((it) => (
                    <NavLink key={it.href} item={it} active={isActive(it.href)} />
                  ))}
                </div>
              </div>

              {/* Integrações Oficiais */}
              <div>
                <div className="px-3 pb-2 text-[10px] uppercase tracking-wider text-green-400">Integrações Oficiais</div>
                <div className="space-y-1">
                  {INTEGRATIONS_OFFICIAL.map((it) => (
                    <NavLink key={it.href} item={it} active={isActive(it.href)} />
                  ))}
                </div>
              </div>

              {/* Ferramentas de Extração */}
              <div>
                <div className="px-3 pb-2 text-[10px] uppercase tracking-wider text-orange-400">Ferramentas de Extração</div>
                <div className="space-y-1">
                  {EXTRACTION_TOOLS.map((it) => (
                    <NavLink key={it.href} item={it} active={isActive(it.href)} />
                  ))}
                </div>
              </div>

              {/* Outras integrações (se admin) */}
              {isAdmin && ADMIN_INTEGRATIONS.length > 0 && (
                <div>
                  <div className="px-3 pb-2 text-[10px] uppercase tracking-wider text-gray-400">Integrações</div>
                  <div className="space-y-1">
                    {ADMIN_INTEGRATIONS.map((it) => (
                      <NavLink key={it.href} item={it} active={isActive(it.href)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Administração (admin/owner) */}
              {isAdmin && ADMIN.length > 0 && (
                <div>
                  <div className="px-3 pb-2 text-[10px] uppercase tracking-wider text-purple-400">Administração</div>
                  <div className="space-y-1">
                    {ADMIN.map((it) => (
                      <NavLink key={it.href} item={it} active={isActive(it.href)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Conta */}
              <div>
                <div className="px-3 pb-2 text-[10px] uppercase tracking-wider text-gray-400">Conta</div>
                <div className="space-y-1">
                  {SELF.map((it) => (
                    <NavLink key={it.href} item={it} active={isActive(it.href)} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="px-3 text-xs text-gray-400">Área pública</div>
          )}
        </nav>

        {/* Rodapé da sidebar */}
        <div className="shrink-0 border-t border-white/10 p-3">
          {authed ? (
            <>
              <div className="truncate text-xs text-gray-300" title={session?.user.email ?? undefined}>
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

      {/* Topbar mobile */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 bg-[#08040F]/95 px-4 backdrop-blur md:hidden">
        <button
          aria-label="Abrir menu"
          aria-controls="rx-mobile-menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
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

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="Fechar menu"
            onClick={close}
            className="absolute inset-0 h-full w-full cursor-default bg-black/60"
          />
          <div
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
                onClick={close}
                className="rounded-lg p-1.5 text-gray-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              >
                ✕
              </button>
            </div>

            <nav aria-label="Menu principal (celular)" className="pb-8">
              {loading ? (
                <p className="text-xs text-gray-400">Carregando seu menu…</p>
              ) : authed ? (
                <div className="space-y-6">
                  {BASE.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">Visão geral</div>
                      <div className="grid grid-cols-2 gap-1">
                        {BASE.map((it) => (
                          <NavLink key={it.href} item={it} active={isActive(it.href)} onNavigate={close} />
                        ))}
                      </div>
                    </div>
                  )}

                  {CRM_SUB.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">CRM</div>
                      <div className="grid grid-cols-2 gap-1">
                        {CRM_SUB.map((it) => (
                          <NavLink key={it.href} item={it} active={isActive(it.href)} onNavigate={close} />
                        ))}
                      </div>
                    </div>
                  )}

                  {INTEGRATIONS_OFFICIAL.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-green-400 mb-2">Integrações Oficiais</div>
                      <div className="grid grid-cols-2 gap-1">
                        {INTEGRATIONS_OFFICIAL.map((it) => (
                          <NavLink key={it.href} item={it} active={isActive(it.href)} onNavigate={close} />
                        ))}
                      </div>
                    </div>
                  )}

                  {EXTRACTION_TOOLS.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-orange-400 mb-2">Ferramentas de Extração</div>
                      <div className="grid grid-cols-2 gap-1">
                        {EXTRACTION_TOOLS.map((it) => (
                          <NavLink key={it.href} item={it} active={isActive(it.href)} onNavigate={close} />
                        ))}
                      </div>
                    </div>
                  )}

                  {isAdmin && ADMIN_INTEGRATIONS.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">Integrações</div>
                      <div className="grid grid-cols-2 gap-1">
                        {ADMIN_INTEGRATIONS.map((it) => (
                          <NavLink key={it.href} item={it} active={isActive(it.href)} onNavigate={close} />
                        ))}
                      </div>
                    </div>
                  )}

                  {isAdmin && ADMIN_GROUP.items.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-purple-400 mb-2">Administração</div>
                      <div className="grid grid-cols-2 gap-1">
                        {ADMIN_GROUP.items.map((it) => (
                          <NavLink key={it.href} item={it} active={isActive(it.href)} onNavigate={close} />
                        ))}
                      </div>
                    </div>
                  )}

                  {SELF.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">Conta</div>
                      <div className="grid grid-cols-2 gap-1">
                        {SELF.map((it) => (
                          <NavLink key={it.href} item={it} active={isActive(it.href)} onNavigate={close} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-gray-400">Área pública</div>
              )}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
