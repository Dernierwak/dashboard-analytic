# L'étiqueteuse IA fabrique le nom d'une campagne Google, et ce nom détruit le pont du revenu

Type: task
Status: resolved

Sorti de la mesure du ticket [18](18-revenu-google-non-rattachable.md), qui
cherchait une règle d'attribution et a trouvé une fabrication. 18 garde la
question produit (« que fait-on d'une campagne vraiment non rattachable ? ») ;
**ce ticket-ci porte le défaut technique**, qui lui n'a pas besoin d'un arbitrage.

## Le fait, mesuré

Sur le compte de David, deux lignes de `google_campaign_config` portent un
`campaign_name` qui **n'a jamais existé chez Google** :

| campaign_id | Nom stocké | Nom réel (`google_ads_insights`) | label_source | effective_status |
|---|---|---|---|---|
| 24176742897 | `Campagne 24176742897` | `ch_fr_pmax_herbst_2026` | `ai` | `NULL` |
| 24187314124 | `Campagne 24187314124` | `ch_de_pmax_herbst_2026` | `ai` | `NULL` |

`updated_at = 2026-08-29 08:10:26` pour les deux, `budget_max = 0`.

## Qui l'écrit

`saas/recos_ia/labeling.py` :

- **l. 134-139** — la liste des campagnes Google vient de `google_ads_insights`,
  mais la requête ne sélectionne que `campaign_id`. Cette table porte pourtant
  le vrai `campaign_name`, récolté jour par jour (`fetch_google_ads.py` l. 191).
- **l. 170** — sans ligne de config préexistante, le nom est inventé :
  `cname = cfg.get("campaign_name") or f"Campagne {cid}"`.
- **l. 280-283** — ce nom inventé est **upserté dans `google_campaign_config`**.

## Les deux dégâts

1. **Le revenu ne peut plus rentrer.** `name2label` (`build_report.py`) et
   `rev_by_name` (`insights.py`) rattachent le revenu GA4 par nom normalisé.
   `Campagne 24176742897` n'apparaîtra jamais en `utm_campaign`. Résultat
   mesuré : le thème « Campagne Générale » verse 808.87 CHF au dénominateur du
   ROAS et **0 CHF** au numérateur, alors que GA4 a bien enregistré **352.00 CHF**
   sous `ch_de_pmax_herbst_2026`. ROAS affiché 0.00, ROAS réel 0.44.
2. **Gemini a classé à l'aveugle.** La description envoyée était
   `[Campagne Google] «Campagne 24176742897»` — pas un mot de business. Les deux
   campagnes sont tombées dans le fourre-tout « Campagne Générale ».
   `ch_fr_pmax_herbst_2026` / `ch_de_pmax_herbst_2026` disaient la langue, le
   format (pmax) et la saison.

## La réparation

Elle ne fabrique rien, elle arrête une fabrication :

1. **Lire le vrai nom.** `labeling.py` l. 134-139 sélectionne aussi
   `campaign_name` et garde le plus récent par `campaign_id` (les lignes sont
   déjà ordonnées `date_start desc`). L'ordre de repli devient : config →
   insights → rien.
2. **Ne plus jamais écrire un nom inventé** dans `google_campaign_config`
   (l. 282). Si aucun nom réel n'est connu, l'upsert n'envoie pas la colonne —
   `Campagne <id>` reste un habillage d'affichage, jamais une valeur stockée.
   C'est la frontière que le défaut a franchie.
3. **Rattraper les lignes déjà écrites** : un backfill par `campaign_id` depuis
   `google_ads_insights`. Il n'invente rien — le nom est attesté par une ligne
   récoltée. À écrire comme migration signalée, pas en douce (`CLAUDE.md` §7).

Après 1+2+3, la mesure de l'étape 1 du ticket 18 retombe à **zéro campagne
muette**, et la question d'attribution de 18 redevient la garde préventive
qu'elle espérait être.

## Ce qu'on a vu à côté, et qu'il faut vérifier séparément

- `upsert_google_campaign_statuses` (`insert_data.py` l. 493) **n'a jamais
  touché ces deux lignes** — `effective_status` est resté `NULL`. Donc
  `fetch_campaign_statuses` (`fetch_google_ads.py` l. 367-405, `FROM campaign`
  sans `WHERE`) ne les a pas rendues. Hypothèse la plus simple : l'API Google
  Ads exclut par défaut les campagnes `REMOVED`, et ces deux-là ont fini leur
  course (dépense du 2026-08-28 au 2026-09-09). **Non vérifié** : il faudrait
  une requête réelle contre l'API pour le confirmer.
- `fetch_all.py` l. 605 avale l'erreur : `smap, _ = fetch_campaign_statuses(...)`.
  Si la requête échoue, `smap` vaut `{}`, aucun nom n'est écrit, et **rien ne le
  dit**. Ce silence mérite sa propre correction.
- `upsert_google_campaign_config` (`insert_data.py` l. 471) n'a **aucun
  appelant**. Code mort à retirer ou à rebrancher.

## Vérifier

`python3.12 -m py_compile` sur `labeling.py`. Le reste ne se voit **qu'après un
passage du worker** — cron du Jour de travail (07:00 UTC) ou lancement manuel
depuis GitHub Actions (`weekly-fetch.yml`, `label_only` pour l'étiquetage,
`report_only` pour le ROAS reconstruit).

---

## Answer — 2026-09-13 : la source est réparée, le rattrapage attend David

Tranché par David : **réparer la source ET rattraper les lignes déjà écrites.**

### Ce qui a été fait

**`saas/recos_ia/labeling.py`**, trois changements qui n'en font qu'un :

1. **l. 134-139** — la requête sur `google_ads_insights` demande maintenant
   `campaign_id, campaign_name`. Le premier nom vu pour un identifiant est le
   plus récent (`date_start desc` est déjà l'ordre de la requête). Un repli
   garde l'ancienne requête si la colonne manque sur une base ancienne : on perd
   le nom, jamais la campagne.
2. **l. 170** — deux champs au lieu d'un, parce qu'ils n'ont pas le même droit.
   `name` part **en base** et vaut `None` tant qu'aucun nom réel n'est connu ;
   `desc` ne part **qu'à Gemini**, où `Campagne <id>` vaut mieux qu'une ligne
   vide.
3. **l. 280-283** — sans nom réel, la colonne `campaign_name` **ne part pas**
   dans l'upsert. La valeur par défaut de la table (`''`) se lit comme « on ne
   sait pas » ; un `Campagne <id>` écrit se fait passer pour un nom. C'est la
   frontière que le défaut avait franchie.

**`supabase/migrations/nom_google_fabrique.sql`** — le rattrapage. Un seul
`UPDATE`, aucune suppression. Son `WHERE` porte sur l'**égalité exacte** avec
`'Campagne ' || campaign_id` : une campagne que le client aurait lui-même
nommée « Campagne d'automne » n'y répond pas. Le nom écrit n'est pas déduit,
c'est le `campaign_name` le plus récent réellement récolté ; sans aucun nom
récolté, la ligne n'est pas touchée. Deux `RAISE NOTICE` encadrent l'`UPDATE` :
combien de lignes avant, combien restent après. Idempotent.

### Vérifié

- **18 vérifications neuves**, `.scratch/construction/harnais/43-nom-fabrique/`
  — dont l'écriture de bout en bout (`auto_label` avec Gemini remplacé par une
  réponse fixe), pas seulement le champ préparé. Rejouées contre le code
  d'avant : **10 tombent**, pour la bonne raison. Toutes passent après.
- `python3.12 -m py_compile saas/recos_ia/labeling.py` : vert.
- **Le périmètre de l'`UPDATE` a été mesuré en lecture seule sur la base de
  production** — exactement **2 lignes**, et les noms qu'elles recevraient :

  | campaign_id | avant | après |
  |---|---|---|
  | 24176742897 | `Campagne 24176742897` | `CH_FR_PMax_Herbst_2026` |
  | 24187314124 | `Campagne 24187314124` | `CH_DE_PMax_Herbst_2026` |

- **1 874 vérifications au total sur le dépôt, aucun échec.**

### Ce qu'il reste à faire, et par qui

1. **David joue `supabase/migrations/nom_google_fabrique.sql`** dans l'éditeur
   SQL Supabase. C'est une écriture : elle ne se lance pas d'ici.
2. Puis un passage du worker — cron du Jour de travail (07:00 UTC) ou
   `weekly-fetch.yml` à la main. `label_only` suffit pour l'étiquetage ;
   `report_only` pour voir le ROAS reconstruit. **Rien ne se verra en cliquant
   dans l'app.**

À ce moment-là, 352.00 CHF de revenu réel retrouvent leur thème, et les deux
campagnes redeviennent classables sur leur vrai nom au lieu du fourre-tout
« Campagne Générale ».

### Les deux notes de côté, non traitées ici

- `fetch_all.py` l. 605 avale l'erreur de `fetch_campaign_statuses` :
  `smap, _ = ...`. Si la requête échoue, aucun nom n'est écrit et **rien ne le
  dit**. Mérite sa correction.
- `upsert_google_campaign_config` (`insert_data.py` l. 471) n'a aucun appelant.
  Code mort.
