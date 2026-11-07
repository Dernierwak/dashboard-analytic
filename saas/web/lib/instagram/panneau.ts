// ── LE PANNEAU « LIRE UN POST » : CE QU'IL MONTRE ────────────────────────────
//
// Spec `.scratch/instagram/spec.md`, § « Panneau latéral — lire un post » ;
// user story 29. Harnais :
// `.scratch/instagram-construction/harnais/11-les-5-meilleurs-et-le-panneau/`.
//
// Le post se lit avec la MÊME foule que le module et le Tableau (`foulesDe`,
// `placeDuPost`) : sa place sur une métrique est celle que la colonne Place
// écrirait si l'on choisissait cette métrique.
//
// Sans directive (`CLAUDE.md` §8) ; imports relatifs sans extension pour
// Next, résolus par le crochet du harnais.
import {
  ageDe,
  foulesDe,
  maturiteDe,
  METRIQUES,
  placeDuPost,
  valeurDe,
  type CleMetrique,
  type Contexte,
  type PlaceDuPost,
  type Post,
} from "./lecture";
import { jourLong, moustacheDe, type Moustache } from "./annee";
import { visionnageDe } from "./tableau";
import { decaler } from "../meta/lecture";

// ── Le lecteur public ────────────────────────────────────────────────────────

/** Le seul hôte servi dans l'iframe : le permalink vient de la base, et une
 *  iframe ouverte sur n'importe quelle URL afficherait n'importe quoi dans Pulse. */
const HOTE_INSTAGRAM = "www.instagram.com";

/** Le lecteur public d'Instagram (`<permalink>/embed`) pour un Reel ou une
 *  vidéo : Pulse ne garde que l'image, et le lien vidéo de Meta expire (spec).
 *  `null` sans permalink, pour une image ou un carrousel, ou hors d'Instagram. */
export function lecteurDe(p: Post): string | null {
  if (!p.permalink || (p.format !== "reel" && p.format !== "video_fil")) return null;
  let url: URL;
  try {
    url = new URL(p.permalink);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== HOTE_INSTAGRAM) return null;
  // Les paramètres de partage (`?igsh=…`) ne servent pas au lecteur.
  return `https://${HOTE_INSTAGRAM}${url.pathname.replace(/\/+$/, "")}/embed`;
}

// ── Le post lu ───────────────────────────────────────────────────────────────

export type PlaceSurMetrique = { metrique: CleMetrique; valeur: number | null; place: PlaceDuPost };

/** `null` : le post a plus de 7 jours, ses chiffres sont faits. */
export type AgeLu = { texte: string; peutChanger: true } | null;

export type LecturePost = {
  post: Post;
  /** Sur la métrique choisie. */
  valeur: number | null;
  place: PlaceDuPost;
  /** La moustache des 12 mois du format ; `null` pour un format inconnu. */
  moustache: Moustache | null;
  /** Sa place sur chaque métrique, dans l'ordre des Objectifs. */
  places: PlaceSurMetrique[];
  /** Secondes, Reel seul. */
  visionnage: number | null;
  age: AgeLu;
};

/** Sous 7 jours, l'âge se dit avec « peut encore changer » (user story 20) ;
 *  « J+n » = au moins n × 24 h (vocabulaire de la spec). */
function ageLu(p: Post): AgeLu {
  const maturite = maturiteDe(p);
  if (maturite === "mur") return null;
  if (maturite === "jeune") return { texte: "moins de 48 h", peutChanger: true };
  return { texte: `J+${Math.floor((ageDe(p) as number) / 24)}`, peutChanger: true };
}

export function lecturePostDe(p: Post, posts: Post[], m: CleMetrique, ctx: Contexte): LecturePost {
  const places = (Object.keys(METRIQUES) as CleMetrique[]).map((c) => ({
    metrique: c,
    valeur: valeurDe(p, c),
    place: placeDuPost(p, c, foulesDe(posts, c, ctx), ctx),
  }));
  const choisie = places.find((x) => x.metrique === m) as PlaceSurMetrique;
  const foule = p.format ? foulesDe(posts, m, ctx)[p.format] : null;
  return {
    post: p,
    valeur: choisie.valeur,
    place: choisie.place,
    moustache: p.format && foule ? moustacheDe(posts, p.format, m, ctx, 12, foule.n) : null,
    places,
    visionnage: visionnageDe(p),
    age: ageLu(p),
  };
}

// ── L'écart avec l'hebdo ─────────────────────────────────────────────────────
//
// Le rapport hebdo ne porte AUCUN chiffre de post (`lib/hebdo/posts.ts`) : il
// liste les posts de l'année, sans `post_id`, avec leur permalink. « Un
// rapport a lu ce post » se juge donc à sa PRÉSENCE dans un payload, retrouvé
// par son permalink (arbitrage rendu au lancement du ticket 11).

/** Le jour où le worker a écrit ce rapport : le Jour de travail, lendemain du
 *  dernier jour de la semaine mesurée (`lib/hebdo/semaine.ts`). */
export function jourDuRapport(finDeSemaine: string): string {
  return decaler(finDeSemaine, 1);
}

/** La phrase de la spec, sous les chiffres du Panneau. `null` sans relevé
 *  daté (« Chiffres au … » serait inventé), sans rapport, ou quand le rapport
 *  n'est pas antérieur au dernier relevé — il n'y a alors pas d'écart à dire. */
export function phraseEcartHebdo(releveA: string | null, jourRapport: string | null): string | null {
  if (!releveA || !jourRapport) return null;
  const jourReleve = releveA.slice(0, 10);
  if (jourRapport >= jourReleve) return null;
  return (
    `Chiffres au ${jourLong(jourReleve, true)}. Le rapport du ${jourLong(jourRapport, true)} les avait lus ce jour-là : ` +
    "un post continue de gagner des vues après sa publication."
  );
}
