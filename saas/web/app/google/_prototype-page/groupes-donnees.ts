// PROTOTYPE JETABLE — ticket « Les groupes de termes de recherche »
// (.scratch/google-ads/issues/21-les-groupes-de-termes-de-recherche.md). Vit sur
// la branche `prototype/groupes-de-termes`, jamais sur `main`.
//
// Données FICTIVES (location de vélos inventée, 6 campagnes Search). Les
// proportions suivent l'essai réel (ticket 19) :
// - une catégorie = un sujet ET une langue, nommée par son terme principal ;
//   « gratuit » ressort en morceaux, collé à un sujet (gratuit / free / gratis) ;
// - les termes listés d'une catégorie ne font pas son total : le reste est
//   masqué par Google (≈ 35 à 40 % des clics d'une catégorie) ;
// - une catégorie fourre-tout au libellé vide, ≈ 16 % des clics, aucun terme ;
// - une longue traîne : les deux tiers des catégories ont ≤ 5 clics ;
// - clics, impressions, conversions — PAS de coût ;
// - un terme sur ~150 tombe dans deux catégories.

export type Taille = "clics" | "impressions" | "conversions";
export const TAILLES: { cle: Taille; nom: string }[] = [
  { cle: "clics", nom: "Clics" },
  { cle: "impressions", nom: "Impressions" },
  { cle: "conversions", nom: "Conversions" },
];
export type Chiffres = Record<Taille, number>;
export type TermeG = { texte: string; c: Chiffres };
export type Cat = { id: string; libelle: string; c: Chiffres; termes: TermeG[]; listes: Chiffres; fourreTout?: boolean; traine?: number };

function bruit(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
const graine = (s: string) => [...s].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) % 100000;

// libellé, clics de la catégorie, taux de conversion, [terme, clics]…
type Brute = [string, number, number, [string, number][]];
const CAMPAGNES_G: { id: string; nom: string; cats: Brute[]; fourreTout: number; traine: [number, number] }[] = [
  {
    id: "c0", nom: "Marque", fourreTout: 260, traine: [34, 70],
    cats: [
      ["[nom de marque]", 1590, 0.05, [["[nom de marque]", 980], ["[nom de marque] vélo", 140], ["[nom de marque] location", 120]]],
      ["[nom de marque] avis", 210, 0.03, [["[nom de marque] avis", 120], ["avis [nom de marque] lausanne", 30]]],
      ["[nom de marque] horaires", 180, 0.02, [["[nom de marque] horaires", 90], ["[nom de marque] ouvert dimanche", 35]]],
      ["[nom de marque] lausanne", 140, 0.04, [["[nom de marque] lausanne", 80], ["[nom de marque] ouchy", 20]]],
    ],
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
  },
  {
    id: "c4", nom: "Velomiete — DE", fourreTout: 140, traine: [22, 40],
    cats: [
      ["velomiete lausanne", 300, 0.025, [["velomiete lausanne", 130], ["e-bike mieten lausanne", 70]]],
      ["e-bike mieten genfersee", 180, 0.02, [["e-bike mieten genfersee", 80], ["velo mieten genfersee", 40]]],
      ["velomiete preise", 60, 0.01, [["velomiete preise", 25], ["e-bike miete kosten", 15]]],
      ["velo gratis lausanne", 25, 0, [["velo gratis lausanne", 12]]],
    ],
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
  },
];

function chiffres(clics: number, taux: number, s: number): Chiffres {
  const ctr = 0.04 + bruit(s) * 0.08;
  return { clics, impressions: Math.round(clics / ctr), conversions: Math.round(clics * taux * (0.8 + bruit(s + 1) * 0.4) * 10) / 10 };
}
const zero = (): Chiffres => ({ clics: 0, impressions: 0, conversions: 0 });
const ajouter = (a: Chiffres, b: Chiffres) => { a.clics += b.clics; a.impressions += b.impressions; a.conversions += b.conversions; };

function catsDe(camp: (typeof CAMPAGNES_G)[number]): Cat[] {
  const cats: Cat[] = camp.cats.map(([libelle, clics, taux, termes], i) => {
    const c = chiffres(clics, taux, graine(libelle));
    const ts = termes.map(([texte, tc]) => ({ texte, c: { clics: tc, impressions: Math.round(c.impressions * (tc / clics)), conversions: Math.round(c.conversions * (tc / clics) * 10) / 10 } }));
    const listes = zero();
    ts.forEach((t) => ajouter(listes, t.c));
    return { id: `${camp.id}k${i}`, libelle, c, termes: ts, listes };
  });
  const [n, clicsTraine] = camp.traine;
  cats.push({ id: `${camp.id}tr`, libelle: "", c: chiffres(clicsTraine, 0.01, graine(camp.id) + 3), termes: [], listes: zero(), traine: n });
  cats.push({ id: `${camp.id}ft`, libelle: "", c: chiffres(camp.fourreTout, 0.02, graine(camp.id) + 5), termes: [], listes: zero(), fourreTout: true });
  return cats;
}

export const CAMPAGNES_GROUPES = CAMPAGNES_G.map((c) => ({ id: c.id, nom: c.nom }));

/** Les catégories d'une campagne (`campaign_search_term_insight`), ou du compte
 *  entier (`customer_search_term_insight`) quand aucune n'est choisie — au niveau
 *  du compte, Google fusionne un même sujet venu de plusieurs campagnes. */
export function categories(campagne?: string): Cat[] {
  const camp = CAMPAGNES_G.find((c) => c.id === campagne);
  if (camp) return catsDe(camp);
  const parLibelle = new Map<string, Cat>();
  const ft = zero(), tr = zero();
  let nTr = 0;
  for (const c of CAMPAGNES_G.flatMap(catsDe)) {
    if (c.fourreTout) { ajouter(ft, c.c); continue; }
    if (c.traine) { ajouter(tr, c.c); nTr += c.traine; continue; }
    const k = parLibelle.get(c.libelle);
    if (!k) { parLibelle.set(c.libelle, { ...c, id: `t${parLibelle.size}`, c: { ...c.c }, listes: { ...c.listes }, termes: c.termes.map((t) => ({ ...t, c: { ...t.c } })) }); continue; }
    ajouter(k.c, c.c); ajouter(k.listes, c.listes);
    for (const t of c.termes) { const u = k.termes.find((x) => x.texte === t.texte); if (u) ajouter(u.c, t.c); else k.termes.push({ ...t, c: { ...t.c } }); }
  }
  return [...parLibelle.values(), { id: "ttr", libelle: "", c: tr, termes: [], listes: zero(), traine: nTr }, { id: "tft", libelle: "", c: ft, termes: [], listes: zero(), fourreTout: true }];
}

export const nomCat = (c: Cat) => c.fourreTout ? "Sans catégorie" : c.traine ? `${c.traine} petites catégories` : c.libelle;
export const explicationCat = (c: Cat) => c.fourreTout
  ? "Google range ici ce qu'il ne classe nulle part, et n'en liste aucun terme."
  : c.traine ? "Chacune pèse 5 clics au plus : regroupées pour rester lisibles, leurs termes ne sont pas affichés." : "";

/** Les termes qui tombent dans deux catégories — le lien qui relie deux grappes. */
export function termesPartages(cats: Cat[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  cats.forEach((c) => c.termes.forEach((t) => m.set(t.texte, [...(m.get(t.texte) ?? []), c.id])));
  return new Map([...m].filter(([, ids]) => ids.length > 1));
}

// Palette catégorielle du produit, 8 teintes : au-delà, gris.
export const PALETTE = ["#1a56ff", "#e08b1a", "#7b4fff", "#0d9aa8", "#d6457a", "#5b8c2a", "#8a5a2b", "#3a3f4b"];
export const GRIS = "#c9c6bd";
export const MAX_COULEURS = 8;

export type CatRangee = Cat & { couleur: string; rang: number };
/** Rangées par la taille choisie ; les 8 premières « vraies » catégories ont
 *  une couleur, le reste est gris. Traîne et fourre-tout toujours en dernier. */
export function rangees(cats: Cat[], t: Taille): CatRangee[] {
  const vraies = cats.filter((c) => !c.fourreTout && !c.traine).sort((a, b) => b.c[t] - a.c[t]);
  const autres = cats.filter((c) => c.fourreTout || c.traine);
  return [...vraies, ...autres].map((c, i) => ({ ...c, rang: i, couleur: !c.fourreTout && !c.traine && i < MAX_COULEURS ? PALETTE[i] : GRIS }));
}

export const entier = (v: number) => Math.round(v).toLocaleString("fr-CH");
export const conv1 = (v: number) => v.toLocaleString("fr-CH", { maximumFractionDigits: 1 });
export const pct0 = (v: number) => `${Math.round(v * 100)} %`;
export const fmt = (t: Taille, v: number) => (t === "conversions" ? conv1(v) : entier(v));
