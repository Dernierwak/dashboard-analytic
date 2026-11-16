"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCompteActif } from "@/lib/account";
import { JETON_META, effacerJetonTransit, lireJetonTransit } from "@/lib/oauth";
import { comptesPubMeta, instagramDeLaPage } from "@/lib/oauth-api";
import { lancerWorkflow } from "@/lib/github-workflow";
import { leverReconnexion } from "@/lib/reconnexion";

export type Reponse = { ok: boolean; message?: string };

// ── UNE SOURCE BRANCHÉE RÉCOLTE TOUT DE SUITE ────────────────────────────────
//
// « Quand on branche une source, les données sont prises directement, et
// ensuite mises à jour le jour que nous voulons avoir pour notre report »
// (David, `.scratch/refonte/issues/13-entre-deux-jours-de-travail.md` §5).
// C'est la contrepartie du retrait des quatre boutons : le client n'a plus
// « ↻ Mes données » pour amorcer son compte, donc l'amorçage doit partir tout
// seul, à l'instant où la source devient utilisable.
//
// AUCUNE INFRASTRUCTURE NEUVE. C'est le dispatch que les boutons utilisaient
// (`lib/github-workflow.ts`), avec les mêmes entrées ; ensuite le cron de
// 07:00 UTC tourne tous les matins et `_due_today` écarte les comptes dont ce
// n'est pas le jour. Un compte installé qui branche Google Ads un mercredi est
// donc traité comme un compte neuf : ses tableaux de bord se remplissent dans
// les minutes, son rapport l'intègre au Jour de travail.
//
// CE N'EST PAS « BRANCHÉ » AU SENS OAUTH, MAIS AU SENS DONNÉES. Une
// autorisation Google accordée ne récolte rien tant que le compte publicitaire
// et la propriété Analytics ne sont pas choisis — c'est très exactement ce que
// dit l'en-tête de `app/comptes/page.tsx`. La récolte part donc au choix du
// compte, pas au retour d'OAuth : sinon elle tournerait à vide.
//
// UN AMORÇAGE QUI RATE NE FAIT PAS RATER LE BRANCHEMENT. La source EST
// branchée — la ligne est écrite en base. Si GitHub refuse le dispatch (jeton
// absent, réseau), on le dit dans le message de retour et le compte sera servi
// au Jour de travail comme les autres. Perdre le branchement pour un raté de
// dispatch serait un remède pire que le mal.
//
// ET ON LE DIT DANS LES DEUX CAS. Le départ réussi se dit aussi : c'est la
// seule chose qui explique l'écran des minutes qui suivent — un tableau de bord
// encore vide pendant que la récolte tourne. Le panneau de suivi
// (`components/suivi-recolte.tsx`) prend le relais dès qu'il voit le run.
async function amorcerRecolte(uid: string): Promise<string> {
  const r = await lancerWorkflow(
    { user_id: uid },
    "Récolte lancée — tes premières données arrivent dans quelques minutes."
  );
  return r.ok
    ? r.message
    : `Source branchée. La première récolte, elle, n'est pas partie — ${r.message} Tes données arriveront au prochain jour de récolte.`;
}

// Les écritures du parcours de connexion.
//
// Une garde commune à toutes : on ne connecte JAMAIS un compte publicitaire au
// dashboard de quelqu'un d'autre. Les jetons d'accès sont la seule donnée que
// le partage d'équipe n'expose pas (connected_accounts est délibérément hors
// des règles de partage) — l'interface doit tenir la même ligne que la base.
async function moiSeul(): Promise<{ uid: string } | { erreur: string }> {
  const compte = await getCompteActif();
  if (compte.uid !== compte.moi) {
    return {
      erreur:
        "Tu regardes le dashboard de quelqu'un d'autre. Les connexions ne se " +
        "gèrent que depuis son propre compte.",
    };
  }
  return { uid: compte.moi };
}

/** Rattache la Page choisie : on en déduit le compte Instagram, puis on écrit. */
export async function connecterMeta(pageId: string, pageNom: string): Promise<Reponse> {
  const garde = await moiSeul();
  if ("erreur" in garde) return { ok: false, message: garde.erreur };

  const token = lireJetonTransit(JETON_META);
  if (!token) {
    return {
      ok: false,
      message: "L'autorisation Meta a expiré — relance la connexion, ça prend 20 secondes.",
    };
  }

  const ig = await instagramDeLaPage(token, pageId);
  const supabase = createClient();
  let idLigne: number | undefined;

  try {
    // Une même Page reconnectée ne doit pas créer un doublon : on retrouve la
    // ligne par son compte Instagram quand il existe, sinon par le provider.
    const existante = await supabase
      .from("connected_accounts")
      .select("id")
      .eq("user_id", garde.uid)
      .eq("provider", "meta")
      .limit(1);

    const donnees = {
      user_id: garde.uid,
      provider: "meta",
      meta_token: token,
      account_name: pageNom,
      instagram_business_id: ig?.id ?? null,
    };

    let id = existante.data?.[0]?.id as number | undefined;
    if (id) {
      await supabase.from("connected_accounts").update(donnees).eq("id", id);
    } else {
      const ins = await supabase.from("connected_accounts").insert(donnees).select("id").limit(1);
      id = ins.data?.[0]?.id as number | undefined;
    }
    if (id) {
      await supabase.from("profiles").update({ active_account_id: id }).eq("id", garde.uid);
    }
    idLigne = id;
  } catch (e) {
    return { ok: false, message: `La sauvegarde a échoué : ${(e as Error).message}` };
  }

  effacerJetonTransit(JETON_META);
  await leverReconnexion(supabase, garde.uid, "meta");
  revalidatePath("/comptes");

  // LE COMPTE PUBLICITAIRE D'ABORD, QUAND IL Y EN A PLUSIEURS. Amorcer ici
  // ferait lire à la récolte le premier compte que Meta rend — celui que
  // personne n'a choisi — et ses campagnes s'écriraient sous ce compte Pulse
  // avant que le client ait pu désigner le bon. L'amorçage attend donc
  // `choisirComptePubMeta`, à un clic d'ici ; Instagram attend avec lui.
  if (idLigne !== undefined && (await comptePubReste(supabase, idLigne, token))) {
    return {
      ok: true,
      message:
        "Page connectée. Ton accès Facebook voit plusieurs comptes publicitaires : " +
        "choisis juste en dessous celui que Pulse doit lire — la récolte partira à ce moment-là." +
        (ig ? "" : " Aucun compte Instagram Business n'est rattaché à cette Page : tes publications ne remonteront pas."),
    };
  }

  // La Page est rattachée : il y a de quoi récolter, on y va.
  const recolte = await amorcerRecolte(garde.uid);

  // Pas d'Instagram rattaché : la publicité Meta marchera, l'organique non. On
  // le dit maintenant plutôt que de laisser une section vide sans explication.
  if (!ig) {
    return {
      ok: true,
      message:
        "Page connectée, mais aucun compte Instagram Business ne lui est rattaché. " +
        "Tes campagnes Meta remonteront ; tes publications Instagram, non. " +
        "Vérifie le lien Page ↔ compte Instagram dans les paramètres de ta Page. " +
        recolte,
    };
  }
  return { ok: true, message: recolte };
}

type Supabase = ReturnType<typeof createClient>;

/**
 * Reste-t-il un compte publicitaire Meta à choisir avant de récolter ?
 *
 * Un seul compte visible : il n'y a rien à choisir, on l'écrit. Plusieurs :
 * `true`, et la page Connexions pose la question. Dans tous les autres cas —
 * un choix déjà fait et toujours visible (reconnexion), la section 26 du `000`
 * pas encore jouée, une liste illisible — `false` : la récolte part comme avant ce ticket, sur le
 * premier compte, plutôt que de rester bloquée derrière une question que la
 * page ne saurait pas poser.
 */
async function comptePubReste(supabase: Supabase, idLigne: number, token: string): Promise<boolean> {
  const actuel = await supabase
    .from("connected_accounts")
    .select("meta_ad_account_id")
    .eq("id", idLigne)
    .limit(1);
  if (actuel.error) return false;
  const choisi = (actuel.data?.[0] as { meta_ad_account_id?: string | null } | undefined)
    ?.meta_ad_account_id;
  const liste = await comptesPubMeta(token);
  if (!liste.ok || liste.choix.length === 0) return false;
  if (choisi) {
    if (liste.choix.some((c) => c.id === choisi)) return false;
    // UNE RECONNEXION SOUS UN AUTRE ACCÈS FACEBOOK peut ne plus voir le compte
    // choisi. Le garder ferait échouer chaque récolte Meta sur un compte
    // illisible, sans que la page repose jamais la question : le choix part,
    // et la suite le traite comme un compte neuf.
    await supabase
      .from("connected_accounts")
      .update({ meta_ad_account_id: null, meta_ad_account_name: null })
      .eq("id", idLigne);
  }
  if (liste.choix.length > 1) return true;
  await supabase
    .from("connected_accounts")
    .update({ meta_ad_account_id: liste.choix[0].id, meta_ad_account_name: liste.choix[0].nom })
    .eq("id", idLigne);
  return false;
}

/** Le compte publicitaire que la récolte Meta doit lire, parmi ceux du jeton. */
export async function choisirComptePubMeta(compteId: string, nom: string): Promise<Reponse> {
  const garde = await moiSeul();
  if ("erreur" in garde) return { ok: false, message: garde.erreur };

  // La même forme que côté récolte (`accounts.py`, `_ID_COMPTE`) : cet
  // identifiant finira dans le chemin d'une URL Graph.
  if (!/^act_\d+$/.test(compteId)) {
    return { ok: false, message: "Ce compte publicitaire n'a pas un identifiant lisible (attendu : act_…)." };
  }

  const supabase = createClient();
  // Par l'ID de la ligne, pas par `provider` : une ligne Meta d'avant
  // l'unification des jetons peut porter un `provider` vide.
  const ligne = await supabase
    .from("connected_accounts")
    .select("id")
    .eq("user_id", garde.uid)
    .not("meta_token", "is", null)
    .limit(1);
  const id = ligne.data?.[0]?.id as number | undefined;
  if (!id) return { ok: false, message: "Aucune connexion Meta sur ce compte : connecte Meta d'abord." };

  // `.select()` après l'update : un refus RLS ne renvoie aucune erreur, il
  // touche zéro ligne (`CLAUDE.md` §8). On vérifie donc l'écriture.
  const ecrit = await supabase
    .from("connected_accounts")
    .update({ meta_ad_account_id: compteId, meta_ad_account_name: nom || null })
    .eq("id", id)
    .eq("user_id", garde.uid)
    .select("id");
  if (ecrit.error) {
    return {
      ok: false,
      message:
        `Le choix n'a pas pu être enregistré (${ecrit.error.message}). Si la colonne ` +
        "meta_ad_account_id manque, la section 26 de 000_run_me_all.sql n'est pas encore jouée.",
    };
  }
  if (!ecrit.data?.length) {
    return { ok: false, message: "Le choix n'a pas été enregistré : aucune ligne n'a été modifiée." };
  }
  revalidatePath("/comptes");
  // Meta Ads lit maintenant le bon compte — voir `amorcerRecolte`.
  return { ok: true, message: await amorcerRecolte(garde.uid) };
}

export async function choisirCompteGoogle(customerId: string): Promise<Reponse> {
  const garde = await moiSeul();
  if ("erreur" in garde) return { ok: false, message: garde.erreur };

  const supabase = createClient();
  const { error } = await supabase
    .from("connected_accounts")
    .update({ google_customer_id: String(customerId).replace(/-/g, "") })
    .eq("user_id", garde.uid)
    .eq("provider", "google");
  if (error) return { ok: false, message: error.message };
  revalidatePath("/comptes");
  // Google Ads devient récoltable à cette seconde — voir `amorcerRecolte`.
  return { ok: true, message: await amorcerRecolte(garde.uid) };
}

export async function choisirProprieteGa4(property: string): Promise<Reponse> {
  const garde = await moiSeul();
  if ("erreur" in garde) return { ok: false, message: garde.erreur };

  const supabase = createClient();
  const { error } = await supabase
    .from("connected_accounts")
    .update({ ga4_property_id: property })
    .eq("user_id", garde.uid)
    .eq("provider", "google");
  if (error) return { ok: false, message: error.message };
  revalidatePath("/comptes");
  // La propriété Analytics est la seconde moitié de Google : elle apporte le
  // revenu et les conversions, que le compte publicitaire seul ne donne pas.
  return { ok: true, message: await amorcerRecolte(garde.uid) };
}

/**
 * Déconnexion. On efface le jeton, pas les données déjà récoltées : elles
 * appartiennent à l'utilisateur et son historique n'a pas à disparaître parce
 * qu'il change de compte publicitaire.
 */
export async function deconnecter(canal: "meta" | "google"): Promise<Reponse> {
  const garde = await moiSeul();
  if ("erreur" in garde) return { ok: false, message: garde.erreur };

  const supabase = createClient();
  const vide =
    canal === "meta"
      ? { meta_token: null, instagram_business_id: null }
      : { google_refresh_token: null, google_customer_id: null, ga4_property_id: null };

  const { error } = await supabase
    .from("connected_accounts")
    .update(vide)
    .eq("user_id", garde.uid)
    .eq("provider", canal);
  if (error) return { ok: false, message: error.message };
  // Le compte publicitaire choisi part avec le jeton : un autre accès Facebook
  // ne voit pas forcément ce compte, et la récolte échouerait dessus. À PART,
  // et son échec est ignoré : sur une base sans la section 26 du `000`, ces
  // colonnes n'existent pas, et la déconnexion ne doit pas en dépendre.
  if (canal === "meta") {
    await supabase
      .from("connected_accounts")
      .update({ meta_ad_account_id: null, meta_ad_account_name: null })
      .eq("user_id", garde.uid)
      .eq("provider", canal);
  }
  revalidatePath("/comptes");
  return { ok: true };
}
