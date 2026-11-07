// ── LES 5 MEILLEURS POSTS DE LA PÉRIODE ─────────────────────────────────────
//
// Spec `.scratch/instagram/spec.md`, § « Tes posts face à ton année », dernier
// point (la liste), et § La lecture, ligne « les 5 meilleurs » ; user story
// 19. Harnais : `.scratch/instagram-construction/harnais/11-les-5-meilleurs-et-le-panneau/`.
//
// Posts de la période, plus de 48 h, une valeur, triés du plus haut au plus
// bas sur la métrique choisie. Aucun filtre propre : les Règles de lecture
// (`retenus`, `regles.ts`) retirent les écartés AVANT cet appel.
// La forme de la liste reste amendable par le ticket « le carré » (spec,
// § Notes) : seul ce fichier et `components/instagram/meilleurs.tsx` en
// dépendent.
//
// Sans directive (`CLAUDE.md` §8) ; imports relatifs sans extension pour
// Next, résolus par le crochet du harnais.
import { foulesDe, maturiteDe, placeDuPost, valeurDe, type CleMetrique, type Contexte, type PlaceDuPost, type Post } from "./lecture";
import { moustacheDe, type Moustache, type PeriodeLue } from "./annee";

/** Cinq : la liste de la maquette retenue (version D) ; le carré de la
 *  Sélection en tient 3 à 5 (vocabulaire de la spec). */
export const TAILLE_LISTE = 5;

export type Meilleur = {
  rang: number;
  post: Post;
  valeur: number;
  place: PlaceDuPost;
  /** La moustache des 12 mois du format — la mini-moustache « parmi tes
   *  Reels des 12 derniers mois ». `null` pour un format inconnu. */
  moustache: Moustache | null;
};

export function meilleursDe(posts: Post[], m: CleMetrique, periode: PeriodeLue, ctx: Contexte): Meilleur[] {
  const candidats = posts.flatMap((p) => {
    if (p.jour < periode.debut || p.jour > periode.fin || maturiteDe(p) === "jeune") return [];
    const v = valeurDe(p, m);
    return v === null ? [] : [{ post: p, valeur: v }];
  });
  // À égalité, le plus récent d'abord : c'est l'ordre du Tableau à l'ouverture.
  candidats.sort((a, b) => b.valeur - a.valeur || b.post.date.localeCompare(a.post.date) || a.post.id.localeCompare(b.post.id));
  const choisis = candidats.slice(0, TAILLE_LISTE);
  if (choisis.length === 0) return [];

  const foules = foulesDe(posts, m, ctx);
  return choisis.map(({ post, valeur }, i) => ({
    rang: i + 1,
    post,
    valeur,
    place: placeDuPost(post, m, foules, ctx),
    moustache: post.format ? moustacheDe(posts, post.format, m, ctx, 12, foules[post.format].n) : null,
  }));
}

/** ID du post → son numéro, pour le reporter sur le nuage. */
export function rangsDe(liste: Meilleur[]): Record<string, number> {
  return Object.fromEntries(liste.map((m) => [m.post.id, m.rang]));
}
