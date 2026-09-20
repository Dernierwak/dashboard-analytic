// Le trou de récolte lu depuis le web (ticket 48) — `saas/web/lib/canaux-muets.ts`.
//
// Ce que ces tests protègent, et pourquoi chacun existe : les trois états qui
// se ressemblent (ADR 0005), le filtre sur le dernier passage, et la borne de
// fenêtre qui décide si une mesure se tait ou non. Les trois sont des règles
// qu'on ne peut pas vérifier en cliquant — le client ne déclenche rien, et il
// faudrait une panne réelle pour les voir (`CLAUDE.md` §9).
//
//   node --test --experimental-strip-types test_canaux_muets.ts

import assert from "node:assert/strict";
import test from "node:test";

import {
  aveuglesSur,
  canalTu,
  fenetreTue,
  fetchCanauxMuets,
  type CanalMuetLive,
} from "../../../../saas/web/lib/canaux-muets.ts";
import { fauxSupabase, type Base } from "./faux-supabase.ts";

const UID = "00000000-0000-0000-0000-000000000001";

function base(p: Partial<Base> = {}): Base {
  return {
    fetch_progress: [],
    meta_ads_insights: [],
    google_ads_insights: [],
    ...p,
  };
}

function jours(debut: string, n: number): { date_start: string }[] {
  const out: { date_start: string }[] = [];
  const d = new Date(`${debut}T00:00:00Z`);
  for (let i = 0; i < n; i++) {
    out.push({ date_start: new Date(d.getTime() + i * 86400000).toISOString().slice(0, 10) });
  }
  return out;
}

const sb = (b: Base) => fauxSupabase(b) as never;

// ── Ce que la table dit, et ce qu'elle ne dit pas ───────────────────────────

test("un canal en échec au dernier passage est muet, borné à sa dernière date", async () => {
  const muets = await fetchCanauxMuets(
    sb(
      base({
        fetch_progress: [
          { canal: "meta", run_id: "2026-09-20T07:00:00Z", etat: "echec", mot_de_fin: "meta KO: jeton" },
          { canal: "google", run_id: "2026-09-20T07:00:00Z", etat: "fini", mot_de_fin: "google: 812 lignes" },
        ],
        meta_ads_insights: jours("2026-09-08", 5),
        google_ads_insights: jours("2026-09-08", 12),
      })
    ),
    UID
  );

  assert.deepEqual(muets, [
    { canal: "meta", nom: "Meta Ads", mot: "meta KO: jeton", depuis: "2026-09-12" },
  ]);
});

test("un canal SAUTÉ ne creuse aucun trou — il n'a pas été appelé", async () => {
  const muets = await fetchCanauxMuets(
    sb(
      base({
        fetch_progress: [
          { canal: "google", run_id: "2026-09-20T07:00:00Z", etat: "saute", mot_de_fin: "aucune connexion" },
        ],
      })
    ),
    UID
  );

  assert.deepEqual(muets, []);
});

test("un canal qui a fini sans une seule ligne rend un zéro mesuré, pas un trou", async () => {
  const muets = await fetchCanauxMuets(
    sb(
      base({
        fetch_progress: [
          { canal: "meta", run_id: "2026-09-20T07:00:00Z", etat: "fini", mot_de_fin: "meta: 0 ligne" },
        ],
        meta_ads_insights: [],
      })
    ),
    UID
  );

  assert.deepEqual(muets, []);
});

test("un échec d'un passage PRÉCÉDENT ne tait plus rien", async () => {
  const muets = await fetchCanauxMuets(
    sb(
      base({
        fetch_progress: [
          { canal: "meta", run_id: "2026-08-30T07:00:00Z", etat: "echec", mot_de_fin: "meta KO" },
          { canal: "meta", run_id: "2026-09-20T07:00:00Z", etat: "fini", mot_de_fin: "meta: 143 lignes" },
        ],
        meta_ads_insights: jours("2026-09-08", 12),
      })
    ),
    UID
  );

  assert.deepEqual(muets, []);
});

test("un canal muet qui n'a jamais rien écrit n'a pas de date de bord", async () => {
  const muets = await fetchCanauxMuets(
    sb(
      base({
        fetch_progress: [
          { canal: "google", run_id: "2026-09-20T07:00:00Z", etat: "echec", mot_de_fin: "google KO" },
        ],
        google_ads_insights: [],
      })
    ),
    UID
  );

  assert.equal(muets.length, 1);
  assert.equal(muets[0].depuis, null);
});

test("seule la pub creuse un trou dans un chiffre : instagram et ga4 sont ignorés", async () => {
  const muets = await fetchCanauxMuets(
    sb(
      base({
        fetch_progress: [
          { canal: "instagram", run_id: "2026-09-20T07:00:00Z", etat: "echec", mot_de_fin: "insta KO" },
          { canal: "ga4", run_id: "2026-09-20T07:00:00Z", etat: "echec", mot_de_fin: "ga4 KO" },
        ],
      })
    ),
    UID
  );

  assert.deepEqual(muets, []);
});

test("une table de suivi illisible ne fait taire personne", async () => {
  const muets = await fetchCanauxMuets(sb(base({ fetch_progress: null })), UID);

  assert.deepEqual(muets, []);
});

test("un mot de fin absent ne laisse pas le client sans explication", async () => {
  const muets = await fetchCanauxMuets(
    sb(
      base({
        fetch_progress: [
          { canal: "meta", run_id: "2026-09-20T07:00:00Z", etat: "echec", mot_de_fin: null },
        ],
        meta_ads_insights: jours("2026-09-08", 3),
      })
    ),
    UID
  );

  assert.equal(muets[0].mot, "Meta Ads : échec de récolte");
});

// ── La borne qui décide si une mesure se tait ───────────────────────────────

const META_MUET: CanalMuetLive = {
  canal: "meta",
  nom: "Meta Ads",
  mot: "meta KO",
  depuis: "2026-09-12",
};

test("une fenêtre qui s'arrête au dernier jour écrit reste un chiffre", () => {
  assert.equal(fenetreTue([META_MUET], "2026-09-12"), false);
  assert.deepEqual(aveuglesSur([META_MUET], "2026-09-12"), []);
});

test("une fenêtre qui dépasse le dernier jour écrit se tait", () => {
  assert.equal(fenetreTue([META_MUET], "2026-09-13"), true);
});

test("les fenêtres d'AVANT le trou restent des chiffres", () => {
  assert.equal(fenetreTue([META_MUET], "2026-08-31"), false);
});

test("un canal sans aucune ligne est aveugle sur toute fenêtre, même ancienne", () => {
  const jamais: CanalMuetLive = { ...META_MUET, depuis: null };

  assert.equal(fenetreTue([jamais], "2020-01-01"), true);
});

test("le silence d'une régie ne tait pas la mesure de l'autre", () => {
  assert.equal(canalTu([META_MUET], "meta", "2026-09-20"), true);
  assert.equal(canalTu([META_MUET], "google", "2026-09-20"), false);
});

test("aucun canal muet ne tait jamais rien", () => {
  assert.equal(fenetreTue([], "2026-09-20"), false);
  assert.equal(canalTu([], "meta", "2026-09-20"), false);
});
