# 02: Le schéma Meta s'élargit (étape A)

Type: task
Status: ready-for-human
Blocked by: 01

**What to build:** la base sait porter tout ce que la récolte va rapporter, sans
rien perdre ni rien casser. Ce ticket est la seule tranche horizontale du
chantier, et c'est voulu : le `000` est un fichier unique, et une fois joué il
débloque trois tickets en parallèle (03, 05, 06). Tout est **additif** et nullable.

Le détail est dans la spec, § « Les colonnes et tables nouvelles » et
§ « L'identité par ID » (étape A) ; la forme des tables de créas est dans la
recherche de la carte (`.scratch/meta-ads/recherche/champs-api-meta.md`),
§ « Le SQL proposé » (c) et (d).

- [x] `meta_ads_insights` gagne `campaign_id`, `adset_id`, `attribution_setting`
      (text) et `results` (jsonb, la liste brute) — tous nullables
- [x] `meta_campaign_config` gagne `campaign_id`, nullable ; sa clé ne change pas
      ici (c'est le ticket 13)
- [x] `meta_ads_creatives` (une ligne par annonce) et `meta_ads_creative_assets`
      (clé = annonce, provenance, nature, rang ; aucun `asset_id`) existent, avec
      RLS `*_own` et déclencheur `set_updated_at` sur le patron de
      `meta_ads_insights`
- [x] Ne se construisent pas : `meta_ads_actions`, `inline_link_clicks`, `date_stop`
- [x] Aucun `DROP`, `DELETE` ni `TRUNCATE`
- [x] Le `000` joué deux fois sur un PostgreSQL jetable chargé, et deux fois sur
      une base vierge : exit 0 (précédent : la `998`, ticket 02 de la carte)
- [ ] David a joué le `000` sur Supabase

## Comment

**2026-10-03 — écrit et vérifié hors ligne, en attente de David.**

Tout est dans `supabase/migrations/000_run_me_all.sql` :
- section 0 : `meta_ads_insights` gagne `campaign_id`, `adset_id`,
  `attribution_setting` (text) et `results` (jsonb), nullables et sans
  DEFAULT ; `meta_campaign_config` gagne `campaign_id`, sa clé
  `(user_id, campaign_name)` ne bouge pas ;
- nouvelle section **0bis** : `meta_ads_creatives` et
  `meta_ads_creative_assets` (clé primaire `user_id, ad_id, provenance,
  asset_kind, rang`, aucun `asset_id` ; celle des créas est `user_id, ad_id`), forme de la recherche (c) et (d), RLS `*_own` et
  `set_updated_at` sur le patron de `meta_ads_insights` ;
- les deux tables entrent au **partage** (section 15) — sinon un invité verrait
  le panneau des créas vide — et au bloc CONTRÔLE (2 tables, 5 colonnes) ; la
  note A passe de 17 à 19 tables partagées.

Les seuls `DROP` ajoutés sont des `DROP POLICY/TRIGGER IF EXISTS` sur les objets
neufs, le patron rejouable du fichier. Aucun `DELETE` ni `TRUNCATE`.

**Vérifié** sur un PostgreSQL 15 local et jetable (Postgres.app ; stub `auth`,
rôle `authenticated`, les quatre tables posées à la main avant le `000`) ;
harnais hors de l'arbre, comme le veut la base propre :
- base chargée : ancien `000` (HEAD) + deux clients et des lignes Meta → nouveau
  `000` joué **deux fois** : exit 0 ; lignes d'avant intactes (2 lignes,
  32,75 € de dépense, config « Camp A » 300 € ACTIVE), colonnes neuves `NULL` ;
- base vierge : nouveau `000` **deux fois** : exit 0 ;
- les deux : contrôle **51 lignes, toutes ✓** ; **19** tables portent une
  politique `partage_*` ; `meta_ads_actions`, `inline_link_clicks`,
  `date_stop`, `asset_id` absents ;
- écriture comme la récolte le fera (`results` en liste, upsert sur les deux
  clés d'unicité sans doublon), puis lecture sous le rôle `authenticated` :
  un client ne lit pas les créas d'un autre, il lit les siennes.

**Pas vérifié sur la vraie base Supabase** : c'est le dernier point, à David.

**Pour David** : jouer d'abord la `998` (ticket 01) si ce n'est pas fait — la
spec l'exige avant tout ce qui touche au `000`. Puis SQL editor → coller tout
`000_run_me_all.sql` → exécuter (il affichera « Success. No rows returned ») →
sélectionner seul le bloc CONTRÔLE (du `WITH attendu` à l'`ORDER BY`) et
l'exécuter : toutes les lignes doivent dire ✓, dont les sept nouvelles
(`meta_ads_creatives`, `meta_ads_creative_assets`,
`meta_campaign_config.campaign_id`, `meta_ads_insights.campaign_id` /
`adset_id` / `attribution_setting` / `results`). Aucun passage du worker n'est
nécessaire pour ce ticket : rien n'écrit encore dans ces colonnes (tickets 03
et 05).

Revue de code : aucun bug bloquant. Deux remarques retenues : les deux tables
ont une **clé primaire** (sinon l'éditeur de tables de Supabase les rend en
lecture seule), et la récolte doit **remplacer** les assets d'une annonce à
chaque passage, car la clé sur le rang ne retire rien. C'est noté au ticket 05.
Harnais relancé après ces changements : tout vert.
