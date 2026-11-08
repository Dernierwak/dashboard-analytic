# 18: Le compte gratuit à 10 posts

Type: grilling
Status: resolved
Blocked by: —
Assignee: David (session Claude, 2026-11-06)

## Question

Un compte gratuit ne relit que ses **10 derniers posts**
(`saas/data/fetch_data/sources/meta/instagram/sync.py:_a_relire`). Répartis
sur trois formats, cela fait environ trois posts par moustache : la
Comparaison par format ([La structure de la page](01-la-structure-de-la-page.md))
n'y a pas de sens. **Que voit un compte gratuit sur la page `/instagram` ?**

- une moustache unique tous formats confondus, ou aucune ;
- la Comparaison remplacée par une phrase qui dit pourquoi (§7 : ce qu'on ne
  peut pas comparer, on écrit pourquoi) ;
- la Sélection et le Tableau seuls ;
- ou une autre limite de relecture pour le gratuit — ce qui touche à l'offre,
  pas seulement à l'écran.

Dépend du **minimum de posts** qu'une place exige, tranché dans
[La place d'un post](06-la-place-d-un-post.md).

> **Tranché par [La place d'un post](06-la-place-d-un-post.md) (2026-11-03)** :
> **6 posts du format au minimum** ; en dessous, points et `n` sans place, et
> une mention. À 10 posts relus, aucun format ou presque ne l'atteint.

> **Tranché par [La profondeur de l'historique des posts](21-la-profondeur-de-l-historique.md)
> (2026-11-06)** : le compte gratuit **reste à 10 posts** pour l'instant
> (David : « ça augmentera avec le temps ») — l'option « une autre limite de
> relecture » est écartée. Reste à trancher ce que sa page montre.

## Réponse (2026-11-06)

**Le compte gratuit commence à 10 posts, puis garde chaque nouveau post.**
En une phrase : le gratuit, c'est le payant **sans le rattrapage**.

1. **À l'arrivée** : la récolte lit les **10 posts les plus récents**, comme
   aujourd'hui (`sync.py:90`). Pas de rattrapage de l'historique antérieur :
   c'est ce que le payant a en plus
   ([La profondeur de l'historique des posts](21-la-profondeur-de-l-historique.md)).
2. **Ensuite, chaque post publié s'ajoute, et rien ne s'efface.** David :
   « c'est assez important que chaque fois ils aient le nouveau post pour
   qu'ils puissent suivre, pas qu'on s'arrête à 10 posts ». La base d'un
   compte gratuit grandit avec le temps — à 3 posts par semaine, environ
   40 posts en 3 mois, de quoi passer le minimum de 6 sur les formats
   principaux.
3. **Relu exactement comme le payant** : chaque jour de J+0 à J+7, à chaque
   Jour de travail jusqu'à J+30, puis au grand passage tous les 3 mois. Une
   seule règle de relecture pour tous les comptes ; aucun post gratuit ne
   reste figé à son dernier relevé. Coût : ce qu'un post neuf coûte déjà au
   payant (le rattrapage, la partie lourde, n'existe pas ici) ; la seule
   charge qui grandit est le stockage des images, comme en payant.
4. **La même page, les mêmes métriques, les mêmes règles.** Pas de mode
   gratuit, pas de moustache tous formats confondus : le **minimum de 6
   posts par format** fait le tri ([La place d'un post](06-la-place-d-un-post.md)) —
   en dessous, points et `n` sans place, et la mention du fait.
5. **La ligne de référence dit depuis quand** — la même que pendant le
   rattrapage (« référence : tes posts du 3 août au 5 novembre (42) »), sans
   mot propre au gratuit ; elle grandit à mesure que les posts arrivent.
6. **Aucun appel à l'achat sur `/instagram`** : la page dit le fait, pas
   l'offre. **Où pousser le passage au payant** est une question à part,
   notée au `BACKLOG.md` (David : « ça faudrait qu'on se les mette quelque
   part »).

Ce que ça change à
[Ce que la récolte et le traitement doivent calculer](14-ce-que-le-traitement-doit-calculer.md) :
`_a_relire` cesse de tronquer à `df["id"][:10]` pour le gratuit — il garde
les 10 derniers **à la première récolte**, puis prend tout post absent de la
base ; la relecture suit les mêmes fenêtres que le payant. Seul le rattrapage
reste réservé au payant (`is_paid`).
