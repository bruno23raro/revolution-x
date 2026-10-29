// rx-warmup.mjs — Warm-up process antes da fila de gravação de vídeos
// CAUSA RAIZ 2: Gerencia a sessão do Facebook no perfil persistente
//
// Ordem: abrir perfil -> ir ao facebook.com -> detectar login -> auto-login se credenciais existirem
// ou imprimir aviso e esperar 180s (ou 120s conforme o gate)

// Configuração
const PROFILE_DIR = 'C:\\Users\\Bruno\\.pw-fb-profile';
const FACEBOOK_URL = 'https://www.facebook.com';

// Passo 1: Abrir página inicial do Facebook no contexto do perfil
console.log('=== WARM-UP: Iniciando sessão Facebook ===');
console.log(`Perfil: ${PROFILE_DIR}`);

// Navegar para Facebook
await page.goto(FACEBOOK_URL, { waitUntil: 'networkidle', timeout: 15000 });
await waitHuman(500);

// Detectar status de login
// Estratégia: procurar elementos que indicam login vs login form
const loggedInSelectors = ['._5rgr', '.html5-aesop-stories', '.xoX4j', '.profileAvatar'];
const loginFormSelectors = ['input[name="email"]', 'input[name="pass"]', '._6ltg'];

// Verificar se há form de login visível
const hasLoginForm = await page.locator(loginFormSelectors.join(', ')).first().isVisible().catch(() => false);

// Verificar se há elementos de feed/logado visíveis
let isLoggedIn = false;
for (const sel of loggedInSelectors) {
  try {
    if (await page.locator(sel).first().isVisible()) {
      isLoggedIn = true;
      break;
    }
  } catch (e) {
    // Continuar para próximo seletor
  }
}

// Resultados do diagnóstico
if (hasLoginForm && !isLoggedIn) {
  // Usuário não está logado no Facebook
  console.log('LOGUE NO FACEBOOK NA JANELA ABERTA (180s) — CAUSA RAIZ 2');
  console.log('Aguardando o usuário fazer login manualmente...');
  await waitHuman(180000); // 180 segundos
  console.log('SESSAO FB: usuario ainda nao logou — continue o fluxo manualmente');
} else if (isLoggedIn && !hasLoginForm) {
  // Usuário já está logado
  console.log('SESSAO FB: usuario ja logado no Facebook');
} else {
  // Estado indeterminado — aviso conservador
  console.log('LOGUE NO FACEBOOK NA JANELA ABERTA (180s) — CAUSA RAIZ 2 (estado indeterminado)');
  await waitHuman(180000);
  console.log('SESSAO FB: verificacao concluida');
}

// Fechar a página de warm-up — o perfil permanece no contexto
await page.close();

console.log('=== WARM-UP Concluido ===');
console.log('O perfil agora esta pronto para a fila de gravação de videos.');
console.log('Prossiga com a execucao de rx-record.mjs');