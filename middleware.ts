import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { createServiceRoleClient } from './src/lib/supabase/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const pathname = request.nextUrl.pathname;
    const isPublicRoute =
      pathname === '/' ||
      pathname === '/login' ||
      pathname === '/register' ||
      pathname === '/forgot-password' ||
      pathname === '/reset-password' ||
      pathname === '/verify-email' ||
      pathname.startsWith('/onboarding');

    // A preview without Supabase may render public pages, but must never make
    // protected UI appear authenticated in a production-like runtime.
    if (process.env.NODE_ENV === 'production' && !isPublicRoute) {
      if (pathname.startsWith('/api/')) {
        return new NextResponse('Authentication service is not configured', { status: 503 });
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }

    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return response;
  }

  // Fetch user's organization from database.
  // Uses service role here because this query runs before any tenant context
  // is available (middleware has no GUC). The user identity is already validated
  // by Supabase Auth above, so the lookup is safe — only the user's own row
  // can be read (userId is the partition key).
  try {
    const svc = createServiceRoleClient();
    // Um usuário pode pertencer a várias organizações: OrganizationMember tem
    // @@unique([organizationId,userId]), não um userId único. maybeSingle()
    // lançava para o 2º registro e o catch engolia → multi-org perdia o cookie
    // de contexto. Buscamos a lista e usamos a primeira como a org ativa.
    const { data: members } = await svc
      .from('OrganizationMember')
      .select('organizationId')
      .eq('userId', user.id);

    const orgId = members?.[0]?.organizationId;
    if (orgId) {
      response.cookies.set('x-organization-id', orgId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });
    }
  } catch {
    // Ignore errors fetching org
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
