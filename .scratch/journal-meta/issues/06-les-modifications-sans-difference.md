# 06: Les modifications sans différence

Type: grilling
Status: resolved

## Question

Meta envoie des « ciblage modifié » identiques avant et après, et des créas
« modifiées » où seul l'ID interne change. Les filtre-t-on ?

## Answer

Non. David, 2026-10-11 : on ne filtre que si Meta donne un champ qui dit
« rien n'a changé » — il n'en donne aucun. Comparer champ par champ (textes,
montants, listes) ajouterait une pièce fragile. Ces lignes s'affichent telles
que Meta les envoie, avant et après.
