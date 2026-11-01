// `payload.canaux` — ticket 05 (`blocs/canaux.py`). Les changements de la
// carte ont leur propre type (`changements.ts`, ticket 06).
//
// Module SANS directive : la carte du canal (`carte-canal.tsx`, rendue côté
// serveur) lit la table des ratios, la moustache ses types. Le rail qui fait
// défiler les cartes est client (`rail-defilant.tsx`) mais ne lit pas ce
// module : il reçoit les cartes déjà rendues. Sans directive, un composant
// client pourra le lire sans qu'une constante exportée devienne un proxy
// côté serveur (`CLAUDE.md` §8).
import type { ChangementHebdo } from "@/lib/hebdo/changements";

export type RatioHebdo = {
  /** `null` si le dénominateur vaut 0, ou si la source n'a pas `etat: "recolte"`. */
  valeur: number | null;
  /** Les semaines de l'historique qui ont un ratio, la plus ancienne d'abord. */
  semaines: number[];
  n: number;
  /** `null` si n < 6. */
  mediane: number | null;
  q1: number | null;
  q3: number | null;
  /** La POSITION seule ; le sens (mieux / moins bien) se décide à l'affichage. */
  etat: "au_dessus" | "dans" | "en_dessous" | null;
};

export type CanalHebdo = {
  /** `null` partout quand la source n'a pas `etat: "recolte"` ; 0 = rien diffusé. */
  volumes: { depense: number | null; impressions: number | null; clics: number | null };
  ratios: { ctr: RatioHebdo; cpc: RatioHebdo; cpm: RatioHebdo };
  changements?: ChangementHebdo[];
};

export type CanauxHebdo = Record<string, CanalHebdo>;

/** Sous ce seuil, `blocs/canaux.py MINIMUM` ne rend ni quartiles ni état. */
export const SEMAINES_MINIMUM = 6;

export type CleRatio = keyof CanalHebdo["ratios"];

export type DefRatio = {
  cle: CleRatio;
  nom: string;
  /** Où est le mieux : un CTR haut, un CPC ou un CPM bas. */
  mieux: "haut" | "bas";
  format: (v: number) => string;
};

const decimales = (v: number, d: number) =>
  v.toLocaleString("fr-CH", { minimumFractionDigits: d, maximumFractionDigits: d });

export const RATIOS: DefRatio[] = [
  { cle: "ctr", nom: "CTR", mieux: "haut", format: (v) => `${decimales(v, 2)} %` },
  // Un CPC sous 10 centimes arrondi à 2 décimales se lirait 0,04 pour 0,036 :
  // une troisième décimale garde l'ordre des semaines lisible.
  { cle: "cpc", nom: "CPC", mieux: "bas", format: (v) => `${decimales(v, v < 0.1 ? 3 : 2)} CHF` },
  { cle: "cpm", nom: "CPM", mieux: "bas", format: (v) => `${decimales(v, 2)} CHF` },
];

export type Jugement = "mieux" | "moins" | "dans";

/** La position du payload lue dans le sens du ratio — `null` sans état. */
export function jugement(ratio: RatioHebdo, mieux: DefRatio["mieux"]): Jugement | null {
  if (!ratio.etat) return null;
  if (ratio.etat === "dans") return "dans";
  return (ratio.etat === "au_dessus") === (mieux === "haut") ? "mieux" : "moins";
}

/** La page de chaque canal, où mène son nom. */
export const PAGE_CANAL: Record<string, string> = { meta: "/meta", google: "/google" };
