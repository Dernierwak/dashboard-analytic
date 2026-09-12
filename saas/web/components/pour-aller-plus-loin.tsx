// ── POUR ALLER PLUS LOIN ─────────────────────────────────────────────────────
//
// Le savoir-faire de fond, par thème : des bonnes pratiques durables qui restent
// valables dans six mois. Ce ne sont PAS des conseils sur les chiffres de la
// semaine — ceux-là vivent sur la carte du thème, ils portent un geste et un
// verdict. Ici, rien à faire cette semaine, rien à mesurer : un mode d'emploi.
//
// CE BLOC RÉPARE UNE PROMESSE ÉCRITE. `components/reco-actions.tsx` dit depuis
// le début que « ◇ Trop compliqué » « remonte dans "Pour aller plus loin" la
// semaine suivante » — et « Pour aller plus loin » n'existait NULLE PART dans
// l'application, alors que le worker publiait déjà `themes_tips` dans chaque
// payload. Tuyau posé, jamais raccordé, documenté comme s'il coulait
// (`.scratch/refonte/issues/14-le-conseil-facile-et-la-degradation.md`).
// Le worker passe maintenant les conseils marqués trop compliqués au prompt, et
// ce bloc les affiche : la phrase est enfin vraie des deux côtés.
//
// REPLIÉ PAR DÉFAUT, ET SOUS LES THÈMES. « Ça se lit quand on a cinq minutes » :
// un savoir-faire qui s'ouvre tout seul prend la place de ce qui se décide
// aujourd'hui.

export type ThemeTips = { theme: string; tips: { titre: string; texte: string }[] };

export function PourAllerPlusLoin({ themes }: { themes: ThemeTips[] }) {
  const n = themes.reduce((total, t) => total + t.tips.length, 0);
  if (n === 0) return null;
  return (
    <details className="mb-8">
      <summary className="text-[14px] font-semibold text-ink cursor-pointer select-none mb-3">
        Pour aller plus loin ({n}){" "}
        <span className="text-faint font-normal">
          · le savoir-faire de fond, pas les chiffres de la semaine
        </span>
      </summary>
      <div className="grid gap-3 mt-2 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((t) => (
          <div
            key={t.theme}
            className="rounded-xl border border-line bg-white shadow-card px-4 py-3.5 min-w-0"
          >
            <div className="text-[10px] uppercase tracking-widest text-faint font-bold mb-2">
              {t.theme}
            </div>
            <ul className="space-y-2.5">
              {t.tips.map((tip) => (
                <li key={tip.titre} className="min-w-0">
                  <p className="text-[12.5px] font-semibold text-ink leading-snug">
                    {tip.titre}
                  </p>
                  <p className="text-[11.5px] text-muted leading-relaxed mt-0.5">
                    {tip.texte}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
