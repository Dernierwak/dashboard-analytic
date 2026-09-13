// LA PARTITION DES ACTIONS VIVANTES, EXÉCUTÉE — pas lue.
//
// La frontière du produit tient en une phrase : **le module « À faire » liste
// ce qui attend une décision de toi ; le rail montre le temps qui passe**
// (`.scratch/refonte/issues/20-a-faire-cette-semaine.md`). Depuis que les deux
// se lisent sur le MÊME écran, à trente pixels d'écart, cette phrase n'est plus
// une intention : c'est un invariant vérifiable. Une action des deux côtés se
// lirait comme deux choses à faire ; une action d'aucun côté disparaîtrait de
// la page sans que rien ne le dise.
//
// `lib/a-faire.ts` est importé TEL QUEL (voir `alias.mjs`) : rien n'est recopié.

import path from "node:path";
import { fileURLToPath } from "node:url";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const M = await import(path.resolve(ICI, "../../../../saas/web/lib/a-faire.ts"));

let ko = 0;
const ok = (nom, cond, detail = "") => {
  if (!cond) ko++;
  console.log(`  ${cond ? "✓" : "✗"} ${nom}${detail ? " — " + detail : ""}`);
};
const memes = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

const a = (id, o) =>
  Object.assign(
    { id, kind: "action", title: id, theme: "Été", decided_at: "2026-09-01",
      check_at: "2026-09-15", due: false },
    o
  );

// Les six états qu'une ligne vivante peut porter en arrivant sur la page.
const vivantes = [
  a("en-cours", { status: "running" }),
  a("note-pas-encore-faite", { kind: "note", status: "running" }),
  a("verdict-tombe", { status: "done", due: true }),
  a("en-observation", { status: "done", due: false }),
  // `"auto"` est un statut hérité, plus jamais écrit (ticket 06) ; les lignes
  // déjà en base le portent encore et suivent `"done"`.
  a("auto-tombe", { status: "auto", due: true }),
  a("auto-observe", { status: "auto", due: false }),
];

const rail = M.chantiersEnCours(vivantes).map((x) => x.id);
const liste = M.composerAFaire(null, vivantes, {}, {});
const module_ = [...liste.verdicts, ...liste.notes].map((x) => x.id);

console.log(`  rail   : ${rail.join(", ")}`);
console.log(`  module : ${module_.join(", ")}`);

ok("le rail ne montre que ce qui court",
  memes(rail, ["en-cours", "en-observation", "auto-observe"]), rail.join(", "));
ok("le module ne montre que ce qui attend une décision",
  memes(module_, ["verdict-tombe", "auto-tombe", "note-pas-encore-faite"]), module_.join(", "));

const deuxFois = rail.filter((x) => module_.includes(x));
ok("aucune action n'est des deux côtés", deuxFois.length === 0, deuxFois.join(", "));
const couvert = new Set([...rail, ...module_]);
const perdues = vivantes.map((x) => x.id).filter((x) => !couvert.has(x));
ok("aucune action ne se perd entre les deux", perdues.length === 0, perdues.join(", "));

// Le rail de l'accueil ne reçoit que `data.actions`, d'où le rangé et
// l'abandonné sont déjà absents — mais s'ils lui arrivaient un jour, ils ne
// doivent pas se mettre à « courir » : une ligne close ne court plus.
const closes = M.chantiersEnCours([
  a("rangee", { status: "archived" }),
  a("abandonnee", { status: "dropped" }),
]);
ok("ni rangée ni abandonnée ne court", closes.length === 0, closes.map((x) => x.id).join(", "));
ok("aucune action → aucun rail", M.chantiersEnCours([]).length === 0);

// L'ordre du rail vient du rail lui-même (`ORDRE`, `rail-actions.tsx`) ; ici on
// garde seulement que la sélection ne réordonne rien qu'elle n'a pas trié.
ok("le rail rend les lignes dans l'ordre reçu",
  JSON.stringify(M.chantiersEnCours(vivantes).map((x) => x.id)) ===
    JSON.stringify(vivantes.filter((x) => rail.includes(x.id)).map((x) => x.id)));

console.log(`  → ${ko === 0 ? "tout passe" : ko + " échec(s)"}`);
process.exit(ko === 0 ? 0 : 1);
