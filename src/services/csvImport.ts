// FASE 17 — Motor de importação CSV (puro, sem I/O — testável isolado).
//
// Seção 8 da missão de finalização: importação em massa com Mapeamento de
// colunas reutilizável, auto-sugestão de mapeamento, normalização de
// telefone (E.164), validação campo a campo e resultado POR LINHA.
//
// Segurança (§8/§11):
//   * A importação NUNCA dispara mensagem para o contato (só cria registros
//     no escopo da org — a fila de campanha é uma operação separada).
//   * Nenhum valor PII é logado: as funções retornam contagens e listas;
//     a camada de rota loga SOMENTE contagens.
//   * Consentimento: linha SEM consentimento comprovado nasce com
//     `consentMarketing=false` — NUNCA é tratada como elegível para
//     marketing automaticamente.
//   * O importador não pode alterar campos protegidos (role, org, etc.):
//     os campos aceitos estão fixos no alvo `CsvTarget` (allow-list).

export type CsvTarget =
  | 'name'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'company'
  | 'source'
  | 'tags'
  | 'preferences'
  | 'consentMarketing'
  | 'consentSource'
  | 'optOut'
  | 'custom';

/** Mapeamento: cabeçalho do CSV (trimmed) → campo alvo (allow-list). */
export type CsvMapping = Record<string, CsvTarget>;

export interface MappedRecord {
  name?: string;
  /** Como o `name` foi obtido: 'explicit' (coluna) ou 'derived' (e-mail). */
  nameDerivation?: 'explicit' | 'derived';
  firstName?: string;
  lastName?: string;
  email?: string;
  /** Telefone normalizado E.164 (ex.: +5511999998888) ou ausente. */
  phone?: string;
  company?: string;
  source?: string;
  tags: string[];
  customFields: Record<string, string>;
  preferences: Record<string, string>;
  consentMarketing: boolean;
  consentSource?: string;
  optOut: boolean;
}

export interface ImportRowResult {
  /** Linha de dados (1 = primeira linha após o cabeçalho). */
  line: number;
  status: 'valid' | 'duplicate' | 'invalid' | 'skipped';
  /** Códigos de erro (sem PII): ex. 'invalid_email', 'invalid_phone'. */
  errors: string[];
  record?: MappedRecord;
}

export interface ImportSummary {
  total: number;
  valid: number;
  duplicates: number;
  invalid: number;
  skipped: number;
  truncated: boolean;
}

export interface ImportResult {
  summary: ImportSummary;
  rows: ImportRowResult[];
  headers: string[];
  delimiter: string;
}

export interface ProcessImportInput {
  text: string;
  mapping: CsvMapping;
  /** Delimitador explícito; ausente → detecta. */
  delimiter?: string;
  /** Conjunto de e-mails já existentes na org (minúsculos, trimmed). */
  existingEmails?: ReadonlySet<string>;
  /** Conjunto de telefones já existentes na org (dígitos E.164). */
  existingPhones?: ReadonlySet<string>;
  /** Origem padrão quando a coluna `source` não é mapeada. */
  defaultSource?: string;
  /** Teto de linhas processadas (padrão 20000; excedente → truncated). */
  maxRows?: number;
}

const MAX_ROWS_DEFAULT = 20000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Codificação / BOM ────────────────────────────────────────────────────────

/** Remove BOM e decodifica buffer (utf-8; latin-1 como fallback honesto). */
export function decodeCsvBytes(buf: Uint8Array): { text: string; encoding: string } {
  let bytes = buf;
  let encoding = 'utf-8';
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    bytes = bytes.subarray(3);
  }
  try {
    const dec = new TextDecoder('utf-8', { fatal: true });
    return { text: dec.decode(bytes), encoding: 'utf-8' };
  } catch {
    // Sequências inválidas UTF-8: decodificamos como latin-1 (1 byte = 1 char),
    // preservando os bytes originais (sem perda silenciosa).
    const latin = new TextDecoder('latin1');
    return { text: latin.decode(bytes.subarray(0, bytes.length)), encoding: 'latin-1' };
  }
}

// ── Detecção do delimitador ─────────────────────────────────────────────────

const CANDIDATE_DELIMS = [',', ';', '\t', '|'];

/**
 * Detecta o delimitador mais consistente nas primeiras linhas não-vazias.
 * Pontuação: número de linhas que contêm o candidato em 2+ partes;
 * desempate pela ordem da lista (vírgula > ponto e vírgula > tab > pipe).
 */
export function detectDelimiter(text: string): string {
  const lines = text
    .split(/\r\n|\r|\n/)
    .filter((l) => l.trim().length > 0)
    .slice(0, 25);
  if (lines.length === 0) return ',';
  let best = ',';
  let bestScore = 0;
  for (const d of CANDIDATE_DELIMS) {
    let score = 0;
    for (const l of lines) if (l.split(d).length >= 2) score++;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return bestScore === 0 ? ',' : best;
}

// ── Parser (RFC-4180 simplificado) ──────────────────────────────────────────

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

/**
 * Parser de CSV com aspas ("..." e "" escapado), quebras de linha dentro de
 * campos aspasados e CRLF/CR/LF. Linhas vazias são preservadas (a validação
 * as classifica como 'skipped' com o número da linha).
 */
export function parseCsv(text: string, delimiter = ','): ParsedCsv {
  const lines: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  const src = text.replace(/^﻿/, '');

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      lines.push(row);
      row = [];
    } else field += c;
  }
  // Última linha sem quebra de fim.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    lines.push(row);
  }

  // Remove linhas 100% vazias no fim do arquivo.
  while (lines.length > 0 && lines[lines.length - 1].every((f) => f.trim() === '')) {
    lines.pop();
  }

  const headers = (lines.shift() ?? []).map((h) => h.trim());
  return { headers, rows: lines };
}

// ── Cabeçalhos e mapeamento ─────────────────────────────────────────────────

/** Normaliza um cabeçalho para chaves estáveis de mapeamento. */
export function normalizeHeader(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SUGGEST: Array<{ match: string[]; target: CsvTarget }> = [
  { match: ['nome completo', 'nome', 'name', 'full name', 'full_name'], target: 'name' },
  { match: ['primeiro nome', 'nome', 'first name', 'first_name', 'prenome'], target: 'firstName' },
  { match: ['sobrenome', 'ultimo nome', 'last name', 'last_name', 'family name'], target: 'lastName' },
  { match: ['email', 'e-mail', 'mail', 'correio', 'correspondencia'], target: 'email' },
  { match: ['telefone', 'fone', 'celular', 'cel', 'whatsapp', 'numero', 'numero de telefone', 'phone', 'mobile'], target: 'phone' },
  { match: ['empresa', 'company', 'razao social', 'cliente', 'organizacao'], target: 'company' },
  { match: ['origem', 'source', 'canal', 'canal de origem', 'channel'], target: 'source' },
  { match: ['tags', 'tag', 'rotulos', 'label', 'labels'], target: 'tags' },
  { match: ['preferencias', 'preferencia', 'preferences'], target: 'preferences' },
  { match: ['consentimento', 'consent', 'consentimento marketing', 'opt in', 'opt-in', 'aceite', 'lgpd'], target: 'consentMarketing' },
  { match: ['origem do consentimento', 'consentimento fonte', 'consent source'], target: 'consentSource' },
  { match: ['opt out', 'opt-out', 'baixa', 'nao marketing', 'unsubscribe'], target: 'optOut' },
];

/**
 * Auto-sugere o mapeamento de colunas. Cada cabeçalho vira `custom` quando
 * nenhum heurístico casa (o valor entra em `customFields` sob a chave
 * normalizada). Sem PII; só nomes de coluna.
 */
export function suggestMapping(headers: string[]): CsvMapping {
  const used = new Set<CsvTarget>();
  const mapping: CsvMapping = {};
  for (const h of headers) {
    if (h === '') continue;
    const key = normalizeHeader(h);
    let target: CsvTarget = 'custom';
    for (const rule of SUGGEST) {
      if (rule.match.includes(key)) {
        target = rule.target;
        break;
      }
    }
    // Evita dois cabeçalhos disputando o mesmo alvo conhecido: o segundo vira custom.
    if (target !== 'custom' && used.has(target)) target = 'custom';
    if (target !== 'custom') used.add(target);
    mapping[h] = target;
  }
  return mapping;
}

// ── Normalização de telefone (E.164, Brasil primeiro) ────────────────────────

/**
 * Normaliza um telefone para E.164. Brasil (DDD+8/9 dígitos ou DDD+9 com
 * código 55): vira `+55…`. Números já internacionais (com + ou 8–15
 * dígitos) são preservados. `null` quando não é um número plausível.
 */
export function normalizePhone(raw: string, countryCode = '55'): string | null {
  const s = raw.trim();
  if (!s) return null;
  let digits: string;
  if (/^\+/.test(s)) {
    digits = s.replace(/[^0-9]/g, '');
    if (digits.length < 8 || digits.length > 15) return null;
    return '+' + digits;
  }
  digits = s.replace(/[^0-9]/g, '');
  if (digits.length === 0) return null;
  if (digits.length === 10 || digits.length === 11) return '+' + countryCode + digits;
  if (digits.length === 12 || digits.length === 13) {
    if (digits.startsWith(countryCode)) return '+' + digits;
    return null; // 12–13 dígitos sem o código esperado → ambíguo
  }
  if (digits.length >= 8 && digits.length <= 15) return digits; // intl. sem DDI
  return null;
}

// ── Conversores de valores (campos estruturados) ────────────────────────────

/** Tags: separa por `;`, `|` (e vírgula quando o delimitador não é vírgula). */
export function parseTags(raw: string | undefined, delimiter = ','): string[] {
  if (!raw) return [];
  const sep = delimiter === ',' ? /[;|\n]+/ : /[,;|\n]+/;
  return Array.from(
    new Set(
      raw
        .split(sep)
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  )
    .map((t) => t.slice(0, 50))
    .slice(0, 20);
}

/**
 * Objeto simples para `preferences`/`customFields`: JSON válido é mantido;
 * senão pares `chave:valor` separados por `;`/vírgula; senão `{}`.
 * Retorna `null` quando o valor não contém informação.
 */
export function parseSimpleObject(raw: string | undefined): Record<string, string> | null {
  if (!raw || !raw.trim()) return null;
  const t = raw.trim();
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      const v = JSON.parse(t);
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const out: Record<string, string> = {};
        for (const [k, val] of Object.entries(v)) out[String(k).slice(0, 60)] = String(val).slice(0, 200);
        return out;
      }
      return null;
    } catch {
      /* cai para pares simples */
    }
  }
  const out: Record<string, string> = {};
  for (const pair of t.split(/[,;]\s*/)) {
    const idx = pair.indexOf(':');
    if (idx > 0) out[pair.slice(0, idx).trim().slice(0, 60)] = pair.slice(idx + 1).trim().slice(0, 200);
  }
  return Object.keys(out).length ? out : null;
}

const CONSENT_TRUE = new Set(['sim', 's', '1', 'true', 'yes', 'y', 'x', 'opt-in', 'ativo', 'aceito', 'checked', 'concorda']);
const CONSENT_FALSE = new Set(['nao', 'não', '0', 'false', 'no', 'n', 'opt-out', 'inativo', 'negado', 'unsubscribed']);

/** Interpreta um valor de consentimento; vazio/ausente → `false` (fail-closed). */
export function consentBool(raw: string | undefined): boolean {
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  if (CONSENT_TRUE.has(v)) return true;
  return false;
}

// ── Orquestração ─────────────────────────────────────────────────────────────

/** Nome de exibição: explicito > firstName+lastName > parte local do e-mail. */
function deriveName(rec: MappedRecord, email?: string): void {
  const explicit = (rec.firstName || '').trim();
  if (rec.name || explicit) {
    rec.name = ((rec.name || '').trim() || `${(rec.firstName || '').trim()} ${(rec.lastName || '').trim()}`.trim()) || undefined;
    rec.nameDerivation = 'explicit';
    return;
  }
  if (email) {
    rec.name = email.split('@')[0] || undefined;
    rec.nameDerivation = 'derived';
  }
}

/**
 * Processa o CSV contra o mapeamento e devolve o resultado POR LINHA
 * (status + códigos de erro + registro mapeado). Puro: a decisão de
 * gravar (ou não) é da camada de rota/banco.
 */
export function processImport(input: ProcessImportInput): ImportResult {
  const delimiter = input.delimiter?.trim() || detectDelimiter(input.text);
  const { headers, rows } = parseCsv(input.text, delimiter);
  const maxRows = input.maxRows ?? MAX_ROWS_DEFAULT;
  const processing = rows.slice(0, maxRows);
  const truncated = rows.length > maxRows;

  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();
  const out: ImportRowResult[] = [];
  let valid = 0;
  let duplicates = 0;
  let invalid = 0;
  let skipped = 0;

  const headerTargets: Array<[string, CsvTarget]> = headers
    .map((h): [string, CsvTarget] => [h, input.mapping[h] ?? 'custom'])
    .filter(([, t]) => t !== undefined);

  for (let i = 0; i < processing.length; i++) {
    const line = i + 1;
    const cells = processing[i];
    const values: Record<string, string> = {};
    headerTargets.forEach(([h, t], j) => {
      values[h] = (cells[j] ?? '').trim();
    });

    // Linha vazia (todas as células vazias) → pulada, sem erro.
    if (cells.every((c) => (c || '').trim() === '')) {
      skipped++;
      out.push({ line, status: 'skipped', errors: [] });
      continue;
    }

    const errors: string[] = [];
    const rec: MappedRecord = {
      tags: [],
      customFields: {},
      preferences: {},
      consentMarketing: false,
      optOut: false,
    };

    for (const [h, target] of headerTargets) {
      const v = values[h];
      switch (target) {
        case 'name':
          rec.name = v || undefined;
          break;
        case 'firstName':
          rec.firstName = v || undefined;
          break;
        case 'lastName':
          rec.lastName = v || undefined;
          break;
        case 'email': {
          const e = v.toLowerCase();
          if (e && !EMAIL_RE.test(e)) errors.push('invalid_email');
          rec.email = e || undefined;
          break;
        }
        case 'phone': {
          if (v) {
            const p = normalizePhone(v);
            if (!p) errors.push('invalid_phone');
            else rec.phone = p; // só grava telefone válido (E.164)
          }
          break;
        }
        case 'company':
          rec.company = v || undefined;
          break;
        case 'source':
          rec.source = v || undefined;
          break;
        case 'tags':
          rec.tags = parseTags(v, delimiter);
          break;
        case 'preferences': {
          const o = parseSimpleObject(v);
          if (o) rec.preferences = o;
          break;
        }
        case 'consentMarketing':
          rec.consentMarketing = consentBool(v);
          break;
        case 'consentSource':
          rec.consentSource = v || undefined;
          break;
        case 'optOut':
          rec.optOut = consentBool(v);
          break;
        case 'custom':
        default:
          if (v) rec.customFields[normalizeHeader(h)] = v.slice(0, 200);
          break;
      }
    }

    // Origem: mapeada > default > 'csv-import'.
    if (!rec.source) rec.source = input.defaultSource || 'csv-import';

    // Duplicação: contra a base existente e contra linhas já vistas no arquivo.
    const emailKey = rec.email ?? '';
    const phoneKey = rec.phone ?? '';
    if ((emailKey && input.existingEmails?.has(emailKey)) || (phoneKey && input.existingPhones?.has(phoneKey))) {
      duplicates++;
      out.push({ line, status: 'duplicate', errors: [] });
      continue;
    }
    if (emailKey && seenEmails.has(emailKey)) {
      duplicates++;
      out.push({ line, status: 'duplicate', errors: ['duplicate_in_file'] });
      continue;
    }
    if (phoneKey && seenPhones.has(phoneKey)) {
      duplicates++;
      out.push({ line, status: 'duplicate', errors: ['duplicate_in_file'] });
      continue;
    }

    if (errors.length > 0) {
      invalid++;
      out.push({ line, status: 'invalid', errors });
      continue;
    }

    // Regra mínima: precisa de pelo menos um identificador OU nome derivável.
    if (!rec.email && !rec.phone && !rec.name && !rec.firstName) {
      invalid++;
      out.push({ line, status: 'invalid', errors: ['no_identifier'] });
      continue;
    }

    deriveName(rec, rec.email);
    if (emailKey) seenEmails.add(emailKey);
    if (phoneKey) seenPhones.add(phoneKey);
    valid++;
    out.push({ line, status: 'valid', errors: [], record: rec });
  }

  return {
    summary: { total: processing.length, valid, duplicates, invalid, skipped, truncated },
    rows: out,
    headers,
    delimiter,
  };
}

const KNOWN_TARGETS: ReadonlySet<string> = new Set<CsvTarget>([
  'name', 'firstName', 'lastName', 'email', 'phone', 'company', 'source',
  'tags', 'preferences', 'consentMarketing', 'consentSource', 'optOut', 'custom',
]);

/**
 * Sanitiza um mapeamento vindo do cliente: qualquer alvo fora da allow-list
 * (ex.: `role`, `organizationId`, `planId`) é descartado para `custom` — um
 * importador NUNCA altera campos protegidos (§8).
 */
export function sanitizeMapping(m: Record<string, unknown>): CsvMapping {
  const out: CsvMapping = {};
  for (const [h, t] of Object.entries(m ?? {})) {
    if (!h || h.length > 120) continue;
    out[h] = KNOWN_TARGETS.has(String(t)) ? (String(t) as CsvTarget) : 'custom';
  }
  return out;
}

/**
 * Relatório de erros exportável (CSV) — apenas linha/status/motivo,
 * para o usuário corrigir o arquivo-fonte. Sem log de PII.
 */
export function errorReportCsv(result: ImportResult): string {
  const lines = ['line,status,reasons'];
  for (const r of result.rows) {
    if (r.status === 'valid' || r.status === 'skipped') continue;
    lines.push(`${r.line},${r.status},"${r.errors.join('; ')}"`);
  }
  return lines.join('\n');
}
