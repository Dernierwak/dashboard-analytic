// Rapport hebdo — données réelles (même Supabase que le dashboard actuel).
// Les conseils viennent de weekly_reports (publié par le rapport Streamlit,
// bientôt par le worker cron) : même contenu partout.

import Link from "next/link";
import { getWeeklyData, type ReportPayload } from "@/lib/report";
import { SiteHeader } from "@/components/site-header";
import { ObjectifSelect } from "@/components/objectif-select";
import { SetupWizard } from "@/components/setup-wizard";
import { VisionCard } from "@/components/vision-card";
import { ThemeFocusCard } from "@/components/theme-focus-card";
import { ReloadRecosButton } from "@/components/reload-recos-button";
import { RecoCard } from "@/components/reco-card";

export const dynamic = "force-dynamic";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[14px] font-semibold text-ink mb-3">{children}</h2>;
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

export default async function Page() {
  const data = await getWeeklyData();
  const report = data.report;

  // Thèmes prioritaires (≤ 3) — le fil qui relie la vision aux conseils.
  const priorities = Object.keys(data.insightFeedback)
    .filter((k) => k.startsWith("priority_label:"))
    .map((k) => k.split(":").slice(1).join(":"));

  const themesFocus = report?.themes_focus ?? [];
  const reglages = report?.reglages ?? [];

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
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

      {/* Parcours de démarrage — profil → classement IA → priorités (reprenable) */}
      <SetupWizard
        onboarded={data.onboarded}
        toLabel={
          report?.matrice?.coverage
            ? {
                posts:
                  report.matrice.coverage.posts_total - report.matrice.coverage.posts_labeled,
                camps:
                  report.matrice.coverage.campaigns_total -
                  report.matrice.coverage.campaigns_labeled,
              }
            : null
        }
        themes={data.labels}
        priorities={priorities}
      />

      {/* Vision globale — ce qui fonctionne sur TOUT l'historique, à valider.
          Les conseils hebdo (plus bas) s'ancrent sur les constats validés. */}
      {report?.vision && report.vision.constats.length > 0 && (
        <VisionCard vision={report.vision} insightFeedback={data.insightFeedback} />
      )}

      {!data.hasData ? (
        <div className="bg-white border border-line rounded-xl shadow-card p-6 text-center">
          <p className="text-[14px] text-ink font-medium">Pas encore de données ici.</p>
          <p className="text-[12.5px] text-muted mt-2 leading-relaxed">
            Lance « ↻ Mes données » en haut — elles arrivent dans la même base et
            s&apos;afficheront ici automatiquement.
          </p>
        </div>
      ) : (
        <>
          {/* Le brief — 30 secondes pour situer la semaine */}
          {report?.brief && (
            <div className="bg-white border border-line rounded-xl shadow-card p-5 mb-8">
              <div className="flex items-center gap-2 mb-2">
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

          {/* Le cœur : par thème (cross-canal) — campagnes éditables + ≤3 conseils */}
          {themesFocus.length > 0 ? (
            <>
              <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                <SectionTitle>
                  Par thème{" "}
                  <span className="text-faint font-normal">
                    · {priorities.length > 0 ? "tes priorités" : "tes 3 plus gros thèmes"} — ce qui marche + comment l&apos;améliorer
                  </span>
                </SectionTitle>
                <ReloadRecosButton />
              </div>
              {themesFocus.map((t) => (
                <ThemeFocusCard
                  key={t.label}
                  theme={t}
                  labels={data.labels}
                  feedback={data.feedback}
                  comments={data.comments}
                />
              ))}
              {priorities.length === 0 && (
                <p className="text-[12px] text-faint mb-8">
                  Astuce : marque jusqu&apos;à 3 thèmes prioritaires sur{" "}
                  <Link href="/labels" className="text-brand font-semibold hover:underline">◫ Thèmes</Link>{" "}
                  pour concentrer le rapport sur ce qui compte pour toi.
                </p>
              )}
            </>
          ) : (
            <div className="bg-brand/[0.04] border border-brand/[0.14] rounded-xl p-5 mb-8">
              <p className="text-[13px] text-ink leading-relaxed">
                <span className="font-semibold text-brand">Presque prêt — </span>
                classe tes contenus sur la page{" "}
                <Link href="/labels" className="text-brand font-semibold hover:underline">◫ Thèmes</Link>{" "}
                (bouton « ✨ Classer mes contenus »), puis recharge : le rapport se
                construit thème par thème.
              </p>
            </div>
          )}

          {/* Réglages de base — prérequis (GA4, funnel) sortis du flux par thème */}
          {reglages.length > 0 && (
            <details className="mb-8" open>
              <summary className="text-[14px] font-semibold text-ink cursor-pointer select-none mb-3">
                Réglages de base ({reglages.length}){" "}
                <span className="text-faint font-normal">· à mettre en place une fois pour tout débloquer</span>
              </summary>
              <div className="space-y-3 mt-2">
                {reglages.map((r) => (
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

          {/* Boucle de la preuve : les « Fait » re-mesurés */}
          {report?.preuve &&
            (report.preuve.outcomes.length > 0 || report.preuve.pending.length > 0) && (
              <PreuveSection preuve={report.preuve} />
            )}
        </>
      )}
    </main>
  );
}
