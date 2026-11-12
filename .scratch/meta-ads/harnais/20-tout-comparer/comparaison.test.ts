// Harnais de « tout comparer » (David, 2026-11-12) — la Comparaison Meta sans
// plafond, avec « Tout cocher » et le niveau Campagnes (`lib/meta/lecture.ts`,
// `lib/meta/changements.ts`).
// Lancer : sh .scratch/meta-ads/harnais/20-tout-comparer/lancer.sh
//
// Contexte figé : lundi 2026-10-05 est le dernier Jour de travail → semaine
// mesurée 28 sept.–4 oct.
import { test } from "node:test";
import assert from "node:assert/strict";
import { basculerCoche, comparaisonDe, periodeDe, placesVersUrl, type LigneMeta } from "@/lib/meta/lecture";
import { elementOuvertDe, marquesElement, valeurElement, type ChangementMeta } from "@/lib/meta/changements";

const CTX = { aujourdhui: "2026-10-05", dernierJourDeTravail: "2026-10-05" };
const PERIODE = periodeDe({}, CTX);

function ligne(sur: Partial<LigneMeta> = {}): LigneMeta {
  return {
    date: "2026-09-28",
    campagneId: "c1",
    campagneNom: "Campagne 1",
    groupeId: "g1",
    groupeNom: "Groupe 1",
    annonceId: "a1",
    annonceNom: "Annonce 1",
    depense: 10,
    impressions: 1000,
    clics: 10,
    resultats: null,
    attribution: null,
    ...sur,
  };
}

/** Douze annonces, réparties dans trois campagnes (c0, c1, c2) d'un groupe chacune. */
const DOUZE = Array.from({ length: 12 }, (_, i) =>
  ligne({
    campagneId: `c${i % 3}`,
    campagneNom: `Campagne ${i % 3}`,
    groupeId: `g${i % 3}`,
    groupeNom: `Groupe ${i % 3}`,
    annonceId: `a${i}`,
    annonceNom: `Annonce ${i}`,
    depense: 100 - i,
  })
);

test("Trois niveaux offerts, Annonces par défaut", () => {
  const c = comparaisonDe(DOUZE, PERIODE, "couts", {});
  assert.deepEqual(c.niveaux, ["campagnes", "groupes", "annonces"]);
  assert.equal(c.niveau, "annonces");
  assert.equal(c.elements.length, 12);
});

test("Niveau Campagnes : une ligne par campagne, par son ID, sans « sous »", () => {
  const c = comparaisonDe(DOUZE, PERIODE, "couts", { niveau: "campagnes" });
  assert.equal(c.niveau, "campagnes");
  assert.deepEqual(c.elements.map((e) => e.cle).sort(), ["c0", "c1", "c2"]);
  assert.ok(c.elements.every((e) => e.sous === "" && e.annonceId === null));
  // La dépense d'une campagne est la somme de ses quatre annonces.
  const c0 = c.elements.find((e) => e.cle === "c0")!;
  assert.equal(c0.depense, 100 + 97 + 94 + 91);
});

test("Une campagne choisie au Bandeau : pas de niveau Campagnes, retombe sur ses groupes", () => {
  const c = comparaisonDe(DOUZE.filter((l) => l.campagneId === "c0"), PERIODE, "couts", { campagne: "c0", niveau: "campagnes" });
  assert.deepEqual(c.niveaux, ["groupes", "annonces"]);
  assert.equal(c.niveau, "groupes");
});

test("Un groupe choisi impose toujours les annonces", () => {
  const c = comparaisonDe(DOUZE, PERIODE, "couts", { groupe: "g0", niveau: "campagnes" });
  assert.equal(c.niveau, "annonces");
});

test("Toutes les métriques se comparent, pas seulement celles de la vue (CTR × impressions en vue Coûts)", () => {
  assert.deepEqual(comparaisonDe(DOUZE, PERIODE, "couts", { m1: "ctr", m2: "impressions" }).metriques, ["ctr", "impressions"]);
});

test("Sans `comparer`, trois pré-cochées", () => {
  assert.equal(comparaisonDe(DOUZE, PERIODE, "couts", {}).coches.length, 3);
});

test("Aucun plafond : cinq, puis douze cases cochées une à une", () => {
  const cinq = ["a0", "a1", "a2", "a3", "a4"];
  assert.equal(comparaisonDe(DOUZE, PERIODE, "couts", { comparer: cinq }).coches.length, 5);
  let places: (string | null)[] = [];
  for (const l of DOUZE) places = basculerCoche(places, l.annonceId!);
  assert.equal(comparaisonDe(DOUZE, PERIODE, "couts", { comparer: placesVersUrl(places) }).coches.length, 12);
});

test("`comparer=*` coche toute la liste, dans son ordre ; « Tout décocher » écrit `-`", () => {
  const c = comparaisonDe(DOUZE, PERIODE, "couts", { comparer: ["*"] });
  assert.equal(c.coches.length, 12);
  assert.deepEqual(c.places, c.elements.map((e) => e.cle));
  assert.deepEqual(placesVersUrl([]), ["-"]);
  assert.equal(comparaisonDe(DOUZE, PERIODE, "couts", { comparer: ["-"] }).coches.length, 0);
});

test("Au-delà de huit cochées, les teintes reviennent dans l'ordre des places", () => {
  const c = comparaisonDe(DOUZE, PERIODE, "couts", { comparer: ["*"] });
  assert.equal(new Set(c.coches.slice(0, 8).map((s) => s.couleur)).size, 8);
  assert.equal(c.coches[8].couleur, c.coches[0].couleur);
});

test("Décocher libère SA place : les autres gardent leur couleur", () => {
  const c = comparaisonDe(DOUZE, PERIODE, "couts", { comparer: ["*"] });
  const sans = basculerCoche(c.places, c.places[0]!);
  const apres = comparaisonDe(DOUZE, PERIODE, "couts", { comparer: placesVersUrl(sans) });
  assert.equal(apres.coches.length, 11);
  assert.equal(apres.coches[0].couleur, c.coches[1].couleur);
});

test("Le journal : une ligne de campagne porte tout ce qui est posé sous elle", () => {
  const changement = (sur: Partial<ChangementMeta>) => ({ jour: "2026-09-30", campagneId: "c0", groupeId: null, niveau: "campagne", objetId: "c0", ...sur }) as ChangementMeta;
  const dates = ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"];
  const journal = [
    changement({}),
    changement({ jour: "2026-10-01", niveau: "annonce", objetId: "a0", groupeId: "g0" }),
    changement({ jour: "2026-10-02", campagneId: "c1", objetId: "c1" }),
  ];
  assert.deepEqual(marquesElement(journal, { niveau: "campagnes", cle: "c0" }, dates), [2, 3]);
  assert.deepEqual(elementOuvertDe(valeurElement({ niveau: "campagnes", cle: "c0" })), { niveau: "campagnes", cle: "c0" });
});
