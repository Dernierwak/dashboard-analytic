// Harnais du ticket 09 — la lecture `lib/instagram/` et « Tous tes posts ».
// Lancer : sh .scratch/instagram-construction/harnais/09-la-lecture/lancer.sh
// (Node ≥ 23.6, type stripping natif ; `resoudre.mjs` ajoute `.ts` et `@/`).
// Valeurs attendues : la spec, et `statistics.quantiles(method="exclusive")`
// de Python lancé à la main (python3.12) pour les quartiles.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  abonnesParJourDe,
  formatDe,
  foulesDe,
  placeDuPost,
  postDe,
  quartiles,
  totalDe,
  valeurDe,
  type LigneBase,
} from "@/lib/instagram/lecture";

/** Une ligne d'`instagram_organic_posts` telle que PostgREST la rend. */
function ligne(sur: Partial<LigneBase> = {}): LigneBase {
  return {
    post_id: 1,
    date: "2026-10-01T09:00:00+00:00",
    type: "IMAGE",
    media_product_type: "FEED",
    caption: "Un post",
    media_url: "https://x/1.jpg",
    permalink: "https://www.instagram.com/p/abc/",
    reach: 400,
    views: 900,
    likes: 10,
    comments: 2,
    saved: 3,
    shares: 5,
    follows: 2,
    profile_visits: 7,
    avg_watch_time: null,
    releve_a: "2026-10-20T07:00:00+00:00",
    booste_vu_le: null,
    ...sur,
  };
}

test("quartiles exclusifs : [1…6] → 1,75 / 3,5 / 5,25", () => {
  assert.deepEqual(quartiles([6, 2, 4, 1, 5, 3]), { q1: 1.75, mediane: 3.5, q3: 5.25 });
});

test("quartiles exclusifs : les mêmes que Python sur une petite série et une série avec un extrême", () => {
  // python3.12 : quantiles([10,20]) → [7.5, 15.0, 22.5] ;
  // quantiles([3,1,4,1,5,9,2,6]) → [1.25, 3.5, 5.75].
  assert.deepEqual(quartiles([10, 20]), { q1: 7.5, mediane: 15, q3: 22.5 });
  assert.deepEqual(quartiles([3, 1, 4, 1, 5, 9, 2, 6]), { q1: 1.25, mediane: 3.5, q3: 5.75 });
  assert.equal(quartiles([4]), null);
});

test("format : media_product_type d'abord — une vidéo du fil n'est pas un Reel", () => {
  assert.equal(formatDe("VIDEO", "REELS"), "reel");
  assert.equal(formatDe("VIDEO", "FEED"), "video_fil");
  assert.equal(formatDe("CAROUSEL_ALBUM", "FEED"), "carrousel");
  assert.equal(formatDe("IMAGE", null), "image");
  assert.equal(formatDe("CAROUSEL_ALBUM", null), "carrousel");
  // Une VIDEO sans produit peut être l'un ou l'autre : format inconnu.
  assert.equal(formatDe("VIDEO", null), null);
  assert.equal(formatDe(null, null), null);
});

test("métriques brutes : null reste null, 0 reste 0", () => {
  const p = postDe(ligne({ likes: null, follows: 0, views: undefined }), {});
  assert.equal(valeurDe(p, "jaime"), null);
  assert.equal(valeurDe(p, "abonnes"), 0);
  // Une colonne absente du schéma (section 23 pas jouée) se lit comme rien rendu.
  assert.equal(valeurDe(p, "vues"), null);
});

test("taux d'engagement à quatre termes, vide si un terme manque ou sans portée", () => {
  // (10 + 2 + 3 + 5) ÷ 400 × 100 = 5 %
  assert.equal(valeurDe(postDe(ligne(), {}), "taux"), 5);
  assert.equal(valeurDe(postDe(ligne({ shares: null }), {}), "taux"), null);
  assert.equal(valeurDe(postDe(ligne({ reach: 0 }), {}), "taux"), null);
  assert.equal(valeurDe(postDe(ligne({ reach: null }), {}), "taux"), null);
  // Aucune réaction sur une portée mesurée : un vrai 0 %.
  assert.equal(valeurDe(postDe(ligne({ likes: 0, comments: 0, saved: 0, shares: 0 }), {}), "taux"), 0);
});

test("réactions fortes : (enregistrements + partages) ÷ portée, en %", () => {
  assert.equal(valeurDe(postDe(ligne(), {}), "reactions_fortes"), 2);
  assert.equal(valeurDe(postDe(ligne({ saved: null }), {}), "reactions_fortes"), null);
  assert.equal(valeurDe(postDe(ligne({ reach: 0 }), {}), "reactions_fortes"), null);
});

test("abonnés pour 1 000 comptes touchés : vide sur un Reel et sans portée", () => {
  assert.equal(valeurDe(postDe(ligne(), {}), "abonnes_1000"), 5);
  const reel = postDe(ligne({ type: "VIDEO", media_product_type: "REELS", follows: 3 }), {});
  assert.equal(valeurDe(reel, "abonnes_1000"), null);
  assert.equal(valeurDe(postDe(ligne({ reach: 0 }), {}), "abonnes_1000"), null);
});

test("portée ÷ abonnés du jour de publication : vide si ce jour n'est pas mesuré", () => {
  assert.equal(valeurDe(postDe(ligne(), { "2026-10-01": 2000 }), "portee_abonnes"), 0.2);
  assert.equal(valeurDe(postDe(ligne(), { "2026-09-30": 2000 }), "portee_abonnes"), null);
  assert.equal(valeurDe(postDe(ligne(), { "2026-10-01": 0 }), "portee_abonnes"), null);
});

test("abonnés par jour : le dernier relevé du jour de followers_history, le compte jour par jour par-dessus, un null n'est pas une mesure", () => {
  const parJour = abonnesParJourDe(
    [
      { fetched_at: "2026-09-01T07:00:00+00:00", followers: 1000 },
      { fetched_at: "2026-09-01T19:00:00+00:00", followers: 1010 },
      { fetched_at: "2026-09-02T07:00:00+00:00", followers: null },
    ],
    [
      { jour: "2026-09-02", abonnes: null },
      { jour: "2026-10-01", abonnes: 2000 },
      { jour: "2026-09-01", abonnes: 1005 },
    ]
  );
  assert.deepEqual(parJour, { "2026-09-01": 1005, "2026-10-01": 2000 });
});

// ── La foule et la place ─────────────────────────────────────────────────────

const CTX = { maintenant: "2026-11-07T08:00:00Z" };

/** Des images publiées en 2026, mûres (relevées 20 jours après), une par
 *  valeur de j'aime ; l'ID suit l'ordre. */
function images(likes: (number | null)[], sur: Partial<LigneBase> = {}) {
  return likes.map((v, i) =>
    postDe(ligne({ post_id: 100 + i, date: `2026-0${(i % 9) + 1}-10T09:00:00+00:00`, releve_a: `2026-0${(i % 9) + 1}-30T09:00:00+00:00`, likes: v, ...sur }), {})
  );
}

test("la foule : [1…6] donne les quartiles de la spec et le post type", () => {
  const f = foulesDe(images([1, 2, 3, 4, 5, 6]), "jaime", CTX).image;
  assert.equal(f.n, 6);
  assert.deepEqual(f.quartiles, { q1: 1.75, mediane: 3.5, q3: 5.25 });
});

test("la foule : un null n'est jamais compté 0 — il compte dans « x sur n », pas dans les quartiles", () => {
  const f = foulesDe(images([1, 2, 3, 4, 5, 6, null]), "jaime", CTX).image;
  assert.equal(f.n, 6);
  assert.equal(f.sur, 7);
  assert.deepEqual(f.quartiles, { q1: 1.75, mediane: 3.5, q3: 5.25 });
});

test("rien sous 6 : ni quartiles, ni place — la mention dit combien il y en a", () => {
  const posts = images([1, 2, 3, 4, 5]);
  const foules = foulesDe(posts, "jaime", CTX);
  assert.equal(foules.image.quartiles, null);
  assert.deepEqual(placeDuPost(posts[0], "jaime", foules, CTX), { etat: "foule_mince", n: 5, format: "image" });
});

test("la place : bornes de la spec, un post pile au post type est en haut, hors norme au-delà de Tukey", () => {
  // python3.12 : quantiles([1,2,3,4,5,6,100]) → [2.0, 4.0, 6.0] ; IQR 4,
  // limite haute 6 + 1,5 × 4 = 12.
  const posts = images([1, 2, 3, 4, 5, 6, 100]);
  const foules = foulesDe(posts, "jaime", CTX);
  const place = (i: number) => placeDuPost(posts[i], "jaime", foules, CTX);
  assert.deepEqual(place(0), { etat: "place", place: "en_dessous", horsNorme: false });
  assert.deepEqual(place(1), { etat: "place", place: "bas", horsNorme: false }); // q1 ≤ v < médiane
  assert.deepEqual(place(3), { etat: "place", place: "haut", horsNorme: false }); // pile au post type
  assert.deepEqual(place(5), { etat: "place", place: "haut", horsNorme: false }); // = q3
  assert.deepEqual(place(6), { etat: "place", place: "au_dessus", horsNorme: true });
});

test("plus de 12 mois : hors de la foule, et sa place est « plus d'un an »", () => {
  const vieux = postDe(ligne({ post_id: 9, date: "2025-11-06T09:00:00+00:00", likes: 1000 }), {});
  const posts = [...images([1, 2, 3, 4, 5, 6]), vieux];
  const foules = foulesDe(posts, "jaime", CTX);
  assert.equal(foules.image.n, 6);
  assert.deepEqual(foules.image.quartiles, { q1: 1.75, mediane: 3.5, q3: 5.25 });
  assert.deepEqual(placeDuPost(vieux, "jaime", foules, CTX), { etat: "plus_d_un_an" });
});

test("moins de 48 h : hors de la foule, aucune place ; de 48 h à 7 jours : la place viendra à âge égal", () => {
  const jeune = postDe(ligne({ post_id: 8, date: "2026-11-06T09:00:00+00:00", releve_a: "2026-11-07T07:00:00+00:00", likes: 1000 }), {});
  const j3 = postDe(ligne({ post_id: 7, date: "2026-11-03T09:00:00+00:00", releve_a: "2026-11-06T10:00:00+00:00", likes: 4 }), {});
  const posts = [...images([1, 2, 3, 4, 5, 6]), jeune];
  const foules = foulesDe(posts, "jaime", CTX);
  assert.equal(foules.image.n, 6);
  assert.deepEqual(placeDuPost(jeune, "jaime", foules, CTX), { etat: "jeune" });
  assert.deepEqual(placeDuPost(j3, "jaime", foulesDe([...posts, j3], "jaime", CTX), CTX), { etat: "age_egal", jours: 3 });
  // Mais il compte dans la référence des autres (âge ≥ 48 h).
  assert.equal(foulesDe([...posts, j3], "jaime", CTX).image.n, 7);
});

test("sans relevé daté, un post est lu comme mûr", () => {
  const posts = images([1, 2, 3, 4, 5, 6], { releve_a: null });
  const foules = foulesDe(posts, "jaime", CTX);
  assert.equal(foules.image.n, 6);
  assert.deepEqual(placeDuPost(posts[0], "jaime", foules, CTX), { etat: "place", place: "en_dessous", horsNorme: false });
});

test("format inconnu : hors des quatre foules, et le dit", () => {
  const inconnu = postDe(ligne({ post_id: 6, type: "VIDEO", media_product_type: null, likes: 3 }), {});
  const foules = foulesDe([...images([1, 2, 3, 4, 5, 6]), inconnu], "jaime", CTX);
  for (const f of Object.values(foules)) assert.ok(!f.posts.includes(inconnu));
  assert.equal(foules.image.n, 6);
  assert.deepEqual(placeDuPost(inconnu, "jaime", foules, CTX), { etat: "format_inconnu" });
});

test("sans valeur sur la métrique : aucune place, pas « en dessous »", () => {
  const posts = images([1, 2, 3, 4, 5, 6, null]);
  assert.deepEqual(placeDuPost(posts[6], "jaime", foulesDe(posts, "jaime", CTX), CTX), { etat: "sans_valeur" });
});

test("totaux : la somme des valeurs avec « x sur n », jamais la portée ni un taux", () => {
  const posts = images([1, 2, null]);
  assert.deepEqual(totalDe(posts, "jaime"), { total: 3, avecValeur: 2, n: 3 });
  assert.equal(totalDe(posts, "portee"), null);
  assert.equal(totalDe(posts, "taux"), null);
  assert.equal(totalDe(posts, "reactions_fortes"), null);
  assert.equal(totalDe(posts, "abonnes_1000"), null);
  assert.equal(totalDe(posts, "portee_abonnes"), null);
  // Aucune valeur : pas de total à 0.
  assert.deepEqual(totalDe(images([null, null]), "jaime"), { total: null, avecValeur: 0, n: 2 });
});
