// ── LES STORIES : DES LIGNES DE BASE À LA JOURNÉE ────────────────────────────
//
// Spec `.scratch/instagram-stories/spec.md`, § Vocabulaire et § Ce que la page
// montre ; décisions et raisons dans `issues/03` (la journée) et `issues/05`
// (la place dans la page). Harnais : `.scratch/instagram-stories/harnais/02-la-page/`.
//
// Une JOURNÉE DE STORIES (les stories publiées un même jour, calendrier des
// posts de la page : le jour UTC où Meta date la publication) est l'unité qui
// se lit, se compare et se classe. Elle devient un `Post` de format `story`
// (`journeeEnPost`) : la foule, la place, les moustaches, la liste des 5 et le
// Tableau la lisent sans calcul parallèle (`lecture.ts`).
//
// Les règles que ce module tient, chacune testée :
//   · les comptes s'ADDITIONNENT sur les stories de la journée (vues,
//     partages, interactions, abonnés gagnés, visites de profil, clics sur le
//     lien, navigation) — une somme ne prend que ce qui a été mesuré, jamais
//     complétée, et vaut `null` si rien ne l'a été ;
//   · la portée ne s'additionne JAMAIS : celle d'une journée est
//     `reach_story` du compte ce jour-là, dédoublonnée par Instagram ; absente,
//     elle vaut `null` (« – ») ;
//   · seul ratio : sorties pour 100 vues, `tap_exit` ÷ `views` sur les MÊMES
//     stories ; aucun ratio entre la portée du jour et une somme ;
//   · une journée est COMPLÈTE quand toutes ses stories ont un relevé à 20 h
//     de vie ou plus ; seule une journée complète se compare. Le jour en cours
//     n'est jamais complet (§7 : d'autres stories peuvent encore paraître).
//
// Sans directive (`CLAUDE.md` §8) ; aucun import d'exécution : les types de
// `lecture.ts` s'effacent, Node charge le fichier tel quel.
import type { Brutes, Post } from "./lecture";

// ── La story, telle que la base la rend ──────────────────────────────────────

/** Une ligne d'`instagram_stories` (spec § La base, section 27). `undefined`
 *  = colonne absente, lue comme « rien rendu », jamais 0. */
export type LigneStory = {
  story_id: string | number | null;
  publiee_a: string | null;
  media_type?: string | null;
  permalink?: string | null;
  image_path?: string | null;
  vue_le?: string | null;
  releve_a?: string | null;
  age_heures?: unknown;
  reach?: unknown;
  views?: unknown;
  shares?: unknown;
  total_interactions?: unknown;
  follows?: unknown;
  profile_visits?: unknown;
  link_clicks?: unknown;
  nav_tap_forward?: unknown;
  nav_tap_back?: unknown;
  nav_tap_exit?: unknown;
  nav_swipe_forward?: unknown;
};

/** Les comptes d'une story, et ce qui s'additionne sur une journée. Pas de
 *  `replies` : 0 pour toute story créée en Europe (spec, « Jamais »). */
export type Comptes = {
  vues: number | null;
  partages: number | null;
  interactions: number | null;
  abonnes: number | null;
  visitesProfil: number | null;
  clicsLien: number | null;
  avancer: number | null;
  revenir: number | null;
  quitter: number | null;
  suivante: number | null;
};

const CLES_COMPTES: readonly (keyof Comptes)[] = [
  "vues",
  "partages",
  "interactions",
  "abonnes",
  "visitesProfil",
  "clicsLien",
  "avancer",
  "revenir",
  "quitter",
  "suivante",
];

/** `relue` : relevé final pris, des chiffres ; `sans_chiffres` : relevé pris,
 *  Instagram n'a rien rendu (il n'en donne pas sous 5 spectateurs) ;
 *  `a_relire` : pas encore de relevé, la story vit encore ; `jamais_relue` :
 *  disparue sans relevé. */
export type EtatStory = "relue" | "sans_chiffres" | "a_relire" | "jamais_relue";

export type Story = {
  id: string;
  publieeA: string;
  mediaType: string | null;
  permalink: string | null;
  /** URL signée de la vignette (bucket privé), ou `null`. */
  image: string | null;
  releveA: string | null;
  /** L'âge réel de la story au relevé, en heures. */
  ageHeures: number | null;
  /** La portée de CETTE story — affichée dans le Panneau, jamais sommée. */
  portee: number | null;
  comptes: Comptes;
  etat: EtatStory;
};

/** 20 h : le job ne relit une story qu'à 20 h de vie ou plus (spec § La
 *  récolte, point 3) ; c'est le seuil du relevé final. */
export const AGE_RELEVE_FINAL_HEURES = 20;
/** 24 h : une story disparaît d'Instagram ; sans relevé passé ce délai, elle
 *  ne sera jamais relue. */
export const VIE_STORY_HEURES = 24;

const HEURE_MS = 3_600_000;

function mesure(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function etatDe(l: LigneStory, ageHeures: number | null, comptes: Comptes, portee: number | null, maintenant: number, publiee: number): EtatStory {
  const relue = !!l.releve_a && ageHeures !== null && ageHeures >= AGE_RELEVE_FINAL_HEURES;
  if (relue) return portee === null && CLES_COMPTES.every((k) => comptes[k] === null) ? "sans_chiffres" : "relue";
  return (maintenant - publiee) / HEURE_MS < VIE_STORY_HEURES ? "a_relire" : "jamais_relue";
}

/** Une ligne illisible (sans id ou sans date) n'est pas une story. */
export function storyDe(l: LigneStory, maintenant: string, images: Record<string, string> = {}): Story | null {
  const publiee = Date.parse(l.publiee_a ?? "");
  if (!Number.isFinite(publiee) || l.story_id === null || l.story_id === undefined || l.story_id === "") return null;
  const ageHeures = mesure(l.age_heures);
  const comptes: Comptes = {
    vues: mesure(l.views),
    partages: mesure(l.shares),
    interactions: mesure(l.total_interactions),
    abonnes: mesure(l.follows),
    visitesProfil: mesure(l.profile_visits),
    clicsLien: mesure(l.link_clicks),
    avancer: mesure(l.nav_tap_forward),
    revenir: mesure(l.nav_tap_back),
    quitter: mesure(l.nav_tap_exit),
    suivante: mesure(l.nav_swipe_forward),
  };
  const portee = mesure(l.reach);
  return {
    id: String(l.story_id),
    publieeA: new Date(publiee).toISOString(),
    mediaType: l.media_type ?? null,
    permalink: l.permalink || null,
    image: (l.image_path && images[l.image_path]) || null,
    releveA: l.releve_a || null,
    ageHeures,
    portee,
    comptes,
    etat: etatDe(l, ageHeures, comptes, portee, Date.parse(maintenant), publiee),
  };
}

/** Le jour de publication, `AAAA-MM-JJ` en UTC — le calendrier des posts
 *  (`postDe` : `date.slice(0, 10)`, Meta date en UTC). */
export function jourDe(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

// ── La journée ───────────────────────────────────────────────────────────────

export type EtatJournee = "complete" | "en_cours" | "incomplete";

export type JourneeStories = {
  jour: string;
  /** Dans l'ordre de publication. */
  stories: Story[];
  etat: EtatJournee;
  /** Les stories sans chiffres : relevées sans rien rendu, ou jamais relues.
   *  La journée l'écrit, ses sommes restent partielles. */
  sansChiffres: number;
  jamaisRelues: number;
  /** Journée publiée avant le premier passage du job : ses stories déjà
   *  disparues n'ont jamais été vues, la journée ne sera jamais complète. */
  avantRecolte: boolean;
  /** `reach_story` du compte ce jour-là — comptes touchés par des stories ce
   *  jour-là, celles de la veille encore en ligne comprises. `null` = pas
   *  relevée. */
  porteeDuJour: number | null;
  sommes: Comptes;
  /** Pour chaque somme, combien de stories l'ont : « sur 4 stories ». */
  mesurees: Record<keyof Comptes, number>;
  /** `quitter` ÷ `vues` × 100, sur les stories qui ont les deux. */
  sortiesPour100: number | null;
};

function somme(stories: Story[], k: keyof Comptes): { total: number | null; n: number } {
  const valeurs = stories.map((s) => s.comptes[k]).filter((v): v is number => v !== null);
  return { total: valeurs.length ? valeurs.reduce((a, b) => a + b, 0) : null, n: valeurs.length };
}

/** Deux comptes rendus par Instagram sur les mêmes stories, sans estimation
 *  (ticket 03, point 4). Une story sans vues ou sans sorties n'y entre pas ;
 *  aucune vue → pas de ratio (§7, pas de « +∞ »). */
export function sortiesPour100De(stories: Story[]): number | null {
  const paires = stories.filter((s) => s.comptes.quitter !== null && s.comptes.vues !== null);
  const vues = paires.reduce((a, s) => a + (s.comptes.vues as number), 0);
  if (paires.length === 0 || vues === 0) return null;
  return (paires.reduce((a, s) => a + (s.comptes.quitter as number), 0) / vues) * 100;
}

function etatJourneeDe(jour: string, stories: Story[], maintenant: string, avantRecolte: boolean): EtatJournee {
  if (avantRecolte) return "incomplete";
  // Le jour en cours n'est jamais complet : d'autres stories peuvent encore
  // paraître, et toute comparaison l'exclut (`CLAUDE.md` §7).
  if (jour >= maintenant.slice(0, 10)) return "en_cours";
  if (stories.some((s) => s.etat === "a_relire")) return "en_cours";
  if (stories.some((s) => s.etat === "jamais_relue")) return "incomplete";
  return "complete";
}

export function journeeDe(
  jour: string,
  stories: Story[],
  porteeDuJour: number | null,
  maintenant: string,
  debutRecolte: string | null = null
): JourneeStories {
  // Une story publiée le jour J vit jusqu'à J+1 à la même heure : le job ne
  // les a toutes vues que s'il passait déjà le jour J. Les journées d'avant
  // son premier passage n'ont que les stories encore en ligne ce jour-là
  // (constaté au premier passage réel, 2026-11-25 : une seule story du 24).
  const avantRecolte = debutRecolte !== null && jour < debutRecolte;
  const triees = [...stories].sort((a, b) => a.publieeA.localeCompare(b.publieeA) || a.id.localeCompare(b.id));
  const sommes = {} as Comptes;
  const mesurees = {} as Record<keyof Comptes, number>;
  for (const k of CLES_COMPTES) {
    const s = somme(triees, k);
    sommes[k] = s.total;
    mesurees[k] = s.n;
  }
  const jamaisRelues = triees.filter((s) => s.etat === "jamais_relue").length;
  return {
    jour,
    stories: triees,
    etat: etatJourneeDe(jour, triees, maintenant, avantRecolte),
    sansChiffres: jamaisRelues + triees.filter((s) => s.etat === "sans_chiffres").length,
    jamaisRelues,
    avantRecolte,
    porteeDuJour,
    sommes,
    mesurees,
    sortiesPour100: sortiesPour100De(triees),
  };
}

/** Le préfixe de l'`id` d'une journée dans `?post=` : un ID Graph n'est fait
 *  que de chiffres, aucune collision possible. */
export const PREFIXE_JOURNEE = "stories-";

export function idDeJournee(jour: string): string {
  return `${PREFIXE_JOURNEE}${jour}`;
}

/** La journée en `Post` de format `story`, pour la foule commune. La portée
 *  du post est la portée du jour (`reach_story`), jamais une somme ; j'aime,
 *  commentaires et enregistrements n'existent pas pour une story. */
export function journeeEnPost(j: JourneeStories): Post {
  const brutes: Brutes = {
    reach: j.porteeDuJour,
    views: j.sommes.vues,
    likes: null,
    comments: null,
    saved: null,
    shares: j.sommes.partages,
    follows: j.sommes.abonnes,
    profileVisits: j.sommes.visitesProfil,
    avgWatchTime: null,
  };
  const releves = j.stories.map((s) => s.releveA).filter((r): r is string => !!r && Number.isFinite(Date.parse(r)));
  return {
    id: idDeJournee(j.jour),
    // L'heure de la première story : le nuage pose la journée à sa place
    // dans la période, le Tableau la trie parmi les posts.
    date: j.stories[0].publieeA,
    jour: j.jour,
    format: "story",
    legende: "",
    image: j.stories.find((s) => s.image)?.image ?? null,
    permalink: null,
    brutes,
    releveA: releves.length ? releves.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a)) : null,
    boosteVuLe: null,
    abonnesAuJour: null,
    journee: j,
  };
}

export type LigneReachStory = { jour: string | null; reach_story?: unknown };

/** Jour → `reach_story` mesurée. Un null n'est pas une mesure. */
export function porteeParJourDe(lignes: LigneReachStory[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of lignes) {
    const n = mesure(l.reach_story);
    if (n !== null && l.jour) out[l.jour.slice(0, 10)] = n;
  }
  return out;
}

/** Les lignes de base → les journées, en `Post`, de la plus récente à la plus
 *  ancienne. `images` : chemin du bucket → URL signée. */
export function journeesDe(
  lignes: LigneStory[],
  porteeParJour: Record<string, number>,
  maintenant: string,
  images: Record<string, string> = {}
): Post[] {
  const parJour: Record<string, Story[]> = {};
  const vues = lignes.map((l) => Date.parse(l.vue_le ?? "")).filter(Number.isFinite);
  const debutRecolte = vues.length ? jourDe(new Date(Math.min(...vues)).toISOString()) : null;
  for (const l of lignes) {
    const s = storyDe(l, maintenant, images);
    if (s) (parJour[jourDe(s.publieeA)] ??= []).push(s);
  }
  return Object.entries(parJour)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([jour, stories]) => journeeEnPost(journeeDe(jour, stories, porteeParJour[jour] ?? null, maintenant, debutRecolte)));
}

/** Les vignettes à signer : la première de chaque journée (le Tableau, la
 *  liste et le nuage en montrent une), et toutes celles de la journée ouverte
 *  au Panneau. Signer tout l'historique à chaque affichage coûterait une URL
 *  par story jamais regardée. */
export function cheminsASigner(lignes: LigneStory[], idOuvert: string | null): string[] {
  const premiere: Record<string, { a: string; id: string; chemin: string }> = {};
  const ouverte: string[] = [];
  const jourOuvert = idOuvert?.startsWith(PREFIXE_JOURNEE) ? idOuvert.slice(PREFIXE_JOURNEE.length) : null;
  for (const l of lignes) {
    const t = Date.parse(l.publiee_a ?? "");
    if (!l.image_path || !Number.isFinite(t)) continue;
    const a = new Date(t).toISOString();
    const jour = a.slice(0, 10);
    const id = String(l.story_id ?? "");
    const p = premiere[jour];
    if (!p || a < p.a || (a === p.a && id < p.id)) premiere[jour] = { a, id, chemin: l.image_path };
    if (jour === jourOuvert) ouverte.push(l.image_path);
  }
  return [...new Set([...Object.values(premiere).map((p) => p.chemin), ...ouverte])];
}

// ── Ce qui s'écrit ───────────────────────────────────────────────────────────

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** « Stories du 24 nov. · 5 stories » (spec, les 5 meilleurs). */
export function libelleJournee(j: JourneeStories): string {
  const [, m, d] = j.jour.split("-");
  return `Stories du ${Number(d)} ${MOIS[Number(m) - 1]} · ${nombreDeStories(j.stories.length)}`;
}

export function nombreDeStories(n: number): string {
  return `${n} stor${n > 1 ? "ies" : "y"}`;
}

/** « 1 story sans chiffres », « 2 stories sans chiffres » ; `null` sans. */
export function texteSansChiffres(j: JourneeStories): string | null {
  return j.sansChiffres ? `${nombreDeStories(j.sansChiffres)} sans chiffres` : null;
}

/** Une story que le job n'a pas pu relire pendant sa vie (spec). */
export const RAISON_JAMAIS_RELUE = "Pulse n'a pas pu relire cette story avant sa disparition.";
export const RAISON_SANS_CHIFFRES = "Instagram n'a rendu aucun chiffre pour cette story : il n'en donne pas sous 5 spectateurs.";
export const RAISON_A_RELIRE = "Pas encore relue : Pulse lit les chiffres d'une story après 20 h de vie.";

export function raisonStory(s: Story): string | null {
  if (s.etat === "jamais_relue") return RAISON_JAMAIS_RELUE;
  if (s.etat === "sans_chiffres") return RAISON_SANS_CHIFFRES;
  if (s.etat === "a_relire") return RAISON_A_RELIRE;
  return null;
}

/** Tant que l'essai d'une story à lien ne l'a pas tranché (ticket 04,
 *  point 5), un 0 de clics peut venir d'une story sans lien. */
export const ZERO_CLIC = "Instagram rend aussi 0 pour une story sans lien.";

/** « relevé à 22 h de vie » ; `null` sans relevé daté. */
export function texteReleve(s: Story): string | null {
  return s.releveA && s.ageHeures !== null ? `relevé à ${Math.floor(s.ageHeures)} h de vie` : null;
}

export const TEXTE_EN_COURS = "en cours";
export const TEXTE_AVANT_RECOLTE = "Pulse ne récoltait pas encore les stories ce jour-là";

/** L'état d'une journée hors comparaison, en mots. */
export function texteEtatJournee(j: JourneeStories): string | null {
  if (j.etat === "en_cours") return "en cours — une story peut encore être relue, ou la journée n'est pas finie : hors comparaison";
  if (j.etat === "incomplete" && j.avantRecolte) return `incomplète — ${TEXTE_AVANT_RECOLTE} : hors comparaison`;
  if (j.etat === "incomplete") {
    return `incomplète — ${nombreDeStories(j.jamaisRelues)} jamais relue${j.jamaisRelues > 1 ? "s" : ""} : hors comparaison`;
  }
  return null;
}
