# Meta donne-t-il des métriques par asset ?

Type: research
Status: resolved
Blocked by: —

## Question

Le brief demande un drill-down qui descend jusqu'à l'**asset** (texte, titre,
image) avec « les métriques de la catégorie active » en colonnes. Je soupçonne que
Meta ne ventile les métriques par asset que pour les **créas dynamiques** (les
`breakdowns` du type `image_asset`, `body_asset`, `title_asset`,
`video_asset`), et pas pour une annonce classique à une seule créa.

**Si c'est vrai, une ligne « Asset » dans le tableau serait vide pour la majorité
des annonces** — un écran qui ment, donc interdit par `CLAUDE.md` §7.

À établir, sources primaires seulement (documentation Meta Marketing API, pas des
billets de blog) :

1. Quels `breakdowns` d'asset existent, sur quelle version de l'API Graph, et pour
   quelles métriques.
2. À quelles annonces ils s'appliquent : toutes, ou seulement celles en créa
   dynamique / Advantage+ ? Que renvoie l'API pour une annonce à créa unique ?
3. Ces breakdowns se combinent-ils avec une ventilation par jour ? Le dashboard
   trace des courbes quotidiennes — un breakdown qui n'existe qu'en cumul ne sert
   pas les courbes.
4. Y a-t-il des combinaisons interdites (l'API rejette la requête entière au lieu
   de la tronquer, comme Google Ads le fait sur `change_event` au-delà de 30
   jours — voir `CLAUDE.md` §8) ?

**Livrable** : `.scratch/meta-ads/recherche/metriques-par-asset.md` — la réponse,
chaque affirmation avec son lien vers la doc, et une conclusion nette : le niveau
asset est mesurable / ne l'est pas / l'est sous condition X.

Si la réponse est « non », ce n'est pas un échec : le ticket 06 construit de toute
façon la consultation du **contenu** des assets, qui est le besoin réel de David.

## Answer

**Hypothèse confirmée, et élargie.** Rapport complet, 26 liens vers la doc Meta :
[`.scratch/meta-ads/recherche/metriques-par-asset.md`](../recherche/metriques-par-asset.md).

**Le niveau asset est mesurable SOUS CONDITION.** Huit breakdowns existent
(`image_asset`, `video_asset`, `body_asset`, `title_asset`, `description_asset`,
`call_to_action_asset`, `link_url_asset`, `ad_format_asset`), mais :

1. **Ils ne rendent que l'ID de l'asset, pas son contenu.** Conséquence directe : le
   texte que David veut pouvoir lire NE vient PAS de là. Il vient de l'endpoint des
   créas (ticket 04). Les deux besoins sont donc techniquement disjoints, pas
   seulement conceptuellement — le ticket 06 n'a plus besoin d'attendre celui-ci.
2. **Six métriques seulement** : `impressions`, `clicks`, `spend`, `reach`,
   `actions`, `action_values`. Pas de CPM, pas de CTR, pas de fréquence — donc pas
   de « colonnes de la catégorie active » au niveau asset comme le brief le
   demandait.
3. **Périmètre plus large que « créa dynamique »** : les trois familles bâties sur
   un `asset_feed_spec` (Dynamic Creative, Placement Asset Customization — qui
   n'exige pas `is_dynamic_creative` — et Segment Asset Customization).
4. **Pour une annonce à créa unique, la doc ne dit RIEN.** Ni oui, ni non, ni
   exemple. Une ligne « Asset » dans un tableau qui couvre toutes les annonces
   serait donc vide ou fausse pour le cas le plus courant : interdit par
   `CLAUDE.md` §7.
5. **Deux pièges documentés en plus** : `image_asset` / `video_asset` sont
   **interdits au niveau compte** (il faut boucler annonce par annonce, donc charge
   de quotas), et **sur un carrousel les métriques des cartes 2..n sont recollées
   sur la première carte** — un chiffre par carte serait donc faux.
6. **Les courbes quotidiennes par asset : NON ÉTABLI.** La doc ne dit rien de
   `time_increment` combiné à un breakdown d'asset. Les seules combinaisons citées
   sont `age` / `gender`. Rien de quotidien par asset ne doit être spécifié avant
   une mesure réelle.
7. **Contrainte qui déborde sur la récolte** : depuis le 10 juin 2025, `reach`
   n'est plus rendu **avec un breakdown** au-delà de 13 mois, sauf job asynchrone
   plafonné à 10/jour/compte. À garder en tête pour la période « Tout » de `/meta`.

**Ce que ça tranche** : pas de métriques par asset dans la v1 du dashboard. Le
tableau s'arrête à l'annonce. Voir la carte, section « Hors périmètre ».

**Ce qui reste ouvert et ne se règle que par un appel réel** (donc pas par de la
lecture, donc pas dans cette carte) : le retour de l'API pour une créa unique,
`time_increment=1` combiné à un breakdown d'asset, et le mode d'échec d'une
combinaison invalide. Déposé au `BACKLOG.md`.
