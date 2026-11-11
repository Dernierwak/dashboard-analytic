# 02: Le type de campagne, en API v26

**Status:** ready-for-agent

**Blocked by:** 01

**What to build:** la récolte Google passe à l'API v26 et rapporte, pour chaque
campagne et chaque jour, son **Type de campagne** et les colonnes de conversion
qui manquent. Le client voit le repère de type (Search, PMax, Display, Vidéo,
Demand Gen, Autres types) à côté de chaque campagne du menu du Bandeau.

Spec : § Le Type de campagne, § Les colonnes et tables nouvelles
(`google_ads_insights`), § La récolte.

- [ ] Migration additive dans le `000`, rejouable : type de campagne (texte brut de `advertising_channel_type`), `conversions_value`, `all_conversions`, `view_through_conversions`, tous nullables.
- [ ] La récolte demande ces champs dans la même requête que les métriques existantes ; une colonne non lue reste `NULL`, jamais 0 ; un jour omis par Google n'est pas écrit à 0.
- [ ] Toute la récolte Google Ads tourne en v26 (v26 vérifiée au ticket 10 de la carte).
- [ ] Harnais récolte (réponse GAQL écrite à la main → lignes) : type recopié brut, colonne absente → `NULL`, micro converti une seule fois.
- [ ] La lecture traduit le type en six libellés ; « Autres types » regroupe le reste ; une campagne sans type lu n'est jamais rangée dans un type au hasard.
- [ ] Le menu de campagne du Bandeau porte le repère de type.
- [ ] `python3.12 -m py_compile` sur ce qui est touché ; `tsc` et `build` verts, 18 routes.
- [ ] Le ticket dit qu'il faut **un lancement à la main de `weekly-fetch.yml` avec `force`** (réécrire les 30 jours) pour voir les types, puis la reprise de l'historique au 11.
