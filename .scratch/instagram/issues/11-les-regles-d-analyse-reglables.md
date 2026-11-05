# 11: Les règles d'analyse réglables

Type: grilling
Status: resolved
Blocked by: 07, 08
Assignee: Claude

## Question

« On doit voir les données d'Insta et on peut mettre ses règles d'analyse en
mode plus pro pour les personnes qui veulent » (David). **Quelles règles le
client peut-il régler, où, et qu'est-ce qui reste fixe ?**

Candidates, chacune tranchée par son ticket avant celui-ci : le seuil de
maturité ([L'âge](07-l-age-d-un-post.md)), la foule et la règle d'aberrante
([La place](06-la-place-d-un-post.md)), les posts écartés
([Écarter un post](08-ecarter-un-post.md)).

À fixer : un **mode** distinct (un interrupteur « avancé ») ou des réglages
discrets dans le Bandeau de commandes ; réglage **par lecture** (URL) ou
**mémorisé** pour le compte ; comment la page **dit** qu'elle tourne avec des
règles non standard, pour qu'un chiffre réglé ne se lise jamais comme le
chiffre par défaut.

> **Éclairé par [La place d'un post](06-la-place-d-un-post.md) (2026-11-03)** :
> deux candidates nommées — le **coefficient de Tukey** (1,5 par défaut ; sur
> des chiffres de posts asymétriques, il marquera surtout vers le haut) et la
> **portée ÷ abonnés du jour de publication**, variante de la Portée brute
> (dépend de [L'état des abonnés en base](16-l-etat-des-abonnes-en-base.md)).
> Le minimum de 6 et la foule par format sont tranchés, pas réglables.

> **Éclairé par [L'âge d'un post](07-l-age-d-un-post.md) (2026-11-03)** :
> les seuils d'âge (48 h, 7 jours) sont **fixes** — retirés des candidates.

> **Éclairé par [Écarter un post](08-ecarter-un-post.md) (2026-11-03)** :
> écarter se fait par **deux filtres de lecture dans l'URL** — « sans les
> boostés » et « sans les hors norme » (métrique affichée, désactivé par
> défaut) —, jamais mémorisés. La page écrit combien de posts sont écartés et
> pourquoi : c'est le modèle pour « comment la page dit qu'elle tourne avec
> des règles non standard ». Pas de geste manuel.

## Grilling — deux séries (2026-11-05, réponses de David)

1. **Un mode avancé séparé ?** Non (b) : les deux filtres sont là pour tout
   le monde, regroupés et discrets dans le Bandeau de commandes sous
   « Règles de lecture », désactivés par défaut. Un interrupteur qui cache
   deux interrupteurs coûte un clic sans rien apporter.
2. **Le coefficient de Tukey réglable ?** Non, fixe à 1,5 et écrit dans
   l'info-bulle de « hors norme » : réglable, le même post serait hors norme
   chez un client et pas chez l'autre, et le filtre permettrait de retailler
   sa moyenne à volonté.
3. **La portée ÷ abonnés du jour de publication ?** C'est une métrique, pas
   une règle : elle rejoint l'objectif Portée à côté de la portée brute, et
   n'est affichée que si [L'état des abonnés en base](16-l-etat-des-abonnes-en-base.md)
   donne les abonnés du jour (« – » sinon, aucune estimation).
4. **Comment la page dit qu'un filtre tourne ?** Deux rappels : « Règles de
   lecture · n » sur le bouton, et une ligne au-dessus des moustaches —
   « Lu sans les boostés — 4 posts écartés. Revenir aux règles standard ».
   Le lien ne retire que les deux filtres et garde le reste de l'URL
   (`CLAUDE.md` §8). Sans filtre, rien ne s'affiche. (Question reformulée
   avec un exemple : la première formulation n'était pas claire.)
5. **Les filtres touchent-ils la Tendance ?** Non : la Tendance montre le
   compte, pas des posts. Son interrupteur Tout / Organique / Boosté reste
   une commande à part, sans lien avec « sans les boostés ».

## Résolution (2026-11-05)

**Pas de mode avancé, et aucune règle de calcul n'est réglable.** Le « mode
plus pro » se réduit aux **Règles de lecture** : les deux filtres déjà
tranchés (« sans les boostés », « sans les hors norme »), dans l'URL, jamais
mémorisés, regroupés et discrets dans le Bandeau, désactivés par défaut. Ils
s'appliquent à la foule des posts — Comparaison, Sélection, Tableau
détaillé — et à rien d'autre ; la Tendance garde son propre interrupteur.

Restent fixes : seuils d'âge (48 h, 7 jours), foule par format, minimum de
6, quartiles exclusifs, Tukey 1,5.

Un filtre actif se voit à deux endroits : le compteur sur « Règles de
lecture · n » et la ligne au-dessus des moustaches (lequel, combien de posts
écartés, lien « Revenir aux règles standard » qui ne retire que les
filtres). Les posts écartés restent grisés avec leur raison au Tableau. Sans
filtre, rien n'est annoncé.

La portée ÷ abonnés du jour de publication devient une **métrique de
l'objectif Portée**, conditionnée à
[L'état des abonnés en base](16-l-etat-des-abonnes-en-base.md).

Répercuté sur : la carte (Decisions so far, vocabulaire) ;
[Le carré en maquette](12-le-carre-en-maquette.md),
[La page entière en maquette](13-la-page-entiere-en-maquette.md),
[Ce que la récolte et le traitement doivent calculer](14-ce-que-le-traitement-doit-calculer.md),
[L'état des abonnés en base](16-l-etat-des-abonnes-en-base.md).
