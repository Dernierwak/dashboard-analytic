// ── LA LECTURE INSTAGRAM : DES LIGNES DE BASE À LA FOULE ───────────────────
//
// Spec `.scratch/instagram/spec.md`, § « Implementation Decisions — la lecture
// (`lib/instagram/`) ». Le calcul UNIQUE de la foule : le module « Tes posts
// face à ton année », la liste des 5 meilleurs, le Tableau, le Panneau et
// l'export lisent tous ici — la période est libre et les Règles de lecture
// sont dans l'URL, donc rien ne se calcule d'avance (ni en base, ni dans
// `build_payload`). Harnais : `.scratch/instagram-construction/harnais/09-la-lecture/`.
//
// AUCUNE DIRECTIVE ET AUCUN IMPORT, comme `lib/meta/lecture.ts` : sans
// directive, les valeurs se lisent des deux côtés (`CLAUDE.md` §8) ; sans
// import, Node charge le fichier tel quel et le harnais tourne sans Next.
//
// Les règles que ce module tient, chacune testée :
//   · null reste null, 0 reste 0 — l'ancienne lecture (`Number(p.x) || 0`)
//     refaisait des zéros ; un ratio dont un terme manque est vide ;
//   · le format vient de `media_product_type` d'abord : une vidéo du fil n'est
//     pas un Reel, et une `VIDEO` sans produit est un format inconnu, hors des
//     quatre foules ;
//   · la foule d'un post : son format, 12 mois glissants, 48 h d'âge au moins,
//     une valeur ; rien sous 6 ;
//   · aucun total de portée ni de taux.

// ── Le format ────────────────────────────────────────────────────────────────

/** L'ordre est celui des rangées du module, fixe, jamais trié par valeur
 *  (spec, « Tes posts face à ton année »). */
export const FORMATS = ["reel", "carrousel", "image", "video_fil"] as const;
export type Format = (typeof FORMATS)[number];

export const NOM_FORMAT: Record<Format, string> = {
  reel: "Reel",
  carrousel: "Carrousel",
  image: "Image",
  video_fil: "Vidéo du fil",
};

/** Le pluriel, pour « 5 Reels, il en faut 6 ». */
export const NOM_FORMAT_PLURIEL: Record<Format, string> = {
  reel: "Reels",
  carrousel: "Carrousels",
  image: "Images",
  video_fil: "Vidéos du fil",
};

/** `null` = format inconnu, hors des quatre foules. Meta dit `VIDEO` pour un
 *  Reel comme pour une vidéo du fil : seul `media_product_type` les sépare
 *  (migration § 22, 122 posts `VIDEO` au 2026-11-01). Une image ou un
 *  carrousel ne sont jamais un Reel : leur `media_type` suffit. */
export function formatDe(mediaType: string | null, produit: string | null): Format | null {
  if (produit === "REELS") return "reel";
  if (mediaType === "CAROUSEL_ALBUM") return "carrousel";
  if (mediaType === "IMAGE") return "image";
  if (mediaType === "VIDEO" && produit === "FEED") return "video_fil";
  return null;
}

// ── Le post, tel que la base le rend ─────────────────────────────────────────

/** Une ligne d'`instagram_organic_posts` (la fiche et son dernier relevé ;
 *  noms des colonnes : migration, sections 22 et 23). `undefined` = colonne
 *  absente d'une base en retard — lue comme « rien rendu », jamais 0. */
export type LigneBase = {
  post_id: string | number | null;
  date: string | null;
  type: string | null;
  media_product_type?: string | null;
  caption?: string | null;
  media_url?: string | null;
  permalink?: string | null;
  reach?: unknown;
  views?: unknown;
  likes?: unknown;
  comments?: unknown;
  saved?: unknown;
  shares?: unknown;
  follows?: unknown;
  profile_visits?: unknown;
  avg_watch_time?: unknown;
  releve_a?: string | null;
  booste_vu_le?: string | null;
};

export type Brutes = {
  reach: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  saved: number | null;
  shares: number | null;
  follows: number | null;
  profileVisits: number | null;
  /** `ig_reels_avg_watch_time`, en millisecondes d'après la doc Media
   *  Insights (migration § 23 : jamais essayé avec notre jeton). */
  avgWatchTime: number | null;
};

export type Post = {
  /** L'ID Graph du post — stable, c'est la clé de `?post=`. */
  id: string;
  /** Horodatage de publication, ISO. */
  date: string;
  /** Le jour de publication, `AAAA-MM-JJ` en UTC (Meta date en UTC). */
  jour: string;
  format: Format | null;
  legende: string;
  image: string | null;
  permalink: string | null;
  brutes: Brutes;
  /** Le dernier relevé ; `null` = lu avant l'existence du relevé daté. */
  releveA: string | null;
  boosteVuLe: string | null;
  /** Les abonnés mesurés le jour de publication ; `null` = pas de mesure. */
  abonnesAuJour: number | null;
};

/** `null`/`undefined`/texte illisible → `null` ; un nombre, même 0, reste
 *  lui-même. PostgREST rend un `numeric` en texte : il se relit. */
function mesure(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export type LigneAbonnesHistorique = { fetched_at: string | null; followers: unknown };
export type LigneCompteJour = { jour: string | null; abonnes: unknown };

/** Jour → abonnés mesurés. `followers_history` porte la courbe jusqu'au
 *  2026-09-04 (plus rien ne l'écrit depuis, spec § La base) : son DERNIER
 *  relevé du jour. `instagram_compte_jours`, lu chez Meta jour par jour,
 *  l'emporte là où les deux existent. Un null n'est pas une mesure. */
export function abonnesParJourDe(historique: LigneAbonnesHistorique[], jours: LigneCompteJour[]): Record<string, number> {
  const out: Record<string, number> = {};
  const vu: Record<string, string> = {};
  for (const h of historique) {
    const n = mesure(h.followers);
    if (n === null || !h.fetched_at) continue;
    const jour = h.fetched_at.slice(0, 10);
    if (!vu[jour] || h.fetched_at > vu[jour]) {
      vu[jour] = h.fetched_at;
      out[jour] = n;
    }
  }
  for (const j of jours) {
    const n = mesure(j.abonnes);
    if (n !== null && j.jour) out[j.jour.slice(0, 10)] = n;
  }
  return out;
}

/** `abonnesParJour` : jour (`AAAA-MM-JJ`) → abonnés mesurés ce jour-là
 *  (`instagram_compte_jours`, et `followers_history` avant le 2026-09-04). */
export function postDe(l: LigneBase, abonnesParJour: Record<string, number>): Post {
  const date = l.date ?? "";
  const jour = date.slice(0, 10);
  return {
    id: String(l.post_id ?? ""),
    date,
    jour,
    format: formatDe(l.type ?? null, l.media_product_type ?? null),
    legende: l.caption ?? "",
    image: l.media_url || null,
    permalink: l.permalink || null,
    brutes: {
      reach: mesure(l.reach),
      views: mesure(l.views),
      likes: mesure(l.likes),
      comments: mesure(l.comments),
      saved: mesure(l.saved),
      shares: mesure(l.shares),
      follows: mesure(l.follows),
      profileVisits: mesure(l.profile_visits),
      avgWatchTime: mesure(l.avg_watch_time),
    },
    releveA: l.releve_a || null,
    boosteVuLe: l.booste_vu_le || null,
    abonnesAuJour: mesure(abonnesParJour[jour]),
  };
}

// ── Les métriques ────────────────────────────────────────────────────────────

export type Objectif = "portee" | "engagement" | "abonnes";

/** Les métriques du Sélecteur de vue, objectif par objectif, la métrique par
 *  défaut d'abord (spec, tableau « Objectif · Métriques »). */
export const METRIQUES_DE: Record<Objectif, readonly CleMetrique[]> = {
  portee: ["portee", "vues", "portee_abonnes"],
  engagement: ["taux", "jaime", "commentaires", "partages", "enregistrements", "reactions_fortes"],
  abonnes: ["abonnes_1000", "abonnes", "visites_profil"],
};

export type CleMetrique =
  | "portee"
  | "vues"
  | "portee_abonnes"
  | "taux"
  | "jaime"
  | "commentaires"
  | "partages"
  | "enregistrements"
  | "reactions_fortes"
  | "abonnes_1000"
  | "abonnes"
  | "visites_profil";

export type DefMetrique = {
  nom: string;
  objectif: Objectif;
  /** Se somme d'un post à l'autre. Jamais la portée (un compte touché par deux
   *  posts compterait deux fois) ni un ratio (spec, « totaux d'un format »). */
  comptable: boolean;
  decimales: number;
  unite: "" | "%";
  aide: string;
};

export const METRIQUES: Record<CleMetrique, DefMetrique> = {
  portee: { nom: "Portée", objectif: "portee", comptable: false, decimales: 0, unite: "", aide: "Comptes uniques qui ont vu le post." },
  vues: { nom: "Vues", objectif: "portee", comptable: true, decimales: 0, unite: "", aide: "Nombre de fois que le post a été vu." },
  portee_abonnes: {
    nom: "Portée ÷ abonnés",
    objectif: "portee",
    comptable: false,
    decimales: 2,
    unite: "",
    aide: "Portée divisée par les abonnés du jour de publication — vide quand ce jour n'a pas d'abonnés mesurés.",
  },
  taux: {
    nom: "Taux d'engagement",
    objectif: "engagement",
    comptable: false,
    decimales: 1,
    unite: "%",
    aide: "(j'aime + commentaires + enregistrements + partages) ÷ portée.",
  },
  jaime: { nom: "J'aime", objectif: "engagement", comptable: true, decimales: 0, unite: "", aide: "J'aime du post." },
  commentaires: { nom: "Commentaires", objectif: "engagement", comptable: true, decimales: 0, unite: "", aide: "Commentaires du post." },
  partages: { nom: "Partages", objectif: "engagement", comptable: true, decimales: 0, unite: "", aide: "Partages du post." },
  enregistrements: { nom: "Enregistrements", objectif: "engagement", comptable: true, decimales: 0, unite: "", aide: "Enregistrements du post." },
  reactions_fortes: {
    nom: "Réactions fortes",
    objectif: "engagement",
    comptable: false,
    decimales: 1,
    unite: "%",
    aide: "(enregistrements + partages) ÷ portée.",
  },
  abonnes_1000: {
    nom: "Abonnés pour 1 000",
    objectif: "abonnes",
    comptable: false,
    decimales: 1,
    unite: "",
    aide: "Abonnés gagnés pour 1 000 comptes touchés. Instagram ne le donne pas pour un Reel.",
  },
  abonnes: { nom: "Abonnés gagnés", objectif: "abonnes", comptable: true, decimales: 0, unite: "", aide: "Instagram ne le donne pas pour un Reel." },
  visites_profil: { nom: "Visites de profil", objectif: "abonnes", comptable: true, decimales: 0, unite: "", aide: "Instagram ne le donne pas pour un Reel." },
};

export const OBJECTIF_PAR_DEFAUT: Objectif = "engagement";
/** À l'ouverture : Engagement, donc le taux — il se compare d'un post à
 *  l'autre quelle que soit sa portée (arbitrage du 2026-11-06). */
export const METRIQUE_PAR_DEFAUT: CleMetrique = METRIQUES_DE[OBJECTIF_PAR_DEFAUT][0];

export function metriqueDe(cle: string | null | undefined): CleMetrique {
  return cle && cle in METRIQUES ? (cle as CleMetrique) : METRIQUE_PAR_DEFAUT;
}

/** Un ratio sur la portée : vide si un terme manque, ou si la portée est vide
 *  ou nulle — un post que personne n'a vu n'a pas de taux (§7). */
function surPortee(termes: (number | null)[], portee: number | null, facteur: number): number | null {
  if (portee === null || portee === 0 || termes.some((t) => t === null)) return null;
  return ((termes as number[]).reduce((a, b) => a + b, 0) / portee) * facteur;
}

export function valeurDe(p: Post, m: CleMetrique): number | null {
  const b = p.brutes;
  switch (m) {
    case "portee":
      return b.reach;
    case "vues":
      return b.views;
    case "portee_abonnes":
      return p.abonnesAuJour ? surPortee([b.reach], p.abonnesAuJour, 1) : null;
    case "taux":
      // Les partages s'ajoutent aux trois termes de l'ADR 0008 (arbitrage du
      // 2026-11-06) : ils n'étaient pas récoltés quand elle a été écrite.
      return surPortee([b.likes, b.comments, b.saved, b.shares], b.reach, 100);
    case "jaime":
      return b.likes;
    case "commentaires":
      return b.comments;
    case "partages":
      return b.shares;
    case "enregistrements":
      return b.saved;
    case "reactions_fortes":
      // En % comme le taux, pour qu'un même écran ne mêle pas deux unités.
      return surPortee([b.saved, b.shares], b.reach, 100);
    case "abonnes_1000":
      // Un Reel n'a pas de `follows` (erreur 100, essai réel du 2026-11-06).
      return p.format === "reel" ? null : surPortee([b.follows], b.reach, 1000);
    case "abonnes":
      return b.follows;
    case "visites_profil":
      return b.profileVisits;
  }
}

// ── Les quartiles ────────────────────────────────────────────────────────────

export type Quartiles = { q1: number; mediane: number; q3: number };

/** Quartiles en méthode EXCLUSIVE — ceux de `statistics.quantiles(n=4,
 *  method="exclusive")`, la méthode de l'hebdo (`blocs/canaux.py`) : une même
 *  série donne les mêmes bornes sur la page et dans le rapport. Contrôle de la
 *  spec : [1…6] → 1,75 / 3,5 / 5,25. `null` sous deux valeurs (Python lève). */
export function quartiles(valeurs: number[]): Quartiles | null {
  const v = [...valeurs].sort((a, b) => a - b);
  const n = v.length;
  if (n < 2) return null;
  const m = n + 1;
  const point = (i: number) => {
    // Le calcul de CPython, ligne pour ligne : j = i·m // 4 borné à
    // [1 ; n − 1] AVANT delta — sur une petite série, la borne extrapole
    // depuis les deux valeurs extrêmes, comme Python.
    const j = Math.min(Math.max(Math.floor((i * m) / 4), 1), n - 1);
    const delta = i * m - j * 4;
    return (v[j - 1] * (4 - delta) + v[j] * delta) / 4;
  };
  return { q1: point(1), mediane: point(2), q3: point(3) };
}

/** Le coefficient de Tukey, écrit dans l'infobulle de « hors norme » (spec). */
export const COEF_HORS_NORME = 1.5;

export type Limites = { basse: number; haute: number };

export function limitesDe(q: Quartiles): Limites {
  const iqr = q.q3 - q.q1;
  return { basse: q.q1 - COEF_HORS_NORME * iqr, haute: q.q3 + COEF_HORS_NORME * iqr };
}

// ── L'âge et l'année ─────────────────────────────────────────────────────────

const HEURE_MS = 3_600_000;

/** 48 h : la seule latence que Meta documente pour les insights d'un post
 *  (spec, « âge » ; `.scratch/instagram/issues/03`). */
export const AGE_MINIMUM_HEURES = 48;
/** De 48 h à 7 jours, un post se place à âge égal ; au-delà, sur la référence. */
export const AGE_EGAL_JUSQUA_HEURES = 7 * 24;

/** Heures entre la publication et le dernier relevé. `null` sans relevé daté
 *  ou sans date lisible. */
export function ageDe(p: Post): number | null {
  if (!p.releveA) return null;
  const a = Date.parse(p.releveA);
  const d = Date.parse(p.date);
  if (!Number.isFinite(a) || !Number.isFinite(d)) return null;
  return (a - d) / HEURE_MS;
}

export type Maturite = "jeune" | "age_egal" | "mur";

/** Sans relevé daté, le post a été lu avant que le relevé existe — il a donc
 *  plus de 7 jours (spec, « âge »). */
export function maturiteDe(p: Post): Maturite {
  const age = ageDe(p);
  if (age === null) return "mur";
  if (age < AGE_MINIMUM_HEURES) return "jeune";
  if (age < AGE_EGAL_JUSQUA_HEURES) return "age_egal";
  return "mur";
}

export type Contexte = {
  /** L'instant de la lecture, ISO — les 12 mois glissants finissent ici. */
  maintenant: string;
};

/** Le début d'une fenêtre de `mois` mois glissants finissant à `maintenant`,
 *  en mois du calendrier (le 7 novembre → le 7 novembre d'avant). */
export function debutDesMois(maintenant: string, mois: number): string {
  const d = new Date(maintenant);
  d.setUTCMonth(d.getUTCMonth() - mois);
  return d.toISOString();
}

export const MOIS_DE_REFERENCE = 12;

export function dansLesMois(p: Post, ctx: Contexte, mois: number = MOIS_DE_REFERENCE): boolean {
  const t = Date.parse(p.date);
  return Number.isFinite(t) && t >= Date.parse(debutDesMois(ctx.maintenant, mois)) && t <= Date.parse(ctx.maintenant);
}

// ── La foule ─────────────────────────────────────────────────────────────────

/** Sous 6 posts, ni quartiles, ni place, ni moustache (spec ; le même
 *  minimum que l'hebdo, `SEMAINES_MINIMUM` de `lib/hebdo/canaux.ts`). */
export const MINIMUM_FOULE = 6;

export type Foule = {
  format: Format;
  metrique: CleMetrique;
  /** Bornes de la fenêtre, ISO. */
  debut: string;
  fin: string;
  /** Les posts qui la font : format, fenêtre, ≥ 48 h, une valeur. */
  posts: Post[];
  /** `n` : ceux qui ont une valeur ; `sur` : tous ceux du format, de la
   *  fenêtre et de l'âge voulus — « 11 images sur 12 ont ce chiffre ». */
  n: number;
  sur: number;
  /** `null` sous `MINIMUM_FOULE`. */
  quartiles: Quartiles | null;
  limites: Limites | null;
};

/** Les posts d'un format qui ont l'âge et la date pour entrer dans une foule,
 *  avec ou sans valeur — le « sur n » de « 11 images sur 12 ont ce chiffre ». */
export function eligiblesDe(posts: Post[], format: Format, ctx: Contexte, mois: number = MOIS_DE_REFERENCE): Post[] {
  return posts.filter((p) => p.format === format && maturiteDe(p) !== "jeune" && dansLesMois(p, ctx, mois));
}

/** La foule d'un format sur une métrique : la référence (12 mois glissants),
 *  ou une fenêtre plus courte pour les pastilles 3 mois / 1 mois. Le post
 *  lui-même y est compris. Elle ne sait rien des Règles de lecture : leurs
 *  écartés sont retirés AVANT cet appel (`retenus`, `regles.ts`). */
export function fouleDe(posts: Post[], format: Format, m: CleMetrique, ctx: Contexte, mois: number = MOIS_DE_REFERENCE): Foule {
  const eligibles = eligiblesDe(posts, format, ctx, mois);
  const membres = eligibles.filter((p) => valeurDe(p, m) !== null);
  const q = membres.length >= MINIMUM_FOULE ? quartiles(membres.map((p) => valeurDe(p, m) as number)) : null;
  return {
    format,
    metrique: m,
    debut: debutDesMois(ctx.maintenant, mois),
    fin: ctx.maintenant,
    posts: membres,
    n: membres.length,
    sur: eligibles.length,
    quartiles: q,
    limites: q && limitesDe(q),
  };
}

export function foulesDe(posts: Post[], m: CleMetrique, ctx: Contexte, mois: number = MOIS_DE_REFERENCE): Record<Format, Foule> {
  return Object.fromEntries(FORMATS.map((f) => [f, fouleDe(posts, f, m, ctx, mois)])) as Record<Format, Foule>;
}

// ── La place ─────────────────────────────────────────────────────────────────

export type Place = "en_dessous" | "bas" | "haut" | "au_dessus";

export const NOM_PLACE: Record<Place, string> = {
  en_dessous: "en dessous",
  bas: "bas de tes habitudes",
  haut: "haut de tes habitudes",
  au_dessus: "au-dessus",
};

/** Bornes de l'arbitrage du 2026-11-06, les mêmes que l'hebdo
 *  (`blocs/canaux.py`) : < q1 ; q1 ≤ v < médiane ; médiane ≤ v ≤ q3 (un post
 *  pile au post type est en haut) ; > q3. */
export function bandeDe(v: number, q: Quartiles): Place {
  if (v < q.q1) return "en_dessous";
  if (v < q.mediane) return "bas";
  if (v <= q.q3) return "haut";
  return "au_dessus";
}

/** Strictement au-delà des limites de Tukey. */
export function estHorsNorme(v: number, l: Limites): boolean {
  return v < l.basse || v > l.haute;
}

/** Pourquoi une Règle de lecture a retiré un post de sa foule (`regles.ts`) :
 *  « écarté : boosté », « écarté : hors norme sur les j'aime » (spec). */
export type RaisonEcart = { cause: "booste" } | { cause: "hors_norme"; metrique: CleMetrique };

export type PlaceDuPost =
  | { etat: "place"; place: Place; horsNorme: boolean }
  /** Retiré par une Règle de lecture : il reste à l'écran, grisé, avec sa
   *  raison — rien ne disparaît sans trace (user story 28). */
  | { etat: "ecarte"; raison: RaisonEcart }
  | { etat: "plus_d_un_an" }
  | { etat: "jeune" }
  /** De 48 h à 7 jours : sa place se lit à âge égal (ticket 13). */
  | { etat: "age_egal"; jours: number }
  | { etat: "format_inconnu" }
  | { etat: "sans_valeur" }
  /** `ecartes` : combien un filtre en a retiré, la raison de la mention sous
   *  6 (spec) ; absent quand aucun filtre n'a rien retiré. */
  | { etat: "foule_mince"; n: number; format: Format; ecartes?: number };

/** La place d'un post sur la métrique choisie, face à la foule de son format.
 *  `foules` vient de `foulesDe` sur la même métrique et le même contexte. */
export function placeDuPost(p: Post, m: CleMetrique, foules: Record<Format, Foule>, ctx: Contexte): PlaceDuPost {
  if (!dansLesMois(p, ctx)) return { etat: "plus_d_un_an" };
  if (p.format === null) return { etat: "format_inconnu" };
  const maturite = maturiteDe(p);
  if (maturite === "jeune") return { etat: "jeune" };
  const v = valeurDe(p, m);
  if (v === null) return { etat: "sans_valeur" };
  if (maturite === "age_egal") return { etat: "age_egal", jours: Math.floor((ageDe(p) as number) / 24) };
  const f = foules[p.format];
  if (!f.quartiles || !f.limites) return { etat: "foule_mince", n: f.n, format: p.format };
  return { etat: "place", place: bandeDe(v, f.quartiles), horsNorme: estHorsNorme(v, f.limites) };
}

// ── Les totaux ───────────────────────────────────────────────────────────────

export type Total = {
  /** `null` quand aucun post n'a de valeur : pas de total à 0. */
  total: number | null;
  avecValeur: number;
  n: number;
};

/** La somme des valeurs non vides, avec « x sur n ». `null` pour ce qui ne
 *  se compte pas : la portée et les ratios. */
export function totalDe(posts: Post[], m: CleMetrique): Total | null {
  if (!METRIQUES[m].comptable) return null;
  const valeurs = posts.map((p) => valeurDe(p, m)).filter((v): v is number => v !== null);
  return {
    total: valeurs.length ? valeurs.reduce((a, b) => a + b, 0) : null,
    avecValeur: valeurs.length,
    n: posts.length,
  };
}
