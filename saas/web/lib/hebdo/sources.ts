// `payload.sources` et `payload.totaux` — ticket 04 (`blocs/sources.py`).
// Forme proposée par `.scratch/hebdo/spec.md` ; le ticket 04 la fixe.
export type EtatSource = "recolte" | "jeton_mort" | "panne";

export type SourcesHebdo = Record<
  string,
  { etat: EtatSource; connecte_le: string | null; journal: "couvert" | "non_couvert" }
>;

/** `null` quand la source n'a pas `etat: "recolte"` — jamais 0 (`CLAUDE.md` §7). */
export type TotauxHebdo = {
  depense: { meta?: number | null; google?: number | null };
  impressions: { meta?: number | null; google?: number | null };
};
