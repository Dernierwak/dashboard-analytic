// LES CHANGEMENTS DÉCLARÉS PAR LES PLATEFORMES.
//
// Le fil sait déjà DÉDUIRE cinq faits de la dépense quotidienne (lancée,
// arrêtée, reprise, programmée, dépense changée) — voir `changements` dans
// `saas/worker/build_report.py`. C'est robuste mais aveugle : mettre un
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

/**
 * Les changements déclarés, du plus récent au plus ancien.
 *
 * Renvoie `[]` tant que la table `platform_changes` est vide ou absente —
 * jamais une exception : le fil doit s'afficher entièrement sans elle.
 */
export async function getChangementsApi(
  _depuis: string,
  _theme?: string | null
): Promise<ChangementApi[]> {
  return [];
}
