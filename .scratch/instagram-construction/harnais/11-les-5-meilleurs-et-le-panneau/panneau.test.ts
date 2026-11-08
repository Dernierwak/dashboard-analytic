// Harnais du ticket 11 — le Panneau « lire un post » et le lien `?post=`.
// Lancer : sh .scratch/instagram-construction/harnais/11-les-5-meilleurs-et-le-panneau/lancer.sh
// Seams : `lecturePostDe`, `lecteurDe`, `jourDuRapport`, `phraseEcartHebdo`
// (`lib/instagram/panneau.ts`) et `lienInstagram` (`lib/instagram/liens.ts`).
// Valeurs attendues : la spec, § Panneau latéral et § L'état de la page vit
// dans l'URL ; la phrase de l'hebdo telle que la spec l'écrit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { METRIQUES } from "@/lib/instagram/lecture";
import { jourDuRapport, lecteurDe, lecturePostDe, phraseEcartHebdo } from "@/lib/instagram/panneau";
import { lienInstagram } from "@/lib/instagram/liens";
import { ctx, post, sixImages } from "./fixtures.ts";

const REEL = { type: "VIDEO", media_product_type: "REELS", permalink: "https://www.instagram.com/reel/AbC123/" };

test("le lecteur public d'Instagram pour un Reel ou une vidéo, depuis le permalink", () => {
  assert.equal(lecteurDe(post("2026-10-27T09:00:00Z", REEL)), "https://www.instagram.com/reel/AbC123/embed");
  const fil = post("2026-10-27T09:00:00Z", { type: "VIDEO", media_product_type: "FEED", permalink: "https://www.instagram.com/p/XyZ?igsh=1" });
  assert.equal(lecteurDe(fil), "https://www.instagram.com/p/XyZ/embed");
});

test("sans permalink, ni lecteur ; une image n'en a pas ; un lien hors d'Instagram non plus", () => {
  assert.equal(lecteurDe(post("2026-10-27T09:00:00Z", { ...REEL, permalink: null })), null);
  assert.equal(lecteurDe(post("2026-10-27T09:00:00Z", { permalink: "https://www.instagram.com/p/Img/" })), null);
  assert.equal(lecteurDe(post("2026-10-27T09:00:00Z", { ...REEL, permalink: "https://exemple.com/reel/x/" })), null);
});

test("la place sur CHAQUE métrique, null restant null", () => {
  const p = post("2026-10-27T09:00:00Z", { likes: 6, shares: null });
  const l = lecturePostDe(p, [...sixImages(), p], "jaime", ctx);
  assert.deepEqual(l.places.map((x) => x.metrique).sort(), Object.keys(METRIQUES).sort());
  const jaime = l.places.find((x) => x.metrique === "jaime");
  assert.deepEqual(jaime, { metrique: "jaime", valeur: 6, place: { etat: "place", place: "haut", horsNorme: false } });
  const partages = l.places.find((x) => x.metrique === "partages");
  assert.deepEqual(partages, { metrique: "partages", valeur: null, place: { etat: "sans_valeur" } });
  // La métrique choisie : sa valeur et la moustache des 12 mois du format.
  assert.equal(l.valeur, 6);
  assert.equal(l.moustache?.etat === "boite" && l.moustache.quartiles.mediane, 4);
});

test("temps de visionnage pour un Reel seulement, en secondes", () => {
  const reel = post("2026-10-27T09:00:00Z", { ...REEL, avg_watch_time: 4200 });
  assert.equal(lecturePostDe(reel, [reel], "portee", ctx).visionnage, 4.2);
  const image = post("2026-10-27T09:00:00Z", { avg_watch_time: 4200 });
  assert.equal(lecturePostDe(image, [image], "portee", ctx).visionnage, null);
});

test("l'âge : sous 7 jours il se dit et peut encore changer ; au-delà, rien", () => {
  const jeune = post("2026-11-05T09:00:00Z", { releve_a: "2026-11-06T09:00:00Z" });
  assert.deepEqual(lecturePostDe(jeune, [jeune], "jaime", ctx).age, { texte: "moins de 48 h", peutChanger: true });
  const j3 = post("2026-11-02T09:00:00Z", { releve_a: "2026-11-05T10:00:00Z" });
  assert.deepEqual(lecturePostDe(j3, [j3], "jaime", ctx).age, { texte: "J+3", peutChanger: true });
  const mur = post("2026-10-01T09:00:00Z");
  assert.equal(lecturePostDe(mur, [mur], "jaime", ctx).age, null);
});

test("le rapport du Jour de travail : le lendemain de la fin de sa semaine", () => {
  assert.equal(jourDuRapport("2026-11-01"), "2026-11-02");
  assert.equal(jourDuRapport("2026-12-31"), "2027-01-01");
});

test("la phrase de l'écart avec l'hebdo, quand un rapport a listé ce post avant le dernier relevé", () => {
  assert.equal(
    phraseEcartHebdo("2026-11-05T07:03:00Z", "2026-10-26"),
    "Chiffres au 5 novembre 2026. Le rapport du 26 octobre 2026 les avait lus ce jour-là : un post continue de gagner des vues après sa publication."
  );
});

test("pas de phrase sans rapport, sans relevé daté, ni quand le rapport n'est pas antérieur au relevé", () => {
  assert.equal(phraseEcartHebdo("2026-11-05T07:03:00Z", null), null);
  assert.equal(phraseEcartHebdo(null, "2026-10-26"), null);
  assert.equal(phraseEcartHebdo("2026-11-02T07:03:00Z", "2026-11-02"), null);
});

test("ouvrir un post ne change que `post` et garde le reste de l'URL", () => {
  const params = { from: "2026-10-01", to: "2026-10-31", metrique: "jaime", inconnu: "x" };
  assert.equal(lienInstagram(params, { post: "17890" }), "/instagram?from=2026-10-01&to=2026-10-31&metrique=jaime&inconnu=x&post=17890");
  assert.equal(lienInstagram({ ...params, post: "17890" }, { post: null }), "/instagram?from=2026-10-01&to=2026-10-31&metrique=jaime&inconnu=x");
});
