// Harnais du ticket 12 — lire une annonce dans le Panneau latéral.
//
// Seam : « lignes de `meta_ads_creatives` et `meta_ads_creative_assets` → ce
// que le panneau montre », par `saas/web/lib/meta/annonce.ts`. Les lignes
// sont celles que la récolte du ticket 05 DOIT écrire (forme du `000`, § 0bis) ;
// aucune n'a encore été lue sur un vrai compte. La cible « Lire », le panneau
// et « retour » se voient dans Chrome. Lancer depuis la racine du dépôt :
//
//     node --import ./.scratch/meta-ads/harnais/09-le-tableau/resoudre.mjs \
//          --test .scratch/meta-ads/harnais/12-lire-une-annonce/annonce.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  BOUTON_SANS_NOM,
  adresseSure,
  annonceDe,
  annonceOuverteDe,
  depuisStorage,
  nomBouton,
  type LigneAsset,
  type LigneCrea,
} from "../../../../saas/web/lib/meta/annonce.ts";
import type { LigneMeta } from "../../../../saas/web/lib/meta/lecture.ts";
import { lienMeta } from "../../../../saas/web/lib/meta/liens.ts";

const ORIGINE = "https://abc.supabase.co";
const STO = `${ORIGINE}/storage/v1/object/public/ad-images`;
const META = "https://scontent.xx.fbcdn.net/v/t45/123.jpg?oh=expire";

function crea(p: Partial<LigneCrea> = {}): LigneCrea {
  return {
    montage: "object_story",
    titre: null,
    texte: null,
    description: null,
    lien_url: null,
    call_to_action: null,
    image_url: null,
    video_id: null,
    vignette_url: null,
    ...p,
  };
}

function asset(p: Partial<LigneAsset> & Pick<LigneAsset, "provenance" | "asset_kind" | "rang">): LigneAsset {
  return { texte: null, image_url: null, video_id: null, vignette_url: null, lien_url: null, ...p };
}

// ── Les trois montages ───────────────────────────────────────────────────────

test("object_story : texte, titre, description, bouton et visuel tiennent sur la créa", () => {
  const a = annonceDe(
    crea({ texte: "Nos manteaux", titre: "Soldes -30 %", description: "Livraison offerte", call_to_action: "SHOP_NOW", image_url: `${STO}/h1.jpg`, lien_url: "https://maison.ch/soldes" }),
    [],
    ORIGINE
  );
  assert.deepEqual(a.apercu, {
    texte: "Nos manteaux",
    titre: "Soldes -30 %",
    description: "Livraison offerte",
    bouton: "Acheter",
    visuel: { url: `${STO}/h1.jpg`, video: false },
  });
  assert.deepEqual(a.liens, ["https://maison.ch/soldes"]);
  assert.equal(a.aDesVariantes, false);
});

test("flat : même lecture, le montage ne change rien à la ligne", () => {
  const a = annonceDe(crea({ montage: "flat", texte: "Bonjour", titre: "Titre" }), [], ORIGINE);
  assert.deepEqual([a.textes, a.titres], [["Bonjour"], ["Titre"]]);
});

test("asset_feed : chaque variante, numérotée dans l'ordre du rang, en entier", () => {
  const a = annonceDe(
    crea({ montage: "asset_feed" }),
    [
      asset({ provenance: "asset_feed", asset_kind: "body", rang: 1, texte: "Deuxième texte, long et entier." }),
      asset({ provenance: "asset_feed", asset_kind: "body", rang: 0, texte: "Premier texte" }),
      asset({ provenance: "asset_feed", asset_kind: "title", rang: 0, texte: "Titre A" }),
      asset({ provenance: "asset_feed", asset_kind: "title", rang: 1, texte: "Titre B" }),
      asset({ provenance: "asset_feed", asset_kind: "image", rang: 0, image_url: `${STO}/a.jpg` }),
      asset({ provenance: "asset_feed", asset_kind: "image", rang: 1, image_url: `${STO}/b.jpg` }),
      asset({ provenance: "asset_feed", asset_kind: "link_url", rang: 0, lien_url: "https://maison.ch/a" }),
    ],
    ORIGINE
  );
  assert.deepEqual(a.textes, ["Premier texte", "Deuxième texte, long et entier."]);
  assert.deepEqual(a.titres, ["Titre A", "Titre B"]);
  assert.equal(a.visuels.length, 2);
  assert.equal(a.apercu.texte, "Premier texte");
  assert.deepEqual(a.liens, ["https://maison.ch/a"]);
  assert.equal(a.aDesVariantes, true);
});

test("asset_feed : la valeur de la créa vient d'abord, sans être répétée par une variante", () => {
  const a = annonceDe(
    crea({ texte: "Premier texte" }),
    [
      asset({ provenance: "asset_feed", asset_kind: "body", rang: 0, texte: "Premier texte" }),
      asset({ provenance: "asset_feed", asset_kind: "body", rang: 1, texte: "Autre" }),
    ],
    ORIGINE
  );
  assert.deepEqual(a.textes, ["Premier texte", "Autre"]);
});

test("carrousel : chaque carte, dans l'ordre, avec son titre, son visuel et son lien", () => {
  const a = annonceDe(
    crea({ texte: "Trois manteaux", lien_url: "https://maison.ch" }),
    [
      asset({ provenance: "child_attachment", asset_kind: "carousel_card", rang: 1, texte: "Manteau gris", image_url: `${STO}/g.jpg`, lien_url: "https://maison.ch/gris" }),
      asset({ provenance: "child_attachment", asset_kind: "carousel_card", rang: 0, texte: "Manteau bleu", image_url: `${STO}/b.jpg`, lien_url: "https://maison.ch/bleu" }),
      asset({ provenance: "child_attachment", asset_kind: "description", rang: 0, texte: "Laine" }),
    ],
    ORIGINE
  );
  assert.deepEqual(
    a.cartes.map((c) => [c.titre, c.description, c.visuel?.url, c.lien]),
    [
      ["Manteau bleu", "Laine", `${STO}/b.jpg`, "https://maison.ch/bleu"],
      ["Manteau gris", null, `${STO}/g.jpg`, "https://maison.ch/gris"],
    ]
  );
  assert.deepEqual(a.liens, ["https://maison.ch", "https://maison.ch/bleu", "https://maison.ch/gris"]);
  // L'aperçu prend le visuel de la première carte quand la créa n'en a pas.
  assert.equal(a.apercu.visuel?.url, `${STO}/b.jpg`);
});

test("une carte de carrousel n'est jamais lue comme une variante A/B", () => {
  const a = annonceDe(
    crea(),
    [asset({ provenance: "child_attachment", asset_kind: "title", rang: 0, texte: "Carte" })],
    ORIGINE
  );
  assert.deepEqual([a.titres, a.cartes.length, a.aDesVariantes], [[], 1, false]);
});

// ── Rien ne se fabrique ──────────────────────────────────────────────────────

test("une créa sans adresse n'a aucun lien", () => {
  const a = annonceDe(crea({ texte: "Bonjour", titre: "Titre" }), [], ORIGINE);
  assert.deepEqual(a.liens, []);
});

test("une adresse vide ou blanche n'est pas une adresse", () => {
  assert.deepEqual(annonceDe(crea({ lien_url: "   " }), [], ORIGINE).liens, []);
});

test("un javascript: ou une adresse illisible ne devient jamais un lien", () => {
  assert.deepEqual(
    [adresseSure("javascript:alert(1)"), adresseSure("pas une adresse"), adresseSure("https://ok.ch/a")],
    [null, null, "https://ok.ch/a"]
  );
});

test("un champ vide reste absent, pas une chaîne vide", () => {
  const a = annonceDe(crea({ texte: "  ", titre: null }), [], ORIGINE);
  assert.deepEqual([a.apercu.texte, a.textes], [null, []]);
});

test("aucun bouton : NO_BUTTON et l'absence ne s'écrivent pas", () => {
  assert.deepEqual([nomBouton("NO_BUTTON"), nomBouton(null), nomBouton("LEARN_MORE")], [null, null, "En savoir plus"]);
});

test("un bouton inconnu ne s'écrit jamais en anglais, ni traduit au hasard", () => {
  assert.equal(nomBouton("PLAY_GAME"), BOUTON_SANS_NOM);
});

// ── Les visuels viennent de Storage ──────────────────────────────────────────

test("une URL de Meta n'est jamais affichée : le visuel existe, son adresse est nulle", () => {
  const a = annonceDe(crea({ image_url: META }), [], ORIGINE);
  assert.deepEqual(a.apercu.visuel, { url: null, video: false });
});

test("seul le Storage public de ce projet passe : une URL signée stockée expire", () => {
  assert.deepEqual(
    [
      depuisStorage(`${ORIGINE}/storage/v1/object/public/b/x.jpg`, `${ORIGINE}/`),
      depuisStorage(`${ORIGINE}/storage/v1/object/sign/b/x.jpg?token=t`, ORIGINE),
      depuisStorage("https://autre.supabase.co/storage/v1/object/public/b/x.jpg", ORIGINE),
      depuisStorage(`${ORIGINE}/storage/v1/object/public/b/x.jpg`, ""),
    ],
    [`${ORIGINE}/storage/v1/object/public/b/x.jpg`, null, null, null]
  );
});

test("une vidéo se montre par sa vignette", () => {
  const a = annonceDe(crea({ video_id: "v1", vignette_url: `${STO}/v.jpg` }), [], ORIGINE);
  assert.deepEqual(a.apercu.visuel, { url: `${STO}/v.jpg`, video: true });
});

test("aucun visuel lu : pas de visuel du tout", () => {
  assert.equal(annonceDe(crea({ texte: "x" }), [], ORIGINE).apercu.visuel, null);
});

// ── L'annonce lue vit dans l'URL ─────────────────────────────────────────────

function ligne(p: Partial<LigneMeta>): LigneMeta {
  return {
    date: "2026-09-30",
    campagneId: "c1",
    campagneNom: "Soldes",
    groupeId: "g1",
    groupeNom: "Acheteurs",
    annonceId: "a1",
    annonceNom: "Promo",
    depense: 10,
    impressions: 100,
    clics: 1,
    resultats: null,
    attribution: null,
    ...p,
  };
}
const SEL = { debut: "2026-09-28", fin: "2026-10-04", campagne: () => true };

test("une annonce de la période s'ouvre, sous son nom le plus récent", () => {
  const lignes = [ligne({ date: "2026-09-29", annonceNom: "Ancien" }), ligne({ date: "2026-10-02", annonceNom: "Promo" })];
  assert.deepEqual(annonceOuverteDe("a1", lignes, SEL), { id: "a1", nom: "Promo", sous: "Soldes › Acheteurs" });
});

test("une annonce inconnue, absente ou vide ne s'ouvre pas", () => {
  const lignes = [ligne({})];
  assert.deepEqual([annonceOuverteDe("zz", lignes, SEL), annonceOuverteDe(undefined, lignes, SEL), annonceOuverteDe("  ", lignes, SEL)], [null, null, null]);
});

test("une annonce qui n'a tourné qu'avant la période ne s'ouvre pas", () => {
  assert.equal(annonceOuverteDe("a1", [ligne({ date: "2026-09-20" })], SEL), null);
});

test("sous un filtre, une annonce d'une autre campagne ne s'ouvre pas", () => {
  const sel = { ...SEL, campagne: (l: LigneMeta) => l.campagneId === "c2" };
  assert.equal(annonceOuverteDe("a1", [ligne({})], sel), null);
});

test("par l'ID, jamais par le nom : une homonyme sans ID n'ouvre rien", () => {
  assert.equal(annonceOuverteDe("Promo", [ligne({ annonceId: null })], SEL), null);
});

test("ouvrir un jour retire `annonce` (le lien de la Tendance)", () => {
  assert.equal(lienMeta({ annonce: "a1", vue: "trafic" }, { jour: "2026-09-30", annonce: null }), "/meta?vue=trafic&jour=2026-09-30");
});

test("ouvrir une annonce retire `jour` et garde le reste, sans le nommer", () => {
  const params = { vue: "trafic", jour: "2026-09-30", comparer: ["a1", "a2"] };
  assert.equal(lienMeta(params, { annonce: "a1", jour: null }), "/meta?vue=trafic&comparer=a1&comparer=a2&annonce=a1");
});
