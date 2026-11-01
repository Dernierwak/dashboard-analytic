// Les clés NEUVES du payload hebdo, toutes optionnelles : un payload publié
// avant leur bloc ne les porte pas, et la page retombe alors sur l'ancien
// affichage (`weekly_report/blocs/assemble.py` n'écrit pas une clé vide).
//
// Un fichier de types par bloc, réexportés ici une fois pour toutes : chaque
// ticket du chantier ajuste SON fichier sans toucher celui des autres.
//
// La nouvelle `frise` (tickets 07 à 09) n'est pas déclarée ici : elle porte le
// même nom que l'ancienne (`Frise` de `lib/report.ts`), et c'est le ticket 07
// qui fait la bascule.
import type { SemaineHebdo } from "@/lib/hebdo/semaine";
import type { SourcesHebdo, TotauxHebdo } from "@/lib/hebdo/sources";
import type { CanauxHebdo } from "@/lib/hebdo/canaux";

export type { SemaineHebdo, SourcesHebdo, TotauxHebdo, CanauxHebdo };
export type { EtatSource } from "@/lib/hebdo/sources";
export type { CanalHebdo, RatioHebdo } from "@/lib/hebdo/canaux";
export type { ChangementHebdo } from "@/lib/hebdo/changements";

export type PayloadHebdo = {
  semaine?: SemaineHebdo | null;
  sources?: SourcesHebdo | null;
  totaux?: TotauxHebdo | null;
  canaux?: CanauxHebdo | null;
};
