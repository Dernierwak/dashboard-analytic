// Harnais du ticket 18 — ce que le panneau fait d'un VRAI changement de budget.
//
// Le budget n'a pas de lecteur dans `saas/web/lib/meta/rubriques.ts` : la
// lecture rend `phrase`, et le panneau écrit le `resume` de la récolte (« … est
// passé de 350,00 à 750,00 CHF », vérifié par `verifier.py`). La forme est
// celle que Meta a envoyée le 2026-02-12 (ticket 18). Lancer depuis la racine :
//
//     node --import ./.scratch/journal-meta/harnais/13/resoudre.mjs \
//          --test .scratch/journal-meta/harnais/18/*.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { lireExtra } from "../../../../saas/web/lib/meta/rubriques.ts";

const reel = (libelle: string) => ({
  old_value: { type: "payment_amount", currency: "CHF", old_value: 35000, additional_type: "status_string", additional_value: "" },
  new_value: { type: "payment_amount", currency: "CHF", new_value: 75000, additional_type: "status_string", additional_value: libelle },
  type: "composite_data",
});

test("budget réel : le panneau écrit la phrase de la récolte, sans relire les montants", () => {
  assert.deepEqual(lireExtra("budget", reel("Laufzeitbudget")), { forme: "phrase" });
  assert.deepEqual(lireExtra("budget", reel("Budget global")), { forme: "phrase" });
});
