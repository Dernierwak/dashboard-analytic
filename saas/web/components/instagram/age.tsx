import { ageLu, texteAge, type Post } from "@/lib/instagram/lecture";

// ── L'ÂGE D'UN POST, UNE SEULE FORME POUR TOUTE LA PAGE ─────────────────────
//
// Spec, § La lecture, ligne « âge » ; user story 20 : un post de moins de 7
// jours porte son âge et l'icône « peut encore changer » partout où il paraît
// — la liste des 5, le Tableau, le Panneau (le nuage le dit dans l'infobulle
// et dessine un point vide sous 48 h). Le texte vient d'`ageLu` / `texteAge`
// (`lib/instagram/lecture.ts`, harnais du ticket 13) ; rien ne s'écrit ici.
//
// Sans directive ni hook : il se rend aussi bien dans un composant serveur
// que dans le Tableau, qui est client.

export const AIDE_AGE = "Instagram met encore ses chiffres à jour : ils peuvent changer pendant 7 jours.";

/** Rien au-delà de 7 jours : ses chiffres sont faits. */
export function AgePost({ post, className = "" }: { post: Post; className?: string }) {
  const texte = texteAge(ageLu(post));
  if (!texte) return null;
  return (
    <span title={AIDE_AGE} className={`inline-flex items-center gap-1 whitespace-nowrap text-warn ${className}`}>
      <span aria-hidden>↻</span>
      {texte}
    </span>
  );
}
