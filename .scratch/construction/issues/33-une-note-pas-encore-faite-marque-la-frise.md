# Une note qu'on n'a pas encore faite marque déjà la frise, deux fois

Type: task
Status: open

## Question

**Trouvé en chemin par le ticket [12](12-le-carnet-et-la-mort-de-preuve.md),
devenu un ticket plutôt qu'un détour silencieux** (`CLAUDE.md` §4).

Depuis le ticket [11](11-module-a-faire-et-date-libre.md), **une Note peut naître
`running`** : le client écrit ce qu'il COMPTE faire, la ligne rejoint le module
« À faire », et elle **ne se date qu'au moment où on la coche** (`CONTEXT.md`,
entrée Note). Quatre lectures ont appris cette règle — le rail, le filet hors
thème, la courbe du prototype (`lib/proto-notes.ts` : `.neq("status", "running")`)
et la boucle de verdict de `build_report.py`.

**`_markers` ne l'a pas apprise.** `saas/traitement/build_report.py` l. ~2358 lit
`suivi_actions` **sans filtrer `status` ni `kind`** :

```python
for _a in (sb.table("suivi_actions").select("*")
           .eq("user_id", user_id).execute().data or []):
    ...
    _d = _a.get("done_at") or _a.get("decided_at")
    _markers.setdefault(_nrm(_a.get("theme")), []).append(...)
```

Une note `running` porte pourtant déjà un `decided_at` — le jour de l'ÉCRITURE,
posé par `saveNoteOuverte`, et destiné à être **réécrit** au jour choisi lors du
cochage. Elle pose donc un repère ▲ sur la frise du thème **et** sur la courbe de
la boussole (l. 2496 et 4248), à une date qui n'est pas celle d'un fait, pour un
fait qui n'a pas eu lieu.

C'est du `CLAUDE.md` §7 : **un repère ▲ dit « le client a décidé ceci »** — le
commentaire juste au-dessus de cette lecture l'écrit lui-même, à propos des
lignes `auto`. Une intention n'est pas un fait.

### Ce qui rend le défaut petit, et ce qui le rend réel

- **Petit** : il faut avoir écrit une ligne dans « À faire » et ne pas l'avoir
  cochée. La marque disparaît dès qu'on coche — ou plutôt, elle se déplace à la
  bonne date.
- **Réel** : c'est la seule lecture des notes du dépôt qui n'a pas la règle, et
  la frise est justement l'écran où une marque sert à expliquer une courbe. Une
  marque posée le jour où on a écrit « il faudrait refaire les visuels » ferait
  attribuer un mouvement à un geste jamais posé.

### Ce qu'il faut faire, et le piège

Filtrer les notes `running` de `_markers`. **Le piège est déjà écrit dans le
fichier** : on ne peut pas ajouter `.neq("kind", "note")` ou `.neq("status", …)`
à la requête sans risque — la colonne `kind` peut ne pas exister sur une base où
la migration n'est pas jouée, et l'`except` qui entoure la lecture **viderait
alors TOUS les repères en silence**. Le filtre se pose donc **en Python, après la
lecture**, exactement comme la boucle de verdict le fait déjà :

```python
if _a.get("kind") == "note" and _a.get("status") == "running":
    continue
```

### Consigne de repli

Le filtre seul, sans toucher au reste de `_markers` — les deux autres gardes
(`detail.origin == "auto"` sans `done_at`) ont leur raison écrite et ne se
re-litigent pas.
