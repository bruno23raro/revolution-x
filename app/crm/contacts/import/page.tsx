'use client';

// FASE 17 â€” ImportaÃ§Ã£o CSV de contatos (Â§8), assistente de 3 etapas.
//
// Etapa 1: arquivo/colagem + delimitador + anÃ¡lise â†’ sugestÃ£o de mapeamento.
// Etapa 2: mapeamento editÃ¡vel + "Verificar" (dryRun â€” NADA Ã© gravado).
// Etapa 3: "Importar" (commit) â†’ sÃ³ linhas vÃ¡lidas e nÃ£o duplicadas.
//
// Regras duras (Â§8/Â§11):
//   * A importaÃ§Ã£o NUNCA dispara campanha/mensagem (operaÃ§Ã£o separada).
//   * Consentimento fail-closed: linha sem consentimento comprovado nasce
//     `consentMarketing=false` e NÃƒO Ã© elegÃ­vel para marketing.
//   * O mapeamento Ã© allow-list server-side (campos protegidos nunca entram).

import { useRef, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';

type Target =
  | 'name' | 'firstName' | 'lastName' | 'email' | 'phone' | 'company'
  | 'source' | 'tags' | 'preferences' | 'consentMarketing' | 'consentSource'
  | 'optOut' | 'custom';

const TARGETS: Array<{ v: Target; label: string }> = [
  { v: 'name', label: 'Nome completo' },
  { v: 'firstName', label: 'Primeiro nome' },
  { v: 'lastName', label: 'Sobrenome' },
  { v: 'email', label: 'E-mail' },
  { v: 'phone', label: 'Telefone (WhatsApp)' },
  { v: 'company', label: 'Empresa' },
  { v: 'source', label: 'Origem' },
  { v: 'tags', label: 'Tags' },
  { v: 'preferences', label: 'PreferÃªncias' },
  { v: 'consentMarketing', label: 'Consentimento de marketing' },
  { v: 'consentSource', label: 'Origem do consentimento' },
  { v: 'optOut', label: 'Opt-out (baixa)' },
  { v: 'custom', label: 'Campo extra (nÃ£o conhecido)' },
];

interface AnalyzeResult {
  needsMapping: boolean;
  delimiter: string;
  headers: string[];
  suggestedMapping: Record<string, Target>;
  preview: Array<Record<string, unknown>>;
}

interface Summary {
  total: number;
  valid: number;
  duplicates: number;
  invalid: number;
  skipped: number;
  truncated: boolean;
}

type Step = 'upload' | 'mapping' | 'check' | 'done';

const inputCls =
  'w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-gray-500';
const selectCls =
  'px-3 py-1.5 bg-black/50 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white text-sm';

export default function CsvImportPage() {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [delimiter, setDelimiter] = useState('auto');
  const [step, setStep] = useState<Step>('upload');
  const [meta, setMeta] = useState<AnalyzeResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, Target>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [dryRun, setDryRun] = useState<{ summary: Summary; errorReport: string } | null>(null);
  const [result, setResult] = useState<{ summary: Summary; inserted: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (f: File | null) => {
    if (!f) return;
    setFileName(f.name);
    f.text()
      .then(setCsvText)
      .catch(() => setError('NÃ£o foi possÃ­vel ler o arquivo.'));
  };

  async function post(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const res = await fetch('/api/crm/contacts/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      setUnauthorized(true);
      return null;
    }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const codes: Record<string, string> = {
        csv_required: 'Informe o conteÃºdo do CSV (arquivo ou colagem).',
        mapping_invalid_json: 'Mapeamento invÃ¡lido (JSON malformado).',
        invalid_json: 'Corpo da requisiÃ§Ã£o invÃ¡lido.',
      };
      setError(codes[data.error as string] ?? data.error ?? 'Falha na importaÃ§Ã£o.');
      return null;
    }
    return data;
  }

  const analyze = async () => {
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = { csv: csvText };
    if (delimiter !== 'auto') body.delimiter = delimiter;
    const data = await post(body);
    setBusy(false);
    if (!data) return;
    const m = data as unknown as AnalyzeResult;
    setMeta({
      needsMapping: true,
      delimiter: m.delimiter,
      headers: m.headers ?? [],
      suggestedMapping: (m.suggestedMapping ?? {}) as Record<string, Target>,
      preview: Array.isArray(m.preview) ? m.preview : [],
    });
    setMapping((m.suggestedMapping ?? {}) as Record<string, Target>);
    setStep('mapping');
  };

  const check = async () => {
    setBusy(true);
    setError(null);
    const data = await post({
      csv: csvText,
      delimiter: delimiter === 'auto' ? meta?.delimiter : delimiter,
      mapping,
      dryRun: true,
    });
    setBusy(false);
    if (!data) return;
    const d = data as unknown as { summary: Summary; errorReport: string };
    setDryRun({ summary: d.summary, errorReport: d.errorReport ?? '' });
    setStep('check');
  };

  const commit = async () => {
    setBusy(true);
    setError(null);
    const data = await post({
      csv: csvText,
      delimiter: delimiter === 'auto' ? meta?.delimiter : delimiter,
      mapping,
      dryRun: false,
    });
    setBusy(false);
    if (!data) return;
    const d = data as unknown as { summary: Summary; inserted: number };
    setResult({ summary: d.summary, inserted: d.inserted ?? 0 });
    setStep('done');
  };

  const setCol = (header: string, target: Target) =>
    setMapping((m) => ({ ...m, [header]: target }));

  if (unauthorized) {
    return (
      <AppShell>
        <main className="min-h-screen p-8 bg-[#05020A]">
          <BackToContacts />
          <div className="p-3 text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg mt-4">
            FaÃ§a login para importar contatos. <Link href="/login" className="text-purple-400">Entrar</Link>
          </div>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="min-h-screen p-8 bg-[#05020A] max-w-5xl mx-auto">
        <BackToContacts />
        <h1 className="text-2xl font-bold text-white mb-1">ImportaÃ§Ã£o de contatos (CSV)</h1>
        <p className="text-sm text-gray-400 mb-6">
          A importaÃ§Ã£o cria contatos na sua organizaÃ§Ã£o e NUNCA dispara mensagens: a fila de
          campanha Ã© uma operaÃ§Ã£o separada (seÃ§Ãµes 8 e 11).
        </p>

        {/* Etapas */}
        <ol className="flex gap-2 text-xs mb-6">
          {(['upload', 'mapping', 'check', 'done'] as Step[]).map((s, i) => {
            const idx = ['upload', 'mapping', 'check', 'done'].indexOf(step);
            const active = s === step;
            const done = i < idx;
            const labels = ['Arquivo', 'Mapeamento', 'VerificaÃ§Ã£o', 'Resultado'];
            return (
              <li
                key={s}
                className={`px-3 py-1 rounded-lg border ${
                  active
                    ? 'border-purple-500/40 text-white bg-purple-600/20'
                    : done
                      ? 'border-green-500/30 text-green-300 bg-green-500/10'
                      : 'border-white/10 text-gray-500'
                }`}
              >
                {i + 1}. {labels[i]}
              </li>
            );
          })}
        </ol>

        {error && (
          <div className="p-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* â”€â”€ Etapa 1: arquivo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                className="text-sm text-gray-400 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-white/15 file:text-gray-300 file:bg-transparent"
              />
              {fileName && <span className="text-xs text-gray-500">{fileName}</span>}
            </div>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="â€¦ou cole o conteÃºdo do CSV aqui (linha 1 = cabeÃ§alhos)."
              rows={6}
              className={inputCls}
            />
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-300">Delimitador</label>
              <select value={delimiter} onChange={(e) => setDelimiter(e.target.value)} className={selectCls}>
                <option value="auto">AutomÃ¡tico</option>
                <option value=",">VÃ­rgula (,)</option>
                <option value=";">Ponto e vÃ­rgula (;)</option>
                <option value={String.fromCharCode(9)}>TabulaÃ§Ã£o (â‡¥)</option>
                <option value="|">Pipe (|)</option>
              </select>
              <button
                onClick={analyze}
                disabled={busy || csvText.trim().length === 0}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {busy ? 'Analisandoâ€¦' : 'Analisar CSV'}
              </button>
            </div>
          </div>
        )}

        {/* â”€â”€ Etapa 2: mapeamento â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {step === 'mapping' && meta && (
          <div className="space-y-5">
            <div>
              <div className="text-sm text-gray-400 mb-2">
                Delimitador detectado: <code className="text-purple-300">{meta.delimiter === '\t' ? 'tabulaÃ§Ã£o' : `'${meta.delimiter}'`}</code>
                {' Â· '}Colunas: {meta.headers.length}
              </div>
              <div className="border border-white/10 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-[#0D0915] text-gray-400">
                    <tr>
                      <th className="text-left p-2 w-56">Coluna do CSV</th>
                      <th className="text-left p-2">Campo do Revolution X</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-200">
                    {meta.headers.map((h) => (
                      <tr key={h || `(vazia)${meta.headers.indexOf(h)}`} className="border-t border-white/5">
                        <td className="p-2 font-mono text-xs">{h || '(coluna vazia)'}</td>
                        <td className="p-2">
                          <select
                            value={mapping[h] ?? 'custom'}
                            onChange={(e) => setCol(h, e.target.value as Target)}
                            className={selectCls}
                          >
                            {TARGETS.map((t) => (
                              <option key={t.v} value={t.v}>{t.label}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {meta.preview.length > 0 && (
                <details className="text-sm text-gray-400">
                  <summary className="cursor-pointer text-purple-400">PrÃ©via (primeiras {meta.preview.length} linhas)</summary>
                  <pre className="mt-2 p-3 bg-black/40 rounded-lg overflow-x-auto text-xs text-gray-300">
                    {JSON.stringify(meta.preview, null, 2)}
                  </pre>
                </details>
              )}
            </div>
            <div className="p-3 text-xs text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg">
              Consentimento (fail-closed): contatos importados SEM a coluna Â«Consentimento de
              marketingÂ» comprovada nascem <strong>nÃ£o elegÃ­veis</strong> para campanhas de
              marketing. A importaÃ§Ã£o nunca dispara mensagens.
            </div>
            <div className="flex gap-2">
              <button onClick={check} disabled={busy} className="px-4 py-2 text-sm font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50">
                {busy ? 'Verificandoâ€¦' : 'Verificar (nada Ã© gravado)'}
              </button>
              <button onClick={() => setStep('upload')} className="px-4 py-2 text-sm rounded-lg border border-white/15 text-gray-300 hover:bg-white/5">
                Voltar
              </button>
            </div>
          </div>
        )}

        {/* â”€â”€ Etapa 3: verificaÃ§Ã£o (dryRun) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {step === 'check' && dryRun && (
          <div className="space-y-5">
            <SummaryBlock summary={dryRun.summary} title="Resultado da verificaÃ§Ã£o (nenhum registro foi gravado)" />
            {dryRun.errorReport && dryRun.errorReport.split('\n').length > 1 && (
              <div>
                <div className="text-sm text-gray-400 mb-2">RelatÃ³rio de erros (baixe para corrigir o arquivo-fonte):</div>
                <pre className="p-3 bg-black/40 rounded-lg overflow-x-auto text-xs text-gray-300 max-h-64">
                  {dryRun.errorReport.split('\n').slice(0, 200).join('\n')}
                </pre>
                <button
                  onClick={() => downloadErrorReport(dryRun.errorReport)}
                  className="mt-2 px-3 py-1.5 text-xs rounded-lg border border-white/15 text-gray-300 hover:bg-white/5"
                >
                  Baixar relatÃ³rio (CSV)
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={commit} disabled={busy || dryRun.summary.valid === 0} className="px-4 py-2 text-sm font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50">
                {busy ? 'Importandoâ€¦' : `Importar ${dryRun.summary.valid} contato(s) vÃ¡lido(s)`}
              </button>
              <button onClick={() => setStep('mapping')} className="px-4 py-2 text-sm rounded-lg border border-white/15 text-gray-300 hover:bg-white/5">
                Ajustar mapeamento
              </button>
            </div>
          </div>
        )}

        {/* â”€â”€ Etapa 4: resultado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {step === 'done' && result && (
          <div className="space-y-5">
            <SummaryBlock summary={result.summary} title="ImportaÃ§Ã£o concluÃ­da" extra={`Gravados: ${result.inserted} contato(s).`} />
            <div className="p-3 text-sm text-green-300 bg-green-400/10 border border-green-400/20 rounded-lg">
              Os contatos estÃ£o disponÃ­veis no <Link href="/crm/contacts" className="text-purple-300 underline">CRM â†’ Contatos</Link>.
              Para enviar mensagens, crie uma campanha em <Link href="/campaigns" className="text-purple-300 underline">Campanhas</Link> â€” a
              importaÃ§Ã£o nunca dispara envio.
            </div>
            <button onClick={() => { setStep('upload'); setMeta(null); setDryRun(null); setResult(null); setMapping({}); setCsvText(''); setFileName(''); }} className="px-4 py-2 text-sm rounded-lg border border-white/15 text-gray-300 hover:bg-white/5">
              Importar outro arquivo
            </button>
          </div>
        )}
      </main>
    </AppShell>
  );
}

function SummaryBlock({ summary, title, extra }: { summary: Summary; title: string; extra?: string }) {
  return (
    <div>
      <div className="text-sm text-gray-400 mb-2">{title}{extra ? ` â€” ${extra}` : ''}</div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
        {[
          ['Linha', summary.total],
          ['VÃ¡lidas', summary.valid],
          ['Duplicadas', summary.duplicates],
          ['InvÃ¡lidas', summary.invalid],
          ['Puladas', summary.skipped],
        ].map(([label, n]) => (
          <div key={label as string} className="p-3 bg-black/40 border border-white/10 rounded-lg">
            <div className="text-2xl font-bold text-white">{n as number}</div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400">{label as string}</div>
          </div>
        ))}
      </div>
      {summary.truncated && (
        <div className="mt-2 text-xs text-amber-300">O arquivo excedeu o teto de linhas (20.000): sÃ³ a parte inicial foi processada.</div>
      )}
    </div>
  );
}

function BackToContacts() {
  return <Link href="/crm/contacts" className="text-sm text-purple-400 hover:text-purple-300">â† Voltar aos contatos</Link>;
}

function downloadErrorReport(report: string) {
  const blob = new Blob([report], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'relatorio-erros-importacao.csv';
  a.click();
  URL.revokeObjectURL(url);
}
