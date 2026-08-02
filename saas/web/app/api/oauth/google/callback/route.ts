import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { redirectUri, reglagesGoogle, retourComptes, verifierEtat } from "@/lib/oauth";

export const dynamic = "force-dynamic";

// Retour de Google. Différence importante avec Meta : ici on écrit le
// refresh_token en base IMMÉDIATEMENT, avant même de savoir quel compte
// publicitaire choisir.
//
// La raison est une leçon payée cher dans l'ancienne app (components/callbacks.py,
// fonction `_save_google_token`) : le code OAuth est à usage unique. Si on
// attend la fin du parcours pour enregistrer et que quoi que ce soit échoue
// entre-temps, le jeton est perdu pour de bon et l'utilisateur doit re-consentir
// sans comprendre pourquoi. Le choix du compte, lui, se rattrape toujours.

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (url.searchParams.get("error")) {
    return NextResponse.redirect(retourComptes({ erreur: "refus_google" }));
  }
  if (!verifierEtat("google", state)) {
    return NextResponse.redirect(retourComptes({ erreur: "state" }));
  }
  if (!code) return NextResponse.redirect(retourComptes({ erreur: "code_manquant" }));

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(retourComptes({ erreur: "session" }));

  const cfg = reglagesGoogle();
  if (!cfg) return NextResponse.redirect(retourComptes({ erreur: "config_google" }));

  let refreshToken: string | null = null;
  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: redirectUri("google"),
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });
    const d = await r.json();
    refreshToken = d.refresh_token ?? null;
  } catch {
    return NextResponse.redirect(retourComptes({ erreur: "reseau_google" }));
  }

  // Pas de refresh_token = un compte déjà autorisé auparavant, chez qui Google
  // n'en redélivre pas. Le message doit dire quoi faire : révoquer l'accès dans
  // le compte Google, puis recommencer.
  if (!refreshToken) {
    return NextResponse.redirect(retourComptes({ erreur: "pas_de_refresh" }));
  }

  try {
    const existante = await supabase
      .from("connected_accounts")
      .select("id")
      .eq("user_id", user.id)
      .eq("provider", "google")
      .limit(1);

    if (existante.data?.[0]?.id) {
      await supabase
        .from("connected_accounts")
        .update({ google_refresh_token: refreshToken })
        .eq("id", existante.data[0].id);
    } else {
      await supabase.from("connected_accounts").insert({
        user_id: user.id,
        provider: "google",
        account_name: "Google",
        google_refresh_token: refreshToken,
      });
    }
  } catch {
    return NextResponse.redirect(retourComptes({ erreur: "sauvegarde_google" }));
  }

  return NextResponse.redirect(retourComptes({ google: "comptes" }));
}
