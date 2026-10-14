// Harnais du ticket 13 — la lecture de `extra_data` à l'affichage.
//
// Seam : « catégorie + `extra_data` tel que Meta l'envoie → ce que le panneau
// écrit » (`saas/web/lib/meta/rubriques.ts`). Les formes sont celles du
// ticket 02, noms remplacés (le dépôt est public). Lancer depuis la racine :
//
//     node --import ./.scratch/journal-meta/harnais/13/resoudre.mjs \
//          --test .scratch/journal-meta/harnais/13/*.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { actuel, lireExtra, type Rubrique } from "../../../../saas/web/lib/meta/rubriques.ts";

const rubriques = (categorie: string, extra: unknown): Rubrique[] => {
  const l = lireExtra(categorie, extra);
  assert.equal(l.forme, "rubriques", JSON.stringify(l));
  return (l as { rubriques: Rubrique[] }).rubriques;
};

test("statut : les libellés de Meta, recopiés tels quels", () => {
  const l = lireExtra("statut", {
    old_value: "Actif",
    new_value: "En attente de traitement",
    run_status: { old_value: 1, new_value: 17 },
    type: "run_status",
  });
  assert.deepEqual(l, { forme: "statut", avant: "Actif", apres: "En attente de traitement" });
});

test("statut sans libellé d'arrivée : on ne devine pas, la phrase seule", () => {
  assert.deepEqual(lireExtra("statut", { run_status: { old_value: 1, new_value: 17 }, type: "run_status" }), { forme: "phrase" });
});

test("ciblage : une rubrique par `content`, « : » final retiré, avant et après appariés", () => {
  const r = rubriques("audience", {
    old_value: [
      { content: "Lieu :", children: ["Suisse"] },
      { content: "Âge :", children: ["50 - 65+"] },
    ],
    new_value: [
      { content: "Lieu :", children: ["Suisse"] },
      { content: "Âge :", children: ["55 - 65+"] },
      { content: "Langue :", children: ["Allemand", "Français"] },
    ],
    type: "targets_spec",
  });
  assert.deepEqual(r, [
    { nom: "Lieu", avant: "Suisse", apres: "Suisse", change: false },
    { nom: "Âge", avant: "50 - 65+", apres: "55 - 65+", change: true },
    { nom: "Langue", avant: null, apres: "Allemand, Français", change: true },
  ]);
  assert.deepEqual(actuel(r).map((x) => x.nom), ["Âge", "Langue"]);
});

test("ciblage d'un groupe neuf : `old_value: []`, tout est nouveau", () => {
  const r = rubriques("audience", { old_value: [], new_value: [{ content: "Lieu:", children: ["Suisse"] }], type: "targets_spec" });
  assert.deepEqual(r, [{ nom: "Lieu", avant: null, apres: "Suisse", change: true }]);
});

test("ciblage identique avant et après : aucune rubrique dans « Actuel »", () => {
  const cib = [{ content: "Lieu :", children: ["Suisse"] }];
  assert.deepEqual(actuel(rubriques("audience", { old_value: cib, new_value: cib, type: "targets_spec" })), []);
});

test("créa à quatre éléments : visuel par son nom de fichier, titre, texte ; l'ID ne compte pas", () => {
  const r = rubriques("creatif", {
    old_value: ["https://scontent.example/v/abc_n.png?sig=1&oe=2", "Titre", "Texte", "900"],
    new_value: ["https://scontent.example/v/abc_n.png?sig=9&oe=7", "Titre", "Texte neuf", "901"],
  });
  assert.deepEqual(r, [
    { nom: "Visuel", avant: "abc_n.png", apres: "abc_n.png", change: false },
    { nom: "Titre", avant: "Titre", apres: "Titre", change: false },
    { nom: "Texte", avant: "Texte", apres: "Texte neuf", change: true },
  ]);
});

test("créa où seul l'ID change : rien dans « Actuel » (ticket 02, trois cas vus)", () => {
  const v = ["https://x/img.jpg?sig=1", "Titre", "Texte"];
  assert.deepEqual(actuel(rubriques("creatif", { old_value: [...v, "900"], new_value: [...v, "901"] })), []);
});

test("créa sans visuel avant, avec après : longueurs différentes, rangées par ce qu'elles sont", () => {
  const r = rubriques("creatif", {
    old_value: ["Titre", "Texte", "900"],
    new_value: ["https://x/neuf.jpg?s=1", "Titre", "Texte", "901"],
  });
  assert.deepEqual(r[0], { nom: "Visuel", avant: null, apres: "neuf.jpg", change: true });
  assert.deepEqual(actuel(r).map((x) => x.nom), ["Visuel"]);
});

test("créa à un seul texte : on ne devine pas si c'est le titre ou le texte", () => {
  const r = rubriques("creatif", { old_value: ["https://x/a.jpg", "Seul", "900"], new_value: ["https://x/a.jpg", "Seul", "901"] });
  assert.deepEqual(r.map((x) => x.nom), ["Visuel", "Titre ou texte"]);
});

test("objectif sans avant", () => {
  assert.deepEqual(rubriques("objectif", { new_value: "Vues de page de destination", old_value: null, type: "optimization_goal" }), [
    { nom: "Objectif", avant: null, apres: "Vues de page de destination", change: true },
  ]);
});

test("stratégie d'enchère : le code Meta brut, sans traduction (ticket 10, point 5)", () => {
  assert.deepEqual(
    rubriques("enchere", { new_value: "LOWEST_COST_BID_STRATEGY", additional_value: { currency: "CHF", type: "payment_amount" }, type: "bid_type" }),
    [{ nom: "Stratégie d'enchère", avant: null, apres: "LOWEST_COST_BID_STRATEGY", change: true }]
  );
});

test("calendrier : début et fin de diffusion, avant et après", () => {
  const r = rubriques("calendrier", {
    old_value: { time_start: "août 27, 2026, 11:00 AM", time_stop: "nov 5, 2026, 6:00 PM" },
    new_value: { time_start: "août 27, 2026, 4:00 PM", time_stop: "nov 5, 2026, 6:00 PM" },
    type: "duration",
  });
  assert.deepEqual(r, [
    { nom: "Début de diffusion", avant: "août 27, 2026, 11:00 AM", apres: "août 27, 2026, 4:00 PM", change: true },
    { nom: "Fin de diffusion", avant: "nov 5, 2026, 6:00 PM", apres: "nov 5, 2026, 6:00 PM", change: false },
  ]);
});

test("création d'un groupe : le budget dans `composite_data`, en centimes, devise de Meta", () => {
  assert.deepEqual(
    lireExtra("creation", {
      new_value: { type: "payment_amount", currency: "CHF", new_value: 20000, additional_value: "Budget global" },
      type: "composite_data",
    }),
    { forme: "creation", detail: "Budget global : 200,00 CHF" }
  );
});

test("création d'une annonce : rien de plus que le geste", () => {
  assert.deepEqual(lireExtra("creation", { campaign_id: { mutation_input: 210, new: 210 } }), { forme: "creation", detail: null });
});

test("forme inconnue, chaîne non JSON, absence : la phrase seule", () => {
  assert.deepEqual(lireExtra("budget", { old_value: { old_value: 1000 }, new_value: { new_value: 2000 }, type: "composite_data" }), { forme: "phrase" });
  assert.deepEqual(lireExtra("creatif", "pas du json"), { forme: "phrase" });
  assert.deepEqual(lireExtra("audience", null), { forme: "phrase" });
  assert.deepEqual(lireExtra("audience", { type: "targets_spec" }), { forme: "phrase" });
  assert.deepEqual(lireExtra("enchere", { old_value: 40, new_value: 55 }), { forme: "phrase" });
  assert.deepEqual(lireExtra(null, { old_value: "a", new_value: "b" }), { forme: "phrase" });
});
