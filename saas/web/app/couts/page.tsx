// Coûts du mois — dépense par canal vs budget, avec le repère du mois écoulé.
// Sobre : pas de graphique, des jauges. L'édition des budgets reste dans le
// dashboard actuel (table annuelle) — ici on lit, on comprend, on décide.

import { getCoutsData, type ChannelCout } from "@/lib/couts";
import { fmtCHF } from "@/lib/report";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

function Pacing({ ch, elapsed }: { ch: ChannelCout; elapsed: number }) {
  if (ch.budget <= 0) {
    return (
      <p className="text-[11.5px] text-faint mt-2">
        Pas de budget défini — règle-le dans le dashboard actuel (page Coûts).
      </p>
    );
  }
  const ratio = ch.spent / ch.budget;
  const fill = Math.min(1, ratio);
  // Rythme : on compare la part dépensée à la part du mois écoulée (repère).
  const proj = elapsed > 0 ? ch.spent / elapsed : 0;
  const over = proj > ch.budget * 1.05;
  const under = proj < ch.budget * 0.7;
  const barColor = ratio > 1 ? "#c0392b" : over ? "#b86b00" : ch.color;

  return (
    <div className="mt-3">
      <div className="relative h-2 rounded-full bg-black/[0.06] overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${fill * 100}%`, background: barColor }}
        />
        {/* Repère ▏: où on DEVRAIT en être si la dépense était linéaire */}
        <div
          className="absolute inset-y-0 w-[2px] bg-ink/50"
          style={{ left: `${elapsed * 100}%` }}
          title="Repère : part du mois écoulée"
        />
      </div>
      <div className="flex items-baseline justify-between mt-1.5">
        <span className="text-[11px] text-faint">
          {Math.round(ratio * 100)} % du budget · repère {Math.round(elapsed * 100)} %
        </span>
        <span
          className={`text-[11.5px] font-semibold ${
            ratio > 1 ? "text-neg" : over ? "text-warn" : "text-pos"
          }`}
        >
          {ratio > 1
            ? `dépassé de ${fmtCHF(ch.spent - ch.budget)} CHF`
            : over
              ? `projection ${fmtCHF(proj)} CHF — trop vite`
              : under
                ? `projection ${fmtCHF(proj)} CHF — sous le rythme`
                : `projection ${fmtCHF(proj)} CHF — rythme OK`}
        </span>
      </div>
    </div>
  );
}

export default async function CoutsPage() {
  const data = await getCoutsData();
  const reste = data.totalBudget - data.totalSpent;

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
      <SiteHeader email={data.email} active="couts" />

      {/* Hero */}
      <div className="mb-7">
        <p className="text-[11px] uppercase tracking-widest text-faint font-semibold mb-1.5">
          {data.monthLabel} · mois en cours
        </p>
        <h1 className="font-serif text-3xl sm:text-[34px] leading-tight text-ink">
          Coûts du mois.
        </h1>
      </div>

      {/* Vue d'ensemble */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        <div className="bg-white border border-line rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1.5">
            Dépensé
          </div>
          <div className="font-mono text-xl font-medium text-ink">
            {fmtCHF(data.totalSpent)} CHF
          </div>
          <div className="text-[11px] text-faint mt-1">tous canaux</div>
        </div>
        <div className="bg-white border border-line rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1.5">
            Budget
          </div>
          <div className="font-mono text-xl font-medium text-ink">
            {data.totalBudget > 0 ? `${fmtCHF(data.totalBudget)} CHF` : "—"}
          </div>
          <div className="text-[11px] text-faint mt-1">mensuel, tous canaux</div>
        </div>
        <div className="bg-white border border-line rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1.5">
            Reste
          </div>
          <div
            className={`font-mono text-xl font-medium ${
              data.totalBudget > 0 && reste < 0 ? "text-neg" : "text-ink"
            }`}
          >
            {data.totalBudget > 0 ? `${fmtCHF(reste)} CHF` : "—"}
          </div>
          <div className="text-[11px] text-faint mt-1">
            {Math.round(data.elapsed * 100)} % du mois écoulé
          </div>
        </div>
      </div>

      {/* Par canal */}
      <h2 className="text-[14px] font-semibold text-ink mb-3">Par canal</h2>
      <div className="space-y-3 mb-8">
        {data.channels.map((ch) => (
          <div key={ch.key} className="bg-white border border-line rounded-xl shadow-card p-5">
            <div className="flex items-center gap-3">
              <span className="text-[16px]" style={{ color: ch.color }}>
                {ch.icon}
              </span>
              <span className="text-[14px] font-semibold text-ink">{ch.name}</span>
              <span className="ml-auto font-mono text-[15px] text-ink">
                {fmtCHF(ch.spent)} CHF
                {ch.budget > 0 && (
                  <span className="text-faint text-[12px]"> / {fmtCHF(ch.budget)}</span>
                )}
              </span>
            </div>
            <Pacing ch={ch} elapsed={data.elapsed} />
          </div>
        ))}
      </div>

      <p className="text-[11.5px] text-faint leading-relaxed">
        ▏ Le repère marque la part du mois écoulée : une barre qui le dépasse
        largement dépense plus vite que le calendrier. La projection suppose un
        rythme constant — un boost ponctuel la fausse temporairement.
      </p>
    </main>
  );
}
