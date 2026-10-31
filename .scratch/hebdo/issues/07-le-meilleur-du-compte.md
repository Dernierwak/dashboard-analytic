# 07: Le meilleur du compte

Type: prototype
Status: claimed
Assignee: Dernierwak (session 2026-10-31)
Blocked by: —

## Question

David : « pourquoi pas mettre nos meilleurs X, la meilleure campagne, ce qui a
le mieux fonctionné ». **Meilleur selon quoi, et quand ne peut-on pas le dire ?**

Recadré au ticket 01 (2026-10-28) : ce n'est plus le meilleur **de la
semaine**, c'est le meilleur **du compte** — un repère, « voilà ce qu'on a fait
de mieux », auquel la semaine se mesure. Il couvre **la meilleure campagne Meta
et les meilleurs posts Instagram** dès maintenant (les posts ont leurs données
sur `/instagram`). David a demandé d'être challengé ; trois risques posés :

1. **un CTR flatteur sur une petite dépense** gagne si rien ne l'empêche — il
   faut un volume minimum ;
2. **des objectifs différents** (notoriété, trafic) ne se départagent pas ;
3. **depuis toujours ou sur l'année ?** un record vieux de deux ans peut
   devenir un repère qui ne dit plus rien.

Passé en prototype à la clôture du ticket 01 : David le juge « très
pertinent », mais rien d'existant ne le montre — « il faudra qu'on le fasse
pour voir si c'est faisable ou pas ». Le construire sur les **vraies données**
d'un compte, et trancher les trois risques en le regardant.

À trancher :

- le critère par plateforme (ROAS, coût par résultat, engagement d'un post…),
  pris dans les métriques retenues au ticket 02 ;
- comparer des campagnes d'objectifs différents (notoriété contre conversion)
  ne veut rien dire : classe-t-on par objectif, ou pas du tout ?
- le seuil sous lequel une campagne n'est pas classable (dépense trop faible,
  trop peu de jours) — mesuré, pas invoqué de mémoire ;
- un, trois, cinq ? et le pire aussi, ou jamais ?
- la phrase reste un constat (« la plus rentable cette semaine »), jamais une
  consigne (« augmente son budget »).

## Prototype (2026-10-31)

`.scratch/hebdo/prototype-07/index.html` — double-cliquer. Les chiffres vivent
dans `donnees.local.js`, ignoré par git (dépôt public) ; le recréer avec
`python3.12 -I extraire.py <.env du worker> <user_id>`. Compte mesuré : celui
dont les campagnes portent `campaign_id` et `results` (l'autre compte de test
a les mêmes campagnes sans ID — rejeu jamais fait).

Ce que les vraies données ont montré :

- **Objectifs** : le compte ne fait presque que du trafic (vue de page de
  destination) ; une campagne vise des visites de profil. L'indicateur change
  **dans** une campagne (clic sur le lien puis vue de page) : le « même
  objectif » se juge par indicateur, pas par campagne. Une ligne Meta porte
  un seul indicateur, donc le coût par résultat d'un indicateur est exact.
- **Risque 1, réel** : année civile, coût par résultat, sans seuil → gagne
  une campagne 2025 à 0,00 CHF, 0 CHF dépensé ce jour-là, des résultats
  attribués. Au CTR sur 12 mois sans seuil, le « pire » est une campagne à
  1 CHF. Le coût par vue de page des campagnes courtes se stabilise à ±15 %
  entre 73 et 590 CHF dépensés ; les longues dérivent (changement de régime).
- **Risque 3, réel** : la portée Instagram n'est cohérente qu'à partir de
  septembre 2024 (avant : engagement médian > 80 %, jusqu'à 211 %).
  L'engagement médian est passé de ~12 % (fin 2024) à 3–4 % (2026). Écarter
  l'impossible (> 100 %) ne suffit pas ; la fenêtre de 12 mois, si.
- **Post jeune** : portée médiane 3 376 sous 7 jours, 18 241 entre 14 et
  29 jours ; aux abonnés gagnés sans âge minimum, le « pire » est un post de
  3 jours.

Règle proposée dans le prototype, **à trancher par David** : 12 mois
glissants ; Meta au coût par résultat d'un même indicateur, 300 CHF et
7 jours minimum ; Instagram à la portée, posts de 14 jours et plus ;
trois, sans le pire ; moins de deux candidats → pas de « meilleur », on dit
pourquoi.
