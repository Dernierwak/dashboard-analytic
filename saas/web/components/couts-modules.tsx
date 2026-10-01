import { fmtCHF } from "@/lib/report";
import type { AlerteJour, PointSerie } from "@/lib/couts";
import type { BudgetPlanifie } from "@/lib/budgets";
import { BudgetEditor } from "@/components/budget-editor";
import { LineChart } from "@/components/line-chart";
import { dateCourte } from "@/components/etat-action";

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
//   · `EnveloppeAnnee` — à GAUCHE, sur 1/3 : ce que tu t'autorises, et le champ
//     pour le changer. AUCUNE FORME ;
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

/**
 * L'ENVELOPPE — la seule décision de haut de page, et le seul champ.
 *
 * Rangs : 1 identité · 3 le chiffre · 8 le champ · 9 le pied. Pas de rang 6 : la forme appartient à `DepenseAnnee`.
 */
export function EnveloppeAnnee({
  annee,
  budgetAnnuel,
  budgetAnnuelHerite,
}: {
  annee: number;
  budgetAnnuel: number;
  /** Ce que l'ancienne préséance aurait calculé — pour l'écrire, pas pour le servir. */
  budgetAnnuelHerite: number;
}) {
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
 *
 * LA VENTILATION PAR PLATEFORME EST PARTIE, et ce n'est pas un arbitrage de
 * place : c'est la règle qui veut qu'une même information ne se dessine pas
 * deux fois sur une page. Deux lignes fermaient ce module — « ▣ Meta Ads
 * 18 166 · 29 % », « ◆ Google Ads 44 051 · 71 % » — pendant que la section
 * « Où ça part », plus bas, porte un ANNEAU par plateforme qui répond
 * exactement à la même question. Entre les deux, c'est l'anneau qui gagne :
 * il MONTRE la proportion, là où deux lignes obligent à la calculer, et une
 * répartition est d'abord une affaire de surfaces.
 *
 * Il y avait pire que la redite. Ces lignes lisaient `spentYear` — l'année
 * entière, toujours — quand l'anneau obéit au filtre de période.
 * Dès qu'on filtrait sur 30 jours, la même page affichait deux partages Meta /
 * Google différents sans dire lequel répondait à quoi.
 *
 * Donc : si l'envie revient de savoir ce que chaque plateforme a coûté, c'est
 * l'anneau qu'il faut aller regarder ou corriger. Le manque est là-bas, pas
 * ici — le remettre ici, c'est refabriquer la contradiction.
 */
export function DepenseAnnee({
  annee,
  spentYear,
  budgetAnnuel,
  elapsedAn,
  planifie,
}: {
  annee: number;
  /** `null` = une régie muette traverse l'année (ticket 48). LE VERDICT SE
   *  DÉSARME ALORS ENTIÈREMENT — pas de barre, pas de pastille, pas de « reste
   *  à dépenser ». C'est le cœur du ticket : une semaine de récolte ratée
   *  faisait baisser ce cumul, donc repasser le compte du bon côté, donc
   *  afficher « dans les clous » à quelqu'un qui ne l'est peut-être pas. Un
   *  verdict sur une dépense inconnue est pire que pas de verdict. */
  spentYear: number | null;
  budgetAnnuel: number;
  elapsedAn: number;
  /** Ce qui est RÉGLÉ sur les campagnes — l'autre promesse, celle des plateformes. */
  planifie: BudgetPlanifie;
}) {
  const ratio = budgetAnnuel > 0 && spentYear !== null ? spentYear / budgetAnnuel : null;
  const enAvance = ratio !== null && ratio > elapsedAn + 0.05;
  const depasse = ratio !== null && ratio > 1;
  const resteEnveloppe = spentYear === null ? null : budgetAnnuel - spentYear;

  return (
    /* `flex flex-col`, et ce n'est pas décoratif : ce module est le plus COURT
       des deux de la rangée, alors que c'est le plus LARGE. La rangée est en
       `items-stretch`, donc les deux cartes ont toujours la même hauteur — celle
       de l'enveloppe, à gauche, qui porte un champ de saisie et deux
       paragraphes. Tout le mou tombait ici, en bloc, APRÈS la dernière ligne :
       161 px de blanc au bas de la plus grande carte de la page dans le cas
       nominal. La ventilation par plateforme en bouchait 53, ce qui en faisait
       un décor utile — mais c'est un mauvais motif pour garder un bloc, et le
       trou était déjà là avant elle.
       Le mou passe donc AU-DESSUS du pied (`mt-auto` sur le rang 9), et les
       deux cartes finissent leur dernière ligne à la même hauteur. C'est
       exactement ce que le rang 8 d'`EnveloppeAnnee` promet en face. */
    <div className="bg-white border border-line rounded-xl shadow-card p-5 min-w-0 flex flex-col">
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
          {spentYear === null ? "—" : fmtCHF(spentYear)}
          {spentYear !== null && <span className="text-[15px] text-faint"> CHF</span>}
        </span>
        <span className="text-[11px] text-faint">
          {spentYear === null
            ? "une régie n'a pas répondu — le cumul de l'année est incomplet"
            : "dépensés depuis janvier, au total"}
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
      ) : budgetAnnuel <= 0 ? (
        // L'ORDRE DES DEUX ABSENCES COMPTE. Un compte neuf peut n'avoir ni
        // enveloppe NI récolte : lui parler d'abord de la régie muette le
        // prive du seul geste qu'il puisse faire aujourd'hui — poser son
        // enveloppe. Le trou, lui, se répare tout seul au prochain passage.
        <p className="text-[12px] text-muted mt-3 leading-relaxed">
          Aucune barre ici tant que l&apos;enveloppe de l&apos;année n&apos;est pas fixée : sans
          elle, ce montant ne se compare à rien. Elle se pose dans le module de gauche.
        </p>
      ) : (
        // LA BARRE NE SE DESSINE PAS SUR UNE DÉPENSE INCONNUE, même si
        // l'enveloppe, elle, est bien fixée. C'est exactement le désarmement
        // que demande l'ADR 0005 : ne rien prononcer plutôt que prononcer à
        // côté. Le bandeau en haut de page dit quelle régie manque et depuis
        // quand ; ici on dit seulement ce qui ne peut plus être dit.
        <p className="text-[12px] text-muted mt-3 leading-relaxed">
          Pas de barre tant qu&apos;une régie n&apos;a pas répondu : le cumul de
          l&apos;année serait amputé, et le comparer à ton enveloppe te dirait que tu es
          dans les clous sans qu&apos;on en sache rien. Le chiffre revient tout seul au
          prochain passage réussi.
        </p>
      )}

      {/* Rang 7 — le bilan : deux nombres qui ne se déduisent ni l'un de
          l'autre ni du chiffre de tête. */}
      <div className="mt-4 rounded-xl bg-black/[0.025] px-4 py-3 flex gap-x-8 gap-y-3 flex-wrap">
        {/* « RESTE À DÉPENSER » EST UN FEU VERT, et c'est le sens dans lequel il
            ne faut surtout pas se tromper : calculé sur un cumul amputé, il
            autorise à dépenser de l'argent qui est peut-être déjà parti. Il
            disparaît donc avec la dépense, il ne se replie pas sur l'enveloppe
            entière. */}
        {budgetAnnuel > 0 && resteEnveloppe !== null && (
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

      {/* Rang 9 — le pied, un seul. Ce que « réglé dans Meta et Google » veut
          dire, et pourquoi il peut être vide.

          La DATE passe par `dateCourte` : `releveLe` sort de la base au format
          ISO (`2026-08-10`), et une page qui écrit par ailleurs « 10 aoû »
          partout ne peut pas laisser une date de machine au milieu d'une
          phrase française. Le repli « — » reste : `releveLe` vaut `null` tant
          qu'aucun relevé n'existe, et `vide` n'est pas la seule porte qui y
          mène.

          `mt-auto` : le pied est poussé au bas de la carte, et c'est lui qui
          encaisse la hauteur que la carte de gauche impose. `mt-3` reste en
          plancher via `pt-3` — sur téléphone, où les cartes s'empilent et où
          plus rien ne les étire, `mt-auto` ne vaut rien et il faut quand même
          de l'air au-dessus de cette phrase. */}
      <p className="text-[11px] text-faint mt-auto pt-3 leading-relaxed">
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
  dernierePartielle = false,
}: {
  serie: PointSerie[];
  pas: "jour" | "semaine";
  titre: string;
  repere: number;
  /** La dernière semaine est en cours : sans ça, elle se lit comme une chute. */
  dernierePartielle?: boolean;
}) {
  if (serie.length < 2) return null;

  // UN POINT TU (`null`) N'EST PAS UN POINT À ZÉRO (ticket 48). Il ne compte
  // ni dans le cumul, ni dans la recherche du pic — l'inclure comme un zéro
  // ferait d'un jour non lu le jour le plus calme de la période, et baisserait
  // un total que la tuile du haut affiche en 34 px.
  const mesures = serie.filter(
    (p): p is PointSerie & { meta: number; google: number } =>
      p.meta !== null && p.google !== null
  );
  const tus = serie.length - mesures.length;
  const total = mesures.reduce((a, p) => a + p.meta + p.google, 0);
  const pire = mesures.reduce(
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
          {mesures.length === 0 ? "—" : fmtCHF(total)}
          {mesures.length > 0 && <span className="text-[15px] text-faint"> CHF</span>}
        </span>
        <span className="text-[11px] text-faint">
          {mesures.length === 0
            ? `aucun ${unite} lu sur cette période`
            : `cumulés sur ${mesures.length} ${unite}${mesures.length > 1 ? "s" : ""}`}
          {tus > 0 && ` · ${tus} non lu${tus > 1 ? "s" : ""}`}
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
        ) : (
          <>Fixe une enveloppe d&apos;année pour voir apparaître ton budget sur la courbe.</>
        )}
        {dernierePartielle && (
          <> La dernière semaine est en cours : elle est forcément plus basse que les autres.</>
        )}
        {/* Le trait qui s'arrête avant le bord doit s'expliquer, sinon il se lit
            comme un arrêt de campagne — c'est le défaut nommé par le ticket 48. */}
        {tus > 0 && (
          <>
            {" "}
            La courbe s&apos;arrête au dernier {unite} lu : une régie n&apos;a pas répondu,
            et les {unite}s suivant{unite === "semaine" ? "es" : "s"} ne sont pas mesuré
            {unite === "semaine" ? "es" : "s"} — {unite === "semaine" ? "elles" : "ils"} ne
            valent pas zéro.
          </>
        )}
      </p>
    </div>
  );
}
