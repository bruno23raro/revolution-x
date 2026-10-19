// src/integrations/publicScraper.ts

export interface ScrapeOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
}

export interface ScrapeResult {
  ok: boolean;
  html?: string;
  error?: 'invalid_url' | 'forbidden' | 'timeout' | 'network_error' | 'too_large';
  errorDetail?: string;
}

export function isSafePublicUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return false;

    // Basic Private IP Check (simplified)
    const ip = u.hostname.replace(/^\[|\]$/g, '');
    // Check for common private / link-local / cloud-metadata IP ranges
    if (
      ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      ip.startsWith('127.') ||
      (ip.startsWith('172.') &&
        parseInt(ip.split('.')[1]) >= 16 &&
        parseInt(ip.split('.')[1]) <= 31) ||
      ip.startsWith('169.254.') ||
      ip.startsWith('100.64.') ||
      ip === '0.0.0.0' ||
      ip === '::1'
    ) return false;

    // Restrict internal/metadata domains
    if (
        u.hostname.endsWith('.internal') ||
        u.hostname === 'metadata.google.internal'
    ) return false;

    return true;
  } catch {
    return false;
  }
}

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

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetchImpl(url, { signal: ctrl.signal });
    if (!res.ok) return { ok: false, error: 'network_error', errorDetail: `HTTP ${res.status}` };

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > maxBytes) {
      return { ok: false, error: 'too_large', errorDetail: `Response exceeds ${maxBytes} bytes` };
    }

    const html = new TextDecoder().decode(buffer);
    return { ok: true, html };

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'AbortError') return { ok: false, error: 'timeout', errorDetail: 'Request timed out' };
    return { ok: false, error: 'network_error', errorDetail: msg };
  } finally {
    clearTimeout(timer);
  }
}
