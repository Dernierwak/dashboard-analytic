import { createClient } from "@/lib/supabase/server";
import { getCompteActif } from "@/lib/account";
import { jourEtHeureDans } from "@/lib/fuseau";

// LES CHANGEMENTS DÉCLARÉS PAR LES PLATEFORMES.
//
// Le fil sait déjà DÉDUIRE cinq faits de la dépense quotidienne (lancée,
// arrêtée, reprise, programmée, dépense changée) — voir `changements` dans
// `saas/traitement/build_report.py`. C'est robuste mais aveugle : mettre un
// mot-clé en pause, remonter un CPC cible ou changer une audience ne fait pas
// forcément bouger la dépense du jour, et n'apparaît donc nulle part.
//
// Or les deux plateformes tiennent ce journal :
//   · Google Ads → la ressource `change_event` (30 derniers jours seulement,
//     10 000 lignes max, filtre de date OBLIGATOIRE dans la GAQL) ;
//   · Meta       → `GET /act_<id>/activities`.
//
// D'où la règle de fond : **ce qui est déclaré prime sur ce qui est déduit.**
// Quand les deux racontent le même fait le même jour sur la même campagne, on
// garde la version de la plateforme — elle nomme ce qui a changé, la nôtre ne
// fait que constater une conséquence.

export type CategorieChangement =
  | "budget"
  | "motcle"
  | "enchere"
  | "statut"
  | "audience"
  | "creatif"
  | "creation"
  | "autre";

export type ChangementApi = {
  /** Clé stable, pour dédupliquer avec les changements déduits. */
  cle: string;
  canal: "meta" | "google";
  /** YYYY-MM-DD, en heure locale du compte. */
  date: string;
  campagne: string | null;
  categorie: CategorieChangement;
  /** Déjà rédigé, prêt à poser dans le fil : « le CPC cible est passé de 0,40 à 0,55 CHF ». */
  phrase: string;
};

const CATEGORIES: CategorieChangement[] = [
  "budget", "motcle", "enchere", "statut", "audience", "creatif", "creation", "autre",
];

// PostgREST plafonne chaque requête à 1000 lignes, et un compte actif produit
// facilement plus de 1000 changements sur trente jours (Google journalise
// chaque mot-clé). La troncature serait silencieuse : le fil perdrait ses
// lignes les plus anciennes sans rien dire.
//
// L'erreur est LEVÉE, pas ignorée : le client PostgREST ne jette jamais, il
// renvoie `{data, error}`. Un `try/catch` seul ne rattraperait donc rien, et
// une table absente se lirait comme une table vide.
async function fetchAllRows<T>(
  build: () => {
    range: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: unknown }>;
  }
): Promise<T[]> {
  const page = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await build().range(from, from + page - 1);
    if (error) throw error;
    const chunk = (data ?? []) as T[];
    out.push(...chunk);
    if (chunk.length < page) return out;
  }
}

type LigneChangement = {
  channel: string | null;
  change_id: string | null;
  occurred_at: string | null;
  categorie: string | null;
  campaign_id: string | number | null;
  campaign_name: string | null;
  resume: string | null;
  fuseau: string | null;
};

/**
 * Le jour du changement dans le fuseau du compte — celui des insights, donc du
 * point de la courbe où l'effet apparaît. Les deux plateformes ne l'écrivent
 * pas pareil :
 *   · Google écrit l'heure du compte SANS décalage (« 2026-08-11 14:03:22 ») ;
 *     le `timestamptz` la lit dans le fuseau de la session — l'UTC, celui de
 *     Supabase — et la garde donc telle quelle, comme si c'était de l'UTC. La
 *     troncature rend donc le jour du compte, et reconvertir le fausserait.
 *   · Meta écrit l'instant en UTC (« …T22:30:00+0000 ») : la troncature
 *     poserait un geste fait à 00:30 à Zurich la veille. Le jour se découpe
 *     dans le `fuseau` récolté avec la ligne (ticket 17 de `.scratch/meta-ads/`) ;
 *     une ligne d'avant, sans fuseau, retombe sur l'UTC.
 */
function jourDuCompte(canal: "meta" | "google", occurredAt: string, fuseau: string | null): string {
  const d = new Date(occurredAt);
  if (canal === "google" || isNaN(d.getTime())) return occurredAt.slice(0, 10);
  return jourEtHeureDans(d, fuseau).jour;
}

/**
 * Les changements déclarés, du plus récent au plus ancien.
 *
 * Renvoie `[]` tant que la table `platform_changes` est vide ou absente —
 * jamais une exception : le fil doit s'afficher entièrement sans elle.
 */
export async function getChangementsApi(depuis: string): Promise<ChangementApi[]> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const uid = compte.uid;

  // Le thème de chaque campagne se lisait ici dans `*_campaign_config.label`.
  // Il est parti (2026-09-30), et la lecture avec lui : la colonne tombe au
  // ticket 02 de `.scratch/meta-ads/`, et une requête sur une colonne absente
  // aurait vidé le fil EN SILENCE par le `catch` ci-dessous.
  let lignes: LigneChangement[] = [];
  try {
    lignes = await fetchAllRows<LigneChangement>(() =>
      supabase
        .from("platform_changes")
        .select("channel, change_id, occurred_at, categorie, campaign_id, campaign_name, resume, fuseau")
        .eq("user_id", uid)
        .gte("occurred_at", depuis)
        .order("occurred_at", { ascending: false })
    );
  } catch {
    return []; // table absente (migration pas passée) — le fil s'affiche sans
  }

  const out: ChangementApi[] = [];
  for (const l of lignes) {
    const canal = l.channel === "google" ? "google" : l.channel === "meta" ? "meta" : null;
    if (!canal || !l.change_id || !l.occurred_at || !l.resume) continue;

    const campagne = l.campaign_name?.trim() || null;

    const brute = String(l.categorie ?? "");
    const categorie = (CATEGORIES as string[]).includes(brute)
      ? (brute as CategorieChangement)
      : "autre";

    out.push({
      // Le canal entre dans la clé : les deux plateformes hachent leurs
      // identifiants séparément, rien ne garantit qu'ils ne se croisent pas.
      cle: `${canal}:${l.change_id}`,
      canal,
      date: jourDuCompte(canal, l.occurred_at, l.fuseau),
      campagne,
      categorie,
      phrase: l.resume.trim(),
    });
  }

  // Le tri vient de la base, mais la pagination le rend page par page : deux
  // pages concaténées ne sont plus triées entre elles.
  out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return out;
}
