// Harnais du ticket 11 — les changements posés sur la Tendance.
//
// Même seam que le 06 : « lignes de base + commandes → contenu des modules »,
// par `saas/web/lib/meta/changements.ts`. Ce que la Tendance MARQUE (quels
// jours portent un point) et ce que le Panneau latéral LISTE (quels
// changements, sous quelle campagne, combien d'écartés) se vérifient ici ; le
// point qui grossit, le clic et « retour » se voient dans Chrome. Lancer
// depuis la racine du dépôt :
//
//     node --import ./.scratch/meta-ads/harnais/09-le-tableau/resoudre.mjs \
//          --test .scratch/meta-ads/harnais/11-les-changements/changements.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  changementDe,
  jourOuvertDe,
  joursMarques,
  panneauDuJour,
  type ChangementMeta,
  type LigneChangement,
} from "../../../../saas/web/lib/meta/changements.ts";
import { campagnesDe, periodeDe, type LigneMeta } from "../../../../saas/web/lib/meta/lecture.ts";
import { lienMeta } from "../../../../saas/web/lib/meta/liens.ts";

// Lundi 5 octobre 2026, Jour de travail lundi : la semaine mesurée va du lundi
// 28 septembre au dimanche 4 octobre.
const CTX = { aujourdhui: "2026-10-05", dernierJourDeTravail: "2026-10-05" };
const PERIODE = periodeDe({}, CTX);
const DATES = ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"];

function brut(p: Partial<LigneChangement>): LigneChangement {
  return {
    change_id: "x",
    occurred_at: "2026-09-30T09:12:00+00:00",
    categorie: "budget",
    campaign_id: "c1",
    campaign_name: "Soldes",
    resume: 'le budget du groupe d\'annonces "Acheteurs" est passé de 40,00 à 60,00 CHF',
    fuseau: null,
    ...p,
  };
}
const ch = (p: Partial<LigneChangement>): ChangementMeta => changementDe(brut(p))!;

function ligne(p: Partial<LigneMeta> & { date: string }): LigneMeta {
  return {
    campagneId: "c1",
    campagneNom: "Soldes",
    groupeId: "g1",
    groupeNom: "Acheteurs",
    annonceId: "a1",
    annonceNom: "Carrousel",
    depense: 10,
    impressions: 100,
    clics: 1,
    ...p,
  };
}

// ── Une ligne de base → un changement ────────────────────────────────────────

test("00:30 à Zurich se pose sur le jour même, à l'heure de Zurich (ticket 17)", () => {
  // Meta écrit l'instant en UTC : 22:30 UTC le 30 septembre = 00:30 le 1er
  // octobre à Zurich (heure d'été, UTC+2).
  const c = ch({ occurred_at: "2026-09-30T22:30:00+00:00", fuseau: "Europe/Zurich" });
  assert.equal(c.jour, "2026-10-01");
  assert.equal(c.heure, "00:30");
  assert.equal(c.fuseau, "Europe/Zurich");
});

test("un fuseau à l'ouest de UTC recule le jour", () => {
  const c = ch({ occurred_at: "2026-10-01T02:00:00+00:00", fuseau: "America/New_York" });
  assert.equal(c.jour, "2026-09-30");
  assert.equal(c.heure, "22:00");
});

test("l'heure d'hiver se lit aussi : Zurich est à UTC+1 en décembre", () => {
  const c = ch({ occurred_at: "2026-12-01T23:30:00+00:00", fuseau: "Europe/Zurich" });
  assert.equal(c.jour, "2026-12-02");
  assert.equal(c.heure, "00:30");
});

test("sans fuseau récolté, le jour et l'heure restent en UTC, et le changement le dit", () => {
  const c = ch({ occurred_at: "2026-10-01T00:30:00+02:00", fuseau: null });
  assert.equal(c.jour, "2026-09-30");
  assert.equal(c.heure, "22:30");
  assert.equal(c.fuseau, null);
});

test("un fuseau illisible se traite comme un fuseau absent, sans faire tomber la page", () => {
  const c = ch({ occurred_at: "2026-09-30T22:30:00+00:00", fuseau: "Mars/Olympus" });
  assert.equal(c.jour, "2026-09-30");
  assert.equal(c.fuseau, null);
});

test("minuit pile se lit 00:00, pas 24:00", () => {
  const c = ch({ occurred_at: "2026-09-30T22:00:00+00:00", fuseau: "Europe/Zurich" });
  assert.equal(c.jour, "2026-10-01");
  assert.equal(c.heure, "00:00");
});

test("une ligne sans phrase ou sans date ne devient pas un changement", () => {
  assert.equal(changementDe(brut({ resume: "  " })), null);
  assert.equal(changementDe(brut({ occurred_at: null })), null);
  assert.equal(changementDe(brut({ occurred_at: "pas une date" })), null);
});

test("la nature est dite en français ; une catégorie inconnue se lit « Réglage »", () => {
  assert.equal(ch({ categorie: "audience" }).nature, "Ciblage");
  assert.equal(ch({ categorie: "creatif" }).nature, "Visuel");
  assert.equal(ch({ categorie: "creation" }).nature, "Création");
  assert.equal(ch({ categorie: "nouveaute" }).nature, "Réglage");
});

// ── Les points de la Tendance ────────────────────────────────────────────────

test("un point par jour, pas par changement, et il compte les changements du jour", () => {
  const chs = [ch({ change_id: "1" }), ch({ change_id: "2", occurred_at: "2026-09-30T16:00:00+00:00" }), ch({ change_id: "3", occurred_at: "2026-10-02T08:00:00+00:00" })];
  assert.deepEqual(joursMarques(chs, null, DATES), [
    { index: 2, nombre: 2 },
    { index: 4, nombre: 1 },
  ]);
});

test("un changement hors de la période ne pose aucun point", () => {
  assert.deepEqual(joursMarques([ch({ occurred_at: "2026-09-20T09:00:00+00:00" })], null, DATES), []);
});

test("sous un filtre, les changements de groupe et d'annonce de la campagne comptent ; ceux des autres non", () => {
  const chs = [
    ch({ change_id: "groupe", campaign_id: "c1" }),
    ch({ change_id: "autre", campaign_id: "c2", occurred_at: "2026-10-01T09:00:00+00:00" }),
  ];
  assert.deepEqual(joursMarques(chs, "c1", DATES), [{ index: 2, nombre: 1 }]);
});

test("un changement dont la campagne est inconnue ne pose un point que sans filtre", () => {
  const chs = [ch({ campaign_id: null, campaign_name: null })];
  assert.deepEqual(joursMarques(chs, null, DATES), [{ index: 2, nombre: 1 }]);
  assert.deepEqual(joursMarques(chs, "c1", DATES), []);
});

test("une campagne sans ID (d'avant le rejeu) n'attrape aucun changement par son nom", () => {
  const chs = [ch({ campaign_id: "c1", campaign_name: "Soldes" })];
  assert.deepEqual(joursMarques(chs, "sans-id:Soldes", DATES), []);
});

// ── Le Panneau latéral d'un jour ─────────────────────────────────────────────

const CAMPAGNES = campagnesDe(
  [
    ligne({ date: "2026-09-28", campagneId: "c1", campagneNom: "Soldes", depense: 50 }),
    ligne({ date: "2026-10-03", campagneId: "c1", campagneNom: "Soldes d'automne", depense: 50 }),
    ligne({ date: "2026-09-29", campagneId: "c2", campagneNom: "Relance", depense: 10 }),
  ],
  PERIODE
);

const JOUR = [
  ch({ change_id: "r", campaign_id: "c2", campaign_name: "Relance", occurred_at: "2026-09-30T14:02:00+00:00", resume: "relance" }),
  ch({ change_id: "s2", campaign_id: "c1", occurred_at: "2026-09-30T11:24:00+00:00", resume: "deuxième" }),
  ch({ change_id: "s1", campaign_id: "c1", occurred_at: "2026-09-30T11:20:00+00:00", resume: "premier" }),
  ch({ change_id: "perdu", campaign_id: null, campaign_name: null, occurred_at: "2026-09-30T18:30:00+00:00", resume: "orphelin" }),
  ch({ change_id: "veille", campaign_id: "c1", occurred_at: "2026-09-29T10:00:00+00:00", resume: "la veille" }),
];

test("le panneau range le jour par campagne, sous le nom le plus récent, chaque changement à son heure", () => {
  const p = panneauDuJour(JOUR, "2026-09-30", null, CAMPAGNES);
  assert.deepEqual(
    p.groupes.map((g) => [g.nom, g.lignes.map((l) => `${l.heure} ${l.phrase}`)]),
    [
      ["Soldes d'automne", ["11:20 premier", "11:24 deuxième"]],
      ["Relance", ["14:02 relance"]],
      [null, ["18:30 orphelin"]],
    ]
  );
  assert.equal(p.total, 4);
  assert.equal(p.nonRattaches, 0);
});

test("filtré, le panneau ne montre que la campagne, et compte en une ligne ce qui n'a pas de campagne", () => {
  const p = panneauDuJour(JOUR, "2026-09-30", "c1", CAMPAGNES);
  assert.deepEqual(p.groupes.map((g) => g.nom), ["Soldes d'automne"]);
  assert.equal(p.total, 2);
  assert.equal(p.nonRattaches, 1);
});

test("la pastille d'un groupe est celle de la campagne dans le Bandeau", () => {
  const p = panneauDuJour(JOUR, "2026-09-30", null, CAMPAGNES);
  assert.equal(p.groupes[0].couleur, CAMPAGNES.find((c) => c.cle === "c1")!.couleur);
});

test("une campagne absente des chiffres de la période garde le nom que porte le changement", () => {
  const p = panneauDuJour([ch({ campaign_id: "c9", campaign_name: "Hiver" })], "2026-09-30", null, CAMPAGNES);
  assert.equal(p.groupes[0].nom, "Hiver");
});

// ── Le jour ouvert, dans l'URL ───────────────────────────────────────────────

test("un jour de la période s'ouvre ; un jour hors de la période ou illisible, non", () => {
  assert.equal(jourOuvertDe("2026-09-30", PERIODE), "2026-09-30");
  assert.equal(jourOuvertDe("2026-09-27", PERIODE), null);
  assert.equal(jourOuvertDe("2026-10-05", PERIODE), null); // le jour en cours
  assert.equal(jourOuvertDe("30/09/2026", PERIODE), null);
  assert.equal(jourOuvertDe("2026-02-30", PERIODE), null);
  assert.equal(jourOuvertDe(undefined, PERIODE), null);
});

test("ouvrir un jour ne touche que `jour` et retire `annonce`, le reste est gardé", () => {
  const params = { vue: "trafic", campagne: "c1", annonce: "a1", comparer: ["a1", "a2"] };
  assert.equal(lienMeta(params, { jour: "2026-09-30", annonce: null }), "/meta?vue=trafic&campagne=c1&comparer=a1&comparer=a2&jour=2026-09-30");
});

test("le panneau range un jour dans l'ordre des instants, même quand une ligne n'a pas de fuseau", () => {
  // Pendant la transition (avant le passage du worker), une ligne sans fuseau
  // s'écrit en UTC : « 00:30 » (UTC) a eu lieu APRÈS « 01:00 » (Zurich), et
  // un tri sur le texte de l'heure les inverserait.
  const chs = [
    ch({ change_id: "zurich", occurred_at: "2026-09-30T23:00:00+00:00", fuseau: "Europe/Zurich" }), // 01:00 le 1er
    ch({ change_id: "utc", occurred_at: "2026-10-01T00:30:00+00:00", fuseau: null }), // 00:30 UTC le 1er
  ];
  const p = panneauDuJour(chs, "2026-10-01", null, CAMPAGNES);
  assert.deepEqual(p.groupes[0].lignes.map((l) => l.id), ["zurich", "utc"]);
});

test("au retour à l'heure d'hiver, les deux 02:30 se rangent dans l'ordre où ils ont eu lieu", () => {
  // 25 octobre 2026, Zurich : 02:30 UTC+2 (00:30Z) puis 02:30 UTC+1 (01:30Z).
  const chs = [
    ch({ change_id: "second", occurred_at: "2026-10-25T01:30:00+00:00", fuseau: "Europe/Zurich" }),
    ch({ change_id: "premier", occurred_at: "2026-10-25T00:30:00+00:00", fuseau: "Europe/Zurich" }),
  ];
  const p = panneauDuJour(chs, "2026-10-25", null, CAMPAGNES);
  assert.deepEqual(p.groupes[0].lignes.map((l) => [l.id, l.heure]), [["premier", "02:30"], ["second", "02:30"]]);
});
