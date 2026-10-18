'use client';

// Pill de estado de um provedor (saída do health check / configured).
import type { ProbeStatus } from '@/integrations/providers';

const MAP: Record<ProbeStatus, { label: string; cls: string }> = {
  ok: { label: 'ok', cls: 'text-green-400 border-green-400/25 bg-green-400/10' },
  error: { label: 'erro', cls: 'text-red-400 border-red-400/25 bg-red-400/10' },
  not_configured: { label: 'não configurado', cls: 'text-gray-400 border-white/15 bg-white/5' },
  skipped: { label: '—', cls: 'text-gray-500 border-white/10 bg-white/[0.03]' },
};

export default function HealthPill({ status, detail }: { status: ProbeStatus; detail?: string }) {
  const m = MAP[status] ?? MAP.skipped;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${m.cls}`}
      title={detail || undefined}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {m.label}
    </span>
  );
}
