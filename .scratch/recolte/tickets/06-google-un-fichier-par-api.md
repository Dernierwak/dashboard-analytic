# 06: Google — un fichier par API, l'écriture à part

Type: task
Status: resolved
Blocked by: 05

**What to build:** `saas/collecte/google/` rangé selon `../map.md`, même
contrat que le ticket 05. **Aucun comportement ne change.**

- `google/ads/` : insights_campagnes, insights_annonces, statuts, budgets,
  changements (la traduction de `change_event`, ~500 lignes).
- `google/analytics/` (ex `ga4/`) : insights, evenements, catalogue.
- Upserts → `collecte/ecriture/google.py`.
- `build_ga4_context` part dans `saas/traitement/` (il met en forme pour le
  rapport ; `traitement/lecteur.py` l'importe aujourd'hui depuis la récolte).
- `collecte/commun/` et `collecte/ga4/` disparaissent.

Bloqué par 05 et pas en parallèle : les deux touchent `fetch_all.py` et
`ecriture/`.

- [x] `saas/traitement/` n'importe plus rien de `saas/collecte/`
- [ ] `git grep` des anciens chemins propre
- [x] `python3.12 -m py_compile` — [ ] **Essai (ticket 08)** sur un vrai compte : mêmes lignes
      Google et GA4, rapport publié

## Comment

**2026-10-07 — construit et vérifié hors ligne. L'Essai (08) reste à passer ;
des références hors de mon périmètre restent à corriger (liste plus bas).**

La forme :
```
google/acces.py                 AccesGoogle(jeton, client, propriete, login)
google/auth/oauth.py            ex collecte/commun/fetch_token.py, tel quel
google/ads/gaql.py              version d'API, entetes(), micros(), fin_declaree()
google/ads/budgets.py           budget planifié
google/ads/statuts.py           statut + dates déclarées
google/ads/changements.py       change_event + sa traduction (~500 l.)
google/ads/insights_campagnes.py  FROM campaign, par tranche + recuperer
google/ads/insights_annonces.py   FROM ad_group_ad, par tranche + recuperer
google/ads/recolte.py           l'ordre des appels + écritures (ex _fetch_google)
google/analytics/rapport.py     les deux bases d'API, numero_propriete()
google/analytics/insights.py    runReport jour × source/medium/campagne
google/analytics/evenements.py  FUNNEL_EVENTS + runReport filtré
google/analytics/catalogue.py   noms d'événements + événements clés
google/analytics/recolte.py     ex run_ga4_fetch, mêmes paramètres
ecriture/google.py              upserts Google Ads + GA4 (sortis de insert_data)
saas/traitement/ga4_contexte.py build_ga4_context (sorti de la récolte)
```
`collecte/commun/`, `collecte/ga4/` et `google/fetch_google_ads.py` sont
supprimés. Les pavés transverses de `fetch_all.py` (LE RECOUVREMENT, CE QUE ÇA
COÛTE, PROFONDEUR D'HISTORIQUE) vivent maintenant en tête de
`socle/fenetre.py` ; chaque constante de plateforme est à côté de sa récolte.

Décision prise en chemin — **quatre fonctions mortes ne déménagent pas** :
`list_accessible_customers`, `list_managed_accounts` (Google Ads),
`list_ga4_properties`, `get_property_summary` (GA4). `git grep` : aucun
appelant (le choix du compte se fait côté web, en TypeScript). La première
écrivait en plus un FRAGMENT du jeton d'accès et du developer-token dans son
message d'erreur (`access_token[:8]…[-4:]`), contre `CLAUDE.md` §7 : la
recopier dans la forme neuve l'aurait perpétuée. Elles restent dans
l'historique git. Les fonctions mortes de `saas/commun/insert_data.py`, elles,
restent où elles sont (règle de `saas/commun/CLAUDE.md`).

Aucun comportement ne change : mêmes requêtes, mêmes messages, même ordre.
La seule différence de forme : `budgets`, `statuts`, `changements` et le
catalogue exposent aussi `recuperer(acces, fenetre, limite) -> (lignes,
trous)` pour l'essai ; la récolte garde ses appels d'origine.

Vérifié :
- `py_compile` sur tout `saas/collecte`, `saas/commun`, `saas/traitement`,
  `saas/emailing` ; `pyflakes` sans remarque ; les trois modules
  (`fetch_all`, `build_report`, `lecteur`) s'importent.
- `harnais/06_google.py` → `TOUT VERT` : chaque fichier d'API contre une
  fausse API Google (sentinelle 2037, micros, `change_event` traduit,
  catalogue marqué clé) ; récolte Google Ads de bout en bout (5 tables
  écrites) ; récolte GA4 de bout en bout (catalogue, insights, événements) ;
  aucun import de `saas.collecte` dans `saas/traitement/` (lu par l'AST).
- `harnais/01_trous.py` réécrit sur les nouveaux modules → `TOUT VERT` ;
  `02_socle.py`, `05_meta.py` → `TOUT VERT` ; harnais meta-ads 04/05/13 →
  60 passed.

Pas fait — hors de mon périmètre (consigne : ni `saas/web/`, ni `supabase/`) :
- `saas/web/legal/GOOGLE_VERIFICATION.md` l. 57 et
  `saas/web/legal/OAUTH_DEMO_VIDEO_SCRIPT.md` l. 96 citent
  `saas/collecte/ga4/fetch_ga4.py` l. 87-95 et 367-375 : les dimensions
  demandées sont désormais dans `saas/collecte/google/analytics/insights.py`
  (corps `dimensions` de `tranche`) et `evenements.py` (idem).
- Commentaires : `saas/web/app/conversions/page.tsx` l. 63,
  `saas/web/lib/changements-api.ts` l. 90, `saas/web/lib/oauth-api.ts` l. 117.
- **Trouvé en chemin, à trier** : `saas/web/lib/oauth-api.ts` l. 117 déclare
  `ADS_VERSION = "v21"; // aligné sur collecte/google/fetch_google_ads.py` —
  or la récolte est en v25 et v21 est sunsettée depuis le 5 août 2026
  (commentaire de `google/ads/gaql.py`). Si ce fichier appelle l'API Google
  Ads, il rend un 404.
- `supabase/migrations/000_run_me_all.sql` l. 1191,
  `campagnes_dates_declarees.sql` l. 22, `ga4_event_catalog.sql` l. 9 :
  commentaires SQL qui citent les anciens chemins.

Pas vérifié : contre les vraies API (Essai, ticket 08).
