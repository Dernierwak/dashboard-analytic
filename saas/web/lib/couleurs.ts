// La palette de Pulse — une seule source, lue par `tailwind.config.ts` ET par
// les graphiques SVG, qui ne peuvent pas passer par une classe (un `stroke`
// attend une couleur, pas `text-brand`).
//
// Pas de directive : `tailwind.config.ts` et les composants serveur la lisent,
// et une constante sortie d'un module "use client" deviendrait un proxy côté
// serveur (`CLAUDE.md` §8).
//
// LE PARTI PRIS, « LE RELEVÉ ». Pulse mesure et ne conseille pas : son
// matériau est le carnet de mesures, pas la plaquette commerciale. D'où un
// papier millimétré à peine gris-vert (`papier`), une encre bleue de stylo
// plutôt qu'un bleu électrique d'écran (`encre`), un rouge de correcteur pour
// ce qui se dégrade, et un seul geste d'accent : le surligneur. Le détail du
// raisonnement vit dans `docs/identite-visuelle.md`.
//
// Contrastes WCAG calculés sur `feuille` (#fff) : encre 7,35:1, graphite
// 16,8:1, gris 6,9:1, gris-clair 3,2:1 (légendes et libellés seulement, jamais
// un chiffre), vert 5,3:1, rouge 5,2:1, ambre 4,6:1, violet 5,2:1. Tous passent
// AA (4,5:1) sauf le gris-clair, qui passe AA « grand texte » (3:1).

export const COULEURS = {
  /** Le fond de page — le papier du carnet, sous les feuilles. */
  papier: "#f4f5f1",
  /** Une feuille posée dessus — les cartes, les tableaux. */
  feuille: "#ffffff",
  /** Le texte courant — un graphite, pas un noir. */
  graphite: "#1b1d24",
  gris: "#555a66",
  grisClair: "#8a8f9a",
  /** L'encre — la couleur de Pulse, des liens, du trait des courbes. */
  encre: "#2f44d0",
  /** Le surligneur — l'accent, jamais un fond de carte. */
  surligneur: "#ffe36e",
  pos: "#177a55",
  neg: "#c63b2b",
  warn: "#a8650a",
  instagram: "#7a4de8",
  /** Le fond d'un signal ambre — une donnée qui manque, pas une alarme. */
  alerte: "#fdf8ef",
  /** Les filets du millimétré et les grilles de graphique. */
  quadrillage: "#e4e6ec",
  axe: "#d3d6de",
} as const;

// Les couleurs d'identification des plateformes. Celles de Meta et Google ne
// sont PAS leurs couleurs de marque : quatre logos multicolores à côté les uns
// des autres font une vitrine de stickers. On garde leurs logos (qui se
// reconnaissent sans couleur) et une teinte maison, stable d'un écran à l'autre.
export const CANAL = {
  meta: COULEURS.encre,
  google: COULEURS.pos,
  instagram: COULEURS.instagram,
  site: "#5b6472",
} as const;
