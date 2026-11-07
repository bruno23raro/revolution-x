const https = require('https');

async function createWebhook(tableName, url) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      table_name: tableName,
      operations: ['insert', 'update'],
      url: url,
      token: 'revolutionx_webhook_2026'
    });

    const options = {
      hostname: 'nheelwshzbgenpavwhcy.supabase.co',
      path: '/rest/v1/webhooks',
      method: 'POST',
      headers: {
        'apikey': 'sb_publishable_jS_LQSbttNz2nRyAcjOVUw_J1KpXhUd',
        'api-key': 'sk_dcca9cc0057142ce95bba1e051b01699',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log(`${tableName}: ${res.statusCode} ${body}`);
        resolve({ status: res.statusCode, body });
      });
    });

    req.on('error', (e) => reject(e));
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('Creating webhooks...');
  await createWebhook('messages', 'https://revolutionx.com.br/api/webhooks/openbsp/messages');
  await createWebhook('accounts', 'https://revolutionx.com.br/api/webhooks/openbsp/accounts');
  await createWebhook('contacts', 'https://revolutionx.com.br/api/webhooks/openbsp/contacts');
  console.log('\nDone!');
}

main().catch(console.error);
