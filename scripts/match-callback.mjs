import fs from 'node:fs';
const f = 'src/integrations/whatsapp/openbsp/client.ts';
let s = fs.readFileSync(f, 'utf8');

const alvoSig = '  opts: ProviderCallOpts = {},\n): Promise<OpenbspResult<OpenbspAddressRow>> {';
if (!s.includes(alvoSig)) { console.log('assinatura nao encontrada'); process.exit(1); }
s = s.replace(alvoSig, '  opts: ProviderCallOpts = {},\n  expectedCallbackUrl?: string,\n): Promise<OpenbspResult<OpenbspAddressRow>> {');

const alvoHit = `      const hit = conectados.find(
        (r) => (r.extra as Record<string, unknown> | null)?.verify_token === expectedVerifyToken,
      );`;
if (!s.includes(alvoHit)) { console.log('bloco hit nao encontrado'); process.exit(1); }
s = s.replace(alvoHit, `      const porToken = conectados.find(
        (r) => (r.extra as Record<string, unknown> | null)?.verify_token === expectedVerifyToken,
      );
      // O verify_token muda a cada connect; o callback_url da org nao.
      const porCallback = expectedCallbackUrl
        ? conectados.find(
            (r) => (r.extra as Record<string, unknown> | null)?.callback_url === expectedCallbackUrl,
          )
        : undefined;
      const hit = porToken ?? porCallback;`);

fs.writeFileSync(f, s);
console.log('casamento por callback_url adicionado');