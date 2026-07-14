import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Client Supabase côté serveur : lit la session dans les cookies (posés par le
// middleware / login). Les requêtes passent avec le JWT de l'utilisateur → RLS.
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Appelé depuis un Server Component : le middleware rafraîchit
            // déjà la session, on peut ignorer.
          }
        },
      },
    }
  );
}
