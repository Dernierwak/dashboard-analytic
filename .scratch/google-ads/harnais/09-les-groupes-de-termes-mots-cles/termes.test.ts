// Harnais du ticket 09 de la construction Google Ads — les Groupes de termes,
// mode Mots-clés (`lib/google/termes.ts`).
// Lancer : sh .scratch/google-ads/harnais/09-les-groupes-de-termes-mots-cles/lancer.sh
//
// Valeurs attendues calculées à la main (spec, § « Groupes de termes »).
// Contexte figé : lundi 2026-10-05 est le dernier Jour de travail → semaine
// mesurée 28 sept.–4 oct. ; le 5 octobre est le jour en cours, exclu.
import { test } from "node:test";
import assert from "node:assert/strict";
import { campagnesDe, periodeDe, PALETTE_CAMPAGNES, PASTILLE_NEUTRE, type LigneGoogle } from "@/lib/google/lecture";
import { lienGoogle } from "@/lib/google/liens";
import { groupesDeTermes, type CommandesGroupes, type LigneTermeGoogle } from "@/lib/google/termes";

const CTX = { aujourdhui: "2026-10-05", dernierJourDeTravail: "2026-10-05" };
const PERIODE = periodeDe({}, CTX);

function insight(sur: Partial<LigneGoogle>): LigneGoogle {
  return { date: "2026-09-28", campagneId: "222", campagneNom: "Search Vélo", typeCampagne: "SEARCH", cout: 0, impressions: 0, clics: 0, conversions: 0, ...sur };
}

const INSIGHTS: LigneGoogle[] = [
  insight({ date: "2026-09-28", clics: 60, impressions: 1000, cout: 50, conversions: 4 }),
  insight({ date: "2026-09-29", clics: 40, impressions: 1000, cout: 30, conversions: 2 }),
  insight({ date: "2026-09-30", campagneId: "333", campagneNom: "Search Bike", clics: 20, impressions: 500, cout: 10, conversions: 1 }),
  insight({ date: "2026-09-28", campagneId: "444", campagneNom: "PMax", typeCampagne: "PERFORMANCE_MAX", clics: 500, impressions: 9000, cout: 300, conversions: 30 }),
];

function terme(sur: Partial<LigneTermeGoogle>): LigneTermeGoogle {
  return {
    date: "2026-09-28",
    campagneId: "222",
    groupeId: "50",
    terme: "location vélo",
    motCle: "location vélo",
    motCleType: "PHRASE",
    appariement: "PHRASE",
    impressions: 0,
    clics: 0,
    cout: 0,
    conversions: 0,
    ...sur,
  };
}

const TERMES: LigneTermeGoogle[] = [
  terme({ clics: 30, impressions: 300, cout: 20, conversions: 2 }),
  terme({ date: "2026-09-29", clics: 10, impressions: 100, cout: 5, conversions: 0 }),
  terme({ terme: "vélo électrique lausanne", appariement: "NEAR_PHRASE", clics: 5, impressions: 100, cout: 4, conversions: 1 }),
  // Le même terme, apparié par un autre mot-clé : il relie les deux grappes.
  terme({ motCle: "vélo", motCleType: "BROAD", appariement: "BROAD", clics: 3, impressions: 50, cout: 2, conversions: 0 }),
  terme({ date: "2026-09-29", terme: "vélo gratuit", motCle: "vélo", motCleType: "BROAD", appariement: "BROAD", clics: 12, impressions: 200, cout: 6, conversions: 0 }),
  // Sans mot-clé déclencheur, et une conversion non rendue par Google.
  terme({ date: "2026-09-30", campagneId: "333", groupeId: "60", terme: "bike rental", motCle: "", motCleType: "", appariement: "", clics: 4, impressions: 80, cout: 3, conversions: null }),
  // Le jour en cours, la veille de la période, une campagne PMax : hors du module.
  terme({ date: "2026-10-05", clics: 999 }),
  terme({ date: "2026-09-27", clics: 777 }),
  terme({ campagneId: "444", terme: "pmax", clics: 50 }),
];

function lire(c: CommandesGroupes = {}, sur: { termes?: LigneTermeGoogle[] | null; insights?: LigneGoogle[]; debutTermes?: string | null } = {}) {
  const insights = sur.insights ?? INSIGHTS;
  return groupesDeTermes(
    {
      termes: sur.termes === undefined ? TERMES : sur.termes,
      debutTermes: sur.debutTermes === undefined ? "2026-01-01" : sur.debutTermes,
      insights,
      campagnes: campagnesDe(insights, PERIODE),
      periode: PERIODE,
      aujourdhui: CTX.aujourdhui,
    },
    c
  );
}

function lu(c: CommandesGroupes = {}, sur = {}) {
  const g = lire(c, sur);
  assert.equal(g.etat, "lu");
  if (g.etat !== "lu") throw new Error("inatteignable");
  return g;
}

test("toutes les campagnes Search : un rond par mot-clé, rangés par clics, « sans mot-clé » en dernier", () => {
  const g = lu();
  assert.deepEqual(
    g.grappes.map((x) => [x.libelle, x.chiffres.clics]),
    [["location vélo", 45], ["vélo", 15], ["Sans mot-clé déclencheur", 4]]
  );
  assert.ok(g.grappes[2].special?.raison);
  assert.equal(g.grappes[2].couleur, null);
});

test("seules les campagnes Search de la période sont proposées, PMax exclue", () => {
  assert.deepEqual(lu().campagnes.map((c) => c.cle).sort(), ["222", "333"]);
});

test("une grappe porte ses quatre métriques ; une absence reste « — » (null), jamais 0", () => {
  const [loc, , sans] = lu().grappes;
  assert.deepEqual(loc.chiffres, { clics: 45, impressions: 500, cout: 29, conversions: 3 });
  assert.equal(sans.chiffres.conversions, null);
});

test("ligne de totaux sur les quatre métriques, jour en cours et hors période exclus", () => {
  assert.deepEqual(lu().totaux, { clics: 64, impressions: 830, cout: 40, conversions: null });
});

test("part masquée = total des campagnes Search (insights) − somme des termes", () => {
  const g = lu();
  assert.deepEqual(g.masques, { clics: 56, impressions: 1670, cout: 50, conversions: null });
  assert.equal(Math.round((g.partMasquee ?? 0) * 1000), 467); // 56 / 120
  assert.equal(g.raisonMasques, null);
});

test("une campagne choisie : ses termes, sa part masquée", () => {
  const g = lu({ gc: "222" });
  assert.equal(g.campagne, "222");
  assert.deepEqual(g.totaux, { clics: 60, impressions: 750, cout: 37, conversions: 3 });
  assert.deepEqual(g.masques, { clics: 40, impressions: 1250, cout: 43, conversions: 3 });
  assert.deepEqual(g.grappes.map((x) => x.libelle), ["location vélo", "vélo"]);
});

test("une campagne Search choisie au Bandeau préremplit le filtre ; « toutes » l'écrase", () => {
  const pre = lu({ campagne: "333" });
  assert.equal(pre.campagne, "333");
  assert.equal(pre.prerempli, true);
  assert.equal(pre.gcToutes, "toutes");
  assert.equal(lu({ campagne: "333", gc: "toutes" }).campagne, null);
});

test("une campagne non Search au Bandeau ne préremplit rien", () => {
  const g = lu({ campagne: "444" });
  assert.equal(g.campagne, null);
  assert.equal(g.prerempli, false);
  assert.equal(g.gcToutes, null);
});

test("une campagne demandée inconnue : le module le dit, il ne montre pas « toutes »", () => {
  const g = lu({ gc: "999" });
  assert.equal(g.campagneInconnue, true);
  assert.deepEqual(g.grappes, []);
});

test("un terme apparié par deux mots-clés est dans les deux grappes (il les relie)", () => {
  const g = lu();
  const dans = g.grappes.filter((x) => x.termes.some((t) => t.texte === "location vélo")).map((x) => x.libelle);
  assert.deepEqual(dans, ["location vélo", "vélo"]);
});

test("la fiche : termes rangés par la taille, type d'appariement et correspondance du mot-clé nommés", () => {
  const loc = lu().grappes[0];
  assert.equal(loc.correspondance, "Expression exacte");
  assert.deepEqual(
    loc.termes.map((t) => [t.texte, t.chiffres.clics, t.appariement]),
    [["location vélo", 40, "Expression"], ["vélo électrique lausanne", 5, "Expression (variante proche)"]]
  );
  assert.equal(lu().grappes[1].correspondance, "Requête large");
});

test("en mode Mots-clés, la part masquée d'un mot-clé ne se calcule pas : null, avec sa raison", () => {
  const loc = lu().grappes[0];
  assert.equal(loc.masques, null);
  assert.ok(loc.raisonMasques);
});

test("taille au choix, clics par défaut ; une taille inconnue retombe sur clics", () => {
  assert.equal(lu().taille, "clics");
  assert.equal(lu({ gt: "n'importe" }).taille, "clics");
  const conv = lu({ gt: "conversions" });
  assert.equal(conv.taille, "conversions");
  assert.deepEqual(conv.grappes.map((x) => x.libelle).slice(0, 2), ["location vélo", "vélo"]);
  assert.equal(lu({ gt: "impressions" }).taille, "impressions");
});

test("8 couleurs aux plus gros mots-clés, le reste gris", () => {
  const termes = Array.from({ length: 9 }, (_, i) => terme({ terme: `t${i}`, motCle: `m${i}`, clics: 100 - i }));
  const g = lu({}, { termes });
  assert.deepEqual(g.grappes.slice(0, 8).map((x) => x.couleur), PALETTE_CAMPAGNES);
  assert.equal(g.grappes[8].couleur, PASTILLE_NEUTRE);
});

test("termes lus depuis après le début de la période : pas de part masquée, et la raison le dit", () => {
  const g = lu({}, { debutTermes: "2026-09-30" });
  assert.equal(g.masques, null);
  assert.match(g.raisonMasques ?? "", /depuis/);
  assert.equal(g.termesDepuis, "2026-09-30");
});

test("termes jamais récoltés : pas de part masquée", () => {
  const g = lu({}, { termes: [], debutTermes: null });
  assert.equal(g.masques, null);
  assert.deepEqual(g.grappes, []);
});

test("des termes au-delà du total de la campagne : aucune part masquée négative", () => {
  const g = lu({ gc: "333" }, { termes: [terme({ date: "2026-09-30", campagneId: "333", clics: 25, impressions: 10, cout: 1, conversions: 0 })] });
  assert.equal(g.masques, null);
  assert.ok(g.raisonMasques);
});

test("sans campagne Search, une phrase remplace le module", () => {
  const g = lire({}, { insights: [INSIGHTS[3]] });
  assert.equal(g.etat, "sans-search");
  if (g.etat === "sans-search") assert.ok(g.phrase.length > 0);
});

test("termes illisibles (section pas jouée) : le module le dit, la page ne lève pas", () => {
  assert.equal(lire({}, { termes: null }).etat, "non-lu");
});

test("mode, campagne et taille vivent dans l'URL : un lien ne change que ce qu'il nomme", () => {
  assert.equal(lu({ gm: "mots-cles" }).mode, "mots-cles");
  assert.equal(lu({ gm: "inconnu" }).mode, "mots-cles");
  assert.equal(lienGoogle({ vue: "trafic", gc: "222", campagne: "333" }, { gt: "cout" }), "/google?vue=trafic&gc=222&campagne=333&gt=cout");
});
