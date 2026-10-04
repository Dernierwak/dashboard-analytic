// ── LES LIENS DE LA PAGE META ────────────────────────────────────────────────
//
// L'état de la page vit dans l'URL (spec, § « L'état de la page vit dans
// l'URL ») : vue, campagne (par ID), période, le niveau, les deux métriques
// et les places cochées de la Comparaison, le jour ouvert (`jour`) et
// l'annonce lue (`annonce`). Un lien ÉNUMÈRE CE QU'IL CHANGE, JAMAIS CE QU'IL GARDE (`CLAUDE.md` §8) :
// il repart de tous les paramètres présents, y compris ceux qu'il ne connaît
// pas, et n'en touche que le patch. C'est ce qui laisse les tickets suivants
// ajouter leurs paramètres sans repasser sur chaque lien.
//
// Sans directive ni import, comme `lecture.ts` : lu par le serveur (les cartes
// de vue sont des liens) comme par le client (le Bandeau), et par le harnais.

export const CHEMIN_META = "/meta";

/** Une valeur qui EST le défaut ne s'écrit pas : `/meta` et
 *  `/meta?vue=notoriete` sont la même page, la première se partage. */
const DEFAUTS: Record<string, string> = { vue: "notoriete", niveau: "annonces" };

export type Params = Record<string, string | string[] | undefined>;

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
