// Coûts — UN horizon qui se pilote, L'ANNÉE. Le reste s'y rattache.
//
// La page a d'abord porté trois horizons de même poids (jour, mois, année) et
// demandait le même montant par quatre portes différentes. On l'a ramenée au
// mois ; elle se range aujourd'hui sur l'ANNÉE, et c'est le bon niveau : une
// enveloppe publicitaire se décide une fois — un exercice, une saison, un salon
// — puis on passe l'année à vérifier qu'on la tient. Le mois n'est pas une
// saisie de plus, c'est une lecture de l'année ; le jour non plus.
//
// Ce que ça change concrètement : quand aucun budget mensuel n'a été posé, le
// mois se DÉDUIT de l'annuel (÷ 12) au lieu de valoir zéro. Un seul nombre à
// taper — l'enveloppe de l'année — fait vivre le mois, le jour, les alertes et
// toutes les barres de la page.
//
// Trois lectures, dans cet ordre, et pas une de plus :
//   1 · TENIR L'ANNÉE — trois chiffres de cadrage, puis la barre de l'année.
//   2 · OÙ ÇA PART — filtrable par période et par thèmes : l'anneau dit la
//       répartition, la courbe dit le rythme.
//   3 · PAR THÈME — la seule décision de la page, à l'année elle aussi.
//
// Tout ce qui se saisit une fois et ne se relit pas descend dans « Réglages ».
// Les modules eux-mêmes vivent dans `components/couts-modules.tsx` : cette page
// les compose, elle n'en dessine aucun.

import { getCoutsData, type ThemeSpend } from "@/lib/couts";
import { fmtCHF } from "@/lib/report";
import {
  AlerteDepassement,
  CourbeDepense,
  EnveloppeAnnee,
  LigneTheme,
} from "@/components/couts-modules";
import { BudgetEditor } from "@/components/budget-editor";
import { BudgetYearTable } from "@/components/budget-year-table";
import { FiltreCouts } from "@/components/filtre-couts";
import { ScrollList } from "@/components/scroll-list";
import { ThemeDonut } from "@/components/theme-donut";
import { Chiffre } from "@/components/chiffre";
import { teinteLabel } from "@/lib/palette";

export const dynamic = "force-dynamic";

function Titre({ children, sur }: { children: React.ReactNode; sur?: string }) {
  return (
    <div className="mb-3">
      {sur && (
        <div className="text-[10px] uppercase tracking-widest text-faint font-bold mb-1">{sur}</div>
      )}
      <h2 className="font-serif text-[19px] sm:text-[21px] leading-tight text-ink flex items-center gap-2.5">
        <span className="h-4 w-[3px] rounded-full bg-brand shrink-0" />
        {children}
      </h2>
    </div>
  );
}

const SOURCE_MOIS: Record<string, string> = {
  saisi: "enveloppe du mois, fixée à la main",
  plateformes: "hérité de tes budgets par plateforme",
  annuel: "déduit de ton enveloppe d'année (÷ 12)",
  aucun: "à fixer dans les réglages, ou déduit de l'année",
};

function unSeul(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
function plusieurs(v: string | string[] | undefined): string[] {
  if (Array.isArray(v)) return v.filter(Boolean);
  return v ? [v] : [];
}

export default async function CoutsPage({
  searchParams,
}: {
  searchParams?: { [k: string]: string | string[] | undefined };
}) {
  const sp = searchParams ?? {};
  const data = await getCoutsData({
    p: unSeul(sp.p),
    from: unSeul(sp.from),
    to: unSeul(sp.to),
    labels: plusieurs(sp.l),
  });

  const annee = data.annee;
  const ratioMois = data.totalBudget > 0 ? data.totalSpent / data.totalBudget : null;
  const ratioAn = data.budgetAnnuel > 0 ? data.spentYear / data.budgetAnnuel : null;
  const attribue = data.byTheme.reduce((a, t) => a + t.budgetYear, 0);

  // L'univers des thèmes filtrables : la liste maîtresse, plus tout thème qui a
  // dépensé sans y figurer. Un label posé sur une campagne mais pas encore
  // remonté dans `profiles.labels` disparaîtrait sinon du filtre alors qu'il
  // pèse dans l'anneau.
  const univers = [
    ...data.labels,
    ...data.byTheme.map((t) => t.label).filter((l) => !data.labels.includes(l)),
  ];
  const teintes = Object.fromEntries(
    univers.map((l) => {
      const t = teinteLabel(l, data.labels);
      return [l, { trait: t.trait, aplat: t.aplat }];
    })
  );

  const vus: ThemeSpend[] = data.filtreActif
    ? data.byTheme.filter((t) => data.labelsChoisis.includes(t.label))
    : data.byTheme;

  // Le budget de référence de la courbe : par jour, ou par semaine selon le pas.
  // Il tombe dès qu'un filtre par thèmes est posé — voir le pied du module.
  const repereCourbe = data.filtreActif
    ? 0
    : data.budgetJour * (data.periode.pas === "semaine" ? 7 : 1);

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 lg:py-9">
      <div className="mb-7">
        <p className="text-[11px] uppercase tracking-widest text-faint font-semibold mb-1.5">
          {data.monthLabel}
        </p>
        <h1 className="font-serif text-3xl sm:text-[34px] leading-tight text-ink">
          Où part ton budget.
        </h1>
        <p className="text-[13px] text-muted mt-2 leading-relaxed max-w-[68ch]">
          Une seule enveloppe publicitaire, fixée pour l&apos;année. Le mois et le jour en
          découlent — et la vraie question est de savoir dans quels thèmes elle part.
        </p>
      </div>

      {/* ══ 1 · TENIR L'ANNÉE ═══════════════════════════════════════════════ */}
      <section className="mb-9">
        <Titre sur="Fixer le cap">L&apos;année {annee}</Titre>

        <AlerteDepassement alertes={data.alertes} budgetJour={data.budgetJour} />

        <div className="flex overflow-x-auto sm:grid sm:grid-cols-3 gap-3 mb-4 pb-1 sm:pb-0">
          <Chiffre
            titre="Budget annuel"
            valeur={data.budgetAnnuel > 0 ? `${fmtCHF(data.budgetAnnuel)} CHF` : "—"}
            sous={
              ratioAn !== null
                ? `${Math.round(ratioAn * 100)} % consommé · repère ${Math.round(data.elapsedAn * 100)} % de l'année`
                : "à fixer juste en dessous"
            }
            ton={ratioAn !== null && ratioAn > 1 ? "neg" : "ink"}
            serie={data.parMois}
          />
          <Chiffre
            titre="Budget mensuel"
            valeur={data.totalBudget > 0 ? `${fmtCHF(data.totalBudget)} CHF` : "—"}
            sous={
              ratioMois !== null
                ? `${SOURCE_MOIS[data.sourceBudgetMois]} · ${Math.round(ratioMois * 100)} % consommé ce mois`
                : SOURCE_MOIS.aucun
            }
            ton={ratioMois !== null && ratioMois > 1 ? "neg" : "ink"}
            serie={data.daily.map((j) => j.meta + j.google)}
          />
          <Chiffre
            titre="Moyenne quotidienne"
            valeur={`${fmtCHF(data.moyenneJour)} CHF`}
            sous={
              data.repereJour > 0
                ? `depuis janvier · tiens ${fmtCHF(data.repereJour)} CHF par jour pour finir l'année dans l'enveloppe`
                : "depuis janvier, tous canaux confondus"
            }
            // Le repère n'est pas budget ÷ 365 mais « ce qui reste ÷ les jours
            // qui restent » : sinon un début d'année calme se lit comme un
            // dérapage, et une fin d'année emballée passe inaperçue.
            ton={data.repereJour > 0 && data.moyenneJour > data.repereJour * 1.05 ? "warn" : "ink"}
            serie={data.daily.map((j) => j.meta + j.google)}
          />
        </div>

        <EnveloppeAnnee
          annee={annee}
          spentYear={data.spentYear}
          budgetAnnuel={data.budgetAnnuel}
          budgetAnnuelSaisi={data.budgetAnnuelSaisi}
          source={data.sourceBudgetAnnuel}
          elapsedAn={data.elapsedAn}
          channels={data.channels}
          attribue={attribue}
        />
      </section>

      {/* ══ 2 · OÙ ÇA PART ══════════════════════════════════════════════════ */}
      <section className="mb-9">
        <Titre sur="Regarder de près">Où ça part</Titre>
        <p className="text-[12.5px] text-muted leading-relaxed mb-3.5 -mt-1 max-w-[68ch]">
          Choisis une période et les thèmes qui t&apos;intéressent : l&apos;anneau dit la
          répartition, la courbe dit le rythme. La liste des thèmes, plus bas, reste sur
          l&apos;année entière.
        </p>

        <FiltreCouts
          labels={univers}
          choisis={data.labelsChoisis}
          preset={data.periode.preset}
          from={data.periode.preset === "custom" ? data.periode.from : undefined}
          to={data.periode.preset === "custom" ? data.periode.to : undefined}
          teintes={teintes}
        />

        {data.totalPeriode > 0 ? (
          <div className="mb-4">
            <ThemeDonut
              rows={vus.map((t) => ({ label: t.label, spend: t.spendPeriode }))}
              orphan={Math.max(0, data.totalPeriode - vus.reduce((a, t) => a + t.spendPeriode, 0))}
              univers={data.labels}
              titre="Dépensé par thème"
              sousTitre={data.periode.titre}
              montants
              note="La part grise « autres » est ce qui n'est rattaché à aucun thème — des campagnes qu'il reste à étiqueter."
            />
          </div>
        ) : (
          <p className="text-[12.5px] text-muted leading-relaxed mb-4">
            Aucune dépense sur cette période
            {data.filtreActif ? " pour les thèmes choisis" : ""}.
          </p>
        )}

        <CourbeDepense
          serie={data.serie}
          pas={data.periode.pas}
          titre={data.periode.titre}
          repere={repereCourbe}
          filtreActif={data.filtreActif}
          dernierePartielle={data.dernierePartielle}
        />
      </section>

      {/* ══ 3 · PAR THÈME ═══════════════════════════════════════════════════ */}
      {vus.length > 0 && (
        <section className="mb-9">
          <Titre sur="La vraie question">Dans quels thèmes ça part</Titre>
          <p className="text-[12.5px] text-muted leading-relaxed mb-3.5 -mt-1 max-w-[68ch]">
            C&apos;est ici que se prend la seule décision de la page : quel thème mérite
            l&apos;enveloppe de l&apos;année, et lequel en consomme sans la rendre.
          </p>

          <ScrollList title={`Par thème · l'année ${annee}`} count={vus.length} maxH="max-h-[60vh]">
            {vus.map((t) => (
              <LigneTheme
                key={t.label}
                t={t}
                part={data.spentYear > 0 ? (t.spendYear / data.spentYear) * 100 : 0}
                elapsedAn={data.elapsedAn}
                annee={annee}
                univers={data.labels}
              />
            ))}
          </ScrollList>
        </section>
      )}

      {/* ══ RÉGLAGES ════════════════════════════════════════════════════════
          Tout ce qui se saisit une fois et ne se relit pas. Rien n'est perdu :
          les budgets mensuels déjà posés restent actifs, modifiables, et
          continuent de primer sur la déduction depuis l'annuel. */}
      <details className="mb-6">
        <summary className="text-[13px] font-semibold text-ink cursor-pointer select-none">
          ⚙ Réglages du budget — enveloppe du mois, détail mois par mois
        </summary>

        <div className="mt-4 bg-white border border-line rounded-xl shadow-card p-5 mb-4">
          <BudgetEditor
            channel="global"
            current={data.budgetGlobalSaisi}
            periode="mois"
            libelle="Enveloppe du mois"
          />
          <p className="text-[11px] text-faint mt-2 leading-relaxed">
            À laisser vide dans la plupart des cas : sans montant ici, le budget du mois est
            déduit de ton enveloppe d&apos;année (÷ 12), et c&apos;est ce qui permet de ne
            rien taper d&apos;autre. Un montant posé ici prend le pas sur cette déduction et
            se reporte sur les mois suivants tant que tu ne le changes pas.
          </p>
        </div>

        {data.byTheme.some((t) => t.budget > 0) && (
          <div className="bg-white border border-line rounded-xl shadow-card p-5 mb-4">
            <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-3">
              Budgets mensuels déjà fixés par thème
            </div>
            <div className="grid sm:grid-cols-2 gap-x-5 gap-y-3">
              {data.byTheme
                .filter((t) => t.budget > 0)
                .map((t) => (
                  <div key={t.label} className="border-l-2 border-line pl-3">
                    <div className="text-[12px] font-semibold text-ink">{t.label}</div>
                    <BudgetEditor
                      channel={`label:${t.label}`}
                      current={t.budget}
                      periode="mois"
                      libelle="Budget du mois"
                    />
                  </div>
                ))}
            </div>
            <p className="text-[11px] text-faint mt-3 leading-relaxed">
              Ces montants restent actifs et modifiables ici. Ils ne s&apos;affichent plus
              dans la liste des thèmes : le pilotage se fait à l&apos;année. Tant
              qu&apos;aucune enveloppe d&apos;année n&apos;est posée sur un thème, on
              additionne ses douze mois.
            </p>
          </div>
        )}

        <div className="mt-3">
          <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-2">
            Le détail mois par mois
          </div>
          <BudgetYearTable months={data.months} />
        </div>
      </details>
    </main>
  );
}
