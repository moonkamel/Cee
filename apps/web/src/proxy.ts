import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseEnv } from '@/lib/supabase/env';

// Rafraîchit la session Supabase à chaque requête et renvoie vers la connexion sans session.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  const isLogin = request.nextUrl.pathname.startsWith('/connexion');
  // Vérification d'un rapport (QR code) : publique, pour le client, l'assureur ou l'expert.
  const isPublic = request.nextUrl.pathname.startsWith('/verifier/');
  if (!data?.claims && !isLogin && !isPublic) {
    const login = request.nextUrl.clone();
    login.pathname = '/connexion';
    login.search = '';
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)'],
};
