// Harnais JETABLE du ticket 22 — « Pulse lit la vue ».
//
// POURQUOI IL EXISTE. `saas/web` n'a aucun runner de test (arbitré par David,
// ticket 16), et `tsc` + `npm run build` ne disent rien de ce que le code
// CALCULE. Or tout le ticket tient dans deux fonctions dont une erreur
// s'afficherait comme un chiffre plausible : `lisRegroupement` (une page
// oubliée = un thème qui disparaît) et `fusionneRegroupement` (un `??` à la
// place d'un ternaire = le total d'hier réaffiché comme celui d'aujourd'hui).
//
// NI BASE, NI SECRET, NI RÉSEAU. Le faux client Supabase ci-dessous ne fait que
// rendre des tableaux. On transpile `lib/regroupement.ts` seul : ses deux
// imports sont des `import type`, donc effacés à la compilation — le module ne
// dépend de rien à l'exécution.
//
// À rejouer depuis ce dossier :  node verifie.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const WEB = resolve(import.meta.dirname, "../../../../saas/web");

function compile() {
  const dir = mkdtempSync(join(tmpdir(), "harnais-22-"));
  // Les `import type` cèdent la place à des doublures AVANT la compilation :
  // ils pointent sur l'alias `@/…` du projet, que `tsc` appelé hors tsconfig ne
  // sait pas résoudre. Ce n'est pas une perte de vérification — les types du
  // vrai module sont déjà contrôlés par `npx tsc --noEmit` sur le projet
  // entier ; ici on vérifie ce que le code CALCULE.
  //
  // Si un VRAI import (de valeur) apparaissait un jour dans ce fichier, il
  // survivrait à ce remplacement et la compilation échouerait : c'est voulu.
  // `lib/regroupement.ts` ne doit rien importer qu'il exécute — un module qui
  // se contente de lire et de recopier n'a besoin de personne.
  const DOUBLURES = [
    "type ReportPayload = { themes_focus?: any[] | null } & Record<string, any>;",
    "type ThemeFocus = Record<string, any>;",
    "declare const createClient: () => any;",
  ].join("\n");
  const src = readFileSync(join(WEB, "lib/regroupement.ts"), "utf8")
    .replace(/^import type .*$/gm, "")
    .replace("// LE TOTAL D'UN THÈME", `${DOUBLURES}\n// LE TOTAL D'UN THÈME`);
  const nu = join(dir, "regroupement.ts");
  writeFileSync(nu, src);
  try {
    execFileSync(
      "npx",
      ["tsc", nu, "--outDir", dir, "--module", "es2020", "--target", "es2020",
       "--moduleResolution", "bundler", "--skipLibCheck"],
      { cwd: WEB, stdio: "pipe" }
    );
  } catch (e) {
    console.error(String(e.stdout ?? ""));
    throw new Error("la compilation de lib/regroupement.ts a échoué");
  }
  return pathToFileURL(join(dir, "regroupement.js")).href;
}

const { lisRegroupement, fusionneRegroupement, cleTheme } = await import(compile());

let vus = 0;
const ratés = [];
function verifie(quoi, obtenu, attendu) {
  vus += 1;
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a !== b) ratés.push(`${quoi}\n      obtenu  ${a}\n      attendu ${b}`);
}

// ── Le faux client : il compte ce qu'on lui demande ──────────────────────────
function fauxSupabase(lignes, { erreur = null } = {}) {
  const appels = [];
  return {
    appels,
    from(table) {
      const etat = { table, colonnes: null, filtre: null, ordre: null };
      const chaine = {
        select(c) { etat.colonnes = c; return chaine; },
        eq(col, val) { etat.filtre = [col, val]; return chaine; },
        order(col) { etat.ordre = col; return chaine; },
        async range(a, b) {
          appels.push({ ...etat, range: [a, b] });
          if (erreur) return { data: null, error: erreur };
          return { data: lignes.slice(a, b + 1), error: null };
        },
      };
      return chaine;
    },
  };
}

const ligne = (label, extra = {}) => ({
  label, spend: 250, ctr: 1.5, posts: 3, reach_avg: 900, eng_avg: 4.2,
  revenue: 500, juge: true, roas: 2, ...extra,
});

// ── 1 · La lecture : bornée, ordonnée, paginée ───────────────────────────────
{
  const db = fauxSupabase([ligne("Ete")]);
  const r = await lisRegroupement(db, "u-1");
  verifie("1.1 la vue lue est bien theme_regroupement", db.appels[0].table, "theme_regroupement");
  verifie("1.2 la lecture est bornée au compte regardé", db.appels[0].filtre, ["user_id", "u-1"]);
  verifie("1.3 l'ordre est posé AVANT la pagination", db.appels[0].ordre, "label");
  verifie("1.4 la première page part de zéro", db.appels[0].range, [0, 999]);
  verifie("1.5 une page courte suffit", db.appels.length, 1);
  verifie("1.6 la vue a répondu", r.lu, true);
  verifie("1.7 le thème est indexé", r.lignes.get("ete").spend, 250);
}

// LE PLAFOND POSTGREST — le piège nommé par CLAUDE.md §8 : au-delà de 1 000
// lignes, PostgREST tronque EN SILENCE. Sans pagination, le 1 001e thème
// n'existerait pas et rien ne le dirait.
{
  const beaucoup = Array.from({ length: 1500 }, (_, i) => ligne(`T${i}`));
  const db = fauxSupabase(beaucoup);
  const r = await lisRegroupement(db, "u-1");
  verifie("1.8 les deux pages sont demandées", db.appels.map((a) => a.range), [[0, 999], [1000, 1999]]);
  verifie("1.9 aucune ligne n'est perdue au-delà du plafond", r.lignes.size, 1500);
  verifie("1.10 la 1001e ligne est bien là", Boolean(r.lignes.get("t1000")), true);
}

// UNE PANNE N'EST PAS UN COMPTE VIDE. Le client PostgREST ne jette pas : si on
// avalait `error`, une vue absente (migration non jouée) se lirait comme un
// compte sans aucun thème, et Pulse effacerait tous les bilans.
{
  const db = fauxSupabase([ligne("Ete")], { erreur: { code: "PGRST205" } });
  const r = await lisRegroupement(db, "u-1");
  verifie("1.11 une vue absente rend « on ne sait pas », pas « rien »", r.lu, false);
  verifie("1.12 et aucune ligne inventée", r.lignes.size, 0);
}

// ── 2 · La clé : deux orthographes d'un thème ne se ratent pas ───────────────
{
  verifie("2.1 la clé normalise casse et espaces", cleTheme("  Été Vélo  "), "été vélo");
  const db = fauxSupabase([ligne("Ete_Velo")]);
  const r = await lisRegroupement(db, "u-1");
  verifie("2.2 le label brut est conservé tel quel", r.lignes.get("ete_velo").label, "Ete_Velo");
}

// ── 3 · La fusion : trois cas qui ne se ressemblent pas ──────────────────────
const payload = (summary) => ({
  version: 2,
  week_label: "s", since: "2026-09-01", until: "2026-09-07",
  verdict: "", brief: null,
  suivi: { applique: 0, utile: 0, ecarte: 0 },
  todo: [], recos: [],
  themes_focus: [{
    label: "Ete", is_priority: true, campaigns: [], recos: [],
    jugement: { objectif: "ventes", metric: "revenue", metric_label: "Revenu",
                variation_pct: -12, mode: "tout", explication: "figé",
                levier_impactant: null },
    summary: {
      spend: 111, revenue: 111, roas: 1.1, ctr: 1.1, posts: 1,
      reach_avg: 111, eng_avg: 1.1, spend_week: 99,
      best_campaign: "Vieille campagne", n_campaigns: 4, ...summary,
    },
  }],
});

// CAS 1 — la vue répond pour ce thème : ses chiffres remplacent les figés.
{
  const r = fusionneRegroupement(payload({}), {
    lu: true, lignes: new Map([["ete", ligne("Ete")]]),
  });
  const s = r.themes_focus[0].summary;
  verifie("3.1 la dépense vient de la vue", s.spend, 250);
  verifie("3.2 le revenu vient de la vue", s.revenue, 500);
  verifie("3.3 le ROAS vient de la vue", s.roas, 2);
  verifie("3.4 le drapeau `juge` voyage avec", s.juge, true);
  verifie("3.5 la dépense de la SEMAINE reste au payload", s.spend_week, 99);
  verifie("3.6 la meilleure campagne reste au payload", s.best_campaign, "Vieille campagne");
  verifie("3.7 le jugement ne rétroagit jamais",
    r.themes_focus[0].jugement.variation_pct, -12);
}

// CAS 2 — la vue répond, mais plus rien n'est regroupé sous ce thème : ses
// chiffres passent à INCONNU. Ni les anciens (que la vue ne confirme plus), ni
// zéro (qui affirmerait « il n'a rien dépensé » — CLAUDE.md §7).
{
  const r = fusionneRegroupement(payload({}), {
    lu: true, lignes: new Map([["autre", ligne("Autre")]]),
  });
  const s = r.themes_focus[0].summary;
  verifie("3.8 un thème sans ligne n'affiche pas son ancien total", s.spend, null);
  verifie("3.9 ni un revenu que la vue ne confirme pas", s.revenue, null);
  verifie("3.10 ni un zéro qui affirmerait quelque chose", s.roas, null);
  verifie("3.11 `juge` redevient « on ne sait pas »", s.juge, null);
  verifie("3.12 la semaine, elle, reste lisible", s.spend_week, 99);
}

// CAS 3 — la vue n'a pas répondu du tout : on ne rafraîchit RIEN. Effacer des
// chiffres parce qu'une migration manque punirait le lecteur.
{
  const avant = payload({});
  const r = fusionneRegroupement(avant, { lu: false, lignes: new Map() });
  verifie("3.13 rien n'est touché quand la vue est muette",
    r.themes_focus[0].summary.spend, 111);
  verifie("3.14 et c'est bien le payload d'origine", r === avant, true);
}

// LE REVENU NULL SURVIT À LA FUSION — c'est tout l'objet de la mort de
// `revenuTheme()` : la vue dit « je ne rattache rien », et personne ne va
// chercher ailleurs un chiffre plus flatteur.
{
  const r = fusionneRegroupement(payload({}), {
    lu: true, lignes: new Map([["ete", ligne("Ete", { revenue: null, roas: null })]]),
  });
  verifie("3.15 un revenu inconnu reste inconnu", r.themes_focus[0].summary.revenue, null);
  verifie("3.16 et aucun ROAS n'en sort", r.themes_focus[0].summary.roas, null);
}

// UNE COLONNE AJOUTÉE À LA VUE NE DOIT PAS LAISSER SURVIVRE LE CHIFFRE D'HIER.
// Les huit champs partent en bloc (`chiffresDe` / `INCONNU`) plutôt qu'écrits
// un par un. Le contrôle regarde l'inverse : aucun champ de Regroupement du
// payload ne doit rester à sa valeur figée quand la vue a répondu.
{
  const r = fusionneRegroupement(payload({}), {
    lu: true, lignes: new Map([["ete", ligne("Ete")]]),
  });
  const s = r.themes_focus[0].summary;
  const figes = ["spend", "ctr", "posts", "reach_avg", "eng_avg", "revenue", "roas"]
    .filter((c) => s[c] === 111 || s[c] === 1.1 || s[c] === 1);
  verifie("3.17 aucun champ de la vue n'a gardé sa valeur figée", figes, []);
}

// LA PAGINATION QUI N'AVANCE PAS NE TOURNE PAS SANS FIN. Un serveur qui
// ignorerait `range` rendrait la même page pleine à chaque tour : la seule
// sortie étant « une page courte », la boucle tournerait pour toujours sur la
// page la plus consultée du produit.
{
  let appels = 0;
  const bloque = {
    from() {
      const c = {
        select: () => c, eq: () => c, order: () => c,
        async range() {
          appels += 1;
          if (appels > 50) throw new Error("boucle sans fin");
          return { data: Array.from({ length: 1000 }, () => ligne("Toujours")), error: null };
        },
      };
      return c;
    },
  };
  const r = await lisRegroupement(bloque, "u-1");
  verifie("3.19 une page pleine qui n'apporte rien arrête la boucle", appels <= 2, true);
  verifie("3.20 et rend « on ne sait pas », pas une liste amputée", r.lu, false);
}

// Les bords : rien à fusionner ne doit rien casser.
{
  verifie("3.21 pas de rapport du tout", fusionneRegroupement(null, { lu: true, lignes: new Map() }), null);
  const sansThemes = { ...payload({}), themes_focus: [] };
  verifie("3.22 un rapport sans thème passe tel quel",
    fusionneRegroupement(sansThemes, { lu: true, lignes: new Map() }) === sansThemes, true);
}

console.log(`${vus - ratés.length}/${vus} vérifications passent`);
if (ratés.length) {
  for (const r of ratés) console.error(`  ✗ ${r}`);
  process.exit(1);
}
