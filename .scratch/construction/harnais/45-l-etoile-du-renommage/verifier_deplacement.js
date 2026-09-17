// LE DÉPLACEMENT D'UN THÈME, EXÉCUTÉ — pas lu.
//
// `saas/web/lib/deplacer-theme.ts` est importé TEL QUEL : node 22+ retire les
// annotations de type lui-même, et le module n'importe que des types (effacés à
// l'exécution). Aucune compilation, aucune copie du code à vérifier — une copie
// finirait par diverger de l'original, et le harnais dirait vert sur du code qui
// n'est plus servi.
//
// Ce que ces cas gardent, c'est le défaut du ticket 45 : l'étoile « thème
// prioritaire » et les retours sur les conseils ne sont PAS des colonnes, ce
// sont des lignes dont la CLÉ porte le nom du thème. Le renommage simple les
// oubliait ; la suppression laissait l'étoile derrière elle.

import { fileURLToPath } from "node:url";
import path from "node:path";
import { FausseBase } from "./fausse-base.js";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const MODULE = path.resolve(ICI, "../../../../saas/web/lib/deplacer-theme.ts");
const D = await import(MODULE);

let n = 0;
const ko = [];
const ok = (nom, condition, detail = "") => {
  n++;
  if (!condition) ko.push(`${nom} — ${detail}`);
};
const egal = (nom, obtenu, attendu) =>
  ok(nom, obtenu === attendu,
     `obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`);

const MOI = "u-1";
const AUTRE = "u-2";
const etoile = (uid, theme, createdAt) => ({
  id: `i-${theme}-${uid}`,
  user_id: uid,
  insight_key: `priority_label:${theme}`,
  verdict: "agree",
  created_at: createdAt,
});
const cles = (base, uid = MOI) =>
  base.lignes("insight_feedback")
    .filter((l) => l.user_id === uid)
    .map((l) => l.insight_key)
    .sort()
    .join("|");

// ── 0 · LA CLÉ EST COMPOSÉE À UN SEUL ENDROIT ──────────────────────────────
//
// Cinq lecteurs attendent cette forme exacte, dont `build_report.py`. Si elle
// change ici, elle doit changer là-bas — d'où la fonction, et d'où ce cas.
egal("la clé de l'étoile est `priority_label:<nom>`",
     D.cleEtoile("Soldes d'été"), "priority_label:Soldes d'été");

// ── 1 · RENOMMER UN THÈME ÉTOILÉ : L'ÉTOILE SUIT ───────────────────────────
{
  const base = new FausseBase({
    insight_feedback: [
      etoile(MOI, "Soldes", "2026-01-05T10:00:00Z"),
      etoile(MOI, "Marque", "2026-02-01T10:00:00Z"),
      { id: "i-verdict", user_id: MOI, insight_key: "cpa_hausse", verdict: "agree" },
      etoile(AUTRE, "Soldes", "2026-01-05T10:00:00Z"),
    ],
  });
  const panne = await D.deplacerEtoile(base, MOI, "Soldes", "Promotions");
  egal("un renommage réussi ne rend aucune panne", panne ?? null, null);
  egal("l'étoile porte le nouveau nom", cles(base),
       "cpa_hausse|priority_label:Marque|priority_label:Promotions");

  // LE RANG DE L'ÉTOILE EST `created_at` : c'est lui qui décide des trois
  // thèmes que l'IA rédige. Un delete+insert renverrait le thème en dernière
  // position sans qu'il ait rien demandé — d'où l'UPDATE, et d'où ce cas.
  const ligne = base.lignes("insight_feedback")
    .find((l) => l.insight_key === "priority_label:Promotions");
  egal("le rang de l'étoile (created_at) est intact",
       ligne.created_at, "2026-01-05T10:00:00Z");
  egal("la ligne est la MÊME, pas une recréée", ligne.id, "i-Soldes-u-1");
  egal("l'étoile d'un AUTRE compte n'a pas bougé",
       cles(base, AUTRE), "priority_label:Soldes");
  ok("aucune insertion : l'étoile s'est déplacée par UPDATE",
     !base.journal.includes("insight_feedback:insert"), base.journal.join(","));
}

// ── 2 · RENOMMER UN THÈME SANS ÉTOILE N'EN POSE PAS UNE ────────────────────
{
  const base = new FausseBase({
    insight_feedback: [etoile(MOI, "Marque", "2026-02-01T10:00:00Z")],
  });
  const panne = await D.deplacerEtoile(base, MOI, "Soldes", "Promotions");
  egal("aucune panne sur un thème sans étoile", panne ?? null, null);
  egal("et aucune étoile n'apparaît", cles(base), "priority_label:Marque");
}

// ── 3 · LA CLÉ D'ARRIVÉE EST DÉJÀ PRISE — LE CAS QUE LE TICKET CROYAIT ─────
//       IMPOSSIBLE
//
// Sur un renommage simple, aucun THÈME ne porte le nom d'arrivée — `renameLabel`
// route vers la fusion quand c'est le cas. Mais une LIGNE, elle, survivait à son
// thème : c'est l'autre moitié du ticket 45, et ces orphelines sont déjà en
// base. Un UPDATE aveugle heurterait la contrainte, la cascade s'arrêterait là,
// et relancer échouerait à l'identique — le thème renommé à moitié pour
// toujours.
{
  const base = new FausseBase({
    insight_feedback: [
      etoile(MOI, "Soldes", "2026-01-05T10:00:00Z"),
      etoile(MOI, "Promotions", "2025-11-02T10:00:00Z"), // orpheline d'un thème supprimé
    ],
  });

  // TÉMOIN — sans ce cas, celui d'en dessous ne prouverait rien : il faut que la
  // fausse base REFUSE bien ce que la vraie refuse.
  const aveugle = await base.from("insight_feedback")
    .update({ insight_key: "priority_label:Promotions" })
    .eq("user_id", MOI).eq("insight_key", "priority_label:Soldes");
  ok("témoin : un UPDATE aveugle heurte bien la contrainte d'unicité",
     Boolean(aveugle.error), JSON.stringify(aveugle));

  const panne = await D.deplacerEtoile(base, MOI, "Soldes", "Promotions");
  egal("le déplacement, lui, ne rend aucune panne", panne ?? null, null);
  egal("une seule étoile reste, sous le nouveau nom",
       cles(base), "priority_label:Promotions");
  egal("et l'ancienne clé ne désigne plus rien",
       base.lignes("insight_feedback")
         .filter((l) => l.insight_key === "priority_label:Soldes").length, 0);
}

// ── 4 · UNE ORPHELINE QUI N'EST PAS LA NÔTRE NE SE TOUCHE PAS ──────────────
//
// Thème SANS étoile renommé vers un nom sous lequel une orpheline traîne :
// l'effacer serait un geste destructeur sur des données existantes, et il se
// décide avec David (`CLAUDE.md` §7). Ce ticket ne la touche pas.
{
  const base = new FausseBase({
    insight_feedback: [etoile(MOI, "Promotions", "2025-11-02T10:00:00Z")],
  });
  const panne = await D.deplacerEtoile(base, MOI, "Soldes", "Promotions");
  egal("aucune panne", panne ?? null, null);
  egal("l'orpheline est laissée telle quelle",
       cles(base), "priority_label:Promotions");
}

// ── 5 · UNE PANNE EST RENDUE, DONC LA CASCADE S'ARRÊTERA ──────────────────
for (const [nom, pannes] of [
  ["une lecture ratée", ["insight_feedback:select"]],
  ["une écriture ratée", ["insight_feedback:update"]],
]) {
  const base = new FausseBase(
    { insight_feedback: [etoile(MOI, "Soldes", "2026-01-05T10:00:00Z")] },
    pannes
  );
  const panne = await D.deplacerEtoile(base, MOI, "Soldes", "Promotions");
  ok(`l'étoile rend ${nom}`, Boolean(panne), JSON.stringify(panne));
}
{
  // Le conflit passe par un DELETE : sa panne aussi doit remonter.
  const base = new FausseBase(
    {
      insight_feedback: [
        etoile(MOI, "Soldes", "2026-01-05T10:00:00Z"),
        etoile(MOI, "Promotions", "2025-11-02T10:00:00Z"),
      ],
    },
    ["insight_feedback:delete"]
  );
  const panne = await D.deplacerEtoile(base, MOI, "Soldes", "Promotions");
  ok("l'étoile rend une suppression ratée", Boolean(panne), JSON.stringify(panne));
}

// ── 6 · SUPPRIMER UN THÈME EMPORTE SON ÉTOILE ──────────────────────────────
//
// Sans ça, la clé survit au thème et `build_report.py` la compte : un thème
// effacé consomme en silence une des trois places où Pulse conseille.
{
  const base = new FausseBase({
    insight_feedback: [
      etoile(MOI, "Soldes", "2026-01-05T10:00:00Z"),
      etoile(MOI, "Marque", "2026-02-01T10:00:00Z"),
      { id: "i-verdict", user_id: MOI, insight_key: "cpa_hausse", verdict: "agree" },
      etoile(AUTRE, "Soldes", "2026-01-05T10:00:00Z"),
    ],
  });
  const panne = await D.retirerEtoile(base, MOI, "Soldes");
  egal("aucune panne", panne ?? null, null);
  egal("l'étoile du thème supprimé est partie, les autres restent",
       cles(base), "cpa_hausse|priority_label:Marque");
  egal("celle d'un autre compte n'a pas bougé",
       cles(base, AUTRE), "priority_label:Soldes");
}
{
  const base = new FausseBase(
    { insight_feedback: [etoile(MOI, "Soldes", "2026-01-05T10:00:00Z")] },
    ["insight_feedback:delete"]
  );
  const panne = await D.retirerEtoile(base, MOI, "Soldes");
  ok("le retrait rend sa panne", Boolean(panne), JSON.stringify(panne));
}
{
  // Un thème jamais étoilé se supprime sans bruit — l'étape ne doit pas
  // devenir un faux arrêt de cascade sur le cas le plus courant.
  const base = new FausseBase({ insight_feedback: [] });
  const panne = await D.retirerEtoile(base, MOI, "Soldes");
  egal("supprimer un thème sans étoile ne rend aucune panne", panne ?? null, null);
}

// ── 7 · LES RETOURS SUR LES CONSEILS SUIVENT LE THÈME ──────────────────────
//
// Le musellement d'un « pas pour moi » est posé par (conseil, THÈME) depuis
// TASK-025. Un retour resté sur l'ancien nom ne muselle plus rien : le conseil
// écarté revient la semaine d'après.
const retour = (id, uid, theme, recoKey, semaine, reaction = "not_for_me") => ({
  id, user_id: uid, theme, reco_key: recoKey, week_start: semaine, reaction,
});
const retours = (base, uid = MOI) =>
  base.lignes("reco_feedback")
    .filter((l) => l.user_id === uid)
    .map((l) => `${l.theme}/${l.reco_key}/${l.week_start}`)
    .sort()
    .join("|");
{
  const base = new FausseBase({
    reco_feedback: [
      retour("r1", MOI, "Soldes", "ads_budget", "2026-09-07"),
      retour("r2", MOI, "Soldes", "ads_creative", "2026-08-31"),
      retour("r3", MOI, "Marque", "ads_budget", "2026-09-07"),
      retour("r4", AUTRE, "Soldes", "ads_budget", "2026-09-07"),
    ],
  });
  const panne = await D.deplacerRetoursConseils(base, MOI, "Soldes", "Promotions");
  egal("aucune panne", panne ?? null, null);
  egal("les deux retours du thème ont suivi, celui d'un autre thème non",
       retours(base),
       "Marque/ads_budget/2026-09-07|Promotions/ads_budget/2026-09-07|" +
       "Promotions/ads_creative/2026-08-31");
  egal("le compte voisin n'a pas bougé",
       retours(base, AUTRE), "Soldes/ads_budget/2026-09-07");
}

// ── 8 · DEUX RETOURS SE HEURTENT SUR (conseil, semaine) ────────────────────
//
// Même cas que l'étoile orpheline, sur l'autre table : la ligne d'arrivée gagne,
// celle du départ est écartée — le musellement reste posé sous le nouveau nom,
// qui est tout ce qui compte pour le client. Ligne à ligne, jamais en un seul
// UPDATE : une collision ferait échouer l'écriture entière.
{
  const base = new FausseBase({
    reco_feedback: [
      retour("r1", MOI, "Soldes", "ads_budget", "2026-09-07", "not_for_me"),
      retour("r2", MOI, "Soldes", "ads_creative", "2026-09-07", "not_for_me"),
      retour("r3", MOI, "Promotions", "ads_budget", "2026-09-07", "done"),
    ],
  });
  const panne = await D.deplacerRetoursConseils(base, MOI, "Soldes", "Promotions");
  egal("aucune panne malgré la collision", panne ?? null, null);
  egal("la ligne qui se heurte est écartée, l'autre a suivi",
       retours(base),
       "Promotions/ads_budget/2026-09-07|Promotions/ads_creative/2026-09-07");
  egal("c'est bien la ligne d'ARRIVÉE qui a survécu",
       base.lignes("reco_feedback").find((l) => l.reco_key === "ads_budget").id, "r3");
}

// ── 9 · MÊME CONSEIL, AUTRE SEMAINE : PAS DE COLLISION ────────────────────
//
// La clé d'unicité porte la SEMAINE. Deux retours sur le même conseil à deux
// semaines différentes ne se gênent pas — les écarter serait perdre un retour
// que le client a bien donné.
{
  const base = new FausseBase({
    reco_feedback: [
      retour("r1", MOI, "Soldes", "ads_budget", "2026-09-07"),
      retour("r2", MOI, "Promotions", "ads_budget", "2026-08-31"),
    ],
  });
  const panne = await D.deplacerRetoursConseils(base, MOI, "Soldes", "Promotions");
  egal("aucune panne", panne ?? null, null);
  egal("les deux retours coexistent",
       retours(base),
       "Promotions/ads_budget/2026-08-31|Promotions/ads_budget/2026-09-07");
}

// ── 10 · LÀ AUSSI, UNE PANNE EST RENDUE ───────────────────────────────────
for (const [nom, pannes, lignes] of [
  ["une lecture ratée", ["reco_feedback:select"],
   [retour("r1", MOI, "Soldes", "ads_budget", "2026-09-07")]],
  ["une écriture ratée", ["reco_feedback:update"],
   [retour("r1", MOI, "Soldes", "ads_budget", "2026-09-07")]],
  ["une suppression ratée", ["reco_feedback:delete"],
   [retour("r1", MOI, "Soldes", "ads_budget", "2026-09-07"),
    retour("r2", MOI, "Promotions", "ads_budget", "2026-09-07")]],
]) {
  const base = new FausseBase({ reco_feedback: lignes }, pannes);
  const panne = await D.deplacerRetoursConseils(base, MOI, "Soldes", "Promotions");
  ok(`les retours rendent ${nom}`, Boolean(panne), JSON.stringify(panne));
}

// ── 11 · LE MÊME NOM DES DEUX CÔTÉS N'EFFACE RIEN ─────────────────────────
//
// `renameLabel` TRIME le nouveau nom : « Soldes » renommé en « Soldes  » passe
// le garde de l'écran (qui compare AVANT le trim) et descend par le chemin
// simple avec `de === vers`. Sans le retour sec, la ligne de départ serait sa
// propre ligne d'arrivée — le code de conflit la verrait « déjà prise » et
// l'effacerait. Une espace en trop coûterait l'étoile du thème et tous ses
// retours.
{
  const base = new FausseBase({
    insight_feedback: [etoile(MOI, "Soldes", "2026-01-05T10:00:00Z")],
    reco_feedback: [
      retour("r1", MOI, "Soldes", "ads_budget", "2026-09-07"),
      retour("r2", MOI, "Soldes", "ads_creative", "2026-08-31"),
    ],
  });
  const panneEtoile = await D.deplacerEtoile(base, MOI, "Soldes", "Soldes");
  const panneRetours = await D.deplacerRetoursConseils(base, MOI, "Soldes", "Soldes");
  egal("aucune panne sur un déplacement sur place", panneEtoile ?? null, null);
  egal("aucune panne sur les retours non plus", panneRetours ?? null, null);
  egal("l'étoile est toujours là", cles(base), "priority_label:Soldes");
  egal("les retours sont tous là", retours(base),
       "Soldes/ads_budget/2026-09-07|Soldes/ads_creative/2026-08-31");
  ok("et rien n'a même été tenté en écriture",
     !base.journal.some((j) => j.endsWith(":update") || j.endsWith(":delete")),
     base.journal.join(","));
}

// ── 12 · UNE ÉCRITURE QUI TOUCHE ZÉRO LIGNE SE VOIT ───────────────────────
//
// Un refus RLS sur un update ne lève RIEN — il touche zéro ligne en silence
// (`CLAUDE.md` §8). Sans le `.select("id")` qui suit l'écriture, la cascade
// verrait l'étape verte et l'écran dirait « renommé partout » sur une étoile
// restée à l'ancien nom : le défaut même que ce module corrige.
{
  const base = new FausseBase(
    { insight_feedback: [etoile(MOI, "Soldes", "2026-01-05T10:00:00Z")] },
    ["insight_feedback:update:zero"]
  );
  const panne = await D.deplacerEtoile(base, MOI, "Soldes", "Promotions");
  ok("une étoile qui n'a pas bougé est une panne, pas un silence",
     Boolean(panne), JSON.stringify(panne));
}

// ── 13 · AU-DELÀ DE MILLE LIGNES, LA LECTURE SE PAGINE ────────────────────
//
// PostgREST plafonne à 1 000 lignes et TRONQUE EN SILENCE (`CLAUDE.md` §8).
// Sans pagination, les retours au-delà de la première page resteraient sur
// l'ancien nom — le défaut que ce module corrige, revenu en silence et
// seulement chez les comptes qui ont assez d'historique pour y arriver.
{
  const beaucoup = [];
  for (let i = 0; i < 1500; i++) {
    // Des semaines distinctes : la clé d'unicité porte (conseil, semaine), donc
    // ces lignes ne se heurtent pas entre elles.
    beaucoup.push(retour(`r${i}`, MOI, "Soldes", "ads_budget", `s-${i}`));
  }
  const base = new FausseBase({ reco_feedback: beaucoup });
  const panne = await D.deplacerRetoursConseils(base, MOI, "Soldes", "Promotions");
  egal("aucune panne", panne ?? null, null);
  egal("les 1500 retours ont suivi, pas seulement les 1000 premiers",
       base.lignes("reco_feedback").filter((l) => l.theme === "Promotions").length,
       1500);
  egal("et aucun n'est resté sur l'ancien nom",
       base.lignes("reco_feedback").filter((l) => l.theme === "Soldes").length, 0);
  // La boucle s'arrête sur une page COURTE : 1500 lignes = une page pleine
  // (1000) puis une page de 500, donc deux lectures pour la source. L'arrivée
  // est vide, donc une seule. Trois en tout — pas une de plus, sinon la boucle
  // redemanderait après une page déjà courte.
  egal("trois lectures en tout : deux pages à la source, une à l'arrivée",
       base.journal.filter((j) => j === "reco_feedback:select").length, 3);
}
{
  // Pile 1 000 lignes : la page est PLEINE, donc il faut en redemander une —
  // qui revient vide. C'est le cas où une boucle mal arrêtée s'arrêterait trop
  // tôt (ou jamais).
  const pile = [];
  for (let i = 0; i < 1000; i++) {
    pile.push(retour(`r${i}`, MOI, "Soldes", "ads_budget", `s-${i}`));
  }
  const base = new FausseBase({ reco_feedback: pile });
  const panne = await D.deplacerRetoursConseils(base, MOI, "Soldes", "Promotions");
  egal("aucune panne sur une page pile pleine", panne ?? null, null);
  egal("les mille lignes ont suivi",
       base.lignes("reco_feedback").filter((l) => l.theme === "Promotions").length,
       1000);
}

// ── 14 · RIEN À DÉPLACER : AUCUNE ÉCRITURE ────────────────────────────────
{
  const base = new FausseBase({ reco_feedback: [] });
  const panne = await D.deplacerRetoursConseils(base, MOI, "Soldes", "Promotions");
  egal("aucune panne sur un thème sans retour", panne ?? null, null);
  ok("et aucune écriture n'est tentée",
     !base.journal.some((j) => j.endsWith(":update") || j.endsWith(":delete")),
     base.journal.join(","));
}

if (ko.length) {
  console.error(`lib/deplacer-theme.ts : ${ko.length}/${n} vérifications ÉCHOUENT`);
  for (const l of ko) console.error(`  ✗ ${l}`);
  process.exit(1);
}
console.log(`lib/deplacer-theme.ts, exécuté : ${n}/${n} vérifications passent`);
