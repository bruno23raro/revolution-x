import fs from 'node:fs';
const f = 'app/api/integrations/openbsp/connect/route.ts';
const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
const i = lines.findIndex((l) => l.includes('NextResponse.json({ popupUrl'));
if (i < 0) { console.log('linha do json nao encontrada'); process.exit(1); }
console.log('antes: ' + lines[i].trim());
lines[i] = "  return NextResponse.json({ popupUrl: mint.popupUrl, internalPopupUrl: `${(process.env.NEXT_PUBLIC_APP_URL ?? 'https://revolutionx.com.br')}/whatsapp/conectar?token=${mint.tokenId}`, tokenId: mint.tokenId, mode });";
fs.writeFileSync(f, lines.join('\n'));
console.log('depois: ' + lines[i].trim());