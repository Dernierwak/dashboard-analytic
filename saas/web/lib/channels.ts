import { createClient } from "@/lib/supabase/server";
import { getCompteActif } from "@/lib/account";

// Couche données des dashboards par canal — mêmes règles que le Streamlit :
// fenêtre de N jours PLEINS ancrée sur la dernière date de données (jamais
// aujourd'hui), delta vs la fenêtre précédente ; « Tout » = tout l'historique.
// Filtres statut / campagne / thème appliqués AVANT les agrégats (KPIs, graphe
// et tables suivent le filtre, comme dans l'app actuelle).

const MOIS_FR = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}
function fmtDay(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MOIS_FR[d.getUTCMonth()]}`;
}

export type Days = 7 | 14 | 30 | 90 | 0; // 0 = tout l'historique

export type DashParams = {
  d?: string;
  m?: string;       // métrique du graphe
  status?: string;  // filtre statut
  camp?: string;    // filtre campagne (key)
  label?: string;   // filtre thème
  from?: string;    // période custom : YYYY-MM-DD
  to?: string;
  s?: string;       // tri des tables (Instagram)
  cmp?: string;     // à quoi comparer : prev | yoy | custom
  cfrom?: string;   // plage de référence choisie : YYYY-MM-DD
  cto?: string;
};

export function periodDays(sp: DashParams | undefined): Days {
  if (sp?.d === "0") return 0;
  const d = Number(sp?.d);
  return d === 14 ? 14 : d === 30 ? 30 : d === 90 ? 90 : 7;
}

type Window = { since: Date; until: Date; prevSince: Date; prevUntil: Date; label: string };

function makeWindow(lastDataIso: string | null, firstDataIso: string | null, days: Days): Window {
  const yesterday = addDays(new Date(), -1);
  let anchor = yesterday;
  if (lastDataIso) {
    const d = new Date(lastDataIso.slice(0, 10) + "T00:00:00Z");
    if (!isNaN(d.getTime()) && d < yesterday) anchor = d;
  }
  if (days === 0) {
    let first = addDays(anchor, -365);
    if (firstDataIso) {
      const f = new Date(firstDataIso.slice(0, 10) + "T00:00:00Z");
      if (!isNaN(f.getTime())) first = f;
    }
    // pas de période précédente comparable → deltas null
    return {
      since: first,
      until: anchor,
      prevSince: addDays(first, -1),
      prevUntil: addDays(first, -2),
      label: `Tout l'historique · ${fmtDay(first)} ${first.getUTCFullYear()} → ${fmtDay(anchor)} ${anchor.getUTCFullYear()}`,
    };
  }
  const since = addDays(anchor, -(days - 1));
  const prevUntil = addDays(since, -1);
  const prevSince = addDays(prevUntil, -(days - 1));
  return {
    since,
    until: anchor,
    prevSince,
    prevUntil,
    label: `${fmtDay(since)} → ${fmtDay(anchor)} ${anchor.getUTCFullYear()} · ${days} jours pleins`,
  };
}

// Période custom « du … au … » : fenêtre libre, comparée à la fenêtre de même
// durée juste avant (même règle de delta que les presets).
//
// ELLE S'ARRÊTE AU DERNIER JOUR PLEIN, comme les presets. `makeWindow` ancre sur
// `yesterday` depuis toujours ; la période sur mesure, elle, prenait la date
// tapée telle quelle. Un client qui choisissait « du 1er au 17 août » le 17 août
// comparait donc dix-sept jours dont un incomplet à dix-sept jours pleins — la
// règle de la maison (« toute comparaison exclut le jour en cours ») tombait
// exactement là où l'utilisateur avait choisi ses bornes lui-même. Le rognage
// est ÉCRIT dans le libellé : une fenêtre qu'on raccourcit sans le dire est pire
// qu'une fenêtre fausse.
export function customWindow(sp: DashParams | undefined): Window | null {
  const f = sp?.from ?? "";
  const t = sp?.to ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const since = new Date(f + "T00:00:00Z");
  const demande = new Date(t + "T00:00:00Z");
  if (isNaN(since.getTime()) || isNaN(demande.getTime()) || since > demande) return null;
  const hier = addDays(new Date(), -1);
  const rogne = iso(demande) > iso(hier);
  const until = rogne ? new Date(iso(hier) + "T00:00:00Z") : demande;
  if (since > until) return null;
  const len = Math.round((until.getTime() - since.getTime()) / 86400_000) + 1;
  const prevUntil = addDays(since, -1);
  const prevSince = addDays(prevUntil, -(len - 1));
  return {
    since,
    until,
    prevSince,
    prevUntil,
    label:
      `du ${fmtDay(since)} ${since.getUTCFullYear()} au ${fmtDay(until)} ${until.getUTCFullYear()} · ${len} jours` +
      (rogne ? " · jour en cours exclu" : ""),
  };
}

const inWin = (dateStr: string, since: Date, until: Date) => {
  const d = String(dateStr).slice(0, 10);
  return d >= iso(since) && d <= iso(until);
};

export function pct(cur: number, prev: number): number | null {
  return prev > 0 ? ((cur - prev) / prev) * 100 : null;
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
//   · pas de comparaison PAR CAMPAGNE dans le temps — la ventilation par
//     campagne dont on dispose côté revenu (`by_campaign`, GA4, worker) n'est
//     pas datée ; la découper par période produirait un chiffre inventé ;
//   · pas de ROAS ni de revenu — GA4 rend le revenu au niveau du COMPTE, pas du
//     canal : un « revenu Meta » n'existe pas, donc sa variation non plus.

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
 *  seul l'affichage sait ce qui s'additionne et ce qui est déjà un taux. */
export type MetriqueCompare = { cle: string; courant: number; reference: number };

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
 * Construit la comparaison. `sommes` agrège les lignes d'une fenêtre et `jour`
 * en agrège une journée — les deux seuls morceaux qui changent d'un canal à
 * l'autre, et ils restent chez l'appelant qui connaît ses lignes.
 */
function batirComparaison(
  w: Window,
  sp: DashParams | undefined,
  couverture: { debut: string | null; fin: string | null },
  sommes: (since: Date, until: Date) => { mesures: number; metriques: MetriqueCompare[] },
  jour: (cle: string) => PointFrise
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
      reference: rf.metriques[i]?.courant ?? 0,
    })),
    friseCourant: fc.pts,
    friseReference: fr.pts,
    friseTronquee: fc.tronquee || fr.tronquee,
  };
}

// ── Publicité (Meta / Google) ────────────────────────────────────────────────

export type AdRow = {
  name: string;
  spend: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cpc: number;
};

export type AdsetRow = AdRow & { ads: AdRow[] };

export type Campaign = {
  key: string;   // meta : campaign_name · google : campaign_id
  name: string;
  label: string | null;
  labelSource: string | null; // 'user' | 'ai' — pastille IA sur les thèmes proposés
  status: string | null;
  spend: number;
  clicks: number;
  impressions: number;
  reach: number;
  ctr: number;
  cpc: number;
  cpm: number;
  adsets: AdsetRow[]; // Meta : adsets → ads · Google : groupes d'annonces → annonces
};

export type DayPoint = {
  date: string;
  label: string;
  spend: number;
  clicks: number;
  impressions: number;
};

export type LabelAgg = {
  label: string;
  spend: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cpc: number;
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
  filters: { status: string; camp: string; label: string };
  statusOptions: string[];
  campOptions: { key: string; name: string }[];
  activeCampaigns: number;
  spend: number;
  spendDelta: number | null;
  clicks: number;
  clicksDelta: number | null;
  impressions: number;
  imprDelta: number | null;
  reach: number;      // 0 si non suivi (Google)
  reachDelta: number | null;
  ctr: number;
  ctrDelta: number | null;
  cpc: number;
  cpcDelta: number | null;
  cpm: number;
  cpmDelta: number | null;
  /** Série journalière du graphe — PLAFONNÉE à 120 points (voir `maxPts`). */
  daily: DayPoint[];
  /** La même série, SANS plafond. Le graphe se contente des 120 derniers points
   *  parce qu'au-delà il ne se lit plus ; une MOYENNE, elle, ne peut pas se
   *  contenter d'un échantillon sans mentir sur ce qu'elle a moyenné. */
  dailyComplet: DayPoint[];
  campaigns: Campaign[];
  byLabel: LabelAgg[];
  labels: string[];
  comparaison: Comparaison;
};

type RawAd = {
  date: string;
  campaign: string; // clé de campagne
  adset: string;
  ad: string;
  spend: number;
  clicks: number;
  impressions: number;
  reach: number;
};

type Cfg = Map<string, { name: string; label: string | null; labelSource: string | null; status: string | null }>;

function buildDash(
  rows: RawAd[],
  drillRows: RawAd[],
  days: Days,
  sp: DashParams | undefined,
  cfg: Cfg,
  labels: string[],
  email: string
): ChannelDash {
  const lastIso = rows[0]?.date ?? null;
  const firstIso = rows.length ? rows[rows.length - 1].date : null;
  const w = customWindow(sp) ?? makeWindow(lastIso, firstIso, days);

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
  const fLabel = sp?.label ?? "";
  const keep = (campKey: string): boolean => {
    const c = cfg.get(campKey);
    if (fStatus && (c?.status ?? "") !== fStatus) return false;
    if (fCamp && campKey !== fCamp) return false;
    if (fLabel && (c?.label ?? "") !== fLabel) return false;
    return true;
  };

  let spend = 0, clicks = 0, impressions = 0, reach = 0;
  let pSpend = 0, pClicks = 0, pImpr = 0, pReach = 0;
  const byDay = new Map<string, { spend: number; clicks: number; impressions: number }>();
  const byCamp = new Map<string, { spend: number; clicks: number; impressions: number; reach: number }>();

  for (const r of rows) {
    if (!keep(r.campaign)) continue;
    if (inWin(r.date, w.since, w.until)) {
      spend += r.spend; clicks += r.clicks; impressions += r.impressions; reach += r.reach;
      const dk = r.date.slice(0, 10);
      const dd = byDay.get(dk) ?? { spend: 0, clicks: 0, impressions: 0 };
      dd.spend += r.spend; dd.clicks += r.clicks; dd.impressions += r.impressions;
      byDay.set(dk, dd);
      const c = byCamp.get(r.campaign) ?? { spend: 0, clicks: 0, impressions: 0, reach: 0 };
      c.spend += r.spend; c.clicks += r.clicks; c.impressions += r.impressions; c.reach += r.reach;
      byCamp.set(r.campaign, c);
    } else if (inWin(r.date, w.prevSince, w.prevUntil)) {
      pSpend += r.spend; pClicks += r.clicks; pImpr += r.impressions; pReach += r.reach;
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
    ctr: x.impressions > 0 ? (x.clicks / x.impressions) * 100 : 0,
    cpc: x.clicks > 0 ? x.spend / x.clicks : 0,
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
        label: conf?.label ?? null,
        labelSource: conf?.labelSource ?? null,
        status: conf?.status ?? null,
        spend: c.spend,
        clicks: c.clicks,
        impressions: c.impressions,
        reach: c.reach,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
        cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
        cpm: c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0,
        adsets,
      };
    })
    .sort((a, b) => b.spend - a.spend);

  const lblAgg = new Map<string, { spend: number; clicks: number; impressions: number }>();
  for (const c of campaigns) {
    if (!c.label) continue;
    const a = lblAgg.get(c.label) ?? { spend: 0, clicks: 0, impressions: 0 };
    a.spend += c.spend; a.clicks += c.clicks; a.impressions += c.impressions;
    lblAgg.set(c.label, a);
  }
  const byLabel: LabelAgg[] = [...lblAgg.entries()]
    .map(([label, a]) => ({ label, ...a, ...finish(a) }))
    .sort((a, b) => b.spend - a.spend);

  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cpc = clicks > 0 ? spend / clicks : 0;
  const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
  const pCtr = pImpr > 0 ? (pClicks / pImpr) * 100 : 0;
  const pCpc = pClicks > 0 ? pSpend / pClicks : 0;
  const pCpm = pImpr > 0 ? (pSpend / pImpr) * 1000 : 0;

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
          { cle: "ctr", courant: i > 0 ? (c / i) * 100 : 0, reference: 0 },
          { cle: "cpc", courant: c > 0 ? s / c : 0, reference: 0 },
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
    })()
  );

  return {
    email,
    params: sp ?? {},
    periodLabel: w.label,
    windowDebut: iso(w.since),
    windowFin: iso(w.until),
    days,
    metric,
    filters: { status: fStatus, camp: fCamp, label: fLabel },
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
    reach,
    reachDelta: pct(reach, pReach),
    ctr,
    ctrDelta: pct(ctr, pCtr),
    cpc,
    cpcDelta: pct(cpc, pCpc),
    cpm,
    cpmDelta: pct(cpm, pCpm),
    daily,
    dailyComplet,
    campaigns,
    byLabel,
    labels,
    comparaison,
  };
}

export async function getMetaDash(sp: DashParams | undefined): Promise<ChannelDash> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const uid = compte.uid;
  const days = periodDays(sp);

  const [rowsRes, cfgRes, labelsRes] = await Promise.all([
    supabase.from("meta_ads_insights")
      .select("date_start, campaign_name, adset_name, ad_name, spend, clicks, impressions, reach")
      .eq("user_id", uid).order("date_start", { ascending: false }).limit(12000),
    // "*" : tolérant au schéma (label_source peut ne pas encore exister en base)
    supabase.from("meta_campaign_config")
      .select("*").eq("user_id", uid),
    supabase.from("profiles").select("labels").eq("id", uid).limit(1),
  ]);

  const rows: RawAd[] = (rowsRes.data ?? []).map((r) => ({
    date: String(r.date_start),
    campaign: String(r.campaign_name ?? ""),
    adset: String(r.adset_name ?? ""),
    ad: String(r.ad_name ?? ""),
    spend: Number(r.spend) || 0,
    clicks: Number(r.clicks) || 0,
    impressions: Number(r.impressions) || 0,
    reach: Number(r.reach) || 0,
  }));
  const cfg: Cfg = new Map(
    (cfgRes.data ?? []).map((c) => [
      String(c.campaign_name),
      {
        name: String(c.campaign_name),
        label: (c.label as string | null) ?? null,
        labelSource: (c.label_source as string | null) ?? null,
        status: (c.effective_status as string | null) ?? null,
      },
    ])
  );
  const labels = ((labelsRes.data?.[0]?.labels as string[] | null) ?? []);

  // Meta : les lignes sont déjà au niveau annonce → mêmes lignes pour le drill.
  return buildDash(rows, rows, days, sp, cfg, labels, compte.email);
}

export async function getGoogleDash(sp: DashParams | undefined): Promise<ChannelDash> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const uid = compte.uid;
  const days = periodDays(sp);

  const [rowsRes, adsRes, cfgRes, labelsRes] = await Promise.all([
    supabase.from("google_ads_insights")
      .select("date_start, campaign_id, cost_micros, clicks, impressions")
      .eq("user_id", uid).order("date_start", { ascending: false }).limit(12000),
    supabase.from("google_ads_ad_insights")
      .select("date_start, campaign_id, ad_group_name, ad_name, cost_micros, clicks, impressions")
      .eq("user_id", uid).order("date_start", { ascending: false }).limit(12000),
    // "*" : tolérant au schéma (label_source peut ne pas encore exister en base)
    supabase.from("google_campaign_config")
      .select("*").eq("user_id", uid),
    supabase.from("profiles").select("labels").eq("id", uid).limit(1),
  ]);

  const rows: RawAd[] = (rowsRes.data ?? []).map((r) => ({
    date: String(r.date_start),
    campaign: String(r.campaign_id),
    adset: "",
    ad: "",
    spend: (Number(r.cost_micros) || 0) / 1_000_000,
    clicks: Number(r.clicks) || 0,
    impressions: Number(r.impressions) || 0,
    reach: 0,
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
    reach: 0,
  }));
  const cfg: Cfg = new Map(
    (cfgRes.data ?? []).map((c) => [
      String(c.campaign_id),
      {
        name: (c.campaign_name as string) || `Campagne ${c.campaign_id}`,
        label: (c.label as string | null) ?? null,
        labelSource: (c.label_source as string | null) ?? null,
        status: (c.effective_status as string | null) ?? null,
      },
    ])
  );
  const labels = ((labelsRes.data?.[0]?.labels as string[] | null) ?? []);

  return buildDash(rows, drillRows, days, sp, cfg, labels, compte.email);
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
  eng: number;       // %
  labels: string[];
  labelSource: string | null; // 'user' | 'ai' — pastille IA sur les thèmes proposés
};

// avgReach = moyenne de la MÉTRIQUE CHOISIE (pas forcément la portée).
export type FormatStat = { type: string; count: number; avgReach: number; avgEng: number };
export type FollowerPoint = { date: string; followers: number };
export type SlotCell = { count: number; avgReach: number };
export type PostLabelAgg = {
  label: string;
  count: number;
  avgReach: number;   // moyenne de la MÉTRIQUE PILOTE (tri de la table)
  avgEng: number;
  // Toutes les moyennes par post, pour la table complète.
  mReach: number; mViews: number; mLikes: number; mComments: number; mSaved: number;
};

export const INSTA_DAYS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
export const INSTA_SLOTS = ["0-7h", "7-10h", "10-13h", "13-16h", "16-19h", "19-24h"];

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
  labels: string[]; // liste maîtresse (assignation de thème par post)
  // Périmètre réellement utilisé pour formats / créneaux / top 3 / thèmes :
  // « periode » sauf si la fenêtre compte moins de 2 posts.
  scope: "periode" | "historique";
  followers: number;
  followersDelta: number | null;
  growth30: number | null;
  avgEng: number;
  histReach: number;
  // `avgLikes` / `avgComments` / `avgSaved` / `avgViews` vivaient ici pour le
  // module « Tes moyennes par post · tout l'historique », supprimé de la page :
  // il doublait « Tes moyennes ». Le calcul part avec lui — un chiffre qu'on
  // continue de produire sans l'afficher se remet à diverger en silence, et
  // ressort un jour dans un module qui le croit à jour. `histReach` et `avgEng`
  // restent : ils servent le seuil « au-dessus de ton post moyen » et la tuile
  // « Engagement du compte », deux lectures d'HISTORIQUE assumées.
  followersSeries: FollowerPoint[];
  formats: FormatStat[];
  heatmap: SlotCell[][];   // [jour 0-6][créneau 0-5] — sur la période retenue
  bestSlot: { day: number; slot: number; avgReach: number; count: number } | null;
  topPosts: InstaPost[];   // top 3 de la fenêtre (fallback : historique)
  topMetric: string;       // métrique qui pilote formats, heatmap, top 3 et thèmes
  byLabel: PostLabelAgg[];
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

  const [postsRes, followsRes, labelsRes] = await Promise.all([
    // "*" : tolérant au schéma (label_source peut ne pas encore exister en base)
    supabase.from("instagram_organic_posts")
      .select("*")
      // Pas de plafond : « Tout l'historique » doit dire la vérité. À 600 posts
      // on en cachait plus de la moitié sans le signaler nulle part.
      .eq("user_id", uid).order("date", { ascending: false }).limit(5000),
    supabase.from("followers_history")
      .select("fetched_at, followers")
      .eq("user_id", uid).order("fetched_at", { ascending: false }).limit(90),
    supabase.from("profiles").select("labels").eq("id", uid).limit(1),
  ]);
  const masterLabels = ((labelsRes.data?.[0]?.labels as string[] | null) ?? []);
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
      eng: reach > 0 ? ((likes + comments + saved) / reach) * 100 : 0,
      labels: ((p.labels as string[] | null) ?? []),
      labelSource: ((p as Record<string, unknown>).label_source as string | null) ?? null,
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

  // La métrique choisie en haut de page pilote TOUTE la page : formats,
  // heatmap, top 3 et performance par thème. Filtrer sur les vues et voir
  // ensuite des classements par portée, c'est répondre à côté de la question.
  const _METRICS = ["reach", "views", "likes", "comments", "saved", "eng"] as const;
  const topMetric = (_METRICS as readonly string[]).includes(String(sp?.m ?? ""))
    ? String(sp!.m)
    : "reach";
  const _mval = (p: InstaPost): number =>
    topMetric === "views" ? p.views
    : topMetric === "likes" ? p.likes
    : topMetric === "comments" ? p.comments
    : topMetric === "saved" ? p.saved
    : topMetric === "eng" ? p.eng
    : p.reach;

  // LA PÉRIODE PILOTE AUSSI TOUTE LA PAGE. C'est le pendant de la règle
  // ci-dessus, et il manquait : les formats et la performance par thème se
  // calculaient sur tout l'historique, si bien que changer la période ne
  // bougeait rien à l'écran — le filtre avait l'air cassé parce qu'il l'était.
  // Une seule réserve, déjà appliquée à la carte des créneaux : sous 2 posts
  // dans la fenêtre, aucune moyenne ne veut rien dire, alors on retombe sur
  // l'historique — et on le DIT, au lieu de laisser croire au contraire.
  const pool = posts.length >= 2 ? posts : all;
  const scope: "periode" | "historique" = posts.length >= 2 ? "periode" : "historique";

  const fmtMap = new Map<string, { count: number; reach: number; eng: number }>();
  for (const p of pool) {
    const f = fmtMap.get(p.type) ?? { count: 0, reach: 0, eng: 0 };
    f.count += 1; f.reach += _mval(p); f.eng += p.eng;
    fmtMap.set(p.type, f);
  }
  const formats: FormatStat[] = [...fmtMap.entries()]
    .map(([type, f]) => ({
      type,
      count: f.count,
      avgReach: f.count ? f.reach / f.count : 0,
      avgEng: f.count ? f.eng / f.count : 0,
    }))
    .sort((a, b) => b.avgReach - a.avgReach);

  const heatPool = pool;
  const slotOf = (h: number) => (h < 7 ? 0 : h < 10 ? 1 : h < 13 ? 2 : h < 16 ? 3 : h < 19 ? 4 : 5);
  const acc: { count: number; reach: number }[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 6 }, () => ({ count: 0, reach: 0 }))
  );
  for (const p of heatPool) {
    const d = new Date(p.date);
    if (isNaN(d.getTime())) continue;
    const day = (d.getDay() + 6) % 7; // lundi = 0
    const slot = slotOf(d.getHours());
    acc[day][slot].count += 1;
    acc[day][slot].reach += _mval(p);
  }
  const heatmap: SlotCell[][] = acc.map((row) =>
    row.map((c) => ({ count: c.count, avgReach: c.count ? c.reach / c.count : 0 }))
  );
  let bestSlot: InstaDash["bestSlot"] = null;
  for (let day = 0; day < 7; day++)
    for (let slot = 0; slot < 6; slot++) {
      const c = heatmap[day][slot];
      if (c.count >= 2 && (!bestSlot || c.avgReach > bestSlot.avgReach))
        bestSlot = { day, slot, avgReach: c.avgReach, count: c.count };
    }

  // Top 3 posts de la période filtrée (fallback historique, même signal).
  const topPosts = [...heatPool].sort((a, b) => _mval(b) - _mval(a)).slice(0, 3);

  // Performance par thème, sur la période retenue — TOUTES les métriques,
  // triées sur celle qui pilote la page.
  const lblMap = new Map<string, {
    count: number; pilote: number; eng: number;
    reach: number; views: number; likes: number; comments: number; saved: number;
  }>();
  for (const p of pool)
    for (const l of p.labels) {
      const x = lblMap.get(l) ?? {
        count: 0, pilote: 0, eng: 0, reach: 0, views: 0, likes: 0, comments: 0, saved: 0,
      };
      x.count += 1; x.pilote += _mval(p); x.eng += p.eng;
      x.reach += p.reach; x.views += p.views; x.likes += p.likes;
      x.comments += p.comments; x.saved += p.saved;
      lblMap.set(l, x);
    }
  const byLabel: PostLabelAgg[] = [...lblMap.entries()]
    .map(([label, x]) => ({
      label,
      count: x.count,
      avgReach: x.count ? x.pilote / x.count : 0,
      avgEng: x.count ? x.eng / x.count : 0,
      mReach: x.count ? x.reach / x.count : 0,
      mViews: x.count ? x.views / x.count : 0,
      mLikes: x.count ? x.likes / x.count : 0,
      mComments: x.count ? x.comments / x.count : 0,
      mSaved: x.count ? x.saved / x.count : 0,
    }))
    .sort((a, b) => b.avgReach - a.avgReach);

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
            courant: portee > 0 ? (som((p) => p.likes + p.comments + p.saved) / portee) * 100 : 0,
            reference: 0,
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
    })()
  );

  return {
    email: compte.email,
    params: sp ?? {},
    periodLabel: w.label,
    windowDebut: iso(w.since),
    windowFin: iso(w.until),
    days,
    labels: masterLabels,
    scope,
    followers,
    followersDelta,
    growth30,
    avgEng: mean(all.map((p) => p.eng)),
    histReach: mean(all.map((p) => p.reach)),
    followersSeries,
    formats,
    heatmap,
    bestSlot,
    topPosts,
    topMetric,
    byLabel,
    posts,
    allPosts: all,
    postsEng: posts.length ? mean(posts.map((p) => p.eng)) : null,
    postsReach: posts.length ? mean(posts.map((p) => p.reach)) : null,
    comparaison,
  };
}

// ── Labels (liste + compteurs d'usage) ───────────────────────────────────────

export type LabelRowData = { name: string; meta: number; google: number; instagram: number };

export async function getLabelsData(): Promise<{
  email: string;
  rows: LabelRowData[];
  /**
   * TOUS les thèmes étoilés (insight_feedback priority_label:*), DU PLUS ANCIEN
   * ÉTOILAGE AU PLUS RÉCENT. Il y avait un `.slice(0, 3)` ici : il coupait la
   * liste à l'affichage pendant que le worker en coupait une autre de son côté,
   * si bien qu'une quatrième étoile était posée en base, invisible sur la page
   * qui l'avait posée, et absente du rapport.
   *
   * L'ORDRE EST CHARGÉ DE SENS et ne doit pas être retrié : les trois premiers
   * de cette liste sont exactement les thèmes dont l'IA rédige les pistes (voir
   * `_THEMES_IA` dans `saas/worker/build_report.py`). Un `sort()` ailleurs
   * ferait mentir les rangs affichés sur la page Thèmes.
   */
  priorities: string[];
}> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const uid = compte.uid;

  const [labelsRes, metaRes, googleRes, instaRes, prioRes] = await Promise.all([
    supabase.from("profiles").select("labels").eq("id", uid).limit(1),
    supabase.from("meta_campaign_config").select("label").eq("user_id", uid),
    supabase.from("google_campaign_config").select("label").eq("user_id", uid),
    supabase.from("instagram_organic_posts").select("labels").eq("user_id", uid),
    supabase.from("insight_feedback").select("insight_key, created_at")
      .eq("user_id", uid).like("insight_key", "priority_label:%")
      .order("created_at", { ascending: true }),
  ]);
  const priorities = (prioRes.data ?? [])
    .map((r) => String(r.insight_key).split(":").slice(1).join(":"))
    .filter(Boolean);
  const master = ((labelsRes.data?.[0]?.labels as string[] | null) ?? []);
  const counts = new Map<string, LabelRowData>();
  const bump = (name: string | null, ch: "meta" | "google" | "instagram") => {
    if (!name) return;
    const row = counts.get(name) ?? { name, meta: 0, google: 0, instagram: 0 };
    row[ch] += 1;
    counts.set(name, row);
  };
  for (const r of metaRes.data ?? []) bump(r.label, "meta");
  for (const r of googleRes.data ?? []) bump(r.label, "google");
  for (const r of instaRes.data ?? [])
    for (const l of (r.labels as string[] | null) ?? []) bump(l, "instagram");

  const rows: LabelRowData[] = master.map(
    (name) => counts.get(name) ?? { name, meta: 0, google: 0, instagram: 0 }
  );
  for (const [name, row] of counts) if (!master.includes(name)) rows.push(row);

  return { email: compte.email, rows, priorities };
}
