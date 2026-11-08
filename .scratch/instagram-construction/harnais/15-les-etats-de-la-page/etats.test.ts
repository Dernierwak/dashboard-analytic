// Harnais du ticket 15 — les états de la page et le départ de l'ancienne lecture.
// Lancer : sh .scratch/instagram-construction/harnais/15-les-etats-de-la-page/lancer.sh
// Seam : `etatDeLaPage` (`lib/instagram/etat.ts`) — posts en base + la ligne
// `fetch_progress` du canal `instagram` → l'état que la page rend. Valeurs
// attendues : la spec, § La page — Les états de la page ; le mot du worker
// vient de `orchestration/execution_plan.py:_a_reconnecter` (« jeton Meta à
// reconnecter — <raison> → Comptes → Connexions »).
// Le départ de l'ancienne lecture se vérifie sur l'arbre (`git grep`), en fin
// de fichier : ce n'est pas un comportement, c'est une absence.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { etatDeLaPage, texteFigeAu } from "@/lib/instagram/etat";

const MORT = { etat: "saute", mot_de_fin: "jeton Meta à reconnecter — Error validating access token → Comptes → Connexions" };
const post = (releveA: string | null) => ({ releveA });

test("jeton mort : figé au jour du relevé le plus récent, même avec des posts sans relevé daté", () => {
  const e = etatDeLaPage({
    posts: [post("2026-10-30T07:02:00Z"), post(null), post("2026-11-02T07:05:00Z")],
    progres: MORT,
  });
  assert.deepEqual(e, { etat: "jeton_mort", figeAu: "2026-11-02" });
  assert.equal(texteFigeAu(e.etat === "jeton_mort" ? e.figeAu : null), "Tes chiffres Instagram sont figés au 2 novembre 2026");
});

test("jeton mort sans aucun relevé daté : pas de date inventée", () => {
  const e = etatDeLaPage({ posts: [post(null)], progres: MORT });
  assert.deepEqual(e, { etat: "jeton_mort", figeAu: null });
  assert.equal(texteFigeAu(null), "Tes chiffres Instagram ne se mettent plus à jour");
});

test("jeton mort l'emporte sur le compte neuf : un compte sans post au jeton mort n'attend pas le worker, il attend une reconnexion", () => {
  assert.deepEqual(etatDeLaPage({ posts: [], progres: MORT }), { etat: "jeton_mort", figeAu: null });
});

test("un saut pour une autre raison n'est pas un jeton mort", () => {
  const sansMeta = { etat: "saute", mot_de_fin: "aucune connexion Meta sur ce compte → Comptes → Connexions" };
  assert.equal(etatDeLaPage({ posts: [post(null)], progres: sansMeta }).etat, "normale");
  assert.equal(etatDeLaPage({ posts: [post(null)], progres: { etat: "saute", mot_de_fin: null } }).etat, "normale");
  // Le jeton Google mort ne concerne pas Instagram.
  const google = { etat: "saute", mot_de_fin: "jeton Google à reconnecter — invalid_grant → Comptes → Connexions" };
  assert.equal(etatDeLaPage({ posts: [post(null)], progres: google }).etat, "normale");
  // Un échec n'est pas un saut : le jeton a été essayé.
  assert.equal(etatDeLaPage({ posts: [post(null)], progres: { etat: "echec", mot_de_fin: MORT.mot_de_fin } }).etat, "normale");
});

test("compte neuf : aucun post et aucun passage fini ; le saut d'un autre motif est rapporté tel quel", () => {
  assert.deepEqual(etatDeLaPage({ posts: [], progres: null }), { etat: "neuf", motDuWorker: null });
  assert.deepEqual(etatDeLaPage({ posts: [], progres: { etat: "en_cours", mot_de_fin: null } }), { etat: "neuf", motDuWorker: null });
  const sansIg = { etat: "saute", mot_de_fin: "aucun compte Instagram Business lié — colonne vide" };
  assert.deepEqual(etatDeLaPage({ posts: [], progres: sansIg }), { etat: "neuf", motDuWorker: sansIg.mot_de_fin });
});

test("aucun post mais un passage fini : la page normale (le worker a lu, il n'y a rien), pas « le premier passage lira »", () => {
  assert.equal(etatDeLaPage({ posts: [], progres: { etat: "fini", mot_de_fin: "instagram: 0 post" } }).etat, "normale");
});

test("des posts, jeton vivant : la page normale — un compte gratuit n'a aucun état à part", () => {
  assert.equal(etatDeLaPage({ posts: [post("2026-11-02T07:05:00Z")], progres: { etat: "fini", mot_de_fin: null } }).etat, "normale");
  assert.equal(etatDeLaPage({ posts: [post(null)], progres: null }).etat, "normale");
});

// Revue de code : `fetch_progress` n'est écrite que par le passage complet (le
// léger n'y touche pas, `account_sync.leger`). Reconnecté le mardi, le compte
// garderait l'encart jusqu'au Jour de travail suivant : un relevé ou une ligne
// du compte PLUS RÉCENTS que la ligne `fetch_progress` disent que le jeton
// revit, et l'encart se tait.
const MORT_LE_LUNDI = { ...MORT, maj_a: "2026-11-02T07:01:00Z" };

test("jeton mort, puis un relevé de post plus récent (reconnexion active) : pas d'encart", () => {
  const e = etatDeLaPage({ posts: [post("2026-10-30T07:02:00Z"), post("2026-11-04T07:03:00Z")], progres: MORT_LE_LUNDI });
  assert.equal(e.etat, "normale");
});

test("jeton mort, puis une ligne du compte plus récente (reconnexion active) : pas d'encart", () => {
  const e = etatDeLaPage({ posts: [post("2026-10-30T07:02:00Z")], progres: MORT_LE_LUNDI, compteMajA: "2026-11-03T07:02:00Z" });
  assert.equal(e.etat, "normale");
});

test("jeton mort, relevés et ligne du compte plus anciens que le constat : l'encart reste", () => {
  const e = etatDeLaPage({ posts: [post("2026-10-30T07:02:00Z")], progres: MORT_LE_LUNDI, compteMajA: "2026-11-01T07:02:00Z" });
  assert.deepEqual(e, { etat: "jeton_mort", figeAu: "2026-10-30" });
});

test("jeton mort sans date sur la ligne fetch_progress : l'encart reste (on ne devine pas une reconnexion)", () => {
  const e = etatDeLaPage({ posts: [post("2026-11-04T07:03:00Z")], progres: { ...MORT, maj_a: null }, compteMajA: "2026-11-04T07:03:00Z" });
  assert.equal(e.etat, "jeton_mort");
});

test("le commentaire de etat.ts ne prétend plus que le léger écrit fetch_progress", () => {
  const source = readFileSync(join(RACINE, "saas/web/lib/instagram/etat.ts"), "utf8");
  assert.doesNotMatch(source, /le léger quotidien compris/);
  assert.doesNotMatch(source, /connected_accounts"\)|from\("connected_accounts/);
});

// ── Ce qui part ─────────────────────────────────────────────────────────────

const RACINE = execFileSync("git", ["rev-parse", "--show-toplevel"]).toString().trim();
const grep = (motif: string) => {
  try {
    return execFileSync("git", ["grep", "-n", "-E", motif, "--", "saas/web", ":!saas/web/node_modules"], { cwd: RACINE }).toString();
  } catch {
    return ""; // git grep sort en 1 quand rien ne correspond
  }
};

test("l'ancienne lecture Instagram n'a plus ni définition ni appelant dans saas/web", () => {
  for (const nom of ["getInstaDash", "InstaDash", "InstaPost", "FORMAT_LABEL", "MoyennesInsta", "CourbeAbonnes", "porteeRelevee", "LECTURES_INSTA"]) {
    assert.equal(grep(`\\b${nom}\\b`), "", `${nom} encore cité`);
  }
});

test("batirComparaison reste pour Google (un seul appel, celui de buildDash)", () => {
  const lignes = grep("batirComparaison\\(").trim().split("\n").filter(Boolean);
  assert.equal(lignes.filter((l) => l.startsWith("saas/web/lib/channels.ts")).length, 2, lignes.join("\n")); // définition + appel
});

test("aucun dossier _prototype-* dans l'arbre, aucune citation dans le dépôt", () => {
  assert.equal(execFileSync("git", ["ls-files", "--", "**/_prototype-*"], { cwd: RACINE }).toString(), "");
  assert.equal(grep("_prototype-"), "");
});

test("compte gratuit : aucun appel à l'achat sur la page Instagram", () => {
  const fichiers = (d: string): string[] =>
    readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? fichiers(join(d, f)) : [join(d, f)]));
  const web = join(RACINE, "saas/web");
  const textes = [...fichiers(join(web, "components/instagram")), ...fichiers(join(web, "app/instagram")), ...fichiers(join(web, "lib/instagram"))];
  for (const f of textes) {
    assert.doesNotMatch(readFileSync(f, "utf8"), /premium|passe au payant|passer au payant|offre payante|upgrade|débloque/i, f);
  }
});
