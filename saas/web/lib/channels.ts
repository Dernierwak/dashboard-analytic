import { createClient } from "@/lib/supabase/server";
import { aveuglesSur, fetchCanauxMuets, type CanalMuetLive, type CanalPub } from "@/lib/canaux-muets";
import { getCompteActif } from "@/lib/account";
import {
  addDays,
  fenetreSurMesure,
  fmtDay,
  inWin,
  iso,
  makeWindow,
  type Days,
  type Window,
} from "@/lib/fenetre-canal";

export type { Days } from "@/lib/fenetre-canal";

// Couche données des dashboards par canal — mêmes règles que le Streamlit :
// fenêtre de N jours PLEINS ancrée sur la dernière date de données (jamais
// aujourd'hui), delta vs la fenêtre précédente ; « Tout » = tout l'historique.
// Filtres statut / campagne appliqués AVANT les agrégats (KPIs, graphe
// et tables suivent le filtre, comme dans l'app actuelle).


export type DashParams = {
  d?: string;
  m?: string;       // métrique du graphe
  status?: string;  // filtre statut
  camp?: string;    // filtre campagne (key)
  from?: string;    // période custom : YYYY-MM-DD
  to?: string;
  s?: string;       // tri des tables (Instagram)
  cmp?: string;     // à quoi comparer : prev | yoy | custom
  cfrom?: string;   // plage de référence choisie : YYYY-MM-DD
  cto?: string;
  tri?: string;     // tri des tables comparables : "ecart" | absent (la période affichée)
};

export function periodDays(sp: DashParams | undefined): Days {
  if (sp?.d === "0") return 0;
  const d = Number(sp?.d);
  return d === 14 ? 14 : d === 30 ? 30 : d === 90 ? 90 : 7;
}

// LA FENÊTRE VIT DANS `lib/fenetre-canal.ts` (ticket 48) — arithmétique pure,
// donc vérifiable hors ligne, ce que ce fichier-ci ne sera jamais (il importe le
// client Supabase). `customWindow` reste exporté d'ici avec sa signature
// d'origine : tout ce qui construit un lien ou une période passe par ce nom.
export function customWindow(
  sp: DashParams | undefined,
  /** Le dernier jour lu par un canal MUET, ou `null` — voir `fenetreSurMesure`. */
  dernierJourLu: string | null = null
): Window | null {
  return fenetreSurMesure(sp?.from ?? "", sp?.to ?? "", dernierJourLu);
}

export function pct(cur: number, prev: number): number | null {
  return prev > 0 ? ((cur - prev) / prev) * 100 : null;
}

/** Un taux dont le dénominateur est nul n'existe pas : une campagne sans
 *  impression n'a pas un CTR de 0 %, elle n'a pas de CTR (`CLAUDE.md` §7,
 *  ticket meta-ads 22). */
export function taux(num: number, den: number, echelle = 1): number | null {
  return den > 0 ? (num / den) * echelle : null;
}

/** Trie du plus grand au plus petit, et range les valeurs absentes EN FIN : un
 *  taux sans dénominateur n'est ni le meilleur ni le pire, il n'a pas de rang
 *  (ticket meta-ads 25). */
export function trierDecroissant<T>(xs: T[], val: (x: T) => number | null): T[] {
  return [...xs].sort((a, b) => {
    const va = val(a), vb = val(b);
    if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1;
    return vb - va;
  });
}

/** La moyenne des seules valeurs mesurées. Aucune → `null`, jamais 0 : compter
 *  un taux absent comme un zéro tirerait la moyenne vers le bas. */
export function moyenneMesuree(xs: (number | null)[]): number | null {
  const m = xs.filter((x): x is number => x !== null);
  return m.length ? m.reduce((a, b) => a + b, 0) / m.length : null;
}

/** La variation d'un taux. Un taux absent d'un côté ou de l'autre ne se compare
 *  pas — même règle que `pct` pour une référence nulle. */
function pctTaux(cur: number | null, prev: number | null): number | null {
  return cur === null || prev === null ? null : pct(cur, prev);
}

// ── COMPARER LA PÉRIODE AFFICHÉE À UNE AUTRE ─────────────────────────────────
//
// Le module vit sur les trois canaux et pose partout la même question : « et
// avant, ça donnait quoi ? ». Quatre décisions le rendent honnête, et aucune
// n'est cosmétique — sans elles, un module de comparaison est une machine à
// fabriquer des variations spectaculaires.
//
// 1 · LES DEUX FENÊTRES S'ARRÊTENT AU DERNIER JOUR PLEIN. C'est la règle déjà
//     appliquée par `makeWindow` (ancre = hier, ou la dernière date de données
//     si elle est antérieure) et, depuis cette passe, par `customWindow`. Une
//     journée de fetch incomplète comptée dans la fenêtre courante fait plonger
//     toutes les variations d'un coup, et rien à l'écran ne le dirait.
//
// 2 · « L'AN DERNIER » RECULE DE 364 JOURS, PAS DE 365. Cinquante-deux semaines
//     pile : le lundi retombe sur un lundi. Sur de la publicité et du social, le
//     jour de la semaine pèse plus que la date — comparer un samedi à un
//     vendredi produit un écart qui ne dit rien d'autre que le décalage. Le prix
//     à payer est d'un jour de dérive dans le calendrier, et il est écrit.
//
// 3 · UNE RÉFÉRENCE DOIT ÊTRE ENTIÈREMENT MESURÉE. Elle doit tenir tout entière
//     entre la première et la dernière date relevées. Sinon on comparerait un
//     total complet à un total amputé de ses jours non récoltés — c'est la
//     fabrique du « −100 % » et du « +∞ % ». Quand elle déborde, on REFUSE, et
//     on dit par quel bout.
//
// 4 · UNE RÉFÉRENCE À ZÉRO N'EST PAS UNE RÉFÉRENCE. `pct()` rend `null` dès que
//     le dénominateur vaut 0 : l'affichage écrit alors le mot, jamais un
//     pourcentage. Un compte qui n'a rien dépensé la semaine d'avant n'a pas
//     fait « +∞ % », il n'a pas de point de comparaison.
//
// Ce que le module NE compare PAS, et pourquoi :
//   · pas de ROAS ni de revenu — GA4 rend le revenu au niveau du COMPTE, pas du
//     canal : un « revenu Meta » n'existe pas, donc sa variation non plus. Et la
//     ventilation par campagne dont on dispose côté revenu (`by_campaign`, GA4,
//     worker) n'est PAS DATÉE (docs/references/plateformes.md) : la découper par
//     période produirait un chiffre inventé.
//
// EN REVANCHE, LA DÉPENSE, LES CLICS ET LES IMPRESSIONS SONT DATÉS PAR CAMPAGNE.
// `meta_ads_insights` et `google_ads_insights` portent une ligne par campagne et
// par jour — c'est ce qui permet aux tables posées sous ce module de montrer le
// même écart, campagne par campagne, sans rien inventer. La
// limite de `by_campaign` porte sur le REVENU, pas sur les métriques de régie ;
// les confondre aurait interdit une comparaison que les données portent.

export type ModeCompare = "prev" | "yoy" | "custom";

export function modeCompare(sp: DashParams | undefined): ModeCompare {
  const m = sp?.cmp ?? "";
  return m === "yoy" ? "yoy" : m === "custom" ? "custom" : "prev";
}

export type FenetreCompare = {
  debut: string;
  fin: string;
  jours: number;
  /** « 4 aoû → 10 aoû 2026 » */
  label: string;
};

/** Une valeur brute par fenêtre. Les sommes ne sont PAS ramenées au jour ici :
 *  seul l'affichage sait ce qui s'additionne et ce qui est déjà un taux.
 *  `null` = un taux sans dénominateur dans cette fenêtre (voir `taux`) : il
 *  n'existait pas, il ne se compare donc pas à zéro (ticket meta-ads 24). */
export type MetriqueCompare = { cle: string; courant: number | null; reference: number | null };

/**
 * Un jour de la frise : les grandeurs qui S'ADDITIONNENT, brutes. Les taux
 * (CTR, CPC, engagement) ne sont PAS stockés — ils se dérivent des totaux du
 * jour à l'affichage, exactement comme partout ailleurs. Un CPC stocké par jour
 * puis re-moyenné donnerait au dimanche à trois clics le poids du mardi à
 * quatre cents.
 *
 * Les clés sont celles des métriques du canal (`spend`/`clicks`/… côté pub,
 * `reach`/`likes`/… côté Instagram) : un enregistrement plutôt qu'un type figé,
 * parce que les deux canaux ne mesurent pas les mêmes choses et qu'un type
 * commun forcerait chacun à porter les champs vides de l'autre.
 */
export type PointFrise = Record<string, number>;

/** Au-delà, une frise n'a plus de colonnes lisibles — même plafond que le
 *  graphe d'évolution, et pour la même raison. */
export const FRISE_MAX = 120;

/**
 * CE QUE LA FENÊTRE DE RÉFÉRENCE A PORTÉ, **LIGNE PAR LIGNE**.
 *
 * C'est ce qui permet aux tables posées SOUS le module « Comparer » (par
 * campagne, par publication) de montrer le même écart que lui sans refaire sa cuisine. Elles
 * ne recalculent ni la fenêtre de référence, ni les refus, ni le rognage du jour
 * en cours : `batirComparaison` les a déjà tranchés une fois, ici, et rend `null`
 * dès que la comparaison ne tient pas. Un second exemplaire de cette liste de
 * règles finirait par diverger — c'est exactement le défaut qui vient d'être
 * corrigé sur les constructeurs de liens.
 *
 * `reference` ne porte que les grandeurs qui S'ADDITIONNENT, brutes : les taux
 * (CTR, CPC, engagement) se dérivent des totaux à l'affichage, comme partout
 * ailleurs. Un CPC stocké par ligne puis re-moyenné donnerait à la campagne à
 * trois clics le poids de celle à quatre cents.
 */
export type VentilationCompare = {
  /** Les totaux de la fenêtre de RÉFÉRENCE, par clé de ligne. Une clé absente
   *  n'est pas une ligne à zéro : c'est une ligne qui n'a rien porté. */
  reference: Record<string, PointFrise>;
  /**
   * La PREMIÈRE date relevée pour chaque clé, sur tout l'historique chargé et
   * sous les MÊMES filtres. C'est elle qui distingue les deux absences que rien
   * ne séparait : une ligne NÉE après la référence (elle n'a pas d'écart, elle a
   * une naissance) et une ligne qui existait déjà mais s'est tue (là, l'absence
   * de mesure n'est pas une baisse de 100 %). Sans cette date, les deux
   * s'écriraient « nouveau » et l'une des deux mentirait.
   */
  premiere: Record<string, string>;
};

export type Comparaison = {
  mode: ModeCompare;
  courant: FenetreCompare;
  /** null quand la référence n'a pas pu être construite (dates invalides). */
  reference: FenetreCompare | null;
  /** Les deux fenêtres n'ont pas le même nombre de jours. */
  inegales: boolean;
  /** Ce qui interdit la comparaison, rédigé. `null` = on peut comparer. */
  refus: string | null;
  /** Combien de lignes (ou de publications) chaque fenêtre a réellement portées.
   *  Zéro ne se lit pas comme un zéro mesuré : c'est « rien à comparer ». */
  mesuresCourant: number;
  mesuresReference: number;
  metriques: MetriqueCompare[];
  /** LA FRISE — un point par jour, du plus ancien au plus récent, dans CHAQUE
   *  fenêtre. Les deux tableaux n'ont pas forcément la même longueur : c'est
   *  l'affichage qui les aligne, et il les aligne PAR LA FIN (le dernier jour de
   *  chaque fenêtre en face l'un de l'autre), jamais sur des dates réelles —
   *  deux périodes décalées superposées sur un axe de dates ne veulent rien
   *  dire. */
  friseCourant: PointFrise[];
  friseReference: PointFrise[];
  /** Une des deux frises a été coupée à `FRISE_MAX` jours. Les chiffres, eux,
   *  portent toujours sur la fenêtre entière — il faut donc le dire. */
  friseTronquee: boolean;
  /**
   * CE QUE LES TABLES DU DESSOUS LISENT, une entrée par table comparable
   * (`campagne`, `theme`). **`null` dès que la comparaison ne tient pas** —
   * refus, ou référence sans aucune ligne relevée : les modules du dessous n'ont
   * alors rien à tester de leur côté, la couche d'écart disparaît et la table
   * redevient exactement ce qu'elle était.
   */
  ventilations: Record<string, VentilationCompare> | null;
};

const ISO_JOUR = /^\d{4}-\d{2}-\d{2}$/;

function nbJours(since: Date, until: Date): number {
  return Math.round((until.getTime() - since.getTime()) / 86400_000) + 1;
}

function fenetre(since: Date, until: Date): FenetreCompare {
  return {
    debut: iso(since),
    fin: iso(until),
    jours: nbJours(since, until),
    label: `${fmtDay(since)} → ${fmtDay(until)} ${until.getUTCFullYear()}`,
  };
}

/** La fenêtre de référence, selon le mode. `null` = la saisie ne tient pas. */
function fenetreReference(
  w: Window,
  mode: ModeCompare,
  sp: DashParams | undefined
): { since: Date; until: Date } | null {
  if (mode === "yoy") {
    return { since: addDays(w.since, -364), until: addDays(w.until, -364) };
  }
  if (mode === "custom") {
    const f = sp?.cfrom ?? "";
    const t = sp?.cto ?? "";
    if (!ISO_JOUR.test(f) || !ISO_JOUR.test(t)) return null;
    const since = new Date(f + "T00:00:00Z");
    const demande = new Date(t + "T00:00:00Z");
    if (isNaN(since.getTime()) || isNaN(demande.getTime()) || since > demande) return null;
    // Même rognage que partout ailleurs : la référence non plus ne mange pas le
    // jour en cours.
    const hier = addDays(new Date(), -1);
    const until = iso(demande) > iso(hier) ? new Date(iso(hier) + "T00:00:00Z") : demande;
    if (since > until) return null;
    return { since, until };
  }
  // `prev` reprend EXACTEMENT la fenêtre qui sert déjà aux deltas des tuiles :
  // deux arithmétiques pour un même écart finissent toujours par diverger.
  return { since: w.prevSince, until: w.prevUntil };
}

/**
 * Découpe une fenêtre en jours pleins, du plus ancien au plus récent, en
 * appelant `jour` pour chacun. Les jours SANS ligne existent quand même : une
 * frise qui saute les jours vides raccourcit la période sans le dire, et deux
 * frises ainsi raccourcies ne s'alignent plus l'une sur l'autre.
 */
function frisePar(
  since: Date,
  until: Date,
  jour: (cle: string) => PointFrise
): { pts: PointFrise[]; tronquee: boolean } {
  const pts: PointFrise[] = [];
  for (let d = new Date(since); d <= until; d = addDays(d, 1)) pts.push(jour(iso(d)));
  return { pts: pts.slice(-FRISE_MAX), tronquee: pts.length > FRISE_MAX };
}

/**
 * Construit la comparaison. `sommes` agrège les lignes d'une fenêtre, `jour` en
 * agrège une journée et `ventiler` répartit la fenêtre de référence par ligne de
 * table — les trois seuls morceaux qui changent d'un canal à l'autre, et ils
 * restent chez l'appelant qui connaît ses lignes.
 *
 * `ventiler` n'est appelé QUE lorsque la comparaison tient : c'est ce qui rend
 * impossible qu'une table du dessous affiche un écart là où le module de
 * comparaison affiche un refus.
 */
function batirComparaison(
  w: Window,
  sp: DashParams | undefined,
  couverture: { debut: string | null; fin: string | null },
  sommes: (since: Date, until: Date) => { mesures: number; metriques: MetriqueCompare[] },
  jour: (cle: string) => PointFrise,
  ventiler: (since: Date, until: Date) => Record<string, VentilationCompare>
): Comparaison {
  const mode = modeCompare(sp);
  const cur = sommes(w.since, w.until);
  const courant = fenetre(w.since, w.until);
  const ref = fenetreReference(w, mode, sp);

  const vide = (refus: string): Comparaison => ({
    mode,
    courant,
    reference: ref ? fenetre(ref.since, ref.until) : null,
    inegales: false,
    refus,
    mesuresCourant: cur.mesures,
    mesuresReference: 0,
    metriques: [],
    friseCourant: [],
    friseReference: [],
    friseTronquee: false,
    ventilations: null,
  });

  if (!ref || ref.since > ref.until)
    return vide("Choisis une plage de référence (une date de début et une date de fin).");
  if (!couverture.debut || !couverture.fin)
    return vide("Aucune donnée n'a encore été relevée sur ce canal : il n'y a rien à comparer.");

  const r = fenetre(ref.since, ref.until);
  // UNE RÉFÉRENCE NE CHEVAUCHE PAS LA PÉRIODE AFFICHÉE. Les presets ne peuvent
  // pas produire ce cas, une plage choisie à la main si — et l'écart serait
  // alors calculé pour partie contre les mêmes journées : un chiffre comparé à
  // lui-même tire mécaniquement toute variation vers zéro, et personne ne
  // pourrait le voir à l'écran.
  if (r.debut <= courant.fin && r.fin >= courant.debut)
    return vide(
      `La plage de référence (${r.debut} → ${r.fin}) recouvre la période affichée ` +
        `(${courant.debut} → ${courant.fin}) : les journées communes seraient comparées à ` +
        `elles-mêmes, ce qui écrase l'écart sans que rien ne le montre. Choisis une plage ` +
        `qui s'arrête avant le ${courant.debut}.`
    );
  if (r.debut < couverture.debut)
    return vide(
      `La référence commence le ${r.debut} et tes données ne remontent qu'au ${couverture.debut} : ` +
        `une partie de cette fenêtre n'a jamais été mesurée, la comparer ferait passer un trou de récolte pour une baisse.`
    );
  if (r.fin > couverture.fin)
    return vide(
      `La référence va jusqu'au ${r.fin} et ta dernière donnée relevée date du ${couverture.fin} : ` +
        `les jours qui manquent compteraient comme des zéros.`
    );

  const rf = sommes(ref.since, ref.until);
  const fc = frisePar(w.since, w.until, jour);
  const fr = frisePar(ref.since, ref.until, jour);
  return {
    mode,
    courant,
    reference: r,
    inegales: r.jours !== courant.jours,
    refus: null,
    mesuresCourant: cur.mesures,
    mesuresReference: rf.mesures,
    metriques: cur.metriques.map((m, i) => ({
      cle: m.cle,
      courant: m.courant,
      reference: rf.metriques[i]?.courant ?? null,
    })),
    friseCourant: fc.pts,
    friseReference: fr.pts,
    friseTronquee: fc.tronquee || fr.tronquee,
    // Une référence SANS AUCUNE LIGNE n'est pas une référence à zéro : le module
    // de comparaison l'écrit en toutes lettres au lieu d'un pourcentage, et les
    // tables du dessous n'ont donc rien à poser non plus.
    ventilations: rf.mesures > 0 ? ventiler(ref.since, ref.until) : null,
  };
}

// ── Publicité (Meta / Google) ────────────────────────────────────────────────

export type AdRow = {
  name: string;
  spend: number;
  clicks: number;
  impressions: number;
  ctr: number | null;
  cpc: number | null;
};

export type AdsetRow = AdRow & { ads: AdRow[] };

export type Campaign = {
  key: string;   // campaign_id (seul Google lit encore cette couche ; Meta a `lib/meta/`)
  name: string;
  status: string | null;
  spend: number;
  clicks: number;
  impressions: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  adsets: AdsetRow[]; // groupes d'annonces → annonces
};

export type DayPoint = {
  date: string;
  label: string;
  spend: number;
  clicks: number;
  impressions: number;
};

export type ChannelDash = {
  email: string;
  /** LES PARAMÈTRES D'URL TELS QUELS. Ils voyagent avec le dashboard pour que
   *  tout constructeur de lien puisse repartir de l'état COMPLET (voir
   *  `lib/liens.ts`) : un lien bâti à partir de ce qu'il sait garder perd, en
   *  silence, tout réglage ajouté après lui. */
  params: DashParams;
  periodLabel: string;
  /** Les bornes exactes de la fenêtre affichée, en ISO. Le libellé est fait pour
   *  être lu, pas pour être découpé — un module qui doit dire sa fenêtre a
   *  besoin des dates elles-mêmes. */
  windowDebut: string;
  windowFin: string;
  days: Days;
  metric: string;
  /** Ce que la page filtre, tel que le bandeau doit le réafficher. */
  filters: { status: string; camp: string };
  statusOptions: string[];
  campOptions: { key: string; name: string }[];
  activeCampaigns: number;
  spend: number;
  spendDelta: number | null;
  clicks: number;
  clicksDelta: number | null;
  impressions: number;
  imprDelta: number | null;
  ctr: number | null;
  ctrDelta: number | null;
  cpc: number | null;
  cpcDelta: number | null;
  cpm: number | null;
  cpmDelta: number | null;
  /** Série journalière du graphe — PLAFONNÉE à 120 points (voir `maxPts`). */
  daily: DayPoint[];
  /** La même série, SANS plafond. Le graphe se contente des 120 derniers points
   *  parce qu'au-delà il ne se lit plus ; une MOYENNE, elle, ne peut pas se
   *  contenter d'un échantillon sans mentir sur ce qu'elle a moyenné. */
  dailyComplet: DayPoint[];
  campaigns: Campaign[];
  comparaison: Comparaison;
  /** LA RÉCOLTE DE CE CANAL A ÉCHOUÉ AU DERNIER PASSAGE (ticket 48), ou `null`
   *  si tout va bien.
   *
   *  Ce qu'il change ici n'est pas un calcul mais une EXPLICATION. Les chiffres
   *  de cette page sont déjà justes quand un canal est muet — la fenêtre
   *  s'ancre sur la dernière ligne écrite (`makeWindow`), la plage sur mesure
   *  s'y arrête aussi, et la comparaison refuse toute référence au-delà. Ce qui
   *  manquait, c'est de DIRE pourquoi la fenêtre s'est décalée : sans ça, le
   *  client relit sa semaine d'avant sous les dates d'aujourd'hui et la panne
   *  devient invisible pour tout le monde, lui comme nous (ADR 0005). */
  muet: CanalMuetLive | null;
};

type RawAd = {
  date: string;
  campaign: string; // clé de campagne
  adset: string;
  ad: string;
  spend: number;
  clicks: number;
  impressions: number;
};

type Cfg = Map<string, { name: string; status: string | null }>;

/** Ce qui change d'un canal à l'autre et qu'un tableau de bord ne calcule pas
 *  lui-même. Regroupé parce que `buildDash` en portait déjà sept, et qu'une
 *  fonction à huit paramètres positionnels s'appelle à l'aveugle. */
type Contexte = {
  cfg: Cfg;
  email: string;
  muet: CanalMuetLive | null;
};

function buildDash(
  rows: RawAd[],
  drillRows: RawAd[],
  days: Days,
  sp: DashParams | undefined,
  ctx: Contexte
): ChannelDash {
  const { cfg, email, muet } = ctx;
  const lastIso = rows[0]?.date ?? null;
  const firstIso = rows.length ? rows[rows.length - 1].date : null;
  const w = customWindow(sp, muet?.depuis ?? null) ?? makeWindow(lastIso, firstIso, days);

  // Options de filtre (avant filtrage — on liste tout ce qui existe)
  const statusSet = new Set<string>();
  const campSet = new Map<string, string>();
  for (const r of rows) {
    const c = cfg.get(r.campaign);
    if (c?.status) statusSet.add(c.status);
    campSet.set(r.campaign, c?.name || r.campaign);
  }

  const fStatus = sp?.status ?? "";
  const fCamp = sp?.camp ?? "";
  const keep = (campKey: string): boolean => {
    const c = cfg.get(campKey);
    if (fStatus && (c?.status ?? "") !== fStatus) return false;
    if (fCamp && campKey !== fCamp) return false;
    return true;
  };

  let spend = 0, clicks = 0, impressions = 0;
  let pSpend = 0, pClicks = 0, pImpr = 0;
  const byDay = new Map<string, { spend: number; clicks: number; impressions: number }>();
  const byCamp = new Map<string, { spend: number; clicks: number; impressions: number }>();

  for (const r of rows) {
    if (!keep(r.campaign)) continue;
    if (inWin(r.date, w.since, w.until)) {
      spend += r.spend; clicks += r.clicks; impressions += r.impressions;
      const dk = r.date.slice(0, 10);
      const dd = byDay.get(dk) ?? { spend: 0, clicks: 0, impressions: 0 };
      dd.spend += r.spend; dd.clicks += r.clicks; dd.impressions += r.impressions;
      byDay.set(dk, dd);
      const c = byCamp.get(r.campaign) ?? { spend: 0, clicks: 0, impressions: 0 };
      c.spend += r.spend; c.clicks += r.clicks; c.impressions += r.impressions;
      byCamp.set(r.campaign, c);
    } else if (inWin(r.date, w.prevSince, w.prevUntil)) {
      pSpend += r.spend; pClicks += r.clicks; pImpr += r.impressions;
    }
  }

  // Drill-down : campagne → adset/groupe → annonce (sur la fenêtre, filtré)
  const drill = new Map<string, Map<string, Map<string, { spend: number; clicks: number; impressions: number }>>>();
  for (const r of drillRows) {
    if (!keep(r.campaign) || !inWin(r.date, w.since, w.until)) continue;
    const setName = r.adset || "—";
    const adName = r.ad || "—";
    const sets = drill.get(r.campaign) ?? new Map();
    const ads = sets.get(setName) ?? new Map();
    const a = ads.get(adName) ?? { spend: 0, clicks: 0, impressions: 0 };
    a.spend += r.spend; a.clicks += r.clicks; a.impressions += r.impressions;
    ads.set(adName, a);
    sets.set(setName, ads);
    drill.set(r.campaign, sets);
  }
  const finish = (x: { spend: number; clicks: number; impressions: number }) => ({
    ctr: taux(x.clicks, x.impressions, 100),
    cpc: taux(x.spend, x.clicks),
  });

  // Série journalière complète (jours vides inclus). `daily` sert le GRAPHE et
  // reste bornée à 120 points : au-delà, les colonnes font moins de 6 px et la
  // courbe ne se lit plus. `dailyComplet` couvre toute la fenêtre et sert les
  // MOYENNES — une moyenne qui n'annonce pas qu'elle a été calculée sur un
  // échantillon est un chiffre faux.
  const dailyComplet: DayPoint[] = [];
  for (let d = new Date(w.since); d <= w.until; d = addDays(d, 1)) {
    const k = iso(d);
    const v = byDay.get(k) ?? { spend: 0, clicks: 0, impressions: 0 };
    dailyComplet.push({ date: k, label: fmtDay(d), spend: v.spend, clicks: v.clicks, impressions: v.impressions });
  }
  const maxPts = 120;
  const daily: DayPoint[] = dailyComplet.slice(-maxPts);

  const campaigns: Campaign[] = [...byCamp.entries()]
    .map(([key, c]) => {
      const conf = cfg.get(key);
      const adsets: AdsetRow[] = [...(drill.get(key) ?? new Map()).entries()]
        .map(([setName, adsMap]) => {
          const ads: AdRow[] = [...(adsMap as Map<string, { spend: number; clicks: number; impressions: number }>).entries()]
            .map(([adName, a]) => ({ name: adName, ...a, ...finish(a) }))
            .sort((a, b) => b.spend - a.spend);
          const tot = ads.reduce(
            (acc, a) => ({ spend: acc.spend + a.spend, clicks: acc.clicks + a.clicks, impressions: acc.impressions + a.impressions }),
            { spend: 0, clicks: 0, impressions: 0 }
          );
          return { name: setName, ...tot, ...finish(tot), ads };
        })
        .sort((a, b) => b.spend - a.spend);
      return {
        key,
        name: conf?.name || key,
        status: conf?.status ?? null,
        spend: c.spend,
        clicks: c.clicks,
        impressions: c.impressions,
        ...finish(c),
        cpm: taux(c.spend, c.impressions, 1000),
        adsets,
      };
    })
    .sort((a, b) => b.spend - a.spend);

  const { ctr, cpc } = finish({ spend, clicks, impressions });
  const cpm = taux(spend, impressions, 1000);
  const prec = finish({ spend: pSpend, clicks: pClicks, impressions: pImpr });
  const pCpm = taux(pSpend, pImpr, 1000);

  const METRICS = ["spend", "clicks", "impressions", "ctr", "cpc"];
  const metric = METRICS.includes(sp?.m ?? "") ? (sp!.m as string) : "spend";

  // La comparaison relit les LIGNES BRUTES, jamais `daily` : `daily` est
  // plafonnée et déjà repliée par jour, deux raccourcis qu'une comparaison ne
  // supporte pas. Les mêmes filtres s'appliquent (`keep`) — comparer deux
  // périodes sur deux périmètres différents serait le pire des deux mondes.
  const comparaison = batirComparaison(
    w,
    sp,
    { debut: firstIso ? firstIso.slice(0, 10) : null, fin: lastIso ? lastIso.slice(0, 10) : null },
    (since, until) => {
      let s = 0, c = 0, i = 0, n = 0;
      for (const r of rows) {
        if (!keep(r.campaign) || !inWin(r.date, since, until)) continue;
        s += r.spend; c += r.clicks; i += r.impressions; n += 1;
      }
      return {
        mesures: n,
        metriques: [
          { cle: "spend", courant: s, reference: 0 },
          { cle: "clicks", courant: c, reference: 0 },
          { cle: "impressions", courant: i, reference: 0 },
          { cle: "ctr", courant: taux(c, i, 100), reference: null },
          { cle: "cpc", courant: taux(s, c), reference: null },
        ],
      };
    },
    // La frise réutilise `byDay`… non : `byDay` ne couvre que la fenêtre
    // AFFICHÉE, et la référence est ailleurs. Un second repli par jour, sur les
    // mêmes lignes filtrées, est le seul moyen de tenir les deux fenêtres sur le
    // même périmètre.
    (() => {
      const parJour = new Map<string, PointFrise>();
      for (const r of rows) {
        if (!keep(r.campaign)) continue;
        const k = r.date.slice(0, 10);
        const p = parJour.get(k) ?? { spend: 0, clicks: 0, impressions: 0 };
        p.spend += r.spend; p.clicks += r.clicks; p.impressions += r.impressions;
        parJour.set(k, p);
      }
      // Un jour sans campagne est un jour à ZÉRO, pas un jour absent : c'est ce
      // qui distingue « tu dépenses peu » de « tu dépenses sur peu de jours ».
      return (cle: string) => parJour.get(cle) ?? { spend: 0, clicks: 0, impressions: 0 };
    })(),
    // LA VENTILATION — ce que la référence a porté PAR CAMPAGNE.
    //
    // Une seule passe sur les lignes DÉJÀ CHARGÉES : aucune requête de plus, la
    // seconde fenêtre ne coûte donc pas un aller-retour de base mais un parcours
    // en mémoire. Le plafond reste celui du `.limit(12000)` du chargement, et il
    // n'est pas contourné en silence — une référence antérieure à la plus vieille
    // ligne chargée tombe sur le refus « tes données ne remontent qu'au … ».
    (since, until) => {
      const campagne: VentilationCompare = { reference: {}, premiere: {} };
      const vide = () => ({ spend: 0, clicks: 0, impressions: 0 });
      for (const r of rows) {
        if (!keep(r.campaign)) continue;
        const j = r.date.slice(0, 10);
        // La première date se prend sur TOUT l'historique chargé, pas sur la
        // fenêtre : c'est une naissance qu'on cherche, pas une présence.
        if (!campagne.premiere[r.campaign] || j < campagne.premiere[r.campaign])
          campagne.premiere[r.campaign] = j;
        if (!inWin(r.date, since, until)) continue;
        const c = campagne.reference[r.campaign] ?? vide();
        c.spend += r.spend; c.clicks += r.clicks; c.impressions += r.impressions;
        campagne.reference[r.campaign] = c;
      }
      return { campagne };
    }
  );

  return {
    email,
    params: sp ?? {},
    periodLabel: w.label,
    windowDebut: iso(w.since),
    windowFin: iso(w.until),
    days,
    metric,
    filters: { status: fStatus, camp: fCamp },
    statusOptions: [...statusSet].sort(),
    campOptions: [...campSet.entries()].map(([key, name]) => ({ key, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    activeCampaigns: campaigns.length,
    spend,
    spendDelta: pct(spend, pSpend),
    clicks,
    clicksDelta: pct(clicks, pClicks),
    impressions,
    imprDelta: pct(impressions, pImpr),
    ctr,
    ctrDelta: pctTaux(ctr, prec.ctr),
    cpc,
    cpcDelta: pctTaux(cpc, prec.cpc),
    cpm,
    cpmDelta: pctTaux(cpm, pCpm),
    daily,
    dailyComplet,
    campaigns,
    comparaison,
    muet,
  };
}

export async function getGoogleDash(sp: DashParams | undefined): Promise<ChannelDash> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const uid = compte.uid;
  const days = periodDays(sp);

  const [rowsRes, adsRes, cfgRes, muets] = await Promise.all([
    supabase.from("google_ads_insights")
      .select("date_start, campaign_id, cost_micros, clicks, impressions")
      .eq("user_id", uid).order("date_start", { ascending: false }).limit(12000),
    supabase.from("google_ads_ad_insights")
      .select("date_start, campaign_id, ad_group_name, ad_name, cost_micros, clicks, impressions")
      .eq("user_id", uid).order("date_start", { ascending: false }).limit(12000),
    // "*" : tolérant au schéma — une colonne absente d'une base en retard ne
    // doit pas faire tomber la lecture entière.
    supabase.from("google_campaign_config")
      .select("*").eq("user_id", uid),
    fetchCanauxMuets(supabase, uid),
  ]);

  const rows: RawAd[] = (rowsRes.data ?? []).map((r) => ({
    date: String(r.date_start),
    campaign: String(r.campaign_id),
    adset: "",
    ad: "",
    spend: (Number(r.cost_micros) || 0) / 1_000_000,
    clicks: Number(r.clicks) || 0,
    impressions: Number(r.impressions) || 0,
  }));
  // Drill google : groupes d'annonces → annonces (table dédiée)
  const drillRows: RawAd[] = (adsRes.data ?? []).map((r) => ({
    date: String(r.date_start),
    campaign: String(r.campaign_id),
    adset: String(r.ad_group_name ?? ""),
    ad: String(r.ad_name ?? ""),
    spend: (Number(r.cost_micros) || 0) / 1_000_000,
    clicks: Number(r.clicks) || 0,
    impressions: Number(r.impressions) || 0,
  }));
  const cfg: Cfg = new Map(
    (cfgRes.data ?? []).map((c) => [
      String(c.campaign_id),
      {
        name: (c.campaign_name as string) || `Campagne ${c.campaign_id}`,
        status: (c.effective_status as string | null) ?? null,
      },
    ])
  );

  return buildDash(rows, drillRows, days, sp, {
    cfg,
    email: compte.email,
    muet: muetDu(muets, "google"),
  });
}

/** Le trou de CE canal-ci, parmi ceux du compte, et seulement s'il tait
 *  vraiment quelque chose.
 *
 *  Une page canal ne parle que d'une régie : celle de l'autre ne la concerne
 *  pas, et l'afficher ici enverrait le client reconnecter ce qui fonctionne.
 *  Un canal tombé APRÈS avoir écrit jusqu'à hier ne raccourcit aucune fenêtre
 *  non plus — il est en panne, il sera signalé sur le rapport, mais il n'a rien
 *  à expliquer ici. Une alarme qui s'allume sans rien cacher s'use. */
function muetDu(muets: CanalMuetLive[], canal: CanalPub): CanalMuetLive | null {
  const hier = iso(addDays(new Date(), -1));
  return aveuglesSur(muets, hier).find((m) => m.canal === canal) ?? null;
}

// ── Instagram organique ───────────────────────────────────────────────────────

export type InstaPost = {
  id: string;        // uuid de la ligne (édition du thème)
  date: string;      // ISO
  type: string;
  caption: string;
  mediaUrl: string;
  reach: number;
  views: number;
  likes: number;
  comments: number;
  saved: number;
  /** % — `null` quand la portée n'est pas relevée : voir `taux`. */
  eng: number | null;
};

export type FollowerPoint = { date: string; followers: number };

export type InstaDash = {
  email: string;
  /** LES PARAMÈTRES D'URL TELS QUELS. Ils voyagent avec le dashboard pour que
   *  tout constructeur de lien puisse repartir de l'état COMPLET (voir
   *  `lib/liens.ts`) : un lien bâti à partir de ce qu'il sait garder perd, en
   *  silence, tout réglage ajouté après lui. */
  params: DashParams;
  periodLabel: string;
  /** Bornes exactes de la fenêtre affichée — voir `ChannelDash`. */
  windowDebut: string;
  windowFin: string;
  days: Days;
  // Périmètre réellement utilisé pour le top 3 :
  // « periode » sauf si la fenêtre compte moins de 2 posts.
  scope: "periode" | "historique";
  followers: number;
  followersDelta: number | null;
  growth30: number | null;
  avgEng: number | null;
  histReach: number;
  // `avgLikes` / `avgComments` / `avgSaved` / `avgViews` vivaient ici pour le
  // module « Tes moyennes par post · tout l'historique », supprimé de la page :
  // il doublait « Tes moyennes ». Le calcul part avec lui — un chiffre qu'on
  // continue de produire sans l'afficher se remet à diverger en silence, et
  // ressort un jour dans un module qui le croit à jour. `histReach` et `avgEng`
  // restent : ils servent le seuil « au-dessus de ton post moyen » et la tuile
  // « Engagement du compte », deux lectures d'HISTORIQUE assumées.
  followersSeries: FollowerPoint[];
  // `formats`, `heatmap` et `bestSlot` VIVAIENT ICI, ET ILS SONT MORTS LE
  // 2026-09-12 : ils répondaient en TypeScript, sur la fenêtre affichée, à une
  // question qu'un autre moteur traitait sur TOUT l'historique avec ses propres
  // seuils — deux réponses possibles le même lundi. Cet autre moteur est parti
  // avec les recommandations le 2026-09-21 : plus personne ne répond à « quel
  // format marche », et c'est assumé.
  topPosts: InstaPost[];   // top 3 de la fenêtre (fallback : historique)
  topMetric: string;       // métrique qui pilote le top 3
  posts: InstaPost[];
  allPosts: InstaPost[];
  postsEng: number | null;
  postsReach: number | null;
  comparaison: Comparaison;
};

const FORMAT_LABEL: Record<string, string> = {
  VIDEO: "Reel",
  REEL: "Reel",
  CAROUSEL_ALBUM: "Carrousel",
  IMAGE: "Image",
};

export async function getInstaDash(sp: DashParams | undefined): Promise<InstaDash> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const uid = compte.uid;
  const days = periodDays(sp);

  const [postsRes, followsRes] = await Promise.all([
    // "*" : tolérant au schéma — une colonne absente d'une base en retard ne
    // doit pas faire tomber la lecture entière.
    supabase.from("instagram_organic_posts")
      .select("*")
      // Pas de plafond : « Tout l'historique » doit dire la vérité. À 600 posts
      // on en cachait plus de la moitié sans le signaler nulle part.
      .eq("user_id", uid).order("date", { ascending: false }).limit(5000),
    supabase.from("followers_history")
      .select("fetched_at, followers")
      .eq("user_id", uid).order("fetched_at", { ascending: false }).limit(90),
  ]);
  const all: InstaPost[] = (postsRes.data ?? []).map((p) => {
    const reach = Number(p.reach) || 0;
    const likes = Number(p.likes) || 0;
    const comments = Number(p.comments) || 0;
    const saved = Number(p.saved) || 0;
    return {
      id: String(p.id ?? ""),
      date: String(p.date ?? ""),
      type: FORMAT_LABEL[String(p.type ?? "")] ?? String(p.type ?? ""),
      caption: String(p.caption ?? ""),
      mediaUrl: String(p.media_url ?? ""),
      reach,
      views: Number(p.views) || 0,
      likes, comments, saved,
      eng: taux(likes + comments + saved, reach, 100),
    };
  });
  const follows = followsRes.data ?? [];

  const w = customWindow(sp) ?? makeWindow(all[0]?.date ?? null, all.length ? all[all.length - 1].date : null, days);

  const posts = all.filter((p) => inWin(p.date, w.since, w.until));

  const followers = follows.length ? Number(follows[0].followers) || 0 : 0;
  let followersDelta: number | null = null;
  const dRef = days === 0 ? follows.length - 1 : days;
  if (follows.length > dRef && dRef > 0) followersDelta = followers - (Number(follows[dRef].followers) || 0);
  else if (follows.length >= 7) followersDelta = followers - (Number(follows[6].followers) || 0);

  let growth30: number | null = null;
  if (follows.length >= 2) {
    const target = new Date(String(follows[0].fetched_at)).getTime() - 30 * 86400_000;
    let best: { diff: number; val: number } | null = null;
    for (const f of follows.slice(1)) {
      const diff = Math.abs(new Date(String(f.fetched_at)).getTime() - target);
      if (!best || diff < best.diff) best = { diff, val: Number(f.followers) || 0 };
    }
    if (best) growth30 = followers - best.val;
  }

  const followersSeries: FollowerPoint[] = follows
    .slice(0, 30)
    .map((f) => ({ date: String(f.fetched_at).slice(0, 10), followers: Number(f.followers) || 0 }))
    .reverse();

  // La métrique choisie en haut de page pilote le top 3. Filtrer sur les vues et voir ensuite des classements
  // par portée, c'est répondre à côté de la question.
  const _METRICS = ["reach", "views", "likes", "comments", "saved", "eng"] as const;
  const topMetric = (_METRICS as readonly string[]).includes(String(sp?.m ?? ""))
    ? String(sp!.m)
    : "reach";
  const _mval = (p: InstaPost): number | null =>
    topMetric === "views" ? p.views
    : topMetric === "likes" ? p.likes
    : topMetric === "comments" ? p.comments
    : topMetric === "saved" ? p.saved
    : topMetric === "eng" ? p.eng
    : p.reach;

  // LA PÉRIODE PILOTE AUSSI LE TOP 3. Une seule réserve : sous 2 posts
  // dans la fenêtre, aucune moyenne ne veut rien dire, alors on retombe sur
  // l'historique — et on le DIT, au lieu de laisser croire au contraire.
  const pool = posts.length >= 2 ? posts : all;
  const scope: "periode" | "historique" = posts.length >= 2 ? "periode" : "historique";

  // Top 3 posts de la période filtrée (fallback historique, même signal).
  const topPosts = trierDecroissant(pool, _mval).slice(0, 3);

  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  // La couverture d'Instagram, ce sont les dates de PUBLICATION : avant la
  // première, le compte n'a rien produit qu'on puisse comparer. `all` est trié
  // du plus récent au plus ancien.
  const dernierPost = all[0]?.date ?? null;
  const premierPost = all.length ? all[all.length - 1].date : null;
  const comparaison = batirComparaison(
    w,
    sp,
    {
      debut: premierPost ? String(premierPost).slice(0, 10) : null,
      // La fenêtre courante s'arrête au dernier jour PLEIN, qui est souvent
      // postérieur au dernier post : borner la couverture sur la dernière
      // publication ferait refuser une comparaison parfaitement mesurée.
      fin: iso(w.until) > (dernierPost ? String(dernierPost).slice(0, 10) : "")
        ? iso(w.until)
        : String(dernierPost).slice(0, 10),
    },
    (since, until) => {
      const ps = all.filter((p) => inWin(p.date, since, until));
      const som = (f: (p: InstaPost) => number) => ps.reduce((a, p) => a + f(p), 0);
      const portee = som((p) => p.reach);
      return {
        mesures: ps.length,
        metriques: [
          { cle: "posts", courant: ps.length, reference: 0 },
          { cle: "reach", courant: portee, reference: 0 },
          { cle: "views", courant: som((p) => p.views), reference: 0 },
          { cle: "likes", courant: som((p) => p.likes), reference: 0 },
          { cle: "comments", courant: som((p) => p.comments), reference: 0 },
          { cle: "saved", courant: som((p) => p.saved), reference: 0 },
          // Le taux se calcule sur les TOTAUX de la fenêtre : moyenner les
          // engagements post par post donnerait le même poids à une story vue
          // par 40 personnes et à un reel vu par 12 000.
          {
            cle: "eng",
            courant: taux(som((p) => p.likes + p.comments + p.saved), portee, 100),
            reference: null,
          },
        ],
      };
    },
    (() => {
      const parJour = new Map<string, PointFrise>();
      for (const p of all) {
        const k = String(p.date).slice(0, 10);
        const x = parJour.get(k) ?? { posts: 0, reach: 0, views: 0, likes: 0, comments: 0, saved: 0 };
        x.posts += 1; x.reach += p.reach; x.views += p.views;
        x.likes += p.likes; x.comments += p.comments; x.saved += p.saved;
        parJour.set(k, x);
      }
      // Un jour sans publication vaut zéro sur ce qui s'additionne — on n'a rien
      // touché ce jour-là — et RIEN sur l'engagement : un taux sans portée n'est
      // pas 0 %, il est indéfini. La frise le montre en interrompant son trait
      // plutôt qu'en le posant sur l'axe.
      return (cle: string) =>
        parJour.get(cle) ?? { posts: 0, reach: 0, views: 0, likes: 0, comments: 0, saved: 0 };
    })(),
    // PAS DE VENTILATION ICI : une publication n'existe que dans la période où
    // elle a été publiée, donc une table de POSTS n'a pas d'écart à montrer —
    // elle n'aurait que des naissances.
    () => ({})
  );

  return {
    email: compte.email,
    params: sp ?? {},
    periodLabel: w.label,
    windowDebut: iso(w.since),
    windowFin: iso(w.until),
    days,
    scope,
    followers,
    followersDelta,
    growth30,
    avgEng: moyenneMesuree(all.map((p) => p.eng)),
    histReach: mean(all.map((p) => p.reach)),
    followersSeries,
    topPosts,
    topMetric,
    posts,
    allPosts: all,
    postsEng: moyenneMesuree(posts.map((p) => p.eng)),
    postsReach: posts.length ? mean(posts.map((p) => p.reach)) : null,
    comparaison,
  };
}

// ── Le catalogue des événements GA4 (page /conversions) ─────────────────────
//
// Ce que la propriété GA4 émet (`profiles.ga4_event_catalog`, rempli par la
// récolte) et si une propriété est choisie. Le choix des événements PAR THÈME
// (`theme_ga4_events`) est parti avec le thème.

export type EvenementCatalogue = {
  nom: string;
  /** Occurrences sur les 90 derniers jours, telles que la récolte les a vues. */
  volume: number;
  /**
   * `true` si GA4 a déclaré cet événement comme ÉVÉNEMENT CLÉ (key event).
   * `null` quand l'API d'administration n'a pas pu être interrogée — auquel cas
   * l'écran n'affiche aucune marque, plutôt que d'afficher « pas clé » pour une
   * question qu'on n'a pas posée.
   */
  cle: boolean | null;
};

export type CatalogueGa4 = {
  /** Une propriété GA4 est-elle choisie sur ce compte ? */
  ga4Connecte: boolean;
  catalogue: EvenementCatalogue[];
  /**
   * La migration n'a pas été jouée : `profiles.ga4_event_catalog` n'existe pas.
   * À NE PAS confondre avec « jamais récolté » — c'est la confusion qui a coûté
   * le plus cher ici : l'écran envoyait relancer une récolte qui ne pouvait
   * rien écrire, indéfiniment.
   */
  migrationManquante: boolean;
};

export async function getCatalogueGa4(): Promise<CatalogueGa4> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const uid = compte.uid;

  const [profRes, connRes] = await Promise.all([
    supabase.from("profiles").select("ga4_event_catalog").eq("id", uid).limit(1),
    supabase.from("connected_accounts").select("ga4_property_id").eq("user_id", uid),
  ]);

  // PGRST204 / PGRST205 : PostgREST refuse AVANT d'atteindre Postgres (colonne
  // ou table absente du cache de schéma). 42703 : `undefined_column` remonté
  // par Postgres lui-même. Les trois disent la même chose — la migration n'est
  // pas passée — et aucun n'est une panne : c'est une installation inachevée.
  const migrationManquante = ["PGRST204", "PGRST205", "42703"].includes(profRes.error?.code ?? "");

  // Le catalogue est un cache écrit par la récolte : on le lit défensivement.
  const brut = ((profRes.data?.[0] as { ga4_event_catalog?: unknown } | undefined)
    ?.ga4_event_catalog ?? {}) as {
    evenements?: { nom?: string; volume?: number; cle?: boolean | null }[];
  };
  const catalogue: EvenementCatalogue[] = (brut.evenements ?? [])
    .filter((e) => typeof e?.nom === "string" && e.nom.trim() !== "")
    .map((e) => ({
      nom: String(e.nom),
      volume: Number(e.volume ?? 0),
      cle: e.cle === true ? true : e.cle === false ? false : null,
    }));

  return {
    ga4Connecte: (connRes.data ?? []).some((l) => Boolean(l.ga4_property_id)),
    catalogue,
    migrationManquante,
  };
}

// ── Les catégories de conversions (page /conversions) ───────────────────────
//
// LA CATÉGORIE EST UNE PROPRIÉTÉ DE L'ÉVÉNEMENT : `purchase` veut dire la même
// chose partout. C'est ce qui permet au camembert de /conversions de compter
// « mes conversions par catégorie » sur tout le compte — voir l'en-tête de
// `conversion_categories.sql`.

export type ConversionCategoryRow = {
  name: string;
  /** Combien d'événements du catalogue portent cette catégorie. */
  evenements: number;
};

export type ConversionCategoriesData = {
  categories: ConversionCategoryRow[];
  /** { nom d'événement → catégorie }, uniquement les événements catégorisés. */
  parEvenement: Record<string, string>;
  peutEditer: boolean;
  /** `conversion_categories` ou `ga4_event_categories` absente. */
  migrationManquante: boolean;
};

export async function getConversionCategories(): Promise<ConversionCategoriesData> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const uid = compte.uid;

  const [catRes, mapRes] = await Promise.all([
    supabase.from("conversion_categories").select("name").eq("user_id", uid),
    supabase.from("ga4_event_categories").select("event_name, category").eq("user_id", uid),
  ]);

  const codeSchema = (e: { code?: string } | null | undefined) =>
    ["PGRST204", "PGRST205", "42703"].includes(e?.code ?? "");
  const migrationManquante = codeSchema(catRes.error) || codeSchema(mapRes.error);

  const parEvenement: Record<string, string> = {};
  const compteParCat = new Map<string, number>();
  for (const r of mapRes.data ?? []) {
    const nom = String(r.event_name ?? "");
    const cat = String(r.category ?? "");
    if (!nom || !cat) continue;
    parEvenement[nom] = cat;
    compteParCat.set(cat, (compteParCat.get(cat) ?? 0) + 1);
  }

  const noms = (catRes.data ?? []).map((r) => String(r.name ?? "")).filter(Boolean);
  const categories: ConversionCategoryRow[] = noms
    .map((name) => ({ name, evenements: compteParCat.get(name) ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return {
    categories,
    parEvenement,
    peutEditer: compte.peutEditer,
    migrationManquante,
  };
}
