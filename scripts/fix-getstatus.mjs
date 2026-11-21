import fs from 'node:fs';
for (const f of ['app/api/whatsapp/templates/[id]/sync/route.ts', 'app/api/whatsapp/templates/[id]/test/route.ts']) {
  if (!fs.existsSync(f)) continue;
  let s = fs.readFileSync(f, 'utf8');
  s = s.split('getTemplateStatus(cfg, ORG_BSP, ').join('getTemplateStatus(cfg, ');
  fs.writeFileSync(f, s);
  console.log('revertido: ' + f);
}