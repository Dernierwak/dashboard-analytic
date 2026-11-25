// Harnais du ticket stories 02 — les stories dans la page `/instagram`.
// Lignes de base écrites à la main → ce que le client lira : une somme, un
// « – », une place, une phrase, une ligne de Tableau, une ligne de CSV.
// Spec : `.scratch/instagram-stories/spec.md`, § Ce que la page montre.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cheminsASigner,
  journeesDe,
  libelleJournee,
  raisonStory,
  RAISON_JAMAIS_RELUE,
  storyDe,
  texteReleve,
  texteSansChiffres,
  ZERO_CLIC,
  type LigneStory,
} from "@/lib/instagram/stories";
import { lireJourneesStories } from "@/lib/instagram/donnees-stories";
import { foulesDe, phraseSansMetrique, placeDuPost, postDe, valeurDe, type Contexte, type Post } from "@/lib/instagram/lecture";
import { moduleAnneeDe, raisonIndisponible } from "@/lib/instagram/annee";
import { meilleursDe } from "@/lib/instagram/meilleurs";
import { csvDuTableau, libellePlace, raisonPlace, tableauDe } from "@/lib/instagram/tableau";

const MAINTENANT = "2026-11-25T12:00:00.000Z";
const ctx: Contexte = { maintenant: MAINTENANT };

/** Une story relue à 22 h de vie, ses chiffres en `c`. */
function story(id: string, publiee: string, c: Partial<LigneStory> = {}, age = 22): LigneStory {
  const t = Date.parse(publiee);
  return {
    story_id: id,
    publiee_a: publiee,
    media_type: "IMAGE",
    image_path: `u1/${id}.jpg`,
    releve_a: new Date(t + age * 3_600_000).toISOString(),
    age_heures: age,
    ...c,
  };
}
/** Une story jamais relue : ni relevé ni chiffres. */
function sansReleve(id: string, publiee: string): LigneStory {
  return { story_id: id, publiee_a: publiee, image_path: `u1/${id}.jpg`, releve_a: null, age_heures: null };
}

function journee(lignes: LigneStory[], portees: Record<string, number> = {}): Post {
  const j = journeesDe(lignes, portees, MAINTENANT);
  assert.equal(j.length, 1);
  return j[0];
}

// ── Les sommes ───────────────────────────────────────────────────────────────

test("les comptes s'additionnent sur la journée, une absence n'est pas un zéro", () => {
  const p = journee([
    story("a", "2026-11-20T08:00:00Z", { views: 100, shares: 2, link_clicks: 3, nav_tap_exit: 10, total_interactions: 4 }),
    story("b", "2026-11-20T09:00:00Z", { views: 50, shares: null, link_clicks: 0, nav_tap_exit: 5, total_interactions: 1 }),
    story("c", "2026-11-20T10:00:00Z"), // relevée, rien rendu : sans chiffres
  ]);
  const j = p.journee!;
  assert.equal(j.etat, "complete");
  assert.equal(j.sommes.vues, 150);
  assert.equal(j.sommes.partages, 2, "seule la story mesurée compte, la vide n'ajoute pas 0");
  assert.equal(j.mesurees.partages, 1);
  assert.equal(j.sommes.clicsLien, 3);
  assert.equal(j.sommes.interactions, 5);
  assert.equal(j.sommes.abonnes, null, "aucune story n'a d'abonnés gagnés → « – », pas 0");
  assert.equal(j.sansChiffres, 1);
  assert.equal(texteSansChiffres(j), "1 story sans chiffres");
  assert.equal(valeurDe(p, "vues"), 150);
  assert.equal(valeurDe(p, "clics_lien"), 3);
  assert.equal(valeurDe(p, "interactions"), 5);
});

test("une story sans chiffres dit pourquoi : relevée sans rien rendu, ou jamais relue", () => {
  const relevee = storyDe(story("c", "2026-11-20T10:00:00Z"), MAINTENANT)!;
  assert.equal(relevee.etat, "sans_chiffres");
  assert.match(raisonStory(relevee) ?? "", /sous 5 spectateurs/);
  const perdue = storyDe(sansReleve("d", "2026-11-20T10:00:00Z"), MAINTENANT)!;
  assert.equal(perdue.etat, "jamais_relue");
  assert.equal(raisonStory(perdue), RAISON_JAMAIS_RELUE);
  assert.equal(RAISON_JAMAIS_RELUE, "Pulse n'a pas pu relire cette story avant sa disparition.");
});

// ── La portée ────────────────────────────────────────────────────────────────

test("la portée d'une journée est reach_story du compte, jamais la somme des portées", () => {
  const lignes = [
    story("a", "2026-11-20T08:00:00Z", { reach: 80, views: 100 }),
    story("b", "2026-11-20T09:00:00Z", { reach: 40, views: 50 }),
  ];
  const p = journee(lignes, { "2026-11-20": 95 });
  assert.equal(p.brutes.reach, 95);
  assert.equal(valeurDe(p, "portee"), 95);
  assert.equal(p.journee!.stories[0].portee, 80, "la portée de chaque story reste lisible au Panneau");
  const sans = journee(lignes, {});
  assert.equal(valeurDe(sans, "portee"), null, "reach_story absent → « – », pas 120");
  const foules = foulesDe([sans], "portee", ctx);
  assert.deepEqual(placeDuPost(sans, "portee", foules, ctx), { etat: "sans_valeur", journee: true });
});

// ── Sorties pour 100 vues ───────────────────────────────────────────────────

test("sorties pour 100 vues : quitter ÷ vues sur les mêmes stories", () => {
  const p = journee([
    story("a", "2026-11-20T08:00:00Z", { views: 100, nav_tap_exit: 10 }),
    story("b", "2026-11-20T09:00:00Z", { views: 100, nav_tap_exit: 20 }),
    // Des sorties sans vues : hors du ratio, pas de vues inventées.
    story("c", "2026-11-20T10:00:00Z", { views: null, nav_tap_exit: 30 }),
    // Des vues sans sorties : hors du ratio aussi.
    story("d", "2026-11-20T11:00:00Z", { views: 500, nav_tap_exit: null }),
  ]);
  assert.equal(valeurDe(p, "sorties_100"), 15);
  const zero = journee([story("a", "2026-11-20T08:00:00Z", { views: 0, nav_tap_exit: 0 })]);
  assert.equal(valeurDe(zero, "sorties_100"), null, "aucune vue → pas de ratio, jamais +∞");
});

// ── Complète, en cours, incomplète ───────────────────────────────────────────

test("le jour en cours est en cours, même relu", () => {
  const p = journee([story("a", "2026-11-25T00:10:00Z", { views: 10 }, 21)]);
  assert.equal(p.journee!.etat, "en_cours");
});

test("une story encore en vie sans relevé laisse la journée en cours", () => {
  // Publiée hier à 23:00, lue à 12:00 : 13 h de vie, le job ne l'a pas encore relue.
  const p = journee([story("a", "2026-11-24T08:00:00Z", { views: 10 }), sansReleve("b", "2026-11-24T23:00:00Z")]);
  assert.equal(p.journee!.etat, "en_cours");
  const foules = foulesDe([p], "vues", ctx);
  assert.deepEqual(placeDuPost(p, "vues", foules, ctx), { etat: "journee_en_cours" });
  assert.equal(libellePlace({ etat: "journee_en_cours" }), "en cours");
});

test("une story disparue sans relevé rend la journée incomplète, hors comparaison", () => {
  const p = journee([story("a", "2026-11-20T08:00:00Z", { views: 10 }), sansReleve("b", "2026-11-20T09:00:00Z")]);
  assert.equal(p.journee!.etat, "incomplete");
  assert.equal(p.journee!.sansChiffres, 1);
  assert.equal(p.journee!.sommes.vues, 10, "la somme reste partielle, jamais complétée");
  const foules = foulesDe([p], "vues", ctx);
  assert.deepEqual(placeDuPost(p, "vues", foules, ctx), { etat: "journee_incomplete", jamaisRelues: 1, avantRecolte: false });
  assert.equal(foules.story.sur, 0, "hors de la foule");
});

test("une journée d'avant le premier passage du job est incomplète, même relue", () => {
  // Le cas réel du 2026-11-25 : premier passage à 15:25, une seule story du 24
  // encore en ligne — les autres stories du 24 n'ont jamais été vues.
  const vue = { vue_le: "2026-11-25T15:25:00Z" };
  const [j25, j24] = journeesDe(
    [story("a", "2026-11-24T15:48:00Z", { views: 10, ...vue }), story("b", "2026-11-25T01:00:00Z", { views: 5, ...vue })],
    {},
    "2026-11-27T12:00:00.000Z"
  );
  assert.equal(j24.journee!.etat, "incomplete");
  assert.equal(j24.journee!.avantRecolte, true);
  assert.equal(j25.journee!.etat, "complete", "le jour du premier passage : toutes ses stories étaient encore en ligne");
  assert.match(raisonPlace(placeDuPost(j24, "vues", foulesDe([j24], "vues", ctx), ctx)) ?? "", /ne récoltait pas encore/);
});

test("un relevé pris avant 20 h de vie n'est pas un relevé final", () => {
  const s = storyDe(story("a", "2026-11-20T08:00:00Z", { views: 10 }, 19), MAINTENANT)!;
  assert.equal(s.etat, "jamais_relue");
  assert.equal(texteReleve(storyDe(story("b", "2026-11-20T08:00:00Z", { views: 1 }, 22.7), MAINTENANT)!), "relevé à 22 h de vie");
});

// ── La place ─────────────────────────────────────────────────────────────────

/** `n` journées complètes, du 1er au n-ième novembre, `clics` = leur rang. */
function journees(n: number): Post[] {
  const lignes = Array.from({ length: n }, (_, i) =>
    story(`s${i + 1}`, `2026-11-${String(i + 1).padStart(2, "0")}T10:00:00Z`, { link_clicks: i + 1, views: 100 })
  );
  return journeesDe(lignes, {}, MAINTENANT);
}

test("une journée complète se place parmi les journées des 12 mois, minimum 6", () => {
  const sept = journees(7);
  const foules = foulesDe(sept, "clics_lien", ctx);
  assert.equal(foules.story.n, 7);
  const septieme = sept.find((p) => p.jour === "2026-11-07")!;
  const place = placeDuPost(septieme, "clics_lien", foules, ctx);
  assert.equal(place.etat, "place");
  assert.equal(place.etat === "place" && place.place, "au_dessus");
  assert.match(raisonPlace(place), /journées de stories/);

  const cinq = journees(5);
  const mince = placeDuPost(cinq[0], "clics_lien", foulesDe(cinq, "clics_lien", ctx), ctx);
  assert.deepEqual(mince, { etat: "foule_mince", n: 5, format: "story", journee: true });
  assert.equal(libellePlace(mince), "5 / 6 journées");
});

// ── Les phrases ──────────────────────────────────────────────────────────────

test("Engagement : la story n'a ni taux ni j'aime, une phrase les remplace", () => {
  const p = journee([story("a", "2026-11-20T08:00:00Z", { views: 100, shares: 3, follows: 2 })], { "2026-11-20": 90 });
  assert.equal(valeurDe(p, "taux"), null);
  assert.equal(valeurDe(p, "jaime"), null);
  assert.equal(valeurDe(p, "partages"), 3);
  assert.equal(phraseSansMetrique("story", "taux"), "Instagram ne donne ni j'aime, ni commentaires, ni enregistrements pour une story.");
  const foules = foulesDe([p], "taux", ctx);
  assert.equal(placeDuPost(p, "taux", foules, ctx).etat, "sans_metrique");
});

test("Abonnés : pas de « pour 1 000 » pour une story, même avec portée et abonnés", () => {
  const p = journee([story("a", "2026-11-20T08:00:00Z", { follows: 2 })], { "2026-11-20": 90 });
  assert.equal(valeurDe(p, "abonnes"), 2);
  assert.equal(valeurDe(p, "abonnes_1000"), null, "aucun ratio entre la portée du jour et une somme");
  assert.equal(valeurDe(p, "portee_abonnes"), null);
});

test("Trafic : les autres formats reçoivent la phrase, jamais un zéro", () => {
  const image = postDe({ post_id: "1", date: "2026-11-02T10:00:00Z", type: "IMAGE", media_product_type: "FEED", reach: 50 }, {});
  assert.equal(valeurDe(image, "clics_lien"), null);
  assert.equal(phraseSansMetrique("image", "clics_lien"), "Instagram ne donne de clics sur le lien que pour les stories.");
  const place = placeDuPost(image, "clics_lien", foulesDe([image], "clics_lien", ctx), ctx);
  assert.deepEqual(place, { etat: "sans_metrique", phrase: "Instagram ne donne de clics sur le lien que pour les stories." });
  assert.equal(libellePlace(place), null, "« – » au Tableau");
});

test("un 0 de clics porte sa mention", () => {
  assert.equal(ZERO_CLIC, "Instagram rend aussi 0 pour une story sans lien.");
});

// ── Le module « Tes posts face à ton année » ─────────────────────────────────

const PERIODE = { debut: "2026-11-01", fin: "2026-11-24" };

function imagesDuFil(n: number): Post[] {
  return Array.from({ length: n }, (_, i) =>
    postDe(
      { post_id: String(100 + i), date: `2026-10-${String(i + 1).padStart(2, "0")}T10:00:00Z`, type: "IMAGE", media_product_type: "FEED", reach: 10 * (i + 1), likes: 1, comments: 0, saved: 0, shares: 0 },
      {}
    )
  );
}

test("la rangée Story vient en dernier ; un point = une journée complète", () => {
  const encours = journeesDe([sansReleve("x", "2026-11-24T23:00:00Z")], {}, MAINTENANT);
  const tous = [...imagesDuFil(6), ...journees(7), ...encours];
  const m = moduleAnneeDe(tous, "clics_lien", PERIODE, ctx);
  assert.deepEqual(m.rangees.map((r) => r.format), ["image", "story"]);
  const image = m.rangees[0];
  assert.equal(image.etat, "sans_metrique");
  assert.equal(image.etat === "sans_metrique" && image.phrase, "Instagram ne donne de clics sur le lien que pour les stories.");
  const story = m.rangees[1];
  assert.equal(story.etat, "lue");
  if (story.etat !== "lue") return;
  assert.equal(story.nuage.length, 7, "la journée en cours n'est pas un point");
  assert.equal(story.n, 7);
  assert.equal(story.total?.total, 28, "les clics se comptent : 1 + … + 7");
});

test("Engagement par défaut : la rangée Story reçoit la phrase", () => {
  const m = moduleAnneeDe([...imagesDuFil(6), ...journees(7)], "taux", PERIODE, ctx);
  const story = m.rangees.find((r) => r.format === "story")!;
  assert.equal(story.etat, "sans_metrique");
});

test("sans stories, ou avec des journées en cours seulement : pas de rangée Story", () => {
  assert.deepEqual(moduleAnneeDe(imagesDuFil(6), "vues", PERIODE, ctx).rangees.map((r) => r.format), ["image"]);
  const encours = journeesDe([sansReleve("x", "2026-11-24T23:00:00Z")], {}, MAINTENANT);
  assert.deepEqual(moduleAnneeDe([...imagesDuFil(6), ...encours], "vues", PERIODE, ctx).rangees.map((r) => r.format), ["image"]);
});

test("la référence parle des posts, les journées n'y sont pas comptées", () => {
  const m = moduleAnneeDe([...imagesDuFil(6), ...journees(7)], "vues", PERIODE, ctx);
  assert.deepEqual(m.reference, { complete: false, debut: "2026-10-01", fin: "2026-10-06", n: 6 });
});

test("une métrique des stories se grise avec sa raison tant qu'il n'y a pas de stories", () => {
  assert.equal(raisonIndisponible(imagesDuFil(6), "clics_lien"), "Pas encore en base : les stories.");
  assert.equal(raisonIndisponible([...imagesDuFil(6), ...journees(1)], "clics_lien"), null);
});

// ── Les 5 meilleurs ──────────────────────────────────────────────────────────

test("les journées entrent dans les 5 meilleurs, libellées « Stories du 24 nov. · 5 stories »", () => {
  const liste = meilleursDe(journees(7), "clics_lien", PERIODE, ctx);
  assert.equal(liste.length, 5);
  assert.equal(liste[0].post.jour, "2026-11-07");
  assert.equal(libelleJournee(liste[0].post.journee!), "Stories du 7 nov. · 1 story");
  const cinq = journee(
    Array.from({ length: 5 }, (_, i) => story(`z${i}`, `2026-11-24T0${i}:00:00Z`)),
    {}
  );
  assert.equal(libelleJournee(cinq.journee!), "Stories du 24 nov. · 5 stories");
});

// ── Le Tableau et l'export ───────────────────────────────────────────────────

test("le Tableau : une ligne par journée, la colonne des clics paraît avec les stories", () => {
  const t = tableauDe([...imagesDuFil(2), ...journees(3)], "vues", ctx);
  assert.equal(t.lignes.length, 5);
  assert.ok(t.colonnes.includes("clics_lien"));
  assert.ok(!tableauDe(imagesDuFil(2), "vues", ctx).colonnes.includes("clics_lien"));
});

test("l'export : une ligne par journée, le nombre de stories, une absence en cellule vide", () => {
  const p = journee([story("a", "2026-11-20T08:00:00Z", { views: 100, link_clicks: 0 }), story("b", "2026-11-20T09:00:00Z", { views: 20 })]);
  const t = tableauDe([...imagesDuFil(1), p], "vues", ctx);
  const [entete, ...rangs] = csvDuTableau(t).trimEnd().split("\r\n");
  const cols = entete.split(";");
  assert.equal(cols[0], "Date");
  assert.equal(cols[2], "Stories");
  const ligne = rangs.map((r) => r.split(";")).find((r) => r[1] === "Story")!;
  assert.equal(ligne[0], "2026-11-20");
  assert.equal(ligne[2], "2");
  assert.equal(ligne[cols.indexOf("Vues")], "120");
  assert.equal(ligne[cols.indexOf("Clics sur le lien")], "0", "un vrai 0 reste 0");
  assert.equal(ligne[cols.indexOf("Portée")], "", "reach_story absent → cellule vide");
  assert.equal(ligne[cols.indexOf("J'aime")], "");
  assert.equal(rangs.length, 2);
  assert.ok(!csvDuTableau(tableauDe(imagesDuFil(1), "vues", ctx)).startsWith("Date;Format;Stories"));
});

// ── Les vignettes ────────────────────────────────────────────────────────────

test("on signe la première vignette de chaque journée, et toutes celles de la journée ouverte", () => {
  const lignes = [
    story("a2", "2026-11-20T09:00:00Z"),
    story("a1", "2026-11-20T08:00:00Z"),
    story("b1", "2026-11-21T08:00:00Z"),
    story("b2", "2026-11-21T09:00:00Z"),
    { ...story("c1", "2026-11-22T08:00:00Z"), image_path: null },
  ];
  assert.deepEqual(cheminsASigner(lignes, null).sort(), ["u1/a1.jpg", "u1/b1.jpg"]);
  assert.deepEqual(cheminsASigner(lignes, "stories-2026-11-21").sort(), ["u1/a1.jpg", "u1/b1.jpg", "u1/b2.jpg"]);
  const p = journeesDe(lignes.slice(0, 2), {}, MAINTENANT, { "u1/a1.jpg": "https://signee/a1" })[0];
  assert.equal(p.image, "https://signee/a1");
  assert.equal(p.journee!.stories[1].image, null, "non signée → pas de vignette, pas d'erreur");
});

// ── La lecture de la base ────────────────────────────────────────────────────

type Rep = { data?: unknown[]; error?: unknown };
function fauxClient(tables: Record<string, Rep>, signature?: { data: unknown; error: unknown }) {
  const signes: string[][] = [];
  const client = {
    from(t: string) {
      const r = tables[t] ?? { error: { code: "42P01", message: `relation ${t} does not exist` } };
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.eq = () => b;
      b.order = () => b;
      b.range = (de: number, a: number) =>
        Promise.resolve(r.error ? { data: null, error: r.error } : { data: (r.data ?? []).slice(de, a + 1), error: null });
      return b;
    },
    storage: {
      from: () => ({
        createSignedUrls: async (chemins: string[]) => {
          signes.push(chemins);
          return signature ?? { data: chemins.map((c) => ({ path: c, signedUrl: `https://signee/${c}`, error: null })), error: null };
        },
      }),
    },
  };
  return { client: client as never, signes };
}

test("table instagram_stories absente : aucune journée, aucune erreur levée", async () => {
  const { client } = fauxClient({});
  const erreurs = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(await lireJourneesStories(client, "u1", MAINTENANT, null), []);
  } finally {
    console.error = erreurs;
  }
});

test("table vide : aucune journée, rien à signer", async () => {
  const { client, signes } = fauxClient({ instagram_stories: { data: [] } });
  assert.deepEqual(await lireJourneesStories(client, "u1", MAINTENANT, null), []);
  assert.equal(signes.length, 0);
});

test("colonne reach_story ou bucket absents : les journées restent, portée « – », pas de vignette", async () => {
  const lignes = [story("a", "2026-11-20T08:00:00Z", { views: 10 })];
  const { client } = fauxClient(
    { instagram_stories: { data: lignes }, instagram_compte_jours: { error: { code: "42703", message: "column reach_story does not exist" } } },
    { data: null, error: { message: "Bucket not found" } }
  );
  const erreurs = console.error;
  console.error = () => {};
  try {
    const [p] = await lireJourneesStories(client, "u1", MAINTENANT, null);
    assert.equal(p.journee!.sommes.vues, 10);
    assert.equal(p.brutes.reach, null);
    assert.equal(p.image, null);
  } finally {
    console.error = erreurs;
  }
});

test("tout en base : portée du jour lue, vignettes signées", async () => {
  const lignes = [story("a", "2026-11-20T08:00:00Z", { views: 10 })];
  const { client } = fauxClient({ instagram_stories: { data: lignes }, instagram_compte_jours: { data: [{ jour: "2026-11-20", reach_story: 33 }] } });
  const [p] = await lireJourneesStories(client, "u1", MAINTENANT, null);
  assert.equal(p.brutes.reach, 33);
  assert.equal(p.image, "https://signee/u1/a.jpg");
});

test("plus de 1 000 stories : toutes lues, page après page", async () => {
  const lignes = Array.from({ length: 1500 }, (_, i) => story(`p${i}`, new Date(Date.parse("2026-06-01T00:00:00Z") + i * 3_600_000).toISOString(), { views: 1 }));
  const { client } = fauxClient({ instagram_stories: { data: lignes }, instagram_compte_jours: { data: [] } });
  const journeesLues = await lireJourneesStories(client, "u1", MAINTENANT, null);
  assert.equal(journeesLues.reduce((a, p) => a + p.journee!.stories.length, 0), 1500);
});
