# 05: Garder l'historique des chiffres d'un post

Type: grilling
Status: open
Blocked by: 03
Assignee: —

## Question

Aujourd'hui la récolte **écrase** les chiffres d'un post à chaque passage
(upsert `(user_id, post_id)`) : on ne sait pas ce qu'un post valait à J+2. Pour
comparer **à âge égal**, faut-il garder un relevé daté des chiffres de chaque
post — et alors **pendant combien de jours après publication**, à **quelle
fréquence** (chaque Jour de travail ? chaque jour ?), pour **quels posts**
(les 10 d'un compte gratuit ? les 200 d'un payant ?), et à quel coût en appels
Graph par passage du worker ?

Dépend de [Quand les chiffres d'un post se figent](03-quand-les-chiffres-d-un-post-se-figent.md) :
si l'API rend déjà la série jour par jour, ce ticket se réduit ; si elle ne
rend que le cumul, il devient le cœur de la récolte. Un relevé ne commence
qu'au jour où on le construit : les posts déjà publiés n'auront jamais leur
J+2 — dire ce que la page montre pour eux.

> **Éclairé par [la recherche 03](03-quand-les-chiffres-d-un-post-se-figent.md)
> (2026-11-01)** : l'API ne rend qu'un cumul `lifetime` ; **le relevé daté est
> la seule voie vers l'âge égal**, et la seule source possible d'un seuil de
> maturité au-delà de 48 h. Les insights d'un média restent lisibles 2 ans.
