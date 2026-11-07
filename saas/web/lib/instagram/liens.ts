// ── LES LIENS DE LA PAGE INSTAGRAM ───────────────────────────────────────────
//
// L'état de la page vit dans l'URL (spec, § « L'état de la page vit dans
// l'URL ») : la période (`from`/`to`), la métrique choisie (`metrique`), et
// les deux Règles de lecture (`sansBoostes`, `sansHorsNorme`, `regles.ts`) et le post ouvert (`post`,
// ticket 11). Un lien ÉNUMÈRE CE QU'IL CHANGE, JAMAIS CE QU'IL GARDE
// (`CLAUDE.md` §8) : il repart de tous les paramètres présents, même ceux
// qu'il ne connaît pas — c'est ce qui laisse les tickets suivants ajouter les
// leurs sans repasser sur chaque lien. Même mécanique que `lienMeta`
// (`lib/meta/liens.ts`), dont le chemin est en dur.
//
// Sans directive : lu par le serveur (le Sélecteur) comme par le client (le
// Bandeau), et par le harnais.
import { METRIQUE_PAR_DEFAUT } from "./lecture";

export const CHEMIN_INSTAGRAM = "/instagram";

export type Params = Record<string, string | string[] | undefined>;

/** Une valeur qui EST le défaut ne s'écrit pas : `/instagram` se partage. */
const DEFAUTS: Record<string, string> = { metrique: METRIQUE_PAR_DEFAUT };

/** `null` dans le patch retire le paramètre. */
export function lienInstagram(params: Params, patch: Record<string, string | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k in patch) continue;
    for (const x of Array.isArray(v) ? v : [v]) if (x) q.append(k, x);
  }
  for (const [k, v] of Object.entries(patch)) if (v) q.append(k, v);
  for (const [k, d] of Object.entries(DEFAUTS)) if (q.get(k) === d) q.delete(k);
  const s = q.toString();
  return s ? `${CHEMIN_INSTAGRAM}?${s}` : CHEMIN_INSTAGRAM;
}
