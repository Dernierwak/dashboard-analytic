# 01 — Le socle de l'identité visuelle

Type: task
Status: resolved

## Question

Mettre Pulse au standard visuel actuel : couleurs, espacements, icônes, petits
dessins, un côté papier et écrit — sans casser l'existant.

## Answer

Posé sur la branche `worktree-design-identite`, limité aux fichiers que le
chantier « retrait du thème » (non commité dans le checkout principal le
2026-09-30) ne touche pas :

- `lib/couleurs.ts` (nouveau), `tailwind.config.ts`, `app/globals.css`,
  `app/layout.tsx` — palette « relevé », Instrument Sans / Newsreader / Caveat,
  papier millimétré, chiffres tabulaires, surligneur, focus visible,
  `prefers-reduced-motion`.
- `components/icones.tsx`, `components/illustrations.tsx`, `components/logo.tsx`
  (nouveaux).
- `side-nav.tsx` — icônes, onglet actif en feuille levée, pied avatar +
  sortie, entrée « Thèmes » retirée.
- `app/login/page.tsx`, `app/comptes/page.tsx`, `app/equipe/page.tsx`.
- `canal-muet.tsx`, `trou-recolte.tsx` — bandeau illustré, lien renommé
  « Reconnecter dans Connexions », phrase « aucun conseil » retirée.
- `chiffre`, `line-chart`, `bar-chart`, `kpi-focus`, `etat-action`,
  `suivi-recolte`, `palette.ts` — couleurs lues dans `lib/couleurs.ts`.
- 22 étiquettes en capitales espacées passées en casse de phrase.

Vérifié : `tsc --noEmit` et `npm run build` verts ; rendu contrôlé dans Chrome
sur le rapport et `/login`.
