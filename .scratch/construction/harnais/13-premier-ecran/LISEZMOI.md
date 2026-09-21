# Harnais du ticket 13 — les trois dates en tête du rapport

**Ce n'est pas une suite de tests installée.** Le dépôt n'en a aucune, et le
ticket [16](../../issues/16-le-seam-du-payload.md) a tranché que le seul seam de
test de la v1 serait le payload du rapport — **il est ouvert depuis le
2026-09-13**, et son harnais est
[16-le-seam-du-payload](../16-le-seam-du-payload/). Ce
dossier est ce qui a servi à vérifier le ticket 13, gardé pour qu'il soit
rejouable plutôt que raconté.

Il ne demande **ni base de données, ni secret, ni réseau, ni installation**.

```bash
cd .scratch/construction/harnais/13-premier-ecran
python3.12 test_trois_dates.py
```

Les deux fichiers Python lancent eux-mêmes les deux vérificateurs JavaScript ;
on peut aussi les jouer seuls :

```bash
node verifier_dates.js
node --import ./alias.mjs verifier_partition.js
```

## Ce qui est EXÉCUTÉ, et pas seulement lu

C'est la nouveauté de ce harnais-ci, et elle vient d'une limite que les harnais
06 à 12 écrivaient à chaque fois : *« ces tests lisent du texte TypeScript, ils
ne l'exécutent pas »*. **Deux modules purs de `saas/web` tournent maintenant pour
de bon** — node 22+ retire les annotations de type lui-même, donc aucune
compilation et, surtout, **aucune copie du code à vérifier** dans le harnais :

| Vérificateur | Ce qu'il exécute |
|---|---|
| `verifier_dates.js` | `lib/jour-de-travail.ts` tel quel — 26 cas |
| `verifier_partition.js` | `lib/a-faire.ts` tel quel (via `alias.mjs`, qui rend l'alias `@/…` résoluble) — 7 cas |

`bouchon-report.ts` remplace `@/lib/report`, qui ouvre une connexion Supabase au
chargement : il n'expose que `feedbackKey` et `estVeille`, deux fonctions d'une
ligne, recopiées à l'identique.

## Ce qu'il vérifie

| Fichier | Ce qu'il prouve |
|---|---|
| `test_trois_dates.py` | `updated_at` **est lu** (il ne l'était pas), le Jour de travail est lu sur le profil du **compte regardé**, et les trois dates sortent de là sans qu'aucune soit calculée à la louche. Le piège du §8 est tenu : le calcul partagé vit dans un module **sans directive**, les sept jours n'existent plus qu'à un endroit, et le composant est rendu par le serveur. **Ce que la ligne n'a pas le droit de dire** : jamais « périmé », « obsolète », « il y a N jours », aucune couleur d'alerte, aucun bandeau « mise à jour en cours » — les mots sont cherchés dans le **code**, commentaires retirés, parce que ce ticket les écrit exprès dans sa prose pour les interdire. Chaque date **peut manquer et alors ne s'écrit pas** : la fenêtre ne s'écrit qu'entière, une date illisible vaut `null` et jamais « NaN septembre ». **34 vérifications**, dont le calcul exécuté. |

Total : **34 vérifications**.

**`test_premier_ecran.py` a été retiré le 2026-09-21** avec son sujet : il
tenait l'ordre « verdict → bilan du Carnet → À faire → rail → résumé IA », et
quatre de ces cinq marches sont parties avec les recommandations. Ce qu'il
prouvait encore et qui compte — la semaine du rapport sort de la fenêtre
mesurée, republier retombe sur la même ligne — est tenu par
`16-le-seam-du-payload/test_chiffres_du_payload.py`.

**Rejouées** : les harnais 06 (342), 07 (189), 08 (83), 09 (108), 10 (343) et
12 (179), tous verts. Les harnais 04 et 05 demandent un PostgreSQL et n'ont pas
été rejoués.

## Ce qu'il ne prouve pas

- **Rien n'a été vu à l'écran.** La page d'accueil est derrière `middleware.ts`
  et lit un vrai compte : ni l'ordre des blocs à 390 px, ni le repli du résumé,
  ni la ligne des trois dates n'ont été regardés dans un navigateur.
- ~~**`build_payload` n'a pas tourné.**~~ **LEVÉ par le ticket 16**
  ([16](../16-le-seam-du-payload/LISEZMOI.md)). La
  dérivation de `week_start` n'est plus vérifiée sur un calcul recopié : la
  construction est **rejouée pour de bon** sur les mêmes lignes, trois jours de
  fabrication différents (le jour même, trois jours après, trois semaines
  après), et elle retombe sur la même ligne d'écriture. L'idempotence de la
  publication est donc mesurée, plus racontée.
- **Aucune republication réelle.** Que deux publications de la même fenêtre
  écrivent la même ligne est démontré sur les dates, pas sur la base : aucun
  `upsert` n'a été joué.
- **Le rendu de `RailActions` sur l'accueil.** Ce qu'on lui donne est vérifié ;
  ce qu'il en dessine ne l'est pas — aucun runner dans `saas/web`, décision de
  David au ticket 16.
