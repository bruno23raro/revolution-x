import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { encryptToken } from '@/lib/encryption';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { withUserContext } from '@/lib/prisma';
import { resolvePublicSiteOrigin } from '@/lib/site-origin';
import type { MetaConnectionStatus } from '@/integrations/meta/types';

// OAuth Meta callback — arquitetura existente respeitada
// META_APP_SECRET: NUNCA exposto no código/cliente/Git

// Timing-safe state comparison
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Erros explícitos — sem stack trace
  if (error) return redirectError(req, 'oauth_error', error);
  if (!state) return redirectError(req, 'state_missing');
  if (!code) return redirectError(req, 'code_missing');

  // State CSRF protection — cookie armazena "provider:state" para saber qual provedor persistir
  const sessionStateFull = req.cookies.get('oauth_state')?.value ?? '';
  const [expectedProvider, sessionState] = sessionStateFull.split(':', 2);
  if (!sessionState || !secureCompare(state, sessionState)) {
    return redirectError(req, 'state_invalid');
  }
  // Validar que o provider é um dos esperados
  if (!['facebook', 'instagram', 'whatsapp'].includes(expectedProvider)) {
    return redirectError(req, 'state_invalid');
  }

  // Autenticação robusta: validação via Supabase Auth (anon key → RLS sujeito)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectError(req, 'not_authenticated');
  }

  // Buscar membership do usuário no banco para validar a organização.
  // Wrapped in withUserContext so the "User_self" RLS policy is satisfied.
  // (Currently BYPASSRLS ignores this, but future-proof for role migration.)
  const dbUser = await withUserContext(user.id, async (tx) =>
    tx.user.findUnique({
      where: { id: user.id },
      include: { organizationMembers: true },
    })
  );

  if (!dbUser || dbUser.organizationMembers.length === 0) {
    return redirectError(req, 'not_authenticated');
  }

  // Usa a primeira (primary) organização do usuário
  const organizationId = dbUser.organizationMembers[0].organizationId;

  // Token exchange — servidor, META_APP_ID/SECRET do .env.local
  // NUNCA expor token na response/redirect
  let metaToken: string;
  let expiresIn = 0;
  // MULTICONTAS: uma meta por PÁGINA (não só a [0]). A persistência de 2+
  // páginas exige a relaxation de UNIQUE(organization_id,provider) da migration
  // 016 (passo humano). Para 1 página funciona com ou sem 016.
  type PageTarget = { metaPageId: string | null; instagramAccountId: string | null };
  let pageTargets: PageTarget[] = [];

  try {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) return redirectError(req, 'config_missing');

    // redirect_uri deve ser EXATAMENTE o mesmo usado no início do dialog
    // (Meta rejeita mismatch). resolvePublicSiteOrigin evita o origin interno
    // do proxy do Hostinger (0.0.0.0:3000), que quebraria o exchange.
    const callbackOrigin = resolvePublicSiteOrigin(req.nextUrl.origin);
    const tokenRes = await fetch(
      `https://graph.facebook.com/v26.0/oauth/access_token?` +
      `client_id=${appId}&client_secret=${appSecret}&code=${code}&` +
      `redirect_uri=${encodeURIComponent(`${callbackOrigin}/api/auth/callback/meta`)}`,
      { method: 'POST' }
    );

    if (!tokenRes.ok) {
      const err = await tokenRes.json().catch(() => ({}));
      console.error('[meta-oauth] token exchange failed:', err);
      return redirectError(req, 'token_exchange_failed');
    }

    const tokenData = await tokenRes.json() as { access_token: string; expires_in?: number };
    metaToken = tokenData.access_token;
    expiresIn = tokenData.expires_in ?? 0;

    // MULTICONTAS: busca TODAS as PÁGINAS (não só [0]) e, p/ cada uma, a conta
    // de Instagram Business vinculada. Persiste 1 meta_integrations por página.
    const pagesRes = await fetch(
      `https://graph.facebook.com/v26.0/me/accounts?access_token=${metaToken}`
    );
    if (pagesRes.ok) {
      const pages = await pagesRes.json() as { data: Array<{ id: string; name: string }> };
      const pageList = (pages.data ?? []).slice(0, 25); // guarda contra abuso
      for (const pg of pageList) {
        let igId: string | null = null;
        if (pg.id) {
          const igRes = await fetch(
            `https://graph.facebook.com/v26.0/${pg.id}?fields=instagram_business_account&access_token=${metaToken}`
          );
          if (igRes.ok) {
            const ig = await igRes.json() as { instagram_business_account?: { id: string } };
            igId = ig.instagram_business_account?.id ?? null;
          }
        }
        pageTargets.push({ metaPageId: pg.id || null, instagramAccountId: igId });
      }
    }
    if (pageTargets.length === 0) {
      // Nenhuma página: mantém o fluxo legado (token sem página).
      pageTargets.push({ metaPageId: null, instagramAccountId: null });
    }
  } catch (err) {
    console.error('[meta-oauth] token exchange error:', err);
    return redirectError(req, 'token_exchange_failed');
  }

  // Criptografar token antes de persistir
  let encryptedToken: string;
  try {
    encryptedToken = encryptToken(metaToken);
  } catch {
    return redirectError(req, 'encryption_failed');
  }

  // Persistir integração no banco via service_role (único caminho que precisa de privileged access)
  try {
    const serviceSupabase = createServiceRoleClient();
    const expiresAt = expiresIn > 0
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;

    // MULTICONTAS: 1 linha por PÁGINA (check-then-act, idempotente por
    // meta_page_id). Pré-migration-016 a 2ª+ página viola
    // UNIQUE(organization_id,provider) → db_error (documentado); 1 página
    // funciona com ou sem 016.
    for (const t of pageTargets) {
      const selectQ = serviceSupabase
        .from('meta_integrations')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('provider', expectedProvider);
      const found = t.metaPageId
        ? await selectQ.eq('meta_page_id', t.metaPageId).maybeSingle()
        : await selectQ.is('meta_page_id', null).maybeSingle();

      const base = {
        encrypted_access_token: encryptedToken,
        token_expires_at: expiresAt,
        status: 'CONNECTED' as MetaConnectionStatus,
        connected_at: new Date().toISOString(),
      };

      if (found.data && !found.error) {
        const up = await serviceSupabase
          .from('meta_integrations')
          .update(base)
          .eq('id', found.data.id);
        if (up.error) {
          console.error('[meta-oauth] db error:', up.error);
          return redirectError(req, 'db_error');
        }
      } else {
        const ins = await serviceSupabase
          .from('meta_integrations')
          .insert({
            organization_id: organizationId,
            provider: expectedProvider,
            meta_page_id: t.metaPageId,
            instagram_account_id: t.instagramAccountId,
            meta_app_id: process.env.META_APP_ID ?? null,
            ...base,
          });
        if (ins.error) {
          // Pré-migration-016, a 2ª+ página viola UNIQUE(organization_id,provider).
          console.error('[meta-oauth] db error:', ins.error);
          return redirectError(req, 'db_error');
        }
      }
    }
  } catch (err) {
    console.error('[meta-oauth] db error:', err);
    return redirectError(req, 'db_error');
  }

  // Token nunca em log/redirect. Estado OAuth é de uso único: limpar o cookie.
  const ok = NextResponse.redirect(new URL('/onboarding/success', req.url));
  ok.cookies.set('oauth_state', '', { maxAge: 0, path: '/' });
  return ok;
}

function redirectError(req: NextRequest, reason: string, detail?: string) {
  const url = new URL('/onboarding/error', req.url);
  url.searchParams.set('reason', reason);
  if (detail) url.searchParams.set('detail', detail);
  return NextResponse.redirect(url);
}
