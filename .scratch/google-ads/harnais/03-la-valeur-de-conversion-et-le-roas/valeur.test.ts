// Harnais du ticket 03 de la construction Google Ads — valeur de conversion et ROAS, côté page.
// Lancer : sh .scratch/google-ads/harnais/03-la-valeur-de-conversion-et-le-roas/lancer.sh
// (le pendant récolte : `python3.12 -I .scratch/google-ads/harnais/03-la-valeur-de-conversion-et-le-roas/test_recolte.py`).
//
// Attendus tirés de la spec, § « Les conversions et leur valeur », et de la
// décision de David (carte, issue 13) : une action est « sans valeur » quand sa
// valeur est imposée à 0 ou à 1 ; toutes sans valeur → « — » avec la raison ;
// mélange → le total de Google, jamais recomposé, avec une « ⓘ » ; la règle se
// recalcule sur la période et la campagne choisies ; ROAS = valeur ÷ coût sur
// les totaux, coût nul → « — ».
import { test } from "node:test";
import assert from "node:assert/strict";
import { contenuPage, formaterValeur, VUES, type LigneGoogle, type MetriqueTendance } from "@/lib/google/lecture";
import { RAISON_SANS_VALEUR, sansValeur, type ActionConversion, type ConversionsParAction } from "@/lib/google/valeur";

// Lundi 5 oct. → période 28 sept.–4 oct., période d'avant 21–27 sept.
const CTX = { aujourdhui: "2026-10-05", dernierJourDeTravail: "2026-10-05" };

function ligne(sur: Partial<LigneGoogle> = {}): LigneGoogle {
  return {
    date: "2026-09-28",
    campagneId: "111",
    campagneNom: "Search marque",
    typeCampagne: "SEARCH",
    cout: 100,
    impressions: 1000,
    clics: 50,
    conversions: 10,
    valeurConversion: 10,
    ...sur,
  };
}

// Les réglages du compte A (issue 13).
const ACHAT: ActionConversion = { id: "10", nom: "achat (balise)", toujoursDefaut: false, valeurDefaut: 1 };
const ACHAT_SERVEUR: ActionConversion = { id: "20", nom: "achat (serveur)", toujoursDefaut: true, valeurDefaut: 0 };
const CLIC_BILLET: ActionConversion = { id: "30", nom: "clic billet", toujoursDefaut: true, valeurDefaut: 1 };
const DEVIS_FIXE: ActionConversion = { id: "40", nom: "devis", toujoursDefaut: true, valeurDefaut: 250 };
const ACTIONS = [ACHAT, ACHAT_SERVEUR, CLIC_BILLET, DEVIS_FIXE];

function parAction(actionId: string, conversions: number, sur: Partial<ConversionsParAction> = {}): ConversionsParAction {
  return { date: "2026-09-28", campagneId: "111", actionId, conversions, ...sur };
}

function metrique(t: MetriqueTendance[], cle: string): MetriqueTendance {
  const m = t.find((x) => x.cle === cle);
  assert.ok(m, `métrique ${cle} absente de la vue`);
  return m;
}

test("la vue Conversion porte valeur de conversion et ROAS, après les trois d'avant", () => {
  assert.deepEqual(VUES.conversion.metriques, ["conversions", "cout_conversion", "taux_conversion", "valeur_conversion", "roas"]);
});

test("« sans valeur » = valeur imposée à 0 ou à 1, et seulement ça", () => {
  assert.equal(sansValeur(CLIC_BILLET), true);
  assert.equal(sansValeur(ACHAT_SERVEUR), true);
  assert.equal(sansValeur(ACHAT), false, "par événement : vraie valeur");
  assert.equal(sansValeur(DEVIS_FIXE), false, "valeur fixe choisie par l'annonceur : vraie valeur");
  assert.equal(sansValeur({ id: "x", nom: "x", toujoursDefaut: null, valeurDefaut: 1 }), false, "réglage non lu : pas deviné");
});

test("toutes les actions converties sans valeur → « — » sur valeur et ROAS, avec la raison", () => {
  const lignes = [ligne({ conversions: 10, valeurConversion: 7 })];
  const rep = { actions: ACTIONS, parAction: [parAction("30", 7), parAction("20", 3)] };
  const c = contenuPage(lignes, { vue: "conversion" }, CTX, rep);
  const valeur = metrique(c.tendance, "valeur_conversion");
  const roas = metrique(c.tendance, "roas");
  assert.equal(valeur.valeur, null);
  assert.equal(roas.valeur, null);
  assert.equal(formaterValeur("valeur_conversion", valeur.valeur), "—");
  assert.equal(valeur.raison, RAISON_SANS_VALEUR);
  assert.equal(roas.raison, RAISON_SANS_VALEUR);
  assert.equal(RAISON_SANS_VALEUR, "aucune valeur de conversion déclarée dans Google Ads");
  assert.deepEqual(valeur.serie, Array(7).fill(null), "la courbe ne dessine pas un comptage");
  assert.equal(valeur.avertissement, null);
});

test("un mélange → le total de Google, jamais recomposé, avec une ⓘ", () => {
  // Google déclare 6 269,25 ; la somme recomposée par action ne s'en servirait pas.
  const lignes = [ligne({ conversions: 303.69, valeurConversion: 6269.25, cout: 8703.37 })];
  const rep = {
    actions: ACTIONS,
    parAction: [parAction("10", 66.56), parAction("20", 66.79), parAction("30", 169.34), parAction("30", 1, { campagneId: "999" })],
  };
  const c = contenuPage(lignes, { vue: "conversion" }, CTX, rep);
  const valeur = metrique(c.tendance, "valeur_conversion");
  assert.equal(valeur.valeur, 6269.25);
  assert.equal(valeur.raison, null);
  assert.match(valeur.avertissement ?? "", /comptage/);
  const roas = metrique(c.tendance, "roas");
  assert.ok(Math.abs((roas.valeur ?? 0) - 6269.25 / 8703.37) < 1e-12, "ROAS = valeur ÷ coût sur les totaux");
  assert.match(roas.avertissement ?? "", /comptage/);
});

test("que des vraies valeurs → le total de Google, sans ⓘ", () => {
  const lignes = [ligne({ conversions: 4, valeurConversion: 1200 })];
  const rep = { actions: ACTIONS, parAction: [parAction("10", 3), parAction("40", 1)] };
  const valeur = metrique(contenuPage(lignes, { vue: "conversion" }, CTX, rep).tendance, "valeur_conversion");
  assert.equal(valeur.valeur, 1200);
  assert.equal(valeur.avertissement, null);
});

test("la règle se recalcule au filtre campagne", () => {
  const lignes = [
    ligne({ campagneId: "111", conversions: 5, valeurConversion: 500 }),
    ligne({ campagneId: "222", campagneNom: "PMax", conversions: 8, valeurConversion: 8 }),
  ];
  const rep = { actions: ACTIONS, parAction: [parAction("10", 5, { campagneId: "111" }), parAction("30", 8, { campagneId: "222" })] };
  const compte = metrique(contenuPage(lignes, { vue: "conversion" }, CTX, rep).tendance, "valeur_conversion");
  assert.equal(compte.valeur, 508, "le compte entier mélange : total de Google");
  assert.ok(compte.avertissement);
  const vraie = metrique(contenuPage(lignes, { vue: "conversion", campagne: "111" }, CTX, rep).tendance, "valeur_conversion");
  assert.equal(vraie.valeur, 500, "une campagne à vraie valeur n'est pas effacée par le reste du compte");
  assert.equal(vraie.avertissement, null);
  const comptage = metrique(contenuPage(lignes, { vue: "conversion", campagne: "222" }, CTX, rep).tendance, "valeur_conversion");
  assert.equal(comptage.valeur, null);
  assert.equal(comptage.raison, RAISON_SANS_VALEUR);
});

test("la règle se recalcule sur la période : la période d'avant a la sienne", () => {
  const lignes = [
    ligne({ date: "2026-09-28", conversions: 2, valeurConversion: 300 }),
    ligne({ date: "2026-09-21", conversions: 4, valeurConversion: 4 }),
  ];
  const rep = { actions: ACTIONS, parAction: [parAction("10", 2), parAction("30", 4, { date: "2026-09-21" })] };
  const valeur = metrique(contenuPage(lignes, { vue: "conversion" }, CTX, rep).tendance, "valeur_conversion");
  assert.equal(valeur.valeur, 300);
  assert.equal(valeur.avant, null, "la période d'avant n'était qu'un comptage");
  assert.equal(valeur.ecart, null, "pas d'écart contre un comptage");
});

test("coût nul → ROAS « — », jamais l'infini", () => {
  const lignes = [ligne({ cout: 0, conversions: 2, valeurConversion: 300 })];
  const rep = { actions: ACTIONS, parAction: [parAction("10", 2)] };
  const roas = metrique(contenuPage(lignes, { vue: "conversion" }, CTX, rep).tendance, "roas");
  assert.equal(roas.valeur, null);
  assert.equal(formaterValeur("roas", roas.valeur), "—");
  assert.ok(roas.raison);
});

test("le ROAS s'écrit valeur ÷ coût, deux décimales", () => {
  assert.equal(formaterValeur("roas", 3.4159), "3,42");
  assert.equal(formaterValeur("valeur_conversion", 6269.25), "6 269,25 CHF");
});

test("une valeur non récoltée sur une ligne de la période → « — », jamais une somme partielle", () => {
  const lignes = [ligne({ conversions: 2, valeurConversion: 300 }), ligne({ date: "2026-09-29", conversions: 0, valeurConversion: null })];
  const rep = { actions: ACTIONS, parAction: [parAction("10", 2)] };
  const valeur = metrique(contenuPage(lignes, { vue: "conversion" }, CTX, rep).tendance, "valeur_conversion");
  assert.equal(valeur.valeur, null);
  assert.ok(valeur.raison && !valeur.raison.includes("déclarée"), "une autre raison que « sans valeur »");
});

test("des conversions dont la répartition n'est pas lue → « — », pas un comptage pris pour un montant", () => {
  const lignes = [ligne({ conversions: 10, valeurConversion: 10 })];
  const sansRepartition = metrique(contenuPage(lignes, { vue: "conversion" }, CTX).tendance, "valeur_conversion");
  assert.equal(sansRepartition.valeur, null);
  assert.ok(sansRepartition.raison);
  // Une action convertie dont les réglages n'ont pas été lus, seule : pas de conclusion.
  const inconnue = metrique(
    contenuPage(lignes, { vue: "conversion" }, CTX, { actions: ACTIONS, parAction: [parAction("77", 10)] }).tendance,
    "valeur_conversion"
  );
  assert.equal(inconnue.valeur, null);
});

test("une répartition incomplète à côté d'une vraie valeur → total de Google, avec ⓘ", () => {
  const lignes = [ligne({ conversions: 10, valeurConversion: 900 })];
  const rep = { actions: ACTIONS, parAction: [parAction("10", 6)] };
  const valeur = metrique(contenuPage(lignes, { vue: "conversion" }, CTX, rep).tendance, "valeur_conversion");
  assert.equal(valeur.valeur, 900);
  assert.ok(valeur.avertissement);
});

test("l'arrondi à 2 décimales des conversions en base ne passe pas pour un reste", () => {
  // `google_ads_insights.conversions` est numeric(12,2) ; la répartition ne l'est pas.
  const lignes = [ligne({ conversions: 3.33, valeurConversion: 400 })];
  const rep = { actions: ACTIONS, parAction: [parAction("10", 3.333333)] };
  const valeur = metrique(contenuPage(lignes, { vue: "conversion" }, CTX, rep).tendance, "valeur_conversion");
  assert.equal(valeur.avertissement, null);
});

test("aucune conversion sur la période → la valeur de Google telle quelle", () => {
  const lignes = [ligne({ conversions: 0, valeurConversion: 0 })];
  const valeur = metrique(contenuPage(lignes, { vue: "conversion" }, CTX, { actions: ACTIONS, parAction: [] }).tendance, "valeur_conversion");
  assert.equal(valeur.valeur, 0);
  assert.equal(valeur.raison, null);
});

test("une période sans aucune ligne → « — » sans raison inventée", () => {
  const valeur = metrique(contenuPage([], { vue: "conversion" }, CTX, { actions: ACTIONS, parAction: [] }).tendance, "valeur_conversion");
  assert.equal(valeur.valeur, null);
  assert.equal(valeur.raison, null);
});

test("le jour en cours n'entre pas dans la règle", () => {
  const lignes = [ligne({ conversions: 2, valeurConversion: 300 })];
  const rep = { actions: ACTIONS, parAction: [parAction("10", 2), parAction("30", 50, { date: "2026-10-05" })] };
  const valeur = metrique(contenuPage(lignes, { vue: "conversion" }, CTX, rep).tendance, "valeur_conversion");
  assert.equal(valeur.avertissement, null);
});
