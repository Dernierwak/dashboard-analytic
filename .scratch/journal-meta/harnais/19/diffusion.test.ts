// Harnais du ticket 19 — le début de la distribution, lu à l'affichage.
//
// Forme réelle du 2026-08-27 (IDs remplacés : le dépôt est public). Lancer
// depuis la racine :
//
//     node --import ./.scratch/journal-meta/harnais/13/resoudre.mjs \
//          --test .scratch/journal-meta/harnais/19/*.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { lireExtra } from "../../../../saas/web/lib/meta/rubriques.ts";
import { changementDe } from "../../../../saas/web/lib/meta/changements.ts";

const reel = (libelle: string) => ({
  campaign_id: 200,
  old_value: null,
  new_value: libelle,
  type: "delivery_event",
});

test("la valeur de Meta, recopiée telle quelle, sans avant", () => {
  for (const libelle of ["Début de la distribution", "Auslieferung gestartet"]) {
    assert.deepEqual(lireExtra("diffusion", reel(libelle)), {
      forme: "rubriques",
      rubriques: [{ nom: "Diffusion", avant: null, apres: libelle, change: true }],
    });
  }
});

test("une autre forme : la phrase de la récolte, rien de deviné", () => {
  assert.deepEqual(lireExtra("diffusion", { new_value: "x", type: "autre" }), { forme: "phrase" });
  assert.deepEqual(lireExtra("diffusion", { old_value: null, type: "delivery_event" }), { forme: "phrase" });
});

test("la carte dit « Diffusion », pas « Réglage »", () => {
  const c = changementDe({
    change_id: "a",
    occurred_at: "2026-08-27T09:00:50+00:00",
    categorie: "diffusion",
    campaign_id: "100",
    campaign_name: "Campagne A",
    resume: "l'annonce \"Annonce C\" a commencé à diffuser",
    fuseau: "Europe/Zurich",
    niveau: "annonce",
    object_id: "300",
    object_name: "Annonce C",
    adset_id: "200",
    extra_data: reel("Début de la distribution"),
  });
  assert.equal(c?.nature, "Diffusion");
});
