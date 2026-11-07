// Harnais du ticket 09 — corrections de la revue de code de instagram-construction.
// Lancer : sh .scratch/instagram-construction/harnais/09-la-lecture/lancer.sh
// Valeurs attendues :
//   · `?metrique=toString` : une clé héritée d'`Object.prototype` n'est pas une
//     métrique — la page tombait en 500 (`METRIQUES["toString"].nom`) ;
//   · `debutDesMois` borné au dernier jour du mois, comme `_plus_mois` côté
//     Python (`cockpit/instagram_reread.py`) : le 31 mai − 3 mois = le 28 février,
//     pas le 3 mars (`setUTCMonth` déborde) ;
//   · `post_id` : 17854360229135493 dépasse 2^53 (9007199254740992) ; lu en
//     `bigint` JSON il devient 17854360229135492 — l'ID Graph est faux.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { debutDesMois, METRIQUE_PAR_DEFAUT, metriqueDe, postDe, relevesDe, type LigneBase } from "@/lib/instagram/lecture";
import { reglesDe } from "@/lib/instagram/regles";

const WEB = process.env.WEB!;

test("une clé héritée d'Object.prototype n'est pas une métrique : la métrique par défaut", () => {
  for (const cle of ["toString", "constructor", "__proto__", "hasOwnProperty", "valueOf"]) {
    assert.equal(metriqueDe(cle), METRIQUE_PAR_DEFAUT, cle);
  }
  assert.equal(metriqueDe("portee"), "portee");
});

test("les Règles de lecture ne prennent pas une clé héritée pour un réglage", () => {
  assert.deepEqual(reglesDe({ toString: "1", constructor: "1" }), reglesDe({}));
});

test("aucun `in` sur un objet de clés dans lib/instagram (Object.hasOwn à la place)", () => {
  for (const f of ["lecture.ts", "regles.ts", "tableau.ts", "liens.ts", "annee.ts", "panneau.ts", "tendance.ts", "meilleurs.ts", "etat.ts", "donnees.ts", "donnees-tendance.ts"]) {
    const code = readFileSync(join(WEB, "lib/instagram", f), "utf8")
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*\*)/.test(l) && !/for \((const|let) \w+ in /.test(l));
    for (const l of code) assert.doesNotMatch(l, /\w in [A-Za-z_]\w*/, `${f} : ${l.trim()}`);
  }
});

test("12 mois avant le 31 mai : le 31 mai d'avant ; 3 mois avant le 31 mai : le 28 février", () => {
  assert.equal(debutDesMois("2026-05-31T08:00:00.000Z", 12), "2025-05-31T08:00:00.000Z");
  assert.equal(debutDesMois("2026-05-31T08:00:00.000Z", 3), "2026-02-28T08:00:00.000Z");
});

test("1 mois avant le 31 mars : le 28 février (29 une année bissextile) — jamais le 3 mars", () => {
  assert.equal(debutDesMois("2026-03-31T08:00:00.000Z", 1), "2026-02-28T08:00:00.000Z");
  assert.equal(debutDesMois("2028-03-31T08:00:00.000Z", 1), "2028-02-29T08:00:00.000Z");
  assert.equal(debutDesMois("2026-11-07T08:00:00.000Z", 12), "2025-11-07T08:00:00.000Z");
});

function ligne(sur: Partial<LigneBase>): LigneBase {
  return { post_id: 1, date: "2026-10-01T09:00:00+00:00", type: "IMAGE", media_product_type: "FEED", ...sur };
}

test("post_id lu en texte : 17854360229135493 reste intact", () => {
  // Ce que PostgREST rend : le `bigint` arrondi par JSON.parse, et l'alias texte.
  const p = postDe(ligne({ post_id: 17854360229135492, post_id_texte: "17854360229135493" }), {});
  assert.equal(p.id, "17854360229135493");
});

test("un relevé lu en texte garde son post_id exact", () => {
  const r = relevesDe([{ post_id: "17854360229135493", releve_a: "2026-10-03T07:00:00Z", age_heures: 50, reach: 10 }]);
  assert.deepEqual(Object.keys(r), ["17854360229135493"]);
});

test("les deux lectures web de post_id le demandent en texte (post_id::text)", () => {
  const src = readFileSync(join(WEB, "lib/instagram/donnees.ts"), "utf8");
  assert.match(src, /\.select\("\*, post_id_texte:post_id::text"\)/);
  assert.match(src, /\.select\("post_id:post_id::text, releve_a/);
});
