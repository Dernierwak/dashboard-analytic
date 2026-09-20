// LA FENÊTRE D'UN TABLEAU DE BORD DE CANAL — et rien d'autre.
//
// Ce module est un DÉPLACEMENT depuis `lib/channels.ts`, pour une seule raison :
// pouvoir être vérifié hors ligne. `channels.ts` importe le client Supabase,
// donc `next/headers`, donc React — il ne se charge pas hors de Next, et tout ce
// qu'il contient était invérifiable autrement qu'en production. Les règles de
// fenêtre, elles, sont de l'arithmétique pure sur des dates : elles n'ont besoin
// ni de base, ni de secret, ni de réseau (`CLAUDE.md` §9). Elles vivent donc
// ici, et `channels.ts` les importe.
//
// AUCUNE LOGIQUE N'A CHANGÉ EN CHEMIN. `customWindow` reste exporté depuis
// `channels.ts`, avec la même signature : c'est une couture, pas une réécriture.
//
// Les trois règles que ce module tient, et qui se valent sur toutes les pages
// canal :
//   · une fenêtre finit sur un JOUR PLEIN, jamais sur aujourd'hui ;
//   · elle recule jusqu'au dernier jour de données quand la récolte a du retard ;
//   · elle s'arrête au dernier jour LU quand la récolte a ÉCHOUÉ (ticket 48) —
//     et dans ce cas seulement, parce que seul `fetch_progress` distingue un
//     trou d'un zéro mesuré (ADR 0005).

const MOIS_FR = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];

export function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

export function fmtDay(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MOIS_FR[d.getUTCMonth()]}`;
}

export type Days = 7 | 14 | 30 | 90 | 0; // 0 = tout l'historique

export type Window = { since: Date; until: Date; prevSince: Date; prevUntil: Date; label: string };

export function makeWindow(lastDataIso: string | null, firstDataIso: string | null, days: Days): Window {
  const yesterday = addDays(new Date(), -1);
  let anchor = yesterday;
  if (lastDataIso) {
    const d = new Date(lastDataIso.slice(0, 10) + "T00:00:00Z");
    if (!isNaN(d.getTime()) && d < yesterday) anchor = d;
  }
  if (days === 0) {
    let first = addDays(anchor, -365);
    if (firstDataIso) {
      const f = new Date(firstDataIso.slice(0, 10) + "T00:00:00Z");
      if (!isNaN(f.getTime())) first = f;
    }
    // pas de période précédente comparable → deltas null
    return {
      since: first,
      until: anchor,
      prevSince: addDays(first, -1),
      prevUntil: addDays(first, -2),
      label: `Tout l'historique · ${fmtDay(first)} ${first.getUTCFullYear()} → ${fmtDay(anchor)} ${anchor.getUTCFullYear()}`,
    };
  }
  const since = addDays(anchor, -(days - 1));
  const prevUntil = addDays(since, -1);
  const prevSince = addDays(prevUntil, -(days - 1));
  return {
    since,
    until: anchor,
    prevSince,
    prevUntil,
    label: `${fmtDay(since)} → ${fmtDay(anchor)} ${anchor.getUTCFullYear()} · ${days} jours pleins`,
  };
}

// Période custom « du … au … » : fenêtre libre, comparée à la fenêtre de même
// durée juste avant (même règle de delta que les presets).
//
// ELLE S'ARRÊTE AU DERNIER JOUR PLEIN, comme les presets. `makeWindow` ancre sur
// `yesterday` depuis toujours ; la période sur mesure, elle, prenait la date
// tapée telle quelle. Un client qui choisissait « du 1er au 17 août » le 17 août
// comparait donc dix-sept jours dont un incomplet à dix-sept jours pleins — la
// règle de la maison (« toute comparaison exclut le jour en cours ») tombait
// exactement là où l'utilisateur avait choisi ses bornes lui-même. Le rognage
// est ÉCRIT dans le libellé : une fenêtre qu'on raccourcit sans le dire est pire
// qu'une fenêtre fausse.
export function fenetreSurMesure(
  from: string,
  to: string,
  /** LE DERNIER JOUR LU PAR UN CANAL MUET (ticket 48), ou `null` quand la
   *  récolte a tourné normalement.
   *
   *  Les présélections n'en ont pas besoin : `makeWindow` s'ancre déjà sur la
   *  dernière ligne écrite, donc elles ne peuvent pas déborder sur le trou. Une
   *  plage tapée à la main, elle, prend les dates du client — et les jours
   *  d'après la panne entrent alors dans la fenêtre comme des jours à ZÉRO :
   *  la courbe tombe, ce qui se lit comme un arrêt de campagne, et le total
   *  baisse sans que personne n'ait rien arrêté.
   *
   *  ON NE CLAMPE QUE SUR UN CANAL MUET, jamais sur « plus de lignes récentes ».
   *  Un canal qui a bien répondu et n'a simplement plus de campagne active a
   *  des zéros MESURÉS, et ils doivent continuer à s'afficher comme des zéros
   *  (ADR 0005, état ③). Seule `fetch_progress` distingue les deux. */
  dernierJourLu: string | null = null
): Window | null {
  const f = from;
  const t = to;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const since = new Date(f + "T00:00:00Z");
  const demande = new Date(t + "T00:00:00Z");
  if (isNaN(since.getTime()) || isNaN(demande.getTime()) || since > demande) return null;
  const hier = addDays(new Date(), -1);
  const rogne = iso(demande) > iso(hier);
  let until = rogne ? new Date(iso(hier) + "T00:00:00Z") : demande;
  // Le rognage sur le trou vient APRÈS celui du jour en cours : les deux
  // rétrécissent la fenêtre, et c'est la borne la plus ancienne qui gagne.
  const trou = dernierJourLu !== null && iso(until) > dernierJourLu;
  if (trou) until = new Date(dernierJourLu + "T00:00:00Z");

  // UNE PLAGE ENTIÈREMENT APRÈS LA BORNE SE RABAT DESSUS, ELLE N'EST PAS JETÉE.
  //
  // Rendre `null` ici renvoyait l'appelant sur `makeWindow`, donc sur la
  // présélection de 7 jours — SANS RIEN DIRE. Les deux champs de date du
  // bandeau continuaient d'afficher « du 15 au 20 septembre » pendant que le
  // libellé et tous les chiffres portaient les sept jours finissant le 10 : une
  // fenêtre de repli déguisée en fenêtre choisie, exactement le défaut que le
  // ticket 46 a corrigé sur la page Coûts (`resoudrePeriode`). Même remède
  // ici, et pour les deux bornes — le jour en cours comme le trou de récolte.
  let debut = since;
  const rabattue = debut > until;
  if (rabattue) debut = until;

  const len = Math.round((until.getTime() - debut.getTime()) / 86400_000) + 1;
  const prevUntil = addDays(debut, -1);
  const prevSince = addDays(prevUntil, -(len - 1));
  return {
    since: debut,
    until,
    prevSince,
    prevUntil,
    // UNE FENÊTRE QU'ON RACCOURCIT SANS LE DIRE EST PIRE QU'UNE FENÊTRE FAUSSE
    // — la règle est déjà celle du jour en cours, elle vaut ici aussi.
    label:
      `du ${fmtDay(debut)} ${debut.getUTCFullYear()} au ${fmtDay(until)} ${until.getUTCFullYear()} · ${len} jour${len > 1 ? "s" : ""}` +
      (rogne ? " · jour en cours exclu" : "") +
      (trou ? " · arrêtée au dernier jour lu" : "") +
      (rabattue ? " · ta plage est entièrement après" : ""),
  };
}

export const inWin = (dateStr: string, since: Date, until: Date) => {
  const d = String(dateStr).slice(0, 10);
  return d >= iso(since) && d <= iso(until);
};

