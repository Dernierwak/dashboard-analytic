# Harnais du ticket 10 — les six règles payantes restantes

**Ce n'est pas une suite de tests installée.** Le dépôt n'en a aucune, et le
ticket [16](../../issues/16-le-seam-du-payload.md) a tranché que le seul seam de
test de la v1 serait le payload du rapport — il n'est toujours pas ouvert. Ce
dossier est ce qui a servi à vérifier le ticket 10, gardé pour qu'il soit
rejouable plutôt que raconté. Même patron que
[le harnais 07](../07-quatre-regles/LISEZMOI.md).

Il ne demande **ni base de données, ni secret, ni réseau** : les six règles sont
pures (listes ou dicts en entrée, dict en sortie, zéro I/O).

## Ce qu'il vérifie

| Fichier | Ce qu'il prouve |
|---|---|
| `test_adset_inegal.py` | La comparaison se fait **dans une même campagne** — deux Groupes de deux campagnes ne jouent pas la même enchère, et leur écart ne dit rien du ciblage. Le repère est ce que paient les **voisins**, pas une médiane : une médiane sur deux valeurs tombe pile entre elles, et la règle n'aurait jamais parlé sur une campagne à deux Groupes, c'est-à-dire sur le cas le plus courant. Déclenchement pile sur `cpc_ratio` et `cpc_spend_min`. Une campagne **jeune** n'est ni dénoncée ni comptée dans le repère. |
| `test_theme_deux_regies.py` | Elle **se tait dès que l'attribution d'un canal est incomplète** — c'est le fait du ticket [18](../../issues/18-revenu-google-non-rattachable.md) : une campagne étiquetée dont le nom ne correspond plus verse sa dépense sans jamais verser son revenu, et la règle dirait « l'autre rend quatre fois mieux » alors qu'on a perdu le revenu d'une campagne. Un « ×∞ » ne s'écrit jamais. Le champ `pourquoi` **nomme le biais du dernier clic** — condition posée par [24](../../../refonte/issues/24-conseils-payants-manquants.md). Le geste est un transfert **partiel**, jamais une coupe. |
| `test_budget_non_depense.py` | Le seuil est celui de David, mot pour mot (« 2 fois la dépense moyenne » = `cpc_ratio` lu à l'envers). L'argent qui dort doit peser au moins `cpc_spend_min` sur la fenêtre. Une campagne à **zéro dépense** parle (c'est le cas le plus utile) sans division par zéro. Sans budget posé, silence — jamais un budget de zéro. L'angle mort **date le relevé**, et n'invente aucune date quand il n'y en a pas. |
| `test_annonce_usee.py` | **Le piège que le ticket 10 nommait d'avance.** `reach` compte des personnes dédoublonnées et deux jours de portée ne s'additionnent pas : la règle ne calcule donc pas la fréquence hebdomadaire, elle calcule un **plancher** (impressions ÷ somme des portées quotidiennes), toujours plus petit que la vraie. Le titre, l'observation et l'angle mort disent tous les trois « au moins ». La **fréquence seule ne déclenche rien** : sans un prix du clic qui monte, une audience volontairement étroite se ferait dénoncer pour rien. Déclenchement pile sur `freq_plancher` et `freq_cpc_hausse`. |
| `test_page_arrivee_muette.py` | `sessions=None` (GA4 muet) n'est **jamais** lu comme zéro session ; zéro session **mesurée**, si. Elle exige assez de clics pour juger un taux (`funnel_views_min`) et de l'argent en jeu. Elle **ne nomme jamais une page** — GA4 n'a aucune dimension de page dans ce qu'on récolte, et l'écrire quand même serait un chiffre fabriqué. Le `pourquoi` donne le repère documenté (10 à 20 % normal, au-delà de 30 % Google parle d'un problème technique). |
| `test_creneau_pub.py` | Un jour ne se juge pas sur moins de **quatre occurrences** (`creneau_jours_min`), le repère est ce que paient **les six autres jours réunis**, pondéré par leurs clics. Déclenchement pile sur `cpc_ratio` et `cpc_spend_min`. L'angle mort dit pourquoi **Google est dehors** — on ne récolte pas la stratégie d'enchère, et brider les horaires d'une enchère automatique la dégrade. |
| `test_cinq_colonnes_six.py` | Les six clés portent **durée · levier · indicateur · geste · preuve** ; les quatre tables de `build_report.py` les couvrent ; ce qu'une **vraie sortie de règle** déclare est bien ce que la table annonce ; les clés **privées** (`_annonce`, `_groupe`, `_enjeu`) ne franchissent jamais `RECO_FIELDS`. Et les **six collisions** possibles entre les dix règles sont tranchées ou refusées, jamais laissées au hasard du tri — y compris « une seule Stratégie par thème ». |
| `test_branchement_dix.py` | Les cinq lectures neuves existent, sont appelées, et portent les gardes annoncées : `ad_id` **et** `reach` pour l'usure (**une seule journée sans portée et l'annonce sort** — garder ses impressions en perdant sa portée donnerait un nombre trois fois trop grand sous la mention « au moins »), campagnes en pause et campagnes jeunes écartées du budget, **cinq semaines** pour le créneau afin de pouvoir en perdre une, drapeau `complet` pour les régies, et **`_arrivee_theme` qui intersecte les deux côtés** au lieu de comparer tous les clics du thème aux seules sessions que GA4 rattache. **Seul fichier qui lit du texte source** — voir sa limite en tête de fichier. |

Total : **343 vérifications**, plus les **189** du harnais 07 et les **342** du
harnais 06, rejouées. Deux assertions ont été assouplies ailleurs, et les deux le
disent sur place : `test_branchement.py` (harnais 07) et
`test_indicateur_sans_proof_kpi.py` (harnais 06).

## Le jouer

```sh
cd .scratch/construction/harnais/10-six-regles
for f in test_*.py; do python3.12 "$f"; done
```

`python3.12`, jamais `python3` (`CLAUDE.md` §2). Aucune dépendance hors `pandas`,
déjà nécessaire au dépôt (et seulement pour importer `build_report.py` — les
règles elles-mêmes n'en ont pas besoin).

`t.py` et `pulse.py` sont les copies de ceux du harnais 07 : des harnais
jetables indépendants valent mieux qu'un module partagé qu'aucun ticket ne
possède.

## Ce qu'il ne prouve pas

- **Les cinq lectures n'ont jamais tourné.** `_budget_campagnes_theme`,
  `_usure_theme`, `_creneaux_theme`, `_arrivee_theme` et `_regies_theme` sont des
  closures de `build_payload`, qui prend un client Supabase vivant. C'est là que
  se fait le rattachement d'une campagne à son thème, la somme des portées
  quotidiennes et le drapeau `complet` — vérifié par **lecture seule** et par
  texte source. Les rendre appelables hors ligne est le ticket
  [16](../../issues/16-le-seam-du-payload.md).
- **Aucune règle n'a tourné sur de vraies données**, et c'est plus lourd ici que
  pour le ticket 07 : quatre des seuils sont **neufs**, et
  [24](../../../refonte/issues/24-conseils-payants-manquants.md) avait reporté
  ces six règles exactement pour ça (« elles portent au moins un seuil à
  calibrer sur données réelles »). Rien n'a changé de ce côté. Les quatre
  nombres portent leur source dans `SEUILS`, ce sont des points de départ
  argumentés — si une règle se tait toujours ou se répète chez un vrai compte,
  c'est un ticket, pas une retouche silencieuse.
- **Rien n'a été joué sur la base de David**, ni lu, ni écrit. Aucune migration,
  aucune récolte nouvelle.
