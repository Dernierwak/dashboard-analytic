# Harnais du ticket 07 — les quatre règles payantes

**Ce n'est pas une suite de tests installée.** Le dépôt n'en a aucune, et le
ticket [16](../../issues/16-le-seam-du-payload.md) a tranché que le seul seam de
test de la v1 serait le payload du rapport — **il est ouvert depuis le
2026-09-13**, et son harnais est
[16-le-seam-du-payload](../16-le-seam-du-payload/). Ce
dossier est ce qui a servi à vérifier le ticket 07, gardé pour qu'il soit
rejouable plutôt que raconté.

Il ne demande **ni base de données, ni secret, ni réseau** : les quatre règles
sont pures (listes de dicts en entrée, dicts en sortie, zéro I/O), et les deux
lectures qu'elles ont demandées se vérifient contre un client PostgREST de
laboratoire (`faux_supabase.py`).

## Ce qu'il vérifie

| Fichier | Ce qu'il prouve |
|---|---|
| `test_annonce_chere.py` | La règle se déclenche **pile** sur `cpc_ratio` et `cpc_spend_min`, et sur aucun autre nombre. La comparaison se fait **dans un Groupe d'annonces** : deux canaux ne se comparent jamais, et entre deux Groupes c'est celui qui coûte le plus qui parle. Une campagne **jeune** n'est jamais dénoncée — **ni comptée dans la médiane**, parce qu'une campagne en apprentissage paie ses premiers clics plus cher et masquerait la vraie annonce chère. Une annonce à 0 clic ne tire pas la médiane vers le bas. |
| `test_annonce_locomotive.py` | Le geste désigne le **Groupe d'annonces**, jamais l'Annonce — sans Groupe connu, la règle se tait. La comparaison reste **dans ce Groupe** : à `ctr_ratio = 1.5`, comparer un taux de clic Search à un taux de clic social aurait désigné la même annonce Search chaque semaine. La référence est le CTR des **autres** annonces du Groupe, pondéré par les impressions : une annonce ne se compare pas à elle-même, et une petite annonce ne commande pas la référence. |
| `test_annonce_sans_conversion.py` | Une **absence de mesure n'est pas un zéro** : les annonces Meta (`conversions=None`) ne sont ni dénoncées ni utilisées comme preuve. La voisine qui convertit est une **condition** — zéro conversion partout ne dit rien sur l'annonce, et `roas` porte déjà ce conseil-là. Elle doit aussi être du **même Groupe** : une annonce Search qui convertit ne prouve rien sur une annonce Display qui ne convertit pas. |
| `test_theme_hors_budget.py` | **Seul l'avenir est projeté** : un passé sage sous le budget ne déclenche rien, même à rythme de semaine identique. Sans budget posé, la règle se tait plutôt que de lire un zéro comme « rien de prévu ». L'angle mort **date le relevé**. |
| `test_cinq_colonnes_payantes.py` | Les quatre clés portent **durée · levier · indicateur · geste · preuve**, toutes dans leurs listes fermées ; les quatre tables de `build_report.py` les couvrent ; et ce qu'une **vraie sortie de règle** déclare est bien ce que la table annonce — `_attach_grammaire` n'écrase rien. `spend` est déclaré et mesurable, `sessions` ne l'est pas. Et les **collisions** sont arbitrées : deux conseils qui disent de couper la même Annonce n'en font qu'un, deux qui se contredisent sur la même n'en font aucun. La clé privée `_annonce` ne sort jamais dans le payload. |
| `test_lectures.py` | Le détail par Annonce côté Google est **paginé** (2 500 lignes rendues, pas 1 000 — `CLAUDE.md` §8), et le budget posé est relu **par canal** sur son propre dernier relevé. Une table absente rend `[]`, jamais une exception. |
| `test_branchement.py` | `_compares_channels` n'existe plus, plus aucun appel ne subsiste. Les quatre règles sont appelées par la boucle des thèmes. **Seul fichier qui lit du texte source** — voir sa limite en tête de fichier. |

Total : **188 vérifications**, plus les **302** du harnais 06 rejouées sans
régression (une assertion y a été assouplie, le commentaire dans
`test_indicateur_sans_proof_kpi.py` dit exactement laquelle et pourquoi).

## Le jouer

```sh
cd .scratch/construction/harnais/07-quatre-regles
for f in test_*.py; do python3.12 "$f"; done
```

`python3.12`, jamais `python3` (`CLAUDE.md` §2). Aucune dépendance hors
`pandas`, déjà nécessaire au dépôt (et seulement pour importer
`build_report.py` — les règles elles-mêmes n'en ont pas besoin).

`t.py` et `pulse.py` sont les copies de ceux du harnais 06 : des harnais
jetables indépendants valent mieux qu'un module partagé qu'aucun ticket ne
possède.

## Ce qu'il ne prouve pas

- **`_annonces_theme` et `_budget_theme` n'ont jamais tourné.** Ce sont des
  closures de `build_payload`. C'est là que se fait le rattachement d'une
  Annonce à son thème, la garde sur `ad_id` et le prorata des budgets posés.
  **Partiellement LEVÉ par le ticket 16** : la fonction tourne maintenant hors
  ligne et le harnais [16](../16-le-seam-du-payload/LISEZMOI.md) exécute le
  rattachement d'une Annonce à son thème — deux Annonces homonymes d'un même
  Groupe font bien parler
  `annonce_sans_conversion`. Les closures restent vérifiées par lecture pour le
  reste.
- **Aucune règle n'a tourné sur de vraies données.** Les quatre seuils sortent
  de `SEUILS`, aucun n'est inventé, mais personne ne sait encore ce qu'elles
  diront chez un vrai compte — si elles se taisent ou se répètent, c'est un
  ticket, pas une retouche silencieuse.
- **Rien n'a été joué sur la base de David**, ni lu, ni écrit.
