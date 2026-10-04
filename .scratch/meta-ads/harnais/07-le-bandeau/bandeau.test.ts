// Harnais du ticket 07 — le Bandeau de commandes complet.
//
// Même seam que le 06 : « lignes de base + commandes → contenu des modules »,
// par les fonctions pures de `saas/web/lib/meta/`. Ce que le Bandeau AFFICHE
// (la dépense de chaque campagne, sa pastille, les raccourcis, les cases du
// calendrier) et ce qu'il ÉCRIT dans l'URL se vérifient ici ; la pilule et les
// menus, eux, ne se voient que dans Chrome. Lancer depuis la racine du dépôt :
//
//     node --test .scratch/meta-ads/harnais/07-le-bandeau/bandeau.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  contenuPage,
  moisCalendrier,
  moisVoisin,
  periodeDe,
  periodeEntre,
  PALETTE_CAMPAGNES,
  type LigneMeta,
} from "../../../../saas/web/lib/meta/lecture.ts";
import { lienMeta } from "../../../../saas/web/lib/meta/liens.ts";

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

/** Relit une URL du Bandeau comme le ferait la page qui la reçoit. */
function relire(href: string) {
  const q = new URLSearchParams(href.split("?")[1] ?? "");
  return Object.fromEntries(q.entries());
}

// ── Le menu des campagnes ────────────────────────────────────────────────────

test("la dépense du menu est celle de la période, pas celle d'avant", () => {
  const lignes = [
    ligne({ date: "2026-09-22", depense: 100 }), // période d'avant
    ligne({ date: "2026-09-29", depense: 7 }),
  ];
  assert.equal(contenuPage(lignes, {}, CTX).campagnes[0].depense, 7);
});

test("une campagne qui n'a dépensé qu'avant reste choisissable, sa dépense est « — », pas 0", () => {
  const lignes = [
    ligne({ date: "2026-09-29", campagneId: "c1", depense: 7 }),
    ligne({ date: "2026-09-22", campagneId: "c2", campagneNom: "Arrêtée", depense: 50 }),
  ];
  const c = contenuPage(lignes, {}, CTX).campagnes;
  assert.deepEqual(c.map((x) => [x.cle, x.depense]), [["c1", 7], ["c2", null]]);
});

test("une dépense de zéro rendue par Meta reste un zéro", () => {
  const c = contenuPage([ligne({ date: "2026-09-29", depense: 0 })], {}, CTX).campagnes;
  assert.equal(c[0].depense, 0);
});

test("la pastille suit la campagne, pas son rang : elle ne change pas quand la dépense reclasse le menu", () => {
  const avant = contenuPage(
    [
      ligne({ date: "2026-09-29", campagneId: "c1", depense: 90 }),
      ligne({ date: "2026-09-29", campagneId: "c2", depense: 10 }),
    ],
    {},
    CTX
  ).campagnes;
  const apres = contenuPage(
    [
      ligne({ date: "2026-09-29", campagneId: "c1", depense: 10 }),
      ligne({ date: "2026-09-29", campagneId: "c2", depense: 90 }),
    ],
    {},
    CTX
  ).campagnes;
  const couleurs = (cs: typeof avant) => Object.fromEntries(cs.map((c) => [c.cle, c.couleur]));
  assert.notEqual(avant[0].cle, apres[0].cle, "le classement a bien changé");
  assert.deepEqual(couleurs(avant), couleurs(apres));
});

test("choisir une campagne ne repeint pas les pastilles des autres", () => {
  const lignes = [
    ligne({ date: "2026-09-29", campagneId: "c1", depense: 1 }),
    ligne({ date: "2026-09-29", campagneId: "c2", depense: 2 }),
    ligne({ date: "2026-09-29", campagneId: "c3", depense: 3 }),
  ];
  const toutes = contenuPage(lignes, {}, CTX).campagnes;
  const une = contenuPage(lignes, { campagne: "c2" }, CTX).campagnes;
  assert.deepEqual(une.map((c) => c.couleur), toutes.map((c) => c.couleur));
});

test("huit campagnes ont huit couleurs distinctes ; au-delà, un gris neutre, jamais une couleur réutilisée", () => {
  const lignes = Array.from({ length: 10 }, (_, i) =>
    ligne({ date: "2026-09-29", campagneId: `c${i}`, annonceId: `a${i}`, depense: i })
  );
  const couleurs = contenuPage(lignes, {}, CTX).campagnes.map((c) => c.couleur);
  const vives = couleurs.filter((c) => PALETTE_CAMPAGNES.includes(c));
  assert.equal(new Set(vives).size, 8);
  assert.equal(couleurs.length - vives.length, 2);
});

// ── Les raccourcis de période ────────────────────────────────────────────────

test("cinq raccourcis, de 7 jours à 12 semaines", () => {
  const r = contenuPage([], {}, CTX).raccourcis;
  assert.deepEqual(r.map((x) => x.jours), [7, 14, 28, 56, 84]);
});

test("un raccourci finit au dernier jour de la semaine mesurée, jamais au jour en cours", () => {
  const r = contenuPage([], {}, CTX).raccourcis.find((x) => x.jours === 28)!;
  assert.deepEqual([r.from, r.to], ["2026-09-07", "2026-10-04"]);
});

test("par défaut, « 7 derniers jours » est actif, et le choisir écrit ses dates : le lien ne glisse pas", () => {
  const r = contenuPage([], {}, CTX).raccourcis;
  assert.deepEqual(r.filter((x) => x.actif).map((x) => x.jours), [7]);
  const sept = r.find((x) => x.jours === 7)!;
  assert.deepEqual([sept.from, sept.to], ["2026-09-28", "2026-10-04"]);
  // Ouvert une semaine plus tard, le lien rouvre toujours la semaine vue.
  const plusTard = { aujourdhui: "2026-10-12", dernierJourDeTravail: "2026-10-12" };
  const p = periodeDe({ from: sept.from!, to: sept.to! }, plusTard);
  assert.deepEqual([p.debut, p.fin], ["2026-09-28", "2026-10-04"]);
});

test("un raccourci choisi rouvre la même période, comparée à la même durée d'avant", () => {
  const r = contenuPage([], {}, CTX).raccourcis.find((x) => x.jours === 56)!;
  const href = lienMeta({ vue: "trafic", campagne: "c1" }, { from: r.from, to: r.to });
  const params = relire(href);
  const p = periodeDe(params, CTX);
  assert.deepEqual([p.debut, p.fin, p.jours], ["2026-08-10", "2026-10-04", 56]);
  assert.deepEqual([p.avantDebut, p.avantFin], ["2026-06-15", "2026-08-09"]);
  assert.deepEqual([params.vue, params.campagne], ["trafic", "c1"], "le lien garde ce qu'il ne change pas");
  const rouverte = contenuPage([], params, CTX).raccourcis;
  assert.deepEqual(rouverte.filter((x) => x.actif).map((x) => x.jours), [56]);
});

test("une période sur mesure n'allume aucun raccourci", () => {
  const r = contenuPage([], { from: "2026-09-10", to: "2026-09-20" }, CTX).raccourcis;
  assert.equal(r.some((x) => x.actif), false);
});

test("quand la récolte a échoué, les raccourcis finissent au dernier jour lu", () => {
  const ctx = { ...CTX, dernierJourLu: "2026-09-30" };
  const r = contenuPage([], {}, ctx).raccourcis.find((x) => x.jours === 14)!;
  assert.deepEqual([r.from, r.to], ["2026-09-17", "2026-09-30"]);
  const p = periodeDe({ from: r.from!, to: r.to! }, ctx);
  assert.equal(p.jours, 14, "la période n'est pas rognée en silence");
});

// ── Le calendrier sur deux mois ──────────────────────────────────────────────

test("un mois commence le bon jour de semaine, lundi en tête", () => {
  // Le 1er septembre 2026 est un mardi : une case vide avant.
  const m = moisCalendrier("2026-09");
  assert.equal(m.nom, "septembre 2026");
  assert.deepEqual(m.cases.slice(0, 2), [null, "2026-09-01"]);
  assert.equal(m.cases.filter(Boolean).length, 30);
  assert.equal(m.cases.at(-1), "2026-09-30");
});

test("un mois qui commence un lundi n'a pas de case vide", () => {
  // Le 1er juin 2026 est un lundi.
  assert.equal(moisCalendrier("2026-06").cases[0], "2026-06-01");
});

test("février d'une année bissextile a 29 jours", () => {
  assert.equal(moisCalendrier("2028-02").cases.filter(Boolean).length, 29);
});

test("on passe d'un mois à l'autre, y compris par-dessus l'année", () => {
  assert.equal(moisVoisin("2026-01", -1), "2025-12");
  assert.equal(moisVoisin("2026-12", 1), "2027-01");
  assert.equal(moisVoisin("2026-10", -1), "2026-09");
});

// ── L'URL ────────────────────────────────────────────────────────────────────

test("deux jours cliqués à l'envers donnent la même période qu'à l'endroit", () => {
  assert.deepEqual(periodeEntre("2026-09-20", "2026-09-10"), { from: "2026-09-10", to: "2026-09-20" });
  assert.deepEqual(periodeEntre("2026-09-10", "2026-09-20"), { from: "2026-09-10", to: "2026-09-20" });
});

test("un seul jour cliqué deux fois est une période d'un jour, comparée à la veille", () => {
  const p = periodeDe(periodeEntre("2026-09-15", "2026-09-15"), CTX);
  assert.deepEqual([p.debut, p.fin, p.jours, p.avantDebut], ["2026-09-15", "2026-09-15", 1, "2026-09-14"]);
});
