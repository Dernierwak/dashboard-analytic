// Harnais du ticket 05 de la construction Google Ads — une campagne PMax se
// déplie en ses Groupes d'éléments, et rien en dessous (`lib/google/tableau.ts`).
// Lancer : sh .scratch/google-ads/harnais/05-les-groupes-d-elements-pmax/lancer.sh
//
// Valeurs attendues calculées à la main (spec, § « Tableau détaillé »).
// Contexte figé : lundi 2026-10-05 est le dernier Jour de travail → semaine
// mesurée 28 sept.–4 oct., période d'avant 21–27 sept.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { LigneGoogle } from "@/lib/google/lecture";
import {
  csvDuTableau,
  tableauDe,
  type LigneAnnonceGoogle,
  type LigneGroupeElementsGoogle,
  type LigneTableau,
} from "@/lib/google/tableau";
import { RAISON_SANS_VALEUR, type ActionConversion } from "@/lib/google/valeur";

const CTX = { aujourdhui: "2026-10-05", dernierJourDeTravail: "2026-10-05" };

function campagne(sur: Partial<LigneGoogle> = {}): LigneGoogle {
  return {
    date: "2026-09-28",
    campagneId: "222",
    campagneNom: "PMax été",
    typeCampagne: "PERFORMANCE_MAX",
    cout: 100,
    impressions: 4000,
    clics: 80,
    conversions: 8,
    valeurConversion: 800,
    ...sur,
  };
}

function groupe(sur: Partial<LigneGroupeElementsGoogle> = {}): LigneGroupeElementsGoogle {
  return {
    date: "2026-09-28",
    campagneId: "222",
    groupeId: "9001",
    groupeNom: "Plage",
    cout: 30,
    impressions: 1000,
    clics: 10,
    conversions: 2,
    valeurConversion: 200,
    ...sur,
  };
}

function annonce(sur: Partial<LigneAnnonceGoogle> = {}): LigneAnnonceGoogle {
  return {
    date: "2026-09-28",
    campagneId: "222",
    campagneNom: "PMax été",
    typeCampagne: null,
    groupeId: "g1",
    groupeNom: "Groupe d'annonces fantôme",
    annonceId: "a1",
    annonceNom: "Annonce fantôme",
    cout: 1,
    impressions: 1,
    clics: 1,
    conversions: 0,
    ...sur,
  };
}

const parNom = (lignes: LigneTableau[], nom: string) => lignes.find((l) => l.nom === nom)!;

// ── La profondeur ────────────────────────────────────────────────────────────

test("PMax : Campagne › Groupe d'éléments, et rien en dessous", () => {
  const t = tableauDe([campagne()], [], {}, CTX, undefined, [groupe(), groupe({ groupeId: "9002", groupeNom: "Montagne" })]);
  const c = t.lignes[0];
  assert.equal(c.sansDetail, null);
  assert.deepEqual(c.enfants.map((e) => e.niveau), ["groupe_elements", "groupe_elements"]);
  assert.deepEqual(c.enfants.map((e) => e.nom).sort(), ["Montagne", "Plage"]);
  assert.ok(c.enfants.every((e) => e.enfants.length === 0));
  assert.deepEqual(c.enfants.map((e) => e.id).sort(), ["9001", "9002"]);
});

test("PMax : une ligne d'annonce, s'il en arrivait une, ne fait pas une fausse annonce", () => {
  const t = tableauDe([campagne()], [annonce()], {}, CTX, undefined, [groupe()]);
  assert.deepEqual(t.lignes[0].enfants.map((e) => e.niveau), ["groupe_elements"]);
});

test("Search reste Campagne › Groupe d'annonces › Annonce, même avec des groupes d'éléments lus", () => {
  const t = tableauDe(
    [campagne({ campagneId: "111", campagneNom: "Search", typeCampagne: "SEARCH" })],
    [annonce({ campagneId: "111" })],
    {},
    CTX,
    undefined,
    [groupe()]
  );
  assert.equal(t.lignes[0].enfants[0].niveau, "groupe");
  assert.equal(t.lignes[0].enfants[0].enfants[0].niveau, "annonce");
});

// ── Le rattachement par l'ID ─────────────────────────────────────────────────

test("chaque groupe se rattache à SA campagne par l'ID", () => {
  const t = tableauDe(
    [campagne(), campagne({ campagneId: "333", campagneNom: "PMax hiver" })],
    [],
    {},
    CTX,
    undefined,
    [groupe(), groupe({ campagneId: "333", groupeId: "9100", groupeNom: "Ski" }), groupe({ campagneId: "999", groupeId: "9999", groupeNom: "Orphelin" })]
  );
  assert.deepEqual(parNom(t.lignes, "PMax été").enfants.map((e) => e.nom), ["Plage"]);
  assert.deepEqual(parNom(t.lignes, "PMax hiver").enfants.map((e) => e.nom), ["Ski"]);
  assert.ok(!JSON.stringify(t).includes("Orphelin"));
});

test("un groupe renommé reste une ligne, sous son nom le plus récent", () => {
  const t = tableauDe([campagne()], [], {}, CTX, undefined, [groupe(), groupe({ date: "2026-09-30", groupeNom: "Plage (neuf)" })]);
  assert.deepEqual(t.lignes[0].enfants.map((e) => e.nom), ["Plage (neuf)"]);
});

// ── Les chiffres ─────────────────────────────────────────────────────────────

test("chaque groupe recalcule ses taux ; la campagne garde les chiffres de google_ads_insights", () => {
  // Plage : 30 / 10 = 3 ; Montagne : 20 / 40 = 0,5. Campagne : 100 / 80 = 1,25,
  // pas la somme des groupes (50 / 50) — PMax a aussi de la dépense hors groupe.
  const t = tableauDe([campagne()], [], { vue: "trafic" }, CTX, undefined, [
    groupe(),
    groupe({ groupeId: "9002", groupeNom: "Montagne", cout: 20, clics: 40, impressions: 2000 }),
  ]);
  const c = t.lignes[0];
  assert.equal(c.valeurs[2], 1.25);
  assert.equal(parNom(c.enfants, "Plage").valeurs[2], 3);
  assert.equal(parNom(c.enfants, "Montagne").valeurs[2], 0.5);
  assert.equal(parNom(c.enfants, "Plage").valeurs[1], 1); // CTR = 10 / 1000 × 100
  assert.equal(t.total?.valeurs[0], 80);
});

test("un jour omis n'est pas un zéro : pas d'écart inventé contre une période d'avant sans ligne", () => {
  const t = tableauDe([campagne(), campagne({ date: "2026-09-21" })], [], {}, CTX, undefined, [groupe()]);
  assert.equal(t.lignes[0].enfants[0].ecart, null);
  assert.equal(t.lignes[0].enfants[0].valeurs[0], 1000);
});

test("écart d'un groupe contre la période d'avant", () => {
  const t = tableauDe([campagne(), campagne({ date: "2026-09-21" })], [], {}, CTX, undefined, [
    groupe({ impressions: 1500 }),
    groupe({ date: "2026-09-21", impressions: 1000 }),
  ]);
  assert.equal(t.lignes[0].enfants[0].ecart, 50);
});

test("un groupe vu seulement la période d'avant n'est pas une ligne", () => {
  const t = tableauDe([campagne(), campagne({ date: "2026-09-21" })], [], {}, CTX, undefined, [groupe({ date: "2026-09-21" })]);
  assert.equal(t.lignes[0].enfants.length, 0);
  assert.match(t.lignes[0].sansDetail ?? "", /groupe d'éléments/);
});

test("le jour en cours n'entre dans rien", () => {
  const t = tableauDe([campagne({ date: "2026-10-04" })], [], { from: "2026-09-28", to: "2026-10-05" }, CTX, undefined, [
    groupe({ date: "2026-10-04" }),
    groupe({ date: "2026-10-05", impressions: 99999 }),
  ]);
  assert.equal(t.lignes[0].enfants[0].valeurs[0], 1000);
});

test("un compteur que Google n'a pas rendu (NULL) n'est jamais compté pour zéro", () => {
  const t = tableauDe([campagne()], [], {}, CTX, undefined, [groupe(), groupe({ groupeId: "9002", groupeNom: "Montagne", impressions: null })]);
  assert.equal(t.lignes[0].enfants.length, 0);
  assert.match(t.lignes[0].sansDetail ?? "", /pas rendu tous les chiffres/);
});

test("le filtre de campagne du Bandeau s'applique aux groupes", () => {
  const t = tableauDe(
    [campagne(), campagne({ campagneId: "333", campagneNom: "PMax hiver" })],
    [],
    { campagne: "333" },
    CTX,
    undefined,
    [groupe(), groupe({ campagneId: "333", groupeId: "9100", groupeNom: "Ski" })]
  );
  assert.deepEqual(t.lignes.map((l) => l.nom), ["PMax hiver"]);
  assert.deepEqual(t.lignes[0].enfants.map((e) => e.nom), ["Ski"]);
});

// ── Ce que dit une campagne PMax sans groupe ─────────────────────────────────

test("table pas lue (null) : la raison le dit", () => {
  const t = tableauDe([campagne()], [], {}, CTX, undefined, null);
  assert.equal(t.lignes[0].enfants.length, 0);
  assert.match(t.lignes[0].sansDetail ?? "", /pas pu être lus/);
});

test("lue, mais aucun groupe pour cette campagne sur la période : la raison le dit", () => {
  const t = tableauDe([campagne()], [], {}, CTX, undefined, []);
  assert.match(t.lignes[0].sansDetail ?? "", /aucun groupe d'éléments/);
});

// ── La valeur de conversion ──────────────────────────────────────────────────

const VUE = { vue: "conversion" };
const VALEUR = 3;

test("la valeur d'un groupe se montre quand celle de sa campagne se montre", () => {
  const actions: ActionConversion[] = [{ id: "10", nom: "achat", toujoursDefaut: false, valeurDefaut: 1 }];
  const rep = { actions, parAction: [{ date: "2026-09-28", campagneId: "222", actionId: "10", conversions: 8 }] };
  const t = tableauDe([campagne()], [], VUE, CTX, rep, [groupe()]);
  assert.equal(t.lignes[0].enfants[0].valeurs[VALEUR], 200);
  assert.equal(t.lignes[0].enfants[0].raisons[VALEUR], null);
});

test("sa campagne sans valeur déclarée : le groupe s'efface avec la même raison, jamais 0", () => {
  const actions: ActionConversion[] = [{ id: "30", nom: "clic", toujoursDefaut: true, valeurDefaut: 1 }];
  const rep = { actions, parAction: [{ date: "2026-09-28", campagneId: "222", actionId: "30", conversions: 8 }] };
  const t = tableauDe([campagne()], [], VUE, CTX, rep, [groupe()]);
  assert.equal(t.lignes[0].enfants[0].valeurs[VALEUR], null);
  assert.equal(t.lignes[0].enfants[0].raisons[VALEUR], RAISON_SANS_VALEUR);
});

// ── L'export ─────────────────────────────────────────────────────────────────

test("CSV : le groupe d'éléments a sa colonne et son niveau, avec le type PMax", () => {
  const t = tableauDe([campagne()], [], { vue: "trafic" }, CTX, undefined, [groupe()]);
  const lignes = csvDuTableau(t).trimEnd().split("\r\n").map((l) => l.split(";"));
  const entete = lignes[0];
  assert.deepEqual(entete.slice(0, 7), ["Niveau", "Type de campagne", "Campagne", "Groupe d'annonces", "Groupe d'éléments", "Annonce", "ID Google"]);
  const g = lignes.find((l) => l[0] === "Groupe d'éléments")!;
  assert.equal(g[1], "PMax");
  assert.equal(g[2], "PMax été");
  assert.equal(g[3], "");
  assert.equal(g[4], "Plage");
  assert.equal(g[5], "");
  assert.equal(g[6], "9001");
});
