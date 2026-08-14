// Coûts — UN horizon qui se pilote, L'ANNÉE. Le reste s'y rattache.
//
// La page a d'abord porté trois horizons de même poids (jour, mois, année) et
// demandait le même montant par quatre portes différentes. On l'a ramenée au
// mois ; elle se range aujourd'hui sur l'ANNÉE, et c'est le bon niveau : une
// enveloppe publicitaire se décide une fois — un exercice, une saison, un salon
// — puis on passe l'année à vérifier qu'on la tient. Le mois n'est pas une
// saisie de plus, c'est une lecture de l'année ; le jour non plus.
//
// Ce que ça change concrètement : le mois se DÉDUIT de l'annuel (÷ 12), et
// c'est sa SEULE source depuis la suppression du dépliant de réglages. Un seul
// nombre à taper — l'enveloppe de l'année — fait vivre le mois, le jour, les
// alertes et toutes les barres de la page.
//
// Trois lectures, dans cet ordre, et pas une de plus :
//   1 · TENIR L'ANNÉE — trois chiffres de cadrage, puis DEUX modules côte à
//       côte : l'enveloppe fixée et sa répartition à gauche (1/3, aucune
//       forme), la dépense avec sa barre et le trait du calendrier à droite
//       (2/3). Décider une enveloppe et surveiller une dépense ne se font ni au
//       même rythme ni dans le même état d'esprit.
//   2 · OÙ ÇA PART — filtrable par période et par thèmes : deux anneaux (par
//       plateforme, par thème) disent la répartition, la courbe dit le rythme.
//   3 · PAR THÈME — la seule décision de la page, à l'année elle aussi, en
//       grille de trois colonnes et toujours défilante.
//
// IL N'Y A PLUS DE SECTION « RÉGLAGES ». Ce qui s'y saisissait — l'enveloppe du
// mois, les budgets mensuels par thème, la table mois par mois — demandait douze
// nombres pour en produire un seul, et le premier de ces nombres primait
// silencieusement sur l'enveloppe d'année. Tout se règle maintenant à l'endroit
// où le chiffre se lit. Les modules vivent dans
// `components/couts-modules.tsx` : cette page les compose, elle n'en dessine
// aucun.

import { getCoutsData, type ThemeSpend } from "@/lib/couts";
import { getBudgetPlanifie } from "@/lib/budgets";
import { fmtCHF } from "@/lib/report";
import {
  AlerteDepassement,
  CourbeDepense,
  DepenseAnnee,
  EnveloppeAnnee,
  LigneTheme,
} from "@/components/couts-modules";
import { FiltreCouts } from "@/components/filtre-couts";
import { dateCourte } from "@/components/etat-action";
import { ScrollList } from "@/components/scroll-list";
import { ThemeDonut } from "@/components/theme-donut";
import { Chiffre } from "@/components/chiffre";
import { teinteLabel, type Teinte } from "@/lib/palette";

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

// Le mois n'a plus qu'une provenance possible, et il continue de l'écrire là
// où le nombre s'affiche : c'est la règle qui a fait naître cette page, un
// client lisait « enveloppe : 3 000 CHF » sans l'avoir jamais tapée.
const SOURCE_MOIS: Record<string, string> = {
  annuel: "ton enveloppe d'année ÷ 12",
  aucun: "fixe ton enveloppe d'année, le mois en découle",
};

// Les couleurs de canal, forcées sur l'anneau par plateforme. `teinteLabel`
// indexe sur la liste des THÈMES : Meta et Google y prendraient deux teintes
// arbitraires, et Google pourrait sortir en bleu — la couleur de Meta dans
// dix-huit autres endroits de l'application.
const TEINTE_CANAL: Record<string, Teinte> = {
  Meta: { nom: "meta", trait: "#1a56ff", aplat: "rgba(26, 86, 255, 0.14)" },
  Google: { nom: "google", trait: "#1a7a4a", aplat: "rgba(26, 122, 74, 0.14)" },
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
  // Le budget POSÉ sur les campagnes, sur l'année entière — pas sur la période
  // filtrée : c'est l'enveloppe de l'année qu'il vient compléter, et un budget
  // planifié restreint à « 30 derniers jours » ne voudrait rien dire (une photo
  // hebdomadaire n'a pas de fenêtre).
  const planifie = await getBudgetPlanifie(`${annee}-01-01`, `${annee}-12-31`);
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
    /* max-w-6xl et non 5xl : deux anneaux côte à côte et une liste de thèmes en
       trois colonnes n'ont pas la place dans 1 024 px — à 5xl, la troisième
       colonne descendait sous la deuxième et la grille ne servait plus à rien. */
    <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 lg:py-9">
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
            // Un mois ne se saisit plus : il n'y a plus qu'une source, et c'est
            // pour ça que la phrase ci-dessus a cessé de varier.
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

        {/* L'ENVELOPPE À GAUCHE SUR 1/3, LA DÉPENSE À DROITE SUR 2/3.
            Un seul module pleine largeur portait les deux, et il mélangeait
            deux gestes de fréquence opposée : décider l'enveloppe (une fois par
            an) et surveiller la dépense (chaque semaine). Le champ de saisie
            finissait sous une barre, trois chiffres de bilan et deux
            plateformes — soit tout en bas de ce qu'il commande.

            `minmax(0, …)` sur les deux colonnes, et `min-w-0` sur chaque
            module : un élément de grille vaut `min-width: auto` par défaut, un
            nombre en mono qui ne se coupe pas l'empêche alors de rétrécir, et
            c'est la PAGE ENTIÈRE qui se met à défiler horizontalement.
            Sur téléphone ils s'empilent dans l'ordre du DOM — l'enveloppe
            d'abord, parce qu'on ne surveille pas un budget avant de l'avoir
            fixé. */}
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3 mb-4 items-stretch">
          <EnveloppeAnnee
            annee={annee}
            budgetAnnuel={data.budgetAnnuel}
            budgetAnnuelHerite={data.budgetAnnuelHerite}
            attribue={attribue}
          />
          <DepenseAnnee
            annee={annee}
            spentYear={data.spentYear}
            budgetAnnuel={data.budgetAnnuel}
            elapsedAn={data.elapsedAn}
            planifie={planifie}
          />
        </div>
      </section>

      {/* ══ 2 · OÙ ÇA PART ══════════════════════════════════════════════════ */}
      <section className="mb-9">
        <Titre sur="Regarder de près">Où ça part</Titre>
        <p className="text-[12.5px] text-muted leading-relaxed mb-3.5 -mt-1 max-w-[68ch]">
          Choisis une période et les thèmes qui t&apos;intéressent : les deux anneaux
          disent la répartition — par plateforme, puis par thème — et la courbe dit le
          rythme. La liste des thèmes, plus bas, reste sur l&apos;année entière.
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
          /* DEUX ANNEAUX, PAS UN. « Où ça part » a deux réponses qui ne se
             déduisent pas l'une de l'autre : sur quelle RÉGIE, et sur quel
             THÈME. Un compte à 80 % sur Google et un compte partagé ne se
             pilotent pas pareil, et cette question-là n'avait aucune réponse
             sur la page — il fallait aller sur les pages canal les lire une par
             une. Les deux obéissent au même filtre de période et de thèmes, et
             affichent donc exactement le même total au centre : c'est ce qui
             fait qu'on les lit comme deux découpes d'un seul gâteau.
             La plateforme est à GAUCHE parce que c'est la découpe la plus
             grossière — deux parts contre dix. */
          <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-3 mb-4 items-stretch">
            <ThemeDonut
              rows={[
                { label: "Meta", spend: data.parCanalPeriode.meta },
                { label: "Google", spend: data.parCanalPeriode.google },
              ]}
              teintes={TEINTE_CANAL}
              titre="Dépensé par plateforme"
              sousTitre={data.periode.titre}
              unite="plateforme"
              montants
              etroit
              note={
                data.filtreActif
                  ? "Sur les thèmes que tu as choisis uniquement — les campagnes sans thème sont exclues, comme dans l'anneau voisin."
                  : "Tout le compte sur la période. Un déséquilibre n'est pas un défaut en soi : c'est une question à se poser quand il n'a jamais été décidé."
              }
            />
            <ThemeDonut
              rows={vus.map((t) => ({ label: t.label, spend: t.spendPeriode }))}
              orphan={Math.max(0, data.totalPeriode - vus.reduce((a, t) => a + t.spendPeriode, 0))}
              univers={data.labels}
              titre="Dépensé par thème"
              sousTitre={data.periode.titre}
              montants
              etroit
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
            l&apos;enveloppe de l&apos;année, et lequel en consomme sans la rendre. Un thème
            sans enveloppe affiche sa dépense et rien d&apos;autre — aucun pourcentage
            n&apos;est estimé à partir d&apos;anciens réglages.
          </p>
          {/* Le PIED DE SECTION, monté d'un cran : il serait identique sous les
              trente-cinq cartes, et la grammaire dit qu'un pied qui se répète
              appartient à la section. « Réglé dans Meta et Google » était écrit
              « Posé sur ses campagnes », que personne ne reliait à un réglage de
              régie ; et son état vide ne disait pas que le chiffre finit par
              arriver tout seul.

              RESSERRÉ, parce que le pied de `DepenseAnnee` définit déjà ce
              nombre mot pour mot, huit cents pixels plus haut, et que le
              lecteur passe par là avant d'arriver ici. Ce qui restait à dire
              n'est pas la définition mais le LIEN : c'est le même relevé,
              découpé par thème. On garde quand même de quoi comprendre sans
              remonter — « pas ce qui en est parti » est la confusion que ce
              libellé existe pour éviter, elle ne se sous-entend pas.

              La date passe par `dateCourte` : `releveLe` sort de la base en ISO
              (`2026-08-10`), illisible au milieu d'une phrase française. Le
              repli tient la valeur `null`, que `vide === false` n'exclut pas
              formellement. */}
          <p className="text-[11.5px] text-faint leading-relaxed mb-3 max-w-[68ch]">
            « Budget réglé dans Meta et Google » est le même relevé qu&apos;en haut de
            page, découpé thème par thème : ce que tu prévois d&apos;y mettre, pas ce qui
            en est parti.
            {planifie.vide
              ? " Le premier passage hebdomadaire n'a pas encore eu lieu — le chiffre apparaîtra tout seul."
              : ` Relevé le ${planifie.releveLe ? dateCourte(planifie.releveLe) : "—"}.`}
          </p>

          {/* TROIS COLONNES, ET TOUJOURS DÉFILANTE. Une ligne par thème sur
              toute la largeur donnait 35 lignes de 90 px pour un contenu qui en
              occupe 300 : on faisait défiler pendant dix secondes pour comparer
              deux thèmes qui auraient tenu côte à côte.

              LES CARTES SE DÉTACHENT. Elles étaient collées, séparées par un
              seul filet partagé (`gap-px bg-line`) qui ne courait pas sur les
              quatre côtés : deux cartes voisines se lisaient comme une seule
              zone, et la troisième colonne se confondait avec le bord du cadre.
              Chacune a maintenant sa bordure complète, son arrondi et son air
              autour. Le fond du contenu reste TRANSPARENT — `.defile` peint ses
              ombres de défilement derrière lui, un fond opaque les éteindrait. */}
          <ScrollList
            title={`Par thème · l'année ${annee}`}
            count={vus.length}
            maxH="max-h-[70vh]"
            divise={false}
          >
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 p-3">
              {vus.map((t) => (
                <div
                  key={t.label}
                  className="min-w-0 rounded-xl border border-line bg-white shadow-card"
                >
                  <LigneTheme
                    t={t}
                    part={data.spentYear > 0 ? (t.spendYear / data.spentYear) * 100 : 0}
                    elapsedAn={data.elapsedAn}
                    annee={annee}
                    univers={data.labels}
                    planifie={planifie}
                  />
                </div>
              ))}
            </div>
          </ScrollList>
        </section>
      )}

      {/* IL N'Y A PLUS QU'UN SEUL CHAMP D'ENVELOPPE SUR CETTE PAGE, ET C'EST LE
          FIL À PLOMB DE TOUT LE RESTE. Trois suppressions successives y mènent,
          et elles obéissent toutes à la même règle : un montant qui gouverne un
          écran et qu'aucun écran ne permet plus de corriger est pire qu'un
          montant faux.

          · le dépliant « ⚙ Réglages du budget » (enveloppe du mois, budgets
            mensuels par thème, table mois par mois) — douze nombres pour en
            produire un. Le mois vient depuis TOUJOURS de l'annuel ÷ 12 ;
          · les deux enveloppes par PLATEFORME dans le module de l'année. Leur
            somme primait sur l'annuel quand il était vide ; l'éditeur parti, la
            branche de préséance part avec lui. `lib/couts.ts` n'a donc plus
            aucune règle de préséance sur l'année : `budgetAnnuel` vaut ce qui a
            été tapé, ou zéro ;
          · l'estimation d'enveloppe PAR THÈME, qui retombait sur la somme des
            douze mensuels du thème. Elle ne touchait que les thèmes ayant un
            vieux mensuel : la page semblait juger certains thèmes et pas
            d'autres, sur un dénominateur que personne n'avait tapé.

          Ce qui est en base n'est pas détruit et l'écran le DIT :
          `budgetAnnuelHerite` et `ThemeSpend.budgetYearHerite` ne servent qu'à
          écrire « ces montants ne comptent plus », là où le nombre a disparu. Un
          réglage qu'on abandonne se raconte, il ne s'efface pas en silence. */}
    </main>
  );
}
