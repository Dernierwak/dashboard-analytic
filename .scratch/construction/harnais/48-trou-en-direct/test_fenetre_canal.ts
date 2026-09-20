// La fenêtre d'une page canal face à un trou de récolte (ticket 48) —
// `saas/web/lib/fenetre-canal.ts`.
//
// CE QUE CES TESTS PROTÈGENT. Une plage tapée à la main prenait les dates du
// client telles quelles : les jours d'après une panne entraient dans la fenêtre
// comme des jours à ZÉRO, la courbe tombait, et ça se lit comme un arrêt de
// campagne. La fenêtre s'arrête désormais au dernier jour lu — et le libellé le
// dit, parce qu'une fenêtre qu'on raccourcit sans le dire est pire qu'une
// fenêtre fausse.
//
// LE TEST QUI COMPTE LE PLUS EST CELUI DE L'ÉTAT ③ : un canal qui a bien
// répondu et n'a simplement plus de campagne active a des zéros MESURÉS, et ils
// doivent continuer à s'afficher (ADR 0005). Clamper sur « plus de lignes
// récentes » au lieu de « la récolte a échoué » effacerait ces zéros-là.
//
//   node --test --experimental-strip-types test_fenetre_canal.ts

import assert from "node:assert/strict";
import test from "node:test";

import {
  fenetreSurMesure,
  iso,
  makeWindow,
} from "../../../../saas/web/lib/fenetre-canal.ts";

/** Hier, en ISO — les fenêtres se rognent dessus, donc les cas limites se
 *  construisent relativement à lui plutôt que sur une date figée qui périmerait
 *  le harnais. */
function hier(decalage = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1 + decalage);
  return d.toISOString().slice(0, 10);
}

test("sans canal muet, une plage jusqu'à hier garde toutes ses journées", () => {
  const w = fenetreSurMesure(hier(-6), hier(), null);

  assert.ok(w);
  assert.equal(iso(w.until), hier());
  assert.ok(!w.label.includes("dernier jour lu"));
});

test("un canal muet arrête la plage à son dernier jour lu", () => {
  const w = fenetreSurMesure(hier(-9), hier(), hier(-3));

  assert.ok(w);
  assert.equal(iso(w.until), hier(-3));
});

test("le raccourcissement est ÉCRIT dans le libellé, jamais silencieux", () => {
  const w = fenetreSurMesure(hier(-9), hier(), hier(-3));

  assert.ok(w);
  assert.match(w.label, /arrêtée au dernier jour lu/);
});

test("la durée annoncée est celle de la fenêtre rognée, pas celle demandée", () => {
  const w = fenetreSurMesure(hier(-9), hier(), hier(-3));

  assert.ok(w);
  assert.match(w.label, /· 7 jours/);
});

test("un canal muet dont le trou est APRÈS la plage ne la touche pas", () => {
  const w = fenetreSurMesure(hier(-20), hier(-15), hier(-3));

  assert.ok(w);
  assert.equal(iso(w.until), hier(-15));
  assert.ok(!w.label.includes("dernier jour lu"));
});

test("une plage entièrement postérieure au trou ne rend aucune fenêtre", () => {
  assert.equal(fenetreSurMesure(hier(-2), hier(), hier(-3)), null);
});

test("le rognage du jour en cours et celui du trou se cumulent", () => {
  const w = fenetreSurMesure(hier(-9), hier(5), hier(-3));

  assert.ok(w);
  assert.equal(iso(w.until), hier(-3));
  assert.match(w.label, /jour en cours exclu/);
  assert.match(w.label, /arrêtée au dernier jour lu/);
});

test("aucun canal muet : un zéro mesuré reste dans la fenêtre", () => {
  // État ③ de l'ADR 0005 — plus aucune campagne active depuis trois jours, mais
  // la récolte a bien tourné. Personne ne passe de borne, et la fenêtre garde
  // ces trois jours : ce sont des zéros CONSTATÉS.
  const w = fenetreSurMesure(hier(-9), hier(), null);

  assert.ok(w);
  assert.equal(iso(w.until), hier());
});

test("une présélection s'ancre déjà sur la dernière ligne écrite", () => {
  // C'est pourquoi les présélections n'ont pas besoin de la borne : elles ne
  // peuvent pas déborder sur le trou. Le test fige cette propriété — c'est elle
  // qui justifie de ne clamper QUE la plage sur mesure.
  const w = makeWindow(hier(-3), hier(-90), 7);

  assert.equal(iso(w.until), hier(-3));
  assert.equal(iso(w.since), hier(-9));
});
