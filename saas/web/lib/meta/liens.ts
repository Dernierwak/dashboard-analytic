// ── LES LIENS DE LA PAGE META ────────────────────────────────────────────────
//
// L'état de la page vit dans l'URL (spec, § « L'état de la page vit dans
// l'URL ») : vue, campagne et groupe d'annonces (par ID), période, le niveau,
// les deux métriques et les places cochées de la Comparaison, et ce que montre
// le Panneau latéral — le jour ouvert (`jour`, avec `element` depuis un point
// de la Comparaison), un onglet du bord droit (`panneau`) ou l'annonce lue
// (`annonce`). Un lien ÉNUMÈRE CE QU'IL CHANGE, JAMAIS CE QU'IL GARDE (`CLAUDE.md` §8) :
// il repart de tous les paramètres présents, y compris ceux qu'il ne connaît
// pas, et n'en touche que le patch. C'est ce qui laisse les tickets suivants
// ajouter leurs paramètres sans repasser sur chaque lien.
//
// Sans directive ni import, comme `lecture.ts` : lu par le serveur (les cartes
// de vue sont des liens) comme par le client (le Bandeau), et par le harnais.

export const CHEMIN_META = "/meta";

/** Une valeur qui EST le défaut ne s'écrit pas : `/meta` et
 *  `/meta?vue=couts` sont la même page, la première se partage. */
const DEFAUTS: Record<string, string> = { vue: "couts", niveau: "annonces" };

export type Params = Record<string, string | string[] | undefined>;

/** Le patch qui ferme le Panneau latéral, quel que soit ce qu'il montre. Un
 *  lien qui en ouvre un l'étend avec ce qu'il ouvre : il ne peut jamais y en
 *  avoir deux. */
export const SANS_PANNEAU = { jour: null, element: null, panneau: null, annonce: null };

/** Le patch d'un changement de vue : la Comparaison revient à la paire de
 *  la nouvelle vue. Ses menus offrent toutes les métriques (`metriquesDe`) ;
 *  gardées, celles de l'ancienne vue feraient d'un clic sur une vue un clic
 *  qui ne change rien à la Comparaison. */
export const METRIQUES_DE_LA_VUE = { m1: null, m2: null };

/** Les onglets du bord droit (`components/meta/onglets.tsx`). */
export type Onglet = "changements" | "apercus";

/** Les paramètres d'un rendu serveur, SANS l'état du journal (`jour`,
 *  `element`, `panneau=changements`). Le navigateur ouvre et ferme le journal
 *  sans relire la page (`sur-place.ts`) : les paramètres que le serveur a vus
 *  sont donc périmés sur ces clés-là, et un lien construit dessus rouvrirait
 *  un jour déjà refermé (relecture du ticket 17). Seule l'URL du navigateur
 *  dit si le journal est ouvert. */
export function sansJournal(params: Params): Params {
  const { jour: _jour, element: _element, ...reste } = params;
  return reste.panneau === "changements" ? { ...reste, panneau: undefined } : reste;
}

/** `null` dans le patch retire le paramètre ; une liste l'écrit répété
 *  (`comparer`, les places cochées de la Comparaison). */
export function lienMeta(params: Params, patch: Record<string, string | string[] | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k in patch) continue;
    // Un paramètre répété survit au lien : `String(["a","b"])` l'aplatirait.
    for (const x of Array.isArray(v) ? v : [v]) if (x) q.append(k, x);
  }
  for (const [k, v] of Object.entries(patch)) for (const x of Array.isArray(v) ? v : [v]) if (x) q.append(k, x);
  for (const [k, d] of Object.entries(DEFAUTS)) if (q.get(k) === d) q.delete(k);
  const s = q.toString();
  return s ? `${CHEMIN_META}?${s}` : CHEMIN_META;
}
