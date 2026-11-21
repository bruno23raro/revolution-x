import fs from 'node:fs';
const f = 'src/integrations/whatsapp/openbsp/client.ts';
let s = fs.readFileSync(f, 'utf8');
const ini = s.indexOf('export async function fetchConnectedAddress(');
if (ini < 0) { console.log('funcao nao encontrada'); process.exit(1); }
const fim = s.indexOf('\n}\n', ini);
if (fim < 0) { console.log('fim da funcao nao encontrado'); process.exit(1); }

const novo = `export async function fetchConnectedAddress(
  expectedVerifyToken: string,
  opts: ProviderCallOpts = {},
): Promise<OpenbspResult<OpenbspAddressRow>> {
  const cfg = openbspConfig();
  if (!cfg) return { ok: false, error: 'openbsp_not_configured' };
  const fetchImpl = resolveFetch(opts);
  if (!fetchImpl) return { ok: false, error: 'fetch_unavailable' };

  const base = cfg.base.replace(/\/+$/, '');
  const orgEnv = (process.env.OPENBSP_ORG_ID ?? '').trim();
  const org = orgEnv ? \`&organization_id=eq.\${orgEnv}\` : '';

  // organizations_addresses nao tem created_at nem verify_token como coluna:
  // sem order, e o verify_token e casado em memoria dentro de extra.
  const tentativas = [
    \`\${base}/organizations_addresses?service=eq.whatsapp&status=eq.connected\${org}&select=address,extra\`,
    \`\${base}/organizations_addresses?service=eq.whatsapp&status=eq.connected\${org}\`,
    \`\${base}/organizations_addresses?select=address,extra,status\${org}&limit=200\`,
  ];

  let ultimoErro = 'provider_error';
  let ultimoDetalhe = '';

  for (const url of tentativas) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? OPENBSP_TIMEOUT_MS);
    if (opts.signal) {
      if (opts.signal.aborted) ctrl.abort();
      else opts.signal.addEventListener('abort', () => ctrl.abort(), { once: true });
    }

    try {
      const res = await fetchImpl(url, {
        signal: ctrl.signal,
        cache: 'no-store',
        headers: { apikey: cfg.publishableKey, 'api-key': cfg.apiKey },
      });
      const text = await res.text().catch(() => '');

      if (!res.ok) {
        ultimoErro = 'http_error';
        ultimoDetalhe = text.slice(0, 500);
        continue;
      }

      let rows: OpenbspAddressRow[] = [];
      try {
        rows = JSON.parse(text) as OpenbspAddressRow[];
      } catch {
        ultimoErro = 'provider_error';
        ultimoDetalhe = 'JSON invalido';
        continue;
      }

      const conectados = rows.filter((r) => {
        const st = (r as { status?: string }).status;
        return st === undefined || st === 'connected';
      });

      const hit = conectados.find(
        (r) => (r.extra as Record<string, unknown> | null)?.verify_token === expectedVerifyToken,
      );

      if (hit) return { ok: true, data: hit };

      ultimoErro = 'provider_error';
      ultimoDetalhe = 'sem linha conectada p/ este verify_token';
    } catch (e) {
      ultimoErro = 'network_error';
      ultimoDetalhe = String((e as Error)?.message ?? e);
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, error: ultimoErro, errorDetail: ultimoDetalhe };
}
`;
s = s.slice(0, ini) + novo + s.slice(fim + 3);
fs.writeFileSync(f, s);
console.log('fetchConnectedAddress reescrita');