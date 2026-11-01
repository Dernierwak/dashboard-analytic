// Rend « Ce qui a été fait » sur un payload construit par le harnais, hors
// ligne, sans navigateur ni framework de test (le web n'en a pas).
//
//   node .scratch/hebdo/harnais/07-la-frise-des-campagnes/rendu.js
// (depuis la racine du dépôt ; `saas/web/node_modules` doit être installé.)
const path = require("path");
const fs = require("fs");
const Module = require("module");
const { execFileSync } = require("child_process");

const RACINE = path.resolve(__dirname, "../../../..");
const WEB = path.join(RACINE, "saas/web");
const exiger = Module.createRequire(path.join(WEB, "package.json"));
const { transform } = exiger("sucrase");

// `@/x` → `saas/web/x`, et les .ts/.tsx transpilés à la volée.
const resoudre = Module._resolveFilename;
Module._resolveFilename = function (req, parent, ...r) {
  if (req.startsWith("@/")) req = path.join(WEB, req.slice(2));
  else if (!req.startsWith(".") && !path.isAbsolute(req)) {
    try { return exiger.resolve(req); } catch { /* module natif */ }
  }
  return resoudre.call(this, req, parent, ...r);
};
for (const ext of [".ts", ".tsx"]) {
  require.extensions[ext] = (m, fichier) => {
    const { code } = transform(fs.readFileSync(fichier, "utf8"), {
      transforms: ["typescript", "jsx", "imports"], jsxRuntime: "automatic", production: true, filePath: fichier,
    });
    m._compile(code, fichier);
  };
}

const React = exiger("react");
const { renderToStaticMarkup } = exiger("react-dom/server");
const { CeQuiAEteFait } = require(path.join(WEB, "components/hebdo/ce-qui-a-ete-fait.tsx"));
const F = require(path.join(WEB, "lib/hebdo/frise.ts"));

const echecs = [];
const constat = (vrai, texte) => { console.log((vrai ? "✓ " : "✗ ") + texte); if (!vrai) echecs.push(texte); };
const rendre = (report) => renderToStaticMarkup(React.createElement(CeQuiAEteFait, { report }));

const payload = JSON.parse(execFileSync("python3.12",
  [path.join(__dirname, "payload_rendu.py")], { cwd: RACINE, encoding: "utf8" }));

// ── Le bloc rendu sur un payload du harnais ──────────────────────────────────
const html = rendre(payload);
constat(html.includes("Ce qui a été fait"), "le bloc se rend sur un payload neuf");
constat(html.includes("22 → 28 octobre") && html.includes("la semaine mesurée"),
  "le panneau s'ouvre sur la semaine mesurée");
constat(["Automne vivante", "Signalée"].every((n) => html.includes(n)) && html.includes("Campagnes · 2"),
  "les deux campagnes qui tournent la semaine mesurée sont en cartes");
constat(html.includes("problème signalé par Meta"), "WITH_ISSUES se dit « problème signalé par Meta »");
constat(html.includes("https://exemple.test/automne.jpg") && html.includes("pas de visuel"),
  "une carte avec visuel, une « pas de visuel »");
constat(html.includes("lancée cette semaine"), "« lancée cette semaine » sur celle du 23 octobre");
constat(html.includes("84 CHF cette semaine"), "la dépense de la semaine au survol (12 CHF × 7 jours, le jour du fetch exclu)");
constat(html.includes("Organique") === false, "sans posts ni Instagram branché, pas d'onglet Organique");
constat(html.includes('aria-pressed="true"') && />Mois</.test(html), "la frise s'ouvre sur le Mois");

constat(payload.sources && payload.sources.meta && payload.sources.meta.etat === "recolte",
  "le payload porte `sources` (ticket 04) : Meta récolté");
const sansPub = rendre({ ...payload, sources: {} });
constat(!sansPub.includes("Campagnes ·"), "aucune régie branchée : pas d'onglet Campagnes");
constat(rendre({ ...payload, sources: undefined }).includes("Campagnes · 2"),
  "payload d'avant le ticket 04 (sans `sources`) : l'onglet Campagnes reste");

// ── Les payloads d'avant ne cassent pas la page ──────────────────────────────
const ancien = { ...payload, frise: { debut: "2025-01-01", fin: "2026-12-31", semaine_debut: "2026-10-22", campagnes: [], posts: [] } };
constat(rendre(ancien) === "", "ancienne forme de `frise` : le bloc ne se montre pas");
constat(rendre({ ...payload, frise: undefined }) === "", "pas de `frise` : rien");
constat(rendre({ ...payload, semaine: undefined }) === "", "pas de `semaine` : rien");

// ── Le vide se dit ───────────────────────────────────────────────────────────
const sem = { debut: "2026-10-22", fin: "2026-10-28" };
const avec = (etat, connecte_le) => ({ meta: { etat, connecte_le, journal: "couvert" } });
constat(F.campagnesVides(null, sem, true) === "Aucune campagne active cette semaine", "sans `sources` : une vraie semaine vide");
constat(F.campagnesVides(avec("panne", "2026-01-01T00:00:00Z"), sem, true) === "Campagnes en cours de récupération",
  "panne la semaine mesurée : en cours de récupération");
constat(F.campagnesVides(avec("jeton_mort", "2026-01-01T00:00:00Z"), sem, true) === "Aucune campagne active cette semaine",
  "jeton mort : panneau inchangé");
constat(F.campagnesVides(avec("recolte", "2026-11-01T00:00:00Z"), sem, false) === "Meta n'était pas encore connecté",
  "avant la connexion : « Meta n'était pas encore connecté »");
const vide = { ...payload, frise: { ...payload.frise, campagnes: [] }, sources: avec("panne", "2026-01-01") };
constat(rendre(vide).includes("Campagnes en cours de récupération") && rendre(vide).includes("Campagnes · 0"),
  "onglet gardé, compte 0, phrase de récupération");

// ── Le trait ─────────────────────────────────────────────────────────────────
const S = payload.semaine;
const vivante = payload.frise.campagnes.find((c) => c.id === "m_vit");
const seg = F.segments(vivante, S, 2026);
constat(seg.plein.fin === "2026-10-28" && seg.pointilles.debut === "2026-10-29" && seg.pointilles.fin === "2026-12-31",
  `vivante sans fin : plein jusqu'à semaine.fin, pointillés jusqu'au 31/12 — ${JSON.stringify(seg)}`);
const supprimee = payload.frise.campagnes.find((c) => c.id === "g_rem");
const segS = F.segments(supprimee, S, 2026);
constat(segS.plein.fin === "2026-05-20" && segS.pointilles === null,
  "supprimée : finit à son dernier jour de dépense, sans pointillés");
constat(F.decalageMax(S, 2026) === 42 && F.semaineDecalee(S, 42).fin === "2026-01-07",
  "on remonte jusqu'à la dernière semaine qui finit dans l'année");
constat(F.decalageDuJour(S, 2026, "2026-10-21") === 1 && F.decalageDuJour(S, 2026, "2026-12-15") === 0,
  "un clic choisit la semaine du jour ; après la semaine mesurée, on reste sur elle");

console.log();
if (echecs.length) { console.error(`${echecs.length} constat(s) ne tiennent pas.`); process.exit(1); }
console.log("tous les constats tiennent.");
