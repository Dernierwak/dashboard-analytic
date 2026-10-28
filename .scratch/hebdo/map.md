# Carte — La page hebdomadaire

Label : `wayfinder:map`

## Destination

Une **spec de la page hebdo** (`/`), prête à remettre à la construction : ce
qu'elle montre, dans quel ordre, sous quelle forme, et ce que le traitement
doit calculer pour ça. On part de **ce qui existe déjà** et on le retravaille —
le design, la présentation et le choix des éléments sont le cœur du chantier.

## Notes

- **Ce que David garde, dans ses mots (2026-10-28)** :
  1. la semaine écoulée **face à la précédente**, avec les métriques de
     **toutes les sources** ;
  2. le repère « **c'est une bonne moyenne, c'est la moyenne de notre compte,
     on est sur une bonne lancée** » ;
  3. la vue rapide de **toutes les campagnes et tous les posts** — en cours,
     publiés, et **à venir** (« les posts en dessous pas forcément idéaux ») ;
  4. **les changements effectués cette semaine** ;
  5. peut-être **nos meilleurs X** — « la meilleure campagne, ce qui a le mieux
     fonctionné ».
- **La page est statique.** Pas de filtre, pas de bascule. Pour en savoir plus,
  on va sur la page de la plateforme (Meta, Google, Instagram).
- **Pulse ne conseille rien** (`CLAUDE.md` §1) : la page dit ce qui a bougé,
  jamais quoi faire. « Meilleur » se mesure, il ne se recommande pas.
- **Chaque plateforme se lit avec ses propres chiffres** (règle de l'ADR 0010,
  rappelée par `CLAUDE.md` §1) — vaut pour la comparaison comme pour « le
  meilleur ».
- **§7 s'applique partout** : aucun chiffre fabriqué, une absence n'est pas un
  zéro, le jour en cours est exclu de toute comparaison.
- Skills à appeler : `grilling` + `domain-modeling` pour les grillings,
  `prototype` pour la maquette ; l'agent `vision-ux` pour la hiérarchie et la
  forme, `vision-produit` pour juger ce qui mérite d'exister.
- Point de départ dans le code : `saas/web/app/page.tsx` (la page),
  `saas/data/supabase/processed_data/weekly_report/builder.py` (ce qu'elle lit).
- `BACKLOG.md`, `CONTEXT.md` et `docs/` ont quitté l'arbre (1b05a92, b97e807) ;
  ce qu'ils disaient du rapport reste dans l'historique git
  (`git show a909601:BACKLOG.md`).

## Tickets

Format : un fichier par ticket sous `issues/`, en-tête `Type / Status /
Blocked by`. Le frontier = `Status: open`, rien d'ouvert dans `Blocked by`.

| Ticket | Type | Bloqué par |
|---|---|---|
| [Ce qu'on inventorie avant de décider](issues/01-ce-qu-on-inventorie-avant-de-decider.md) | task (AFK) | — |
| [Les métriques de la semaine face à la précédente](issues/02-les-metriques-de-la-semaine-face-a-la-precedente.md) | grilling | — |
| [Ce que veut dire « la moyenne du compte »](issues/03-ce-que-veut-dire-la-moyenne-du-compte.md) | grilling | — |
| [La vue des campagnes et des posts](issues/04-la-vue-des-campagnes-et-des-posts.md) | grilling | — |
| [Les changements de la semaine](issues/05-les-changements-de-la-semaine.md) | grilling | — |
| [Le verdict et la boussole dans une page statique](issues/06-le-verdict-et-la-boussole-dans-une-page-statique.md) | grilling | — |
| [Le meilleur de la semaine](issues/07-le-meilleur-de-la-semaine.md) | grilling | Les métriques de la semaine… |
| [La page entière, en maquette](issues/08-la-page-entiere-en-maquette.md) | prototype | 02 à 07 |

## Decisions so far

<!-- une ligne par ticket clos : [titre](lien) : l'essentiel de la réponse -->

## Not yet specified

- **Ce que le traitement doit calculer de neuf.** Dépend de ce que les
  grillings retiennent : la spec finira par une liste « clé du payload → d'où
  elle vient », mais on ne peut pas l'écrire avant de savoir quoi montrer.
- **Les états de la page** : une source pas branchée, une source muette cette
  semaine, un compte de moins de deux semaines (rien à comparer), une semaine
  sans aucune campagne. Chaque bloc retenu en aura, ils se trancheront avec la
  maquette.
- **Le passage vers la page plateforme** : depuis quel bloc, vers quoi, avec
  quel contexte (la même semaine ?). Ça dépend des blocs.
- **L'identité visuelle** de la page — typographie, densité, ce qui « fait
  waouh » sans casser la lecture. À voir quand la maquette existera.

## Out of scope

- **L'email hebdo** — David : « on va l'ouvrir dans une autre section ».
- **Les filtres et les bascules** sur la page hebdo — elle est statique ; le
  détail vit sur les pages plateforme.
- **Le conseil** (« quoi faire cette semaine ») — retiré du produit le
  2026-09-21, ne revient pas par ce chantier.
- **Le thème et le regroupement** — partis le 2026-09-30, ne reviennent pas.
- **Les pages Meta / Google / Instagram** — elles ont leur propre chantier.
