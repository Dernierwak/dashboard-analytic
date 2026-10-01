// Le nuancier des séries — un seul endroit pour toutes les couleurs qui
// distinguent des catégories (thèmes, canaux, parts d'un anneau).
//
// Le principe qui les tient ensemble : chaque teinte est posée en aplat très
// dilué (~14 % d'opacité) et reprise en trait plein pour le contour. C'est ce
// qui donnait sa douceur au violet Instagram — on l'applique à toute la gamme
// plutôt que d'empiler des aplats saturés qui se battent entre eux.
//
// L'ordre compte : les quatre premières sont les couleurs maison (bleu Meta,
// vert Google, violet Instagram, ambre), les suivantes prolongent la roue sans
// jamais tomber sur deux teintes voisines côte à côte.

export type Teinte = { trait: string; aplat: string; nom: string };

export const SERIES: Teinte[] = [
  { nom: "bleu", trait: "#1a56ff", aplat: "rgba(26, 86, 255, 0.14)" },
  { nom: "violet", trait: "#7b4fff", aplat: "rgba(123, 79, 255, 0.14)" },
  { nom: "vert", trait: "#1a7a4a", aplat: "rgba(26, 122, 74, 0.14)" },
  { nom: "ambre", trait: "#e08b1a", aplat: "rgba(224, 139, 26, 0.16)" },
  { nom: "rose", trait: "#e0459b", aplat: "rgba(224, 69, 155, 0.14)" },
  { nom: "turquoise", trait: "#0d9aa8", aplat: "rgba(13, 154, 168, 0.14)" },
  { nom: "indigo", trait: "#4b3fbd", aplat: "rgba(75, 63, 189, 0.14)" },
  { nom: "corail", trait: "#e05a45", aplat: "rgba(224, 90, 69, 0.14)" },
  { nom: "olive", trait: "#7a8b1a", aplat: "rgba(122, 139, 26, 0.16)" },
  { nom: "ardoise", trait: "#5b6472", aplat: "rgba(91, 100, 114, 0.14)" },
  // Dix teintes de plus. Dix ne suffisaient pas : un compte réel porte ici 35
  // thèmes, et trois d'entre eux se retrouvaient en ambre — on lisait la même
  // couleur pour trois sujets différents. Vingt ne règlent pas le cas d'un
  // compte à cent thèmes, mais elles couvrent largement ce qui s'affiche à un
  // instant donné (une quinzaine).
  { nom: "cyan", trait: "#0e7ec7", aplat: "rgba(14, 126, 199, 0.14)" },
  { nom: "prune", trait: "#8e3b6b", aplat: "rgba(142, 59, 107, 0.14)" },
  { nom: "mousse", trait: "#4a7c3f", aplat: "rgba(74, 124, 63, 0.14)" },
  { nom: "brique", trait: "#b5502a", aplat: "rgba(181, 80, 42, 0.14)" },
  { nom: "lavande", trait: "#9a7bd6", aplat: "rgba(154, 123, 214, 0.16)" },
  { nom: "sable", trait: "#b8923f", aplat: "rgba(184, 146, 63, 0.16)" },
  { nom: "menthe", trait: "#2fa88a", aplat: "rgba(47, 168, 138, 0.14)" },
  { nom: "bordeaux", trait: "#8c2f3f", aplat: "rgba(140, 47, 63, 0.14)" },
  { nom: "acier", trait: "#3f6f8f", aplat: "rgba(63, 111, 143, 0.14)" },
  { nom: "fuchsia", trait: "#b83ac0", aplat: "rgba(184, 58, 192, 0.14)" },
];

export function teinte(i: number): Teinte {
  return SERIES[i % SERIES.length];
}

// Le gris des parts qui ne sont pas une catégorie (« autres »).
// Volontairement hors de SERIES : aucune vraie part ne doit pouvoir le porter,
// sinon on croit lire une catégorie là où il n'y en a pas.
export const NEUTRE: Teinte = {
  nom: "neutre",
  trait: "#a8a8b0",
  aplat: "rgba(168, 168, 176, 0.14)",
};
