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

## Comments

**2026-10-11 — rouvert en partie par le retour sur le prototype (ticket 10).**
David veut voir au-dessus de chaque changement **ce qui a changé** (« l'âge
est maintenant 65 »), ce qui suppose de comparer avant et après. Le prototype
le fait sous la forme la plus simple : rubrique par rubrique, **texte contre
texte** — Meta envoie déjà des textes des deux côtés pour le ciblage, la créa,
l'objectif et le calendrier ; aucun montant ni nombre n'est comparé. Aucune
ligne n'est cachée : une modification sans différence affiche « avant et
après sont identiques selon Meta ». À confirmer par David avant la
construction.
