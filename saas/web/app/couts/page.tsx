// Coûts — UN horizon qui se pilote, LE MOIS. Le reste s'y rattache.
//
// La page a porté trois horizons de même poids (jour, mois, année) et
// demandait le même montant par quatre portes différentes : enveloppe du mois,
// enveloppe de l'année, douze mois × deux plateformes, plus deux champs par
// thème. Trente-huit champs de saisie sur un compte à six thèmes, et une règle
// de préséance muette — un client qui avait réglé 2 000 Meta et 1 000 Google
// lisait une enveloppe de 3 000 CHF qu'il n'avait jamais tapée.
//
// Ce qui reste à l'écran : le mois et son repère d'avancement, la dépense par
// jour pour sa FORME, et la répartition par thème. L'année passe en une ligne
// sous le mois — un budget annuel ne se pilote pas le lundi matin, il se fixe
// une fois et se consulte. Tous les éditeurs descendent dans « Réglages du
// budget », replié : rien n'est perdu, rien n'est détruit, la page visible
// perd trente champs.
//
// L'alerte quotidienne survit sans son module : elle n'apparaît que quand elle
// se déclenche, et son seuil est passé à 2× (voir lib/couts.ts).
//
// Un seul budget, pas un par plateforme : personne ne raisonne « 2 000 sur
// Meta et 10 000 sur Google ». On a une enveloppe publicitaire, et la vraie
// question est de savoir dans quels THÈMES elle part. Le détail par plateforme
// reste calculé et lisible dans le graphe, il n'est simplement plus un endroit
// où l'on fixe un budget (voir le bloc mis en commentaire plus bas).

import { getCoutsData, type CoutDay, type ThemeSpend, type AlerteJour } from "@/lib/couts";
import { fmtCHF } from "@/lib/report";
import { BudgetEditor } from "@/components/budget-editor";
import { BudgetYearTable } from "@/components/budget-year-table";
import { ScrollList } from "@/components/scroll-list";
import { LineChart } from "@/components/line-chart";
import { Chiffre, type Ton } from "@/components/chiffre";
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

// `Tuile` était un doublon de la tuile de AdsKpis, en 20 px au lieu de 18 et
// sans delta ni forme. Elle n'est plus qu'un nom local sur la brique partagée
// — les sept tuiles de cette page gagnent le delta coloré et la sparkline.
function Tuile({
  titre,
  valeur,
  sous,
  ton = "ink",
  serie,
}: {
  titre: string;
  valeur: string;
  sous: string;
  ton?: Ton;
  serie?: number[];
}) {
  return <Chiffre titre={titre} valeur={valeur} sous={sous} ton={ton} serie={serie} />;
}

// L'alerte quotidienne — une LIGNE, plus un module.
//
// Le module « Rythme quotidien » affichait deux chiffres à 22 px qui étaient le
// même nombre que la barre du dessus : `moyenneJour / budgetJour` vaut
// exactement `ratioMois / elapsed`, c'est-à-dire « 62 % consommé · repère
// 45 % », déjà imprimé dans la tuile « Reste » et déjà dessiné par la barre.
// Une identité algébrique, pas une comparaison.
//
// Ce qui restait vrai, c'est le pic isolé — et il n'a pas besoin d'un horizon
// permanent, il a besoin d'apparaître quand il existe.
function AlerteDepassement({ alertes, budgetJour }: { alertes: AlerteJour[]; budgetJour: number }) {
  if (budgetJour <= 0 || alertes.length === 0) return null;
  const pire = alertes[0];
  return (
    <div className="rounded-xl border border-warn/25 bg-warn/[0.05] px-4 py-3 mb-4">
      <div className="text-[10px] uppercase tracking-widest text-warn font-bold mb-1.5">
        {alertes.length} journée{alertes.length > 1 ? "s" : ""} à plus du double du budget du jour
      </div>
      <p className="text-[12.5px] text-ink leading-relaxed">
        La pire : <span className="font-semibold">{pire.label}</span> à{" "}
        <span className="font-mono">{fmtCHF(pire.montant)} CHF</span>, soit{" "}
        {pire.ratio.toFixed(1)}× la référence de {fmtCHF(budgetJour)} CHF par jour.
      </p>
      {alertes.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {alertes.slice(1, 10).map((a) => (
            <span
              key={a.date}
              title={`${fmtCHF(a.montant)} CHF`}
              className="font-mono text-[10.5px] text-warn bg-white border border-warn/25 rounded-full px-2 py-0.5"
            >
              {a.label} ×{a.ratio.toFixed(1)}
            </span>
          ))}
        </div>
      )}
      <p className="text-[10.5px] text-faint mt-2 leading-relaxed">
        Les plateformes s\u2019autorisent des dépassements quotidiens tant que le total du
        mois tient — on ne signale donc que le double, pas le simple écart.
      </p>
    </div>
  );
}

// Deux courbes plutôt qu'un empilement : on compare les canaux entre eux, au
// lieu de lire une somme dont il faut soustraire mentalement le bas.
function CourbeJournaliere({ daily, budgetJour }: { daily: CoutDay[]; budgetJour: number }) {
  if (daily.length === 0) return null;

  // Le cumul du mois AVANT la courbe. Il existait déjà, mais deux blocs plus
  // haut, dans une tuile : ce module ouvrait donc sur une forme sans sa
  // valeur. Et le pire jour, nommé — c'est lui qu'on cherche des yeux.
  const total = daily.reduce((a, p) => a + p.meta + p.google, 0);
  const pire = daily.reduce(
    (m, p) => (p.meta + p.google > m.montant ? { label: p.label, montant: p.meta + p.google } : m),
    { label: "", montant: 0 }
  );

  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-5 mb-4">
      <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-2">
        Dépense par jour · mois en cours
      </div>

      <div className="flex items-baseline gap-2.5 flex-wrap mb-3">
        <span className="font-mono text-[30px] sm:text-[34px] leading-none font-medium text-ink">
          {fmtCHF(total)}
          <span className="text-[15px] text-faint"> CHF</span>
        </span>
        <span className="text-[11px] text-faint">
          cumulés sur {daily.length} jour{daily.length > 1 ? "s" : ""}
        </span>
        {pire.montant > 0 && (
          <span className="text-[11px] font-bold text-warn bg-warn/[0.08] px-2 py-0.5 rounded-full">
            pic le {pire.label} · {fmtCHF(pire.montant)} CHF
          </span>
        )}
      </div>

      <div className="flex items-baseline justify-end mb-2 flex-wrap gap-2">
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
  univers,
}: {
  byTheme: ThemeSpend[];
  total: number;
  periode: "mois" | "an";
  univers: string[];
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
        {avecBudget.map((t) => (
          <div
            key={t.label}
            style={{
              width: `${(budgetDe(t) / base) * 100}%`,
              background: teinteLabel(t.label, univers).trait,
              opacity: 0.85,
            }}
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
          {avecBudget.slice(0, 6).map((t) => (
            <span key={t.label} className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full inline-block border-2"
                style={{
                  background: teinteLabel(t.label, univers).aplat,
                  borderColor: teinteLabel(t.label, univers).trait,
                }}
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

// L'ANNÉE, EN UNE LIGNE. Elle occupait trois tuiles, un éditeur et une
// répartition — soit autant de place que le mois, pour un objet qu'on ne pilote
// pas le lundi matin : un budget annuel se fixe une fois et se consulte.
// Elle se lit maintenant sous le mois, en une phrase, et se règle dans les
// réglages repliés en bas de page.
function LigneAnnee({
  spentYear,
  budgetAnnuel,
  annee,
}: {
  spentYear: number;
  budgetAnnuel: number;
  annee: number;
}) {
  // En jours, pas en mois entiers : le 2 août, compter août comme écoulé
  // annoncerait 67 % d'année passée au lieu de 58, et ferait croire qu'on est
  // très en dessous du budget alors qu'on est dans les clous.
  const now = new Date();
  const debut = new Date(now.getFullYear(), 0, 1);
  const fin = new Date(now.getFullYear() + 1, 0, 1);
  const part = (now.getTime() - debut.getTime()) / (fin.getTime() - debut.getTime());

  if (budgetAnnuel <= 0) {
    return (
      <p className="text-[11.5px] text-faint mt-2.5 leading-relaxed">
        Sur {annee} : <span className="font-mono text-muted">{fmtCHF(spentYear)} CHF</span>{" "}
        dépensés depuis janvier. Fixe une enveloppe d&apos;année dans les réglages pour te
        situer.
      </p>
    );
  }
  const ratio = spentYear / budgetAnnuel;
  const enAvance = ratio > part + 0.05;
  return (
    <p className="text-[11.5px] text-faint mt-2.5 leading-relaxed">
      Sur {annee} :{" "}
      <span className="font-mono text-ink">{fmtCHF(spentYear)}</span>
      <span className="font-mono"> / {fmtCHF(budgetAnnuel)} CHF</span> —{" "}
      <span className={enAvance ? "text-warn font-semibold" : "text-muted font-semibold"}>
        {Math.round(ratio * 100)} % de ton enveloppe pour {Math.round(part * 100)} % de
        l&apos;année écoulée
      </span>
      .
    </p>
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
          Une seule enveloppe publicitaire. Ce qui se pilote, c&apos;est le mois — et
          la vraie question est de savoir dans quels thèmes il part.
        </p>
      </div>

      {/* ══ 1 · CE MOIS-CI ══════════════════════════════════════════════════ */}
      <section className="mb-9">
        <Titre sur="Corriger le rythme">Ce mois-ci</Titre>

        <AlerteDepassement alertes={data.alertes} budgetJour={data.budgetJour} />

        <div className="flex overflow-x-auto sm:grid sm:grid-cols-3 gap-3 mb-4 pb-1 sm:pb-0">
          <Tuile
            titre="Dépensé"
            valeur={`${fmtCHF(data.totalSpent)} CHF`}
            sous={`tous canaux · ${Math.round(data.elapsed * 100)} % du mois écoulé`}
            serie={data.daily.map((j) => j.meta + j.google)}
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
          <LigneAnnee spentYear={data.spentYear} budgetAnnuel={data.budgetAnnuel} annee={annee} />
        </div>

        <CourbeJournaliere daily={data.daily} budgetJour={data.budgetJour} />

        {data.byTheme.length > 0 && (
          <Repartition byTheme={data.byTheme} total={data.totalBudget} periode="mois" univers={data.labels} />
        )}
      </section>

      {/* ══ 3 · PAR THÈME ═══════════════════════════════════════════════════ */}
      {data.byTheme.length > 0 && (
        <section className="mb-9">
          <Titre sur="La vraie question">Dans quels thèmes ça part</Titre>
          <p className="text-[12.5px] text-muted leading-relaxed mb-3.5 -mt-1 max-w-[68ch]">
            C&apos;est ici que se prend la seule décision de la page : quel thème mérite
            l&apos;enveloppe du mois, et lequel en consomme sans le rendre.
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
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0 border-2"
                        style={{
                          background: teinteLabel(t.label, data.labels).aplat,
                          borderColor: teinteLabel(t.label, data.labels).trait,
                        }}
                      />
                      <span className="text-[13.5px] font-semibold text-ink truncate">{t.label}</span>
                    </span>
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
                          {/* Un seul éditeur par thème, celui du mois. Le budget
                              d'année thème par thème demandait douze nombres
                              pour en obtenir un qui vaut le mensuel × 12 dans
                              presque tous les cas — il vit dans les réglages. */}
                          {c.cle === "mois" && (
                            <BudgetEditor
                              channel={`label:${t.label}`}
                              current={t.budget}
                              periode="mois"
                              libelle="Budget du mois"
                            />
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

      {/* ══ RÉGLAGES ════════════════════════════════════════════════════════
          Tout ce qui se saisit une fois et ne se relit pas. La page perd ainsi
          une trentaine de champs sans qu'aucune saisie existante ne disparaisse
          de la base ni ne devienne inaccessible. */}
      <details className="mb-6">
        <summary className="text-[13px] font-semibold text-ink cursor-pointer select-none">
          ⚙ Réglages du budget — enveloppe de l&apos;année, détail mois par mois
        </summary>

        <div className="mt-4 bg-white border border-line rounded-xl shadow-card p-5 mb-4">
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

        {data.byTheme.some((t) => t.budgetYearSaisi > 0) && (
          <div className="bg-white border border-line rounded-xl shadow-card p-5 mb-4">
            <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-3">
              Enveloppes d&apos;année déjà fixées par thème
            </div>
            <div className="grid sm:grid-cols-2 gap-x-5 gap-y-3">
              {data.byTheme
                .filter((t) => t.budgetYearSaisi > 0)
                .map((t) => (
                  <div key={t.label} className="border-l-2 border-line pl-3">
                    <div className="text-[12px] font-semibold text-ink">{t.label}</div>
                    <BudgetEditor
                      channel={`label:${t.label}`}
                      current={t.budgetYearSaisi}
                      periode="an"
                      annee={annee}
                      libelle={`Budget ${annee}`}
                    />
                  </div>
                ))}
            </div>
            <p className="text-[11px] text-faint mt-3 leading-relaxed">
              Ces montants restent actifs et modifiables ici. Ils ne s&apos;affichent plus
              dans la liste des thèmes : le pilotage se fait au mois.
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
