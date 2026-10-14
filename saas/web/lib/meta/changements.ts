// ── LE JOURNAL META À L'ÉCRAN ────────────────────────────────────────────────
//
// Ce que Meta DÉCLARE avoir changé (`platform_changes`) devient des points —
// un par jour sur la Tendance, un par jour sur chaque ligne de la Comparaison
// — et se lit dans le Panneau latéral, rangé campagne › groupe d'annonces ›
// annonce (écran validé au ticket 10 de `.scratch/journal-meta/`, construit au
// ticket 13). Harnais : `.scratch/journal-meta/harnais/13/`.
//
// LE FILTRE PASSE PAR L'ID, JAMAIS PAR LE NOM. La récolte (ticket 12) écrit sur
// chaque ligne l'élément touché, sa campagne et son groupe d'annonces ; quand
// elle ne les retrouve pas, l'ID reste vide. Un tel changement ne se montre que
// SANS le filtre qui le demande, et le panneau filtré le COMPTE : le taire
// ferait croire que la journée est complète.
//
// LE STATUT SE REGROUPE (ticket 05) : chaque modification d'annonce fait passer
// Meta par son examen, trois lignes dans la même minute. Une chaîne par élément
// et par jour, qui compte pour UN changement — partout où l'on compte.
//
// Pas de directive, comme `lecture.ts` (`CLAUDE.md` §8).
//
// LE JOUR EST CELUI DU COMPTE, pas celui de l'UTC : c'est celui des insights,
// donc celui du point de la courbe où l'effet apparaît.

import { jourEtHeureDans } from "../fuseau";
import type { Campagne, Niveau as NiveauCompare, Periode } from "./lecture";
import type { Onglet } from "./liens";
import { lireExtra, type Lecture } from "./rubriques";

/** Une ligne de `platform_changes`, telle que PostgREST la rend. Les cinq
 *  dernières colonnes viennent du ticket 12 : NULL sur les lignes d'avant. */
export type LigneChangement = {
  change_id: string | null;
  occurred_at: string | null;
  categorie: string | null;
  campaign_id: string | number | null;
  campaign_name: string | null;
  resume: string | null;
  /** Le `timezone_name` du compte, récolté avec le changement. */
  fuseau: string | null;
  niveau: string | null;
  object_id: string | number | null;
  object_name: string | null;
  adset_id: string | number | null;
  /** Tel que Meta l'envoie : un objet, ou une chaîne quand ce n'était pas du JSON. */
  extra_data: unknown;
  /** Ticket 20 : NULL sur les lignes d'avant. */
  acteur: string | null;
};

export type NiveauChangement = "campagne" | "groupe" | "annonce";

/** Qui a fait le changement, comme la colonne « Modifié par » d'Ads Manager —
 *  jamais un nom (ticket 20). `null` = pas encore récolté. */
export type Acteur = "personne" | "meta" | null;

export type ChangementMeta = {
  id: string;
  /** YYYY-MM-DD, dans le fuseau du compte. */
  jour: string;
  /** « 14:02 », dans le fuseau du compte. */
  heure: string;
  /** `null` = fuseau inconnu : `jour` et `heure` sont alors en UTC, et
   *  l'écran l'écrit. */
  fuseau: string | null;
  /** L'instant, en ms : l'ordre du panneau. `heure` ne suffit pas — une
   *  ligne sans fuseau est en UTC, et le retour à l'heure d'hiver écrit deux
   *  fois « 02:30 ». */
  instant: number;
  nature: string;
  /** `null` = une ligne d'avant le ticket 12 : on ne sait pas quel élément. */
  niveau: NiveauChangement | null;
  objetId: string | null;
  objetNom: string | null;
  campagneId: string | null;
  campagneNom: string | null;
  /** Le groupe d'annonces : l'élément lui-même pour un groupe, son groupe pour
   *  une annonce, `null` pour une campagne ou quand la récolte l'a perdu. */
  groupeId: string | null;
  /** Rédigée à la récolte ; elle nomme l'élément touché. Le panneau l'écrit
   *  quand `extra_data` ne se lit pas. */
  phrase: string;
  lecture: Lecture;
  acteur: Acteur;
};

/** Les catégories de `platform_changes`, dites comme Ads Manager les dit. */
const NATURES: Record<string, string> = {
  budget: "Budget",
  statut: "Statut",
  audience: "Ciblage",
  creatif: "Visuel et texte",
  enchere: "Enchère",
  creation: "Création",
  objectif: "Objectif",
  calendrier: "Calendrier",
  diffusion: "Diffusion",
};
const NATURE_INCONNUE = "Réglage";
const NIVEAUX: NiveauChangement[] = ["campagne", "groupe", "annonce"];
const ACTEURS: Acteur[] = ["personne", "meta"];

const id = (x: string | number | null): string | null => (x === null || x === "" ? null : String(x));

/**
 * Une ligne de base → un changement, ou `null` quand elle n'a ni date lisible
 * ni phrase.
 *
 * Découpé dans le fuseau du compte. Une ligne sans fuseau, ou un fuseau
 * illisible, retombe sur l'UTC — `fuseau: null` le signale.
 */
export function changementDe(r: LigneChangement): ChangementMeta | null {
  const phrase = r.resume?.trim();
  if (!phrase || !r.occurred_at) return null;
  const d = new Date(r.occurred_at);
  if (isNaN(d.getTime())) return null;
  const categorie = r.categorie ?? null;
  return {
    id: String(r.change_id ?? `${r.occurred_at}|${phrase}`),
    ...jourEtHeureDans(d, r.fuseau),
    instant: d.getTime(),
    nature: NATURES[String(categorie ?? "")] ?? NATURE_INCONNUE,
    niveau: (NIVEAUX as (string | null)[]).includes(r.niveau) ? (r.niveau as NiveauChangement) : null,
    objetId: id(r.object_id),
    objetNom: r.object_name?.trim() || null,
    campagneId: id(r.campaign_id),
    campagneNom: r.campaign_name?.trim() || null,
    groupeId: id(r.adset_id),
    phrase,
    lecture: lireExtra(categorie, r.extra_data),
    acteur: (ACTEURS as (string | null)[]).includes(r.acteur) ? (r.acteur as Acteur) : null,
  };
}

// ── La portée : ce que la page regarde ───────────────────────────────────────

/** Une ligne de la Comparaison, ouverte depuis un de ses points. */
export type ElementOuvert = { niveau: NiveauCompare; cle: string };

export type Portee = {
  /** Le filtre du Bandeau, par ID. */
  campagne: string | null;
  groupe: string | null;
  /** La ligne de la Comparaison dont on a cliqué un point. */
  element?: ElementOuvert | null;
};

const PREFIXES: Record<NiveauCompare, string> = { groupes: "groupe:", annonces: "annonce:" };

/** `element` dans l'URL : « groupe:<ID> » ou « annonce:<ID> ». Le niveau y
 *  est écrit parce que celui de la Comparaison peut changer panneau ouvert. */
export function valeurElement(e: ElementOuvert): string {
  return `${PREFIXES[e.niveau]}${e.cle}`;
}

export function elementOuvertDe(x: string | undefined): ElementOuvert | null {
  for (const niveau of Object.keys(PREFIXES) as NiveauCompare[]) {
    if (x?.startsWith(PREFIXES[niveau]) && x.length > PREFIXES[niveau].length) return { niveau, cle: x.slice(PREFIXES[niveau].length) };
  }
  return null;
}

/** La ligne d'un groupe compte aussi les changements de ses annonces (ticket
 *  08) ; celle d'une annonce, les siens. Par l'ID : une clé « sans-id: » de la
 *  Comparaison n'attrape donc rien. */
function deLElement(c: ChangementMeta, e: ElementOuvert): boolean {
  return e.niveau === "groupes" ? c.groupeId === e.cle : c.niveau === "annonce" && c.objetId === e.cle;
}

function visible(c: ChangementMeta, p: Portee): boolean {
  if (p.campagne !== null && c.campagneId !== p.campagne) return false;
  if (p.groupe !== null && c.groupeId !== p.groupe) return false;
  return !p.element || deLElement(c, p.element);
}

/** Ce que le filtre écarte FAUTE D'ID, et qu'il faut donc compter à part. Un
 *  changement de campagne sous un filtre de groupe n'en est pas : il n'est
 *  pas sur le groupe, on le sait. */
function nonRattache(c: ChangementMeta, p: Portee): boolean {
  if (p.element || visible(c, p)) return false;
  if (p.campagne !== null && c.campagneId === null) return true;
  return p.groupe !== null && c.groupeId === null && c.niveau !== "campagne" && (c.campagneId === null || c.campagneId === p.campagne);
}

// ── Le compte : le statut regroupé ───────────────────────────────────────────

/** La clé qui réunit les pas d'un statut : l'élément et le jour. Un statut
 *  sans élément connu, ou que `extra_data` ne raconte pas, reste seul. */
function cleCarte(c: ChangementMeta): string {
  return c.lecture.forme === "statut" && c.objetId ? `statut|${c.jour}|${c.niveau}|${c.objetId}` : c.id;
}

/** Combien de changements on lit : une chaîne de statut compte pour un. */
export function nombreDeChangements(changements: ChangementMeta[]): number {
  return new Set(changements.map(cleCarte)).size;
}

export type MarqueJour = {
  /** La place du jour dans `dates`. */
  index: number;
  nombre: number;
};

/** Un point par JOUR qui a au moins un changement visible, pas un par
 *  changement : trois gestes à la même heure se chevaucheraient. */
export function joursMarques(changements: ChangementMeta[], portee: Portee, dates: string[]): MarqueJour[] {
  const parJour = new Map<string, ChangementMeta[]>();
  for (const c of changements) if (visible(c, portee)) parJour.set(c.jour, [...(parJour.get(c.jour) ?? []), c]);
  return dates.flatMap((d, index) => (parJour.has(d) ? [{ index, nombre: nombreDeChangements(parJour.get(d)!) }] : []));
}

/** Les jours où une ligne de la Comparaison porte un point. */
export function marquesElement(changements: ChangementMeta[], element: ElementOuvert, dates: string[]): number[] {
  const jours = new Set(changements.filter((c) => deLElement(c, element)).map((c) => c.jour));
  return dates.flatMap((d, i) => (jours.has(d) ? [i] : []));
}

/** Le jour demandé par l'URL, s'il est dans la période. Un jour hors de la
 *  période ne s'ouvre pas : on lirait des changements sans les chiffres qui
 *  vont avec. La période exclut déjà le jour en cours. */
export function jourOuvertDe(x: string | undefined, periode: Periode): string | null {
  if (!x || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return null;
  const d = new Date(`${x}T00:00:00Z`);
  // `Date` accepte le 30 février et le reporte au 2 mars : on refuse.
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== x) return null;
  return x >= periode.debut && x <= periode.fin ? x : null;
}

/** Ce que l'URL demande au Panneau latéral. UNE règle pour la page (ce
 *  qu'elle lit), les onglets (lequel s'allume) et le journal (ce qu'il
 *  montre) : le jour l'emporte sur l'onglet, même hors de la période — il
 *  n'ouvre alors rien, et l'onglet ne s'ouvre pas non plus. */
export type PanneauDemande = {
  /** Un `jour` est dans l'URL, ouvrable ou non. */
  jourDemande: boolean;
  /** Le jour qui s'ouvre vraiment (`jourOuvertDe`). */
  jour: string | null;
  element: ElementOuvert | null;
  onglet: Onglet | null;
};

type Lire = (cle: string) => string | undefined;

/** La part de la demande qui ne dépend pas de la période : la page en a
 *  besoin AVANT de lire ses données, pour ne pas lire ce qui ne s'ouvrira pas. */
export function ongletDemandeDe(lire: Lire): Pick<PanneauDemande, "jourDemande" | "onglet"> {
  const jourDemande = !!lire("jour");
  const panneau = lire("panneau");
  return { jourDemande, onglet: !jourDemande && (panneau === "changements" || panneau === "apercus") ? panneau : null };
}

export function panneauDemandeDe(lire: Lire, periode: Periode): PanneauDemande {
  return { ...ongletDemandeDe(lire), jour: jourOuvertDe(lire("jour"), periode), element: elementOuvertDe(lire("element")) };
}

// ── Le panneau : campagne › groupe d'annonces › annonce ──────────────────────

/** L'état de départ n'a ni heure ni acteur : il précède la chaîne. */
export type Etape = { libelle: string; heure: string | null; acteur: Acteur };

type Commun = { id: string; instant: number; heure: string; fuseau: string | null; nature: string };
/** Une petite carte du panneau : un statut enchaîné, ou une modification.
 *  L'acteur d'un statut est sur chaque étape, pas sur la carte : Meta et une
 *  personne s'y relaient (ticket 20). */
export type Carte =
  | (Commun & { sorte: "statut"; etapes: Etape[] })
  | (Commun & { sorte: "lecture"; lecture: Lecture; phrase: string; acteur: Acteur });

export type NoeudAnnonce = { id: string; nom: string; cartes: Carte[] };
export type NoeudGroupe = {
  /** `null` = des annonces dont la récolte n'a pas retrouvé le groupe. */
  id: string | null;
  nom: string | null;
  cartes: Carte[];
  annonces: NoeudAnnonce[];
  total: number;
};
export type NoeudCampagne = {
  /** `null` = la récolte n'a pas retrouvé la campagne. */
  id: string | null;
  nom: string | null;
  couleur: string;
  /** Les changements de la campagne elle-même, et ceux d'avant le ticket 12,
   *  dont on ne sait pas l'élément : leur phrase le nomme. */
  cartes: Carte[];
  groupes: NoeudGroupe[];
  total: number;
};
export type JourPanneau = { jour: string; campagnes: NoeudCampagne[] };

export type Panneau = {
  /** Les changements montrés, statut regroupé. */
  total: number;
  /** Le plus récent d'abord. */
  jours: JourPanneau[];
  /** Ceux que le filtre écarte faute d'ID : ils ne se montrent pas, mais se
   *  comptent. */
  nonRattaches: number;
};

const GRIS_INCONNU = "#c3c2bb";

/** Les changements d'une même carte → la carte. Les pas d'un statut font une
 *  chaîne : l'état de départ, puis chaque état d'arrivée à son heure. */
function carteDe(lignes: ChangementMeta[]): Carte {
  const [premier] = lignes;
  const commun: Commun = { id: premier.id, instant: premier.instant, heure: premier.heure, fuseau: premier.fuseau, nature: premier.nature };
  if (premier.lecture.forme !== "statut") {
    return { ...commun, sorte: "lecture", lecture: premier.lecture, phrase: premier.phrase, acteur: premier.acteur };
  }
  const etapes: Etape[] = premier.lecture.avant === null ? [] : [{ libelle: premier.lecture.avant, heure: null, acteur: null }];
  for (const l of lignes) if (l.lecture.forme === "statut") etapes.push({ libelle: l.lecture.apres, heure: l.heure, acteur: l.acteur });
  return { ...commun, sorte: "statut", etapes };
}

/** Le statut d'abord (ticket 10, point 5), puis les modifications ; chacun
 *  dans l'ordre des heures. */
function cartesDe(lignes: ChangementMeta[]): Carte[] {
  const parCle = new Map<string, ChangementMeta[]>();
  for (const l of [...lignes].sort((a, b) => a.instant - b.instant)) parCle.set(cleCarte(l), [...(parCle.get(cleCarte(l)) ?? []), l]);
  const cartes = [...parCle.values()].map(carteDe);
  return [...cartes.filter((c) => c.sorte === "statut"), ...cartes.filter((c) => c.sorte !== "statut")];
}

/** Regroupe en gardant l'ordre du premier changement de chaque groupe — le
 *  panneau se lit par heure, les blocs comme les lignes. `null` en dernier. */
function regrouper<K>(lignes: ChangementMeta[], cle: (c: ChangementMeta) => K): [K, ChangementMeta[]][] {
  const m = new Map<K, ChangementMeta[]>();
  for (const l of [...lignes].sort((a, b) => a.instant - b.instant)) m.set(cle(l), [...(m.get(cle(l)) ?? []), l]);
  return [...m.entries()].sort(([a], [b]) => Number(a === null) - Number(b === null));
}

/** Le nom d'un élément : celui des insights (le plus récent, comme le
 *  Bandeau), sinon celui que Meta a écrit avec le changement. */
type Noms = Record<string, string>;

function noeudGroupe(id: string | null, lignes: ChangementMeta[], noms: Noms): NoeudGroupe {
  const propres = lignes.filter((l) => l.niveau === "groupe");
  const annonces = regrouper(lignes.filter((l) => l.niveau !== "groupe"), (l) => l.objetId ?? l.id).map(([aid, la]): NoeudAnnonce => ({
    id: aid,
    nom: noms[aid] ?? la.find((l) => l.objetNom)?.objetNom ?? aid,
    cartes: cartesDe(la),
  }));
  const cartes = cartesDe(propres);
  return {
    id,
    nom: (id && noms[id]) ?? propres.find((l) => l.objetNom)?.objetNom ?? id,
    cartes,
    annonces,
    total: cartes.length + annonces.reduce((s, a) => s + a.cartes.length, 0),
  };
}

function noeudCampagne(id: string | null, lignes: ChangementMeta[], campagnes: Campagne[], noms: Noms): NoeudCampagne {
  const connue = id === null ? undefined : campagnes.find((c) => c.cle === id);
  const sousGroupe = (l: ChangementMeta) => l.niveau === "groupe" || l.niveau === "annonce";
  const cartes = cartesDe(lignes.filter((l) => !sousGroupe(l)));
  const groupes = regrouper(lignes.filter(sousGroupe), (l) => l.groupeId).map(([gid, lg]) => noeudGroupe(gid, lg, noms));
  return {
    id,
    nom: id === null ? null : connue?.nom ?? lignes.find((l) => l.campagneNom)?.campagneNom ?? id,
    couleur: connue?.couleur ?? GRIS_INCONNU,
    cartes,
    groupes,
    total: cartes.length + groupes.reduce((s, g) => s + g.total, 0),
  };
}

/**
 * Le Panneau latéral : les changements visibles de `debut` à `fin` (un jour,
 * ou toute la période pour l'onglet « Changements »), un bloc par jour, le
 * plus récent d'abord.
 */
export function panneauDe(
  changements: ChangementMeta[],
  jours: { debut: string; fin: string },
  portee: Portee,
  ctx: { campagnes: Campagne[]; noms: Noms }
): Panneau {
  const dansJours = changements.filter((c) => c.jour >= jours.debut && c.jour <= jours.fin);
  const montres = dansJours.filter((c) => visible(c, portee));
  const parJour = regrouper(montres, (c) => c.jour).sort(([a], [b]) => (a < b ? 1 : -1));
  return {
    total: nombreDeChangements(montres),
    jours: parJour.map(([jour, lj]) => ({
      jour,
      campagnes: regrouper(lj, (c) => c.campagneId).map(([cid, lc]) => noeudCampagne(cid, lc, ctx.campagnes, ctx.noms)),
    })),
    nonRattaches: nombreDeChangements(dansJours.filter((c) => nonRattache(c, portee))),
  };
}
