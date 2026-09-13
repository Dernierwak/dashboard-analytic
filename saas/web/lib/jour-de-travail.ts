// ── LE JOUR DE TRAVAIL, ET LES DATES QU'IL DONNE À LIRE ──────────────────────
//
// « Le jour de la semaine que le compte a choisi, et le SEUL moment où Pulse
// récolte, recalcule et publie » (`CONTEXT.md`, entrée Jour de travail). Tout
// ce que ce module calcule en découle : le prochain passage du worker, et la
// façon d'écrire une date en français.
//
// POURQUOI CE MODULE EXISTE, ET POURQUOI IL N'A AUCUNE DIRECTIVE.
//
// Ces sept jours et ce calcul vivaient dans `components/jour-recolte.tsx`, qui
// porte `"use client"`. Deux lecteurs en ont besoin maintenant : ce module-là,
// et les trois dates en tête du rapport (`components/trois-dates.tsx`), qui
// sont rendues par le SERVEUR. Importer une valeur exportée depuis un module
// `"use client"` dans un composant serveur ne lève rien et passe TypeScript —
// la valeur lue est une référence client, c'est-à-dire un proxy
// (`CLAUDE.md` §8). Les valeurs partagées vivent donc dans un module sans
// directive, qui se compile des deux côtés.
//
// TOUT EST EN UTC, ET CE N'EST PAS UN DÉTAIL. Le cron tourne à « 0 7 * * * »
// (`.github/workflows/weekly-fetch.yml`) et le worker compare
// `datetime.utcnow().strftime("%A")` (`_due_today`, `fetch_all.py`). Calculer
// le prochain passage dans le fuseau du lecteur le décalerait d'un jour à
// l'ouest de Greenwich — le défaut exact payé au ticket 11 sur `done_at`.

/** L'ordre de la semaine, pas celui de `getUTCDay()` (qui commence le
 *  dimanche). L'anglais est la valeur écrite en base (`profiles.fetch_schedule`),
 *  le français ne sert qu'à l'écran. */
export const JOURS = [
  { en: "Monday", fr: "lundi", court: "lun" },
  { en: "Tuesday", fr: "mardi", court: "mar" },
  { en: "Wednesday", fr: "mercredi", court: "mer" },
  { en: "Thursday", fr: "jeudi", court: "jeu" },
  { en: "Friday", fr: "vendredi", court: "ven" },
  { en: "Saturday", fr: "samedi", court: "sam" },
  { en: "Sunday", fr: "dimanche", court: "dim" },
];

export const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** L'heure du cron, en UTC. */
export const HEURE_UTC = 7;

/** Le jour par défaut, celui du worker : `_due_today` lit
 *  `(fetch_schedule or "Monday")`. Un profil sans jour choisi EST récolté le
 *  lundi — l'écrire ici n'invente donc rien, c'est le comportement réel. */
export const JOUR_DEFAUT = "Monday";

/** 0 = lundi (`getUTCDay` met dimanche en 0). */
export function indexSemaine(d: Date): number {
  return (d.getUTCDay() + 6) % 7;
}

/** Le prochain passage du worker pour ce jour choisi, et dans combien de jours. */
export function prochainPassage(
  jourEn: string,
  maintenant: Date
): { date: Date; delta: number } {
  const i = JOURS.findIndex((j) => j.en === jourEn);
  const cible = i < 0 ? 0 : i;
  let delta = (cible - indexSemaine(maintenant) + 7) % 7;
  // Le passage du jour est déjà parti : le prochain est dans une semaine.
  if (delta === 0 && maintenant.getUTCHours() >= HEURE_UTC) delta = 7;
  const date = new Date(
    Date.UTC(
      maintenant.getUTCFullYear(),
      maintenant.getUTCMonth(),
      maintenant.getUTCDate() + delta,
      HEURE_UTC
    )
  );
  return { date, delta };
}

// Les noms sont écrits à la main plutôt que confiés à `Intl` : le serveur (Node)
// et le navigateur ne portent pas toujours les mêmes données de locale, et deux
// rendus différents pour la même date, c'est une erreur d'hydratation.

/** « lundi 21 septembre » — le jour nommé, parce qu'un rendez-vous se retient
 *  par son jour de semaine. */
export function enFrancais(d: Date): string {
  return `${JOURS[indexSemaine(d)].fr} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
}

/** « 21 septembre » — sans le jour de semaine, pour une date qu'on constate
 *  plutôt qu'on attend. */
export function dateFr(d: Date): string {
  return `${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
}

export function delai(delta: number): string {
  if (delta === 0) return "aujourd'hui";
  if (delta === 1) return "demain";
  return `dans ${delta} jours`;
}

/**
 * Une date nue (« 2026-09-13 ») lue en UTC, et `null` si elle ne ressemble à
 * rien. `new Date("2026-09-13")` la lit déjà comme UTC, mais `new Date(x)` sur
 * une chaîne mal formée rend `Invalid Date` sans jamais lever : sans ce
 * contrôle, une date absente du payload s'afficherait « NaN septembre ».
 */
export function dateNue(iso: string | null | undefined): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return isNaN(d.getTime()) ? null : d;
}

/** Un horodatage Postgres (`timestamptz`) lu tel quel, `null` s'il est illisible. */
export function horodatage(x: string | null | undefined): Date | null {
  if (!x) return null;
  const d = new Date(x);
  return isNaN(d.getTime()) ? null : d;
}

// ── LA PHRASE D'UN RÉGLAGE QUI ATTEND LE JOUR DE TRAVAIL ─────────────────────
//
// Trois réglages s'enregistrent à la seconde et ne changent le rapport qu'au
// prochain passage du worker : les priorités de thèmes, l'objectif du compte,
// les catégories de conversions. Ils ne sont pas du REGROUPEMENT (qui se relit
// tout de suite, partout) mais de la RÉDACTION — et ce qui se rédige attend le
// jour dit (`.scratch/refonte/issues/13-entre-deux-jours-de-travail.md` §2).
//
// UNE SEULE FORMULATION, ÉCRITE UNE FOIS. Trois écrans différents qui disent la
// même règle avec trois phrases différentes, c'est trois règles pour le
// lecteur. Le `quand` vient du serveur (`lib/jour-compte.ts`) : ce module ne
// lit aucune horloge ici, il met en mots une date déjà calculée.

/** « Enregistré — tes conseils en tiennent compte le jeudi 17 septembre. » */
export function prisEnCompteLe(quand: string): string {
  return `Enregistré — tes conseils en tiennent compte le ${quand}.`;
}
