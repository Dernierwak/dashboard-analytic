// Harnais du ticket 03 — valeur de conversion et ROAS dans le Tableau détaillé
// (`lib/google/tableau.ts`, ticket 04). Même règle que la Tendance, recalculée
// sur chaque campagne et sur le Total ; groupes et annonces n'ont pas de valeur
// récoltée (`google_ads_ad_insights`) : « — » avec sa raison, jamais 0.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { LigneGoogle } from "@/lib/google/lecture";
import { csvDuTableau, tableauDe, type LigneAnnonceGoogle, type LigneTableau } from "@/lib/google/tableau";
import { RAISON_SANS_VALEUR, type ActionConversion, type ConversionsParAction } from "@/lib/google/valeur";

const CTX = { aujourdhui: "2026-10-05", dernierJourDeTravail: "2026-10-05" };
const VUE = { vue: "conversion" };
// valeur_conversion et roas : rangs 3 et 4 de la vue Conversion.
const VALEUR = 3;
const ROAS = 4;

function campagne(sur: Partial<LigneGoogle> = {}): LigneGoogle {
  return { date: "2026-09-28", campagneId: "111", campagneNom: "Search", typeCampagne: "SEARCH", cout: 100, impressions: 1000, clics: 50, conversions: 5, valeurConversion: 500, ...sur };
}

function annonce(sur: Partial<LigneAnnonceGoogle> = {}): LigneAnnonceGoogle {
  return {
    date: "2026-09-28", campagneId: "111", campagneNom: "Search", typeCampagne: null,
    groupeId: "g1", groupeNom: "Groupe 1", annonceId: "a1", annonceNom: "Annonce 1",
    cout: 100, impressions: 1000, clics: 50, conversions: 5, valeurConversion: null, ...sur,
  };
}

const ACTIONS: ActionConversion[] = [
  { id: "10", nom: "achat", toujoursDefaut: false, valeurDefaut: 1 },
  { id: "30", nom: "clic billet", toujoursDefaut: true, valeurDefaut: 1 },
];
const par = (campagneId: string, actionId: string, conversions: number): ConversionsParAction => ({ date: "2026-09-28", campagneId, actionId, conversions });

const lignes = [campagne(), campagne({ campagneId: "222", campagneNom: "Comptage", conversions: 8, valeurConversion: 8, cout: 0 })];
const rep = { actions: ACTIONS, parAction: [par("111", "10", 5), par("222", "30", 8)] };
const parNom = (l: LigneTableau[], nom: string) => l.find((x) => x.nom === nom)!;

test("chaque campagne a sa règle : vraie valeur affichée, comptage effacé avec sa raison", () => {
  const t = tableauDe(lignes, [annonce()], VUE, CTX, rep);
  const vraie = parNom(t.lignes, "Search");
  assert.equal(vraie.valeurs[VALEUR], 500);
  assert.equal(vraie.valeurs[ROAS], 5);
  assert.equal(vraie.avertissements[VALEUR], null);
  const comptage = parNom(t.lignes, "Comptage");
  assert.equal(comptage.valeurs[VALEUR], null);
  assert.equal(comptage.raisons[VALEUR], RAISON_SANS_VALEUR);
  assert.equal(comptage.raisons[ROAS], RAISON_SANS_VALEUR);
});

test("le Total mélange : total de Google avec ⓘ", () => {
  const t = tableauDe(lignes, [], VUE, CTX, rep);
  assert.equal(t.total!.valeurs[VALEUR], 508);
  assert.match(t.total!.avertissements[VALEUR] ?? "", /comptage/);
});

test("groupe et annonce : pas de valeur récoltée → « — » avec sa raison, jamais 0", () => {
  const t = tableauDe(lignes, [annonce()], VUE, CTX, rep);
  const groupe = parNom(t.lignes, "Search").enfants[0];
  const ann = groupe.enfants[0];
  for (const l of [groupe, ann]) {
    assert.equal(l.valeurs[VALEUR], null);
    assert.equal(l.valeurs[ROAS], null);
    assert.match(l.raisons[VALEUR] ?? "", /niveau campagne/);
    assert.match(l.raisons[ROAS] ?? "", /niveau campagne/);
  }
});

test("le CSV écrit le ROAS sans unité et « — » là où l'écran l'écrit", () => {
  const csv = csvDuTableau(tableauDe(lignes, [], VUE, CTX, rep));
  const rangs = csv.split("\r\n");
  assert.match(rangs[0], /Valeur de conversion \(CHF\);ROAS;/);
  assert.match(rangs.find((r) => r.includes(";111;")) ?? "", /;500,00;5,00;/);
  assert.match(rangs.find((r) => r.includes(";222;")) ?? "", /;—;—;/);
});
