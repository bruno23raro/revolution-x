import fs from 'node:fs';
const f = 'app/whatsapp/page.tsx';
let s = fs.readFileSync(f, 'utf8');
const antes = s;
s = s.split('/api/integrations/whatsapp-official/status').join('/api/integrations/openbsp/status');
if (s !== antes) fs.writeFileSync(f, s);
console.log(s !== antes ? 'pagina ajustada' : 'pagina ja usava openbsp');