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
  /** La colonne « Résultats » d'Ads Manager (`resultatsDe`). `null` = `results`
   *  n'a pas été lu pour cette ligne ; `[]` = Meta n'a rendu aucun type. */
  resultats: Resultat[] | null;
  /** Le réglage d'attribution que Meta a appliqué (« 1d_view_7d_click »…). */
  attribution: string | null;
};

// ── Les résultats, tels que Meta les rend ────────────────────────────────────

/** Un élément de `results`. `valeur: null` = l'indicateur est là SANS
 *  `values` : Meta n'écrit jamais "0" (aucune des 5 751 lignes lues le
 *  2026-10-03), il omet le nombre, et Ads Manager affiche « — ». */
export type Resultat = { type: string; valeur: number | null };

type ValeurBrute = { attribution_windows?: unknown; value?: unknown };

/**
 * `results` tel que la base le porte, recopié brut par la récolte (ticket 03) :
 * `[{"indicator": "actions:omni_landing_page_view", "values":
 * [{"attribution_windows": ["default"], "value": "45"}]}]`.
 *
 * Le nombre est celui de la fenêtre `default` — le réglage du compte, celui
 * qu'Ads Manager affiche — ou la valeur unique quand Meta n'écrit aucune
 * fenêtre (sous `1d_click`). Les `values` ne se SOMMENT jamais : deux fenêtres
 * comptent les mêmes actions deux fois. Aucune ligne lue n'en porte plus
 * d'une ; si ça arrive sans `default`, le nombre reste inconnu.
 */
export function resultatsDe(brut: unknown): Resultat[] | null {
  if (!Array.isArray(brut)) return null;
  return brut.flatMap((e): Resultat[] => {
    const type = e && typeof e.indicator === "string" ? e.indicator : null;
    if (!type) return [];
    const valeurs: ValeurBrute[] = Array.isArray(e.values) ? e.values : [];
    const choisie =
      valeurs.find((v) => Array.isArray(v?.attribution_windows) && v.attribution_windows.includes("default")) ??
      (valeurs.length === 1 ? valeurs[0] : undefined);
    const n = Number(choisie?.value);
    return [{ type, valeur: choisie && Number.isFinite(n) ? n : null }];
  });
}

/** Le nom d'Ads Manager, en français, des types lus dans la base le
 *  2026-10-03. Un type absent d'ici s'écrit tel que Meta le nomme : jamais
 *  rangé sous un nom qui n'est pas le sien. */
const NOMS_RESULTATS: Record<string, { des: string; un: string }> = {
  "actions:omni_landing_page_view": { des: "vues de page de destination", un: "vue de page de destination" },
  "actions:link_click": { des: "clics sur un lien", un: "clic sur un lien" },
  "actions:click_to_call_native_call_placed": { des: "appels passés", un: "appel passé" },
  total_profile_visits: { des: "visites du profil", un: "visite du profil" },
};

export function nomResultat(type: string): string {
  return NOMS_RESULTATS[type]?.des ?? type;
}

function nomUnResultat(type: string): string {
  return NOMS_RESULTATS[type]?.un ?? type;
}

/** « 1d_view_7d_click » → « 7 jours après un clic ou 1 jour après un
 *  affichage ». Un réglage d'une autre forme s'écrit tel que Meta le rend. */
export function nomAttribution(reglage: string): string {
  const morceaux = reglage.match(/\d+d_(?:click|view)/g);
  if (!morceaux || morceaux.join("_") !== reglage) return reglage;
  const phrases = morceaux.map((m) => {
    const [n, geste] = m.split("d_");
    return { geste, texte: `${n} jour${n === "1" ? "" : "s"} après un ${geste === "click" ? "clic" : "affichage"}` };
  });
  // Le clic d'abord, comme Ads Manager le lit.
  phrases.sort((a, b) => (a.geste === b.geste ? 0 : a.geste === "click" ? -1 : 1));
  return phrases.map((p) => p.texte).join(" ou ");
}

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

export type Vue = "notoriete" | "trafic" | "conversion";
export const VUE_PAR_DEFAUT: Vue = "notoriete";

export type Commandes = {
  vue?: string;
  /** L'ID Meta de la campagne, ou la clé d'une campagne sans ID. */
  campagne?: string;
  from?: string;
  to?: string;
  /** La Comparaison : son niveau, ses deux métriques et ses places cochées
   *  (`comparer`, répété — voir `placesDe`). */
  niveau?: string;
  m1?: string;
  m2?: string;
  comparer?: string[];
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

/** Pourquoi une sélection n'a pas de total de résultats :
 *  · `non-lu` — une de ses lignes n'a pas `results` (récoltée avant lui) ;
 *  · `types-melanges` — elle porte plusieurs types : ils ne s'additionnent pas ;
 *  · `aucun-type` — Meta n'y rend aucun type (`[]`) ;
 *  · `aucun-nombre` — un seul type, jamais accompagné d'un nombre. */
export type RaisonSansResultat = "non-lu" | "types-melanges" | "aucun-type" | "aucun-nombre";

/** Le total des résultats d'une sélection, et ce qu'il compte. */
export type TotalResultats =
  | { mesure: true; type: string; valeur: number }
  | { mesure: false; raison: RaisonSansResultat; types: string[] };

/** Ce qui s'additionne. Les ratios ne se stockent jamais : ils se dérivent de
 *  ces sommes, sur la sélection entière. */
export type Totaux = {
  depense: number;
  impressions: number;
  clics: number;
  resultats: TotalResultats;
  /** Les réglages d'attribution des lignes, distincts et triés. */
  attributions: string[];
};

export type CleMetrique = "impressions" | "cpm" | "clics" | "ctr" | "cpc" | "resultats" | "cout_resultat" | "taux_conversion";

const METRIQUES_RESULTATS: CleMetrique[] = ["resultats", "cout_resultat", "taux_conversion"];
export const estMetriqueResultat = (m: CleMetrique) => METRIQUES_RESULTATS.includes(m);

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
  resultats: {
    nom: "Résultats",
    aide: "La colonne « Résultats » d'Ads Manager, recopiée : ce que Meta compte comme l'action visée par l'annonce.",
    hausseBonne: true,
    format: "entier",
    calcul: (t) => (t.resultats.mesure ? t.resultats.valeur : null),
  },
  cout_resultat: {
    nom: "Coût par résultat",
    aide: "Dépense ÷ résultats, sur toute la période.",
    hausseBonne: false,
    format: "argent",
    calcul: (t) => (t.resultats.mesure ? diviser(t.depense, t.resultats.valeur) : null),
  },
  taux_conversion: {
    nom: "Taux de conversion",
    aide: "Résultats ÷ tous les clics × 100 — les clics de la vue Trafic, pas seulement ceux sur le lien.",
    hausseBonne: true,
    format: "pourcent",
    calcul: (t) => (t.resultats.mesure ? mul(diviser(t.resultats.valeur, t.clics), 100) : null),
  },
};

/** Les vues et leurs métriques — spec, § « Les vues et leurs métriques ». La
 *  première est le chiffre principal. */
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
  conversion: {
    titre: "Conversion",
    question: "Ce que tes campagnes rapportent en actions",
    metriques: ["resultats", "cout_resultat", "taux_conversion"],
  },
};

export const ORDRE_VUES: Vue[] = ["notoriete", "trafic", "conversion"];

export function vueDe(x: string | undefined): Vue {
  return (ORDRE_VUES as (string | undefined)[]).includes(x) ? (x as Vue) : VUE_PAR_DEFAUT;
}

/** Les résultats d'un ensemble de lignes. Un type différent ne s'ajoute
 *  jamais à un autre — même quand l'un d'eux n'a pas de nombre : Ads Manager
 *  refuse lui aussi d'additionner deux résultats de nature différente. */
function totalResultats(lignes: LigneMeta[]): TotalResultats {
  const types = new Set<string>();
  let nonLu = false;
  for (const l of lignes) {
    // Absent comme NULL : non lu. Une ligne construite ailleurs que par
    // `donnees.ts` (les harnais d'avant ce ticket) n'a pas le champ.
    if (l.resultats == null) nonLu = true;
    else for (const r of l.resultats) types.add(r.type);
  }
  const liste = [...types].sort();
  if (nonLu) return { mesure: false, raison: "non-lu", types: liste };
  if (liste.length > 1) return { mesure: false, raison: "types-melanges", types: liste };
  if (liste.length === 0) return { mesure: false, raison: "aucun-type", types: liste };

  let valeur: number | null = null;
  for (const l of lignes) for (const r of l.resultats ?? []) if (r.valeur !== null) valeur = (valeur ?? 0) + r.valeur;
  if (valeur === null) return { mesure: false, raison: "aucun-nombre", types: liste };
  return { mesure: true, type: liste[0], valeur };
}

/** La somme des lignes, ou `null` s'il n'y en a aucune : une sélection vide
 *  n'a pas « zéro impression », elle n'a rien de mesuré. */
export function totaux(lignes: LigneMeta[]): Totaux | null {
  if (lignes.length === 0) return null;
  let depense = 0;
  let impressions = 0;
  let clics = 0;
  const attributions = new Set<string>();
  for (const l of lignes) {
    depense += l.depense;
    impressions += l.impressions;
    clics += l.clics;
    if (l.attribution) attributions.add(l.attribution);
  }
  return { depense, impressions, clics, resultats: totalResultats(lignes), attributions: [...attributions].sort() };
}

export function valeurDe(m: CleMetrique, t: Totaux | null): number | null {
  return t === null ? null : METRIQUES[m].calcul(t);
}

/** Deux résultats ne se comparent que s'ils comptent la même chose : des
 *  vues de page n'ont pas « monté » par rapport à des clics sur un lien. */
export function memeResultat(a: Totaux | null, b: Totaux | null): boolean {
  return !!a && !!b && a.resultats.mesure && b.resultats.mesure && a.resultats.type === b.resultats.type;
}

/** L'écart de `m` entre deux sélections, `null` dès qu'elles ne se comparent pas. */
export function ecartEntre(m: CleMetrique, courant: Totaux | null, avant: Totaux | null): number | null {
  if (estMetriqueResultat(m) && !memeResultat(courant, avant)) return null;
  return ecart(valeurDe(m, courant), valeurDe(m, avant));
}

/** Ce qu'on écrit sous un chiffre de résultats : le type qu'il compte, ou
 *  pourquoi il n'y en a pas. `null` hors de la vue Conversion. */
export function precisionDe(m: CleMetrique, t: Totaux | null): string | null {
  if (!estMetriqueResultat(m) || t === null) return null;
  const r = t.resultats;
  if (r.mesure) {
    if (m === "taux_conversion") return `${nomResultat(r.type)} ÷ clics (tous)`;
    if (m === "cout_resultat") return `par ${nomUnResultat(r.type)}`;
    return nomResultat(r.type);
  }
  switch (r.raison) {
    case "non-lu":
      return "Les résultats d'une partie de ces jours n'ont pas été lus : le total serait incomplet.";
    case "types-melanges":
      return `Des résultats de types différents ne s'additionnent pas (${r.types.map(nomResultat).join(", ")}). Choisis une campagne pour lire les siens.`;
    case "aucun-type":
      return "Meta ne rend aucun résultat pour cette sélection.";
    case "aucun-nombre":
      return `Meta n'a compté aucun résultat (${nomResultat(r.types[0])}) sur cette période — Ads Manager écrit « — » lui aussi.`;
  }
}

/** Le nom du type que compte le total, `null` quand il n'y a pas de total. */
export function nomTypeDe(t: Totaux | null): string | null {
  return t?.resultats.mesure ? nomResultat(t.resultats.type) : null;
}

/** Le réglage d'attribution, dit dans l'info-bulle. */
export function aideDe(m: CleMetrique, t: Totaux | null): string {
  const base = METRIQUES[m].aide;
  if (!estMetriqueResultat(m) || !t || t.attributions.length !== 1) return base;
  return `${base} Réglage d'attribution de Meta : ${nomAttribution(t.attributions[0])}.`;
}

/** Plusieurs réglages dans la sélection : écrit À L'ENDROIT DU CHIFFRE, pas
 *  caché dans une bulle — deux fenêtres différentes comptent différemment. */
export function attentionDe(m: CleMetrique, t: Totaux | null): string | null {
  if (!estMetriqueResultat(m) || !t || t.attributions.length < 2) return null;
  return `Réglages d'attribution mélangés : ${t.attributions.map(nomAttribution).join(" ; ")}.`;
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
  /** Ce que compte le chiffre, ou pourquoi il n'y en a pas (`precisionDe`). */
  precision: string | null;
};

export type MetriqueTendance = {
  cle: CleMetrique;
  nom: string;
  /** Le ⓘ — avec le réglage d'attribution pour un résultat (`aideDe`). */
  aide: string;
  /** Sous le chiffre : le type compté, ou pourquoi « — » (`precisionDe`). */
  precision: string | null;
  /** À côté du chiffre : des réglages d'attribution mélangés (`attentionDe`). */
  attention: string | null;
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
  comparaison: Comparaison;
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
    return {
      vue: v,
      metrique: m,
      valeur: valeurDe(m, tCourant),
      avant: estMetriqueResultat(m) && !memeResultat(tCourant, tAvant) ? null : valeurDe(m, tAvant),
      ecart: ecartEntre(m, tCourant, tAvant),
      precision: precisionDe(m, tCourant),
    };
  });

  const joursCourant = parJour(courant);
  const joursAvant = parJour(avant);
  // Une courbe de résultats ne trace que ce que le total accepte d'écrire :
  // sur une période aux types mélangés, chaque jour serait une somme d'un type
  // différent sur le même axe ; sur une période lue en partie, elle montrerait
  // une série que le total refuse. La période d'avant ne se trace que si elle
  // compte la même chose.
  const raison = tCourant && !tCourant.resultats.mesure ? tCourant.resultats.raison : null;
  const tracable = raison !== "types-melanges" && raison !== "non-lu";
  const comparable = memeResultat(tCourant, tAvant);
  const vide = () => Array<number | null>(periode.jours).fill(null);
  const tendance = VUES[vue].metriques.map((m, rang): MetriqueTendance => {
    const resultat = estMetriqueResultat(m);
    // Pourquoi « — » et les réglages mélangés ne s'écrivent qu'une fois, sous
    // le chiffre principal : répétés sur les trois cartes, ils noyaient la vue
    // (vu dans Chrome sur décembre 2025). Le type, lui, reste sur chacune.
    const principal = rang === 0;
    let precision = precisionDe(m, tCourant);
    if (!principal && precision !== null && !tCourant?.resultats.mesure) precision = "Voir pourquoi sous « Résultats ».";
    return {
      cle: m,
      nom: METRIQUES[m].nom,
      aide: aideDe(m, tCourant),
      precision,
      attention: principal ? attentionDe(m, tCourant) : null,
      valeur: valeurDe(m, tCourant),
      avant: resultat && !comparable ? null : valeurDe(m, tAvant),
      ecart: ecartEntre(m, tCourant, tAvant),
      serie: resultat && !tracable ? vide() : serieDe(m, joursCourant, periode.debut, periode.jours),
      serieAvant: resultat && !comparable ? vide() : serieDe(m, joursAvant, periode.avantDebut, periode.jours),
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
    comparaison: comparaisonDe(courant, periode, vue, c),
  };
}

// ── La Comparaison ───────────────────────────────────────────────────────────
//
// Spec, § « Comparaison — la mécanique » ; user stories 29 à 33, 35, 36. Une
// liste classée de groupes d'annonces ou d'annonces, sur la sélection du
// Bandeau ; on en coche jusqu'à quatre, tracés dans deux graphes, un par
// métrique.

export type Niveau = "groupes" | "annonces";
/** Le niveau du prototype validé (ticket 05 de la carte). */
export const NIVEAU_PAR_DEFAUT: Niveau = "annonces";
export const NOMS_NIVEAUX: Record<Niveau, { un: string; des: string }> = {
  groupes: { un: "Groupe d'annonces", des: "Groupes d'annonces" },
  annonces: { un: "Annonce", des: "Annonces" },
};

export function niveauDe(x: string | undefined): Niveau {
  return x === "groupes" || x === "annonces" ? x : NIVEAU_PAR_DEFAUT;
}

export const MAX_COMPARES = 4;
/** Pré-cochés quand l'URL ne dit rien : de quoi voir des courbes en arrivant,
 *  en laissant une case libre. */
const COCHES_PAR_DEFAUT = 3;

/** Quatre teintes de `PALETTE_CAMPAGNES`, repassées au validateur `dataviz`
 *  TOUTES PAIRES (`--pairs all`) puisque les quatre partagent un graphe :
 *  l'orange et le jaune de la palette tombaient à ΔE 13,7 en vision normale
 *  (plancher 15), le violet les sépare (pire paire 16,3 ; CVD 9,2). Le vert
 *  est sous 3:1 de contraste : le nom est toujours écrit à côté de la couleur,
 *  dans la liste comme dans la légende. */
export const PALETTE_COMPARES = ["#2a78d6", "#eb6834", "#1baf7a", "#4a3aa7"];

/**
 * Une place cochée vide, dans l'URL. Les éléments cochés occupent des PLACES
 * (1 à 4), et la couleur est celle de la place : décocher le premier ne
 * repeint pas les autres (règle `dataviz` — la couleur suit l'élément, jamais
 * son rang). Une place libérée s'écrit « - » tant qu'une place après elle est
 * prise ; la suivante cochée la reprend. `comparer=-` seul = « rien de coché,
 * exprès », à distinguer de l'absence du paramètre, qui pré-coche.
 */
export const PLACE_VIDE = "-";

export type Places = (string | null)[];

/** La clé d'un élément, par ID Meta. Une ligne sans ID (d'avant le rejeu,
 *  ticket 03) prend une clé PRÉFIXÉE, dans sa campagne, comme `cleCampagne` :
 *  elle ne tombe jamais sur celle d'un élément identifié, même homonyme. */
export function cleElement(l: LigneMeta, niveau: Niveau): string {
  if (niveau === "groupes") return l.groupeId ?? `${PREFIXE_SANS_ID}${cleCampagne(l)}›${l.groupeNom}`;
  return l.annonceId ?? `${PREFIXE_SANS_ID}${cleCampagne(l)}›${l.groupeNom}›${l.annonceNom}`;
}

/** Les deux métriques, toujours distinctes et toujours de la vue. Une métrique
 *  d'une autre vue (un lien gardé en changeant de vue) est ignorée, pas
 *  remplacée en silence par une autre dans l'URL. */
export function metriquesDe(vue: Vue, m1?: string, m2?: string): [CleMetrique, CleMetrique] {
  const de = VUES[vue].metriques;
  const est = (x?: string): x is CleMetrique => !!x && (de as string[]).includes(x);
  const a = est(m1) ? m1 : de[0];
  const b = est(m2) && m2 !== a ? m2 : de.find((m) => m !== a)!;
  return [a, b];
}

/** Choisir pour l'une la métrique de l'autre les ÉCHANGE (user story 32) :
 *  les deux graphes montrent toujours deux choses différentes. */
export function choixMetrique(actuelles: [CleMetrique, CleMetrique], rang: 0 | 1, cle: CleMetrique): { m1: CleMetrique; m2: CleMetrique } {
  const [a, b] = actuelles;
  if (rang === 0) return cle === b ? { m1: b, m2: a } : { m1: cle, m2: b };
  return cle === a ? { m1: b, m2: a } : { m1: a, m2: cle };
}

/** Les places lues dans l'URL, ou `null` quand le paramètre est absent. Une
 *  clé répétée ne prend qu'une place ; au-delà de quatre, le reste est ignoré. */
export function placesDe(brut: string[] | undefined): Places | null {
  if (!brut || brut.length === 0) return null;
  const vues = new Set<string>();
  return brut.slice(0, MAX_COMPARES).map((x) => {
    if (!x || x === PLACE_VIDE || vues.has(x)) return null;
    vues.add(x);
    return x;
  });
}

/** Cocher ou décocher. Une cinquième case est REFUSÉE (user story 33) : rien
 *  n'est décoché en silence pour lui faire de la place. */
export function basculerCoche(places: Places, cle: string): Places | "refus" {
  const i = places.indexOf(cle);
  if (i >= 0) return places.map((x, k) => (k === i ? null : x));
  const libre = places.indexOf(null);
  if (libre >= 0) return places.map((x, k) => (k === libre ? cle : x));
  if (places.length < MAX_COMPARES) return [...places, cle];
  return "refus";
}

/** Ce que le lien écrit : les places vides de fin tombent, et « rien de
 *  coché » s'écrit `-` pour ne pas retomber sur le pré-cochage. */
export function placesVersUrl(places: Places): string[] {
  const out = places.map((x) => x ?? PLACE_VIDE);
  while (out.length && out[out.length - 1] === PLACE_VIDE) out.pop();
  return out.length ? out : [PLACE_VIDE];
}

export type ElementCompare = {
  cle: string;
  /** Le nom le plus récent lu. */
  nom: string;
  /** Où il vit : la campagne (et le groupe, pour une annonce). */
  sous: string;
  /** L'ID Meta de l'annonce, pour sa vignette ; `null` pour un groupe. */
  annonceId: string | null;
  /** Dans la vue Conversion, le type que compte son chiffre — deux éléments
   *  voisins ne comptent pas forcément la même chose. */
  typeResultat: string | null;
  /** Les deux métriques sur la période ; `null` = « — », rangé en bas. */
  valeurs: [number | null, number | null];
  /** 0 à 3 quand l'élément est coché — sa couleur ; `null` sinon. */
  place: number | null;
};

export type SerieCompare = {
  cle: string;
  nom: string;
  couleur: string;
  /** Une série par métrique, un point par jour ; `null` = un trou. */
  series: [(number | null)[], (number | null)[]];
};

export type Comparaison = {
  niveau: Niveau;
  metriques: [CleMetrique, CleMetrique];
  /** Classés par la métrique 1. */
  elements: ElementCompare[];
  /** Les places telles qu'elles s'affichent — c'est d'elles que part un clic. */
  places: Places;
  /** Les cochés, dans l'ordre de leur place. */
  coches: SerieCompare[];
};

/** Classe par la métrique 1 : décroissant, croissant pour un coût (un CPC bas
 *  est le meilleur) ; « — » toujours en bas, jamais classé comme un zéro. */
function classer(a: ElementCompare, b: ElementCompare, m: CleMetrique): number {
  const x = a.valeurs[0];
  const y = b.valeurs[0];
  if (x === null || y === null) {
    if (x !== y) return x === null ? 1 : -1;
  } else if (x !== y) {
    return METRIQUES[m].hausseBonne ? y - x : x - y;
  }
  return a.nom.localeCompare(b.nom, "fr") || (a.cle < b.cle ? -1 : 1);
}

export function comparaisonDe(courant: LigneMeta[], periode: Periode, vue: Vue, c: Commandes): Comparaison {
  const niveau = niveauDe(c.niveau);
  const metriques = metriquesDe(vue, c.m1, c.m2);

  const groupes = new Map<string, { lignes: LigneMeta[]; recente: LigneMeta }>();
  for (const l of courant) {
    const cle = cleElement(l, niveau);
    const g = groupes.get(cle);
    if (!g) groupes.set(cle, { lignes: [l], recente: l });
    else {
      g.lignes.push(l);
      if (l.date > g.recente.date) g.recente = l;
    }
  }

  const elements: ElementCompare[] = [...groupes].map(([cle, { lignes, recente }]) => {
    const t = totaux(lignes);
    return {
      cle,
      nom: niveau === "groupes" ? recente.groupeNom : recente.annonceNom,
      sous: niveau === "groupes" ? recente.campagneNom : `${recente.campagneNom} › ${recente.groupeNom}`,
      annonceId: niveau === "annonces" ? recente.annonceId : null,
      typeResultat: estMetriqueResultat(metriques[0]) ? nomTypeDe(t) : null,
      valeurs: [valeurDe(metriques[0], t), valeurDe(metriques[1], t)],
      place: null,
    };
  });
  elements.sort((a, b) => classer(a, b, metriques[0]));

  // Une clé qui n'est plus dans la liste (un autre filtre, une autre période)
  // LIBÈRE sa place sans décaler les autres : les couleurs ne bougent pas.
  const presentes = new Set(elements.map((e) => e.cle));
  const lues = placesDe(c.comparer);
  const places: Places = lues
    ? lues.map((x) => (x !== null && presentes.has(x) ? x : null))
    : elements.slice(0, COCHES_PAR_DEFAUT).map((e) => e.cle);
  for (const e of elements) {
    const p = places.indexOf(e.cle);
    e.place = p >= 0 ? p : null;
  }

  const coches: SerieCompare[] = [];
  places.forEach((cle, p) => {
    if (cle === null) return;
    const e = elements.find((x) => x.cle === cle)!;
    const jours = parJour(groupes.get(cle)!.lignes);
    coches.push({
      cle,
      nom: e.nom,
      couleur: PALETTE_COMPARES[p],
      series: [
        serieDe(metriques[0], jours, periode.debut, periode.jours),
        serieDe(metriques[1], jours, periode.debut, periode.jours),
      ],
    });
  });

  return { niveau, metriques, elements, places, coches };
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
