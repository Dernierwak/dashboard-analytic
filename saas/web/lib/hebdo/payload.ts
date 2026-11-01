// Les clés du payload hebdo, toutes optionnelles : un payload publié avant
// leur bloc ne les porte pas, et la page ne rend rien à leur place
// (`weekly_report/blocs/assemble.py` n'écrit pas une clé vide).
//
// Un fichier de types par bloc, réexportés ici une fois pour toutes : chaque
// ticket du chantier ajuste SON fichier sans toucher celui des autres.
//
// La clé `frise` est déclarée dans `lib/report.ts`, en `unknown` : des
// payloads publiés avant le ticket 07 portent une autre forme sous ce nom. La
// page la lit toujours par `estFriseHebdo`.
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
