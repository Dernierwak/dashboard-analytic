// ── LES PLAGES MESURÉES D'UNE SÉRIE ──────────────────────────────────────────
//
// Une courbe ne relie que des jours mesurés qui se suivent. Depuis le ticket
// 24, un jour sans impression vaut `null` ; tracer un seul trait par-dessus
// dessinait une continuité que rien n'a mesurée (ticket 26, `CLAUDE.md` §7).
// Le trait et son dégradé se tracent donc plage par plage.
//
// Pas de directive : lu par `components/line-chart.tsx` (`CLAUDE.md` §8).

/** Les indices des valeurs mesurées, regroupés par suites consécutives.
 *  `[1, 2, null, 4]` → `[[0, 1], [3]]`. Zéro est une mesure. */
export function plagesMesurees(values: readonly (number | null)[]): number[][] {
  const plages: number[][] = [];
  let enCours: number[] = [];
  values.forEach((v, i) => {
    if (v !== null) {
      enCours.push(i);
      return;
    }
    if (enCours.length > 0) plages.push(enCours);
    enCours = [];
  });
  if (enCours.length > 0) plages.push(enCours);
  return plages;
}
