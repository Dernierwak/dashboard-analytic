// Coûts — trois horizons, dans l'ordre où l'on peut encore agir dessus :
//   LE JOUR   on peut couper une campagne emballée aujourd'hui ;
//   LE MOIS   on peut corriger le rythme avant la fin ;
//   L'ANNÉE   on ne peut plus que constater, et décider pour la suite.
//
// Un seul budget, pas un par plateforme : personne ne raisonne « 2 000 sur
// Meta et 10 000 sur Google ». On a une enveloppe publicitaire, et la vraie
// question est de savoir dans quels THÈMES elle part. Le détail par plateforme
// reste calculé et lisible dans le graphe, il n'est simplement plus un endroit
// où l'on fixe un budget (voir le bloc mis en commentaire plus bas).

import { getCoutsData, type CoutDay, type ThemeSpend, type MonthRow, type AlerteJour } from "@/lib/couts";
import { fmtCHF } from "@/lib/report";
import { BudgetEditor } from "@/components/budget-editor";
import { BudgetYearTable } from "@/components/budget-year-table";
import { ScrollList } from "@/components/scroll-list";
import { LineChart } from "@/components/line-chart";
import { teinte } from "@/lib/palette";

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

function Tuile({
  titre,
  valeur,
  sous,
  ton = "ink",
}: {
  titre: string;
  valeur: string;
  sous: string;
  ton?: "ink" | "pos" | "neg" | "warn";
}) {
  const cls =
    ton === "neg" ? "text-neg" : ton === "pos" ? "text-pos" : ton === "warn" ? "text-warn" : "text-ink";
  return (
    <div className="bg-white border border-line rounded-xl p-4 min-w-[190px] shrink-0 sm:min-w-0 sm:shrink">
      <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1.5">
        {titre}
      </div>
      <div className={`font-mono text-xl font-medium ${cls}`}>{valeur}</div>
      <div className="text-[11px] text-faint mt-1 leading-snug">{sous}</div>
    </div>
  );
}

// ── LE JOUR ────────────────────────────────────────────────────────────────
// Le garde-fou que le budget mensuel ne donne pas : à la fin du mois, l'argent
// est déjà parti. Ramené à la journée, un dérapage se voit le lendemain.
function Quotidien({
  budgetJour,
  moyenneJour,
  alertes,
  joursMois,
}: {
  budgetJour: number;
  moyenneJour: number;
  alertes: AlerteJour[];
  joursMois: number;
}) {
  if (budgetJour <= 0) return null;
  const ecart = moyenneJour / budgetJour;
  const pire = alertes[0];

  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-5 mb-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <div className="text-[10px] uppercase tracking-wide text-faint font-semibold">
          Rythme quotidien
        </div>
        <div className="text-[11px] text-faint">
          budget ÷ {joursMois} jours
        </div>
      </div>

      <div className="flex items-end gap-6 flex-wrap">
        <div>
          <div className="font-mono text-[22px] font-medium text-ink leading-none">
            {fmtCHF(budgetJour)} <span className="text-[13px] text-faint">CHF / jour</span>
          </div>
          <div className="text-[11.5px] text-faint mt-1">ce que tu peux dépenser par jour</div>
        </div>
        <div>
          <div
            className={`font-mono text-[22px] font-medium leading-none ${
              ecart > 1.1 ? "text-neg" : ecart > 0.95 ? "text-warn" : "text-pos"
            }`}
          >
            {fmtCHF(moyenneJour)} <span className="text-[13px] text-faint">CHF / jour</span>
          </div>
          <div className="text-[11.5px] text-faint mt-1">
            ta moyenne réelle —{" "}
            {ecart > 1.1
              ? `${Math.round((ecart - 1) * 100)} % au-dessus`
              : ecart > 0.95
                ? "au niveau"
                : `${Math.round((1 - ecart) * 100)} % en dessous`}
          </div>
        </div>
      </div>

      {alertes.length > 0 ? (
        <div className="mt-4 rounded-xl border border-warn/25 bg-warn/[0.05] px-4 py-3">
          <div className="text-[10px] uppercase tracking-widest text-warn font-bold mb-1.5">
            {alertes.length} journée{alertes.length > 1 ? "s" : ""} au-dessus du budget du jour
          </div>
          <p className="text-[12.5px] text-ink leading-relaxed">
            La pire : <span className="font-semibold">{pire.label}</span> à{" "}
            <span className="font-mono">{fmtCHF(pire.montant)} CHF</span>, soit{" "}
            {Math.round((pire.ratio - 1) * 100)} % de plus que prévu pour une journée.
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {alertes.slice(0, 12).map((a) => (
              <span
                key={a.date}
                title={`${fmtCHF(a.montant)} CHF — ${Math.round(a.ratio * 100)} % du budget du jour`}
                className="font-mono text-[10.5px] text-warn bg-white border border-warn/25 rounded-full px-2 py-0.5"
              >
                {a.label} ×{a.ratio.toFixed(1)}
              </span>
            ))}
            {alertes.length > 12 && (
              <span className="text-[10.5px] text-faint self-center">
                +{alertes.length - 12} autres
              </span>
            )}
          </div>
        </div>
      ) : (
        <p className="text-[11.5px] text-pos font-medium mt-3">
          Aucune journée au-dessus du budget quotidien ce mois-ci.
        </p>
      )}
    </div>
  );
}

// Deux courbes plutôt qu'un empilement : on compare les canaux entre eux, au
// lieu de lire une somme dont il faut soustraire mentalement le bas.
function CourbeJournaliere({ daily, budgetJour }: { daily: CoutDay[]; budgetJour: number }) {
  if (daily.length === 0) return null;
  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-5 mb-4">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <div className="text-[10px] uppercase tracking-wide text-faint font-semibold">
          Dépense par jour · mois en cours
        </div>
        <div className="flex items-center gap-3 text-[10.5px] text-faint">
          <span><span style={{ color: "#1a56ff" }}>■</span> Meta</span>
          <span><span style={{ color: "#1a7a4a" }}>■</span> Google</span>
          {budgetJour > 0 && (
            <span><span style={{ color: "#b86b00" }}>┄</span> budget du jour</span>
          )}
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
        repere={
          budgetJour > 0
            ? { value: budgetJour, label: `${fmtCHF(budgetJour)} CHF / jour` }
            : undefined
        }
      />
      <p className="text-[10.5px] text-faint mt-2 leading-relaxed">
        Le trait orange est ton budget quotidien, tous canaux confondus. Les courbes sont
        par canal : elles peuvent passer dessous chacune tout en dépassant une fois
        additionnées.
      </p>
    </div>
  );
}

// Réconciliation : l'enveloppe globale d'un côté, ce qu'on a promis aux thèmes
// de l'autre. Sans cette vue, on ne sait jamais s'il reste de la marge ni si on
// a engagé deux fois le même franc.
function Repartition({
  byTheme,
  total,
  periode,
}: {
  byTheme: ThemeSpend[];
  total: number;
  periode: "mois" | "an";
}) {
  const budgetDe = (t: ThemeSpend) => (periode === "an" ? t.budgetYear : t.budget);
  const attribue = byTheme.reduce((a, t) => a + budgetDe(t), 0);
  const avecBudget = byTheme.filter((t) => budgetDe(t) > 0);
  const reste = total - attribue;
  const depasse = reste < 0;

  if (total <= 0) {
    return (
      <p className="text-[12px] text-muted leading-relaxed mb-3">
        Fixe l&apos;enveloppe {periode === "an" ? "de l'année" : "du mois"} ci-dessus — les
        budgets par thème viendront s&apos;y découper, et tu verras ce qu&apos;il te reste
        à répartir.
      </p>
    );
  }

  const base = Math.max(total, attribue);
  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-5 mb-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2.5">
        <div className="text-[10px] uppercase tracking-wide text-faint font-semibold">
          Répartition {periode === "an" ? "de l'année" : "du mois"} · thèmes dans l&apos;enveloppe
        </div>
        <div className="font-mono text-[12.5px] text-ink">
          {fmtCHF(attribue)} <span className="text-faint">/ {fmtCHF(total)} CHF</span>
        </div>
      </div>

      <div className="flex h-3 rounded-full overflow-hidden bg-black/[0.05]">
        {avecBudget.map((t, i) => (
          <div
            key={t.label}
            style={{ width: `${(budgetDe(t) / base) * 100}%`, background: teinte(i).trait, opacity: 0.85 }}
            title={`${t.label} — ${fmtCHF(budgetDe(t))} CHF`}
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
                className="h-2.5 w-2.5 rounded-full inline-block border-2"
                style={{ background: teinte(i).aplat, borderColor: teinte(i).trait }}
              />
              {t.label} <span className="font-mono text-muted">{fmtCHF(budgetDe(t))}</span>
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
          La somme de tes budgets par thème dépasse ton enveloppe. Baisse un thème, ou
          remonte l&apos;enveloppe.
        </p>
      )}
    </div>
  );
}

function BarreBudget({ ratio, repere }: { ratio: number; repere?: number }) {
  const couleur = ratio > 1 ? "#c0392b" : repere !== undefined && ratio > repere + 0.1 ? "#b86b00" : "#1a56ff";
  return (
    <div className="relative h-1.5 rounded-full bg-black/[0.06] overflow-hidden mt-1.5">
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${Math.min(100, ratio * 100)}%`, background: couleur }}
      />
      {repere !== undefined && (
        <div className="absolute inset-y-0 w-[2px] bg-ink/40" style={{ left: `${repere * 100}%` }} />
      )}
    </div>
  );
}

function AnneeTuiles({ months, spentYear, budgetAnnuel }: { months: MonthRow[]; spentYear: number; budgetAnnuel: number }) {
  const passes = months.filter((m) => !m.isFuture);
  // En jours, pas en mois entiers : le 2 août, compter août comme écoulé
  // annoncerait 67 % d'année passée au lieu de 58, et ferait croire qu'on est
  // très en dessous du budget alors qu'on est dans les clous.
  const now = new Date();
  const debut = new Date(now.getFullYear(), 0, 1);
  const fin = new Date(now.getFullYear() + 1, 0, 1);
  const partEcoulee = (now.getTime() - debut.getTime()) / (fin.getTime() - debut.getTime());
  const attendu = budgetAnnuel * partEcoulee;
  const ecart = attendu - spentYear;

  return (
    <div className="flex overflow-x-auto sm:grid sm:grid-cols-3 gap-3 mb-4 pb-1 sm:pb-0">
      <Tuile
        titre="Dépensé depuis janvier"
        valeur={`${fmtCHF(spentYear)} CHF`}
        sous={`Meta + Google · ${passes.length} mois`}
      />
      <Tuile
        titre="Enveloppe de l'année"
        valeur={budgetAnnuel > 0 ? `${fmtCHF(budgetAnnuel)} CHF` : "—"}
        sous={budgetAnnuel > 0 ? `${Math.round(partEcoulee * 100)} % de l'année écoulée` : "à fixer ci-dessous"}
      />
      {budgetAnnuel > 0 ? (
        <Tuile
          titre="Où tu en es"
          valeur={ecart < 0 ? `+${fmtCHF(-ecart)} CHF` : `−${fmtCHF(ecart)} CHF`}
          sous={
            ecart < 0
              ? "au-dessus du rythme prévu à ce point de l'année"
              : "sous le rythme prévu à ce point de l'année"
          }
          ton={ecart < 0 ? "neg" : "pos"}
        />
      ) : (
        <Tuile titre="Où tu en es" valeur="—" sous="fixe une enveloppe annuelle pour te situer" />
      )}
    </div>
  );
}

export default async function CoutsPage() {
  const data = await getCoutsData();
  const reste = data.totalBudget - data.totalSpent;
  const annee = Number(data.monthLabel.slice(-4));
  const ratioMois = data.totalBudget > 0 ? data.totalSpent / data.totalBudget : null;

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
          Une seule enveloppe publicitaire, lue à trois échelles : la journée pour
          réagir, le mois pour corriger, l&apos;année pour décider.
        </p>
      </div>

      {/* ══ 1 · CE MOIS-CI ══════════════════════════════════════════════════ */}
      <section className="mb-9">
        <Titre sur="Corriger le rythme">Ce mois-ci</Titre>

        <div className="flex overflow-x-auto sm:grid sm:grid-cols-3 gap-3 mb-4 pb-1 sm:pb-0">
          <Tuile
            titre="Dépensé"
            valeur={`${fmtCHF(data.totalSpent)} CHF`}
            sous={`tous canaux · ${Math.round(data.elapsed * 100)} % du mois écoulé`}
          />
          <Tuile
            titre="Enveloppe du mois"
            valeur={data.totalBudget > 0 ? `${fmtCHF(data.totalBudget)} CHF` : "—"}
            sous={
              data.budgetGlobalSaisi > 0
                ? "budget unique, tous canaux"
                : data.totalBudget > 0
                  ? "hérité de tes budgets par plateforme"
                  : "à fixer ci-dessous"
            }
          />
          <Tuile
            titre="Reste"
            valeur={data.totalBudget > 0 ? `${fmtCHF(reste)} CHF` : "—"}
            sous={
              ratioMois !== null
                ? `${Math.round(ratioMois * 100)} % consommé · repère ${Math.round(data.elapsed * 100)} %`
                : "sans budget, pas de reste à calculer"
            }
            ton={data.totalBudget > 0 && reste < 0 ? "neg" : "ink"}
          />
        </div>

        <div className="bg-white border border-line rounded-xl shadow-card p-5 mb-4">
          {ratioMois !== null && <BarreBudget ratio={ratioMois} repere={data.elapsed} />}
          <BudgetEditor
            channel="global"
            current={data.budgetGlobalSaisi > 0 ? data.budgetGlobalSaisi : data.totalBudget}
            periode="mois"
            libelle="Enveloppe du mois"
          />
          <p className="text-[11px] text-faint mt-2 leading-relaxed">
            Ce montant se reporte sur les mois suivants tant que tu ne le changes pas. Le
            trait vertical de la barre marque la part du mois écoulée : le dépasser
            largement, c&apos;est dépenser plus vite que le calendrier.
          </p>
        </div>

        <Quotidien
          budgetJour={data.budgetJour}
          moyenneJour={data.moyenneJour}
          alertes={data.alertes}
          joursMois={data.joursMois}
        />

        <CourbeJournaliere daily={data.daily} budgetJour={data.budgetJour} />

        {data.byTheme.length > 0 && (
          <Repartition byTheme={data.byTheme} total={data.totalBudget} periode="mois" />
        )}
      </section>

      {/* ══ 2 · CETTE ANNÉE ═════════════════════════════════════════════════ */}
      <section className="mb-9">
        <Titre sur="Décider pour la suite">L&apos;année {annee}</Titre>

        <AnneeTuiles
          months={data.months}
          spentYear={data.spentYear}
          budgetAnnuel={data.budgetAnnuel}
        />

        <div className="bg-white border border-line rounded-xl shadow-card p-5 mb-4">
          <BudgetEditor
            channel="global"
            current={data.budgetAnnuelSaisi > 0 ? data.budgetAnnuelSaisi : data.budgetAnnuel}
            periode="an"
            annee={annee}
            libelle={`Enveloppe ${annee}`}
          />
          <p className="text-[11px] text-faint mt-2 leading-relaxed">
            L&apos;enveloppe de l&apos;année est indépendante du mensuel : un budget de
            saison ou de salon ne se répartit pas en douze parts égales.{" "}
            {data.budgetAnnuelSaisi === 0 && data.budgetAnnuel > 0 && (
              <>Tant que rien n&apos;est saisi ici, on additionne tes douze budgets mensuels.</>
            )}
          </p>
        </div>

        {data.byTheme.length > 0 && (
          <Repartition byTheme={data.byTheme} total={data.budgetAnnuel} periode="an" />
        )}

        <details className="mb-2">
          <summary className="text-[13px] font-semibold text-ink cursor-pointer select-none mb-3">
            ▦ Le détail mois par mois — voir et modifier
          </summary>
          <div className="mt-3">
            <BudgetYearTable months={data.months} />
          </div>
        </details>
      </section>

      {/* ══ 3 · PAR THÈME ═══════════════════════════════════════════════════ */}
      {data.byTheme.length > 0 && (
        <section className="mb-9">
          <Titre sur="La vraie question">Dans quels thèmes ça part</Titre>
          <p className="text-[12.5px] text-muted leading-relaxed mb-3.5 -mt-1 max-w-[68ch]">
            Le mois dit où tu en es, l&apos;année dit si tu tiens ton enveloppe. Fixe les
            deux : ils ne répondent pas à la même question.
          </p>

          <ScrollList
            title="Par thème · le mois et l'année"
            count={data.byTheme.length}
            maxH="max-h-[60vh]"
          >
            {data.byTheme.map((t) => {
              const share = data.totalSpent > 0 ? (t.spend / data.totalSpent) * 100 : 0;
              const cartes = [
                { cle: "mois" as const, titre: "Ce mois-ci", d: t.spend, b: t.budget, repere: data.elapsed },
                { cle: "an" as const, titre: `Depuis janvier`, d: t.spendYear, b: t.budgetYear, repere: undefined },
              ];
              return (
                <div key={t.label} className="px-5 py-4">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <span className="text-[13.5px] font-semibold text-brand">{t.label}</span>
                    <span className="text-[11px] text-faint">
                      {share.toFixed(0)} % de la dépense du mois
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-x-5 gap-y-3">
                    {cartes.map((c) => {
                      const r = c.b > 0 ? c.d / c.b : null;
                      return (
                        <div key={c.cle} className="border-l-2 border-line pl-3">
                          <div className="text-[10px] uppercase tracking-wide text-faint font-semibold">
                            {c.titre}
                          </div>
                          <div className="font-mono text-[13.5px] text-ink mt-0.5">
                            {fmtCHF(c.d)} CHF
                            {c.b > 0 && (
                              <span className="text-faint text-[11.5px]"> / {fmtCHF(c.b)}</span>
                            )}
                          </div>
                          {r !== null ? (
                            <>
                              <BarreBudget ratio={r} repere={c.repere} />
                              <div
                                className={`text-[11px] mt-1 font-semibold ${
                                  r > 1 ? "text-neg" : "text-muted"
                                }`}
                              >
                                {r > 1
                                  ? `dépassé de ${fmtCHF(c.d - c.b)} CHF`
                                  : `${Math.round(r * 100)} % du budget`}
                              </div>
                            </>
                          ) : (
                            <div className="text-[11px] text-faint mt-1.5">pas de budget fixé</div>
                          )}
                          <BudgetEditor
                            channel={`label:${t.label}`}
                            current={c.cle === "an" ? t.budgetYearSaisi : t.budget}
                            periode={c.cle}
                            annee={annee}
                            libelle={c.cle === "an" ? `Budget ${annee}` : "Budget du mois"}
                          />
                          {c.cle === "an" && t.budgetYearSaisi === 0 && t.budgetYear > 0 && (
                            <p className="text-[10.5px] text-faint mt-1 leading-snug">
                              {fmtCHF(t.budgetYear)} CHF déduits de tes budgets mensuels — saisis
                              un montant pour fixer une vraie enveloppe d&apos;année.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </ScrollList>
        </section>
      )}

      {/*
        ── BUDGET PAR PLATEFORME — conservé, plus affiché ─────────────────────
        Le bloc « Par canal » posait un budget mensuel séparé sur Meta et sur
        Google. Retiré de l'écran : dans la vraie vie on n'a pas deux enveloppes,
        on en a une, et ce qui compte est de savoir dans quels thèmes elle part.

        Rien n'est perdu pour autant :
          · les montants déjà saisis restent en base (channel_budgets, channel
            = 'meta' / 'google') et servent encore de valeur de départ à
            l'enveloppe globale tant qu'aucun budget unique n'a été posé
            (voir getCoutsData, calcul de totalBudget) ;
          · la dépense par plateforme reste visible dans la courbe journalière
            et dans la table mois par mois ;
          · le composant est réactivable en une ligne si le besoin revient.

        <h2 className="text-[14px] font-semibold text-ink mb-3">Par canal</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
          {data.channels.map((ch) => (
            <div key={ch.key} className="bg-white border border-line rounded-xl shadow-card p-5">
              <div className="flex items-center gap-3">
                <span className="text-[16px]" style={{ color: ch.color }}>{ch.icon}</span>
                <span className="text-[14px] font-semibold text-ink">{ch.name}</span>
                <span className="ml-auto font-mono text-[15px] text-ink">
                  {fmtCHF(ch.spent)} CHF
                  {ch.budget > 0 && <span className="text-faint text-[12px]"> / {fmtCHF(ch.budget)}</span>}
                </span>
              </div>
              <BudgetEditor channel={ch.key} current={ch.budget} />
            </div>
          ))}
        </div>
      */}
    </main>
  );
}
