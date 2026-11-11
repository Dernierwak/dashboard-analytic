// ── LA LECTURE GOOGLE : DES LIGNES DE BASE AU CONTENU DES MODULES ───────────
//
// Spec `.scratch/google-ads/spec.md`, § « La lecture des données côté web ».
// Ce fichier est le seam testé de la page Google (harnais :
// `.scratch/google-ads/harnais/01-la-page-google-neuve/`, et `02-…` pour le
// Type de campagne) : tout ce qui
// transforme des lignes en chiffres affichés vit ici, en fonctions pures.
//
// Écrit en partant de `lib/meta/lecture.ts`, mais SON PROPRE CODE (ADR 0011) :
// Meta et Google ne partagent pas de type rempli par l'un et l'autre. La
// période, la pagination, les dates et l'écriture des nombres sont recopiées
// telles quelles ; les métriques et les vues sont celles de Google.
//
// AUCUNE DIRECTIVE ET AUCUN IMPORT, et les deux sont voulus. Sans directive,
// les valeurs exportées se lisent des deux côtés (`CLAUDE.md` §8 : une
// constante d'un module `"use client"` arrive en proxy côté serveur). Sans
// import, Node charge le fichier tel quel et le harnais tourne sans Next, sans
// Supabase et sans lanceur de tests ajouté au projet.
//
// Les règles que ce module tient, chacune testée :
//   · le jour en cours n'entre dans aucun chiffre (`CLAUDE.md` §7) ;
//   · un taux est recalculé total ÷ total sur la sélection — jamais moyenné,
//     jamais lu dans la base (`ctr`, `avg_cpc_micros` ne sont pas lus) : le
//     ticket 10 de la carte a vérifié que ce recalcul égale ceux de Google ;
//   · une absence n'est pas un zéro : pas de ligne → `null` → « — » ; un jour
//     sans ligne est un trou dans la courbe ;
//   · un diviseur nul rend `null`, donc aucun écart « +∞ % » ;
//   · une campagne est son ID Google, sous le nom porté par sa ligne la plus
//     récente : une campagne renommée reste une seule ligne.

export type LigneGoogle = {
  date: string; // YYYY-MM-DD
  campagneId: string | null;
  campagneNom: string;
  /** `advertising_channel_type` tel que Google l'a rendu (`SEARCH`,
   *  `PERFORMANCE_MAX`…), `null` quand il n'a pas été lu. */
  typeCampagne: string | null;
  /** Le coût, déjà converti des micros (une seule fois, dans `donnees.ts`). */
  cout: number;
  impressions: number;
  /** `metrics.clicks`, la colonne « Clics » de Google Ads. */
  clics: number;
  /** `metrics.conversions`, la colonne « Conversions » de Google Ads. */
  conversions: number;
};

// ── La lecture paginée ───────────────────────────────────────────────────────

/** PostgREST plafonne une réponse à 1 000 lignes et tronque EN SILENCE
 *  (`CLAUDE.md` §8). L'erreur est LEVÉE : le client PostgREST ne jette jamais,
 *  et une colonne absente se lirait sinon comme une table vide — donc des
 *  « — » partout sans cause. */
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

export type Vue = "notoriete" | "trafic" | "conversion";
/** Pas de vue Coûts chez Google (spec, § « Les vues et leurs métriques ») ;
 *  la spec ne tranche pas laquelle s'ouvre. Notoriété, la première dans
 *  l'ordre du Sélecteur — choix par défaut, réversible sans toucher au reste. */
export const VUE_PAR_DEFAUT: Vue = "notoriete";

export type Commandes = {
  vue?: string;
  /** L'ID Google de la campagne. */
  campagne?: string;
  from?: string;
  to?: string;
};

export type Contexte = {
  /** Le jour en cours, en UTC — exclu de tout. */
  aujourdhui: string;
  /** Le dernier Jour de travail passé (`dernierJourDeTravail`). */
  dernierJourDeTravail: string;
  /** Le dernier jour ÉCRIT par une récolte Google en échec
   *  (`lib/canaux-muets.ts`), absent quand la récolte a réussi. */
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
  /** La récolte a échoué : la période s'arrête au dernier jour lu. */
  arreteeAuDernierJourLu: boolean;
};

/**
 * La période lue et celle d'avant, de même durée. Par défaut, la SEMAINE
 * MESURÉE — les sept jours pleins avant le dernier Jour de travail, la Fenêtre
 * que tout le reste de Pulse lit. Même règle que Meta (`lib/meta/lecture.ts`).
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
    if (parDefaut) debut = decaler(borne, -6);
    else if (debut > borne) debut = borne;
    fin = borne;
  }
  return { debut, fin, ...periodeAvant(debut, fin), parDefaut, rognee, arreteeAuDernierJourLu };
}

/** La durée d'une période et la période d'avant, de même durée, qui finit la
 *  veille de son premier jour (spec, user story 11). */
export function periodeAvant(debut: string, fin: string): { jours: number; avantDebut: string; avantFin: string } {
  const jours = ecartJours(debut, fin) + 1;
  const avantFin = decaler(debut, -1);
  return { jours, avantDebut: decaler(avantFin, -(jours - 1)), avantFin };
}

// ── Les raccourcis de période (les mêmes que Meta, user story 10) ────────────

export const RACCOURCIS: { jours: number; nom: string }[] = [
  { jours: 7, nom: "7 derniers jours" },
  { jours: 14, nom: "14 derniers jours" },
  { jours: 28, nom: "4 dernières semaines" },
  { jours: 56, nom: "8 dernières semaines" },
  { jours: 84, nom: "12 dernières semaines" },
];

export type Raccourci = { jours: number; nom: string; from: string; to: string; actif: boolean };

/** Les raccourcis finissent là où finit la semaine mesurée : la récolte ne
 *  passe qu'au Jour de travail, les jours suivants n'ont encore aucune ligne.
 *  Ils s'écrivent en dates, pour qu'un lien partagé rouvre la période vue. */
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

// ── Les campagnes, par leur ID ───────────────────────────────────────────────

const PREFIXE_SANS_ID = "sans-id:";

/** Une ligne sans ID garde son nom comme clé, PRÉFIXÉ : elle ne tombe jamais
 *  sur la clé d'une campagne qui a un ID, même homonyme. */
export function cleCampagne(l: LigneGoogle): string {
  return l.campagneId ?? `${PREFIXE_SANS_ID}${l.campagneNom}`;
}

/** La palette des pastilles de campagne de Meta (validée `dataviz`, CVD ΔE ≥
 *  9,1 entre voisins) : une campagne a la même grammaire de couleur d'une page
 *  à l'autre. Le nom est toujours écrit à côté de la pastille. */
export const PALETTE_CAMPAGNES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
/** Au-delà de huit campagnes : un gris neutre, jamais une teinte réutilisée. */
export const PASTILLE_NEUTRE = "#c3c2bb";

// ── Le Type de campagne ──────────────────────────────────────────────────────

/** Les six libellés de l'écran, dans son ordre — spec, § « Le Type de
 *  campagne ». « Vidéo » est le YouTube payant ; « YouTube » seul désigne la
 *  future page organique. */
export const TYPES_CAMPAGNE = ["Search", "PMax", "Display", "Vidéo", "Demand Gen", "Autres types"] as const;
export type LibelleType = (typeof TYPES_CAMPAGNE)[number];

/** Les cinq types que l'écran nomme (carte, issues 03 et 14 : ce que les
 *  comptes réels font tourner, Demand Gen ajouté le dernier). */
const TYPES_NOMMES: Record<string, LibelleType> = {
  SEARCH: "Search",
  PERFORMANCE_MAX: "PMax",
  DISPLAY: "Display",
  VIDEO: "Vidéo",
  DEMAND_GEN: "Demand Gen",
};

/** Le libellé d'un type brut de Google, ou `null` quand il n'a pas été lu.
 *  `UNSPECIFIED` est la valeur par défaut de l'enum, pas un type : Google ne
 *  l'émet pas pour une vraie campagne, elle se lit donc « non lu ».
 *  `UNKNOWN`, lui, est un vrai type que v26 ne sait pas nommer — donc aucun des
 *  cinq, que v26 connaît : « Autres types ». */
export function libelleType(brut: string | null | undefined): LibelleType | null {
  if (!brut || brut === "UNSPECIFIED") return null;
  return TYPES_NOMMES[brut] ?? "Autres types";
}

export type TypeCampagne = {
  libelle: LibelleType;
  /** Le vrai type de Google, à montrer quand le libellé est « Autres types ». */
  brut: string;
};

export type Campagne = {
  cle: string;
  nom: string;
  sansId: boolean;
  /** `null` = aucune ligne de la campagne ne porte de type lu (lignes d'avant
   *  la récolte du type) : elle n'est rangée dans aucun type, jamais devinée. */
  type: TypeCampagne | null;
  /** Le coût de la PÉRIODE lue. `null` = aucune ligne sur la période : rien
   *  de mesuré, pas « 0 CHF ». */
  cout: number | null;
  /** Donnée dans l'ordre des clés, pas du coût : un menu reclassé ne repeint rien. */
  couleur: string;
};

/** Les campagnes présentes, la plus coûteuse sur `courante` d'abord, chacune
 *  sous le nom de sa ligne la plus récente (Google garde le dernier nom). */
export function campagnesDe(lignes: LigneGoogle[], courante: { debut: string; fin: string }): Campagne[] {
  const couts = new Map<string, number | null>();
  const recentes = new Map<string, LigneGoogle>();
  // Le type, lu sur la ligne la plus récente qui en PORTE un : Google ne
  // laisse pas changer le type d'une campagne existante, donc toute ligne lue
  // dit le même. Les lignes écrites avant la récolte du type (NULL) ne
  // l'effacent pas.
  const types = new Map<string, LigneGoogle>();
  for (const l of lignes) {
    const cle = cleCampagne(l);
    const avant = couts.get(cle) ?? null;
    couts.set(cle, l.date >= courante.debut && l.date <= courante.fin ? (avant ?? 0) + l.cout : avant);
    const vue = recentes.get(cle);
    if (!vue || l.date > vue.date) recentes.set(cle, l);
    const typee = types.get(cle);
    if (libelleType(l.typeCampagne) && (!typee || l.date > typee.date)) types.set(cle, l);
  }
  const typeDe = (cle: string): TypeCampagne | null => {
    const brut = types.get(cle)?.typeCampagne;
    const libelle = libelleType(brut);
    return brut && libelle ? { libelle, brut } : null;
  };
  const couleurs = new Map([...recentes.keys()].sort().map((cle, i) => [cle, PALETTE_CAMPAGNES[i] ?? PASTILLE_NEUTRE]));
  return [...recentes]
    .map(([cle, l]) => ({
      cle,
      nom: l.campagneNom,
      sansId: l.campagneId === null,
      type: typeDe(cle),
      cout: couts.get(cle) ?? null,
      couleur: couleurs.get(cle)!,
    }))
    .sort((a, b) => (b.cout ?? -1) - (a.cout ?? -1) || a.nom.localeCompare(b.nom, "fr"));
}

// ── Les métriques ────────────────────────────────────────────────────────────

/** Ce qui s'additionne, tous types de campagnes confondus, comme la Vue
 *  d'ensemble de Google Ads. Les taux se dérivent de ces sommes. */
export type Totaux = { cout: number; impressions: number; clics: number; conversions: number };

export type CleMetrique = "impressions" | "cpm" | "clics" | "ctr" | "cpc" | "conversions" | "cout_conversion" | "taux_conversion";

type Format = "entier" | "decimal" | "argent" | "pourcent";

type DefMetrique = {
  nom: string;
  /** Ce que la métrique compte, dit au survol du ⓘ. */
  aide: string;
  /** Une hausse est-elle une bonne nouvelle ? (un coût qui monte ne l'est pas) */
  hausseBonne: boolean;
  format: Format;
  /** `null` dès que le diviseur est nul : « — », jamais 0 ni l'infini. */
  calcul: (t: Totaux) => number | null;
  /** Écrit sous le chiffre : ce qu'il divise par quoi, quand le nom ne le dit pas. */
  precision?: string;
};

const diviser = (a: number, b: number) => (b === 0 ? null : a / b);
const mul = (v: number | null, k: number) => (v === null ? null : v * k);

/** Spec, user story 19 : ces totaux additionnent des types de campagnes qui
 *  ne diffusent pas de la même façon — le dire, sans les effacer. */
const MELANGE_TYPES = "Ce total additionne tous tes types de campagnes (Search, Performance Max, Display…), comme la Vue d'ensemble de Google Ads.";

export const METRIQUES: Record<CleMetrique, DefMetrique> = {
  impressions: {
    nom: "Impressions",
    aide: `Le nombre de fois où tes annonces ont été affichées, la colonne « Impr. » de Google Ads. ${MELANGE_TYPES}`,
    hausseBonne: true,
    format: "entier",
    calcul: (t) => t.impressions,
  },
  cpm: {
    nom: "CPM",
    aide: "Coût pour 1 000 impressions : coût ÷ impressions × 1 000, sur toute la période.",
    hausseBonne: false,
    format: "argent",
    calcul: (t) => mul(diviser(t.cout, t.impressions), 1000),
  },
  clics: {
    nom: "Clics",
    aide: `La colonne « Clics » de Google Ads. ${MELANGE_TYPES}`,
    hausseBonne: true,
    format: "entier",
    calcul: (t) => t.clics,
  },
  ctr: {
    nom: "CTR",
    aide: "Clics ÷ impressions × 100, sur toute la période.",
    hausseBonne: true,
    format: "pourcent",
    calcul: (t) => mul(diviser(t.clics, t.impressions), 100),
  },
  cpc: {
    nom: "CPC",
    aide: "Coût ÷ clics, sur toute la période.",
    hausseBonne: false,
    format: "argent",
    calcul: (t) => diviser(t.cout, t.clics),
  },
  conversions: {
    nom: "Conversions",
    aide: "La colonne « Conversions » de Google Ads, recopiée telle que Google l'attribue — datée au jour du clic.",
    hausseBonne: true,
    format: "decimal",
    calcul: (t) => t.conversions,
  },
  cout_conversion: {
    nom: "Coût par conversion",
    aide: "Coût ÷ conversions, sur toute la période.",
    hausseBonne: false,
    format: "argent",
    calcul: (t) => diviser(t.cout, t.conversions),
  },
  taux_conversion: {
    nom: "Taux de conversion",
    aide: "Conversions ÷ clics × 100, sur toute la période.",
    hausseBonne: true,
    format: "pourcent",
    calcul: (t) => mul(diviser(t.conversions, t.clics), 100),
    precision: "conversions ÷ clics",
  },
};

/** Les vues et leurs métriques — spec, § « Les vues et leurs métriques ». La
 *  première est le chiffre principal. Valeur de conversion et ROAS : ticket 03. */
export const VUES: Record<Vue, { titre: string; question: string; metriques: CleMetrique[] }> = {
  notoriete: { titre: "Notoriété", question: "Combien de fois on t'a vu, et à quel prix", metriques: ["impressions", "cpm"] },
  trafic: { titre: "Trafic", question: "Combien de clics tes annonces ont reçus", metriques: ["clics", "ctr", "cpc"] },
  conversion: { titre: "Conversion", question: "Ce que tes campagnes rapportent en actions", metriques: ["conversions", "cout_conversion", "taux_conversion"] },
};

export const ORDRE_VUES: Vue[] = ["notoriete", "trafic", "conversion"];

export function vueDe(x: string | undefined): Vue {
  return (ORDRE_VUES as (string | undefined)[]).includes(x) ? (x as Vue) : VUE_PAR_DEFAUT;
}

/** La somme des lignes, ou `null` s'il n'y en a aucune : une sélection vide
 *  n'a pas « zéro impression », elle n'a rien de mesuré. */
export function totaux(lignes: LigneGoogle[]): Totaux | null {
  if (lignes.length === 0) return null;
  const t: Totaux = { cout: 0, impressions: 0, clics: 0, conversions: 0 };
  for (const l of lignes) {
    t.cout += l.cout;
    t.impressions += l.impressions;
    t.clics += l.clics;
    t.conversions += l.conversions;
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
// À la main plutôt que par `Intl` : serveur et navigateur ne portent pas
// toujours les mêmes données de locale, et deux rendus différents du même
// nombre sont une erreur d'hydratation. Milliers : l'espace fine insécable.

export const TIRET = "—";
const ESPACE_FINE = " ";

export function nombre(v: number, decimales = 0): string {
  const [entier, frac] = Math.abs(v).toFixed(decimales).split(".");
  const groupe = entier.replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE_FINE);
  return `${v < 0 ? "−" : ""}${groupe}${frac ? `,${frac}` : ""}`;
}

/** Aucune colonne devise en base Google : la devise des pages publicitaires
 *  de Pulse, celle de Meta et de l'ancienne page Google. */
export const DEVISE = "CHF";

export function formaterValeur(m: CleMetrique, v: number | null): string {
  if (v === null) return TIRET;
  switch (METRIQUES[m].format) {
    case "entier":
      return nombre(v);
    case "decimal":
      // Google attribue des fractions de conversion (modèle data-driven) :
      // les arrondir à l'entier ferait lire un autre nombre que Google Ads.
      return Number.isInteger(v) ? nombre(v) : nombre(v, 2);
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
  const txt = nombre(Math.abs(arrondi), Math.abs(arrondi) < 10 ? 1 : 0).replace(/,0$/, "");
  return `${arrondi > 0 ? "+" : "−"}${txt}${ESPACE_FINE}%`;
}

/** Bonne ou mauvaise nouvelle — `null` quand il n'y a pas d'écart à juger. */
export function tonEcart(m: CleMetrique, e: number | null): "pos" | "neg" | null {
  if (e === null || Math.round(e * 10) === 0) return null;
  return e > 0 === METRIQUES[m].hausseBonne ? "pos" : "neg";
}

// ── Le contenu des modules ───────────────────────────────────────────────────

/** La campagne demandée par l'URL. `connue: false` = un ID qu'aucune ligne lue
 *  ne porte : la page le dit au lieu de montrer « toutes ». */
export type CampagneChoisie = { cle: string; nom: string; connue: boolean };

export type CarteVue = { vue: Vue; metrique: CleMetrique; valeur: number | null; avant: number | null; ecart: number | null };

export type MetriqueTendance = {
  cle: CleMetrique;
  nom: string;
  aide: string;
  precision: string | null;
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
  dates: string[];
  datesAvant: string[];
  campagnes: Campagne[];
  raccourcis: Raccourci[];
  /** `null` = toutes les campagnes. */
  campagneChoisie: CampagneChoisie | null;
  cartes: CarteVue[];
  tendance: MetriqueTendance[];
};

function parJour(lignes: LigneGoogle[]): Map<string, LigneGoogle[]> {
  const m = new Map<string, LigneGoogle[]>();
  for (const l of lignes) {
    const j = m.get(l.date);
    if (j) j.push(l);
    else m.set(l.date, [l]);
  }
  return m;
}

function serieDe(m: CleMetrique, jours: Map<string, LigneGoogle[]>, debut: string, n: number): (number | null)[] {
  return Array.from({ length: n }, (_, i) => valeurDe(m, totaux(jours.get(decaler(debut, i)) ?? [])));
}

export function contenuPage(lignesBrutes: LigneGoogle[], c: Commandes, ctx: Contexte): ContenuPage {
  const vue = vueDe(c.vue);
  const periode = periodeDe(c, ctx);
  const dans = (l: LigneGoogle, de: string, a: string) => l.date >= de && l.date <= a && l.date < ctx.aujourdhui;

  const lues = lignesBrutes.filter((l) => dans(l, periode.debut, periode.fin) || dans(l, periode.avantDebut, periode.avantFin));
  const campagnes = campagnesDe(lues, periode);

  let campagneChoisie: CampagneChoisie | null = null;
  if (c.campagne) {
    const trouvee = campagnes.find((x) => x.cle === c.campagne);
    campagneChoisie = { cle: c.campagne, nom: trouvee?.nom ?? c.campagne, connue: !!trouvee };
  }
  const filtrees = c.campagne ? lues.filter((l) => cleCampagne(l) === c.campagne) : lues;
  const courant = filtrees.filter((l) => dans(l, periode.debut, periode.fin));
  const avant = filtrees.filter((l) => dans(l, periode.avantDebut, periode.avantFin));
  const tCourant = totaux(courant);
  const tAvant = totaux(avant);

  const cartes = ORDRE_VUES.map((v): CarteVue => {
    const m = VUES[v].metriques[0];
    const valeur = valeurDe(m, tCourant);
    const precedente = valeurDe(m, tAvant);
    return { vue: v, metrique: m, valeur, avant: precedente, ecart: ecart(valeur, precedente) };
  });

  const joursCourant = parJour(courant);
  const joursAvant = parJour(avant);
  const tendance = VUES[vue].metriques.map((m): MetriqueTendance => {
    const valeur = valeurDe(m, tCourant);
    const precedente = valeurDe(m, tAvant);
    return {
      cle: m,
      nom: METRIQUES[m].nom,
      aide: METRIQUES[m].aide,
      precision: METRIQUES[m].precision ?? null,
      valeur,
      avant: precedente,
      ecart: ecart(valeur, precedente),
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

/** « 28 sept. » */
export function dateCourte(iso: string): string {
  const d = new Date(versMs(iso));
  return `${d.getUTCDate()} ${MOIS_COURTS[d.getUTCMonth()]}`;
}

/** « lun. 28 sept. » — dans la bulle, où le jour de semaine se compare. */
export function dateBulle(iso: string): string {
  return `${JOURS_COURTS[new Date(versMs(iso)).getUTCDay()]} ${dateCourte(iso)}`;
}

/** « 28 sept. → 4 oct. 2026 » */
export function bornes(debut: string, fin: string): string {
  const a = debut.slice(0, 4);
  const b = fin.slice(0, 4);
  return `${dateCourte(debut)}${a === b ? "" : ` ${a}`} → ${dateCourte(fin)} ${b}`;
}
