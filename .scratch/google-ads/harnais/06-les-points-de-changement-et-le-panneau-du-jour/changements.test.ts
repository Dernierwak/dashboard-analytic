// Harnais du ticket 06 de la construction Google Ads — les points de
// changement de la Tendance et le Panneau du jour (`lib/google/changements.ts`,
// `lib/google/liens.ts`).
// Lancer : sh .scratch/google-ads/harnais/06-les-points-de-changement-et-le-panneau-du-jour/lancer.sh
//
// Entrées écrites à la main sous la forme que PostgREST rend pour
// `platform_changes` (channel = 'google') : Google écrit l'heure du COMPTE sans
// décalage, le `timestamptz` la garde telle quelle (« …T14:03:22+00:00 »).
// Période figée : semaine du 28 sept. au 4 oct. 2026.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  aideJournal,
  CE_QUE_PULSE_GARDE,
  changementDe,
  jourOuvertDe,
  joursMarques,
  panneauDe,
  type LigneChangementGoogle,
} from "@/lib/google/changements";
import { lienGoogle, sansJour, SANS_PANNEAU } from "@/lib/google/liens";
import type { Campagne, Periode } from "@/lib/google/lecture";

const PERIODE: Periode = {
  debut: "2026-09-28",
  fin: "2026-10-04",
  avantDebut: "2026-09-21",
  avantFin: "2026-09-27",
  jours: 7,
  parDefaut: true,
  rognee: false,
  arreteeAuDernierJourLu: false,
};
const DATES = ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"];

let n = 0;
function ligne(sur: Partial<LigneChangementGoogle> = {}): LigneChangementGoogle {
  n += 1;
  return {
    change_id: `c${n}`,
    occurred_at: "2026-09-29T10:00:00+00:00",
    categorie: "budget",
    campaign_id: "111",
    campaign_name: "Search marque",
    resume: "le budget quotidien a été modifié",
    ...sur,
  };
}
const lire = (lignes: LigneChangementGoogle[]) => lignes.flatMap((l) => changementDe(l) ?? []);

const CAMPAGNES: Campagne[] = [
  { cle: "111", nom: "Search marque (nom récent)", sansId: false, cout: 10, couleur: "#2a78d6" },
  { cle: "222", nom: "PMax", sansId: false, cout: 5, couleur: "#eb6834" },
];

// ── Le jour d'un changement ──────────────────────────────────────────────────

test("le jour et l'heure sont ceux écrits par Google (heure du compte), sans conversion", () => {
  // 23:30 « UTC » est en fait 23:30 à l'heure du compte : un fuseau appliqué
  // le pousserait au lendemain à Zurich.
  const [c] = lire([ligne({ occurred_at: "2026-09-29T23:30:12.11455+00:00" })]);
  assert.equal(c.jour, "2026-09-29");
  assert.equal(c.heure, "23:30");
});

test("une ligne sans phrase ou sans date ne devient pas un changement", () => {
  assert.equal(changementDe(ligne({ resume: "  " })), null);
  assert.equal(changementDe(ligne({ occurred_at: null })), null);
  assert.equal(changementDe(ligne({ occurred_at: "pas une date" })), null);
});

// ── Les points : un par jour ─────────────────────────────────────────────────

test("un point par JOUR, pas par changement, avec le nombre du jour", () => {
  const journal = lire([
    ligne({ occurred_at: "2026-09-29T09:00:00+00:00" }),
    ligne({ occurred_at: "2026-09-29T09:00:00+00:00", categorie: "motcle", resume: "le mot-clé \"x\" a été ajouté" }),
    ligne({ occurred_at: "2026-09-29T17:45:00+00:00", campaign_id: "222" }),
    ligne({ occurred_at: "2026-10-02T08:00:00+00:00" }),
  ]);
  assert.deepEqual(joursMarques(journal, null, DATES), [
    { index: 1, nombre: 3 },
    { index: 4, nombre: 1 },
  ]);
});

test("aucun point hors des dates de la période (la veille débordée ne marque rien)", () => {
  const journal = lire([ligne({ occurred_at: "2026-09-27T12:00:00+00:00" }), ligne({ occurred_at: "2026-10-05T01:00:00+00:00" })]);
  assert.deepEqual(joursMarques(journal, null, DATES), []);
});

// ── Le filtre campagne ───────────────────────────────────────────────────────

test("filtré par campagne : ses groupes, mots-clés et annonces compris, les autres campagnes non", () => {
  // Google pose la campagne sur chaque `change_event`, groupe et annonce
  // compris : le filtre par ID les garde tous.
  const journal = lire([
    ligne({ occurred_at: "2026-09-29T09:00:00+00:00", categorie: "statut", resume: "le groupe d'annonces \"A\" a été mis en pause" }),
    ligne({ occurred_at: "2026-09-29T10:00:00+00:00", categorie: "creatif", resume: "une annonce a été retirée de la campagne \"Search marque\"" }),
    ligne({ occurred_at: "2026-09-30T10:00:00+00:00", campaign_id: "222" }),
  ]);
  assert.deepEqual(joursMarques(journal, "111", DATES), [{ index: 1, nombre: 2 }]);
  assert.deepEqual(joursMarques(journal, "222", DATES), [{ index: 2, nombre: 1 }]);
});

test("un changement sans campagne connue n'apparaît que sans filtre, et le panneau filtré le compte", () => {
  const journal = lire([
    ligne({ occurred_at: "2026-09-29T09:00:00+00:00", campaign_id: null, campaign_name: null, categorie: "creatif", resume: "une accroche au niveau du compte a été ajoutée" }),
    ligne({ occurred_at: "2026-09-29T10:00:00+00:00" }),
  ]);
  assert.deepEqual(joursMarques(journal, null, DATES), [{ index: 1, nombre: 2 }]);
  assert.deepEqual(joursMarques(journal, "111", DATES), [{ index: 1, nombre: 1 }]);

  const filtre = panneauDe(journal, "2026-09-29", "111", CAMPAGNES);
  assert.equal(filtre.total, 1);
  assert.equal(filtre.nonRattaches, 1);
  assert.deepEqual(filtre.campagnes.map((c) => c.id), ["111"]);

  const sans = panneauDe(journal, "2026-09-29", null, CAMPAGNES);
  assert.equal(sans.total, 2);
  assert.equal(sans.nonRattaches, 0);
  // La campagne inconnue se range en dernier.
  assert.deepEqual(sans.campagnes.map((c) => c.id), ["111", null]);
});

test("une chaîne vide en campaign_id veut dire « pas retrouvée », pas une campagne", () => {
  const journal = lire([ligne({ campaign_id: "" })]);
  assert.deepEqual(joursMarques(journal, "111", DATES), []);
  assert.equal(panneauDe(journal, "2026-09-29", "111", CAMPAGNES).nonRattaches, 1);
});

// ── Le panneau du jour ───────────────────────────────────────────────────────

test("le panneau range le jour par campagne, dans l'ordre des heures, sous le nom récent des insights", () => {
  const journal = lire([
    ligne({ occurred_at: "2026-09-29T15:00:00+00:00", campaign_id: "222", campaign_name: "PMax ancien nom", categorie: "enchere", resume: "la stratégie d'enchères a été changée" }),
    ligne({ occurred_at: "2026-09-29T09:05:00+00:00", categorie: "budget", resume: "le budget quotidien est passé de 10,00 à 20,00 CHF" }),
    ligne({ occurred_at: "2026-09-29T11:00:00+00:00", categorie: "motcle", resume: "le mot-clé \"chaussures\" a été ajouté" }),
    ligne({ occurred_at: "2026-09-30T11:00:00+00:00" }),
    ligne({ occurred_at: "2026-09-29T12:00:00+00:00", campaign_id: "999", campaign_name: "Supprimée", categorie: "statut", resume: "la campagne \"Supprimée\" a été supprimée" }),
  ]);
  const p = panneauDe(journal, "2026-09-29", null, CAMPAGNES);
  assert.equal(p.total, 4);
  assert.deepEqual(
    p.campagnes.map((c) => [c.id, c.nom, c.couleur]),
    [
      ["111", "Search marque (nom récent)", "#2a78d6"],
      ["999", "Supprimée", "#c3c2bb"],
      ["222", "PMax", "#eb6834"],
    ]
  );
  assert.deepEqual(
    p.campagnes[0].cartes.map((c) => [c.heure, c.nature, c.phrase]),
    [
      ["09:05", "Budget", "le budget quotidien est passé de 10,00 à 20,00 CHF"],
      ["11:00", "Mot-clé", "le mot-clé \"chaussures\" a été ajouté"],
    ]
  );
});

test("un jour sans changement rend un panneau vide, pas une erreur", () => {
  const p = panneauDe(lire([ligne()]), "2026-10-01", null, CAMPAGNES);
  assert.equal(p.total, 0);
  assert.deepEqual(p.campagnes, []);
});

// ── Le jour dans l'URL ───────────────────────────────────────────────────────

test("un jour hors de la période ne s'ouvre pas ; un jour dedans, oui", () => {
  assert.equal(jourOuvertDe("2026-09-28", PERIODE), "2026-09-28");
  assert.equal(jourOuvertDe("2026-10-04", PERIODE), "2026-10-04");
  assert.equal(jourOuvertDe("2026-09-27", PERIODE), null);
  assert.equal(jourOuvertDe("2026-10-05", PERIODE), null);
  assert.equal(jourOuvertDe("2026-02-30", PERIODE), null);
  assert.equal(jourOuvertDe("hier", PERIODE), null);
  assert.equal(jourOuvertDe(undefined, PERIODE), null);
});

test("ouvrir un jour écrit le jour, retire l'annonce, et garde tout le reste", () => {
  const params = { vue: "trafic", campagne: "111", from: "2026-09-01", to: "2026-09-30", annonce: "555", inconnu: ["a", "b"] };
  const url = new URL(lienGoogle(params, { ...SANS_PANNEAU, jour: "2026-09-29" }), "https://x");
  assert.equal(url.pathname, "/google");
  assert.equal(url.searchParams.get("jour"), "2026-09-29");
  assert.equal(url.searchParams.get("annonce"), null);
  assert.equal(url.searchParams.get("vue"), "trafic");
  assert.equal(url.searchParams.get("campagne"), "111");
  assert.equal(url.searchParams.get("from"), "2026-09-01");
  assert.deepEqual(url.searchParams.getAll("inconnu"), ["a", "b"]);
});

test("les paramètres du rendu serveur ne portent pas le jour (le navigateur le tient)", () => {
  assert.deepEqual(sansJour({ vue: "trafic", jour: "2026-09-29" }), { vue: "trafic" });
  assert.equal(lienGoogle(sansJour({ jour: "2026-09-29" }), SANS_PANNEAU), "/google");
});

// ── La « ⓘ » de la légende ───────────────────────────────────────────────────

test("la liste des catégories gardées est celle écrite à côté de la récolte, mot pour mot", () => {
  const source = readFileSync(
    new URL("../../../../saas/data/fetch_data/sources/google/ads/fetchers/changes.py", import.meta.url),
    "utf8"
  );
  const bloc = source.match(/^CE_QUE_PULSE_GARDE[^{]*\{([\s\S]*?)^\}/m);
  assert.ok(bloc, "CE_QUE_PULSE_GARDE introuvable dans changes.py");
  const python = [...bloc[1].matchAll(/^\s*"(\w+)":\s*"([^"]*)",?\s*$/gm)].map((m) => [m[1], m[2]]);
  assert.ok(python.length >= 6);
  assert.deepEqual(Object.entries(CE_QUE_PULSE_GARDE), python);
  const aide = aideJournal("2026-08-12");
  for (const [, phrase] of python) assert.ok(aide.includes(phrase), `absent de la ⓘ : ${phrase}`);
});

test("la ⓘ dit depuis quand le journal existe, ou qu'on ne le sait pas", () => {
  assert.match(aideJournal("2026-08-12"), /depuis le 12 août 2026/);
  const inconnue = aideJournal(null);
  assert.doesNotMatch(inconnue, /depuis le \d/);
  assert.match(inconnue, /n'a pas pu être lue/);
  assert.match(inconnue, /Un jour sans point n'est donc pas un jour où rien n'a changé/);
});
