// PROTOTYPE JETABLE — ticket « L'Analyse Search en maquette »
// (.scratch/google-ads/issues/20-l-analyse-search-en-maquette.md). Vit sur la
// branche `prototype/analyse-search`, jamais sur `main`.
//
// Données FICTIVES : une location de vélos électriques inventée, 12 campagnes
// Search (plus de 8, pour éprouver la règle des couleurs). Les proportions
// suivent l'essai réel (ticket 19) : ~44 % des clics sur des termes masqués,
// éléments servis ensemble (≈ 5 fois les clics de l'annonce), catégories sans
// coût, niveau de qualité absent pour plus de la moitié des mots-clés.

export type SP = Record<string, string | string[] | undefined>;
export const un = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
export const tous = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** Un lien n'énumère que ce qu'il CHANGE (`CLAUDE.md` §8). */
export function lien(sp: SP, patch: Record<string, string | string[] | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (!(k in patch)) tous(v).forEach((x) => q.append(k, x));
  for (const [k, v] of Object.entries(patch)) tous(v).forEach((x) => q.append(k, x));
  return `/google?${q.toString()}#analyse`;
}

export type Vue = "notoriete" | "trafic" | "conversion";
export type Niveau = "campagnes" | "groupes" | "annonces" | "elements";
export const NIVEAUX: { cle: Niveau; nom: string; un: string }[] = [
  { cle: "campagnes", nom: "Campagnes", un: "campagne" },
  { cle: "groupes", nom: "Groupes d'annonces", un: "groupe d'annonces" },
  { cle: "annonces", nom: "Annonces", un: "annonce" },
  { cle: "elements", nom: "Éléments", un: "élément" },
];

// ── Actions de conversion ────────────────────────────────────────────────────
// La leçon du ticket 19 : ce que Google compte se lit par campagne, pas dans le
// drapeau « principale ». Une action non principale peut compter quand même.
export type Action = { id: string; nom: string; principale: boolean; compteePar: number; part: number };
export const ACTIONS: Action[] = [
  { id: "resa", nom: "Réservation en ligne", principale: true, compteePar: 12, part: 0.46 },
  { id: "appel", nom: "Appel depuis l'annonce", principale: true, compteePar: 12, part: 0.14 },
  { id: "groupe", nom: "Demande de devis groupe", principale: true, compteePar: 9, part: 0.08 },
  { id: "tarifs", nom: "Page des tarifs vue", principale: false, compteePar: 3, part: 0.32 },
];
export const actionsChoisies = (sp: SP) => {
  const a = tous(sp.act).filter((x) => ACTIONS.some((y) => y.id === x));
  if (tous(sp.act).includes("_")) return [];
  return a.length ? a : ACTIONS.filter((x) => x.compteePar > 0).map((x) => x.id);
};
export const partActions = (ids: string[]) => ACTIONS.filter((a) => ids.includes(a.id)).reduce((s, a) => s + a.part, 0);

// ── L'arbre campagnes › groupes › annonces › éléments ────────────────────────
export type Chiffres = { impressions: number; clics: number; cout: number; conversions: number };
export type Noeud = { id: string; nom: string; niveau: Niveau; campagne: string; parent?: string; c: Chiffres; texte?: string; genre?: "Titre" | "Description" };

function bruit(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
const graine = (s: string) => [...s].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) % 100000;

const CAMPAGNES_BRUTES: [string, number, number, number, number][] = [
  // nom, impressions, clics, coût CHF, conversions (28 jours)
  ["Marque", 9800, 2450, 610, 96],
  ["Location vélo — Lausanne", 31200, 2180, 1690, 61],
  ["E-bike — Riviera", 24400, 1310, 1240, 38],
  ["Tours guidés Lavaux", 18900, 1120, 980, 44],
  ["Vélo cargo", 7600, 410, 520, 9],
  ["Familles et enfants", 11800, 690, 470, 17],
  ["Velomiete — DE", 14500, 760, 690, 15],
  ["Bike rental — EN", 16300, 940, 830, 27],
  ["Groupes et entreprises", 5200, 210, 380, 11],
  ["Concurrents", 8900, 330, 610, 4],
  ["Automne — saisonnier", 6100, 380, 290, 8],
  ["Itinéraires et cartes", 12600, 520, 210, 3],
];

const GROUPES: Record<string, string[]> = {
  "Marque": ["Nom de marque", "Marque + ville"],
  "Location vélo — Lausanne": ["Location vélo", "Location à l'heure", "Vélo électrique Lausanne"],
  "E-bike — Riviera": ["E-bike Montreux", "E-bike Vevey"],
  "Tours guidés Lavaux": ["Tour guidé", "Lavaux à vélo", "Dégustation à vélo"],
  "Vélo cargo": ["Cargo"],
  "Familles et enfants": ["Vélo enfant", "Siège enfant"],
  "Velomiete — DE": ["Velomiete", "E-Bike mieten"],
  "Bike rental — EN": ["Bike rental", "E-bike tour"],
  "Groupes et entreprises": ["Sortie d'équipe"],
  "Concurrents": ["Concurrents"],
  "Automne — saisonnier": ["Automne"],
  "Itinéraires et cartes": ["Itinéraires", "Cartes vélo"],
};

const TITRES = ["Location de vélos électriques", "Réservez en 2 minutes", "Dès 25 CHF la demi-journée", "Au bord du lac", "Casque et antivol inclus", "Ouvert 7 jours sur 7"];
const DESCRIPTIONS = ["Vélos récents, batterie pleine, itinéraires offerts.", "Réservation en ligne, annulation gratuite jusqu'à la veille."];

function partager(total: Chiffres, n: number, s: number): Chiffres[] {
  const poids = Array.from({ length: n }, (_, i) => 0.4 + bruit(s + i * 3.1));
  const somme = poids.reduce((a, b) => a + b, 0);
  return poids.map((p, i) => {
    const k = p / somme;
    const q = 0.75 + bruit(s + i * 7.7) * 0.5; // les taux varient d'un enfant à l'autre
    return { impressions: total.impressions * k, clics: total.clics * k * q, cout: total.cout * k * (0.8 + bruit(s + i) * 0.4), conversions: total.conversions * k * q * (0.6 + bruit(s + i * 2) * 0.8) };
  });
}

export const NOEUDS: Noeud[] = [];
CAMPAGNES_BRUTES.forEach(([nom, impressions, clics, cout, conversions], ci) => {
  const cid = `c${ci}`;
  const c = { impressions, clics, cout, conversions };
  NOEUDS.push({ id: cid, nom, niveau: "campagnes", campagne: cid, c });
  const gs = GROUPES[nom];
  partager(c, gs.length, graine(nom)).forEach((gc, gi) => {
    const gid = `${cid}g${gi}`;
    NOEUDS.push({ id: gid, nom: gs[gi], niveau: "groupes", campagne: cid, parent: cid, c: gc });
    partager(gc, 2, graine(gid)).forEach((ac, ai) => {
      const aid = `${gid}a${ai}`;
      NOEUDS.push({ id: aid, nom: `Annonce responsive ${ai + 1}`, niveau: "annonces", campagne: cid, parent: gid, c: ac });
      // Chaque élément est compté à chaque fois que l'annonce le sert : leur
      // somme dépasse l'annonce (≈ 5 fois chez A, ticket 19).
      [...TITRES.slice(0, 4 + ai), ...DESCRIPTIONS].forEach((tx, ei) => {
        const k = 0.55 + bruit(graine(aid) + ei) * 0.45;
        const genre = ei < 4 + ai ? "Titre" : "Description";
        NOEUDS.push({ id: `${aid}e${ei}`, nom: tx, texte: tx, genre, niveau: "elements", campagne: cid, parent: aid,
          c: { impressions: ac.impressions * k, clics: ac.clics * k * (0.85 + bruit(ei) * 0.3), cout: ac.cout * k, conversions: ac.conversions * k } });
      });
    });
  });
});
export const CAMPAGNES = NOEUDS.filter((n) => n.niveau === "campagnes");
export const nomCampagne = (id: string) => CAMPAGNES.find((c) => c.id === id)?.nom ?? id;
export const parId = (id: string) => NOEUDS.find((n) => n.id === id);
export const enfantsDe = (id: string) => NOEUDS.filter((n) => n.parent === id);
export const RANG_COUT = [...CAMPAGNES].sort((a, b) => b.c.cout - a.c.cout).map((c) => c.id);

// ── Mots-clés, termes, catégories ────────────────────────────────────────────
export type MotCle = { id: string; texte: string; correspondance: "Exacte" | "Expression"; campagne: string; groupe: string; qualite: number | null; c: Chiffres | null; termes: number; partIdentique: number };
const MC_BRUTS: [string, "Exacte" | "Expression", number, number, number | null][] = [
  // texte, correspondance, index du groupe (dans NOEUDS groupes), part des clics du groupe, niveau de qualité
  ["[nom de marque]", "Exacte", 0, 0.9, 9], ["location vélo lausanne", "Expression", 2, 0.6, 7], ["vélo électrique location", "Expression", 2, 0.4, null],
  ["location vélo à l'heure", "Exacte", 3, 0.7, 6], ["e-bike lausanne", "Expression", 4, 0.8, null], ["location e-bike montreux", "Expression", 5, 0.9, 8],
  ["e-bike vevey", "Exacte", 6, 0.8, null], ["tour guidé vélo", "Expression", 7, 0.7, 5], ["lavaux à vélo", "Expression", 8, 0.9, 7],
  ["dégustation vélo lavaux", "Exacte", 9, 0.8, null], ["vélo cargo location", "Expression", 10, 0.9, 4], ["vélo enfant location", "Expression", 11, 0.7, null],
  ["siège enfant vélo", "Exacte", 12, 0.6, null], ["velomiete lausanne", "Expression", 13, 0.8, 6], ["e-bike mieten genfersee", "Expression", 14, 0.9, null],
  ["bike rental lausanne", "Expression", 15, 0.8, 7], ["e-bike tour lake geneva", "Expression", 16, 0.8, null], ["sortie d'équipe vélo", "Expression", 17, 0.9, 5],
  ["[concurrent] location", "Expression", 18, 0.9, 3], ["balade vélo automne", "Expression", 19, 0.9, null], ["itinéraire vélo lavaux", "Expression", 20, 0.7, null],
  ["carte vélo riviera", "Expression", 21, 0.8, null], ["vélo électrique tandem", "Exacte", 3, 0, null], ["location vtt lausanne", "Expression", 2, 0, null],
];
const GROUPES_NOEUDS = NOEUDS.filter((n) => n.niveau === "groupes");
export const MOTS_CLES: MotCle[] = MC_BRUTS.map(([texte, correspondance, gi, part, qualite], i) => {
  const g = GROUPES_NOEUDS[gi % GROUPES_NOEUDS.length];
  const s = graine(texte);
  const c = part === 0 ? null : { impressions: g.c.impressions * part, clics: g.c.clics * part, cout: g.c.cout * part, conversions: g.c.conversions * part };
  return { id: `k${i}`, texte, correspondance, campagne: g.campagne, groupe: g.id, qualite, c,
    termes: c ? Math.max(1, Math.round((correspondance === "Exacte" ? 2 : 6) + bruit(s) * (correspondance === "Exacte" ? 6 : 60))) : 0,
    partIdentique: c ? (correspondance === "Exacte" ? 0.55 + bruit(s + 1) * 0.4 : bruit(s + 2) * 0.35) : 0 };
});

export type Terme = { texte: string; motCle: string; appariement: "EXACT" | "NEAR_EXACT" | "PHRASE" | "NEAR_PHRASE"; exclu: boolean; c: Chiffres };
const SUFFIXES = ["", " prix", " pas cher", " gratuit", " ouvert dimanche", " avis", " réservation", " horaires", " demi-journée", " week-end"];
export const TERMES: Terme[] = MOTS_CLES.filter((k) => k.c).flatMap((k) => {
  const n = Math.min(5, Math.max(1, Math.round(k.termes / 6)));
  const base = k.texte.replace(/[[\]]/g, "");
  return Array.from({ length: n }, (_, j) => {
    const s = graine(k.texte) + j * 11;
    const part = j === 0 ? k.partIdentique * 0.56 : (1 - k.partIdentique) * 0.56 * (0.15 + bruit(s) * 0.3);
    const conv = SUFFIXES[(s + j) % SUFFIXES.length] === " gratuit" ? 0 : k.c!.conversions * part * (0.3 + bruit(s + 4) * 1.2);
    return { texte: j === 0 ? base : base + SUFFIXES[(s + j) % SUFFIXES.length], motCle: k.id,
      appariement: j === 0 ? "EXACT" : k.correspondance === "Exacte" ? "NEAR_EXACT" : bruit(s + 3) > 0.7 ? "PHRASE" : "NEAR_PHRASE",
      exclu: j > 0 && bruit(s + 5) > 0.9,
      c: { impressions: k.c!.impressions * part, clics: k.c!.clics * part, cout: k.c!.cout * part, conversions: conv } } as Terme;
  });
}).sort((a, b) => b.c.cout - a.c.cout);
export const CLICS_SEARCH = CAMPAGNES.reduce((s, c) => s + c.c.clics, 0);
export const CLICS_TERMES = TERMES.reduce((s, t) => s + t.c.clics, 0);

export type Categorie = { id: string; libelle: string; impressions: number; clics: number; conversions: number; termes: string[] };
export const CATEGORIES: Categorie[] = [
  { id: "x1", libelle: "location vélo électrique lausanne", impressions: 22100, clics: 1890, conversions: 58, termes: ["location vélo électrique lausanne", "louer e-bike lausanne", "vélo électrique à louer lausanne"] },
  { id: "x2", libelle: "lavaux à vélo", impressions: 14300, clics: 1020, conversions: 39, termes: ["lavaux à vélo", "balade vélo lavaux", "tour lavaux vélo électrique"] },
  { id: "x3", libelle: "bike rental lausanne", impressions: 9800, clics: 640, conversions: 19, termes: ["bike rental lausanne", "e-bike hire lausanne", "rent a bike lausanne"] },
  { id: "x4", libelle: "velomiete lausanne", impressions: 8400, clics: 470, conversions: 11, termes: ["velomiete lausanne", "e-bike mieten lausanne"] },
  { id: "x5", libelle: "location vélo prix", impressions: 6900, clics: 410, conversions: 9, termes: ["location vélo prix", "tarif location vélo", "prix e-bike journée"] },
  { id: "x6", libelle: "vélo gratuit lausanne", impressions: 3100, clics: 160, conversions: 0, termes: ["vélo gratuit lausanne", "prêt vélo gratuit", "vélo libre service gratuit"] },
  { id: "x7", libelle: "free bike lausanne", impressions: 1200, clics: 70, conversions: 0, termes: ["free bike lausanne", "free bike rental"] },
  { id: "x8", libelle: "velo gratis lausanne", impressions: 700, clics: 30, conversions: 0, termes: ["velo gratis lausanne"] },
  { id: "x9", libelle: "vélo cargo", impressions: 2600, clics: 150, conversions: 4, termes: ["vélo cargo location", "vélo cargo lausanne"] },
  { id: "x0", libelle: "", impressions: 11200, clics: 1350, conversions: 21, termes: [] },
];

// ── Métriques et axes du nuage, selon la vue ─────────────────────────────────
export const entier = (v: number) => Math.round(v).toLocaleString("fr-CH");
export const chf = (v: number) => `${v.toLocaleString("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF`;
export const chf0 = (v: number) => `${Math.round(v).toLocaleString("fr-CH")} CHF`;
export const pct = (v: number) => `${(v * 100).toLocaleString("fr-CH", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
export const conv1 = (v: number) => v.toLocaleString("fr-CH", { maximumFractionDigits: 1 });

export type Axe = { nom: string; v: (c: Chiffres, part: number) => number | null; fmt: (v: number) => string };
export const AXES: Record<Vue, { x: Axe; y: Axe; r?: Axe }> = {
  notoriete: {
    x: { nom: "Impressions", v: (c) => c.impressions, fmt: entier },
    y: { nom: "CPM", v: (c) => (c.impressions ? (c.cout / c.impressions) * 1000 : null), fmt: chf },
  },
  trafic: {
    x: { nom: "Clics", v: (c) => c.clics, fmt: entier },
    y: { nom: "CTR", v: (c) => (c.impressions ? c.clics / c.impressions : null), fmt: pct },
    r: { nom: "Coût", v: (c) => c.cout, fmt: chf0 },
  },
  conversion: {
    x: { nom: "Coût", v: (c) => c.cout, fmt: chf0 },
    y: { nom: "Conversions", v: (c, part) => c.conversions * part, fmt: conv1 },
    r: { nom: "Clics", v: (c) => c.clics, fmt: entier },
  },
};
export const AXES_ETENDUE = {
  x: { nom: "Termes différents attrapés", fmt: entier },
  y: { nom: "Part des clics venant du terme au texte identique", fmt: pct },
  r: { nom: "Coût", fmt: chf0 },
};

// Palette catégorielle du produit (Comparaison Meta) prolongée à 8 teintes.
export const PALETTE = ["#1a56ff", "#e08b1a", "#7b4fff", "#0d9aa8", "#d6457a", "#5b8c2a", "#8a5a2b", "#3a3f4b"];
export const GRIS = "#c9c6bd";
