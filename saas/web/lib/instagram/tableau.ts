// ── LE TABLEAU DÉTAILLÉ « TOUS TES POSTS », ET SON EXPORT ───────────────────
//
// Spec `.scratch/instagram/spec.md`, § « Tableau détaillé — Tous tes posts » ;
// user stories 26 et 27. Tout l'historique en base, sans filtre de période ;
// la colonne Place suit la métrique choisie. Harnais :
// `.scratch/instagram-construction/harnais/09-la-lecture/`.
//
// Sans directive, comme `lecture.ts` : le serveur construit les lignes, le
// client les trie et en tire le CSV (`CLAUDE.md` §8). L'import de `./lecture`
// est sans extension pour Next ; le harnais le résout par son crochet.
//
// Les règles que ce module tient, chacune testée :
//   · un post sans valeur reste en bas, quel que soit le sens du tri ;
//   · un post de plus de 12 mois se trie sur sa valeur brute, sans place ;
//   · le temps de visionnage n'existe que pour un Reel ;
//   · le CSV écrit une cellule VIDE pour une absence, jamais 0 ni « – ».
import {
  dansLesMois,
  foulesDe,
  METRIQUES,
  MINIMUM_FOULE,
  NOM_FORMAT,
  NOM_FORMAT_PLURIEL,
  NOM_PLACE,
  placeDuPost,
  valeurDe,
  type CleMetrique,
  type Contexte,
  type PlaceDuPost,
  type Post,
} from "./lecture";
// Les nombres s'écrivent comme sur la page Meta (espace fine, « − »).
import { nombre } from "../meta/lecture";

/** Les colonnes toujours là, dans l'ordre des trois Objectifs. Les ratios
 *  dérivés (réactions fortes, abonnés pour 1 000, portée ÷ abonnés) ne
 *  s'ajoutent que choisis : quinze colonnes ne se lisent plus. */
export const COLONNES_FIXES: readonly CleMetrique[] = [
  "portee",
  "vues",
  "jaime",
  "commentaires",
  "partages",
  "enregistrements",
  "taux",
  "abonnes",
  "visites_profil",
];

export type LigneTableau = {
  post: Post;
  place: PlaceDuPost;
  valeurs: Record<CleMetrique, number | null>;
  /** Temps de visionnage moyen en secondes, Reels seuls. */
  visionnage: number | null;
  /** Le post est dans les 12 mois glissants. */
  dansLAnnee: boolean;
};

export type Tableau = {
  metrique: CleMetrique;
  colonnes: CleMetrique[];
  /** Du plus récent au plus ancien — le tri d'ouverture (arbitrage du 2026-11-06). */
  lignes: LigneTableau[];
  /** Le jour de la lecture, `AAAA-MM-JJ` — pour le nom du fichier. */
  jour: string;
};

export type Tri = "date" | "visionnage" | "releve" | CleMetrique;
export type Ordre = "asc" | "desc";

/** Millisecondes → secondes. L'unité vient de la doc Media Insights
 *  (`ig_reels_avg_watch_time`), jamais vérifiée avec notre jeton (migration
 *  § 23) : si la première vraie valeur dément, c'est ici qu'on corrige. */
const MS_PAR_SECONDE = 1000;

/** Temps de visionnage moyen en secondes ; Instagram ne le donne que pour un
 *  Reel — « – » ailleurs (spec, arbitrage du 2026-11-06). */
export function visionnageDe(p: Post): number | null {
  return p.format === "reel" && p.brutes.avgWatchTime !== null ? p.brutes.avgWatchTime / MS_PAR_SECONDE : null;
}

export function tableauDe(posts: Post[], m: CleMetrique, ctx: Contexte): Tableau {
  const foules = foulesDe(posts, m, ctx);
  const colonnes = COLONNES_FIXES.includes(m) ? [...COLONNES_FIXES] : [...COLONNES_FIXES, m];
  const lignes = posts.map((p) => ({
    post: p,
    place: placeDuPost(p, m, foules, ctx),
    valeurs: Object.fromEntries(
      (Object.keys(METRIQUES) as CleMetrique[]).map((c) => [c, valeurDe(p, c)])
    ) as Record<CleMetrique, number | null>,
    visionnage: visionnageDe(p),
    dansLAnnee: dansLesMois(p, ctx),
  }));
  return { metrique: m, colonnes, lignes: trier(lignes, "date", "desc"), jour: ctx.maintenant.slice(0, 10) };
}

function cleDeTri(l: LigneTableau, tri: Tri): number | null {
  if (tri === "date") return Date.parse(l.post.date) || null;
  if (tri === "releve") return l.post.releveA ? Date.parse(l.post.releveA) || null : null;
  if (tri === "visionnage") return l.visionnage;
  return l.valeurs[tri];
}

/** Une copie triée. Sans valeur, en bas dans les deux sens : « – » n'est ni
 *  le plus petit ni le plus grand chiffre. À égalité, le plus récent d'abord. */
export function trier(lignes: LigneTableau[], tri: Tri, ordre: Ordre): LigneTableau[] {
  const sens = ordre === "asc" ? 1 : -1;
  return [...lignes].sort((a, b) => {
    const [va, vb] = [cleDeTri(a, tri), cleDeTri(b, tri)];
    if (va === null || vb === null) {
      if (va !== vb) return va === null ? 1 : -1;
    } else if (va !== vb) {
      return sens * (va - vb);
    }
    return b.post.date.localeCompare(a.post.date) || a.post.id.localeCompare(b.post.id);
  });
}

// ── Ce qui s'écrit ───────────────────────────────────────────────────────────
//
// À la main plutôt que par `Intl` : serveur et navigateur n'ont pas les mêmes
// locales, et deux rendus différents sont une erreur d'hydratation (même
// raison que `lib/meta/lecture.ts`).

/** Le tiret de la spec (« – », demi-cadratin) : une absence, jamais un 0. */
export const TIRET = "–";
const ESPACE_FINE = " ";
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export function formaterValeur(m: CleMetrique, v: number | null): string {
  if (v === null) return TIRET;
  const d = METRIQUES[m];
  return `${nombre(v, d.decimales)}${d.unite ? `${ESPACE_FINE}${d.unite}` : ""}`;
}

export function formaterVisionnage(s: number | null): string {
  return s === null ? TIRET : `${nombre(s, 1)}${ESPACE_FINE}s`;
}

/** « 1 oct. 2026 », en UTC — le jour où Meta date le post. */
export function dateCourte(iso: string | null): string {
  if (!iso) return TIRET;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return TIRET;
  return `${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Ce que la colonne Place écrit ; `null` = rien à écrire (« – »). */
export function libellePlace(p: PlaceDuPost): string | null {
  switch (p.etat) {
    case "place":
      return p.horsNorme ? `${NOM_PLACE[p.place]} · hors norme` : NOM_PLACE[p.place];
    case "plus_d_un_an":
      return "plus d'un an";
    case "jeune":
      return "moins de 48 h";
    case "age_egal":
      return `J+${p.jours}`;
    case "foule_mince":
      return `${p.n} / ${MINIMUM_FOULE} posts`;
    case "format_inconnu":
      return "format inconnu";
    case "sans_valeur":
      return null;
  }
}

/** Pourquoi une place manque ou ce qu'elle veut dire — l'infobulle. */
export function raisonPlace(p: PlaceDuPost): string {
  switch (p.etat) {
    case "place":
      return p.horsNorme
        ? "Au-delà de 1,5 × l'écart entre le bas et le haut de tes habitudes, parmi les posts de ce format des 12 derniers mois."
        : "Parmi les posts de ce format des 12 derniers mois.";
    case "plus_d_un_an":
      return "Publié il y a plus de 12 mois : hors de tout calcul, il se trie sur sa valeur.";
    case "jeune":
      return "Moins de 48 h : ses chiffres bougent encore, il n'a pas de place.";
    case "age_egal":
      return `J+${p.jours} : sa place se lira face aux posts du même âge.`;
    case "foule_mince":
      return `${p.n} ${NOM_FORMAT_PLURIEL[p.format]} ont ce chiffre sur les 12 derniers mois, il en faut ${MINIMUM_FOULE}.`;
    case "format_inconnu":
      return "Meta n'a pas dit si cette vidéo est un Reel ou une vidéo du fil : elle n'entre dans aucune foule.";
    case "sans_valeur":
      return "Instagram n'a pas rendu ce chiffre pour ce post.";
  }
}

// ── L'export CSV ─────────────────────────────────────────────────────────────
//
// Pour un tableur réglé en français : point-virgule, virgule décimale, aucun
// séparateur de milliers, l'unité dans l'en-tête. Date en première colonne
// (spec). Une absence est une cellule VIDE — pas le « — » de l'export Meta :
// une cellule vide ne se somme pas en 0 et ne casse pas une colonne de nombres.

const SEP = ";";

function nombreTableur(v: number | null, decimales: number): string {
  return v === null ? "" : v.toFixed(decimales).replace(".", ",");
}

function jourIso(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function cellule(x: string): string {
  return /[";\r\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x;
}

/** Une légende vient du compte du client : commençant par `=`, `+`, `-` ou
 *  `@`, le tableur l'exécuterait (injection CSV, OWASP ; même garde que
 *  `lib/meta/tableau.ts`). Les textes seulement, jamais les nombres. */
function texte(x: string): string {
  return /^[=+\-@\t\r]/.test(x) ? `'${x}` : x;
}

function enTete(m: CleMetrique): string {
  return METRIQUES[m].unite ? `${METRIQUES[m].nom} (${METRIQUES[m].unite})` : METRIQUES[m].nom;
}

/** Les lignes dans l'ordre donné (celui de l'écran), toutes par défaut. */
export function csvDuTableau(t: Tableau, lignes: LigneTableau[] = t.lignes): string {
  const entete = [
    "Date",
    "Format",
    "Boosté",
    "Légende",
    "Lien",
    `Place (${METRIQUES[t.metrique].nom})`,
    ...t.colonnes.map(enTete),
    "Temps de visionnage moyen (s)",
    "Dernier relevé",
  ];
  const rangs = lignes.map((l) => [
    jourIso(l.post.date),
    l.post.format ? NOM_FORMAT[l.post.format] : "format inconnu",
    l.post.boosteVuLe ? "oui" : "",
    texte(l.post.legende),
    l.post.permalink ?? "",
    libellePlace(l.place) ?? "",
    ...t.colonnes.map((c) => nombreTableur(l.valeurs[c], METRIQUES[c].decimales)),
    nombreTableur(l.visionnage, 1),
    jourIso(l.post.releveA),
  ]);
  return [entete, ...rangs].map((r) => r.map(cellule).join(SEP)).join("\r\n") + "\r\n";
}

export function nomDuFichier(t: Tableau): string {
  return `pulse-instagram-posts-${t.metrique}-${t.jour}.csv`;
}
