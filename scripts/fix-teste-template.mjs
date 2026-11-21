import fs from 'node:fs';
const f = 'app/api/whatsapp/templates/[id]/test/route.ts';
let s = fs.readFileSync(f, 'utf8');

const alvo = `  const r = await sendTemplateViaOpenBSP(channel, to, {
    name: template.name,
    language: body.language ?? template.language,
    variables: body.variables ?? [],
  });`;
if (!s.includes(alvo)) { console.log('bloco de envio nao encontrado'); process.exit(1); }
s = s.replace(alvo, `  const r = await sendTemplateViaOpenBSP(
    channel,
    to,
    template.name,
    body.language ?? template.language,
    body.variables ?? [],
  );`);

s = s.replace("detail: r.detail ?? null", "details: r.details ?? null");
fs.writeFileSync(f, s);
console.log('teste ajustado para a assinatura posicional');