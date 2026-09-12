# Harnais du ticket 05 — `author_id` et la campagne sur `suivi_actions`

**Ce n'est pas une suite de tests installée.** Le dépôt n'en a aucune, et le
ticket [16](../../issues/16-le-seam-du-payload.md) a tranché que le seul seam de
test de la v1 serait le payload du rapport. Ce dossier est ce qui a servi à
vérifier le ticket 05, gardé pour qu'il soit rejouable plutôt que raconté.

Il existe parce que **la migration n'a pas pu être jouée sur la vraie base** : le
`.env` racine pointe un projet Supabase qui ne répond plus. Vérifier sur un
PostgreSQL réel et jetable est ce qui restait de plus proche de la vérité.

## Ce qu'il vérifie

| Fichier | Ce qu'il prouve |
|---|---|
| `test_auteur_fige.py` | Le déclencheur refuse de réattribuer une note et de combler après coup l'auteur d'une vieille ligne, laisse passer tout le reste — **et n'empêche pas la suppression d'un membre**, qui passe par le même UPDATE via `ON DELETE SET NULL`. |
| `test_campagne.py` | La campagne est une **paire** (régie, clé) : la base refuse les moitiés, la clé vide et la régie inconnue. L'index de « tout ce que j'ai fait pour cette campagne » existe et ne porte que les lignes concernées. |
| `test_rejouable.py` | La migration se joue **deux fois** sans erreur, ne duplique rien, ne touche aucune ligne existante — et aucune de ses instructions ne commence par DELETE, UPDATE ou TRUNCATE. |
| `test_copie_non_derivee.py` | La copie de la section 25 de `000_run_me_all.sql` n'a pas dérivé de `suivi_actions_auteur_campagne.sql`, et le contrôle de fin de fichier annonce bien les trois colonnes. Seul fichier qui ne demande aucun PostgreSQL. |

`schema.sql` est la table `suivi_actions` **telle que les sections 9→11, 19 et 23
la laissent** — c'est-à-dire l'état d'AVANT la migration vérifiée. Rien de plus :
un harnais qui invente une colonne prouve autre chose que ce que David va jouer.

## Le jouer

```sh
python3.12 -m venv /tmp/pulse-harnais && /tmp/pulse-harnais/bin/pip install pgserver
cd .scratch/construction/harnais/05-deux-colonnes
for f in test_*.py; do /tmp/pulse-harnais/bin/python "$f"; done
```

`pgserver` embarque un PostgreSQL 16 complet : **aucune connexion à Supabase**,
aucun secret, rien à configurer. Le répertoire de données va dans `/tmp`
(`PULSE_HARNAIS_PGDATA` pour le déplacer), jamais dans le dépôt.

Les `NOTICE: ... does not exist, skipping` au démarrage sont le signe que la
rejouabilité marche, pas un problème.

`t.py` est la copie de celui du harnais 04 : deux harnais jetables indépendants
valent mieux qu'un couplage entre deux dossiers qui n'ont aucune raison de vivre
ou de mourir ensemble.
