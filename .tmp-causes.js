const fs = require('fs');
const path = require('path');
const o = require('./.tmp-fail.json');

// classify by reading the test file's auth mock vs the route's auth import
const authCache = new Map();
function authMock(file) {
  if (authCache.has(file)) return authCache.get(file);
  let txt = '';
  try { txt = fs.readFileSync(file, 'utf8'); } catch { authCache.set(file, null); return null; }
  const m = txt.match(/jest\.mock\(['"]@\/lib\/auth['"],\s*\(\)\s*=>\s*\(\{([\s\S]*?)\}\)/);
  const keys = m ? [...m[1].matchAll(/(\w+)\s*:/g)].map((x) => x[1]) : [];
  authCache.set(file, keys);
  return keys;
}

const groups = {};
for (const x of o) {
  let cause = x.c;
  const msg = x.m;
  if (/campaignService_1\.(escapeForMessage|canTransition|interpolateVars|selectAudience|runCampaignBatch|buildRecipients|isWhatsAppChannel)/.test(msg))
    cause = 'A_mock_global_campaignService_incompleto';
  else if (/auth_1\.(getAuth|getAuthenticatedUser|getAllOrganizationMemberships) is not a function/.test(msg))
    cause = 'B_mock_auth_export_errado';
  else if (/Cannot destructure property 'user'/.test(msg))
    cause = 'B_mock_auth_retorno_nulo';
  else if (/relação .* não existe/.test(msg))
    cause = 'C_banco_sem_tabela_Integration';
  else if (/expected .* toBe|expect\(received\)|toHaveBeenCalledWith/.test(msg))
    cause = 'D_assert_comportamento';
  groups[cause] = (groups[cause] || 0) + 1;
}

console.log('=== 111 falhas por causa raiz ===');
for (const k of Object.keys(groups).sort((a, b) => groups[b] - groups[a])) {
  console.log(String(groups[k]).padStart(4) + '  ' + k);
}

console.log('\n=== mocks de auth divergentes (arquivo de teste) ===');
const seen = new Set();
for (const x of o) {
  if (seen.has(x.f)) continue;
  seen.add(x.f);
  const keys = authMock(x.f);
  if (keys && keys.length) console.log('  ' + x.f + '  -> mocka: ' + keys.join(', '));
}
