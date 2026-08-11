// Rapport hebdo — données réelles (même Supabase que le dashboard actuel).
// Les conseils viennent de weekly_reports (publié par le rapport Streamlit,
// bientôt par le worker cron) : même contenu partout.

import Link from "next/link";
import { getWeeklyData, type ReportPayload, type TrackedAction } from "@/lib/report";
import { ObjectifSelect } from "@/components/objectif-select";
import { SetupWizard } from "@/components/setup-wizard";
import { ThemeCard, ancreTheme, ecartTheme, penteNeutre } from "@/components/theme-card";
import { KpiFocusCard } from "@/components/kpi-focus";
import { ThemeDonut } from "@/components/theme-donut";
import { FriseSemaine } from "@/components/frise-semaine";
import { ReloadRecosButton } from "@/components/reload-recos-button";
import { RailActions } from "@/components/rail-actions";
import { Apprentissage } from "@/components/apprentissage";
import { RecoCard } from "@/components/reco-card";
import { Triangle } from "@/components/pente";


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

// Le résumé de la semaine — sans carte : au milieu de blocs encadrés, un bloc
// nu attire l'œil plus fort qu'un cadre de plus.
//
// Sa première phrase n'est plus mise en avant. Elle l'était, et elle disait la
// même chose que le verdict juste au-dessus — le worker demande à l'IA « une
// phrase de synthèse » alors que le verdict EST déjà une phrase de synthèse,
// calculée de façon déterministe. Deux affirmations identiques et de poids
// proche, collées l'une à l'autre : le doublon retiré de la section 2 vivait
// encore ici. Le résumé garde tout son texte, il cesse seulement de se
// disputer le niveau 1.
function ResumeSemaine({ brief }: { brief: string }) {
  return (
    <div className="mt-5 max-w-[68ch]">
      <p className="text-[14px] sm:text-[15px] leading-relaxed text-muted whitespace-pre-line">
        {brief}
      </p>
      <p className="text-[10.5px] text-faint mt-2.5">
        Résumé écrit par l&apos;IA à partir de tous tes posts et campagnes de la semaine.
      </p>
    </div>
  );
}

// Le verdict, en chiffre. Une page dont le niveau 1 est une phrase de 26 px
// alors qu'un module affiche 46 px plus bas n'a pas la hiérarchie qu'elle
// croit avoir : c'est la typographie qui classe, pas l'intention. L'écart
// passe donc en très grand, et la phrase entière reste juste dessous.
// Sans les nouvelles clés (rapports publiés avant), on retombe sur la phrase.
function Verdict({ report }: { report: ReportPayload }) {
  const pct = report.verdict_pct;
  const ton = report.verdict_tone ?? "stable";
  if (pct === null || pct === undefined || !report.verdict_metric) {
    return (
      <h1 className="font-serif text-[26px] sm:text-[32px] leading-[1.15] text-ink text-balance">
        {report.verdict}
      </h1>
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
      <h1 className="font-serif text-[17px] sm:text-[19px] leading-snug text-ink text-balance mt-2 max-w-[60ch]">
        {report.verdict}
      </h1>
    </div>
  );
}

// Le raccourci du hero vers ce qui t'attend.
//
// Il pointait vers « Ce que tu dois faire », une section unique. Les actions
// vivent maintenant dans la carte de leur thème : il vise donc la carte de la
// PLUS URGENTE — celle dont le verdict est tombé, sinon celle à faire — et se
// rabat sur le filet « hors thème » quand elle n'a pas de carte.
function VersLaction({
  actions,
  themesRendus,
}: {
  actions: TrackedAction[];
  themesRendus: Set<string>;
}) {
  const aFaire = actions.filter((a) => a.status === "running").length;
  const aJuger = actions.filter((a) => a.status === "done" && !a.due).length;
  if (aFaire + aJuger === 0) return null;
  const bouts = [
    aFaire > 0 ? `${aFaire} action${aFaire > 1 ? "s" : ""} en cours` : null,
    aJuger > 0 ? `${aJuger} à juger` : null,
  ].filter(Boolean);
  const urgente =
    actions.find((a) => a.status === "done" && a.due) ??
    actions.find((a) => a.status === "running") ??
    actions[0];
  const cible =
    urgente?.theme && themesRendus.has(urgente.theme)
      ? `#${ancreTheme(urgente.theme)}`
      : urgente
        ? "#actions-hors-theme"
        : "#conseils";
  return (
    <a
      href={cible}
      className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand border border-brand/25 rounded-full px-3.5 py-1.5 hover:bg-brand/[0.06] transition-colors"
    >
      ▸ {bouts.join(" · ")} <span className="text-faint font-normal">— y aller ↓</span>
    </a>
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
  // elle désignerait le seul thème de la page.
  const topRecos = themesFocus.length > 1 ? report?.top_recos ?? [] : [];
  // On ne peut pas mener 4 chantiers de front : au-delà de 3 actions « à faire »,
  // les autres conseils invitent à en boucler un d'abord.
  const capReached = data.actions.filter((a) => a.status !== "done").length >= 3;

  // TOUS les thèmes ont désormais une carte, qu'ils aient une courbe ou non :
  // c'est la carte qui décide de montrer sa courbe. Deux cartes pour le même
  // thème — une pour le bilan, une pour les conseils — obligeaient le lecteur
  // à faire lui-même le lien entre « voilà la courbe » et « voilà quoi faire ».
  const cartes = themesFocus;
  const avecCourbe = cartes.filter((t) => t.series && t.series.points.length > 1);
  // Le classement entre thèmes n'a de sens que s'ils suivent LE MÊME
  // indicateur : comparer une portée à une dépense ne veut rien dire.
  const memeMetrique =
    avecCourbe.length > 1 &&
    avecCourbe.every((t) => t.series!.metric_label === avecCourbe[0].series!.metric_label);
  // Le classement entre tes thèmes. Pas de verdict absolu possible — il n'y a
  // pas de seuil de référence par thème — mais une comparaison qui reste À
  // L'INTÉRIEUR du même compte est légitime, et elle répond à la seule question
  // que cette section doit servir : où je mets mes dix minutes cette semaine.
  // …sauf quand l'indicateur commun est la DÉPENSE : un thème dont la dépense
  // baisse n'est pas un thème qui décroche, c'est un thème qu'on a coupé.
  const pentes = memeMetrique && !penteNeutre(avecCourbe[0].series!.metric_label)
    ? avecCourbe.map((t) => ({
        label: t.label,
        ecart: ecartTheme(t.series!.points.map((p) => p.value)),
      }))
    : [];
  const pire = pentes
    .filter((x): x is { label: string; ecart: number } => x.ecart !== null && x.ecart < -8)
    .sort((a, b) => a.ecart - b.ecart)[0];

  // LES ACTIONS QUI N'ONT PLUS DE MAISON.
  //
  // Le complément EXACT du filtre des cartes (`a.theme === theme.label`), donc
  // ni doublon ni trou par construction. Trois causes, toutes réelles : un
  // conseil pris depuis « Réglages de base » n'a pas de thème du tout ; un
  // thème peut sortir des trois prioritaires ; un thème renommé laisse ses
  // actions derrière lui.
  //
  // Sans ce filet, ces actions seraient invisibles ET inatteignables tout en
  // continuant de compter dans le plafond des trois chantiers : trois actions
  // de réglage et toute la page se bloque, sans aucun moyen de débloquer.
  const themesRendus = new Set(cartes.map((t) => t.label));
  const orphelines = [...data.actions, ...data.actionsArchived].filter(
    (a) => !a.theme || !themesRendus.has(a.theme)
  );
  const orphelinesVivantes = orphelines.some(
    (a) => a.status === "running" || a.status === "done"
  );

  // Numérotation dynamique : « Ce que tu dois faire » et « Historique »
  // disparaissent quand ils sont vides. Numéroter en dur faisait commencer la
  // page à 2, et un lecteur qui voit un 2 cherche le 1.
  let _n = 0;
  const nSemaine = report?.kpi_focus || report?.themes ? ++_n : undefined;
  const nThemes = cartes.length > 0 ? ++_n : undefined;
  const nApprendre = report?.apprentissage ? ++_n : undefined;

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-9">

      {/* Hero — le verdict EST le titre : « ma semaine a été bonne ? » est la
          première question du lecteur, elle doit trouver sa réponse avant le
          premier scroll. Une phrase d'accroche à la place ne dit rien. */}
      <div className="mb-7">
        {/* Ce qui est CALCULÉ entre en carte ; ce qui est RÉDIGÉ reste nu.
            La ligne de partage n'est pas esthétique, c'est une convention de
            lecture : l'écart, la métrique et la phrase de verdict sont produits
            par des règles déterministes, le résumé est écrit par une IA. Un
            cadre autour du second lui donnerait l'autorité du premier. */}
        <div className="rounded-2xl border border-line bg-white shadow-card px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex items-baseline gap-3 flex-wrap mb-2">
            <p className="text-[11px] uppercase tracking-widest text-faint font-semibold">
              {report?.week_label ?? data.weekLabel}
            </p>
            {/* Le raccourci vers l'action était la DERNIÈRE chose du hero, après
                200 px d'objectif replié — donc loin du chiffre qui le motive. */}
            <span className="ml-auto">
              <VersLaction actions={data.actions} themesRendus={themesRendus} />
            </span>
          </div>
          {report ? (
            <Verdict report={report} />
          ) : (
            <h1 className="font-serif text-[26px] sm:text-[32px] leading-[1.15] text-ink text-balance">
              Ta semaine en bref.
            </h1>
          )}
        </div>
        {report?.brief && <ResumeSemaine brief={report.brief} />}
      {/* L'objectif est un RÉGLAGE, pas du contenu : il se range sous le
          résumé, replié, à portée mais sans peser sur la lecture. */}
        <details className="group mt-4 rounded-xl border border-line bg-white max-w-[68ch]">
          <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none list-none flex-wrap">
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
      </div>

      {/* 1 · LA SEMAINE, TOUS THÈMES CONFONDUS — la vue d'ensemble : un seul
             indicateur en grand, et où part l'argent. Rien de filtré ici. */}
      {(report?.kpi_focus || (report?.themes && report.themes.rows.length > 0)) && (
        <section className="mb-9">
          <SectionTitle>
            <span className="text-faint font-mono mr-1.5">{nSemaine}</span> Ta semaine, tous
            thèmes confondus
          </SectionTitle>
          <p className="text-[12.5px] text-muted leading-relaxed mb-3.5 -mt-1 max-w-[68ch]">
            La vue d&apos;ensemble du compte : tout ce que tu publies et achètes, sans
            filtre. Choisis l&apos;indicateur que tu veux suivre.
          </p>
          {/* Tout sur toute la largeur, empilé. La boussole partageait sa
              ligne avec l'anneau : à deux, aucun des deux n'avait la place de
              son chiffre, et la courbe de trajectoire — qui est l'intérêt du
              module — était écrasée sur un tiers de page. */}
          <div className="space-y-3">
            {report?.kpi_focus && <KpiFocusCard k={report.kpi_focus} />}
            {report?.themes && report.themes.rows.length > 0 && (
              <ThemeDonut rows={report.themes.rows} orphan={report.themes.orphan} univers={data.labels} />
            )}
          </div>
          {/* Le temps, sous les chiffres : ce qui était en l'air pour les
              obtenir. Les couleurs sont celles de l'anneau juste au-dessus. */}
          {report?.frise && (
            <div className="mt-3">
              <FriseSemaine f={report.frise} univers={data.labels} />
            </div>
          )}
        </section>
      )}

      {/* 2 · TES THÈMES PRIORITAIRES — LA section du thème. Elle porte tout ce
             qui le concerne : son bilan, sa courbe, ses conseils, et ce qu'on a
             déjà tenté dessus. Il y avait deux sections pour ça, à 900 px
             d'écart, avec le même titre et la même étoile. */}
      {cartes.length > 0 && (
        <section id="conseils" className="mb-9 scroll-mt-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
            <SectionTitle>
              <span className="text-faint font-mono mr-1.5">{nThemes}</span> Tes thèmes
              prioritaires
            </SectionTitle>
            <ReloadRecosButton />
          </div>
          <p className="text-[12.5px] text-muted leading-relaxed mb-3.5 max-w-[68ch]">
            Objectif <span className="font-semibold text-ink">{ONB_OBJ[data.objectif ?? ""] ?? "à définir"}</span>
            {priorities.length > 0 && (
              <> · thèmes suivis <span className="font-semibold text-warn">{priorities.join(" · ")}</span></>
            )}{" "}
            — pour chacun : où il en est, ce qui peut le faire bouger, et ce que tes
            actions passées ont donné.
          </p>
          {report?.themes_intro && (
            <p className="text-[13.5px] text-muted leading-relaxed mb-4 -mt-1.5">
              {report.themes_intro}
            </p>
          )}

          {/* « Si tu ne fais que trois choses » — la sélection cross-thème.
              Des LIENS, pas des cartes : les mêmes conseils sont rendus en
              entier dans leur thème juste dessous, et rendre deux fois le même
              composant sur une page est ce que la grammaire interdit. */}
          {topRecos.length > 0 && (
            <div className="mb-4 rounded-xl border border-brand/[0.18] bg-brand/[0.03] px-4 py-3">
              <div className="text-[10px] uppercase tracking-widest text-brand font-bold mb-1.5">
                Si tu ne fais que trois choses
              </div>
              <ol className="space-y-1">
                {topRecos.map((r, i) => (
                  <li key={r.key} className="text-[12.5px] text-muted leading-snug">
                    <span className="font-mono text-faint">{i + 1}.</span>{" "}
                    <a
                      href={`#${ancreTheme(r.theme ?? "")}`}
                      className="font-semibold text-ink hover:underline"
                    >
                      {r.title}
                    </a>
                    {r.theme && <span className="text-faint"> · {r.theme}</span>}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="space-y-3">
            {cartes.map((t) => (
              <ThemeCard
                key={t.label}
                theme={t}
                actions={data.actions}
                archived={data.actionsArchived}
                fenetre={report?.vision?.period_label || null}
                decroche={pire?.label === t.label}
                labels={data.labels}
                feedback={data.feedback}
                comments={data.comments}
                suivis={data.suivis}
                capReached={capReached}
              />
            ))}
          </div>
        </section>
      )}

      {/* LE FILET — les actions qu'aucune carte ne prend.
             Pas de numéro de section : c'est un repêchage, pas un chapitre. Et
             rendu ICI, pas en bas de page : une action qu'on ne voit pas est
             une action qui bloque le plafond sans qu'on sache pourquoi.
             Rendu HORS de la branche « pas encore de données » : un compte sans
             thème classé n'a aucune carte, ce bloc est sa seule liste. */}
      {orphelines.length > 0 &&
        (orphelinesVivantes ? (
          <section id="actions-hors-theme" className="mb-8 scroll-mt-4">
            <SectionTitle tone="discret">Tes actions hors de tes thèmes</SectionTitle>
            <div className="bg-white border border-line rounded-xl shadow-card px-4 py-3">
              <RailActions actions={orphelines} themeCourant={null} />
              <p className="text-[10.5px] text-faint/80 mt-2 leading-relaxed">
                Ces actions ne sont rattachées à aucun de tes thèmes suivis : prises depuis
                les réglages de base, ou sur un thème sorti de tes priorités.
              </p>
            </div>
          </section>
        ) : (
          <details id="actions-hors-theme" className="mb-8 scroll-mt-4 group">
            <summary className="text-[11px] uppercase tracking-widest text-faint font-bold cursor-pointer select-none">
              Tes actions hors de tes thèmes ({orphelines.length}){" "}
              <span className="text-brand normal-case tracking-normal group-open:hidden">
                voir ▾
              </span>
              <span className="text-brand normal-case tracking-normal hidden group-open:inline">
                replier ▴
              </span>
            </summary>
            <div className="bg-white border border-line rounded-xl shadow-card px-4 py-3 mt-2.5">
              <RailActions actions={orphelines} themeCourant={null} />
            </div>
          </details>
        ))}

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


          {/* LA SECTION « TES CONSEILS » A DISPARU.
              Elle rendait une seconde carte par thème — même titre, même
              étoile, mêmes campagnes — à 900 px de la première. Ses conseils
              vivent maintenant dans la carte du thème, à gauche sous la
              courbe, en face de ce que les actions passées ont donné. C'est la
              boucle conseil → action → effet dans un seul écran, au lieu de
              trois sections qui ne se regardaient pas.
              Le seul cas qu'elle traitait encore seule : aucun thème classé. */}
          {themesFocus.length === 0 && (
            <div className="bg-brand/[0.04] border border-brand/[0.14] rounded-xl p-5 mb-8">
              <p className="text-[13px] text-ink leading-relaxed">
                <span className="font-semibold text-brand">Presque prêt — </span>
                classe tes contenus sur la page{" "}
                <Link href="/labels" className="text-brand font-semibold hover:underline">◫ Thèmes</Link>{" "}
                (bouton « ✨ Classer mes contenus »), puis recharge : le rapport se
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
                    theme={null}
                    action={data.suivis[r.key] ?? null}
                    capReached={capReached}
                  />
                ))}
              </div>
            </details>
          )}

          {/* ALLER PLUS LOIN — le savoir-faire qui répond à ce qui te bloque */}
          {report?.apprentissage && (
            <Apprentissage data={report.apprentissage} num={nApprendre} />
          )}
        </>
      )}
    </main>
  );
}
