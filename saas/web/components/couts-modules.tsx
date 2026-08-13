import { fmtCHF } from "@/lib/report";
import type { AlerteJour, ChannelCout, PointSerie, ThemeSpend } from "@/lib/couts";
import type { BudgetPlanifie } from "@/lib/budgets";
import { BudgetEditor } from "@/components/budget-editor";
import { LineChart } from "@/components/line-chart";
import { CANAL, dateCourte } from "@/components/etat-action";
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

// ── L'ANNÉE, EN DEUX MODULES QUI NE POSENT PAS LA MÊME QUESTION ────────────
//
// Il n'y en avait qu'un, pleine largeur, et il mélangeait deux gestes : DÉCIDER
// une enveloppe (une fois par an, en cinq secondes) et SURVEILLER la dépense
// (chaque semaine, en un coup d'œil). Le champ de saisie se retrouvait donc
// enterré sous une barre, trois chiffres de bilan et deux plateformes.
//
//   · `EnveloppeAnnee` — à GAUCHE, sur 1/3 : ce que tu t'autorises, ce que tu
//     en as promis aux thèmes, et le champ pour le changer. AUCUNE FORME ;
//   · `DepenseAnnee`   — à DROITE, sur 2/3 : ce qui est parti, la barre et le
//     trait du calendrier. C'est lui qui garde la forme.
//
// Sur téléphone ils s'empilent, l'enveloppe d'abord : on ne surveille pas un
// budget avant de l'avoir fixé.

// TROIS NATURES DE NOMBRE, ET IL FAUT LES TENIR SÉPARÉES.
//
//   · DÉPENSÉ   — constaté, il ne bougera plus ;
//   · FIXÉ      — l'enveloppe que tu as décidée, une promesse que tu te fais ;
//   · PLANIFIÉ  — ce qui est réellement RÉGLÉ sur tes campagnes en ce moment,
//                 relevé chez Meta et Google.
//
// Les deux dernières se confondent facilement et ne disent pas la même chose :
// une enveloppe de 72 000 avec 18 000 réglés sur les campagnes, c'est un compte
// qui ne dépensera pas son budget, et aucune barre de « dépensé / fixé » ne le
// montre — au contraire, elle rassure. D'où le troisième chiffre.
//
// Et le planifié n'est pas un historique : ni Meta ni Google ne rendent le
// budget tel qu'il était il y a trois mois. C'est une suite de photos
// HEBDOMADAIRES. Quand aucune n'a encore été prise, l'état vide doit dire que
// le chiffre ARRIVE et QUAND — « pas encore relevé » tout court laissait croire
// à une case en panne. Jamais « 0 CHF », qui se lirait « rien de prévu » et
// serait un chiffre non mesuré présenté comme mesuré.
function Planifie({ p, montant }: { p: BudgetPlanifie; montant: number }) {
  if (p.vide) {
    return (
      <span className="text-[12.5px] text-faint leading-tight block">
        au prochain relevé
        <span className="block text-[10.5px]">Meta et Google sont lus une fois par semaine</span>
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

// La phrase de la répartition. Elle vivait sous CHAQUE carte de thème — treize
// cartes répétaient treize fois le même nombre — et se contentait d'annoncer
// « 74 950 CHF encore à répartir » sans jamais dire répartir QUOI ni POURQUOI.
// Elle remonte ici, une seule fois, et dit maintenant le GESTE et son effet :
// promettre une part de l'enveloppe à un thème, c'est ce qui permet à la page
// de juger ce thème ensuite. Un nombre qui demande une action doit dire
// laquelle.
function phraseRepartition(attribue: number, reste: number): string {
  if (attribue <= 0) {
    return "Aucune part de cette enveloppe n'est encore promise à un thème. Promettre un montant à un thème, c'est ce qui permet à la page de dire ensuite lequel tient son budget et lequel dérape — ça se règle thème par thème, dans la liste plus bas.";
  }
  if (reste > 0) {
    return `Tu as promis ${fmtCHF(attribue)} CHF de ton enveloppe à des thèmes précis ; ${fmtCHF(reste)} CHF ne sont promis à personne. Tant qu'un thème n'a pas sa part, la page ne peut pas dire s'il tient son budget — elle ne montre que sa dépense. Le reste se place dans la liste plus bas.`;
  }
  if (reste === 0) {
    return "Toute ton enveloppe est promise à des thèmes : chacun peut donc être jugé sur la sienne, dans la liste plus bas.";
  }
  return `Tu as promis ${fmtCHF(attribue)} CHF à tes thèmes pour une enveloppe de ${fmtCHF(attribue + reste)} CHF, soit ${fmtCHF(-reste)} CHF de plus que ce que tu t'autorises. Remonte l'enveloppe, ou baisse un thème dans la liste plus bas.`;
}

/**
 * L'ENVELOPPE — la seule décision de haut de page, et le seul champ.
 *
 * Rangs : 1 identité · 3 le chiffre · 7 la répartition et sa phrase · 8 le
 * champ · 9 le pied. Pas de rang 6 : la forme appartient à `DepenseAnnee`.
 */
export function EnveloppeAnnee({
  annee,
  budgetAnnuel,
  budgetAnnuelHerite,
  attribue,
}: {
  annee: number;
  budgetAnnuel: number;
  /** Ce que l'ancienne préséance aurait calculé — pour l'écrire, pas pour le servir. */
  budgetAnnuelHerite: number;
  attribue: number;
}) {
  const reste = budgetAnnuel - attribue;

  return (
    /* `min-w-0` : élément de grille dont le contenu est un nombre en mono qui
       ne se coupe pas. Sans lui, `min-width: auto` l'empêche de rétrécir et
       c'est la PAGE ENTIÈRE qui défile horizontalement. */
    <div className="bg-white border border-line rounded-xl shadow-card p-5 min-w-0 flex flex-col">
      <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-2">
        Enveloppe fixée · {annee}
      </div>

      {/* Rang 3 — le chiffre. Ce module n'en a qu'un, et c'est celui que la page
          entière consomme : le mois, le jour, les alertes et les barres en
          descendent tous. */}
      {budgetAnnuel > 0 ? (
        <div className="font-mono text-[30px] sm:text-[34px] leading-none font-medium text-ink">
          {fmtCHF(budgetAnnuel)}
          <span className="text-[15px] text-faint"> CHF</span>
        </div>
      ) : (
        <div className="font-mono text-[30px] sm:text-[34px] leading-none font-medium text-faint">
          —<span className="text-[15px]"> CHF</span>
        </div>
      )}
      <p className="text-[11.5px] text-muted mt-2 leading-relaxed">
        {budgetAnnuel > 0
          ? `Ce que tu t'autorises à dépenser en publicité sur ${annee}, tous canaux confondus.`
          : `Personne n'a encore fixé d'enveloppe pour ${annee}. Tant qu'elle vaut zéro, la page ne peut ni juger un rythme ni signaler un dérapage : elle ne sait que compter.`}
      </p>

      {/* Rang 7 — le détail : ce qui est déjà promis, et ce qui ne l'est pas.
          Deux nombres à 19 px contre 34, sur UN seul fond — la grammaire
          l'autorise à cette condition, ce qu'elle interdit c'est la concurrence
          entre deux chiffres de même taille, pas la densité. */}
      {budgetAnnuel > 0 ? (
        <div className="mt-4 rounded-xl bg-black/[0.025] px-4 py-3">
          <div className="flex gap-x-6 gap-y-3 flex-wrap">
            <div className="min-w-0">
              <div className="font-mono text-[19px] leading-none font-medium text-ink">
                {fmtCHF(attribue)}
                <span className="text-[11.5px] text-faint"> CHF</span>
              </div>
              <div className="text-[9.5px] uppercase tracking-wide text-faint font-semibold mt-1">
                Promis à des thèmes
              </div>
            </div>
            <div className="min-w-0">
              <div
                className={`font-mono text-[19px] leading-none font-medium ${
                  reste < 0 ? "text-neg" : "text-ink"
                }`}
              >
                {reste >= 0 ? fmtCHF(reste) : `−${fmtCHF(-reste)}`}
                <span className="text-[11.5px] text-faint"> CHF</span>
              </div>
              <div
                className={`text-[9.5px] uppercase tracking-wide font-semibold mt-1 ${
                  reste < 0 ? "text-neg" : reste > 0 ? "text-warn" : "text-pos"
                }`}
              >
                {reste < 0 ? "Promis en trop" : reste > 0 ? "Encore libres" : "Tout est promis"}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted mt-3 pt-3 border-t border-line leading-relaxed">
            {phraseRepartition(attribue, reste)}
          </p>
        </div>
      ) : (
        attribue > 0 && (
          <p className="text-[11px] text-warn mt-3 leading-relaxed">
            {fmtCHF(attribue)} CHF sont déjà promis à des thèmes, sans enveloppe globale pour
            les borner : rien ne dit encore si c&apos;est trop.
          </p>
        )
      )}

      {/* Rang 8 — le pilotage, en bas, collé au bas de la carte pour que les
          deux modules de la rangée finissent à la même ligne. */}
      <div className="mt-auto pt-4">
        <BudgetEditor
          channel="global"
          current={budgetAnnuel}
          periode="an"
          annee={annee}
          libelle={`Enveloppe ${annee}`}
        />
        {/* Rang 9 — le pied, un seul. Ce que ce nombre N'EST PAS. */}
        <p className="text-[11px] text-faint mt-2 leading-relaxed">
          {budgetAnnuelHerite > 0
            ? `Tes anciens réglages par plateforme et par mois (${fmtCHF(budgetAnnuelHerite)} CHF au total) restent enregistrés, mais ils ne fabriquent plus d'enveloppe d'année : seul le montant tapé ici compte.`
            : "Cette enveloppe vaut exactement ce que tu tapes ici. Elle n'est jamais estimée à partir d'autre chose, et vaut zéro tant que le champ est vide."}
        </p>
      </div>
    </div>
  );
}

/**
 * LA DÉPENSE DE L'ANNÉE — ce qui est parti, contre l'enveloppe et contre le
 * calendrier. C'est le module qui porte la FORME de la rangée.
 */
export function DepenseAnnee({
  annee,
  spentYear,
  budgetAnnuel,
  elapsedAn,
  channels,
  planifie,
}: {
  annee: number;
  spentYear: number;
  budgetAnnuel: number;
  elapsedAn: number;
  channels: ChannelCout[];
  /** Ce qui est RÉGLÉ sur les campagnes — l'autre promesse, celle des plateformes. */
  planifie: BudgetPlanifie;
}) {
  const ratio = budgetAnnuel > 0 ? spentYear / budgetAnnuel : null;
  const enAvance = ratio !== null && ratio > elapsedAn + 0.05;
  const depasse = ratio !== null && ratio > 1;
  const resteEnveloppe = budgetAnnuel - spentYear;

  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-5 min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-2">
        Dépense de l&apos;année · {annee}
      </div>

      {/* Rang 3 — le chiffre, avant toute forme. Le dénominateur n'est plus
          collé ici : l'enveloppe a son propre module à gauche, et la répéter en
          20 px aurait donné deux fois le même nombre sur la même rangée. Elle
          reste écrite là où la grammaire l'exige — SUR la barre, sous laquelle
          une cible non écrite ferait du décor. */}
      <div className="flex items-baseline gap-x-2.5 gap-y-1 flex-wrap">
        <span className="font-mono text-[30px] sm:text-[34px] leading-none font-medium text-ink">
          {fmtCHF(spentYear)}
          <span className="text-[15px] text-faint"> CHF</span>
        </span>
        <span className="text-[11px] text-faint">
          dépensés depuis janvier, au total
        </span>
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
        <div className="mt-3">
          <BarreBudget ratio={ratio} repere={elapsedAn} epaisse />
          {/* Rang 6 — la forme et SA CIBLE ÉCRITE. Les deux bornes encadrent la
              barre : ce qu'on en a consommé à gauche, ce qu'elle vaut en tout à
              droite. */}
          <div className="flex items-baseline justify-between gap-3 mt-1.5">
            <span className="text-[11.5px] text-muted">
              <span className="font-semibold">{Math.round(ratio * 100)} %</span> de ton enveloppe
              pour <span className="font-semibold">{Math.round(elapsedAn * 100)} %</span> de
              l&apos;année écoulée
            </span>
            <span className="font-mono text-[11.5px] text-faint whitespace-nowrap">
              sur {fmtCHF(budgetAnnuel)} CHF
            </span>
          </div>
          <p className="text-[11px] text-faint mt-1 leading-relaxed">
            Le trait vertical marque le calendrier : le dépasser largement, c&apos;est dépenser
            plus vite que le temps ne passe.
          </p>
        </div>
      ) : (
        <p className="text-[12px] text-muted mt-3 leading-relaxed">
          Aucune barre ici tant que l&apos;enveloppe de l&apos;année n&apos;est pas fixée : sans
          elle, ce montant ne se compare à rien. Elle se pose dans le module de gauche.
        </p>
      )}

      {/* Rang 7 — le bilan : deux nombres qui ne se déduisent ni l'un de
          l'autre ni du chiffre de tête. */}
      <div className="mt-4 rounded-xl bg-black/[0.025] px-4 py-3 flex gap-x-8 gap-y-3 flex-wrap">
        {budgetAnnuel > 0 && (
          <div className="min-w-0">
            <div
              className={`font-mono text-[19px] leading-none font-medium ${
                resteEnveloppe >= 0 ? "text-ink" : "text-neg"
              }`}
            >
              {resteEnveloppe >= 0 ? fmtCHF(resteEnveloppe) : `−${fmtCHF(-resteEnveloppe)}`}
              <span className="text-[11.5px] text-faint"> CHF</span>
            </div>
            <div className="text-[9.5px] uppercase tracking-wide text-faint font-semibold mt-1">
              {resteEnveloppe >= 0 ? "Reste à dépenser" : "Au-delà de l'enveloppe"}
            </div>
          </div>
        )}
        <div className="min-w-0">
          <Planifie p={planifie} montant={planifie.total} />
          <div className="text-[9.5px] uppercase tracking-wide text-faint font-semibold mt-1">
            Budget réglé dans Meta et Google
          </div>
        </div>
      </div>

      {/* Rang 7 (suite) — le détail. Chaque plateforme avec ce qu'elle a
          consommé et sa part, RIEN QUE DU DÉPENSÉ : les enveloppes par
          plateforme ont quitté cette page, il n'y a plus qu'une enveloppe.
          Aucune barre ici — une seule forme par module, et c'est celle du
          dessus. */}
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mt-4 pt-4 border-t border-line">
        {channels.map((ch) => (
          <div key={ch.key} className="flex items-baseline gap-2 min-w-0">
            <span className="text-[13px]" style={{ color: ch.color }}>
              {ch.icon}
            </span>
            <span className="text-[12.5px] font-semibold text-ink truncate">{ch.name}</span>
            <span className="ml-auto font-mono text-[12.5px] text-ink whitespace-nowrap">
              {fmtCHF(ch.spentYear)}
              <span className="text-faint text-[11.5px]">
                {" "}
                · {spentYear > 0 ? Math.round((ch.spentYear / spentYear) * 100) : 0} %
              </span>
            </span>
          </div>
        ))}
      </div>

      {/* Rang 9 — le pied, un seul. Ce que « réglé dans Meta et Google » veut
          dire, et pourquoi il peut être vide.

          La DATE passe par `dateCourte` : `releveLe` sort de la base au format
          ISO (`2026-08-10`), et une page qui écrit par ailleurs « 10 aoû »
          partout ne peut pas laisser une date de machine au milieu d'une
          phrase française. Le repli « — » reste : `releveLe` vaut `null` tant
          qu'aucun relevé n'existe, et `vide` n'est pas la seule porte qui y
          mène. */}
      <p className="text-[11px] text-faint mt-3 leading-relaxed">
        {planifie.vide
          ? "« Réglé dans Meta et Google » est le budget posé sur tes campagnes dans les régies — ce que tu as prévu d'y mettre, pas ce qui en est parti. Il est relevé une fois par semaine et le premier passage n'a pas encore eu lieu : le chiffre apparaîtra tout seul. On n'écrit pas 0 CHF entre-temps, ça se lirait « rien de prévu »."
          : `« Réglé dans Meta et Google » est le budget posé sur tes campagnes dans les régies, relevé le ${planifie.releveLe ? dateCourte(planifie.releveLe) : "—"} : une photo hebdomadaire, pas un historique. Les régies ne rendent jamais la valeur d'il y a trois mois.`}
      </p>
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
// DEUX AJOUTS, ET LE MÊME MOTIF DERRIÈRE LES DEUX — on posait un budget sans
// rien savoir de ce qu'on était en train de faire :
//
//  · SUR QUELLE PLATEFORME l'argent de ce thème est parti. Un thème à 100 % sur
//    Google et un thème partagé ne se pilotent pas de la même façon, et rien ne
//    permettait de le voir sans changer de page ;
//  · CE QUI EST RÉGLÉ sur ses campagnes en ce moment, quand le relevé existe.
//
// UN TROISIÈME EST PARTI : l'enveloppe totale et le reste à répartir, écrits
// sous le champ. C'était juste en intention et faux en pratique — treize cartes
// répétaient treize fois le même nombre, et le lecteur ne lisait plus rien. La
// phrase remonte dans `EnveloppeAnnee`, une seule fois, reformulée.
//
// Ce qu'on n'affiche PAS, et il faut le dire : le réglé n'est pas ventilé par
// plateforme AU SEIN d'un thème. `BudgetPlanifie` donne `parCanal` (tout le
// compte) et `parTheme` (tous canaux confondus), pas le croisement des deux.
// Le croiser au prorata de la dépense fabriquerait un nombre que personne n'a
// mesuré — c'est exactement ce que la page s'interdit.
//
// AUCUNE ENVELOPPE ESTIMÉE. Un thème sans enveloppe saisie affiche sa dépense
// et se tait : ni barre, ni pourcentage, ni dénominateur. Elle retombait avant
// sur la somme des douze mensuels du thème, ce qui produisait à l'écran un
// « 61 % de l'enveloppe » sur un thème dont le champ affichait 0 — un reproche
// adossé à un nombre que personne n'avait tapé, et seulement sur les thèmes qui
// avaient un vieux mensuel. Soit on juge tout le monde, soit personne.
export function LigneTheme({
  t,
  part,
  elapsedAn,
  annee,
  univers,
  planifie,
}: {
  t: ThemeSpend;
  part: number;
  elapsedAn: number;
  annee: number;
  univers: string[];
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
    <div className="px-4 py-4 h-full flex flex-col min-w-0">
      {/* Rang 1 — l'identité, et rang 2 à sa droite : le compteur de contexte. */}
      <div className="flex items-baseline gap-2 min-w-0">
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0 border-2 translate-y-[1px]"
          style={{ background: teinte.aplat, borderColor: teinte.trait }}
        />
        <span className="text-[13.5px] font-semibold text-ink truncate min-w-0">{t.label}</span>
        <span className="ml-auto text-[10.5px] text-faint whitespace-nowrap shrink-0">
          {part.toFixed(0)} % du total
        </span>
      </div>

      {/* Rang 3 — le chiffre. Il était en 15 px, la taille d'une ligne de
          détail : la grammaire demande 22 px au minimum, et c'est le seul
          nombre que cette carte existe pour montrer. Il porte sa fenêtre et son
          mot — une somme dit « au total ». */}
      <div className="font-mono text-[22px] leading-none font-medium text-ink mt-2.5">
        {fmtCHF(t.spendYear)}
        <span className="text-[12px] text-faint"> CHF</span>
      </div>
      <div className="text-[10.5px] text-faint mt-1">
        dépensés en {annee}, au total
        {t.budgetYear > 0 && (
          <span className="text-muted"> · enveloppe {fmtCHF(t.budgetYear)} CHF</span>
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
        // Rang 7 — et le pied d'hier est venu s'y fondre.
        //
        // « Tes budgets mensuels ne font plus une enveloppe d'année » vivait au
        // rang 9, sous le champ. Deux torts : ce n'est pas une convention de
        // lecture du module, c'est un fait sur la DONNÉE de ce thème — la même
        // nature que la phrase juste au-dessus, qui dit qu'il n'a pas
        // d'enveloppe ; et surtout, posé après le champ, il faisait remonter ce
        // champ de sa propre hauteur. Deux cartes sur une rangée de trois le
        // portaient : leurs champs se retrouvaient 114 px plus haut que les
        // autres, dans un module dont le rang 8 écrit noir sur blanc que des
        // champs à trois hauteurs différentes se cherchent.
        //
        // Fondues, les deux phrases se suivent naturellement : il n'y a pas
        // d'enveloppe, ET voilà ce qui n'en tient pas lieu. Le champ redevient
        // le dernier élément de la carte, `mt-auto` ne pousse plus que lui.
        <div className="text-[11px] text-faint mt-1.5 leading-relaxed">
          Pas d&apos;enveloppe pour ce thème — sans elle, il n&apos;y a rien à quoi comparer
          cette dépense.
          {t.budgetYearHerite > 0 && (
            <>
              {" "}
              Tes budgets mensuels sur ce thème ({fmtCHF(t.budgetYearHerite)} CHF sur douze
              mois) n&apos;en fabriquent plus une : seul le montant tapé ci-dessous compte.
            </>
          )}
        </div>
      )}

      {/* Rang 7 — le détail : où c'est parti, et ce qui est réglé dans les
          régies. Le libellé était « Posé sur ses campagnes », que personne ne
          reliait à un réglage Meta ou Google. */}
      <div className="mt-3 pt-2.5 border-t border-line space-y-1">
        {canaux.length > 0 ? (
          canaux.map(([cle, montant]) => {
            const ca = CANAL[cle];
            return (
              <div key={cle} className="flex items-baseline gap-1.5 text-[11.5px] min-w-0">
                <span style={{ color: ca.couleur }}>{ca.glyphe}</span>
                <span className="text-muted truncate">{ca.nom}</span>
                <span className="ml-auto font-mono text-ink whitespace-nowrap">
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
            rien de dépensé sur ce thème en {annee}
          </div>
        )}
        {/* DEUX VIDES, DEUX MOTS — et surtout pas le même.
            · `planifie.vide` : aucun relevé n'existe encore, on ne SAIT pas.
              « au prochain relevé » dit que le chiffre arrive.
            · `pose === 0` avec un relevé : on sait, et la réponse est zéro.
              Ce zéro-là est mesuré, il n'est donc pas faux — mais « 0 CHF » se
              lit « rien de prévu », alors que le fait est « aucun budget n'est
              réglé EN CE MOMENT sur les campagnes de ce thème » : elles sont
              finies, en pause, ou aucune ne porte ce label. On écrit le fait.
            Les confondre, c'est faire passer une ignorance pour un constat, ou
            l'inverse — et le second est le plus grave, parce qu'il se lit comme
            la ligne honnête de la carte. */}
        <div className="flex items-baseline gap-2 text-[11.5px] pt-0.5 min-w-0">
          <span className="text-faint min-w-0">Budget réglé dans Meta et Google</span>
          <span className="ml-auto whitespace-nowrap">
            {planifie.vide ? (
              <span className="text-faint">au prochain relevé</span>
            ) : pose > 0 ? (
              <span className="font-mono text-ink">{fmtCHF(pose)} CHF</span>
            ) : (
              <span className="text-muted">rien de réglé en ce moment</span>
            )}
          </span>
        </div>
      </div>

      {/* Rang 8 — le pilotage, en bas, poussé au bas de la carte : dans une
          grille, des champs de saisie alignés se comparent, des champs qui
          flottent à trois hauteurs différentes se cherchent.
          `mt-auto` ne tient cette promesse QUE s'il pousse le champ SEUL. Rien
          ne se pose plus sous lui — le module n'a pas de rang 9, sa seule
          phrase d'honnêteté est remontée au rang 7 avec les autres faits sur la
          donnée du thème. */}
      <div className="mt-auto pt-3">
        <BudgetEditor
          channel={`label:${t.label}`}
          current={t.budgetYear}
          periode="an"
          annee={annee}
          libelle={`Enveloppe ${annee}`}
        />
      </div>
    </div>
  );
}
