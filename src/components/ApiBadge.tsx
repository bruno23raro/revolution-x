'use client';

// Selo de camada do Hub de Integrações.
// Separa visualmente "API Oficial" (roxo) de "Sem API / Avançado" (âmbar + risco).
import type { Layer } from '@/integrations/providers';

export default function ApiBadge({ layer }: { layer: Layer }) {
  if (layer === 'official') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
        API Oficial
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30"
      title="Método não oficial — use por sua conta e risco"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
      Sem API · Avançado
    </span>
  );
}
