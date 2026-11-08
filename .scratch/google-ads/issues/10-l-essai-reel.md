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
- le volume de lignes par niveau (mots-clés, éléments) sur 90 jours.

Lecture seule, jetable (branche `essai/` ou `$CLAUDE_JOB_DIR/tmp`), aucun
secret en sortie (§7). HITL si l'agent ne peut pas joindre l'API : checklist
précise pour David.

## Rendu attendu

Un tableau métrique × type « rendu / 0 / rejeté » confronté à la doc, et les
écarts qui changent une décision de la carte.
