import { createClient } from "@/lib/supabase/server";
import { getCompteActif } from "@/lib/account";
import { jourDeTravailDuCompte } from "@/lib/jour-compte";
import { dernierJourDeTravail } from "@/lib/jour-de-travail";
import { decaler, lireToutesLesPages, periodeDe, raccourcisDe, type Periode, type Raccourci } from "@/lib/meta/lecture";
import {
  abonnesParJourDe,
  AGE_EGAL_JUSQUA_HEURES,
  AGE_MINIMUM_HEURES,
  debutDesMois,
  maturiteDe,
  MOIS_DE_REFERENCE,
  postDe,
  relevesDe,
  type Contexte,
  type LigneAbonnesHistorique,
  type LigneBase,
  type LigneCompteJour,
  type LigneReleve,
  type Post,
  type RelevesParPost,
} from "@/lib/instagram/lecture";
import { jourDuRapport } from "@/lib/instagram/panneau";

// ── CE QUE LA PAGE INSTAGRAM LIT DANS SUPABASE ───────────────────────────────
//
// La seule couche de `lib/instagram/` qui touche la base ; tout le calcul est
// dans `lecture.ts` et `tableau.ts`, testé hors ligne. Elle ne déclenche aucun
// appel à Meta : le client ne déclenche rien (`CLAUDE.md` §9).
//
// LE COMPTE REGARDÉ, JAMAIS LE MIEN : un Membre invité lit `compte.uid`, et la
// règle de partage lui ouvre les mêmes lignes (`a_acces`, migration § 23).
// Rien ici ne lit `connected_accounts` : les jetons ne sont jamais à portée de
// cette page (`CLAUDE.md` §7).

export type DonneesInstagram = {
  /** Tout l'historique en base, du plus récent au plus ancien. */
  posts: Post[];
  ctx: Contexte;
  /** La période du Bandeau — elle choisit les points, jamais la référence. */
  periode: Periode;
  raccourcis: Raccourci[];
  /** La borne haute du calendrier : le jour en cours n'est jamais compté. */
  hier: string;
};

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** `from`/`to` : la période choisie au Bandeau (`AAAA-MM-JJ`). */
export async function getDonneesInstagram(choix: { from?: string; to?: string } = {}): Promise<DonneesInstagram> {
  const supabase = createClient();
  const { uid } = await getCompteActif();
  const maintenant = new Date();
  // La période « comme Meta » (arbitrage du 2026-11-06) : par défaut les 7
  // jours qui finissent la veille du dernier Jour de travail. Pas de
  // `dernierJourLu` : `fetchCanauxMuets` ne connaît pas Instagram — un canal
  // Instagram muet coûte des posts, pas une division fausse
  // (`lib/canaux-muets.ts`).
  const ctxPeriode = {
    aujourdhui: iso(maintenant),
    dernierJourDeTravail: iso(dernierJourDeTravail(await jourDeTravailDuCompte(), maintenant)),
  };
  const periode = periodeDe(choix, ctxPeriode);

  const [lignes, historique, jours] = await Promise.all([
    // `*` plutôt qu'une liste : une base où la section 23 n'est pas encore
    // jouée n'a ni `shares` ni `releve_a`, et une colonne nommée absente
    // ferait échouer toute la lecture. Absente, elle se lit « rien rendu ».
    // Paginé avec un ordre TOTAL (`id`) : 1 839 posts chez le compte de
    // l'essai, PostgREST tronque à 1 000 en silence (`CLAUDE.md` §8).
    lireToutesLesPages<LigneBase>((de, a) =>
      supabase
        .from("instagram_organic_posts")
        .select("*")
        .eq("user_id", uid)
        .order("date", { ascending: false })
        .order("id", { ascending: true })
        .range(de, a)
    ),
    // Les abonnés ne servent qu'à « portée ÷ abonnés » : illisibles, ce ratio
    // s'écrit « – » et le reste de la page tient.
    lireToutesLesPages<LigneAbonnesHistorique>((de, a) =>
      supabase
        .from("followers_history")
        .select("fetched_at, followers")
        .eq("user_id", uid)
        // Pas d'`id` connu dans le schéma de cette table (créée avant la
        // migration unique) ; elle est figée à 176 lignes, une seule page.
        .order("fetched_at", { ascending: true })
        .range(de, a)
    ).catch((e) => {
      console.error("[instagram] followers_history illisible", e);
      return [];
    }),
    lireToutesLesPages<LigneCompteJour>((de, a) =>
      supabase
        .from("instagram_compte_jours")
        .select("jour, abonnes")
        .eq("user_id", uid)
        .order("jour", { ascending: true })
        .range(de, a)
    ).catch((e) => {
      // Table absente tant que la section 23 n'est pas jouée.
      console.error("[instagram] instagram_compte_jours illisible", e);
      return [];
    }),
  ]);

  const abonnes = abonnesParJourDe(historique, jours);
  const posts = lignes.map((l) => postDe(l, abonnes));
  const ctx: Contexte = { maintenant: maintenant.toISOString() };
  // Les relevés ne servent qu'à placer un post de 48 h à 7 jours : sans lui,
  // personne ne les demande et on ne les lit pas.
  if (posts.some((p) => maturiteDe(p) === "age_egal")) {
    const releves = await lireReleves(supabase, uid, ctx.maintenant);
    if (releves) ctx.releves = releves;
  }
  return {
    posts,
    ctx,
    periode,
    raccourcis: raccourcisDe(periode, ctxPeriode),
    hier: decaler(ctxPeriode.aujourdhui, -1),
  };
}

/** Les relevés de 48 h à 7 jours des 12 derniers mois — la matière de la
 *  place à âge égal (spec, « place à âge égal » : J+2 à J+6). `null` si la
 *  table manque (section 23 pas jouée) ou se lit mal : la page dit alors que
 *  l'âge égal ne se calcule pas, au lieu d'un « 0 post au même âge ».
 *
 *  Paginé avec un ordre TOTAL — la clé `(user_id, post_id, releve_a)` : un
 *  relevé par post et par passage dépasse 1 000 lignes en quelques semaines,
 *  et PostgREST tronque en silence (`CLAUDE.md` §8). */
async function lireReleves(supabase: ReturnType<typeof createClient>, uid: string, maintenant: string): Promise<RelevesParPost | null> {
  try {
    const lignes = await lireToutesLesPages<LigneReleve>((de, a) =>
      supabase
        .from("instagram_post_releves")
        .select("post_id, releve_a, age_heures, reach, views, likes, comments, saved, shares, follows, profile_visits")
        .eq("user_id", uid)
        .gte("age_heures", AGE_MINIMUM_HEURES)
        .lt("age_heures", AGE_EGAL_JUSQUA_HEURES)
        // Un post publié il y a plus de 12 mois n'entre dans aucune foule :
        // ce seuil élague la lecture, `dansLesMois` reste le juge au calcul.
        .gte("releve_a", debutDesMois(maintenant, MOIS_DE_REFERENCE))
        .order("post_id", { ascending: true })
        .order("releve_a", { ascending: true })
        .range(de, a)
    );
    return relevesDe(lignes);
  } catch (e) {
    console.error("[instagram] instagram_post_releves illisible", e);
    return null;
  }
}

/** Le jour (`AAAA-MM-JJ`) du PREMIER rapport hebdo qui a listé ce post, ou
 *  `null`. Lu seulement quand le Panneau est ouvert sur un post qui a un
 *  permalink : chaque payload porte la frise de l'année, trop lourde pour
 *  être relue à chaque affichage de la page.
 *
 *  Le rapport ne porte pas de `post_id` (`lib/hebdo/posts.ts`) : on le
 *  retrouve par le permalink, par inclusion JSON côté base (`@>`), pour ne
 *  rapatrier qu'une ligne. Le premier, parce que c'est lui qui a vu le post le
 *  plus tôt. Une lecture ratée rend `null` : la phrase manque, le Panneau tient. */
export async function jourDuPremierRapportQuiListe(permalink: string): Promise<string | null> {
  const supabase = createClient();
  const { uid } = await getCompteActif();
  const { data, error } = await supabase
    .from("weekly_reports")
    .select("week_start, fin:payload->semaine->>fin")
    .eq("user_id", uid)
    .contains("payload", { frise: { posts: [{ lien: permalink }] } })
    .order("week_start", { ascending: true })
    .limit(1);
  if (error) {
    console.error("[instagram] weekly_reports illisible pour le Panneau", error);
    return null;
  }
  const fin = (data?.[0] as { fin?: unknown } | undefined)?.fin;
  return typeof fin === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fin) ? jourDuRapport(fin) : null;
}
