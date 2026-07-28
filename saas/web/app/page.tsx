// Rapport hebdo — données réelles (même Supabase que le dashboard actuel).
// Les conseils viennent de weekly_reports (publié par le rapport Streamlit,
// bientôt par le worker cron) : même contenu partout.

import Link from "next/link";
import { getWeeklyData, type ReportPayload } from "@/lib/report";
import { SiteHeader } from "@/components/site-header";
import { ObjectifSelect } from "@/components/objectif-select";
import { SetupWizard } from "@/components/setup-wizard";
import { ThemeFocusCard } from "@/components/theme-focus-card";
import { TopRecos } from "@/components/top-recos";
import { ReloadRecosButton } from "@/components/reload-recos-button";
import { TrackingSection } from "@/components/tracking-section";
import { ActionTop } from "@/components/action-top";
import { RecoCard } from "@/components/reco-card";

export const dynamic = "force-dynamic";

const ONB_OBJ: Record<string, string> = {
  ventes: "Plus de ventes",
  notoriete: "Être plus connu",
  engagement: "Une communauté qui réagit",
};

// Deux niveaux de titre, pas un seul. « Fort » est réservé à ce sur quoi on
// AGIT ; « discret » habille le détail qu'on consulte. Quand tous les titres
// ont la même force, l'œil n'a plus de classement et tout se vaut.
function SectionTitle({
  children,
  tone = "fort",
}: {
  children: React.ReactNode;
  tone?: "fort" | "discret";
}) {
  if (tone === "discret") {
    return (
      <h2 className="text-[11px] uppercase tracking-widest text-faint font-bold mb-2.5">
        {children}
      </h2>
    );
  }
  return (
    <h2 className="font-serif text-[19px] sm:text-[21px] leading-tight text-ink mb-3.5 flex items-center gap-2.5">
      <span className="h-4 w-[3px] rounded-full bg-brand shrink-0" />
      {children}
    </h2>
  );
}

// Le résumé de la semaine — niveau 1, juste sous le titre, en typographie
// éditoriale et SANS carte : au milieu de blocs encadrés, un bloc nu attire
// l'œil plus fort qu'un cadre de plus. Sa première phrase porte l'essentiel,
// on la met en avant à l'intérieur même du résumé.
function ResumeSemaine({ brief }: { brief: string }) {
  const i = brief.indexOf(". ");
  const tete = i > 0 ? brief.slice(0, i + 1) : brief;
  const suite = i > 0 ? brief.slice(i + 2) : "";
  return (
    <div className="mt-3.5 max-w-[68ch]">
      <p className="text-[15px] sm:text-[16px] leading-relaxed text-ink font-medium">{tete}</p>
      {suite && (
        <p className="text-[14px] sm:text-[15px] leading-relaxed text-muted mt-1.5 whitespace-pre-line">
          {suite}
        </p>
      )}
      <p className="text-[10.5px] text-faint mt-2.5">
        Résumé écrit par l&apos;IA à partir de tous tes posts et campagnes de la semaine.
      </p>
    </div>
  );
}

// Lecture simple des métriques clés — 4 tuiles, balayables au pouce sur mobile.
// Chaque chiffre porte son repère (semaine précédente + variation) : un nombre
// nu ne se lit pas, le lecteur invente une conclusion à la place.
function MetricsRead({
  m,
  prev,
}: {
  m: NonNullable<ReportPayload["metrics_read"]>;
  prev?: ReportPayload["metrics_prev"];
}) {
  const fmt = (n: number | null | undefined) =>
    n === null || n === undefined ? "—" : n.toLocaleString("fr-CH").replace(/ /g, " ");
  const pct = (n: number | null | undefined) =>
    n === null || n === undefined ? "—" : `${n.toFixed(1)} %`;
  const tiles = [
    { key: "trafic" as const, label: "Trafic", value: fmt(m.trafic), sub: "sessions (GA4)", cur: m.trafic },
    { key: "vues" as const, label: "Vues", value: fmt(m.vues), sub: "Instagram", cur: m.vues },
    { key: "clics" as const, label: "Clics", value: fmt(m.clics), sub: "publicité", cur: m.clics },
    { key: "ctr" as const, label: "CTR", value: pct(m.ctr), sub: "publicité", cur: m.ctr },
  ];
  return (
    <div className="flex overflow-x-auto sm:grid sm:grid-cols-4 gap-2.5 pb-1 sm:pb-0">
      {tiles.map((t) => {
        const p = prev?.[t.key] ?? null;
        // Sous 0,5 % d'écart on dit « stable » — même seuil que partout ailleurs.
        const delta =
          p !== null && p !== 0 && t.cur !== null && t.cur !== undefined
            ? ((t.cur - p) / Math.abs(p)) * 100
            : null;
        const stable = delta !== null && Math.abs(delta) < 0.5;
        const cls = delta === null || stable ? "text-faint" : delta > 0 ? "text-pos" : "text-neg";
        const arrow = delta === null ? "" : stable ? "≈" : delta > 0 ? "▲" : "▼";
        return (
          <div
            key={t.label}
            className="bg-white border border-line rounded-xl p-3.5 min-w-[146px] shrink-0 sm:min-w-0"
          >
            <div className="text-[10px] uppercase tracking-wide text-faint font-semibold">
              {t.label}
            </div>
            <div className="font-mono text-[19px] font-medium text-ink mt-1">{t.value}</div>
            {delta !== null ? (
              <div className="text-[10.5px] mt-1 leading-snug">
                <span className={`font-semibold ${cls}`}>
                  {arrow} {stable ? "stable" : `${delta > 0 ? "+" : ""}${delta.toFixed(0)} %`}
                </span>
                <span className="text-faint">
                  {" "}· {t.key === "ctr" ? pct(p) : fmt(p)} la sem. dernière
                </span>
              </div>
            ) : (
              <div className="text-[10.5px] text-faint mt-1">pas de semaine comparable</div>
            )}
            <div className="text-[10.5px] text-faint mt-0.5">{t.sub}</div>
          </div>
        );
      })}
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
  // La sélection n'a de sens que si elle SÉLECTIONNE : avec un seul thème,
  // elle répétait mot pour mot les conseils affichés juste en dessous.
  const topRecos = themesFocus.length > 1 ? report?.top_recos ?? [] : [];
  // On ne peut pas mener 4 chantiers de front : au-delà de 3 actions « à faire »,
  // les autres conseils invitent à en boucler un d'abord.
  const capReached = data.actions.filter((a) => a.status !== "done").length >= 3;

  // Numérotation dynamique : « Ce que tu dois faire » et « Historique »
  // disparaissent quand ils sont vides. Numéroter en dur faisait commencer la
  // page à 2, et un lecteur qui voit un 2 cherche le 1.
  let _n = 0;
  const nActions = data.actions.length > 0 ? ++_n : undefined;
  const nConseils = ++_n;
  const nHistorique =
    data.actions.length + data.actionsArchived.length > 0 ? ++_n : undefined;

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
      <SiteHeader email={data.email} active="rapport" />

      {/* Hero — le verdict EST le titre : « ma semaine a été bonne ? » est la
          première question du lecteur, elle doit trouver sa réponse avant le
          premier scroll. Une phrase d'accroche à la place ne dit rien. */}
      <div className="mb-7">
        <p className="text-[11px] uppercase tracking-widest text-faint font-semibold mb-1.5">
          {report?.week_label ?? data.weekLabel}
        </p>
        <h1 className="font-serif text-[26px] sm:text-[32px] leading-[1.15] text-ink text-balance">
          {report?.verdict ?? (report ? "Voici ce qui compte cette semaine." : "Ta semaine en bref.")}
        </h1>
        {report?.brief && <ResumeSemaine brief={report.brief} />}
        {report && <Suivi feedback={data.feedback} />}
      </div>

      {/* Ce que tu dois faire — tes décisions vivent ici jusqu'à être faites */}
      <ActionTop actions={data.actions} num={nActions} />

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
          {/* 1 . NOS OBJECTIFS - compact : un titre repliable, plus une grande carte */}
          <details className="group mb-7 rounded-xl border border-line bg-white">
            <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none list-none flex-wrap">
              <span className="text-[15px]">🎯</span>
              <span className="text-[14px] font-semibold text-ink">
                Objectif :{" "}
                <span className="text-brand">
                  {ONB_OBJ[data.objectif ?? ""] ?? "à définir"}
                </span>
              </span>
              {priorities.length > 0 ? (
                <span className="text-[13px] font-semibold text-warn">
                  · ★ {priorities.join(" · ")}
                </span>
              ) : (
                <span className="text-[12.5px] text-faint">· 3 plus gros thèmes</span>
              )}
              <span className="ml-auto text-[11px] text-faint group-open:hidden">modifier ▾</span>
              <span className="ml-auto text-[11px] text-faint hidden group-open:inline">replier ▴</span>
            </summary>
            <div className="px-4 pb-4 pt-1 border-t border-line grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-2">
                  Ce qu&apos;on cherche
                </div>
                <ObjectifSelect current={data.objectif} />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-2">
                  On se concentre sur {priorities.length > 0 && `(${priorities.length}/3)`}
                </div>
                {priorities.length > 0 ? (
                  <div className="flex flex-wrap gap-2 items-center">
                    {priorities.map((p) => (
                      <span
                        key={p}
                        className="text-[13px] font-semibold text-warn bg-warn/[0.08] border border-warn/25 rounded-full px-3 py-1.5"
                      >
                        ★ {p}
                      </span>
                    ))}
                    <Link href="/labels" className="text-[12px] font-semibold text-brand hover:underline ml-1">
                      Changer →
                    </Link>
                  </div>
                ) : (
                  <p className="text-[12.5px] text-muted leading-relaxed">
                    Aucune priorité — le rapport prend tes 3 plus gros thèmes.{" "}
                    <Link href="/labels" className="text-brand font-semibold hover:underline">
                      Choisis les tiens →
                    </Link>
                  </p>
                )}
              </div>
            </div>
          </details>

          {/* LES CHIFFRES - niveau 3 : du detail qu'on consulte, pas une
              destination. Le verdict et le resume ont deja dit l'essentiel. */}
          {report?.metrics_read && (
            <section className="mb-9">
              <SectionTitle tone="discret">Les chiffres de la semaine</SectionTitle>
              {report?.metrics_read && (
                <MetricsRead m={report.metrics_read} prev={report.metrics_prev} />
              )}
              {report?.brief && (
                <div className="bg-white border border-line rounded-xl shadow-card p-5 mt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] uppercase tracking-wide text-ig font-bold">
                      Le résumé de la semaine
                    </span>
                    <span className="text-[9px] font-semibold text-ig bg-ig/10 rounded-full px-2 py-0.5">
                      IA
                    </span>
                  </div>
                  <p className="text-[13.5px] text-ink leading-relaxed whitespace-pre-line">
                    {report.brief}
                  </p>
                </div>
              )}
            </section>
          )}

          {/* TES CONSEILS, THEME PAR THEME - le coeur, cross-canal */}
          <section id="conseils" className="mb-9 scroll-mt-4">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <SectionTitle>
                <span className="text-faint font-mono mr-1.5">{nConseils}</span> Tes conseils, thème par thème
              </SectionTitle>
              {themesFocus.length > 0 && <ReloadRecosButton />}
            </div>
            {report?.themes_intro && (
              <p className="text-[13.5px] text-muted leading-relaxed mb-4 -mt-1">
                {report.themes_intro}
              </p>
            )}
            <TopRecos
              recos={topRecos}
              feedback={data.feedback}
              comments={data.comments}
              trackedKeys={data.trackedKeys}
              capReached={capReached}
            />
            {themesFocus.length > 0 ? (
              <>
              {topRecos.length > 0 && (
                <h3 className="text-[14px] font-bold text-ink mb-2.5">
                  Le détail, thème par thème
                </h3>
              )}
              {themesFocus.map((t) => (
                <ThemeFocusCard
                  key={t.label}
                  theme={t}
                  labels={data.labels}
                  feedback={data.feedback}
                  comments={data.comments}
                  trackedKeys={data.trackedKeys}
                  capReached={capReached}
                />
              ))}
              </>
            ) : (
              <div className="bg-brand/[0.04] border border-brand/[0.14] rounded-xl p-5">
                <p className="text-[13px] text-ink leading-relaxed">
                  <span className="font-semibold text-brand">Presque prêt — </span>
                  classe tes contenus sur la page{" "}
                  <Link href="/labels" className="text-brand font-semibold hover:underline">◫ Thèmes</Link>{" "}
                  (bouton « ✨ Classer mes contenus »), puis recharge : le rapport se
                  construit thème par thème.
                </p>
              </div>
            )}
          </section>

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
                    theme={null}
                    tracked={data.trackedKeys.includes(r.key)}
                  />
                ))}
              </div>
            </details>
          )}

          <TrackingSection
            actions={data.actions}
            archived={data.actionsArchived}
            num={nHistorique}
          />
        </>
      )}
    </main>
  );
}
