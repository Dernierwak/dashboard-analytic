// Harnais du ticket 09 — le Tableau détaillé, exporté en CSV.
//
// Même seam que le 06 : « lignes de base + commandes → contenu des modules »,
// par `saas/web/lib/meta/tableau.ts`. Ce que le Tableau AFFICHE (quelles
// lignes, sous quel nom, quels chiffres) et ce que le CSV ÉCRIT se vérifient
// ici ; le dépliage et le téléchargement, eux, se voient dans Chrome. Lancer
// depuis la racine du dépôt :
//
//     node --import ./.scratch/meta-ads/harnais/09-le-tableau/resoudre.mjs \
//          --test .scratch/meta-ads/harnais/09-le-tableau/tableau.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { csvDuTableau, nomDuFichier, tableauDe } from "../../../../saas/web/lib/meta/tableau.ts";
import type { LigneMeta } from "../../../../saas/web/lib/meta/lecture.ts";

// Lundi 5 octobre 2026, Jour de travail lundi : la semaine mesurée va du lundi
// 28 septembre au dimanche 4 octobre, la période d'avant du 21 au 27.
const CTX = { aujourdhui: "2026-10-05", dernierJourDeTravail: "2026-10-05" };

function ligne(p: Partial<LigneMeta> & { date: string }): LigneMeta {
  return {
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

const lignesCsv = (csv: string) => csv.trimEnd().split("\r\n").map((l) => l.split(";"));

// ── Les ratios, ligne par ligne ──────────────────────────────────────────────

test("le CTR d'une campagne est total ÷ total, pas la moyenne de ses groupes", () => {
  // Groupe A : 1 clic / 100 impr. = 1 % ; groupe B : 300 / 10 000 = 3 %.
  // Moyenne des deux : 2 %. Total ÷ total : 301 / 10 100 ≈ 2,98 %.
  const lignes = [
    ligne({ date: "2026-09-29", groupeId: "gA", annonceId: "a1", impressions: 100, clics: 1 }),
    ligne({ date: "2026-09-29", groupeId: "gB", annonceId: "a2", impressions: 10_000, clics: 300 }),
  ];
  const [campagne] = tableauDe(lignes, { vue: "trafic" }, CTX).lignes;
  assert.ok(Math.abs(campagne.valeurs[1]! - (301 / 10_100) * 100) < 1e-9);
  assert.deepEqual(
    campagne.enfants.map((g) => g.valeurs[1]),
    [3, 1]
  );
});

test("le CPM d'un groupe est total ÷ total sur ses annonces et ses jours", () => {
  const lignes = [
    ligne({ date: "2026-09-28", annonceId: "a1", depense: 10, impressions: 1_000 }), // CPM 10
    ligne({ date: "2026-09-29", annonceId: "a2", depense: 1, impressions: 9_000 }), // CPM 0,11
  ];
  const groupe = tableauDe(lignes, {}, CTX).lignes[0].enfants[0];
  assert.equal(groupe.valeurs[1], (11 / 10_000) * 1000);
});

test("une annonce sans impression a un CPM « — », pas 0, et le CSV écrit « — »", () => {
  const lignes = [ligne({ date: "2026-09-29", depense: 0, impressions: 0 })];
  const t = tableauDe(lignes, {}, CTX);
  const annonce = t.lignes[0].enfants[0].enfants[0];
  assert.equal(annonce.valeurs[1], null);
  const [, , , ligneAnnonce] = lignesCsv(csvDuTableau(t));
  assert.equal(ligneAnnonce[6], "—"); // CPM
  assert.equal(ligneAnnonce[5], "0"); // un vrai zéro d'impressions reste un zéro
});

// ── L'identité ───────────────────────────────────────────────────────────────

test("une campagne renommée reste une seule ligne, sous son nom le plus récent", () => {
  const lignes = [
    ligne({ date: "2026-09-28", campagneNom: "Soldes été", impressions: 10 }),
    ligne({ date: "2026-10-01", campagneNom: "Soldes automne", impressions: 5 }),
    ligne({ date: "2026-09-30", campagneNom: "Soldes été", impressions: 1 }),
  ];
  const t = tableauDe(lignes, {}, CTX);
  assert.equal(t.lignes.length, 1);
  assert.equal(t.lignes[0].nom, "Soldes automne");
  assert.equal(t.lignes[0].valeurs[0], 16);
});

test("un groupe renommé reste un seul groupe, sous son nom le plus récent", () => {
  const lignes = [
    ligne({ date: "2026-09-28", groupeNom: "Ancien" }),
    ligne({ date: "2026-10-02", groupeNom: "Nouveau" }),
  ];
  const groupes = tableauDe(lignes, {}, CTX).lignes[0].enfants;
  assert.deepEqual(groupes.map((g) => g.nom), ["Nouveau"]);
});

test("deux annonces homonymes restent deux lignes", () => {
  const lignes = [
    ligne({ date: "2026-09-29", annonceId: "a1", annonceNom: "Vidéo" }),
    ligne({ date: "2026-09-29", annonceId: "a2", annonceNom: "Vidéo" }),
  ];
  assert.equal(tableauDe(lignes, {}, CTX).lignes[0].enfants[0].enfants.length, 2);
});

test("une ligne sans ID n'est jamais rattachée par son nom à une campagne qui en a un", () => {
  const lignes = [
    ligne({ date: "2026-09-29", campagneId: "c1", campagneNom: "Soldes" }),
    ligne({ date: "2026-09-29", campagneId: null, campagneNom: "Soldes", groupeId: null, annonceId: null }),
  ];
  const t = tableauDe(lignes, {}, CTX);
  assert.equal(t.lignes.length, 2);
  assert.deepEqual(t.lignes.map((l) => l.id).sort(), ["c1", null].sort());
});

test("un groupe sans ID homonyme dans deux campagnes reste deux groupes", () => {
  const lignes = [
    ligne({ date: "2026-09-29", campagneId: "c1", groupeId: null, groupeNom: "Tous" }),
    ligne({ date: "2026-09-29", campagneId: "c2", groupeId: null, groupeNom: "Tous" }),
  ];
  const t = tableauDe(lignes, {}, CTX);
  assert.equal(t.lignes.length, 2);
  const cles = t.lignes.flatMap((c) => c.enfants.map((g) => g.cle));
  assert.equal(new Set(cles).size, 2);
});

// ── La sélection : vue, filtre, période ──────────────────────────────────────

test("les colonnes suivent la vue", () => {
  const lignes = [ligne({ date: "2026-09-29" })];
  assert.deepEqual(tableauDe(lignes, {}, CTX).metriques, ["impressions", "cpm"]);
  assert.deepEqual(tableauDe(lignes, { vue: "trafic" }, CTX).metriques, ["clics", "ctr", "cpc"]);
});

test("seule la période compte ; la période d'avant donne l'écart ; le jour en cours n'entre pas", () => {
  const lignes = [
    ligne({ date: "2026-09-22", impressions: 50 }), // période d'avant
    ligne({ date: "2026-09-29", impressions: 100 }),
    ligne({ date: "2026-10-05", impressions: 9_999 }), // aujourd'hui
    ligne({ date: "2026-09-01", impressions: 7 }), // hors de tout
  ];
  const [c] = tableauDe(lignes, { from: "2026-09-28", to: "2026-10-10" }, CTX).lignes;
  assert.equal(c.valeurs[0], 100);
  assert.equal(c.ecart, 100);
});

test("un élément qui n'a tourné que la période d'avant n'est pas une ligne", () => {
  const lignes = [
    ligne({ date: "2026-09-22", annonceId: "vieille" }),
    ligne({ date: "2026-09-29", annonceId: "a1" }),
  ];
  const annonces = tableauDe(lignes, {}, CTX).lignes[0].enfants[0].enfants;
  assert.deepEqual(annonces.map((a) => a.id), ["a1"]);
});

test("le filtre campagne ne garde que ses groupes et ses annonces", () => {
  const lignes = [
    ligne({ date: "2026-09-29", campagneId: "c1", campagneNom: "Soldes" }),
    ligne({ date: "2026-09-29", campagneId: "c2", campagneNom: "Marque", groupeId: "g2", annonceId: "a2" }),
  ];
  const t = tableauDe(lignes, { campagne: "c2" }, CTX);
  assert.deepEqual(t.lignes.map((l) => l.nom), ["Marque"]);
  assert.equal(t.campagne, "Marque");
});

test("une campagne inconnue en URL ne retombe pas sur « toutes »", () => {
  const t = tableauDe([ligne({ date: "2026-09-29" })], { campagne: "inconnue" }, CTX);
  assert.equal(t.lignes.length, 0);
});

test("classé par le chiffre principal décroissant", () => {
  const lignes = [
    ligne({ date: "2026-09-29", campagneId: "c1", campagneNom: "Petite", impressions: 10 }),
    ligne({ date: "2026-09-29", campagneId: "c2", campagneNom: "Grande", impressions: 900 }),
  ];
  assert.deepEqual(tableauDe(lignes, {}, CTX).lignes.map((l) => l.nom), ["Grande", "Petite"]);
});

// ── Le CSV ───────────────────────────────────────────────────────────────────

test("le CSV a une ligne par élément, son niveau et son chemin, et les colonnes de la vue", () => {
  const lignes = [
    ligne({ date: "2026-09-29", depense: 12.345, impressions: 1_234, clics: 37 }),
    ligne({ date: "2026-09-22", depense: 1, impressions: 1_000, clics: 20 }),
  ];
  const csv = lignesCsv(csvDuTableau(tableauDe(lignes, { vue: "trafic" }, CTX)));
  assert.deepEqual(csv[0], [
    "Niveau",
    "Campagne",
    "Groupe d'annonces",
    "Annonce",
    "ID Meta",
    "Clics (tous)",
    "CTR (tous) (%)",
    "CPC (tous) (CHF)",
    "Clics (tous), écart contre la période d'avant (%)",
  ]);
  assert.deepEqual(csv[1], ["Campagne", "Soldes", "", "", "c1", "37", "3,00", "0,33", "85,0"]);
  assert.deepEqual(csv[3], ["Annonce", "Soldes", "Acheteurs", "Carrousel", "a1", "37", "3,00", "0,33", "85,0"]);
  assert.equal(csv.length, 4);
});

test("un écart sans base s'écrit « — », jamais « +∞ »", () => {
  const csv = lignesCsv(csvDuTableau(tableauDe([ligne({ date: "2026-09-29", impressions: 3 })], {}, CTX)));
  assert.equal(csv[1].at(-1), "—");
});

test("un nom avec point-virgule ou guillemet reste une seule cellule", () => {
  const csv = csvDuTableau(tableauDe([ligne({ date: "2026-09-29", campagneNom: 'Été; "promo"' })], {}, CTX));
  assert.ok(csv.split("\r\n")[1].includes('"Été; ""promo"""'));
});

test("un nom qui commence par « = » n'est pas une formule dans le tableur", () => {
  const csv = csvDuTableau(tableauDe([ligne({ date: "2026-09-29", campagneNom: "=HYPERLINK(1)" })], {}, CTX));
  assert.equal(lignesCsv(csv)[1][1], "'=HYPERLINK(1)");
});

test("le nom du fichier porte la vue, la campagne et la période", () => {
  const t = tableauDe([ligne({ date: "2026-09-29", campagneNom: "Soldes d'été" })], { vue: "trafic", campagne: "c1" }, CTX);
  assert.equal(nomDuFichier(t), "pulse-meta-trafic-soldes-d-ete-2026-09-28-2026-10-04.csv");
});

test("un écart négatif reste un nombre dans le tableur, pas du texte", () => {
  const lignes = [ligne({ date: "2026-09-22", impressions: 200 }), ligne({ date: "2026-09-29", impressions: 150 })];
  const csv = lignesCsv(csvDuTableau(tableauDe(lignes, {}, CTX)));
  assert.equal(csv[1].at(-1), "-25,0");
});
