# Identité visuelle — la carte

## Destination

Une identité visuelle propre à Pulse, au standard actuel (Notion, Linear) :
légère, « papier », écrite, avec des icônes et des petits dessins qui font
pro. Demande de David du 2026-09-30.

## Notes

La référence est `docs/identite-visuelle.md`. La source des couleurs est
`saas/web/lib/couleurs.ts`.

## Decisions so far

- **01 — le socle** (résolu) : direction « le relevé » (papier millimétré,
  encre, surligneur), tokens, typographie, icônes, dessins, navigation,
  connexion, Connexions, Équipe, bandeaux de données manquantes.
  → `issues/01-le-socle.md`

- **2026-10-01 — la direction change**, sur retour de David : « le relevé »
  (Newsreader, millimétré) et trois variantes suisses (Grille, Registre,
  Affiche) n'ont pas convaincu. Retenue comme base : **le style
  d'extrafazant.nl** — titres mêlant une grotesque grasse condensée en
  capitales (Archivo, `wdth` 62–80, 800) et une serif fine étroite (Instrument
  Serif) ; fond `#f4f4f4`, encre `#101010`, un seul bleu `#0038ff` ; sections
  noires alternées ; papier par feuilles de couleur empilées et tirages
  inclinés ; chiffres héros très condensés. Graphiques **animés et
  interactifs** (barres qui montent et glissent d'un indicateur à l'autre,
  survol, courbes qui se tracent). Aperçu de référence :
  https://claude.ai/artifact/JJYLFUar1KiDfcAR9neRc2 (version 5). Le code de la
  branche porte encore « le relevé » : à reporter une fois la direction validée.

## Fog

- Le rapport (`app/page.tsx`) et les dashboards n'ont reçu que la cascade des
  tokens : leurs modules (verdict, boussole, frise) méritent un passage
  écran par écran une fois le retrait du thème commité (`issues/02`).
- Trouvé en chemin, hors design : `equipe-manager.tsx` décrit encore le rôle
  « Peut agir » par « coche les actions, reclasse les campagnes, choisit les
  priorités » — les actions sont parties le 2026-09-21. Texte à réécrire.
- Mode sombre : les tokens sont prêts à devenir des variables CSS, rien de
  plus n'est fait.
