const fs = require('fs');
const https = require('https');
const http = require('http');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const text = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
  const env = {};
  text.split('\n').forEach(l => {
    const m = l.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].split(' #')[0].trim();
  });
  return env;
}

const env = Object.assign({}, loadEnvFile('C:/Users/Bruno/.claude/Revolution/X/.env'), loadEnvFile('C:/Users/Bruno/.claude/Revolution/X/.env.local'));
const appId = env.APP_ID || env.META_APP_ID;
const appSecret = env.APP_SECRET || env.META_APP_SECRET;
const accessToken = env.ACCESS_TOKEN || env.SYSTEM_USER_TOKEN;
const adAccountId = env.AD_ACCOUNT_ID ? env.AD_ACCOUNT_ID.split('#')[0].trim() : null;
const n8nKey = env.N8N_API_KEY;

const output = [];
output.push('=== ENV CHECK ===');
output.push('APP_ID: ' + appId);
output.push('APP_SECRET: ' + (appSecret ? appSecret.substring(0,8)+'...' : 'MISSING'));
output.push('AD_ACCOUNT_ID: ' + adAccountId);
output.push('N8N_API_KEY: ' + (n8nKey ? n8nKey.substring(0,8)+'...' : 'MISSING'));
output.push('ACCESS_TOKEN: ' + (accessToken ? accessToken.substring(0,30)+'...' : 'MISSING'));
output.push('');

// 1.1 Get App Access Token
const tokenUrl = `https://graph.facebook.com/v26.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&grant_type=client_credentials`;
output.push('=== 1.1 GET APP ACCESS TOKEN ===');
https.get(tokenUrl, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    output.push('STATUS: ' + res.statusCode);
    output.push('TOKEN: ' + data.substring(0,100));
    try {
      const tok = JSON.parse(data);
      const appToken = tok.access_token;
      output.push('');

      // 1.2 Get Roles
      output.push('=== 1.2 GET ROLES ===');
      const rolesUrl = `https://graph.facebook.com/v26.0/${appId}/roles?access_token=${appToken}`;
      https.get(rolesUrl, res2 => {
        let d2 = '';
        res2.on('data', c => d2 += c);
        res2.on('end', () => {
          output.push('STATUS: ' + res2.statusCode);
          output.push('RESPONSE: ' + d2);
          output.push('');

          // 1.4 Get Ad Account
          output.push('=== 1.4 GET AD ACCOUNT ===');
          if (adAccountId) {
            const acctUrl = `https://graph.facebook.com/v26.0/act_${adAccountId}?fields=id,name,account_status&access_token=${appToken}`;
            https.get(acctUrl, res3 => {
              let d3 = '';
              res3.on('data', c => d3 += c);
              res3.on('end', () => {
                output.push('STATUS: ' + res3.statusCode);
                output.push('RESPONSE: ' + d3);
                output.push('');

                // 2.1 N8N Workflows
                output.push('=== 2.1 N8N WORKFLOWS ===');
                if (n8nKey) {
                  const n8nUrl = 'http://localhost:5678/api/v1/workflows';
                  http.get(n8nUrl, { headers: { 'X-N8N-API-KEY': n8nKey } }, res4 => {
                    let d4 = '';
                    res4.on('data', c => d4 += c);
                    res4.on('end', () => {
                      output.push('STATUS: ' + res4.statusCode);
                      output.push('RESPONSE: ' + d4.substring(0, 500));
                      output.push('');

                      // 3.1 Chrome CDP
                      output.push('=== 3.1 CHROME CDP ===');
                      http.get('http://127.0.0.1:9222/json/version', res5 => {
                        let d5 = '';
                        res5.on('data', c => d5 += c);
                        res5.on('end', () => {
                          output.push('STATUS: ' + res5.statusCode);
                          output.push('RESPONSE: ' + d5);

                          // Write output
                          fs.writeFileSync('C:/Users/Bruno/.claude/Revolution/X/check_results.txt', output.join('\n'));
                          console.log('DONE - check_results.txt written');
                        });
                      }).on('error', e => output.push('CDP ERROR: ' + e.message));
                    });
                  }).on('error', e => output.push('N8N ERROR: ' + e.message));
                } else {
                  output.push('N8N_API_KEY missing');
                }
              });
            }).on('error', e => output.push('ACCT ERROR: ' + e.message));
          } else {
            output.push('AD_ACCOUNT_ID missing');
          }
        });
      }).on('error', e => output.push('ROLES ERROR: ' + e.message));
    } catch(e) {
      output.push('PARSE ERROR: ' + e.message);
      fs.writeFileSync('C:/Users/Bruno/.claude/Revolution/X/check_results.txt', output.join('\n'));
    }
  });
}).on('error', e => output.push('TOKEN ERROR: ' + e.message) && fs.writeFileSync('C:/Users/Bruno/.claude/Revolution/X/check_results.txt', output.join('\n')));
