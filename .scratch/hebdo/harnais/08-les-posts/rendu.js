// Rend « Ce qui a été fait » sur le payload du harnais 08, hors ligne : les
// points des posts dans la frise et l'onglet Organique.
//
//   node .scratch/hebdo/harnais/08-les-posts/rendu.js
// (depuis la racine du dépôt ; `saas/web/node_modules` doit être installé.)
const path = require("path");
const fs = require("fs");
const Module = require("module");
const { execFileSync } = require("child_process");

const RACINE = path.resolve(__dirname, "../../../..");
const WEB = path.join(RACINE, "saas/web");
const exiger = Module.createRequire(path.join(WEB, "package.json"));
const { transform } = exiger("sucrase");

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
const P = require(path.join(WEB, "lib/hebdo/posts.ts"));

const echecs = [];
const constat = (vrai, texte) => { console.log((vrai ? "✓ " : "✗ ") + texte); if (!vrai) echecs.push(texte); };
const rendre = (report) => renderToStaticMarkup(React.createElement(CeQuiAEteFait, { report }));

const payload = JSON.parse(execFileSync("python3.12",
  [path.join(__dirname, "payload_rendu.py")], { cwd: RACINE, encoding: "utf8" }));

const html = rendre(payload);
constat(html.includes("Posts Instagram"), "la frise porte la rangée des posts");
constat((html.match(/rounded-full" style="left:[^"]*;top:[^"]*;background:#7b4fff/g) || []).length === 5,
  "un point par post de l'année jusqu'à semaine.fin (5)");
constat(html.includes("Organique · 4"), "l'onglet Organique compte les posts de la semaine choisie (4)");
constat(html.includes('aria-selected="true"') && /aria-selected="true"[^>]*>Organique/.test(html),
  "le panneau s'ouvre sur Organique quand il y a des posts");
constat(html.includes("▶ Reel") && html.includes("▶ Vidéo") && html.includes("· Autre"),
  "le format se lit : Reel, Vidéo, Autre pour un type inconnu");
constat(html.includes("aspect-[4/5]"), "visuel 4:5");
constat(html.includes("https://www.instagram.com/p/3/") && html.includes("voir le post"),
  "lien vers le post");
constat(html.includes("lien non récolté"), "un post sans permalink le dit, sans lien inventé");
constat(html.includes("ven. 23"), "le jour du post (ven. 23)");
constat(!/\b(900|400|likes|vues|portée)\b/i.test(html.split("Organique ·")[1] || ""),
  "aucun chiffre dans l'onglet Organique");

// ── Le vide se dit ───────────────────────────────────────────────────────────
const sem = { debut: "2026-10-15", fin: "2026-10-21" };
const ig = (connecte_le, jusqu_au) => ({ instagram: { etat: "recolte", connecte_le,
  posts: { depuis: "0001-01-01", jusqu_au } } });
constat(P.organiqueVide(ig("2026-03-02", "2026-10-28"), sem) === "Aucun post publié cette semaine",
  "semaine couverte sans post : « Aucun post publié cette semaine »");
constat(P.organiqueVide(ig("2026-03-02", "2026-10-18"), sem) === "Posts en cours de récupération",
  "semaine que la couverture ne contient pas : « en cours de récupération »");
constat(P.organiqueVide(ig("2026-10-25", "2026-10-28"), sem) === "Instagram n'était pas encore connecté",
  "semaine finie avant la connexion : « … n'était pas encore connecté »");
const mort = (jusqu_au) => ({ instagram: { etat: "jeton_mort", connecte_le: "2026-03-02",
  posts: { depuis: "0001-01-01", jusqu_au } } });
constat(P.organiqueVide(mort("2026-10-18"), sem) === "Pas de données Instagram pour cette semaine.",
  "jeton mort, semaine non couverte : « Pas de données Instagram pour cette semaine. », comme l'onglet Campagnes");
constat(P.organiqueVide(mort("2026-10-28"), sem) === "Aucun post publié cette semaine",
  "jeton mort, semaine que la couverture contient : le vide est prouvé");
constat(P.organiqueVide({}, sem) === "Posts en cours de récupération",
  "sans entrée Instagram, rien ne prouve une semaine vide");
const vide = rendre({ ...payload, frise: { ...payload.frise, posts: [] } });
constat(vide.includes("Organique · 0") && vide.includes("Aucun post publié cette semaine"),
  "onglet gardé, compte 0, phrase du vide");
const sansIg = rendre({ ...payload, frise: { ...payload.frise, posts: undefined },
  sources: { meta: payload.sources.meta } });
constat(!sansIg.includes("Organique"), "sans posts ni Instagram : pas d'onglet Organique");

console.log();
if (echecs.length) { console.error(`${echecs.length} constat(s) ne tiennent pas.`); process.exit(1); }
console.log("tous les constats tiennent.");
