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
terminé par « – ». En attente du retour de David.
