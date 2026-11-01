import type { ReportPayload } from "@/lib/report";
import { estFriseHebdo } from "@/lib/hebdo/frise";
import { SectionTitle } from "@/components/hebdo/section-titre";
import { FriseEtPanneau } from "@/components/hebdo/frise-et-panneau";

// ── CE QUI A ÉTÉ FAIT : LA FRISE DE L'ANNÉE ET LE PANNEAU DE LA SEMAINE ──────
//
// Ticket 07. L'ancienne frise de la semaine a quitté la page : un payload
// publié avant (ancienne forme de `frise`, ou pas de `semaine`) ne montre pas
// ce bloc plutôt que de le dessiner sur des règles qu'il ne porte pas — la
// frise place la semaine choisie à partir de `semaine.fin`.
export function CeQuiAEteFait({ report }: { report: ReportPayload }) {
  if (!estFriseHebdo(report.frise) || !report.semaine) return null;
  return (
    <section className="mb-9">
      <SectionTitle>Ce qui a été fait</SectionTitle>
      <FriseEtPanneau
        frise={report.frise}
        semaine={report.semaine}
        sources={report.sources ?? null}
      />
    </section>
  );
}
