// LE CALCUL DES TROIS DATES, EXÉCUTÉ — pas lu.
//
// `lib/jour-de-travail.ts` est importé TEL QUEL : node 22+ retire les
// annotations de type lui-même, donc aucune compilation, aucune dépendance, et
// surtout aucune COPIE du code à vérifier (une copie finirait par diverger de
// l'original, et le harnais dirait vert sur du code qui n'est plus servi).
//
// Ce que ces cas gardent, dans l'ordre du §7 : une date qu'on ne sait pas lire
// ne devient jamais un texte approché, et l'heure du cron (07:00 UTC) décide
// seule si le passage du jour est déjà parti.

import { fileURLToPath } from "node:url";
import path from "node:path";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const MODULE = path.resolve(ICI, "../../../../saas/web/lib/jour-de-travail.ts");
const J = await import(MODULE);

let ko = 0;
const egal = (nom, obtenu, attendu) => {
  const bon = obtenu === attendu;
  if (!bon) ko++;
  console.log(`  ${bon ? "✓" : "✗"} ${nom} : ${obtenu}${bon ? "" : ` (attendu ${attendu})`}`);
};

// ── La fenêtre mesurée — une date nue, lue en UTC des deux côtés.
// `new Date("2026-09-07")` est déjà de l'UTC ; la relire en local reculerait
// d'un jour à l'ouest de Greenwich (le défaut payé au ticket 11 sur `done_at`).
egal("« mesuré du »", J.dateFr(J.dateNue("2026-09-07")), "7 septembre");
egal("« mesuré au »", J.dateFr(J.dateNue("2026-09-13")), "13 septembre");
egal("dernier jour d'un mois", J.dateFr(J.dateNue("2026-08-31")), "31 août");

// ── Ce qu'on ne sait pas lire ne s'écrit pas.
egal("date absente", String(J.dateNue(null)), "null");
egal("date vide", String(J.dateNue("")), "null");
egal("date illisible", String(J.dateNue("la semaine dernière")), "null");
egal("date impossible", String(J.dateNue("2026-13-45")), "null");
egal("horodatage illisible", String(J.horodatage("bientôt")), "null");
egal("horodatage absent", String(J.horodatage(null)), "null");

// ── « publié le » — un `timestamptz` Postgres, tel que la ligne le rend.
egal("publié", J.dateFr(J.horodatage("2026-09-14T07:12:43.918+00:00")), "14 septembre");

// ── « mis à jour le » — le prochain Jour de travail.
const p = (jour, iso) => J.enFrancais(J.prochainPassage(jour, new Date(iso)).date);
egal("le jour même, avant 07:00 UTC — le cron n'est pas parti",
  p("Monday", "2026-09-14T06:00:00Z"), "lundi 14 septembre");
egal("le jour même, après 07:00 UTC — il est parti, rendez-vous dans huit jours",
  p("Monday", "2026-09-14T08:00:00Z"), "lundi 21 septembre");
egal("un jeudi vu le vendredi", p("Thursday", "2026-09-18T09:00:00Z"), "jeudi 24 septembre");
egal("un jeudi vu le mardi", p("Thursday", "2026-09-15T23:00:00Z"), "jeudi 17 septembre");
egal("un dimanche vu le lundi", p("Sunday", "2026-09-14T09:00:00Z"), "dimanche 20 septembre");
egal("bascule de mois", p("Tuesday", "2026-09-30T09:00:00Z"), "mardi 6 octobre");
egal("bascule d'année", p("Friday", "2026-12-31T09:00:00Z"), "vendredi 1 janvier");

// Un jour que la base ne devrait pas porter retombe sur le défaut du worker
// (`_due_today` lit `(fetch_schedule or "Monday")`) : on ne devine pas un autre
// jour, on dit celui qui sera réellement servi.
egal("jour inconnu → lundi, comme le worker", p("Caturday", "2026-09-15T09:00:00Z"),
  "lundi 21 septembre");
egal("le défaut est bien lundi", J.JOUR_DEFAUT, "Monday");

// ── Le délai, tel que `jour-recolte.tsx` le lit encore.
egal("délai 0", J.delai(0), "aujourd'hui");
egal("délai 1", J.delai(1), "demain");
egal("délai 4", J.delai(4), "dans 4 jours");

// ── Les sept jours sont dans l'ordre de la semaine, pas dans celui de
//    `getUTCDay()` — c'est ce qui fait que `indexSemaine` et `JOURS` s'accordent.
egal("lundi est premier", J.JOURS[0].en, "Monday");
egal("dimanche est dernier", J.JOURS[6].en, "Sunday");
egal("index d'un dimanche", J.indexSemaine(new Date("2026-09-13T00:00:00Z")), 6);
egal("index d'un lundi", J.indexSemaine(new Date("2026-09-14T00:00:00Z")), 0);

console.log(`  → ${ko === 0 ? "tout passe" : ko + " échec(s)"}`);
process.exit(ko === 0 ? 0 : 1);
