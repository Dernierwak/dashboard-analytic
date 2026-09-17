// CE QUE `etat()` ÉCRIT SOUS UNE LIGNE DE SUIVI — ticket 42.
//
// Chaque vérification a d'abord été rejouée contre le code d'AVANT le
// correctif, où celles qui portent un verdict sur une ligne rangée tombent :
// `report.ts` lisait le verdict dans le payload, et `suivi_en_cours()` n'y met
// que `running`/`done` — une action rangée n'en avait donc jamais.
//
// Ici on ne simule pas cette lecture : on donne à `etat()` la ligne TELLE
// QU'ELLE ARRIVE MAINTENANT, verdict compris, et on regarde ce qu'elle écrit.

import { etat } from "./etat-action.js";

let passees = 0;
const echecs = [];

function verifie(nom, ligne, attendu) {
  const e = etat(ligne);
  const ecarts = Object.entries(attendu).filter(([k, v]) => e[k] !== v);
  if (ecarts.length === 0) {
    passees += 1;
    return;
  }
  echecs.push(
    `${nom}\n     attendu ${JSON.stringify(attendu)}\n     obtenu  ` +
      JSON.stringify({ forme: e.forme, label: e.label })
  );
}

// Le squelette d'une ligne de suivi : ce que `report.ts` compose pour chaque
// ligne de `suivi_actions`. Les champs qui comptent ici sont posés par test.
const ligne = (extra) => ({
  id: "1",
  title: "Baisser le budget de la campagne Trafic",
  theme: "Notoriété",
  metric_label: "CPC",
  decided_at: "2026-08-01",
  check_at: "2026-08-15",
  ...extra,
});

// ── 1 · Une action RANGÉE rend enfin son verdict ─────────────────────────────
// Le cœur du ticket. Avant, ces trois-là écrivaient « rangée ».
verifie("rangée · verdict better", ligne({ status: "archived", verdict: "better" }), {
  label: "ça a marché",
  forme: "pleine",
});
verifie("rangée · verdict worse", ligne({ status: "archived", verdict: "worse" }), {
  label: "pas d'effet",
  forme: "pleine",
});
verifie("rangée · verdict stable", ligne({ status: "archived", verdict: "stable" }), {
  label: "stable",
  forme: "pleine",
});

// ── 2 · Une ligne rangée SANS verdict reste « rangée » ───────────────────────
// Abandonnée avant l'échéance, ou jugée non mesurable : elle n'hérite d'aucune
// pastille de résultat. C'est la deuxième exigence du ticket.
verifie("rangée · aucun verdict", ligne({ status: "archived" }), {
  label: "rangée",
  forme: "pleine",
});
verifie(
  "rangée · aucun verdict · hypothèse auto",
  ligne({ status: "archived", origin: "auto" }),
  { label: "hypothèse rangée", forme: "creuse" }
);

// ── 3 · Une hypothèse que personne n'a confirmée ne prend pas la pastille pleine
// Chemin resté inerte jusqu'ici — aucun verdict n'arrivait sur une ligne rangée.
// Le correctif l'ouvre : les lignes `auto` jugées avant que le ticket 06 ne les
// sorte de `suivi_en_cours` portent un verdict en base. Le verdict est vrai, il
// a été mesuré ; mais il ne dit pas que le client a fait quelque chose.
verifie(
  "rangée · verdict · hypothèse auto jamais confirmée",
  ligne({ status: "archived", origin: "auto", verdict: "better" }),
  { label: "hypothèse — ça a marché", forme: "creuse" }
);
// Confirmée par « ✓ Je l'ai fait » (seul geste qui pose `done_at`) : c'est
// redevenu une vraie décision, elle reprend la pastille pleine.
verifie(
  "rangée · verdict · hypothèse auto CONFIRMÉE",
  ligne({ status: "archived", origin: "auto", verdict: "better", done_at: "2026-08-02" }),
  { label: "ça a marché", forme: "pleine" }
);

// ── 4 · Une action ABANDONNÉE dit où elle a fini, pas ce qu'elle a donné ─────
// `drop` admet un départ `done` (`DEPART_ADMIS`, `app/actions.ts`) et les deux
// boutons sont côte à côte au moment du verdict : une ligne jugée puis
// abandonnée porte donc un verdict. On annonce l'abandon.
verifie("abandonnée · verdict better", ligne({ status: "dropped", verdict: "better" }), {
  label: "abandonnée",
  forme: "barree",
});
verifie(
  "abandonnée · verdict · hypothèse auto",
  ligne({ status: "dropped", origin: "auto", verdict: "better" }),
  { label: "hypothèse écartée", forme: "creuse" }
);

// ── 5 · Ce que le correctif ne devait PAS déplacer ───────────────────────────
// Une action faite dont l'échéance est là : c'est le rail qui parle, pas le
// verdict — même quand il est déjà écrit en base ce jour-là.
verifie("faite · échéance atteinte", ligne({ status: "done", due: true, verdict: "better" }), {
  label: "à juger",
  forme: "creuse",
});
verifie("faite · en observation", ligne({ status: "done", due: false }), {
  label: "en observation",
  forme: "creuse",
});
verifie("hypothèse · échéance atteinte", ligne({ status: "auto", due: true }), {
  label: "hypothèse à juger",
  forme: "creuse",
});
verifie("hypothèse · suivie", ligne({ status: "auto", due: false }), {
  label: "suivie automatiquement",
  forme: "creuse",
});
verifie("décidée, pas encore faite", ligne({ status: "running" }), {
  label: "à faire",
  forme: "creuse",
});
// Une note n'a ni indicateur ni échéance : rien à juger. Un verdict posé sur
// elle par erreur ne doit pas lui donner de pastille.
verifie("note", ligne({ kind: "note", status: "archived", verdict: "better" }), {
  label: "ta note",
  forme: "note",
});

// ─────────────────────────────────────────────────────────────────────────────
if (echecs.length) {
  console.error(`✗ ${echecs.length} vérification(s) en échec :\n`);
  for (const e of echecs) console.error(`  · ${e}\n`);
  process.exit(1);
}
console.log(`✓ ${passees} vérifications passées — etat() (ticket 42)`);
