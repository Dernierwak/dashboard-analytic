// Harnais du ticket 13 — le journal Meta à l'écran.
//
// Seam : « lignes de `platform_changes` + portée de la page → ce que la page
// pose et ce que le panneau range » (`saas/web/lib/meta/changements.ts`) :
// quels jours portent un point, sur la Tendance et sur chaque ligne de la
// Comparaison ; combien de changements compte l'onglet ; comment le panneau
// range campagne › groupe d'annonces › annonce, le statut d'abord et regroupé.
// Le clic, le halo et le panneau qui s'ouvre se voient dans Chrome.
//
//     node --import ./.scratch/journal-meta/harnais/13/resoudre.mjs \
//          --test .scratch/journal-meta/harnais/13/*.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  changementDe,
  elementOuvertDe,
  joursMarques,
  marquesElement,
  nombreDeChangements,
  panneauDe,
  valeurElement,
  type Carte,
  type ChangementMeta,
  type LigneChangement,
  type Portee,
} from "../../../../saas/web/lib/meta/changements.ts";
import type { Campagne } from "../../../../saas/web/lib/meta/lecture.ts";

const DATES = ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"];
const TOUT: Portee = { campagne: null, groupe: null };
const CAMPAGNES: Campagne[] = [{ cle: "c1", nom: "Campagne A", sansId: false, depense: 10, couleur: "#2a78d6" }];
const NOMS = { g1: "Groupe B (insights)", a1: "Annonce C (insights)" };

let n = 0;
function brut(p: Partial<LigneChangement>): LigneChangement {
  n += 1;
  return {
    change_id: `x${n}`,
    occurred_at: "2026-09-30T14:10:00+00:00",
    categorie: "audience",
    campaign_id: "c1",
    campaign_name: "Campagne A",
    resume: "le ciblage du groupe d'annonces \"Groupe B\" a été modifié",
    fuseau: "Europe/Zurich",
    niveau: "groupe",
    object_id: "g1",
    object_name: "Groupe B",
    adset_id: "g1",
    extra_data: null,
    ...p,
  };
}
const ch = (p: Partial<LigneChangement>): ChangementMeta => changementDe(brut(p))!;

const statut = (objet: string, niveau: string, heure: string, avant: string, apres: string, adset = "g1") =>
  ch({
    categorie: "statut",
    niveau,
    object_id: objet,
    object_name: objet,
    adset_id: adset,
    occurred_at: `2026-09-30T${heure}:00+00:00`,
    extra_data: { old_value: avant, new_value: apres, type: "run_status" },
    resume: "le statut a changé",
  });

test("une ligne de base garde l'élément touché et lit `extra_data`", () => {
  const c = ch({ categorie: "objectif", extra_data: { old_value: null, new_value: "Vues", type: "optimization_goal" } });
  assert.equal(c.niveau, "groupe");
  assert.equal(c.objetId, "g1");
  assert.equal(c.groupeId, "g1");
  assert.equal(c.nature, "Objectif");
  assert.equal(c.lecture.forme, "rubriques");
});

test("une ligne d'avant le ticket 12 : ni niveau ni groupe, la phrase seule", () => {
  const c = ch({ niveau: null, object_id: null, object_name: null, adset_id: null, extra_data: null });
  assert.equal(c.niveau, null);
  assert.equal(c.groupeId, null);
  assert.deepEqual(c.lecture, { forme: "phrase" });
});

test("un niveau que l'écran ne connaît pas est lu comme absent", () => {
  assert.equal(ch({ niveau: "compte" }).niveau, null);
});

test("le statut d'un élément sur un jour compte pour UN changement (ticket 05)", () => {
  const chaine = [
    statut("a1", "annonce", "14:10", "Actif", "En attente de traitement"),
    statut("a1", "annonce", "14:25", "En attente de traitement", "En attente d'examen"),
    statut("a1", "annonce", "14:27", "En attente d'examen", "Actif"),
  ];
  assert.equal(nombreDeChangements([...chaine, ch({})]), 2);
  // Un autre élément, ou un autre jour, est une autre chaîne.
  assert.equal(nombreDeChangements([...chaine, statut("a2", "annonce", "14:10", "Actif", "Inactif")]), 2);
});

test("la Tendance : un point par jour, compté statut regroupé, filtré par le groupe", () => {
  const journal = [
    statut("a1", "annonce", "14:10", "Actif", "En attente de traitement"),
    statut("a1", "annonce", "14:25", "En attente de traitement", "Actif"),
    ch({ object_id: "g2", adset_id: "g2", occurred_at: "2026-09-28T09:00:00+00:00" }),
  ];
  assert.deepEqual(joursMarques(journal, TOUT, DATES), [
    { index: 0, nombre: 1 },
    { index: 2, nombre: 1 },
  ]);
  assert.deepEqual(joursMarques(journal, { campagne: "c1", groupe: "g2" }, DATES), [{ index: 0, nombre: 1 }]);
});

test("sous un filtre de groupe, un changement de campagne ne se montre pas et ne se compte pas comme perdu", () => {
  const journal = [ch({ niveau: "campagne", object_id: "c1", adset_id: null }), ch({})];
  const p = panneauDe(journal, { debut: "2026-09-30", fin: "2026-09-30" }, { campagne: "c1", groupe: "g1" }, { campagnes: CAMPAGNES, noms: NOMS });
  assert.equal(p.total, 1);
  assert.equal(p.nonRattaches, 0);
});

test("sous un filtre de groupe, une annonce dont le groupe est inconnu se COMPTE à part", () => {
  const journal = [ch({ niveau: "annonce", object_id: "a9", adset_id: null }), ch({ niveau: null, adset_id: null, object_id: null })];
  const p = panneauDe(journal, { debut: "2026-09-30", fin: "2026-09-30" }, { campagne: "c1", groupe: "g1" }, { campagnes: CAMPAGNES, noms: NOMS });
  assert.equal(p.total, 0);
  assert.equal(p.nonRattaches, 2);
});

test("la Comparaison : la ligne d'un groupe porte ses changements et ceux de ses annonces", () => {
  const journal = [
    ch({ occurred_at: "2026-09-28T09:00:00+00:00" }),
    ch({ niveau: "annonce", object_id: "a1", adset_id: "g1", occurred_at: "2026-10-01T09:00:00+00:00" }),
    ch({ niveau: "annonce", object_id: "a2", adset_id: "g2", occurred_at: "2026-09-29T09:00:00+00:00" }),
    ch({ niveau: "campagne", object_id: "c1", adset_id: null, occurred_at: "2026-09-29T09:00:00+00:00" }),
  ];
  assert.deepEqual(marquesElement(journal, { niveau: "groupes", cle: "g1" }, DATES), [0, 3]);
  assert.deepEqual(marquesElement(journal, { niveau: "annonces", cle: "a1" }, DATES), [3]);
  // Une clé « sans-id: » n'attrape rien : on ne rattache jamais par le nom.
  assert.deepEqual(marquesElement(journal, { niveau: "groupes", cle: "sans-id:c1›Groupe B" }, DATES), []);
});

test("l'élément ouvert s'écrit et se relit dans l'URL ; tout le reste est refusé", () => {
  const e = { niveau: "annonces" as const, cle: "123" };
  assert.deepEqual(elementOuvertDe(valeurElement(e)), e);
  assert.deepEqual(elementOuvertDe("groupe:9"), { niveau: "groupes", cle: "9" });
  assert.equal(elementOuvertDe("campagne:9"), null);
  assert.equal(elementOuvertDe("annonce:"), null);
  assert.equal(elementOuvertDe(undefined), null);
});

test("le panneau range campagne › groupe › annonce, le statut d'abord, par heure", () => {
  const journal = [
    ch({ niveau: "annonce", object_id: "a1", object_name: "Annonce C", occurred_at: "2026-09-30T14:09:00+00:00", categorie: "creatif" }),
    statut("a1", "annonce", "14:12", "En attente d'examen", "Actif"),
    statut("a1", "annonce", "14:10", "Actif", "En attente d'examen"),
    ch({ occurred_at: "2026-09-30T14:05:00+00:00" }),
    ch({ niveau: "campagne", object_id: "c1", adset_id: null, occurred_at: "2026-09-30T15:00:00+00:00", categorie: "budget" }),
  ];
  const p = panneauDe(journal, { debut: "2026-09-30", fin: "2026-09-30" }, TOUT, { campagnes: CAMPAGNES, noms: NOMS });
  assert.equal(p.total, 4);
  assert.equal(p.jours.length, 1);
  const [campagne] = p.jours[0].campagnes;
  assert.equal(campagne.nom, "Campagne A");
  assert.equal(campagne.couleur, "#2a78d6");
  assert.deepEqual(campagne.cartes.map((c) => c.nature), ["Budget"]);
  const [groupe] = campagne.groupes;
  assert.equal(groupe.nom, "Groupe B (insights)", "le nom des insights, comme le Bandeau");
  assert.equal(groupe.total, 3);
  assert.deepEqual(groupe.cartes.map((c) => c.heure), ["16:05"], "heure du compte, Zurich en été");
  const [annonce] = groupe.annonces;
  assert.equal(annonce.nom, "Annonce C (insights)");
  assert.deepEqual(annonce.cartes.map((c) => c.sorte), ["statut", "lecture"], "le statut d'abord");
  const chaine = annonce.cartes[0] as Extract<Carte, { sorte: "statut" }>;
  assert.deepEqual(chaine.etapes, [
    { libelle: "Actif", heure: null },
    { libelle: "En attente d'examen", heure: "16:10" },
    { libelle: "Actif", heure: "16:12" },
  ]);
});

test("une annonce sans groupe retrouvé se range sous un groupe « non retrouvé », jamais perdue", () => {
  const journal = [ch({ niveau: "annonce", object_id: "a7", object_name: "Annonce Z", adset_id: null })];
  const p = panneauDe(journal, { debut: "2026-09-30", fin: "2026-09-30" }, TOUT, { campagnes: CAMPAGNES, noms: {} });
  const [groupe] = p.jours[0].campagnes[0].groupes;
  assert.equal(groupe.id, null);
  assert.equal(groupe.annonces[0].nom, "Annonce Z");
});

test("tous les changements de la période : un bloc par jour, le plus récent d'abord", () => {
  const journal = [ch({ occurred_at: "2026-09-28T09:00:00+00:00" }), ch({ occurred_at: "2026-10-01T09:00:00+00:00" }), ch({ occurred_at: "2026-10-09T09:00:00+00:00" })];
  const p = panneauDe(journal, { debut: DATES[0], fin: DATES[3] }, TOUT, { campagnes: CAMPAGNES, noms: NOMS });
  assert.deepEqual(p.jours.map((j) => j.jour), ["2026-10-01", "2026-09-28"]);
  assert.equal(p.total, 2);
});

test("le panneau d'un élément ne montre que lui (et, pour un groupe, ses annonces)", () => {
  const journal = [ch({}), ch({ niveau: "annonce", object_id: "a1" }), ch({ object_id: "g2", adset_id: "g2" })];
  const portee: Portee = { ...TOUT, element: { niveau: "groupes", cle: "g1" } };
  const p = panneauDe(journal, { debut: "2026-09-30", fin: "2026-09-30" }, portee, { campagnes: CAMPAGNES, noms: NOMS });
  assert.equal(p.total, 2);
  assert.deepEqual(p.jours[0].campagnes[0].groupes.map((g) => g.id), ["g1"]);
});
