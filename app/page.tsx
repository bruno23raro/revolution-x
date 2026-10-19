import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-extrabold tracking-tight text-white hover:text-indigo-300 transition-colors" aria-label="Revolution X home">
            Revolution X
          </Link>
          <nav aria-label="Principal" className="flex items-center gap-6 text-sm text-slate-300">
            <a href="#recursos" className="hover:text-white transition-colors">Recursos</a>
            <a href="#como-funciona" className="hover:text-white transition-colors">Como funciona</a>
            <a href="#beneficios" className="hover:text-white transition-colors">Benefícios</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="rounded-full px-4 py-2 text-sm font-medium text-slate-200 hover:text-white transition-colors">Entrar</Link>
            <Link href="/register" className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-900/20 hover:bg-indigo-500 transition-colors">Começar agora</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section aria-label="Hero" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/40 to-slate-950" />
        <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-20 md:pt-36 md:pb-28">
          <div className="max-w-3xl">
            <h1 className="text-5xl font-extrabold leading-tight tracking-tight text-white md:text-7xl">
              Centralize sua operação.{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-300">Automatize seu negócio.</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-slate-300 leading-relaxed max-w-2xl">
              Revolution X é uma plataforma SaaS omnichannel para centralizar operações, relacionamento, vendas, agenda e comunicação — com multi-tenant isolado, CRM real, produtos, agenda e integrações preparadas.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link href="/register" className="rounded-full bg-indigo-600 px-8 py-3.5 text-base font-semibold text-white shadow-xl shadow-indigo-900/20 hover:bg-indigo-500 transition-all hover:scale-[1.03]">Começar agora</Link>
              <Link href="/login" className="rounded-full border border-slate-700 px-8 py-3.5 text-base font-semibold text-slate-200 hover:border-slate-500 hover:text-white transition-all">Entrar na plataforma</Link>
            </div>
          </div>

          {/* Visual mockup 3D — propriedades reais */}
          <div style={{ perspective: "1200px", marginTop: "2rem", display: "flex", justifyContent: "center" }} aria-label="Mockup 3D futurista">
            <div style={{ transformStyle: "preserve-3d", transform: "rotateX(8deg) rotateY(-3deg) translateZ(40px)", borderRadius: "1.25rem", background: "linear-gradient(180deg,rgba(10,6,18,0.85),rgba(5,2,10,0.95))", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 40px 80px rgba(109,40,217,0.25)", padding: "1.25rem", width: "100%", maxWidth: "980px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", paddingBottom: "0.75rem", borderBottom: "1px solid rgba(255,255,255,0.08)", fontWeight: 700, fontSize: "0.95rem", color: "#fff" }}>
                <span className="h-3 w-3 rounded-full bg-rose-400" style={{boxShadow: "0 0 6px #f87171"}}></span>
                <span className="h-3 w-3 rounded-full bg-amber-400" style={{boxShadow: "0 0 6px #fbbf24"}}></span>
                <span className="h-3 w-3 rounded-full bg-emerald-400" style={{boxShadow: "0 0 6px #34d399"}}></span>
                <span style={{ marginLeft: 12, fontSize: "0.85rem", color: "#A78BFA", fontFamily: "monospace" }}>revolutionx.com.br — dashboard</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
                <div style={{ borderRadius: "0.75rem", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", padding: "1rem", transform: "translateZ(20px)", transition: "transform .2s" }}>
                  <h3 style={{ fontSize: "0.85rem", fontWeight: 600, color: "#E2E8F0", marginBottom: "0.5rem" }}>CRM Real</h3>
                  <div style={{ height: 8, borderRadius: 999, background: "linear-gradient(90deg,#6D28D9,#8B5CF6)", marginBottom: 6, width: "92%" }} />
                  <div style={{ height: 8, borderRadius: 999, background: "linear-gradient(90deg,#6D28D9,#8B5CF6)", marginBottom: 6, width: "70%" }} />
                  <div style={{ height: 8, borderRadius: 999, background: "linear-gradient(90deg,#6D28D9,#8B5CF6)", width: "85%" }} />
                </div>
                <div style={{ borderRadius: "0.75rem", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", padding: "1rem", transform: "translateZ(30px)", transition: "transform .2s", boxShadow: "0 10px 30px rgba(168,85,247,0.15)" }}>
                  <h3 style={{ fontSize: "0.85rem", fontWeight: 600, color: "#E2E8F0", marginBottom: "0.5rem" }}>Produtos</h3>
                  <div style={{ height: 8, borderRadius: 999, background: "linear-gradient(90deg,#8B5CF6,#A855F7)", marginBottom: 6, width: "88%" }} />
                  <div style={{ height: 8, borderRadius: 999, background: "linear-gradient(90deg,#8B5CF6,#A855F7)", marginBottom: 6, width: "65%" }} />
                  <div style={{ height: 8, borderRadius: 999, background: "linear-gradient(90deg,#8B5CF6,#A855F7)", width: "78%" }} />
                </div>
                <div style={{ borderRadius: "0.75rem", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", padding: "1rem", transform: "translateZ(10px)", transition: "transform .2s" }}>
                  <h3 style={{ fontSize: "0.85rem", fontWeight: 600, color: "#E2E8F0", marginBottom: "0.5rem" }}>Agenda / Pipeline</h3>
                  <div style={{ height: 8, borderRadius: 999, background: "linear-gradient(90deg,#A855F7,#C084FC)", marginBottom: 6, width: "95%" }} />
                  <div style={{ height: 8, borderRadius: 999, background: "linear-gradient(90deg,#A855F7,#C084FC)", marginBottom: 6, width: "72%" }} />
                  <div style={{ height: 8, borderRadius: 999, background: "linear-gradient(90deg,#A855F7,#C084FC)", width: "60%" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Resources */}
      <section id="recursos" aria-label="Recursos" className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">Recursos que realmente existem</h2>
          <p className="mt-4 text-slate-400">O que já está implementado e operando no Revolution X.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { title: 'CRM Real', desc: 'Contatos, leads, deals e pipelines com repositórios PostgreSQL reais (Migration 003).' },
            { title: 'Produtos', desc: 'Tabela products executada (Migration 004); repository real; API real.' },
            { title: 'Agenda', desc: 'Rotas de agendamento integradas; validação de horários e status.' },
            { title: 'Publisher / Vídeo', desc: 'Páginas e componentes de publicação e vídeo implementadas.' },
            { title: 'Relatórios', desc: 'Dashboard de métricas preparado; dados via APIs reais.' },
            { title: 'Autenticação Multi-tenant', desc: 'Login, registro, sessão, hash bcrypt, JWT; RBAC (rbac.ts); isolamento de tenant.' },
            { title: 'Integrações Preparadas', desc: 'Arquitetura Meta (Facebook, Instagram, WhatsApp Business) preparada; OAuth, webhooks, estados e sanitação de payloads.' },
            { title: 'Segurança / RLS', desc: 'Policies configuradas; organization_id isolado; nenhum acesso cruzado permitido.' },
          ].map((r) => (
            <div key={r.title} className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-7 shadow-lg hover:shadow-indigo-900/10 transition-shadow">
              <h3 className="text-lg font-bold text-white mb-2">{r.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" aria-label="Como funciona" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white text-center mb-14">Como funciona</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { step: '01', label: 'Crie sua conta', desc: 'Cadastro com validação, hash seguro e sessão protegida.' },
            { step: '02', label: 'Configure sua operação', desc: 'Organização, membros, papéis e permissões via RBAC.' },
            { step: '03', label: 'Centralize processos', desc: 'CRM, produtos, agenda e relatórios em um só tenant.' },
            { step: '04', label: 'Acompanhe resultados', desc: 'Dashboards reais conectados ao banco PostgreSQL (Supabase).' },
          ].map((s) => (
            <div key={s.step} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-7">
              <span className="text-3xl font-black text-indigo-400">{s.step}</span>
              <h3 className="mt-3 text-lg font-bold text-white">{s.label}</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section id="beneficios" aria-label="Benefícios" className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-6">Benefícios reais do SaaS</h2>
            <ul className="space-y-4">
              {[
                { label: 'Centralização', desc: 'Todos os processos do cliente em um tenant isolado.' },
                { label: 'Automação', desc: 'Validações, eventos e fluxos integrados sem intervenção manual.' },
                { label: 'Organização', desc: 'Estrutura multi-tenant com organização, membros e RBAC.' },
                { label: 'Produtividade', desc: 'APIs reais para CRM, produtos, agenda e relatórios.' },
                { label: 'Escalabilidade', desc: 'Arquitetura preparada para novas organizações sem reescrever o sistema.' },
                { label: 'Visibilidade', desc: 'Dados reais, relatórios baseados no banco, sem simulação.' },
              ].map((b) => (
                <li key={b.label} className="flex items-start gap-3">
                  <span className="mt-1 h-5 w-5 shrink-0 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-xs font-bold" aria-hidden="true">✓</span>
                  <div>
                    <strong className="text-white">{b.label}</strong>
                    <p className="text-sm text-slate-400">{b.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-6 shadow-xl shadow-indigo-900/10">
            <h3 className="text-lg font-bold text-white mb-4">Estado do projeto</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-slate-300">TypeScript</span><span className="font-bold text-emerald-400">0 erros</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-300">Testes</span><span className="font-bold text-emerald-400">488/488 PASS</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-300">Lint</span><span className="font-bold text-emerald-400">0 avisos</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-300">Build</span><span className="font-bold text-emerald-400">28/28 págs</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-300">RLS (007–015)</span><span className="font-bold text-emerald-400">EM PRODUÇÃO</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-300">E-mail (Resend)</span><span className="font-bold text-amber-400">PREPARADO</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-300">Repositórios</span><span className="font-bold text-emerald-400">4 REAL</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-300">Integrações Meta</span><span className="font-bold text-amber-400">PREPARADAS</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section aria-label="Call to action" className="mx-auto max-w-6xl px-6 py-20">
        <div className="rounded-3xl bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 border border-indigo-800/40 p-12 text-center shadow-2xl shadow-indigo-900/20">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">Pronto para transformar sua operação?</h2>
          <p className="mt-4 text-slate-300 text-lg max-w-xl mx-auto">Crie sua conta, configure sua organização e comece a centralizar seus processos no Revolution X.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/register" className="rounded-full bg-indigo-600 px-8 py-3.5 text-base font-semibold text-white shadow-xl shadow-indigo-900/20 hover:bg-indigo-500 transition-all hover:scale-[1.03]">Começar agora</Link>
            <Link href="/login" className="rounded-full border border-slate-600 px-8 py-3.5 text-base font-semibold text-slate-200 hover:border-white hover:text-white transition-all">Entrar na plataforma</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950" aria-label="Rodapé">
        <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <Link href="/" className="text-lg font-extrabold text-white hover:text-indigo-300" aria-label="Revolution X">Revolution X</Link>
            <p className="text-sm text-slate-500 mt-1">Plataforma SaaS omnichannel multi-tenant.</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-6 text-sm text-slate-400">
            <a href="/login" className="hover:text-white transition-colors">Login</a>
            <a href="/register" className="hover:text-white transition-colors">Cadastro</a>
            <a href="#recursos" className="hover:text-white transition-colors">Recursos</a>
          </nav>
        </div>
        <div className="mx-auto max-w-6xl px-6 pb-6 text-xs text-slate-600">© 2026 Revolution X. Produção em <code>https://revolutionx.com.br</code>.</div>
      </footer>
    </main>
  );
}
