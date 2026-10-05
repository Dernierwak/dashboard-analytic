# 24: La courbe, la tuile et l'écart tracent un taux absent à zéro

Type: task
Status: resolved
Blocked by: —

**Trouvé en chemin** du ticket 22 (pas demandé, donc un ticket — `CLAUDE.md` §4.4).

Le 22 a fait passer à `null` le CTR, le CPC et le CPM non calculables de
`buildDash` (`saas/web/lib/channels.ts`) : tuiles et table Google affichent « — ».
Quatre endroits recalculent encore le taux eux-mêmes et retombent sur `0` quand
le dénominateur est nul :

- `MetricChart` (`components/channel-dash.tsx`, `val`) — un jour sans impression
  devient une barre CTR à 0 et tire la moyenne et la pente vers le bas.
- La mini-série de la tuile « CTR moyen » (`serie=` dans `AdsKpis`).
- `METRIQUES_ECART.ctr` / `.cpc` (`components/channel-dash.tsx`) — c'est la
  RÉFÉRENCE (la période d'avant) sans impression qui tombe à 0 : une campagne
  qui a un CTR aujourd'hui reçoit un écart chiffré contre un taux qui n'existait
  pas. La ligne courante, elle, est déjà filtrée par le 22.
- La comparaison (`batirComparaison`, métriques `ctr`/`cpc` dans `buildDash`) —
  `MetriqueCompare.courant` est un `number`, la fenêtre sans impression compare 0.

Le module d'écart (`components/ecart.tsx`) et `MetriqueCompare` sont partagés
avec Instagram : leur faire accepter `null` touche les trois canaux.

- [x] Chacun de ces quatre endroits écrit « — » ou saute le point, jamais 0
- [x] `tsc` et build verts, 18 routes

## Réponse

Les quatre endroits passent par `taux()` (`lib/channels.ts`) et rendent `null`
au lieu de 0 :

- **Courbe** (`MetricChart`) : elle dérive maintenant de `METRIQUES_ECART`, la
  même source que l'écart. Un jour sans impression est sauté.
  - Le chiffre d'en-tête d'un taux est le taux des **totaux** de la période, et
    non plus une moyenne de taux journaliers (règle déjà écrite dans
    `ecart.tsx`). **Le chiffre affiché change donc.**
  - La pente se calcule sur les totaux de chaque moitié. Quand elle ne se
    calcule pas, on lit « pente non calculable » avec sa raison, au lieu de
    « ≈ stable ». Cela vaut aussi pour une dépense nulle en première moitié.
  - Une période sans aucun jour mesuré affiche une phrase au lieu d'un axe
    gradué sur une échelle inventée. Le « max … / jour » disparaît alors.
- **Tuile « CTR moyen »** : sa mini-série porte des `null`, que `Chiffre` gère
  déjà (ticket 48).
- **Écart des tables** : `MetriqueEcart.valeur` peut rendre `null`. Une
  référence sans dénominateur donne le nouveau genre `sansTaux`, écrit « pas de
  CTR sur la réf. » ; la cellule et la phrase de pied disent pourquoi. Ces
  lignes ferment le tri, comme les naissances.
- **Comparaison** : `MetriqueCompare.courant` et `.reference` sont
  `number | null`. Le CTR, le CPC et l'engagement Instagram passent par
  `taux()`. Aucun écran ne lit `metriques` aujourd'hui : c'est le type qui est
  corrigé.

À côté : la bulle de `LineChart` n'écrit plus « — % ».

Vérifié :

- `tsc` et `npm run build` sont verts, avec 18 routes.
- Un harnais hors arbre (sucrase + `renderToStaticMarkup`) a passé 8 contrôles :
  référence sans impression → `sansTaux` ; tri des disparues ; CTR des totaux
  6/200 = 3.00 ; CPC 20/6 = 3.33 ; pente non calculable ; période vide → « — »
  sans axe ni « — % ».

Rien ne dépend du worker : la correction se voit au prochain déploiement Vercel.

Trouvé en chemin :

- 25 : l'engagement d'une publication sans portée vaut 0.
- 26 : la courbe enjambe un jour sans mesure.
