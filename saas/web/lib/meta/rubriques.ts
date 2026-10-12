// ── CE QUE META A CHANGÉ, LU DANS `extra_data` ───────────────────────────────
//
// La récolte garde `extra_data` TEL QUE META L'ENVOIE (ticket 11 de
// `.scratch/journal-meta/`) : l'avant / après, « Actuel » et le statut se
// lisent ICI, à l'affichage. Une fonction par forme vue sur un vrai compte
// (ticket 02) ; une forme qu'aucune ne reconnaît rend `phrase`, et le panneau
// écrit alors le `resume` de la récolte, seul — jamais une valeur devinée.
//
// RIEN N'EST TRADUIT (ticket 04) : les libellés sont ceux de Meta, dans la
// langue du jeton, et `LOWEST_COST_BID_STRATEGY` reste un code (ticket 10,
// point 5). La forme se choisit par la catégorie de la ligne et par la
// structure de `extra_data`, jamais par un libellé.
//
// « Actuel » compare avant et après TEXTE CONTRE TEXTE, rubrique par rubrique
// (ticket 06, rouvert par le prototype) : aucun montant ni nombre n'est
// comparé, aucune ligne n'est cachée.
//
// Pas de directive : lu par le serveur et par le harnais
// `.scratch/journal-meta/harnais/13/`.

import { nombre } from "./lecture";

export type Rubrique = {
  nom: string;
  /** `null` = Meta ne donne rien de ce côté (un groupe neuf, un objectif posé). */
  avant: string | null;
  apres: string | null;
  /** Le texte diffère : la rubrique entre dans « Actuel » et se surligne. */
  change: boolean;
};

export type Lecture =
  /** Un pas du statut ; le panneau les enchaîne par élément et par jour. */
  | { forme: "statut"; avant: string | null; apres: string }
  | { forme: "rubriques"; rubriques: Rubrique[] }
  /** `detail` : ce que Meta dit de plus à la création (le budget d'un groupe). */
  | { forme: "creation"; detail: string | null }
  | { forme: "phrase" };

const PHRASE: Lecture = { forme: "phrase" };

type Objet = Record<string, unknown>;
const estObjet = (x: unknown): x is Objet => typeof x === "object" && x !== null && !Array.isArray(x);

/** Un libellé tel que Meta l'écrit ; `null` pour rien ou une chaîne vide. */
function texte(x: unknown): string | null {
  if (typeof x === "string") return x.trim() || null;
  if (typeof x === "number" || typeof x === "boolean") return String(x);
  return null;
}

function rubrique(nom: string, avant: string | null, apres: string | null): Rubrique {
  return { nom, avant, apres, change: avant !== apres };
}

/** Les rubriques qui ont changé, avec leur nouvelle valeur : « Actuel ». */
export function actuel(rubriques: Rubrique[]): Rubrique[] {
  return rubriques.filter((r) => r.change);
}

// ── Une fonction par forme (ticket 02) ───────────────────────────────────────

/** `{"old_value":"Actif","new_value":"En attente de traitement","run_status":{…},"type":"run_status"}`.
 *  Le code chiffré ne sert à rien ici : on affiche le libellé de Meta. */
function lireStatut(e: Objet): Lecture {
  const apres = texte(e.new_value);
  return apres === null ? PHRASE : { forme: "statut", avant: texte(e.old_value), apres };
}

/** Une liste de `{"content":"Lieu :","children":["…"]}`, état complet de chaque
 *  côté, déjà rédigée par Meta. Les deux côtés s'apparient par `content`. */
function lireCiblage(e: Objet): Lecture {
  const cote = (x: unknown): Map<string, string> | null => {
    if (x === null || x === undefined) return new Map();
    if (!Array.isArray(x)) return null;
    const m = new Map<string, string>();
    for (const l of x) {
      if (!estObjet(l)) return null;
      const nom = texte(l.content)?.replace(/\s*:\s*$/, "");
      if (!nom) return null;
      const enfants = Array.isArray(l.children) ? l.children.map(texte).filter((t): t is string => t !== null) : [];
      m.set(nom, enfants.join(", "));
    }
    return m;
  };
  const avant = cote(e.old_value);
  const apres = cote(e.new_value);
  if (!avant || !apres || (avant.size === 0 && apres.size === 0)) return PHRASE;
  const noms = [...new Set([...avant.keys(), ...apres.keys()])];
  return { forme: "rubriques", rubriques: noms.map((n) => rubrique(n, avant.get(n) ?? null, apres.get(n) ?? null)) };
}

/** `[url_image?, titre?, texte?, id_créa]`, de longueur 2 à 4 (ticket 02).
 *  L'URL de la même image change d'un appel à l'autre (paramètres signés) :
 *  le visuel se dit et se compare par son NOM DE FICHIER. L'ID de la créa ne
 *  se compare pas — Meta le change sans rien changer de visible. */
function lireCrea(e: Objet): Lecture {
  type Cote = { visuel: string | null; textes: string[] };
  const cote = (x: unknown): Cote | null => {
    if (x === null || x === undefined) return { visuel: null, textes: [] };
    if (!Array.isArray(x) || x.length === 0) return null;
    const valeurs = x.slice(0, -1).map(texte);
    const url = valeurs.find((v) => v !== null && /^https?:\/\//.test(v)) ?? null;
    return {
      visuel: url && (new URL(url).pathname.split("/").pop() || url),
      textes: valeurs.filter((v): v is string => v !== null && v !== url),
    };
  };
  const avant = cote(e.old_value);
  const apres = cote(e.new_value);
  if (!avant || !apres) return PHRASE;
  const rubriques: Rubrique[] = [];
  if (avant.visuel || apres.visuel) rubriques.push(rubrique("Visuel", avant.visuel, apres.visuel));
  // Deux textes : titre puis texte, l'ordre de la liste de Meta. Un seul : rien
  // ne dit lequel des deux, et on ne devine pas.
  const n = Math.max(avant.textes.length, apres.textes.length);
  const noms = n >= 2 ? ["Titre", "Texte"] : ["Titre ou texte"];
  for (let i = 0; i < Math.min(n, 2); i++) rubriques.push(rubrique(noms[i], avant.textes[i] ?? null, apres.textes[i] ?? null));
  return rubriques.length ? { forme: "rubriques", rubriques } : PHRASE;
}

/** `{"new_value":"Vues de page de destination","old_value":null,"type":"optimization_goal"}`
 *  et `{"new_value":"LOWEST_COST_BID_STRATEGY",…,"type":"bid_type"}` : une
 *  seule rubrique, valeurs recopiées. */
function lireValeur(nom: string, type: string) {
  return (e: Objet): Lecture => {
    if (e.type !== type) return PHRASE;
    const avant = texte(e.old_value);
    const apres = texte(e.new_value);
    return avant === null && apres === null ? PHRASE : { forme: "rubriques", rubriques: [rubrique(nom, avant, apres)] };
  };
}

/** `{"old_value":{"time_start":"…","time_stop":"…"},"new_value":{…},"type":"duration"}`.
 *  Dates écrites par Meta, dans sa langue : recopiées, pas relues. */
function lireCalendrier(e: Objet): Lecture {
  if (e.type !== "duration") return PHRASE;
  const de = (x: unknown, cle: string) => (estObjet(x) ? texte(x[cle]) : null);
  const rubriques = [
    rubrique("Début de diffusion", de(e.old_value, "time_start"), de(e.new_value, "time_start")),
    rubrique("Fin de diffusion", de(e.old_value, "time_stop"), de(e.new_value, "time_stop")),
  ];
  return rubriques.every((r) => r.avant === null && r.apres === null) ? PHRASE : { forme: "rubriques", rubriques };
}

/** `create_ad_set` porte son budget en `composite_data`, EN CENTIMES (ticket
 *  02 ; même lecture que `_montant` de la récolte), la devise donnée par Meta,
 *  aucune supposée. `create_ad` ne porte que son groupe : rien à ajouter. */
function lireCreation(e: Objet): Lecture {
  const v = e.type === "composite_data" && estObjet(e.new_value) ? e.new_value : null;
  const centimes = v && typeof v.new_value === "number" ? v.new_value : null;
  const devise = v && texte(v.currency);
  if (centimes === null || !devise) return { forme: "creation", detail: null };
  const libelle = texte(v!.additional_value);
  return { forme: "creation", detail: `${libelle ? `${libelle} : ` : ""}${nombre(centimes / 100, 2)} ${devise}` };
}

const LECTEURS: Record<string, (e: Objet) => Lecture> = {
  statut: lireStatut,
  audience: lireCiblage,
  creatif: lireCrea,
  objectif: lireValeur("Objectif", "optimization_goal"),
  enchere: lireValeur("Stratégie d'enchère", "bid_type"),
  calendrier: lireCalendrier,
  creation: lireCreation,
};

/**
 * Ce que le panneau écrit d'un changement. `extra_data` arrive en objet
 * (jsonb), ou en chaîne quand Meta n'envoyait pas du JSON : une chaîne, une
 * absence ou une forme inattendue rendent la phrase seule.
 */
export function lireExtra(categorie: string | null, extra: unknown): Lecture {
  const lire = categorie ? LECTEURS[categorie] : undefined;
  if (!lire || !estObjet(extra)) return PHRASE;
  try {
    return lire(extra);
  } catch {
    // `new URL` sur une adresse que Meta aurait mal formée : la phrase plutôt
    // qu'un panneau qui tombe.
    return PHRASE;
  }
}
