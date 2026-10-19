import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '../../../../src/lib/supabase/server';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 50)
    + '-' + crypto.randomUUID().substring(0, 6);
}

interface OnboardingResult {
  ok: boolean;
  /** orgId gerado mesmo que o insert falhe — o cleanup de resíduo parcial precisa dele. */
  orgId?: string;
  /** Erro original (NUNCA exposto ao client; só log). */
  error?: unknown;
}

async function createOnboardingRecords(
  userId: string,
  name: string,
  email: string,
): Promise<OnboardingResult> {
  const admin = createServiceRoleClient();

  // 1. Sync to public.User (auth.users → public."User")
  const { error: userError } = await admin.from('User').insert({
    id: userId,
    email,
    name,
    passwordHash: 'placeholder_migrated_user',
    emailVerified: true,
  });
  if (userError) {
    // 23505 = e-mail já em uso por linha anterior → idempotente, ignora.
    // Qualquer outro erro é real (ex.: banco fora) → falha o onboarding.
    if (userError.code !== '23505') return { ok: false, error: userError };
  }

  // 2. Create default Organization for this user
  const orgName = `${name.trim()}'s Organization`;
  const orgId = crypto.randomUUID();
  const { error: orgError } = await admin.from('Organization').insert({
    id: orgId,
    name: orgName,
    slug: slugify(orgName),
    status: 'active',
  });
  if (orgError) return { ok: false, orgId, error: orgError };

  // 3. Link user as admin member
  const { error: memberError } = await admin.from('OrganizationMember').insert({
    organizationId: orgId,
    userId,
    role: 'admin',
  });
  if (memberError) return { ok: false, orgId, error: memberError };

  return { ok: true, orgId };
}

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const normalizedPassword = String(password ?? '');
    if (!normalizedEmail || !normalizedPassword) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }
    const supabase = await createClient();
    const host = request.headers.get('host') ?? 'localhost:3000';
    const isLocalhost = host.includes('localhost');
    const siteOrigin = `${isLocalhost ? 'http' : 'https'}://${host}`;
    const emailRedirectTo = `${siteOrigin}/auth/callback?next=/verify-email`;
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: normalizedPassword,
      options: {
        emailRedirectTo,
        data: { name: String(name ?? '').trim() }
        // ATENÇÃO (skill supabase): user_metadata / raw_user_meta_data é editável pelo usuário.
        // Dados de autorização devem vir de app_metadata; não usar raw_user_meta_data em políticas RLS.
      }
    });
    if (error) {
      return NextResponse.json({ error: 'registration_failed' }, { status: 400 });
    }
    if (!data || !data.user) {
      return NextResponse.json({ error: 'registration_failed' }, { status: 400 });
    }

    // Create public.User + Organization + OrganizationMember for CRM access.
    // NUNCA lança: devolve um resultado — a falha é o ponto de compensação P4-2.
    let onboarding: OnboardingResult;
    try {
      onboarding = await createOnboardingRecords(
        data.user.id,
        String(name ?? '').trim(),
        normalizedEmail,
      );
    } catch (onboardErr) {
      // createServiceRoleClient() pode lançar (service key ausente) — trata
      // como onboarding falhado (sem orgId conhecido).
      onboarding = { ok: false, error: onboardErr };
    }

    if (!onboarding.ok) {
      // P4-2 (registro-zumbi): onboarding falhou → usuário com sessão GoTrue
      // válida mas sem public."User"/Organization (getAuthenticatedUser → null
      // → bloqueio permanente, sem retry). Compensa em DOIS planos e devolve
      // 500 honesto em vez de 201 falso, para o e-mail poder re-registrar limpo:
      //  1. deleteUser mata a sessão GoTrue (meta principal);
      //  2. o GoTrue NÃO tem cascade para public."User" — apaga também o
      //     resíduo parcial das linhas públicas (child → parent). Sem isso, a
      //     linha órfã de public."User" (e-mail UNIQUE) travaria o re-cadastro.
      console.error('[register] onboarding failed:', onboarding.error);
      let rolledBack = false;
      try {
        const admin = createServiceRoleClient();
        await admin.auth.admin.deleteUser(data.user.id);
        rolledBack = true;
        // Resíduo público parcial (melhor esforço; só loga, não muda o detail):
        await admin.from('OrganizationMember').delete().eq('userId', data.user.id);
        if (onboarding.orgId) {
          await admin.from('Organization').delete().eq('id', onboarding.orgId);
        }
        await admin.from('User').delete().eq('id', data.user.id);
      } catch (rollbackErr) {
        // Falha do rollback NÃO derruba a resposta: resíduo possível (cleanup
        // manual). Log sem segredos.
        console.error('[register] compensating delete left residue:', rollbackErr);
      }
      return NextResponse.json(
        {
          error: 'registration_failed',
          detail: rolledBack ? 'onboarding_rolled_back' : 'onboarding_residual',
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      user: {
        id: data.user.id,
        email: data.user.email || normalizedEmail,
        // NÃO usar user_metadata para decisão de autorização (skill supabase: raw_user_meta_data é editável).
        // Se precisar de claim de auth, usar app_metadata (raw_app_meta_data) via admin/updateUser.
        name: (data.user.app_metadata && typeof data.user.app_metadata === 'object' && data.user.app_metadata.name) || (data.user.user_metadata && typeof data.user.user_metadata === 'object' && data.user.user_metadata.name) || String(name ?? '').trim(),
        email_verified: !!data.user.email_confirmed_at
      }
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'registration_failed' }, { status: 500 });
  }
}
