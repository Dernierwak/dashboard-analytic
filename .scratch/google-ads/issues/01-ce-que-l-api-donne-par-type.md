# 01: Ce que l'API Google Ads donne, type de campagne par type

Type: research
Status: open
Blocked by: —
Assignee: —

## Question

Pour chacun des types **Search, Performance Max, Display, Video (YouTube)** —
et, plus brièvement, Shopping, Demand Gen et App —, **que rend l'API Google
Ads (GAQL, version courante)** ?

En particulier :
- **le type lui-même** : `campaign.advertising_channel_type` et
  `advertising_channel_sub_type` — valeurs, et comment se classent les
  campagnes vidéo (in-stream, bumper, Demand Gen vidéo…) ;
- **les métriques valides par type** : impressions, clics, coût, conversions,
  `all_conversions`, `conversions_value`, `view_through_conversions`,
  `video_views` / `video_trueview_views`, `video_view_rate`, quartiles de
  lecture (`video_quartile_p25…p100_rate`), `engagements`, `interactions`,
  portée / fréquence unique (si elle existe encore) — **lesquelles sont
  rejetées, lesquelles valent 0 sans le dire** ;
- **les niveaux sous la campagne** : groupe d'annonces et annonce (Search,
  Display, Video), **groupe d'éléments et éléments pour PMax**
  (`asset_group`, `asset_group_asset` : ce qui a des métriques, ce qui n'a
  qu'un libellé de performance) ; mots-clés et termes de recherche
  (`keyword_view`, `search_term_view`) ; vidéo YouTube rattachée ;
- **PMax** : quelle ventilation par réseau (Search / YouTube / Display /
  Discover / Gmail) l'API rend aujourd'hui, à quel niveau, avec quelles
  limites ;
- **la date d'attribution des conversions** (date du clic ou de la
  conversion) et leur délai de stabilisation ;
- **la profondeur d'historique** lisible et les plafonds qui rejettent une
  requête entière (comme `change_event` à 30 jours, `CLAUDE.md` §8).

## Rendu attendu

Un tableau **métrique × type de campagne** (rendue / rejetée / 0 silencieux)
et un tableau **niveau × type**, chaque cellule sourcée (doc Google Ads API,
lien et date de lecture). Findings sur la branche jetable
`research/google-api-types`, fichier `.scratch/google-ads/research/api-types.md`,
poussée sans PR ; pointeur de contexte ici.
