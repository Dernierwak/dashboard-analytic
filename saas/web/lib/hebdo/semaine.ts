// `payload.semaine` — écrit par `weekly_report/blocs/semaine.py`.
//
// 7 jours pleins qui finissent la veille du dernier Jour de travail, quel que
// soit le jour du recalcul. La page la LIT, elle ne la recalcule pas : seule la
// carte « compte neuf », qui n'a pas de payload, applique la règle côté web.
export type SemaineHebdo = {
  /** Premier jour, « 2026-10-22 ». */
  debut: string;
  /** Dernier jour : la veille du Jour de travail — jamais le jour du fetch. */
  fin: string;
  /** Numéro de semaine ISO de `fin`. */
  numero: number;
};
