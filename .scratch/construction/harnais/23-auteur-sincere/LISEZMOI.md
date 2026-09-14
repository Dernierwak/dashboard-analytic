# Harnais du ticket 23 — une note ne se signe que de son propre nom

**Ce n'est pas une suite de tests installée.** Le dépôt n'en a aucune, et le
ticket [16](../../issues/16-le-seam-du-payload.md) a tranché que le seul seam de
test de la v1 serait le payload du rapport. Ce dossier est ce qui a servi à
vérifier le ticket 23, gardé pour qu'il soit rejouable plutôt que raconté.

Il existe parce que **la migration n'a pas pu être jouée sur la vraie base** : le
`.env` racine pointe un projet Supabase qui ne répond plus — constat écrit dans
le ticket [05](../../issues/05-migration-deux-colonnes.md), qui a monté le
harnais voisin pour la même raison, et que la consigne de repli du ticket 23
reprend. Vérifier sur un PostgreSQL réel et jetable est ce qui restait de plus
proche de la vérité — et ici c'était indispensable, parce que **la question du
ticket ne se lit pas dans le SQL** : elle dépend de la façon dont PostgreSQL
combine plusieurs politiques sur la même commande. Ça se mesure, ça ne se
raisonne pas de mémoire.

## Ce qu'il vérifie

| Fichier | Ce qu'il prouve |
|---|---|
| `test_le_trou.py` | **Que le ticket dit vrai.** Sur le schéma d'aujourd'hui, un membre « Peut agir » pose une note signée de son collègue, elle entre en base à ce nom-là, et le déclencheur du ticket 05 l'y **fige** — même la personne à qui elle est attribuée ne peut plus la rendre. |
| `test_auteur_sincere.py` | La règle refuse de signer du nom d'un autre (y compris pour le propriétaire du compte, y compris sans jeton), laisse passer `NULL` et la signature sincère, **et ne casse rien** : le viewer reste refusé par le partage et non par elle, l'upsert sans auteur passe encore, la clé de service n'est pas filtrée, le départ d'un membre reste possible. |
| `test_rejouable.py` | La migration se joue **deux fois** sans erreur, ne laisse qu'une politique, ne touche aucune ligne, ne contient aucune instruction destructrice — et, jouée trop tôt, **s'arrête en nommant le fichier à jouer d'abord**. |
| `test_copie_non_derivee.py` | La copie de la section 26 de `000_run_me_all.sql` n'a pas dérivé de `suivi_actions_auteur_sincere.sql`, elle est bien placée après la 25, et le contrôle de fin de fichier exige la politique **et son caractère RESTRICTIVE**. Seul fichier qui ne demande aucun PostgreSQL. |

## Le point qui a justifié tout ce dossier

**PostgreSQL combine les politiques PERMISSIVES d'une même commande en OU.** Une
politique de plus qui dit « seulement si l'auteur est toi » n'interdit donc
**rien** tant que `partage_insert` ou `suivi_actions_insert_own` dit oui à côté.
Écrite en permissive, la correction se serait lue comme une protection sans en
être une — et personne ne l'aurait vu, parce que le SQL est identique à un mot
près. Seul `AS RESTRICTIVE` retranche.

C'est pour ça que `pg.py` rejoue **toutes** les migrations qui posent une
politique d'insertion sur `suivi_actions`, et pas seulement celle qu'on vérifie :
un harnais qui n'aurait joué que la nouvelle aurait conclu l'inverse de la
vérité.

## Deux pièges rencontrés en le construisant, pour qui reprendra

- **`SET ROLE` n'est pas optionnel.** `psql` entre en propriétaire de la table,
  que PostgreSQL exempte de ses propres politiques. Sans `SET ROLE`, tout passe
  et le harnais conclut qu'il n'y a rien à corriger.
- **Le répertoire de données survit d'une exécution à l'autre.** Sans le
  `DROP SCHEMA public CASCADE` en tête de `decor.sql`, `ADD COLUMN IF NOT EXISTS
  author_id … REFERENCES` retrouvait la colonne du run précédent et **ne reposait
  pas sa clé étrangère** — le test du départ d'un membre échouait alors sur un
  défaut inventé par le harnais.

## Le jouer

```sh
python3.12 -m venv /tmp/pulse-harnais && /tmp/pulse-harnais/bin/pip install pgserver
cd .scratch/construction/harnais/23-auteur-sincere
for f in test_*.py; do /tmp/pulse-harnais/bin/python "$f"; done
```

`pgserver` embarque un PostgreSQL 16 complet : **aucune connexion à Supabase**,
aucun secret, rien à configurer. Le répertoire de données va dans `/tmp`
(`PULSE_HARNAIS_PGDATA` pour le déplacer), jamais dans le dépôt.

Les `NOTICE: ... does not exist, skipping` et les `drop cascades to ...` au
démarrage sont le signe que la rejouabilité et le nettoyage marchent, pas un
problème.

`t.py` est la copie de celui du harnais 05 : deux harnais jetables indépendants
valent mieux qu'un couplage entre deux dossiers qui n'ont aucune raison de vivre
ou de mourir ensemble.

## Ce que ce harnais ne prouve pas

**Rien n'a été joué sur la base de production.** La politique est écrite, pas
posée : tant que David ne joue pas `suivi_actions_auteur_sincere.sql` (ou le
fichier unique) dans le SQL editor de Supabase, le trou décrit par
`test_le_trou.py` est toujours ouvert en vrai.

Et **ça ne se verra pas en cliquant** : l'écran ne change pas, puisque
l'interface écrivait déjà la bonne valeur. Ce qui change est ce qu'une écriture
directe en PostgREST a le droit de faire. La ligne « sécurité » du contrôle en
fin de `000_run_me_all.sql` est le seul endroit où ça se lit.
