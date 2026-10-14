# 04: La langue des valeurs

Type: grilling
Status: resolved

## Question

Meta écrit les libellés (« Actif », « Vues de page de destination ») dans la
langue de l'utilisateur du jeton. Pulse les traduit-il ?

## Answer

Non. David, 2026-10-11 : on affiche ce que Meta envoie, dans la langue où il
l'envoie ; aucune traduction dans l'application. La **logique** (ranger,
regrouper, décider) ne lit jamais un libellé : elle lit le code chiffré
(`run_status`) ou le type d'événement. Ainsi aucune ligne n'est jetée parce
qu'elle est en français. Un code Meta brut (`LOWEST_COST_BID_STRATEGY`)
s'affiche tel quel — à confirmer sur le prototype (ticket 10).
