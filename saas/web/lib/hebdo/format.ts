// Les nombres du rapport hebdo, écrits d'une seule façon par tous ses blocs —
// le bandeau des totaux, la carte du canal (serveur) et le panneau Campagnes
// (client).
//
// Module SANS directive : une valeur exportée d'un module `"use client"` se
// lirait côté serveur comme un proxy (`CLAUDE.md` §8).
//
// POURQUOI PAS `fmtCHF` (`lib/report.ts`) : il passe par `toLocaleString`, et
// serveur et navigateur n'ont pas toujours les mêmes données de locale — deux
// rendus différents d'un composant client font une erreur d'hydratation (voir
// `lib/jour-de-travail.ts`). Et `lib/report.ts` importe le client Supabase
// serveur : un composant client ne peut pas le lire.

/** « 12 480 » : arrondi à l'unité, milliers séparés par une espace. */
export function entier(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** « 1 240 CHF ». */
export function chf(n: number): string {
  return `${entier(n)} CHF`;
}
