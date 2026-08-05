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

// Le gris des parts qui ne sont pas un thème (« autres », « sans thème »).
// Volontairement hors de SERIES : aucun vrai thème ne doit pouvoir le porter,
// sinon on croit lire une catégorie là où il n'y en a pas.
export const NEUTRE: Teinte = {
  nom: "neutre",
  trait: "#a8a8b0",
  aplat: "rgba(168, 168, 176, 0.14)",
};

// UNE COULEUR PAR LABEL, la même partout et d'une semaine à l'autre.
//
// La couleur venait du RANG dans la vue courante : position dans l'anneau
// (trié par dépense de la semaine), dans la frise, dans la liste des coûts
// (triée par dépense de l'année). Trois tris différents, donc trois couleurs
// différentes pour le même thème — et une couleur qui changeait dès qu'un
// thème dépensait plus qu'un autre. Une légende qu'il fallait relire à chaque
// bloc n'est pas une légende.
//
// On indexe donc sur la liste maîtresse des thèmes (profiles.labels), qui est
// stable et partagée par toute l'application. Un thème absent de cette liste —
// un label supprimé mais encore porté par d'anciennes campagnes — retombe sur
// une empreinte de son nom : arbitraire, mais constante.
// Le pas d'avancement dans la gamme. La liste maîtresse est alphabétique :
// sans pas, deux thèmes voisins dans l'alphabet — « Gamme » et « Gastronomie »
// — prendraient deux teintes voisines dans la roue, donc presque la même. Un
// pas premier avec la taille de la gamme parcourt les 20 sans jamais en
// répéter une, en sautant chaque fois à l'opposé.
const PAS = 7;

export function teinteLabel(label: string | null | undefined, univers?: string[]): Teinte {
  if (!label) return NEUTRE;
  const i = (univers ?? []).indexOf(label);
  if (i >= 0) return teinte(i * PAS);
  let h = 0;
  for (let k = 0; k < label.length; k++) h = (h * 31 + label.charCodeAt(k)) >>> 0;
  return teinte(h);
}
