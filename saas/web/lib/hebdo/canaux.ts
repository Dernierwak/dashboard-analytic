// `payload.canaux` — ticket 05 (`blocs/canaux.py`). Forme proposée par
// `.scratch/hebdo/spec.md` ; le ticket 05 la fixe. Les changements de la carte
// ont leur propre type (`changements.ts`, ticket 06).
import type { ChangementHebdo } from "@/lib/hebdo/changements";

export type RatioHebdo = {
  valeur: number | null;
  semaines: number[];
  n: number;
  /** `null` si n < 6. */
  mediane: number | null;
  q1: number | null;
  q3: number | null;
  etat: "au_dessus" | "dans" | "en_dessous" | null;
};

export type CanalHebdo = {
  volumes: { depense: number | null; impressions: number | null; clics: number | null };
  ratios: { ctr: RatioHebdo; cpc: RatioHebdo; cpm: RatioHebdo };
  changements?: ChangementHebdo[];
};

export type CanauxHebdo = Record<string, CanalHebdo>;
