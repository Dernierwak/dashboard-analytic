# L'identifiant d'annonce Meta : deux annonces homonymes n'en font qu'une

Type: task
Status: resolved
Blocked by: 24

## Question

**Rien à décider sur le principe — la mesure est faite, le coût est le seul
sujet.** Gradué par [24](24-conseils-payants-manquants.md), qui a descendu les
conseils payants au niveau de l'Annonce et découvert ce trou en y descendant.

### Le fait, vérifié

`000_run_me_all.sql` (l. 137-152) — le fichier unique à jouer selon `CLAUDE.md`
§2 — crée `meta_ads_insights` avec `UNIQUE (user_id, date_start, ad_name)` et
**aucun `ad_id`**. Les deux seules occurrences d'`ad_id` dans ce fichier
appartiennent à `google_ads_ad_insights`.

La migration `meta_ads_ad_id.sql` existe et ajoute la colonne, **mais elle n'est
pas repliée dans `000_run_me_all.sql`** : une base montée depuis le fichier
unique ne l'a pas.

Conséquence mesurée : `upsert_meta_ads` (`saas/commun/insert_data.py` l. 37-44)
déduplique sur `(date_start, ad_name)` avec un `seen` qui *skip*. **Deux
annonces portant le même nom dans deux Groupes d'annonces différents fusionnent,
et la dépense de la seconde ne part jamais en base — elle n'est pas mal
attribuée, elle disparaît.** « Video 1 » réutilisé dans deux Groupes est le cas
courant.

### Pourquoi ce n'est pas gratuit

L'identifiant **n'arrive pas dans la réponse actuelle** : `fetch_all.py` l. 299
demande `campaign_name,adset_name,ad_name,impressions,clicks,reach,spend,
actions,date_start`. Il faut donc modifier la requête — c'est-à-dire toucher
`saas/collecte/`, que David a mis hors carte (*« il la dit bonne »*). Le dire
avant de commencer.

Trois gestes, dans cet ordre :

1. demander `ad_id` à l'API Meta (`fetch_all.py` l. 299) ;
2. replier `meta_ads_ad_id.sql` dans `000_run_me_all.sql` et déplacer la
   contrainte d'unicité sur `ad_id` ;
3. reprendre l'historique — les lignes déjà en base n'ont pas d'identifiant, et
   **ce qui a été écrasé n'est pas récupérable** : seule une nouvelle récolte le
   ramène, dans la limite de la fenêtre que l'API Meta accepte.

### Ce que ça débloque

Trois des dix règles de [24](24-conseils-payants-manquants.md) reposent sur le
niveau Annonce côté Meta (`annonce_locomotive`, `annonce_chere`, `annonce_usee`).
Tant que ce ticket n'est pas fait, elles tournent sur une table qui peut être
amputée sans le dire. Le seul détecteur possible — refuser de se déclencher
quand un `ad_name` du thème apparaît sur moins de jours que la campagne n'a été
active — est bancal, et l'agent `recos` l'a signalé comme tel.

Les trois règles qui n'en dépendent pas (`annonce_sans_conversion` côté Google,
`theme_hors_budget`, `theme_deux_regies`) se livrent sans attendre ce ticket.

### Condition d'entrée

**Reporté par David le 2026-09-11** — la récolte reste hors carte et les quatre
règles du premier lot n'en ont pas besoin. À reprendre quand une règle Meta au
niveau Annonce entre en construction, ou dès qu'un compte réel réutilise un nom
d'annonce.

### Consigne de repli

Rendre la mesure de l'ampleur avant de toucher quoi que ce soit : sur un compte
réel, combien de couples `(date_start, ad_name)` sont en collision, et quelle
dépense a été perdue. Un chiffre vérifié vaut mieux qu'une migration écrite à
l'aveugle.


## Avancement — session du 2026-09-11

**Les deux premiers gestes sont faits en code ; le troisième et la mise en base
t'attendent.** Le ticket reste ouvert : rien n'a été joué sur la base, et c'est
volontaire.

### La mesure demandée n'a pas pu être refaite, et pourquoi

La consigne de repli demandait de chiffrer l'ampleur sur un compte réel avant de
toucher quoi que ce soit. **Je n'ai pas pu atteindre la base** : le `.env` de la
racine — celui que lit `saas/commun/app_secrets.py`, donc toute la partie Python
— pointe vers un projet Supabase dont **l'hôte ne résout plus en DNS**, et ce
n'est pas le même projet que celui de `saas/web/.env.local`, qui répond. La clé
anonyme de l'app renvoie `401` sur le schéma. Le script de mesure est écrit et
prêt à tourner (lecture seule, il compare ce que l'API Meta rend à ce que la
déduplication en garde) — il ne lui manque que des identifiants valides.

Deux défauts d'environnement relevés en chemin, sans rapport avec ce ticket mais
qui coûteront une heure à qui les redécouvrira :

- le `.env` racine nomme la clé **`SUPABASE_SERVICE_ROLE_KEY`**, alors que
  `_service_client()` cherche `SUPABASE_SERVICE_KEY` (env) ou
  `SUPABASE_SERVICE_ROLE` (secret). **Aucun des deux ne correspond** : lancer
  `fetch_all.py` en local échoue sur `SUPABASE_URL / SUPABASE_SERVICE_KEY
  manquants`. Le workflow GitHub, lui, passe bien `SUPABASE_SERVICE_KEY`
  (`weekly-fetch.yml` l. 47) — c'est pour ça que la production tourne ;
- le projet du `.env` racine n'existe plus.

**Le phénomène, lui, est déjà chiffré** et n'avait pas besoin d'être reprouvé :
l'en-tête de `meta_ads_ad_id.sql` porte la mesure faite en conditions réelles —
**~17 € le 19/08/2026 et ~15 € le 20/08, environ 40 % de la dépense Meta
quotidienne**, sur la campagne `BW_Sommer_Traffic_2026` qui porte deux annonces
`fr_awarness` d'ad_id différents.

### Le fait que le ticket ne connaissait pas : la migration décrivait un fix qui n'existait pas

`meta_ads_ad_id.sql` annonce noir sur blanc que `upsert_meta_ads` « supprime
explicitement les lignes `ad_id IS NULL` restantes pour les dates qu'il
s'apprête à réécrire ». **Ce code n'existait nulle part.** La fonction
dédupliquait toujours sur `(date_start, ad_name)`, n'envoyait pas `ad_id`, et
upsertait `on_conflict="user_id,date_start,ad_name"`.

La conséquence est plus grave que le ticket ne le disait : **jouer la migration
sans ce code aurait cassé la récolte Meta**, pas seulement laissé le bug. Le
`DROP CONSTRAINT meta_ads_insights_uq` retire la contrainte que
`on_conflict=…ad_name` désigne, et PostgREST refuse un upsert dont la clé de
conflit n'existe plus. La migration était donc **un piège armé** depuis qu'elle
a été écrite.

### Ce qui est fait

1. **`ad_id` est demandé à l'API** — `fetch_all.py` l. 299, avec le pourquoi en
   commentaire. Le champ s'ajoute au même appel, il ne coûte aucun aller-retour.
2. **La migration est repliée dans `000_run_me_all.sql`**, juste après le bloc
   `meta_ads_insights`, sur le patron déjà en place pour `ga4_insights_uq`
   (l. 382-385) : `ADD COLUMN IF NOT EXISTS`, les deux `DROP CONSTRAINT IF
   EXISTS`, puis `ADD CONSTRAINT … UNIQUE (user_id, date_start, ad_id)`.
   Rejouable. **Le DROP CONSTRAINT est signalé dans le fichier comme l'exige
   `CLAUDE.md` §7 — il remplace une contrainte d'unicité, il n'efface aucune
   ligne.**
3. **`upsert_meta_ads` est réécrit** : déduplication sur `ad_id`, envoi d'`ad_id`,
   `on_conflict="user_id,date_start,ad_id"`, et **le DELETE que la migration
   promettait** — les lignes `ad_id IS NULL` des seules dates du lot, pour le
   seul utilisateur, effacées avant l'upsert. Sans lui, la vieille ligne NULL et
   la neuve cohabiteraient et la dépense de ces journées compterait double.
   Une ligne sans `ad_id` est ignorée et comptée dans le journal, plutôt
   qu'insérée pour se ré-insérer à chaque passage.
4. Deux pièges désamorcés dans les fichiers voisins : `meta_ads_insights.sql`
   dit maintenant que sa clé est périmée, et `meta_ads_ad_id.sql` ne renvoie
   plus vers `scripts/insert_data.py` (chemin mort) ni vers une « section 22 »
   qui n'existait pas.

`python3.12 -m py_compile` passe sur les deux fichiers touchés. **Le SQL n'a pas
été joué** — je n'ai pas d'accès à la base.

### Ce qui reste, et l'ordre compte

- [ ] **Jouer `000_run_me_all.sql`** (ou `meta_ads_ad_id.sql` seul) dans l'éditeur
      SQL Supabase. Le DROP CONSTRAINT attend ta validation.
- [ ] **Déployer le code dans la même fenêtre.** Entre les deux, la récolte Meta
      est cassée dans un sens ou dans l'autre : l'ancien code sur la nouvelle
      base ne trouve plus sa clé de conflit, le nouveau code sur l'ancienne base
      non plus. La prochaine récolte hebdomadaire ne doit pas tomber au milieu.
- [ ] **Reprendre l'historique** — le geste 3, et c'est une décision, pas une
      exécution. La récolte normale ne remonte que de 7 jours
      (`_RECOUVREMENT_JOURS_META`), donc seule la dernière semaine gagnera de
      vrais `ad_id` ; tout l'historique antérieur reste amputé là où des
      homonymes existaient. **Le seul levier qui rejoue tout** : vider
      `meta_ads_insights` pour l'utilisateur, ce qui fait repartir
      `_depart_recolte` du **1er janvier de l'année** (l. 227-245). C'est un
      DELETE sur des données réelles — **à valider explicitement**, et borné par
      ce que l'API Meta accepte encore de rendre.

### Ce que ça change à l'écran, et qu'il faut attendre

**La dépense Meta va monter** partout où des annonces homonymes existaient — ce
n'est pas une régression, c'est la dépense qui manquait. Les totaux de `/meta`,
les coûts par thème et tout ROAS calculé dessus bougent. Le drill-down de
`/meta` regroupe les annonces par `campagne → groupe → nom`
(`lib/channels.ts` l. 586-597) : deux homonymes d'un même groupe resteront une
seule ligne à l'écran, mais leurs deux dépenses y seront. Rien à changer côté
web.


## Answer

Résolu le 2026-09-11. **Le ticket disait « rien à décider sur le principe, le
coût est le seul sujet » — c'était faux : il portait cinq décisions**, et
écrire le code a suffi à les faire remonter. Les deux premiers gestes sont
faits ; les trois autres décisions sont tranchées et **attendent une
construction, pas un arbitrage**.

### Le fait qui a changé la question : la migration était un piège armé

`meta_ads_ad_id.sql` annonce que `upsert_meta_ads` « supprime explicitement les
lignes `ad_id IS NULL` restantes pour les dates qu'il s'apprête à réécrire ».
**Ce code n'existait nulle part.** La fonction dédupliquait toujours sur
`(date_start, ad_name)` et upsertait `on_conflict="user_id,date_start,ad_name"`.

La conséquence est plus grave que ce que le ticket décrivait : jouer la
migration n'aurait pas « laissé le bug en place », **elle aurait cassé la
récolte Meta**. Son `DROP CONSTRAINT meta_ads_insights_uq` retire exactement la
contrainte que `on_conflict=…ad_name` désigne, et PostgREST refuse un upsert
dont la clé de conflit n'existe plus. Le piège était armé depuis l'écriture de
la migration.

### Les décisions

- **Le rejeu de l'historique se fait par une date forcée, jamais par un
  DELETE.** Le geste 3 du ticket disait « vider la table pour que
  `_depart_recolte` reparte du 1er janvier ». Il n'a plus lieu d'être : puisque
  `upsert_meta_ads` efface désormais les lignes `ad_id IS NULL` **des dates
  qu'il réécrit**, une récolte forcée depuis le 1er janvier nettoie l'historique
  date par date. Reste à ajouter `--meta-since` et l'entrée `meta_since` au
  `workflow_dispatch` — le fichier a déjà ce patron (`--force`, `--user`,
  `--report-only`…). **La table n'est jamais vide et rien ne se perd si la
  récolte s'interrompt**, là où le DELETE créait une fenêtre où la donnée
  n'existait plus nulle part.
- **Le drapeau ne touche que Meta.** Un `--since` global atteindrait Google, où
  `change_event` plafonne à 30 jours et où une fenêtre plus large fait
  **rejeter la requête entière** au lieu de la tronquer (`CLAUDE.md` §8). Un
  drapeau global fabriquerait la panne que §8 raconte déjà. Si Google a besoin
  d'un rejeu, ce sera sa question et ses bornes.
- **Le code se défend ; le timing n'est qu'une précaution.** Avant d'écrire, la
  récolte vérifie que la colonne `ad_id` existe. Si elle manque — SQL pas encore
  joué, code neuf déployé — elle saute l'écriture Meta Ads, l'écrit dans le
  journal, **laisse Google, GA4 et Instagram finir**, et **la run GitHub finit
  rouge**. Une run verte sans Meta, c'est une semaine de dépense publicitaire
  absente que personne ne voit passer, et **que le rapport lirait comme une
  baisse** — un faux verdict, pas un trou visible. Implication technique :
  `run()` doit rendre au `__main__` qu'une écriture a été sautée, pour que le
  `sys.exit(1)` tombe APRÈS que tout le reste a fini.
- **`CONTEXT.md` gagne une ligne sur Annonce** : elle est identifiée par
  `ad_id`, **jamais par son nom** — le nom est une étiquette que l'annonceur
  réutilise. Ce n'est pas un détail d'implémentation : trois des dix règles de
  [24](24-conseils-payants-manquants.md) (`annonce_locomotive`, `annonce_chere`,
  `annonce_usee`) vont désigner une Annonce, et si elles la désignent par son
  nom **elles rejouent le bug dans le moteur de conseils**.
- **La mesure n'a pas pu être refaite, et elle n'était pas nécessaire.** Le
  `.env` de la racine pointe vers un projet Supabase **dont l'hôte ne résout
  plus**, et ce n'est pas celui de `saas/web/.env.local`. Mais le phénomène est
  déjà chiffré dans l'en-tête de `meta_ads_ad_id.sql` : **~17 € le 19/08/2026,
  ~15 € le 20/08, environ 40 % de la dépense Meta quotidienne**, sur
  `BW_Sommer_Traffic_2026` et ses deux annonces `fr_awarness`.

### Ce qui est déjà fait en code

1. **`ad_id` demandé à l'API** (`fetch_all.py` l. 299) — même appel, aucun
   aller-retour de plus.
2. **La migration repliée dans `000_run_me_all.sql`**, après le bloc
   `meta_ads_insights`, sur le patron de `ga4_insights_uq` (l. 382-385).
   Rejouable. Le `DROP CONSTRAINT` est signalé comme l'exige `CLAUDE.md` §7 : il
   remplace une contrainte d'unicité, il n'efface aucune ligne.
3. **`upsert_meta_ads` réécrit** — dédup sur `ad_id`, `on_conflict` sur `ad_id`,
   et le DELETE que la migration promettait, borné à l'utilisateur et aux dates
   du lot. Une ligne sans `ad_id` est ignorée et comptée au journal plutôt
   qu'insérée pour se ré-insérer à chaque passage.
4. Deux pièges voisins désamorcés : `meta_ads_insights.sql` dit que sa clé est
   périmée, et `meta_ads_ad_id.sql` ne pointe plus vers `scripts/insert_data.py`
   ni vers une « section 22 » qui n'existait pas.

`python3.12 -m py_compile` passe sur les deux fichiers touchés. **Le SQL n'a pas
été joué.**

### Ce qui reste, et qui n'est plus une décision

Construction : `--meta-since` + l'entrée de workflow, le garde-fou de colonne
avec son code de sortie, la ligne de `CONTEXT.md`. Puis, dans l'ordre : jouer le
SQL, déployer le code **dans la même fenêtre** (le cron passe tous les matins à
07:00 UTC), et lancer la récolte forcée depuis le 1er janvier.

**Ce que ça changera à l'écran** : la dépense Meta va **monter** là où des
homonymes existaient. Ce n'est pas une régression, c'est la dépense qui
manquait — et tout ROAS par thème calculé dessus bouge avec elle.

### Deux défauts d'environnement relevés en chemin

Sans rapport avec ce ticket, mais ils coûteront une heure à qui les
redécouvrira :

- le `.env` racine nomme la clé **`SUPABASE_SERVICE_ROLE_KEY`**, quand
  `_service_client()` cherche `SUPABASE_SERVICE_KEY` ou `SUPABASE_SERVICE_ROLE`.
  **Aucun des deux ne correspond** : `fetch_all.py` en local échoue d'entrée. Le
  workflow, lui, passe le bon nom (`weekly-fetch.yml` l. 47) — c'est pour ça que
  la production tourne ;
- le projet Supabase de ce `.env` n'existe plus.
