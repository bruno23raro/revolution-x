import fs from 'node:fs';
const f = 'src/integrations/whatsapp/openbsp/client.ts';
let L = fs.readFileSync(f, 'utf8').split(/\r?\n/);
const hits = L.map((l, i) => (l.includes("headers: { apikey: cfg.publishableKey, 'api-key': cfg.apiKey },") ? i : -1)).filter((i) => i >= 0);
if (hits.length !== 1) { console.log('ocorrencias inesperadas: ' + hits.length); process.exit(1); }
L.splice(hits[0], 0, "      cache: 'no-store',");
fs.writeFileSync(f, L.join('\n'));
console.log('cache no-store aplicado');
