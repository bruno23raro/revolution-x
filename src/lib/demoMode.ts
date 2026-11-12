/**
 * Demo Mode - modo local sem login para desenvolvimento/testes
 *
 * Regras de segurança:
 * - Em produção, demoModeEnabled() SEMPRE retorna false, independente de RX_DEMO_MODE
 * - A flag deve ser lida apenas do lado do servidor (nunca NEXT_PUBLIC_)
 * - O modo demo só pode ser ativado em ambientes de desenvolvimento local
 * - Tokens demo são pinados às identidades demo (sub/org_id fixos) e expiram
 * - A validação de stack local usa ALLOWLIST de host (nunca bloco de produção):
 *   qualquer host externo (supabase.co, pooler, IP remoto) é recusado
 */

const crypto = require('crypto');

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000002';
const DEMO_USER_EMAIL = 'demo@revolutionx.dev';

export const DEMO_IDENTITIES = {
  USER_ID: DEMO_USER_ID,
  ORG_ID: DEMO_ORG_ID,
  EMAIL: DEMO_USER_EMAIL,
} as const;

export { DEMO_ORG_ID };

/**
 * Chave secreta para verificação de assinatura de tokens demo.
 * IMPORTANTE: Em produção, demoModeEnabled() retorna false, então esta chave nunca é usada para autenticação real.
 * Esta chave é apenas para garantir a integridade dos tokens demo no ambiente de desenvolvimento.
 *
 * REQUISITO: DEMO_JWT_SECRET deve estar definido em .env.local com pelo menos 32 bytes aleatórios criptograficamente.
 * Fail-closed: falha se não estiver definido (não usa fallback público).
 */
const DEMO_JWT_SECRET = process.env.DEMO_JWT_SECRET;

/**
 * Verifica a assinatura HMAC-SHA256 de um token JWT demo.
 * Usa timing-safe comparison para prevenir timing attacks.
 */
function verifyDemoSignature(header: string, payload: string, signature: string): boolean {
  try {
    const signData = `${header}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', DEMO_JWT_SECRET)
      .update(signData)
      .digest('base64')
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Verifica se o token JWT é um token demo VÁLIDO.
 *
 * Um token só é demo quando:
 * 1. payload.is_demo === true
 * 2. payload.sub === DEMO_USER_ID (pinned — token demo NUNCA representa outro usuário)
 * 3. payload.org_id === DEMO_ORG_ID (pinned — token demo NUNCA representa outra organização)
 * 4. payload.exp existe e está no futuro (token expirado é rejeitado)
 * 5. ASSINATURA HMAC-SHA256 válida (proteção contra falsificação)
 *
 * A segurança é defesa em profundidade:
 * - demoModeEnabled() é false absoluto em produção (primeira linha de defesa)
 * - O PINNING de sub/org_id impede acesso a identidades reais (segunda linha de defesa)
 * - A assinatura HMAC impede falsificação de tokens (terceira linha de defesa)
 */
export function isDemoToken(token: string | null): boolean {
  if (!token) return false;
  const result = decodeJwtPayload(token);
  if (!result) return false;
  const payload = result.payload;
  if (payload.is_demo !== true) return false;
  if (payload.sub !== DEMO_USER_ID) return false;
  if (payload.org_id !== DEMO_ORG_ID) return false;
  const exp = Number(payload.exp ?? '');
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) return false;
  return true;
}

/**
 * Decodifica um token demo e retorna as claims validadas.
 * Retorna null para token ausente, inválido, expirado ou não-demo.
 */
export function decodeDemoToken(token: string | null): { userId: string; email: string; organizationId: string; role: string } | null {
  const result = decodeJwtPayload(token!);
  if (!result) return null;
  const payload = result.payload;
  if (payload.is_demo !== true) return null;
  if (payload.sub !== DEMO_USER_ID) return null;
  if (payload.org_id !== DEMO_ORG_ID) return null;
  const exp = Number(payload.exp ?? '');
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) return null;

  // CRITICAL SECURITY: role é fixo como 'admin' - não confia no payload
  // Isso previne elevação de privilégios via token demo falsificado
  return {
    userId: DEMO_USER_ID,
    email: typeof payload.email === 'string' ? payload.email : DEMO_USER_EMAIL,
    organizationId: DEMO_ORG_ID,
    role: 'admin', // Role fixo - não pode ser falsificado via payload
  };
}

/**
 * Resultado da decodificação de um JWT
 */
interface JwtResult {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
}

/**
 * Decodifica e verifica um token JWT demo.
 * Retorna null se o token for inválido, expirado ou tiver assinatura incorreta.
 */
function decodeJwtPayload(token: string): JwtResult | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signature] = parts;

    // Verificar assinatura HMAC-SHA256 primeiro
    if (!verifyDemoSignature(headerB64, payloadB64, signature)) {
      return null;
    }

    // Decodificar header
    const headerB64Padded = headerB64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (headerB64.length % 4)) % 4);
    const header = JSON.parse(Buffer.from(headerB64Padded, 'base64').toString('utf8')) as Record<string, unknown>;

    // Decodificar payload
    const payloadB64Padded = payloadB64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (payloadB64.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(payloadB64Padded, 'base64').toString('utf8')) as Record<string, unknown>;

    return { header, payload };
  } catch {
    return null;
  }
}

/**
 * Verifica se o modo demo está habilitado.
 * RESTRIÇÃO CRÍTICA: Sempre retorna false em produção, mesmo que RX_DEMO_MODE esteja setado.
 */
export function demoModeEnabled(): boolean {
  // Guard absoluto: produção NUNCA permite modo demo
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  // Apenas desenvolvimento/teste permite modo demo
  return process.env.RX_DEMO_MODE === '1';
}

/**
 * Hosts de banco PERMITIDOS para operação demo/seed.
 * Allowlist deliberada: só loopback. Tudo o mais é recusado — incluindo
 * supabase.co, pooler.supabase.com e qualquer IP remoto, mesmo que o
 * DATABASE_URL alegue ser local.
 */
const LOCAL_DB_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '::1', 'host.docker.internal'];

/** Retorna true se host está na allowlist local (case-insensitive). */
export function isLocalHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.trim().toLowerCase().replace(/^\[|\]$/g, '');
  return LOCAL_DB_HOSTS.includes(h);
}

/** Extrai o host de uma connection string postgres. Retorna '' se ausente/inválida. */
export function parsePostgresHost(url: string | null | undefined): string {
  if (!url) return '';
  const at = url.lastIndexOf('@');
  const rest = at >= 0 ? url.slice(at + 1) : url;
  // host vai até o primeiro ':' (porta) ou '/' (path)
  const m = rest.match(/^([^:/?]+)/);
  return m ? m[1] : '';
}

/**
 * Verifica se o ambiente está configurado para rodar o stack local de desenvolvimento.
 * Útil para validar que o seed de demo está sendo executado no local correto.
 *
 * Allowlist de host no DATABASE_URL + recusa explícita de hosts Supabase.
 * NÃO confia em NODE_ENV nem em blocos parciais de hash de projeto.
 */
export function isLocalDevelopmentStack(): boolean {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl) return false;

  // Recusa qualquer host Supabase gerenciado (produção ou dev remoto)
  if (/supabase\.(co|com)/i.test(dbUrl)) return false;

  return isLocalHost(parsePostgresHost(dbUrl));
}

/**
 * Gera as credenciais demo para sessão local.
 * Não expõe valores sensíveis — apenas os IDs fixos para o seed.
 */
export function getDemoCredentials(): { userId: string; organizationId: string; email: string } {
  return {
    userId: DEMO_USER_ID,
    organizationId: DEMO_ORG_ID,
    email: DEMO_USER_EMAIL,
  };
}

/**
 * Detecta se deve usar simulação de IA baseado em demo mode e disponibilidade de providers.
 * Útil para decidir se deve retornar respostas mock em vez de chamar APIs reais.
 */
export function shouldSimulateAI(): boolean {
  if (!demoModeEnabled()) return false;

  // No modo demo sem providers configurados, simular
  const providers = process.env.OPENAI_API_KEY ||
                    process.env.ANTHROPIC_API_KEY ||
                    process.env.GOOGLE_API_KEY ||
                    process.env.AI_PROVIDER; // Providers custom

  return !providers;
}