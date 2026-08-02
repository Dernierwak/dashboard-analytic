import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { nouvelEtat, redirectUri, reglagesMeta, retourComptes, META_API } from "@/lib/oauth";

export const dynamic = "force-dynamic";

// Départ du parcours Meta. Les permissions demandées sont exactement celles de
// l'ancienne app (meta_script/fetch_token.py) — les changer obligerait tous les
// comptes déjà connectés à re-consentir, et Meta ne délivre les nouvelles qu'au
// terme d'une revue de leur part.
//
//   ads_management            lire les campagnes et leurs dépenses
//   pages_show_list           lister les Pages dont l'utilisateur est admin
//   instagram_basic           lire le compte Instagram lié à la Page
//   instagram_manage_insights lire les statistiques des publications
//   business_management       retrouver les Pages gérées via un Business Manager
const SCOPES = [
  "ads_management",
  "pages_show_list",
  "instagram_basic",
  "instagram_manage_insights",
  "business_management",
].join(",");

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(retourComptes({ erreur: "session" }));

  const cfg = reglagesMeta();
  if (!cfg) return NextResponse.redirect(retourComptes({ erreur: "config_meta" }));

  const params = new URLSearchParams({
    client_id: cfg.appId,
    redirect_uri: redirectUri("meta"),
    response_type: "code",
    scope: SCOPES,
    state: nouvelEtat("meta"),
  });
  return NextResponse.redirect(
    `https://www.facebook.com/${META_API}/dialog/oauth?${params.toString()}`
  );
}
