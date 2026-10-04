// Harnais du ticket 10 — la vue Conversion.
//
// Même seam que les 06 et 09 : « lignes de base + commandes → contenu des
// modules », par `saas/web/lib/meta/lecture.ts` et `tableau.ts`. Les formes de
// `results` ci-dessous sont RECOPIÉES de la base de production après le
// passage du worker du 2026-10-03 (ticket 03) — pas inventées :
//   · `{"indicator": "actions:omni_landing_page_view", "values":
//      [{"attribution_windows": ["default"], "value": "45"}]}` ;
//   · l'indicateur SANS `values` (Meta ne rend jamais "0" : 1 698 lignes) ;
//   · `{"indicator": "total_profile_visits", "values": [{"value": "57"}]}`,
//     sans `attribution_windows`, sous `1d_click`.
// La liste vide et `results` NULL ne sont dans aucune ligne lue : ils viennent
// de la règle de la récolte (absent → NULL, vide → []).
//
// Lancer depuis la racine du dépôt :
//
//     node --import ./.scratch/meta-ads/harnais/09-le-tableau/resoudre.mjs \
//          --test .scratch/meta-ads/harnais/10-la-vue-conversion/conversion.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  contenuPage,
  formaterValeur,
  resultatsDe,
  vueDe,
  type LigneMeta,
} from "../../../../saas/web/lib/meta/lecture.ts";
import { csvDuTableau, tableauDe } from "../../../../saas/web/lib/meta/tableau.ts";

// Lundi 5 octobre 2026, Jour de travail lundi : la semaine mesurée va du 28
// septembre au 4 octobre, la période d'avant du 21 au 27.
const CTX = { aujourdhui: "2026-10-05", dernierJourDeTravail: "2026-10-05" };
const VUE = { vue: "conversion" };

const LPV = "actions:omni_landing_page_view";
const CLIC_LIEN = "actions:link_click";

/** Un élément de `results` tel que la base le porte. */
const rendu = (indicator: string, value?: string) =>
  value === undefined
    ? [{ indicator }]
    : [{ indicator, values: [{ attribution_windows: ["default"], value }] }];

function ligne(p: Partial<LigneMeta> & { date: string }): LigneMeta {
  return {
    campagneId: "c1",
    campagneNom: "Trafic",
    groupeId: "g1",
    groupeNom: "Bernois",
    annonceId: "a1",
    annonceNom: "Vidéo",
    depense: 0,
    impressions: 0,
    clics: 0,
    resultats: resultatsDe(rendu(LPV, "0")),
    attribution: "1d_view_7d_click",
    ...p,
  };
}

const metrique = (lignes: LigneMeta[], cle: string, cmd: object = VUE) =>
  contenuPage(lignes, cmd, CTX).tendance.find((m) => m.cle === cle)!;

// ── La forme de `results`, lue telle que Meta la rend ────────────────────────

test("results NULL reste « non lu », jamais une liste vide ni un zéro", () => {
  assert.equal(resultatsDe(null), null);
  assert.equal(resultatsDe(undefined), null);
});

test("une liste vide reste vide : Meta n'a rendu aucun type", () => {
  assert.deepEqual(resultatsDe([]), []);
});

test("le type voyage avec son nombre, les values sont sommées", () => {
  assert.deepEqual(resultatsDe(rendu(LPV, "45")), [{ type: LPV, valeur: 45 }]);
  assert.deepEqual(resultatsDe([{ indicator: "total_profile_visits", values: [{ value: "57" }] }]), [
    { type: "total_profile_visits", valeur: 57 },
  ]);
});

test("deux fenêtres ne se somment pas : la fenêtre default l'emporte", () => {
  const brut = [{ indicator: LPV, values: [
    { attribution_windows: ["1d_click"], value: "4" },
    { attribution_windows: ["default"], value: "9" },
  ] }];
  assert.deepEqual(resultatsDe(brut), [{ type: LPV, valeur: 9 }]);
});

test("plusieurs fenêtres sans default : le nombre reste inconnu, pas une somme", () => {
  const brut = [{ indicator: LPV, values: [
    { attribution_windows: ["1d_click"], value: "4" },
    { attribution_windows: ["7d_click"], value: "9" },
  ] }];
  assert.deepEqual(resultatsDe(brut), [{ type: LPV, valeur: null }]);
});

test("un indicateur sans values n'a pas de nombre — pas un zéro", () => {
  assert.deepEqual(resultatsDe(rendu(LPV)), [{ type: LPV, valeur: null }]);
});

// ── La vue existe ────────────────────────────────────────────────────────────

test("la vue Conversion se lit dans l'URL, et le Sélecteur porte trois cartes", () => {
  assert.equal(vueDe("conversion"), "conversion");
  const p = contenuPage([], VUE, CTX);
  assert.deepEqual(p.cartes.map((c) => c.vue), ["notoriete", "trafic", "conversion"]);
  assert.deepEqual(p.tendance.map((m) => m.cle), ["resultats", "cout_resultat", "taux_conversion"]);
});

// ── Les trois chiffres ───────────────────────────────────────────────────────

test("résultats, coût par résultat et taux de conversion sur tous les clics", () => {
  const lignes = [
    ligne({ date: "2026-09-28", depense: 30, clics: 40, resultats: resultatsDe(rendu(LPV, "10")) }),
    ligne({ date: "2026-09-29", annonceId: "a2", depense: 10, clics: 10, resultats: resultatsDe(rendu(LPV, "10")) }),
  ];
  assert.equal(metrique(lignes, "resultats").valeur, 20);
  assert.equal(metrique(lignes, "cout_resultat").valeur, 2); // 40 CHF ÷ 20
  assert.equal(metrique(lignes, "taux_conversion").valeur, 40); // 20 ÷ 50 clics (tous) × 100
});

test("le dénominateur du taux est écrit à l'écran", () => {
  const m = metrique([ligne({ date: "2026-09-28", clics: 5, resultats: resultatsDe(rendu(LPV, "1")) })], "taux_conversion");
  assert.match(m.precision ?? "", /clics \(tous\)/);
});

test("le type du résultat s'écrit à côté du chiffre", () => {
  const m = metrique([ligne({ date: "2026-09-28", resultats: resultatsDe(rendu(LPV, "3")) })], "resultats");
  assert.equal(m.precision, "vues de page de destination");
});

test("une annonce sans values compte pour rien dans la somme de ses voisines", () => {
  const lignes = [
    ligne({ date: "2026-09-28", resultats: resultatsDe(rendu(LPV, "7")) }),
    ligne({ date: "2026-09-28", annonceId: "a2", impressions: 3, resultats: resultatsDe(rendu(LPV)) }),
  ];
  assert.equal(metrique(lignes, "resultats").valeur, 7);
});

// ── « — », jamais « 0 » ──────────────────────────────────────────────────────

test("des types différents ne s'additionnent pas : « — » et l'info-bulle dit pourquoi", () => {
  const lignes = [
    ligne({ date: "2026-09-28", resultats: resultatsDe(rendu(LPV, "10")) }),
    ligne({ date: "2026-09-28", campagneId: "c2", groupeId: "g2", annonceId: "a2", resultats: resultatsDe(rendu(CLIC_LIEN, "5")) }),
  ];
  const m = metrique(lignes, "resultats");
  assert.equal(m.valeur, null);
  assert.equal(formaterValeur("resultats", m.valeur), "—");
  assert.match(m.precision ?? "", /ne s'additionnent pas/);
  assert.match(m.precision ?? "", /vues de page de destination/);
  assert.match(m.precision ?? "", /clics sur un lien/);
  // Le coût et le taux d'un total qui n'existe pas n'existent pas non plus.
  assert.equal(metrique(lignes, "cout_resultat").valeur, null);
  assert.equal(metrique(lignes, "taux_conversion").valeur, null);
  // Et la courbe ne trace pas une somme qu'on refuse d'écrire.
  assert.ok(m.serie.every((v) => v === null));
});

test("filtrée sur une campagne, la même sélection redevient lisible", () => {
  const lignes = [
    ligne({ date: "2026-09-28", resultats: resultatsDe(rendu(LPV, "10")) }),
    ligne({ date: "2026-09-28", campagneId: "c2", groupeId: "g2", annonceId: "a2", resultats: resultatsDe(rendu(CLIC_LIEN, "5")) }),
  ];
  assert.equal(metrique(lignes, "resultats", { ...VUE, campagne: "c2" }).valeur, 5);
});

test("une annonce sans résultat rendu affiche « — », pas 0", () => {
  const lignes = [ligne({ date: "2026-09-28", impressions: 40, clics: 0, depense: 0.2, resultats: resultatsDe(rendu(LPV)) })];
  const p = contenuPage(lignes, { ...VUE, niveau: "annonces" }, CTX);
  assert.equal(p.comparaison.elements[0].valeurs[0], null);
  assert.equal(metrique(lignes, "resultats").valeur, null);
  assert.equal(metrique(lignes, "cout_resultat").valeur, null);
});

test("une campagne de notoriété (aucun type rendu) affiche « — », jamais « 0 »", () => {
  const lignes = [
    ligne({ date: "2026-09-28", campagneId: "notoriete", campagneNom: "Notoriété", groupeId: "gN", annonceId: "aN", impressions: 9_000, depense: 50, resultats: [] }),
  ];
  const [campagne] = tableauDe(lignes, VUE, CTX).lignes;
  assert.deepEqual(campagne.valeurs, [null, null, null]);
  assert.equal(formaterValeur("resultats", campagne.valeurs[0]), "—");
});

test("des lignes dont results n'a pas été lu rendent le total « — »", () => {
  const lignes = [
    ligne({ date: "2026-09-28", resultats: resultatsDe(rendu(LPV, "10")) }),
    ligne({ date: "2026-09-29", annonceId: "a2", resultats: null }),
  ];
  const m = metrique(lignes, "resultats");
  assert.equal(m.valeur, null);
  assert.match(m.precision ?? "", /pas été lu/);
  // La courbe ne trace pas une série que le total refuse d'écrire.
  assert.ok(m.serie.every((v) => v === null));
});

test("l'écart ne compare pas deux types différents", () => {
  const lignes = [
    ligne({ date: "2026-09-21", resultats: resultatsDe(rendu(CLIC_LIEN, "10")) }),
    ligne({ date: "2026-09-28", resultats: resultatsDe(rendu(LPV, "20")) }),
  ];
  const m = metrique(lignes, "resultats");
  assert.equal(m.valeur, 20);
  assert.equal(m.ecart, null);
  assert.ok(m.serieAvant.every((v) => v === null));
});

test("même type des deux côtés : l'écart se calcule", () => {
  const lignes = [
    ligne({ date: "2026-09-21", resultats: resultatsDe(rendu(LPV, "10")) }),
    ligne({ date: "2026-09-28", resultats: resultatsDe(rendu(LPV, "20")) }),
  ];
  assert.equal(metrique(lignes, "resultats").ecart, 100);
});

// ── L'attribution ────────────────────────────────────────────────────────────

test("l'info-bulle dit le réglage d'attribution", () => {
  const m = metrique([ligne({ date: "2026-09-28", resultats: resultatsDe(rendu(LPV, "3")) })], "resultats");
  assert.match(m.aide, /7 jours après un clic ou 1 jour après un affichage/);
  assert.equal(m.attention, null);
});

test("une sélection qui mélange deux réglages l'écrit à l'endroit du chiffre", () => {
  const lignes = [
    ligne({ date: "2026-09-28", resultats: resultatsDe(rendu(LPV, "3")) }),
    ligne({ date: "2026-09-28", annonceId: "a2", attribution: "1d_click", resultats: resultatsDe(rendu(LPV, "4")) }),
  ];
  const m = metrique(lignes, "resultats");
  assert.match(m.attention ?? "", /1 jour après un clic/);
  assert.match(m.attention ?? "", /7 jours après un clic ou 1 jour après un affichage/);
});

// ── Toutes les campagnes restent présentes ───────────────────────────────────

test("la vue Conversion n'écarte aucune campagne, même sans résultat", () => {
  const lignes = [
    ligne({ date: "2026-09-28", resultats: resultatsDe(rendu(LPV, "10")) }),
    ligne({ date: "2026-09-28", campagneId: "c2", campagneNom: "Notoriété", groupeId: "g2", annonceId: "a2", impressions: 100, resultats: [] }),
  ];
  const p = contenuPage(lignes, VUE, CTX);
  assert.deepEqual(p.campagnes.map((c) => c.cle).sort(), ["c1", "c2"]);
  assert.deepEqual(tableauDe(lignes, VUE, CTX).lignes.map((l) => l.id).sort(), ["c1", "c2"]);
});

// ── Le Tableau et son export ─────────────────────────────────────────────────

test("le Tableau : la campagne mélangée « — », chaque groupe son type", () => {
  const lignes = [
    ligne({ date: "2026-09-28", groupeId: "gA", annonceId: "a1", resultats: resultatsDe(rendu(LPV, "10")) }),
    ligne({ date: "2026-09-28", groupeId: "gB", annonceId: "a2", resultats: resultatsDe(rendu(CLIC_LIEN, "5")) }),
  ];
  const [campagne] = tableauDe(lignes, VUE, CTX).lignes;
  assert.equal(campagne.valeurs[0], null);
  assert.match(campagne.pourquoi ?? "", /ne s'additionnent pas/);
  const types = Object.fromEntries(campagne.enfants.map((g) => [g.id, [g.valeurs[0], g.typeResultat]]));
  assert.deepEqual(types, { gA: [10, "vues de page de destination"], gB: [5, "clics sur un lien"] });
});

test("le CSV porte le type avec le nombre, et « — » reste « — »", () => {
  const lignes = [
    ligne({ date: "2026-09-28", groupeId: "gA", annonceId: "a1", resultats: resultatsDe(rendu(LPV, "10")) }),
    ligne({ date: "2026-09-28", groupeId: "gB", annonceId: "a2", resultats: resultatsDe(rendu(CLIC_LIEN, "5")) }),
  ];
  const [entete, campagne, ...reste] = csvDuTableau(tableauDe(lignes, VUE, CTX))
    .trimEnd()
    .split("\r\n")
    .map((l) => l.split(";"));
  const col = entete.indexOf("Type de résultat");
  assert.ok(col >= 0);
  const res = entete.indexOf("Résultats");
  assert.equal(campagne[res], "—");
  assert.ok(reste.some((r) => r[res] === "10" && r[col] === "vues de page de destination"));
});

test("le CSV des autres vues n'a pas de colonne de type", () => {
  const csv = csvDuTableau(tableauDe([ligne({ date: "2026-09-28", impressions: 5 })], { vue: "trafic" }, CTX));
  assert.ok(!csv.split("\r\n")[0].includes("Type de résultat"));
});
