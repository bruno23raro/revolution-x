'use client';

import { CheckCircle, AlertCircle, XCircle, Clock } from 'lucide-react';

interface ProbeStatus {
  ok: 'ok';
  error: 'error';
  not_configured: 'not_configured';
  skipped: 'skipped';
}

interface HealthPillProps {
  status: keyof ProbeStatus;
  detail?: string;
}

const MAP: Record<keyof ProbeStatus, { label: string; cls: string; Icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }> = {
  ok: {
    label: 'ok',
    cls: 'text-green-400 border-green-400/25 bg-green-400/10',
    Icon: CheckCircle,
  },
  error: {
    label: 'erro',
    cls: 'text-red-400 border-red-400/25 bg-red-400/10',
    Icon: AlertCircle,
  },
  not_configured: {
    label: 'não configurado',
    cls: 'text-gray-400 border-white/15 bg-white/5',
    Icon: XCircle,
  },
  skipped: {
    label: '—',
    cls: 'text-gray-500 border-white/10 bg-white/[0.03]',
    Icon: Clock,
  },
};

export default function HealthPill({ status, detail }: HealthPillProps) {
  const m = MAP[status] ?? MAP.skipped;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${m.cls}`}
      title={detail || undefined}
    >
      <m.Icon className="w-1.5 h-1.5 text-current" />
      {m.label}
    </span>
  );
}