import fs from 'node:fs';
const f = 'app/api/integrations/openbsp/refresh-token/route.ts';
let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
lines = lines.filter((l) => !l.includes('createServiceRoleClient'));
lines = lines.map((l) => l.includes('import prisma from "@/lib/prisma"') ? 'import { prisma } from "@/lib/prisma";' : l);
const pi = lines.findIndex((l) => l.includes('from "@/lib/prisma"'));
if (pi < 0) { console.log('import prisma nao encontrado'); process.exit(1); }
lines.splice(pi + 1, 0, 'import { encryptToken } from "@/lib/encryption";');
const start = lines.findIndex((l) => l.includes('// 6) atualizar'));
const okIdx = lines.findIndex((l) => l.includes('{ ok: true, tokenId'));
if (start < 0 || okIdx < 0) { console.log('ancoras nao encontradas'); process.exit(1); }
const retIdx = okIdx - 1;
if (!lines[retIdx].includes('return NextResponse.json(')) { console.log('linha de return inesperada: ' + lines[retIdx]); process.exit(1); }
const block = [
  '  // 6) renovar access_token em cache (OpenBSP renova automaticamente)',
  '  const accessTokenEnc = encryptToken(address.extra.access_token);',
  '',
  '  try {',
  '    await prisma.whatsappChannel.update({',
  '      where: { id: channel.id },',
  '      data: {',
  '        status: "CONNECTED",',
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
  '    console.error("[openbsp-refresh] erro ao atualizar:", (e as Error).message);',
  '    return NextResponse.json({ error: "db_error" }, { status: 500 });',
  '  }',
  '',
];
lines.splice(start, retIdx - start, ...block);
fs.writeFileSync(f, lines.join('\n'));
console.log('patch aplicado');
