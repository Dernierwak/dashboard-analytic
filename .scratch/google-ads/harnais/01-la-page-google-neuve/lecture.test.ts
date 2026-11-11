// Harnais du ticket 01 de la construction Google Ads — la lecture
// `lib/google/lecture.ts` et les liens `lib/google/liens.ts`.
// Lancer : sh .scratch/google-ads/harnais/01-la-page-google-neuve/lancer.sh
// (Node ≥ 23.6, type stripping natif ; `resoudre.mjs` ajoute `.ts` et `@/`).
//
// Valeurs attendues calculées à la main, à partir des règles de la spec
// (§ « Les vues et leurs métriques ») : taux total ÷ total, diviseur nul → « — ».
// Contexte figé : lundi 2026-10-05 est le dernier Jour de travail → semaine
// mesurée 28 sept.–4 oct., période d'avant 21–27 sept.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contenuPage,
  formaterEcart,
  formaterValeur,
  lireToutesLesPages,
  METRIQUES,
  VUES,
  ORDRE_VUES,
  type LigneGoogle,
} from "@/lib/google/lecture";
import { lienGoogle } from "@/lib/google/liens";

const CTX = { aujourdhui: "2026-10-05", dernierJourDeTravail: "2026-10-05" };

function ligne(sur: Partial<LigneGoogle> = {}): LigneGoogle {
  return {
    date: "2026-09-28",
    campagneId: "111",
    campagneNom: "Search marque",
    cout: 10,
    impressions: 1000,
    clics: 50,
    conversions: 5,
    ...sur,
  };
}

const carte = (c: ReturnType<typeof contenuPage>, vue: string) => c.cartes.find((x) => x.vue === vue)!;
const metrique = (c: ReturnType<typeof contenuPage>, cle: string) => c.tendance.find((m) => m.cle === cle)!;

// ── Les vues et leurs métriques ──────────────────────────────────────────────

test("trois vues : Notoriété, Trafic, Conversion, avec les métriques de la spec", () => {
  assert.deepEqual(ORDRE_VUES, ["notoriete", "trafic", "conversion"]);
  assert.deepEqual(VUES.notoriete.metriques, ["impressions", "cpm"]);
  assert.deepEqual(VUES.trafic.metriques, ["clics", "ctr", "cpc"]);
  assert.deepEqual(VUES.conversion.metriques, ["conversions", "cout_conversion", "taux_conversion"]);
});

test("le mot « moyenne » n'apparaît dans aucun texte des métriques ni des vues", () => {
  const textes = [
    ...Object.values(METRIQUES).flatMap((m) => [m.nom, m.aide]),
    ...Object.values(VUES).flatMap((v) => [v.titre, v.question]),
  ];
  for (const t of textes) assert.doesNotMatch(t.toLowerCase(), /moyen/);
});

test("la ⓘ d'impressions et de clics dit que ces totaux mêlent des types de campagnes", () => {
  assert.match(METRIQUES.impressions.aide, /types de campagnes/);
  assert.match(METRIQUES.clics.aide, /types de campagnes/);
});

test("le taux de conversion écrit son dénominateur : conversions ÷ clics", () => {
  const c = contenuPage([ligne()], { vue: "conversion" }, CTX);
  assert.equal(metrique(c, "taux_conversion").precision, "conversions ÷ clics");
});

// ── Taux total ÷ total ───────────────────────────────────────────────────────

test("les taux se calculent sur les totaux, pas en moyenne des lignes", () => {
  // A : 10 CHF, 1 000 impr., 50 clics, 5 conv. ; B : 30 CHF, 3 000 impr., 10 clics, 0 conv.
  // CTR total = 60 / 4 000 × 100 = 1,5 % (la moyenne des CTR ferait (5 + 0,333)/2 = 2,67 %).
  const lignes = [ligne(), ligne({ campagneId: "222", campagneNom: "PMax", cout: 30, impressions: 3000, clics: 10, conversions: 0 })];
  const n = contenuPage(lignes, { vue: "notoriete" }, CTX);
  assert.equal(metrique(n, "impressions").valeur, 4000);
  assert.equal(metrique(n, "cpm").valeur, 10); // 40 / 4 000 × 1 000
  const t = contenuPage(lignes, { vue: "trafic" }, CTX);
  assert.equal(metrique(t, "clics").valeur, 60);
  assert.equal(metrique(t, "ctr").valeur, 1.5);
  assert.equal(metrique(t, "cpc").valeur, 40 / 60);
  const v = contenuPage(lignes, { vue: "conversion" }, CTX);
  assert.equal(metrique(v, "conversions").valeur, 5);
  assert.equal(metrique(v, "cout_conversion").valeur, 8); // 40 / 5
  assert.equal(metrique(v, "taux_conversion").valeur, 5 / 60 * 100);
});

test("diviseur nul → « — » : aucun clic, aucune conversion", () => {
  const c = contenuPage([ligne({ clics: 0, conversions: 0 })], { vue: "conversion" }, CTX);
  assert.equal(metrique(c, "cout_conversion").valeur, null);
  assert.equal(metrique(c, "taux_conversion").valeur, null);
  assert.equal(formaterValeur("cout_conversion", null), "—");
});

test("aucun « +∞ % » : un écart sans base est « — »", () => {
  // Rien avant, 1 000 impressions cette semaine.
  const c = contenuPage([ligne()], { vue: "notoriete" }, CTX);
  assert.equal(carte(c, "notoriete").ecart, null);
  assert.equal(formaterEcart(carte(c, "notoriete").ecart), "—");
  // Une base à 0 conversion : pas d'écart non plus.
  const d = contenuPage([ligne({ date: "2026-09-21", conversions: 0 }), ligne()], { vue: "conversion" }, CTX);
  assert.equal(carte(d, "conversion").ecart, null);
  for (const m of d.tendance) assert.doesNotMatch(formaterEcart(m.ecart), /∞/);
});

test("la période est comparée à la période d'avant de même durée", () => {
  const lignes = [ligne({ date: "2026-09-21", impressions: 800 }), ligne({ impressions: 1000 })];
  const c = contenuPage(lignes, { vue: "notoriete" }, CTX);
  assert.equal(c.periode.debut, "2026-09-28");
  assert.equal(c.periode.fin, "2026-10-04");
  assert.equal(c.periode.avantDebut, "2026-09-21");
  assert.equal(c.periode.avantFin, "2026-09-27");
  assert.equal(carte(c, "notoriete").ecart, 25);
  // Période choisie de 3 jours → avant de 3 jours.
  const p = contenuPage(lignes, { from: "2026-09-29", to: "2026-10-01" }, CTX).periode;
  assert.deepEqual([p.avantDebut, p.avantFin, p.jours], ["2026-09-26", "2026-09-28", 3]);
});

// ── Le jour en cours, les trous ──────────────────────────────────────────────

test("le jour en cours n'entre dans aucun chiffre", () => {
  const lignes = [ligne({ date: "2026-10-04" }), ligne({ date: "2026-10-05", impressions: 99_999 })];
  const c = contenuPage(lignes, { from: "2026-10-01", to: "2026-10-05" }, CTX);
  assert.equal(c.periode.fin, "2026-10-04");
  assert.equal(c.periode.rognee, true);
  assert.equal(metrique(contenuPage(lignes, { from: "2026-10-01", to: "2026-10-05", vue: "notoriete" }, CTX), "impressions").valeur, 1000);
});

test("un jour sans ligne est un trou dans la Tendance, pas un zéro", () => {
  const c = contenuPage([ligne({ date: "2026-09-28" }), ligne({ date: "2026-09-30" })], { vue: "notoriete" }, CTX);
  const serie = metrique(c, "impressions").serie;
  assert.equal(serie.length, 7);
  assert.deepEqual(serie.slice(0, 3), [1000, null, 1000]);
  // La période d'avant, sans aucune ligne, n'est que des trous.
  assert.ok(metrique(c, "impressions").serieAvant.every((v) => v === null));
});

test("une sélection sans ligne n'a pas « 0 impression » : elle n'a rien de mesuré", () => {
  const c = contenuPage([], { vue: "notoriete" }, CTX);
  assert.equal(carte(c, "notoriete").valeur, null);
});

test("les taux de la Tendance se recalculent jour par jour depuis les comptes", () => {
  const lignes = [ligne(), ligne({ campagneId: "222", impressions: 3000, clics: 10 })];
  const c = contenuPage(lignes, { vue: "trafic" }, CTX);
  assert.equal(metrique(c, "ctr").serie[0], 1.5);
});

// ── Les campagnes, par leur ID ───────────────────────────────────────────────

test("une campagne renommée reste une ligne, sous son nom le plus récent", () => {
  const lignes = [
    ligne({ date: "2026-09-28", campagneNom: "Ancien nom" }),
    ligne({ date: "2026-10-02", campagneNom: "Nouveau nom" }),
    ligne({ date: "2026-09-29", campagneId: "222", campagneNom: "Autre" }),
  ];
  const c = contenuPage(lignes, {}, CTX);
  assert.equal(c.campagnes.length, 2);
  const a = c.campagnes.find((x) => x.cle === "111")!;
  assert.equal(a.nom, "Nouveau nom");
  assert.equal(a.cout, 20);
});

test("choisir une campagne resserre le Sélecteur et la Tendance", () => {
  const lignes = [ligne(), ligne({ campagneId: "222", campagneNom: "PMax", impressions: 3000 })];
  const c = contenuPage(lignes, { campagne: "222", vue: "notoriete" }, CTX);
  assert.equal(carte(c, "notoriete").valeur, 3000);
  assert.equal(metrique(c, "impressions").serie[0], 3000);
  assert.deepEqual(c.campagneChoisie, { cle: "222", nom: "PMax", connue: true });
  // Le menu garde toutes les campagnes.
  assert.equal(c.campagnes.length, 2);
});

test("une campagne inconnue ne retombe pas sur « toutes » : les chiffres sont vides", () => {
  const c = contenuPage([ligne()], { campagne: "999", vue: "notoriete" }, CTX);
  assert.equal(c.campagneChoisie?.connue, false);
  assert.equal(carte(c, "notoriete").valeur, null);
});

test("une vue illisible retombe sur la vue par défaut", () => {
  assert.equal(contenuPage([ligne()], { vue: "couts" }, CTX).vue, "notoriete");
});

// ── La pagination ────────────────────────────────────────────────────────────

test("plus de 1 000 lignes sont lues entières", async () => {
  const base = Array.from({ length: 2345 }, (_, i) => i);
  const lues = await lireToutesLesPages(async (de, a) => ({ data: base.slice(de, a + 1), error: null }));
  assert.equal(lues.length, 2345);
});

test("une erreur de lecture lève au lieu de se lire « table vide »", async () => {
  await assert.rejects(lireToutesLesPages(async () => ({ data: null, error: { message: "colonne absente" } })));
});

// ── Les liens ────────────────────────────────────────────────────────────────

test("un lien n'énumère que ce qu'il change et garde le reste, même inconnu", () => {
  const params = { vue: "trafic", campagne: "111", from: "2026-09-01", to: "2026-09-07", demain: "x" };
  const url = new URL(lienGoogle(params, { vue: "conversion" }), "https://p");
  assert.equal(url.pathname, "/google");
  assert.equal(url.searchParams.get("vue"), "conversion");
  assert.equal(url.searchParams.get("campagne"), "111");
  assert.equal(url.searchParams.get("from"), "2026-09-01");
  assert.equal(url.searchParams.get("demain"), "x");
});

test("null retire un paramètre ; la vue par défaut ne s'écrit pas", () => {
  assert.equal(lienGoogle({ campagne: "111", vue: "trafic" }, { campagne: null, vue: "notoriete" }), "/google");
});
