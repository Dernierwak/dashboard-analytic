# 07: L'âge d'un post

Type: grilling
Status: resolved
Blocked by: 03, 05
Assignee: Claude

## Question

Tranché au cadrage : un post neuf se compare **à âge égal**, et un post trop
**jeune** attend un seuil de maturité réglable. Reste à fixer :

- le **seuil par défaut** — tiré de ce qu'Instagram documente
  ([Quand les chiffres d'un post se figent](03-quand-les-chiffres-d-un-post-se-figent.md)),
  par format si Meta les distingue ;
- comment un post jeune **se montre** (marqué « en cours », hors de la foule,
  ou dans la foule mais à âge égal) ;
- ce que montre un post **publié avant** le début du relevé daté, qui n'a pas
  de J+2 ([Garder l'historique](05-garder-l-historique-d-un-post.md)) ;
- si le seuil se règle, **où** (filtre de la page, mode « plus pro » — voir
  [Les règles d'analyse réglables](11-les-regles-d-analyse-reglables.md)).

> **Éclairé par [la recherche 03](03-quand-les-chiffres-d-un-post-se-figent.md)
> (2026-11-01)** : Meta ne documente **aucun** délai de maturité ; seule la
> latence de 48 h est écrite. Le seuil par défaut ne peut donc pas être
> « celui d'Instagram » : 48 h comme plancher sourcé, et au-delà une
> observation tirée de nos propres relevés, dite comme telle.

> **Éclairé par [Garder l'historique](05-garder-l-historique-d-un-post.md)
> (2026-11-03)** : relevé quotidien de J+0 à J+7, puis hebdomadaire jusqu'à
> J+30, âge réel en heures. Les âges comparables sont donc J+1 … J+7 au jour
> près, au-delà à la semaine près ; un post antérieur à la mise en service
> n'a aucun relevé jeune.

## Grilling — trois séries (2026-11-03, réponses de David)

1. **Seuil par défaut : 48 h, le même pour tous les formats.** Meta ne
   documente aucune maturité, seulement la latence de 48 h (recherche 03), et
   ne distingue pas les formats. Au-delà, **7 jours** : « après une semaine,
   il est censé être plus ou moins statique » (David) — un choix de Pulse,
   pas une règle d'Instagram.
2. **Trois âges, trois traitements** :
   - moins de 48 h : pas de place, hors de la foule, point vide (contour
     seul) sur la moustache ou le nuage ;
   - de 48 h à 7 jours : place **à âge égal**, face aux relevés des posts de
     son format au même J+n ; minimum 6 posts relevés à cet âge, sinon pas de
     place et une mention le dit (même forme que la place d'un post) ;
   - plus de 7 jours : la foule normale, avec son dernier relevé.
3. **Les posts publiés avant la mise en service** comptent comme « plus de
   7 jours » avec leur dernier relevé ; ils ne servent jamais à l'âge égal
   (ils n'ont pas de J+n). « Après quelques jours, ils le seront, donc c'est
   pas trop un problème » (David).
4. **À l'écran, pas de nom d'état** : « Trop tôt / Instable / Stable » et
   « en cours / en mouvement » ont été proposés puis rejetés (« on comprend
   pas »). On écrit l'âge tel quel, avec une icône et une phrase courte :
   - « Moins de 48 h — Instagram met jusqu'à 48 h à tout compter. »
   - « Moins de 7 jours — ses chiffres peuvent encore changer. »
   - plus de 7 jours : rien.
   Texte exact et icône : [La page entière, en maquette](13-la-page-entiere-en-maquette.md).
5. **Les seuils ne se règlent pas** : 48 h et 7 jours sont fixes, hors du
   mode « plus pro ». « On s'en fiche, c'est juste une mention qui dit que
   cela peut changer » (David).
6. **Pas de contrôle prévu du chiffre 7 jours** : David juge que très peu
   bouge après une semaine. Les relevés existeront de toute façon si on veut
   y revenir.

Remarque hors ticket : David attend que « toutes les données soient mises à
jour à chaque fois », alors que [Garder l'historique](05-garder-l-historique-d-un-post.md)
arrête la relecture à J+30 (plafond 40) et que le compte gratuit ne suit que
ses 10 derniers posts. Noté sur la carte (Not yet specified), pas traité ici.

## Résolution (2026-11-03)

**L'âge d'un post se lit en trois tranches fixes, les mêmes pour tous les
formats** : moins de 48 h (latence documentée par Meta) — pas de place, hors
de la foule ; de 48 h à 7 jours — place à âge égal face aux posts du format
relevés au même J+n, minimum 6, sinon une mention ; plus de 7 jours — la
foule normale. Les posts antérieurs à la mise en service comptent comme plus
de 7 jours. À l'écran : l'âge écrit tel quel avec une icône et « ses chiffres
peuvent encore changer », jamais un nom d'état. Aucun réglage.

Répercuté sur : la carte (Decisions so far, Not yet specified) ;
[Les règles d'analyse réglables](11-les-regles-d-analyse-reglables.md),
[Ce que la récolte et le traitement doivent calculer](14-ce-que-le-traitement-doit-calculer.md).
