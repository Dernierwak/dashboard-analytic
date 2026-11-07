// Harnais du ticket 13 — l'âge d'un post à l'écran.
// Lancer : sh .scratch/instagram-construction/harnais/13-l-age-d-un-post/lancer.sh
// Seams : `relevesDe`, `placeDuPost` (relevés dans le contexte), `ageLu`
// (`lib/instagram/lecture.ts`), et ce que le Tableau / le module / la liste en
// tirent. Valeurs attendues : la spec, § La lecture, lignes « âge » et « place
// à âge égal » — n = ⌊âge ÷ 24⌋, de chaque AUTRE post du format sur 12 mois son
// PREMIER relevé tombé dans [n × 24 ; (n+1) × 24) h, mêmes quartiles, minimum 6.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ageLu, foulesDe, placeDuPost, postDe, relevesDe, type LigneBase, type LigneReleve, type Post } from "@/lib/instagram/lecture";

const MAINTENANT = "2026-11-07T08:00:00.000Z";
const H = 3_600_000;

let id = 0;
/** Une image publiée à `date`, relevée `ageH` heures plus tard (null = sans relevé daté). */
function image(date: string, ageH: number | null, likes: number, sur: Partial<LigneBase> = {}): Post {
  id += 1;
  return postDe(
    {
      post_id: `p${id}`,
      date,
      type: "IMAGE",
      media_product_type: "FEED",
      reach: 100,
      likes,
      comments: 0,
      saved: 0,
      shares: 0,
      releve_a: ageH === null ? null : new Date(Date.parse(date) + ageH * H).toISOString(),
      ...sur,
    },
    {}
  );
}

function releve(p: Post, ageH: number, likes: number | null): LigneReleve {
  return { post_id: p.id, releve_a: new Date(Date.parse(p.date) + ageH * H).toISOString(), age_heures: ageH, reach: 100, likes, comments: 0, saved: 0, shares: 0 };
}

/** Six images mûres (j'aime finaux 100…600) ; à J+3 elles avaient 1…6. */
function sixMures(): { posts: Post[]; lignes: LigneReleve[] } {
  const posts = [1, 2, 3, 4, 5, 6].map((v, i) => image(`2026-0${3 + i}-10T09:00:00Z`, 240, v * 100));
  const lignes = posts.flatMap((p, i) => [
    releve(p, 30, 0), // J+1 : pas le bon jour
    releve(p, 90, 999), // J+3 aussi, mais rendu AVANT dans la liste : l'ordre de la base ne décide pas
    releve(p, 80, i + 1), // J+3, le PREMIER de la fenêtre
    releve(p, 100, 999), // J+4
  ]);
  return { posts, lignes };
}

test("l'âge égal se lit sur le PREMIER relevé de chaque autre post tombé dans le bon J+n", () => {
  const { posts, lignes } = sixMures();
  const j3 = image("2026-11-02T09:00:00Z", 75, 6); // 75 h → J+3, 6 j'aime
  const tous = [...posts, j3];
  const ctx = { maintenant: MAINTENANT, releves: relevesDe(lignes) };
  // À J+3 les autres valaient 1…6 : quartiles exclusifs 1,75 / 3,5 / 5,25 —
  // 6 > 5,25, « au-dessus ». Face aux valeurs finales (100…600), il serait en dessous.
  assert.deepEqual(placeDuPost(j3, "jaime", foulesDe(tous, "jaime", ctx), ctx), {
    etat: "age_egal_place",
    jours: 3,
    place: "au_dessus",
    horsNorme: false,
    n: 6,
  });
});

test("sous 6 posts relevés au même âge : pas de place, une mention — un relevé hors du J+n ne compte pas", () => {
  const { posts, lignes } = sixMures();
  // Le sixième n'a été relevé qu'à J+1 et J+4 : rien à J+3.
  const sansJ3 = lignes.filter((l) => !(l.post_id === posts[5].id && (l.age_heures as number) >= 72 && (l.age_heures as number) < 96));
  const j3 = image("2026-11-02T09:00:00Z", 75, 6);
  const ctx = { maintenant: MAINTENANT, releves: relevesDe(sansJ3) };
  assert.deepEqual(placeDuPost(j3, "jaime", foulesDe([...posts, j3], "jaime", ctx), ctx), {
    etat: "age_egal_mince",
    jours: 3,
    n: 5,
    format: "image",
  });
});

test("un relevé sans la valeur à cet âge ne compte pas : null n'est pas 0", () => {
  const { posts, lignes } = sixMures();
  lignes.find((l) => l.post_id === posts[0].id && l.age_heures === 80)!.likes = null;
  const j3 = image("2026-11-02T09:00:00Z", 75, 6);
  const ctx = { maintenant: MAINTENANT, releves: relevesDe(lignes) };
  const place = placeDuPost(j3, "jaime", foulesDe([...posts, j3], "jaime", ctx), ctx);
  assert.equal(place.etat, "age_egal_mince");
});

test("le post lui-même, un autre format et un post de plus de 12 mois n'entrent pas dans l'âge égal", () => {
  const { posts, lignes } = sixMures();
  const j3 = image("2026-11-02T09:00:00Z", 75, 6);
  const reel = image("2026-09-01T09:00:00Z", 240, 1, { type: "VIDEO", media_product_type: "REELS" });
  const vieux = image("2025-09-01T09:00:00Z", 240, 1);
  // Cinq autres images seulement : le sixième relevé à J+3 manque.
  const cinq = lignes.filter((l) => l.post_id !== posts[5].id);
  const ctx = {
    maintenant: MAINTENANT,
    releves: relevesDe([...cinq, releve(j3, 75, 6), releve(reel, 80, 3), releve(vieux, 80, 3)]),
  };
  const tous = [...posts, j3, reel, vieux];
  assert.deepEqual(placeDuPost(j3, "jaime", foulesDe(tous, "jaime", ctx), ctx), { etat: "age_egal_mince", jours: 3, n: 5, format: "image" });
});

test("les écartés des Règles de lecture sortent aussi de l'âge égal", async () => {
  const { ecartesDe, placeLue, retenus } = await import("@/lib/instagram/regles");
  const { posts, lignes } = sixMures();
  const booste = image("2026-09-10T09:00:00Z", 240, 700, { booste_vu_le: "2026-09-11" });
  const j3 = image("2026-11-02T09:00:00Z", 75, 6);
  const tous = [...posts, booste, j3];
  const ctx = { maintenant: MAINTENANT, releves: relevesDe([...lignes, releve(booste, 80, 1000)]) };
  // Règles standard : sept posts relevés à J+3 (1…6 et 1 000), 6 reste sous q3.
  const standard = placeDuPost(j3, "jaime", foulesDe(tous, "jaime", ctx), ctx);
  assert.deepEqual(standard, { etat: "age_egal_place", jours: 3, place: "haut", horsNorme: false, n: 7 });
  // Sans les boostés : le boosté ne compte plus, six posts, 6 au-dessus.
  const e = ecartesDe(tous, "jaime", { sansBoostes: true, sansHorsNorme: false }, ctx);
  const lue = placeLue(j3, "jaime", foulesDe(retenus(tous, e), "jaime", ctx), ctx, e);
  assert.deepEqual(lue, { etat: "age_egal_place", jours: 3, place: "au_dessus", horsNorme: false, n: 6 });
});

// Revue de code : un filtre qui fait tomber l'âge égal sous 6 le dit, comme la
// mention de la référence (« — 1 est écarté par ton filtre »). Le compte est
// celui des écartés qui AURAIENT compté à cet âge : un relevé au même J+n,
// avec une valeur — pas tous les écartés du format.
test("un filtre fait tomber l'âge égal sous 6 : la mention dit combien il en a écartés à cet âge", async () => {
  const { ecartesDe, placeLue, retenus } = await import("@/lib/instagram/regles");
  const { raisonPlace } = await import("@/lib/instagram/tableau");
  const { posts, lignes } = sixMures();
  // Cinq images relevées à J+3 (la sixième pas), plus un boosté relevé à J+3
  // et un boosté sans relevé à J+3 : six au même âge sans filtre.
  const sansJ3 = lignes.filter((l) => !(l.post_id === posts[5].id && (l.age_heures as number) >= 72 && (l.age_heures as number) < 96));
  const booste = image("2026-09-10T09:00:00Z", 240, 700, { booste_vu_le: "2026-09-11" });
  const boosteSansJ3 = image("2026-09-12T09:00:00Z", 240, 800, { booste_vu_le: "2026-09-13" });
  const j3 = image("2026-11-02T09:00:00Z", 75, 6);
  const tous = [...posts, booste, boosteSansJ3, j3];
  const ctx = { maintenant: MAINTENANT, releves: relevesDe([...sansJ3, releve(booste, 80, 1000), releve(boosteSansJ3, 30, 5)]) };
  const e = ecartesDe(tous, "jaime", { sansBoostes: true, sansHorsNorme: false }, ctx);
  const lue = placeLue(j3, "jaime", foulesDe(retenus(tous, e), "jaime", ctx), ctx, e);
  assert.deepEqual(lue, { etat: "age_egal_mince", jours: 3, n: 5, format: "image", ecartes: 1 });
  assert.equal(
    raisonPlace(lue),
    "5 Images ont un relevé à J+3 sur les 12 derniers mois, il en faut 6 — 1 est écarté par ton filtre : sa place à âge égal attendra."
  );
});

test("sous 6 à âge égal sans filtre : la mention ne parle pas de filtre", async () => {
  const { placeLue, AUCUN_ECART } = await import("@/lib/instagram/regles");
  const { posts, lignes } = sixMures();
  const sansJ3 = lignes.filter((l) => !(l.post_id === posts[5].id && (l.age_heures as number) >= 72 && (l.age_heures as number) < 96));
  const j3 = image("2026-11-02T09:00:00Z", 75, 6);
  const ctx = { maintenant: MAINTENANT, releves: relevesDe(sansJ3) };
  assert.deepEqual(placeLue(j3, "jaime", foulesDe([...posts, j3], "jaime", ctx), ctx, AUCUN_ECART), {
    etat: "age_egal_mince",
    jours: 3,
    n: 5,
    format: "image",
  });
});

test("relevés non lus (base sans la section 23) : la place à âge égal ne se calcule pas, et ce n'est pas zéro post", () => {
  const { posts } = sixMures();
  const j3 = image("2026-11-02T09:00:00Z", 75, 6);
  const ctx = { maintenant: MAINTENANT };
  assert.deepEqual(placeDuPost(j3, "jaime", foulesDe([...posts, j3], "jaime", ctx), ctx), { etat: "age_egal", jours: 3 });
});

test("sans releve_a, un post a plus de 7 jours : aucun âge affiché, il se place sur la référence", () => {
  const { posts } = sixMures();
  const ancien = image("2026-11-05T09:00:00Z", null, 400); // publié il y a 2 jours, mais sans relevé daté
  const ctx = { maintenant: MAINTENANT, releves: {} };
  assert.equal(ageLu(ancien), null);
  // Référence 100…600 et lui-même (400) : sept valeurs, médiane 400 — pile au post type, « haut ».
  assert.deepEqual(placeDuPost(ancien, "jaime", foulesDe([...posts, ancien], "jaime", ctx), ctx), { etat: "place", place: "haut", horsNorme: false });
});

test("l'âge, une seule forme : moins de 48 h, J+n (au moins n × 24 h), rien à 7 jours", async () => {
  const { texteAge } = await import("@/lib/instagram/lecture");
  assert.deepEqual(ageLu(image("2026-11-05T09:00:00Z", 47.9, 1)), { texte: "moins de 48 h", peutChanger: true });
  assert.deepEqual(ageLu(image("2026-11-01T09:00:00Z", 48, 1)), { texte: "J+2", peutChanger: true });
  assert.deepEqual(ageLu(image("2026-10-30T09:00:00Z", 167.9, 1)), { texte: "J+6", peutChanger: true });
  assert.equal(ageLu(image("2026-10-30T09:00:00Z", 168, 1)), null);
  assert.equal(texteAge(ageLu(image("2026-11-02T09:00:00Z", 75, 1))), "J+3 · peut encore changer");
});

test("le Tableau, le module, la liste et le Panneau portent la même place à âge égal", async () => {
  const { tableauDe, libellePlace } = await import("@/lib/instagram/tableau");
  const { moduleAnneeDe } = await import("@/lib/instagram/annee");
  const { meilleursDe } = await import("@/lib/instagram/meilleurs");
  const { lecturePostDe } = await import("@/lib/instagram/panneau");
  const { posts, lignes } = sixMures();
  const j3 = image("2026-11-02T09:00:00Z", 75, 6);
  const tous = [...posts, j3];
  const ctx = { maintenant: MAINTENANT, releves: relevesDe(lignes) };
  const attendu = { etat: "age_egal_place", jours: 3, place: "au_dessus", horsNorme: false, n: 6 };
  const ligne = tableauDe(tous, "jaime", ctx).lignes.find((l) => l.post.id === j3.id)!;
  assert.deepEqual(ligne.place, attendu);
  assert.equal(libellePlace(ligne.place), "au-dessus à J+3");
  const semaine = { debut: "2026-11-01", fin: "2026-11-06" };
  const rangee = moduleAnneeDe(tous, "jaime", semaine, ctx).rangees.find((r) => r.format === "image")!;
  assert.ok(rangee.etat === "lue");
  assert.deepEqual(rangee.nuage.find((p) => p.post.id === j3.id)!.place, attendu);
  assert.deepEqual(meilleursDe(tous, "jaime", semaine, ctx)[0].place, attendu);
  const lu = lecturePostDe(j3, tous, "jaime", ctx);
  assert.deepEqual(lu.place, attendu);
  assert.deepEqual(lu.age, { texte: "J+3", peutChanger: true });
});

test("la mention sous 6 au même âge dit l'âge et combien il en manque", async () => {
  const { libellePlace, raisonPlace } = await import("@/lib/instagram/tableau");
  const mince = { etat: "age_egal_mince", jours: 3, n: 4, format: "reel" } as const;
  assert.equal(libellePlace(mince), "J+3 · 4 / 6 au même âge");
  assert.equal(raisonPlace(mince), "4 Reels ont un relevé à J+3 sur les 12 derniers mois, il en faut 6 : sa place à âge égal attendra.");
});
