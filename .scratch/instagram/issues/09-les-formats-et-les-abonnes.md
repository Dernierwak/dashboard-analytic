# 09: Les formats et les abonnés

Type: grilling
Status: open
Blocked by: 02
Assignee: —

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
