import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Les trois documents légaux doivent répondre SANS session : Google exige des
// URL publiques HTTPS pour la politique et les CGU, Meta exige en plus une page
// d'instructions de suppression. Sans cette liste, la redirection ci-dessous
// renvoie le reviewer sur l'écran de connexion, et il en conclut que la
// politique n'est pas publiée.
const CHEMINS_PUBLICS = ["/privacy", "/terms", "/suppression"];

// Rafraîchit la session Supabase à chaque requête et protège les routes :
// pas connecté → /login ; connecté sur /login → rapport.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const chemin = request.nextUrl.pathname;
  const isLogin = chemin.startsWith("/login");
  const estPublic = CHEMINS_PUBLICS.some((p) => chemin === p || chemin.startsWith(`${p}/`));
  if (!user && !isLogin && !estPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Les paramètres ne suivent pas : si la session expire pendant un retour
    // OAuth, le code d'autorisation se retrouverait dans l'URL de la page de
    // connexion — donc dans l'historique du navigateur et dans les journaux.
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)"],
};
