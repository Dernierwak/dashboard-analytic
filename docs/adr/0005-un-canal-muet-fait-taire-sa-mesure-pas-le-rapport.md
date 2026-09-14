# Un canal muet fait taire sa mesure, pas le rapport

Quand la récolte d'un canal **échoue** — jeton expiré, 500, limite de débit,
schéma en retard — Pulse **publie quand même** le rapport de la semaine, et
**chaque mesure dont la source est muette vaut `None`** : jamais 0, jamais une
baisse, jamais un ratio recalculé sur ce qui reste. Le rapport nomme le canal
tombé, dit jusqu'à quel jour il a été lu, et renvoie vers la reconnexion.

La règle n'est donc pas « un canal est tombé → le rapport est dégradé ». C'est
**chaque mesure se tait si sa source est muette**, appliquée mesure par mesure :
un compte dont la boussole est l'engagement garde un rapport entier et juste
quand Meta Ads tombe, parce qu'aucun de ses chiffres ne traverse le trou.

## Ce qui a été écarté, et pourquoi

**Retenir la publication** — c'est ce que faisait le worker, mais pour une seule
cause sur cinq (la colonne `ad_id` absente, ticket 03). L'étendre à toutes les
causes était l'option la plus évidente et elle a été refusée : un compte au
jeton mort ne recevrait plus **aucun** rapport tant qu'il n'a pas reconnecté, et
personne ne lui aurait dit pourquoi. Retenir ne supprime pas le silence, **il le
déplace** — et le rapport est précisément le seul canal par lequel on peut
demander une reconnexion. Deux doctrines pour le même fait (« la dépense de la
semaine n'est pas là ») était de toute façon le vrai défaut : la cause du trou
ne change rien pour le lecteur.

**Publier le total amputé** viole `CLAUDE.md` §7 — une absence de donnée n'est
pas un zéro — et fabrique un faux verdict : « Semaine en retrait — les clics
publicitaires (−100 %) », servi en tête du rapport et repris dans l'email.

## Le piège qui a décidé du périmètre

Le trou n'est **pas symétrique**. GA4 tourne dans son propre fil et écrit
normalement pendant que Meta ou Google échoue : le revenu reste **entier**
pendant que le dénominateur est amputé. **Le ROAS ne s'effondre pas, il
gonfle.** Le rapport n'a alors pas l'air cassé — il a l'air excellent, et la
règle `scaler` conseille d'augmenter un budget sur un chiffre fabriqué par une
panne. C'est ce cas, et non la baisse apparente, qui justifie de faire taire les
**conseils payants** entiers et pas seulement les nombres.

## Les trois états qui se ressemblent

Ils rendent le même nombre de lignes en base et se traitent à l'opposé :

1. **jamais connecté** — le canal n'existe pas pour ce compte : aucun trou,
   aucune mention, rien à manquer ;
2. **connecté, la récolte a échoué** — la dépense de la semaine manque : c'est
   le seul cas que cette décision vise ;
3. **connecté, zéro ligne légitime** — aucune campagne active : c'est un zéro
   **mesuré**, et il continue de s'afficher comme un zéro.

Le signal ne peut donc **jamais** être « il y a peu de lignes ». Il est, et
uniquement : *une écriture a été tentée et elle a échoué* — ce que seul le
worker sait et ce que `fetch_progress` range déjà (état `echec`).

## Deux conséquences à ne pas « réparer » plus tard

**Un canal muet n'ancre pas la fenêtre.** Sa dernière date est périmée par
définition ; s'ancrer dessus ferait republier la semaine précédente sous sa
propre clé — le client ne recevrait pas un rapport troué, il recevrait l'ancien,
et la panne deviendrait invisible pour tout le monde. C'est la sortie la plus
discrète du problème, et c'est un compte **sans Instagram** qui l'emprunte,
faute d'une autre source pour ancrer.

**Un canal muet ne fait pas retomber `has_data`.** Un compte qui ne fait que du
Meta Ads et dont le jeton vient d'expirer a une dépense de fenêtre à 0, donc
« pas de données », donc aucun rapport — le silence reconstitué par une autre
porte. Un canal muet **est** une donnée.

## Ce que ça ne règle pas

Le trou se rattrape tout seul : `_depart_recolte` déduit le point de reprise des
lignes réellement écrites, moins le recouvrement (7 jours côté Meta, 30 côté
Google), donc le prochain passage réussi **réécrit la semaine trouée**. La
semaine suivante ne ment donc pas — à condition qu'un passage réussisse.

Reste entier le point soulevé par `vision-produit` et **non traité ici** : à la
deuxième semaine muette consécutive, une note dans le rapport ne suffit plus. Un
compte au jeton mort depuis un mois reçoit quatre rapports polis qui disent tous
la même absence, pendant que la run reste verte. Suivi au ticket
[47](../../.scratch/construction/issues/47-un-canal-muet-deux-semaines-de-suite.md).

Tranché avec `vision-produit` le 2026-09-14, au ticket
[20](../../.scratch/construction/issues/20-rapport-publie-sur-un-canal-muet.md),
né de la revue de code du ticket
[03](../../.scratch/construction/issues/03-identifiant-annonce-meta.md).
Vérifié hors ligne par `.scratch/construction/harnais/20-canal-muet/`.
