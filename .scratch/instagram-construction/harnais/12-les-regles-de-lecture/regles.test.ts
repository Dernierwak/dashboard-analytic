// Harnais du ticket 12 — les Règles de lecture.
// Lancer : sh .scratch/instagram-construction/harnais/12-les-regles-de-lecture/lancer.sh
// Seams : `reglesDe`, `ecartesDe`, `retenus`, `ligneRegles`, `mentionSousSix`
// (`lib/instagram/regles.ts`) ; `moduleAnneeDe`, `meilleursDe`, `tableauDe`,
// `lecturePostDe` qui reçoivent les écartés ; `lienInstagram`.
// Valeurs attendues : la spec, § La lecture, lignes « sans les hors norme »,
// « sans les boostés », « La mention sous 6 posts » ; § Tableau (« écarté :
// hors norme sur les j'aime ») ; § L'état de la page vit dans l'URL. Les
// quartiles attendus sont calculés à la main en méthode exclusive (celle de
// `statistics.quantiles`), pas par le code testé.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ecartesDe, ligneRegles, mentionSousSix, reglesDe, retenus, STANDARD } from "@/lib/instagram/regles";
import { moduleAnneeDe } from "@/lib/instagram/annee";
import { meilleursDe } from "@/lib/instagram/meilleurs";
import { libellePlace, tableauDe } from "@/lib/instagram/tableau";
import { lecturePostDe } from "@/lib/instagram/panneau";
import { lienInstagram } from "@/lib/instagram/liens";
import { ctx, post, SEMAINE } from "../11-les-5-meilleurs-et-le-panneau/fixtures.ts";

const SANS_HN = { sansBoostes: false, sansHorsNorme: true };
const SANS_B = { sansBoostes: true, sansHorsNorme: false };

/** Huit images de l'année, j'aime 1…6, 13 et 100. Une passe de Tukey :
 *  q1 2,25 · q3 11,25 · limite haute 24,75 → seul 100 part. Sur le reste
 *  [1…6, 13] (q1 2 · q3 6 · limite 12), une SECONDE passe retirerait 13 :
 *  elle ne doit pas avoir lieu. */
function huitImages() {
  return [1, 2, 3, 4, 5, 6, 13, 100].map((v, i) => post(`2026-0${2 + i}-10T09:00:00Z`, { likes: v }));
}

test("sans les hors norme : Tukey une seule passe sur la référence de la métrique affichée", () => {
  const posts = huitImages();
  const e = ecartesDe(posts, "jaime", SANS_HN, ctx);
  assert.deepEqual(Object.keys(e.raisons), [posts[7].id]);
  assert.deepEqual(e.raisons[posts[7].id], { cause: "hors_norme", metrique: "jaime" });
  assert.equal(e.total, 1);
  // Quartiles refaits sur le reste, sans recommencer : [1…6, 13] → 2 / 4 / 6.
  const [r] = moduleAnneeDe(posts, "jaime", SEMAINE, ctx, e).rangees;
  assert.equal(r.etat === "lue" && r.postType, 4);
  assert.equal(r.etat === "lue" && r.n, 7);
});

test("sans filtre, rien n'est écarté et la référence garde tout le monde", () => {
  const posts = huitImages();
  const e = ecartesDe(posts, "jaime", STANDARD, ctx);
  assert.equal(e.total, 0);
  const [r] = moduleAnneeDe(posts, "jaime", SEMAINE, ctx, e).rangees;
  // [1…6, 13, 100] : médiane 4,5.
  assert.equal(r.etat === "lue" && r.postType, 4.5);
});

test("sans les hors norme : les bornes suivent la métrique affichée", () => {
  const posts = huitImages();
  // Sur la portée, toutes à 100 : personne n'est hors norme.
  assert.equal(ecartesDe(posts, "portee", SANS_HN, ctx).total, 0);
});

test("sans les boostés : retirés de toutes les foules, quelle que soit la métrique", () => {
  const posts = [1, 2, 3, 4, 5, 6].map((v, i) => post(`2026-0${3 + i}-10T09:00:00Z`, { likes: v }));
  const booste = post("2026-09-10T09:00:00Z", { likes: 7, booste_vu_le: "2026-09-11" });
  const ancien = post("2024-09-10T09:00:00Z", { likes: 7, booste_vu_le: "2024-09-11" });
  const tous = [...posts, booste, ancien];
  for (const m of ["jaime", "portee"] as const) {
    const e = ecartesDe(tous, m, SANS_B, ctx);
    // Un boosté de plus de 12 mois n'était dans aucune foule : il n'est pas
    // « écarté », il n'aurait pas compté.
    assert.deepEqual(e.raisons, { [booste.id]: { cause: "booste" } });
  }
  const [r] = moduleAnneeDe(tous, "jaime", SEMAINE, ctx, ecartesDe(tous, "jaime", SANS_B, ctx)).rangees;
  // [1…6] : médiane 3,5 (contrôle de la spec), au lieu de 4 avec le boosté.
  assert.equal(r.etat === "lue" && r.postType, 3.5);
});

test("les deux filtres : les boostés partent d'abord, Tukey se calcule sur le reste", () => {
  const posts = huitImages();
  const booste = post("2026-10-01T09:00:00Z", { likes: 13, booste_vu_le: "2026-10-02" });
  const e = ecartesDe([...posts, booste], "jaime", { sansBoostes: true, sansHorsNorme: true }, ctx);
  assert.deepEqual(e.raisons, { [booste.id]: { cause: "booste" }, [posts[7].id]: { cause: "hors_norme", metrique: "jaime" } });
  assert.equal(e.total, 2);
});

test("minimum 6 jugé APRÈS le retrait, et la mention sous 6 garde sa raison", () => {
  const posts = [1, 2, 3, 4, 5].map((v, i) => post(`2026-0${3 + i}-10T09:00:00Z`, { likes: v }));
  const booste = post("2026-09-10T09:00:00Z", { likes: 6, booste_vu_le: "2026-09-11" });
  const e = ecartesDe([...posts, booste], "jaime", SANS_B, ctx);
  const [r] = moduleAnneeDe([...posts, booste], "jaime", SEMAINE, ctx, e).rangees;
  assert.equal(r.etat === "lue" && r.postType, null);
  assert.equal(r.etat === "lue" && r.n, 5);
  assert.equal(r.etat === "lue" && r.ecartes, 1);
  // La phrase de la spec (§ La lecture, « La mention sous 6 posts »).
  assert.equal(mentionSousSix(5, "reel", 1), "5 Reels, il en faut 6 — 1 est écarté par ton filtre");
  assert.equal(mentionSousSix(4, "image", 2), "4 Images, il en faut 6 — 2 sont écartés par ton filtre");
  assert.equal(mentionSousSix(5, "reel", 0), "5 Reels, il en faut 6");
  // Au Tableau, un post de la foule mince le dit aussi.
  const t = tableauDe([...posts, booste], "jaime", ctx, e);
  const ligne = t.lignes.find((l) => l.post.id === posts[0].id);
  assert.deepEqual(ligne?.place, { etat: "foule_mince", n: 5, format: "image", ecartes: 1 });
});

test("au Tableau, un écarté reste, avec sa raison", () => {
  const posts = huitImages();
  const booste = post("2026-10-01T09:00:00Z", { likes: 3, booste_vu_le: "2026-10-02" });
  const tous = [...posts, booste];
  const e = ecartesDe(tous, "jaime", { sansBoostes: true, sansHorsNorme: true }, ctx);
  const t = tableauDe(tous, "jaime", ctx, e);
  assert.equal(t.lignes.length, 9);
  const place = (id: string) => libellePlace(t.lignes.find((l) => l.post.id === id)!.place);
  assert.equal(place(posts[7].id), "écarté : hors norme sur les j'aime");
  assert.equal(place(booste.id), "écarté : boosté");
});

test("au nuage, l'écarté reste, sa place dit pourquoi ; hors de la liste des 5", () => {
  const posts = huitImages();
  const periode = post("2026-10-27T09:00:00Z", { likes: 500 });
  const tous = [...posts, periode];
  const e = ecartesDe(tous, "jaime", SANS_HN, ctx);
  const [r] = moduleAnneeDe(tous, "jaime", SEMAINE, ctx, e).rangees;
  assert.equal(r.etat === "lue" && r.nuage.length, 1);
  assert.deepEqual(r.etat === "lue" && r.nuage[0].place, { etat: "ecarte", raison: { cause: "hors_norme", metrique: "jaime" } });
  assert.deepEqual(meilleursDe(retenus(tous, e), "jaime", SEMAINE, ctx), []);
});

test("au Panneau, la place de l'écarté dit pourquoi, sur la métrique affichée", () => {
  const posts = huitImages();
  const l = lecturePostDe(posts[7], posts, "jaime", ctx, SANS_HN);
  assert.deepEqual(l.place, { etat: "ecarte", raison: { cause: "hors_norme", metrique: "jaime" } });
  const portee = l.places.find((x) => x.metrique === "portee");
  assert.equal(portee?.place.etat, "place");
});

test("deux filtres dans l'URL, rien d'autre ; une valeur inconnue n'en allume aucun", () => {
  assert.deepEqual(reglesDe({}), STANDARD);
  assert.deepEqual(reglesDe({ sansBoostes: "1", sansHorsNorme: "1" }), { sansBoostes: true, sansHorsNorme: true });
  assert.deepEqual(reglesDe({ sansBoostes: "0" }), STANDARD);
});

test("la ligne « Lu sans … » dit le filtre et combien de posts il écarte", () => {
  assert.equal(ligneRegles(STANDARD, 0, "jaime"), null);
  assert.equal(ligneRegles(SANS_B, 4, "jaime"), "Lu sans les boostés — 4 posts écartés.");
  assert.equal(ligneRegles(SANS_HN, 1, "jaime"), "Lu sans les hors norme sur les j'aime — 1 post écarté.");
  assert.equal(ligneRegles({ sansBoostes: true, sansHorsNorme: true }, 0, "taux"), "Lu sans les boostés ni les hors norme sur le taux d'engagement — aucun post écarté.");
});

test("« Revenir aux règles standard » ne retire que les deux filtres", () => {
  const params = { from: "2026-10-01", metrique: "jaime", post: "17", sansBoostes: "1", sansHorsNorme: "1", inconnu: "x" };
  assert.equal(lienInstagram(params, { sansBoostes: null, sansHorsNorme: null }), "/instagram?from=2026-10-01&metrique=jaime&post=17&inconnu=x");
});
