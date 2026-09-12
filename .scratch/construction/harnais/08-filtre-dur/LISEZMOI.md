# Harnais du ticket 08 — le filtre dur et le plafond de cinq

**Ce n'est pas une suite de tests installée.** Le dépôt n'en a aucune, et le
ticket [16](../../issues/16-le-seam-du-payload.md) a tranché que le seul seam de
test de la v1 serait le payload du rapport — il n'est pas encore ouvert. Ce
dossier est ce qui a servi à vérifier le ticket 08, gardé pour qu'il soit
rejouable plutôt que raconté.

Il ne demande **ni base de données, ni secret, ni réseau**.

## Ce qu'il vérifie

| Fichier | Ce qu'il prouve |
|---|---|
| `test_plafond_de_cinq.py` | Cinq conseils au maximum sur tout le compte, **jamais plus de deux Marches** et **jamais plus de deux fabrications à une heure ou plus** — et le contraire de chacun : moins de cinq candidats rendent moins de cinq, une seule Marche n'en fabrique pas une seconde, `créer` en dix minutes n'est pas lourd, `couper` en une heure non plus. L'**empreinte** est bien la clé ET la cible : la même instruction ne revient pas, la même clé sur une autre cible passe, une Marche épinglée se réaffiche à l'identique. Un conseil écarté ne consomme aucune place, et le vivier reçu n'est jamais modifié. |
| `test_filtre_dur.py` | Les **pistes rédigées par Gemini** n'existent plus (fonction, appels, décompte forcé) et les **quatre autres appels Gemini** sont intacts. Le filtre dur se lit **sur l'arbre**, pas sur le texte : dans la boucle des thèmes, les quatre familles de règles sont appelées **uniquement** sous `if _conseille:`, et ce garde **n'a pas de `else`** — un plafond qui n'est pas un quota ne se complète pas. `is_priority` **n'est plus un critère de tri** d'`_importance`. Le plafond s'applique **après** la pose des efforts et **avant** l'écriture du plan de thème. Une Marche épinglée ne fabrique pas une quatrième place, et une piste `ai_` ne se réaffiche jamais. `too_hard` arrive dans les astuces et **ne touche jamais le tri**. Un geste hors `NATURES` n'est pas un geste, un rôle hors `ROLES` est retiré plutôt que deviné. |

Total : **83 vérifications** (26 + 57), plus les **570** des harnais 04 à 07
rejouées sans régression. Les harnais 06 et 07 ont dû être **renommés** :
`LEVIERS_IA`, `METRICS_IA`, `NATURES_IA`, `ROLES_IA` et `METRIC_INFO_IA` ont
perdu leur suffixe en perdant Gemini — `LEVIERS`, `METRICS_MESURABLES`,
`NATURES`, `ROLES`, `METRIC_INFO`. Aucune valeur n'a changé.

## Ce qu'il ne prouve pas

`build_payload` prend un client Supabase vivant : **le filtre dur et le plafond
n'ont jamais tourné sur un vrai payload.** `test_filtre_dur.py` lit l'arbre et le
texte source pour ce qui vit à l'intérieur de cette fonction — un test de
structure prouve qu'un appel est sous un garde, jamais que le garde est vrai au
bon moment. C'est exactement le seam que le ticket 16 doit ouvrir.

## Le jouer

```sh
cd .scratch/construction/harnais/08-filtre-dur
python3.12 test_plafond_de_cinq.py
python3.12 test_filtre_dur.py
```
