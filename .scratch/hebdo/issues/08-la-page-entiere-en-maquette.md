# 08: La page entière, en maquette

Type: prototype
Status: open — prototype prêt, en attente de la réaction de David (2026-10-31)
Blocked by: 10, 11 — jugés dans la même maquette

## Question

**Dans quel ordre et sous quelle forme** les blocs retenus se lisent-ils sur une
seule page statique ? Une maquette jetable (HTML ou composant, données d'un vrai
compte ou d'un faux lecteur) à laquelle David réagit — avec l'agent `vision-ux`
pour la hiérarchie.

À trancher en réagissant :

- ce que le client voit avant le premier scroll ;
- l'ordre des blocs et ce qui se tait quand un bloc n'a rien ;
- la forme de chaque bloc (chiffres, courbe, frise, liste).

Charpente de départ (ticket 01) : titre et totaux → module des canaux →
campagnes et posts sur l'année ; changements selon le ticket 05. Le
meilleur du compte est retiré (ticket 07, 2026-10-31).

La spec de la page s'écrit à la clôture de ce ticket.

## Prototype (2026-10-31)

Pris en charge le 2026-10-31 alors que 10 et 11 étaient encore ouverts :
une maquette de la page entière contient forcément une carte de canal et une
frise, donc **les questions de [La boussole et le haut de page](10-le-haut-de-page-en-maquette.md)
et de [La frise](11-la-frise-en-maquette.md) se jugent ici aussi**. S'ils
sont tranchés devant cette maquette, ils se ferment avec elle. Ce qui n'y est
pas : la comparaison avec l'actuel `Verdict` / `KpiFocusCard` (ticket 10).

`.scratch/hebdo/prototype-08/index.html`. Pour la lancer :
`python3.12 -m http.server 8765 --directory .scratch/hebdo/prototype-08`, puis
<http://127.0.0.1:8765/?variant=A>. Les flèches ← → passent d'une variante à
l'autre. Les chiffres vivent dans `donnees.local.js`, ignoré par git ; on le
recrée avec
`python3.12 -I extraire.py <.env du worker> <début du user_id>` (compte
`11043e9a`, le seul qui a Meta avec ID, Google, Instagram et le journal).

Trois variantes, mêmes chiffres, structures différentes :

- **A · Le fil** : une colonne lue de haut en bas. Totaux → carte Meta avec
  jauge (les 12 semaines en tirets, la bande « tes habitudes », la médiane, la
  semaine en point) → changements → frise. Dans la frise, les campagnes de
  toutes plateformes sont mêlées, sans couleur (le statut s'écrit), avec
  leurs visuels au début de la barre ; les posts Instagram sont en vignettes
  sur le **même axe** de dates.
- **B · Le tableau de bord** : tout le chiffré avant le pli, en tuiles. Les
  changements sont en colonne collante à droite. Les campagnes sont séparées
  par plateforme, en couleur de plateforme ; les posts sortent de l'axe, en
  **mur par mois** (la semaine mesurée est entourée).
- **C · La semaine au centre** : pas de cartes. Les totaux tiennent en une
  phrase, Meta en tableau (cette semaine · semaine type · tes habitudes). Puis
  les **sept jours** côte à côte : débuts, fins, changements et posts de
  chaque jour. L'année vient dessous, en couleur de statut, sans visuels de
  campagne.

À trancher en réagissant : ce qu'on voit avant le premier scroll, l'ordre des
blocs, la forme de chaque bloc, et les questions de 10 et 11 (forme de la
carte, des totaux, séparation, visuels, couleur, statut).

Ce que les vraies données ont montré (semaine du mercredi 21 au mardi
27 octobre, Jour de travail : mercredi) :

- **La portée organique ne s'écrit pas.** Aucune table ne garde la portée du
  compte par semaine, seulement celle de chaque post
  (`instagram_organic_posts.reach`), et des portées de posts ne s'additionnent
  pas (§7). La case vaut « — » avec sa raison. **À ajouter à la spec** :
  récolter la portée du compte à la semaine (insights de compte Instagram),
  ou retirer la case.
- **Les visuels de campagne tiennent mal.** En 2026 : 11 campagnes Meta,
  86 annonces, toutes avec leur créa en base, mais 33 seulement ont une image
  ou une vignette. 3 campagnes sur 10 en montrent une. Google n'en a
  aucune (Search, PMax). Un visuel par campagne ne peut donc pas être la règle.
- **La frise de l'année est longue** : 42 campagnes (10 Meta, 32 Google) et
  103 posts. En zoom Année, les posts s'empilent ; en zoom Mois, il faut les
  noms collants.
- **Le statut ne se déduit pas de la dernière dépense** : une campagne Google
  sans fin déclarée a sa dernière dépense la veille du Jour de travail. Seule
  une fin **déclarée** et passée la rend « terminée ». `WITH_ISSUES` (deux
  campagnes Meta terminées) n'entre dans aucun des quatre statuts du ticket 04.
- **Le changement sans campagne existe** (niveau compte ou ensemble) : la
  ligne « Hors campagne » doit avoir un nom dans la spec.
- **Les ratios montrent les trois états** sur cette semaine : CTR et CPC dans
  les habitudes, CPM en dessous (mieux).
