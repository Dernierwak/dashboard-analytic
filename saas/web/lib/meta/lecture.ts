// ── LA LECTURE META : DES LIGNES DE BASE AU CONTENU DES MODULES ─────────────
//
// Spec `.scratch/meta-ads/spec.md`, § « La lecture des données côté web ». Ce
// fichier est le seam testé de la page Meta (harnais :
// `.scratch/meta-ads/harnais/06-la-page-meta-neuve/`) : tout ce qui transforme
// des lignes en chiffres affichés vit ici, en fonctions pures.
//
// AUCUNE DIRECTIVE ET AUCUN IMPORT, et les deux sont voulus. Sans directive,
// les valeurs exportées se lisent des deux côtés (`CLAUDE.md` §8 : une
// constante d'un module `"use client"` arrive en proxy côté serveur). Sans
// import, Node charge le fichier tel quel et le harnais tourne sans Next, sans
// Supabase et sans lanceur de tests ajouté au projet.
//
// Les règles que ce module tient, chacune testée :
//   · le jour en cours n'entre dans aucun chiffre (`CLAUDE.md` §7) ;
//   · un ratio est recalculé total ÷ total sur la sélection — jamais moyenné,
//     jamais lu dans la base — comme Ads Manager le fait ;
//   · une absence n'est pas un zéro : pas de ligne → `null` → « — » ; un jour
//     sans ligne est un trou dans la courbe ;
//   · un diviseur nul rend `null`, donc aucun écart « +∞ % » ;
//   · une campagne est son ID Meta. Son nom est le plus récent lu ; une ligne
//     sans ID (d'avant le rejeu, ticket 03) n'est jamais rattachée par son nom
//     à une campagne qui en a un.

export type LigneMeta = {
  date: string; // YYYY-MM-DD
  campagneId: string | null;
  campagneNom: string;
  groupeId: string | null;
  groupeNom: string;
  annonceId: string | null;
  annonceNom: string;
  depense: number;
  impressions: number;
  /** « Clics (tous) » d'Ads Manager — le champ `clicks`, pas `link_clicks`. */
  clics: number;
};

// ── La lecture paginée ───────────────────────────────────────────────────────

/** PostgREST plafonne une réponse à 1 000 lignes et tronque EN SILENCE
 *  (`CLAUDE.md` §8). Même patron que `lib/couts.ts` et `lib/changements-api.ts`,
 *  avec l'erreur LEVÉE : le client PostgREST ne jette jamais, et une colonne
 *  absente se lirait sinon comme une table vide — donc des « — » partout sans
 *  cause. */
export const TAILLE_PAGE = 1000;

export async function lireToutesLesPages<T>(
  page: (de: number, a: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += TAILLE_PAGE) {
    const { data, error } = await page(de, de + TAILLE_PAGE - 1);
    if (error) throw error;
    const morceau = data ?? [];
    out.push(...morceau);
    if (morceau.length < TAILLE_PAGE) return out;
  }
}

// ── Les dates, en ISO et en UTC ──────────────────────────────────────────────

const JOUR_MS = 86_400_000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function versMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}
export function decaler(iso: string, jours: number): string {
  return new Date(versMs(iso) + jours * JOUR_MS).toISOString().slice(0, 10);
}
function ecartJours(de: string, a: string): number {
  return Math.round((versMs(a) - versMs(de)) / JOUR_MS);
}
function dateLisible(x: string | undefined): x is string {
  return !!x && ISO.test(x) && !isNaN(versMs(x));
}

// ── Les commandes : ce que l'URL porte ───────────────────────────────────────

export type Vue = "notoriete" | "trafic";
export const VUE_PAR_DEFAUT: Vue = "notoriete";

export type Commandes = {
  vue?: string;
  /** L'ID Meta de la campagne, ou la clé d'une campagne sans ID. */
  campagne?: string;
  from?: string;
  to?: string;
};

export type Contexte = {
  /** Le jour en cours, en UTC — exclu de tout. */
  aujourdhui: string;
  /** Le dernier Jour de travail passé (`dernierJourDeTravail`). */
  dernierJourDeTravail: string;
  /** Le dernier jour ÉCRIT par une récolte Meta en échec (`lib/canaux-muets.ts`),
   *  absent quand la récolte a réussi. Seul un échec déclaré borne la période :
   *  une campagne simplement arrêtée a des jours sans ligne, et ils restent
   *  des trous dans une période qui ne recule pas (ADR 0005). */
  dernierJourLu?: string | null;
};

export type Periode = {
  debut: string;
  fin: string;
  avantDebut: string;
  avantFin: string;
  jours: number;
  /** La semaine mesurée, faute d'une période choisie lisible. */
  parDefaut: boolean;
  /** La période choisie touchait le jour en cours : elle s'arrête la veille. */
  rognee: boolean;
  /** La récolte a échoué : la période s'arrête au dernier jour lu au lieu de
   *  compter comme vides des jours que personne n'a lus. */
  arreteeAuDernierJourLu: boolean;
};

/**
 * La période lue et celle d'avant, de même durée.
 *
 * Par défaut, la SEMAINE MESURÉE — les sept jours pleins avant le dernier Jour
 * de travail (spec, Notes, choix 2 ; `CONTEXT.md`, **Jour de travail**) : c'est
 * la Fenêtre que tout le reste de Pulse lit. Pas de période « Tout » : elle n'a
 * pas de période d'avant à comparer.
 */
export function periodeDe(c: Commandes, ctx: Contexte): Periode {
  const hier = decaler(ctx.aujourdhui, -1);
  let debut: string;
  let fin: string;
  let parDefaut = false;
  let rognee = false;
  if (dateLisible(c.from) && dateLisible(c.to) && c.from <= c.to && c.from <= hier) {
    debut = c.from;
    fin = c.to;
    if (fin > hier) {
      fin = hier;
      rognee = true;
    }
  } else {
    fin = decaler(ctx.dernierJourDeTravail, -1);
    debut = decaler(fin, -6);
    parDefaut = true;
  }
  const borne = ctx.dernierJourLu ?? null;
  const arreteeAuDernierJourLu = borne !== null && fin > borne;
  if (arreteeAuDernierJourLu) {
    // La semaine mesurée recule entière : sept jours restent sept jours. Une
    // période choisie garde son premier jour, et se rabat sur la borne si elle
    // tombe tout entière après — jamais jetée en silence pour une autre.
    if (parDefaut) debut = decaler(borne, -6);
    else if (debut > borne) debut = borne;
    fin = borne;
  }
  return {
    debut,
    fin,
    ...periodeAvant(debut, fin),
    parDefaut,
    rognee,
    arreteeAuDernierJourLu,
  };
}

/** La durée d'une période et la période d'avant, de même durée, qui finit la
 *  veille de son premier jour (spec, user story 9). */
export function periodeAvant(debut: string, fin: string): { jours: number; avantDebut: string; avantFin: string } {
  const jours = ecartJours(debut, fin) + 1;
  const avantFin = decaler(debut, -1);
  return { jours, avantDebut: decaler(avantFin, -(jours - 1)), avantFin };
}

// ── Les raccourcis de période ────────────────────────────────────────────────

/** Spec, user story 8 : de 7 jours à 12 semaines. */
export const RACCOURCIS: { jours: number; nom: string }[] = [
  { jours: 7, nom: "7 derniers jours" },
  { jours: 14, nom: "14 derniers jours" },
  { jours: 28, nom: "4 dernières semaines" },
  { jours: 56, nom: "8 dernières semaines" },
  { jours: 84, nom: "12 dernières semaines" },
];

export type Raccourci = {
  jours: number;
  nom: string;
  /** Ce que le lien écrit — toujours des dates, même pour « 7 derniers
   *  jours » qui égale la semaine mesurée : sans elles, le lien partagé
   *  rouvrirait la semaine mesurée du jour où on l'ouvre (revue du ticket 07). */
  from: string;
  to: string;
  actif: boolean;
};

/**
 * Les raccourcis finissent là où finit la semaine mesurée — la veille du
 * dernier Jour de travail, ou le dernier jour lu si la récolte a échoué — et
 * non la veille d'aujourd'hui : la récolte ne passe qu'au Jour de travail, les
 * jours suivants n'ont encore aucune ligne, et « 4 dernières semaines »
 * compterait des trous.
 *
 * Ils s'écrivent en dates, pas en « 28 j » : un lien partagé rouvre la période
 * qu'on a vue, pas une autre qui aurait glissé depuis (user story 11).
 */
export function raccourcisDe(periode: Periode, ctx: Contexte): Raccourci[] {
  const defaut = periodeDe({}, ctx);
  return RACCOURCIS.map(({ jours, nom }) => ({
    jours,
    nom,
    from: decaler(defaut.fin, -(jours - 1)),
    to: defaut.fin,
    actif: periode.fin === defaut.fin && periode.jours === jours,
  }));
}

/** Deux jours cliqués dans le calendrier, dans n'importe quel ordre :
 *  `periodeDe` retomberait sur la semaine mesurée si `from` dépassait `to`. */
export function periodeEntre(a: string, b: string): { from: string; to: string } {
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

// ── Le calendrier ────────────────────────────────────────────────────────────

const MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export type MoisCalendrier = {
  /** « 2026-09 » */
  cle: string;
  /** « septembre 2026 » */
  nom: string;
  /** Lundi en tête ; `null` pour les cases d'avant le 1er. */
  cases: (string | null)[];
};

/** `cle` : « AAAA-MM ». En UTC, comme toutes les dates de ce module. */
export function moisCalendrier(cle: string): MoisCalendrier {
  const [annee, mois] = cle.split("-").map(Number);
  const premier = Date.UTC(annee, mois - 1, 1);
  const n = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
  const vides = (new Date(premier).getUTCDay() + 6) % 7;
  const cases: (string | null)[] = Array(vides).fill(null);
  for (let j = 0; j < n; j++) cases.push(new Date(premier + j * JOUR_MS).toISOString().slice(0, 10));
  return { cle, nom: `${MOIS_LONGS[mois - 1]} ${annee}`, cases };
}

export function moisVoisin(cle: string, delta: number): string {
  const [annee, mois] = cle.split("-").map(Number);
  return new Date(Date.UTC(annee, mois - 1 + delta, 1)).toISOString().slice(0, 7);
}

// ── Les campagnes, par leur ID ───────────────────────────────────────────────

const PREFIXE_SANS_ID = "sans-id:";

/** Une ligne sans ID garde son propre nom comme clé, PRÉFIXÉ : elle ne peut
 *  donc jamais tomber sur la clé d'une campagne qui a un ID, même homonyme. */
export function cleCampagne(l: LigneMeta): string {
  return l.campagneId ?? `${PREFIXE_SANS_ID}${l.campagneNom}`;
}

/** La palette des pastilles de campagne : celle du prototype validé (ticket
 *  05), repassée au validateur `dataviz` sur fond blanc dans cet ordre (CVD
 *  ΔE ≥ 9,1 entre voisins). Trois teintes sont sous 3:1 de contraste : le nom
 *  est donc toujours écrit à côté de la pastille, jamais la couleur seule. */
export const PALETTE_CAMPAGNES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
/** Au-delà de huit campagnes : un gris neutre. Une teinte réutilisée ferait
 *  passer deux campagnes pour une seule ; une teinte générée ne passerait pas
 *  le validateur. */
export const PASTILLE_NEUTRE = "#c3c2bb";

export type Campagne = {
  cle: string;
  nom: string;
  /** Une ligne d'avant le rejeu des IDs (ticket 03) : regroupée par son nom,
   *  à part des campagnes identifiées. */
  sansId: boolean;
  /** La dépense de la PÉRIODE lue. `null` = aucune ligne sur la période (la
   *  campagne n'a tourné qu'avant) : rien de mesuré, pas « 0 CHF ». */
  depense: number | null;
  /** La couleur suit la campagne, jamais son rang : elle est donnée dans
   *  l'ordre des clés (l'ID Meta), pas dans celui de la dépense — un menu
   *  reclassé ne repeint rien, et choisir une campagne ne repeint pas les
   *  autres. Elle peut changer d'une période à l'autre si l'ensemble des
   *  campagnes présentes change. */
  couleur: string;
};

/** Les campagnes présentes, la plus dépensière sur `courante` d'abord, chacune
 *  sous le nom porté par sa ligne la plus récente. Sans `courante`, la
 *  dépense est celle de toutes les lignes reçues. */
export function campagnesDe(lignes: LigneMeta[], courante?: { debut: string; fin: string }): Campagne[] {
  const compte = (l: LigneMeta) => !courante || (l.date >= courante.debut && l.date <= courante.fin);
  const parCle = new Map<string, Omit<Campagne, "couleur"> & { dateNom: string }>();
  for (const l of lignes) {
    const cle = cleCampagne(l);
    let c = parCle.get(cle);
    if (!c) {
      c = { cle, nom: l.campagneNom, sansId: l.campagneId === null, depense: null, dateNom: l.date };
      parCle.set(cle, c);
    }
    if (compte(l)) c.depense = (c.depense ?? 0) + l.depense;
    if (l.date > c.dateNom) {
      c.nom = l.campagneNom;
      c.dateNom = l.date;
    }
  }
  const couleurs = new Map(
    [...parCle.keys()].sort().map((cle, i) => [cle, PALETTE_CAMPAGNES[i] ?? PASTILLE_NEUTRE])
  );
  return [...parCle.values()]
    .sort((a, b) => (b.depense ?? -1) - (a.depense ?? -1) || a.nom.localeCompare(b.nom, "fr"))
    .map(({ dateNom: _, ...c }) => ({ ...c, couleur: couleurs.get(c.cle)! }));
}

// ── Les métriques ────────────────────────────────────────────────────────────

/** Ce qui s'additionne. Les ratios ne se stockent jamais : ils se dérivent de
 *  ces trois sommes, sur la sélection entière. */
export type Totaux = { depense: number; impressions: number; clics: number };

export type CleMetrique = "impressions" | "cpm" | "clics" | "ctr" | "cpc";

type Format = "entier" | "argent" | "pourcent";

type DefMetrique = {
  nom: string;
  /** Ce que la métrique compte, dit au survol du ⓘ. */
  aide: string;
  /** Une hausse est-elle une bonne nouvelle ? (un coût qui monte ne l'est pas) */
  hausseBonne: boolean;
  format: Format;
  /** `null` dès que le diviseur est nul : « — », jamais 0 ni l'infini. */
  calcul: (t: Totaux) => number | null;
};

const diviser = (a: number, b: number) => (b === 0 ? null : a / b);
const mul = (v: number | null, k: number) => (v === null ? null : v * k);

export const METRIQUES: Record<CleMetrique, DefMetrique> = {
  impressions: {
    nom: "Impressions",
    aide: "Le nombre de fois où tes annonces ont été affichées. Une même personne peut en compter plusieurs.",
    hausseBonne: true,
    format: "entier",
    calcul: (t) => t.impressions,
  },
  cpm: {
    nom: "CPM",
    aide: "Coût pour 1 000 impressions : dépense ÷ impressions × 1 000, sur toute la période.",
    hausseBonne: false,
    format: "argent",
    calcul: (t) => mul(diviser(t.depense, t.impressions), 1000),
  },
  clics: {
    nom: "Clics (tous)",
    aide: "Tous les clics, comme la colonne « Clics (tous) » d'Ads Manager — pas seulement ceux sur le lien.",
    hausseBonne: true,
    format: "entier",
    calcul: (t) => t.clics,
  },
  ctr: {
    nom: "CTR (tous)",
    aide: "Tous les clics ÷ impressions × 100, sur toute la période.",
    hausseBonne: true,
    format: "pourcent",
    calcul: (t) => mul(diviser(t.clics, t.impressions), 100),
  },
  cpc: {
    nom: "CPC (tous)",
    aide: "Dépense ÷ tous les clics, sur toute la période.",
    hausseBonne: false,
    format: "argent",
    calcul: (t) => diviser(t.depense, t.clics),
  },
};

/** Les vues et leurs métriques — spec, § « Les vues et leurs métriques ». La
 *  première est le chiffre principal. La vue Conversion vient au ticket 10. */
export const VUES: Record<Vue, { titre: string; question: string; metriques: CleMetrique[] }> = {
  notoriete: {
    titre: "Notoriété",
    question: "Combien de fois on t'a vu, et à quel prix",
    metriques: ["impressions", "cpm"],
  },
  trafic: {
    titre: "Trafic",
    question: "Combien de clics tes annonces ont reçus",
    metriques: ["clics", "ctr", "cpc"],
  },
};

export const ORDRE_VUES: Vue[] = ["notoriete", "trafic"];

export function vueDe(x: string | undefined): Vue {
  return x === "notoriete" || x === "trafic" ? x : VUE_PAR_DEFAUT;
}

/** La somme des lignes, ou `null` s'il n'y en a aucune : une sélection vide
 *  n'a pas « zéro impression », elle n'a rien de mesuré. */
export function totaux(lignes: LigneMeta[]): Totaux | null {
  if (lignes.length === 0) return null;
  const t = { depense: 0, impressions: 0, clics: 0 };
  for (const l of lignes) {
    t.depense += l.depense;
    t.impressions += l.impressions;
    t.clics += l.clics;
  }
  return t;
}

export function valeurDe(m: CleMetrique, t: Totaux | null): number | null {
  return t === null ? null : METRIQUES[m].calcul(t);
}

/** L'écart relatif, en %. `null` quand l'un des deux manque ou que la base est
 *  nulle : un compte qui n'a rien fait avant n'a pas fait « +∞ % ». */
export function ecart(courant: number | null, avant: number | null): number | null {
  if (courant === null || avant === null || avant === 0) return null;
  return ((courant - avant) / avant) * 100;
}

// ── L'écriture des nombres ───────────────────────────────────────────────────
//
// À la main plutôt que par `Intl` : le serveur (Node) et le navigateur ne
// portent pas toujours les mêmes données de locale, et deux rendus différents
// du même nombre sont une erreur d'hydratation (même raison que les dates de
// `lib/jour-de-travail.ts`). Séparateur de milliers : l'espace fine insécable.

export const TIRET = "—";
const ESPACE_FINE = " ";

export function nombre(v: number, decimales = 0): string {
  const [entier, frac] = Math.abs(v).toFixed(decimales).split(".");
  const groupe = entier.replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE_FINE);
  return `${v < 0 ? "−" : ""}${groupe}${frac ? `,${frac}` : ""}`;
}

/** La devise des pages publicitaires de Pulse (`channel-dash.tsx`, `couts`). */
export const DEVISE = "CHF";

export function formaterValeur(m: CleMetrique, v: number | null): string {
  if (v === null) return TIRET;
  switch (METRIQUES[m].format) {
    case "entier":
      return nombre(v);
    case "argent":
      return `${nombre(v, 2)}${ESPACE_FINE}${DEVISE}`;
    case "pourcent":
      return `${nombre(v, 2)}${ESPACE_FINE}%`;
  }
}

export function formaterEcart(e: number | null): string {
  if (e === null) return TIRET;
  const arrondi = Math.round(e * 10) / 10;
  if (arrondi === 0) return `0${ESPACE_FINE}%`;
  // Une décimale sous 10 %, aucune au-delà : « +2,4 % » se lit, « +143,7 % » non.
  const txt = nombre(Math.abs(arrondi), Math.abs(arrondi) < 10 ? 1 : 0).replace(/,0$/, "");
  return `${arrondi > 0 ? "+" : "−"}${txt}${ESPACE_FINE}%`;
}

/** Bonne ou mauvaise nouvelle — `null` quand il n'y a pas d'écart à juger. */
export function tonEcart(m: CleMetrique, e: number | null): "pos" | "neg" | null {
  if (e === null || Math.round(e * 10) === 0) return null;
  return e > 0 === METRIQUES[m].hausseBonne ? "pos" : "neg";
}

// ── Le contenu des modules ───────────────────────────────────────────────────

/** La campagne demandée par l'URL. `connue: false` = un ID qu'aucune ligne
 *  lue ne porte : la page le dit au lieu de montrer « toutes ». Pas de dépense
 *  ici : celle d'une campagne sans ligne n'est pas zéro, elle n'est pas lue. */
export type CampagneChoisie = { cle: string; nom: string; connue: boolean };

export type CarteVue = {
  vue: Vue;
  metrique: CleMetrique;
  valeur: number | null;
  avant: number | null;
  ecart: number | null;
};

export type MetriqueTendance = {
  cle: CleMetrique;
  nom: string;
  aide: string;
  valeur: number | null;
  avant: number | null;
  ecart: number | null;
  /** Un point par jour de la période ; `null` = aucune ligne ce jour-là. */
  serie: (number | null)[];
  /** La période d'avant, alignée jour pour jour sur la période. */
  serieAvant: (number | null)[];
};

export type ContenuPage = {
  vue: Vue;
  periode: Periode;
  /** Le jour en cours moins un : la borne haute de toute date choisissable. */
  hier: string;
  /** Les dates de la période, une par point de série. */
  dates: string[];
  /** Les dates de la période d'avant, alignées jour pour jour sur `dates`. */
  datesAvant: string[];
  campagnes: Campagne[];
  raccourcis: Raccourci[];
  /** `null` = toutes les campagnes. */
  campagneChoisie: CampagneChoisie | null;
  cartes: CarteVue[];
  tendance: MetriqueTendance[];
};

function parJour(lignes: LigneMeta[]): Map<string, LigneMeta[]> {
  const m = new Map<string, LigneMeta[]>();
  for (const l of lignes) {
    const j = m.get(l.date);
    if (j) j.push(l);
    else m.set(l.date, [l]);
  }
  return m;
}

function serieDe(m: CleMetrique, jours: Map<string, LigneMeta[]>, debut: string, n: number): (number | null)[] {
  return Array.from({ length: n }, (_, i) => valeurDe(m, totaux(jours.get(decaler(debut, i)) ?? [])));
}

export function contenuPage(lignesBrutes: LigneMeta[], c: Commandes, ctx: Contexte): ContenuPage {
  const vue = vueDe(c.vue);
  const periode = periodeDe(c, ctx);
  const dansPeriode = (l: LigneMeta, de: string, a: string) =>
    l.date >= de && l.date <= a && l.date < ctx.aujourdhui;

  const lues = lignesBrutes.filter(
    (l) => dansPeriode(l, periode.debut, periode.fin) || dansPeriode(l, periode.avantDebut, periode.avantFin)
  );
  const campagnes = campagnesDe(lues, periode);

  let campagneChoisie: ContenuPage["campagneChoisie"] = null;
  if (c.campagne) {
    const trouvee = campagnes.find((x) => x.cle === c.campagne);
    campagneChoisie = { cle: c.campagne, nom: trouvee?.nom ?? c.campagne, connue: !!trouvee };
  }
  const filtrees = campagneChoisie ? lues.filter((l) => cleCampagne(l) === campagneChoisie!.cle) : lues;

  const courant = filtrees.filter((l) => dansPeriode(l, periode.debut, periode.fin));
  const avant = filtrees.filter((l) => dansPeriode(l, periode.avantDebut, periode.avantFin));
  const tCourant = totaux(courant);
  const tAvant = totaux(avant);

  const cartes = ORDRE_VUES.map((v): CarteVue => {
    const m = VUES[v].metriques[0];
    const valeur = valeurDe(m, tCourant);
    const base = valeurDe(m, tAvant);
    return { vue: v, metrique: m, valeur, avant: base, ecart: ecart(valeur, base) };
  });

  const joursCourant = parJour(courant);
  const joursAvant = parJour(avant);
  const tendance = VUES[vue].metriques.map((m): MetriqueTendance => {
    const valeur = valeurDe(m, tCourant);
    const base = valeurDe(m, tAvant);
    return {
      cle: m,
      nom: METRIQUES[m].nom,
      aide: METRIQUES[m].aide,
      valeur,
      avant: base,
      ecart: ecart(valeur, base),
      serie: serieDe(m, joursCourant, periode.debut, periode.jours),
      serieAvant: serieDe(m, joursAvant, periode.avantDebut, periode.jours),
    };
  });

  return {
    vue,
    periode,
    hier: decaler(ctx.aujourdhui, -1),
    dates: Array.from({ length: periode.jours }, (_, i) => decaler(periode.debut, i)),
    datesAvant: Array.from({ length: periode.jours }, (_, i) => decaler(periode.avantDebut, i)),
    campagnes,
    raccourcis: raccourcisDe(periode, ctx),
    campagneChoisie,
    cartes,
    tendance,
  };
}

// ── Les dates, pour l'écran ──────────────────────────────────────────────────

const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const JOURS_COURTS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

/** « 28 sept. » — sur l'axe. */
export function dateCourte(iso: string): string {
  const d = new Date(versMs(iso));
  return `${d.getUTCDate()} ${MOIS_COURTS[d.getUTCMonth()]}`;
}

/** « lun. 28 sept. » — dans la bulle, où le jour de semaine se compare. */
export function dateBulle(iso: string): string {
  return `${JOURS_COURTS[new Date(versMs(iso)).getUTCDay()]} ${dateCourte(iso)}`;
}

/** « 28 sept. → 4 oct. 2026 » — les deux bornes d'une Fenêtre. */
export function bornes(debut: string, fin: string): string {
  const a = debut.slice(0, 4);
  const b = fin.slice(0, 4);
  return `${dateCourte(debut)}${a === b ? "" : ` ${a}`} → ${dateCourte(fin)} ${b}`;
}
