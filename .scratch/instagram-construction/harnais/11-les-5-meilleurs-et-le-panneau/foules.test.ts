// Harnais du ticket 11 — revue de code : les foules calculées UNE fois par
// lecture et passées au module, à la liste des 5 et au Tableau.
// Lancer : sh .scratch/instagram-construction/harnais/11-les-5-meilleurs-et-le-panneau/lancer.sh
// Seam : le paramètre optionnel `foules` de `moduleAnneeDe`, `meilleursDe`,
// `tableauDe`. Valeurs attendues : sans le paramètre, le calcul d'avant (le
// résultat ne bouge pas) ; avec, ce sont bien ces foules-là qui placent.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { foulesDe } from "@/lib/instagram/lecture";
import { moduleAnneeDe } from "@/lib/instagram/annee";
import { meilleursDe } from "@/lib/instagram/meilleurs";
import { tableauDe } from "@/lib/instagram/tableau";
import { AUCUN_ECART } from "@/lib/instagram/regles";
import { ctx, post, SEMAINE, sixImages } from "./fixtures.ts";

const posts = [...sixImages(), post("2026-10-28T09:00:00Z", { likes: 9 }), post("2026-10-27T09:00:00Z", { likes: 2 })];
const foules = foulesDe(posts, "jaime", ctx);
// Des foules d'une base vide : tout post y est « foule mince ».
const vides = foulesDe([], "jaime", ctx);

test("foules passées = foules calculées : le module, la liste et le Tableau ne bougent pas", () => {
  assert.deepEqual(moduleAnneeDe(posts, "jaime", SEMAINE, ctx, AUCUN_ECART, foules), moduleAnneeDe(posts, "jaime", SEMAINE, ctx));
  assert.deepEqual(meilleursDe(posts, "jaime", SEMAINE, ctx, foules), meilleursDe(posts, "jaime", SEMAINE, ctx));
  assert.deepEqual(tableauDe(posts, "jaime", ctx, AUCUN_ECART, foules), tableauDe(posts, "jaime", ctx));
});

test("ce sont les foules passées qui placent (elles ne sont pas recalculées)", () => {
  assert.equal(meilleursDe(posts, "jaime", SEMAINE, ctx, vides)[0].place.etat, "foule_mince");
  const ligne = tableauDe(posts, "jaime", ctx, AUCUN_ECART, vides).lignes.find((l) => l.valeurs.jaime === 9);
  assert.equal(ligne?.place.etat, "foule_mince");
  const rangee = moduleAnneeDe(posts, "jaime", SEMAINE, ctx, AUCUN_ECART, vides).rangees[0];
  assert.notDeepEqual(rangee, moduleAnneeDe(posts, "jaime", SEMAINE, ctx).rangees[0]);
});

test("la page calcule les foules une fois et les passe aux trois", () => {
  const page = readFileSync(join(process.env.WEB!, "app/instagram/page.tsx"), "utf8");
  assert.equal((page.match(/foulesDe\(/g) ?? []).length, 1);
  assert.match(page, /moduleAnneeDe\([^)]*foules\)/);
  assert.match(page, /meilleursDe\([^)]*foules\)/);
  assert.match(page, /tableauDe\([^)]*foules\)/);
});
