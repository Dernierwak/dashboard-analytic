// Harnais du ticket 10 de la construction Google Ads — les Groupes de termes,
// mode Clusters Google (`lib/google/termes.ts`).
// Lancer : sh .scratch/google-ads/harnais/10-les-groupes-de-termes-clusters/lancer.sh
//
// Valeurs attendues calculées à la main (spec, § « Groupes de termes », Further
// Notes 1 et 2). Contexte figé : lundi 2026-10-05 est le dernier Jour de
// travail → semaine mesurée 28 sept.–4 oct. ; la récolte du 5 a lu les
// clusters sur 90 jours pleins, 7 juil. → 4 oct.
import { test } from "node:test";
import assert from "node:assert/strict";
import { campagnesDe, periodeDe, PALETTE_CAMPAGNES, type LigneGoogle } from "@/lib/google/lecture";
import { lienGoogle } from "@/lib/google/liens";
import { groupesDeTermes, type CommandesGroupes, type LigneClusterGoogle } from "@/lib/google/termes";

const CTX = { aujourdhui: "2026-10-05", dernierJourDeTravail: "2026-10-05" };
const PERIODE = periodeDe({}, CTX);
const DEBUT = "2026-07-07";
const FIN = "2026-10-04";

function insight(sur: Partial<LigneGoogle>): LigneGoogle {
  return { date: "2026-09-28", campagneId: "222", campagneNom: "Search Vélo", typeCampagne: "SEARCH", cout: 0, impressions: 0, clics: 0, conversions: 0, ...sur };
}
const INSIGHTS: LigneGoogle[] = [
  insight({ clics: 60, impressions: 1000, cout: 50, conversions: 4 }),
  insight({ date: "2026-09-30", campagneId: "333", campagneNom: "Search Bike", clics: 20, impressions: 500, cout: 10, conversions: 1 }),
  insight({ campagneId: "444", campagneNom: "PMax", typeCampagne: "PERFORMANCE_MAX", clics: 500, impressions: 9000, cout: 300, conversions: 30 }),
];

type T = [string, number | null, number | null, number | null];
function cluster(campagneId: string, clusterId: string, libelle: string, c: [number | null, number | null, number | null], termes: T[] = [], fenetre = [DEBUT, FIN]): LigneClusterGoogle {
  return {
    campagneId,
    clusterId,
    libelle,
    clics: c[0],
    impressions: c[1],
    conversions: c[2],
    termes: termes.map(([texte, clics, impressions, conversions]) => ({ texte, clics, impressions, conversions })),
    debut: fenetre[0],
    fin: fenetre[1],
  };
}

const CLUSTERS: LigneClusterGoogle[] = [
  cluster("222", "11", "location vélo", [120, 1000, 6.5], [["location vélo", 60, 400, 3], ["vélo lausanne", 10, 100, 1]]),
  cluster("222", "12", "vélo gratuit", [30, 300, 1], [["vélo lausanne", 4, 30, 0], ["vélo gratuit", 20, 200, 1]]),
  // Le fourre-tout : libellé vide, aucun terme listé (issue 19).
  cluster("222", "99", "", [40, 300, 0]),
  // Deux petits clusters (≤ 5 clics), dont un sans conversions rendues.
  cluster("222", "13", "bike rental", [5, 50, null], [["bike rental", 3, 30, null]]),
  cluster("222", "14", "e-bike miete", [2, 20, 0], [["e-bike miete", 2, 20, 0]]),
  // Un cluster d'un passage précédent, absent du dernier : hors de la lecture.
  cluster("222", "15", "ancien", [500, 5000, 9], [["ancien", 400, 4000, 9]], ["2026-06-30", "2026-09-27"]),
  // Le niveau compte (campagneId ""), pour « Toutes les campagnes ».
  cluster("", "7", "visite guidée", [300, 4000, 12], [["visite guidée lausanne", 100, 1000, 5]]),
  cluster("", "8", "vélo cargo", [1, 10, 0], [["vélo cargo", 1, 10, 0]]),
];

function lire(c: CommandesGroupes = {}, sur: { clusters?: LigneClusterGoogle[] | null; insights?: LigneGoogle[] } = {}) {
  const insights = sur.insights ?? INSIGHTS;
  return groupesDeTermes(
    {
      termes: [],
      debutTermes: "2026-01-01",
      clusters: sur.clusters === undefined ? CLUSTERS : sur.clusters,
      insights,
      campagnes: campagnesDe(insights, PERIODE),
      periode: PERIODE,
      aujourdhui: CTX.aujourdhui,
    },
    { gm: "clusters", ...c }
  );
}

function lu(c: CommandesGroupes = {}, sur = {}) {
  const g = lire(c, sur);
  assert.equal(g.etat, "lu");
  if (g.etat !== "lu") throw new Error("inatteignable");
  return g;
}

test("gm=clusters choisit le mode Clusters ; sans gm, Mots-clés reste le défaut", () => {
  assert.equal(lu().mode, "clusters");
  assert.equal(lu({ gm: undefined }).mode, "mots-cles");
});

test("une campagne : un rond par cluster de Google, rangés par clics, petits clusters puis « Sans cluster » en dernier", () => {
  const g = lu({ gc: "222" });
  assert.deepEqual(
    g.grappes.map((x) => [x.libelle, x.chiffres.clics]),
    [["location vélo", 120], ["vélo gratuit", 30], ["2 petits clusters", 7], ["Sans cluster", 40]]
  );
  assert.deepEqual(g.grappes.map((x) => x.couleur), [PALETTE_CAMPAGNES[0], PALETTE_CAMPAGNES[1], null, null]);
});

test("le coût s'écrit « — » partout : grappe, terme, totaux, part masquée", () => {
  const g = lu({ gc: "222" });
  assert.ok(g.grappes.every((x) => x.chiffres.cout === null && x.termes.every((t) => t.chiffres.cout === null)));
  assert.equal(g.totaux.cout, null);
  assert.equal(g.masques?.cout, null);
});

test("la taille Coût n'existe pas en mode Clusters : elle retombe sur les clics", () => {
  assert.equal(lu({ gc: "222", gt: "cout" }).taille, "clics");
  assert.equal(lu({ gc: "222", gt: "conversions" }).taille, "conversions");
});

test("petits clusters (≤ 5 clics) regroupés en une grappe hachurée, avec sa raison", () => {
  const petits = lu({ gc: "222" }).grappes[2];
  assert.ok(petits.special?.raison.includes("5 clics"));
  assert.deepEqual(petits.chiffres, { clics: 7, impressions: 70, conversions: null, cout: null });
  assert.deepEqual(petits.termes.map((t) => [t.texte, t.chiffres.clics]), [["bike rental", 3], ["e-bike miete", 2]]);
  assert.deepEqual(petits.masques, { clics: 2, impressions: 20, conversions: null, cout: null });
});

test("le fourre-tout : « Sans cluster », hachuré, avec sa raison ; tout y est masqué", () => {
  const sans = lu({ gc: "222" }).grappes[3];
  assert.ok(sans.special?.raison);
  assert.deepEqual(sans.termes, []);
  assert.deepEqual(sans.masques, { clics: 40, impressions: 300, conversions: 0, cout: null });
});

test("part masquée d'un cluster = son total − ses termes listés", () => {
  const loc = lu({ gc: "222" }).grappes[0];
  assert.deepEqual(loc.masques, { clics: 50, impressions: 500, conversions: 2.5, cout: null });
  assert.equal(loc.raisonMasques, null);
});

test("un terme rangé dans deux clusters est dans les deux grappes (il les relie)", () => {
  const dans = lu({ gc: "222" }).grappes.filter((x) => x.termes.some((t) => t.texte === "vélo lausanne")).map((x) => x.libelle);
  assert.deepEqual(dans, ["location vélo", "vélo gratuit"]);
});

test("totaux = termes listés ; masqués = total des clusters − termes ; part des clics masqués", () => {
  const g = lu({ gc: "222" });
  assert.deepEqual(g.totaux, { clics: 99, impressions: 780, conversions: null, cout: null });
  assert.deepEqual(g.masques, { clics: 98, impressions: 890, conversions: null, cout: null });
  assert.equal(Math.round((g.partMasquee ?? 0) * 1000), 497); // 98 / 197
});

test("seule la fenêtre la plus récente d'un niveau est lue : un cluster d'un passage précédent n'entre pas", () => {
  assert.ok(!lu({ gc: "222" }).grappes.some((x) => x.libelle === "ancien"));
});

test("le module écrit sa fenêtre de 90 jours quand elle diffère de la période du Bandeau", () => {
  const g = lu({ gc: "222" });
  assert.deepEqual(g.fenetre, { debut: DEBUT, fin: FIN });
  assert.ok(g.phrases.some((p) => p.includes("7 juil.") && p.includes("4 oct.")));
  const meme = lu({ gc: "222" }, { clusters: CLUSTERS.map((x) => ({ ...x, debut: PERIODE.debut, fin: PERIODE.fin })) });
  assert.ok(!meme.phrases.some((p) => p.includes("90")));
});

test("une phrase dit qu'un même sujet peut faire un cluster par langue", () => {
  assert.ok(lu({ gc: "222" }).phrases.some((p) => /langue/.test(p)));
});

test("« Toutes les campagnes » lit le niveau compte et dit qu'il mêle Search et PMax, sans comparaison au mode Mots-clés", () => {
  const g = lu();
  assert.equal(g.campagne, null);
  assert.deepEqual(g.grappes.map((x) => [x.libelle, x.chiffres.clics]), [["visite guidée", 300], ["1 petit cluster", 1]]);
  const phrase = g.phrases.find((p) => /Performance Max/.test(p));
  assert.ok(phrase && /ne se compare pas/.test(phrase));
  assert.ok(!lu({ gc: "222" }).phrases.some((p) => /Performance Max/.test(p)));
});

test("la campagne du Bandeau préremplit aussi le mode Clusters", () => {
  const g = lu({ campagne: "222" });
  assert.equal(g.campagne, "222");
  assert.equal(g.grappes[0].libelle, "location vélo");
});

test("une campagne Search sans cluster lu : aucune grappe, aucune fenêtre", () => {
  const g = lu({ gc: "333" });
  assert.deepEqual(g.grappes, []);
  assert.equal(g.fenetre, null);
});

test("clusters jamais récoltés : aucune grappe ; table illisible : le module le dit, en gardant le mode", () => {
  assert.deepEqual(lu({}, { clusters: [] }).grappes, []);
  const g = lire({}, { clusters: null });
  assert.equal(g.etat, "non-lu");
  if (g.etat === "non-lu") {
    assert.equal(g.mode, "clusters");
    assert.match(g.phrase, /clusters/i);
  }
});

test("des termes au-delà du total d'un cluster : pas de part masquée négative, la raison le dit", () => {
  const g = lu({ gc: "222" }, { clusters: [cluster("222", "11", "location vélo", [10, 100, 1], [["location vélo", 25, 100, 1]])] });
  assert.equal(g.grappes[0].masques, null);
  assert.ok(g.grappes[0].raisonMasques);
  assert.equal(g.masques, null);
});

test("le mode se change par un lien qui ne touche que gm et gt", () => {
  assert.equal(lienGoogle({ vue: "trafic", gc: "222", gt: "cout" }, { gm: "clusters", gt: null }), "/google?vue=trafic&gc=222&gm=clusters");
});
