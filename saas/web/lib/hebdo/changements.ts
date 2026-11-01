// `payload.canaux[c].changements` — ticket 06 (`blocs/changements.py`).
// Forme proposée par `.scratch/hebdo/spec.md` ; le ticket 06 la fixe.
export type ChangementHebdo = {
  jour: string;
  categorie: string;
  campaign_id: string | null;
  campagne: string | null;
  objet: string | null;
  resume: string;
};
