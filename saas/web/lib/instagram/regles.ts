// ── LES RÈGLES DE LECTURE : « SANS LES BOOSTÉS », « SANS LES HORS NORME » ────
//
// Spec `.scratch/instagram/spec.md`, § La lecture, lignes « sans les hors
// norme » et « sans les boostés », « La mention sous 6 posts » ; § L'état de
// la page vit dans l'URL ; user stories 23 à 25 et 28. Harnais :
// `.scratch/instagram-construction/harnais/12-les-regles-de-lecture/`.
//
// Les écartés se décident ICI, une seule fois par lecture, puis se retirent
// des posts (`retenus`) AVANT `fouleDe` : le module, la liste des 5, le
// Tableau et le Panneau lisent la même foule filtrée (user story 33). La
// Tendance n'en reçoit rien : les Règles ne la gouvernent pas (spec § Tendance).
//
// Les règles que ce module tient, chacune testée :
//   · deux filtres dans l'URL, jamais mémorisés, désactivés par défaut ;
//   · Tukey en UNE passe sur la référence de la métrique affichée — refaire
//     les bornes après le retrait en écarterait d'autres, sans fin ;
//   · les boostés partent d'abord : les bornes se calculent sur la foule que
//     le client a demandé de lire ;
//   · n'est « écarté » qu'un post qui serait entré dans une foule — un boosté
//     d'il y a deux ans n'a jamais compté, le dire écarté gonflerait le compte ;
//   · minimum 6 jugé après le retrait, la raison gardée dans la mention.
//
// Sans directive (`CLAUDE.md` §8) ; imports relatifs sans extension pour
// Next, résolus par le crochet du harnais.
import {
  eligiblesDe,
  estHorsNorme,
  fouleDe,
  FORMATS,
  MINIMUM_FOULE,
  NOM_FORMAT,
  NOM_FORMAT_PLURIEL,
  placeDuPost,
  valeurDe,
  type CleMetrique,
  type Contexte,
  type Foule,
  type Format,
  type PlaceDuPost,
  type Post,
  type RaisonEcart,
} from "./lecture";

// ── Les deux filtres, dans l'URL ─────────────────────────────────────────────

export type Regles = { sansBoostes: boolean; sansHorsNorme: boolean };

/** Les noms des paramètres d'URL. « Revenir aux règles standard » les retire
 *  tous les deux, et rien d'autre. */
export const PARAM_REGLE = { sansBoostes: "sansBoostes", sansHorsNorme: "sansHorsNorme" } as const;
export const ALLUME = "1";

export const STANDARD: Regles = { sansBoostes: false, sansHorsNorme: false };

type Params = Record<string, string | string[] | undefined>;

function allume(v: string | string[] | undefined): boolean {
  return (Array.isArray(v) ? v[0] : v) === ALLUME;
}

/** Lu dans l'URL seulement : rien n'est mémorisé ni écrit en base — un invité
 *  ne subit jamais un filtre qu'il n'a pas choisi (user story 5). */
export function reglesDe(params: Params): Regles {
  return { sansBoostes: allume(params[PARAM_REGLE.sansBoostes]), sansHorsNorme: allume(params[PARAM_REGLE.sansHorsNorme]) };
}

/** Le « · n » du bouton du Bandeau. */
export function nombreDeRegles(r: Regles): number {
  return Number(r.sansBoostes) + Number(r.sansHorsNorme);
}

/** Le patch de `lienInstagram` qui revient aux règles standard. */
export const SANS_REGLES: Record<string, null> = { [PARAM_REGLE.sansBoostes]: null, [PARAM_REGLE.sansHorsNorme]: null };

// ── Les écartés ──────────────────────────────────────────────────────────────

export type Ecartes = {
  /** ID du post → pourquoi il est écarté. */
  raisons: Record<string, RaisonEcart>;
  /** Par format, les écartés qui auraient fait la référence de la métrique
   *  (une valeur, 12 mois, 48 h) — la raison de la mention sous 6. */
  parFormat: Record<Format, number>;
  total: number;
};

const ZERO_PAR_FORMAT = Object.fromEntries(FORMATS.map((f) => [f, 0])) as Record<Format, number>;
export const AUCUN_ECART: Ecartes = { raisons: {}, parFormat: ZERO_PAR_FORMAT, total: 0 };

export function ecartesDe(posts: Post[], m: CleMetrique, regles: Regles, ctx: Contexte): Ecartes {
  if (!regles.sansBoostes && !regles.sansHorsNorme) return AUCUN_ECART;
  const raisons: Record<string, RaisonEcart> = {};

  if (regles.sansBoostes) {
    // Toutes métriques : le boost ne dépend pas de la métrique lue (spec).
    for (const f of FORMATS) for (const p of eligiblesDe(posts, f, ctx)) if (p.boosteVuLe) raisons[p.id] = { cause: "booste" };
  }
  if (regles.sansHorsNorme) {
    const restants = posts.filter((p) => !raisons[p.id]);
    for (const f of FORMATS) {
      const { limites, posts: membres } = fouleDe(restants, f, m, ctx);
      // Sous 6, pas de quartiles donc pas de bornes : personne n'est hors norme.
      if (!limites) continue;
      for (const p of membres) if (estHorsNorme(valeurDe(p, m) as number, limites)) raisons[p.id] = { cause: "hors_norme", metrique: m };
    }
  }

  const parFormat = Object.fromEntries(
    FORMATS.map((f) => [f, eligiblesDe(posts, f, ctx).filter((p) => raisons[p.id] && valeurDe(p, m) !== null).length])
  ) as Record<Format, number>;
  return { raisons, parFormat, total: Object.keys(raisons).length };
}

/** Les posts que la lecture garde : c'est EUX qu'on passe à `fouleDe`,
 *  `moduleAnneeDe`, `meilleursDe` pour leurs foules. */
export function retenus(posts: Post[], e: Ecartes): Post[] {
  return e.total === 0 ? posts : posts.filter((p) => !e.raisons[p.id]);
}

/** La place d'un post sous les Règles : un écarté dit pourquoi ; une foule
 *  mince dit combien le filtre lui en a pris. `foules` : celles des `retenus`. */
export function placeLue(p: Post, m: CleMetrique, foules: Record<Format, Foule>, ctx: Contexte, e: Ecartes): PlaceDuPost {
  const raison = e.raisons[p.id];
  if (raison) return { etat: "ecarte", raison };
  const place = placeDuPost(p, m, foules, ctx);
  if (place.etat === "foule_mince" && e.parFormat[place.format] > 0) return { ...place, ecartes: e.parFormat[place.format] };
  return place;
}

// ── Ce qui s'écrit ───────────────────────────────────────────────────────────

/** « hors norme sur les j'aime » : la métrique avec son article. */
export const SUR_LA_METRIQUE: Record<CleMetrique, string> = {
  portee: "la portée",
  vues: "les vues",
  portee_abonnes: "la portée ÷ abonnés",
  taux: "le taux d'engagement",
  jaime: "les j'aime",
  commentaires: "les commentaires",
  partages: "les partages",
  enregistrements: "les enregistrements",
  reactions_fortes: "les réactions fortes",
  abonnes_1000: "les abonnés pour 1 000",
  abonnes: "les abonnés gagnés",
  visites_profil: "les visites de profil",
};

export function texteEcart(r: RaisonEcart): string {
  return r.cause === "booste" ? "écarté : boosté" : `écarté : hors norme sur ${SUR_LA_METRIQUE[r.metrique]}`;
}

/** La seconde ligne du module quand une Règle tourne — « Lu sans les boostés
 *  — 4 posts écartés. » — pour qu'un chiffre filtré ne se lise jamais comme
 *  le chiffre par défaut (user story 24). `null` aux règles standard. */
export function ligneRegles(r: Regles, total: number, m: CleMetrique): string | null {
  const sans = [r.sansBoostes && "les boostés", r.sansHorsNorme && `les hors norme sur ${SUR_LA_METRIQUE[m]}`].filter(Boolean);
  if (sans.length === 0) return null;
  const combien = total === 0 ? "aucun post écarté" : `${total} post${total > 1 ? "s" : ""} écarté${total > 1 ? "s" : ""}`;
  return `Lu sans ${sans.join(" ni ")} — ${combien}.`;
}

/** « 5 Reels, il en faut 6 — 1 est écarté par ton filtre » (spec, « La
 *  mention sous 6 posts »). */
export function mentionSousSix(n: number, f: Format, ecartes: number): string {
  const base = `${n} ${n > 1 ? NOM_FORMAT_PLURIEL[f] : NOM_FORMAT[f]}, il en faut ${MINIMUM_FOULE}`;
  if (ecartes === 0) return base;
  return `${base} — ${ecartes} ${ecartes > 1 ? "sont écartés" : "est écarté"} par ton filtre`;
}
