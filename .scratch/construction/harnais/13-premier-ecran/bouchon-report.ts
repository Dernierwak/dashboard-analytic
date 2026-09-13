// Le bouchon de `@/lib/report` — le vrai module lit `next/headers` et ouvre une
// connexion Supabase au chargement. `lib/a-faire.ts` ne lui demande que deux
// fonctions pures, recopiées ici à l'identique de leur définition d'origine :
// elles sont d'une ligne chacune et ne portent aucune règle du ticket.
export function feedbackKey(recoKey: string, theme: string | null): string {
  return `${recoKey}::${theme ?? ""}`;
}
export function estVeille(key: string): boolean {
  return key.startsWith("veille_");
}
