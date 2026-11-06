# 19: Les posts boostés

Type: grilling
Status: resolved
Blocked by: —
Assignee: David (session Claude, 2026-11-06)

## Question

Un post boosté reçoit de la portée payante. L'API rend ses chiffres
organiques **hors boost** ([recherche 02](02-ce-que-l-api-donne-d-un-post.md)),
mais David juge que la différence pèse lourd (2026-11-02). La page
doit-elle **marquer** un post boosté (`boost_ads_list`), le **sortir de la
foule** ou le laisser dedans, et le relevé doit-il **noter** qu'un post était
boosté au moment de la lecture ? Dépend de [La place d'un post](06-la-place-d-un-post.md) :
qui compose la foule.

> **Tranché par [La place d'un post](06-la-place-d-un-post.md) (2026-11-03)** :
> la foule = les posts du même format sur la période, le post compris.

> **Tranché par [Écarter un post](08-ecarter-un-post.md) (2026-11-03)** :
> un post boosté **reste dans la foule par défaut**, et le client peut l'en
> sortir avec le filtre **« sans les boostés »** (toutes métriques, dans
> l'URL ; grisé « écarté : boosté » dans le Tableau détaillé). Reste à fixer
> ici : comment Pulse **sait** qu'un post est boosté (`boost_ads_list`, au
> relevé ou une fois pour toutes) et comment il le **marque** à l'écran.

## Résolution (2026-11-06, grilling avec David)

1. **La source : Instagram, `boost_ads_list`**, lu sur le post au même appel
   que ses chiffres, avec le jeton Instagram — « vu qu'on est sur Instagram ».
   Pas de passage par Meta Ads : un boost lancé depuis l'appli se voit, et le
   client n'a pas à brancher son compte publicitaire.
2. **Boosté une fois, boosté pour toujours** : dès qu'un relevé voit au moins
   une annonce liée au post, il est marqué, et le reste après la fin du boost.
   Le post garde la date où le boost a été vu la première fois ; chaque relevé
   note en plus l'état du moment. « Sans les boostés » le sort donc pour de bon.
3. **Pas de relecture de plus pour attraper les boosts** : on voit le boost au
   rythme des relevés déjà fixés (chaque jour jusqu'à J+7, chaque Jour de
   travail jusqu'à J+30, tous les 3 mois ensuite). Un boost raté puis vu plus
   tard est marqué dès qu'il est vu — « si on a l'information, autant la
   mettre », « comme sur Insta ».
4. **Le marquage** (forme laissée à Claude par David) :
   - au **nuage**, un **anneau fin** autour du point, de sa propre couleur —
     ni couleur ni forme à part, déjà prises par le format et le gris de
     l'écarté ; « Boosté » dans l'infobulle ;
   - au **Tableau**, dans **les 5 meilleurs** et au **Panneau**, une étiquette
     texte neutre « Boosté » à côté du format ;
   - au **Panneau**, la ligne « Chiffres organiques, hors boost — Instagram
     les rend ainsi » ;
   - **rien d'autre** : aucun budget, aucun chiffre payant (la page Meta).
5. **Ce que l'absence veut dire** (§7) : « aucun boost vu au dernier relevé »,
   jamais « pas boosté ». Deux cas suspendus à
   [L'essai réel des métriques](17-l-essai-reel-des-metriques.md) :
   - si `boost_ads_list` **ne liste pas les annonces terminées**, la ligne des
     Règles de lecture ajoute « boosts vus par Pulse seulement quand ils
     tournaient au moment d'un relevé » ; s'il les liste, rien ;
   - si notre jeton **n'obtient pas** `boost_ads_list`, ni filtre ni marquage.

Pour [Ce que la récolte et le traitement doivent calculer](14-ce-que-le-traitement-doit-calculer.md) :
la colonne `booste` de la fiche devient `booste_vu_le` (date, null = aucun
boost vu) ; le relevé porte `booste` (booléen du moment). La relecture
unique remplit `booste_vu_le` pour les posts déjà en base.

> **Éclairé par [L'essai réel](17-l-essai-reel-des-metriques.md)
> (2026-11-06)** : `boost_ads_list` est obtenu et **garde les annonces
> terminées** — la mention « boosts vus seulement quand ils tournaient »
> tombe ; un vieux boost est vu dès la relecture unique. La même annonce
> revient plusieurs fois : dédoublonner par `ad_id`. Le statut `error` se
> tranche dans [Ce que l'essai réel laisse à décider](22-ce-que-l-essai-laisse-a-decider.md).
