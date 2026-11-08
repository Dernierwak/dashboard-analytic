# 06: Le premier passage d'un compte

**What to build:** quand un compte Instagram n'a encore aucun jour en base,
le passage remonte 90 jours de portée et d'interactions et **la courbe des
abonnés sur 30 jours** (total d'un jour passé = total du jour − gagnés +
perdus des jours suivants), arrêtée au premier jour manquant.

Spec : § La récolte — Ce qui s'ajoute, « Au premier passage d'un compte » ;
§ Ce qu'on ne mesure pas (abonnés au-delà de 30 jours).

**Blocked by:** 05

**Status:** resolved

- [x] 90 jours de portée (3 appels de 30 jours au plus, voir plus bas) et
      d'interactions (90 appels).
- [x] Remontée de 30 jours jour par jour ; un jour manquant arrête la courbe
      là, rien n'est interpolé.
- [x] Harnais : la remontée sur un cas écrit à la main, et son arrêt.
- [x] Dit dans la réponse : la remontée n'a jamais été essayée avec un vrai
      jeton (vérifiée au premier passage du worker).

## Réponse

**Ce qui est fait** (arbitrages : premier passage = aucune ligne avant
avant-hier ; avant-hier relu à chaque passage)

- `sources/meta/instagram/releve_compte.py` :
  - **avant-hier relu à chaque passage** (retard de 48 h documenté par Meta,
    `issues/04`) : 5 appels de plus, ligne upsertée **sans** `abonnes` (il
    garde le `followers_count` du passage d'hier). 12 appels par jour au lieu
    de 7.
  - **détection** : `a_des_jours_avant(sb, uid, avant-hier)`. « Avant
    avant-hier » plutôt que « avant hier » : le léger écrit maintenant les deux
    jours, une ligne d'avant-hier ne dit pas que la remontée a eu lieu. Base
    illisible → pas de premier passage (pas 130 appels à l'aveugle), le mot le
    dit.
  - **`premier_passage`** : les 88 jours avant avant-hier (hier et avant-hier
    viennent du relevé du jour → 90 jours). Portée par `serie` (`period=day`,
    `time_series`) en **tranches de 30 jours (3 appels, pas 1)** : la fenêtre
    > 30 j est refusée en entier sur `follows_and_unfollows` (essai réel) et
    n'a jamais été essayée sur la portée — un refus aurait perdu les 90 jours.
    Interactions un appel par jour (88 + 2). `follows_and_unfollows` jour par
    jour sur 30 jours (28 appels, hier et avant-hier réutilisés). Part `AD`
    non remontée (la spec ne la demande pas ; 176 appels).
  - **`remonter_abonnes`** : ancrée sur le `followers_count` du passage posé
    sur hier ; total(J−1) = total(J) − gagnés(J) + perdus(J) ; **le premier jour
    sans gagnés ET perdus (erreur ou dimension absente) arrête la courbe** ;
    les gagnés/perdus des jours plus anciens restent écrits. 31 totaux au plus
    (hier + 30).
  - `valeurs_par_jour` : `end_time` = fin de la journée → le jour qui précède.
- `fetchers/account_insights.serie` (neuf).
- `source_data/instagram_compte.py` : `ecrire_jours_du_compte(sb, lignes)`
  remplace `ecrire_jour_du_compte` — **un lot par jeu de colonnes** (PostgREST
  écrit NULL pour une clé absente dans un lot mixte) ; `a_des_jours_avant`.
- Harnais 05 mis à jour (avant-hier relu, 12 appels, fonction renommée,
  détection neutralisée). `account_sync.py` non touché : le mot du compte
  passe tel quel dans la ligne du léger.

**Vérifié**

    python3.12 -I .scratch/instagram-construction/harnais/06-le-premier-passage/test_premier_passage.py
    → TOUT EST VERT (33 : avant-hier relu sans abonnés, 12 appels ; 90 jours
      écrits sans aujourd'hui ; portée rattachée à end_time ; 3 tranches
      30/30/28 ; 90 appels interactions ; 30 follows sans doublon ; remontée
      à la main 1840 → 1835 → 1833 → 1838 → 1828 → 1828 → 1827 ; arrêt sur
      erreur et sur NON_FOLLOWER absent ; followers_count absent → aucune
      remontée ; tranche en erreur → colonne non envoyée ; base illisible →
      pas de premier passage ; lots par jeu de colonnes ; table absente)
    harnais 01, 02, 04, 05 → TOUT EST VERT
    python3.12 -m py_compile (3 fichiers touchés) → OK

**Ne se vérifie qu'en vrai — la remontée n'a jamais été essayée avec un vrai
jeton.** Au premier passage du worker après que David a joué la section 23 :
le **cron de 07:00 UTC** (n'importe quel jour, le léger tourne chaque jour),
ou un lancement à la main depuis l'onglet GitHub Actions (`weekly-fetch.yml`,
mode `mise_a_jour`, `user_id`). À regarder dans le journal et la base :
- `follows_and_unfollows` jour par jour sur 30 jours (**non essayé**) : si
  Meta omet `NON_FOLLOWER` un jour sans désabonnement au lieu de rendre 0, la
  courbe s'arrêtera dès ce jour (règle stricte voulue — à constater) ;
- le jour le plus ancien (J−30) peut être refusé : la courbe s'arrête alors
  un jour plus tôt, sans rien inventer ;
- le rattachement de `end_time` au jour (convention UTC / Pacifique, déjà
  ouvert au ticket 05) — comparer une valeur à l'écran Instagram ;
- la série de portée de 30 jours en `period=day` sans `metric_type`.

**Limites connues**
- Un premier passage dont tous les appels de remontée échouent n'est **pas
  repris** le lendemain si hier/avant-hier se sont écrits : trois jours plus
  tard, une ligne « avant avant-hier » existe. Le journal le dit (« 0/88 jours
  remontés »).
- `saas/data/fetch_data/CLAUDE.md` (§ passage léger) ne mentionne pas encore
  avant-hier ni le premier passage : laissé hors de ma frontière (l'agent du
  ticket 03 touche aux mêmes zones de doc) — à ajouter à la fusion.

Corrigé après revue : le premier passage a un marqueur explicite, `connected_accounts.premier_passage_instagram_le` (section 23, ajout seul, CONTRÔLE et sommaire ; lecture/écriture dans `source_data/account.py`). Posé seulement quand la remontée a écrit au moins un jour plus ancien qu'avant-hier ; NULL → retenté chaque jour (« k/88 jours remontés … retenté demain »). Colonne absente → pas de premier passage à l'aveugle, §23 nommée. `a_des_jours_avant` est retirée (plus d'appelant). À faire par David : rejouer `000_run_me_all.sql` (section 23).

Vérifié : les 15 harnais verts (`python3.12 -I …/test_*.py`, `sh …/lancer.sh`). Ne se voit en vrai qu'après un passage du worker : le cron de 07:00 UTC, après la migration.
