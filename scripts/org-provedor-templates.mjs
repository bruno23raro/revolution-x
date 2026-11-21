import fs from 'node:fs';
const f = 'app/api/whatsapp/templates/route.ts';
let s = fs.readFileSync(f, 'utf8');
if (!s.includes('ORG_BSP')) {
  s = s.replace(
    "export const dynamic = 'force-dynamic';",
    "export const dynamic = 'force-dynamic';\n\nconst ORG_BSP = (process.env.OPENBSP_ORG_ID ?? '').trim();",
  );
}
for (const fn of ['listTemplates', 'createTemplate', 'editTemplate', 'deleteTemplate']) {
  s = s.split(`${fn}(cfg, user.organizationId,`).join(`${fn}(cfg, ORG_BSP || user.organizationId,`);
}
fs.writeFileSync(f, s);
console.log('templates: org do provedor aplicado');