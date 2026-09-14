# La collecte Instagram écrit 0 pour ce qu'elle ne sait pas — et ne demande jamais les likes des Reels

Type: task
Status: open

## Question

**Trouvé en relecture du ticket [44](44-la-vue-du-regroupement-ne-peut-pas-etre-jouee.md).**
Deux défauts distincts dans `saas/collecte/meta/fetch_instagram.py`, qui ont la
même conséquence : **une donnée qu'on n'a pas est écrite en base comme un
zéro**, et plus rien en aval ne peut distinguer « mesuré à zéro » de « jamais
reçu ». C'est exactement ce que `CLAUDE.md` §7 interdit — *« Une absence de
donnée n'est pas un zéro. »*

Ces deux défauts sont antérieurs à 44 ; ils deviennent visibles maintenant
parce que l'engagement est désormais calculé à partir de ces colonnes.

### 1. `likes` n'est JAMAIS demandé pour les Reels et les vidéos

`fetch_instagram.py` l. 248-251 :

```python
if media_type in ("VIDEO", "REEL"):
    metric_list = "reach,saved,comments,views"     # ← pas de `likes`
else:
    metric_list = "likes,comments,saved,reach,views"
```

puis l. 321 : `"likes": metrics.get("likes", 0)` → **0 écrit en base pour toute
vidéo et tout Reel**, à chaque passage, l'upsert réécrivant la colonne.

**Conséquence, maintenant que `likes` est un des trois termes du numérateur :**
l'engagement d'un Reel est structurellement sous-évalué, et tout classement de
thèmes par engagement défavorise mécaniquement les comptes qui publient des
Reels. `insights.py` l. 345-353 choisit précisément *« le thème qui fait le plus
réagir »* par `max(…, key=lambda t: t["eng_avg"])` : **il peut nommer le mauvais
thème**, et le rapport l'écrira avec assurance.

Il faut d'abord **vérifier si `likes` est disponible sur v24.0** pour ces
formats (la branche date probablement d'une version où l'API rejetait la
métrique pour `VIDEO`). Le fichier sait déjà faire une requête séparée pour une
métrique capricieuse — c'est le motif employé pour `follows`.

- **Si `likes` est récupérable** : le demander, et le trou se referme.
- **S'il ne l'est pas** : écrire `NULL`, jamais `0`, et **trancher dans
  `CONTEXT.md` ce qu'on fait d'une publication dont une composante du numérateur
  est inconnue.** Aujourd'hui le `coalesce(p.likes, 0)` de la vue prendrait ce
  `NULL` pour un zéro — il faudra le corriger en même temps, sinon on aura
  déplacé le mensonge sans le supprimer.

### 2. Toutes les métriques absentes deviennent 0, y compris `reach`

`fetch_instagram.py` l. 319-325 : `metrics.get("reach", 0)`,
`metrics.get("likes", 0)`, `views`, `saved`, `follows`, `comments` — **aucune ne
peut valoir `NULL`**. Si Graph ne rend pas la métrique, la ligne part à zéro.

Pour `reach` c'est le plus grave, parce qu'il est **dénominateur** : une portée
absente écrite `0` ferait, sans précaution, entrer les réactions d'une
publication au numérateur d'un taux sans rien apporter au dénominateur.

**La vue est déjà protégée** — elle écarte `reach <= 0` et pas seulement
`NULL`, et c'est la relecture de 44 qui l'a fait corriger (le filtre ne visait
d'abord que `NULL`, donc il gardait la branche vivante). Mais c'est une
protection en aval d'un défaut d'amont : **les deux autres moteurs
d'engagement ne l'ont pas** ([49](49-trois-moteurs-d-engagement-trois-reponses.md)),
et le prochain lecteur de ces colonnes retombera dans le même trou.

## Ce qu'il faut faire

- **Distinguer « absent » de « zéro » à l'écriture** : `metrics.get("x")` sans
  défaut, et `NULL` en base quand Graph n'a rien rendu. C'est le seul endroit
  où l'information existe encore — une fois le 0 écrit, elle est perdue pour
  tout le monde et pour toujours.
- **Vérifier `likes` sur v24.0 pour `VIDEO`/`REEL`**, et le demander s'il est
  disponible.
- **Regarder les autres colonnes avec le même œil** : `views` et `follows`
  passent par le même `.get(..., 0)`.

## ⚠ Ce qu'il faut regarder avant de changer l'écriture

**Des lignes à 0 existent déjà en base**, écrites par le code actuel, et on ne
pourra pas les distinguer après coup des vrais zéros. Passer à `NULL` ne
réécrit que ce qui sera collecté ensuite : l'historique garde ses zéros
ambigus. Le dire dans le ticket qui fera la bascule, et ne pas promettre que
les anciens chiffres deviendront justes.

## Comment le vérifier

Rien ne se voit en cliquant : la collecte ne tourne qu'au passage du worker —
cron du Jour de travail (07:00 UTC) ou `weekly-fetch.yml` lancé à la main. Un
contrôle utile avant/après, sur la vraie base :

```sql
SELECT type, count(*) FILTER (WHERE likes = 0) AS likes_zero, count(*)
  FROM public.instagram_organic_posts GROUP BY type;
```

Si **tous** les `REEL` et `VIDEO` sont à `likes = 0`, le défaut 1 est confirmé
en production — c'est ce que le code laisse attendre, et ça n'a pas été mesuré
sur la vraie base par cette session.
