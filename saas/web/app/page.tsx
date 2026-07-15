// Rapport hebdo — données réelles (même Supabase que le dashboard actuel).
// Les conseils viennent de weekly_reports (publié par le rapport Streamlit,
// bientôt par le worker cron) : même contenu partout.

import {
  getWeeklyData,
  fmtCHF,
  type Kpi,
  type PayloadReco,
} from "@/lib/report";
import { RecoActions } from "@/components/reco-actions";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

const CHANNEL: Record<string, { icon: string; label: string; color: string }> = {
  instagram: { icon: "◎", label: "Instagram organique", color: "#7b4fff" },
  meta: { icon: "▣", label: "Meta Ads", color: "#1a56ff" },
  google: { icon: "◆", label: "Google", color: "#1a7a4a" },
  ia: { icon: "◇", label: "Piste", color: "#8b6f00" },
};

const CONF: Record<string, { symbol: string; label: string }> = {
  solide: { symbol: "●", label: "Solide" },
  creuser: { symbol: "◐", label: "À creuser" },
  piste: { symbol: "○", label: "Piste" },
};

function DeltaBadge({ delta, goodWhenUp }: { delta: number | null; goodWhenUp: boolean | null }) {
  if (delta === null) return null;
  if (Math.abs(delta) < 0.5)
    return <span className="text-[11px] text-faint font-medium">≈ stable vs 7j préc.</span>;
  const up = delta > 0;
  const arrow = up ? "▲" : "▼";
  let cls = "text-muted";
  if (goodWhenUp !== null) cls = up === goodWhenUp ? "text-pos" : "text-neg";
  return (
    <span className={`text-[11px] font-semibold ${cls}`}>
      {arrow} {up ? "+" : ""}
      {delta.toFixed(0)} % <span className="text-faint font-normal">vs 7j préc.</span>
    </span>
  );
}

function KpiCard({ k }: { k: Kpi }) {
  return (
    <div className="bg-white border border-line rounded-xl p-4">
      <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1.5">
        {k.label}
      </div>
      <div className="font-mono text-xl font-medium text-ink">{k.value}</div>
      <div className="text-[11px] text-faint mt-1">{k.sub}</div>
      <div className="mt-1.5 min-h-[16px]">
        <DeltaBadge delta={k.delta} goodWhenUp={k.deltaGoodWhenUp} />
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[14px] font-semibold text-ink mb-3">{children}</h2>;
}

function Suivi({ feedback }: { feedback: Record<string, string> }) {
  // Compté en LIVE depuis reco_feedback — reflète immédiatement les clics ici.
  const vals = Object.values(feedback);
  const applique = vals.filter((v) => v === "done").length;
  const utile = vals.filter((v) => v === "useful").length;
  const ecarte = vals.filter((v) => v === "not_for_me").length;
  const bits: React.ReactNode[] = [];
  if (applique)
    bits.push(
      <span key="a" className="text-pos font-semibold">
        ✓ {applique} appliqué{applique > 1 ? "s" : ""}
      </span>
    );
  if (utile)
    bits.push(
      <span key="u" className="text-brand font-semibold">
        ● {utile} utile{utile > 1 ? "s" : ""}
      </span>
    );
  if (ecarte)
    bits.push(
      <span key="e" className="text-faint font-medium">
        ✕ {ecarte} écarté{ecarte > 1 ? "s" : ""}
      </span>
    );
  if (bits.length === 0) return null;
  return (
    <div className="flex items-center gap-3 text-[12px] mt-2.5">
      <span className="text-[10px] uppercase tracking-wide text-faint font-semibold">
        Suivi des conseils
      </span>
      {bits}
    </div>
  );
}

function RecoCard({ r, current }: { r: PayloadReco; current: string | null }) {
  const cf = CONF[r.confidence] ?? CONF.piste;
  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-5">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] font-semibold text-muted bg-black/[0.06] rounded-full px-2 py-0.5">
          Règle
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted">
          <span className="text-[13px] text-ink">{cf.symbol}</span>
          {cf.label}
        </span>
      </div>
      <h3 className="text-[15px] font-semibold text-ink leading-snug">{r.title}</h3>
      <p className="text-[13px] text-ink leading-relaxed mt-1.5">{r.observation}</p>
      <p className="text-[13px] text-muted leading-relaxed mt-1.5">
        <span className="font-semibold text-ink">Pourquoi — </span>
        {r.pourquoi}
      </p>
      <p className="text-[13px] text-muted leading-relaxed mt-1.5">
        <span className="font-semibold text-ink">Avant d&apos;agir — </span>
        {r.verifier}
      </p>
      {r.repere && (
        <div className="text-[12.5px] text-ink leading-relaxed mt-2.5 bg-brand/[0.05] border border-brand/[0.14] rounded-lg px-3 py-2">
          <span className="font-semibold text-brand">Repère — </span>
          {r.repere}
        </div>
      )}
      {r.angle_mort && (
        <p className="text-[12px] text-faint leading-relaxed mt-2.5">
          <span className="font-semibold">Angle mort — </span>
          {r.angle_mort}
        </p>
      )}
      <RecoActions recoKey={r.key} current={current} />
    </div>
  );
}

export default async function Page() {
  const data = await getWeeklyData();
  const report = data.report;

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
      <SiteHeader email={data.email} active="rapport" />

      {/* Hero */}
      <div className="mb-7">
        <p className="text-[11px] uppercase tracking-widest text-faint font-semibold mb-1.5">
          {report?.week_label ?? data.weekLabel}
        </p>
        <h1 className="font-serif text-3xl sm:text-[34px] leading-tight text-ink">
          {report ? "Voici ce qui compte cette semaine." : "Ta semaine en bref."}
        </h1>
        {report && (
          <p className="text-[14px] text-muted mt-2 leading-relaxed">{report.verdict}</p>
        )}
        {report && <Suivi feedback={data.feedback} />}
      </div>

      {!data.hasData ? (
        <div className="bg-white border border-line rounded-xl shadow-card p-6 text-center">
          <p className="text-[14px] text-ink font-medium">Pas encore de données ici.</p>
          <p className="text-[12.5px] text-muted mt-2 leading-relaxed">
            Lance « Récupérer mes données » dans ton dashboard actuel — les données
            arrivent dans la même base et s&apos;afficheront ici automatiquement.
          </p>
        </div>
      ) : (
        <>
          {/* L'essentiel — brief IA + à faire */}
          {report && (report.brief || report.todo.length > 0) && (
            <>
              <SectionTitle>L&apos;essentiel — 30 secondes</SectionTitle>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-8">
                {report.brief && (
                  <div className="bg-white border border-line rounded-xl shadow-card p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] uppercase tracking-wide text-ig font-bold">
                        Le brief de la semaine
                      </span>
                      <span className="text-[9px] font-semibold text-ig bg-ig/10 rounded-full px-2 py-0.5">
                        IA
                      </span>
                    </div>
                    <p className="text-[13.5px] text-ink leading-relaxed">{report.brief}</p>
                  </div>
                )}
                {report.todo.length > 0 && (
                  <div className="bg-white border border-line rounded-xl shadow-card p-5">
                    <div className="text-[10px] uppercase tracking-wide text-brand font-bold mb-3">
                      À faire cette semaine
                    </div>
                    <ul className="space-y-2.5">
                      {report.todo.map((t, i) => {
                        // done = payload (état au moment de la publication) OU clic live ici
                        const done = t.done || data.feedback[t.key] === "done";
                        return (
                          <li key={t.key} className="flex gap-2.5 items-baseline">
                            <span className="font-mono text-[12px] text-faint">
                              {done ? "✓" : i + 1}
                            </span>
                            <span
                              className="text-[14px]"
                              style={{ color: CHANNEL[t.platform]?.color ?? "#5a5d66" }}
                            >
                              {CHANNEL[t.platform]?.icon ?? "◇"}
                            </span>
                            <span
                              className={`text-[13px] leading-snug ${
                                done ? "text-faint line-through" : "text-ink font-medium"
                              }`}
                            >
                              {t.title}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Vue d'ensemble */}
          <SectionTitle>Vue d&apos;ensemble</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            {data.kpis.map((k) => (
              <KpiCard key={k.label} k={k} />
            ))}
          </div>

          {/* Dépense par canal */}
          <SectionTitle>Dépense par canal</SectionTitle>
          <div className="bg-white border border-line rounded-xl shadow-card divide-y divide-line mb-8">
            {data.channels.map((ch) => {
              const delta = ch.prev > 0 ? ((ch.spend - ch.prev) / ch.prev) * 100 : null;
              return (
                <div key={ch.name} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="text-[15px]" style={{ color: ch.color }}>
                    {ch.icon}
                  </span>
                  <span className="text-[13.5px] font-medium text-ink">{ch.name}</span>
                  <span className="ml-auto font-mono text-[14px] text-ink">
                    {fmtCHF(ch.spend)} CHF
                  </span>
                  <span className="w-24 text-right">
                    <DeltaBadge delta={delta} goodWhenUp={null} />
                  </span>
                </div>
              );
            })}
          </div>

          {/* Le détail, canal par canal */}
          {report && report.recos.length > 0 ? (
            <>
              <SectionTitle>Le détail, canal par canal</SectionTitle>
              {(["instagram", "meta", "google", "ia"] as const).map((chKey) => {
                const items = report.recos.filter((r) => r.platform === chKey);
                if (items.length === 0) return null;
                const ch = CHANNEL[chKey];
                return (
                  <div key={chKey} className="mb-5">
                    <div className="flex items-center gap-2.5 mb-3">
                      <span className="text-[17px]" style={{ color: ch.color }}>
                        {ch.icon}
                      </span>
                      <span className="text-[15px] font-semibold text-ink">{ch.label}</span>
                      <span className="text-[11px] text-faint bg-black/[0.05] rounded-full px-2 py-0.5">
                        {items.length}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {items.map((r) => (
                        <RecoCard key={r.key} r={r} current={data.feedback[r.key] ?? null} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <>
              <SectionTitle>Tes conseils de la semaine</SectionTitle>
              <div className="bg-brand/[0.04] border border-brand/[0.14] rounded-xl p-5">
                <p className="text-[13px] text-ink leading-relaxed">
                  <span className="font-semibold text-brand">Presque prêt — </span>
                  ouvre une fois ton rapport dans le dashboard actuel : il publiera tes
                  conseils personnalisés ici (même contenu, avec le pourquoi, le repère
                  et l&apos;angle mort).
                </p>
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
