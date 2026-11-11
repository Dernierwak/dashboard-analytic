// Harnais du ticket 02 de la construction Google Ads — le Type de campagne côté page.
// Lancer : sh .scratch/google-ads/harnais/02-le-type-de-campagne-en-v26/lancer.sh
// (le pendant récolte : `python3.12 -I .scratch/google-ads/harnais/02-le-type-de-campagne-en-v26/test_recolte.py`).
//
// Attendus tirés de la spec, § « Le Type de campagne » : six libellés (Search,
// PMax, Display, Vidéo, Demand Gen, Autres types) ; « Autres types » réunit le
// reste, avec le vrai type de Google gardé ; une campagne sans type lu n'est
// rangée dans aucun type. Valeurs de l'enum `AdvertisingChannelType` de l'API.
import { test } from "node:test";
import assert from "node:assert/strict";
import { contenuPage, libelleType, TYPES_CAMPAGNE, type LigneGoogle } from "@/lib/google/lecture";

const CTX = { aujourdhui: "2026-10-05", dernierJourDeTravail: "2026-10-05" };

function ligne(sur: Partial<LigneGoogle> = {}): LigneGoogle {
  return {
    date: "2026-09-28",
    campagneId: "111",
    campagneNom: "Search marque",
    typeCampagne: "SEARCH",
    cout: 10,
    impressions: 1000,
    clics: 50,
    conversions: 5,
    ...sur,
  };
}

test("les six libellés, dans l'ordre de l'écran", () => {
  assert.deepEqual(TYPES_CAMPAGNE, ["Search", "PMax", "Display", "Vidéo", "Demand Gen", "Autres types"]);
});

test("les cinq types nommés se traduisent", () => {
  assert.equal(libelleType("SEARCH"), "Search");
  assert.equal(libelleType("PERFORMANCE_MAX"), "PMax");
  assert.equal(libelleType("DISPLAY"), "Display");
  assert.equal(libelleType("VIDEO"), "Vidéo");
  assert.equal(libelleType("DEMAND_GEN"), "Demand Gen");
});

test("tout le reste tombe dans « Autres types »", () => {
  for (const brut of ["SHOPPING", "MULTI_CHANNEL", "LOCAL", "SMART", "HOTEL", "LOCAL_SERVICES", "TRAVEL", "UNKNOWN"]) {
    assert.equal(libelleType(brut), "Autres types", brut);
  }
});

test("un type non lu n'est rangé nulle part", () => {
  assert.equal(libelleType(null), null);
  assert.equal(libelleType(""), null);
  assert.equal(libelleType("UNSPECIFIED"), null);
});

test("le menu porte le type de chaque campagne, et le vrai type de Google sous « Autres types »", () => {
  const c = contenuPage(
    [
      ligne(),
      ligne({ campagneId: "222", campagneNom: "PMax boutique", typeCampagne: "PERFORMANCE_MAX" }),
      ligne({ campagneId: "333", campagneNom: "Shopping", typeCampagne: "SHOPPING" }),
    ],
    {},
    CTX,
  );
  const par = Object.fromEntries(c.campagnes.map((x) => [x.cle, x.type]));
  assert.deepEqual(par["111"], { libelle: "Search", brut: "SEARCH" });
  assert.deepEqual(par["222"], { libelle: "PMax", brut: "PERFORMANCE_MAX" });
  assert.deepEqual(par["333"], { libelle: "Autres types", brut: "SHOPPING" });
});

test("une campagne dont aucune ligne n'a de type lu reste sans type", () => {
  const c = contenuPage([ligne({ typeCampagne: null }), ligne({ date: "2026-09-29", typeCampagne: null })], {}, CTX);
  assert.equal(c.campagnes[0].type, null);
});

test("les lignes d'avant la récolte du type (NULL) ne l'effacent pas", () => {
  // Après le lancement `force`, seuls les 30 derniers jours portent le type ;
  // une ligne récente sans type ne vaut pas non plus « aucun type ».
  const c = contenuPage(
    [
      ligne({ date: "2026-09-21", typeCampagne: null }),
      ligne({ date: "2026-09-28", typeCampagne: "PERFORMANCE_MAX" }),
      ligne({ date: "2026-09-29", typeCampagne: null }),
    ],
    {},
    CTX,
  );
  assert.deepEqual(c.campagnes[0].type, { libelle: "PMax", brut: "PERFORMANCE_MAX" });
});

test("le type ne retire rien des totaux", () => {
  const c = contenuPage(
    [ligne({ impressions: 1000 }), ligne({ campagneId: "444", typeCampagne: null, impressions: 500 })],
    { vue: "notoriete" },
    CTX,
  );
  const impressions = c.cartes.find((x) => x.vue === "notoriete")!;
  assert.equal(impressions.valeur, 1500);
});
