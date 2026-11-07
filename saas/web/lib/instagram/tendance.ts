// ── LA TENDANCE « TA PAGE » : LE COMPTE SEUL, JOUR PAR JOUR ─────────────────
//
// Spec `.scratch/instagram/spec.md`, § « Tendance — Ta page », ligne « la
// Tendance » de § la lecture, et § Ce qu'on ne mesure pas ; user stories 6 à
// 10. Harnais : `.scratch/instagram-construction/harnais/14-la-tendance/`.
//
// LE COMPTE SEUL, jamais une somme de posts : tout vient de
// `instagram_compte_jours` (le relevé du compte, ticket 05, et la remontée du
// premier passage, ticket 06), de `followers_history` pour les abonnés d'avant
// le 2026-09-04, et de `instagram_compte_periodes` pour la portée d'une
// période. L'Objectif et les Règles de lecture n'y entrent pas : rien ici ne
// reçoit une métrique ni un filtre.
//
// Sans directive (`CLAUDE.md` §8) : le serveur calcule, le composant client
// trace. Les imports sont relatifs et sans extension, comme `tableau.ts`, pour
// que Next et le harnais les résolvent tous deux.
//
// Les règles que ce module tient, chacune testée :
//   · un jour sans ligne, ou une colonne vide, est un TROU — jamais un 0 ;
//   · le jour en cours n'a jamais de valeur ;
//   · la portée de la période est celle qu'Instagram rend, chaque compte
//     compté une fois — JAMAIS la somme des jours ; absente, une phrase dit
//     pourquoi ;
//   · la portée organique du compte n'existe pas (§ Ce qu'on ne mesure pas) ;
//   · une part boostée absente n'est pas un zéro, donc l'organique de ce
//     jour-là n'est pas le total.
import { abonnesParJourDe, NOM_FORMAT, type LigneAbonnesHistorique, type Post } from "./lecture";
import { decaler } from "../meta/lecture";
import { dateCourte } from "./tableau";
import { lienInstagram, type Params } from "./liens";

// ── Ce que la base rend ──────────────────────────────────────────────────────

/** Une ligne d'`instagram_compte_jours` (migration § 23). `undefined` =
 *  colonne non lue, comme `null` : rien rendu. */
export type LigneJourCompte = {
  jour: string | null;
  reach?: unknown;
  total_interactions?: unknown;
  abonnes?: unknown;
  gagnes?: unknown;
  perdus?: unknown;
  reach_ad?: unknown;
  interactions_ad?: unknown;
};

/** Une ligne d'`instagram_compte_periodes` (migration § 23) : `debut` et `fin`
 *  compris tous deux (le worker écrit les 7 jours finissant hier, ticket 05). */
export type LignePeriodeCompte = { debut: string | null; fin: string | null; reach: unknown };

/** La période choisie et celle d'avant — le sous-ensemble de `Periode`
 *  (`lib/meta/lecture.ts`, `periodeDe`) dont la Tendance a besoin. */
export type PeriodeTendance = { debut: string; fin: string; avantDebut: string; avantFin: string; jours: number };

export type EntreeTendance = {
  /** `null` = la table n'a pas pu être lue : des trous, et la page le dit. */
  jours: LigneJourCompte[] | null;
  historique: LigneAbonnesHistorique[];
  periodes: LignePeriodeCompte[] | null;
  /** Les posts en base : seules leurs dates servent (les jours de publication). */
  posts: Post[];
  periode: PeriodeTendance;
  /** L'instant de la lecture, ISO. */
  maintenant: string;
};

// ── Ce que l'écran lit ───────────────────────────────────────────────────────

export type Ventilation = "tout" | "organique" | "booste";
export const VENTILATIONS: readonly Ventilation[] = ["tout", "organique", "booste"];
export const NOM_VENTILATION: Record<Ventilation, string> = { tout: "Tout", organique: "Organique", booste: "Boosté" };

/** Une somme de jours qui se comptent (des interactions, des abonnés gagnés) :
 *  `lus` jours avaient un chiffre sur `sur`. `total` = `null` sans aucun jour
 *  lu — pas un 0. */
export type Somme = { total: number | null; lus: number; sur: number };

export type Serie = {
  serie: (number | null)[];
  serieAvant: (number | null)[];
  /** Pourquoi la série est vide alors que le total ne l'est pas ; `null`
   *  quand elle a au moins un chiffre ou que tout est vide. */
  raisonVide: string | null;
};

export type SerieComptable = Serie & {
  somme: Somme;
  sommeAvant: Somme;
  /** En %, seulement quand les deux périodes sont lues en entier : une somme
   *  à laquelle il manque des jours n'est pas comparable. */
  ecart: number | null;
};

export type PorteePeriode = { etat: "lue"; reach: number } | { etat: "absente"; raison: string };

export type Publication = {
  /** La place du jour dans `dates`. */
  index: number;
  jour: string;
  posts: { id: string; format: string; legende: string }[];
};

export type Tendance = {
  /** Ce qui n'a pas pu être lu en base, dit en une phrase ; `null` sinon. */
  illisible: string | null;
  dates: string[];
  datesAvant: string[];
  /** Les jours (index dans `dates`) des 48 dernières heures : ils peuvent
   *  encore changer. */
  recents: number[];
  publications: Publication[];
  abonnes: {
    serie: (number | null)[];
    serieAvant: (number | null)[];
    gagnes: (number | null)[];
    perdus: (number | null)[];
    /** Le dernier total mesuré de la période. */
    dernier: { jour: string; valeur: number } | null;
    sommeGagnes: Somme;
    sommePerdus: Somme;
  };
  portee: {
    tout: Serie;
    booste: Serie;
    /** Ne se mesure pas : seulement sa raison. */
    organique: { raison: string };
    periode: PorteePeriode;
    periodeAvant: PorteePeriode;
    ecart: number | null;
    /** La portée boostée d'une période ne se lit pas : sa raison. */
    raisonPeriodeBoostee: string;
  };
  interactions: Record<Ventilation, SerieComptable>;
};

// ── Les phrases ──────────────────────────────────────────────────────────────

/** § Ce qu'on ne mesure pas : la ventilation de la portée est dédoublonnée par
 *  produit, pas entre produits — sur 30 jours de l'essai réel, la somme des
 *  produits faisait 83 519 pour un total de 65 980 (`issues/17`). */
export const RAISON_PORTEE_ORGANIQUE =
  "La portée organique du compte ne se mesure pas : Instagram compte chaque personne une fois par produit " +
  "(fil, Reels, stories, publicité), pas une fois en tout. Retirer la part boostée du total compterait " +
  "deux fois les personnes touchées des deux façons.";

export const RAISON_PERIODE_BOOSTEE =
  "Instagram ne rend la portée de la période, chaque compte compté une fois, que pour le total ; " +
  "additionner les jours boostés compterait deux fois un compte touché deux jours.";

/** Ticket 05 : « `AD` absent → NULL ». Meta n'énumère pas les produits sans
 *  activité, et rien ne garantit qu'un `AD` absent vaille 0. */
const RAISON_SANS_PART_BOOSTEE =
  "Instagram n'a rendu aucune part boostée ces jours-là. Pulse ne prend pas son absence pour un zéro : " +
  "sans elle, la part organique ne se calcule pas.";
const RAISON_BOOSTE_VIDE =
  "Instagram n'a rendu aucune part boostée ces jours-là. Pulse ne prend pas son absence pour un zéro.";

/** Le worker relève chaque jour la portée des 7 jours finissant la veille
 *  (`releve_compte.py`, `_JOURS_DE_LA_PERIODE`). */
export const JOURS_DE_LA_PERIODE_RELEVEE = 7;

function raisonPorteeAbsente(p: { debut: string; fin: string; jours: number }, periodes: LignePeriodeCompte[]): string {
  const lues = periodes.filter((l) => l.debut && l.fin && mesure(l.reach) !== null);
  if (p.jours !== JOURS_DE_LA_PERIODE_RELEVEE)
    return (
      `Instagram ne rend la portée d'une période, chaque compte compté une fois, que pour la période qu'on lui demande, ` +
      `et Pulse la relève sur ${JOURS_DE_LA_PERIODE_RELEVEE} jours seulement. La somme des jours compterait deux fois ` +
      `un compte touché deux jours.`
    );
  if (lues.length === 0)
    return "Pulse n'a encore relevé la portée d'aucune semaine : elle se lit au passage du worker qui suit la fin de la semaine.";
  const premiere = lues.map((l) => (l.fin as string).slice(0, 10)).sort()[0];
  return p.fin < premiere
    ? `Pulse ne relève la portée de la semaine que depuis celle finie le ${dateCourte(premiere)} : celle-ci la précède.`
    : "Le worker n'a pas relevé la portée de ces 7 jours le lendemain de leur fin.";
}

// ── Le calcul ────────────────────────────────────────────────────────────────

function mesure(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function joursEntre(debut: string, fin: string): string[] {
  const out: string[] = [];
  for (let d = debut; d <= fin; d = decaler(d, 1)) out.push(d);
  return out;
}

/** Meta documente jusqu'à 48 h de retard sur les chiffres du compte
 *  (`issues/04`) : un jour dont la fin date de moins de 48 h peut encore
 *  changer — le worker relit avant-hier à chaque passage (ticket 06). */
const RETARD_MS = 48 * 3_600_000;
function peutEncoreChanger(jour: string, maintenant: string): boolean {
  return Date.parse(`${decaler(jour, 1)}T00:00:00Z`) + RETARD_MS > Date.parse(maintenant);
}

function somme(valeurs: (number | null)[]): Somme {
  const lues = valeurs.filter((v): v is number => v !== null);
  return { total: lues.length ? lues.reduce((a, b) => a + b, 0) : null, lus: lues.length, sur: valeurs.length };
}

function ecartPct(courant: number | null, avant: number | null): number | null {
  // Diviseur nul → pas d'écart : un « +∞ % » n'existe pas (`CLAUDE.md` §7).
  if (courant === null || avant === null || avant === 0) return null;
  return ((courant - avant) / avant) * 100;
}

const complete = (s: Somme) => s.total !== null && s.lus === s.sur;

const RAISON_PERIODES_ILLISIBLES = "La portée relevée des périodes n'a pas pu être lue.";

function porteeDe(p: { debut: string; fin: string; jours: number }, periodes: LignePeriodeCompte[] | null): PorteePeriode {
  if (periodes === null) return { etat: "absente", raison: RAISON_PERIODES_ILLISIBLES };
  const l = periodes.find((x) => x.debut?.slice(0, 10) === p.debut && x.fin?.slice(0, 10) === p.fin);
  const reach = l ? mesure(l.reach) : null;
  return reach !== null ? { etat: "lue", reach } : { etat: "absente", raison: raisonPorteeAbsente(p, periodes) };
}

// ── Le pont vers le Panneau ──────────────────────────────────────────────────

export type ParamsUrl = Params;

/** Un jour de publication ouvre le post dans le Panneau (`?post=`, spec § L'état
 *  de la page vit dans l'URL). Le lien ne change QUE `post` et garde tout le
 *  reste, Règles de lecture et période comprises (`CLAUDE.md` §8). */
export function lienDuPost(params: ParamsUrl, id: string): string {
  return lienInstagram(params, { post: id });
}

const LEGENDE_MAX = 80;

export function tendanceDe(e: EntreeTendance): Tendance {
  const { periode, maintenant } = e;
  const aujourdhui = maintenant.slice(0, 10);
  const dates = joursEntre(periode.debut, periode.fin);
  const datesAvant = joursEntre(periode.avantDebut, periode.avantFin);

  const parJour = new Map<string, LigneJourCompte>();
  for (const l of e.jours ?? []) if (l.jour) parJour.set(l.jour.slice(0, 10), l);

  /** La valeur d'un jour, `null` pour un trou ou pour le jour en cours. */
  const lire = (jours: string[], f: (l: LigneJourCompte) => number | null) =>
    jours.map((d) => {
      const l = parJour.get(d);
      return l && d < aujourdhui ? f(l) : null;
    });
  const col = (c: keyof LigneJourCompte) => (l: LigneJourCompte) => mesure(l[c]);

  const serie = (f: (l: LigneJourCompte) => number | null): Serie => ({
    serie: lire(dates, f),
    serieAvant: lire(datesAvant, f),
    raisonVide: null,
  });
  const comptable = (s: Serie): SerieComptable => {
    const sc = somme(s.serie);
    const sa = somme(s.serieAvant);
    return { ...s, somme: sc, sommeAvant: sa, ecart: complete(sc) && complete(sa) ? ecartPct(sc.total, sa.total) : null };
  };
  /** La raison d'une série vide, seulement si le total a des chiffres. */
  const expliquer = (s: Serie, total: Serie, raison: string): Serie => {
    const vide = (x: (number | null)[]) => x.every((v) => v === null);
    return { ...s, raisonVide: vide(s.serie) && !vide(total.serie) ? raison : null };
  };

  // Abonnés : `followers_history` jusqu'au 2026-09-04, puis le compte ; le
  // compte l'emporte un jour où les deux existent (`abonnesParJourDe`). Entre
  // les deux sources, aucun jour mesuré : le trou se fait seul.
  const abonnesParJour = abonnesParJourDe(e.historique, (e.jours ?? []).map((l) => ({ jour: l.jour, abonnes: l.abonnes })));
  const abonnes = (jours: string[]) => jours.map((d) => (d < aujourdhui && d in abonnesParJour ? abonnesParJour[d] : null));
  const serieAbonnes = abonnes(dates);
  const gagnes = lire(dates, col("gagnes"));
  const perdus = lire(dates, col("perdus"));
  let dernier: Tendance["abonnes"]["dernier"] = null;
  serieAbonnes.forEach((v, i) => {
    if (v !== null) dernier = { jour: dates[i], valeur: v };
  });

  const porteeTout = serie(col("reach"));
  const porteeBooste = expliquer(serie(col("reach_ad")), porteeTout, RAISON_BOOSTE_VIDE);
  const periodeLue = porteeDe(periode, e.periodes);
  const periodeAvant = porteeDe({ debut: periode.avantDebut, fin: periode.avantFin, jours: periode.jours }, e.periodes);

  const interTout = serie(col("total_interactions"));
  const interBooste = expliquer(serie(col("interactions_ad")), interTout, RAISON_BOOSTE_VIDE);
  const interOrganique = expliquer(
    serie((l) => {
      const t = mesure(l.total_interactions);
      const ad = mesure(l.interactions_ad);
      return t === null || ad === null ? null : t - ad;
    }),
    interTout,
    RAISON_SANS_PART_BOOSTEE
  );

  const publications: Publication[] = [];
  const index = new Map(dates.map((d, i) => [d, i]));
  for (const p of [...e.posts].sort((a, b) => a.date.localeCompare(b.date))) {
    const i = index.get(p.jour);
    if (i === undefined) continue;
    let pub = publications.find((x) => x.index === i);
    if (!pub) publications.push((pub = { index: i, jour: p.jour, posts: [] }));
    const legende = p.legende.length > LEGENDE_MAX ? `${p.legende.slice(0, LEGENDE_MAX - 1)}…` : p.legende;
    pub.posts.push({ id: p.id, format: p.format ? NOM_FORMAT[p.format] : "Format inconnu", legende });
  }
  publications.sort((a, b) => a.index - b.index);

  return {
    illisible: e.jours === null ? "Les chiffres du compte n'ont pas pu être lus : les courbes sont vides, ce n'est pas un zéro." : null,
    dates,
    datesAvant,
    recents: dates.flatMap((d, i) => (d < aujourdhui && peutEncoreChanger(d, maintenant) ? [i] : [])),
    publications,
    abonnes: {
      serie: serieAbonnes,
      serieAvant: abonnes(datesAvant),
      gagnes,
      perdus,
      dernier,
      sommeGagnes: somme(gagnes),
      sommePerdus: somme(perdus),
    },
    portee: {
      tout: porteeTout,
      booste: porteeBooste,
      organique: { raison: RAISON_PORTEE_ORGANIQUE },
      periode: periodeLue,
      periodeAvant,
      ecart: periodeLue.etat === "lue" && periodeAvant.etat === "lue" ? ecartPct(periodeLue.reach, periodeAvant.reach) : null,
      raisonPeriodeBoostee: RAISON_PERIODE_BOOSTEE,
    },
    interactions: {
      tout: comptable(interTout),
      organique: comptable(interOrganique),
      booste: comptable(interBooste),
    },
  };
}
