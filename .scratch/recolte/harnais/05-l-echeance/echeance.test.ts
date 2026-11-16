// Harnais du ticket 05 (recolte) — `lib/echeance.ts`, pur.
//   sh .scratch/recolte/harnais/05-l-echeance/lancer.sh
import assert from "node:assert/strict";
import { test } from "node:test";
import { dansCombien, echeanceDe, PREAVIS_JOURS } from "../../../../saas/web/lib/echeance.ts";

const MAINTENANT = new Date("2026-11-16T09:00:00Z");
const dans = (jours: number, heures = 0) =>
  new Date(MAINTENANT.getTime() + jours * 86_400_000 + heures * 3_600_000).toISOString();

test("une date absente ou illisible ne rend aucune échéance", () => {
  assert.equal(echeanceDe(null, MAINTENANT), null);
  assert.equal(echeanceDe(undefined, MAINTENANT), null);
  assert.equal(echeanceDe("", MAINTENANT), null);
  assert.equal(echeanceDe("pas une date", MAINTENANT), null);
});

test("loin de l'échéance : aucun préavis", () => {
  const e = echeanceDe(dans(40), MAINTENANT)!;
  assert.equal(e.joursRestants, 40);
  assert.equal(e.bientot, false);
  assert.equal(e.passee, false);
});

test("le préavis commence sous 14 jours pleins, comme côté worker", () => {
  assert.equal(PREAVIS_JOURS, 14);
  assert.equal(echeanceDe(dans(14), MAINTENANT)!.bientot, false);
  assert.equal(echeanceDe(dans(13, 23), MAINTENANT)!.bientot, true);
});

test("les jours restants sont des jours pleins, arrondis vers le bas", () => {
  const e = echeanceDe(dans(0, 3), MAINTENANT)!;
  assert.equal(e.joursRestants, 0);
  assert.equal(e.passee, false);
  assert.equal(dansCombien(e), "aujourd'hui");
  assert.equal(dansCombien(echeanceDe(dans(1, 2), MAINTENANT)!), "demain");
  assert.equal(dansCombien(echeanceDe(dans(9, 5), MAINTENANT)!), "dans 9 jours");
});

test("une échéance passée se dit passée, et reste dans le préavis", () => {
  const e = echeanceDe(dans(-2), MAINTENANT)!;
  assert.equal(e.passee, true);
  assert.equal(e.bientot, true);
});
