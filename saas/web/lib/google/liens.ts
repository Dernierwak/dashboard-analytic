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

export type Params = Record<string, string | string[] | undefined>;

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
