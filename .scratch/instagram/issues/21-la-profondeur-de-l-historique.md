# 21: La profondeur de l'historique des posts

Type: grilling
Status: open
Blocked by: —
Assignee: —

## Question

La page promet au Tableau **« tout ton historique »**
([La page entière, en maquette](13-la-page-entiere-en-maquette.md)). La sonde
de [Ce que la récolte et le traitement doivent calculer](14-ce-que-le-traitement-doit-calculer.md)
(2026-11-06) montre que la base en porte **233 posts sur 1 839** pour la page
suivie : la récolte ne lit jamais au-delà des 200 derniers posts en payant, 10
en gratuit (`sync.py:_a_relire`, `limite`), et seuls ceux des 30 derniers
jours sont relus, 40 au plus.

**Combien d'historique Pulse va-t-il chercher, et à quelle fréquence le
relit-il ?**

- garder 200 posts et l'écrire au Tableau (« tes 200 derniers posts »), ou
  aller chercher tout l'historique une fois (≈ 1 839 × 3 appels, durée d'un
  passage inconnue) ;
- relire un vieux post à chaque passage — David attend que « toutes les
  données soient mises à jour à chaque fois » (2026-11-03) — ou le figer
  passé J+30 et l'écrire ;
- la référence des 12 mois glissants a-t-elle besoin de plus que 200 posts
  sur un compte qui publie beaucoup ?

Absorbe la zone « Relire tous les posts à chaque passage ? » du Not yet
specified de la carte. Touche à l'offre (gratuit / payant), pas seulement à
l'écran : à confronter au coût en appels et en durée de passage.
