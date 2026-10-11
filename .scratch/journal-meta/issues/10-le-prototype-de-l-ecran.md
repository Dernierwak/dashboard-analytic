# 10: Le prototype de l'écran

Type: prototype
Status: claimed

## Question

À quoi ressemblent le panneau détaillé, l'accès à tous les changements et le
filtre par groupe d'annonces ? En particulier :
1. le rangement du panneau : par élément (campagne › groupe › annonce) ou fil
   horaire ;
2. l'accès à tous les changements : bouton dans la barre de filtres, ou onglet
   sur le bord gauche ;
3. le statut regroupé, lisible ou non ;
4. un code Meta brut (`LOWEST_COST_BID_STRATEGY`) affiché tel quel ;
5. les modifications sans différence affichées avant/après.

## Asset

Prototype (privé, journal réel, courbes fictives, variantes A/B/C dans la
barre du bas) : https://claude.ai/artifact/LKiuzG9Sa2pd7LGfu9HWQu

Proposé par Claude : filtre « Groupe d'annonces » à côté de « Campagne », qui
filtre toute la page ; bouton « Changements · N » qui ouvre le même panneau
avec tous les changements de la période, filtrés comme la page ; les points
restent un raccourci vers un jour.

## Comments

**2026-10-11 — retour de David sur la version 1.**
- **Rangement : A** (par élément, le trait qui montre où l'on est : groupe
  d'annonces ou annonce). Le fil horaire (B) est écarté.
- **Plus de bouton dans la barre de filtres, ni d'onglet à gauche** : un
  **onglet sur le bord droit**, plus soigné, avec le nombre de changements,
  qui ouvre le panneau et reste visible accroché à lui. D'autres onglets s'y
  ajouteront — par exemple les **aperçus des annonces** (visuel, texte).
- **Au-dessus de chaque changement, seulement ce qui a changé**, le détail
  complet en dessous. Deux écritures du résumé à essayer : ancien → nouveau,
  ou seulement la nouvelle valeur.

**Version 2 publiée** (même lien) : onglets « Changements » et « Aperçus » à
droite ; le résumé en variante 1 / 2 dans la barre du bas ; un seul exemple
fictif (âge 50-65+ → 55-65+, 27 août, groupe allemand), marqué comme tel.
**2026-10-11 — retour de David sur la version 2.**
- Les heures ne se suivaient pas dans l'ordre (lignes dans l'ordre d'arrivée).
- Le résumé s'appelle **« Actuel : »** et ne montre **que ce qui a changé**,
  avec sa nouvelle valeur (« Âge : 55 - 65+ ») ; le dépliant montre **avant et
  après de toutes les rubriques**, même celles qui n'ont pas bougé.
- Le calendrier « Début : … → … » ne se comprenait pas d'un coup d'œil.
- Campagne et groupe d'annonces **dépliables**, plus d'espace, une vraie
  séparation entre groupes ; le trait de gauche pourrait finir par un « – »
  coloré.

**Version 3 publiée** (même lien) : tri par heure partout ; « Actuel » + un
tableau rubrique | avant | après, ligne changée surlignée ; calendrier en
« Début de diffusion » / « Fin de diffusion » ; trois présentations à
comparer : 1 tiroirs fermés, 2 cartes, 3 trait de la couleur de la campagne
terminé par « – ».

**2026-10-11 — retour de David sur la version 3.** Le tableau avant/après au
fond léger est retenu (« on voit rapidement la différence »). Les dépliants
sont trop discrets. Sur la Comparaison, on vise mal la bonne annonce. Cause
trouvée : deux éléments changés le même jour posent deux zones de clic
exactement superposées — la dernière dessinée gagne. À corriger dans le vrai
`components/courbe.tsx`, quelle que soit la variante retenue.

**Version 4 publiée** : dépliants agrandis (pastille ronde, survol), « Voir
avant / après » en bouton ; trois façons de viser, dans la barre du bas :
A un clic sur le jour, puis une liste « quel élément ? » ; B les points
empilés dans une rangée au-dessus du graphique ; C l'élément choisi d'abord
dans la légende, sa ligne mise en avant.

**2026-10-11 — retour de David sur la version 4.**
- **Panneau** : revenir aux traits (on doit voir que l'annonce est sous son
  groupe, le groupe sous sa campagne) ; seulement une flèche de dépliant plus
  grande et plus simple. Les présentations 1 et 2 sont écartées.
- **Avant / après en tout petit** sous le résumé « Actuel » ; fond coloré léger
  sur les seules lignes qui ont changé (toutes si tout a changé).
- **Comparaison** : A (liste au clic) écarté, double clic pénible ; B (rangée
  au-dessus) écarté. Retenu, l'esprit de C : les points se voient toujours ;
  un clic sur la **ligne** la met en avant ; ses points ne se cliquent
  qu'ensuite. Cela doit se comprendre **sans rien lire**.

**Version 5 publiée** : traits de la couleur de la campagne terminés par
« – », tout ouvert, flèche agrandie ; « avant / après » en petit lien, tableau
en 12 px. Comparaison : points creux (anneaux) tant que rien n'est choisi —
un clic les met en avant, n'ouvre rien ; survol d'une ligne = elle
s'épaissit, les autres pâlissent ; ligne choisie = épaisse, les autres
effacées, ses points pleins, plus gros, avec un halo qui pulse, seuls à ouvrir
le panneau ; une pastille « ● nom · mise en avant ✕ » au-dessus.

**2026-10-11 — retour de David sur la version 5.** La sélection et le halo
qui pulse sont retenus (« beaucoup plus clair »). À retirer : la légende
cliquable et la pastille « mise en avant » (« ça rajoute trop »). À ajouter :
au survol, juste le nom ; un clic à côté relâche la ligne, un nouveau clic
sur elle aussi ; un clic sur une autre ligne relâche, il ne bascule pas. Dans
le panneau, sous le nom de l'élément : **le statut d'abord**, puis les
modifications (« Actuel »), puis le petit avant / après.

**Version 6 publiée** : légende simple (les autres s'estompent quand une
ligne est choisie), bulle avec le nom au survol, désélection au clic à côté,
statut en tête de chaque élément. En attente du retour de David.
