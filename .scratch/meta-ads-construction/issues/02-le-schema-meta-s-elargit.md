# 02: Le schéma Meta s'élargit (étape A)

Type: task
Status: ready-for-agent
Blocked by: 01

**What to build:** la base sait porter tout ce que la récolte va rapporter, sans
rien perdre ni rien casser. Ce ticket est la seule tranche horizontale du
chantier, et c'est voulu : le `000` est un fichier unique, et une fois joué il
débloque trois tickets en parallèle (03, 05, 06). Tout est **additif** et nullable.

Le détail est dans la spec, § « Les colonnes et tables nouvelles » et
§ « L'identité par ID » (étape A) ; la forme des tables de créas est dans la
recherche de la carte (`.scratch/meta-ads/recherche/champs-api-meta.md`),
§ « Le SQL proposé » (c) et (d).

- [ ] `meta_ads_insights` gagne `campaign_id`, `adset_id`, `attribution_setting`
      (text) et `results` (jsonb, la liste brute) — tous nullables
- [ ] `meta_campaign_config` gagne `campaign_id`, nullable ; sa clé ne change pas
      ici (c'est le ticket 13)
- [ ] `meta_ads_creatives` (une ligne par annonce) et `meta_ads_creative_assets`
      (clé = annonce, provenance, nature, rang ; aucun `asset_id`) existent, avec
      RLS `*_own` et déclencheur `set_updated_at` sur le patron de
      `meta_ads_insights`
- [ ] Ne se construisent pas : `meta_ads_actions`, `inline_link_clicks`, `date_stop`
- [ ] Aucun `DROP`, `DELETE` ni `TRUNCATE`
- [ ] Le `000` joué deux fois sur un PostgreSQL jetable chargé, et deux fois sur
      une base vierge : exit 0 (précédent : la `998`, ticket 02 de la carte)
- [ ] David a joué le `000` sur Supabase
