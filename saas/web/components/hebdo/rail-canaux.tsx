import type { ReportPayload } from "@/lib/report";
import { CanalMuetAlerte } from "@/components/canal-muet";
import { KpiFocusCard } from "@/components/kpi-focus";
import { Triangle } from "@/components/pente";
import { SectionTitle } from "@/components/hebdo/section-titre";

// ── LE RAIL DES CANAUX — ticket 05 ───────────────────────────────────────────
//
// Pas encore construit. En attendant, ce slot rend l'ANCIEN haut de page tel
// qu'il était : l'alerte « canal muet », le verdict et la boussole. Le
// ticket 05 remplace tout ce fichier par le rail des cartes de canal.

// Le verdict, en chiffre : l'écart en très grand, la phrase entière dessous.
// Sans les clés `verdict_*` (rapports publiés avant), on retombe sur la phrase.
function Verdict({ report }: { report: ReportPayload }) {
  const pct = report.verdict_pct;
  const ton = report.verdict_tone ?? "stable";
  if (pct === null || pct === undefined || !report.verdict_metric) {
    return (
      <h2 className="font-serif text-[22px] sm:text-[26px] leading-[1.15] text-ink text-balance">
        {report.verdict}
      </h2>
    );
  }
  const cls = ton === "pos" ? "text-pos" : ton === "neg" ? "text-neg" : "text-muted";
  const plat = Math.abs(pct) <= 0.5;
  return (
    <div>
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className={`font-mono text-[52px] sm:text-[68px] leading-[0.9] font-medium ${cls}`}>
          {plat ? "≈" : <Triangle sens={pct > 0 ? "haut" : "bas"} />} {pct > 0 ? "+" : ""}
          {pct.toFixed(0)}
          <span className="text-[26px] sm:text-[32px]"> %</span>
        </span>
        <span className="font-serif text-[17px] sm:text-[19px] text-muted leading-tight">
          {report.verdict_metric}
        </span>
      </div>
      <h2 className="font-serif text-[17px] sm:text-[19px] leading-snug text-ink text-balance mt-2 max-w-[60ch]">
        {report.verdict}
      </h2>
    </div>
  );
}

export function RailCanaux({ report }: { report: ReportPayload }) {
  return (
    <>
      <div className="mb-7">
        {/* Ce qu'on n'a pas pu lire passe AVANT le verdict qu'il conditionne. */}
        <CanalMuetAlerte canaux={report.canaux_muets} />
        <div className="rounded-2xl border border-line bg-white shadow-card px-5 py-5 sm:px-7 sm:py-6">
          <Verdict report={report} />
        </div>
      </div>
      {report.kpi_focus && (
        <section className="mb-9">
          <SectionTitle>Ta semaine</SectionTitle>
          <p className="text-[12.5px] text-muted leading-relaxed mb-3.5 -mt-1 max-w-[68ch]">
            La vue d&apos;ensemble du compte : tout ce que tu publies et achètes, sans
            filtre. Choisis l&apos;indicateur que tu veux suivre.
          </p>
          <KpiFocusCard k={report.kpi_focus} />
        </section>
      )}
    </>
  );
}
