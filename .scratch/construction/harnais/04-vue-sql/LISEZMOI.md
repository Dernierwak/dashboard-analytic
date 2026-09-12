# Harnais du ticket 04 — la vue `theme_regroupement`

**Ce n'est pas une suite de tests installée.** Le dépôt n'en a aucune, et le
ticket [16](../../issues/16-le-seam-du-payload.md) a tranché que le seul seam
de test de la v1 serait le payload du rapport. Ce dossier est ce qui a servi à
vérifier le ticket 04, gardé pour qu'il soit rejouable plutôt que raconté.

## Ce qu'il vérifie

| Fichier | Ce qu'il prouve |
|---|---|
| `test_vue_vs_build_matrix.py` | La vue rend **exactement** ce que `build_matrix` rendait, sur les mêmes lignes — la version de `build_matrix` est relue depuis `git show HEAD`, pas depuis le fichier de travail. Les deux écarts VOULUS sont déclarés en tête du fichier. |
| `test_regles_de_la_vue.py` | Ce que la vue décide elle-même : la journée en cours dehors, le seuil des 100 CHF aux deux centimes qui l'encadrent, la conversion choisie, et « revenu inconnu ≠ revenu nul ». |
| `test_isolement.py` | `security_invoker` isole bien un compte — **et le témoin** : la même requête sans l'option rend les deux comptes. |
| `test_python_lit_la_vue.py` | La boucle entière sans réseau : vue → `fetch_theme_regroupement` (filtrée, paginée, ordonnée) → `build_matrix` → `build_constats`. Y compris le refus de replier quand la vue manque. |
| `test_copie_non_derivee.py` | La copie de la vue dans `000_run_me_all.sql` n'a pas dérivé de `theme_regroupement.sql`. Seul fichier qui ne demande aucun PostgreSQL. |
| `plan.py` | Lire UN compte ne coûte pas la clientèle entière — mesuré à 300 puis 900 comptes, le même nombre de lignes lues. |

## Le jouer

```sh
python3.12 -m venv /tmp/pulse-harnais && /tmp/pulse-harnais/bin/pip install pgserver pandas requests
cd .scratch/construction/harnais/04-vue-sql
for f in test_*.py plan.py; do /tmp/pulse-harnais/bin/python "$f"; done
```

`pgserver` embarque un PostgreSQL 16 complet : **aucune connexion à Supabase**,
aucun secret, rien à configurer. Le répertoire de données va dans `/tmp`
(`PULSE_HARNAIS_PGDATA` pour le déplacer), jamais dans le dépôt.

`schema.sql` ne reprend du schéma réel que les colonnes et les index que la vue
touche : un harnais qui invente un index donne des plans plus beaux que la
production.
