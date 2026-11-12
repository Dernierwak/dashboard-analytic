// ── LA COMPARAISON GOOGLE, VARIANTE A ───────────────────────────────────────
//
// Spec `.scratch/google-ads/spec.md`, § « Comparaison — la mécanique » ; user
// stories 34 à 47 ; décision : ticket 16 de la carte (variante A, validée par
// David le 2026-11-11). Harnais :
// `.scratch/google-ads/harnais/07-la-comparaison-variante-a/`.
//
// Écrit en partant de la Comparaison de Meta (`lib/meta/lecture.ts`), mais son
// propre code (ADR 0011) — et la Comparaison de Meta ne change pas (spec, §
// Out of Scope). Ce que la variante A ajoute :
//   · un réglage Type de campagne (Tous, ou un type présent sur la période) ;
//   · trois niveaux, Campagnes › Groupes › Annonces. « Groupes » réunit les
//     groupes d'annonces (`google_ads_ad_insights`) et les Groupes d'éléments
//     PMax (`google_ads_asset_group_insights`) ; PMax n'a pas d'annonces
//     (Google n'en rend aucune, carte issue 01), donc « Annonces » disparaît
//     quand il est seul ;
//   · un nuage de la période à la place du premier graphe, et une seule
//     courbe qui bascule entre les deux métriques.
// Ce qui est repris de Meta : quatre places au plus, la couleur qui suit la
// place, la 5ᵉ case refusée, le pré-cochage, l'échange des métriques.
//
// Sans directive, comme `lecture.ts` (`CLAUDE.md` §8) ; les imports relatifs
// sont résolus par Next, et par le crochet du harnais.
//
// Les règles que ce module tient, chacune testée :
//   · chaque élément est son ID Google, sous son nom le plus récent : deux
//     annonces homonymes restent deux lignes (user story 47) ; une ligne sans
//     ID n'est rattachée à rien par son nom ;
//   · « — » se range en bas, jamais classé comme un zéro (user story 46) ;
//   · un compteur que Google n'a pas rendu sur un Groupe d'éléments n'est
//     jamais compté pour zéro (`CLAUDE.md` §7) ;
//   · le jour en cours n'entre dans rien.
import {
  appliquer,
  campagnesDe,
  cleCampagne,
  decaler,
  lectureValeur,
  METRIQUES,
  periodeDe,
  totaux,
  TYPES_CAMPAGNE,
  valeurDe,
  verdictDe,
  vueDe,
  VUES,
  type Campagne,
  type CleMetrique,
  type Commandes,
  type Contexte,
  type LibelleType,
  type LigneGoogle,
  type Totaux,
  type TypeCampagne,
  type Vue,
} from "./lecture";
import { ligneComplete, type LigneAnnonceGoogle, type LigneGroupeElementsGoogle } from "./tableau";
import type { ConversionsParAction, Repartition, Verdict } from "./valeur";

// ── Les commandes ────────────────────────────────────────────────────────────

/** Ce que l'URL porte pour la Comparaison, en plus des commandes de la page. */
export type CommandesComparaison = Commandes & {
  /** Le type de campagne (`TYPE_URL`), absent = Tous. */
  type?: string;
  niveau?: string;
  m1?: string;
  m2?: string;
  /** Les places cochées, répétées (`placesVersUrl`). */
  comparer?: string[];
  /** La métrique que trace la courbe, l'une des deux choisies. */
  courbe?: string;
};

/** Les quatre sources de la page — celles du Tableau détaillé. */
export type SourcesComparaison = {
  campagnes: LigneGoogle[];
  annonces: LigneAnnonceGoogle[];
  /** `null` = la table n'a pas pu être lue (section 3quinquies pas jouée…). */
  groupesElements: LigneGroupeElementsGoogle[] | null;
  repartition?: Repartition;
};

/** Le type dans l'URL : un mot court, sans accent ni espace. */
export const TYPE_URL: Record<LibelleType, string> = {
  Search: "search",
  PMax: "pmax",
  Display: "display",
  Vidéo: "video",
  "Demand Gen": "demand-gen",
  "Autres types": "autres",
};

export type Niveau = "campagnes" | "groupes" | "annonces";
export const NIVEAUX: Niveau[] = ["campagnes", "groupes", "annonces"];
export const NOMS_NIVEAUX: Record<Niveau, string> = { campagnes: "Campagnes", groupes: "Groupes", annonces: "Annonces" };

export type NiveauElement = "campagne" | "groupe" | "groupe_elements" | "annonce";

// ── Les places cochées (recopiées de Meta) ───────────────────────────────────

export const MAX_COMPARES = 4;
/** Pré-cochés quand l'URL ne dit rien : de quoi voir des courbes en arrivant,
 *  en laissant une case libre (même règle que Meta). */
const COCHES_PAR_DEFAUT = 3;

/** Les quatre teintes de la Comparaison Meta, validées `dataviz` toutes paires
 *  (pire paire ΔE 16,3 ; CVD 9,2) : le nom est toujours écrit à côté. */
export const PALETTE_COMPARES = ["#2a78d6", "#eb6834", "#1baf7a", "#4a3aa7"];
/** Les lignes non cochées du nuage : un fond, pas une identité. */
export const GRIS_NON_COCHE = "#c3c2bb";

/** Une place libérée, dans l'URL. La couleur suit la PLACE : décocher la
 *  première ne repeint pas les autres. `comparer=-` seul = « rien de coché,
 *  exprès », à distinguer de l'absence du paramètre, qui pré-coche. */
export const PLACE_VIDE = "-";

export type Places = (string | null)[];

/** Les places lues dans l'URL, ou `null` quand le paramètre est absent. Une
 *  clé répétée ne prend qu'une place ; au-delà de quatre, le reste est ignoré. */
export function placesDe(brut: string[] | undefined): Places | null {
  if (!brut || brut.length === 0) return null;
  const vues = new Set<string>();
  return brut.slice(0, MAX_COMPARES).map((x) => {
    if (!x || x === PLACE_VIDE || vues.has(x)) return null;
    vues.add(x);
    return x;
  });
}

/** Cocher ou décocher. Une cinquième case est REFUSÉE (user story 43) : rien
 *  n'est décoché en silence pour lui faire de la place. */
export function basculerCoche(places: Places, cle: string): Places | "refus" {
  const i = places.indexOf(cle);
  if (i >= 0) return places.map((x, k) => (k === i ? null : x));
  const libre = places.indexOf(null);
  if (libre >= 0) return places.map((x, k) => (k === libre ? cle : x));
  if (places.length < MAX_COMPARES) return [...places, cle];
  return "refus";
}

/** Ce que le lien écrit : les places vides de fin tombent, et « rien de
 *  coché » s'écrit `-` pour ne pas retomber sur le pré-cochage. */
export function placesVersUrl(places: Places): string[] {
  const out = places.map((x) => x ?? PLACE_VIDE);
  while (out.length && out[out.length - 1] === PLACE_VIDE) out.pop();
  return out.length ? out : [PLACE_VIDE];
}

// ── Les métriques ────────────────────────────────────────────────────────────

/** Les deux métriques, toujours distinctes, prises dans la vue (spec : « deux
 *  métriques de la vue ») ; une clé hors de la vue est ignorée. Changer de vue
 *  y revient : ses liens retirent `m1`/`m2`. */
export function metriquesDe(vue: Vue, m1?: string, m2?: string): [CleMetrique, CleMetrique] {
  const de = VUES[vue].metriques;
  const est = (x?: string): x is CleMetrique => !!x && (de as string[]).includes(x);
  const a = est(m1) ? m1 : de[0];
  const b = est(m2) && m2 !== a ? m2 : de.find((m) => m !== a)!;
  return [a, b];
}

/** Choisir pour l'une la métrique de l'autre les ÉCHANGE : les deux axes du
 *  nuage montrent toujours deux choses différentes. */
export function choixMetrique(actuelles: [CleMetrique, CleMetrique], rang: 0 | 1, cle: CleMetrique): { m1: CleMetrique; m2: CleMetrique } {
  const [a, b] = actuelles;
  if (rang === 0) return cle === b ? { m1: b, m2: a } : { m1: cle, m2: b };
  return cle === a ? { m1: b, m2: a } : { m1: a, m2: cle };
}

// ── Le contenu ───────────────────────────────────────────────────────────────

export type ElementCompare = {
  cle: string;
  niveau: NiveauElement;
  /** Le nom le plus récent lu. */
  nom: string;
  /** Où il vit : la campagne (et le groupe, pour une annonce) ; `null` pour une campagne. */
  sous: string | null;
  /** Le type de sa campagne ; `null` = pas lu, aucun repère deviné. */
  type: TypeCampagne | null;
  /** L'ID Google de l'annonce — la cible « Lire » (ticket 08) ; `null` sinon. */
  annonceId: string | null;
  /** Les deux métriques sur la période ; `null` = « — », rangé en bas. */
  valeurs: [number | null, number | null];
  /** Pourquoi la valeur de même rang est « — ». */
  raisons: [string | null, string | null];
  /** Son coût sur la période : la taille de son point. `null` = non mesuré. */
  cout: number | null;
  /** 0 à 3 quand l'élément est coché — sa couleur ; `null` sinon. */
  place: number | null;
};

export type SerieCompare = {
  cle: string;
  nom: string;
  couleur: string;
  /** Une série par métrique, un point par jour ; `null` = un trou. */
  series: [(number | null)[], (number | null)[]];
};

export type Comparaison = {
  /** Les types présents sur la période, dans l'ordre de l'écran. */
  types: { libelle: LibelleType; cle: string }[];
  /** Le type choisi (`TYPE_URL`), `null` = Tous. */
  type: string | null;
  /** Une campagne choisie au Bandeau : son type s'impose, le réglage disparaît. */
  typeImpose: boolean;
  /** Les niveaux offerts : sans « Campagnes » sous une campagne choisie, sans
   *  « Annonces » quand PMax est seul. */
  niveaux: Niveau[];
  niveau: Niveau;
  /** Niveau Annonces sur « Tous », avec du PMax sur la période : une phrase
   *  dit pourquoi ses campagnes ne sont pas là (user story 38). */
  pmaxSansAnnonces: boolean;
  /** Les métriques offertes : celles de la vue. */
  offertes: CleMetrique[];
  metriques: [CleMetrique, CleMetrique];
  /** La métrique que trace la courbe. */
  courbe: CleMetrique;
  /** Classés par la métrique 1. */
  elements: ElementCompare[];
  /** Les places telles qu'elles s'affichent — c'est d'elles que part un clic. */
  places: Places;
  /** Les cochés, dans l'ordre de leur place. */
  coches: SerieCompare[];
};

const PMAX: LibelleType = "PMax";

/** Les raisons d'un « — », dites au survol. */
const RIEN_MESURE = "Rien de mesuré sur la période.";
const SANS_DIVISEUR = "Ce ratio n'a pas de diviseur sur la période : il ne se calcule pas.";
/** `google_ads_ad_insights` ne récolte pas la valeur de conversion. */
const VALEUR_PAR_CAMPAGNE = "La valeur de conversion n'est lue qu'au niveau campagne et groupe d'éléments : Pulse ne la récolte pas par groupe d'annonces ni par annonce.";
const INCOMPLET = "Google n'a pas rendu tous les chiffres de ce groupe d'éléments sur la période : Pulse ne compte pas un manque pour zéro.";

/** Un élément en cours de construction : ses lignes de la période. */
type Brouillon = {
  cle: string;
  niveau: NiveauElement;
  nom: string;
  dateNom: string;
  campagne: string;
  groupeNom: string;
  annonceId: string | null;
  lignes: LigneGoogle[];
  /** Les jours où un compteur manquait (Groupes d'éléments seulement). */
  incomplets: Set<string>;
};

function brouillon(m: Map<string, Brouillon>, base: Omit<Brouillon, "lignes" | "incomplets" | "dateNom">, date: string): Brouillon {
  let b = m.get(base.cle);
  if (!b) {
    b = { ...base, dateNom: date, lignes: [], incomplets: new Set() };
    m.set(base.cle, b);
  }
  // Le nom porté par la ligne la plus récente : un élément renommé reste une
  // seule ligne, sous son nom d'aujourd'hui.
  if (date > b.dateNom) {
    b.nom = base.nom;
    b.groupeNom = base.groupeNom;
    b.dateNom = date;
  }
  return b;
}

/** Classe par la métrique 1 : décroissant, croissant pour un coût (un CPC bas
 *  est le meilleur) ; « — » toujours en bas. */
function classer(a: ElementCompare, b: ElementCompare, m: CleMetrique): number {
  const [x, y] = [a.valeurs[0], b.valeurs[0]];
  if (x === null || y === null) {
    if (x !== y) return x === null ? 1 : -1;
  } else if (x !== y) {
    return METRIQUES[m].hausseBonne === false ? x - y : y - x;
  }
  return a.nom.localeCompare(b.nom, "fr") || (a.cle < b.cle ? -1 : 1);
}

export function comparaisonDe(s: SourcesComparaison, c: CommandesComparaison, ctx: Contexte): Comparaison {
  const vue = vueDe(c.vue);
  const p = periodeDe(c, ctx);
  // Le même tri que `contenuPage` : la période seule, jamais le jour en cours.
  const dans = (l: { date: string }) => l.date >= p.debut && l.date <= p.fin && l.date < ctx.aujourdhui;
  // La campagne choisie au Bandeau resserre toute la page (user story 9).
  const choisie = (campagneId: string | null) => !c.campagne || campagneId === c.campagne;

  const courant = s.campagnes.filter((l) => dans(l) && (!c.campagne || cleCampagne(l) === c.campagne));
  const infos = new Map<string, Campagne>(campagnesDe(courant, p).map((x) => [x.cle, x]));
  const libelleDe = (cle: string) => infos.get(cle)?.type?.libelle ?? null;

  // ── Le type ──
  const presents = TYPES_CAMPAGNE.filter((t) => [...infos.values()].some((x) => x.type?.libelle === t));
  const types = presents.map((libelle) => ({ libelle, cle: TYPE_URL[libelle] }));
  const typeImpose = !!c.campagne;
  const libelleImpose = c.campagne ? libelleDe(c.campagne) : null;
  const demande = typeImpose
    ? libelleImpose && TYPE_URL[libelleImpose]
    : types.find((t) => t.cle === c.type)?.cle ?? null;
  const libelleChoisi = demande ? types.find((t) => t.cle === demande)?.libelle ?? null : null;
  const duType = (campagne: string) => libelleChoisi === null || libelleDe(campagne) === libelleChoisi;

  // ── Le niveau ──
  const enJeu = libelleChoisi ? [libelleChoisi] : presents;
  const pmaxSeul = enJeu.length > 0 && enJeu.every((t) => t === PMAX);
  const niveaux = NIVEAUX.filter((n) => !(n === "campagnes" && c.campagne) && !(n === "annonces" && pmaxSeul));
  // Un niveau retiré retombe sur le plus proche : des annonces demandées
  // sous PMax seul donnent ses groupes, pas ses campagnes.
  const niveau = niveaux.find((n) => n === c.niveau) ?? (c.niveau === "annonces" ? niveaux[niveaux.length - 1] : niveaux[0]);
  const pmaxSansAnnonces = niveau === "annonces" && libelleChoisi === null && presents.includes(PMAX);

  // ── Les éléments du niveau ──
  const brouillons = new Map<string, Brouillon>();
  if (niveau === "campagnes") {
    for (const l of courant) {
      const cle = cleCampagne(l);
      if (!duType(cle)) continue;
      brouillon(brouillons, { cle, niveau: "campagne", nom: l.campagneNom, campagne: cle, groupeNom: "", annonceId: null }, l.date).lignes.push(l);
    }
  } else {
    for (const l of s.annonces) {
      // Sans les ID, une ligne ne se rattache à rien : le nom n'est jamais une
      // identité (spec, § « L'identité par ID »).
      if (!dans(l) || !l.campagneId || !l.groupeId || !choisie(l.campagneId) || !infos.has(l.campagneId)) continue;
      // PMax n'a pas d'annonces : une ligne d'annonce qui le dirait ne compte pas
      // (même règle que le Tableau).
      if (libelleDe(l.campagneId) === PMAX || !duType(l.campagneId)) continue;
      if (niveau === "groupes") {
        const base = { cle: `g:${l.groupeId}`, niveau: "groupe" as const, nom: l.groupeNom, campagne: l.campagneId, groupeNom: l.groupeNom, annonceId: null };
        brouillon(brouillons, base, l.date).lignes.push(l);
      } else if (l.annonceId) {
        const base = { cle: `a:${l.annonceId}`, niveau: "annonce" as const, nom: l.annonceNom, campagne: l.campagneId, groupeNom: l.groupeNom, annonceId: l.annonceId };
        brouillon(brouillons, base, l.date).lignes.push(l);
      }
    }
    if (niveau === "groupes") {
      for (const l of s.groupesElements ?? []) {
        if (!dans(l) || !l.campagneId || !l.groupeId || !choisie(l.campagneId) || !infos.has(l.campagneId) || !duType(l.campagneId)) continue;
        const base = { cle: `ge:${l.groupeId}`, niveau: "groupe_elements" as const, nom: l.groupeNom, campagne: l.campagneId, groupeNom: l.groupeNom, annonceId: null };
        const b = brouillon(brouillons, base, l.date);
        const complete = ligneComplete(l);
        if (complete) b.lignes.push(complete);
        else b.incomplets.add(l.date);
      }
    }
  }

  const metriques = metriquesDe(vue, c.m1, c.m2);
  const courbe = metriques.find((m) => m === c.courbe) ?? metriques[0];

  // La règle « sans valeur » (`./valeur`) d'une campagne, sur la période. Un
  // Groupe d'éléments prend celle de SA campagne : la répartition par action
  // n'est lue que par campagne (même choix que le Tableau).
  const verdicts = new Map<string, Verdict>();
  const verdictDeCampagne = (cle: string): Verdict => {
    let v = verdicts.get(cle);
    if (!v) {
      const garder = (r: ConversionsParAction) => dans(r) && r.campagneId === cle;
      v = verdictDe(courant.filter((l) => cleCampagne(l) === cle), s.repartition, garder);
      verdicts.set(cle, v);
    }
    return v;
  };
  const AFFICHEE: Verdict = { affichee: true, avertissement: null };

  // Un compteur manquant un seul jour : la somme de la période le compterait
  // pour zéro, donc pas de somme du tout.
  const totauxDe = (b: Brouillon, verdict: Verdict): Totaux | null => (b.incomplets.size > 0 ? null : appliquer(totaux(b.lignes), verdict));

  const valeurEtRaison = (b: Brouillon, t: Totaux | null, verdict: Verdict, m: CleMetrique): [number | null, string | null] => {
    const v = valeurDe(m, t);
    if (v !== null) return [v, null];
    if (b.incomplets.size > 0) return [null, INCOMPLET];
    if (t === null) return [null, RIEN_MESURE];
    if ((m === "valeur_conversion" || m === "roas") && (b.niveau === "groupe" || b.niveau === "annonce")) return [null, VALEUR_PAR_CAMPAGNE];
    return [null, lectureValeur(m, t, verdict).raison ?? SANS_DIVISEUR];
  };

  const verdictDeBrouillon = (b: Brouillon) => (b.niveau === "campagne" || b.niveau === "groupe_elements" ? verdictDeCampagne(b.campagne) : AFFICHEE);

  const elements: ElementCompare[] = [...brouillons.values()].map((b) => {
    const verdict = verdictDeBrouillon(b);
    const t = totauxDe(b, verdict);
    const [v1, r1] = valeurEtRaison(b, t, verdict, metriques[0]);
    const [v2, r2] = valeurEtRaison(b, t, verdict, metriques[1]);
    const nomCampagne = infos.get(b.campagne)?.nom ?? "";
    return {
      cle: b.cle,
      niveau: b.niveau,
      nom: b.nom,
      sous: b.niveau === "campagne" ? null : b.niveau === "annonce" ? `${nomCampagne} › ${b.groupeNom}` : nomCampagne,
      type: infos.get(b.campagne)?.type ?? null,
      annonceId: b.annonceId,
      valeurs: [v1, v2],
      raisons: [r1, r2],
      cout: t?.cout ?? null,
      place: null,
    };
  });
  elements.sort((a, b) => classer(a, b, metriques[0]));

  // Une clé qui n'est plus dans la liste (un autre filtre, une autre période)
  // LIBÈRE sa place sans décaler les autres : les couleurs ne bougent pas.
  const presentes = new Set(elements.map((e) => e.cle));
  const lues = placesDe(c.comparer);
  const places: Places = lues
    ? lues.map((x) => (x !== null && presentes.has(x) ? x : null))
    : elements.slice(0, COCHES_PAR_DEFAUT).map((e) => e.cle);
  for (const e of elements) {
    const i = places.indexOf(e.cle);
    e.place = i >= 0 ? i : null;
  }

  const dates = Array.from({ length: p.jours }, (_, i) => decaler(p.debut, i));
  const serie = (b: Brouillon, m: CleMetrique): (number | null)[] => {
    const verdict = verdictDeBrouillon(b);
    return dates.map((d) => {
      // Un jour sans ligne est un trou ; un jour à compteur manquant aussi.
      if (b.incomplets.has(d)) return null;
      const jour = b.lignes.filter((l) => l.date === d);
      return valeurDe(m, appliquer(totaux(jour), verdict));
    });
  };
  const coches: SerieCompare[] = [];
  places.forEach((cle, i) => {
    if (cle === null) return;
    const b = brouillons.get(cle)!;
    coches.push({ cle, nom: b.nom, couleur: PALETTE_COMPARES[i], series: [serie(b, metriques[0]), serie(b, metriques[1])] });
  });

  return {
    types,
    type: demande,
    typeImpose,
    niveaux,
    niveau,
    pmaxSansAnnonces,
    offertes: VUES[vue].metriques,
    metriques,
    courbe,
    elements,
    places,
    coches,
  };
}
