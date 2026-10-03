// ── MODULE 5 · LE TABLEAU DÉTAILLÉ, ET SON EXPORT ───────────────────────────
//
// Spec `.scratch/meta-ads/spec.md`, § « Solution », module 5 ; user stories 47
// à 51. Campagne › Groupe d'annonces › Annonce, les colonnes de la vue active,
// et le CSV de ce qui est affiché. Harnais :
// `.scratch/meta-ads/harnais/09-le-tableau/`.
//
// Sans directive, comme `lecture.ts` : le serveur construit l'arbre, le client
// le déplie et en tire le CSV (`CLAUDE.md` §8). L'import de `./lecture` est
// sans extension pour Next ; le harnais le résout par son propre crochet.
//
// Les règles que ce module tient, chacune testée :
//   · chaque ligne recalcule ses ratios sur SES totaux : une campagne n'est
//     jamais la moyenne de ses groupes, un groupe jamais celle de ses annonces ;
//   · un élément est son ID Meta, sous son nom le plus récent ; une ligne sans
//     ID n'est rattachée par son nom qu'à ses homonymes SANS ID du même parent ;
//   · le CSV écrit « — » là où l'écran l'écrit, jamais 0.
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
  type LigneMeta,
  type Vue,
} from "./lecture";

export type NiveauTableau = "campagne" | "groupe" | "annonce";

export type LigneTableau = {
  /** Unique dans tout l'arbre : la clé de dépliage. */
  cle: string;
  niveau: NiveauTableau;
  nom: string;
  /** L'ID Meta, `null` pour une ligne d'avant le rejeu (ticket 03). */
  id: string | null;
  /** La pastille de la campagne — la même que dans le Bandeau. */
  couleur: string | null;
  /** Une valeur par métrique de la vue, dans l'ordre de `Tableau.metriques`. */
  valeurs: (number | null)[];
  /** L'écart du chiffre principal contre la période d'avant. */
  ecart: number | null;
  enfants: LigneTableau[];
};

export type Tableau = {
  vue: Vue;
  metriques: CleMetrique[];
  debut: string;
  fin: string;
  /** Le nom de la campagne choisie, `null` = toutes. */
  campagne: string | null;
  lignes: LigneTableau[];
};

const SANS_ID = "sans-id:";

type Noeud = {
  cle: string;
  id: string | null;
  nom: string;
  dateNom: string;
  courant: LigneMeta[];
  avant: LigneMeta[];
  enfants: Map<string, Noeud>;
};

/** Le nœud d'un élément sous son parent. Sans ID, la clé est le nom PRÉFIXÉ
 *  ET placée sous le parent : elle ne tombe jamais sur un élément identifié, ni
 *  sur un homonyme sans ID d'une autre campagne ou d'un autre groupe. */
function noeudSous(parent: Map<string, Noeud>, prefixe: string, id: string | null, nom: string, l: LigneMeta): Noeud {
  const cle = id ?? `${prefixe}${SANS_ID}${nom}`;
  let n = parent.get(cle);
  if (!n) {
    n = { cle, id, nom, dateNom: l.date, courant: [], avant: [], enfants: new Map() };
    parent.set(cle, n);
  }
  // Le nom porté par la ligne la plus récente : une campagne renommée reste
  // une seule ligne, sous son nom d'aujourd'hui (user story 51).
  if (l.date > n.dateNom) {
    n.nom = nom;
    n.dateNom = l.date;
  }
  return n;
}

export function tableauDe(lignesBrutes: LigneMeta[], c: Commandes, ctx: Contexte): Tableau {
  const vue = vueDe(c.vue);
  const metriques = VUES[vue].metriques;
  const p = periodeDe(c, ctx);
  // Le même tri que `contenuPage` : le jour en cours n'entre dans rien.
  const dans = (l: LigneMeta, de: string, a: string) => l.date >= de && l.date <= a && l.date < ctx.aujourdhui;
  const lues = lignesBrutes.filter((l) => dans(l, p.debut, p.fin) || dans(l, p.avantDebut, p.avantFin));
  const campagnes = campagnesDe(lues, p);
  const choisie = c.campagne ? campagnes.find((x) => x.cle === c.campagne) : undefined;

  const racine = new Map<string, Noeud>();
  for (const l of lues) {
    if (c.campagne && cleCampagne(l) !== c.campagne) continue;
    const campagne = noeudSous(racine, "", l.campagneId, l.campagneNom, l);
    const groupe = noeudSous(campagne.enfants, `${campagne.cle}›`, l.groupeId, l.groupeNom, l);
    const annonce = noeudSous(groupe.enfants, `${groupe.cle}›`, l.annonceId, l.annonceNom, l);
    const periode = dans(l, p.debut, p.fin) ? "courant" : "avant";
    for (const n of [campagne, groupe, annonce]) n[periode].push(l);
  }

  const couleurs = new Map(campagnes.map((x) => [x.cle, x.couleur]));
  const principale = metriques[0];
  const sens = METRIQUES[principale].hausseBonne ? -1 : 1;

  const versLigne = (n: Noeud, niveau: NiveauTableau): LigneTableau => {
    const t = totaux(n.courant);
    const valeurs = metriques.map((m) => valeurDe(m, t));
    return {
      cle: n.cle,
      niveau,
      nom: n.nom,
      id: n.id,
      couleur: niveau === "campagne" ? couleurs.get(n.cle) ?? null : null,
      valeurs,
      ecart: ecart(valeurs[0], valeurDe(principale, totaux(n.avant))),
      enfants: [],
    };
  };
  // Classé par le chiffre principal (un coût croissant), « — » en bas.
  const classer = (a: LigneTableau, b: LigneTableau) => {
    const [va, vb] = [a.valeurs[0], b.valeurs[0]];
    if (va === null || vb === null) return va === vb ? a.nom.localeCompare(b.nom, "fr") : va === null ? 1 : -1;
    return sens * (va - vb) || a.nom.localeCompare(b.nom, "fr");
  };
  const niveaux: NiveauTableau[] = ["campagne", "groupe", "annonce"];
  const construire = (m: Map<string, Noeud>, rang: number): LigneTableau[] =>
    [...m.values()]
      // Seul ce qui a tourné sur la période est une ligne : un élément vu
      // seulement la période d'avant n'aurait que des « — ».
      .filter((n) => n.courant.length > 0)
      .map((n) => ({ ...versLigne(n, niveaux[rang]), enfants: rang < 2 ? construire(n.enfants, rang + 1) : [] }))
      .sort(classer);

  return {
    vue,
    metriques,
    debut: p.debut,
    fin: p.fin,
    campagne: c.campagne ? choisie?.nom ?? c.campagne : null,
    lignes: construire(racine, 0),
  };
}

// ── L'export CSV ─────────────────────────────────────────────────────────────
//
// Pour un tableur réglé en français (Excel, Numbers, LibreOffice) : point-
// virgule entre les colonnes, virgule décimale, aucun séparateur de milliers
// et l'unité dans l'en-tête — sans quoi « 1 234,50 CHF » arrive en texte et ne
// se somme pas. Les décimales sont celles de l'écran. Un « — » reste « — ».

const SEP = ";";
const NOM_NIVEAU: Record<NiveauTableau, string> = {
  campagne: "Campagne",
  groupe: "Groupe d'annonces",
  annonce: "Annonce",
};
const DECIMALES = { entier: 0, argent: 2, pourcent: 2 } as const;
const UNITE = { entier: "", argent: ` (${DEVISE})`, pourcent: " (%)" } as const;

function nombreTableur(v: number | null, decimales: number): string {
  return v === null ? TIRET : v.toFixed(decimales).replace(".", ",");
}

/** Échappe une cellule pour le CSV : guillemets autour de ce qui contient le
 *  séparateur, un guillemet ou un saut de ligne. */
function cellule(x: string): string {
  return /[";\r\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x;
}

/** Un nom vient du compte Meta du client : commençant par `=`, `+`, `-` ou
 *  `@`, le tableur l'exécuterait comme une formule (injection CSV, OWASP).
 *  L'apostrophe le garde en texte. Les NOMS seulement : un écart « -12,5 »
 *  protégé ainsi arriverait en texte et ne se trierait plus (revue du 09). */
function texte(x: string): string {
  return /^[=+\-@\t\r]/.test(x) ? `'${x}` : x;
}

/** Toutes les lignes, dépliées ou non : le tableur filtre par la colonne
 *  « Niveau », et une somme sur un seul niveau ne compte rien deux fois. */
export function csvDuTableau(t: Tableau): string {
  const principale = METRIQUES[t.metriques[0]];
  const entete = [
    "Niveau",
    "Campagne",
    "Groupe d'annonces",
    "Annonce",
    "ID Meta",
    ...t.metriques.map((m) => `${METRIQUES[m].nom}${UNITE[METRIQUES[m].format]}`),
    `${principale.nom}, écart contre la période d'avant (%)`,
  ];
  const lignes: string[][] = [];
  const parcourir = (l: LigneTableau, chemin: string[]) => {
    const noms = [...chemin, l.nom];
    lignes.push([
      NOM_NIVEAU[l.niveau],
      texte(noms[0] ?? ""),
      texte(noms[1] ?? ""),
      texte(noms[2] ?? ""),
      l.id ?? TIRET,
      ...t.metriques.map((m, i) => nombreTableur(l.valeurs[i], DECIMALES[METRIQUES[m].format])),
      nombreTableur(l.ecart, 1),
    ]);
    for (const e of l.enfants) parcourir(e, noms);
  };
  for (const l of t.lignes) parcourir(l, []);
  return [entete, ...lignes].map((r) => r.map(cellule).join(SEP)).join("\r\n") + "\r\n";
}

/** « pulse-meta-trafic-2026-09-28-2026-10-04.csv » : la vue et la période
 *  voyagent avec le fichier, puisqu'elles ne sont pas dans ses colonnes. */
export function nomDuFichier(t: Tableau): string {
  const campagne = t.campagne
    ? `-${t.campagne.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 40)}`
    : "";
  return `pulse-meta-${t.vue}${campagne}-${t.debut}-${t.fin}.csv`;
}
