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
> à confirmer par la recherche 02, puis à trancher ici : on l'écrit, on ne
> l'estime pas.
