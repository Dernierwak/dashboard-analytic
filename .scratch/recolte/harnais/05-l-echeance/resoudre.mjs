// Crochet de résolution pour un harnais TS lancé par `node --test` (Node ≥ 23.6,
// type stripping natif). Deux choses que Next fait et que Node ne fait pas :
//   · un import relatif sans extension (`./lecture`) → on essaie `.ts` ;
//   · l'alias `@/` de `tsconfig.json` → `saas/web/` (passé en WEB, env).
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const web = process.env.WEB;
const base = web ? pathToFileURL(web.endsWith("/") ? web : web + "/").href : null;

register(
  "data:text/javascript," +
    encodeURIComponent(`
const BASE = ${JSON.stringify(base)};
export async function resolve(spec, ctx, suite) {
  if (BASE && spec.startsWith("@/")) spec = new URL(spec.slice(2), BASE).href;
  try { return await suite(spec, ctx); }
  catch (e) {
    if ((spec.startsWith(".") || spec.startsWith("file:")) && !/\\.[a-z]+$/.test(spec)) {
      try { return await suite(spec + ".ts", ctx); } catch { return suite(spec + ".tsx", ctx); }
    }
    throw e;
  }
}`),
  import.meta.url
);
