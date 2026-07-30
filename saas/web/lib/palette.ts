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
];

export function teinte(i: number): Teinte {
  return SERIES[i % SERIES.length];
}
