'use client';

// Aviso de risco obrigatório para funcionalidades "Sem API / Avançado"
// (scraping, QR Code, automação de navegador). O hub DECLARA o método e o risco;
// nunca executa automação evasiva em silêncio.
interface RiskBannerProps {
  title?: string;
  children: React.ReactNode;
}

export default function RiskBanner({ title = 'Aviso de risco', children }: RiskBannerProps) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-3 text-amber-200">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide mb-1.5">
        <span aria-hidden>⚠</span>
        {title}
      </div>
      <div className="text-[13px] leading-relaxed text-amber-100/90">{children}</div>
    </div>
  );
}
