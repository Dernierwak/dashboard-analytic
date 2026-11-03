# 09: Les formats et les abonnés

Type: grilling
Status: resolved
Blocked by: 02
Assignee: Claude

## Question

« Si je veux plus de followers, comprendre sur quel format me concentrer —
genre image apporte plus de followers en général » (David). **Que mesure ce
module, et où se calcule-t-il une seule fois ?**

- **La mesure** : abonnés gagnés par post (`follows`, déjà demandé mais écrit
  0 en cas d'absence) regroupés par format — médiane, total, ou distribution
  par format ? Une portée ne s'additionne pas : quelles métriques ont le droit
  d'être sommées par format ;
- **l'honnêteté** : à partir de combien de posts par format une comparaison
  entre formats se montre ; ce qu'on écrit quand un format n'a que 2 posts ;
  posts jeunes et écartés inclus ou non (cohérence avec
  [L'âge d'un post](07-l-age-d-un-post.md) et
  [Écarter un post](08-ecarter-un-post.md)) ;
- **le lieu du calcul** : « Tes formats » est mort le 2026-09-12 parce qu'il
  recalculait en TypeScript ce que deux moteurs posaient ailleurs — le calcul
  vit-il dans le traitement Python, dans `lib/` côté page, et la page hebdo
  en a-t-elle besoin aussi ?
- **la frontière du conseil** : la page dit « les images ont rapporté X
  abonnés par post », jamais « concentre-toi sur les images » (§1).

> **Éclairé par [la recherche 03](03-quand-les-chiffres-d-un-post-se-figent.md)
> (2026-11-01)** : le **Reel n'a pas de `follows`** (ni `profile_visits`) dans
> l'API. « Quel format rapporte des abonnés » ne peut pas y mettre le Reel —
> **confirmé par [la recherche 02](02-ce-que-l-api-donne-d-un-post.md)** —
> reste à trancher ici : on l'écrit, on ne l'estime pas. La recherche 02
> ajoute que les chiffres organiques d'un post boosté excluent le payant, et
> que le format se lit dans `media_product_type` (FEED / REELS / STORY) : une
> image, un carrousel et une vidéo du fil sont tous `FEED`.

> **Éclairé par [La structure de la page](01-la-structure-de-la-page.md)
> (2026-11-02)** : il n'y a **pas de module Formats à part**. Les formats
> vivent dans la Comparaison (une moustache par format), sur la métrique de
> l'objectif choisi ; « quel format rapporte des abonnés », c'est la
> Comparaison en vue **Abonnés**. Choisir un format filtre vers ses meilleurs
> posts. « Ce module » se lit donc : la Comparaison par format. Deux points
> pro ajoutés par David :
> - **réactions légères et fortes** — un « j'aime » contre un enregistrement
>   ou un partage (`saved`, `shares`, rendus partout) : la vue Engagement
>   les distingue-t-elle ?
> - **le Reel lu avec ses propres chiffres** — exclu de la vue Abonnés, mais
>   seul à avoir le temps de visionnage moyen et total (recherche 02).

## Grilling — quatre séries (2026-11-03, réponses de David)

Faits vérifiés avant la séance : la récolte range le format dans `type` à
partir de `media_type` seul (IMAGE / VIDEO / CAROUSEL_ALBUM,
`saas/data/fetch_data/sources/meta/instagram/sync.py:193-197`) — **un Reel y
est un `VIDEO`**, confondu avec une vidéo du fil, alors que seul le Reel n'a
pas de `follows`. Elle écrit `follows` à 0 quand Meta ne rend rien
(`sync.py:201`). La moustache de l'hebdo se calcule en Python
(`weekly_report/blocs/canaux.py:104-107`), la page actuelle en TypeScript
(`lib/channels.ts`).

1. **Quatre formats** : Reel, Carrousel, Image, **Vidéo du fil** — lus en
   croisant `media_product_type` (REELS / FEED) et `media_type`. Un format
   sans post sur la période n'a pas de moustache ; la vidéo du fil n'apparaît
   que si le compte en a. « Super input » (David).
2. **Des blocs au-dessus des moustaches**, pas dans la moustache : « cela
   mélange moins » (David). Par format : le **post type** (la médiane —
   jamais « moyenne », qu'un seul hors norme tire), le **total** quand il a
   un sens, le **`n`**.
3. **Un total seulement pour ce qui se compte** : `follows`, likes,
   commentaires, partages, enregistrements, vues, visites de profil. Jamais
   pour la portée (les mêmes personnes touchées par plusieurs posts) ni pour
   un taux. Un post sans le chiffre n'est pas compté zéro : le bloc écrit
   « 11 images sur 12 ont ce chiffre ».
4. **Deux métriques ajoutées**, jamais par défaut, vides si la portée manque :
   - Abonnés : **abonnés gagnés pour 1 000 comptes touchés** (`follows` ÷
     portée du post) ;
   - Engagement : **réactions fortes** = (enregistrements + partages) ÷
     portée — le taux d'engagement met un « j'aime » au poids d'un partage.
5. **Comparer les formats sur les mêmes données** : « quand on analyse les
   types, on essaie d'avoir les mêmes données ; une fois dans les posts, on
   permet de voir les spécificités, genre visionnage » (David). Le temps de
   visionnage du Reel se lit **au niveau du post** (Sélection, Panneau
   latéral, Tableau détaillé), pas dans la Comparaison. Seule exception, déjà
   tranchée par [La place d'un post](06-la-place-d-un-post.md) : en vue
   Abonnés, le Reel reçoit la phrase « Instagram ne donne pas les abonnés
   gagnés pour les Reels ».
6. **La frontière du conseil** : aucune phrase ne classe les formats ; ordre
   **fixe** Reel, Carrousel, Image, Vidéo du fil, jamais trié par valeur —
   les blocs ne sautent pas quand la métrique change, et la mise en page ne
   classe pas à la place du client. David : l'ordre « m'importe peu ».
7. **Le calcul vit une fois, dans un dossier commun** : la période est libre
   et les filtres sont dans l'URL, donc la moustache se calcule à la lecture,
   pas d'avance dans le traitement. Quartiles exclusifs, Tukey, minimum de 6 :
   **un seul calcul de la foule**, dans un dossier commun de `lib/` dont le
   nom dit qu'il sert plusieurs graphiques (Comparaison, blocs, Sélection,
   Tableau, nuage) — « si une fonction s'applique à plusieurs graphs, la
   mettre dans un dossier commun » (David). Vérifié sur le jeu de contrôle de
   l'hebdo ([1…6] → 1,75 / 3,5). L'hebdo ne montre pas les formats et garde
   son calcul Python ; s'il les montre un jour, il ne le refait pas à sa
   façon.
8. **Un 0 est un 0, une absence est « – »** — « je veux pas de fausses
   données » (David). La récolte cesse d'écrire 0 pour une absence, et
   l'existant se nettoie : le 0 des Reels devient « – » (l'API ne leur rend
   jamais `follows`) ; les posts du fil sont **relus une fois** chez
   Instagram — ce qu'il rend devient le chiffre, 0 compris, ce qu'il ne rend
   pas devient « – ».

## Résolution (2026-11-03)

**« Quel format rapporte des abonnés » = la Comparaison en vue Abonnés**,
sur **quatre formats** (Reel, Carrousel, Image, Vidéo du fil, lus par
`media_product_type` × `media_type`), en ordre fixe, sans phrase qui les
classe. Au-dessus des moustaches, **un bloc par format** : post type
(médiane), total pour ce qui se compte seulement (jamais portée ni taux), `n`
et « x sur n » quand un chiffre manque. Deux métriques nouvelles : abonnés
pour 1 000 comptes touchés (Abonnés), réactions fortes (Engagement). Les
formats se comparent sur les mêmes données ; le propre d'un format (temps de
visionnage du Reel) se lit au niveau du post. Le calcul de la foule existe
**une fois**, à la lecture, dans un dossier commun de `lib/`. **0 si
Instagram le rend, « – » sinon** : la récolte se corrige et l'existant se
nettoie (Reels vidés, posts du fil relus une fois).

Répercuté sur : la carte (Decisions so far, vocabulaire) ;
[La page entière, en maquette](13-la-page-entiere-en-maquette.md),
[Ce que la récolte et le traitement doivent calculer](14-ce-que-le-traitement-doit-calculer.md),
[L'essai réel des métriques](17-l-essai-reel-des-metriques.md).
