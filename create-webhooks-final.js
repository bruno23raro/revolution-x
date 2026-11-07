const https = require('https');

// Webhook URLs configurados
const WEBHOOK_URLS = {
  messages: 'https://revolutionx.com.br/api/webhooks/openbsp/messages',
  accounts: 'https://revolutionx.com.br/api/webhooks/openbsp/accounts',
};

// Token compartilhado entre todos os webhooks
const WEBHOOK_TOKEN = 'revolutionx_webhook_2026';

// Organization ID do OpenBSP
const ORGANIZATION_ID = '9d7114cd-013e-4e03-b91d-848518bf6514';

// Headers com service_role key (necessário para RLS bypass)
// Ajuste estes valores com as chaves corretas do seu projeto prod
const HEADERS = {
  'apikey': 'sb_publishable_jS_LQSbttNz2nRyAcjOVUw_J1KpXhUd',
  'api-key': 'sk_dcca9cc0057142ce95bba1e051b01699',
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

function createWebhook(tableName, url) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      table_name: tableName,
      operations: ['insert', 'update'],
      url: url,
      token: WEBHOOK_TOKEN,
      organization_id: ORGANIZATION_ID,
    });

    const options = {
      hostname: 'nheelwshzbgenpavwhcy.supabase.co',
      path: '/rest/v1/webhooks',
      method: 'POST',
      headers: {
        ...HEADERS,
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
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
  console.log('Creating 2 webhooks (OpenBSP limit)...\n');

  // Webhook 1: messages - processa mensagens, status E CONTATOS
  console.log('1. Creating "messages" webhook...');
  await createWebhook('messages', WEBHOOK_URLS.messages);
  console.log('   -> Processa: mensagens recebidas, status de envio, CONTATOS\n');

  // Webhook 2: accounts - processa eventos de conexão/desconexão de contas WhatsApp
  console.log('2. Creating "accounts" webhook...');
  await createWebhook('accounts', WEBHOOK_URLS.accounts);
  console.log('   -> Processa: status da conta WhatsApp (conexão/desconexão)\n');

  console.log('\n✅ Webhooks criados com sucesso!');
  console.log('\nResumo:');
  console.log('  - messages: POST /api/webhooks/openbsp/messages');
  console.log('    -> Insere em: inbound_messages, message_status, crm_contacts');
  console.log('  - accounts: POST /api/webhooks/openbsp/accounts');
  console.log('    -> Upserts em: whatsapp_channels');
}

main().catch(console.error);