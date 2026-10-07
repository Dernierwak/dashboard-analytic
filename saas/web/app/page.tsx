// Le point de la semaine — données réelles, lues dans `weekly_reports`, publié
// en headless par `saas/data/supabase/processed_data/weekly_report/builder.py` (cron du Jour de travail).
//
// CETTE PAGE NE CONSEILLE RIEN, ELLE CONSTATE. Les conseils, le suivi des
// actions, le carnet et le module « À faire » ont été retirés du produit : ce
// qui reste est ce qui se mesure — le verdict, la boussole, la frise et ce qui
// a bougé sur les plateformes. Le thème (l'anneau, les cartes, l'alerte de
// couverture) est parti à son tour : rien ne le remplace.

import Link from "next/link";
import { getWeeklyData, type ReportPayload } from "@/lib/report";
import { getChangementsApi } from "@/lib/changements-api";
import { TroisDates } from "@/components/trois-dates";
import { CanalMuetAlerte } from "@/components/canal-muet";
// L'ÉTAT VIDE, et lui seul. Le bandeau du rapport reste `CanalMuetAlerte`, qui
// lit le payload : deux listes du même fait sur un écran finiraient par se
// contredire. Celui-ci prend le relais là où il n'y a PAS de payload.
import { TrouDeRecolte } from "@/components/trou-recolte";
import { SetupWizard } from "@/components/setup-wizard";
import { KpiFocusCard } from "@/components/kpi-focus";
import { Changements } from "@/components/changements";
import { FriseSemaine } from "@/components/frise-semaine";
import { Triangle } from "@/components/pente";


export const dynamic = "force-dynamic";

// Le titre d'une section. La numérotation est partie avec la section des
// thèmes : deux sections ne font pas une table des matières.
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-serif text-[19px] sm:text-[21px] leading-tight text-ink mb-3.5 flex items-center gap-2.5">
      <span className="h-4 w-[3px] rounded-full bg-brand shrink-0" />
      {children}
    </h2>
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

export default async function Page() {
  // CE QUE LES PLATEFORMES DÉCLARENT ELLES-MÊMES. Nos cinq faits déduits de la
  // dépense sont aveugles à tout ce qui ne fait pas bouger le budget du jour —
  // un mot-clé en pause, un CPC cible relevé, une audience élargie. Quatre-vingt
  // -dix jours parce que Google Ads ne garde `change_event` que trente jours et
  // Meta un peu plus : demander plus large ne coûte rien, la couche de données
  // rend ce qu'elle a.
  const depuisChg = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  // Deux lectures qui ne s'attendent pas : les enchaîner additionnerait des
  // allers-retours Supabase sur la page la plus lue du produit.
  const [data, changementsApi] = await Promise.all([
    getWeeklyData(),
    getChangementsApi(depuisChg),
  ]);
  const report = data.report;
  const changements = report?.changements ?? [];

  // L'HEURE DU RENDU, LUE UNE FOIS. La troisième des trois dates (« mis à jour
  // le ») se calcule à partir d'elle ; la figer ici garantit que toute la ligne
  // parle du même instant.
  const maintenant = new Date();


  return (
    // PAS DE `max-w-*` SUR LE CONTENEUR — et c'est un changement, pas un
    // oubli. `<main>` vit déjà à côté de `<aside>` (la colonne latérale,
    // `app/layout.tsx`) : sa largeur RÉELLE n'est jamais celle de l'écran,
    // c'est déjà écran moins colonne. Un `max-w-7xl` fixe par-dessus ça
    // semblait donner de la marge, mais recréait le même défaut à une autre
    // taille d'écran — un plafond fixe est toujours trop bas pour un écran
    // encore plus large, et 7xl (1 280 px) ne changeait déjà plus rien sur un
    // portable de 1 280 px UNE FOIS LA COLONNE DÉCOMPTÉE (1 000 px de
    // contenu disponible, sous le plafond). Le principe, du coup, n'est plus
    // « choisir le bon plafond » mais ne PAS en poser : le conteneur prend
    // toute la largeur que la colonne laisse, à toute taille d'écran et à
    // toute largeur de colonne (la colonne est maintenant redimensionnable,
    // voir `components/side-nav.tsx`).
    // Ce qui NE bouge pas : les paragraphes de prose portent chacun leur
    // propre plafond en `ch` (`max-w-[68ch]`, `max-w-[60ch]`…) — un texte
    // long reste lisible indépendamment de la largeur du conteneur qui le
    // porte. Seuls les modules qui bénéficient réellement de l'espace
    // (tableaux, grilles de cartes, courbes) suivent la largeur complète.
    <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-9">

      {/* LA MISE EN PLACE EST REMONTÉE EN TÊTE, et c'est un défaut mesuré par
          `.scratch/refonte/issues/06-le-parcours-comment-les-pages-se-parlent.md`
          qu'on répare ici : le fil de démarrage était rendu tout en bas de la
          page, sous deux écrans de défilement, alors qu'il porte les seules
          actions qui débloquent tout le reste. La décision est au point 2 de
          `10-l-entree-premier-ecran.md` : tant qu'une étape est ouverte, le fil
          est le PREMIER bloc et le rapport passe dessous ; dès que tout est
          franchi il s'efface et le verdict reprend la tête. Ce composant décide
          lui-même s'il a quelque chose à dire — il rend `null` quand il n'y a
          plus d'étape — donc le déplacer ne change rien pour un compte installé.
          Ce qu'on ne fait PAS ici : le passage aux quatre étapes avec la
          connexion en gate (même ticket, point 1). C'est la brique « mise en
          place », hors v1 : elle ne sert qu'à un client qui n'est pas encore
          là (`plan-de-refonte.md` §3). */}
      <SetupWizard
        onboarded={data.onboarded}
        jourDeTravail={data.jourDeTravail}
        maintenantIso={maintenant.toISOString()}
      />

      {/* Hero — le verdict EST le titre : « ma semaine a été bonne ? » est la
          première question du lecteur, elle doit trouver sa réponse avant le
          premier scroll. Une phrase d'accroche à la place ne dit rien. */}
      <div className="mb-7">
        {/* Ce qui est CALCULÉ entre en carte ; ce qui est RÉDIGÉ reste nu.
            La ligne de partage n'est pas esthétique, c'est une convention de
            lecture : l'écart, la métrique et la phrase de verdict sont produits
            par des règles déterministes, le résumé est écrit par une IA. Un
            cadre autour du second lui donnerait l'autorité du premier. */}
        {/* CE QU'ON N'A PAS PU LIRE — AU-DESSUS DES CHIFFRES, PAS EN NOTE.
            Un canal dont la récolte a échoué laisse des « — » à la place d'une
            dépense, d'un CPC, d'un ROAS (ticket 20). Ces tirets se lisent comme
            un bug de Pulse tant que personne ne dit d'où ils viennent, et un
            produit qui a l'air cassé se ferme. Le module est donc AVANT le
            verdict qu'il conditionne, et il se vide de lui-même dès que la
            récolte a tout lu — voir `canal-muet.tsx`. */}
        <CanalMuetAlerte canaux={report?.canaux_muets} />
        <div className="rounded-2xl border border-line bg-white shadow-card px-5 py-5 sm:px-7 sm:py-6">
          {/* LES TROIS DATES PRENNENT LA PLACE DU LIBELLÉ DE SEMAINE, elles ne
              s'ajoutent pas à lui : `week_label` dit déjà « Semaine 37 · 7 → 13
              septembre · 7 jours pleins », donc la fenêtre mesurée se serait
              lue deux fois à trente pixels d'écart. La ligne des trois dates
              dit la même fenêtre et deux choses de plus — quand ce texte a été
              publié, et quand il changera. Le libellé reste le repli des
              payloads publiés avant que `since`/`until` existent. */}
          <div className="mb-2">
            {report?.since && report?.until ? (
              <TroisDates
                since={report.since}
                until={report.until}
                publieLe={data.publieLe}
                jourDeTravail={data.jourDeTravail}
                maintenant={maintenant}
              />
            ) : (
              <p className="text-[11px] uppercase tracking-widest text-faint font-semibold">
                {report?.week_label ?? data.weekLabel}
              </p>
            )}
          </div>
          {report ? (
            <Verdict report={report} />
          ) : (
            <h1 className="font-serif text-[26px] sm:text-[32px] leading-[1.15] text-ink text-balance">
              Ta semaine en bref.
            </h1>
          )}
        </div>
      </div>

      {/* 1 · LA SEMAINE — la vue d'ensemble : un seul indicateur en grand, puis
             le temps qu'il a fallu pour l'obtenir. Rien de filtré ici. */}
      {(report?.kpi_focus || report?.frise) && (
        <section className="mb-9">
          <SectionTitle>Ta semaine</SectionTitle>
          <p className="text-[12.5px] text-muted leading-relaxed mb-3.5 -mt-1 max-w-[68ch]">
            La vue d&apos;ensemble du compte : tout ce que tu publies et achètes, sans
            filtre. Choisis l&apos;indicateur que tu veux suivre.
          </p>
          {report?.kpi_focus && <KpiFocusCard k={report.kpi_focus} />}
          {report?.frise && (
            <div className="mt-3">
              <FriseSemaine f={report.frise} />
            </div>
          )}
        </section>
      )}

      {!data.hasData ? (
        // « BRANCHE UNE SOURCE » EST FAUX QUAND LA SOURCE EST DÉJÀ BRANCHÉE
        // (ticket 48). Un compte qui vient de connecter Meta et dont la
        // première récolte a échoué n'a ni ligne ni rapport : il tombe ici, et
        // s'entendait répondre de faire ce qu'il venait de faire. La panne a
        // un nom, une date et un geste — c'est ça qu'il doit lire.
        data.canauxMuets.length > 0 ? (
          <TrouDeRecolte
            muets={data.canauxMuets}
            taisent="Rien n'a encore pu être lu sur ce compte, donc aucun chiffre ne s'affiche ici"
          />
        ) : (
          <div className="bg-white border border-line rounded-xl shadow-card p-6 text-center">
            <p className="text-[14px] text-ink font-medium">Pas encore de données ici.</p>
            <p className="text-[12.5px] text-muted mt-2 leading-relaxed">
              Branche une source sur la page{" "}
              <Link href="/comptes" className="text-brand font-semibold hover:underline">
                ⚙ Connexions
              </Link>{" "}
              : sa récolte part tout de suite, et tes chiffres s&apos;afficheront ici.
            </p>
          </div>
        )
      ) : (
        <>
          {/* CE QUI A BOUGÉ SUR LES PLATEFORMES — les faits déduits de la
              dépense (`report.changements`) et ceux que les plateformes
              déclarent (`changementsApi`). Ils se rangeaient par thème, dans
              les cartes, et ce qu'aucun thème ne prenait tombait ici ; sans
              thème, tout tombe ici. */}
          {changements.length + changementsApi.length > 0 && (
            <section className="mb-9">
              <SectionTitle>Ce qui a bougé sur les plateformes</SectionTitle>
              <div className="bg-white border border-line rounded-xl shadow-card px-4 py-3.5">
                <Changements
                  changements={changements}
                  changementsApi={changementsApi}
                  maxH="max-h-[320px]"
                />
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
