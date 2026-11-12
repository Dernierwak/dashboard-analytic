// ── LES GROUPES DE TERMES : DES TERMES DE RECHERCHE AUX GRAPPES ─────────────
//
// Spec `.scratch/google-ads/spec.md`, § « Groupes de termes » ; décision : carte,
// issue 21 (graphe en grappes validé par David le 2026-11-11). Seam testé :
// `.scratch/google-ads/harnais/09-les-groupes-de-termes-mots-cles/`.
//
// Un MODE range les mêmes termes de recherche en grappes. Ce fichier construit
// le mode Mots-clés (un rond par mot-clé déclencheur, ses termes autour) ; le
// mode Clusters Google (ticket 10) produit les mêmes `Grappe` — coût `null`,
// part masquée par grappe, grappes `special` hachurées — et s'ajoute à
// `MODES` sans toucher à l'écran.
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

// ── Les commandes ────────────────────────────────────────────────────────────

/** Le mode Clusters Google (ticket 10) s'ajoutera ici. */
export type ModeGroupes = "mots-cles";
export const MODES: { cle: ModeGroupes; nom: string }[] = [{ cle: "mots-cles", nom: "Mots-clés" }];

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
  | { etat: "non-lu"; phrase: string }
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
    };

export type LectureTermes = {
  /** `null` = la table n'a pas pu être lue. */
  termes: LigneTermeGoogle[] | null;
  debutTermes: string | null;
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
  if (lu.termes === null)
    return { etat: "non-lu", phrase: "Les termes de recherche n'ont pas pu être lus. Les autres chiffres de la page ne sont pas touchés." };

  const mode: ModeGroupes = "mots-cles";
  const taille = TAILLES.find((t) => t.cle === c.gt)?.cle ?? TAILLE_PAR_DEFAUT;
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

  const lignes = lu.termes.filter((l) => dansPeriode(l.date) && dansSelection(l.campagneId));
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
    etat: "lu",
    mode,
    taille,
    campagnes: search.map((x) => ({ cle: x.cle, nom: x.nom })),
    campagne,
    prerempli,
    gcToutes: bandeauSearch ? TOUTES : null,
    campagneInconnue,
    grappes: rangees(grappesMotsCles(lignes, taille), taille),
    totaux,
    masques,
    partMasquee: part,
    raisonMasques: raison,
    termesDepuis: lu.debutTermes,
  };
}
