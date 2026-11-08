// Harnais du ticket 14 — la Tendance « Ta page ».
// Lancer : sh .scratch/instagram-construction/harnais/14-la-tendance/lancer.sh
// (Node ≥ 23.6, type stripping natif ; `resoudre.mjs` ajoute `.ts` et `@/`).
// Valeurs attendues : écrites à la main d'après la spec (§ La page — Tendance ;
// § Ce qu'on ne mesure pas), jamais recalculées comme le code les calcule.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lienDuPost, tendanceDe, type EntreeTendance, type LigneJourCompte } from "@/lib/instagram/tendance";
import { postDe } from "@/lib/instagram/lecture";

/** Période du 2026-11-02 au 2026-11-04 (3 jours), avant : 10-30 → 11-01.
 *  Lu le 2026-11-05 à 07:30 UTC : le 3 et le 4 peuvent encore changer. */
function entree(sur: Partial<EntreeTendance> = {}): EntreeTendance {
  return {
    jours: [],
    historique: [],
    periodes: [],
    posts: [],
    periode: { debut: "2026-11-02", fin: "2026-11-04", avantDebut: "2026-10-30", avantFin: "2026-11-01", jours: 3 },
    maintenant: "2026-11-05T07:30:00Z",
    ...sur,
  };
}

const j = (jour: string, x: Partial<LigneJourCompte> = {}): LigneJourCompte => ({ jour, ...x });

test("les dates : la période et celle d'avant, jour par jour", () => {
  const t = tendanceDe(entree());
  assert.deepEqual(t.dates, ["2026-11-02", "2026-11-03", "2026-11-04"]);
  assert.deepEqual(t.datesAvant, ["2026-10-30", "2026-10-31", "2026-11-01"]);
});

test("un jour sans ligne est un trou, un vrai 0 reste 0, la période d'avant est alignée", () => {
  const t = tendanceDe(
    entree({
      jours: [
        j("2026-10-30", { reach: 50 }),
        j("2026-11-01", { reach: "70" }),
        j("2026-11-02", { reach: 100, total_interactions: 0 }),
        j("2026-11-04", { reach: 300, total_interactions: null }),
      ],
    })
  );
  assert.deepEqual(t.portee.tout.serie, [100, null, 300]);
  assert.deepEqual(t.portee.tout.serieAvant, [50, null, 70]);
  assert.deepEqual(t.interactions.tout.serie, [0, null, null]);
});

test("le jour en cours ne compte jamais, même si une ligne existe", () => {
  const t = tendanceDe(
    entree({
      periode: { debut: "2026-11-04", fin: "2026-11-05", avantDebut: "2026-11-02", avantFin: "2026-11-03", jours: 2 },
      jours: [j("2026-11-04", { reach: 10 }), j("2026-11-05", { reach: 3 })],
    })
  );
  assert.deepEqual(t.portee.tout.serie, [10, null]);
});

test("les 48 dernières heures portent l'icône : hier et avant-hier, pas le jour d'avant", () => {
  const t = tendanceDe(entree());
  assert.deepEqual(t.recents, [1, 2]);
});

// ── Les abonnés : trois sources, un trou entre la première et la deuxième ──

test("abonnés : followers_history jusqu'au 2026-09-04, un trou, puis la remontée et le relevé", () => {
  const t = tendanceDe(
    entree({
      periode: { debut: "2026-09-03", fin: "2026-09-08", avantDebut: "2026-08-28", avantFin: "2026-09-02", jours: 6 },
      historique: [
        { fetched_at: "2026-09-03T06:00:00Z", followers: 1700 },
        { fetched_at: "2026-09-04T05:00:00Z", followers: 1702 },
        { fetched_at: "2026-09-04T09:00:00Z", followers: 1705 }, // le dernier relevé du jour
        { fetched_at: "2026-08-30T06:00:00Z", followers: 1690 },
      ],
      // La remontée du premier passage commence le 7, le relevé suit le 8.
      jours: [j("2026-09-07", { abonnes: 1820, gagnes: 4, perdus: 1 }), j("2026-09-08", { abonnes: 1823, gagnes: 0, perdus: null })],
    })
  );
  assert.deepEqual(t.abonnes.serie, [1700, 1705, null, null, 1820, 1823]);
  assert.deepEqual(t.abonnes.serieAvant, [null, null, 1690, null, null, null]);
  assert.deepEqual(t.abonnes.gagnes, [null, null, null, null, 4, 0]);
  assert.deepEqual(t.abonnes.perdus, [null, null, null, null, 1, null]);
  assert.deepEqual(t.abonnes.dernier, { jour: "2026-09-08", valeur: 1823 });
  assert.deepEqual(t.abonnes.sommeGagnes, { total: 4, lus: 2, sur: 6 });
  assert.deepEqual(t.abonnes.sommePerdus, { total: 1, lus: 1, sur: 6 });
});

test("abonnés : là où le compte et followers_history se recouvrent, le compte l'emporte", () => {
  const t = tendanceDe(
    entree({
      historique: [{ fetched_at: "2026-11-02T06:00:00Z", followers: 999 }],
      jours: [j("2026-11-02", { abonnes: 1000 })],
    })
  );
  assert.equal(t.abonnes.serie[0], 1000);
});

test("abonnés : aucun mouvement lu → aucune somme, pas un 0", () => {
  const t = tendanceDe(entree({ jours: [j("2026-11-02", { abonnes: 10 })] }));
  assert.deepEqual(t.abonnes.sommeGagnes, { total: null, lus: 0, sur: 3 });
  assert.equal(t.abonnes.dernier?.valeur, 10);
});

// ── La portée de la période : celle d'Instagram, jamais la somme des jours ──

const sept = { debut: "2026-10-26", fin: "2026-11-01", avantDebut: "2026-10-19", avantFin: "2026-10-25", jours: 7 };
const raison = (p: { etat: string }) => (p as { raison: string }).raison;

test("portée de la période : la ligne d'instagram_compte_periodes, jamais la somme des jours", () => {
  const t = tendanceDe(
    entree({
      periode: sept,
      jours: [j("2026-10-26", { reach: 40000 }), j("2026-10-27", { reach: 40000 })],
      periodes: [
        { debut: "2026-10-26", fin: "2026-11-01", reach: "65980" },
        { debut: "2026-10-19", fin: "2026-10-25", reach: 52000 },
      ],
    })
  );
  assert.deepEqual(t.portee.periode, { etat: "lue", reach: 65980 });
  assert.deepEqual(t.portee.periodeAvant, { etat: "lue", reach: 52000 });
  // (65 980 − 52 000) ÷ 52 000 = 26,8846… %
  assert.ok(t.portee.ecart !== null && Math.abs(t.portee.ecart - 26.8846) < 0.001);
});

test("portée de la période : une période qui n'est pas de 7 jours → une phrase, pas la somme", () => {
  const t = tendanceDe(entree({ jours: [j("2026-11-02", { reach: 100 }), j("2026-11-03", { reach: 100 })] }));
  assert.equal(t.portee.periode.etat, "absente");
  assert.match(raison(t.portee.periode), /7 jours/);
  assert.match(raison(t.portee.periode), /deux fois/);
  assert.equal(t.portee.ecart, null);
});

test("portée de la période : 7 jours sans relevé → la raison, et pas d'écart avec la période d'avant lue", () => {
  const t = tendanceDe(entree({ periode: sept, periodes: [{ debut: "2026-10-19", fin: "2026-10-25", reach: 52000 }] }));
  assert.match(raison(t.portee.periode), /n'a pas relevé/);
  assert.equal(t.portee.periodeAvant.etat, "lue");
  assert.equal(t.portee.ecart, null);
});

test("portée de la période : avant le premier relevé, la phrase donne sa date", () => {
  const t = tendanceDe(entree({ periode: sept, periodes: [{ debut: "2026-11-02", fin: "2026-11-08", reach: 1 }] }));
  assert.match(raison(t.portee.periodeAvant), /depuis celle finie le 8 nov\. 2026/);
});

test("portée de la période : aucune semaine relevée → la phrase le dit", () => {
  const t = tendanceDe(entree({ periode: sept }));
  assert.match(raison(t.portee.periode), /aucune semaine/);
});

test("tables illisibles : des trous et une phrase, jamais « aucune semaine relevée »", () => {
  const t = tendanceDe(entree({ periode: sept, jours: null, periodes: null }));
  assert.match(t.illisible ?? "", /pas pu être lus/);
  assert.ok(t.portee.tout.serie.every((v) => v === null));
  assert.match(raison(t.portee.periode), /pas pu être lue/);
  assert.equal(tendanceDe(entree()).illisible, null);
});

// ── L'interrupteur Tout / Organique / Boosté ─────────────────────────────

test("interactions : Organique = total − AD, Boosté = AD ; AD absent → trou, pas le total", () => {
  const t = tendanceDe(
    entree({
      jours: [
        j("2026-11-02", { total_interactions: 120, interactions_ad: 20 }),
        j("2026-11-03", { total_interactions: 80, interactions_ad: null }),
        j("2026-11-04", { total_interactions: 50, interactions_ad: 0 }),
      ],
    })
  );
  assert.deepEqual(t.interactions.tout.serie, [120, 80, 50]);
  assert.deepEqual(t.interactions.organique.serie, [100, null, 50]);
  assert.deepEqual(t.interactions.booste.serie, [20, null, 0]);
  assert.deepEqual(t.interactions.tout.somme, { total: 250, lus: 3, sur: 3 });
  assert.deepEqual(t.interactions.organique.somme, { total: 150, lus: 2, sur: 3 });
});

test("interactions : un compte qui ne booste pas — Organique et Boosté vides, et ils disent pourquoi", () => {
  const t = tendanceDe(entree({ jours: [j("2026-11-02", { total_interactions: 120 })] }));
  assert.match(t.interactions.organique.raisonVide ?? "", /part organique ne se calcule pas/);
  assert.match(t.interactions.booste.raisonVide ?? "", /pas son absence pour un zéro/);
  assert.equal(t.interactions.tout.raisonVide, null);
});

test("interactions : l'écart ne se calcule que sur deux périodes lues en entier", () => {
  const plein = tendanceDe(
    entree({
      jours: ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"].map((d, k) =>
        j(d, { total_interactions: k < 3 ? 100 : 150 })
      ),
    })
  );
  assert.equal(plein.interactions.tout.ecart, 50);
  const troue = tendanceDe(entree({ jours: [j("2026-10-30", { total_interactions: 100 }), j("2026-11-02", { total_interactions: 150 })] }));
  assert.equal(troue.interactions.tout.ecart, null);
});

test("portée : Boosté = AD, Organique n'a qu'une raison, la période boostée aussi", () => {
  const t = tendanceDe(entree({ jours: [j("2026-11-02", { reach: 900, reach_ad: 300 })] }));
  assert.deepEqual(t.portee.booste.serie, [300, null, null]);
  assert.match(t.portee.organique.raison, /ne se mesure pas/);
  assert.equal("serie" in t.portee.organique, false);
  assert.match(t.portee.raisonPeriodeBoostee, /deux fois/);
});

test("l'interrupteur ne touche pas aux abonnés : une seule série, sans ventilation", () => {
  const t = tendanceDe(entree({ jours: [j("2026-11-02", { abonnes: 10, reach_ad: 3, interactions_ad: 2 })] }));
  assert.deepEqual(Object.keys(t.abonnes).sort(), ["dernier", "gagnes", "perdus", "serie", "serieAvant", "sommeGagnes", "sommePerdus"]);
});

// ── Les jours de publication ─────────────────────────────────────────────

const post = (id: number, date: string, type = "IMAGE", produit: string | null = "FEED") =>
  postDe({ post_id: id, date, type, media_product_type: produit, caption: "x".repeat(100) }, {});

test("jours de publication : les dates des posts de la période, groupés par jour, pour ouvrir ?post=", () => {
  const t = tendanceDe(
    entree({
      posts: [
        post(3, "2026-11-04T20:00:00+00:00", "VIDEO", "REELS"),
        post(1, "2026-11-02T09:00:00+00:00"),
        post(2, "2026-11-02T18:00:00+00:00", "VIDEO", null),
        post(9, "2026-11-01T09:00:00+00:00"), // période d'avant : pas de repère
      ],
    })
  );
  assert.deepEqual(
    t.publications.map((p) => [p.index, p.jour, p.posts.map((x) => [x.id, x.format])]),
    [
      [0, "2026-11-02", [["1", "Image"], ["2", "Format inconnu"]]],
      [2, "2026-11-04", [["3", "Reel"]]],
    ]
  );
  assert.equal(t.publications[0].posts[0].legende.length, 80);
});

// ── La date du dernier relevé (user story 1) ─────────────────────────────

test("relevé : le maj_a le plus récent des lignes lues, écrit en UTC", () => {
  const t = tendanceDe(
    entree({
      jours: [
        j("2026-11-02", { reach: 1, maj_a: "2026-11-03T07:04:12.5+00:00" }),
        j("2026-11-03", { reach: 1, maj_a: "2026-11-05T07:02:00+00:00" }),
        j("2026-11-04", { reach: 1, maj_a: "2026-11-04T07:09:00+00:00" }),
      ],
    })
  );
  assert.equal(t.releve, "relevé du jeu. 5 nov. à 07:02 UTC");
});

test("relevé : sans maj_a, le jour le plus récent présent — jamais le jour en cours", () => {
  const t = tendanceDe(entree({ jours: [j("2026-11-02", { reach: 1 }), j("2026-11-03", { reach: 1 }), j("2026-11-05", { reach: 9 })] }));
  assert.equal(t.releve, "chiffres jusqu'au mar. 3 nov.");
});

test("relevé : aucune donnée → aucune date", () => {
  assert.equal(tendanceDe(entree()).releve, null);
  assert.equal(tendanceDe(entree({ jours: null })).releve, null);
});

test("le lien d'un jour de publication garde toute l'URL et ne change que ?post=", () => {
  assert.equal(
    lienDuPost({ from: "2026-10-01", to: "2026-10-07", sansBoostes: "1", comparer: ["a", "b"], post: "7" }, "42"),
    "/instagram?from=2026-10-01&to=2026-10-07&sansBoostes=1&comparer=a&comparer=b&post=42"
  );
  assert.equal(lienDuPost({}, "42"), "/instagram?post=42");
});
