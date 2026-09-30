import type { SVGProps } from "react";

// LES ICÔNES DE PULSE — un seul dessin, bicolore, sur une grille de 24.
//
// Elles remplacent des glyphes Unicode (▤ ◫ ◔ ⚯ ⧉) qui changeaient de dessin
// d'une police de repli à l'autre et se lisaient comme du bricolage. Pas de
// bibliothèque : il en faut quinze, et une bibliothèque d'icônes est
// reconnaissable entre mille — c'est l'inverse d'une identité.
//
// LA RÈGLE DU DESSIN : un trait de 1,6 en `currentColor`, extrémités rondes,
// et UNE surface pleine par icône à 16 % de la même couleur — la partie qui dit
// ce qu'est l'objet (la feuille du rapport, le centre de la cible, la part
// consommée de l'enveloppe). C'est ce qui les rend lisibles à 16 px et vivantes
// à 24, sans ajouter une deuxième couleur à gérer.
//
// Pas de directive : elles sont posées aussi bien par des composants serveur
// que client.

type Props = SVGProps<SVGSVGElement> & { taille?: number };

function Svg({ taille = 18, children, ...rest }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={taille}
      height={taille}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

const APLAT = { fill: "currentColor", fillOpacity: 0.16, stroke: "none" } as const;

/** Le rapport : une feuille au coin corné, un pouls écrit dessus. */
export function IconeRapport(p: Props) {
  return (
    <Svg {...p}>
      <path {...APLAT} d="M6 3h8.5L19 7.5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14.5 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7.5z" />
      <path d="M14.5 3v3.5a1 1 0 0 0 1 1H19" />
      <path d="M8 14.5h1.8l1.3-3.2 1.9 5.4 1.3-2.2H16" />
    </Svg>
  );
}

/** Les conversions : la cible, et ce qui l'atteint. */
export function IconeConversions(p: Props) {
  return (
    <Svg {...p}>
      <circle {...APLAT} cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" />
    </Svg>
  );
}

/** Les thèmes : l'étiquette qu'on pose sur une campagne ou une publication. */
export function IconeThemes(p: Props) {
  return (
    <Svg {...p}>
      <path {...APLAT} d="M3.5 4.5v6.3a1 1 0 0 0 .3.7l8.7 8.7a1 1 0 0 0 1.4 0l6.3-6.3a1 1 0 0 0 0-1.4L11.5 3.8a1 1 0 0 0-.7-.3H4.5a1 1 0 0 0-1 1z" />
      <path d="M3.5 4.5v6.3a1 1 0 0 0 .3.7l8.7 8.7a1 1 0 0 0 1.4 0l6.3-6.3a1 1 0 0 0 0-1.4L11.5 3.8a1 1 0 0 0-.7-.3H4.5a1 1 0 0 0-1 1z" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Les coûts : l'enveloppe de l'année, et la part déjà consommée. */
export function IconeCouts(p: Props) {
  return (
    <Svg {...p}>
      <path {...APLAT} d="M12 12V3.5A8.5 8.5 0 0 1 20.2 14.2z" />
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5V12l8.2 2.2" />
    </Svg>
  );
}

/** Meta : l'anneau de Möbius, au trait. */
export function IconeMeta(p: Props) {
  return (
    <Svg {...p}>
      <path d="M3.5 14.2c0-3.6 1.8-6.7 4.1-6.7 3.3 0 5.4 9 8.9 9 2.3 0 4-1.9 4-4.6 0-2.9-1.6-4.4-3.3-4.4-3.4 0-5.6 9-9.6 9-2.4 0-4.1-1.3-4.1-3.3z" />
    </Svg>
  );
}

/** Google : le G, au trait. */
export function IconeGoogle(p: Props) {
  return (
    <Svg {...p}>
      <path d="M19.2 7.4A8.5 8.5 0 1 0 20.5 12h-7.8" />
    </Svg>
  );
}

/** Instagram : l'objectif dans son boîtier arrondi. */
export function IconeInstagram(p: Props) {
  return (
    <Svg {...p}>
      <rect {...APLAT} x="3.5" y="3.5" width="17" height="17" rx="5" />
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="3.9" />
      <circle cx="17.1" cy="6.9" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Le site (Google Analytics) : trois barres qui montent. */
export function IconeSite(p: Props) {
  return (
    <Svg {...p}>
      <rect {...APLAT} x="15" y="4" width="4.5" height="16" rx="2.25" />
      <rect x="15" y="4" width="4.5" height="16" rx="2.25" />
      <rect x="9.25" y="9" width="4.5" height="11" rx="2.25" />
      <circle cx="5.75" cy="17.75" r="2.25" />
    </Svg>
  );
}

/** Les connexions : une prise branchée. */
export function IconeConnexions(p: Props) {
  return (
    <Svg {...p}>
      <path {...APLAT} d="M7 8h10v3.5a5 5 0 0 1-10 0z" />
      <path d="M7 8h10v3.5a5 5 0 0 1-10 0z" />
      <path d="M9.5 8V3.5M14.5 8V3.5M12 16.5V21" />
    </Svg>
  );
}

/** L'équipe : deux personnes, l'une devant l'autre. */
export function IconeEquipe(p: Props) {
  return (
    <Svg {...p}>
      <circle {...APLAT} cx="9" cy="8" r="3.5" />
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.8 19.5c.7-3.3 3.2-5.3 6.2-5.3s5.5 2 6.2 5.3" />
      <path d="M15.5 4.8a3.5 3.5 0 0 1 0 6.4M17.6 14.6c1.8.8 3.1 2.5 3.6 4.9" />
    </Svg>
  );
}

/** Replier / déplier la colonne : un panneau et son volet. */
export function IconePanneau(p: Props) {
  return (
    <Svg {...p}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
      <path {...APLAT} d="M6.5 4.5h3v15h-3a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3z" />
      <path d="M9.5 4.5v15" />
    </Svg>
  );
}

export function IconeFermer(p: Props) {
  return (
    <Svg {...p}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </Svg>
  );
}

export function IconeMenu(p: Props) {
  return (
    <Svg {...p}>
      <path d="M4 7h16M4 12h16M4 17h10" />
    </Svg>
  );
}

export function IconeSortie(p: Props) {
  return (
    <Svg {...p}>
      <path d="M14 4.5H7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h7" />
      <path d="M11 12h9.5M17.5 8.5 21 12l-3.5 3.5" />
    </Svg>
  );
}

/** Une donnée qui manque : un signal, pas une alarme. */
export function IconeAttention(p: Props) {
  return (
    <Svg {...p}>
      <path {...APLAT} d="M10.3 4.4 3.1 17.2A2 2 0 0 0 4.8 20h14.4a2 2 0 0 0 1.7-2.8L13.7 4.4a2 2 0 0 0-3.4 0z" />
      <path d="M10.3 4.4 3.1 17.2A2 2 0 0 0 4.8 20h14.4a2 2 0 0 0 1.7-2.8L13.7 4.4a2 2 0 0 0-3.4 0z" />
      <path d="M12 9.5v4" />
      <circle cx="12" cy="16.6" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconeFleche(p: Props) {
  return (
    <Svg {...p}>
      <path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5" />
    </Svg>
  );
}
