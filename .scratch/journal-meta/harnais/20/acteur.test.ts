// Harnais du ticket 20 — qui a fait le changement, lu à l'affichage.
//
// Le 18 septembre (IDs remplacés : le dépôt est public) : une personne relance
// l'examen d'une annonce à 16:05, Meta la remet en « Actif » à 16:09. Ads
// Manager l'écrit dans sa colonne « Modifié par » ; le panneau l'écrit à
// chaque étape de la chaîne de statut, et sur la carte d'une modification.
//
//     node --import ./.scratch/journal-meta/harnais/13/resoudre.mjs \
//          --test .scratch/journal-meta/harnais/20/*.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  changementDe,
  panneauDe,
  type Carte,
  type ChangementMeta,
  type LigneChangement,
} from "../../../../saas/web/lib/meta/changements.ts";

let n = 0;
function ch(p: Partial<LigneChangement>): ChangementMeta {
  n += 1;
  return changementDe({
    change_id: `x${n}`,
    occurred_at: "2026-09-18T14:05:11+00:00",
    categorie: "statut",
    campaign_id: "100",
    campaign_name: "Campagne A",
    resume: "le statut de l'annonce \"Annonce C\" a changé",
    fuseau: "Europe/Zurich",
    niveau: "annonce",
    object_id: "300",
    object_name: "Annonce C",
    adset_id: "200",
    extra_data: null,
    acteur: null,
    ...p,
  })!;
}

const statut = (heure: string, avant: string, apres: string, acteur: string | null) =>
  ch({
    occurred_at: `2026-09-18T${heure}+00:00`,
    extra_data: { old_value: avant, new_value: apres, type: "run_status" },
    acteur,
  });

function cartesDuJour(changements: ChangementMeta[]): Carte[] {
  const p = panneauDe(changements, { debut: "2026-09-18", fin: "2026-09-18" }, { campagne: null, groupe: null }, {
    campagnes: [],
    noms: {},
  });
  return p.jours[0].campagnes[0].groupes[0].annonces[0].cartes;
}

test("l'acteur se lit sur la ligne ; une valeur inconnue ne devient pas une personne", () => {
  assert.equal(ch({ acteur: "meta" }).acteur, "meta");
  assert.equal(ch({ acteur: "personne" }).acteur, "personne");
  assert.equal(ch({ acteur: null }).acteur, null);
  assert.equal(ch({ acteur: "Prénom Nom" }).acteur, null);
});

test("la chaîne du 18 septembre : une personne à 16:05, Meta à 16:09", () => {
  const [carte] = cartesDuJour([
    statut("14:05:11", "Pending Process", "Pending Review", "personne"),
    statut("14:09:19", "Pending Review", "Active", "meta"),
  ]);
  assert.equal(carte.sorte, "statut");
  if (carte.sorte !== "statut") return;
  assert.deepEqual(carte.etapes, [
    { libelle: "Pending Process", heure: null, acteur: null },
    { libelle: "Pending Review", heure: "16:05", acteur: "personne" },
    { libelle: "Active", heure: "16:09", acteur: "meta" },
  ]);
});

test("une modification porte son acteur sur la carte", () => {
  const [carte] = cartesDuJour([ch({ categorie: "audience", resume: "le ciblage a été modifié", acteur: "personne" })]);
  assert.equal(carte.sorte, "lecture");
  assert.equal(carte.acteur, "personne");
});

test("une ligne d'avant le ticket 20 ne dit rien de l'acteur", () => {
  const [carte] = cartesDuJour([ch({ categorie: "audience", resume: "le ciblage a été modifié" })]);
  assert.equal(carte.acteur, null);
});
