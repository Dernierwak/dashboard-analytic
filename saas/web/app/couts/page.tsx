// Coûts du mois — même base que la page Streamlit : dépense par canal vs
// budget avec repère, graphe journalier empilé, budgets de l'année (table
// éditable, dépliable), dépense du mois par thème.
import { getCoutsData, type ChannelCout, type CoutDay } from "@/lib/couts";
import { fmtCHF } from "@/lib/report";
import { SiteHeader } from "@/components/site-header";
import { BudgetEditor } from "@/components/budget-editor";
import { BudgetYearTable } from "@/components/budget-year-table";

export const dynamic = "force-dynamic";

function Pacing({ ch, elapsed }: { ch: ChannelCout; elapsed: number }) {
  if (ch.budget <= 0) {
    return (
      <p className="text-[11.5px] text-faint mt-2">
        Pas de budget défini — fixe-le ci-dessous pour voir le rythme du mois.
      </p>
    );
  }
  const ratio = ch.spent / ch.budget;
  const fill = Math.min(1, ratio);
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

// Graphe empilé : dépense par jour, Meta (bleu) + Google (vert).
function StackedDaily({ daily }: { daily: CoutDay[] }) {
  if (daily.length === 0) return null;
  const max = Math.max(...daily.map((p) => p.meta + p.google), 1);
  const W = 640, H = 130, PAD = 4;
  const bw = (W - PAD * 2) / daily.length;
  const step = Math.max(1, Math.ceil(daily.length / 8));
  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-5 mb-8">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <div className="text-[10px] uppercase tracking-wide text-faint font-semibold">
          Dépense par jour · mois en cours
        </div>
        <div className="flex items-center gap-3 text-[10.5px] text-faint">
          <span><span style={{ color: "#1a56ff" }}>■</span> Meta</span>
          <span><span style={{ color: "#1a7a4a" }}>■</span> Google</span>
          <span>max {fmtCHF(max)} CHF / jour</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label="Dépense par jour et par canal">
        {daily.map((p, i) => {
          const hMeta = (p.meta / max) * (H - 8);
          const hGoog = (p.google / max) * (H - 8);
          const x = PAD + i * bw + bw * 0.15;
          const wRect = bw * 0.7;
          return (
            <g key={p.date}>
              <title>{`${p.label} — Meta ${p.meta.toFixed(0)} CHF · Google ${p.google.toFixed(0)} CHF`}</title>
              {p.google > 0 && (
                <rect x={x} y={H - hGoog} width={wRect} height={hGoog} rx={1.5} fill="#1a7a4a" opacity={0.85} />
              )}
              {p.meta > 0 && (
                <rect x={x} y={H - hGoog - hMeta} width={wRect} height={hMeta} rx={1.5} fill="#1a56ff" opacity={0.85} />
              )}
              {i % step === 0 && (
                <text x={x + wRect / 2} y={H + 14} textAnchor="middle" fontSize="10" fill="#8b8e98">
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default async function CoutsPage() {
  const data = await getCoutsData();
  const reste = data.totalBudget - data.totalSpent;

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
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
      <div className="flex overflow-x-auto sm:grid sm:grid-cols-3 gap-3 mb-8 pb-1 sm:pb-0">
        <div className="bg-white border border-line rounded-xl p-4 min-w-[200px] shrink-0 sm:min-w-0 sm:shrink">
          <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1.5">
            Dépensé
          </div>
          <div className="font-mono text-xl font-medium text-ink">
            {fmtCHF(data.totalSpent)} CHF
          </div>
          <div className="text-[11px] text-faint mt-1">
            tous canaux · du 01 au {String(new Date().getDate()).padStart(2, "0")}{" "}
            {data.monthLabel.split(" ")[0]}
          </div>
        </div>
        <div className="bg-white border border-line rounded-xl p-4 min-w-[200px] shrink-0 sm:min-w-0 sm:shrink">
          <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1.5">
            Budget
          </div>
          <div className="font-mono text-xl font-medium text-ink">
            {data.totalBudget > 0 ? `${fmtCHF(data.totalBudget)} CHF` : "—"}
          </div>
          <div className="text-[11px] text-faint mt-1">mensuel, tous canaux</div>
        </div>
        <div className="bg-white border border-line rounded-xl p-4 min-w-[200px] shrink-0 sm:min-w-0 sm:shrink">
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

      {/* Graphe empilé */}
      <StackedDaily daily={data.daily} />

      {/* Par canal */}
      <h2 className="text-[14px] font-semibold text-ink mb-3">Par canal</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
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
            <BudgetEditor channel={ch.key} current={ch.budget} />
          </div>
        ))}
      </div>

      {/* Par thème — où va ton budget, thème par thème */}
      {data.byTheme.length > 0 && (
        <div className="mb-8">
          <h2 className="text-[14px] font-semibold text-ink mb-3">
            Par thème{" "}
            <span className="text-faint font-normal">
              · dépense du mois · fixe un budget par thème pour suivre
            </span>
          </h2>
          <div className="bg-white border border-line rounded-xl shadow-card divide-y divide-line">
            {data.byTheme.map((t) => {
              const share = data.totalSpent > 0 ? (t.spend / data.totalSpent) * 100 : 0;
              const ratio = t.budget > 0 ? t.spend / t.budget : null;
              return (
                <div key={t.label} className="px-5 py-3.5">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[13px] font-semibold text-brand">{t.label}</span>
                    <span className="text-[11px] text-faint">
                      {share.toFixed(0)} % de la dépense du mois
                    </span>
                    <span className="ml-auto font-mono text-[13px] text-ink">
                      {fmtCHF(t.spend)} CHF
                      {t.budget > 0 && (
                        <span className="text-faint text-[11.5px]"> / {fmtCHF(t.budget)}</span>
                      )}
                    </span>
                  </div>
                  {ratio !== null ? (
                    <div className="mt-2">
                      <div className="relative h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{
                            width: `${Math.min(100, ratio * 100)}%`,
                            background: ratio > 1 ? "#c0392b" : ratio > data.elapsed + 0.1 ? "#b86b00" : "#1a56ff",
                          }}
                        />
                        <div
                          className="absolute inset-y-0 w-[2px] bg-ink/50"
                          style={{ left: `${data.elapsed * 100}%` }}
                          title="Repère : part du mois écoulée"
                        />
                      </div>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-[10.5px] text-faint">
                          {Math.round(ratio * 100)} % du budget thème · repère{" "}
                          {Math.round(data.elapsed * 100)} %
                        </span>
                        {ratio > 1 && (
                          <span className="text-[11px] font-semibold text-neg">
                            dépassé de {fmtCHF(t.spend - t.budget)} CHF
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1.5 h-1.5 rounded-full bg-black/[0.05] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand/40"
                        style={{ width: `${Math.min(100, share)}%` }}
                      />
                    </div>
                  )}
                  <BudgetEditor channel={`label:${t.label}`} current={t.budget} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Budgets de l'année — dépliable, on travaille directement dedans */}
      <details className="mb-6">
        <summary className="text-[14px] font-semibold text-ink cursor-pointer select-none mb-3">
          ▦ Budgets par mois · {data.monthLabel.slice(-4)} — voir et modifier
        </summary>
        <div className="mt-3">
          <BudgetYearTable months={data.months} />
        </div>
      </details>

      <p className="text-[11.5px] text-faint leading-relaxed">
        ▏ Le repère marque la part du mois écoulée : une barre qui le dépasse
        largement dépense plus vite que le calendrier. La projection suppose un
        rythme constant — un boost ponctuel la fausse temporairement.
      </p>
    </main>
  );
}
