# Harnais du ticket 06 — les cinq colonnes, et la fin de l'entrée automatique

**Ce n'est pas une suite de tests installée.** Le dépôt n'en a aucune, et le
ticket [16](../../issues/16-le-seam-du-payload.md) a tranché que le seul seam de
test de la v1 serait le payload du rapport — il n'est pas encore ouvert. Ce
dossier est ce qui a servi à vérifier le ticket 06, gardé pour qu'il soit
rejouable plutôt que raconté.

Il ne demande **ni base de données, ni secret, ni réseau** : la couche de règles
est pure (elle prend des DataFrames, zéro I/O) et les tables de déclaration sont
des constantes de module.

## Ce qu'il vérifie

| Fichier | Ce qu'il prouve |
|---|---|
| `test_cinq_colonnes.py` | Après `_attach_grammaire`, une reco-règle porte **durée · levier · indicateur · geste · preuve**, toutes dans leurs listes fermées. La table n'écrase jamais ce qu'une branche a déclaré, ni ce qu'une piste IA déclare. Les quatre tables couvrent les mêmes clés — une clé qui aurait une durée mais pas de levier sortirait avec quatre colonnes sur cinq sans que rien ne le dise. |
| `test_geste_par_branche.py` | `roas` écrit **plusieurs gestes sous une seule clé**, selon le chiffre du jour (augmenter / couper / couper / corriger), et `gaspillage` aussi. Les vraies règles tournent sur des chiffres choisis pour tomber sur chaque branche. |
| `test_critere_entree.py` | **Un conseil sans geste est un constat** : `theme_event_cout` n'est pas servi, une clé inconnue non plus, et rien n'est deviné à leur place. Deux circuits restent dehors et ce sont bien les deux prévus — la veille et le socle. Il n'y a pas de sixième geste « vérifier ». |
| `test_indicateur_sans_proof_kpi.py` | `PROOF_KPI` est retirée **sans qu'aucune valeur ne bouge** : la table d'avant est recopiée telle quelle et comparée cinq-uplet par cinq-uplet à ce que rendent `_METRIC_REGLE` + `_spec_mesure`. Ce qui n'avait pas d'indicateur n'en a toujours pas. |
| `test_plus_rien_sans_clic.py` | Le worker **n'écrit plus** de ligne `status="auto"` et **ne relit plus** celles qui existent ; le verdict ne tombe que sur un « ✓ Je l'ai fait » ; `theme_plan` continue de s'écrire à la publication ; l'échéance repart du clic. **Seul fichier qui lit du texte source** — voir sa limite en tête de fichier. |

## Le jouer

```sh
cd .scratch/construction/harnais/06-plan-de-theme
for f in test_*.py; do python3.12 "$f"; done
```

`python3.12`, jamais `python3` (`CLAUDE.md` §2). `pandas` est la seule
dépendance, déjà nécessaire au dépôt.

`t.py` est la copie de celui du harnais 05 : trois harnais jetables
indépendants valent mieux qu'un module partagé qu'aucun ticket ne possède.
`pulse.py` ne fait que poser la racine du dépôt sur le chemin d'import.

## Ce qu'il ne prouve pas

- **Rien ne fait tourner `build_payload`.** Elle prend un client Supabase vivant
  et va chercher ses données elle-même ; la rendre appelable hors ligne est le
  ticket 16. Tant qu'il n'est pas fait, l'assemblage du payload — le filtre des
  constats appliqué à une vraie liste de recos, l'écriture de `theme_plan` sur un
  vrai thème — n'est vérifié que par lecture.
- **Rien n'a été joué sur la base de David.** Aucune ligne `suivi_actions`
  `status="auto"` n'a été relue, comptée ni effacée : elles restent en base,
  reconnaissables à `detail.origin == "auto"`.
