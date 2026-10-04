// ── UN INSTANT, LU DANS LE FUSEAU DU COMPTE PUBLICITAIRE ─────────────────────
//
// Meta écrit `event_time` en UTC (« 2026-09-30T22:30:00+0000 ») et
// `platform_changes.occurred_at` est un `timestamptz` : l'instant est juste,
// le jour ne l'est pas. Les jours des insights (`meta_ads_insights.date_start`)
// sont ceux du FUSEAU DU COMPTE — un geste fait à Zurich à 00:30 se poserait,
// découpé en UTC, la veille du jour où ses effets apparaissent (ticket 17).
//
// Pas de directive : partagé par `lib/meta/changements.ts` et
// `lib/changements-api.ts` (`CLAUDE.md` §8).

export type JourEtHeure = {
  /** YYYY-MM-DD. */
  jour: string;
  /** « 00:30 ». */
  heure: string;
  /** Le fuseau qui a servi ; `null` = UTC, faute d'un fuseau lisible. */
  fuseau: string | null;
};

const deux = (n: number) => String(n).padStart(2, "0");

function enUtc(d: Date): JourEtHeure {
  return {
    jour: d.toISOString().slice(0, 10),
    heure: `${deux(d.getUTCHours())}:${deux(d.getUTCMinutes())}`,
    fuseau: null,
  };
}

/**
 * Le jour et l'heure de `d` dans `fuseau` (un nom IANA, comme le
 * `timezone_name` de Meta). Un fuseau absent ou que le moteur ne connaît pas
 * rend l'UTC, et le DIT par `fuseau: null` : l'écran l'écrit alors, pour
 * qu'on ne lise pas l'heure comme une heure locale.
 */
export function jourEtHeureDans(d: Date, fuseau: string | null | undefined): JourEtHeure {
  if (!fuseau) return enUtc(d);
  let morceaux: Intl.DateTimeFormatPart[];
  try {
    morceaux = new Intl.DateTimeFormat("en-CA", {
      timeZone: fuseau,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      // `hourCycle`, pas `hour12: false` : ce dernier rend « 24:00 » à minuit
      // sur une partie des moteurs.
      hourCycle: "h23",
    }).formatToParts(d);
  } catch {
    // RangeError : un nom de fuseau que le moteur ne connaît pas.
    return enUtc(d);
  }
  const de = (t: Intl.DateTimeFormatPartTypes) => morceaux.find((m) => m.type === t)?.value ?? "";
  return { jour: `${de("year")}-${de("month")}-${de("day")}`, heure: `${de("hour")}:${de("minute")}`, fuseau };
}
