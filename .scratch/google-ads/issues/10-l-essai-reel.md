# 10: L'essai réel des métriques Google

Type: task
Status: open
Blocked by: 01, 03
Assignee: —

## Question

La doc dit ce qui **devrait** être rendu ; **un vrai compte dit ce qui
l'est**. Sur les comptes réels (03), lancer les requêtes GAQL que la
recherche (01) a retenues, type par type, et noter :
- ce qui revient rempli, ce qui revient à 0, ce qui est rejeté ;
- les métriques vidéo et PMax sur de vraies campagnes ;
- le volume de lignes par niveau (mots-clés, éléments) sur 90 jours ;
- **conversions (ticket 05)** : que `metrics.conversions` retrouve la colonne
  « Conversions » de l'interface Google Ads et sa date (au clic — déduit, non
  écrit par Google) ; que `all_conversions` et `view_through_conversions`
  reviennent dans la même requête ; ce que rend `conversions_value` pour un
  compte **sans valeur configurée** — 0 ou vide (la page affiche « — »,
  jamais 0) ;
- _Non bloquant depuis la Comparaison (08) — sert l'analyse par type, au
  `BACKLOG.md`_ — **PMax et les audiences (ticket 07)** : David veut lire PMax par ses
  audiences. Vérifier si l'API rend une performance (impressions, coût,
  conversions) par audience ou signal d'audience pour une campagne PMax, ou
  seulement par groupe d'éléments, par réseau et en « insights » ; noter ce
  qui revient et à quel grain ;
- **Display et les emplacements (ticket 07)** : ce que rendent
  `group_placement_view` / `detail_placement_view` (sites, trafic) ;
- qu'un taux calculé sur les totaux (clics ÷ impressions, coût ÷ clics…) sur
  une campagne et une période retrouve celui de l'interface Google Ads.

Lecture seule, jetable (branche `essai/` ou `$CLAUDE_JOB_DIR/tmp`), aucun
secret en sortie (§7). HITL si l'agent ne peut pas joindre l'API : checklist
précise pour David.

## Rendu attendu

Un tableau métrique × type « rendu / 0 / rejeté » confronté à la doc, et les
écarts qui changent une décision de la carte.
