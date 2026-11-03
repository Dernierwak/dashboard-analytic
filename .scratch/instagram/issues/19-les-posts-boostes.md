# 19: Les posts boostés

Type: grilling
Status: open
Blocked by: —
Assignee: —

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
