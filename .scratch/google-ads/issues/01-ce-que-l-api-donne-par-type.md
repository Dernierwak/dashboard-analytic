# 01: Ce que l'API Google Ads donne, type de campagne par type

Type: research
Status: resolved
Blocked by: —
Assignee: Claude

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

## Answer

Tableaux sourcés (API v26, sortie le 2026-10-14 ; 21 pages
developers.google.com lues les 2026-11-08 et 09) : branche
`research/google-api-types` (`3f1af21`),
`git show origin/research/google-api-types:.scratch/google-ads/research/api-types.md`.

- **L'API contrôle par ressource (`FROM …`), jamais par type de campagne.**
  Une métrique vidéo demandée sur du Search n'est pas rejetée ; la doc ne dit
  pas si elle revient à 0 ou vide → « ? » à trancher à l'essai réel (ticket
  10). Google ne rend pas les lignes entièrement à 0 : une ligne absente n'est
  pas un zéro de Google.
- **Le socle commun à tous les types** : impressions, clics, coût, CTR, CPC
  moyen, conversions, valeur de conversion, toutes conversions,
  interactions, `conversions_by_conversion_date`. C'est le seul jeu qu'une
  vue générale peut totaliser (ticket 05).
- **Propre à la vidéo** : vues TrueView, taux de vue, CPV, quartiles, durée
  de visionnage, likes / commentaires / partages Shorts (v26).
  `video_views`, `video_view_rate`, `average_cpv` **n'existent plus** en v26.
  In-stream / bumper / Shorts ne sont pas des sous-types : le format se lit
  par `segments.ad_format_type`. **Demand Gen est un type à part**
  (`DEMAND_GEN`), avec groupes d'annonces.
- **Portée et fréquence** (`unique_users`) : par campagne seulement, Display,
  Vidéo, Demand Gen et App ; **ne s'additionne pas**, 92 jours maximum, peut
  revenir masquée (v26, avec sa raison) → elle se demande sur la période
  entière et s'écrit « — » avec la raison quand Google la masque.
- **PMax** : `ad_group` / `ad_group_ad` répondent **sans aucune ligne PMax ni
  erreur** — la table par annonce actuelle le perd sans le dire. Pas de
  performance par annonce, pas de quartiles ; le libellé de performance des
  éléments est retiré (v23). En revanche `asset_group` et `asset_group_asset`
  portent de vraies métriques, et `segments.ad_network_type` ventile PMax
  par réseau (Search, Partenaires, Display, YouTube, Discover, Gmail, Maps,
  Google TV) depuis la v23. Termes de recherche PMax : seulement
  `campaign_search_term_view`.
- **Date des conversions** : `conversions_by_conversion_date` est datée par la
  conversion ; que `metrics.conversions` soit datée par le clic est une
  **déduction**, sans phrase de Google. Aucun délai de stabilisation trouvé.
- **Plafonds qui rejettent** : 37 mois pour une requête segmentée par jour ou
  par semaine, 11 ans par mois ; `change_event` à 30 jours repris de
  `CLAUDE.md`, non relu.
- **La récolte actuelle** (v25) ne demande qu'impressions, clics, coût,
  conversions, CTR, CPC. Manquent : le type de campagne, valeur et toutes
  conversions, conversions après affichage, tout le vidéo et le format
  d'annonce, la portée, `asset_group(_asset)` et la ventilation par réseau,
  mots-clés et termes. La docstring de `_query.py` annonce encore `/v17`.
