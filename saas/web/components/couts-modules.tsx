import { fmtCHF } from "@/lib/report";
import type { AlerteJour, ChannelCout, PointSerie, ThemeSpend } from "@/lib/couts";
import type { BudgetPlanifie } from "@/lib/budgets";
import { BudgetEditor } from "@/components/budget-editor";
import { LineChart } from "@/components/line-chart";
import { CANAL } from "@/components/etat-action";
import { teinteLabel } from "@/lib/palette";

// LES MODULES DE LA PAGE COÛTS.
//
// Ils vivaient dans `app/couts/page.tsx`, ce qui les rendait invisibles à tout
// ce qui n'est pas une session connectée — donc invérifiables autrement qu'en
// production. Ici, la page les COMPOSE et n'en dessine aucun ; chacun peut être
// rendu seul, avec les cas limites qu'on veut lui donner.
//
// Tous respectent la grammaire (docs/03-grammaire-des-modules.md) : identité,
// chiffre, verdict, delta, UNE forme, détail, pilotage, pied.

// L'alerte quotidienne — une LIGNE, plus un module.
//
// Le module « Rythme quotidien » affichait deux chiffres à 22 px qui étaient le
// même nombre que la barre du dessus : une identité algébrique, pas une
// comparaison. Ce qui restait vrai, c'est le pic isolé — et il n'a pas besoin
// d'un horizon permanent, il a besoin d'apparaître quand il existe.
export function AlerteDepassement({
  alertes,
  budgetJour,
}: {
  alertes: AlerteJour[];
  budgetJour: number;
}) {
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
        Les plateformes s&apos;autorisent des dépassements quotidiens tant que le total du
        mois tient — on ne signale donc que le double, pas le simple écart.
      </p>
    </div>
  );
}

export function BarreBudget({
  ratio,
  repere,
  epaisse = false,
}: {
  ratio: number;
  repere?: number;
  epaisse?: boolean;
}) {
  const couleur =
    ratio > 1 ? "#c0392b" : repere !== undefined && ratio > repere + 0.1 ? "#b86b00" : "#1a56ff";
  return (
    <div
      className={`relative ${epaisse ? "h-2.5" : "h-1.5"} rounded-full bg-black/[0.06] overflow-hidden mt-1.5`}
    >
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

// ── L'ENVELOPPE DE L'ANNÉE ────────────────────────────────────────────────
//
// Le module central de la page : ce qui a été dépensé sur ce qui a été promis,
// avec le trait du calendrier pour dire si le rythme tient. Il porte aussi les
// deux enveloppes par plateforme, parce que beaucoup de comptes les ont déjà
// posées et qu'on ne peut pas afficher un total dont on cache la provenance —
// c'était le défaut fondateur de cette page : un client qui avait réglé 2 000
// Meta et 1 000 Google lisait une enveloppe de 3 000 CHF qu'il n'avait jamais
// tapée, sans que rien ne le dise. La règle de préséance est donc ÉCRITE, en
// pied, et elle change avec la situation.
const SOURCE_AN: Record<string, string> = {
  saisi: "Ce montant est celui que tu as fixé ici. Les enveloppes par plateforme ci-dessus restent enregistrées mais ne comptent plus dans le total.",
  plateformes:
    "Ce montant est la somme de tes deux enveloppes par plateforme. Pose une enveloppe unique ci-dessous pour qu'elle prenne le pas sur elles.",
  mensuels:
    "Ce montant est la somme de tes douze budgets mensuels — aucune enveloppe d'année n'a encore été fixée. Une enveloppe d'année n'est pas douze fois un mois : un salon ou une saison ne se répartit pas en parts égales.",
  aucun: "",
};

// TROIS NATURES DE NOMBRE, ET IL FAUT LES TENIR SÉPARÉES.
//
//   · DÉPENSÉ   — constaté, il ne bougera plus ;
//   · FIXÉ      — l'enveloppe que tu as décidée, une promesse que tu te fais ;
//   · PLANIFIÉ  — ce qui est réellement POSÉ sur tes campagnes en ce moment,
//                 relevé chez Meta et Google.
//
// Les deux dernières se confondent facilement et ne disent pas la même chose :
// une enveloppe de 72 000 avec 18 000 posés sur les campagnes, c'est un compte
// qui ne dépensera pas son budget, et aucune barre de « dépensé / fixé » ne le
// montre — au contraire, elle rassure. D'où le troisième chiffre.
//
// Et le planifié n'est pas un historique : ni Meta ni Google ne rendent le
// budget tel qu'il était il y a trois mois. C'est une suite de photos. Quand
// aucune n'a encore été prise, on écrit que le relevé n'a pas eu lieu — jamais
// « 0 CHF planifié », qui se lirait « rien de prévu » et serait un chiffre non
// mesuré présenté comme mesuré.
function Planifie({ p, montant }: { p: BudgetPlanifie; montant: number }) {
  if (p.vide) {
    return (
      <span className="text-[12.5px] text-faint">
        pas encore relevé
      </span>
    );
  }
  return (
    <span className="font-mono text-[19px] leading-none font-medium text-ink">
      {fmtCHF(montant)}
      <span className="text-[11.5px] text-faint"> CHF</span>
    </span>
  );
}

export function EnveloppeAnnee({
  annee,
  spentYear,
  budgetAnnuel,
  budgetAnnuelSaisi,
  source,
  elapsedAn,
  channels,
  attribue,
  planifie,
}: {
  annee: number;
  spentYear: number;
  budgetAnnuel: number;
  budgetAnnuelSaisi: number;
  source: string;
  elapsedAn: number;
  channels: ChannelCout[];
  attribue: number;
  /** Ce qui est POSÉ sur les campagnes — l'autre promesse, celle des plateformes. */
  planifie: BudgetPlanifie;
}) {
  const ratio = budgetAnnuel > 0 ? spentYear / budgetAnnuel : null;
  const enAvance = ratio !== null && ratio > elapsedAn + 0.05;
  const depasse = ratio !== null && ratio > 1;
  const reste = budgetAnnuel - attribue;
  const resteEnveloppe = budgetAnnuel - spentYear;

  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-5 mb-4">
      <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-2">
        Dépense de l&apos;année · {annee}
      </div>

      {/* Rang 3 — le chiffre, avant toute forme.
          Le dénominateur est un bloc À PART, et pas une suite du même texte :
          « 62 158 / 72 000 CHF » en 30 px ne tient pas dans les 303 px utiles
          d'un iPhone, et le texte se coupait où il pouvait — l'unité finissait
          seule sur sa ligne. En deux morceaux, le retour à la ligne se fait
          entre le dépensé et sa référence, jamais au milieu d'un nombre.

          LE BUDGET FIXÉ REMONTE. Il était en 15 px gris, à peine plus lisible
          qu'une unité : la question de la page — « est-ce que je tiens mon
          budget ? » — a besoin de ses DEUX termes. Il passe en 20 px encre et
          porte son mot (« fixé »), parce qu'un nombre à côté d'un autre sans
          rien qui les distingue se lit comme une seule mesure. */}
      <div className="flex items-baseline gap-x-2.5 gap-y-1 flex-wrap">
        <span className="font-mono text-[30px] sm:text-[34px] leading-none font-medium text-ink">
          {fmtCHF(spentYear)}
        </span>
        {budgetAnnuel > 0 ? (
          <span className="font-mono text-[19px] sm:text-[20px] leading-none text-ink whitespace-nowrap">
            <span className="text-faint">/ </span>
            {fmtCHF(budgetAnnuel)}
            <span className="text-[12px] text-faint"> CHF fixés pour {annee}</span>
          </span>
        ) : (
          <span className="font-mono text-[15px] text-faint">CHF</span>
        )}
        {ratio !== null && (
          <span
            className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${
              depasse
                ? "text-neg bg-neg/[0.08]"
                : enAvance
                  ? "text-warn bg-warn/[0.08]"
                  : "text-pos bg-pos/[0.08]"
            }`}
          >
            {depasse
              ? "enveloppe dépassée"
              : enAvance
                ? "en avance sur le calendrier"
                : "dans les clous"}
          </span>
        )}
      </div>

      {ratio !== null ? (
        <>
          <BarreBudget ratio={ratio} repere={elapsedAn} epaisse />
          <p className="text-[11.5px] text-muted mt-1.5 leading-relaxed">
            <span className="font-semibold">{Math.round(ratio * 100)} %</span> de ton enveloppe
            pour <span className="font-semibold">{Math.round(elapsedAn * 100)} %</span> de
            l&apos;année écoulée. Le trait vertical marque le calendrier : le dépasser
            largement, c&apos;est dépenser plus vite que le temps ne passe.
          </p>
        </>
      ) : (
        <p className="text-[12px] text-muted mt-2 leading-relaxed">
          Fixe ton enveloppe de l&apos;année ci-dessous — tout le reste de la page en
          découle : le budget du mois, celui du jour, et les alertes de dérapage.
        </p>
      )}

      {/* Le bilan sous le chiffre de tête : trois nombres, 20 px contre 34, UN
          seul fond. La grammaire l'autorise à cette condition — c'est la
          concurrence entre deux chiffres de même taille qu'elle interdit, pas
          la densité. Aucun des trois ne se déduit des autres. */}
      {budgetAnnuel > 0 && (
        <div className="mt-4 rounded-xl bg-black/[0.025] px-4 py-3 flex gap-x-8 gap-y-3 flex-wrap">
          <div>
            <div className="font-mono text-[19px] leading-none font-medium text-ink">
              {resteEnveloppe >= 0 ? fmtCHF(resteEnveloppe) : `−${fmtCHF(-resteEnveloppe)}`}
              <span className="text-[11.5px] text-faint"> CHF</span>
            </div>
            <div className="text-[9.5px] uppercase tracking-wide text-faint font-semibold mt-1">
              {resteEnveloppe >= 0 ? "Reste de l'enveloppe" : "Au-delà de l'enveloppe"}
            </div>
          </div>
          <div>
            <Planifie p={planifie} montant={planifie.total} />
            <div className="text-[9.5px] uppercase tracking-wide text-faint font-semibold mt-1">
              Posé sur tes campagnes
            </div>
          </div>
          <div>
            <div className="font-mono text-[19px] leading-none font-medium text-ink">
              {fmtCHF(attribue)}
              <span className="text-[11.5px] text-faint"> CHF</span>
            </div>
            <div
              className={`text-[9.5px] uppercase tracking-wide font-semibold mt-1 ${
                reste < 0 ? "text-neg" : reste > 0 ? "text-warn" : "text-pos"
              }`}
            >
              Réparti par thème
              {reste < 0
                ? ` · ${fmtCHF(-reste)} de trop`
                : reste > 0
                  ? ` · ${fmtCHF(reste)} à placer`
                  : " · tout est placé"}
            </div>
          </div>
        </div>
      )}

      {/* Rang 7 — le détail. Chaque plateforme avec ce qu'elle a consommé, ce
          qui lui a été promis et ce qui est posé sur ses campagnes. Aucune
          barre ici : une seule forme par module, et c'est celle du dessus. */}
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 mt-4 pt-4 border-t border-line">
        {channels.map((ch) => (
          <div key={ch.key}>
            <div className="flex items-baseline gap-2">
              <span className="text-[13px]" style={{ color: ch.color }}>
                {ch.icon}
              </span>
              <span className="text-[12.5px] font-semibold text-ink">{ch.name}</span>
              <span className="ml-auto font-mono text-[12.5px] text-ink">
                {fmtCHF(ch.spentYear)}
                {ch.budgetAn > 0 && (
                  <span className="text-faint text-[11.5px]"> / {fmtCHF(ch.budgetAn)}</span>
                )}
              </span>
            </div>
            {!planifie.vide && (
              <div className="text-[11px] text-faint mt-0.5">
                posé sur les campagnes :{" "}
                <span className="font-mono text-muted">
                  {fmtCHF(planifie.parCanal[ch.key as "meta" | "google"] ?? 0)} CHF
                </span>
              </div>
            )}
            <BudgetEditor
              channel={ch.key}
              current={ch.budgetAnSaisi}
              periode="an"
              annee={annee}
              libelle={`Enveloppe ${annee}`}
            />
          </div>
        ))}
      </div>

      {/* Rang 8 — le pilotage, en bas. L'enveloppe unique passe DEVANT les deux
          plateformes, et le pied juste en dessous le dit. */}
      <div className="mt-4 pt-4 border-t border-line">
        <BudgetEditor
          channel="global"
          current={budgetAnnuelSaisi}
          periode="an"
          annee={annee}
          libelle={`Enveloppe unique ${annee}`}
        />
        <p className="text-[11px] text-faint mt-2 leading-relaxed">
          {/* Rang 9 — le pied, un seul. D'où sortent les nombres affichés. */}
          {SOURCE_AN[source]}
          {SOURCE_AN[source] && " "}
          {planifie.vide
            ? "Le budget posé sur tes campagnes n'a pas encore été relevé : Meta et Google ne rendent que sa valeur du jour, jamais son historique, et aucune photo n'a encore été prise. C'est pour ça qu'on n'écrit pas 0 CHF."
            : `Le budget posé sur tes campagnes vient du relevé du ${planifie.releveLe ?? "—"} : c'est une photo, pas un historique.`}
        </p>
      </div>
    </div>
  );
}

// ── LA COURBE, au pas de la période ───────────────────────────────────────
// Deux courbes plutôt qu'un empilement : on compare les canaux entre eux, au
// lieu de lire une somme dont il faut soustraire mentalement le bas.
export function CourbeDepense({
  serie,
  pas,
  titre,
  repere,
  filtreActif,
  dernierePartielle = false,
}: {
  serie: PointSerie[];
  pas: "jour" | "semaine";
  titre: string;
  repere: number;
  filtreActif: boolean;
  /** La dernière semaine est en cours : sans ça, elle se lit comme une chute. */
  dernierePartielle?: boolean;
}) {
  if (serie.length < 2) return null;

  const total = serie.reduce((a, p) => a + p.meta + p.google, 0);
  const pire = serie.reduce(
    (m, p) => (p.meta + p.google > m.montant ? { label: p.label, montant: p.meta + p.google } : m),
    { label: "", montant: 0 }
  );
  const unite = pas === "semaine" ? "semaine" : "jour";

  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-5 mb-4">
      <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-2">
        Dépense par {unite} · {titre}
      </div>

      <div className="flex items-baseline gap-2.5 flex-wrap mb-3">
        <span className="font-mono text-[30px] sm:text-[34px] leading-none font-medium text-ink">
          {fmtCHF(total)}
          <span className="text-[15px] text-faint"> CHF</span>
        </span>
        <span className="text-[11px] text-faint">
          cumulés sur {serie.length} {unite}
          {serie.length > 1 ? "s" : ""}
        </span>
        {pire.montant > 0 && (
          <span className="text-[11px] font-bold text-warn bg-warn/[0.08] px-2 py-0.5 rounded-full">
            pic {pas === "semaine" ? "la semaine du" : "le"} {pire.label} ·{" "}
            {fmtCHF(pire.montant)} CHF
          </span>
        )}
      </div>

      <div className="flex items-baseline justify-end mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-3 text-[10.5px] text-faint">
          <span>
            <span style={{ color: "#1a56ff" }}>■</span> Meta
          </span>
          <span>
            <span style={{ color: "#1a7a4a" }}>■</span> Google
          </span>
          {repere > 0 && (
            <span>
              <span style={{ color: "#b86b00" }}>┄</span> budget du {unite}
            </span>
          )}
        </div>
      </div>
      <LineChart
        labels={serie.map((p) => p.label)}
        series={[
          { name: "Meta", color: "#1a56ff", values: serie.map((p) => p.meta) },
          { name: "Google", color: "#1a7a4a", values: serie.map((p) => p.google) },
        ]}
        fmt={(v) => fmtCHF(v)}
        unit=" CHF"
        ariaLabel={`Dépense par ${unite} et par canal`}
        repere={repere > 0 ? { value: repere, label: `${fmtCHF(repere)} CHF / ${unite}` } : undefined}
      />
      <p className="text-[10.5px] text-faint mt-2 leading-relaxed">
        {repere > 0 ? (
          <>
            Le trait orange est ton budget, tous canaux confondus. Les courbes sont par
            canal : elles peuvent passer dessous chacune tout en dépassant une fois
            additionnées.
          </>
        ) : filtreActif ? (
          // Le seuil disparaît dès qu'on filtre, et il faut le dire : comparer la
          // dépense de deux thèmes au budget de TOUT le compte ferait passer pour
          // vertueux n'importe quel sous-ensemble.
          <>
            Pas de trait de budget ici : ton budget porte sur l&apos;ensemble du compte, le
            comparer à une sélection de thèmes n&apos;aurait aucun sens.
          </>
        ) : (
          <>Fixe une enveloppe d&apos;année pour voir apparaître ton budget sur la courbe.</>
        )}
        {dernierePartielle && (
          <> La dernière semaine est en cours : elle est forcément plus basse que les autres.</>
        )}
      </p>
    </div>
  );
}

// ── UNE LIGNE DE LA LISTE PAR THÈME, à l'année ────────────────────────────
//
// C'est ici que se prend la seule décision de la page. Un seul éditeur par
// thème, celui de l'année : le mensuel par thème demandait douze nombres pour
// en obtenir un qui vaut le mensuel × 12 dans presque tous les cas.
//
// TROIS AJOUTS, ET LE MÊME MOTIF DERRIÈRE LES TROIS — on posait un budget sans
// rien savoir de ce qu'on était en train de faire :
//
//  · l'ENVELOPPE TOTALE et CE QUI RESTE À RÉPARTIR, sous le champ. Taper 8 000
//    sur un thème quand il reste 2 000 à placer sur 72 000 est une décision
//    qu'on ne prend pas si on le sait — et la seule ligne qui le disait était
//    600 px plus haut, dans un autre module ;
//  · SUR QUELLE PLATEFORME l'argent de ce thème est parti. Un thème à 100 % sur
//    Google et un thème partagé ne se pilotent pas de la même façon, et rien ne
//    permettait de le voir sans changer de page ;
//  · CE QUI EST POSÉ sur ses campagnes en ce moment, quand le relevé existe.
//
// Ce qu'on n'affiche PAS, et il faut le dire : le posé n'est pas ventilé par
// plateforme AU SEIN d'un thème. `BudgetPlanifie` donne `parCanal` (tout le
// compte) et `parTheme` (tous canaux confondus), pas le croisement des deux.
// Le croiser au prorata de la dépense fabriquerait un nombre que personne n'a
// mesuré — c'est exactement ce que la page s'interdit.
export function LigneTheme({
  t,
  part,
  elapsedAn,
  annee,
  univers,
  budgetTotal,
  resteARepartir,
  planifie,
}: {
  t: ThemeSpend;
  part: number;
  elapsedAn: number;
  annee: number;
  univers: string[];
  /** L'enveloppe de l'année, tous thèmes confondus — le cadre de la décision. */
  budgetTotal: number;
  /** Ce qui n'est encore posé sur aucun thème. Peut être négatif. */
  resteARepartir: number;
  planifie: BudgetPlanifie;
}) {
  const r = t.budgetYear > 0 ? t.spendYear / t.budgetYear : null;
  const teinte = teinteLabel(t.label, univers);
  const pose = planifie.parTheme[t.label] ?? 0;
  const canaux = ([
    ["meta", t.parCanalAn.meta],
    ["google", t.parCanalAn.google],
  ] as const).filter(([, v]) => v > 0);

  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-3 flex-wrap mb-1.5">
        <span className="inline-flex items-center gap-2 min-w-0">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0 border-2"
            style={{ background: teinte.aplat, borderColor: teinte.trait }}
          />
          <span className="text-[13.5px] font-semibold text-ink truncate">{t.label}</span>
        </span>
        <span className="text-[11px] text-faint">
          {part.toFixed(0)} % de la dépense de l&apos;année
        </span>
      </div>

      <div className="font-mono text-[15px] text-ink">
        {fmtCHF(t.spendYear)} CHF
        {t.budgetYear > 0 && (
          <span className="text-faint text-[12.5px]"> / {fmtCHF(t.budgetYear)}</span>
        )}
      </div>

      {r !== null ? (
        <>
          <BarreBudget ratio={r} repere={elapsedAn} />
          <div
            className={`text-[11px] mt-1 font-semibold ${
              r > 1 ? "text-neg" : r > elapsedAn + 0.1 ? "text-warn" : "text-muted"
            }`}
          >
            {r > 1
              ? `dépassé de ${fmtCHF(t.spendYear - t.budgetYear)} CHF`
              : `${Math.round(r * 100)} % de l'enveloppe · ${Math.round(elapsedAn * 100)} % de l'année`}
          </div>
        </>
      ) : (
        <div className="text-[11px] text-faint mt-1.5">
          pas d&apos;enveloppe fixée pour ce thème
        </div>
      )}

      {/* Rang 7 — le détail : où c'est parti, et ce qui est posé. */}
      <div className="mt-2.5 pt-2.5 border-t border-line space-y-1">
        {canaux.length > 0 ? (
          canaux.map(([cle, montant]) => {
            const ca = CANAL[cle];
            return (
              <div key={cle} className="flex items-baseline gap-1.5 text-[11.5px]">
                <span style={{ color: ca.couleur }}>{ca.glyphe}</span>
                <span className="text-muted">{ca.nom}</span>
                <span className="ml-auto font-mono text-ink">
                  {fmtCHF(montant)}
                  <span className="text-faint">
                    {" "}
                    · {Math.round((montant / Math.max(1, t.spendYear)) * 100)} %
                  </span>
                </span>
              </div>
            );
          })
        ) : (
          <div className="text-[11.5px] text-faint">
            rien de dépensé sur ce thème {annee}
          </div>
        )}
        <div className="flex items-baseline gap-1.5 text-[11.5px] pt-0.5">
          <span className="text-faint">Posé sur ses campagnes</span>
          <span className="ml-auto font-mono">
            {planifie.vide ? (
              <span className="text-faint font-sans">pas encore relevé</span>
            ) : (
              <span className="text-ink">{fmtCHF(pose)} CHF</span>
            )}
          </span>
        </div>
      </div>

      {/* Rang 8 — le pilotage, en bas, avec le cadre de la décision juste
          au-dessus du champ : combien il y a en tout, et combien il en reste. */}
      <BudgetEditor
        channel={`label:${t.label}`}
        current={t.budgetYearSaisi}
        periode="an"
        annee={annee}
        libelle={`Enveloppe ${annee}`}
      />
      {budgetTotal > 0 ? (
        <p className="text-[10.5px] mt-1 leading-relaxed">
          <span className="text-faint">
            Sur {fmtCHF(budgetTotal)} CHF fixés pour {annee} —{" "}
          </span>
          <span
            className={
              resteARepartir < 0
                ? "text-neg font-semibold"
                : resteARepartir > 0
                  ? "text-warn font-semibold"
                  : "text-pos font-semibold"
            }
          >
            {resteARepartir < 0
              ? `${fmtCHF(-resteARepartir)} CHF de trop répartis`
              : resteARepartir > 0
                ? `${fmtCHF(resteARepartir)} CHF encore à répartir`
                : "tout est réparti"}
          </span>
          .
        </p>
      ) : (
        <p className="text-[10.5px] text-faint mt-1 leading-relaxed">
          Aucune enveloppe d&apos;année fixée pour l&apos;instant : rien ne borne encore
          ce que tu poses ici.
        </p>
      )}
      {t.budgetYearSaisi === 0 && t.budgetYear > 0 && (
        <p className="text-[10.5px] text-faint mt-1 leading-relaxed">
          Enveloppe déduite de tes budgets mensuels sur ce thème.
        </p>
      )}
    </div>
  );
}
