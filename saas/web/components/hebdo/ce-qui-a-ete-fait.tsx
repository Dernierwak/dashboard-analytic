import type { ReportPayload } from "@/lib/report";
import { FriseSemaine } from "@/components/frise-semaine";

// ── CE QUI A ÉTÉ FAIT : LA FRISE ET LE PANNEAU DE LA SEMAINE — ticket 07 ─────
//
// Pas encore construit. En attendant, ce slot rend l'ANCIENNE frise de la
// semaine, sous la boussole comme avant.
export function CeQuiAEteFait({ report }: { report: ReportPayload }) {
  if (!report.frise) return null;
  return (
    <div className="mb-9">
      <FriseSemaine f={report.frise} />
    </div>
  );
}
