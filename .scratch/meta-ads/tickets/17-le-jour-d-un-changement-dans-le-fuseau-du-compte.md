# 17: Le jour d'un changement, dans le fuseau du compte

Type: task
Status: ready-for-human
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

- [x] Récolter le fuseau du compte Meta (`timezone_name` de `/act_<id>`) — ou
      garder l'heure locale brute à côté de `occurred_at` ; à trancher
- [x] `lib/meta/changements.ts` découpe le jour et l'heure dans ce fuseau
      (testé : 00:30 à Zurich se pose sur le jour même) ; l'écran ne dit plus
      « UTC »
- [x] Le commentaire de `lib/changements-api.ts` est corrigé

## Comments

**2026-10-04 — construit et vérifié hors ligne. Reste à le voir sur la vraie
base.**

**Tranché : on récolte `timezone_name`.** L'autre branche n'existe pas chez
Meta : `/activities` écrit `event_time` déjà en UTC (`+0000`), il n'y a pas
d'« heure locale brute » à garder. Le fuseau est lu dans l'appel
`/me/adaccounts` qui existait déjà (`fields=id,timezone_name`) — aucun appel
de plus.

Ce qui a été fait :
- Schéma : `platform_changes.fuseau text` (NULL permis), dans `000` et
  `platform_changes.sql`. Ajout seul, rien n'est réécrit ni effacé.
- Récolte : `compte_et_fuseau` (`fetch_meta_ads.py`) lit le compte et son
  fuseau ; `lignes_activites(actes, parents, fuseau)` le pose sur chaque
  ligne. **Un fuseau inconnu n'est pas envoyé** (ni par la récolte ni par
  `upsert_platform_changes`) : chaque passage relit 180 jours, et un `NULL`
  effacerait par upsert le fuseau déjà acquis.
- `saas/web/lib/fuseau.ts` (sans directive) : `jourEtHeureDans(date, fuseau)`,
  par `Intl.DateTimeFormat` en `hourCycle: "h23"`. Un fuseau absent ou
  illisible rend l'UTC et `fuseau: null`.
- `lib/meta/changements.ts` : `changementDe` découpe dans le fuseau ;
  `ChangementMeta.fuseau` dit si c'est le cas. `lib/meta/donnees.ts` lit
  `fuseau` et élargit la fenêtre d'un jour de chaque côté (aucun fuseau n'est
  à plus d'un jour de l'UTC) ; ce qui déborde ne pose aucun point.
- Le panneau n'écrit plus « UTC » — sauf pour une ligne sans fuseau récolté.
- `lib/changements-api.ts` : le commentaire était faux pour Meta seulement.
  Google écrit l'heure du compte SANS décalage, et le `timestamptz` (session
  UTC) la garde telle quelle : la troncature y est juste. Pour Meta, le fil
  du rapport découpe désormais aussi dans le fuseau (`jourDuCompte`).

**Harnais** : `11-les-changements` — 6 tests remplacent l'ancien « en UTC » :
00:30 à Zurich → jour même, New York recule le jour, heure d'hiver (UTC+1),
fuseau absent → UTC et `fuseau: null`, fuseau illisible → idem, minuit pile
→ « 00:00 » ; 19 verts. `04-le-journal` — 5 tests : le fuseau voyage avec
chaque ligne, inconnu il n'est pas envoyé, l'horodatage reste celui de Meta,
`compte_et_fuseau`, l'upsert l'écrit et ne l'efface jamais ; 28 verts. Les
huit harnais Meta : 195 verts. `tsc --noEmit` et `npm run build` verts,
**18 routes**.

**Pas vérifié** : la forme réelle de `timezone_name` sur le compte de David
(attendu : un nom IANA, « Europe/Zurich »), et l'écran nourri de vraies
lignes.

**Ordre de mise en route — il compte :**
1. David joue `supabase/migrations/000_run_me_all.sql` **avant** le
   déploiement. Sinon la lecture de `fuseau` échoue : `/meta` dit « le journal
   n'a pas pu être lu » et le fil du rapport perd ses changements déclarés.
   Et la récolte Meta voit son journal refusé (PGRST204), le reste passe.
2. Un passage du worker — cron du Jour de travail, ou à la main dans GitHub
   Actions (`weekly-fetch.yml`, sans option) — remplit le fuseau des 180 jours
   relus. Avant, toutes les lignes s'affichent en UTC, avec la mention.

**2026-10-04 — revue (normes et spec), corrigé.**
- Un lot d'upsert qui mêlerait des lignes avec et sans `fuseau` l'aurait mis
  à NULL (PostgREST écrit NULL pour une clé absente d'une ligne du lot) :
  `lots_sans_effacer_la_campagne` fait désormais un lot par jeu de clés
  (testé).
- Le panneau triait par `heure` (texte) : faux le jour où une ligne sans
  fuseau (UTC) côtoie une ligne locale, et au retour à l'heure d'hiver (deux
  « 02:30 »). `ChangementMeta.instant` donne l'ordre (2 tests).
- Le commentaire Google de `changements-api.ts` cite sa source
  (`fetch_campaign_changes`).
- Écarté : « `fin+1` suffirait » — non, à UTC−12 le dernier jour local finit
  à `fin+1 12:00Z`. Gardé sans test : le fil du rapport lit
  `occurred_at >= depuis` en UTC (fenêtre de 90 jours) ; au pire un geste
  fait entre minuit et deux heures le 90ᵉ jour manque au bord de la fenêtre.
Harnais : 21 + 29 tests, les huit harnais Meta à 198 verts ; `tsc` et build
verts, 18 routes.

**2026-10-07 — `000` rejoué par Claude** (`supabase db query --linked`), 50 contrôles verts, bucket `ad-creatives` créé ; rien de détruit (`reco_news` et les colonnes de `profiles` étaient déjà parties). Reste : le passage du worker, puis la vérification en base.
