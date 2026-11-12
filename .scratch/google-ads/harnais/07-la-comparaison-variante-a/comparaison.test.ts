// Harnais du ticket 07 de la construction Google Ads — la Comparaison,
// variante A (`lib/google/comparaison.ts`).
// Lancer : sh .scratch/google-ads/harnais/07-la-comparaison-variante-a/lancer.sh
//
// Valeurs attendues calculées à la main (spec, § « Comparaison — la
// mécanique »). Contexte figé : lundi 2026-10-05 est le dernier Jour de
// travail → semaine mesurée 28 sept.–4 oct., période d'avant 21–27 sept.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { LigneGoogle } from "@/lib/google/lecture";
import type { LigneAnnonceGoogle, LigneGroupeElementsGoogle } from "@/lib/google/tableau";
import { basculerCoche, choixMetrique, comparaisonDe, placesVersUrl, type SourcesComparaison } from "@/lib/google/comparaison";

const CTX = { aujourdhui: "2026-10-05", dernierJourDeTravail: "2026-10-05" };

function campagne(sur: Partial<LigneGoogle> = {}): LigneGoogle {
  return {
    date: "2026-09-28",
    campagneId: "111",
    campagneNom: "Search marque",
    typeCampagne: "SEARCH",
    cout: 100,
    impressions: 1000,
    clics: 50,
    conversions: 5,
    valeurConversion: null,
    ...sur,
  };
}
const SEARCH = (sur: Partial<LigneGoogle> = {}) => campagne(sur);
const PMAX = (sur: Partial<LigneGoogle> = {}) =>
  campagne({ campagneId: "222", campagneNom: "PMax été", typeCampagne: "PERFORMANCE_MAX", cout: 300, impressions: 9000, clics: 90, ...sur });

function annonce(sur: Partial<LigneAnnonceGoogle> = {}): LigneAnnonceGoogle {
  return {
    ...campagne({ typeCampagne: null }),
    groupeId: "g1",
    groupeNom: "Groupe marque",
    annonceId: "a1",
    annonceNom: "RSA marque",
    cout: 60,
    impressions: 600,
    clics: 30,
    conversions: 3,
    ...sur,
  };
}

function groupeElements(sur: Partial<LigneGroupeElementsGoogle> = {}): LigneGroupeElementsGoogle {
  return {
    date: "2026-09-28",
    campagneId: "222",
    groupeId: "9001",
    groupeNom: "Plage",
    cout: 200,
    impressions: 6000,
    clics: 60,
    conversions: 2,
    valeurConversion: 400,
    ...sur,
  };
}

/** Un compte Search + PMax, une ligne de chaque niveau. */
function compte(sur: Partial<SourcesComparaison> = {}): SourcesComparaison {
  return {
    campagnes: [SEARCH(), PMAX()],
    annonces: [annonce()],
    groupesElements: [groupeElements()],
    ...sur,
  };
}

// ── Les niveaux, par type ────────────────────────────────────────────────────

test("Tous : trois niveaux, Campagnes par défaut, types présents proposés dans l'ordre de l'écran", () => {
  const c = comparaisonDe(compte(), {}, CTX);
  assert.deepEqual(c.niveaux, ["campagnes", "groupes", "annonces"]);
  assert.equal(c.niveau, "campagnes");
  assert.equal(c.type, null);
  assert.deepEqual(c.types.map((t) => t.libelle), ["Search", "PMax"]);
  assert.deepEqual(c.elements.map((e) => e.nom), ["PMax été", "Search marque"]);
});

test("PMax seul : « Annonces » disparaît, un lien vers les annonces retombe sur les groupes", () => {
  const c = comparaisonDe(compte(), { type: "pmax", niveau: "annonces" }, CTX);
  assert.equal(c.type, "pmax");
  assert.deepEqual(c.niveaux, ["campagnes", "groupes"]);
  assert.equal(c.niveau, "groupes");
  assert.deepEqual(c.elements.map((e) => e.nom), ["Plage"]);
});

test("Un compte qui n'a que du PMax : pas d'« Annonces » même sur « Tous »", () => {
  const c = comparaisonDe(compte({ campagnes: [PMAX()], annonces: [] }), {}, CTX);
  assert.deepEqual(c.niveaux, ["campagnes", "groupes"]);
});

test("Search seul : trois niveaux, aucun élément PMax", () => {
  const c = comparaisonDe(compte(), { type: "search", niveau: "groupes" }, CTX);
  assert.deepEqual(c.niveaux, ["campagnes", "groupes", "annonces"]);
  assert.deepEqual(c.elements.map((e) => e.nom), ["Groupe marque"]);
});

test("Groupes sur « Tous » : groupes d'annonces et groupes d'éléments ensemble, chacun avec son type", () => {
  const c = comparaisonDe(compte(), { niveau: "groupes" }, CTX);
  const parNom = Object.fromEntries(c.elements.map((e) => [e.nom, e]));
  assert.equal(parNom["Plage"].niveau, "groupe_elements");
  assert.equal(parNom["Plage"].type?.libelle, "PMax");
  assert.equal(parNom["Groupe marque"].niveau, "groupe");
  assert.equal(parNom["Groupe marque"].type?.libelle, "Search");
});

test("Annonces sur « Tous » avec du PMax : la phrase le dit ; sans PMax, rien à dire", () => {
  assert.equal(comparaisonDe(compte(), { niveau: "annonces" }, CTX).pmaxSansAnnonces, true);
  assert.equal(comparaisonDe(compte({ campagnes: [SEARCH()] }), { niveau: "annonces" }, CTX).pmaxSansAnnonces, false);
  assert.equal(comparaisonDe(compte(), { niveau: "groupes" }, CTX).pmaxSansAnnonces, false);
});

test("Un type absent de la période retombe sur « Tous »", () => {
  const c = comparaisonDe(compte(), { type: "display" }, CTX);
  assert.equal(c.type, null);
  assert.equal(c.elements.length, 2);
});

test("Une campagne choisie au Bandeau : son type s'impose, le niveau Campagnes disparaît", () => {
  const c = comparaisonDe(compte(), { campagne: "111" }, CTX);
  assert.equal(c.typeImpose, true);
  assert.deepEqual(c.niveaux, ["groupes", "annonces"]);
  assert.equal(c.niveau, "groupes");
  assert.deepEqual(c.elements.map((e) => e.nom), ["Groupe marque"]);
});

// ── Les métriques : classement et échange ────────────────────────────────────

/** Trois campagnes Search : A 1 000 impr. pour 10 CHF (CPM 10), B 4 000 pour
 *  20 (CPM 5), C 0 impression (CPM « — »). */
const TROIS = [
  SEARCH({ campagneId: "A", campagneNom: "A", impressions: 1000, cout: 10 }),
  SEARCH({ campagneId: "B", campagneNom: "B", impressions: 4000, cout: 20 }),
  SEARCH({ campagneId: "C", campagneNom: "C", impressions: 0, clics: 0, cout: 5 }),
];

test("La première métrique classe la liste, décroissante ; « — » en bas", () => {
  const c = comparaisonDe(compte({ campagnes: TROIS }), {}, CTX);
  assert.deepEqual(c.metriques, ["impressions", "cpm"]);
  assert.deepEqual(c.elements.map((e) => e.nom), ["B", "A", "C"]);
});

test("Un coût en première métrique classe croissant, « — » toujours en bas avec sa raison", () => {
  const c = comparaisonDe(compte({ campagnes: TROIS }), { m1: "cpm", m2: "impressions" }, CTX);
  assert.deepEqual(c.elements.map((e) => e.nom), ["B", "A", "C"]);
  assert.deepEqual(c.elements.map((e) => e.valeurs[0]), [5, 10, null]);
  assert.match(c.elements[2].raisons[0]!, /diviseur/);
});

test("Choisir pour l'une la métrique de l'autre les échange", () => {
  assert.deepEqual(choixMetrique(["impressions", "cpm"], 0, "cpm"), { m1: "cpm", m2: "impressions" });
  assert.deepEqual(choixMetrique(["clics", "ctr"], 1, "clics"), { m1: "ctr", m2: "clics" });
  assert.deepEqual(choixMetrique(["clics", "ctr"], 1, "cpc"), { m1: "clics", m2: "cpc" });
});

test("Les métriques se prennent dans la vue ; une métrique d'une autre vue est ignorée", () => {
  const c = comparaisonDe(compte(), { vue: "trafic", m1: "impressions", m2: "cpc" }, CTX);
  assert.deepEqual(c.offertes, ["clics", "ctr", "cpc"]);
  assert.deepEqual(c.metriques, ["clics", "cpc"]);
});

test("Chaque cochée porte une série par métrique : les deux graphes côte à côte", () => {
  const c = comparaisonDe(compte(), {}, CTX);
  assert.ok(c.coches.length > 0);
  for (const s of c.coches) assert.equal(s.series.length, 2);
});

// ── Les cases : sans plafond, pré-cochage, « Tout cocher » ───────────────────
// (David, 2026-11-12 : « pas que ce soit maximum 5 ».)

const CINQ = ["A", "B", "C", "D", "E"].map((x, i) => SEARCH({ campagneId: x, campagneNom: x, impressions: 1000 * (5 - i) }));
const DOUZE = Array.from({ length: 12 }, (_, i) => SEARCH({ campagneId: `K${i}`, campagneNom: `K${i}`, impressions: 1000 * (12 - i) }));

test("Sans `comparer`, les trois premières sont pré-cochées, dans l'ordre de la liste", () => {
  const c = comparaisonDe(compte({ campagnes: CINQ }), {}, CTX);
  assert.deepEqual(c.places, ["A", "B", "C"]);
  assert.deepEqual(c.coches.map((s) => s.couleur), ["#2a78d6", "#eb6834", "#1baf7a"]);
});

test("`comparer=-` : rien de coché, exprès", () => {
  const c = comparaisonDe(compte({ campagnes: CINQ }), { comparer: ["-"] }, CTX);
  assert.equal(c.coches.length, 0);
});

test("Aucun plafond : la cinquième case se coche à la suite", () => {
  const c = comparaisonDe(compte({ campagnes: CINQ }), { comparer: ["A", "B", "C", "D"] }, CTX);
  assert.equal(c.coches.length, 4);
  assert.deepEqual(basculerCoche(c.places, "E"), ["A", "B", "C", "D", "E"]);
  assert.equal(comparaisonDe(compte({ campagnes: CINQ }), { comparer: ["A", "B", "C", "D", "E"] }, CTX).coches.length, 5);
  // Décocher la première libère SA place : les autres gardent leur couleur.
  const sans = basculerCoche(c.places, "A");
  assert.deepEqual(placesVersUrl(sans), ["-", "B", "C", "D"]);
  assert.deepEqual(basculerCoche(sans, "E"), ["E", "B", "C", "D"]);
});

test("`comparer=*` coche toute la liste, dans son ordre", () => {
  const c = comparaisonDe(compte({ campagnes: DOUZE }), { comparer: ["*"] }, CTX);
  assert.equal(c.coches.length, 12);
  assert.deepEqual(c.places, DOUZE.map((l) => l.campagneId));
  assert.ok(c.elements.every((e) => e.place !== null));
});

test("Au-delà de huit cochées, les teintes reviennent dans l'ordre des places", () => {
  const c = comparaisonDe(compte({ campagnes: DOUZE }), { comparer: ["*"] }, CTX);
  assert.equal(c.coches[8].couleur, c.coches[0].couleur);
  assert.equal(new Set(c.coches.slice(0, 8).map((s) => s.couleur)).size, 8);
});

test("Un `comparer` d'un autre niveau ne désigne rien : sa place se libère", () => {
  // Les liens de type et de niveau retirent `comparer` (pré-cochage) ; une URL
  // qui le garderait quand même ne coche pas un élément d'un autre niveau.
  const c = comparaisonDe(compte(), { niveau: "groupes", comparer: ["111"] }, CTX);
  assert.deepEqual(c.places, [null]);
  assert.equal(c.coches.length, 0);
});

// ── L'identité, les manques ──────────────────────────────────────────────────

test("Deux annonces de même nom restent deux lignes, rattachées par leur ID", () => {
  const c = comparaisonDe(
    compte({ annonces: [annonce({ annonceId: "a1" }), annonce({ annonceId: "a2" }), annonce({ annonceId: null })] }),
    { niveau: "annonces" },
    CTX
  );
  assert.deepEqual(c.elements.map((e) => e.annonceId).sort(), ["a1", "a2"]);
  assert.equal(c.elements[0].sous, "Search marque › Groupe marque");
});

test("Un Groupe d'éléments à compteur manquant : « — » et un trou ce jour-là, jamais un zéro", () => {
  const c = comparaisonDe(
    compte({ groupesElements: [groupeElements(), groupeElements({ date: "2026-09-29", clics: null })] }),
    { type: "pmax", niveau: "groupes" },
    CTX
  );
  const e = c.elements[0];
  assert.deepEqual(e.valeurs, [null, null]);
  assert.equal(e.cout, null);
  assert.match(e.raisons[0]!, /pas rendu/);
  assert.deepEqual(c.coches[0].series[0].slice(0, 3), [6000, null, null]);
});

test("Le jour en cours n'entre pas : la série couvre la période, un jour sans ligne est un trou", () => {
  const c = comparaisonDe(
    compte({ campagnes: [SEARCH(), SEARCH({ date: "2026-10-01", impressions: 500 }), SEARCH({ date: "2026-10-05", impressions: 99999 })] }),
    { from: "2026-09-28", to: "2026-10-05" },
    CTX
  );
  assert.equal(c.elements[0].valeurs[0], 1500);
  assert.deepEqual(c.coches[0].series[0], [1000, null, null, 500, null, null, null]);
});

test("Valeur de conversion : « — » au groupe d'annonces avec sa raison", () => {
  const c = comparaisonDe(compte(), { vue: "conversion", niveau: "groupes", m1: "valeur_conversion", m2: "conversions" }, CTX);
  const parNom = Object.fromEntries(c.elements.map((e) => [e.nom, e]));
  assert.equal(parNom["Groupe marque"].valeurs[0], null);
  assert.match(parNom["Groupe marque"].raisons[0]!, /niveau campagne/);
  assert.equal(parNom["Plage"].valeurs[1], 2);
});
