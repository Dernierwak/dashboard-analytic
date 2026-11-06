# 15: La spec de la page Instagram

Type: task
Status: open
Blocked by: —
Assignee: David (session Claude, 2026-11-06)

## Question

Écrire `.scratch/instagram/spec.md` à partir des tickets clos, sans rien y
inventer : chaque décision renvoie à son ticket. Même forme que la spec Meta
Ads (`git show 1b05a92^:.scratch/meta-ads/spec.md`) : Problem Statement,
Solution en modules nommés, User Stories, ce que la récolte et le traitement
calculent, Notes sur les choix tranchés par défaut. C'est la destination de la
carte.

## Arbitrages de David (2026-11-06)

Les points que la spec laissait ouverts, tranchés un par un ; la spec les
cite sous « arbitrage du 2026-11-06 ».

1. **Le taux d'engagement compte les partages** : (j'aime + commentaires +
   enregistrements + partages) ÷ portée. L'ADR 0008 (retirée de l'arbre au
   commit `1b05a92`) reprenait la formule en place quand les partages
   n'étaient pas récoltés ; le chiffre affiché bouge, et la spec le dit.
2. **La Tendance affiche la portée du compte sur la période**, le
   `total_value` d'Instagram (chaque compte une fois), à côté de la période
   d'avant — jamais la somme des jours.
3. **À l'ouverture** : Objectif Engagement (le taux) ; Portée → la portée ;
   Abonnés → abonnés pour 1 000 comptes touchés ; interrupteur sur Tout ;
   Tableau par date décroissante ; période comme Meta (les 7 jours qui
   finissent la veille du dernier Jour de travail).
4. **Le temps de visionnage moyen du Reel** est récolté (`REELS` seulement),
   affiché au Panneau et au Tableau, « – » ailleurs ; vérifié au premier
   passage, grisé avec sa raison s'il ne revient pas.
5. **Un format sans post** : aucun post sur les 12 mois → pas de rangée ;
   des posts dans l'année mais aucun sur la période → la rangée garde sa
   bande, « aucun post sur la période » à la place du nuage.
6. **Post type des 12 mois à 0** : la pastille écrit l'écart en valeur
   (« 3 mois : 2 abonnés de plus · 15 posts »), jamais un %.
