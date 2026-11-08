// Harnais du ticket 10 — l'Objectif et « Tes posts face à ton année ».
// Lancer : sh .scratch/instagram-construction/harnais/10-l-objectif-et-l-annee/lancer.sh
// Valeurs attendues : la spec (§ « Tes posts face à ton année », § La lecture,
// lignes « 3 mois, 1 mois ») et des quartiles exclusifs calculés à la main
// (même méthode que le contrôle [1…6] → 1,75 / 3,5 / 5,25 de la spec).
import { test } from "node:test";
import assert from "node:assert/strict";
import { postDe, type LigneBase, type Post } from "@/lib/instagram/lecture";
import {
  moduleAnneeDe,
  raisonIndisponible,
  textePastille,
  texteReference,
  type ModuleAnnee,
  type RangeeLue,
} from "@/lib/instagram/annee";
import { lienInstagram } from "@/lib/instagram/liens";

const ctx = { maintenant: "2026-11-07T08:00:00.000Z" };
const SEMAINE = { debut: "2026-10-26", fin: "2026-11-01" };

let id = 0;
/** Un post mûr (relevé 10 jours après), une image par défaut. */
function post(date: string, sur: Partial<LigneBase> = {}): Post {
  id += 1;
  const releve = new Date(Date.parse(date) + 10 * 86_400_000).toISOString();
  return postDe(
    {
      post_id: id,
      date,
      type: "IMAGE",
      media_product_type: "FEED",
      caption: "",
      reach: 100,
      views: 200,
      likes: 1,
      comments: 0,
      saved: 0,
      shares: 0,
      follows: 1,
      profile_visits: 1,
      releve_a: releve,
      ...sur,
    },
    {}
  );
}

/** Six images, j'aime 1…6, réparties dans l'année (mars → août 2026). */
function sixImages(): Post[] {
  return [1, 2, 3, 4, 5, 6].map((v, i) => post(`2026-0${3 + i}-10T09:00:00Z`, { likes: v }));
}

const rangee = (m: ModuleAnnee, format: string) => m.rangees.find((r) => r.format === format);
function lue(m: ModuleAnnee, format: string): RangeeLue {
  const r = rangee(m, format);
  assert.ok(r && r.etat === "lue", `rangée ${format} lue`);
  return r as RangeeLue;
}

test("changer la période ne bouge pas les quartiles de la référence", () => {
  const posts = [...sixImages(), post("2026-10-20T09:00:00Z", { likes: 9 })];
  const a = moduleAnneeDe(posts, "jaime", SEMAINE, ctx);
  const b = moduleAnneeDe(posts, "jaime", { debut: "2026-03-01", fin: "2026-05-31" }, ctx);
  assert.deepEqual(lue(a, "image").moustaches, lue(b, "image").moustaches);
  assert.equal(lue(a, "image").postType, lue(b, "image").postType);
  // … mais les points, eux, suivent la période.
  assert.equal(lue(a, "image").nuage.length, 0);
  assert.equal(lue(b, "image").nuage.length, 3);
});

test("rangées en ordre fixe ; un format sans post sur 12 mois n'a pas de rangée", () => {
  const posts = [
    ...sixImages(),
    post("2026-04-01T09:00:00Z", { type: "VIDEO", media_product_type: "REELS" }),
    // Une vidéo du fil de plus d'un an : pas de rangée.
    post("2025-01-01T09:00:00Z", { type: "VIDEO", media_product_type: "FEED" }),
  ];
  const m = moduleAnneeDe(posts, "jaime", SEMAINE, ctx);
  assert.deepEqual(m.rangees.map((r) => r.format), ["reel", "image"]);
});

test("un format sans post sur la période garde sa bande et le dit", () => {
  const r = lue(moduleAnneeDe(sixImages(), "jaime", SEMAINE, ctx), "image");
  assert.equal(r.nuage.length, 0);
  assert.equal(r.surLaPeriode, 0);
  assert.equal(r.moustaches[0].etat, "boite");
});

test("en-tête : post type, n, total de ce qui se compte, « x sur n »", () => {
  const posts = [...sixImages(), post("2026-09-01T09:00:00Z", { likes: null })];
  const r = lue(moduleAnneeDe(posts, "jaime", SEMAINE, ctx), "image");
  assert.equal(r.postType, 3.5);
  assert.equal(r.n, 6);
  assert.equal(r.sur, 7);
  assert.deepEqual(r.total, { total: 21, avecValeur: 6, n: 7 });
  // La portée ne se somme pas.
  assert.equal(lue(moduleAnneeDe(posts, "portee", SEMAINE, ctx), "image").total, null);
});

test("pastilles : post type de la fenêtre face aux 12 mois, signées, avec leur nombre ; aucune sous 6", () => {
  // Douze images : six anciennes à 1 j'aime (déc. → mai), six des 3 derniers
  // mois à 3 j'aime (août → oct.). 12 mois : médiane 2. 3 mois : 3 → +50 %.
  const anciennes = ["2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05"].map((m) => post(`${m}-15T09:00:00Z`, { likes: 1 }));
  const recentes = ["2026-08-15", "2026-08-25", "2026-09-05", "2026-09-20", "2026-10-01", "2026-10-03"].map((j) =>
    post(`${j}T09:00:00Z`, { likes: 3 })
  );
  const r = lue(moduleAnneeDe([...anciennes, ...recentes], "jaime", SEMAINE, ctx), "image");
  assert.deepEqual(r.pastilles[0], { etat: "pourcent", mois: 3, n: 6, ecart: 50 });
  // Dernier mois (7 oct. → 7 nov.) : aucune image → pas de pastille.
  assert.deepEqual(r.pastilles[1], { etat: "mince", mois: 1, n: 0 });
});

test("pastille en valeur quand le post type des 12 mois vaut 0", () => {
  const anciennes = ["2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"].map((m) =>
    post(`${m}-15T09:00:00Z`, { follows: 0 })
  );
  const recentes = ["2026-08-15", "2026-08-25", "2026-09-05", "2026-09-20", "2026-10-01", "2026-10-03"].map((j) =>
    post(`${j}T09:00:00Z`, { follows: 2 })
  );
  const r = lue(moduleAnneeDe([...anciennes, ...recentes], "abonnes", SEMAINE, ctx), "image");
  assert.equal(r.postType, 0);
  assert.deepEqual(r.pastilles[0], { etat: "valeur", mois: 3, n: 6, ecart: 2 });
});

test("moustaches pesées : sous 6 posts « n / 6 », jamais une boîte", () => {
  const posts = [1, 2, 3, 4, 5].map((v, i) => post(`2026-0${3 + i}-10T09:00:00Z`, { likes: v }));
  const r = lue(moduleAnneeDe(posts, "jaime", SEMAINE, ctx), "image");
  assert.deepEqual(r.moustaches[0], { etat: "mince", mois: 12, n: 5 });
  assert.equal(r.postType, null);
});

test("moustache : valeurs, poids, et un hors norme compté sans étirer l'axe", () => {
  // [1…6, 100] : q1 = 2, médiane 4, q3 = 6 ; limite haute 12 → 100 hors norme.
  const posts = [...sixImages(), post("2026-09-10T09:00:00Z", { likes: 100 })];
  const r = lue(moduleAnneeDe(posts, "jaime", { debut: "2026-09-01", fin: "2026-09-30" }, ctx), "image");
  const b = r.moustaches[0];
  assert.equal(b.etat, "boite");
  if (b.etat !== "boite") return;
  assert.deepEqual(b.quartiles, { q1: 2, mediane: 4, q3: 6 });
  assert.equal(b.basse, 1);
  assert.equal(b.haute, 6);
  assert.equal(b.horsNormeHaut, 1);
  assert.equal(b.horsNormeBas, 0);
  assert.deepEqual(b.points, [1, 2, 3, 4, 5, 6]);
  assert.equal(b.poids, 1);
  // L'axe s'arrête au haut des moustaches ; le point de la période au-delà
  // est marqué hors de l'axe, pas posé à 100.
  assert.equal(r.axeMax, 6);
  assert.equal(r.nuage[0].horsAxe, true);
});

test("une moustache plus mince que l'année pèse moins", () => {
  // 12 images dans l'année, dont 6 dans les 3 derniers mois : poids √(6/12).
  const anciennes = ["2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05"].map((m) => post(`${m}-15T09:00:00Z`));
  const recentes = ["2026-08-15", "2026-08-25", "2026-09-05", "2026-09-20", "2026-10-01", "2026-10-03"].map((j) => post(`${j}T09:00:00Z`));
  const r = lue(moduleAnneeDe([...anciennes, ...recentes], "jaime", SEMAINE, ctx), "image");
  const b = r.moustaches[1];
  assert.equal(b.etat, "boite");
  if (b.etat === "boite") assert.equal(b.poids, Math.sqrt(0.5));
});

test("le Reel en Abonnés reçoit une phrase, jamais une moustache", () => {
  const reels = [1, 2, 3, 4, 5, 6].map((_, i) =>
    post(`2026-0${3 + i}-10T09:00:00Z`, { type: "VIDEO", media_product_type: "REELS", follows: null })
  );
  const r = rangee(moduleAnneeDe(reels, "abonnes_1000", SEMAINE, ctx), "reel");
  assert.equal(r?.etat, "sans_metrique");
  if (r?.etat === "sans_metrique") assert.match(r.phrase, /Instagram ne donne pas/);
});

test("un post de moins de 48 h est un point vide, hors de la référence", () => {
  const jeune = post("2026-11-06T09:00:00Z", { likes: 50, releve_a: "2026-11-07T07:00:00Z" });
  const r = lue(moduleAnneeDe([...sixImages(), jeune], "jaime", { debut: "2026-11-01", fin: "2026-11-06" }, ctx), "image");
  assert.equal(r.n, 6);
  assert.equal(r.nuage[0].jeune, true);
});

test("la ligne de référence : complète, ou « tes posts du … au … (n) »", () => {
  const partielle = moduleAnneeDe(sixImages(), "jaime", SEMAINE, ctx);
  assert.deepEqual(partielle.reference, { complete: false, debut: "2026-03-10", fin: "2026-08-10", n: 6 });
  const complete = moduleAnneeDe([...sixImages(), post("2025-06-01T09:00:00Z")], "jaime", SEMAINE, ctx);
  assert.deepEqual(complete.reference, { complete: true });
});

test("ce qui s'écrit : la pastille signée avec son nombre, la ligne de référence", () => {
  // `nombre` groupe et signe en typographie : « − » (U+2212), espace fine.
  const f = (s: string) => s.replace(/ /g, " ");
  assert.equal(f(textePastille({ etat: "pourcent", mois: 3, n: 15, ecart: 9 }, "taux") ?? ""), "3 mois +9 % · 15 posts");
  assert.equal(f(textePastille({ etat: "pourcent", mois: 1, n: 6, ecart: -12 }, "taux") ?? ""), "1 mois −12 % · 6 posts");
  assert.equal(textePastille({ etat: "valeur", mois: 3, n: 15, ecart: 2 }, "abonnes"), "3 mois : 2 abonnés gagnés de plus · 15 posts");
  assert.equal(textePastille({ etat: "mince", mois: 1, n: 4 }, "taux"), null);
  assert.equal(texteReference({ complete: false, debut: "2026-08-03", fin: "2026-11-05", n: 42 }), "tes posts du 3 août au 5 novembre 2026 (42)");
  assert.equal(texteReference({ complete: false, debut: "2025-12-03", fin: "2026-01-05", n: 7 }), "tes posts du 3 décembre 2025 au 5 janvier 2026 (7)");
  assert.equal(texteReference({ complete: true }), "tes 12 derniers mois, format par format — elle ne bouge pas avec la période");
});

test("le lien du Sélecteur ne change que la métrique et garde le reste de l'URL", () => {
  const params = { from: "2026-10-01", to: "2026-10-31", post: "123", inconnu: "x" };
  assert.equal(lienInstagram(params, { metrique: "portee" }), "/instagram?from=2026-10-01&to=2026-10-31&post=123&inconnu=x&metrique=portee");
  // Le défaut (Engagement / taux) ne s'écrit pas.
  assert.equal(lienInstagram({ metrique: "portee" }, { metrique: "taux" }), "/instagram");
});

test("une métrique pas encore en base est grisée avec sa raison", () => {
  const posts = sixImages().map((p) => ({ ...p, brutes: { ...p.brutes, shares: null } }));
  assert.match(raisonIndisponible(posts, "partages") ?? "", /partages/);
  // Le taux en a besoin aussi : il est vide partout, et le dit.
  assert.match(raisonIndisponible(posts, "taux") ?? "", /partages/);
  assert.equal(raisonIndisponible(posts, "jaime"), null);
});
