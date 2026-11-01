// `payload.frise` à la nouvelle forme — écrit par `weekly_report/blocs/frise.py`
// (ticket 07 ; les posts arrivent au ticket 08).
//
// Module SANS directive : la page serveur y lit la garde de forme, la frise et
// le panneau (client) y lisent les règles de semaine. Une valeur exportée d'un
// module `"use client"` se lirait côté serveur comme un proxy (`CLAUDE.md` §8).
//
// TOUT CE QUI SE MESURE SORT DU PAYLOAD. Ici on ne fait que placer : quelle
// semaine est choisie, jusqu'où va le trait, quelle campagne tourne cette
// semaine-là. Aucun chiffre ne se recalcule.
import type { SemaineHebdo } from "@/lib/hebdo/semaine";
import type { SourcesHebdo } from "@/lib/hebdo/sources";
import { SOURCE } from "@/lib/plateformes";

/** Testé dans cet ordre par le worker ; absent = statut non récolté. */
export type StatutCampagne =
  | "supprimee"
  | "terminee"
  | "probleme"
  | "en_cours"
  | "en_pause"
  | "prevue";

export type CampagneFrise = {
  /** `campaign_id` — l'identité. Deux homonymes font deux campagnes. */
  id: string;
  plateforme: "meta" | "google";
  /** Le nom actuel : la config, sinon la ligne d'insights la plus récente. */
  nom: string;
  /** Date déclarée, sinon premier jour de dépense. */
  debut: string;
  /** Fin déclarée ; pour une supprimée, son dernier jour de dépense (sinon
   *  `debut`) ; sinon le dernier jour de dépense mesuré, `null` s'il n'y en a
   *  aucun. Une campagne vivante sans fin déclarée ne s'arrête pas là : voir
   *  `segments`. */
  fin: string | null;
  /** `true` quand `fin` vient de la plateforme (trait plein jusqu'à elle). */
  fin_declaree: boolean;
  statut?: StatutCampagne;
  /** Créas des annonces, par dépense décroissante, sans doublon, ≤ 4. `[]`
   *  pour Google. */
  visuels: string[];
  /** CLÉ = DERNIER JOUR de la semaine calée sur le Jour de travail (la même
   *  que `semaine.fin` pour la semaine mesurée). Creux : une semaine absente
   *  n'a enregistré aucune dépense. */
  depense_par_semaine: Record<string, number>;
};

export type FriseHebdo = {
  /** L'année de `semaine.fin` — une seule. */
  annee: number;
  campagnes: CampagneFrise[];
  /** Ticket 08. */
  posts?: unknown[];
};

/** Un payload publié avant le ticket 07 porte l'ancienne `frise` (sans
 *  `annee`), ou rien : la page ne montre alors pas ce bloc. */
export function estFriseHebdo(f: unknown): f is FriseHebdo {
  return (
    typeof f === "object" &&
    f !== null &&
    typeof (f as FriseHebdo).annee === "number" &&
    Array.isArray((f as FriseHebdo).campagnes)
  );
}

// ── Les dates, en chaînes ISO lues en UTC ────────────────────────────────────

const JOUR_MS = 864e5;
const enMs = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
const enIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function ajouteJours(iso: string, n: number): string {
  return enIso(enMs(iso) + n * JOUR_MS);
}

/** Jours de `a` à `b` (positif si `b` est après `a`). */
export function ecartJours(a: string, b: string): number {
  return Math.round((enMs(b) - enMs(a)) / JOUR_MS);
}

export function joursDansAnnee(annee: number): number {
  return ecartJours(`${annee}-01-01`, `${annee + 1}-01-01`);
}

/** Position d'un jour dans l'année : 0 le 1er janvier. */
export function jourDeLAnnee(iso: string, annee: number): number {
  return ecartJours(`${annee}-01-01`, iso);
}

// ── La semaine choisie ───────────────────────────────────────────────────────
//
// `w` compte les semaines en arrière depuis la semaine mesurée (0). Pas de
// semaine après elle : le rapport est figé à `semaine.fin`.

export type Bornes = { debut: string; fin: string };

export function semaineDecalee(semaine: SemaineHebdo, w: number): Bornes {
  const fin = ajouteJours(semaine.fin, -7 * w);
  return { debut: ajouteJours(fin, -6), fin };
}

/** La plus vieille semaine qu'on peut choisir : la dernière qui finit dans
 *  l'année de la frise. */
export function decalageMax(semaine: SemaineHebdo, annee: number): number {
  return Math.max(0, Math.floor(ecartJours(`${annee}-01-01`, semaine.fin) / 7));
}

/** La semaine qui contient ce jour, bornée à l'année et à la semaine mesurée. */
export function decalageDuJour(semaine: SemaineHebdo, annee: number, iso: string): number {
  const w = Math.floor(ecartJours(iso, semaine.fin) / 7);
  return Math.min(decalageMax(semaine, annee), Math.max(0, w));
}

// ── Le trait d'une campagne ──────────────────────────────────────────────────

const VIVANTS: ReadonlySet<StatutCampagne> = new Set(["en_cours", "en_pause", "probleme"]);

/** En cours, en pause ou problème signalé, sans fin déclarée : elle continue
 *  au-delà de ce qu'on a mesuré. */
export function sansFin(c: CampagneFrise): boolean {
  return !c.fin_declaree && c.statut !== undefined && VIVANTS.has(c.statut);
}

/**
 * Le trait plein va du début à la fin déclarée (ou au dernier jour mesuré) ;
 * une campagne vivante sans fin va en plein jusqu'à la fin de la semaine du
 * rapport, puis en pointillés jusqu'au 31 décembre (ticket 17) — le plein
 * avance d'une semaine à chaque rapport. Bornes incluses ; `null` = pas de
 * segment.
 */
export function segments(
  c: CampagneFrise,
  semaine: SemaineHebdo,
  annee: number
): { plein: Bornes | null; pointilles: Bornes | null } {
  const finAnnee = `${annee}-12-31`;
  if (!sansFin(c)) {
    return { plein: { debut: c.debut, fin: c.fin ?? c.debut }, pointilles: null };
  }
  const plein = c.debut <= semaine.fin ? { debut: c.debut, fin: semaine.fin } : null;
  const depuis = c.debut > semaine.fin ? c.debut : ajouteJours(semaine.fin, 1);
  return { plein, pointilles: depuis <= finAnnee ? { debut: depuis, fin: finAnnee } : null };
}

/** A tourné pendant la semaine choisie : son trait plein la touche, ou elle y
 *  a dépensé. */
export function tourneDans(c: CampagneFrise, sem: Bornes, semaine: SemaineHebdo): boolean {
  if ((c.depense_par_semaine[sem.fin] ?? 0) > 0) return true;
  const { plein } = segments(c, semaine, Number(semaine.fin.slice(0, 4)));
  return plein !== null && plein.debut <= sem.fin && plein.fin >= sem.debut;
}

export function lanceeDans(c: CampagneFrise, sem: Bornes): boolean {
  return c.debut >= sem.debut && c.debut <= sem.fin;
}

export function termineeDans(c: CampagneFrise, sem: Bornes): boolean {
  return c.fin_declaree && c.fin !== null && c.fin >= sem.debut && c.fin <= sem.fin;
}

// ── Le filtre des statuts ────────────────────────────────────────────────────

export type CleStatut = StatutCampagne | "inconnu";

export const STATUTS: { cle: CleStatut; nom: string }[] = [
  { cle: "terminee", nom: "terminée" },
  { cle: "supprimee", nom: "supprimée" },
  { cle: "probleme", nom: "problème signalé par Meta" },
  { cle: "en_cours", nom: "en cours" },
  { cle: "en_pause", nom: "en pause" },
  { cle: "prevue", nom: "prévue" },
  { cle: "inconnu", nom: "statut inconnu" },
];

export const cleStatut = (c: CampagneFrise): CleStatut => c.statut ?? "inconnu";

export function nomStatut(c: CampagneFrise): string {
  const cle = cleStatut(c);
  return STATUTS.find((s) => s.cle === cle)?.nom ?? "statut inconnu";
}

// ── L'onglet Campagnes vide ──────────────────────────────────────────────────

const PUBS = ["meta", "google"] as const;

/**
 * Le vide se dit (spec, tableau des états, point 9). Dans cet ordre :
 * avant la connexion de toutes les régies → « … n'était pas encore connecté » ;
 * la semaine mesurée d'une régie en panne → « en cours de récupération » (un
 * jeton mort laisse le panneau inchangé) ; sinon une vraie semaine sans
 * campagne. Sans `sources` (payload d'avant le ticket 04), seul le dernier cas
 * peut se dire.
 */
export function campagnesVides(
  sources: SourcesHebdo | null | undefined,
  sem: Bornes,
  mesuree: boolean
): string {
  const pubs = PUBS.filter((c) => sources?.[c]);
  const avant = pubs.filter((c) => {
    const le = sources?.[c]?.connecte_le;
    return le ? sem.fin < le.slice(0, 10) : false;
  });
  if (pubs.length > 0 && avant.length === pubs.length) {
    const noms = avant.map((c) => SOURCE[c]?.nom ?? c);
    return noms.length > 1
      ? `${noms.join(" et ")} n'étaient pas encore connectés`
      : `${noms[0]} n'était pas encore connecté`;
  }
  if (mesuree && pubs.some((c) => sources?.[c]?.etat === "panne")) {
    return "Campagnes en cours de récupération";
  }
  return "Aucune campagne active cette semaine";
}

// ── L'affichage ──────────────────────────────────────────────────────────────

/** « 1 240 CHF ». Pas de `toLocaleString` : serveur et navigateur n'ont pas
 *  toujours les mêmes données de locale, et deux rendus différents font une
 *  erreur d'hydratation (voir `lib/jour-de-travail.ts`). */
export function chf(n: number): string {
  const entier = String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${entier} CHF`;
}
