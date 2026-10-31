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

## Première réaction de David (2026-10-31) → variante D

Devant A, B et C :

- **Les totaux en avant**, avec leur répartition par canal. L'idée de la
  barre de B est bonne, mais elle doit être mieux faite.
- **Les changements en haut à droite, à côté des totaux** (B) : « pas que
  ce soit encore un truc en dessous ».
- **Le module des canaux juste dessous, en rail** qu'on fait glisser à
  gauche et à droite, une carte par canal (Meta, Google…).
- **La moustache** de A sur chaque ratio : « en graphique visuel où on se
  trouve actuellement, c'est quoi un peu les meilleurs, pour les 12
  dernières semaines ».
- **La frise** est bien placée, mais elle n'est « pas assez jolie ».
- **Les posts ne vont pas dans la frise** : « des petits stickers en bas ».
  Ce module compte le plus pour David : « je vois ce que j'ai fait la
  semaine passée ». Quelqu'un d'autre doit pouvoir naviguer d'une semaine à
  l'autre et voir à quoi ressemblent les posts et les campagnes, pas « une
  ligne avec un nom ». Les petits visuels sur les barres de campagne lui
  plaisent.

La **variante D** assemble ces retours (`?variant=D`) :

- les totaux en grand, avec une barre de répartition et une légende
  chiffrée ;
- les changements à droite ;
- un rail des canaux, où la carte Google est calculée sur ses vrais
  chiffres, en aperçu, puisque Google n'est pas encore au module ;
- une moustache par ratio : les moustaches vont de la moins bonne à la
  meilleure semaine, la boîte marque « tes habitudes », le trait la semaine
  type, le point la semaine regardée ;
- **« Ce qui a été fait »** : une frise de l'année redessinée, avec le
  rythme des posts sous les mois, les barres arrondies, l'avancement et le
  visuel en tête. Elle sert de navigateur : un clic choisit une semaine, et
  ‹ › passe à la voisine. Dessous, la semaine choisie s'affiche en grand :
  les posts en cartes 4:5 (format, date, légende, aucun chiffre), puis les
  campagnes actives en cartes, avec leur mosaïque de visuels, l'avancement,
  « lancée / terminée cette semaine » et la dépense de la semaine au survol.

## Deuxième réaction de David (2026-10-31) → D1, D2, D3

Devant D :

- **On garde D, et on supprime A, B et C.** David veut trois nouvelles
  propositions, **plus simples**.
- **Les totaux** : l'idée de la répartition est bonne, mais la barre
  séparée ne plaît pas. Il faut chercher une autre forme.
- **La semaine choisie, avec ses visuels, s'affiche à droite de la frise**,
  pas dessous, « pour qu'on ait un truc un peu plus clean ». Changer de
  semaine lui plaît. En zoom Mois, « tu vois tout ce qui s'est passé ».

Les trois propositions (`?variant=D1|D2|D3`) gardent la même charpente :
totaux et changements en haut, rail des canaux avec moustaches, puis la
frise à gauche et le panneau de la semaine à droite, collant. Elles
diffèrent ainsi :

- **D1 · Les chiffres** : les totaux sans aucun graphique (le grand
  chiffre, puis une ligne par canal avec sa part) ; à droite, les posts en
  grandes cartes empilées, puis les campagnes en liste avec leur vignette ;
  la frise s'ouvre sur l'année.
- **D2 · L'anneau** : un anneau par total ; à droite, deux onglets, Posts et
  Campagnes, en grille de deux colonnes ; la frise s'ouvre sur le mois.
- **D3 · Le tableau** : les totaux en tableau canal × total ; à droite, la
  mosaïque des posts, puis les campagnes à visuels en bandeau et les autres
  en pastilles ; la frise s'ouvre sur le mois.

En zoom Mois, la frise ne garde que les campagnes actives à six semaines
près de la semaine choisie : sinon le mois se lit entre des rangées vides.

## Troisième réaction de David (2026-10-31) → E, D2 corrigée

David retient D2 (« une base qui est plutôt clean ») et demande :

- **Les totaux en haut**, mais plus jolis.
- **Un canal par écran**, avec le suivant qui dépasse d'environ 10 % « pour
  se dire, ah, mais ok, on peut slider ».
- **Les changements dans la carte de leur canal**, regroupés **par
  catégorie**, et non plus dans un bloc à part.
- **La moustache plus jolie** : « il manque un peu de vision, tout est un
  peu regroupé ».
- **Le panneau de la semaine séparé par source** : Organique · Instagram (et
  les suivantes), Campagnes · Meta, Campagnes · Google Ads.
- Les couleurs ne lui plaisent pas, mais ce n'est pas le sujet pour l'instant.

**E** (`?variant=E`, seule version restante) :

- les totaux en bandeau de trois colonnes (dépense, impressions, portée)
  séparées par un filet, le grand chiffre puis les canaux en petit ;
- la carte d'un canal à 90 % de la largeur, avec les chiffres et les
  moustaches à gauche, les changements par catégorie à droite ;
- une moustache trois fois plus large, les 12 semaines en points, la
  semaine type nommée au-dessus, **le mieux toujours à droite** (un CPC
  plus bas se lit vers la droite) ;
- le panneau en onglets groupés par source.

En attente : la suite, que David annonce une fois ces corrections faites.
