// src/integrations/publicScraper.ts
//
// "Sem API / Avançado" — scraping de páginas públicas com guarda SSRF.
// Casa: TS puro, zero dependências externas, NUNCA lança ({ok, error, errorDetail}).
//
// A guarda é em profundidade (coberta por publicScraper.test.ts):
//  1. allow-list de esquema (só http/https — `file:`/`ftp:`/`data:` caem no URL);
//  2. IPs literais bloqueados na forma canônica E nas notações não-padrão
//     (decimal 2130706433, octal 0177.0.0.1, hex 0x7f.0.0.1, IPv4-mapped IPv6
//     ::ffff:127.0.0.1, ULA fc00::/7, link-local fe80::/10, ::, etc.);
//  3. pré-resolução DNS: hosts de domínio passam pelo resolver (node:dns no
//     servidor; injetável) ANTES do fetch — todo endereço resolvido passa pela
//     mesma guarda de IP (mitiga "hostname público que resolve para
//     169.254.169.254", ex.: * .nip.io);
//  4. redirects manuais: `redirect: 'manual'` + até `maxRedirects` (3) hops,
//     cada Location revalidada com a guarda completa (não segue 302 → alvo
//     interno sem checar);
//  5. timeout por request (AbortController) + teto de tamanho da resposta.
//
// Limitação honesta (documentada, não escondida): rebinding DNS de TTL curto
// ENTRE a pré-resolução e o connect segue possível — a mitigação completa
// exigiria resolver-pinned no connect (undici Agent com callback de lookup).
// `resolveHost` e `fetchImpl` já são os pontos de injeção para essa extensão.

export type ResolveHost = (hostname: string) => Promise<string[]>;

export interface ScrapeOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
  /**
   * Resolve um domínio para TODOS os endereços (v4 e/ou v6).
   * Padrão no servidor: `node:dns` (import dinâmico — zero dep nova).
   * Em testes, injete um fake: nenhum DNS real no jest.
   */
  resolveHost?: ResolveHost;
  /** Máx. de redirects seguidos, cada hop revalidado (padrão 3). */
  maxRedirects?: number;
}

export interface ScrapeResult {
  ok: boolean;
  html?: string;
  error?: 'invalid_url' | 'forbidden' | 'timeout' | 'network_error' | 'too_large';
  errorDetail?: string;
}

// ---------------------------------------------------------------------------
// Normalização de IPs — canonicidade de notação
// ---------------------------------------------------------------------------

const RE_HEX32 = /^0[xX][0-9a-fA-F]+$/;
const RE_OCT32 = /^0[0-7]+$/;

/** Converte um host que "é" um IPv4 (qualquer notação aceita) em quad dotted; null se não for v4. */
export function ipv4FromHost(host: string): string | null {
  const h = host.toLowerCase().replace(/\.$/, '').replace(/%.*$/, '');

  if (h.includes(':')) {
    // v6 literal. Só conta como "v4 embutido" a forma IPv4-mapped
    // (::ffff:a.b.c.d / ::ffff:xx:yy) ou IPv4-compatible (::a.b.c.d) —
    // exige PONTOS no host (sufixo v4 em notação dotted) ou os dois
    // grupos hex explícitos após ::ffff. Assim `::1`, `::` e afins
    // permanecem no mundo v6 e não são mal-classificados como v4.
    if (h.includes('.')) {
      const w = ipv6Words(h);
      if (!w) return null;
      if (w[0] === 0 && w[1] === 0 && w[2] === 0 && w[3] === 0 && w[4] === 0 && (w[5] === 0xffff || w[5] === 0)) {
        // mapeado: …:0:ffff:a.b.c.d → v4 em w[6]..w[7]; compatible: …:0:0:a.b.c.d
        return [
          (w[6] >> 8) & 0xff,
          w[6] & 0xff,
          (w[7] >> 8) & 0xff,
          w[7] & 0xff,
        ].join('.');
      }
      return null; // prefixo v6 não-mapped c/ v4 embutido → tratado por range v6
    }
    const m = h.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (m) {
      const hi = parseInt(m[1], 16);
      const lo = parseInt(m[2], 16);
      if (hi > 0xffff || lo > 0xffff) return null;
      return [(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff].join('.');
    }
    return null; // v6 puro — não é v4
  }

  if (h.includes('.')) {
    const parts = h.split('.');
    if (parts.length !== 4) return null;
    const nums: number[] = [];
    for (const p of parts) {
      let v: number;
      if (RE_HEX32.test(p)) v = parseInt(p.slice(2), 16);
      else if (/^0[0-7]{1,3}$/.test(p)) v = parseInt(p, 8);
      else if (/^[0-9]+$/.test(p)) v = parseInt(p, 10);
      else return null; // parte não-numérica → é hostname, não literal IP
      if (v > 255) return null;
      nums.push(v);
    }
    return nums.join('.');
  }

  // Notação 32-bit de host único: decimal ("2130706433"), hex ("0x7f000001")
  // ou octal ("01770000001"). Prefixo "0" ⇒ octal (mesma semântica de inet_aton).
  if (RE_HEX32.test(h)) {
    const v = parseInt(h.slice(2), 16);
    return v <= 0xffffffff ? fromInt32(v) : null;
  }
  if (RE_OCT32.test(h) && h.length > 1) {
    const v = parseInt(h, 8);
    return v <= 0xffffffff ? fromInt32(v) : null;
  }
  if (/^[0-9]+$/.test(h)) {
    const v = parseInt(h, 10);
    return v <= 0xffffffff ? fromInt32(v) : null;
  }
  return null;
}

function fromInt32(v: number): string {
  return [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff].join('.');
}

/** Se o host é um literal IPv6 (com `::` expandido, zone-id e v4 embutido), devolve 8 palavras de 16 bits; senão null. */
export function ipv6Words(host: string): number[] | null {
  let s = host.toLowerCase().replace(/\.$/, '').replace(/%.*$/, '');

  // Sufixo v4 embed ("…::1.2.3.4") → 2 grupos hex de 16 bits.
  const v4tail = s.match(/^(.*):(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4tail) {
    const v4 = ipv4FromHost(v4tail[2]);
    if (!v4) return null;
    const [a, b, c, d] = v4.split('.').map(Number);
    s = v4tail[1] + ':' + (((a << 8) | b).toString(16)) + ':' + (((c << 8) | d).toString(16));
  }

  if (!s.includes(':')) return null;
  const valid = (p: string) => p.length > 0 && p.length <= 4 && /^[0-9a-f]+$/.test(p);
  let head: string[];
  let tail: string[];
  if (s.includes('::')) {
    const parts = s.split('::');
    if (parts.length !== 2) return null;
    head = parts[0] === '' ? [] : parts[0].split(':');
    tail = parts[1] === '' ? [] : parts[1].split(':');
    if (head.length + tail.length > 7) return null; // `::` expande p/ ≥ 1 grupo
  } else {
    head = s.split(':');
    tail = [];
    if (head.length !== 8) return null;
  }
  if (!head.every(valid) || !tail.every(valid)) return null;

  const words: number[] = [];
  for (const p of head) words.push(parseInt(p, 16));
  for (let i = 0; i < 8 - head.length - tail.length; i++) words.push(0);
  for (const p of tail) words.push(parseInt(p, 16));
  return words.length === 8 ? words : null;
}

// ---------------------------------------------------------------------------
// Guarda de ranges — IPs bloqueados
// ---------------------------------------------------------------------------

/** True se o endereço (v4 quad dotted, v4-mapped v6 ou literal v6) está em range bloqueado. */
export function isBlockedIp(ip: string): boolean {
  const v4 = ipv4FromHost(ip);
  if (v4 !== null) {
    const [a, b] = v4.split('.').map(Number);
    return blockedV4(a, b);
  }
  const w = ipv6Words(ip);
  if (w !== null) {
    if (w.every((x) => x === 0)) return true; // ::
    if (w[0] === 0 && w[1] === 0 && w[2] === 0 && w[3] === 0 && w[4] === 0 && w[5] === 0 && w[6] === 0 && w[7] === 1) return true; // ::1
    if ((w[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 — ULA
    if ((w[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 — link-local
    if ((w[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 — site-local (deprecated)
    if (w[0] === 0x0100) return true; // 100::/64 — CGNAT v6
    if (w[0] === 0x2001 && w[1] === 0x0db8) return true; // 2001:db8::/32 — documentação
    if (w[0] === 0x64 && w[1] === 0xff9b) return true; // 64:ff9b::/96 — NAT64 (32 bits iniciais)
    // v4-mapped/compatible EM EXPANSÃO TOTAL (0:0:0:0:0:ffff:xx:yy ou 0:0:0:0:0:0:xx:yy):
    // re-derive o v4 embutido (w[6],w[7]) e passe pelo range v4 — mesmo marcador
    // (w[5]===0xffff|0, cinco zeros à frente) que ipv4FromHost usa. Fecha a forma
    // NÃO-canônica que um resolver INJETADO pode devolver: o resolver default e
    // `new URL` normalizam p/ ::ffff:a.b.c.d, mas um resolveHost custom pode não.
    if (
      w[0] === 0 && w[1] === 0 && w[2] === 0 && w[3] === 0 && w[4] === 0 &&
      (w[5] === 0xffff || w[5] === 0)
    ) {
      const a = (w[6] >> 8) & 0xff;
      const b = w[6] & 0xff;
      if (blockedV4(a, b)) return true;
    }
    return false; // unicast global
  }
  // Não é literal IP (é domínio) → decisão fica com a pré-resolução DNS.
  return false;
}

function blockedV4(a: number, b: number): boolean {
  if (a === 0 || a === 10 || a === 127 || a >= 224) return true; // 0/8, 10/8, 127/8, 224/4 (multicast+reservado, incl. 255.x)
  if (a === 100 && b === 64) return true; // CGNAT
  if (a === 169 && b === 254) return true; // link-local / metadata de nuvem
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && (b === 168 || b === 0)) return true; // 192.168/16 + 192.0.x (TEST-NET-1 conservador)
  if (a === 198 && b === 51) return true; // 198.51.100/24 (TEST-NET-2 conservador)
  if (a === 203 && b === 0) return true; // 203.0.113/24 (TEST-NET-3 conservador)
  return false;
}

// ---------------------------------------------------------------------------
// Validação de URL (nível host)
// ---------------------------------------------------------------------------

export function isSafePublicUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const hostname = u.hostname; // v6 literal vem entre colchetes; domínio já em minúscula
  if (hostname === '') return false;
  if (hostname === 'localhost') return false;
  if (hostname === 'internal' || hostname.endsWith('.internal')) return false;
  if (hostname === 'metadata.google.internal') return false; // redundante com .internal, explícito por clareza
  if (hostname.endsWith('.local')) return false;

  const ip = hostname.replace(/^\[|\]$/g, '');
  if (ip === '') return false;
  if (ipv4FromHost(ip) !== null || ipv6Words(ip) !== null) {
    // Literal IP (qualquer notação) → decisão por range canônico.
    return !isBlockedIp(ip);
  }
  // Domínio: nível host OK — a checagem de IP acontece na pré-resolução
  // (scrapePublicUrl), que é onde o ataque de DNS redirecionado mora.
  return true;
}

// ---------------------------------------------------------------------------
// Pré-resolução DNS
// ---------------------------------------------------------------------------

/** Padrão: lookup do node:dns (servidor). Em runtime não-Node, retorna [] (o chamador injeta). */
const defaultResolveHost: ResolveHost = async (hostname: string) => {
  let dns: typeof import('node:dns');
  try {
    dns = await import('node:dns');
  } catch {
    return []; // fora do Node: não há como checar — documentado
  }
  return new Promise<string[]>((resolve, reject) => {
    dns.lookup(hostname, { all: true, verbatim: true }, (err, records) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(records.map((r) => r.address));
    });
  });
};

function isIpLiteralHost(host: string): boolean {
  const ip = host.replace(/^\[|\]$/g, '');
  return ip.includes(':') || ipv4FromHost(ip) !== null || ipv6Words(ip) !== null;
}

/**
 * Checa UM host (IP literal ou domínio) contra a guarda.
 * Retorna null (pode prosseguir) ou o ScrapeResult de bloqueio/falha.
 */
async function checkHostAgainstGuard(
  host: string,
  resolver: ResolveHost,
): Promise<ScrapeResult | null> {
  const ip = host.replace(/^\[|\]$/g, '');
  if (ip === '') return { ok: false, error: 'forbidden', errorDetail: 'host vazio' };

  if (isIpLiteralHost(ip)) {
    if (isBlockedIp(ip)) {
      return { ok: false, error: 'forbidden', errorDetail: `IP literal bloqueado (${ip})` };
    }
    return null;
  }

  // Domínio: pré-resolve e EXIGE que todo endereço resolvido passe na guarda.
  let addrs: string[];
  try {
    addrs = await resolver(ip);
  } catch {
    return { ok: false, error: 'network_error', errorDetail: `DNS não resolveu (${ip})` };
  }
  if (addrs.length === 0) {
    return { ok: false, error: 'network_error', errorDetail: `DNS sem endereço para (${ip})` };
  }
  const bad = addrs.find((a) => isBlockedIp(a));
  if (bad) {
    return { ok: false, error: 'forbidden', errorDetail: `host resolve para endereço bloqueado (${ip} → ${bad})` };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Scraping (NUNCA lança)
// ---------------------------------------------------------------------------

export async function scrapePublicUrl(url: string, opts: ScrapeOptions = {}): Promise<ScrapeResult> {
  if (!isSafePublicUrl(url)) {
    return { ok: false, error: 'forbidden', errorDetail: 'URL blocked for security reasons' };
  }

  const fetchImpl = opts.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  if (!fetchImpl) {
    return { ok: false, error: 'network_error', errorDetail: 'fetch implementation missing' };
  }

  const timeoutMs = opts.timeoutMs ?? 5000;
  const maxBytes = opts.maxBytes ?? 500_000; // 500KB
  const maxRedirects = opts.maxRedirects ?? 3;
  const resolver = opts.resolveHost ?? defaultResolveHost;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  let current: URL;
  try {
    current = new URL(url);
  } catch {
    clearTimeout(timer);
    return { ok: false, error: 'invalid_url', errorDetail: 'URL inválida' };
  }

  try {
    let hops = 0;
    for (;;) {
      // Revalida o host de cada hop: IP literal (v4/v6 canônico) ou
      // pré-resolução DNS. É a trava contra 302 → alvo interno sem checagem.
      const hostCheck = await checkHostAgainstGuard(current.hostname, resolver);
      if (hostCheck) return hostCheck;

      const res = await fetchImpl(current.toString(), {
        signal: ctrl.signal,
        redirect: 'manual',
      });

      if (res.status >= 300 && res.status < 400 && res.status !== 304) {
        const location = res.headers.get('location');
        if (location === null) {
          return { ok: false, error: 'network_error', errorDetail: `HTTP ${res.status} redirect sem Location` };
        }
        if (hops >= maxRedirects) {
          return { ok: false, error: 'forbidden', errorDetail: `Limite de ${maxRedirects} redirects atingido` };
        }
        let next: URL;
        try {
          next = new URL(location, current);
        } catch {
          return { ok: false, error: 'network_error', errorDetail: `Location inválida (${location})` };
        }
        if (!isSafePublicUrl(next.toString())) {
          return { ok: false, error: 'forbidden', errorDetail: `Redirect bloqueado pela guarda (${next.host})` };
        }
        hops += 1;
        current = next;
        continue;
      }

      if (!res.ok) {
        return { ok: false, error: 'network_error', errorDetail: `HTTP ${res.status}` };
      }

      const buffer = await res.arrayBuffer();
      if (buffer.byteLength > maxBytes) {
        return { ok: false, error: 'too_large', errorDetail: `Response exceeds ${maxBytes} bytes` };
      }

      const html = new TextDecoder().decode(buffer);
      return { ok: true, html };
    }
  } catch (e) {
    const name = (e as { name?: unknown })?.name;
    const msg = e instanceof Error ? e.message : String(e);
    // Abort pode vir como DOMException (name 'AbortError') ou mensagem crua.
    if (name === 'AbortError' || msg === 'AbortError' || msg === 'The operation was aborted' || msg === 'This operation was aborted') {
      return { ok: false, error: 'timeout', errorDetail: 'Request timed out' };
    }
    return { ok: false, error: 'network_error', errorDetail: msg };
  } finally {
    clearTimeout(timer);
  }
}
