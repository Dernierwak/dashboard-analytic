# 17: Le jour d'un changement, dans le fuseau du compte

Type: task
Status: needs-triage
Blocked by: 11

Trouvé en construisant le ticket 11. `platform_changes.occurred_at` est un
`timestamptz` : PostgreSQL ramène l'instant à UTC et le fuseau d'origine est
perdu. Les jours des insights (`meta_ads_insights.date_start`), eux, sont ceux
du **fuseau du compte publicitaire**. Un geste fait à Zurich entre minuit et
deux heures se pose donc, sur la Tendance, la veille du jour où ses effets
apparaissent. Le ticket 11 l'assume et écrit l'heure « UTC » dans le panneau.

Le commentaire de `saas/web/lib/changements-api.ts` (« stocké tel que la
plateforme l'a écrit, dans le fuseau du compte ») est faux pour la même raison.

**What to build:** les points et le panneau se posent sur le jour du compte.

- [ ] Récolter le fuseau du compte Meta (`timezone_name` de `/act_<id>`) — ou
      garder l'heure locale brute à côté de `occurred_at` ; à trancher
- [ ] `lib/meta/changements.ts` découpe le jour et l'heure dans ce fuseau
      (testé : 00:30 à Zurich se pose sur le jour même) ; l'écran ne dit plus
      « UTC »
- [ ] Le commentaire de `lib/changements-api.ts` est corrigé
