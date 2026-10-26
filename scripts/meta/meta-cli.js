// Meta CLI - Automação de integração Meta (Facebook/Instagram/WhatsApp)
// Baseado nas credenciais: META_APP_ID=1112157761403064, META_APP_SECRET=ff2edcdec00e1e843433b860c717a3ab

import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { execSync } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import crypto from 'crypto';

// Credenciais fixas para esta automação
const META_APP_ID = '1112157761403064';
const META_APP_SECRET = 'ff2edcdec00e1e843433b860c717a3ab';
const DEFAULT_ORIGIN = 'https://revolutionx.com.br';

// Escopos padrão
const DEFAULT_SCOPES = [
  'pages_show_list',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
  'business_management',
  'whatsapp_business_messaging',
];

// Gerar verify token seguro
function generateVerifyToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Verificar se variáveis de ambiente estão configuradas
function checkEnv(): { ok: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!process.env.META_APP_ID) missing.push('META_APP_ID');
  if (!process.env.META_APP_SECRET) missing.push('META_APP_SECRET');
  if (!process.env.META_WEBHOOK_VERIFY_TOKEN) missing.push('META_WEBHOOK_VERIFY_TOKEN');
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  return {
    ok: missing.length === 0,
    missing
  };
}

// Listar contas Meta conectadas
async function listAccounts(organizationId: string): Promise<void> {
  const envCheck = checkEnv();
  if (!envCheck.ok) {
    console.error(`❌ Variáveis de ambiente faltando: ${envCheck.missing.join(', ')}`);
    console.error('Configure-as em .env.local ou no Hostinger');
    process.exit(1);
  }

  console.log(`📋 Listando contas Meta para organização: ${organizationId}`);
  console.log(`🔑 Usando App ID: ${META_APP_ID}`);
  console.log('');

  // Aqui integraríamos com o Supabase para listar meta_integrations
  // Por enquanto, mostramos estrutura
  console.log('Para listar contas reais, integrar com:');
  console.log('  npx supabase query execute "select * from meta_integrations where organization_id = \\'${organizationId}\\''');
}

// Iniciar OAuth flow
async function startOAuth(provider: 'whatsapp' | 'instagram' | 'facebook', organizationId: string): Promise<void> {
  const envCheck = checkEnv();
  if (!envCheck.ok) {
    console.error('❌ Variáveis de ambiente faltando');
    process.exit(1);
  }

  console.log(`🔐 Iniciando OAuth flow para ${provider} - Organização: ${organizationId}`);
  console.log('');

  // Gerar state seguro
  const state = crypto.randomBytes(24).toString('base64url');
  console.log(`🔑 State OAuth gerado: ${state}`);
  console.log('');

  // Construir URL de autorização
  const scopes = DEFAULT_SCOPES.join(',');
  const authUrl = `https://www.facebook.com/v26.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(`${DEFAULT_ORIGIN}/api/auth/callback/meta`)}&state=${state}&scope=${encodeURIComponent(scopes)}`;

  console.log('🌐 URL de autorização:');
  console.log(authUrl);
  console.log('');
  console.log('📋 Instruções:');
  console.log('1. Abra o navegador e acesse a URL acima');
  console.log('2. Faça login com a conta Facebook do admin');
  console.log('3. Autorize as permissões solicitadas');
  console.log('4. Após o callback, o sistema capturará o code automaticamente');
  console.log('');
  console.log('⚠️  Para conclusão automática, configure um webhook listener ou use o modo interativo');
}

// Verificar status de conexão
async function checkStatus(organizationId: string): Promise<void> {
  const envCheck = checkEnv();
  if (!envCheck.ok) {
    console.error('❌ Variáveis de ambiente faltando');
    process.exit(1);
  }

  console.log(`📊 Verificando status da conexão Meta - Organização: ${organizationId}`);
  console.log(`🔑 App ID: ${META_APP_ID}`);
  console.log('');

  // Integrar com Supabase para verificar meta_integrations
  console.log('Status das integrações (exemplo):');
  console.log('  - WhatsApp: [conectado/pending/expired]');
  console.log('  - Instagram: [conectado/pending/expired]');
  console.log('  - Facebook Login: [ativo/inativo]');
  console.log('');
  console.log('Para status real, integrar com Supabase:');
  console.log('  npx supabase storage list meta_integrations');
}

// Refresh de token
async function refreshToken(organizationId: string): Promise<void> {
  const envCheck = checkEnv();
  if (!envCheck.ok) {
    console.error('❌ Variáveis de ambiente faltando');
    process.exit(1);
  }

  console.log(`🔄 Refresh de token - Organização: ${organizationId}`);
  console.log(`🔑 App ID: ${META_APP_ID}`);
  console.log('');

  console.log('Para refresh automático, integrar com:');
  console.log('  refreshMetaAccessToken({ appId, appSecret }, exchangeToken)');
  console.log('');
  console.log('O endpoint é:');
  console.log('  GET https://graph.facebook.com/v26.0/oauth/access_token?');
  console.log('    grant_type=fb_exchange_token&');
  console.log('    client_id=' + META_APP_ID + '&');
  console.log('    client_secret=' + META_APP_SECRET + '&');
  console.log('    fb_exchange_token=' + [oldToken]);
}

// Publicar post no Facebook
async function publishPost(scheduledAt?: string, message?: string, link?: string): Promise<void> {
  const envCheck = checkEnv();
  if (!envCheck.ok) {
    console.error('❌ Variáveis de ambiente faltando');
    process.exit(1);
  }

  console.log('📝 Publicando post no Facebook');
  console.log(`🔑 App ID: ${META_APP_ID}`);
  console.log('');

  if (scheduledAt) {
    console.log(`⏰ Post agendado para: ${scheduledAt}`);
  }
  if (message) {
    console.log(`💬 Mensagem: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
  }
  if (link) {
    console.log(`🔗 Link: ${link}`);
  }
  console.log('');
  console.log('Para publicar de forma integrada, usar:');
  console.log('  publishFacebookPagePost({ facebookPageId, accessToken }, { message, link })');
}

// Helper para ler linha do stdin
function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Main CLI
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'list-accounts':
      if (args[1]) await listAccounts(args[1]);
      else {
        console.error('❌ Uso: meta list-accounts <organization-id>');
        process.exit(1);
      }
      break;

    case 'start-oauth':
      if (args[1] && args[2]) await startOAuth(args[1], args[2]);
      else {
        console.error('❌ Uso: meta start-oauth <provider> <organization-id>');
        console.error('Providers: whatsapp, instagram, facebook');
        process.exit(1);
      }
      break;

    case 'check-status':
      if (args[1]) await checkStatus(args[1]);
      else {
        console.error('❌ Uso: meta check-status <organization-id>');
        process.exit(1);
      }
      break;

    case 'refresh-token':
      if (args[1]) await refreshToken(args[1]);
      else {
        console.error('❌ Uso: meta refresh-token <organization-id>');
        process.exit(1);
      }
      break;

    case 'publish':
      // Processar args opcionais
      const scheduledAt = args[1];
      const message = args[2];
      const link = args[3];
      await publishPost(scheduledAt, message, link);
      break;

    case 'init':
      // Inicializar configurações
      console.log('🚀 Inicializando automação Meta...');
      console.log('');

      // Verificar env
      const envCheck = checkEnv();
      if (!envCheck.ok) {
        console.log('⚠️  Variáveis de ambiente incompletas. Configurando exemplo...');

        // Criar .env.example com valores de exemplo
        const envExample = `# Revolução X - Variáveis de Ambiente Meta
META_APP_ID=${META_APP_ID}
META_APP_SECRET=${META_APP_SECRET}
META_WEBHOOK_VERIFY_TOKEN=${generateVerifyToken()}
NEXT_PUBLIC_SUPABASE_URL=https://ardpabjoepzhkpmkgwgu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_XJ7GF2EDFcmYKNeaB3YucA_LbbEBdOi
NEXT_PUBLIC_SITE_URL=https://revolutionx.com.br
META_TOKEN_ENCRYPTION_KEY=${crypto.randomBytes(32).toString('hex')}
CRON_SECRET=${crypto.randomBytes(32).toString('hex')}
`;

        const envPath = resolve(process.cwd(), '.env.example');
        writeFileSync(envPath, envExample);
        console.log(`✅ Arquivo .env.example criado em: ${envPath}`);
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
      break;

    case '--help':
    case '-h':
    case 'help':
      console.log(`🤖 Meta CLI - Automação de Integração Meta

Comandos disponíveis:
  meta init                          - Inicializar/configurar variáveis de ambiente
  meta list-accounts <org-id>        - Listar contas Meta conectadas
  meta start-oauth <provider> <org-id> - Iniciar fluxo OAuth
  meta check-status <org-id>         - Verificar status da conexão
  meta refresh-token <org-id>        - Refresh automático de token
  meta publish [scheduledAt] [msg] [link] - Publicar post no Facebook
  meta --help | meta -h              - Mostrar esta ajuda

Credenciais usadas:
  META_APP_ID:    1112157761403064
  META_APP_SECRET: ff2edcdec00e1e843433b860c717a3ab
  App URL:        https://revolutionx.com.br
  Redirect URI:   https://revolutionx.com.br/api/auth/callback/meta
  Webhook URL:    https://revolutionx.com.br/api/webhooks/meta
`);
      break;

    default:
      console.error('❌ Comando desconhecido:', command);
      console.error('Use `meta --help` para ver comandos disponíveis');
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ Erro inesperado:', err.message);
  process.exit(1);
});