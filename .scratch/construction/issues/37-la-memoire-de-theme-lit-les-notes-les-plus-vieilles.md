# La mémoire de thème lit les 200 notes les plus VIEILLES

Type: task
Status: open

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
