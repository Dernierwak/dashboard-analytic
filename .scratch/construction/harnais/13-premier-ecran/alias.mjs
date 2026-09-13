// LE SEUL ÉCHAFAUDAGE DE CE HARNAIS : rendre l'alias `@/…` de `saas/web`
// résoluble sous node, pour pouvoir importer `lib/a-faire.ts` TEL QUEL.
//
// Sans lui il faudrait recopier la fonction à vérifier dans le harnais — et une
// copie finit toujours par diverger de l'original, c'est-à-dire par dire vert
// sur du code qui n'est plus servi. Ici rien n'est recopié : `@/…` pointe sur
// les vrais fichiers de `saas/web`, et node retire les types lui-même.
//
// `@/lib/report` est la seule exception : le vrai module ouvre une connexion
// Supabase au chargement (`next/headers`). Il est remplacé par un bouchon qui
// n'expose que les deux fonctions PURES dont `lib/a-faire.ts` se sert.
import { register } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

// `fileURLToPath` et pas `new URL(...).pathname` : un chemin qui contient un
// espace en ressortirait encodé (« 08_Data%20analyse »), et node ne le
// retrouverait plus.
const ICI = path.dirname(fileURLToPath(import.meta.url));
register(pathToFileURL(path.join(ICI, "resolveur.mjs")));
