# Un `link_click` absent devient zéro en production

Type: task
Status: open
Blocked by: —
Venu de : la carte `.scratch/meta-ads/` — rangé ici le 2026-10-01 : c'est une réparation, pas une décision.

## Question

Trouvé en chemin par le ticket 04 de `.scratch/meta-ads/`, et **vérifié à la main** : ce n'est pas un
rapport d'agent pris au mot.

`saas/collecte/automatisation/fetch_all.py:886-887`

```python
lc = next((it for it in row.get("actions", []) if it.get("action_type") == "link_click"), None)
row["link_clicks"] = int(lc.get("value", 0)) if lc else 0
```

La colonne est `link_clicks integer` — **nullable** (`000_run_me_all.sql:146`). Le
`NULL` est donc disponible, et le code ne s'en sert jamais.

**La nuance, parce qu'elle décide du correctif.** Il y a deux absences différentes
ici, et le code les confond :

- **`actions` est présent mais ne contient pas `link_click`** → Meta omet les types
  d'action à zéro. C'est un **vrai zéro**, et l'écrire est juste.
- **`actions` est absent de la réponse** (champ non demandé, non rendu, erreur
  partielle) → `row.get("actions", [])` rend `[]`, et le code écrit `0`. Là, on ne
  sait pas, et on écrit un chiffre. **C'est ça le défaut**, et c'est `CLAUDE.md` §7
  en production : « une absence de donnée n'est pas un zéro ».

**Le correctif** distingue les deux : `NULL` quand la clé `actions` est absente,
`0` quand elle est là sans `link_click`. Vérifier au passage que les lecteurs de
`link_clicks` côté web supportent le `NULL` sans afficher « 0 » — sinon on déplace
le mensonge d'un cran.

**Pourquoi ce ticket est dans cette carte** alors qu'il déborde de sa destination :
c'est **exactement le patron qu'il ne faut pas recopier pour les conversions**, et
les conversions arrivent par ce même chemin de code. Le corriger avant d'ajouter
`meta_ads_actions` évite de dupliquer le défaut sur cinq champs au lieu d'un.

**Vérification** : `python3.12 -m py_compile` sur `fetch_all.py`, et le dire
franchement — **ça ne se voit qu'après un passage du worker** (cron du Jour de
travail à 07:00 UTC, ou lancement à la main depuis l'onglet GitHub Actions,
`weekly-fetch.yml`, en `report_only` + `force`). Rien ne se vérifie en cliquant.
