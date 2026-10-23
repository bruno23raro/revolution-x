// FASE 17 — Importação CSV de contatos (seção 8).
//
// POST com JSON `{csv, mapping?, delimiter?, dryRun?, defaultSource?, maxRows?}`
// ou multipart (campo `file` + `mapping` em JSON). Fluxo do assistente:
//   1. SEM `mapping` → devolve `needsMapping` + cabeçalhos + mapeamento
//      sugerido + prévia (NADA escrito).
//   2. Com `mapping` + `dryRun` → processa tudo, devolve resumo e relatório
//      de erros (NADA escrito).
//   3. Com `mapping` (sem dryRun) → grava apenas linhas válidas e não
//      duplicadas, em lotes; loga SOMENTE contagens (§8: sem PII no log,
//      sem mensagens de efeito colateral).
//
// Tenant: `organizationId` SEMPRE server-derived do usuário autenticado.
// O mapeamento passa por `sanitizeMapping` (allow-list de campos).

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '../../../../../src/lib/auth';
import {
  detectDelimiter,
  errorReportCsv,
  parseCsv,
  processImport,
  sanitizeMapping,
  suggestMapping,
  type CsvMapping,
} from '../../../../../src/services/csvImport';
import {
  bulkCreateContacts,
  listIdentifiers,
} from '../../../../../src/repositories/contactImportRepo';

const MAX_CSV_BYTES = 5_000_000; // ~5 MB

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Lê o corpo (JSON, multipart ou text/csv) ────────────────────────────
  const ctype = (req.headers.get('content-type') ?? '').toLowerCase();
  let csvText = '';
  let mapping: CsvMapping | undefined;
  let delimiter: string | undefined;
  let dryRun = false;
  let defaultSource: string | undefined;
  let maxRows: number | undefined;

  if (ctype.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file');
    if (file && typeof (file as { text?: unknown }).text === 'function') {
      csvText = await (file as { text(): Promise<string> }).text();
    } else if (typeof file === 'string') {
      csvText = file;
    }
    const m = form.get('mapping');
    if (typeof m === 'string' && m.trim()) {
      try {
        const parsed = JSON.parse(m);
        if (isRecord(parsed)) mapping = parsed as unknown as CsvMapping; // sanitizeMapping re-valida os alvos
      } catch {
        return NextResponse.json({ error: 'mapping_invalid_json' }, { status: 400 });
      }
    }
    if (typeof form.get('delimiter') === 'string') delimiter = String(form.get('delimiter'));
    dryRun = form.get('dryRun') === 'true';
    if (typeof form.get('defaultSource') === 'string') defaultSource = String(form.get('defaultSource')).slice(0, 120);
  } else if (ctype.includes('text/csv')) {
    csvText = await req.text();
  } else {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }
    if (!isRecord(body)) body = {};
    if (typeof body.csv === 'string') csvText = body.csv;
    if (isRecord(body.mapping)) mapping = body.mapping as unknown as CsvMapping; // sanitizeMapping re-valida os alvos
    if (typeof body.delimiter === 'string' && body.delimiter.length <= 2) delimiter = body.delimiter;
    dryRun = body.dryRun === true;
    if (typeof body.defaultSource === 'string') defaultSource = body.defaultSource.slice(0, 120);
    if (Number.isInteger(body.maxRows) && (body.maxRows as number) > 0 && (body.maxRows as number) <= 20000) {
      maxRows = body.maxRows as number;
    }
  }

  if (!csvText || csvText.length > MAX_CSV_BYTES) {
    return NextResponse.json({ error: 'csv_required' }, { status: 400 });
  }

  // ── Etapa 1: sem mapeamento → sugerir + prévia (sem escrita) ───────────
  if (!mapping) {
    const d = delimiter ?? detectDelimiter(csvText);
    const { headers } = parseCsv(csvText, d);
    const suggested = suggestMapping(headers);
    const preview = processImport({
      text: csvText,
      mapping: suggested,
      delimiter: d,
      maxRows: Math.min(maxRows ?? 50, 50),
    }).rows.slice(0, 10);
    return NextResponse.json({
      needsMapping: true,
      delimiter: d,
      headers,
      suggestedMapping: suggested,
      preview,
    });
  }

  // ── Etapas 2/3: mapeamento sanitizado, processamento, (opcional) gravação
  const clean = sanitizeMapping(mapping);
  const existing = await listIdentifiers(user.organizationId);
  const result = processImport({
    text: csvText,
    mapping: clean,
    delimiter,
    maxRows,
    defaultSource,
    existingEmails: existing.emails,
    existingPhones: existing.phones,
  });

  if (dryRun) {
    return NextResponse.json({
      summary: result.summary,
      rows: result.rows.slice(0, 500),
      errorReport: errorReportCsv(result),
      truncated: result.summary.truncated,
    });
  }

  const records = result.rows.filter((r) => r.status === 'valid' && r.record).map((r) => r.record!);
  const { inserted } = await bulkCreateContacts(user.organizationId, records);

  // Log SEM PII: apenas contagens (§8).
  console.info('[import] csv contatos ok', {
    org: user.organizationId,
    total: result.summary.total,
    inserted,
    duplicates: result.summary.duplicates,
    invalid: result.summary.invalid,
  });

  return NextResponse.json({
    summary: result.summary,
    inserted,
    errorReport: errorReportCsv(result),
    truncated: result.summary.truncated,
  });
}
