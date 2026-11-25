# 05: La place de la story dans la page

Type: grilling
Status: resolved
Blocked by: 03, 04
Assignee: —

## Question

Les stories vivent **dans** `/instagram` (David, 2026-11-25). Module par
module de la spec (`.scratch/instagram/spec.md`), que devient une journée de
stories ?

1. **« Tes posts face à ton année »** : une rangée **Story** en dernier, après
   Vidéo du fil ? Un point du nuage = une journée ?
2. **Les 5 meilleurs** et **le Tableau** : une ligne par journée, dépliable
   en ses stories ? Ou les journées à part des posts, sous un interrupteur ?
3. **Le Panneau** d'une journée : la séquence des images dans l'ordre, les
   chiffres de chacune, la navigation ?
4. **L'export `.csv`** : une ligne par journée, par story, ou les deux ?
5. **Les chiffres relevés à 22-23 h** et ceux du webhook n'ont pas le même
   âge : l'écran le dit-il (« relevé à 22 h de vie »), et que montre une story
   dont le webhook n'est jamais arrivé ?

Agent `vision-ux` pour l'ordre et la forme ; une maquette (`prototype`) si la
réponse ne se voit pas en mots.

## Answer

Tranché par Claude le 2026-11-25, sur délégation de David.

1. **« Tes posts face à ton année »** : une rangée **Story**, la dernière ;
   un point du nuage = une journée complète.
2. **Les 5 meilleurs** comptent les journées comme les posts, libellées
   « Stories du 24 nov. · 5 stories ». **Le Tableau** : une ligne par
   journée, format « Story », le nombre de stories, cliquable vers le
   Panneau.
3. **Le Panneau d'une journée** : les vignettes dans l'ordre de publication,
   puis par story ses chiffres (portée, vues, clics, navigation ventilée) et
   « relevé à 22 h de vie » ; en tête, les sommes de la journée et la portée
   du compte ce jour-là. Les vidéos se montrent par leur vignette (Pulse ne
   garde pas les vidéos).
4. **L'export `.csv`** : une ligne par journée, comme le Tableau.
5. **Une story jamais relue** (job raté pendant toute sa fenêtre) : vignette
   gardée, chiffres « – » avec la raison « Pulse n'a pas pu relire cette story
   avant sa disparition ».
