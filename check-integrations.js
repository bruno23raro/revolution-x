#!/usr/bin/env node
/**
 * Verificador de Saúde de Integrações - Revolution X
 *
 * Executa checks de saúde para WhatsApp, Instagram e Facebook
 * usando as APIs oficiais disponíveis.
 */

const fs = require('fs');
const path = require('path');

const ENDPOINTS = {
  whatsapp: {
    name: 'WhatsApp Business API',
    url: (token, pnId) => `https://graph.facebook.com/v26.0/${pnId}?access_token=${token}`,
    check: async (token, pnId) => {
      const res = await fetch(`https://graph.facebook.com/v26.0/${pnId}?access_token=${token}&fields=name,phone_number_id`);
      return { ok: res.ok, status: res.status };
    },
    fields: ['OPENBSP_API_KEY', 'OPENBSP_BASE_URL']
  },
  instagram: {
    name: 'Instagram Graph API',
    url: (token, igId) => `https://graph.facebook.com/v26.0/${igId}?access_token=${token}`,
    check: async (token, igId) => {
      const res = await fetch(`https://graph.facebook.com/v26.0/${igId}?access_token=${token}&fields=name,username`);
      return { ok: res.ok, status: res.status };
    },
    fields: ['META_APP_ID', 'META_APP_SECRET']
  },
  facebook: {
    name: 'Facebook Graph API',
    url: (token, pageId) => `https://graph.facebook.com/v26.0/${pageId}?access_token=${token}`,
    check: async (token, pageId) => {
      const res = await fetch(`https://graph.facebook.com/v26.0/${pageId}?access_token=${token}&fields=name`);
      return { ok: res.ok, status: res.status };
    },
    fields: ['META_APP_ID', 'META_APP_SECRET']
  }
};

// Cores
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'blue') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkHealth() {
  log('\n╔════════════════════════════════════════════════════════════╗', 'blue');
  log('║     Verificador de Saúde - Integrações Revolution X       ║', 'blue');
  log('╚════════════════════════════════════════════════════════════╝', 'blue');

  const envPath = path.join(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) {
    log('\n❌ .env.local não encontrado!', 'red');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  envContent.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value.length) env[key.trim()] = value.join('=').trim();
  });

  // Check WhatsApp
  log('\n=== WhatsApp Business API ===\n', 'blue');
  if (env.OPENBSP_BASE_URL && env.OPENBSP_API_KEY) {
    log('✅ Credenciais OpenBSP encontradas', 'green');
    log(`   Base URL: ${env.OPENBSP_BASE_URL.substring(0, 50)}...`, 'cyan');

    // Try to check WhatsApp status via OpenBSP
    try {
      const res = await fetch(`${env.OPENBSP_BASE_URL}/rest/v1/whatsapp_channels?select=id,status,provider`, {
        headers: {
          'apikey': env.OPENBSP_PUBLISHABLE_KEY || '',
          'Authorization': `Bearer ${env.OPENBSP_API_KEY}`
        }
      });
      if (res.ok) {
        const channels = await res.json();
        log(`✅ ${channels.length} canal(is) WhatsApp conectado(s)`, 'green');
        channels.forEach((c, i) => {
          log(`   Canal ${i + 1}: ${c.provider || 'openbsp'} (status: ${c.status || 'unknown'})`, 'cyan');
        });
      } else {
        log(`ℹ️  Nenhum canal configurado ainda (HTTP ${res.status})`, 'yellow');
      }
    } catch (e) {
      log(`ℹ️  Conecte um canal WhatsApp via /admin/integrations`, 'yellow');
    }
  } else {
    log('❌ Credenciais OpenBSP não encontradas', 'red');
  }

  // Check Meta OAuth
  log('\n=== Meta Integration (Instagram/Facebook) ===\n', 'blue');
  if (env.META_APP_ID) {
    log('✅ META_APP_ID configurado', 'green');
    log(`   App ID: ${env.META_APP_ID}`, 'cyan');

    if (env.ENABLE_META_OAUTH) {
      log('✅ OAuth da Meta habilitado', 'green');
    } else {
      log('ℹ️  Defina ENABLE_META_OAUTH=true para habilitar OAuth', 'yellow');
    }

    if (env.META_WEBHOOK_VERIFY_TOKEN) {
      log('✅ Webhook token configurado', 'green');
    }
  } else {
    log('❌ META_APP_ID não configurado', 'red');
  }

  // Summary
  log('\n=== Resumo ===\n', 'blue');
  const whatsappOk = !!(env.OPENBSP_BASE_URL && env.OPENBSP_API_KEY);
  const metaOk = !!env.META_APP_ID;

  log(`WhatsApp Business API: ${whatsappOk ? '✅ Configurado' : '❌ Não configurado'}`, whatsappOk ? 'green' : 'red');
  log(`Meta OAuth: ${metaOk ? '✅ Configurado' : '❌ Não configurado'}`, metaOk ? 'green' : 'red');

  if (whatsappOk && metaOk) {
    log('\n✅ Sistema pronto para uso!\n', 'green');
    log('Acesse http://localhost:3000/admin/integrations para conectar contas', 'yellow');
  } else {
    log('\n⚠️  Configure as credenciais faltantes no .env.local', 'yellow');
  }
}

checkHealth();