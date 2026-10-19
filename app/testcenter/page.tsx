'use client';

// Centro de Testes — hub funcional para acessar (e redirecionar) TODAS as
// partes do site, no domínio da Hostinger, e conferir se está tudo funcionando.
//
//  • Página pública: mostra o mapa completo; áreas protegidas exibem o gate
//    (login / papel) sem quebrar — "tudo redirecionando".
//  • Sondas read-only (NUNCA segredos, NUNCA efeito colateral):
//      - GET /api/auth/session         (auth/role/org do próprio usuário)
//      - GET /api/cron/tiktok          (responde 405 sem segredo → rota viva)
//      - GET /api/integrations/health  (só estado dos provedores)
//  • O núcleo de derivação está em @/lib/testCenter (puro, testado).

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AppNav from '@/components/AppNav';
import HealthPill from '@/components/HealthPill';
import { buildTestCenterView, groupParts, type Signals, type SessionLike, type PartStatus } from '@/lib/testCenter';
import type { ProbeStatus } from '@/integrations/providers';

interface Sigs {
  session: SessionLike | null;
  signals: Signals;
  done: boolean;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<{ status: number; body: T | null }> {
  const r = await fetch(url, init);
  let body: T | null = null;
  try {
    body = (await r.json()) as T;
  } catch {
    body = null; // resposta não-JSON (ex.: cron GET→405 devolve JSON, mas por segurança)
  }
  return { status: r.status, body };
}

export default function TestCenterPage() {
  const [state, setState] = useState<Sigs>({ session: null, signals: {}, done: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [sess, cron, health] = await Promise.all([
        fetchJson<SessionLike>('/api/auth/session').catch(() => ({ status: 0, body: null })),
        fetchJson<unknown>('/api/cron/tiktok', { method: 'GET' }).catch(() => ({ status: 0, body: null })),
        fetchJson<{ health?: { provider: string; status: ProbeStatus }[] }>('/api/integrations/health').catch(
          () => ({ status: 0, body: null }),
        ),
      ]);

      const session: SessionLike | null = sess.body; // auth/role/org do próprio usuário (ou null em falha)

      // Sinais vivos — nenhum segredo; apenas estado.
      const signals: Signals = {
        api_session:
          sess.status === 0
            ? { status: 'error', detail: 'API não respondeu' }
            : { status: 'ok', detail: sess.body?.authenticated ? `autenticado (role ${sess.body.role ?? '—'})` : 'não autenticado' },
        cron_tiktok:
          cron.status === 405
            ? { status: 'ok', detail: 'GET→405 (rota viva; POST exige x-cron-secret)' }
            : cron.status === 0
              ? { status: 'error', detail: 'API não respondeu' }
              : { status: 'error', detail: `esperado 405, veio HTTP ${cron.status}` },
        api_health:
          health.status === 200
            ? healthStatus(health.body)
            : health.status === 401
              ? { status: 'skipped', detail: 'exige papel admin/owner' }
              : health.status === 0
                ? { status: 'error', detail: 'API não respondeu' }
                : { status: 'error', detail: `HTTP ${health.status}` },
      };

      if (!cancelled) setState({ session, signals, done: true });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const view = useMemo(
    () => buildTestCenterView(state.session, state.signals),
    [state.session, state.signals],
  );
  const sections = useMemo(() => groupParts(view.parts), [view.parts]);

  return (
    <>
      <AppNav />
      <main className="min-h-screen p-4 sm:p-8 bg-[#05020A] text-gray-300">
        <div className="mx-auto max-w-6xl">
          {/* Hero */}
          <div className="rounded-2xl border border-white/10 bg-[#0D0915] p-6 sm:p-8">
            <h1 className="text-2xl font-bold text-white">Centro de Testes</h1>
            <p className="text-sm text-gray-400 mt-2 max-w-3xl">
              Mapa funcional de <strong className="text-gray-200">todas as partes</strong> da plataforma, com o
              estado vivo de cada sonda read-only e um link que <strong className="text-gray-200">redireciona</strong> para
              a área. Nada aqui expõe segredos nem dispara ação de escrita.
            </p>

            {/* Resumo */}
            <div className="flex flex-wrap gap-2 mt-5">
              <Chip label="partes" value={view.counts.total} />
              <Chip label="vivas" value={view.counts.live} tone="green" />
              <Chip label="bloqueadas p/ você" value={view.counts.locked} tone="amber" />
              <Chip label="problemas" value={view.counts.problems} tone={view.counts.problems ? 'red' : 'green'} />
            </div>

            {/* CTAs de redirecionamento */}
            <div className="mt-6 flex flex-wrap gap-3">
              {view.authenticated ? (
                <Link
                  href="/dashboard"
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700"
                >
                  Ir para o Dashboard →
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700"
                  >
                    Entrar (área logada)
                  </Link>
                  <Link
                    href="/register"
                    className="px-4 py-2 text-sm font-semibold rounded-lg border border-white/20 text-gray-200 hover:bg-white/5"
                  >
                    Criar conta
                  </Link>
                </>
              )}
              <Link
                href="/admin/chat"
                className={`px-4 py-2 text-sm font-semibold rounded-lg border ${
                  view.isAdmin ? 'border-white/20 text-gray-200 hover:bg-white/5' : 'border-white/10 text-gray-500'
                }`}
              >
                {view.isAdmin ? 'Centro IA (admin) →' : 'Centro IA 🔒 (exige admin/owner)'}
              </Link>
            </div>

            {!view.authenticated && (
              <p className="text-xs text-amber-300/80 mt-4">
                Você está <strong>não autenticado</strong>: as áreas logadas ficam <em>locked</em> e redirecionam para o
                login. Entre para desbloquear o teste completo.
              </p>
            )}
          </div>

          {/* Seções por grupo */}
          <div className="mt-8 space-y-8">
            {sections.map((s) => (
              <section key={s.group} aria-label={s.label}>
                <h2 className="text-xs uppercase tracking-wider text-gray-500 mb-3">{s.label}</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {s.items.map((p) => (
                    <PartCard key={p.id} part={p} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <p className="text-xs text-gray-600 mt-10">
            {state.done
              ? 'Sondas read-only executadas. Rota desconhecida → redireciona para a home (app/not-found).'
              : 'Coletando o estado das sondas read-only…'}
          </p>
        </div>
      </main>
    </>
  );
}

function Chip({ label, value, tone = 'gray' }: { label: string; value: number; tone?: 'gray' | 'green' | 'amber' | 'red' }) {
  const cls =
    tone === 'green'
      ? 'text-green-400 border-green-400/25 bg-green-400/10'
      : tone === 'amber'
        ? 'text-amber-400 border-amber-400/25 bg-amber-400/10'
        : tone === 'red'
          ? 'text-red-400 border-red-400/25 bg-red-400/10'
          : 'text-gray-300 border-white/15 bg-white/5';
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${cls}`}>
      <span className="font-mono">{value}</span>
      {label}
    </span>
  );
}

function PartCard({ part }: { part: PartStatus }) {
  const kindPage = part.kind === 'page';
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0D0915] p-4 hover:border-purple-500/40 transition">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white truncate" title={part.label}>
            {part.label}
          </div>
          {part.kind === 'api' && (
            <code className="text-[11px] text-purple-300/80 mt-1 block truncate" title={part.href}>
              {part.href}
            </code>
          )}
        </div>
        <HealthPill status={part.status} detail={part.detail} />
      </div>

      {part.note && <p className="text-xs text-gray-500 mt-2 leading-relaxed">{part.note}</p>}

      <div className="mt-3">
        {kindPage && !part.locked ? (
          <Link
            href={part.href}
            className="inline-block text-xs font-semibold text-purple-400 hover:text-purple-300"
          >
            abrir {part.href} →
          </Link>
        ) : part.locked ? (
          part.adminOnly ? (
            <span className="inline-block text-xs text-gray-500">
              🔒 exige papel admin/owner
            </span>
          ) : (
            <Link href="/login" className="inline-block text-xs font-semibold text-amber-400 hover:text-amber-300">
              🔒 exige login → entrar
            </Link>
          )
        ) : (
          <span className="inline-block text-xs text-gray-600">endpoint read-only</span>
        )}
      </div>
    </div>
  );
}

// Deriva um estado agregado p/ a health de integrações a partir de `{ health: [] }`.
function healthStatus(body: { health?: { provider: string; status: ProbeStatus }[] } | null): { status: ProbeStatus; detail?: string } {
  if (!body?.health || body.health.length === 0) {
    return { status: 'not_configured', detail: 'nenhum provedor listado' };
  }
  const n = body.health.length;
  const ok = body.health.filter((h) => h.status === 'ok').length;
  const hasError = body.health.some((h) => h.status === 'error');
  if (hasError) return { status: 'error', detail: `${ok}/${n} provedores ok; há falha` };
  if (ok === n) return { status: 'ok', detail: `${ok}/${n} provedores ok` };
  return { status: 'not_configured', detail: `${ok}/${n} ok; demais sem config` };
}
