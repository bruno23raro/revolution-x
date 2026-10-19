import Link from 'next/link';

const resources = [
  ['CRM e pipeline', 'Contatos, leads, deals e pipelines para manter cada oportunidade em movimento.'],
  ['Operação omnichannel', 'Centralize canais, agenda, publicação e comunicação em um só espaço.'],
  ['Dados protegidos', 'Arquitetura multi-tenant com isolamento por organização e permissões reais.'],
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#08090d] text-white">
      <header className="landing-header">
        <Link href="/" className="brand" aria-label="Revolution X início"><span className="brand-mark">R</span>Revolution <em>X</em></Link>
        <nav className="landing-nav" aria-label="Principal">
          <a href="#recursos">Recursos</a><a href="#fluxo">Como funciona</a><a href="#seguranca">Segurança</a>
        </nav>
        <div className="flex items-center gap-3"><Link href="/login" className="nav-login">Entrar</Link><Link href="/register" className="button button-small">Começar agora <span>↗</span></Link></div>
      </header>

      <section className="hero-shell" aria-label="Apresentação">
        <div className="hero-orb orb-one" /><div className="hero-orb orb-two" />
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-dot" /> Plataforma operacional omnichannel</div>
          <h1>O controle da sua operação, <span>em movimento.</span></h1>
          <p>Conecte relacionamento, vendas, conteúdo e automação em uma experiência construída para times que não param.</p>
          <div className="hero-actions"><Link href="/register" className="button">Começar agora <span>↗</span></Link><a href="#recursos" className="button-ghost">Conhecer a plataforma <span>↓</span></a></div>
          <div className="hero-note"><span>✦</span> Dados unificados. Fluxos inteligentes. Uma visão completa.</div>
        </div>
        <div className="product-stage" role="img" aria-label="Prévia ilustrativa da plataforma Revolution X">
          <p className="preview-disclaimer">Prévia ilustrativa — números e atividades não são dados da sua conta.</p>
          <div className="dashboard-preview">
            <div className="preview-sidebar"><div className="mini-brand"><span className="brand-mark">R</span></div><div className="side-active">⌂</div><div>◈</div><div>◎</div><div>▣</div><div>◌</div><div className="side-bottom">⚙</div></div>
            <div className="preview-content"><div className="preview-top"><div><span className="muted-label">SEGUNDA, 19 OUT 2026</span><h3>Bom dia, sua operação.</h3></div><div className="avatar">RX</div></div><div className="preview-grid"><div className="metric-card"><span>Contatos ativos</span><strong>1.284</strong><small className="positive">↗ 12,8% <i>vs. mês anterior</i></small></div><div className="metric-card"><span>Conversão</span><strong>24,6%</strong><small className="positive">↗ 4,2% <i>vs. mês anterior</i></small></div><div className="chart-card"><div className="card-title"><span>Atividade da operação</span><span className="period">Últimos 30 dias⌄</span></div><div className="chart"><div className="chart-line" /><div className="chart-fill" /><div className="chart-labels"><span>01 OUT</span><span>15 OUT</span><span>30 OUT</span></div></div></div><div className="activity-card"><div className="card-title"><span>Atividade recente</span><span className="dots">•••</span></div><div className="activity-row"><b className="activity-icon purple">◎</b><span>Novo lead qualificado<small>Há 8 minutos</small></span></div><div className="activity-row"><b className="activity-icon green">↗</b><span>Deal movido para ganho<small>Há 24 minutos</small></span></div><div className="activity-row"><b className="activity-icon orange">◈</b><span>Integração conectada<small>Há 1 hora</small></span></div></div></div></div>
          </div>
          <div className="floating-pill pill-one"><span className="pill-icon green">✓</span><span>Operação saudável<small>Todos os canais ativos</small></span></div><div className="floating-pill pill-two"><span className="pill-icon purple">✦</span><span>Insight da IA<small>3 oportunidades encontradas</small></span></div>
        </div>
      </section>

      <section id="recursos" className="section-shell"><div className="section-heading"><span className="eyebrow">01 — A plataforma</span><h2>Menos abas. <span>Mais clareza.</span></h2><p>Tudo o que seu time precisa para transformar operação em crescimento consistente.</p></div><div className="resource-grid">{resources.map(([title, desc], index) => <article className="resource-card" key={title}><div className="resource-number">0{index + 1}</div><h3>{title}</h3><p>{desc}</p><span className="arrow">↗</span></article>)}</div></section>
      <section id="fluxo" className="statement-section"><div className="statement-line" /><span className="eyebrow">02 — Um novo ritmo</span><h2>Seu negócio tem uma história.<br /><span>Faça cada movimento contar.</span></h2><Link href="/register" className="button">Explorar o Revolution X <span>↗</span></Link></section>
      <section id="seguranca" className="trust-strip"><span>Construído para operar com confiança</span><div><b>Multi-tenant</b><b>APIs reais</b><b>Permissões por função</b><b>RLS preparado</b></div></section>
      <footer className="landing-footer"><Link href="/" className="brand"><span className="brand-mark">R</span>Revolution <em>X</em></Link><span>Plataforma operacional omnichannel.</span><div><Link href="/login">Entrar</Link><Link href="/register">Cadastro</Link><Link href="/testcenter">Centro de Testes</Link></div><small>© 2026 Revolution X</small></footer>
    </main>
  );
}
