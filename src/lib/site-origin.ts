/**
 * Resolve a origem pública para links de e-mail (confirmação de cadastro,
 * reset de senha, webhooks com callback público).
 *
 * Prioridade:
 *   1. NEXT_PUBLIC_SITE_URL — origem canônica configurada pelo operador
 *      (SEM www; em produção deve ser https://revolutionx.com.br).
 *   2. A origem da request, quando útil — exceto valores internos/quebrados
 *      que o proxy interno do Hostinger pode produzir (ex.: 0.0.0.0:3000,
 *      em que o hostname 0.0.0.0 não é uma origem alcançável pelo usuário).
 *      (localhost/127.0.0.1 permanecem válidos: na stack local o link de
 *      confirmação precisa apontar para o app local.)
 *   3. Fallback duro para o apex de produção.
 */
export function resolvePublicSiteOrigin(requestOrigin?: string): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv;

  const origin = (requestOrigin ?? '').trim();
  if (origin && isUsableOrigin(origin)) return origin;

  return 'https://revolutionx.com.br';
}

function isUsableOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    // 0.0.0.0 / IPv6 "todos os interfaces" não são host alcançáveis.
    return u.hostname.toLowerCase() !== '0.0.0.0' && u.hostname.toLowerCase() !== '::';
  } catch {
    return false;
  }
}
