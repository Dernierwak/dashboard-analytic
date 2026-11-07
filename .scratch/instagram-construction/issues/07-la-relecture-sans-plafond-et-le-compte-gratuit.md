# 07: La relecture sans plafond et le compte gratuit qui grandit

**What to build:** la cadence de relecture de la spec — chaque jour de J+0 à
J+7 (déjà par 04), à chaque Jour de travail les posts de moins de 30 jours,
tous les 3 mois tous les posts en base (le chemin de 03). Le payant perd son
plafond de 200 posts et sa reprise à 40. Le gratuit garde ses 10 premiers puis
grandit : tout post absent s'ajoute, rien ne s'efface.

Spec : § La récolte — Ce qui s'ajoute, « La relecture » et « Le compte
gratuit ».

**Blocked by:** 03, 04

**Status:** resolved

- [x] `_a_relire` suit la cadence ; plus de plafond 200 ni de reprise à 40
      pour le payant.
- [x] Le gratuit n'est plus tronqué à 10 après sa première récolte ; pas de
      Rattrapage (`is_paid`).
- [x] Le trimestriel se déclenche tout seul tous les 3 mois, sur une date de
      dernier passage complet lue en base, pas devinée.
- [x] Harnais : la liste à relire pour un payant et un gratuit à des dates
      données.

## Réponse

**Ce qui est fait**

- `sync.posts_a_relire(medias, connus, maintenant, is_paid)` : la règle pure
  du Jour de travail, hors Supabase et hors horloge. `_a_relire` ne fait plus
  que lire (`is_paid`, posts en base) et l'appeler.
  - En base : publié il y a moins de 30 jours, ou image jamais arrivée dans
    le stockage. **Plus de plafond 40, plus de plancher 6** ; une date
    illisible n'est plus reprise ici (le trimestriel la reprend).
  - Absent de la base : **payant — tous, sans plafond 200** ; **gratuit — ses
    10 plus récents à l'arrivée, puis tout post plus récent que le plus ancien
    de sa base** (il grandit ; rien de plus ancien, donc pas de Rattrapage).
  - `_en_base` sans liste d'ids est maintenant **paginé** (`_all_pages`, ordre
    `post_id`) : sans plafond, un payant passe les 1 000 posts et PostgREST
    tronquait en silence. `pandas` quitte `sync.py`. Un profil illisible
    donne la règle du gratuit au lieu d'un `IndexError`.
- **Le trimestriel** : `cockpit/instagram_reread.relire_si_du(sb, uid,
  maintenant)`, appelé par `scheduled_update.py` pour chaque profil, chaque
  jour, **après le léger et avant le complet** (pas en `--report-only`). Il
  lit `connected_accounts.relecture_instagram_le` par connexion et ne relit
  (`sync.relire_tous`, le chemin de 03) que celles où cette date a **3 mois
  du calendrier** (comptés en jours : le 31 août + 3 mois = le 30 novembre),
  ou est NULL. Après un passage réussi, la date du **début** du passage est
  posée (nombre de lignes touchées vérifié, `CLAUDE.md` §8) ; après une panne,
  rien : la connexion est reprise au cron suivant. Colonne absente → rien
  n'est relu, et le journal le dit (sans date lisible, le cron relirait tout
  chaque jour). Le lancement à la main (`relecture_instagram`) pose la date
  lui aussi : c'est un passage complet.
- Lecture/écriture de la date dans `source_data/account.py`
  (`dates_de_relecture_instagram`, `noter_relecture_instagram`,
  `ColonneRelectureAbsente`), à côté de `marquer_a_reconnecter`.
- Migration §23, ajout seul : `connected_accounts.relecture_instagram_le
  timestamptz DEFAULT NULL`, plus sa ligne dans le CONTRÔLE et le sommaire.
  La RLS de `connected_accounts` est déjà là et reste fermée au partage.
- `saas/data/fetch_data/CLAUDE.md`, les docstrings du cockpit et le
  commentaire de `couverture.debut_des_posts_complets` le disent.
- Aucun fichier du ticket 06 touché (`account_sync.py`, `releve_compte.py`,
  `account_insights.py`, `instagram_compte.py`).

**Vérifié**

    python3.12 -I .scratch/instagram-construction/harnais/07-la-relecture-sans-plafond/test_relecture_sans_plafond.py
    → TOUT EST VERT (28 vérifications : payant 300 posts / 200 en base — les
      60 de moins de 30 jours, les 100 absents au-delà du 200e, l'image hors
      stockage ; payant à l'arrivée : tout ; gratuit à l'arrivée : 10 ; gratuit
      trois mois après : les 40 neufs, sa base relue, rien de plus ancien ;
      date illisible ; 1 500 posts en base lus sur 2 pages ; « 3 mois » :
      NULL, jour pour jour, moins un jour, minutes du cron, fin de mois ;
      relire_si_du : dû / pas dû / jamais / jeton mort / panne sans date et
      reprise le lendemain / colonne absente / 0 ligne touchée ; à la main :
      relu et daté ; cron : léger → trimestriel → complet, rien en report-only)
    harnais 01, 02, 03, 04, 05 → TOUT EST VERT
    python3.12 -m py_compile (sync.py, instagram_reread.py, scheduled_update.py,
      account.py, couverture.py) → OK

Le harnais 03 reçoit une méthode `update` sur son faux client (le passage
complet pose maintenant sa date) ; ses vérifications sont inchangées.

**Ce qui ne se vérifie qu'en vrai**

1. Jouer la section 23 (la nouvelle colonne), puis son CONTRÔLE. Avant ça, le
   journal du cron porte « colonne … relecture_instagram_le absente » et
   aucun trimestriel ne part.
2. **Au cron de 07:00 UTC qui suit la migration**, toutes les connexions
   Instagram ont une date NULL : le trimestriel part pour chacune — c'est la
   relecture unique de 03, faite par le cron si David ne l'a pas lancée à la
   main avant. Le journal en porte la ligne `instagram relecture en … s`, puis
   `SELECT id, relecture_instagram_le FROM connected_accounts WHERE
   instagram_business_id IS NOT NULL;` doit montrer la date du jour. Le cron
   du lendemain ne doit plus en relancer aucun.
3. **À savoir avant le Jour de travail d'un compte payant** : sans plafond,
   son prochain passage complet importe tous les posts absents de sa base
   (sur le compte de l'essai, ~1 600 au-delà des 200 actuels : ~3 appels et
   une image chacun). C'est ce que ce ticket demande ; le Rattrapage par
   blocs (08) bornera cette partie. Si 08 n'est pas fusionné avant la mise
   en production, la durée de ce passage se lit dans le journal du cron du
   Jour de travail — rien ne l'a mesurée.
