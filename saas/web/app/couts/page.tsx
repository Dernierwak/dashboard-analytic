// Coûts du mois — même base que la page Streamlit : dépense par canal vs
// budget avec repère, graphe journalier empilé, budgets de l'année (table
// éditable, dépliable), dépense du mois par thème.
import { getCoutsData, type ChannelCout, type CoutDay, type ThemeSpend } from "@/lib/couts";
import { fmtCHF } from "@/lib/report";
import { SiteHeader } from "@/components/site-header";
import { BudgetEditor } from "@/components/budget-editor";
import { BudgetYearTable } from "@/components/budget-year-table";
import { ScrollList } from "@/components/scroll-list";
import { LineChart } from "@/components/line-chart";

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
  // Deux courbes plutôt qu'un empilement : on compare les canaux entre eux,
  // au lieu de lire une somme dont il faut soustraire mentalement le bas.
  const max = Math.max(...daily.map((p) => Math.max(p.meta, p.google)), 1);
  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-5 mb-8">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <div className="text-[10px] uppercase tracking-wide text-faint font-semibold">
          Dépense par jour · mois en cours
        </div>
        <div className="flex items-center gap-3 text-[10.5px] text-faint">
          <span><span style={{ color: "#1a56ff" }}>■</span> Meta</span>
          <span><span style={{ color: "#1a7a4a" }}>■</span> Google</span>
          <span>max {fmtCHF(max)} CHF / jour et canal</span>
        </div>
      </div>
      <LineChart
        labels={daily.map((p) => p.label)}
        series={[
          { name: "Meta", color: "#1a56ff", values: daily.map((p) => p.meta) },
          { name: "Google", color: "#1a7a4a", values: daily.map((p) => p.google) },
        ]}
        fmt={(v) => fmtCHF(v)}
        unit=" CHF"
        ariaLabel="Dépense par jour et par canal"
      />
    </div>
  );
}


// Réconciliation des deux niveaux de budget : celui que tu fixes par PLATEFORME
// (Meta, Google) et ceux que tu fixes par THÈME. Les seconds se découpent dans
// les premiers — sans cette vue, on ne sait jamais s'il reste de la marge à
// répartir ni si on a promis deux fois le même franc.
function RepartitionBudget({
  byTheme,
  totalBudget,
}: {
  byTheme: ThemeSpend[];
  totalBudget: number;
}) {
  const attribue = byTheme.reduce((a, t) => a + t.budget, 0);
  const avecBudget = byTheme.filter((t) => t.budget > 0);
  const reste = totalBudget - attribue;
  const depasse = reste < 0;

  if (totalBudget <= 0) {
    return (
      <div className="bg-white border border-line rounded-xl shadow-card p-5 mb-4">
        <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1.5">
          Répartition du budget
        </div>
        <p className="text-[12.5px] text-muted leading-relaxed">
          Fixe d&apos;abord un budget par plateforme ci-dessus — les budgets par
          thème viendront s&apos;y découper, et tu verras ce qu&apos;il te reste à
          répartir.
        </p>
      </div>
    );
  }

  // Chaque thème prend sa part de la barre ; le reste est le non-attribué.
  const base = Math.max(totalBudget, attribue);
  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-5 mb-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2.5">
        <div className="text-[10px] uppercase tracking-wide text-faint font-semibold">
          Répartition du budget · thèmes dans plateformes
        </div>
        <div className="font-mono text-[12.5px] text-ink">
          {fmtCHF(attribue)} <span className="text-faint">/ {fmtCHF(totalBudget)} CHF</span>
        </div>
      </div>

      <div className="flex h-3 rounded-full overflow-hidden bg-black/[0.05]">
        {avecBudget.map((t, i) => (
          <div
            key={t.label}
            style={{
              width: `${(t.budget / base) * 100}%`,
              background: "#1a56ff",
              opacity: 1 - Math.min(0.55, i * 0.13),
            }}
            title={`${t.label} — ${fmtCHF(t.budget)} CHF`}
          />
        ))}
        {!depasse && reste > 0 && (
          <div
            style={{ width: `${(reste / base) * 100}%` }}
            className="bg-[repeating-linear-gradient(45deg,rgba(0,0,0,0.10)_0_4px,transparent_4px_8px)]"
            title={`Non attribué — ${fmtCHF(reste)} CHF`}
          />
        )}
      </div>

      <div className="flex items-baseline justify-between gap-3 flex-wrap mt-2">
        <div className="flex items-center gap-3 flex-wrap text-[11px] text-faint">
          {avecBudget.slice(0, 6).map((t, i) => (
            <span key={t.label} className="inline-flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full inline-block"
                style={{ background: "#1a56ff", opacity: 1 - Math.min(0.55, i * 0.13) }}
              />
              {t.label} <span className="font-mono text-muted">{fmtCHF(t.budget)}</span>
            </span>
          ))}
          {avecBudget.length === 0 && <span>aucun budget par thème pour l&apos;instant</span>}
        </div>
        <span
          className={`text-[12px] font-semibold ${depasse ? "text-neg" : reste > 0 ? "text-warn" : "text-pos"}`}
        >
          {depasse
            ? `${fmtCHF(-reste)} CHF de trop répartis`
            : reste > 0
              ? `${fmtCHF(reste)} CHF encore à répartir`
              : "tout est réparti"}
        </span>
      </div>

      {depasse && (
        <p className="text-[11.5px] text-neg leading-relaxed mt-2">
          La somme de tes budgets par thème dépasse ce que tu as prévu sur Meta +
          Google. Baisse un thème, ou remonte le budget de la plateforme.
        </p>
      )}
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
          <RepartitionBudget byTheme={data.byTheme} totalBudget={data.totalBudget} />
          <ScrollList
            title="Par thème · dépense du mois · fixe un budget pour suivre"
            count={data.byTheme.length}
            maxH="max-h-[52vh]"
          >
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
          </ScrollList>
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
