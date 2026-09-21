# Harnais du ticket 37 — les notes les plus RÉCENTES

## Ce qu'il vérifie

`LecteurSupabase.notes_archivees` demandait `.order("decided_at").limit(200)`.
`supabase-py` trie **en ascendant par défaut** : la requête gardait les 200
notes les plus **vieilles** du compte, et `theme_memoire.build_prompt` en
prenait `faits[-8:]` — les huit dernières d'un lot périmé. Au-delà de 200 notes,
la mémoire d'un thème décrivait à Gemini un travail que le client ne fait plus.

| Fichier | Ce qu'il prouve |
|---|---|
| `test_notes_recentes.py` | La requête demande `desc=True` ; ce qui sort est rendu du plus ancien au plus récent ; les huit faits qui atteignent Gemini sont les huit derniers. Avec son **témoin** : la coupe d'avant, sur les mêmes 500 notes, gardait `note 000` et perdait `note 499`. |

## Pourquoi un faux client qui ENREGISTRE la requête

Le défaut n'était pas dans le résultat, il était dans la **demande**. Un faux
client qui rendrait des lignes déjà triées l'aurait laissé passer — c'est
exactement ce qu'a fait le faux lecteur du harnais 16 (`self._notes[:limite]`,
la même coupe que le vrai), pendant tout ce temps. `faux_sb.py` n'exécute rien :
il garde la table, les `eq`, l'`order` et la `limit` de l'appel construit.

## Le jouer

```sh
cd .scratch/construction/harnais/37-notes-les-plus-recentes
python3.12 test_notes_recentes.py
```

Ni base, ni secret, ni réseau.
