// ── « TES POSTS FACE À TON ANNÉE » : CE QUE LE MODULE MONTRE ────────────────
//
// Spec `.scratch/instagram/spec.md`, § « Tes posts face à ton année » et § La
// lecture, lignes « la référence », « 3 mois, 1 mois », « totaux » ; user
// stories 13 à 18 et 22. Harnais :
// `.scratch/instagram-construction/harnais/10-l-objectif-et-l-annee/`.
//
// Tout part de `fouleDe` (`lecture.ts`) : la foule se calcule une seule fois,
// ici on ne fait que la ranger par fenêtre (12 / 3 / 1 mois) et par format.
// Sans directive, comme `lecture.ts` (`CLAUDE.md` §8) ; imports relatifs sans
// extension pour Next, résolus par le crochet du harnais.
//
// Les règles que ce module tient, chacune testée :
//   · la PÉRIODE ne choisit que les points du nuage : les moustaches, le post
//     type et les pastilles ne dépendent que de l'instant de la lecture —
//     changer la période ne bouge pas la référence (user story 16) ;
//   · rien sous 6 : ni boîte, ni post type, ni pastille ;
//   · un post type des 12 mois à 0 n'a pas de % (§7) : l'écart s'écrit en valeur ;
//   · un hors norme n'étire pas l'axe, il est compté ;
//   · le Reel en Abonnés reçoit une phrase, jamais une moustache à zéro.
//
// La liste des 5 meilleurs (ticket 11), les Règles de lecture (12) et l'âge
// égal (13) s'ajoutent à côté : les Règles retireront des posts AVANT
// `moduleAnneeDe`, l'âge égal changera la place portée par chaque point.
import {
  eligiblesDe,
  fouleDe,
  FORMATS,
  limitesDe,
  maturiteDe,
  METRIQUES,
  dansLesMois,
  debutDesMois,
  placeDuPost,
  foulesDe,
  totalDe,
  valeurDe,
  type Brutes,
  type CleMetrique,
  type Contexte,
  type Format,
  type PlaceDuPost,
  type Post,
  type Quartiles,
  type Total,
} from "./lecture";
import { formaterValeur } from "./tableau";
// L'écart s'écrit comme sur la page Meta : une décimale sous 10 %, « − ».
import { formaterEcart } from "../meta/lecture";

/** Les bornes de la période du Bandeau, `AAAA-MM-JJ` incluses (`periodeDe`
 *  de `lib/meta/lecture.ts`, le jour en cours toujours exclu). */
export type PeriodeLue = { debut: string; fin: string };

// ── La ligne de référence ────────────────────────────────────────────────────

/** `complete` : la base remonte au-delà des 12 mois. Sinon la référence écrit
 *  ce qu'elle couvre — « tes posts du 3 août au 5 novembre 2026 (42) » —, la
 *  même ligne pendant le Rattrapage et pour un compte gratuit (user story 22). */
export type Reference = { complete: true } | { complete: false; debut: string; fin: string; n: number };

function referenceDe(posts: Post[], ctx: Contexte): Reference | null {
  const lisibles = posts.filter((p) => Number.isFinite(Date.parse(p.date)));
  if (lisibles.length === 0) return null;
  const debutAnnee = Date.parse(debutDesMois(ctx.maintenant, 12));
  if (lisibles.some((p) => Date.parse(p.date) < debutAnnee)) return { complete: true };
  // Ceux qu'une rangée peut lire : un format inconnu n'entre dans aucune foule.
  const annee = lisibles.filter((p) => p.format !== null && dansLesMois(p, ctx)).map((p) => p.jour).sort();
  if (annee.length === 0) return null;
  return { complete: false, debut: annee[0], fin: annee[annee.length - 1], n: annee.length };
}

// ── Les moustaches et les pastilles ──────────────────────────────────────────

/** Les trois fenêtres, dans l'ordre de l'écran : 12 mois « la référence »,
 *  3 derniers mois « à lire avec prudence », dernier mois « encore mince ». */
export const FENETRES = [12, 3, 1] as const;
export type Fenetre = (typeof FENETRES)[number];

export type Moustache =
  /** Sous 6 posts : « 5 / 6 posts » à la place de la boîte. */
  | { etat: "mince"; mois: Fenetre; n: number }
  | {
      etat: "boite";
      mois: Fenetre;
      n: number;
      quartiles: Quartiles;
      /** Les bouts des moustaches : la valeur la plus extrême encore dans les
       *  limites de Tukey — elles s'arrêtent à la limite hors norme. */
      basse: number;
      haute: number;
      horsNormeBas: number;
      horsNormeHaut: number;
      /** Les valeurs des posts qui la font, hors norme exclus (comptés). */
      points: number[];
      /** De 0 à 1 : largeur et encre de la boîte. */
      poids: number;
    };

export type Pastille =
  | { etat: "mince"; mois: Fenetre; n: number }
  /** Pas de post type des 12 mois (moins de 6 posts) : rien à comparer. */
  | { etat: "sans_reference"; mois: Fenetre; n: number }
  | { etat: "pourcent"; mois: Fenetre; n: number; ecart: number }
  /** Post type des 12 mois à 0 : un % n'existe pas, l'écart est en valeur. */
  | { etat: "valeur"; mois: Fenetre; n: number; ecart: number };

/** La largeur et l'encre d'une boîte suivent √(n ÷ n de l'année) — la règle du
 *  prototype retenu par David (version D, `_prototype-page/maquette.tsx`,
 *  `MoustachesPesees`) : une boîte de 6 posts se voit plus mince qu'une de 42,
 *  sans disparaître. */
function poidsDe(n: number, nAnnee: number): number {
  return nAnnee > 0 ? Math.min(1, Math.sqrt(n / nAnnee)) : 0;
}

export function moustacheDe(posts: Post[], format: Format, m: CleMetrique, ctx: Contexte, mois: Fenetre, nAnnee: number): Moustache {
  const f = fouleDe(posts, format, m, ctx, mois);
  if (!f.quartiles) return { etat: "mince", mois, n: f.n };
  const l = limitesDe(f.quartiles);
  const valeurs = f.posts.map((p) => valeurDe(p, m) as number).sort((a, b) => a - b);
  const dedans = valeurs.filter((v) => v >= l.basse && v <= l.haute);
  return {
    etat: "boite",
    mois,
    n: f.n,
    quartiles: f.quartiles,
    basse: dedans[0],
    haute: dedans[dedans.length - 1],
    horsNormeBas: valeurs.filter((v) => v < l.basse).length,
    horsNormeHaut: valeurs.filter((v) => v > l.haute).length,
    points: dedans,
    poids: mois === 12 ? 1 : poidsDe(f.n, nAnnee),
  };
}

/** Le post type de la fenêtre face à celui des 12 mois — jamais entre elles
 *  (spec ; `.scratch/instagram/issues/20`). */
function pastilleDe(fenetre: Moustache, postType: number | null): Pastille {
  const { mois, n } = fenetre;
  if (fenetre.etat === "mince") return { etat: "mince", mois, n };
  if (postType === null) return { etat: "sans_reference", mois, n };
  const ecart = fenetre.quartiles.mediane - postType;
  if (postType === 0) return { etat: "valeur", mois, n, ecart };
  return { etat: "pourcent", mois, n, ecart: (ecart / postType) * 100 };
}

// ── Le nuage ─────────────────────────────────────────────────────────────────

export type PointNuage = {
  post: Post;
  valeur: number;
  /** Moins de 48 h : un point vide, hors de la foule. */
  jeune: boolean;
  /** Au-delà du haut de l'axe : marqué en haut, sa valeur écrite. */
  horsAxe: boolean;
  place: PlaceDuPost;
};

// ── La rangée d'un format ────────────────────────────────────────────────────

export type RangeeLue = {
  etat: "lue";
  format: Format;
  /** La médiane des 12 mois ; `null` sous 6 posts. */
  postType: number | null;
  n: number;
  sur: number;
  /** `null` pour ce qui ne se compte pas (portée, ratios). Sur les 12 mois. */
  total: Total | null;
  pastilles: [Pastille, Pastille];
  moustaches: [Moustache, Moustache, Moustache];
  /** Les posts de la période qui ont une valeur, du plus ancien au plus récent. */
  nuage: PointNuage[];
  /** Tous les posts du format sur la période, avec ou sans valeur. */
  surLaPeriode: number;
  /** Le haut de l'axe commun du nuage et des moustaches ; le bas est 0. */
  axeMax: number;
};

export type RangeeSansMetrique = { etat: "sans_metrique"; format: Format; phrase: string };
export type Rangee = RangeeLue | RangeeSansMetrique;

/** Le Reel n'a ni `follows` ni visites de profil (erreur 100, essai réel du
 *  2026-11-06 ; `.scratch/instagram/issues/02`) : sa rangée le dit, au lieu
 *  d'une moustache faite de vides qu'on lirait comme des zéros (user story 14). */
const ABSENT_DU_REEL: Partial<Record<CleMetrique, string>> = {
  abonnes_1000: "Instagram ne donne pas les abonnés gagnés pour les Reels.",
  abonnes: "Instagram ne donne pas les abonnés gagnés pour les Reels.",
  visites_profil: "Instagram ne donne pas les visites de profil pour les Reels.",
};

/** L'axe s'arrête au plus haut bout de moustache et aux points de la période
 *  restés dans les limites de l'année : un hors norme est compté, il n'écrase
 *  pas les autres en étirant l'axe (spec, deuxième tour de la maquette). */
function axeMaxDe(moustaches: Moustache[], valeursPeriode: number[], haute: number | null): number {
  const bouts = moustaches.flatMap((b) => (b.etat === "boite" ? [b.haute] : []));
  const points = valeursPeriode.filter((v) => haute === null || v <= haute);
  const max = Math.max(0, ...bouts, ...points);
  // Une rangée toute à zéro garde un axe : rien n'est divisé par zéro au dessin.
  return max > 0 ? max : 1;
}

function rangeeDe(posts: Post[], format: Format, m: CleMetrique, periode: PeriodeLue, ctx: Contexte, foules: ReturnType<typeof foulesDe>): Rangee {
  const phrase = format === "reel" ? ABSENT_DU_REEL[m] : undefined;
  if (phrase) return { etat: "sans_metrique", format, phrase };

  const annee = foules[format];
  const moustaches = [
    moustacheDe(posts, format, m, ctx, 12, annee.n),
    moustacheDe(posts, format, m, ctx, 3, annee.n),
    moustacheDe(posts, format, m, ctx, 1, annee.n),
  ] as [Moustache, Moustache, Moustache];
  const postType = annee.quartiles?.mediane ?? null;

  const dePeriode = posts
    .filter((p) => p.format === format && p.jour >= periode.debut && p.jour <= periode.fin)
    .sort((a, b) => a.date.localeCompare(b.date));
  const avecValeur = dePeriode.flatMap((p) => {
    const v = valeurDe(p, m);
    return v === null ? [] : [{ post: p, valeur: v }];
  });
  const axeMax = axeMaxDe(moustaches, avecValeur.map((x) => x.valeur), annee.limites?.haute ?? null);

  return {
    etat: "lue",
    format,
    postType,
    n: annee.n,
    sur: annee.sur,
    total: totalDe(eligiblesDe(posts, format, ctx), m),
    pastilles: [pastilleDe(moustaches[1], postType), pastilleDe(moustaches[2], postType)],
    moustaches,
    nuage: avecValeur.map(({ post, valeur }) => ({
      post,
      valeur,
      jeune: maturiteDe(post) === "jeune",
      horsAxe: valeur > axeMax,
      place: placeDuPost(post, m, foules, ctx),
    })),
    surLaPeriode: dePeriode.length,
    axeMax,
  };
}

// ── Le module ────────────────────────────────────────────────────────────────

export type ModuleAnnee = {
  metrique: CleMetrique;
  periode: PeriodeLue;
  /** `null` : aucun post en base (l'état « compte neuf », ticket 15). */
  reference: Reference | null;
  /** Ordre fixe — Reel, Carrousel, Image, Vidéo du fil —, jamais trié par
   *  valeur ; un format sans aucun post sur 12 mois n'a pas de rangée. */
  rangees: Rangee[];
};

export function moduleAnneeDe(posts: Post[], m: CleMetrique, periode: PeriodeLue, ctx: Contexte): ModuleAnnee {
  const foules = foulesDe(posts, m, ctx);
  // Un post de moins de 48 h compte pour ouvrir la rangée : il paraît au
  // nuage, en point vide, même s'il n'entre pas encore dans la foule.
  const presents = FORMATS.filter((f) => posts.some((p) => p.format === f && dansLesMois(p, ctx)));
  return {
    metrique: m,
    periode,
    reference: referenceDe(posts, ctx),
    rangees: presents.map((f) => rangeeDe(posts, f, m, periode, ctx, foules)),
  };
}

// ── Une métrique pas encore en base ──────────────────────────────────────────

type Source = keyof Brutes | "abonnesAuJour";

/** Ce dont chaque métrique a besoin (spec, tableau des calculs). */
const SOURCES: Record<CleMetrique, Source[]> = {
  portee: ["reach"],
  vues: ["views"],
  portee_abonnes: ["reach", "abonnesAuJour"],
  taux: ["likes", "comments", "saved", "shares", "reach"],
  jaime: ["likes"],
  commentaires: ["comments"],
  partages: ["shares"],
  enregistrements: ["saved"],
  reactions_fortes: ["saved", "shares", "reach"],
  abonnes_1000: ["follows", "reach"],
  abonnes: ["follows"],
  visites_profil: ["profileVisits"],
};

const NOM_SOURCE: Record<Source, string> = {
  reach: "la portée",
  views: "les vues",
  likes: "les j'aime",
  comments: "les commentaires",
  saved: "les enregistrements",
  shares: "les partages",
  follows: "les abonnés gagnés",
  profileVisits: "les visites de profil",
  avgWatchTime: "le temps de visionnage",
  abonnesAuJour: "les abonnés du jour de publication",
};

function lu(p: Post, s: Source): boolean {
  return s === "abonnesAuJour" ? p.abonnesAuJour !== null : p.brutes[s] !== null;
}

/** Pourquoi une métrique est grisée au Sélecteur ; `null` = au moins un post
 *  l'a. Une base sans aucun post ne grise rien : c'est l'état « compte neuf ». */
export function raisonIndisponible(posts: Post[], m: CleMetrique): string | null {
  if (posts.length === 0 || posts.some((p) => valeurDe(p, m) !== null)) return null;
  const manquent = SOURCES[m].filter((s) => !posts.some((p) => lu(p, s)));
  if (manquent.length === 0) return `Aucun post n'a encore ${METRIQUES[m].nom.toLowerCase()}.`;
  return `Pas encore en base : ${manquent.map((s) => NOM_SOURCE[s]).join(", ")}.`;
}

// ── Ce qui s'écrit ───────────────────────────────────────────────────────────
//
// À la main, sans `Intl` : serveur et navigateur n'ont pas les mêmes locales
// (même raison que `tableau.ts`).

const MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function jourLong(jour: string, avecAnnee: boolean): string {
  const [a, m, j] = jour.split("-");
  return `${Number(j)} ${MOIS_LONGS[Number(m) - 1]}${avecAnnee ? ` ${a}` : ""}`;
}

/** La référence, au-dessus des rangées (spec, user story 22). */
export function texteReference(r: Reference): string {
  if (r.complete) return "tes 12 derniers mois, format par format — elle ne bouge pas avec la période";
  const memeAnnee = r.debut.slice(0, 4) === r.fin.slice(0, 4);
  return `tes posts du ${jourLong(r.debut, !memeAnnee)} au ${jourLong(r.fin, true)} (${r.n})`;
}

/** « 3 mois +9 % · 15 posts » ; `null` = pas de pastille (sous 6, ou rien à
 *  comparer). L'écart est toujours écrit et signé, jamais « ≈ » (spec). */
export function textePastille(p: Pastille, m: CleMetrique): string | null {
  const posts = `${p.n} posts`;
  if (p.etat === "pourcent") return `${p.mois} mois ${formaterEcart(p.ecart)} · ${posts}`;
  if (p.etat !== "valeur") return null;
  const d = METRIQUES[m];
  const valeur = formaterValeur(m, Math.abs(p.ecart));
  // Un compte s'écrit avec son nom (« 2 abonnés gagnés ») ; un ratio porte
  // déjà son unité ou n'en a pas.
  const quoi = d.comptable ? `${valeur} ${d.nom.toLowerCase()}` : valeur;
  const sens = p.ecart > 0 ? "de plus" : p.ecart < 0 ? "de moins" : "d'écart";
  return `${p.mois} mois : ${quoi} ${sens} · ${posts}`;
}
