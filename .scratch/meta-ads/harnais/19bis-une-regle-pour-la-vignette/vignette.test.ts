// Harnais du ticket 19bis — une seule règle pour le visuel d'une annonce.
// Lancer : sh .scratch/meta-ads/harnais/19bis-une-regle-pour-la-vignette/lancer.sh
// Seam : `premierVisuel` (`lib/meta/annonce.ts`), que la vignette de la
// Comparaison et les Aperçus (`lib/meta/donnees.ts`) appellent avec
// `[vignette_url, image_url]`, et le panneau via `annonceDe`. Attendu : seule
// une URL du Storage public de Pulse atteint l'écran ; une URL de Meta expire
// (https://developers.facebook.com/docs/marketing-api/reference/ad-image/).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { annonceDe, premierVisuel, type LigneCrea } from "@/lib/meta/annonce";

const ORIGINE = "https://projet.supabase.co";
const STOCKAGE = `${ORIGINE}/storage/v1/object/public/creatives/u1/ad1.jpg`;
const FBCDN = "https://scontent-cdg4-1.xx.fbcdn.net/v/t45.1600-4/ad1.jpg?oh=abc&oe=6789";

// Ce que la Comparaison et les Aperçus passent : la vignette d'abord.
const vignetteDe = (vignette_url: string | null, image_url: string | null) => premierVisuel([vignette_url, image_url], ORIGINE);

test("une URL de notre stockage est acceptée", () => {
  assert.equal(vignetteDe(STOCKAGE, null), STOCKAGE);
});

test("une URL fbcdn est refusée", () => {
  assert.equal(vignetteDe(FBCDN, null), null);
});

test("une URL Meta hors fbcdn (lookaside) est refusée aussi", () => {
  assert.equal(vignetteDe("https://lookaside.facebook.com/ads/image/?d=x", null), null);
});

test("une URL signée de notre stockage est refusée : elle expire comme celle de Meta", () => {
  assert.equal(vignetteDe(`${ORIGINE}/storage/v1/object/sign/creatives/u1/ad1.jpg?token=t`, null), null);
});

test("null donne « pas de visuel »", () => {
  assert.equal(vignetteDe(null, null), null);
});

test("vide ou blanc donne « pas de visuel »", () => {
  assert.equal(vignetteDe("", "   "), null);
});

test("vignette_url refusée mais image_url valide : prend image_url", () => {
  assert.equal(vignetteDe(FBCDN, STOCKAGE), STOCKAGE);
});

test("sans origine Supabase, rien ne passe", () => {
  assert.equal(premierVisuel([STOCKAGE], ""), null);
});

const crea = (sur: Partial<LigneCrea>): LigneCrea => ({
  montage: "flat",
  titre: null,
  texte: null,
  description: null,
  lien_url: null,
  call_to_action: null,
  image_url: null,
  video_id: null,
  vignette_url: null,
  ...sur,
});

test("le panneau suit la même règle : image chez Meta, vignette chez nous → la vignette", () => {
  assert.deepEqual(annonceDe(crea({ image_url: FBCDN, vignette_url: STOCKAGE }), [], ORIGINE).apercu.visuel, { url: STOCKAGE, video: false });
});

test("le panneau garde son état « Meta en a un, Pulse ne l'a pas copié »", () => {
  assert.deepEqual(annonceDe(crea({ image_url: FBCDN }), [], ORIGINE).apercu.visuel, { url: null, video: false });
});

// Garde-fou de texte : un `vignette_url ?? image_url` brut revenu dans la
// lecture Meta rouvrirait la seconde règle que ce ticket a fermée.
test("aucune lecture Meta ne prend plus un visuel sans `premierVisuel`", () => {
  const source = readFileSync(join(process.env.WEB ?? "", "lib/meta/donnees.ts"), "utf8");
  assert.doesNotMatch(source, /(vignette_url|image_url)\s*\?\?/);
});
