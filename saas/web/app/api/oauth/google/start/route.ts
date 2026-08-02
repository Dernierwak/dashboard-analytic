import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { nouvelEtat, redirectUri, reglagesGoogle, retourComptes } from "@/lib/oauth";

export const dynamic = "force-dynamic";

// Départ du parcours Google. Une seule autorisation couvre les deux sources :
// Google Ads (adwords) et Analytics (analytics.readonly). C'est voulu — deux
// consentements séparés feraient abandonner la moitié des gens en route, et le
// même refresh_token sert aux deux API.
const SCOPES = [
  "https://www.googleapis.com/auth/adwords",
  "https://www.googleapis.com/auth/analytics.readonly",
].join(" ");

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(retourComptes({ erreur: "session" }));

  const cfg = reglagesGoogle();
  if (!cfg) return NextResponse.redirect(retourComptes({ erreur: "config_google" }));

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri("google"),
    response_type: "code",
    scope: SCOPES,
    // Ces deux-là ne sont pas décoratifs. Sans `offline`, Google ne délivre
    // aucun refresh_token et la récolte automatique meurt au bout d'une heure.
    // Sans `consent`, une reconnexion renvoie un access_token seul — le compte
    // paraît branché, puis se tait le lendemain sans message d'erreur.
    access_type: "offline",
    prompt: "consent",
    state: nouvelEtat("google"),
  });
  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
