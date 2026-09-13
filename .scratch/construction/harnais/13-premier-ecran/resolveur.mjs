import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(ICI, "../../../../saas/web");

export async function resolve(specifier, context, next) {
  if (specifier === "@/lib/report" || specifier === "@/app/actions")
    return next(pathToFileURL(path.join(ICI, "bouchon-report.ts")).href, context);
  if (specifier.startsWith("@/"))
    return next(pathToFileURL(path.join(WEB, specifier.slice(2))).href, context);
  return next(specifier, context);
}
