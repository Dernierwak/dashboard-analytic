// Harnais du ticket 09 — le Tableau « Tous tes posts » et son export.
// Lancer : sh .scratch/instagram-construction/harnais/09-la-lecture/lancer.sh
import { test } from "node:test";
import assert from "node:assert/strict";
import { postDe, type LigneBase } from "@/lib/instagram/lecture";
import { csvDuTableau, nomDuFichier, tableauDe, trier } from "@/lib/instagram/tableau";

const CTX = { maintenant: "2026-11-07T08:00:00Z" };

function ligne(sur: Partial<LigneBase>): LigneBase {
  return {
    post_id: 1,
    date: "2026-10-01T09:00:00+00:00",
    type: "IMAGE",
    media_product_type: "FEED",
    caption: "Un post",
    media_url: null,
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

const POSTS = [
  postDe(ligne({ post_id: 1, date: "2026-03-01T09:00:00+00:00", likes: 40 }), {}),
  postDe(ligne({ post_id: 2, date: "2026-10-01T09:00:00+00:00", likes: null }), {}),
  postDe(ligne({ post_id: 3, date: "2026-06-01T09:00:00+00:00", likes: 7 }), {}),
  postDe(ligne({ post_id: 4, date: "2024-01-01T09:00:00+00:00", likes: 900 }), {}),
];
const ids = (l: { post: { id: string } }[]) => l.map((x) => x.post.id);

test("tout l'historique, du plus récent au plus ancien par défaut", () => {
  const t = tableauDe(POSTS, "jaime", CTX);
  assert.deepEqual(ids(t.lignes), ["2", "3", "1", "4"]);
});

test("tri par date dans les deux sens", () => {
  const t = tableauDe(POSTS, "jaime", CTX);
  assert.deepEqual(ids(trier(t.lignes, "date", "asc")), ["4", "1", "3", "2"]);
});

test("tri par métrique : un post sans valeur reste en bas, dans les deux sens ; un post de plus d'un an se trie sur sa valeur brute", () => {
  const t = tableauDe(POSTS, "jaime", CTX);
  assert.deepEqual(ids(trier(t.lignes, "jaime", "desc")), ["4", "1", "3", "2"]);
  assert.deepEqual(ids(trier(t.lignes, "jaime", "asc")), ["3", "1", "4", "2"]);
});

test("la Place suit la métrique choisie ; plus de 12 mois → « plus d'un an »", () => {
  const t = tableauDe(POSTS, "jaime", CTX);
  const vieux = t.lignes.find((l) => l.post.id === "4")!;
  assert.deepEqual(vieux.place, { etat: "plus_d_un_an" });
  assert.equal(t.metrique, "jaime");
  // Trois images dans l'année : moins de 6, aucune place.
  assert.deepEqual(t.lignes.find((l) => l.post.id === "1")!.place, { etat: "foule_mince", n: 2, format: "image" });
});

test("le temps de visionnage : rempli pour un Reel seulement, en secondes", () => {
  const reel = postDe(ligne({ post_id: 5, type: "VIDEO", media_product_type: "REELS", avg_watch_time: 12345 }), {});
  const image = postDe(ligne({ post_id: 6, avg_watch_time: 999 }), {});
  const t = tableauDe([reel, image], "taux", CTX);
  assert.equal(t.lignes.find((l) => l.post.id === "5")!.visionnage, 12.345);
  assert.equal(t.lignes.find((l) => l.post.id === "6")!.visionnage, null);
});

test("une métrique choisie hors des colonnes fixes s'ajoute au Tableau", () => {
  assert.ok(!tableauDe(POSTS, "jaime", CTX).colonnes.includes("reactions_fortes"));
  assert.ok(tableauDe(POSTS, "reactions_fortes", CTX).colonnes.includes("reactions_fortes"));
});

test("l'export : point-virgule, Date en première colonne, une absence est une cellule vide, jamais 0", () => {
  const p = postDe(
    ligne({ post_id: 7, caption: "=SOMME(A1); « été »", likes: null, follows: 0, releve_a: null, booste_vu_le: "2026-10-03" }),
    {}
  );
  const csv = csvDuTableau(tableauDe([p], "taux", CTX));
  const [entete, rang] = csv.trimEnd().split("\r\n");
  const cols = entete.split(";");
  assert.equal(cols[0], "Date");
  // Un découpage qui respecte les guillemets, comme le tableur.
  const cellules = [...rang.matchAll(/("(?:[^"]|"")*"|[^;]*)(;|$)/g)].map((x) => x[1]).slice(0, cols.length);
  const cellule = (nom: string) => cellules[cols.indexOf(nom)];
  assert.equal(cellules[0], "2026-10-01");
  assert.equal(cellule("J'aime"), "");
  assert.equal(cellule("Abonnés gagnés"), "0");
  assert.equal(cellule("Taux d'engagement (%)"), ""); // un terme manque
  assert.equal(cellule("Portée"), "400");
  assert.equal(cellule("Dernier relevé"), "");
  assert.equal(cellule("Boosté"), "oui");
  assert.equal(cellule("Temps de visionnage moyen (s)"), "");
  // Une légende ne s'exécute pas dans le tableur et ne casse pas les colonnes.
  assert.match(rang, /"'=SOMME\(A1\); « été »"/);
});

test("l'export écrit les décimales à la virgule", () => {
  const p = postDe(ligne({ post_id: 8, likes: 11, comments: 0, saved: 0, shares: 0, reach: 300 }), {});
  const csv = csvDuTableau(tableauDe([p], "taux", CTX));
  const [entete, rang] = csv.trimEnd().split("\r\n");
  assert.equal(rang.split(";")[entete.split(";").indexOf("Taux d'engagement (%)")], "3,7");
});

test("le nom du fichier porte la métrique et le jour de l'export", () => {
  assert.equal(nomDuFichier(tableauDe(POSTS, "jaime", CTX)), "pulse-instagram-posts-jaime-2026-11-07.csv");
});
