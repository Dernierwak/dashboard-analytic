import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  JETON_META,
  META_API,
  poserJetonTransit,
  redirectUri,
  reglagesMeta,
  retourComptes,
  verifierEtat,
} from "@/lib/oauth";

export const dynamic = "force-dynamic";

// Retour de Facebook. Deux échanges successifs, et le second n'est pas
// facultatif : le jeton rendu par l'échange du code ne vit qu'une heure. C'est
// le « long-lived » (60 jours) qu'on garde, sinon la récolte automatique du
// lundi matin échouerait dès la première semaine.

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // L'utilisateur a refusé sur l'écran Facebook — ce n'est pas une panne.
  if (url.searchParams.get("error")) {
    return NextResponse.redirect(retourComptes({ erreur: "refus_meta" }));
  }
  if (!verifierEtat("meta", state)) {
    return NextResponse.redirect(retourComptes({ erreur: "state" }));
  }
  if (!code) return NextResponse.redirect(retourComptes({ erreur: "code_manquant" }));

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(retourComptes({ erreur: "session" }));

  const cfg = reglagesMeta();
  if (!cfg) return NextResponse.redirect(retourComptes({ erreur: "config_meta" }));

  try {
    // 1. code → jeton court (1 h)
    const p1 = new URLSearchParams({
      client_id: cfg.appId,
      client_secret: cfg.appSecret,
      redirect_uri: redirectUri("meta"),
      code,
    });
    const r1 = await fetch(
      `https://graph.facebook.com/${META_API}/oauth/access_token?${p1.toString()}`,
      { cache: "no-store" }
    );
    const d1 = await r1.json();
    if (!d1.access_token) {
      return NextResponse.redirect(retourComptes({ erreur: "echange_meta" }));
    }

    // 2. jeton court → jeton long (60 j). Meta répond par une erreur explicite
    //    quand l'app est en développement et que le compte n'est pas déclaré
    //    testeur : c'est la cause n°1, la page /comptes la nomme.
    const p2 = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: cfg.appId,
      client_secret: cfg.appSecret,
      fb_exchange_token: d1.access_token,
    });
    const r2 = await fetch(
      `https://graph.facebook.com/${META_API}/oauth/access_token?${p2.toString()}`,
      { cache: "no-store" }
    );
    const d2 = await r2.json();
    if (!d2.access_token) {
      return NextResponse.redirect(retourComptes({ erreur: "long_token_meta" }));
    }

    // On ne l'écrit PAS encore en base : tant que la Page n'est pas choisie, on
    // ne sait pas à quel compte Instagram il correspond. Il attend dans un
    // cookie httpOnly, le temps du choix.
    poserJetonTransit(JETON_META, d2.access_token);
    return NextResponse.redirect(retourComptes({ meta: "pages" }));
  } catch {
    return NextResponse.redirect(retourComptes({ erreur: "reseau_meta" }));
  }
}
