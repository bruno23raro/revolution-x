// FASE 17 — Testes do importador CSV (§8).
//
// Puro: sem I/O, sem banco. Cobre: delimitadores, aspas/RFC-4180, BOM/
// latin-1, sugestão + SANITIZAÇÃO de mapeamento (campos protegidos nunca
// entram), normalização de telefone, consentimento fail-closed, duplicados
// (base + in-file), linhas vazias, truncamento e relatório de erros.

import {
  consentBool,
  decodeCsvBytes,
  detectDelimiter,
  errorReportCsv,
  normalizePhone,
  parseCsv,
  processImport,
  sanitizeMapping,
  suggestMapping,
} from '@/services/csvImport';

// ── Codificação ───────────────────────────────────────────────────────────────

describe('decodeCsvBytes', () => {
  it('remove BOM UTF-8', () => {
    const buf = new TextEncoder().encode('﻿a,b\n1,2');
    const { text, encoding } = decodeCsvBytes(new Uint8Array(buf));
    expect(text.startsWith('﻿')).toBe(false);
    expect(text).toBe('a,b\n1,2');
    expect(encoding).toBe('utf-8');
  });

  it('cai para latin-1 quando UTF-8 é inválido', () => {
    // 0xE9 = "é" em latin-1; em UTF-8 seria byte isolado inválido.
    const buf = new Uint8Array([0x61, 0x3b, 0x62, 0x0a, 0x63, 0xe9]);
    const { text, encoding } = decodeCsvBytes(buf);
    expect(encoding).toBe('latin-1');
    expect(text).toContain('cé');
  });
});

// ── Delimitador ───────────────────────────────────────────────────────────────

describe('detectDelimiter', () => {
  it('detecta ; em CSV brasileiro', () => {
    expect(detectDelimiter('nome;email\nJoão;a@x.com')).toBe(';');
  });

  it('detecta tab', () => {
    expect(detectDelimiter('nome\temail\nJoão\ta@x.com')).toBe('\t');
  });

  it('padrão é vírgula', () => {
    expect(detectDelimiter('nome,email\nJoão,a@x.com')).toBe(',');
  });
});

// ── Parser RFC-4180 ───────────────────────────────────────────────────────────

describe('parseCsv', () => {
  it('aspas, escape "" e quebra de linha dentro de aspas', () => {
    const csv = '"a","b""c","\nd","x"';
    const { headers, rows } = parseCsv(`h1,h2,h3,h4\n${csv}`, ',');
    expect(headers).toEqual(['h1', 'h2', 'h3', 'h4']);
    expect(rows).toEqual([['a', 'b"c', '\nd', 'x']]);
  });

  it('CRLF e linhas vazias no fim', () => {
    const { rows } = parseCsv('h\n1,2\r\n3,4\r\n\r\n', ',');
    expect(rows).toEqual([['1', '2'], ['3', '4']]);
  });

  it('linhas mais curtas deixam células faltantes ausentes (processImport completa)', () => {
    const { rows } = parseCsv('a,b,c\n1\n', ',');
    expect(rows[0]).toEqual(['1']);
  });
});

// ── Mapeamento: sugestão + sanitização (campos protegidos) ───────────────────

describe('suggestMapping + sanitizeMapping', () => {
  it('sugere campos conhecidos (PT)', () => {
    const s = suggestMapping(['nome', 'email', 'telefone', 'empresa', 'tags', 'origem']);
    expect(s.nome).toBe('name');
    expect(s.email).toBe('email');
    expect(s.telefone).toBe('phone');
    expect(s.empresa).toBe('company');
    expect(s.tags).toBe('tags');
    expect(s.origem).toBe('source');
  });

  it('segundo cabeçalho para o mesmo alvo degrada para custom', () => {
    const s = suggestMapping(['email', 'Email corporativo']);
    expect(s.email).toBe('email');
    expect(s['Email corporativo']).toBe('custom');
  });

  it('SANITIZA alvos protegidos: role/org/plan viram custom (§8)', () => {
    const longHeader = 'header-longo'.padEnd(130, 'x'); // >120 chars → descartada
    const clean = sanitizeMapping({
      a: 'role',
      b: 'organizationId',
      c: 'planId',
      d: 'email',
      z: 'nada-valido',
      [longHeader]: 'name',
    });
    expect(clean.a).toBe('custom');
    expect(clean.b).toBe('custom');
    expect(clean.c).toBe('custom');
    expect(clean.d).toBe('email');
    expect(clean.z).toBe('custom');
    expect(Object.keys(clean)).not.toContain(longHeader);
  });
});

// ── Telefone + consentimento ───────────────────────────────────────────────────

describe('normalizePhone', () => {
  it('Brasil: (11) 98765-4321 → E.164', () => {
    expect(normalizePhone('(11) 98765-4321')).toBe('+5511987654321');
  });

  it('Brasil com prefixo 0 (ramal/fixa) é ambíguo → null', () => {
    expect(normalizePhone('011 98765-4321')).toBeNull();
  });

  it('já E.164: +5521999999999 preservado', () => {
    expect(normalizePhone('+5521999999999')).toBe('+5521999999999');
  });

  it('inválido → null', () => {
    expect(normalizePhone('abc')).toBeNull();
    expect(normalizePhone('123')).toBeNull();
  });
});

describe('consentBool (fail-closed, §11)', () => {
  it('verdadeiros', () => {
    expect(consentBool('sim')).toBe(true);
    expect(consentBool('true')).toBe(true);
    expect(consentBool('1')).toBe(true);
  });

  it('tudo o mais é FALSO (sem consentimento ≠ consentimento)', () => {
    expect(consentBool('nao')).toBe(false);
    expect(consentBool('')).toBe(false);
    expect(consentBool(undefined)).toBe(false);
    expect(consentBool(' Sim ')).toBe(true); // trim + case-insensitive
    expect(consentBool('sim!!')).toBe(false); // fora do conjunto → fail-closed
  });
});

// ── processImport ──────────────────────────────────────────────────────────────

describe('processImport', () => {
  const base = {
    text: 'nome,email,telefone,consent\nMaria,m@x.com,(11) 98765-4321,sim\n',
    mapping: { nome: 'name', email: 'email', telefone: 'phone', consent: 'consentMarketing' },
  } as const;

  it('linha válida com consentimento → record completa', () => {
    const r = processImport({ ...base });
    expect(r.summary).toEqual({ total: 1, valid: 1, duplicates: 0, invalid: 0, skipped: 0, truncated: false });
    const rec = r.rows[0].record!;
    expect(rec.name).toBe('Maria');
    expect(rec.email).toBe('m@x.com');
    expect(rec.phone).toBe('+5511987654321');
    expect(rec.consentMarketing).toBe(true);
    expect(rec.source).toBe('csv-import'); // default de origem
  });

  it('duplicado contra a base existente', () => {
    const r = processImport({ ...base, existingEmails: new Set(['m@x.com']) });
    expect(r.rows[0].status).toBe('duplicate');
    expect(r.summary.duplicates).toBe(1);
    expect(r.summary.valid).toBe(0);
  });

  it('duplicado in-file (mesmo e-mail em duas linhas)', () => {
    const r = processImport({
      text: 'email\na@x.com\na@x.com\n',
      mapping: { email: 'email' },
    });
    expect(r.rows.map((x) => x.status)).toEqual(['valid', 'duplicate']);
    expect(r.rows[1].errors).toEqual(['duplicate_in_file']);
  });

  it('e-mail inválido → invalid com código sem PII', () => {
    const r = processImport({
      text: 'email\na@x\n',
      mapping: { email: 'email' },
    });
    expect(r.rows[0].status).toBe('invalid');
    expect(r.rows[0].errors).toContain('invalid_email');
  });

  it('sem identificador → no_identifier', () => {
    const r = processImport({
      text: 'empresa\nACME\n',
      mapping: { empresa: 'company' },
    });
    expect(r.rows[0].status).toBe('invalid');
    expect(r.rows[0].errors).toContain('no_identifier');
  });

  it('nome derivado do e-mail quando ausente', () => {
    const r = processImport({
      text: 'email\nmaria.silva@x.com\n',
      mapping: { email: 'email' },
    });
    const rec = r.rows[0].record!;
    expect(rec.name).toContain('maria');
    expect(rec.nameDerivation).toBe('derived');
  });

  it('linha em branco é pulada (não invalida)', () => {
    const r = processImport({
      text: 'email\n\na@x.com\n',
      mapping: { email: 'email' },
    });
    expect(r.rows[0].status).toBe('skipped');
    expect(r.rows[1].status).toBe('valid');
    expect(r.summary.skipped).toBe(1);
  });

  it('truncamento: maxRows limita e sinaliza', () => {
    const text = 'email\n' + Array.from({ length: 10 }, (_, i) => `a${i}@x.com`).join('\n') + '\n';
    const r = processImport({ text, mapping: { email: 'email' }, maxRows: 4 });
    expect(r.summary.truncated).toBe(true);
    expect(r.summary.total).toBe(4);
    expect(r.summary.valid).toBe(4);
  });

  it('tags com ; e dedupe (delimitador CSV é vírgula)', () => {
    const r = processImport({
      text: 'nome,tags\nA,vip;vip;loja\n',
      mapping: { nome: 'name', tags: 'tags' },
      delimiter: ',', // delimitador explícito: a detecção é best-effort,
      // e o valor das tags confunde o auto-detect em 2 colunas.
    });
    const rec = r.rows[0].record!;
    expect(rec.tags).toEqual(['vip', 'loja']);
  });
});

// ── Relatório de erros ────────────────────────────────────────────────────────

describe('errorReportCsv', () => {
  it('só inclui linhas problemáticas, com motivos (sem PII)', () => {
    const r = processImport({
      text: 'email\nok@x.com\nbad\n',
      mapping: { email: 'email' },
    });
    const report = errorReportCsv(r);
    const lines = report.trim().split('\n');
    expect(lines[0]).toBe('line,status,reasons');
    expect(lines.length).toBe(2); // cabeçalho + 1 linha invalid
    expect(lines[1]).toContain('invalid');
    expect(report).not.toContain('ok@x.com');
  });
});
