// Harnais du ticket 04 de la construction Google Ads — le Tableau détaillé
// (`lib/google/tableau.ts`).
// Lancer : sh .scratch/google-ads/harnais/04-le-tableau-detaille/lancer.sh
//
// Valeurs attendues calculées à la main (spec, § « Tableau détaillé » et
// § « Les vues et leurs métriques ») : taux total ÷ total sur chaque ligne,
// diviseur nul → « — » avec sa raison, profondeur décidée par le type.
// Contexte figé : lundi 2026-10-05 est le dernier Jour de travail → semaine
// mesurée 28 sept.–4 oct., période d'avant 21–27 sept.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lireToutesLesPages, type LigneGoogle } from "@/lib/google/lecture";
import { csvDuTableau, nomDuFichier, tableauDe, type LigneAnnonceGoogle, type LigneTableau } from "@/lib/google/tableau";

const CTX = { aujourdhui: "2026-10-05", dernierJourDeTravail: "2026-10-05" };

function campagne(sur: Partial<LigneGoogle> = {}): LigneGoogle {
  return {
    date: "2026-09-28",
    campagneId: "111",
    campagneNom: "Search marque",
    typeCampagne: "SEARCH",
    cout: 10,
    impressions: 1000,
    clics: 50,
    conversions: 5,
    ...sur,
  };
}

function annonce(sur: Partial<LigneAnnonceGoogle> = {}): LigneAnnonceGoogle {
  return {
    date: "2026-09-28",
    campagneId: "111",
    campagneNom: "Search marque",
    typeCampagne: null,
    groupeId: "g1",
    groupeNom: "Groupe 1",
    annonceId: "a1",
    annonceNom: "Annonce 1",
    cout: 10,
    impressions: 1000,
    clics: 50,
    conversions: 5,
    ...sur,
  };
}

const parNom = (lignes: LigneTableau[], nom: string) => lignes.find((l) => l.nom === nom)!;

// ── La profondeur, décidée par le type ───────────────────────────────────────

test("Search : Campagne › Groupe d'annonces › Annonce", () => {
  const t = tableauDe([campagne()], [annonce()], {}, CTX);
  const c = t.lignes[0];
  assert.equal(c.niveau, "campagne");
  assert.equal(c.type?.libelle, "Search");
  assert.equal(c.enfants[0].niveau, "groupe");
  assert.equal(c.enfants[0].nom, "Groupe 1");
  assert.equal(c.enfants[0].enfants[0].niveau, "annonce");
  assert.equal(c.enfants[0].enfants[0].nom, "Annonce 1");
  assert.equal(c.sansDetail, null);
});

test("PMax : la campagne seule, et la raison écrite", () => {
  const t = tableauDe(
    [campagne({ campagneId: "222", campagneNom: "PMax", typeCampagne: "PERFORMANCE_MAX" })],
    // Une ligne d'annonce PMax n'existe pas chez Google ; si une arrivait, elle
    // ne ferait pas une fausse annonce.
    [annonce({ campagneId: "222" })],
    {},
    CTX
  );
  assert.equal(t.lignes[0].enfants.length, 0);
  assert.match(t.lignes[0].sansDetail ?? "", /Performance Max/);
});

test("Autres types : dépliée quand Google lui donne des groupes, seule sinon", () => {
  const t = tableauDe(
    [
      campagne({ campagneId: "333", campagneNom: "Shopping", typeCampagne: "SHOPPING" }),
      campagne({ campagneId: "444", campagneNom: "App", typeCampagne: "MULTI_CHANNEL" }),
    ],
    [annonce({ campagneId: "333" })],
    {},
    CTX
  );
  assert.equal(parNom(t.lignes, "Shopping").enfants.length, 1);
  assert.equal(parNom(t.lignes, "Shopping").type?.brut, "SHOPPING");
  assert.equal(parNom(t.lignes, "App").enfants.length, 0);
});

test("Display, Vidéo et Demand Gen se déplient comme Search", () => {
  for (const type of ["DISPLAY", "VIDEO", "DEMAND_GEN"]) {
    const t = tableauDe([campagne({ typeCampagne: type })], [annonce()], {}, CTX);
    assert.equal(t.lignes[0].enfants[0].enfants[0].niveau, "annonce", type);
  }
});

// ── Les chiffres ─────────────────────────────────────────────────────────────

test("ratios recalculés par ligne : une campagne n'est pas la moyenne de ses groupes", () => {
  // G1 : 10 CHF / 10 clics = 1 ; G2 : 90 CHF / 40 clics = 2,25.
  // La moyenne des groupes vaudrait 1,625 ; la campagne, total ÷ total, 100 / 50 = 2.
  const t = tableauDe(
    [campagne({ cout: 100, clics: 50, impressions: 2000 })],
    [
      annonce({ groupeId: "g1", groupeNom: "G1", annonceId: "a1", cout: 10, clics: 10, impressions: 1000 }),
      annonce({ groupeId: "g2", groupeNom: "G2", annonceId: "a2", cout: 90, clics: 40, impressions: 1000 }),
    ],
    { vue: "trafic" },
    CTX
  );
  assert.deepEqual(t.metriques, ["clics", "ctr", "cpc"]);
  const c = t.lignes[0];
  assert.equal(c.valeurs[2], 2); // CPC campagne = 100 / 50
  assert.equal(parNom(c.enfants, "G1").valeurs[2], 1);
  assert.equal(parNom(c.enfants, "G2").valeurs[2], 2.25);
  assert.equal(c.valeurs[1], 2.5); // CTR = 50 / 2000 × 100
});

test("la ligne Total additionne toutes les campagnes, tous types, et recalcule ses taux", () => {
  const t = tableauDe(
    [
      campagne({ cout: 10, clics: 10, impressions: 1000 }),
      campagne({ campagneId: "222", campagneNom: "PMax", typeCampagne: "PERFORMANCE_MAX", cout: 30, clics: 10, impressions: 3000 }),
    ],
    [],
    { vue: "trafic" },
    CTX
  );
  assert.equal(t.total?.niveau, "total");
  assert.deepEqual(t.total?.valeurs, [20, (20 / 4000) * 100, 2]);
});

test("les colonnes suivent la vue active", () => {
  assert.deepEqual(tableauDe([campagne()], [], {}, CTX).metriques, ["impressions", "cpm"]);
  assert.deepEqual(tableauDe([campagne()], [], { vue: "conversion" }, CTX).metriques, ["conversions", "cout_conversion", "taux_conversion", "valeur_conversion", "roas"]);
});

test("diviseur nul : « — » (null) avec sa raison, jamais 0", () => {
  const t = tableauDe([campagne({ clics: 0, conversions: 0 })], [], { vue: "conversion" }, CTX);
  const c = t.lignes[0];
  assert.equal(c.valeurs[0], 0); // zéro conversion, mesuré : un vrai zéro
  assert.equal(c.valeurs[1], null);
  assert.equal(c.valeurs[2], null);
  assert.match(c.raisons[1] ?? "", /conversion/i);
  assert.match(c.raisons[2] ?? "", /clic/i);
  assert.equal(c.raisons[0], null);
});

test("écart contre la période d'avant ; base nulle → pas d'écart", () => {
  const t = tableauDe(
    [campagne({ impressions: 1500 }), campagne({ date: "2026-09-21", impressions: 1000 })],
    [],
    {},
    CTX
  );
  assert.equal(t.lignes[0].ecart, 50);
  const sansBase = tableauDe([campagne(), campagne({ date: "2026-09-21", impressions: 0 })], [], {}, CTX);
  assert.equal(sansBase.lignes[0].ecart, null);
});

test("le jour en cours n'entre dans rien", () => {
  const ctx = { aujourdhui: "2026-10-05", dernierJourDeTravail: "2026-10-05" };
  const t = tableauDe(
    [campagne({ date: "2026-10-04" }), campagne({ date: "2026-10-05", impressions: 99999 })],
    [],
    { from: "2026-09-28", to: "2026-10-05" },
    ctx
  );
  assert.equal(t.lignes[0].valeurs[0], 1000);
});

test("une campagne vue seulement la période d'avant n'est pas une ligne", () => {
  const t = tableauDe([campagne(), campagne({ campagneId: "999", campagneNom: "Ancienne", date: "2026-09-21" })], [], {}, CTX);
  assert.deepEqual(t.lignes.map((l) => l.nom), ["Search marque"]);
});

test("le filtre de campagne du Bandeau s'applique au Tableau et au Total", () => {
  const t = tableauDe(
    [campagne(), campagne({ campagneId: "222", campagneNom: "Autre", impressions: 5000 })],
    [annonce(), annonce({ campagneId: "222", annonceId: "a9" })],
    { campagne: "111" },
    CTX
  );
  assert.deepEqual(t.lignes.map((l) => l.nom), ["Search marque"]);
  assert.equal(t.total?.valeurs[0], 1000);
  assert.equal(t.campagne, "Search marque");
});

// ── L'identité par ID ────────────────────────────────────────────────────────

test("deux annonces de même nom restent deux lignes", () => {
  const t = tableauDe(
    [campagne()],
    [annonce({ annonceId: "a1", annonceNom: "Même nom" }), annonce({ annonceId: "a2", annonceNom: "Même nom" })],
    {},
    CTX
  );
  const annonces = t.lignes[0].enfants[0].enfants;
  assert.equal(annonces.length, 2);
  assert.deepEqual(annonces.map((a) => a.id).sort(), ["a1", "a2"]);
});

test("une campagne, un groupe ou une annonce renommés restent une ligne, sous leur nom le plus récent", () => {
  const t = tableauDe(
    [campagne({ campagneNom: "Vieux nom" }), campagne({ date: "2026-09-30", campagneNom: "Nouveau nom" })],
    [annonce({ groupeNom: "G vieux", annonceNom: "A vieux" }), annonce({ date: "2026-09-30", groupeNom: "G neuf", annonceNom: "A neuf" })],
    {},
    CTX
  );
  assert.equal(t.lignes.length, 1);
  assert.equal(t.lignes[0].nom, "Nouveau nom");
  assert.equal(t.lignes[0].enfants[0].nom, "G neuf");
  assert.equal(t.lignes[0].enfants[0].enfants[0].nom, "A neuf");
});

test("une ligne d'annonce sans ID de campagne n'est rattachée à rien par son nom", () => {
  const t = tableauDe([campagne()], [annonce({ campagneId: null })], {}, CTX);
  assert.equal(t.lignes[0].enfants.length, 0);
});

test("plus de 1 000 lignes d'annonces, lues paginées, toutes comptées", async () => {
  const base = Array.from({ length: 2345 }, (_, i) => annonce({ annonceId: `a${i}`, impressions: 1 }));
  const lues = await lireToutesLesPages<LigneAnnonceGoogle>(async (de, a) => ({ data: base.slice(de, a + 1), error: null }));
  const t = tableauDe([campagne()], lues, {}, CTX);
  assert.equal(t.lignes[0].enfants[0].valeurs[0], 2345);
  assert.equal(t.lignes[0].enfants[0].enfants.length, 2345);
});

// ── L'export ─────────────────────────────────────────────────────────────────

test("CSV : Total, puis chaque ligne, avec le Type de campagne et « — » compris", () => {
  const t = tableauDe(
    [
      campagne({ clics: 0 }),
      campagne({ campagneId: "333", campagneNom: "Shopping", typeCampagne: "SHOPPING", cout: 5, impressions: 500, clics: 5 }),
    ],
    [annonce({ clics: 0 })],
    { vue: "trafic" },
    CTX
  );
  const lignes = csvDuTableau(t).trimEnd().split("\r\n").map((l) => l.split(";"));
  assert.deepEqual(lignes[0].slice(0, 7), ["Niveau", "Type de campagne", "Campagne", "Groupe d'annonces", "Annonce", "ID Google", "Clics"]);
  assert.equal(lignes[1][0], "Total");
  assert.equal(lignes[1][1], "Tous les types");
  const search = lignes.find((l) => l[0] === "Campagne" && l[2] === "Search marque")!;
  assert.equal(search[1], "Search");
  assert.equal(search[8], "—"); // CPC sans clic
  const shopping = lignes.find((l) => l[2] === "Shopping")!;
  assert.equal(shopping[1], "SHOPPING"); // le vrai type de Google, pas « Autres types »
  const ann = lignes.find((l) => l[0] === "Annonce")!;
  assert.equal(ann[1], "Search"); // le type de la campagne voyage jusqu'à l'annonce
  assert.equal(ann[4], "Annonce 1");
  assert.equal(ann[5], "a1");
});

test("CSV : un nom qui commence par « = » reste du texte", () => {
  const t = tableauDe([campagne({ campagneNom: "=SOMME(A1)" })], [], {}, CTX);
  assert.match(csvDuTableau(t), /;'=SOMME\(A1\);/);
});

test("nom du fichier : canal, vue et période", () => {
  assert.equal(nomDuFichier(tableauDe([campagne()], [], { vue: "trafic" }, CTX)), "pulse-google-trafic-2026-09-28-2026-10-04.csv");
});
