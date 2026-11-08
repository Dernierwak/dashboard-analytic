# 15: La spec de la page Instagram

Type: task
Status: resolved
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
7. **Les bornes des bandes** comme l'hebdo : < q1 en dessous ; q1 ≤ v <
   médiane bas ; médiane ≤ v ≤ q3 haut ; > q3 au-dessus ; hors norme
   strictement au-delà des limites de Tukey ; quartiles exclusifs.
8. **Les stories sortent du chantier** : Out of Scope de la carte et de la
   spec, une ligne au `BACKLOG.md` ; la part `STORY` du compte reste comptée.
9. **Ce qu'on ne mesure pas s'écrit dans la spec**, § du même nom, au lieu de
   recréer `docs/mesures-impossibles.md`.
10. **La cohérence avec l'hebdo se règle par les mots** : l'onglet Organique
    reprend le vocabulaire de la spec ; la phrase de l'écart entre le dernier
    relevé et le rapport s'écrit au Panneau ; refaire l'hebdo va au
    `BACKLOG.md`.
11. **La spec part à la construction sans attendre le ticket du carré** : la
    Sélection = les 5 meilleurs de la période ; [Le carré de sélection, en
    maquette](12-le-carre-en-maquette.md) n'amendera que ce paragraphe.

## Résolution (2026-11-06)

`.scratch/instagram/spec.md`, **Status: ready-for-agent**. Écrite par un
agent à partir des tickets clos, contrôlée par Claude (liens, deux décisions
recoupées avec leur ticket, contradictions relues), puis complétée des onze
arbitrages ci-dessus. Tout `docs/` (ADR, mesures impossibles) a quitté
l'arbre au commit `1b05a92` : la spec renvoie à l'historique pour les ADR et
porte elle-même « Ce qu'on ne mesure pas ».
