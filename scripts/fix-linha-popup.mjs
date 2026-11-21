import fs from 'node:fs';
const f = process.argv[2];
const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
const i = lines.findIndex((l) => l.includes('NextResponse.json({ popupUrl'));
if (i < 0) { console.log('linha do json nao encontrada'); process.exit(1); }
console.log('antes: ' + lines[i].trim());
lines[i] = '  return NextResponse.json({ popupUrl: `${(process.env.NEXT_PUBLIC_APP_URL ?? \'https://revolutionx.com.br\')}/whatsapp/conectar?token=${mint.tokenId}`, openbspPopupUrl: mint.popupUrl, tokenId: mint.tokenId, mode });';
fs.writeFileSync(f, lines.join('\n'));
console.log('depois: ' + lines[i].trim());
