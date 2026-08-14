// Le nom du cookie qui porte le repli de la barre latérale.
//
// IL VIT ICI, ET PAS DANS `components/side-nav.tsx`, POUR UNE RAISON PRÉCISE.
// `side-nav.tsx` porte « use client » : côté serveur, TOUS ses exports — y
// compris une simple chaîne — sont remplacés par une référence client. Un
// `cookies().get(COOKIE_NAV)` importé de là recevait donc un proxy, jamais
// « pulse_nav » : le cookie était bien envoyé par le navigateur, bien reçu par
// Next, et la barre se rendait quand même toujours dépliée. Rien ne plantait,
// TypeScript passait, et le HTML du serveur montrait `$8` là où on attendait le
// nom. Un module sans directive est lisible des deux côtés.
export const COOKIE_NAV = "pulse_nav";

/** Ce que le cookie vaut quand la barre est repliée. */
export const NAV_REPLIEE = "replie";
export const NAV_DEPLIEE = "deplie";
