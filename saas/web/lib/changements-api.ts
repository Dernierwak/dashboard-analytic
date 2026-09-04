import { createClient } from "@/lib/supabase/server";
import { getCompteActif } from "@/lib/account";

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
  | "autre";

export type ChangementApi = {
  /** Clé stable, pour dédupliquer avec les changements déduits. */
  cle: string;
  canal: "meta" | "google";
  /** YYYY-MM-DD, en heure locale du compte. */
  date: string;
  campagne: string | null;
  /** Le thème de la campagne, quand elle en a un. */
  theme: string | null;
  categorie: CategorieChangement;
  /** Déjà rédigé, prêt à poser dans le fil : « le CPC cible est passé de 0,40 à 0,55 CHF ». */
  phrase: string;
};

const CATEGORIES: CategorieChangement[] = [
  "budget", "motcle", "enchere", "statut", "audience", "creatif", "autre",
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
};

/**
 * Les changements déclarés, du plus récent au plus ancien.
 *
 * Renvoie `[]` tant que la table `platform_changes` est vide ou absente —
 * jamais une exception : le fil doit s'afficher entièrement sans elle.
 */
export async function getChangementsApi(
  depuis: string,
  theme?: string | null
): Promise<ChangementApi[]> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const uid = compte.uid;

  let lignes: LigneChangement[] = [];
  let metaCfg: { campaign_name: string | null; label: string | null }[] = [];
  let googCfg: { campaign_id: string | number | null; label: string | null }[] = [];
  try {
    const [l, m, g] = await Promise.all([
      fetchAllRows<LigneChangement>(() =>
        supabase
          .from("platform_changes")
          .select("channel, change_id, occurred_at, categorie, campaign_id, campaign_name, resume")
          .eq("user_id", uid)
          .gte("occurred_at", depuis)
          .order("occurred_at", { ascending: false })
      ),
      supabase.from("meta_campaign_config").select("campaign_name, label").eq("user_id", uid),
      supabase.from("google_campaign_config").select("campaign_id, label").eq("user_id", uid),
    ]);
    if (m.error) throw m.error;
    if (g.error) throw g.error;
    lignes = l;
    metaCfg = m.data ?? [];
    googCfg = g.data ?? [];
  } catch {
    return []; // table absente (migration pas passée) — le fil s'affiche sans
  }

  // Meta se rattache par NOM de campagne, Google par IDENTIFIANT : c'est la clé
  // de chaque table de config, et les intervertir perdrait tous les thèmes.
  const metaLbl = new Map(metaCfg.map((c) => [String(c.campaign_name), c.label]));
  const googLbl = new Map(googCfg.map((c) => [String(c.campaign_id), c.label]));

  const out: ChangementApi[] = [];
  for (const l of lignes) {
    const canal = l.channel === "google" ? "google" : l.channel === "meta" ? "meta" : null;
    if (!canal || !l.change_id || !l.occurred_at || !l.resume) continue;

    const campagne = l.campaign_name?.trim() || null;
    const lien =
      canal === "meta"
        ? metaLbl.get(String(l.campaign_name)) ?? null
        : googLbl.get(String(l.campaign_id)) ?? null;

    // Un filtre par thème ne garde QUE ce qui est rattaché à ce thème. Laisser
    // passer les changements sans campagne « pour ne rien perdre » ferait
    // remonter des faits d'un autre thème sous le titre de celui-ci.
    if (theme && lien !== theme) continue;

    const brute = String(l.categorie ?? "");
    const categorie = (CATEGORIES as string[]).includes(brute)
      ? (brute as CategorieChangement)
      : "autre";

    out.push({
      // Le canal entre dans la clé : les deux plateformes hachent leurs
      // identifiants séparément, rien ne garantit qu'ils ne se croisent pas.
      cle: `${canal}:${l.change_id}`,
      canal,
      // `occurred_at` est stocké tel que la plateforme l'a écrit, dans le
      // fuseau du compte publicitaire. On tronque au jour sans reconvertir :
      // décaler vers UTC déplacerait une modification de fin de soirée au
      // lendemain, et le fil la poserait sur le mauvais point de la courbe.
      date: String(l.occurred_at).slice(0, 10),
      campagne,
      theme: lien,
      categorie,
      phrase: l.resume.trim(),
    });
  }

  // Le tri vient de la base, mais la pagination le rend page par page : deux
  // pages concaténées ne sont plus triées entre elles.
  out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return out;
}
