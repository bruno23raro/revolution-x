// FASE 3 — Tela CRM (REAL com prova: existe, navegável)
import Link from 'next/link';

export default function CRMPage() {
  return (
    <main>
      <h1>CRM — Contatos e Deals</h1>
      <nav>
        <Link href="/crm/contacts">Contatos</Link> |
        <Link href="/crm/leads">Leads</Link> |
        <Link href="/crm/deals">Deals</Link>
      </nav>
      <section>
        <h2>Contatos (MOCK — banco local ativo)</h2>
        <p>Organização isolada por tenant. Nenhum outro tenant vê estes dados.</p>
      </section>
    </main>
  );
}
