# La mémoire de thème lit les 200 notes les plus VIEILLES

Type: task
Status: resolved

## Question

Trouvé par la revue de code lancée à la fin de [14](14-la-porte-vers-la-plateforme.md),
**vérifié**. `saas/traitement/build_report.py` l. 4348-4352 :

```python
.order("decided_at").limit(200)
```

`supabase-py` trie **en ascendant par défaut** (`desc=False`). La requête garde
donc les 200 notes les **plus anciennes** du compte ; `theme_memoire.build_prompt`
prend ensuite `faits[-8:]`, soit les huit dernières **de ce lot périmé**.

Au-delà de 200 notes, la mémoire d'un thème décrit donc un travail que le client
ne fait plus — et elle le décrit à Gemini, qui en tire la Marche suivante.

**Le piège est déjà nommé dans le code voisin** : `theme_memoire.py` l. 88 écrit
en capitales « LES DOUZE DERNIÈRES, PAS LES DOUZE PREMIÈRES ». La correction est
`.order("decided_at", desc=True).limit(200)` puis `faits[:8]` — ou un
renversement avant la coupe.

## Answer

**Corrigé dans `lecteur.py`, pas dans `build_report.py`.** Le ticket pointait
`build_report.py` l. 4348-4352 ; depuis le ticket 16 la lecture a déménagé dans
`LecteurSupabase.notes_archivees` (`saas/traitement/lecteur.py`), et c'est là
qu'elle vivait encore, mot pour mot. Le défaut était bien présent au
2026-09-20 — vérifié sur pièce avant de toucher quoi que ce soit.

La correction est `.order("decided_at", desc=True).limit(limite)` **puis
`lignes[::-1]`**, et le renversement compte autant que le `desc` : tout le code
en aval coupe par la fin (`faits[-8:]`, `historique[-12:]`). Rendre la liste
décroissante aurait remplacé « les huit plus vieilles » par « les huit plus
vieilles des deux cents plus récentes » — un second défaut à la place du
premier. Le contrat est écrit dans la docstring **et** sur le protocole
`Lecteur`, là où un appelant le lit.

**Le faux lecteur portait le même défaut**, et c'est pour ça qu'aucun harnais ne
l'avait vu : `lecteur_fige.py` faisait `self._notes[:limite]` — la même coupe
que le vrai. Un faux qui reproduit le bug du vrai ne prouve rien. Corrigé en
`[-limite:]`.

**Harnais neuf** : `.scratch/construction/harnais/37-notes-les-plus-recentes/`,
11 vérifications. Il regarde la **requête construite**, pas le résultat — le
défaut était dans la demande, et un faux client qui rendrait des lignes déjà
triées l'aurait laissé passer une deuxième fois. Il porte son témoin : sur les
mêmes 500 notes, l'ancienne coupe gardait `note 000` et perdait `note 499`.

Deux pins d'autres harnais ont suivi, chacun avec sa raison écrite :
`16-le-seam-du-payload` (la chaîne PostgREST comparée) et `12-le-carnet`
(le texte de la méthode). 184/184 et 46/46.

**§9 — ça ne se voit qu'après un passage du worker** : la mémoire de thème est
écrite par le traitement. Il faut le cron du Jour de travail (07:00 UTC) ou un
lancement à la main depuis **GitHub Actions** (`weekly-fetch.yml`, `report_only`).
Rien à cliquer dans l'app.
