// app/api/oauth/callback/whatsapp/route.ts
// WhatsApp Business API OAuth callback
// Valida state contra cookie httpOnly, troca code por tokens via Graph API,
// busca info da WABA, salva em integrations com tokens criptografados,
// retorna HTML que fecha popup via postMessage.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { encryptToken } from '@/lib/encryption';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { withUserContext } from '@/lib/prisma';
import { resolvePublicSiteOrigin } from '@/lib/site-origin';

const WHATSAPP_PROVIDER = 'whatsapp';

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

  // Erros explícitos
  if (error) return redirectError(req, 'oauth_error', error);
  if (!state) return redirectError(req, 'state_missing');
  if (!code) return redirectError(req, 'code_missing');

  // State CSRF protection — cookie armazena "provider:state"
  const sessionStateFull = req.cookies.get('oauth_state')?.value ?? '';
  const [expectedProvider, sessionState] = sessionStateFull.split(':', 2);
  if (!sessionState || !secureCompare(state, sessionState)) {
    return redirectError(req, 'state_invalid');
  }
  if (expectedProvider !== WHATSAPP_PROVIDER) {
    return redirectError(req, 'state_invalid');
  }

  // Autenticação via Supabase Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return redirectError(req, 'not_authenticated');
  }

  // Buscar membership do usuário
  const dbUser = await withUserContext(user.id, async (tx) =>
    tx.user.findUnique({
      where: { id: user.id },
      include: { organizationMembers: true },
    })
  );

  if (!dbUser || dbUser.organizationMembers.length === 0) {
    return redirectError(req, 'not_authenticated');
  }

  const organizationId = dbUser.organizationMembers[0].organizationId;

  // Token exchange — servidor
  let metaToken: string;
  let expiresIn = 0;
  let wabaId: string | null = null;
  let phoneNumberId: string | null = null;
  let displayName: string | null = null;

  try {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) return redirectError(req, 'config_missing');

    const callbackOrigin = resolvePublicSiteOrigin(req.nextUrl.origin);
    const redirectUri = `${callbackOrigin}/api/oauth/callback/whatsapp`;

    const tokenRes = await fetch(
      `https://graph.facebook.com/v26.0/oauth/access_token?` +
      `client_id=${appId}&client_secret=${appSecret}&code=${code}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}`,
      { method: 'POST' }
    );

    if (!tokenRes.ok) {
      const err = await tokenRes.json().catch(() => ({}));
      console.error('[whatsapp-oauth] token exchange failed:', err);
      return redirectError(req, 'token_exchange_failed');
    }

    const tokenData = await tokenRes.json() as { access_token: string; expires_in?: number; waba_id?: string; phone_number_id?: string };
    metaToken = tokenData.access_token;
    expiresIn = tokenData.expires_in ?? 0;
    wabaId = tokenData.waba_id ?? null;
    phoneNumberId = tokenData.phone_number_id ?? null;

    // Buscar nome da conta WABA
    if (wabaId) {
      const wabaRes = await fetch(
        `https://graph.facebook.com/v26.0/${wabaId}?fields=name&access_token=${metaToken}`
      );
      if (wabaRes.ok) {
        const waba = await wabaRes.json() as { name?: string };
        displayName = waba.name ?? null;
      }
    }
  } catch (err) {
    console.error('[whatsapp-oauth] token exchange error:', err);
    return redirectError(req, 'token_exchange_failed');
  }

  // Criptografar token
  let encryptedToken: string;
  try {
    encryptedToken = encryptToken(metaToken);
  } catch {
    return redirectError(req, 'encryption_failed');
  }

  const expiresAt = expiresIn > 0
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null;

  // Persistir na tabela integrations (user-scoped via RLS)
  try {
    const serviceSupabase = createServiceRoleClient();
    const { error: upsertError } = await serviceSupabase
      .from('integrations')
      .upsert({
        user_id: user.id,
        channel: WHATSAPP_PROVIDER,
        status: 'CONNECTED',
        access_token: encryptedToken,
        expires_at: expiresAt,
        meta_account_id: wabaId,
        meta_account_name: displayName,
        phone_number: phoneNumberId,
        waba_id: wabaId,
        metadata: { phone_number_id: phoneNumberId },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,channel,meta_account_id',
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error('[whatsapp-oauth] db error:', upsertError);
      return redirectError(req, 'db_error');
    }
  } catch (err) {
    console.error('[whatsapp-oauth] db error:', err);
    return redirectError(req, 'db_error');
  }

  // Limpar cookie de state e retornar HTML que fecha popup
  const publicOrigin = resolvePublicSiteOrigin(req.nextUrl.origin);
  const html = successHtml(publicOrigin, 'whatsapp');
  const res = new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  res.cookies.set('oauth_state', '', { maxAge: 0, path: '/' });
  return res;
}

function redirectError(req: NextRequest, reason: string, detail?: string) {
  const publicOrigin = resolvePublicSiteOrigin(req.nextUrl.origin);
  const url = new URL('/onboarding/error', publicOrigin);
  url.searchParams.set('reason', reason);
  if (detail) url.searchParams.set('detail', detail);
  return NextResponse.redirect(url);
}

function successHtml(origin: string, provider: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${provider.charAt(0).toUpperCase() + provider.slice(1)} Conectado</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f5f5f5; }
    .card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { font-size: 1.5rem; color: #1a1a1a; margin-bottom: 0.5rem; }
    p { color: #666; margin-bottom: 1.5rem; }
    .btn { background: #25D366; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; font-size: 1rem; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>WhatsApp Conectado!</h1>
    <p>Sua conta WhatsApp Business foi vinculada com sucesso.</p>
    <button class="btn" onclick="closePopup()">Fechar</button>
  </div>
  <script>
    function closePopup() {
      window.opener?.postMessage({ type: 'OAUTH_SUCCESS', provider: 'whatsapp' }, '${origin}');
      window.close();
    }
    // Auto-close após 3s
    setTimeout(closePopup, 3000);
  </script>
</body>
</html>`;
}

// Importações locais (evitam ciclos)
// import { createClient } from '@/lib/supabase/server';
// import { withUserContext } from '@/lib/prisma';