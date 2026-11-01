// Les clés NEUVES du payload hebdo, toutes optionnelles : un payload publié
// avant leur bloc ne les porte pas, et la page retombe alors sur l'ancien
// affichage (`weekly_report/blocs/assemble.py` n'écrit pas une clé vide).
//
// Un fichier de types par bloc, réexportés ici une fois pour toutes : chaque
// ticket du chantier ajuste SON fichier sans toucher celui des autres.
//
// La nouvelle `frise` (`lib/hebdo/frise.ts`) porte le même nom que l'ancienne
// (`Frise` de `lib/report.ts`) : la clé reste déclarée là-bas, en union des
// deux formes, tant que des payloads publiés avant le ticket 07 existent. La
// page les distingue par `estFriseHebdo`.
import type { SemaineHebdo } from "@/lib/hebdo/semaine";
import type { SourcesHebdo, TotauxHebdo } from "@/lib/hebdo/sources";
import type { CanauxHebdo } from "@/lib/hebdo/canaux";

export type { SemaineHebdo, SourcesHebdo, TotauxHebdo, CanauxHebdo };
export type { EtatSource } from "@/lib/hebdo/sources";
export type { CanalHebdo, RatioHebdo } from "@/lib/hebdo/canaux";
export type { ChangementHebdo } from "@/lib/hebdo/changements";
export type { FriseHebdo, CampagneFrise, StatutCampagne } from "@/lib/hebdo/frise";

export type PayloadHebdo = {
  semaine?: SemaineHebdo | null;
  sources?: SourcesHebdo | null;
  totaux?: TotauxHebdo | null;
  canaux?: CanauxHebdo | null;
};
