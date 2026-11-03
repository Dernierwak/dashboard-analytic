# 11: Les règles d'analyse réglables

Type: grilling
Status: open
Blocked by: 07, 08
Assignee: —

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
