// Harnais du ticket 11 — la liste des 5 meilleurs.
// Lancer : sh .scratch/instagram-construction/harnais/11-les-5-meilleurs-et-le-panneau/lancer.sh
// Seam : `meilleursDe(posts, metrique, periode, ctx)` (`lib/instagram/meilleurs.ts`).
// Valeurs attendues : la spec, § La lecture, ligne « les 5 meilleurs » —
// posts de la période, âge > 48 h, valeur non vide, tri décroissant.
import { test } from "node:test";
import assert from "node:assert/strict";
import { meilleursDe, rangsDe } from "@/lib/instagram/meilleurs";
import { ctx, post, SEMAINE, sixImages } from "./fixtures.ts";

test("les 5 meilleurs de la période, du plus haut au plus bas, numérotés de 1 à 5", () => {
  const periode = [3, 9, 1, 7, 5, 8].map((v, i) => post(`2026-10-2${6 + (i % 4)}T09:00:00Z`, { likes: v }));
  const l = meilleursDe([...sixImages(), ...periode], "jaime", SEMAINE, ctx);
  assert.deepEqual(l.map((m) => m.valeur), [9, 8, 7, 5, 3]);
  assert.deepEqual(l.map((m) => m.rang), [1, 2, 3, 4, 5]);
});

test("hors période, moins de 48 h ou sans valeur : pas dans la liste", () => {
  const avant = post("2026-10-20T09:00:00Z", { likes: 50 });
  const jeune = post("2026-11-01T09:00:00Z", { likes: 40, releve_a: "2026-11-02T09:00:00Z" });
  const vide = post("2026-10-28T09:00:00Z", { likes: null });
  const bon = post("2026-10-27T09:00:00Z", { likes: 2 });
  const l = meilleursDe([avant, jeune, vide, bon], "jaime", SEMAINE, ctx);
  assert.deepEqual(l.map((m) => m.post.id), [bon.id]);
});

test("un zéro mesuré entre dans la liste, un vide non", () => {
  const zero = post("2026-10-27T09:00:00Z", { likes: 0 });
  const l = meilleursDe([zero, post("2026-10-28T09:00:00Z", { likes: null })], "jaime", SEMAINE, ctx);
  assert.deepEqual(l.map((m) => m.valeur), [0]);
});

test("chaque meilleur porte sa place et la moustache des 12 mois de son format", () => {
  const p = post("2026-10-27T09:00:00Z", { likes: 6 });
  const [m] = meilleursDe([...sixImages(), p], "jaime", SEMAINE, ctx);
  // Sept valeurs 1…6 + 6 : quartiles exclusifs 2 / 4 / 6 ; 6 ≤ q3 → haut.
  assert.deepEqual(m.place, { etat: "place", place: "haut", horsNorme: false });
  assert.equal(m.moustache?.etat, "boite");
  assert.equal(m.moustache?.etat === "boite" && m.moustache.quartiles.mediane, 4);
});

test("à égalité, le plus récent d'abord", () => {
  const a = post("2026-10-27T09:00:00Z", { likes: 4 });
  const b = post("2026-10-29T09:00:00Z", { likes: 4 });
  assert.deepEqual(meilleursDe([a, b], "jaime", SEMAINE, ctx).map((m) => m.post.id), [b.id, a.id]);
});

test("les numéros se reportent sur le nuage par l'ID du post", () => {
  const a = post("2026-10-27T09:00:00Z", { likes: 4 });
  const b = post("2026-10-29T09:00:00Z", { likes: 8 });
  assert.deepEqual(rangsDe(meilleursDe([a, b], "jaime", SEMAINE, ctx)), { [b.id]: 1, [a.id]: 2 });
});
