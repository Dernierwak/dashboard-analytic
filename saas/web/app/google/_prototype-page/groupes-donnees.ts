// PROTOTYPE JETABLE — ticket « Les groupes de termes de recherche »
// (.scratch/google-ads/issues/21-les-groupes-de-termes-de-recherche.md). Vit sur
// la branche `prototype/groupes-de-termes`, jamais sur `main`.
//
// Données FICTIVES (location de vélos inventée, 6 campagnes Search). Les MÊMES
// termes de recherche se rangent de deux façons :
// - sous leur MOT-CLÉ déclencheur (`search_term_view`, ticket 17) : clics,
//   impressions, conversions ET coût ;
// - sous le CLUSTER de Google (`campaign_search_term_insight` /
//   `customer_search_term_insight`, ticket 19) : clics, impressions,
//   conversions, PAS de coût.
// Proportions de l'essai réel (ticket 19) : une catégorie = un sujet ET une
// langue ; « gratuit » ressort en morceaux, collé à un sujet ; les termes
// listés ne font pas le total (le reste est masqué par Google) ; un cluster
// fourre-tout au libellé vide, ≈ 16 % des clics, sans terme ; une longue traîne
// (les deux tiers des clusters à ≤ 5 clics) ; 44 à 61 % des clics Search sur des
// termes masqués côté mots-clés.

export type Taille = "clics" | "impressions" | "conversions" | "cout";
export const TAILLES: { cle: Taille; nom: string }[] = [
  { cle: "clics", nom: "Clics" },
  { cle: "impressions", nom: "Impressions" },
  { cle: "conversions", nom: "Conversions" },
  { cle: "cout", nom: "Coût" },
];
/** `cout` est null pour un cluster : Google ne le donne pas (ticket 19). */
export type Chiffres = { clics: number; impressions: number; conversions: number; cout: number | null };
export type TermeG = { texte: string; c: Chiffres };
export type Mode = "mots-cles" | "clusters";
export type Correspondance = "Exacte" | "Expression" | "Large";
export type Cat = { id: string; libelle: string; c: Chiffres; termes: TermeG[]; listes: Chiffres; fourreTout?: boolean; traine?: number; correspondance?: Correspondance };

function bruit(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
const graine = (s: string) => [...s].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) % 100000;

// Clusters : libellé, clics, taux de conversion, [terme, clics]…
type Brute = [string, number, number, [string, number][]];
// Mots-clés : texte, correspondance, mots qui le déclenchent (vide = attrape le reste).
type MotBrut = [string, Correspondance, string[]];
type CampagneG = { id: string; nom: string; cats: Brute[]; fourreTout: number; traine: [number, number]; mots: MotBrut[] };

const CAMPAGNES_G: CampagneG[] = [
  {
    id: "c0", nom: "Marque", fourreTout: 260, traine: [34, 70],
    cats: [
      ["[nom de marque]", 1590, 0.05, [["[nom de marque]", 980], ["[nom de marque] vélo", 140], ["[nom de marque] location", 120]]],
      ["[nom de marque] avis", 210, 0.03, [["[nom de marque] avis", 120], ["avis [nom de marque] lausanne", 30]]],
      ["[nom de marque] horaires", 180, 0.02, [["[nom de marque] horaires", 90], ["[nom de marque] ouvert dimanche", 35]]],
      ["[nom de marque] lausanne", 140, 0.04, [["[nom de marque] lausanne", 80], ["[nom de marque] ouchy", 20]]],
    ],
    mots: [["[nom de marque]", "Exacte", ["=[nom de marque]"]], ["nom de marque avis", "Expression", ["avis"]], ["nom de marque", "Large", []]],
  },
  {
    id: "c1", nom: "Location vélo — Lausanne", fourreTout: 330, traine: [41, 90],
    cats: [
      ["location vélo électrique lausanne", 820, 0.035, [["location vélo électrique lausanne", 240], ["louer e-bike lausanne", 120], ["vélo électrique à louer lausanne", 80], ["vélo électrique lausanne location", 45], ["e-bike location lausanne gare", 30]]],
      ["location vélo lausanne", 510, 0.03, [["location vélo lausanne", 190], ["louer un vélo lausanne", 95], ["vélo électrique lausanne location", 45], ["location vélo lausanne ouchy", 40]]],
      ["location vélo prix", 260, 0.02, [["location vélo prix", 70], ["tarif location vélo", 50], ["prix e-bike journée", 35], ["location vélo pas cher", 30]]],
      ["location vélo à l'heure", 150, 0.03, [["location vélo à l'heure", 70], ["vélo électrique heure lausanne", 25]]],
      ["vélo gratuit lausanne", 120, 0, [["vélo gratuit lausanne", 45], ["prêt vélo gratuit", 25], ["vélo libre service gratuit", 15], ["location vélo lausanne gratuit", 10]]],
      ["vtt location", 70, 0.01, [["location vtt lausanne", 30], ["vtt électrique location", 20]]],
      ["vélo libre service lausanne", 60, 0, [["vélo libre service lausanne", 25], ["vélo partage lausanne", 12]]],
      ["location trottinette lausanne", 35, 0, [["location trottinette lausanne", 20]]],
    ],
    // Personne n'achète « gratuit » : ces recherches arrivent par la requête large.
    mots: [["location vélo prix", "Expression", ["prix", "tarif", "pas cher"]], ["vélo électrique location", "Expression", ["électrique"]], ["e-bike lausanne", "Expression", ["e-bike"]], ["location vtt", "Expression", ["vtt"]], ["location vélo", "Large", []]],
  },
  {
    id: "c2", nom: "E-bike — Riviera", fourreTout: 220, traine: [30, 60],
    cats: [
      ["location e-bike montreux", 480, 0.03, [["location e-bike montreux", 180], ["e-bike montreux", 90], ["louer vélo électrique montreux", 60], ["location vélo montreux gratuit", 15]]],
      ["e-bike vevey", 260, 0.03, [["e-bike vevey", 110], ["location vélo vevey", 70]]],
      ["vélo électrique riviera", 150, 0.025, [["vélo électrique riviera", 60], ["e-bike riviera vaudoise", 30]]],
      ["montreux à vélo", 90, 0.01, [["montreux à vélo", 40], ["balade vélo montreux", 25]]],
      ["location vélo montreux gratuit", 35, 0, [["location vélo montreux gratuit", 15], ["vélo gratuit montreux", 10]]],
    ],
    mots: [["location e-bike montreux", "Expression", ["e-bike"]], ["vélo électrique montreux", "Expression", ["électrique"]], ["location vélo vevey", "Expression", ["vevey"]], ["vélo montreux", "Large", []]],
  },
  {
    id: "c3", nom: "Tours guidés Lavaux", fourreTout: 180, traine: [28, 50],
    cats: [
      ["lavaux à vélo", 420, 0.04, [["lavaux à vélo", 160], ["balade vélo lavaux", 90], ["tour lavaux vélo électrique", 50]]],
      ["tour guidé vélo lavaux", 210, 0.05, [["tour guidé vélo lavaux", 90], ["visite guidée lavaux vélo", 45]]],
      ["dégustation vin vélo", 160, 0.06, [["dégustation vin vélo", 60], ["vélo et vin lavaux", 40], ["tour vignoble vélo", 20]]],
      ["lavaux unesco visite", 70, 0.01, [["lavaux unesco visite", 30], ["que voir à lavaux", 15]]],
      ["balade lavaux gratuite", 40, 0, [["balade lavaux gratuite", 20], ["randonnée lavaux gratuit", 10]]],
    ],
    mots: [["dégustation vin vélo", "Expression", ["vin", "vignoble", "dégustation"]], ["tour guidé vélo", "Expression", ["guidé"]], ["lavaux à vélo", "Large", []]],
  },
  {
    id: "c4", nom: "Velomiete — DE", fourreTout: 140, traine: [22, 40],
    cats: [
      ["velomiete lausanne", 300, 0.025, [["velomiete lausanne", 130], ["e-bike mieten lausanne", 70]]],
      ["e-bike mieten genfersee", 180, 0.02, [["e-bike mieten genfersee", 80], ["velo mieten genfersee", 40]]],
      ["velomiete preise", 60, 0.01, [["velomiete preise", 25], ["e-bike miete kosten", 15]]],
      ["velo gratis lausanne", 25, 0, [["velo gratis lausanne", 12]]],
    ],
    mots: [["velomiete", "Expression", ["velomiete", "miete "]], ["e-bike mieten", "Expression", ["mieten"]], ["velo lausanne", "Large", []]],
  },
  {
    id: "c5", nom: "Bike rental — EN", fourreTout: 170, traine: [26, 45],
    cats: [
      ["bike rental lausanne", 380, 0.03, [["bike rental lausanne", 150], ["e-bike hire lausanne", 70], ["rent a bike lausanne", 50]]],
      ["e-bike hire lake geneva", 160, 0.03, [["e-bike hire lake geneva", 70], ["electric bike rental lake geneva", 30]]],
      ["electric bike tour lausanne", 70, 0.04, [["electric bike tour lausanne", 30], ["guided bike tour lausanne", 20]]],
      ["bike rental prices", 60, 0.01, [["bike rental prices", 25], ["cheap bike rental lausanne", 15]]],
      ["free bike lausanne", 50, 0, [["free bike lausanne", 25], ["free bike rental", 12]]],
    ],
    mots: [["e-bike hire", "Expression", ["hire"]], ["bike rental lausanne", "Expression", ["rental", "rent "]], ["bike tour lausanne", "Large", []]],
  },
];

const zero = (cout: number | null = 0): Chiffres => ({ clics: 0, impressions: 0, conversions: 0, cout });
function ajouter(a: Chiffres, b: Chiffres) {
  a.clics += b.clics; a.impressions += b.impressions; a.conversions += b.conversions;
  a.cout = a.cout === null || b.cout === null ? null : a.cout + b.cout;
}
const arrondi1 = (v: number) => Math.round(v * 10) / 10;

/** Un terme : ses chiffres sont les mêmes quel que soit le rangement ; seul le
 *  coût dépend de la source (le cluster ne l'a pas). */
function chiffresTerme(texte: string, clics: number, tauxCat: number, avecCout: boolean): Chiffres {
  const s = graine(texte);
  const ctr = 0.04 + bruit(s) * 0.08;
  return {
    clics,
    impressions: Math.round(clics / ctr),
    conversions: arrondi1(clics * tauxCat * (0.6 + bruit(s + 1) * 0.8)),
    cout: avecCout ? Math.round(clics * (0.6 + bruit(s + 2) * 1.4)) : null,
  };
}
// Les termes uniques d'une campagne, avec le taux de conversion de leur cluster.
function termesDe(camp: CampagneG): { texte: string; clics: number; taux: number }[] {
  const vus = new Map<string, { texte: string; clics: number; taux: number }>();
  camp.cats.forEach(([, , taux, ts]) => ts.forEach(([texte, clics]) => { if (!vus.has(texte)) vus.set(texte, { texte, clics, taux }); }));
  return [...vus.values()];
}

function clustersDe(camp: CampagneG): Cat[] {
  const cats: Cat[] = camp.cats.map(([libelle, clics, taux, termes], i) => {
    const ts = termes.map(([texte, tc]) => ({ texte, c: chiffresTerme(texte, tc, taux, false) }));
    const listes = zero(null);
    ts.forEach((t) => ajouter(listes, t.c));
    // Le cluster pèse plus que ses termes listés : le reste est masqué par Google.
    const k = clics / Math.max(1, listes.clics);
    const c = { clics, impressions: Math.round(listes.impressions * k), conversions: arrondi1(listes.conversions * k), cout: null };
    return { id: `${camp.id}k${i}`, libelle, c, termes: ts, listes };
  });
  const [n, clicsTraine] = camp.traine;
  const special = (clics: number, s: string): Chiffres => ({ clics, impressions: Math.round(clics / (0.04 + bruit(graine(s)) * 0.05)), conversions: arrondi1(clics * 0.012), cout: null });
  cats.push({ id: `${camp.id}tr`, libelle: "", c: special(clicsTraine, camp.id + "tr"), termes: [], listes: zero(null), traine: n });
  cats.push({ id: `${camp.id}ft`, libelle: "", c: special(camp.fourreTout, camp.id + "ft"), termes: [], listes: zero(null), fourreTout: true });
  return cats;
}

function motsClesDe(camp: CampagneG): Cat[] {
  const mots: Cat[] = camp.mots.map(([texte, correspondance], i) => ({ id: `${camp.id}m${i}`, libelle: texte, correspondance, c: zero(), termes: [], listes: zero() }));
  for (const t of termesDe(camp)) {
    const i = camp.mots.findIndex(([, , declencheurs]) => declencheurs.length === 0 || declencheurs.some((d) => (d.startsWith("=") ? t.texte === d.slice(1) : t.texte.includes(d))));
    const m = mots[i];
    const c = chiffresTerme(t.texte, t.clics, t.taux, true);
    m.termes.push({ texte: t.texte, c });
    ajouter(m.listes, c);
  }
  // Côté mots-clés aussi, une part des termes est masquée (44 à 61 % des clics
  // Search chez A et B) : le total du mot-clé dépasse la somme de ses termes.
  for (const m of mots) {
    const k = 1 / (1 - (0.35 + bruit(graine(m.libelle)) * 0.2));
    m.c = { clics: Math.round(m.listes.clics * k), impressions: Math.round(m.listes.impressions * k), conversions: arrondi1(m.listes.conversions * k), cout: Math.round((m.listes.cout ?? 0) * k) };
  }
  return mots.filter((m) => m.termes.length > 0);
}

export const CAMPAGNES_GROUPES = CAMPAGNES_G.map((c) => ({ id: c.id, nom: c.nom }));

/** Les groupes d'une campagne, ou du compte entier quand aucune n'est choisie.
 *  Au niveau du compte, un même libellé venu de plusieurs campagnes se fusionne. */
export function groupes(mode: Mode, campagne?: string): Cat[] {
  const parCampagne = mode === "clusters" ? clustersDe : motsClesDe;
  const camp = CAMPAGNES_G.find((c) => c.id === campagne);
  if (camp) return parCampagne(camp);
  const parLibelle = new Map<string, Cat>();
  const ft = zero(null), tr = zero(null);
  let nTr = 0;
  for (const c of CAMPAGNES_G.flatMap(parCampagne)) {
    if (c.fourreTout) { ajouter(ft, c.c); continue; }
    if (c.traine) { ajouter(tr, c.c); nTr += c.traine; continue; }
    const k = parLibelle.get(c.libelle);
    if (!k) { parLibelle.set(c.libelle, { ...c, id: `t${parLibelle.size}`, c: { ...c.c }, listes: { ...c.listes }, termes: c.termes.map((t) => ({ ...t, c: { ...t.c } })) }); continue; }
    ajouter(k.c, c.c); ajouter(k.listes, c.listes);
    for (const t of c.termes) { const u = k.termes.find((x) => x.texte === t.texte); if (u) ajouter(u.c, t.c); else k.termes.push({ ...t, c: { ...t.c } }); }
  }
  const sortie = [...parLibelle.values()];
  if (mode === "clusters") sortie.push({ id: "ttr", libelle: "", c: tr, termes: [], listes: zero(null), traine: nTr }, { id: "tft", libelle: "", c: ft, termes: [], listes: zero(null), fourreTout: true });
  return sortie;
}

// Palette catégorielle du produit, 8 teintes : au-delà, gris.
export const PALETTE = ["#1a56ff", "#e08b1a", "#7b4fff", "#0d9aa8", "#d6457a", "#5b8c2a", "#8a5a2b", "#3a3f4b"];
export const GRIS = "#c9c6bd";
export const MAX_COULEURS = 8;

export type CatRangee = Cat & { couleur: string; rang: number };
/** Rangés par la taille choisie ; les 8 premiers ont une couleur, le reste est
 *  gris. Traîne et fourre-tout toujours en dernier. */
export function rangees(cats: Cat[], t: Taille): CatRangee[] {
  const vraies = cats.filter((c) => !c.fourreTout && !c.traine).sort((a, b) => (b.c[t] ?? 0) - (a.c[t] ?? 0));
  const autres = cats.filter((c) => c.fourreTout || c.traine);
  return [...vraies, ...autres].map((c, i) => ({ ...c, rang: i, couleur: !c.fourreTout && !c.traine && i < MAX_COULEURS ? PALETTE[i] : GRIS }));
}

export const entier = (v: number) => Math.round(v).toLocaleString("fr-CH");
export const conv1 = (v: number) => v.toLocaleString("fr-CH", { maximumFractionDigits: 1 });
export const chf0 = (v: number) => `${Math.round(v).toLocaleString("fr-CH")} CHF`;
/** « — » quand la valeur n'existe pas (coût d'un cluster), jamais 0 (§7). */
export const fmt = (t: Taille, v: number | null) => (v === null ? "—" : t === "conversions" ? conv1(v) : t === "cout" ? chf0(v) : entier(v));
