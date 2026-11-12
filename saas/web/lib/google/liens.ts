// ── LES LIENS DE LA PAGE GOOGLE ──────────────────────────────────────────────
//
// L'état de la page vit dans l'URL (spec, § « L'état de la page vit dans
// l'URL ») : vue, campagne (par ID), période. Un lien ÉNUMÈRE CE QU'IL CHANGE,
// JAMAIS CE QU'IL GARDE (`CLAUDE.md` §8) : il repart de tous les paramètres
// présents, y compris ceux qu'il ne connaît pas, et n'en touche que le patch —
// c'est ce qui laisse les tickets suivants (Comparaison, jour, annonce, Groupes
// de termes) ajouter leurs paramètres sans repasser sur chaque lien.
//
// Sans directive ni import, comme `lecture.ts` : lu par le serveur (les cartes
// de vue sont des liens), par le client (le Bandeau) et par le harnais.

export const CHEMIN_GOOGLE = "/google";

/** Une valeur qui EST le défaut ne s'écrit pas : `/google` et
 *  `/google?vue=notoriete` sont la même page, la première se partage.
 *  Doit suivre `VUE_PAR_DEFAUT` de `lecture.ts`. */
const DEFAUTS: Record<string, string> = { vue: "notoriete" };

/** Changer de vue repart des métriques de la nouvelle vue : la Comparaison
 *  ne prend ses deux métriques que dans la vue (`lib/google/comparaison.ts`),
 *  et la courbe trace l'une des deux. */
export const METRIQUES_DE_LA_VUE = { m1: null, m2: null, courbe: null };

export type Params = Record<string, string | string[] | undefined>;

/** Le patch qui ferme le Panneau latéral, quoi qu'il montre : le jour ouvert
 *  (`jour`) ou l'annonce lue (`annonce`, ticket 08). Un lien qui en ouvre un
 *  l'étend avec ce qu'il ouvre — ouvrir un jour retire l'annonce, rien
 *  d'autre : il ne peut jamais y avoir deux panneaux. */
export const SANS_PANNEAU = { jour: null, annonce: null };

/** Les paramètres d'un rendu serveur, SANS le jour ouvert. Le navigateur ouvre
 *  et ferme le jour sans relire la page (`lib/meta/sur-place.ts`) : le `jour`
 *  que le serveur a vu est donc périmé, et un lien construit dessus rouvrirait
 *  un jour déjà refermé (même piège que Meta, `sansJournal`). Seule l'URL du
 *  navigateur dit quel jour est ouvert. */
export function sansJour(params: Params): Params {
  const { jour: _jour, ...reste } = params;
  return reste;
}

/** `null` dans le patch retire le paramètre ; une liste l'écrit répété. */
export function lienGoogle(params: Params, patch: Record<string, string | string[] | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k in patch) continue;
    // Un paramètre répété survit au lien : `String(["a","b"])` l'aplatirait.
    for (const x of Array.isArray(v) ? v : [v]) if (x) q.append(k, x);
  }
  for (const [k, v] of Object.entries(patch)) for (const x of Array.isArray(v) ? v : [v]) if (x) q.append(k, x);
  for (const [k, d] of Object.entries(DEFAUTS)) if (q.get(k) === d) q.delete(k);
  const s = q.toString();
  return s ? `${CHEMIN_GOOGLE}?${s}` : CHEMIN_GOOGLE;
}
