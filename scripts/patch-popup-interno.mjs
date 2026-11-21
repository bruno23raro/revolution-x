import fs from 'node:fs';
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
if (s.includes('/whatsapp/conectar')) { console.log('ja aponta para a pagina interna'); process.exit(0); }

const base = "(process.env.NEXT_PUBLIC_APP_URL ?? 'https://revolutionx.com.br')";
const alvo = /https:\/\/web\.openbsp\.dev\/onboard\/whatsapp\/\$\{\s*([^}]+?)\s*\}/;

if (alvo.test(s)) {
  s = s.replace(alvo, '`${' + base + '}/whatsapp/conectar?token=${$1}`');
} else {
  const lines = s.split(/\r?\n/);
  const i = lines.findIndex((l) => l.includes('popupUrl'));
  if (i < 0) {
    console.log('nem URL do openbsp nem popupUrl encontrados. Arquivo:');
    console.log(lines.slice(0, 45).join('\n'));
    process.exit(1);
  }
  console.log('linha: ' + lines[i].trim());
  const m = lines[i].match(/popupUrl:\s*(.+?),?$/);
  if (!m) { console.log('formato inesperado'); process.exit(1); }
  const v = m[1].replace(/,$/, '');
  lines[i] = lines[i].replace(m[1], '`${' + base + '}/whatsapp/conectar?token=${' + v + '}`');
  s = lines.join('\n');
}

fs.writeFileSync(f, s);
console.log('ok');
