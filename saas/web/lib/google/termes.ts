// ── LES GROUPES DE TERMES : DES TERMES DE RECHERCHE AUX GRAPPES ─────────────
//
// Spec `.scratch/google-ads/spec.md`, § « Groupes de termes » ; décision : carte,
// issue 21 (graphe en grappes validé par David le 2026-11-11). Seam testé :
// `.scratch/google-ads/harnais/09-les-groupes-de-termes-mots-cles/`.
//
// Un MODE range les mêmes termes de recherche en grappes : Mots-clés (un rond
// par mot-clé déclencheur, ses termes autour, ticket 09) ou Clusters Google
// (un rond par groupe que Google forme, ticket 10 — coût `null`, part masquée
// par grappe, fourre-tout et petits clusters hachurés). Harnais du second :
// `.scratch/google-ads/harnais/10-les-groupes-de-termes-clusters/`.
//
// Sans directive ni import hors des modules purs voisins, comme `lecture.ts` :
// le harnais tourne sous Node seul (`CLAUDE.md` §8 pour la directive).
//
// Les règles tenues, chacune testée :
//   · le jour en cours n'entre dans aucun chiffre (`CLAUDE.md` §7) ;
//   · une métrique que Google n'a pas rendue rend la somme `null` (« — »),
//     jamais un zéro ;
//   · la part masquée se CALCULE (total des campagnes − somme des termes, carte
//     issue 17 : aucun seuil publié, rien à lire), et seulement quand les deux
//     lectures couvrent toute la période — sinon « — » avec la raison ;
//   · aucun « mauvais », aucun « à supprimer » (`CLAUDE.md` §1) : le module
//     montre, le client décide.

import { PALETTE_CAMPAGNES, PASTILLE_NEUTRE, TIRET, cleCampagne, dateCourte, nombre, type Campagne, type LigneGoogle, type Periode } from "./lecture";

/** Une ligne de `google_ads_search_terms` (section 3sexies du `000`), coût déjà
 *  converti des micros (une seule fois, dans `donnees.ts`). */
export type LigneTermeGoogle = {
  date: string;
  campagneId: string;
  groupeId: string;
  /** Tel que Google le rend — minuscules, accents conservés (issue 19). */
  terme: string;
  /** Le mot-clé déclencheur ; `""` = Google n'en a rattaché aucun. */
  motCle: string;
  /** `segments.keyword.info.match_type`, brut (`EXACT`, `PHRASE`, `BROAD`). */
  motCleType: string;
  /** `segments.search_term_match_type`, brut. */
  appariement: string;
  impressions: number | null;
  clics: number | null;
  cout: number | null;
  conversions: number | null;
};

/** Une ligne de `google_ads_search_term_clusters` (section 3septies du `000`) :
 *  un cluster de Google sur sa fenêtre de 90 jours. Aucun coût — Google le
 *  refuse (carte, issue 19). */
export type LigneClusterGoogle = {
  /** `""` = le niveau compte (Search et PMax mêlés). */
  campagneId: string;
  clusterId: string;
  /** `""` = le fourre-tout de Google. */
  libelle: string;
  impressions: number | null;
  clics: number | null;
  conversions: number | null;
  /** Les termes que Google liste — jamais le tout. */
  termes: { texte: string; impressions: number | null; clics: number | null; conversions: number | null }[];
  debut: string;
  fin: string;
};

// ── Les commandes ────────────────────────────────────────────────────────────

export type ModeGroupes = "mots-cles" | "clusters";
export const MODES: { cle: ModeGroupes; nom: string }[] = [
  { cle: "mots-cles", nom: "Mots-clés" },
  { cle: "clusters", nom: "Clusters Google" },
];
/** Les tailles qu'un mode ne peut pas dessiner : Google ne donne pas le coût
 *  d'un cluster (user story 72, le bouton est barré). */
export const TAILLES_SANS_OBJET: Record<ModeGroupes, Taille[]> = { "mots-cles": [], clusters: ["cout"] };

export type Taille = "clics" | "impressions" | "conversions" | "cout";
export const TAILLES: { cle: Taille; nom: string }[] = [
  { cle: "clics", nom: "Clics" },
  { cle: "impressions", nom: "Impressions" },
  { cle: "conversions", nom: "Conversions" },
  { cle: "cout", nom: "Coût" },
];
/** Clics par défaut (issue 21, user story 74). */
export const TAILLE_PAR_DEFAUT: Taille = "clics";

/** Ce que l'URL porte pour le module : `gm` (mode), `gc` (campagne), `gt`
 *  (taille) — et la campagne du Bandeau, qui préremplit `gc`. */
export type CommandesGroupes = { gm?: string; gc?: string; gt?: string; campagne?: string };

/** `gc=toutes` : « Toutes les campagnes » choisi alors que le Bandeau, lui, a
 *  une campagne Search — sans cette valeur, le préremplissage la reprendrait. */
export const TOUTES = "toutes";

// ── Le contenu ───────────────────────────────────────────────────────────────

/** `cout` est `null` quand Google ne le donne pas (un cluster, ticket 10) ;
 *  toute métrique est `null` dès qu'une ligne sommée ne la porte pas. */
export type Chiffres = Record<Taille, number | null>;

export type TermeDeGrappe = { texte: string; chiffres: Chiffres; appariement: string | null };

export type Grappe = {
  id: string;
  libelle: string;
  /** La correspondance du mot-clé (« Expression exacte »…), `null` sans objet. */
  correspondance: string | null;
  chiffres: Chiffres;
  /** Rangés par la taille choisie, du plus gros au plus petit. */
  termes: TermeDeGrappe[];
  /** La part de la grappe que Google n'a pas listée ; `null` = ne se calcule
   *  pas, `raisonMasques` dit pourquoi. */
  masques: Chiffres | null;
  raisonMasques: string | null;
  /** Une grappe qui n'est pas un vrai groupe (sans mot-clé ; fourre-tout et
   *  petits clusters au ticket 10) : hachurée, en dernier, avec sa raison. */
  special: { raison: string } | null;
  /** Les 8 plus grosses ont une couleur, le reste le gris neutre ; `null` pour
   *  une grappe spéciale (hachurée). */
  couleur: string | null;
};

export type GroupesDeTermes =
  | { etat: "sans-search"; phrase: string }
  | { etat: "non-lu"; mode: ModeGroupes; phrase: string }
  | {
      etat: "lu";
      mode: ModeGroupes;
      taille: Taille;
      /** Les campagnes Search de la période, pour le filtre. */
      campagnes: { cle: string; nom: string }[];
      /** `null` = toutes les campagnes Search. */
      campagne: string | null;
      /** La campagne vient du Bandeau, pas d'un choix dans le module. */
      prerempli: boolean;
      /** La valeur de `gc` du lien « Toutes les campagnes ». */
      gcToutes: string | null;
      /** `gc` désigne une campagne qui n'est pas une campagne Search lue. */
      campagneInconnue: boolean;
      grappes: Grappe[];
      /** La somme des termes listés. */
      totaux: Chiffres;
      masques: Chiffres | null;
      /** Part des clics masqués, de 0 à 1 ; `null` quand elle ne se calcule pas. */
      partMasquee: number | null;
      raisonMasques: string | null;
      /** Le plus ancien jour de termes en base ; `null` = jamais récoltés. */
      termesDepuis: string | null;
      /** Mode Clusters : la fenêtre de 90 jours lue pour le niveau affiché ;
       *  `null` = aucun cluster lu pour lui (ou mode Mots-clés). */
      fenetre: { debut: string; fin: string } | null;
      /** Ce qu'il faut savoir pour lire le mode (fenêtre, niveau compte,
       *  langues), une phrase par point. */
      phrases: string[];
    };

export type LectureTermes = {
  /** `null` = la table n'a pas pu être lue. */
  termes: LigneTermeGoogle[] | null;
  debutTermes: string | null;
  /** `null` = la table n'a pas pu être lue. */
  clusters: LigneClusterGoogle[] | null;
  insights: LigneGoogle[];
  campagnes: Campagne[];
  periode: Periode;
  aujourdhui: string;
};

// ── Les libellés de Google Ads ───────────────────────────────────────────────

/** Les mots de l'interface Google Ads en français. */
const CORRESPONDANCES: Record<string, string> = {
  EXACT: "Mot clé exact",
  PHRASE: "Expression exacte",
  BROAD: "Requête large",
};
/** Valeurs réelles relevées : EXACT, NEAR_EXACT, PHRASE, NEAR_PHRASE, BROAD
 *  (issue 19). Une valeur inconnue s'affiche brute, jamais devinée. */
const APPARIEMENTS: Record<string, string> = {
  EXACT: "Exact",
  NEAR_EXACT: "Exact (variante proche)",
  PHRASE: "Expression",
  NEAR_PHRASE: "Expression (variante proche)",
  BROAD: "Large",
};
const libelle = (table: Record<string, string>, brut: string) => (brut ? table[brut] ?? brut : null);

/** Un chiffre du module. Coût et impressions entiers : la grappe se lit d'un
 *  coup d'œil, le Tableau détaillé porte les centimes. `null` → « — ». */
export function chiffre(t: Taille, v: number | null): string {
  if (v === null) return TIRET;
  if (t === "conversions") return Number.isInteger(v) ? nombre(v) : nombre(v, 1);
  return nombre(Math.round(v));
}

// ── Les sommes ───────────────────────────────────────────────────────────────

const zero = (): Chiffres => ({ clics: 0, impressions: 0, conversions: 0, cout: 0 });

function ajouter(a: Chiffres, b: Chiffres): void {
  for (const t of TAILLES) {
    const x = a[t.cle];
    const y = b[t.cle];
    a[t.cle] = x === null || y === null ? null : x + y;
  }
}

const chiffresDe = (l: LigneTermeGoogle): Chiffres => ({ clics: l.clics, impressions: l.impressions, conversions: l.conversions, cout: l.cout });

/** `null` passe derrière tout : on ne range pas ce qu'on n'a pas mesuré. */
const parTaille = (t: Taille) => (a: { chiffres: Chiffres }, b: { chiffres: Chiffres }) => (b.chiffres[t] ?? -1) - (a.chiffres[t] ?? -1);

const SANS_MOT_CLE = "Sans mot-clé déclencheur";
const RAISON_SANS_MOT_CLE = "Google n'a rattaché ces recherches à aucun mot-clé de la campagne.";
const RAISON_MASQUES_MOT_CLE =
  "Google ne donne pas le total d'un mot-clé ici : la part masquée se calcule pour la campagne entière, dans la ligne de totaux.";

/** Les grappes du mode Mots-clés : un rond par mot-clé (texte et correspondance,
 *  tous groupes d'annonces confondus — c'est ce que le client a écrit), ses
 *  termes sommés sur la période. */
function grappesMotsCles(lignes: LigneTermeGoogle[], taille: Taille): Omit<Grappe, "couleur">[] {
  const parMot = new Map<string, { motCle: string; type: string; chiffres: Chiffres; termes: Map<string, { chiffres: Chiffres; appariements: Set<string> }> }>();
  for (const l of lignes) {
    const cle = `${l.motCle}\u0000${l.motCle ? l.motCleType : ""}`;
    let g = parMot.get(cle);
    if (!g) parMot.set(cle, (g = { motCle: l.motCle, type: l.motCle ? l.motCleType : "", chiffres: zero(), termes: new Map() }));
    ajouter(g.chiffres, chiffresDe(l));
    let t = g.termes.get(l.terme);
    if (!t) g.termes.set(l.terme, (t = { chiffres: zero(), appariements: new Set() }));
    ajouter(t.chiffres, chiffresDe(l));
    if (l.appariement) t.appariements.add(l.appariement);
  }
  return [...parMot].map(([cle, g]) => ({
    id: cle,
    libelle: g.motCle || SANS_MOT_CLE,
    correspondance: libelle(CORRESPONDANCES, g.type),
    chiffres: g.chiffres,
    termes: [...g.termes]
      .map(([texte, t]) => ({
        texte,
        chiffres: t.chiffres,
        appariement: [...t.appariements].map((a) => libelle(APPARIEMENTS, a)).join(" · ") || null,
      }))
      .sort((a, b) => parTaille(taille)(a, b) || a.texte.localeCompare(b.texte, "fr")),
    masques: null,
    raisonMasques: RAISON_MASQUES_MOT_CLE,
    special: g.motCle ? null : { raison: RAISON_SANS_MOT_CLE },
  }));
}

// ── Le mode Clusters Google ─────────────────────────────────────────────────

const SANS_CLUSTER = "Sans cluster";
const RAISON_SANS_CLUSTER = "Les recherches que Google n'a rangées dans aucun cluster. Il n'en liste aucune : tout y est masqué.";
/** Chez A, 625 des 959 clusters du compte ont 5 clics ou moins sur 90 jours
 *  (carte, issue 19) : dessinés un par un, ils noieraient le graphe. */
const SEUIL_PETIT_CLUSTER = 5;
const raisonPetits = (n: number) =>
  `${n} ${n > 1 ? "clusters" : "cluster"} de ${SEUIL_PETIT_CLUSTER} clics ou moins, regroupés pour que le graphe reste lisible.`;
const RAISON_DEPASSE = "Les termes listés dépassent le total du cluster : la part masquée ne se calcule pas.";
const PHRASE_LANGUE =
  "Google forme un cluster par sujet et par langue : un même sujet cherché en français, en allemand et en anglais fait trois clusters.";
const PHRASE_COMPTE =
  "« Toutes les campagnes » lit les clusters du compte entier, où Google mêle Search et Performance Max : ce total ne se compare pas au mode Mots-clés.";

const chiffresCluster = (x: { clics: number | null; impressions: number | null; conversions: number | null }): Chiffres => ({
  clics: x.clics,
  impressions: x.impressions,
  conversions: x.conversions,
  cout: null,
});

/** Total du cluster − termes listés, métrique par métrique ; `null` dès qu'un
 *  terme dépasse le total (les deux chiffres ne parlent plus de la même chose). */
function masquesDe(total: Chiffres, listes: Chiffres, nTermes: number): Chiffres | null {
  const tolerance = TOLERANCE_PAR_LIGNE * Math.max(1, nTermes);
  const m = zero();
  for (const { cle } of TAILLES) {
    const t = total[cle];
    const l = listes[cle];
    if (t === null || l === null) {
      m[cle] = null;
      continue;
    }
    if (t - l < -tolerance) return null;
    m[cle] = Math.max(0, t - l);
  }
  return m;
}

function grappeDeClusters(id: string, libelleGrappe: string, membres: LigneClusterGoogle[], special: Grappe["special"], taille: Taille): Omit<Grappe, "couleur"> {
  const chiffres = zero();
  const termes = new Map<string, Chiffres>();
  let nTermes = 0;
  for (const m of membres) {
    ajouter(chiffres, chiffresCluster(m));
    for (const t of m.termes) {
      nTermes++;
      const deja = termes.get(t.texte);
      if (deja) ajouter(deja, chiffresCluster(t));
      else termes.set(t.texte, chiffresCluster(t));
    }
  }
  const listes = zero();
  for (const c of termes.values()) ajouter(listes, c);
  listes.cout = null;
  const masques = masquesDe(chiffres, listes, nTermes);
  return {
    id,
    libelle: libelleGrappe,
    correspondance: null,
    chiffres,
    termes: [...termes]
      .map(([texte, c]) => ({ texte, chiffres: c, appariement: null }))
      .sort((a, b) => parTaille(taille)(a, b) || a.texte.localeCompare(b.texte, "fr")),
    masques,
    raisonMasques: masques ? null : RAISON_DEPASSE,
    special,
  };
}

/** Un rond par cluster ; les petits (≤ 5 clics) en une grappe, puis le
 *  fourre-tout — tous deux hachurés, en dernier (user story 78). Un cluster
 *  aux clics non rendus n'est pas déclaré petit : on ne le sait pas. */
function grappesClusters(lignes: LigneClusterGoogle[], taille: Taille): Omit<Grappe, "couleur">[] {
  const fourreTout = lignes.filter((l) => l.libelle === "");
  const petits = lignes.filter((l) => l.libelle !== "" && l.clics !== null && l.clics <= SEUIL_PETIT_CLUSTER);
  const vrais = lignes.filter((l) => l.libelle !== "" && !(l.clics !== null && l.clics <= SEUIL_PETIT_CLUSTER));
  const grappes = vrais.map((l) => grappeDeClusters(l.clusterId, l.libelle, [l], null, taille));
  if (petits.length)
    grappes.push(
      grappeDeClusters("petits", `${petits.length} ${petits.length > 1 ? "petits clusters" : "petit cluster"}`, petits, { raison: raisonPetits(petits.length) }, taille)
    );
  if (fourreTout.length) grappes.push(grappeDeClusters("sans-cluster", SANS_CLUSTER, fourreTout, { raison: RAISON_SANS_CLUSTER }, taille));
  return grappes;
}

/** Les lignes du niveau affiché, de son dernier passage seulement : un cluster
 *  absent du dernier passage garde en base sa ligne et son ancienne fenêtre. */
function dernierPassage(clusters: LigneClusterGoogle[], niveau: string): { lignes: LigneClusterGoogle[]; fenetre: { debut: string; fin: string } | null } {
  const du = clusters.filter((l) => l.campagneId === niveau);
  if (du.length === 0) return { lignes: [], fenetre: null };
  const fin = du.reduce((m, l) => (l.fin > m ? l.fin : m), du[0].fin);
  const debut = du.filter((l) => l.fin === fin).reduce((m, l) => (l.debut > m ? l.debut : m), "");
  return { lignes: du.filter((l) => l.fin === fin && l.debut === debut), fenetre: { debut, fin } };
}

const JOUR_MS = 86_400_000;
const dateLongue = (iso: string) => `${dateCourte(iso)} ${iso.slice(0, 4)}`;

function phraseFenetre(f: { debut: string; fin: string }, p: Periode): string | null {
  if (f.debut === p.debut && f.fin === p.fin) return null;
  const jours = Math.round((Date.parse(`${f.fin}T00:00:00Z`) - Date.parse(`${f.debut}T00:00:00Z`)) / JOUR_MS) + 1;
  return `Clusters lus sur ${jours} jours, du ${dateLongue(f.debut)} au ${dateLongue(f.fin)}, pas sur la période choisie : Google ne les donne pas jour par jour.`;
}

/** Rangées par la taille, les spéciales en dernier ; 8 couleurs aux plus
 *  grosses (la palette validée des campagnes), le reste gris. */
function rangees(grappes: Omit<Grappe, "couleur">[], taille: Taille): Grappe[] {
  const vraies = grappes.filter((g) => !g.special).sort((a, b) => parTaille(taille)(a, b) || a.libelle.localeCompare(b.libelle, "fr"));
  const speciales = grappes.filter((g) => g.special);
  return [
    ...vraies.map((g, i) => ({ ...g, couleur: PALETTE_CAMPAGNES[i] ?? PASTILLE_NEUTRE })),
    ...speciales.map((g) => ({ ...g, couleur: null })),
  ];
}

/** L'arrondi `numeric` des conversions par ligne d'insights (ticket 03) : un
 *  écart plus petit n'est pas une part masquée négative, c'est zéro. */
const TOLERANCE_PAR_LIGNE = 0.005;

function partMasquee(
  totaux: Chiffres,
  insights: LigneGoogle[],
  couverte: string | null
): { masques: Chiffres | null; part: number | null; raison: string | null } {
  if (couverte) return { masques: null, part: null, raison: couverte };
  const camp: Record<Taille, number> = { clics: 0, impressions: 0, conversions: 0, cout: 0 };
  for (const l of insights) {
    camp.clics += l.clics;
    camp.impressions += l.impressions;
    camp.conversions += l.conversions;
    camp.cout += l.cout;
  }
  const tolerance = TOLERANCE_PAR_LIGNE * Math.max(1, insights.length);
  const masques = zero();
  for (const { cle } of TAILLES) {
    const liste = totaux[cle];
    if (liste === null) {
      masques[cle] = null;
      continue;
    }
    const reste = camp[cle] - liste;
    if (reste < -tolerance)
      return {
        masques: null,
        part: null,
        raison: "Les termes dépassent le total des campagnes : les deux lectures ne couvrent pas les mêmes jours.",
      };
    masques[cle] = Math.max(0, reste);
  }
  return { masques, part: masques.clics === null || camp.clics === 0 ? null : masques.clics / camp.clics, raison: null };
}

const TYPE_SEARCH = "SEARCH";

export function groupesDeTermes(lu: LectureTermes, c: CommandesGroupes): GroupesDeTermes {
  const { periode, aujourdhui } = lu;
  // Les campagnes Search qui ont tourné sur la période (`cout` non nul = au
  // moins une ligne d'insights dans la période).
  const search = lu.campagnes.filter((x) => x.type?.brut === TYPE_SEARCH && x.cout !== null);
  if (search.length === 0)
    return { etat: "sans-search", phrase: "Aucune campagne Search sur la période : il n'y a pas de recherches à montrer." };
  const mode: ModeGroupes = MODES.find((m) => m.cle === c.gm)?.cle ?? "mots-cles";
  if (mode === "mots-cles" && lu.termes === null)
    return { etat: "non-lu", mode, phrase: "Les termes de recherche n'ont pas pu être lus. Les autres chiffres de la page ne sont pas touchés." };
  if (mode === "clusters" && !lu.clusters)
    return { etat: "non-lu", mode, phrase: "Les clusters de Google n'ont pas pu être lus. Les autres chiffres de la page ne sont pas touchés." };

  const demandee = TAILLES.find((t) => t.cle === c.gt)?.cle;
  const taille = demandee && !TAILLES_SANS_OBJET[mode].includes(demandee) ? demandee : TAILLE_PAR_DEFAUT;
  const cles = new Set(search.map((x) => x.cle));
  const bandeauSearch = c.campagne && cles.has(c.campagne) ? c.campagne : null;

  let campagne: string | null = null;
  let campagneInconnue = false;
  if (c.gc && c.gc !== TOUTES) {
    if (cles.has(c.gc)) campagne = c.gc;
    else campagneInconnue = true;
  } else if (!c.gc) campagne = bandeauSearch;
  const prerempli = !c.gc && campagne !== null;
  const dansSelection = (id: string | null) => !campagneInconnue && id !== null && (campagne ? id === campagne : cles.has(id));
  const dansPeriode = (d: string) => d >= periode.debut && d <= periode.fin && d < aujourdhui;

  const commun = {
    etat: "lu" as const,
    mode,
    taille,
    campagnes: search.map((x) => ({ cle: x.cle, nom: x.nom })),
    campagne,
    prerempli,
    gcToutes: bandeauSearch ? TOUTES : null,
    campagneInconnue,
    termesDepuis: lu.debutTermes,
  };
  if (mode === "clusters") return { ...commun, ...contenuClusters(campagneInconnue ? [] : lu.clusters ?? [], campagne, periode, taille) };

  const lignes = (lu.termes ?? []).filter((l) => dansPeriode(l.date) && dansSelection(l.campagneId));
  const insights = lu.insights.filter((l) => dansPeriode(l.date) && dansSelection(cleCampagne(l)));
  const totaux = zero();
  for (const l of lignes) ajouter(totaux, chiffresDe(l));

  const couverte = !lu.debutTermes
    ? "Les termes de recherche n'ont pas encore été récoltés."
    : lu.debutTermes > periode.debut
      ? `Les termes de recherche ne sont lus que depuis le ${dateCourte(lu.debutTermes)} ${lu.debutTermes.slice(0, 4)} : la part masquée de la période ne se calcule pas.`
      : null;
  const { masques, part, raison } = partMasquee(totaux, insights, couverte);

  return {
    ...commun,
    grappes: rangees(grappesMotsCles(lignes, taille), taille),
    totaux,
    masques,
    partMasquee: part,
    raisonMasques: raison,
    fenetre: null,
    phrases: [],
  };
}

/** Le contenu du mode Clusters : la campagne choisie, ou le niveau compte pour
 *  « Toutes les campagnes » (spec, Further Notes 2). La fenêtre est celle de la
 *  récolte (90 jours pleins), pas la période du Bandeau (Further Notes 1). */
function contenuClusters(clusters: LigneClusterGoogle[], campagne: string | null, periode: Periode, taille: Taille) {
  const { lignes, fenetre } = dernierPassage(clusters, campagne ?? "");
  const grappes = rangees(grappesClusters(lignes, taille), taille);
  const totaux = zero();
  const total = zero();
  let masques: Chiffres | null = zero();
  for (const g of grappes) {
    for (const t of g.termes) ajouter(totaux, t.chiffres);
    ajouter(total, g.chiffres);
    if (masques) {
      if (g.masques) ajouter(masques, g.masques);
      else masques = null;
    }
  }
  totaux.cout = null;
  const phrases = [fenetre && phraseFenetre(fenetre, periode), campagne === null ? PHRASE_COMPTE : null, PHRASE_LANGUE].filter((p): p is string => !!p);
  return {
    grappes,
    totaux,
    masques,
    partMasquee: masques?.clics == null || !total.clics ? null : masques.clics / total.clics,
    raisonMasques: masques ? null : RAISON_DEPASSE,
    fenetre,
    phrases,
  };
}
