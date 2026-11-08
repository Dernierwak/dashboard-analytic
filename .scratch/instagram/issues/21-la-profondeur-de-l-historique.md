# 21: La profondeur de l'historique des posts

Type: grilling
Status: resolved
Blocked by: —
Assignee: David (session Claude, 2026-11-06)

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

## Réponse (2026-11-06, grilling avec David)

**Pulse va chercher tout l'historique, et le relit tous les 3 mois.**

1. **Le rattrapage** : au premier passage d'un compte payant, la récolte lit
   **tous** les posts que Meta rend, du plus récent au plus ancien, par blocs
   — le passage quotidien de 07:00 en remonte un à chaque fois. La page se
   remplit à mesure : on n'attend pas la fin pour voir les premiers mois. La
   taille du bloc se fixe à l'essai, sur la durée mesurée d'un passage.
   Pourquoi tout et pas 12 mois : les appels Meta ne coûtent rien en argent,
   le quota (« 4800 × Number of Impressions » / 24 h, `sync.py:55`) est très
   loin, GitHub Actions est gratuit sur un dépôt public ; la seule charge est
   le stockage des images (plan Supabase gratuit : 1 Go — poids moyen d'une
   image **non mesuré**) et la durée, que les blocs bornent.
2. **La relecture ordinaire** : à chaque Jour de travail, les posts de **moins
   de 30 jours** (les 7 premiers jours restent relevés chaque jour par le
   passage léger, [Garder l'historique](05-garder-l-historique-d-un-post.md)).
3. **Le grand passage trimestriel** : tous les 3 mois, **tous** les posts en
   base sont relus — une seule règle, « tout », plutôt que « les 12 derniers
   mois » (David : « on ne se prend pas la tête »). Coût : 2 à 3 appels par
   post, sans image (`_dans_le_stockage`). 3 mois parce que la pastille
   « 3 mois » des moustaches lit ces posts.
4. **Chaque chiffre porte sa date** : le Tableau écrit la date du dernier
   relevé d'un post ; la page dit quand les posts de plus de 30 jours ont été
   remis à jour. Les posts de plus de 12 mois restent, rien ne s'efface ; leur
   place est l'affaire de
   [La place d'un post hors de l'année](20-la-place-d-un-post-hors-de-l-annee.md).
5. **La référence écrit ce qu'elle couvre** : pas d'état « en cours de
   chargement » ; la place se calcule toujours sur les posts chargés, et une
   ligne au-dessus des moustaches dit sur quoi elle porte — « référence : tes
   posts du 3 août au 5 novembre 2026 (42) » — jusqu'à ce que les 12 mois
   soient couverts. Le minimum de 6 posts par format reste la seule règle.
   Sans cette ligne, un mois chargé se ferait passer pour une année (§7).
6. **Le compte gratuit reste à 10 posts** pour l'instant (David) — reporté à
   [Le compte gratuit à 10 posts](18-le-compte-gratuit-a-10-posts.md).

Ce que ça change à
[Ce que la récolte et le traitement doivent calculer](14-ce-que-le-traitement-doit-calculer.md) :
`_a_relire` perd, pour le payant, son plafond de 200 posts et sa reprise
plafonnée à 40 ; la « relecture unique de tous les posts en base » (§2.5)
devient le premier grand passage, et son drapeau dédié de `weekly-fetch.yml`
sert aussi au trimestriel.
