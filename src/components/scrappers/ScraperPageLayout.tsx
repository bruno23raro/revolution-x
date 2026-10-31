'use client';

// Layout reutilizável para páginas de scraper — Header com RiskBanner, formulário,
// botão de ação (desabilitado sem ack de risco) e área de resultados.
import { useState } from 'react';
import Link from 'next/link';
import RiskBanner from '@/components/RiskBanner';

interface ScraperPageLayoutProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  fields: { name: string; label: string; placeholder: string; type?: string }[];
  children?: React.ReactNode;
}

export default function ScraperPageLayout({ title, description, icon, fields, children }: ScraperPageLayoutProps) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [ack, setAck] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<string | null>(null);

  const handleChange = (name: string, value: string) => {
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ack) return;
    setRunning(true);
    setResults(null);
    // Placeholder: a implementação real chama a API de scraping
    setTimeout(() => {
      setResults(`[PLACEHOLDER] Extração iniciada para: ${JSON.stringify(form)}\n\nEm breve, os resultados serão exibidos aqui.`);
      setRunning(false);
    }, 1000);
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/integracoes" className="text-sm text-gray-400 hover:text-white transition-colors">
          ← Voltar para Integrações
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <div className="w-10 h-10 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/30">
            {icon}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            <p className="text-sm text-gray-400">{description}</p>
          </div>
        </div>
      </div>

      {/* Risk Banner */}
      <div className="mb-6">
        <RiskBanner title="Aviso de Risco — Alta Prioridade">
          Esta ferramenta realiza scraping de dados de redes sociais. O uso indevido pode violar os
          Termos de Serviço das plataformas e resultar em bloqueio de conta. Use apenas para fins
          autorizados, com consentimento explícito e em conformidade com a LGPD e demais regulamentações.
        </RiskBanner>
      </div>

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="bg-[#0D0915] border border-white/10 rounded-xl p-6 space-y-4">
        {fields.map((field) => (
          <div key={field.name}>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              {field.label}
            </label>
            <input
              type={field.type || 'text'}
              value={form[field.name] || ''}
              onChange={(e) => handleChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              className="w-full px-3 py-2 rounded-lg bg-[#05020A] border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50"
            />
          </div>
        ))}

        {/* Risk Acknowledgment */}
        <label className="flex items-start gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/20 cursor-pointer">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-red-500/50 bg-red-500/10 text-red-500 focus:ring-red-500/50"
          />
          <span className="text-sm text-gray-300">
            Eu concordo com os riscos envolvidos e estou ciente de que esta ferramenta pode violar
            os Termos de Serviço das plataformas.
          </span>
        </label>

        <button
          type="submit"
          disabled={!ack || running}
          className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            !ack || running
              ? 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
              : 'bg-red-600 text-white hover:bg-red-700'
          }`}
        >
          {running ? 'Iniciando extração…' : 'Iniciar Extração'}
        </button>
      </form>

      {/* Área de Resultados */}
      {results && (
        <div className="mt-6 bg-[#0D0915] border border-white/10 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-3">Resultados</h3>
          <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono bg-black/30 rounded-lg p-4 overflow-auto">
            {results}
          </pre>
        </div>
      )}

      {/* Conteúdo adicional das páginas filhas */}
      {children}
    </div>
  );
}