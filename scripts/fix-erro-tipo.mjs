import fs from 'node:fs';
const f = 'src/integrations/whatsapp/openbsp/client.ts';
const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
const i = lines.findIndex((l) => l.includes("let ultimoErro = 'provider_error'"));
if (i < 0) { console.log('linha do ultimoErro nao encontrada'); process.exit(1); }
lines[i] = "  let ultimoErro: OpenbspError | 'provider_error' = 'provider_error';";
fs.writeFileSync(f, lines.join('\n'));
console.log('tipado: ' + lines[i]);