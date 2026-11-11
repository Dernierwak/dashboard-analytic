// ── LE TABLEAU DÉTAILLÉ GOOGLE, ET SON EXPORT ───────────────────────────────
//
// Spec `.scratch/google-ads/spec.md`, § « Tableau détaillé » ; user stories 48
// à 57 ; décision : ticket 09 de la carte. Harnais :
// `.scratch/google-ads/harnais/04-le-tableau-detaille/`.
//
// Écrit en partant de `lib/meta/tableau.ts`, mais son propre code (ADR 0011).
// Ce qui change chez Google :
//   · une ligne Total en tête, et un repère de type sur chaque campagne ;
//   · c'est le TYPE de la campagne qui décide jusqu'où elle se déplie ;
//   · deux sources : la campagne et le Total se lisent dans
//     `google_ads_insights` (toutes les campagnes, PMax compris — les mêmes
//     chiffres que les cartes au-dessus) ; groupes et annonces dans
//     `google_ads_ad_insights`, que Google ne remplit que pour les annonces qui
//     ont eu des impressions et jamais pour PMax.
//
// Sans directive, comme `lecture.ts` : le serveur construit l'arbre, le client
// le déplie et en tire le CSV (`CLAUDE.md` §8). L'import de `./lecture` est
// sans extension pour Next ; le harnais le résout par son propre crochet.
//
// Les règles que ce module tient, chacune testée :
//   · chaque ligne recalcule ses ratios sur SES totaux, jamais la moyenne de
//     ses enfants ;
//   · un « — » porte toujours sa raison, jamais 0 ni une cellule vide ;
//   · campagne, groupe et annonce sont leur ID Google, sous leur nom le plus
//     récent ; une ligne d'annonce sans ID n'est rattachée à rien par son nom ;
//   · le CSV écrit ce que l'écran écrit, « — » compris, avec le type de
//     campagne (le vrai type Google sous « Autres types »).
import {
  campagnesDe,
  cleCampagne,
  DEVISE,
  ecart,
  METRIQUES,
  periodeDe,
  TIRET,
  totaux,
  valeurDe,
  vueDe,
  VUES,
  type CleMetrique,
  type Commandes,
  type Contexte,
  type LigneGoogle,
  type Totaux,
  type TypeCampagne,
  type Vue,
} from "./lecture";

/** Une ligne de `google_ads_ad_insights` : une annonce, un jour. Les champs de
 *  campagne sont ceux de `LigneGoogle` ; `typeCampagne` n'y est pas récolté
 *  (`null`) — le type se lit sur la campagne. */
export type LigneAnnonceGoogle = LigneGoogle & {
  groupeId: string | null;
  groupeNom: string;
  annonceId: string | null;
  annonceNom: string;
};

export type NiveauTableau = "total" | "campagne" | "groupe" | "annonce";

export type LigneTableau = {
  /** Unique dans tout l'arbre : la clé de dépliage. */
  cle: string;
  niveau: NiveauTableau;
  nom: string;
  /** L'ID Google ; `null` pour le Total et une campagne sans ID. */
  id: string | null;
  /** La pastille de la campagne — la même que dans le Bandeau. */
  couleur: string | null;
  /** Le type de la campagne, porté aussi par ses groupes et annonces (export). */
  type: TypeCampagne | null;
  /** Une valeur par métrique de la vue, dans l'ordre de `Tableau.metriques`. */
  valeurs: (number | null)[];
  /** Pourquoi la valeur de même rang s'écrit « — » ; `null` quand elle existe. */
  raisons: (string | null)[];
  /** L'écart du chiffre principal contre la période d'avant. */
  ecart: number | null;
  /** Pourquoi une campagne ne se déplie pas, quand c'est son type qui le veut. */
  sansDetail: string | null;
  enfants: LigneTableau[];
};

export type Tableau = {
  vue: Vue;
  metriques: CleMetrique[];
  debut: string;
  fin: string;
  /** Le nom de la campagne choisie, `null` = toutes. */
  campagne: string | null;
  /** `null` = aucune campagne n'a tourné sur la période. */
  total: LigneTableau | null;
  lignes: LigneTableau[];
};

// ── La profondeur, par type ──────────────────────────────────────────────────

/** Décision 09 de la carte : Search, Display, Vidéo, Demand Gen et Autres
 *  types descendent jusqu'où `ad_group_ad` a des lignes. PMax n'a ni groupe
 *  d'annonces ni annonce (Google n'en rend aucune, issue 01) : ses Groupes
 *  d'éléments sont le ticket 05. */
const SANS_DETAIL_PMAX = "Performance Max n'a ni groupe d'annonces ni annonce : Google l'organise en groupes d'éléments, qui ne sont pas encore lus.";

function sansDetailDe(type: TypeCampagne | null): string | null {
  return type?.libelle === "PMax" ? SANS_DETAIL_PMAX : null;
}

// ── Les raisons d'un « — » ───────────────────────────────────────────────────

/** Un ratio sans diviseur. Une métrique ajoutée à `METRIQUES` sans raison
 *  ici retombe sur la phrase générale : jamais une cellule muette. */
const RAISON_DIVISEUR: Partial<Record<CleMetrique, string>> = {
  cpm: "Aucune impression sur la période : le CPM ne se calcule pas.",
  ctr: "Aucune impression sur la période : le CTR ne se calcule pas.",
  cpc: "Aucun clic sur la période : le CPC ne se calcule pas.",
  cout_conversion: "Aucune conversion sur la période : le coût par conversion ne se calcule pas.",
  taux_conversion: "Aucun clic sur la période : le taux de conversion ne se calcule pas.",
};
const RAISON_GENERALE = "Ce ratio n'a pas de diviseur sur la période : il ne se calcule pas.";
const RIEN_MESURE = "Rien de mesuré sur la période.";

function raisonDe(m: CleMetrique, t: Totaux | null, v: number | null): string | null {
  if (v !== null) return null;
  if (t === null) return RIEN_MESURE;
  return RAISON_DIVISEUR[m] ?? RAISON_GENERALE;
}

// ── L'arbre ──────────────────────────────────────────────────────────────────

type Noeud = {
  cle: string;
  id: string | null;
  nom: string;
  dateNom: string;
  courant: LigneGoogle[];
  avant: LigneGoogle[];
  enfants: Map<string, Noeud>;
};

function noeudSous(parent: Map<string, Noeud>, cle: string, id: string | null, nom: string, date: string): Noeud {
  let n = parent.get(cle);
  if (!n) {
    n = { cle, id, nom, dateNom: date, courant: [], avant: [], enfants: new Map() };
    parent.set(cle, n);
  }
  // Le nom porté par la ligne la plus récente : un élément renommé reste une
  // seule ligne, sous son nom d'aujourd'hui (user story 57).
  if (date > n.dateNom) {
    n.nom = nom;
    n.dateNom = date;
  }
  return n;
}

export function tableauDe(lignesCampagnes: LigneGoogle[], lignesAnnonces: LigneAnnonceGoogle[], c: Commandes, ctx: Contexte): Tableau {
  const vue = vueDe(c.vue);
  const metriques = VUES[vue].metriques;
  const p = periodeDe(c, ctx);
  // Le même tri que `contenuPage` : le jour en cours n'entre dans rien.
  const dans = (l: LigneGoogle, de: string, a: string) => l.date >= de && l.date <= a && l.date < ctx.aujourdhui;
  const quand = (l: LigneGoogle): "courant" | "avant" | null =>
    dans(l, p.debut, p.fin) ? "courant" : dans(l, p.avantDebut, p.avantFin) ? "avant" : null;
  const choisie = (l: LigneGoogle) => !c.campagne || cleCampagne(l) === c.campagne;

  const lues = lignesCampagnes.filter((l) => quand(l) !== null);
  const campagnes = campagnesDe(lues, p);
  const infos = new Map(campagnes.map((x) => [x.cle, x]));

  const racine = new Map<string, Noeud>();
  const total: Noeud = { cle: "total", id: null, nom: "Total", dateNom: "", courant: [], avant: [], enfants: new Map() };
  for (const l of lues) {
    if (!choisie(l)) continue;
    const periode = quand(l)!;
    noeudSous(racine, cleCampagne(l), l.campagneId, l.campagneNom, l.date)[periode].push(l);
    total[periode].push(l);
  }

  for (const l of lignesAnnonces) {
    const periode = quand(l);
    // Sans les trois ID, l'annonce ne se rattache à rien : le nom n'est
    // jamais une identité (spec, § « L'identité par ID »).
    if (!periode || !l.campagneId || !l.groupeId || !l.annonceId || !choisie(l)) continue;
    const camp = racine.get(l.campagneId);
    // Une campagne absente du niveau campagne n'a pas de ligne où se déplier ;
    // le Total, lu au niveau campagne, ne dépend pas de ces lignes-ci.
    if (!camp || sansDetailDe(infos.get(camp.cle)?.type ?? null)) continue;
    const groupe = noeudSous(camp.enfants, `${camp.cle}›${l.groupeId}`, l.groupeId, l.groupeNom, l.date);
    const ann = noeudSous(groupe.enfants, `${groupe.cle}›${l.annonceId}`, l.annonceId, l.annonceNom, l.date);
    groupe[periode].push(l);
    ann[periode].push(l);
  }

  const principale = metriques[0];
  const sens = METRIQUES[principale].hausseBonne === false ? 1 : -1;

  const versLigne = (n: Noeud, niveau: NiveauTableau, type: TypeCampagne | null, enfants: LigneTableau[]): LigneTableau => {
    const t = totaux(n.courant);
    const valeurs = metriques.map((m) => valeurDe(m, t));
    return {
      cle: n.cle,
      niveau,
      nom: n.nom,
      id: n.id,
      couleur: niveau === "campagne" ? infos.get(n.cle)?.couleur ?? null : null,
      type,
      valeurs,
      raisons: metriques.map((m, i) => raisonDe(m, t, valeurs[i])),
      ecart: ecart(valeurs[0], valeurDe(principale, totaux(n.avant))),
      sansDetail: niveau === "campagne" ? sansDetailDe(type) : null,
      enfants,
    };
  };
  // Classé par le chiffre principal (un coût croissant), « — » en bas.
  const classer = (a: LigneTableau, b: LigneTableau) => {
    const [va, vb] = [a.valeurs[0], b.valeurs[0]];
    if (va === null || vb === null) return va === vb ? a.nom.localeCompare(b.nom, "fr") : va === null ? 1 : -1;
    return sens * (va - vb) || a.nom.localeCompare(b.nom, "fr");
  };
  // Seul ce qui a tourné sur la période est une ligne : un élément vu
  // seulement la période d'avant n'aurait que des « — ».
  const actifs = (m: Map<string, Noeud>) => [...m.values()].filter((n) => n.courant.length > 0);
  const lignes = actifs(racine)
    .map((camp) => {
      const type = infos.get(camp.cle)?.type ?? null;
      const groupes = actifs(camp.enfants)
        .map((g) => versLigne(g, "groupe", type, actifs(g.enfants).map((a) => versLigne(a, "annonce", type, [])).sort(classer)))
        .sort(classer);
      return versLigne(camp, "campagne", type, groupes);
    })
    .sort(classer);

  return {
    vue,
    metriques,
    debut: p.debut,
    fin: p.fin,
    campagne: c.campagne ? infos.get(c.campagne)?.nom ?? c.campagne : null,
    total: total.courant.length > 0 ? versLigne(total, "total", typeCommun(lignes), []) : null,
    lignes,
  };
}

/** Le type du Total : celui de toutes ses campagnes s'il n'y en a qu'un. */
function typeCommun(lignes: LigneTableau[]): TypeCampagne | null {
  const premier = lignes[0]?.type ?? null;
  return premier && lignes.every((l) => l.type?.brut === premier.brut) ? premier : null;
}

// ── L'export CSV ─────────────────────────────────────────────────────────────
//
// Pour un tableur réglé en français (Excel, Numbers, LibreOffice) : point-
// virgule entre les colonnes, virgule décimale, aucun séparateur de milliers
// et l'unité dans l'en-tête — sans quoi « 1 234,50 CHF » arrive en texte et ne
// se somme pas. Les décimales sont celles de l'écran. Un « — » reste « — ».

const SEP = ";";
const NOM_NIVEAU: Record<NiveauTableau, string> = {
  total: "Total",
  campagne: "Campagne",
  groupe: "Groupe d'annonces",
  annonce: "Annonce",
};
type Format = (typeof METRIQUES)[CleMetrique]["format"];
// « decimal » : les conversions fractionnaires de Google (data-driven), deux
// décimales comme à l'écran.
const DECIMALES: Record<Format, number> = { entier: 0, decimal: 2, argent: 2, pourcent: 2 };
const UNITE: Record<Format, string> = { entier: "", decimal: "", argent: ` (${DEVISE})`, pourcent: " (%)" };

/** Le libellé de l'écran, ou le vrai type Google sous « Autres types »
 *  (spec, § « Le Type de campagne »). */
export function typeExporte(type: TypeCampagne | null): string | null {
  if (!type) return null;
  return type.libelle === "Autres types" ? type.brut : type.libelle;
}
const TOUS_LES_TYPES = "Tous les types";

function nombreTableur(v: number | null, decimales: number): string {
  return v === null ? TIRET : v.toFixed(decimales).replace(".", ",");
}

/** Échappe une cellule pour le CSV : guillemets autour de ce qui contient le
 *  séparateur, un guillemet ou un saut de ligne. */
function cellule(x: string): string {
  return /[";\r\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x;
}

/** Un nom vient du compte Google du client : commençant par `=`, `+`, `-` ou
 *  `@`, le tableur l'exécuterait comme une formule (injection CSV, OWASP).
 *  L'apostrophe le garde en texte. Les NOMS seulement : un écart « -12,5 »
 *  protégé ainsi arriverait en texte et ne se trierait plus. */
function texte(x: string): string {
  return /^[=+\-@\t\r]/.test(x) ? `'${x}` : x;
}

/** Le Total, puis toutes les lignes, dépliées ou non : le tableur filtre par
 *  la colonne « Niveau », et une somme sur un seul niveau ne compte rien deux fois. */
export function csvDuTableau(t: Tableau): string {
  const principale = METRIQUES[t.metriques[0]];
  const entete = [
    "Niveau",
    "Type de campagne",
    "Campagne",
    "Groupe d'annonces",
    "Annonce",
    "ID Google",
    ...t.metriques.map((m) => `${METRIQUES[m].nom}${UNITE[METRIQUES[m].format]}`),
    `${principale.nom}, écart contre la période d'avant (%)`,
  ];
  const ligneCsv = (l: LigneTableau, noms: string[], type: string) => [
    NOM_NIVEAU[l.niveau],
    type,
    texte(noms[0] ?? ""),
    texte(noms[1] ?? ""),
    texte(noms[2] ?? ""),
    l.id ?? TIRET,
    ...t.metriques.map((m, i) => nombreTableur(l.valeurs[i], DECIMALES[METRIQUES[m].format])),
    nombreTableur(l.ecart, 1),
  ];
  const lignes: string[][] = [];
  if (t.total) lignes.push(ligneCsv(t.total, [], typeExporte(t.total.type) ?? TOUS_LES_TYPES));
  const parcourir = (l: LigneTableau, chemin: string[]) => {
    const noms = [...chemin, l.nom];
    lignes.push(ligneCsv(l, noms, typeExporte(l.type) ?? TIRET));
    for (const e of l.enfants) parcourir(e, noms);
  };
  for (const l of t.lignes) parcourir(l, []);
  return [entete, ...lignes].map((r) => r.map(cellule).join(SEP)).join("\r\n") + "\r\n";
}

/** « pulse-google-trafic-2026-09-28-2026-10-04.csv » : la vue et la période
 *  voyagent avec le fichier, puisqu'elles ne sont pas dans ses colonnes. */
export function nomDuFichier(t: Tableau): string {
  const campagne = t.campagne
    ? `-${t.campagne.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 40)}`
    : "";
  return `pulse-google-${t.vue}${campagne}-${t.debut}-${t.fin}.csv`;
}
