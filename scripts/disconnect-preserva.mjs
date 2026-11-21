import fs from 'node:fs';
for (const f of ['app/api/integrations/whatsapp-official/disconnect/route.ts', 'app/api/integrations/disconnect/route.ts']) {
  if (!fs.existsSync(f)) continue;
  let s = fs.readFileSync(f, 'utf8');
  s = s.replace(/accessTokenEnc: null,/g, "accessTokenEnc: null,\n      provider: 'openbsp',");
  s = s.replace(/access_token_enc: null,/g, "access_token_enc: null,");
  fs.writeFileSync(f, s);
  console.log('ajustado: ' + f);
}