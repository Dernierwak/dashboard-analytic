# Meta donne-t-il des métriques par asset ?

Recherche du ticket `.scratch/meta-ads/issues/03-meta-donne-t-il-des-metriques-par-asset.md`.
Menée le 2026-09-28. **Sources primaires uniquement** : `developers.facebook.com`.
Chaque affirmation porte le lien de la page qui la dit. Ce que la doc ne dit pas est
signalé comme tel, jamais comblé.

Version courante de l'API Graph au moment de la recherche : **v26.0** (publiée le
2026-07-29), v25.0 depuis le 2026-02-18 — [Graph API Versions](https://developers.facebook.com/docs/graph-api/changelog/versions/).
Les pages du guide Insights montrent leurs exemples en `v25.0`
([Ads Insights API](https://developers.facebook.com/docs/marketing-api/insights/)).

---

## 1 · Quels breakdowns d'asset existent, sur quelle version, pour quelles métriques

### Les huit breakdowns d'asset

Le guide des breakdowns documente huit valeurs d'asset, décrites chacune comme
« The ID of the … asset involved in impression, click, or action » —
[Breakdowns](https://developers.facebook.com/docs/marketing-api/insights/breakdowns/) :

| Breakdown | Ce qu'il ventile |
|---|---|
| `image_asset` | l'image |
| `video_asset` | la vidéo |
| `body_asset` | le texte principal |
| `title_asset` | le titre |
| `description_asset` | la description |
| `call_to_action_asset` | le bouton d'appel à l'action |
| `link_url_asset` | l'URL de destination |
| `ad_format_asset` | le format de l'annonce |

La même liste de huit est reprise par la page dédiée
[Insights (asset feed spec)](https://developers.facebook.com/docs/marketing-api/ad-creative/asset-feed-spec/insights/).

Ils ne renvoient pas le **contenu** de l'asset, seulement son **ID** — c'est
littéralement ce que dit la définition. Pour afficher le texte ou l'image, il faut
le contenu, qui vient d'ailleurs (l'objet `asset_feed_spec` de la créa). C'est
exactement la distinction déjà tranchée dans la carte (« Lire le texte d'un asset ≠
mesurer un asset »).

### Les métriques admises : six, et c'est tout

Sous le titre « Dynamic Creative asset breakdowns », le guide écrit : « All Dynamic
Creative asset breakdowns only support a limited set of metrics », et liste —
[Breakdowns](https://developers.facebook.com/docs/marketing-api/insights/breakdowns/) :

```
impressions
clicks
spend
reach
actions
action_values
```

La page Insights de l'asset feed spec détaille de son côté `clicks`, `impressions`
et `actions`, et ajoute : « Facebook supports different values derived from the
fields above. For example you can also retrieve `ctr` and
`actions_per_impressions` » —
[Insights (asset feed spec)](https://developers.facebook.com/docs/marketing-api/ad-creative/asset-feed-spec/insights/).

**Conséquence directe pour Pulse** : le drill-down du brief voulait « les métriques
de la catégorie active » en colonnes. Le module **Conversion** repose sur des
conversions et un coût par conversion : `actions` et `action_values` sont dans la
liste, donc ce volet est techniquement atteignable. Mais **tout ce qui est calculé
hors de ces six** (fréquence, CPM dérivé d'autres agrégats, vues de vidéo,
`video_avg_time_watched_actions`, `frequency`) n'est pas servi à ce niveau. Une
colonne qui existe au niveau annonce n'existe pas forcément au niveau asset.

### Versions

Aucune page consultée ne dit « depuis la version vX ». Les breakdowns d'asset
figurent dans la référence de paramètre courante
([Ad Account, Insights](https://developers.facebook.com/docs/marketing-api/reference/ad-account/insights/))
et le guide historique existe depuis au moins `v2.7`
([Breakdowns v2.7](https://developers.facebook.com/docs/marketing-api/insights/breakdowns/v2.7)),
donc ce n'est pas une nouveauté. **Je n'ai pas trouvé de note de changelog qui les
introduise ou les déprécie** : à traiter comme stable, pas comme garanti.

---

## 2 · À quelles annonces ils s'appliquent

**L'hypothèse du ticket est confirmée, avec une nuance qui l'élargit un peu.**

La phrase d'ouverture de la page Insights de l'asset feed spec délimite le
périmètre :

> « You can read insights for ad set and ad objects using Dynamic Creative,
> Placement Asset Customization, and Segment Asset Customization. »

— [Insights (asset feed spec)](https://developers.facebook.com/docs/marketing-api/ad-creative/asset-feed-spec/insights/)

Et, plus loin, sur ce qu'on obtient :

> « For Dynamic Creative, we currently show only creative-asset level breakdowns
> such as metrics by image, title, body, video. »

Trois familles d'annonces, donc, pas une — mais les trois ont le même point commun :
**elles se construisent toutes avec un `asset_feed_spec`**, c'est-à-dire avec
plusieurs assets étiquetés et un mécanisme de choix.

- **Dynamic Creative** : « Provide your creative through the `asset_feed_spec`
  field, also known as Asset Feed », et `is_dynamic_creative` à `true` sur l'ad set —
  [Dynamic Creative](https://developers.facebook.com/docs/marketing-api/ad-creative/asset-feed-spec/dynamic-creative/).
- **Placement Asset Customization** : « Set `asset_customization_rules` inside your
  `asset_feed_spec` », avec « every `asset_feed_spec` needs to have more than one
  customization rule attached to it » —
  [Placement Asset Customization](https://developers.facebook.com/docs/marketing-api/dynamic-creative/placement-asset-customization/).
  Cette page **ne mentionne pas** `is_dynamic_creative` : c'est donc un chemin
  d'asset breakdowns qui n'exige pas la créa dynamique au sens strict.
- **Segment Asset Customization** : citée dans la même phrase d'ouverture ; page
  [Segment Asset Customization](https://developers.facebook.com/docs/marketing-api/dynamic-creative/segment-asset-customization/)
  (non lue en détail dans cette passe).

Le guide des breakdowns nomme d'ailleurs la section « **Dynamic Creative** asset
breakdowns » et attache la restriction de métriques à ce nom —
[Breakdowns](https://developers.facebook.com/docs/marketing-api/insights/breakdowns/).

### Ce que renvoie l'API pour une annonce à créa unique

**La doc ne le dit pas.** Aucune page consultée ne décrit le résultat d'une requête
`breakdowns=image_asset` sur une annonce ordinaire à une seule créa : ni ligne vide,
ni erreur, ni ligne unique. Le silence est complet, et je ne le comble pas.

Ce que la doc établit en revanche, et qui suffit à la décision produit : le
breakdown ventile par **ID d'asset**, et ces IDs viennent des assets étiquetés d'un
`asset_feed_spec`. Une annonce classique n'a pas d'`asset_feed_spec`. Il n'existe
donc aucune source documentée de ventilation pour elle. **Construire une ligne
« Asset » pour toutes les annonces reviendrait à parier sur un comportement
d'API non documenté** — ce que `CLAUDE.md` §7 interdit.

Le point à vérifier empiriquement, s'il faut trancher plus finement : une requête
réelle sur une annonce à créa unique du compte, lancée une fois, dit ce que la doc
ne dit pas. C'est une mesure, pas une lecture, et elle n'est pas dans le périmètre
de ce ticket.

### Une restriction de niveau, à ne pas rater

> « By design, `image_asset` and `video_asset` breakdowns are not available at the
> ad account level for assets used in Dynamic Creative. »

— [Breakdowns](https://developers.facebook.com/docs/marketing-api/insights/breakdowns/)

Les exemples officiels interrogent d'ailleurs `<AD_ID>/insights` et
`<ADSET_ID>/insights`, jamais le compte —
[Insights (asset feed spec)](https://developers.facebook.com/docs/marketing-api/ad-creative/asset-feed-spec/insights/).
Autrement dit : pas de récolte en un appel sur tout le compte pour l'image et la
vidéo. Il faut boucler **annonce par annonce** (ou ad set par ad set), ce qui pèse
sur les quotas — le sujet du ticket 04.

### Une agrégation qui déforme le carrousel

> « In the asset insights breakdown, we aggregate impression-based metrics for
> in-card assets for all cards to the assets in the first card. »

— [Dynamic Creative](https://developers.facebook.com/docs/marketing-api/ad-creative/asset-feed-spec/dynamic-creative/)

Sur un carrousel, les métriques des assets des cartes 2..n sont **recollées sur les
assets de la première carte**. Un tableau par asset sur un carrousel n'attribue donc
pas les impressions à la bonne carte : la doc le dit, et un écran qui l'ignore
affiche un chiffre faux.

---

## 3 · Se combinent-ils avec une ventilation par jour ?

**Réponse honnête : la doc ne le dit pas, et c'est un trou qui compte.**

Ce que la doc dit :

- Les breakdowns d'asset se combinent avec **l'âge et le genre**, et rien d'autre
  n'est cité : « You can combine these in your results with these breakdowns: age,
  gender, age, gender » — l'exemple officiel est `breakdowns=image_asset,age` —
  [Insights (asset feed spec)](https://developers.facebook.com/docs/marketing-api/ad-creative/asset-feed-spec/insights/).
- Les breakdowns d'asset **n'apparaissent pas** dans la liste des permutations
  valides du guide (`age`, `gender`, `country`, `publisher_platform`,
  `platform_position`, `impression_device`, `product_id`, les `hourly_stats_*`,
  les cartes de carrousel…) — [Breakdowns](https://developers.facebook.com/docs/marketing-api/insights/breakdowns/).
  Leur régime est décrit **à part**, dans la section Dynamic Creative.
- La granularité temporelle n'est **pas** un breakdown : c'est le paramètre
  `time_increment`, « monthly », « all_days », ou un entier de 1 à 90, défaut
  « all_days » — [Ad Account, Insights](https://developers.facebook.com/docs/marketing-api/reference/ad-account/insights/).
  Donc la liste des permutations de breakdowns ne le concerne pas.

Ce que la doc **ne** dit **pas** : aucune page consultée — ni le guide des
breakdowns, ni la page Insights de l'asset feed spec, ni la référence de paramètres —
ne parle de `time_increment` **en présence** d'un breakdown d'asset. Il n'y a ni
autorisation explicite, ni interdiction explicite, ni exemple.

**Pour les courbes quotidiennes du dashboard, c'est un point bloquant à mesurer
avant d'être promis.** `time_increment=1` combiné à `breakdowns=body_asset` sur une
annonce dynamique réelle donne la réponse en un appel. Tant qu'elle n'est pas
prise, aucune courbe quotidienne par asset ne doit être spécifiée : ce serait un
comportement d'API deviné.

Un point voisin, lui documenté, va dans le sens de la prudence : « video_* fields
cannot be requested with any hourly stats breakdowns » et
« video_avg_time_watched_actions field cannot be requested with the region
breakdown » — [Breakdowns](https://developers.facebook.com/docs/marketing-api/insights/breakdowns/).
Meta pose bien des interdictions de croisement métrique × breakdown, et elles ne
sont pas toutes rassemblées au même endroit.

---

## 4 · Y a-t-il des combinaisons interdites, et l'API rejette-t-elle tout ?

### Des combinaisons restreintes : oui, explicitement

> « Due to storage constraints, only some permutations of breakdowns are available. »

— [Breakdowns](https://developers.facebook.com/docs/marketing-api/insights/breakdowns/)

Le modèle de Meta est donc une **liste blanche**, pas une combinatoire libre. Les
restrictions documentées, rassemblées :

- seules certaines permutations de breakdowns existent (liste blanche ci-dessus) ;
- `image_asset` et `video_asset` : pas au niveau compte pour la créa dynamique ;
- asset breakdowns : six métriques seulement ;
- `video_*` : pas avec les breakdowns horaires ;
- `video_avg_time_watched_actions` : pas avec `region` ;
- `reach` : depuis le 10 juin 2025, un breakdown sur des dates de plus de 13 mois
  ne renvoie plus `reach` en requête standard ; il faut un job asynchrone, plafonné
  à 10 requêtes par compte et par jour, suivi par l'en-tête
  `x-Fb-Ads-Insights-Reach-Throttle`, et au-delà : « Reach-related metric breakdowns
  are unavailable due to rate limit threshold » —
  [Limits & Best Practices](https://developers.facebook.com/docs/marketing-api/insights/best-practices/).
  `reach` étant l'une des six métriques d'asset, ce plafond s'applique de plein
  fouet à une lecture historique par asset.

### Le mode d'échec : rejet documenté, mais pas pour ce cas précis

La question du ticket — « l'API rejette-t-elle la requête entière au lieu de la
tronquer, comme Google Ads sur `change_event` ? » — n'a **pas** de réponse
documentée pour les combinaisons de breakdowns. Les pages listent ce qui est
supporté ; **elles ne décrivent pas ce qui arrive quand on demande autre chose.**

Ce qui est documenté, et qui montre que Meta rejette plutôt qu'il ne tronque :

- La table d'erreurs de la référence Insights porte `100 — Invalid parameter`,
  `3001 — Invalid query`, `2500 — Error parsing graph query`,
  `105 — The number of parameters exceeded the maximum for this operation`,
  `3018 — The start date of the time range cannot be beyond 37 months from the
  current date` — [Ad Account, Insights](https://developers.facebook.com/docs/marketing-api/reference/ad-account/insights/).
  Aucune de ces entrées ne nomme les breakdowns : je ne peux donc pas affirmer
  laquelle tombe sur une combinaison invalide.
- Trop de données demandées **échoue**, elle ne se tronque pas :
  « error_code = 100, CodeException (error subcode: 1487534) », avec la
  recommandation de réduire la plage de dates et d'éviter les breakdowns à forte
  cardinalité — [Limits & Best Practices](https://developers.facebook.com/docs/marketing-api/insights/best-practices/).
  Un breakdown d'asset **est** à forte cardinalité (un ID par asset), et croisé avec
  `time_increment=1` il multiplie les lignes.
- Le débordement de quota global : « error_code = 4, CodeException (error subcode:
  1504022), error_title: Too many API requests », en-tête
  `x-fb-ads-insights-throttle` à surveiller — même page.

**Le comportement de rejet « tout ou rien » sur une combinaison non supportée
n'est pas documenté. Il se mesure, il ne se suppose pas.**

---

## Pas encore établi

Les points que cette recherche laisse ouverts, et qui demandent une **mesure**
(un appel réel), pas une lecture :

1. **Ce que renvoie `breakdowns=image_asset` sur une annonce à créa unique** : ligne
   vide, ligne unique, ou erreur. La doc est muette.
2. **`time_increment=1` + breakdown d'asset** : accepté ou refusé. Point bloquant
   pour toute courbe quotidienne par asset.
3. **Le mode d'échec d'une combinaison non supportée** : rejet total (avec quel code)
   ou troncature silencieuse.
4. **Segment Asset Customization** : citée comme troisième famille éligible, sa page
   n'a pas été lue en détail dans cette passe.
5. **Les breakdowns d'asset « nouvelle génération »** — `flexible_format_asset_type`,
   `creative_automation_asset_id`, `gen_ai_asset_type`, `media_type`,
   `media_text_content` — existent dans l'énumération de la référence
   ([Ad Account, Insights](https://developers.facebook.com/docs/marketing-api/reference/ad-account/insights/))
   mais **n'apparaissent nulle part dans le guide des breakdowns** : ni définition,
   ni métriques admises, ni périmètre. Les annonces Advantage+ / flexible format
   passent probablement par eux. Non documentés = non utilisables en l'état ; c'est
   une piste, pas un acquis.

---

## Conclusion

**Le niveau asset est mesurable seulement sous condition : l'annonce doit être bâtie
sur un `asset_feed_spec` (Dynamic Creative, Placement Asset Customization ou Segment
Asset Customization), et alors sur six métriques seulement (`impressions`, `clicks`,
`spend`, `reach`, `actions`, `action_values`), annonce par annonce ou ad set par ad
set — jamais au niveau compte pour l'image et la vidéo ; pour une annonce à créa
unique, aucune ventilation par asset n'est documentée, donc une ligne « Asset » dans
un tableau qui couvre toutes les annonces serait un écran qui ment.**
