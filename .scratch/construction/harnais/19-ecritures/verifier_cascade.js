// L'ENCHAÎNEMENT, EXÉCUTÉ — pas lu.
//
// `saas/web/lib/cascade.ts` est importé TEL QUEL : node 22+ retire les
// annotations de type lui-même, donc aucune compilation, aucune dépendance, et
// surtout aucune COPIE du code à vérifier (une copie finirait par diverger de
// l'original, et le harnais dirait vert sur du code qui n'est plus servi).
//
// Le module est PUR : il ne connaît ni Supabase, ni `next/headers`. C'est
// exactement ce qui le rend jouable ici — et c'est la raison pour laquelle la
// cascade de thèmes a été sortie d'`actions.ts` plutôt que corrigée sur place.
//
// Ce que ces cas gardent : la propriété dont dépend tout le ticket 19 — une
// séquence d'écritures s'ARRÊTE à la première panne, et elle DIT laquelle.

import { fileURLToPath } from "node:url";
import path from "node:path";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const MODULE = path.resolve(ICI, "../../../../saas/web/lib/cascade.ts");
const C = await import(MODULE);

let n = 0;
const ko = [];
const ok = (nom, condition, detail = "") => {
  n++;
  if (!condition) ko.push(`${nom} — ${detail}`);
};
const egal = (nom, obtenu, attendu) =>
  ok(nom, obtenu === attendu, `obtenu ${JSON.stringify(obtenu)}, attendu ${JSON.stringify(attendu)}`);

/** Une suite d'étapes qui note ce qu'elle a réellement exécuté. `panne` est
 *  l'index (0-based) de l'étape qui échoue, ou `null` si tout passe. */
function suite(noms, panne = null) {
  const jouees = [];
  const etapes = noms.map((nom, i) => ({
    nom,
    ecrire: async () => {
      jouees.push(nom);
      return i === panne ? { message: `échec simulé sur ${nom}` } : null;
    },
  }));
  return { etapes, jouees };
}

const SIX = ["campagnes Meta", "campagnes Google", "actions décidées",
             "événements GA4 du thème", "objectif du thème", "posts Instagram"];

// ── 1 · TOUT PASSE : les six s'exécutent, dans l'ordre ──────────────────────
{
  const { etapes, jouees } = suite(SIX);
  const r = await C.enchainer(etapes);
  egal("six étapes vertes → ok", r.ok, true);
  egal("les six sont jouées", jouees.length, 6);
  egal("et dans l'ordre donné", jouees.join("|"), SIX.join("|"));
}

// ── 2 · LA TROISIÈME ÉCHOUE : on s'arrête LÀ, et on la nomme ────────────────
//
// C'est le scénario exact du ticket 19 : « si la troisième échoue, les deux
// premières restent écrites, la fonction rend { ok: true } ». Elle ne le rend
// plus, et les suivantes ne partent plus.
{
  const { etapes, jouees } = suite(SIX, 2);
  const r = await C.enchainer(etapes);
  egal("une étape rouge → pas ok", r.ok, false);
  egal("l'étape nommée est celle qui a échoué", r.etape, "actions décidées");
  egal("les suivantes ne sont PAS jouées", jouees.length, 3);
  egal("et les précédentes l'ont bien été", jouees.join("|"), SIX.slice(0, 3).join("|"));
}

// ── 3 · LA PREMIÈRE ÉCHOUE : rien d'autre ne part ───────────────────────────
{
  const { etapes, jouees } = suite(SIX, 0);
  const r = await C.enchainer(etapes);
  egal("arrêt sur la première", r.etape, "campagnes Meta");
  egal("aucune autre écriture", jouees.length, 1);
}

// ── 4 · LA DERNIÈRE ÉCHOUE — la liste maîtresse ─────────────────────────────
//
// L'ordre place `profiles.labels` en dernier POUR ce cas : l'arrêt laisse le
// thème visible dans la liste, donc relançable. Rien ne le prouve ici sinon
// que les cinq précédentes ont bien été écrites avant lui.
{
  const derniere = [...SIX, "liste des thèmes"];
  const { etapes, jouees } = suite(derniere, 6);
  const r = await C.enchainer(etapes);
  egal("arrêt sur la liste maîtresse", r.etape, "liste des thèmes");
  egal("les six précédentes sont passées", jouees.length, 7);
}

// ── 5 · LES FORMES DE PANNE QUE POSTGREST REND ──────────────────────────────
//
// supabase-js rend `error: null` quand tout va bien, un objet sinon. Un
// `undefined` (une étape qui oublie son `return`) ne doit pas passer pour une
// panne — il ne doit pas non plus en cacher une.
{
  egal("`null` n'est pas une panne",
       (await C.enchainer([{ nom: "a", ecrire: async () => null }])).ok, true);
  egal("`undefined` n'est pas une panne",
       (await C.enchainer([{ nom: "a", ecrire: async () => undefined }])).ok, true);
  egal("un objet d'erreur EST une panne",
       (await C.enchainer([{ nom: "a", ecrire: async () => ({ message: "42501" }) }])).ok, false);
  // Le cas qui compte vraiment : PostgREST rend un objet complet, pas un
  // booléen. Un test sur `.message` seul raterait une erreur sans message.
  egal("un objet d'erreur SANS message est quand même une panne",
       (await C.enchainer([{ nom: "a", ecrire: async () => ({ code: "42501" }) }])).ok, false);
}

// ── 6 · AUCUNE ÉTAPE ────────────────────────────────────────────────────────
{
  egal("une liste vide passe", (await C.enchainer([])).ok, true);
}

// ── 7 · EN SÉRIE, JAMAIS EN PARALLÈLE ───────────────────────────────────────
//
// `Promise.all` lancerait les six d'un coup : les cinq autres partiraient
// malgré la panne de la première, c'est-à-dire l'état incohérent qu'on corrige.
// La preuve est temporelle — une étape lente ne doit pas être doublée par la
// suivante.
{
  const ordre = [];
  const lent = (nom, ms) => ({
    nom,
    ecrire: async () => {
      await new Promise((r) => setTimeout(r, ms));
      ordre.push(nom);
      return null;
    },
  });
  await C.enchainer([lent("lente", 30), lent("rapide", 1)]);
  egal("la lente finit avant que la rapide commence", ordre.join("|"), "lente|rapide");
}

// ── 8 · LE MESSAGE D'ARRÊT ──────────────────────────────────────────────────
//
// Trois choses et pas une de plus : que ce n'est pas fini, OÙ, et que relancer
// reprend sans doubler. Aucune promesse de réparation automatique.
{
  const m = C.arretCascade("Renommage incomplet", "actions décidées");
  ok("le message nomme le geste", m.startsWith("Renommage incomplet"));
  ok("le message nomme l'étape", m.includes("« actions décidées »"));
  ok("le message dit que relancer ne double rien", m.includes("n'est pas refait"));
  ok("le message demande de relancer", m.includes("relance"));
  ok("le message ne promet aucune réparation automatique",
     !/automatiqu|tout seul|se répare/i.test(m));
  // L'appelant accorde son groupe nominal lui-même : le constructeur ne doit
  // pas coller un adjectif qui se tromperait de genre.
  ok("le féminin de l'appelant est respecté",
     C.arretCascade("Suppression incomplète", "posts Instagram")
      .startsWith("Suppression incomplète : arrêté sur"));
}

console.log(`\nlib/cascade.ts, exécuté : ${n - ko.length}/${n} vérifications passent`);
for (const m of ko) console.log(`  ✗ ${m}`);
process.exit(ko.length ? 1 : 0);
