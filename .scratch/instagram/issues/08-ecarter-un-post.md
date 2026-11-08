# 08: Écarter un post de la lecture

Type: grilling
Status: resolved
Blocked by: —
Assignee: Claude

## Question

Tranché au cadrage : une aberrante est **signalée par la mesure**, jamais
écartée par Pulse tout seul ; le client peut l'écarter par un **filtre**, avec
une **note** qui explique, pour les moyennes comme pour « les 5 meilleurs ».

Reste à fixer :
- l'exclusion vit-elle **dans l'URL** (lien partagé = même lecture, rien
  d'écrit) ou est-elle **enregistrée** (et alors vue par les membres invités) ?
  Recommandation du cadrage : l'URL ;
- peut-on écarter **n'importe quel post** ou seulement une aberrante ;
- **que dit la note**, où s'affiche-t-elle, et que voit-on du post écarté (barré,
  grisé, absent) ;
- une exclusion change-t-elle la **place** des autres posts (la foule est
  recalculée sans lui) — et le dit-on ?

> **Éclairé par [La place d'un post](06-la-place-d-un-post.md) (2026-11-03)** :
> la foule est le format sur la période, **le post compris** ; « hors norme »
> = Tukey, 1,5 × IQR. Écarter un post recalcule donc les quartiles de son
> format — et peut faire tomber la foule sous le minimum de 6. La place se lit
> sur la métrique choisie : un post hors norme en likes peut ne pas l'être en
> portée — écarte-t-on pour une métrique ou pour toutes ?

## Grilling — trois séries (2026-11-03, réponses de David)

Fait vérifié avant la séance : la page Meta garde tout son état de lecture
(période, filtres, vue) dans l'URL (`searchParams`, `saas/web/app/meta/page.tsx`) ;
aucune table n'enregistre un réglage de lecture.

1. **On écarte par des filtres, pas post par post.** Deux filtres :
   **« sans les boostés »** et **« sans les hors norme »** (la règle de Tukey
   de [La place d'un post](06-la-place-d-un-post.md)). David : « j'aimerais
   avoir la différence entre posts boostés, pour les enlever via un filtre » ;
   « on peut écarter par des filtres, ou aussi via l'IQR ».
2. **Le geste « écarter ce post à la main » est laissé de côté** : « pour
   l'instant c'est un en trop » (David). Noté au `BACKLOG.md` (le post de
   concours qu'aucun filtre n'attrape). Sans geste manuel, il n'y a pas de
   note à écrire par le client : la page l'écrit elle-même (point 5).
3. **Le filtre vit dans l'URL** : il vaut pour une lecture, il ne se mémorise
   pas, et un lien partagé montre la même lecture, filtre compris. Rien
   n'est écrit en base, un membre invité ne subit jamais un filtre qu'il n'a
   pas choisi. « C'est bien si on partage » (David).
4. **« Sans les hors norme » agit sur la métrique affichée, désactivé par
   défaut.** On travaille une métrique à la fois ; un post retiré en likes
   revient si l'on passe à la portée. Le geste type (David) : une Sélection
   sur les likes montre un post qui écrase les autres ; on peut le retirer
   pour voir les posts « haut de tes habitudes » et à quoi ils ressemblent —
   « mais je ne suis pas obligé ». **Une seule passe** : bornes de Tukey
   calculées une fois sur la foule entière du format, on retire ce qui
   dépasse, on recalcule les quartiles sur le reste, on ne recommence pas
   (sinon la foule fond). « Sans les boostés », lui, vaut pour toutes les
   métriques : le boost tient au post.
5. **Ce que le filtre touche** : la **Comparaison** recalcule la moustache
   du format sans les posts écartés ; la **Sélection** les saute (« les 5
   meilleurs » parmi ceux qui restent) ; le **Tableau détaillé** les garde,
   **grisés**, avec la raison (« écarté : hors norme sur les likes »,
   « écarté : boosté ») — rien ne disparaît sans trace.
6. **La page dit combien et pourquoi, en simple**, collé à la moustache du
   format : « 1 post hors norme écarté — moustache sur 18 Reels au lieu de
   19 ». Si le retrait fait tomber le format sous 6 posts, la place disparaît
   avec la mention habituelle, complétée de la raison : « 5 Reels, il en faut
   6 — 1 est écarté par ton filtre ». David veut que la raison se comprenne
   (« une valeur aberrante, ça fausse les analyses ») ; à l'écran le mot
   reste **hors norme** (vocabulaire de la carte), la phrase exacte se règle
   en maquette.

## Résolution (2026-11-03)

**On écarte des posts par deux filtres de lecture, jamais à la main** :
« sans les boostés » (toutes métriques) et « sans les hors norme » (Tukey
1,5 × IQR, **sur la métrique affichée**, une seule passe, désactivé par
défaut). Les filtres vivent **dans l'URL** : rien d'enregistré, un lien
partagé montre la même lecture. Filtré, un post sort de la moustache de son
format et de la Sélection, reste **grisé avec sa raison** dans le Tableau
détaillé ; la page écrit **combien de posts sont écartés et pourquoi**, et si
le format tombe sous 6 posts, que c'est à cause du filtre. Écarter à la main
est au `BACKLOG.md`.

Répercuté sur : la carte (Decisions so far, vocabulaire) ;
[Les règles d'analyse réglables](11-les-regles-d-analyse-reglables.md),
[Le carré en maquette](12-le-carre-en-maquette.md),
[Ce que le traitement doit calculer](14-ce-que-le-traitement-doit-calculer.md),
[Les posts boostés](19-les-posts-boostes.md).
