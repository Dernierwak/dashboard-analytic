// L'axe commun d'une rangée : le nuage et les moustaches le partagent, pour
// qu'un point se lise à la hauteur de la boîte d'à côté (spec, « même axe »).
// Sans directive ni JSX : les deux dessins l'importent côté serveur.

export const HAUTEUR = 210;
const HAUT = 22;
const BAS = 40;

/** Un peu d'air au-dessus du plus haut bout de moustache, pour l'étiquette. */
const MARGE = 1.08;

/** Valeur → ordonnée. Le bas de l'axe est 0 : toutes les métriques du
 *  Sélecteur sont positives, et une boîte posée sur un axe tronqué se lit
 *  plus haute qu'elle n'est. */
export function ordonnee(axeMax: number): (v: number) => number {
  const plafond = axeMax * MARGE;
  return (v) => HAUTEUR - BAS - (Math.min(v, plafond) / plafond) * (HAUTEUR - BAS - HAUT);
}

/** Le haut de la zone de dessin — où se posent les marques « hors de l'axe ». */
export const Y_HAUT = HAUT;
export const Y_BAS = HAUTEUR - BAS;
