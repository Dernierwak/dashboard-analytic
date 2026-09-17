# Une note qu'on n'a pas encore faite marque déjà la frise, deux fois

Type: task
Status: resolved

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

---

## Réponse

**Fait, tel que le ticket le demandait — le filtre seul.** Deux lignes dans la
boucle de `_markers` (`saas/traitement/build_report.py`), posées **en Python
après la lecture** et non dans la requête :

```python
if _a.get("kind") == "note" and _a.get("status") == "running":
    continue
```

Le piège que le ticket nommait est donc évité : sur une base où la colonne
`kind` n'est pas migrée, la lecture ne lève pas, et l'`except` qui l'entoure ne
vide pas tous les repères. Les deux autres gardes (`detail.origin == "auto"`
sans `done_at`) n'ont pas été touchées, et `_marches_faites` non plus — elle
excluait déjà les notes.

### Ce qui le prouve

Harnais [`33-la-note-pas-faite`](../harnais/33-la-note-pas-faite/) — **17
vérifications**, sur un payload réellement construit par `build_payload` avec le
faux lecteur du ticket 16, jamais sur le texte du filtre. Il regarde les **deux**
lectures du dict : la frise du thème (`themes_focus[].series.marqueurs`) et la
courbe de la boussole (`kpi_focus.marqueurs`).

**Avant le correctif : 12/17.** Les cinq échecs étaient exactement les
assertions « une note `running` ne marque rien » — le défaut était donc bien
reproduit avant d'être corrigé.

La non-vacuité est testée : chaque ligne écartée est rejouée en version admise,
**même thème**, seul le cochage change. Un thème sans frise ne peut donc pas
faire passer le test par accident. Sont épinglées au passage : une note cochée
marque le **jour choisi** et non le jour de frappe, une hypothèse ordinaire
`running` **garde** son repère (son `decided_at` est une vraie décision, il ne
sera pas réécrit), et une note écartée ne fait pas disparaître la marque de sa
voisine.

**Une erreur du harnais, corrigée avant le commit.** Sa première version
modélisait le cochage par `status: "done"` + un `done_at` — un état que rien ne
produit. `completeNote` (`saas/web/app/actions.ts` l. 635) écrit
`{ status: "archived", decided_at: quand, check_at: quand }` : **aucun**
`done_at`, et c'est `decided_at` qui est réécrit au jour choisi. Le repère d'une
note cochée vient donc de `decided_at`. Le correctif tenait dans les deux cas —
`archived` comme `done` passent le filtre — mais le harnais documentait un
mécanisme faux, ce qui en aurait fait un mauvais témoin pour le prochain qui le
lit. Relevé par `/code-review`, vérifié dans la source, puis réécrit.

### Ce qui n'a pas été vérifié

- **Rien en base.** La colonne `kind` n'existe que dans les lignes fixes du
  harnais ; le repli « migration pas jouée » tient par construction, il n'a pas
  été exercé contre un vrai PostgREST.
- **Le ▲ lui-même n'a pas été regardé à l'écran** — et il ne peut pas l'être en
  cliquant : c'est une correction du **traitement**, elle ne se voit qu'après un
  passage du worker (`CLAUDE.md` §9). Il faudra soit le cron du Jour de travail
  (07:00 UTC), soit un lancement à la main depuis l'onglet **GitHub Actions**
  (`weekly-fetch.yml`, `report_only` suffit).

### Noté en chemin, hors périmètre

`jouer_tout.py` passe partout **sauf** les deux harnais de
`31-la-cible-des-regles`, déjà en échec avant ce ticket — travail en cours, non
commité, sur `reco_engine.py` / `regles_payantes.py` et sur `build_report.py`.
Vérifié en neutralisant le filtre de ce ticket : échecs identiques, donc sans
rapport. Ce travail est resté **hors du commit** de ce ticket, qui ne porte que
son propre hunk et son harnais.
