// `lib/meta/tableau.ts` importe `./lecture` sans extension, comme Next le
// veut ; Node, lui, exige l'extension. Ce crochet la rajoute, pour le harnais
// seulement — rien n'est ajouté au projet.
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
export async function resolve(spec, ctx, suite) {
  try { return await suite(spec, ctx); }
  catch (e) {
    if (spec.startsWith(".") && !/\\.[a-z]+$/.test(spec)) return suite(spec + ".ts", ctx);
    throw e;
  }
}`),
  import.meta.url
);
