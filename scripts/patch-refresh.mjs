import fs from 'node:fs';
const f = 'app/api/integrations/openbsp/refresh-token/route.ts';
let L = fs.readFileSync(f, 'utf8').split(/\r?\n/);
const find = (s, from = 0) => L.findIndex((l, i) => i >= from && l.includes(s));
const need = (i, tag) => { if (i < 0) { console.log('ancora nao encontrada: ' + tag); process.exit(1); } };

// 6) escrita
const wS = find('// 6) atualizar');
need(wS, 'write-start');
const wRet = find("error: 'db_error'", wS);
need(wRet, 'write-return');
const wE = wRet + 1;
if (!L[wE].trim().startsWith('}')) { console.log('fim de escrita inesperado: ' + L[wE]); process.exit(1); }
L.splice(wS, wE - wS + 1,
  '  // 6) renovar access_token em cache (OpenBSP renova automaticamente)',
  '  const accessTokenEnc = encryptToken(address.extra.access_token);',
  '',
  '  try {',
  '    await prisma.whatsappChannel.update({',
  '      where: { id: channel.id },',
  '      data: {',
  "        status: 'CONNECTED',",
  '        wabaId: address.extra.waba_id ?? null,',
  '        phoneNumberId: address.address,',
  '        phoneNumber: address.extra.phone_number ?? null,',
  '        verifiedName: address.extra.verified_name ?? null,',
  '        accessTokenEnc,',
  '        lastError: null,',
  '        updatedAt: new Date(),',
  '      },',
  '    });',
  '  } catch (e) {',
  "    console.error('[openbsp-refresh] erro ao atualizar:', (e as Error).message);",
  "    return NextResponse.json({ error: 'db_error' }, { status: 500 });",
  '  }',
);

// tokenId
const tI = find('integration.meta?.openbsp_onboarding_token_id');
need(tI, 'tokenId');
L.splice(tI, 1, '  const tokenId = channel.onboardingTokenId;');

// expiracao local (nao existe expires_at no canal)
const eS = find('// 3) verificar se o token ja expirou localmente') >= 0
  ? find('// 3) verificar se o token ja expirou localmente')
  : find('// 3) verificar se o token');
need(eS, 'exp-start');
const eExp = find('onboarding expirou', eS);
need(eExp, 'exp-return');
L.splice(eS, eExp + 2 - eS + 1);

// cast do objeto integration
const cS = find('const integration = integrations[0] as {');
need(cS, 'cast-start');
const cE = find('};', cS);
need(cE, 'cast-end');
L.splice(cS, cE - cS + 1);

// consulta do canal
const qS = find('// 2) buscar canal conectado');
need(qS, 'query-start');
const qRet = find("error: 'not_connected' }, { status: 409 });", qS);
need(qRet, 'query-return');
const qE = qRet + 1;
if (!L[qE].trim().startsWith('}')) { console.log('fim de guarda inesperado: ' + L[qE]); process.exit(1); }
L.splice(qS, qE - qS + 1,
  '  // 2) buscar canal do tenant',
  '  const channel = await prisma.whatsappChannel.findFirst({',
  '    where: {',
  '      organizationId: user.organizationId,',
  "      status: 'CONNECTED',",
  "      provider: 'openbsp',",
  '    },',
  '    select: { id: true, verifyToken: true, onboardingTokenId: true },',
  '  });',
  '',
  '  if (!channel) {',
  "    return NextResponse.json({ error: 'not_connected' }, { status: 409 });",
  '  }',
);

// imports
const authI = find("from '@/lib/auth'");
need(authI, 'auth-import');
L.splice(authI + 1, 0, "import { prisma } from '@/lib/prisma';", "import { encryptToken } from '@/lib/encryption';");
const svcI = find('createServiceRoleClient');
if (svcI >= 0) L.splice(svcI, 1);

fs.writeFileSync(f, L.join('\n'));
console.log('patch aplicado');
