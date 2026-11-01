// `payload.sources` et `payload.totaux` — ticket 04 (`blocs/sources.py`).
// Seules les sources BRANCHÉES ont une entrée, dans `sources` comme dans
// `totaux` : une clé absente veut dire « pas branchée », pas « zéro ».
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
