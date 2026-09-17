import assert from "node:assert/strict";
import test from "node:test";

import { resoudrePeriode } from "../../../../saas/web/lib/periode-couts.ts";

const reperes = {
  ancre: "2026-09-13",
  premier: "2026-01-01",
  yearStart: "2026-01-01",
  monthStart: "2026-09-01",
};

test("une plage entièrement future ne peut pas s'inverser", () => {
  const periode = resoudrePeriode(
    { from: "2026-09-20", to: "2026-09-25" },
    reperes
  );

  assert.equal(periode.from, "2026-09-13");
  assert.equal(periode.to, "2026-09-13");
  assert.equal(periode.jours, 1);
  assert.equal(periode.bornes, "du 13 sep au 13 sep · 1 jour");
});

test("l'ancien mois reste une fenêtre valide quand aucun jour du mois n'est plein", () => {
  const periode = resoudrePeriode(
    { p: "mois" },
    { ...reperes, ancre: "2026-08-31", monthStart: "2026-09-01" }
  );

  assert.equal(periode.from, "2026-08-31");
  assert.equal(periode.to, "2026-08-31");
  assert.equal(periode.bornes, "du 31 aoû au 31 aoû · 1 jour");
});

test("une présélection moderne prime sur un ancien paramètre p", () => {
  const periode = resoudrePeriode({ jours: 7, p: "mois" }, reperes);

  assert.equal(periode.from, "2026-09-07");
  assert.equal(periode.to, "2026-09-13");
  assert.equal(periode.presetJours, 7);
});

test("la date maximale du bandeau est toujours l'ancre", () => {
  assert.equal(resoudrePeriode({ jours: 30 }, reperes).max, "2026-09-13");
});
