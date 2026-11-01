import type { Bornes, FriseHebdo } from "@/lib/hebdo/frise";

// ── L'ONGLET ORGANIQUE — ticket 08 ───────────────────────────────────────────
//
// Pas encore construit : les posts n'entrent dans le payload qu'au ticket 08
// (`frise.posts`). Jusque-là l'onglet dit qu'il n'a rien à montrer, plutôt
// qu'un vide muet qui se lirait « aucun post ».
export function PanneauOrganique({ frise }: { frise: FriseHebdo; choisie: Bornes }) {
  if (frise.posts === undefined) {
    return <p className="text-[12.5px] text-muted">Les posts ne sont pas encore dans ce rapport.</p>;
  }
  return null;
}
