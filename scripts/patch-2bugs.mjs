import fs from 'node:fs';

// refresh-token: usar verifyToken para o match
const rf = 'app/api/integrations/openbsp/refresh-token/route.ts';
let R = fs.readFileSync(rf, 'utf8').split(/\r?\n/);
const t = R.findIndex((l) => l.includes('const tokenId = channel.onboardingTokenId;'));
if (t < 0) { console.log('tokenId nao encontrado'); process.exit(1); }
R[t] = '  const tokenId = channel.verifyToken;';
const okR = R.findIndex((l) => l.includes('{ ok: true, tokenId'));
if (okR < 0) { console.log('return ok nao encontrado'); process.exit(1); }
R[okR] = R[okR].replace('tokenId,', 'tokenId: channel.onboardingTokenId ?? tokenId,');
fs.writeFileSync(rf, R.join('\n'));
console.log('refresh ajustado');

// status: so CONNECTED quando status for CONNECTED, e expor o numero
const sf = 'app/api/integrations/status/route.ts';
let S = fs.readFileSync(sf, 'utf8').split(/\r?\n/);
const a = S.findIndex((l) => l.includes("if (provider === 'openbsp' && phoneNumberId) {"));
const b = S.findIndex((l) => l.includes("connStatus = 'DISCONNECTED';"));
if (a < 0 || b < 0) { console.log('bloco de status nao encontrado'); process.exit(1); }
S.splice(a, b + 2 - a,
  "        if (provider === 'openbsp' && status === 'CONNECTED' && phoneNumberId) {",
  '          mode = \'OFFICIAL\';',
  "          connStatus = 'CONNECTED';",
  '          phoneNumber = (r.phone_number as string | null) ?? phoneNumberId;',
  "        } else if (provider === 'openbsp' && status === 'PENDING') {",
  '          mode = \'OFFICIAL\';',
  "          connStatus = 'PENDING';",
  '        } else {',
  '          mode = \'OFFICIAL\';',
  "          connStatus = 'DISCONNECTED';",
  '        }',
);
const c = S.findIndex((l) => l.includes('connected: integrations.length > 0,'));
if (c < 0) { console.log('flag connected nao encontrada'); process.exit(1); }
S[c] = "      connected: integrations.some((i) => i.status === 'CONNECTED'),";
fs.writeFileSync(sf, S.join('\n'));
console.log('status ajustado');
