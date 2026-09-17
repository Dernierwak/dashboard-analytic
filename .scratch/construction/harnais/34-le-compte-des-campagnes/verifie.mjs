// Harnais JETABLE du ticket 34, moitié web — « le compte des campagnes ».
//
// POURQUOI IL EXISTE. `saas/web` n'a aucun runner de test (arbitré par David,
// ticket 16), et `tsc` + `npm run build` ne disent rien de ce que le code
// CALCULE. Or les erreurs possibles de `lib/campagnes-theme.ts` s'affichent
// toutes comme un écran parfaitement normal :
//
//   · une régie lue sur l'extrait au lieu du compte entier → la porte vers
//     `/google` disparaît sur un thème qui y dépense peu, exactement le défaut
//     du ticket 34, et rien à l'écran ne le signale ;
//   · un repli mal écrit → un vieux payload se met à ÉNONCER un nombre de
//     campagnes par régie qu'il ne porte pas ;
//   · un ordre des régies pris sur les clés du payload → la porte et la phrase
//     de la carte listent Google avant Meta selon les comptes, au hasard.
//
// NI BASE, NI SECRET, NI RÉSEAU : le module ne lit qu'un objet en mémoire. On
// transpile `lib/campagnes-theme.ts` tel qu'il est sur le disque — son seul
// import est un `import type`, donc effacé à la compilation.
//
// À rejouer depuis ce dossier :  node verifie.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const WEB = resolve(import.meta.dirname, "../../../../saas/web");

function compile() {
  const dir = mkdtempSync(join(tmpdir(), "harnais-34-"));
  // La doublure remplace l'alias `@/…`, que `tsc` appelé hors tsconfig ne sait
  // pas résoudre. Ce n'est pas une perte : les vrais types sont déjà contrôlés
  // par `npx tsc --noEmit` sur le projet entier ; ici on vérifie le CALCUL.
  //
  // Un VRAI import (de valeur) survivrait à ce remplacement et ferait échouer
  // la compilation — c'est voulu : ce module ne doit rien exécuter d'autre.
  const DOUBLURE = "type ThemeFocus = Record<string, any>;";
  const src = readFileSync(join(WEB, "lib/campagnes-theme.ts"), "utf8")
    .replace(/^import type .*$/gm, DOUBLURE);
  const nu = join(dir, "campagnes-theme.ts");
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
    throw new Error("la compilation de lib/campagnes-theme.ts a échoué");
  }
  return pathToFileURL(join(dir, "campagnes-theme.js")).href;
}

const { regiesDuTheme, compteCampagnes } = await import(compile());

let vus = 0;
const ratés = [];
function verifie(quoi, obtenu, attendu) {
  vus += 1;
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a !== b) ratés.push(`${quoi}\n      obtenu  ${a}\n      attendu ${b}`);
}

/** Une campagne de l'extrait publié — seul `channel` compte ici. */
const camp = (channel, i) => ({ name: `${channel} ${i}`, channel, key: `k-${channel}-${i}` });

/** La carte d'un thème telle que le payload la porte. `n_campaigns_canal`
 *  absent = payload publié avant le ticket 34. */
function theme({ extrait, n_campaigns, n_campaigns_canal }) {
  const summary = { n_campaigns };
  if (n_campaigns_canal !== undefined) summary.n_campaigns_canal = n_campaigns_canal;
  return { label: "Hiver", campaigns: extrait, summary };
}

// ── 1 · LE CAS DU TICKET : douze campagnes, huit publiées ────────────────────
{
  // Les huit plus grosses dépenses sont toutes Meta ; les deux Google du thème
  // ne sont pas dans l'extrait. C'est le jeu exact du harnais Python.
  const t = theme({
    extrait: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => camp("meta", i)),
    n_campaigns: 14,
    n_campaigns_canal: { meta: 12, google: 2 },
  });
  const c = compteCampagnes(t);
  verifie("1.1 le total est celui du thème, pas de l'extrait", c.total, 14);
  verifie("1.2 l'extrait est nommé pour ce qu'il est", c.affichees, 8);
  verifie("1.3 ce qui manque se compte", c.manquantes, 6);
  verifie("1.4 la régie absente de l'extrait ouvre quand même sa porte",
    regiesDuTheme(t), [{ canal: "meta", n: 12 }, { canal: "google", n: 2 }]);
}

// ── 2 · LE CAS ORDINAIRE : rien ne manque ────────────────────────────────────
{
  const t = theme({
    extrait: [camp("meta", 0), camp("google", 0)],
    n_campaigns: 2,
    n_campaigns_canal: { meta: 1, google: 1 },
  });
  const c = compteCampagnes(t);
  verifie("2.1 le total colle à l'extrait", c.total, 2);
  verifie("2.2 rien à annoncer", c.manquantes, 0);
  verifie("2.3 les deux régies ouvrent",
    regiesDuTheme(t), [{ canal: "meta", n: 1 }, { canal: "google", n: 1 }]);
}

// ── 3 · LES ZÉROS, QUI NE SONT PAS DES ABSENCES ──────────────────────────────
{
  // Un thème purement organique a une carte et zéro campagne. Le compte doit
  // rendre 0 sans que rien ne se replie, et surtout n'ouvrir aucune porte de
  // régie — `{}` se lit « aucune campagne », pas « on ne sait pas ».
  const t = theme({ extrait: [], n_campaigns: 0, n_campaigns_canal: {} });
  const c = compteCampagnes(t);
  verifie("3.1 zéro campagne se dit zéro", c.total, 0);
  verifie("3.2 et rien ne manque", c.manquantes, 0);
  verifie("3.3 aucune régie n'ouvre de porte", regiesDuTheme(t), []);
}
{
  // Une régie écrite à 0 par un worker plus bavard n'ouvre PAS de porte : une
  // page de régie vide promise est pire que pas de promesse (ticket 14).
  const t = theme({
    extrait: [camp("meta", 0)],
    n_campaigns: 1,
    n_campaigns_canal: { meta: 1, google: 0 },
  });
  verifie("3.4 une régie à zéro n'ouvre pas de porte",
    regiesDuTheme(t), [{ canal: "meta", n: 1 }]);
}

// ── 4 · LE REPLI SUR UN VIEUX PAYLOAD ────────────────────────────────────────
{
  // Avant le ticket 34, le payload ne portait pas le détail par régie. Le repli
  // rend le comportement d'AVANT — l'extrait, avec sa limite connue — mais il
  // ne doit surtout pas se mettre à énoncer un nombre.
  const t = theme({
    extrait: [camp("meta", 0), camp("meta", 1), camp("google", 0)],
    n_campaigns: 3,
  });
  verifie("4.1 les régies vues dans l'extrait ouvrent",
    regiesDuTheme(t), [{ canal: "meta", n: null }, { canal: "google", n: null }]);
  verifie("4.2 et aucun nombre n'est inventé",
    regiesDuTheme(t).every((r) => r.n === null), true);
  verifie("4.3 le total figé du vieux payload reste lisible",
    compteCampagnes(t).total, 3);
}
{
  // `null` explicite = la même chose qu'absent : « on ne sait pas ».
  const t = theme({
    extrait: [camp("google", 0)],
    n_campaigns: 1,
    n_campaigns_canal: null,
  });
  verifie("4.4 un null explicite se replie pareil",
    regiesDuTheme(t), [{ canal: "google", n: null }]);
}
{
  // Un payload SANS `n_campaigns` du tout (jamais publié, mais le type le
  // permettrait après une fusion ratée) : on retombe sur l'extrait plutôt que
  // sur `NaN`.
  const t = { label: "X", campaigns: [camp("meta", 0)], summary: {} };
  const c = compteCampagnes(t);
  verifie("4.5 pas de total = l'extrait fait foi", c.total, 1);
  verifie("4.6 et rien ne manque", c.manquantes, 0);
}

// ── 5 · UN PAYLOAD INCOHÉRENT NE PRODUIT PAS DE PHRASE ABSURDE ───────────────
{
  // Si le total était plus petit que l'extrait, `total - affichees` serait
  // négatif et la carte écrirait « les -1 autres campagnes ». La phrase doit
  // disparaître, pas s'afficher à l'envers.
  const t = theme({
    extrait: [camp("meta", 0), camp("meta", 1)],
    n_campaigns: 1,
    n_campaigns_canal: { meta: 1 },
  });
  verifie("5.1 jamais de manquantes négatives", compteCampagnes(t).manquantes, 0);
}

// ── 6 · L'ORDRE DES RÉGIES EST CELUI DE LA LECTURE DES PAGES ─────────────────
{
  // Meta puis Google, quoi qu'en dise l'ordre des clés du payload : la porte et
  // la phrase de la carte doivent lister les régies dans le même ordre que la
  // colonne de gauche, toujours.
  const t = theme({
    extrait: [camp("google", 0)],
    n_campaigns: 5,
    n_campaigns_canal: { google: 2, meta: 3 },
  });
  verifie("6.1 Meta d'abord, Google ensuite",
    regiesDuTheme(t).map((r) => r.canal), ["meta", "google"]);
}

console.log(`\nLe compte des campagnes, côté web (34) : ${vus - ratés.length}/${vus} vérifications passent`);
for (const m of ratés) console.log(`  ✗ ${m}`);
process.exit(ratés.length ? 1 : 0);
