import fs from 'node:fs';
const f = 'app/api/whatsapp/templates/route.ts';
let s = fs.readFileSync(f, 'utf8');

s = s.split("import { openbspConfig, createTemplate } from '@/integrations/whatsapp/openbsp/client';")
     .join("import { openbspConfig, createTemplate, listTemplates } from '@/integrations/whatsapp/openbsp/client';");

const marca = 'export async function GET(req: NextRequest) {';
const ini = s.indexOf(marca);
if (ini < 0) { console.log('GET nao encontrado'); process.exit(1); }

let i = ini;
let prof = 0;
let fim = -1;
for (; i < s.length; i++) {
  const c = s[i];
  if (c === '{') prof++;
  else if (c === '}') {
    prof--;
    if (prof === 0) { fim = i + 1; break; }
  }
}
if (fim < 0) { console.log('fechamento do GET nao encontrado'); process.exit(1); }

const novo = `export async function GET(req: NextRequest) {
  const { user, hasSession } = await getAuth(req);
  if (!hasSession || !user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const channel = await getChannelDecrypted(user.organizationId);
  if (!channel || !channel.isOpenBSPConnected || !channel.phoneNumberId) {
    return NextResponse.json(
      { ok: false, error: 'channel_unavailable', detail: 'WhatsApp nao conectado via OpenBSP' },
      { status: 409 },
    );
  }

  const localTemplates = await listTemplateRows(user.organizationId);
  const cfg = openbspConfig();
  if (!cfg) {
    return NextResponse.json({ ok: true, templates: localTemplates, origem: 'local' });
  }

  // O provedor e a fonte da verdade: e ele quem carrega o status da Meta.
  const remoto = await listTemplates(cfg, user.organizationId, channel.phoneNumberId);

  if (!remoto.ok || !Array.isArray(remoto.data)) {
    return NextResponse.json({ ok: true, templates: localTemplates, origem: 'local', detail: remoto.errorDetail ?? null });
  }

  for (const t of remoto.data) {
    const status = typeof t.status === 'string' ? t.status.toUpperCase() : null;
    if (!status) continue;
    await prisma.whatsappTemplate.updateMany({
      where: { organizationId: user.organizationId, name: t.name, language: t.language },
      data: { status, lastCheckedAt: new Date() },
    });
  }

  const atualizados = await listTemplateRows(user.organizationId);
  return NextResponse.json({ ok: true, templates: atualizados, origem: 'provedor' });
}`;

s = s.slice(0, ini) + novo + s.slice(fim);
fs.writeFileSync(f, s);
console.log('GET trocado com contagem de chaves');