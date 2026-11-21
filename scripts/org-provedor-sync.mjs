import fs from 'node:fs';
for (const f of ['app/api/whatsapp/templates/[id]/sync/route.ts', 'app/api/whatsapp/templates/[id]/test/route.ts']) {
  if (!fs.existsSync(f)) continue;
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('ORG_BSP')) {
    s = s.replace(
      "export const dynamic = 'force-dynamic';",
      "export const dynamic = 'force-dynamic';\n\nconst ORG_BSP = (process.env.OPENBSP_ORG_ID ?? '').trim();",
    );
  }
  s = s.split('getTemplateStatus(cfg, ').join('getTemplateStatus(cfg, ORG_BSP, ');
  fs.writeFileSync(f, s);
  console.log('ajustado: ' + f);
}