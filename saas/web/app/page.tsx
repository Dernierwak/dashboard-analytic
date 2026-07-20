// Rapport hebdo — données réelles (même Supabase que le dashboard actuel).
// Les conseils viennent de weekly_reports (publié par le rapport Streamlit,
// bientôt par le worker cron) : même contenu partout.

import {
  getWeeklyData,
  fmtCHF,
  type Kpi,
  type PayloadReco,
  type ReportPayload,
} from "@/lib/report";
import { RecoActions } from "@/components/reco-actions";
import { SiteHeader } from "@/components/site-header";
import { ObjectifSelect } from "@/components/objectif-select";
import { OnboardingCard } from "@/components/onboarding-card";
import { Trajectoire } from "@/components/trajectoire";
import { VisionCard } from "@/components/vision-card";
import { getMissionData, MISSIONS } from "@/lib/mission";

export const dynamic = "force-dynamic";

const CHANNEL: Record<string, { icon: string; label: string; color: string }> = {
  instagram: { icon: "◎", label: "Instagram organique", color: "#7b4fff" },
  meta: { icon: "▣", label: "Meta Ads", color: "#1a56ff" },
  google: { icon: "◆", label: "Google", color: "#1a7a4a" },
  pub: { icon: "▣", label: "Publicité (Meta + Google)", color: "#1a56ff" },
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
    <div className="bg-white border border-line rounded-xl p-4 min-w-[200px] shrink-0 sm:min-w-0 sm:shrink">
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

// « Ce que chaque thème rapporte » — dépense par label × revenu GA4.
function ThemesCard({ themes }: { themes: NonNullable<ReportPayload["themes"]> }) {
  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-5 mb-8">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[10px] uppercase tracking-wide text-faint font-semibold">
          Ce que chaque thème rapporte · 7 jours pleins
        </div>
        <div className="text-[10px] text-faint/70">attribution GA4 · dernier clic</div>
      </div>
      <div className="divide-y divide-line">
        {themes.rows.map((t) => {
          const roas = t.spend > 0 ? t.rev / t.spend : null;
          return (
            <div key={t.label} className="flex items-baseline gap-3 py-2.5">
              <span className="text-[13px] font-semibold text-ink flex-1">{t.label}</span>
              <span className="font-mono text-[12.5px] text-muted text-right">
                {fmtCHF(t.spend)} CHF → {fmtCHF(t.rev)} CHF
              </span>
              <span className="w-40 text-right">
                {t.rev <= 0 || roas === null ? (
                  <span className="font-mono text-[12px] text-faint/80">
                    — pas de vente attribuée
                  </span>
                ) : (
                  <span
                    className="font-mono text-[12px] font-semibold"
                    style={{
                      color: roas >= 3 ? "#1a7a4a" : roas >= 1 ? "#0e0f12" : "#c0392b",
                    }}
                  >
                    ● ROAS {roas.toFixed(1)}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
      {themes.orphan > 0 && (
        <p className="text-[11px] text-faint mt-2.5">
          + {fmtCHF(themes.orphan)} CHF attribués à des campagnes sans thème — ajoute un
          label à ces campagnes (pages Meta / Google) pour les relier.
        </p>
      )}
    </div>
  );
}

// « Tes décisions — ce que ça a donné » — la boucle de la preuve.
const PROOF_STYLE: Record<string, { icon: string; color: string; verdict: string }> = {
  better: { icon: "✓", color: "#1a7a4a", verdict: "effet visible" },
  worse: { icon: "▸", color: "#b86b00", verdict: "pas encore d'effet — à surveiller" },
  stable: { icon: "≈", color: "#8b8e98", verdict: "stable pour l'instant" },
};

function PreuveSection({ preuve }: { preuve: NonNullable<ReportPayload["preuve"]> }) {
  return (
    <div className="mb-8">
      <SectionTitle>Tes décisions — ce que ça a donné</SectionTitle>
      {preuve.outcomes.length > 0 && (
        <div className="bg-white border border-line rounded-xl shadow-card overflow-hidden divide-y divide-line">
          {preuve.outcomes.map((o) => {
            const s = PROOF_STYLE[o.verdict] ?? PROOF_STYLE.stable;
            const unit = o.unit ? ` ${o.unit}` : "";
            return (
              <div
                key={o.key}
                className="flex gap-3.5 px-4 py-3.5 items-start"
                style={{ borderLeft: `3px solid ${s.color}` }}
              >
                <div
                  className="w-7 h-7 rounded-lg grid place-items-center text-[14px] font-bold shrink-0 mt-0.5"
                  style={{ color: s.color, background: `${s.color}16` }}
                >
                  {s.icon}
                </div>
                <div>
                  <div className="text-[13.5px] font-semibold text-ink leading-snug">
                    {o.title} — {s.verdict}
                  </div>
                  <div className="text-[12px] text-muted mt-0.5 leading-relaxed">
                    Décidé {o.week_label} · {o.kpi} : {o.then}
                    {unit} → <strong className="text-ink">{o.now}{unit}</strong>
                    {o.delta !== null && ` (${o.delta > 0 ? "+" : ""}${o.delta.toFixed(0)} %)`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {preuve.pending.map((p) => (
        <p key={p.key} className="text-[12px] text-faint mt-2">
          ◷ « {p.title} » — décidé cette semaine, effet mesuré dès le prochain rapport.
        </p>
      ))}
      <p className="text-[11px] text-faint/80 mt-2.5 leading-relaxed">
        Avant/après honnête, pas une preuve absolue — la saisonnalité et le contenu jouent
        aussi. Sur la durée, c&apos;est le meilleur indicateur de ce qui marche chez toi.
      </p>
    </div>
  );
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

function RecoCard({
  r,
  current,
  comment,
}: {
  r: PayloadReco;
  current: string | null;
  comment: string | null;
}) {
  const cf = CONF[r.confidence] ?? CONF.piste;
  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-5">
      <div className="flex items-center gap-2 mb-1.5">
        {r.source === "ai" ? (
          <span className="text-[10px] font-semibold text-ig bg-ig/10 rounded-full px-2 py-0.5">
            IA · idée à tester
          </span>
        ) : (
          <span className="text-[10px] font-semibold text-muted bg-black/[0.06] rounded-full px-2 py-0.5">
            Règle
          </span>
        )}
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
      <RecoActions recoKey={r.key} current={current} comment={comment} />
    </div>
  );
}

export default async function Page() {
  const data = await getWeeklyData();
  const report = data.report;
  const mission = await getMissionData(data.objectif);

  // Recos triées mission / hors mission (mission active → focus, rien de caché)
  const missionDef = data.objectif ? MISSIONS[data.objectif] : null;
  const inMission = (r: PayloadReco) =>
    !missionDef ||
    r.platform === "ia" || // l'idée IA est personnalisée à la mission → toujours visible
    missionDef.keys.includes(r.key) ||
    missionDef.platforms.includes(r.platform);
  const recosMission = (report?.recos ?? []).filter(inMission);
  const recosAutres = (report?.recos ?? []).filter((r) => !inMission(r));

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
        <div className="flex items-center justify-between gap-3 flex-wrap mt-3">
          <ObjectifSelect current={data.objectif} />
          {report && <Suivi feedback={data.feedback} />}
        </div>
      </div>

      {/* Onboarding express — première visite (30 s, tout au clic) */}
      {!data.onboarded && <OnboardingCard />}

      {/* Vision globale — ce qui fonctionne sur TOUT l'historique, à valider.
          Les conseils hebdo (plus bas) s'ancrent sur les constats validés. */}
      {report?.vision && report.vision.constats.length > 0 && (
        <VisionCard vision={report.vision} insightFeedback={data.insightFeedback} />
      )}

      {/* La Trajectoire — le chiffre de ta mission + tes actions sur la courbe */}
      {data.hasData && <Trajectoire m={mission} />}

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

          {/* Vue d'ensemble — carrousel horizontal sur téléphone */}
          <SectionTitle>Vue d&apos;ensemble</SectionTitle>
          <div className="flex overflow-x-auto sm:grid sm:grid-cols-3 gap-3 mb-8 pb-1 sm:pb-0">
            {data.kpis.map((k) => (
              <KpiCard key={k.label} k={k} />
            ))}
          </div>

          {/* Dépense par canal */}
          <SectionTitle>
            Dépense par canal{" "}
            <span className="text-faint font-normal">
              · {report?.week_label ?? data.weekLabel} — la page Coûts, elle, suit le mois en cours
            </span>
          </SectionTitle>
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

          {/* Ce que chaque thème rapporte (labels × ventes GA4) */}
          {report?.themes && report.themes.rows.length > 0 && (
            <ThemesCard themes={report.themes} />
          )}

          {/* Boucle de la preuve : les « Fait » re-mesurés */}
          {report?.preuve &&
            (report.preuve.outcomes.length > 0 || report.preuve.pending.length > 0) && (
              <PreuveSection preuve={report.preuve} />
            )}

          {/* Le détail, canal par canal — focalisé sur la mission si définie */}
          {report && report.recos.length > 0 ? (
            <>
              <SectionTitle>
                {missionDef ? (
                  <>
                    Tes conseils — mission « {missionDef.label} »
                  </>
                ) : (
                  "Le détail, canal par canal"
                )}
              </SectionTitle>
              {(["instagram", "pub", "meta", "google", "ia"] as const).map((chKey) => {
                const items = recosMission.filter((r) => r.platform === chKey);
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
                        <RecoCard
                          key={r.key}
                          r={r}
                          current={data.feedback[r.key] ?? null}
                          comment={data.comments[r.key] ?? null}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
              {recosMission.length === 0 && (
                <p className="text-[12.5px] text-muted mb-5">
                  Rien d&apos;urgent pour ta mission cette semaine — tes comptes tournent
                  dans tes normes sur ce front.
                </p>
              )}
              {recosAutres.length > 0 && (
                <details className="mb-5">
                  <summary className="text-[12.5px] font-semibold text-muted cursor-pointer select-none hover:text-ink">
                    ▸ Hors mission ({recosAutres.length}) — le reste mérite un œil aussi
                  </summary>
                  <div className="space-y-3 mt-3">
                    {recosAutres.map((r) => (
                      <RecoCard
                        key={r.key}
                        r={r}
                        current={data.feedback[r.key] ?? null}
                        comment={data.comments[r.key] ?? null}
                      />
                    ))}
                  </div>
                </details>
              )}
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
