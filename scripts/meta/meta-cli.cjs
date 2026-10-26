// Meta CLI - Automação de integração Meta (Facebook/Instagram/WhatsApp)
const { writeFileSync, existsSync, mkdirSync } = require('fs');
const { resolve } = require('path');
const crypto = require('crypto');

// Credenciais fixas para esta automação (valores conhecidos)
const KNOWN_META_APP_ID = '1112157761403064';
const KNOWN_META_APP_SECRET = 'ff2edcdec00e1e843433b860c717a3ab';
const KNOWN_DEFAULT_ORIGIN = 'https://revolutionx.com.br';

const DEFAULT_SCOPES = [
  'pages_show_list',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
  'business_management',
  'whatsapp_business_messaging',
];

function generateVerifyToken() {
  return crypto.randomBytes(16).toString('hex');
}

// Usar variáveis de ambiente ou valores conhecidos
function getMetaAppId() {
  return process.env.META_APP_ID || KNOWN_META_APP_ID;
}

function getMetaAppSecret() {
  return process.env.META_APP_SECRET || KNOWN_META_APP_SECRET;
}

function getDefaultOrigin() {
  return process.env.META_DEFAULT_ORIGIN || KNOWN_DEFAULT_ORIGIN;
}

function checkEnv() {
  const missing = [];
  // Verificar se temos as credenciais (usando conhecidos se não estiverem definidos)
  const appId = getMetaAppId();
  const appSecret = getMetaAppSecret();

  if (!appId) missing.push('META_APP_ID');
  if (!appSecret) missing.push('META_APP_SECRET');
  if (!process.env.META_WEBHOOK_VERIFY_TOKEN) missing.push('META_WEBHOOK_VERIFY_TOKEN');
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  return { ok: missing.length === 0, missing };
}

function listAccounts(organizationId) {
  const envCheck = checkEnv();
  if (!envCheck.ok) {
    console.error('❌ Variáveis de ambiente faltando: ' + envCheck.missing.join(', '));
    process.exit(1);
  }
  console.log('📋 Listando contas Meta para organização: ' + organizationId);
  console.log('🔑 Usando App ID: ' + getMetaAppId());
  console.log('Para listar contas reais, integrar com Supabase:');
  console.log('  npx supabase query execute select * from meta_integrations where organization_id = ' + organizationId);
}

function startOAuth(provider, organizationId) {
  const envCheck = checkEnv();
  if (!envCheck.ok) {
    console.error('❌ Variáveis de ambiente faltando');
    process.exit(1);
  }
  console.log('🔐 Iniciando OAuth flow para ' + provider + ' - Organização: ' + organizationId);
  console.log('');
  const state = crypto.randomBytes(24).toString('base64url');
  console.log('🔑 State OAuth gerado: ' + state);
  console.log('');
  const scopes = DEFAULT_SCOPES.join(',');
  const authUrl = 'https://www.facebook.com/v26.0/dialog/oauth?client_id=' + getMetaAppId() + '&redirect_uri=' + encodeURIComponent(getDefaultOrigin() + '/api/auth/callback/meta') + '&state=' + state + '&scope=' + encodeURIComponent(scopes);
  console.log('🌐 URL de autorização:');
  console.log(authUrl);
  console.log('');
  console.log('📋 Instruções:');
  console.log('1. Abra o navegador e acesse a URL acima');
  console.log('2. Faça login com a conta Facebook do admin');
  console.log('3. Autorize as permissões solicitadas');
  console.log('4. Após o callback, o sistema capturará o code automaticamente');
  console.log('⚠️ Para conclusão automática, configure um webhook listener');
}

function checkStatus(organizationId) {
  const envCheck = checkEnv();
  if (!envCheck.ok) {
    console.error('❌ Variáveis de ambiente faltando');
    process.exit(1);
  }
  console.log('📊 Verificando status da conexão Meta - Organização: ' + organizationId);
  console.log('🔑 App ID: ' + getMetaAppId());
  console.log('Status das integrações (exemplo):');
  console.log('  - WhatsApp: [conectado/pending/expired]');
  console.log('  - Instagram: [conectado/pending/expired]');
  console.log('  - Facebook Login: [ativo/inativo]');
  console.log('Para status real, integrar com Supabase:');
  console.log('  npx supabase storage list meta_integrations');
}

function refreshToken(organizationId) {
  const envCheck = checkEnv();
  if (!envCheck.ok) {
    console.error('❌ Variáveis de ambiente faltando');
    process.exit(1);
  }
  console.log('🔄 Refresh de token - Organização: ' + organizationId);
  console.log('🔑 App ID: ' + getMetaAppId());
  console.log('Para refresh automático:');
  console.log('  refreshMetaAccessToken({ appId, appSecret }, exchangeToken)');
  console.log('O endpoint é:');
  console.log('  GET https://graph.facebook.com/v26.0/oauth/access_token?');
  console.log('    grant_type=fb_exchange_token&');
  console.log('    client_id=' + getMetaAppId() + '&');
  console.log('    client_secret=' + getMetaAppSecret() + '&');
  console.log('    fb_exchange_token=' + '[oldToken]');
}

function publishPost(scheduledAt, message, link) {
  const envCheck = checkEnv();
  if (!envCheck.ok) {
    console.error('❌ Variáveis de ambiente faltando');
    process.exit(1);
  }
  console.log('📝 Publicando post no Facebook');
  console.log('🔑 App ID: ' + getMetaAppId());
  if (scheduledAt) console.log('⏰ Post agendado para: ' + scheduledAt);
  if (message) console.log('💬 Mensagem: ' + message.substring(0, 50) + (message.length > 50 ? '...' : ''));
  if (link) console.log('🔗 Link: ' + link);
  console.log('');
  console.log('Para publicar de forma integrada, usar:');
  console.log('  publishFacebookPagePost({ facebookPageId, accessToken }, { message, link })');
}

function init() {
  console.log('🚀 Inicializando automação Meta...');
  console.log('');
  const envCheck = checkEnv();
  if (!envCheck.ok) {
    console.log('⚠️  Variáveis de ambiente incompletas. Configurando exemplo...');
    const envExample = '# Revolução X - Variáveis de Ambiente Meta\n' +
      'META_APP_ID=' + getMetaAppId() + '\n' +
      'META_APP_SECRET=' + getMetaAppSecret() + '\n' +
      'META_WEBHOOK_VERIFY_TOKEN=' + generateVerifyToken() + '\n' +
      'NEXT_PUBLIC_SUPABASE_URL=https://ardpabjoepzhkpmkgwgu.supabase.co\n' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_XJ7GF2EDFcmYKNeaB3YucA_LbbEBdOi\n' +
      'NEXT_PUBLIC_SITE_URL=https://revolutionx.com.br\n' +
      'META_TOKEN_ENCRYPTION_KEY=' + crypto.randomBytes(32).toString('hex') + '\n' +
      'CRON_SECRET=' + crypto.randomBytes(32).toString('hex') + '\n';
    const envPath = resolve(process.cwd(), '.env.example');
    writeFileSync(envPath, envExample);
    console.log('✅ Arquivo .env.example criado em: ' + envPath);
    console.log('');
    console.log('📝 Próximos passos:');
    console.log('1. Preencher META_APP_SECRET no .env.local (já definido)');
    console.log('2. Gerar META_WEBHOOK_VERIFY_TOKEN consistente');
    console.log('3. Configurar no Hostinger painel');
    console.log('4. Executar `meta start-oauth whatsapp <org-id>`');
  } else {
    console.log('✅ Todas as variáveis de ambiente estão configuradas');
    console.log('🔧 Para ver comandos disponíveis: meta --help');
  }
}

function help() {
  console.log('🤖 Meta CLI - Automação de Integração Meta\n');
  console.log('Comandos disponíveis:');
  console.log('  meta init                          - Inicializar/configurar variáveis de ambiente');
  console.log('  meta list-accounts <org-id>        - Listar contas Meta conectadas');
  console.log('  meta start-oauth <provider> <org-id> - Iniciar OAuth flow');
  console.log('  meta check-status <org-id>         - Verificar status da conexão');
  console.log('  meta refresh-token <org-id>        - Refresh automático de token');
  console.log('  meta publish [scheduledAt] [msg] [link] - Publicar post no Facebook');
  console.log('  meta --help | meta -h              - Mostrar esta ajuda\n');
  console.log('Credenciais usadas:');
  console.log('  META_APP_ID:    1112157761403064');
  console.log('  META_APP_SECRET: ff2edcdec00e1e843433b860c717a3ab');
  console.log('  App URL:        https://revolutionx.com.br');
  console.log('  Redirect URI:   https://revolutionx.com.br/api/auth/callback/meta');
  console.log('  Webhook URL:    https://revolutionx.com.br/api/webhooks/meta');
}

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'list-accounts': listAccounts(args[1]); break;
  case 'start-oauth': startOAuth(args[1], args[2]); break;
  case 'check-status': checkStatus(args[1]); break;
  case 'refresh-token': refreshToken(args[1]); break;
  case 'publish': publishPost(args[1], args[2], args[3]); break;
  case 'init': init(); break;
  case '--help':
  case '-h':
  case 'help': help(); break;
  default:
    console.error('❌ Comando desconhecido: ' + command);
    console.error('Use `meta --help` para ver comandos disponíveis');
    process.exit(1);
}