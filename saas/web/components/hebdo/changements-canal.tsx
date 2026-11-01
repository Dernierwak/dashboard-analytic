import type { ReportPayload } from "@/lib/report";
import type { ChangementApi } from "@/lib/changements-api";
import type { CanalHebdo } from "@/lib/hebdo/payload";
import { Changements } from "@/components/changements";
import { SectionTitle } from "@/components/hebdo/section-titre";

// ── LES CHANGEMENTS DE LA SEMAINE, SUR LA CARTE DU CANAL — ticket 06 ─────────
// Pas encore construit : ne rend rien.
export function ChangementsCanal(props: { canal: string; donnees: CanalHebdo }) {
  void props;
  return null;
}

// ── L'ANCIEN BLOC « CE QUI A BOUGÉ SUR LES PLATEFORMES » ─────────────────────
//
// Déplacé tel quel depuis `app/page.tsx` ; le ticket 06 le vide quand les
// changements arrivent par le payload, sur la carte du canal.
//
// `changementsApi` arrive en PROMESSE : la page lance la lecture en même
// temps que `getWeeklyData`, sans l'attendre — enchaîner les deux
// additionnerait les allers-retours Supabase sur la page la plus lue.
export async function AnciensChangements({
  report,
  changementsApi,
}: {
  report: ReportPayload;
  changementsApi: Promise<ChangementApi[]>;
}) {
  const changements = report.changements ?? [];
  const api = await changementsApi;
  if (changements.length + api.length === 0) return null;
  return (
    <section className="mb-9">
      <SectionTitle>Ce qui a bougé sur les plateformes</SectionTitle>
      <div className="bg-white border border-line rounded-xl shadow-card px-4 py-3.5">
        <Changements changements={changements} changementsApi={api} maxH="max-h-[320px]" />
      </div>
    </section>
  );
}
