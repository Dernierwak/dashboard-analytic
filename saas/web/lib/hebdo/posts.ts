// `payload.frise.posts` — écrit par `weekly_report/blocs/posts.py` (ticket 08).
//
// Module SANS directive, comme `lib/hebdo/frise.ts` : la frise et le panneau
// (client) le lisent, et une valeur exportée d'un module `"use client"` se lit
// côté serveur comme un proxy (`CLAUDE.md` §8).
//
// AUCUN CHIFFRE. Un post dit ce qui a été publié, pas comment ça a marché.
import type { Bornes } from "@/lib/hebdo/frise";
import type { SourcesHebdo } from "@/lib/hebdo/sources";

export type PostFrise = {
  plateforme: "instagram";
  /** Jour UTC de publication. */
  date: string;
  /** `IMAGE` | `CAROUSEL_ALBUM` | `VIDEO` | `REEL` ; `null` pour un type que
   *  le worker ne reconnaît pas. `REEL` seulement quand Meta l'a dit. */
  format: string | null;
  /** L'image rapatriée dans le Storage, ou un lien de CDN qui peut avoir expiré. */
  visuel: string | null;
  /** Le permalink Instagram ; `null` pour un post que la récolte n'a pas relu
   *  depuis l'ajout de la colonne — jamais reconstruit. */
  lien: string | null;
};

/** Les posts de la semaine choisie, du plus récent au plus ancien. */
export function postsDans(posts: PostFrise[], sem: Bornes): PostFrise[] {
  return posts
    .filter((p) => p.date >= sem.debut && p.date <= sem.fin)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * L'onglet Organique vide se dit (spec, tableau des états, point 9). Dans cet
 * ordre : semaine finie avant la connexion → « … n'était pas encore connecté » ;
 * semaine que la couverture des posts ne contient pas → « en cours de
 * récupération » ; sinon une vraie semaine sans post. Sans entrée Instagram
 * dans `sources`, rien ne prouve que la semaine est vide : elle est dite en
 * cours de récupération plutôt que « aucun post ».
 */
export function organiqueVide(sources: SourcesHebdo | null | undefined, sem: Bornes): string {
  const ig = sources?.instagram;
  const connecte = ig?.connecte_le?.slice(0, 10);
  if (connecte && sem.fin < connecte) return "Instagram n'était pas encore connecté";
  const plage = ig?.posts;
  if (!plage || plage.depuis > sem.debut || plage.jusqu_au < sem.fin) {
    return "Posts en cours de récupération";
  }
  return "Aucun post publié cette semaine";
}
