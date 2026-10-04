// Harnais du ticket 06 — la page Meta neuve.
//
// Seam : « lignes de base + commandes → contenu des modules », par les
// fonctions pures de `saas/web/lib/meta/` (aucune directive, aucun import :
// Node les charge tels quels). `saas/web` n'a pas de lanceur de tests ; celui-ci
// est `node:test`, livré avec Node. Lancer depuis la racine du dépôt :
//
//     node --test .scratch/meta-ads/harnais/06-la-page-meta-neuve/lecture.test.ts
//
// (Node ≥ 23.6 retire les types tout seul ; plus ancien : ajouter
// `--experimental-strip-types`.)
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  campagnesDe,
  contenuPage,
  ecart,
  formaterEcart,
  formaterValeur,
  lireToutesLesPages,
  periodeDe,
  type LigneMeta,
} from "../../../../saas/web/lib/meta/lecture.ts";
import { lienMeta } from "../../../../saas/web/lib/meta/liens.ts";
import { dernierJourDeTravail } from "../../../../saas/web/lib/jour-de-travail.ts";

// Lundi 5 octobre 2026, Jour de travail lundi : la semaine mesurée va du lundi
// 28 septembre au dimanche 4 octobre, la période d'avant du 21 au 27.
const AUJOURDHUI = "2026-10-05";
const CTX = { aujourdhui: AUJOURDHUI, dernierJourDeTravail: "2026-10-05" };

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

const tendance = (lignes: LigneMeta[], cmd = {}) => contenuPage(lignes, cmd, CTX).tendance;
const metrique = (lignes: LigneMeta[], cle: string, cmd: object = { vue: "trafic" }) =>
  contenuPage(lignes, cmd, CTX).tendance.find((m) => m.cle === cle)!;

// ── La lecture paginée ───────────────────────────────────────────────────────

test("au-delà de 1 000 lignes, toutes les pages sont lues", async () => {
  const base = Array.from({ length: 2_345 }, (_, i) => i);
  const demandes: [number, number][] = [];
  const lu = await lireToutesLesPages(async (de, a) => {
    demandes.push([de, a]);
    return { data: base.slice(de, a + 1), error: null };
  });
  assert.equal(lu.length, 2_345);
  assert.deepEqual(demandes, [[0, 999], [1000, 1999], [2000, 2999]]);
});

test("une page en erreur lève, elle ne se lit pas comme une table vide", async () => {
  await assert.rejects(
    lireToutesLesPages(async () => ({ data: null, error: { message: "colonne absente" } }))
  );
});

// ── La période ───────────────────────────────────────────────────────────────

test("par défaut, la semaine mesurée et les sept jours d'avant", () => {
  const p = periodeDe({}, CTX);
  assert.deepEqual(
    [p.debut, p.fin, p.avantDebut, p.avantFin, p.jours, p.parDefaut],
    ["2026-09-28", "2026-10-04", "2026-09-21", "2026-09-27", 7, true]
  );
});

test("le dernier Jour de travail : le passage de 07:00 UTC fait foi", () => {
  const jt = (iso: string) => dernierJourDeTravail("Monday", new Date(iso)).toISOString().slice(0, 10);
  assert.equal(jt("2026-10-07T12:00:00Z"), "2026-10-05", "un mercredi");
  assert.equal(jt("2026-10-05T08:00:00Z"), "2026-10-05", "le lundi, après le passage");
  assert.equal(jt("2026-10-05T06:00:00Z"), "2026-09-28", "le lundi, avant le passage");
});

test("une période choisie qui touche aujourd'hui s'arrête hier, et le dit", () => {
  const p = periodeDe({ from: "2026-10-01", to: "2026-10-05" }, CTX);
  assert.deepEqual([p.debut, p.fin, p.jours, p.rognee], ["2026-10-01", "2026-10-04", 4, true]);
  assert.deepEqual([p.avantDebut, p.avantFin], ["2026-09-27", "2026-09-30"]);
});

test("récolte en échec : la semaine mesurée recule jusqu'au dernier jour lu, sans changer de durée", () => {
  const p = periodeDe({}, { ...CTX, dernierJourLu: "2026-10-01" });
  assert.deepEqual([p.debut, p.fin, p.jours, p.arreteeAuDernierJourLu], ["2026-09-25", "2026-10-01", 7, true]);
});

test("récolte en échec : une période choisie s'arrête au dernier jour lu", () => {
  const p = periodeDe({ from: "2026-09-28", to: "2026-10-04" }, { ...CTX, dernierJourLu: "2026-10-01" });
  assert.deepEqual([p.debut, p.fin, p.arreteeAuDernierJourLu], ["2026-09-28", "2026-10-01", true]);
  const tout = periodeDe({ from: "2026-10-02", to: "2026-10-04" }, { ...CTX, dernierJourLu: "2026-10-01" });
  assert.deepEqual([tout.debut, tout.fin], ["2026-10-01", "2026-10-01"]);
});

test("une période illisible retombe sur la semaine mesurée", () => {
  assert.equal(periodeDe({ from: "hier", to: "2026-10-01" }, CTX).parDefaut, true);
  assert.equal(periodeDe({ from: "2026-10-03", to: "2026-10-01" }, CTX).parDefaut, true);
});

// ── Le jour en cours ─────────────────────────────────────────────────────────

test("le jour en cours n'est jamais compté, même dans une période qui l'inclut", () => {
  const lignes = [
    ligne({ date: "2026-10-04", impressions: 100 }),
    ligne({ date: AUJOURDHUI, impressions: 5_000 }),
  ];
  const m = contenuPage(lignes, { from: "2026-10-04", to: AUJOURDHUI }, CTX).tendance[0];
  assert.equal(m.valeur, 100);
  assert.deepEqual(m.serie, [100]);
});

// ── Les ratios, total ÷ total ────────────────────────────────────────────────

test("le CTR est le total des clics ÷ le total des impressions, pas la moyenne des CTR", () => {
  // Jour 1 : 1 clic / 10 impressions (10 %) ; jour 2 : 10 / 1 000 (1 %).
  // Moyenne des deux : 5,5 %. Total ÷ total : 11 / 1 010 = 1,089 %.
  const lignes = [
    ligne({ date: "2026-09-28", clics: 1, impressions: 10 }),
    ligne({ date: "2026-09-29", clics: 10, impressions: 1_000 }),
  ];
  assert.equal(metrique(lignes, "ctr").valeur!.toFixed(4), (11 / 1_010 * 100).toFixed(4));
});

test("CPM = dépense ÷ impressions × 1 000, CPC = dépense ÷ tous les clics", () => {
  const lignes = [
    ligne({ date: "2026-09-28", depense: 30, impressions: 2_000, clics: 40 }),
    ligne({ date: "2026-09-29", annonceId: "a2", depense: 10, impressions: 2_000, clics: 10 }),
  ];
  assert.equal(metrique(lignes, "cpm", { vue: "notoriete" }).valeur, 10);
  assert.equal(metrique(lignes, "cpc").valeur, 0.8);
});

test("l'écran écrit « tous les clics » là où il affiche un clic", () => {
  const vue = contenuPage([], { vue: "trafic" }, CTX).tendance;
  for (const m of vue) assert.match(`${m.nom} ${m.aide}`, /tous les clics/i, m.cle);
});

// ── « — », jamais 0, jamais +∞ % ─────────────────────────────────────────────

test("diviseur nul → « — » (CPC sans clic, CTR sans impression)", () => {
  const lignes = [ligne({ date: "2026-09-28", depense: 12, impressions: 0, clics: 0 })];
  assert.equal(metrique(lignes, "cpc").valeur, null);
  assert.equal(metrique(lignes, "ctr").valeur, null);
  assert.equal(formaterValeur("cpc", null), "—");
});

test("aucune ligne → « — », pas 0", () => {
  const m = metrique([], "clics");
  assert.equal(m.valeur, null);
  assert.equal(formaterValeur("clics", m.valeur), "—");
});

test("base nulle ou absente → écart « — », jamais « +∞ % »", () => {
  assert.equal(ecart(50, 0), null);
  assert.equal(ecart(50, null), null);
  assert.equal(ecart(null, 50), null);
  assert.equal(formaterEcart(ecart(50, 0)), "—");
  const lignes = [ligne({ date: "2026-09-28", clics: 40, impressions: 100 })];
  const m = metrique(lignes, "clics");
  assert.equal(m.avant, null);
  assert.equal(m.ecart, null);
});

test("un écart se calcule sur la période d'avant de même durée", () => {
  const lignes = [
    ligne({ date: "2026-09-21", clics: 40 }),
    ligne({ date: "2026-09-28", clics: 50 }),
  ];
  const m = metrique(lignes, "clics");
  assert.deepEqual([m.valeur, m.avant], [50, 40]);
  assert.equal(formaterEcart(m.ecart).replace(/\s/g, " "), "+25 %");
});

// ── La Tendance ──────────────────────────────────────────────────────────────

test("un jour sans donnée est un trou, pas un zéro", () => {
  const lignes = [
    ligne({ date: "2026-09-28", impressions: 100 }),
    ligne({ date: "2026-09-30", impressions: 300 }),
  ];
  const m = tendance(lignes)[0];
  assert.deepEqual(m.serie, [100, null, 300, null, null, null, null]);
  assert.deepEqual(m.serieAvant, [null, null, null, null, null, null, null]);
});

test("la vue Notoriété montre impressions et CPM ; Trafic clics, CTR et CPC", () => {
  assert.deepEqual(tendance([], { vue: "notoriete" }).map((m) => m.cle), ["impressions", "cpm"]);
  assert.deepEqual(tendance([], { vue: "trafic" }).map((m) => m.cle), ["clics", "ctr", "cpc"]);
  assert.equal(contenuPage([], { vue: "n'importe" }, CTX).vue, "notoriete");
});

test("les cartes de vue portent chacune leur chiffre principal et son écart, quelle que soit la vue active", () => {
  const lignes = [
    ligne({ date: "2026-09-21", impressions: 1_000, clics: 10 }),
    ligne({ date: "2026-09-28", impressions: 1_500, clics: 12 }),
  ];
  const cartes = contenuPage(lignes, { vue: "trafic" }, CTX).cartes;
  assert.deepEqual(
    cartes.map((c) => [c.vue, c.valeur, c.avant]),
    // Ces lignes n'ont pas de `results` : la carte Conversion dit « — »
    // (ticket 10), jamais un zéro.
    [["notoriete", 1_500, 1_000], ["trafic", 12, 10], ["conversion", null, null]]
  );
});

// ── La campagne, par son ID ──────────────────────────────────────────────────

test("une campagne renommée reste une seule campagne, sous son nom le plus récent", () => {
  const lignes = [
    ligne({ date: "2026-09-22", campagneNom: "Soldes été", depense: 5 }),
    ligne({ date: "2026-09-29", campagneNom: "Soldes automne", depense: 7 }),
  ];
  const c = campagnesDe(lignes);
  assert.equal(c.length, 1);
  assert.equal(c[0].nom, "Soldes automne");
});

test("une ligne sans ID n'est jamais rattachée par son nom à une campagne qui en a un", () => {
  const lignes = [
    ligne({ date: "2026-09-28", campagneId: "c1", campagneNom: "Soldes", clics: 5 }),
    ligne({ date: "2026-09-28", campagneId: null, campagneNom: "Soldes", annonceId: "a9", clics: 7 }),
  ];
  const c = campagnesDe(lignes);
  assert.equal(c.length, 2);
  assert.equal(metrique(lignes, "clics", { vue: "trafic", campagne: "c1" }).valeur, 5);
});

test("deux campagnes homonymes restent deux campagnes", () => {
  const lignes = [
    ligne({ date: "2026-09-28", campagneId: "c1", campagneNom: "Soldes" }),
    ligne({ date: "2026-09-28", campagneId: "c2", campagneNom: "Soldes", annonceId: "a2" }),
  ];
  assert.equal(campagnesDe(lignes).length, 2);
});

test("choisir une campagne resserre la Tendance et les cartes", () => {
  const lignes = [
    ligne({ date: "2026-09-28", campagneId: "c1", impressions: 100 }),
    ligne({ date: "2026-09-28", campagneId: "c2", annonceId: "a2", impressions: 900 }),
  ];
  const p = contenuPage(lignes, { campagne: "c2" }, CTX);
  assert.equal(p.tendance[0].valeur, 900);
  assert.equal(p.cartes[0].valeur, 900);
  assert.equal(p.campagneChoisie?.cle, "c2");
});

test("une campagne inconnue en URL ne retombe pas en silence sur « toutes »", () => {
  const lignes = [ligne({ date: "2026-09-28", impressions: 100 })];
  const p = contenuPage(lignes, { campagne: "inconnue" }, CTX);
  assert.equal(p.tendance[0].valeur, null);
  assert.equal(p.campagneChoisie?.cle, "inconnue");
  assert.equal(p.campagneChoisie?.connue, false);
});

// ── L'URL ────────────────────────────────────────────────────────────────────

test("un lien énumère ce qu'il change et garde tout le reste, même ce qu'il ne connaît pas", () => {
  const href = lienMeta({ vue: "trafic", campagne: "c1", from: "2026-09-01", to: "2026-09-07", inconnu: "x" }, { vue: "notoriete" });
  const q = new URLSearchParams(href.split("?")[1]);
  assert.equal(q.get("vue"), null, "la vue par défaut ne s'écrit pas");
  assert.deepEqual([q.get("campagne"), q.get("from"), q.get("to"), q.get("inconnu")], ["c1", "2026-09-01", "2026-09-07", "x"]);
});

test("retirer un réglage le sort de l'URL", () => {
  assert.equal(lienMeta({ campagne: "c1" }, { campagne: null }), "/meta");
});
