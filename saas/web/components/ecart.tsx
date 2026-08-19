import { pct, type Comparaison, type DashParams } from "@/lib/channels";
import { lienDash } from "@/lib/liens";
import { Triangle, sensPente } from "@/components/pente";

// ── L'ÉCART, DANS UNE LIGNE DE TABLE ─────────────────────────────────────────
//
// Quand une comparaison est posée dans le module « Comparer », les deux tables
// qui le suivent — par thème, par campagne — montrent le même écart, ligne par
// ligne. Ce fichier porte la RÈGLE DE LECTURE et la CELLULE ; la fenêtre de
// référence, les quatre refus et le rognage du jour en cours restent où ils ont
// été tranchés une fois pour toutes : `batirComparaison`, dans `lib/channels.ts`.
//
// RIEN N'EST RE-TESTÉ ICI. `c.ventilations` vaut `null` dès que la comparaison
// ne tient pas — référence hors couverture, référence qui chevauche la période
// affichée, référence sans aucune ligne — et `ouvrirEcart` rend alors `null` :
// la colonne disparaît, la table redevient au pixel près ce qu'elle était. Un
// second exemplaire de la liste des refus finirait par diverger de l'original,
// c'est exactement le défaut qu'on vient de corriger sur les liens.
//
// ── LA FORME : UNE COLONNE, EN FIN DE LIGNE ──────────────────────────────────
//
// Trois formes étaient possibles, une seule survit à la contrainte de largeur —
// ces tables défilent déjà horizontalement (820 px de minimum pour les
// campagnes).
//
//   · UNE COLONNE PAR MÉTRIQUE (l'avant / l'après sur chacune). Écartée : elle
//     double une table déjà dense, et elle répond sept fois « combien » quand la
//     question posée à une table est « QUI a bougé ». Le détail métrique par
//     métrique existe déjà, une fois, dans le module « Comparer ».
//   · UNE SECONDE VALEUR SOUS CHAQUE CHIFFRE. Écartée pour deux raisons : elle
//     allonge toutes les lignes même quand rien n'est né, et surtout une cellule
//     qui doit parfois écrire « 1re donnée 14 aoû » au lieu d'un nombre casse la
//     colonne de chiffres dans laquelle elle vit.
//   · UNE COLONNE DÉDIÉE, retenue. Un seul écart par ligne — celui de la
//     métrique qui pilote déjà la page (le sélecteur sous la courbe, la tête du
//     module « Comparer ») — et une cellule qui peut porter un MOT quand il n'y
//     a pas de pourcentage à écrire. Elle coûte ~120 px, et seulement quand une
//     comparaison est posée.
//
// ── CE QU'ON N'ÉCRIT PAS ─────────────────────────────────────────────────────
//
// Une ligne présente dans une fenêtre et absente de l'autre n'a pas d'écart, et
// les deux absences ne se disent pas de la même façon :
//
//   · NAISSANCE — sa première donnée est postérieure à la fin de la référence.
//     Elle n'existait pas, ce n'est donc ni « +100 % » ni « nouveau » posé sans
//     preuve : on écrit LA DATE de sa première ligne, qui est vérifiable.
//   · SILENCE — elle existait avant, elle n'a rien porté pendant la référence.
//     Ce n'est pas une baisse de 100 %, c'est une absence de mesure.
//
// Et une référence à zéro reste une référence à zéro : `pct()` rend `null`, on
// écrit le mot. Il n'y a pas de « +∞ % ».

/** La valeur d'URL qui bascule les tables sur le tri par écart. */
export const TRI_ECART = "ecart";

export type MetriqueEcart = {
  /** Le nom de la métrique comparée, tel qu'il s'écrit dans une phrase. */
  titre: string;
  /** La valeur de la métrique, dérivée des grandeurs BRUTES d'une fenêtre. Les
   *  taux se calculent ici, sur les totaux — jamais en moyennant des taux. */
  valeur: (brut: Record<string, number>) => number;
  /**
   * `true` quand le nombre affiché est un TOTAL de fenêtre : deux fenêtres de
   * longueurs différentes ne se comparent alors qu'au jour, exactement comme
   * dans « Comparer ». `false` quand le dénominateur n'est déjà plus la fenêtre
   * — une moyenne PAR PUBLICATION n'a rien à normaliser, et la ramener au jour
   * la rendrait fausse.
   */
  ramenerAuJour: boolean;
  fmt: (v: number) => string;
  unite?: string;
  baisseEstBonne?: boolean;
  /** La dépense ne se juge pas seule (docs/03-grammaire-des-modules.md) : sa
   *  pastille reste grise, elle n'est ni verte ni rouge. */
  neutre?: boolean;
};

export type EcartLigne =
  | { genre: "compare"; pourcent: number | null; absolu: number; reference: number }
  | { genre: "naissance"; premiere: string }
  | { genre: "silence" };

export type LectureEcart = {
  /** « 28 jul → 3 aoû 2026 » — la fenêtre de référence, écrite. */
  reference: string;
  /** Les valeurs sont-elles ramenées au jour ? (fenêtres inégales + total) */
  parJour: boolean;
  joursCourant: number;
  joursReference: number;
  m: MetriqueEcart;
  /** L'écart d'une ligne, depuis sa valeur AFFICHÉE sur la période courante. */
  ligne: (cle: string, courant: number) => EcartLigne;
  /** Ce que la référence portait et que la table n'a plus. Ces lignes ne sont
   *  PAS ajoutées à la table — elle liste la période affichée — mais les taire
   *  ferait disparaître de l'écran la moitié la plus intéressante d'une baisse. */
  disparues: (affichees: string[]) => { cle: string; valeur: number }[];
};

const MOIS = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];

/** « 2026-08-14 » → « 14 aoû ». Découpage de la chaîne, jamais `new Date` : un
 *  ISO se parse à minuit UTC et rendrait la veille dans tout fuseau derrière
 *  Greenwich (même raison que `jourISO` dans channel-dash). */
export function jourCourtISO(d: string): string {
  const [, m, j] = d.slice(0, 10).split("-");
  const mi = Number(m) - 1;
  return mi >= 0 && mi < 12 ? `${j} ${MOIS[mi]}` : d.slice(0, 10);
}

/**
 * Ouvre la lecture d'écart d'une table. `null` = aucune comparaison à poser, et
 * l'appelant n'a aucune autre question à se poser.
 */
export function ouvrirEcart(
  c: Comparaison,
  ventilation: string,
  m: MetriqueEcart
): LectureEcart | null {
  const v = c.ventilations?.[ventilation];
  if (!v || !c.reference) return null;

  const jc = c.courant.jours;
  const jr = c.reference.jours;
  const parJour = c.inegales && m.ramenerAuJour;
  const finRef = c.reference.fin;
  const valRef = (brut: Record<string, number>) =>
    parJour ? m.valeur(brut) / jr : m.valeur(brut);

  return {
    reference: c.reference.label,
    parJour,
    joursCourant: jc,
    joursReference: jr,
    m,
    ligne: (cle, courant) => {
      const brut = v.reference[cle];
      if (!brut) {
        const p = v.premiere[cle];
        // Née APRÈS la fin de la référence : l'absence est expliquée par sa
        // date, pas par un pourcentage qu'on n'a pas le droit de calculer.
        if (p && p > finRef) return { genre: "naissance", premiere: p };
        return { genre: "silence" };
      }
      const r = valRef(brut);
      const cur = parJour ? courant / jc : courant;
      return { genre: "compare", pourcent: pct(cur, r), absolu: cur - r, reference: r };
    },
    disparues: (affichees) => {
      const vues = new Set(affichees);
      return Object.entries(v.reference)
        .filter(([cle]) => !vues.has(cle))
        .map(([cle, brut]) => ({ cle, valeur: valRef(brut) }))
        .sort((a, b) => b.valeur - a.valeur);
    },
  };
}

/** Le tri par écart est-il demandé ? */
export function triParEcart(sp: DashParams | undefined): boolean {
  return (sp?.tri ?? "") === TRI_ECART;
}

/**
 * Classe une table par écart. **La variation ABSOLUE, jamais le pourcentage** :
 * un thème passé de 2 à 20 CHF fait « +900 % » et n'explique rien, alors que la
 * campagne qui a perdu 3 000 CHF explique à elle seule la baisse du compte. Un
 * tri par pourcentage remonterait mécaniquement les plus petites lignes — c'est
 * une machine à mettre le bruit en tête.
 *
 * LES LIGNES SANS ÉCART FORMENT LEUR PROPRE GROUPE, APRÈS. Une naissance n'a pas
 * de variation ; lui en fabriquer une (sa valeur entière, comme si l'autre
 * fenêtre valait zéro) la ferait concourir contre des écarts mesurés avec un
 * chiffre qui n'a pas été mesuré. Elles sont donc classées entre elles, par la
 * métrique de la période affichée, et le pied de la table le dit.
 */
export function trierParEcart<T>(
  lignes: T[],
  l: LectureEcart,
  cle: (x: T) => string,
  courant: (x: T) => number
): T[] {
  const rang = (x: T): [number, number] => {
    const e = l.ligne(cle(x), courant(x));
    return e.genre === "compare" ? [0, Math.abs(e.absolu)] : [1, courant(x)];
  };
  return [...lignes]
    .map((x) => ({ x, r: rang(x) }))
    .sort((a, b) => (a.r[0] !== b.r[0] ? a.r[0] - b.r[0] : b.r[1] - a.r[1]))
    .map((e) => e.x);
}

/** Ce qui s'ajoute au sous-titre d'une table quand une comparaison est posée. */
export function mentionEcart(l: LectureEcart | null, trie: boolean): string {
  if (!l) return "";
  return ` · écart de ${l.m.titre.toLowerCase()} vs ${l.reference}${trie ? " · classée par écart" : ""}`;
}

/**
 * L'en-tête de la colonne d'écart. Le lien bascule le tri de la page et passe
 * par `lienDash` : il énumère ce qu'il CHANGE (`tri`), tout le reste — période,
 * filtres, métrique, réglage de comparaison — traverse parce qu'il était là.
 */
export function EnteteEcart({
  path,
  sp,
  metriqueParDefaut,
  trie,
  className = "",
}: {
  path: string;
  sp: DashParams;
  metriqueParDefaut: string;
  trie: boolean;
  className?: string;
}) {
  return (
    <a
      href={lienDash(path, sp, { tri: trie ? undefined : TRI_ECART }, metriqueParDefaut)}
      className={`${className} ${trie ? "text-ink" : "hover:text-muted"}`}
      title={
        trie
          ? "Revenir au classement de la période affichée"
          : "Classer par écart — la plus forte variation en valeur d'abord"
      }
    >
      Écart{trie ? " ↓" : ""}
    </a>
  );
}

/**
 * La cellule. Un seul nombre par ligne, ou un mot quand il n'y a pas de nombre —
 * et le mot porte sa raison dans son `title`, parce qu'une cellule de 120 px ne
 * peut pas porter une phrase mais ne doit pas non plus laisser deviner.
 */
export function CelluleEcart({ e, l }: { e: EcartLigne; l: LectureEcart }) {
  if (e.genre === "naissance")
    return (
      <span
        className="text-[10px] text-faint whitespace-nowrap"
        title={`Aucune donnée avant le ${e.premiere}, soit après la fin de la période de référence (${l.reference}). Cette ligne n'a pas d'écart : elle a une naissance.`}
      >
        1<sup>re</sup> donnée {jourCourtISO(e.premiere)}
      </span>
    );

  if (e.genre === "silence")
    return (
      <span
        className="text-[10px] text-faint whitespace-nowrap"
        title={`Cette ligne n'a porté aucune donnée sur ${l.reference}. Ce n'est pas une baisse de 100 % : c'est une absence de mesure, et en faire un dénominateur donnerait une variation infinie.`}
      >
        rien sur la réf.
      </span>
    );

  if (e.pourcent === null)
    return (
      <span
        className="text-[10px] text-faint whitespace-nowrap"
        title={`${l.m.titre} valait zéro sur ${l.reference} : une variation en pourcentage demanderait de diviser par zéro.`}
      >
        réf. à zéro
      </span>
    );

  // LE SENS SE CALCULE SUR L'ÉCART RÉEL, la couleur seule dépend de `neutre`.
  // Passer `null` à `sensPente` pour une métrique neutre rendrait `plat: true`
  // et le nombre disparaîtrait derrière un « ≈ » : la dépense ne se JUGE pas,
  // mais elle se MESURE — « −33 % » reste l'information qu'on vient chercher.
  const s = sensPente(e.pourcent, l.m.baisseEstBonne, 1);
  return (
    <span
      className="whitespace-nowrap"
      title={`${l.m.titre} sur ${l.reference} : ${l.m.fmt(e.reference)}${
        l.m.unite ? ` ${l.m.unite}` : ""
      }${l.parJour ? " par jour" : ""}`}
    >
      <span className={`text-[11px] font-semibold ${l.m.neutre || s.plat ? "text-muted" : s.cls}`}>
        {s.plat ? (
          "≈ stable"
        ) : (
          <>
            {!l.m.neutre && <Triangle sens={s.monte ? "haut" : "bas"} />}
            {l.m.neutre ? "" : " "}
            {e.pourcent > 0 ? "+" : ""}
            {Math.round(e.pourcent)} %
          </>
        )}
      </span>{" "}
      <span className="text-[10px] text-faint">réf. {l.m.fmt(e.reference)}</span>
    </span>
  );
}

/**
 * Le rang 9 des tables comparées — une seule phrase, celle qui rend l'écart
 * honnête. Elle est fabriquée ici pour que les trois tables la disent avec les
 * mêmes mots : trois rédactions divergeraient à la première correction.
 */
export function phraseEcart(
  l: LectureEcart,
  disparues: { cle: string; valeur: number }[],
  trie: boolean,
  /** Le nom de ce qu'une ligne DÉSIGNE — « thème », « campagne ». Il ne sert
   *  qu'à compter ; le SUJET des phrases reste « la ligne », féminin dans les
   *  deux tables. « Une thème » et « les thèmes … classées » sont sortis d'une
   *  première version : une faute d'accord dans la phrase qui explique un
   *  chiffre fait douter du chiffre. */
  mot: { ligne: string; lignes: string }
): string {
  const p: string[] = [
    `L'écart compare la période affichée à ${l.reference}, la même référence que le module « Comparer » ci-dessus.`,
  ];
  if (l.parJour)
    p.push(
      `Les deux fenêtres n'ont pas la même longueur (${l.joursCourant} jours contre ${l.joursReference}) : chaque valeur est ramenée au jour des deux côtés, sinon l'écart mesurerait la durée des fenêtres et non la performance.`
    );
  p.push(
    `Une ligne sans écart n'en a pas : « 1re donnée » dit qu'elle est née après la référence, « rien sur la réf. » qu'elle existait déjà mais n'a rien porté — une absence de mesure n'est pas une baisse de 100 %.`
  );
  if (disparues.length) {
    const n = disparues.length;
    const noms = disparues.slice(0, 3).map((d) => d.cle).join(", ");
    const reste = n - 3;
    p.push(
      `${n} ${n > 1 ? mot.lignes : mot.ligne} ${n > 1 ? "portaient" : "portait"} de la donnée sur la référence et ${
        n > 1 ? "n'en portent" : "n'en porte"
      } plus aucune sur la période affichée (${noms}${
        reste > 0 ? `, et ${reste} autre${reste > 1 ? "s" : ""}` : ""
      }) — cette table liste la période affichée, ${
        n > 1 ? "ces lignes-là n'y figurent" : "cette ligne-là n'y figure"
      } donc pas.`
    );
  }
  if (trie)
    p.push(
      `Le classement suit la VARIATION en valeur, pas le pourcentage — celui-ci remonterait mécaniquement les plus petites lignes. Les lignes sans écart ferment la liste, classées entre elles par ${l.m.titre.toLowerCase()}.`
    );
  return p.join(" ");
}
