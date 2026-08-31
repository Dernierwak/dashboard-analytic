// La largeur de la barre latérale, réglable en glissant son bord droit.
//
// Elle vit ici, à côté de `COOKIE_NAV` dans `nav-cookie.ts` et pour la même
// raison : `side-nav.tsx` porte « use client », donc une constante qui en
// sortirait deviendrait côté serveur une référence client. Ce fichier n'a pas
// besoin d'être lu par le serveur (la largeur ne vit que dans `localStorage`,
// jamais dans un cookie), mais elle reste ici pour ne pas dupliquer le nombre
// entre le composant et son bouton de reset éventuel.
export const LS_NAV_LARGEUR = "pulse_nav_largeur";

/** Largeur de départ — celle mesurée dans `side-nav.tsx` (voir sa note en tête
 *  de fichier) pour qu'aucune des sept étapes du panneau de récolte ne passe
 *  à la ligne. */
export const NAV_LARGEUR_DEFAUT = 280;

/** En dessous, le repli de secours documenté dans `side-nav.tsx` : la plus
 *  longue étape du panneau de récolte passe sur deux lignes. Tolérable une
 *  fois qu'on descend volontairement en dessous de la mesure ci-dessus, pas
 *  plus bas. */
export const NAV_LARGEUR_MIN = 256;

/** Au-dessus, la colonne prendrait plus d'un tiers d'un écran de portable
 *  courant (1280 px) — assez pour lire large, pas pour écraser le contenu. */
export const NAV_LARGEUR_MAX = 400;
