// Harnais du ticket 08 — la Comparaison.
//
// Seam : « lignes de base + commandes → contenu des modules », par
// `contenuPage` (le même que les harnais 06 et 07), plus les fonctions pures
// d'un clic (`basculerCoche`, `choixMetrique`, `placesVersUrl`) et le lien qui
// les écrit. Lancer depuis la racine du dépôt :
//
//     node --test .scratch/meta-ads/harnais/08-la-comparaison/comparaison.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  basculerCoche,
  choixMetrique,
  contenuPage,
  placesDe,
  placesVersUrl,
  type Commandes,
  type LigneMeta,
} from "../../../../saas/web/lib/meta/lecture.ts";
import { lienMeta } from "../../../../saas/web/lib/meta/liens.ts";

// Lundi 5 octobre 2026 : la semaine mesurée va du 28 septembre au 4 octobre.
const CTX = { aujourdhui: "2026-10-05", dernierJourDeTravail: "2026-10-05" };
const JOUR = "2026-09-30";

function ligne(p: Partial<LigneMeta>): LigneMeta {
  return {
    date: JOUR,
    campagneId: "c1",
    campagneNom: "Soldes",
    groupeId: "g1",
    groupeNom: "Acheteurs",
    annonceId: "a1",
    annonceNom: "Carrousel",
    depense: 0,
    impressions: 0,
    clics: 0,
    ...p,
  };
}

const comparer = (lignes: LigneMeta[], cmd: Commandes = {}) => contenuPage(lignes, cmd, CTX).comparaison;
const cles = (lignes: LigneMeta[], cmd: Commandes = {}) => comparer(lignes, cmd).elements.map((e) => e.cle);

// ── Le niveau ────────────────────────────────────────────────────────────────

test("par défaut, la Comparaison est au niveau des annonces", () => {
  const c = comparer([ligne({ annonceId: "a1" }), ligne({ annonceId: "a2" })]);
  assert.equal(c.niveau, "annonces");
  assert.deepEqual(c.elements.map((e) => e.cle).sort(), ["a1", "a2"]);
});

test("au niveau des groupes, les annonces d'un groupe s'additionnent en une ligne", () => {
  const c = comparer(
    [
      ligne({ groupeId: "g1", annonceId: "a1", impressions: 100 }),
      ligne({ groupeId: "g1", annonceId: "a2", impressions: 50 }),
      ligne({ groupeId: "g2", groupeNom: "Visiteurs", annonceId: "a3", impressions: 10 }),
    ],
    { niveau: "groupes" }
  );
  assert.deepEqual(
    c.elements.map((e) => [e.cle, e.valeurs[0]]),
    [["g1", 150], ["g2", 10]]
  );
  assert.equal(c.elements[0].annonceId, null, "un groupe n'a pas de vignette");
});

test("le CPC d'un groupe est recalculé total ÷ total, pas la moyenne des annonces", () => {
  const c2 = comparer(
    [
      ligne({ annonceId: "a1", depense: 10, clics: 10 }),
      ligne({ annonceId: "a2", depense: 90, clics: 30 }),
    ],
    { niveau: "groupes", vue: "trafic", m1: "cpc" }
  );
  assert.equal(c2.elements[0].valeurs[0], 2.5); // 100 ÷ 40 ; la moyenne dirait 2
});

// ── Le classement ────────────────────────────────────────────────────────────

test("classé par la métrique 1, du plus haut au plus bas", () => {
  const l = [
    ligne({ annonceId: "a1", impressions: 10 }),
    ligne({ annonceId: "a2", impressions: 300 }),
    ligne({ annonceId: "a3", impressions: 50 }),
  ];
  assert.deepEqual(cles(l), ["a2", "a3", "a1"]);
});

test("un coût se classe du moins cher au plus cher", () => {
  const l = [
    ligne({ annonceId: "a1", depense: 30, clics: 10 }), // 3
    ligne({ annonceId: "a2", depense: 10, clics: 10 }), // 1
    ligne({ annonceId: "a3", depense: 20, clics: 10 }), // 2
  ];
  assert.deepEqual(cles(l, { vue: "trafic", m1: "cpc" }), ["a2", "a3", "a1"]);
});

test("l'élément sans valeur pour la métrique de classement se range en bas, avec « — » et non 0", () => {
  const l = [
    ligne({ annonceId: "sans-clic", annonceNom: "A", depense: 5, clics: 0 }), // CPC : diviseur nul
    ligne({ annonceId: "cher", annonceNom: "B", depense: 90, clics: 10 }),
    ligne({ annonceId: "pas-cher", annonceNom: "C", depense: 10, clics: 10 }),
  ];
  const c = comparer(l, { vue: "trafic", m1: "cpc" });
  assert.deepEqual(c.elements.map((e) => e.cle), ["pas-cher", "cher", "sans-clic"]);
  assert.equal(c.elements[2].valeurs[0], null);
  // Et en tri décroissant aussi : « — » ne monte pas en tête.
  const c2 = comparer(l, { vue: "trafic", m1: "ctr" }); // 0 impression partout → CTR « — »
  assert.ok(c2.elements.every((e) => e.valeurs[0] === null));
});

test("un vrai zéro reste classé comme un zéro, au-dessus de « — »", () => {
  const l = [
    ligne({ annonceId: "zero", depense: 0, clics: 0, impressions: 100 }), // CTR = 0 %
    ligne({ annonceId: "rien", depense: 0, clics: 0, impressions: 0 }), // CTR = —
    ligne({ annonceId: "bon", clics: 5, impressions: 100 }),
  ];
  const c = comparer(l, { vue: "trafic", m1: "ctr" });
  assert.deepEqual(c.elements.map((e) => [e.cle, e.valeurs[0]]), [["bon", 5], ["zero", 0], ["rien", null]]);
});

test("seules les lignes de la période comptent ; la période d'avant et le jour en cours n'entrent pas", () => {
  const l = [
    ligne({ annonceId: "a1", impressions: 10 }),
    ligne({ annonceId: "avant", date: "2026-09-22", impressions: 999 }),
    ligne({ annonceId: "a1", date: "2026-10-05", impressions: 999 }),
  ];
  const c = comparer(l, { from: "2026-09-28", to: "2026-10-05" });
  assert.deepEqual(c.elements.map((e) => [e.cle, e.valeurs[0]]), [["a1", 10]]);
});

test("le filtre campagne du Bandeau resserre la Comparaison", () => {
  const l = [ligne({ annonceId: "a1" }), ligne({ campagneId: "c2", annonceId: "a2" })];
  assert.deepEqual(cles(l, { campagne: "c2" }), ["a2"]);
});

// ── L'identité ───────────────────────────────────────────────────────────────

test("deux annonces homonymes restent deux lignes, chacune avec ses chiffres", () => {
  const c = comparer([
    ligne({ annonceId: "a1", annonceNom: "Promo", impressions: 100 }),
    ligne({ annonceId: "a2", annonceNom: "Promo", impressions: 7 }),
  ]);
  assert.deepEqual(c.elements.map((e) => [e.cle, e.nom, e.valeurs[0]]), [["a1", "Promo", 100], ["a2", "Promo", 7]]);
  // Et deux séries distinctes une fois cochées.
  assert.equal(c.coches.length, 2);
  assert.deepEqual(c.coches.map((s) => s.series[0][2]), [100, 7]);
});

test("une annonce renommée reste une ligne, sous son nom le plus récent", () => {
  const c = comparer([
    ligne({ annonceId: "a1", annonceNom: "Ancien", date: "2026-09-28", impressions: 1 }),
    ligne({ annonceId: "a1", annonceNom: "Nouveau", date: "2026-10-01", impressions: 2 }),
  ]);
  assert.deepEqual(c.elements.map((e) => [e.nom, e.valeurs[0]]), [["Nouveau", 3]]);
});

test("une ligne sans ID n'est jamais rattachée par son nom à une annonce identifiée", () => {
  const c = comparer([
    ligne({ annonceId: "a1", annonceNom: "Promo", impressions: 100 }),
    ligne({ annonceId: null, annonceNom: "Promo", impressions: 5 }),
  ]);
  assert.equal(c.elements.length, 2);
  assert.ok(c.elements.some((e) => e.cle.startsWith("sans-id:") && e.valeurs[0] === 5));
});

// ── Les cases ────────────────────────────────────────────────────────────────

test("sans paramètre, les trois premiers du classement sont cochés", () => {
  const l = ["a1", "a2", "a3", "a4"].map((id, i) => ligne({ annonceId: id, impressions: 100 - i }));
  const c = comparer(l);
  assert.deepEqual(c.places, ["a1", "a2", "a3"]);
  assert.deepEqual(c.coches.map((s) => s.cle), ["a1", "a2", "a3"]);
});

test("« comparer=- » seul veut dire rien de coché, exprès", () => {
  const c = comparer([ligne({ annonceId: "a1" })], { comparer: ["-"] });
  assert.equal(c.coches.length, 0);
});

test("la cinquième case est refusée, et aucune autre n'est décochée", () => {
  const places = ["a1", "a2", "a3", "a4"];
  assert.equal(basculerCoche(places, "a5"), "refus");
  assert.deepEqual(places, ["a1", "a2", "a3", "a4"]);
});

test("décocher libère une place sans repeindre les autres ; la suivante cochée la reprend", () => {
  const apres = basculerCoche(["a1", "a2", "a3"], "a1");
  assert.deepEqual(apres, [null, "a2", "a3"]);
  assert.deepEqual(basculerCoche(apres as (string | null)[], "a9"), ["a9", "a2", "a3"]);
  const c = comparer(
    ["a1", "a2", "a3"].map((id) => ligne({ annonceId: id })),
    { comparer: placesVersUrl(apres as (string | null)[]) }
  );
  assert.deepEqual(c.coches.map((s) => [s.cle, s.couleur]), [["a2", "#eb6834"], ["a3", "#1baf7a"]]);
});

test("ce que le lien écrit : les places vides de fin tombent, le vide total s'écrit « - »", () => {
  assert.deepEqual(placesVersUrl([null, "a2", null, null]), ["-", "a2"]);
  assert.deepEqual(placesVersUrl([null, null]), ["-"]);
});

test("une clé inconnue ou répétée dans l'URL ne prend pas de place, au-delà de quatre rien n'est lu", () => {
  assert.deepEqual(placesDe(["a1", "a1", "-", "a2", "a3"]), ["a1", null, null, "a2"]);
  const c = comparer([ligne({ annonceId: "a1" }), ligne({ annonceId: "a2" })], { comparer: ["fantome", "a2"] });
  assert.deepEqual(c.places, [null, "a2"]);
  assert.equal(c.coches[0].couleur, "#eb6834", "a2 garde la couleur de sa place");
});

test("une série cochée a un trou, pas un zéro, le jour où l'élément n'a pas tourné", () => {
  const c = comparer([ligne({ annonceId: "a1", date: "2026-09-28", impressions: 4 })]);
  assert.deepEqual(c.coches[0].series[0], [4, null, null, null, null, null, null]);
});

// ── Les métriques ────────────────────────────────────────────────────────────

test("par défaut, les deux premières métriques de la vue", () => {
  assert.deepEqual(comparer([ligne({})]).metriques, ["impressions", "cpm"]);
  assert.deepEqual(comparer([ligne({})], { vue: "trafic" }).metriques, ["clics", "ctr"]);
});

test("choisir pour une métrique celle de l'autre les échange", () => {
  assert.deepEqual(choixMetrique(["clics", "ctr"], 0, "ctr"), { m1: "ctr", m2: "clics" });
  assert.deepEqual(choixMetrique(["clics", "ctr"], 1, "clics"), { m1: "ctr", m2: "clics" });
  assert.deepEqual(choixMetrique(["clics", "ctr"], 1, "cpc"), { m1: "clics", m2: "cpc" });
});

test("deux métriques identiques ou d'une autre vue dans l'URL ne passent pas", () => {
  assert.deepEqual(comparer([ligne({})], { vue: "trafic", m1: "cpc", m2: "cpc" }).metriques, ["cpc", "clics"]);
  assert.deepEqual(comparer([ligne({})], { vue: "trafic", m1: "cpm" }).metriques, ["clics", "ctr"]);
});

// ── L'URL ────────────────────────────────────────────────────────────────────

test("cocher écrit les places répétées et garde tout le reste du lien", () => {
  const lien = lienMeta({ vue: "trafic", campagne: "c1", from: "2026-09-01", comparer: ["a1"] }, { comparer: ["-", "a2"] });
  const q = new URLSearchParams(lien.split("?")[1]);
  assert.deepEqual(q.getAll("comparer"), ["-", "a2"]);
  assert.equal(q.get("vue"), "trafic");
  assert.equal(q.get("campagne"), "c1");
  assert.equal(q.get("from"), "2026-09-01");
});

test("changer de niveau repart du pré-cochage, et « annonces » (le défaut) ne s'écrit pas", () => {
  assert.equal(lienMeta({ niveau: "groupes", comparer: ["g1", "g2"] }, { niveau: "annonces", comparer: null }), "/meta");
  assert.equal(lienMeta({}, { niveau: "groupes", comparer: null }), "/meta?niveau=groupes");
});

test("l'aller-retour URL → contenu rouvre le même niveau, les mêmes métriques et les mêmes cases", () => {
  const lignes = ["g1", "g2"].map((g) => ligne({ groupeId: g, annonceId: `a-${g}` }));
  const lien = lienMeta({}, { niveau: "groupes", m1: "cpm", m2: "impressions", comparer: ["-", "g2"] });
  const q = new URLSearchParams(lien.split("?")[1]);
  const c = comparer(lignes, { niveau: q.get("niveau")!, m1: q.get("m1")!, m2: q.get("m2")!, comparer: q.getAll("comparer") });
  assert.equal(c.niveau, "groupes");
  assert.deepEqual(c.metriques, ["cpm", "impressions"]);
  assert.deepEqual(c.places, [null, "g2"]);
});
