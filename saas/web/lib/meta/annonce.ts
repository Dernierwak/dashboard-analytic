// ── LIRE UNE ANNONCE DANS LE PANNEAU LATÉRAL ─────────────────────────────────
//
// Spec, § « Les créas » et § « Comparaison — la mécanique » ; user stories 34,
// 37 à 45. Décision d'origine : ticket 06 de la carte (on lit une annonce dans
// le Panneau latéral, et on n'y entre que par la Comparaison). Harnais :
// `.scratch/meta-ads/harnais/12-lire-une-annonce/`.
//
// Le contenu vient des deux tables que la récolte des créas (ticket 05) écrit :
// `meta_ads_creatives` (une ligne par annonce) et `meta_ads_creative_assets`
// (les variantes d'une créa dynamique, les cartes d'un carrousel). JAMAIS des
// insights : les ventilations d'asset ne rendent que l'ID de l'asset, pas son
// contenu (ticket 03 de la carte). Il n'y a donc aucun chiffre ici, et rien ne
// doit en ajouter un.
//
// RIEN NE SE FABRIQUE. Un champ vide reste absent ; une créa sans adresse n'a
// pas de lien ; un visuel qui n'est pas dans Storage ne s'affiche pas — l'URL
// de Meta, elle, expire (« a temporary URL »,
// https://developers.facebook.com/docs/marketing-api/reference/ad-image/).
//
// Pas de directive, comme `lecture.ts` (`CLAUDE.md` §8) ; l'import de
// `./lecture` est un type seulement.

import type { LigneMeta } from "./lecture";

/** Une ligne de `meta_ads_creatives`, telle que PostgREST la rend. */
export type LigneCrea = {
  montage: string | null;
  titre: string | null;
  texte: string | null;
  description: string | null;
  lien_url: string | null;
  call_to_action: string | null;
  image_url: string | null;
  video_id: string | null;
  vignette_url: string | null;
};

/** Une ligne de `meta_ads_creative_assets`. */
export type LigneAsset = {
  provenance: string;
  asset_kind: string;
  rang: number;
  texte: string | null;
  image_url: string | null;
  video_id: string | null;
  vignette_url: string | null;
  lien_url: string | null;
};

export type Visuel = {
  /** L'adresse dans Supabase Storage ; `null` = Meta en a un, Pulse ne l'a
   *  pas (encore) copié. On le dit plutôt que de pointer vers Meta. */
  url: string | null;
  video: boolean;
};

export type Carte = {
  titre: string | null;
  description: string | null;
  visuel: Visuel | null;
  lien: string | null;
};

export type ContenuAnnonce = {
  /** L'annonce telle qu'elle s'affiche dans le fil : la première variante de
   *  chaque champ, comme Meta la montre à la création. */
  apercu: { texte: string | null; titre: string | null; description: string | null; bouton: string | null; visuel: Visuel | null };
  /** Chaque champ en entier ; plus d'une valeur = des variantes numérotées. */
  textes: string[];
  titres: string[];
  descriptions: string[];
  boutons: string[];
  visuels: Visuel[];
  /** Les cartes d'un carrousel, dans l'ordre rendu par Meta. */
  cartes: Carte[];
  /** « L'annonce envoie vers… » : les adresses lues dans la créa, sans
   *  doublon. Vide = la créa n'en donne aucune, et aucun lien ne s'affiche. */
  liens: string[];
  /** Au moins un champ a plusieurs valeurs : Meta les assemble à la
   *  diffusion, et le panneau dit pourquoi aucune n'est classée. */
  aDesVariantes: boolean;
};

const propre = (x: string | null | undefined): string | null => x?.trim() || null;

/**
 * Une adresse qu'on peut mettre derrière un lien, ou `null`. Seuls `http` et
 * `https` passent : l'adresse vient de ce que l'annonceur a saisi chez Meta, et
 * un `javascript:` s'exécuterait au clic.
 */
export function adresseSure(x: string | null | undefined): string | null {
  const s = propre(x);
  if (!s) return null;
  try {
    // L'adresse telle qu'elle est saisie, pas `u.href` : c'est elle que
    // l'annonceur reconnaît (« maison.ch », pas « maison.ch/ »).
    const { protocol } = new URL(s);
    return protocol === "http:" || protocol === "https:" ? s : null;
  } catch {
    return null;
  }
}

/**
 * L'URL d'un visuel, seulement si elle est dans le Storage PUBLIC de Pulse.
 * `origine` est l'adresse du projet Supabase (`NEXT_PUBLIC_SUPABASE_URL`).
 *
 * Seul le chemin public passe : une URL signée stockée en base expire comme
 * celle de Meta, et l'image disparaîtrait dans six mois (user story 43). Si
 * David choisit un bucket privé (décision ouverte au ticket 05), la lecture
 * devra SIGNER le chemin au moment de lire (`lireAnnonce`), et cette fonction
 * changer avec elle.
 */
export function depuisStorage(url: string | null | undefined, origine: string): string | null {
  const s = adresseSure(url);
  if (!s || !origine) return null;
  return s.startsWith(`${origine.replace(/\/+$/, "")}/storage/v1/object/public/`) ? s : null;
}

/** Les boutons de Meta sont des constantes (`SHOP_NOW`) ; le fil les écrit
 *  dans la langue du lecteur. Libellés d'Ads Manager en français, NON
 *  VÉRIFIÉS sur un appel réel : le premier passage de la récolte (ticket 05)
 *  dit quelles constantes arrivent vraiment. */
const BOUTONS: Record<string, string> = {
  LEARN_MORE: "En savoir plus",
  SHOP_NOW: "Acheter",
  SIGN_UP: "S'inscrire",
  SUBSCRIBE: "S'abonner",
  CONTACT_US: "Nous contacter",
  DOWNLOAD: "Télécharger",
  BOOK_TRAVEL: "Réserver",
  ORDER_NOW: "Commander",
  GET_OFFER: "Profiter de l'offre",
  GET_QUOTE: "Demander un devis",
  APPLY_NOW: "Postuler",
  SEND_MESSAGE: "Envoyer un message",
  WATCH_MORE: "Regarder plus",
};

export function nomBouton(x: string | null | undefined): string | null {
  const s = propre(x);
  // `NO_BUTTON` : l'annonceur a choisi de n'en mettre aucun.
  if (!s || s === "NO_BUTTON") return null;
  // L'anglais ne s'affiche jamais (`CONTEXT.md`, « Annonce ») : un bouton
  // qu'on ne sait pas nommer se dit comme tel, plutôt que traduit au hasard
  // ou tu.
  return BOUTONS[s] ?? BOUTON_SANS_NOM;
}

export const BOUTON_SANS_NOM = "Bouton que Pulse ne sait pas encore nommer";

function visuelDe(r: { image_url: string | null; vignette_url: string | null; video_id: string | null }, origine: string): Visuel | null {
  const video = !!propre(r.video_id);
  // Une vidéo se montre par sa vignette ; une image par elle-même.
  const brut = video ? r.vignette_url ?? r.image_url : r.image_url ?? r.vignette_url;
  if (!propre(brut) && !video) return null;
  return { url: depuisStorage(brut, origine), video };
}

const sansDoublon = <T,>(xs: (T | null)[]): T[] => [...new Set(xs.filter((x): x is T => x !== null))];

/**
 * Une créa et ses assets → ce que le panneau montre. `origine` : voir
 * `depuisStorage`.
 *
 * Le montage dit où chercher (spec, § « Les créas ») : `flat` et
 * `object_story` tiennent sur la ligne de la créa ; `asset_feed` range ses
 * variantes dans les assets (provenance `asset_feed`) ; un carrousel range ses
 * cartes dans les assets (provenance `child_attachment`), une carte par rang.
 * Les deux provenances ne se mélangent jamais : une variante A/B n'est pas une
 * carte.
 */
export function annonceDe(crea: LigneCrea, assets: LigneAsset[], origine: string): ContenuAnnonce {
  const ordonnes = [...assets].sort((a, b) => a.rang - b.rang);
  const feed = ordonnes.filter((a) => a.provenance === "asset_feed");
  const enfants = ordonnes.filter((a) => a.provenance === "child_attachment");
  const textesDe = (kind: string) => sansDoublon(feed.filter((a) => a.asset_kind === kind).map((a) => propre(a.texte)));

  // La valeur de la créa d'abord : c'est elle que le fil montre. Les variantes
  // suivent, sans répéter celle qui serait déjà là.
  const avec = (premier: string | null, autres: string[]) => sansDoublon([premier, ...autres]);
  const textes = avec(propre(crea.texte), textesDe("body"));
  const titres = avec(propre(crea.titre), textesDe("title"));
  const descriptions = avec(propre(crea.description), textesDe("description"));
  const boutons = avec(nomBouton(crea.call_to_action), sansDoublon(feed.filter((a) => a.asset_kind === "call_to_action").map((a) => nomBouton(a.texte))));

  const visuelCrea = visuelDe(crea, origine);
  const visuelsFeed = feed.filter((a) => a.asset_kind === "image" || a.asset_kind === "video").map((a) => visuelDe(a, origine));
  const visuels = [visuelCrea, ...visuelsFeed].filter((v): v is Visuel => v !== null);

  // Une carte = un rang. La récolte peut l'écrire en une ligne
  // (`carousel_card`) ou en une ligne par champ : on rassemble par rang.
  const parRang = new Map<number, LigneAsset[]>();
  for (const a of enfants) parRang.set(a.rang, [...(parRang.get(a.rang) ?? []), a]);
  const cartes = [...parRang.values()].map((lignes): Carte => {
    const de = (...kinds: string[]) => propre(lignes.find((l) => kinds.includes(l.asset_kind) && propre(l.texte))?.texte);
    const avecVisuel = lignes.find((l) => propre(l.image_url) || propre(l.vignette_url) || propre(l.video_id));
    return {
      titre: de("title", "carousel_card"),
      description: de("description"),
      visuel: avecVisuel ? visuelDe(avecVisuel, origine) : null,
      lien: sansDoublon(lignes.map((l) => adresseSure(l.lien_url)))[0] ?? null,
    };
  });

  const liens = sansDoublon([
    adresseSure(crea.lien_url),
    ...feed.map((a) => adresseSure(a.asset_kind === "link_url" ? a.lien_url ?? a.texte : a.lien_url)),
    ...cartes.map((c) => c.lien),
  ]);

  return {
    apercu: {
      texte: textes[0] ?? null,
      titre: titres[0] ?? null,
      description: descriptions[0] ?? null,
      bouton: boutons[0] ?? null,
      visuel: visuels[0] ?? cartes.find((c) => c.visuel)?.visuel ?? null,
    },
    textes,
    titres,
    descriptions,
    boutons,
    visuels,
    cartes,
    liens,
    aDesVariantes: [textes, titres, descriptions, boutons, visuels].some((l) => l.length > 1),
  };
}

export type AnnonceOuverte = {
  id: string;
  /** Le nom le plus récent lu dans les insights. */
  nom: string;
  /** « Soldes › Acheteurs » — où elle vit. */
  sous: string;
};

/**
 * L'annonce demandée par l'URL (`annonce`, par ID), si elle a des chiffres
 * dans la sélection : la période, et la campagne du Bandeau quand il y en a
 * une. Une annonce inconnue ne s'ouvre pas (spec, § « L'état de la page vit
 * dans l'URL ») — comme un jour hors de la période : changer de filtre ou de
 * période la referme sans qu'aucun lien ait à le savoir.
 *
 * Par l'ID, jamais par le nom : deux annonces homonymes sont deux annonces.
 */
export function annonceOuverteDe(
  x: string | undefined,
  lignes: LigneMeta[],
  selection: { debut: string; fin: string; campagne: (l: LigneMeta) => boolean }
): AnnonceOuverte | null {
  const id = propre(x);
  if (!id) return null;
  let recente: LigneMeta | null = null;
  for (const l of lignes) {
    if (l.annonceId !== id || l.date < selection.debut || l.date > selection.fin || !selection.campagne(l)) continue;
    if (!recente || l.date > recente.date) recente = l;
  }
  return recente && { id, nom: recente.annonceNom, sous: `${recente.campagneNom} › ${recente.groupeNom}` };
}
