// src/integrations/publicScraper.test.ts
//
// "Sem API / Avançado" — suíte da guarda SSRF endurecida.
// Módulo puro: todo I/O externo é injetado (fake fetch + fake resolver) —
// zero DNS real e zero rede no jest.
import {
  isSafePublicUrl,
  isBlockedIp,
  ipv4FromHost,
  ipv6Words,
  scrapePublicUrl,
  ResolveHost,
} from './publicScraper';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const res200 = (html: string): Response =>
  new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });

const res302 = (location: string): Response =>
  new Response(null, { status: 302, headers: { location } });

/** Fake fetch que reinterpreta uma "script" de responses (ou Errors p/ rejeitar). */
function mkFetch(script: Array<Response | Error>) {
  const calls: string[] = [];
  const fetch = jest.fn(async (url: string | URL | Request, _init?: RequestInit) => {
    calls.push(String(url));
    const item = script[calls.length - 1];
    if (item === undefined) throw new Error('fakeFetch: script esgotado');
    if (item instanceof Error) throw item;
    return item;
  });
  return { fetch, calls };
}

/** Resolver fake: endereços por domínio; domínio fora do mapa → [] (DNS vazio). */
const fakeResolver = (map: Record<string, string[]>): ResolveHost =>
  jest.fn(async (host: string) => map[host] ?? []);

// ---------------------------------------------------------------------------
// isSafePublicUrl — IPs literais (forma canônica + notações não-padrão)
// ---------------------------------------------------------------------------

describe('isSafePublicUrl — IPs privados em notação padrão', () => {
  it('bloqueia loopback/privado/link-local/metadata/CGNAT/multicast', () => {
    for (const u of [
      'http://127.0.0.1/',
      'http://127.0.0.1:8080/',
      'http://192.168.1.1/',
      'http://10.0.0.1/',
      'http://172.16.0.1/',
      'http://172.31.255.255/',
      'http://169.254.169.254/',
      'http://100.64.0.1/',
      'http://0.0.0.0/',
      'http://224.0.0.1/',
      'http://255.255.255.255/',
      'http://192.0.2.1/',
      'http://198.51.100.7/',
      'http://203.0.113.9/',
    ]) {
      expect(isSafePublicUrl(u)).toBe(false);
    }
  });

  it('bloqueia localhost e domínios internos', () => {
    for (const u of [
      'http://localhost/',
      'http://myhost.local/',
      'http://svc.internal/',
      'http://a.b.internal/',
      'http://internal/',
      'http://metadata.google.internal/',
    ]) {
      expect(isSafePublicUrl(u)).toBe(false);
    }
  });

  it('bloqueia notações não-padrão de IPv4 que antes passavam', () => {
    for (const u of [
      'http://2130706433/',
      'http://0x7f000001/',
      'http://0177.0.0.1/',
      'http://0x7f.0.0.1/',
      'http://017700000001/',
    ]) {
      expect(isSafePublicUrl(u)).toBe(false);
    }
  });

  it('bloqueia IPv4-mapped IPv6 (dotted e hex)', () => {
    for (const u of [
      'http://[::ffff:127.0.0.1]/',
      'http://[::ffff:7f00:1]/',
      'http://[::ffff:192.168.1.1]/',
      'http://[::ffff:169.254.169.254]/',
    ]) {
      expect(isSafePublicUrl(u)).toBe(false);
    }
  });

  it('bloqueia ranges privados/loopback de IPv6', () => {
    for (const u of [
      'http://[::]/',
      'http://[::1]/',
      'http://[fc00::1]/',
      'http://[fd12:3456::1]/',
      'http://[fe80::1]/',
      'http://[fec0::1]/',
      'http://[100::1]/',
      'http://[2001:db8::1]/',
      'http://[64:ff9b::1]/',
    ]) {
      expect(isSafePublicUrl(u)).toBe(false);
    }
  });

  it('rejeita esquemas não-http(s) e input malformado', () => {
    for (const u of ['file:///etc/passwd', 'ftp://x.y/', 'data:text/html,x', 'nota-uma-url', 'http://']) {
      expect(isSafePublicUrl(u)).toBe(false);
    }
  });

  it('permite URLs públicas (domínio e literais públicos)', () => {
    expect(isSafePublicUrl('https://www.google.com')).toBe(true);
    expect(isSafePublicUrl('https://example.com/path?q=1')).toBe(true);
    expect(isSafePublicUrl('http://8.8.8.8/')).toBe(true);
    expect(isSafePublicUrl('http://1.2.3.4:8080/x')).toBe(true);
    expect(isSafePublicUrl('http://[2001:4860:4860::8888]/')).toBe(true);
    expect(isSafePublicUrl('http://[::ffff:8.8.8.8]/')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isBlockedIp / canonicidade
// ---------------------------------------------------------------------------

describe('isBlockedIp — ranges por família', () => {
  it('IPv4 (forma canônica e via mapped)', () => {
    expect(isBlockedIp('127.0.0.1')).toBe(true);
    expect(isBlockedIp('10.1.2.3')).toBe(true);
    expect(isBlockedIp('172.16.0.1')).toBe(true);
    expect(isBlockedIp('172.31.255.255')).toBe(true);
    expect(isBlockedIp('192.168.0.1')).toBe(true);
    expect(isBlockedIp('169.254.169.254')).toBe(true);
    expect(isBlockedIp('100.64.0.1')).toBe(true);
    expect(isBlockedIp('0.1.1.1')).toBe(true);
    expect(isBlockedIp('224.0.0.1')).toBe(true);
    expect(isBlockedIp('255.255.255.255')).toBe(true);
    expect(isBlockedIp('::ffff:169.254.169.254')).toBe(true);
    expect(isBlockedIp('8.8.8.8')).toBe(false);
    expect(isBlockedIp('93.184.215.14')).toBe(false);
    expect(isBlockedIp('1.2.3.4')).toBe(false);
  });

  it('IPv6 (ULA/link-local/site-local/CGNAT/doc/NAT64/unspecified/loopback)', () => {
    expect(isBlockedIp('::')).toBe(true);
    expect(isBlockedIp('::1')).toBe(true);
    expect(isBlockedIp('fc00::1')).toBe(true);
    expect(isBlockedIp('fdff:ffff::1')).toBe(true);
    expect(isBlockedIp('fe80::1')).toBe(true);
    expect(isBlockedIp('fec0::1')).toBe(true);
    expect(isBlockedIp('100::1')).toBe(true);
    expect(isBlockedIp('2001:db8::1')).toBe(true);
    expect(isBlockedIp('64:ff9b::1')).toBe(true);
    expect(isBlockedIp('2001:4860:4860::8888')).toBe(false);
    expect(isBlockedIp('2606:4700:4700::1111')).toBe(false);
  });

  it('v4-mapped/compatible em EXPANSÃO TOTAL (resolver não-canônico) cai no range v4', () => {
    // A forma totalmente expandida que um resolver INJETADO pode devolver sem
    // normalizar — o default resolver + `new URL` já normalizam, mas o guard
    // também deve pegar a forma crua (defesa em profundidade, marcador w[5]).
    expect(isBlockedIp('0:0:0:0:0:ffff:7f00:1')).toBe(true);  // ::ffff:7f00:1 = 127.0.0.1
    expect(isBlockedIp('0:0:0:0:0:0:7f00:1')).toBe(true);     // ::7f00:1 (v4-compatible)
    expect(isBlockedIp('0:0:0:0:0:ffff:c0a8:80a')).toBe(true); // ::ffff:192.168.8.10
    expect(isBlockedIp('0:0:0:0:0:ffff:a9fe:a9fe')).toBe(true); // ::ffff:169.254.169.254
    // PÚBLICO: 8.8.8.8 expandido ainda é global — não deve ser bloqueado
    expect(isBlockedIp('0:0:0:0:0:ffff:808:808')).toBe(false);
  });
});

describe('canonicidade de notações (ipv4FromHost / ipv6Words)', () => {
  it('ipv4FromHost: decimal/octal/hex por parte e 32-bit', () => {
    expect(ipv4FromHost('2130706433')).toBe('127.0.0.1');
    expect(ipv4FromHost('0x7f000001')).toBe('127.0.0.1');
    expect(ipv4FromHost('0177.0.0.1')).toBe('127.0.0.1');
    expect(ipv4FromHost('0x7f.0.0.1')).toBe('127.0.0.1');
    expect(ipv4FromHost('017700000001')).toBe('127.0.0.1');
    expect(ipv4FromHost('::ffff:127.0.0.1')).toBe('127.0.0.1');
    expect(ipv4FromHost('::ffff:7f00:1')).toBe('127.0.0.1');
    expect(ipv4FromHost('0:0:0:0:0:ffff:127.0.0.1')).toBe('127.0.0.1');
    expect(ipv4FromHost('8.8.8.8')).toBe('8.8.8.8');
    expect(ipv4FromHost('google.com')).toBeNull();
    expect(ipv4FromHost('::1')).toBeNull(); // v6 loopback não é v4
    expect(ipv4FromHost('2001:db8::1.2.3.4')).toBeNull(); // prefixo não-mapped → v6
  });

  it('ipv6Words: expande ::, zone-id e v4 embutido', () => {
    expect(ipv6Words('::1')).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    expect(ipv6Words('::')).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(ipv6Words('fc00::1')).toEqual([0xfc00, 0, 0, 0, 0, 0, 0, 1]);
    expect(ipv6Words('2001:db8::1')).toEqual([0x2001, 0xdb8, 0, 0, 0, 0, 0, 1]);
    expect(ipv6Words('2001:db8::1.2.3.4')).toEqual([0x2001, 0xdb8, 0, 0, 0, 0, 0x0102, 0x0304]);
    expect(ipv6Words('1.2.3.4')).toBeNull();
    expect(ipv6Words('1:2:3:4:5:6:7:8:9')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// scrapePublicUrl — pré-resolução DNS (mitigação de rebinding)
// ---------------------------------------------------------------------------

describe('scrapePublicUrl — pré-resolução DNS', () => {
  it('bloqueia domínio que resolve para IP privado (fetch NUNCA tentado)', async () => {
    const { fetch, calls } = mkFetch([res200('<html></html>')]);
    const r = await scrapePublicUrl('http://evil.com/', {
      fetchImpl: fetch,
      resolveHost: fakeResolver({ 'evil.com': ['10.0.0.1'] }),
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('forbidden');
    expect(r.errorDetail).toContain('10.0.0.1');
    expect(calls).toHaveLength(0);
  });

  it('bloqueia se QUALQUER endereço resolvido for privado', async () => {
    const { fetch, calls } = mkFetch([res200('x')]);
    const r = await scrapePublicUrl('http://multi.example/', {
      fetchImpl: fetch,
      resolveHost: fakeResolver({ 'multi.example': ['1.2.3.4', '169.254.169.254'] }),
    });
    expect(r).toMatchObject({ ok: false, error: 'forbidden' });
    expect(calls).toHaveLength(0);
  });

  it('permite domínio que resolve para IP público', async () => {
    const { fetch, calls } = mkFetch([res200('<html>ok</html>')]);
    const r = await scrapePublicUrl('http://example.com/', {
      fetchImpl: fetch,
      resolveHost: fakeResolver({ 'example.com': ['93.184.215.14'] }),
    });
    expect(r).toEqual({ ok: true, html: '<html>ok</html>' });
    expect(calls).toEqual(['http://example.com/']);
  });

  it('IP literal não consulta o resolver (fast path)', async () => {
    const { fetch } = mkFetch([res200('<html>ip</html>')]);
    const resolver = jest.fn(async () => {
      throw new Error('resolver não deve ser consultado para IP literal');
    });
    const r = await scrapePublicUrl('http://8.8.8.8/', { fetchImpl: fetch, resolveHost: resolver });
    expect(r).toEqual({ ok: true, html: '<html>ip</html>' });
    expect(resolver).not.toHaveBeenCalled();
  });

  it('resolver que falha → network_error (degradação honesta, sem fetch)', async () => {
    const { fetch, calls } = mkFetch([res200('x')]);
    const r = await scrapePublicUrl('http://example.com/', {
      fetchImpl: fetch,
      resolveHost: async () => {
        throw new Error('DNS down');
      },
    });
    expect(r).toMatchObject({ ok: false, error: 'network_error' });
    expect(r.errorDetail).toContain('DNS');
    expect(calls).toHaveLength(0);
  });

  it('resolver que retorna [] → network_error "DNS sem endereço"', async () => {
    const { fetch, calls } = mkFetch([res200('x')]);
    const r = await scrapePublicUrl('http://example.com/', {
      fetchImpl: fetch,
      resolveHost: fakeResolver({}), // fora do mapa → []
    });
    expect(r).toMatchObject({ ok: false, error: 'network_error' });
    expect(r.errorDetail).toContain('sem endereço');
    expect(calls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// scrapePublicUrl — redirects (manual + revalidação por hop)
// ---------------------------------------------------------------------------

describe('scrapePublicUrl — redirects', () => {
  it('segue redirect público revalidando cada hop', async () => {
    const { fetch, calls } = mkFetch([res302('https://b.example/x'), res200('<html>B</html>')]);
    const r = await scrapePublicUrl('http://a.example/', {
      fetchImpl: fetch,
      resolveHost: fakeResolver({ 'a.example': ['1.1.1.1'], 'b.example': ['2.2.2.2'] }),
    });
    expect(r).toEqual({ ok: true, html: '<html>B</html>' });
    expect(calls).toEqual(['http://a.example/', 'https://b.example/x']);
  });

  it('bloqueia redirect → metadata (169.254.169.254)', async () => {
    const { fetch, calls } = mkFetch([res302('http://169.254.169.254/latest/meta-data/')]);
    const r = await scrapePublicUrl('http://a.example/', {
      fetchImpl: fetch,
      resolveHost: fakeResolver({ 'a.example': ['1.1.1.1'] }),
    });
    expect(r).toMatchObject({ ok: false, error: 'forbidden' });
    expect(calls).toHaveLength(1); // alvo bloqueado nunca é buscado
  });

  it('bloqueia redirect → [::1]', async () => {
    const { fetch, calls } = mkFetch([res302('http://[::1]/')]);
    const r = await scrapePublicUrl('http://a.example/', {
      fetchImpl: fetch,
      resolveHost: fakeResolver({ 'a.example': ['1.1.1.1'] }),
    });
    expect(r).toMatchObject({ ok: false, error: 'forbidden' });
    expect(calls).toHaveLength(1);
  });

  it('bloqueia redirect para esquema não-http (file:)', async () => {
    const { fetch, calls } = mkFetch([res302('file:///etc/passwd')]);
    const r = await scrapePublicUrl('http://a.example/', {
      fetchImpl: fetch,
      resolveHost: fakeResolver({ 'a.example': ['1.1.1.1'] }),
    });
    expect(r).toMatchObject({ ok: false, error: 'forbidden' });
    expect(calls).toHaveLength(1);
  });

  it('bloqueia loop de redirect além do limite', async () => {
    const { fetch, calls } = mkFetch([
      res302('http://a.example/b'),
      res302('http://a.example/c'),
      res302('http://a.example/d'),
      res302('http://a.example/e'),
    ]);
    const r = await scrapePublicUrl('http://a.example/', {
      fetchImpl: fetch,
      resolveHost: fakeResolver({ 'a.example': ['1.1.1.1'] }),
    });
    expect(r).toMatchObject({ ok: false, error: 'forbidden' });
    expect(r.errorDetail).toContain('Limite');
    expect(calls).toHaveLength(4);
  });

  it('Location relativa resolve contra o host atual e é revalidada', async () => {
    const { fetch, calls } = mkFetch([res302('relativo'), res200('<html>r</html>')]);
    const r = await scrapePublicUrl('http://a.example/pagina', {
      fetchImpl: fetch,
      resolveHost: fakeResolver({ 'a.example': ['1.1.1.1'] }),
    });
    expect(r).toEqual({ ok: true, html: '<html>r</html>' });
    expect(calls).toEqual(['http://a.example/pagina', 'http://a.example/relativo']);
  });
});

// ---------------------------------------------------------------------------
// scrapePublicUrl — timeout, tamanho e status
// ---------------------------------------------------------------------------

describe('scrapePublicUrl — timeout / tamanho / status', () => {
  it('AbortError (DOMException) → code "timeout"', async () => {
    const abort = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
    const { fetch } = mkFetch([abort]);
    const r = await scrapePublicUrl('http://8.8.8.8/', { fetchImpl: fetch });
    expect(r).toEqual({ ok: false, error: 'timeout', errorDetail: 'Request timed out' });
  });

  it('rejeição crua "AbortError" → code "timeout"', async () => {
    const abort = new Error('AbortError');
    (abort as { name?: string }).name = 'AbortError';
    const { fetch } = mkFetch([abort]);
    const r = await scrapePublicUrl('http://8.8.8.8/', { fetchImpl: fetch });
    expect(r.error).toBe('timeout');
  });

  it('outro erro de rede → network_error com a mensagem', async () => {
    const { fetch } = mkFetch([new Error('ECONNREFUSED')]);
    const r = await scrapePublicUrl('http://8.8.8.8/', { fetchImpl: fetch });
    expect(r).toMatchObject({ ok: false, error: 'network_error', errorDetail: 'ECONNREFUSED' });
  });

  it('corpo acima de maxBytes → too_large', async () => {
    const { fetch } = mkFetch([res200('x'.repeat(5000))]);
    const r = await scrapePublicUrl('http://8.8.8.8/', { fetchImpl: fetch, maxBytes: 100 });
    expect(r).toMatchObject({ ok: false, error: 'too_large' });
  });

  it('HTTP não-2xx → network_error com o status', async () => {
    const { fetch } = mkFetch([new Response('nf', { status: 404 })]);
    const r = await scrapePublicUrl('http://8.8.8.8/', { fetchImpl: fetch });
    expect(r).toMatchObject({ ok: false, error: 'network_error', errorDetail: 'HTTP 404' });
  });
});
