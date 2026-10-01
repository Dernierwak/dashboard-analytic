# La migration qui retire le thème de la base

Type: task
Status: resolved
Blocked by: 01

## Question

Rien à décider non plus, mais **c'est destructeur** : `CLAUDE.md` §7 exige que ce
soit signalé et validé. Ce ticket **écrit** la migration et la **propose** ; David
la joue à la main, une fois, comme `999_supprimer_les_recommandations.sql`.

**Objets de base qui portent le thème** (relevés le 2026-09-28 dans
`supabase/migrations/`)
- `meta_campaign_config.label` et `google_campaign_config` (même colonne)
- `ga4_insights.campaign_labels`, `ga4_insights.google_campaign_labels`
- `instagram_organic_posts` : ses colonnes de label
- `profiles.labels` — « la liste maîtresse unique (Meta + Google + Insta) »
- `theme_regroupement` — la VUE du regroupement par thème (`security_invoker`)
- `theme_objectifs`, `theme_ga4_events`
- `insight_feedback` : les lignes `priority_label:<nom>` (les **lignes**, pas la
  table — elle sert aussi à autre chose, à vérifier avant de supposer)
- `label_source`, `label_at` et leurs déclencheurs (section 20 du
  `000_run_me_all.sql`)

**Ce qu'il faut trancher dans le ticket, pas maintenant**
- La migration s'appelle-t-elle `998_…` sur le modèle du `999`, ou entre-t-elle
  dans `000_run_me_all.sql` ? Le `000` est décrit comme « rejouable sans risque » :
  un `DROP COLUMN` y a sa place seulement s'il est idempotent.
- Faut-il **archiver** les thèmes posés à la main avant de les détruire ? Un client
  a étiqueté ses campagnes ; ce travail disparaît. Un `COPY` vers une table
  `archive_labels` coûte peu et rend le retour possible. À proposer à David.

**Attention** : ce ticket ne se joue **pas** avant que 01 soit vert. Un refus RLS
sur un `update` ne renvoie aucune erreur et touche zéro ligne (`CLAUDE.md` §8) —
du code qui lit une colonne disparue, lui, casse franchement, et c'est le bon
ordre.

## Comments

**2026-10-01 — réservation libérée.** La session qui l'avait prise ne tourne
plus. Son travail est commencé mais **pas commité** : il vit dans la copie de
travail de `main` (`/Users/David.GILLIARD/DAVID/Moi_Hobbies/08_Data analyse/05_Mes Projets/03_Agence_Dashboard/`), pas dans une branche — une session partie d'un
worktree neuf ne le voit pas, elle doit aller le lire là :
- `supabase/migrations/998_supprimer_le_theme.sql` (non suivi) ;
- des modifications de `000_run_me_all.sql`, `equipe_partage.sql`,
  `meta_campaign_config.sql`, `partage_tables_manquantes.sql` ;
- `theme_ga4_events.sql` renommé `ga4_event_catalog.sql`, et la suppression de
  `labels_origine.sql`, `theme_objectifs.sql`, `theme_regroupement.sql`,
  `unified_labels.sql`, `vision_labels_ia.sql`.
Rien n'en a été vérifié. Le ticket 01 est résolu : plus aucun code ne lit ce que
cette migration supprime, l'ordre « code d'abord, base ensuite » est tenu.

**2026-10-01 — repris, vérifié, en attente de David.** Le travail resté dans
la copie de `main` est importé tel quel dans la branche
`worktree-meta-ads-02-migration-theme`, puis joué sur un PostgreSQL 15 local
et jetable (stub minimal de `auth` et des trois tables que Supabase crée avant
le `000`) :
- ancien `000` → données de test (campagne étiquetée avec budget, verdict
  `priority_label:`, post Instagram étiqueté, `fetch_progress` 'labels' et
  'meta') → `998` : **exit 0, 20 lignes ✓** au contrôle ;
- après la `998`, le budget, le post et la ligne 'meta' sont **intacts** ;
- nouveau `000` joué **deux fois** sur cette base, puis deux fois sur une base
  vierge : exit 0, aucun objet du thème ne renaît ; seul ✗ du contrôle,
  `followers_history` absente, qui vient du stub (l'ancien `000` le signalait
  déjà).
- Code : `git grep` ne trouve plus aucune lecture ni écriture des objets
  supprimés dans `saas/` ni `.github/`.

Corrections au passage : le ticket citait `ga4_insights.campaign_labels` —
la colonne n'a jamais existé, les deux listes vivent dans `profiles` (créées
par `meta_campaign_config.sql` et `google_ads.sql`), et c'est là que la `998`
les supprime. Le commentaire de `conversion_categories.sql` renvoyait vers
deux fichiers supprimés : réécrit. `docs/mesures-impossibles.md` décrit encore
le thème comme vivant : rangé en `.scratch/corrections/issues/05-…`.

**Ce qui bloque la résolution — deux points que le dépôt ne prouve pas :**
1. La `998` dit « AUCUNE ARCHIVE, décision de David le 2026-09-30 : “Rien, on
   perd” » et « l'idée est notée au `BACKLOG.md` ». Ni la phrase ni l'idée
   n'apparaissent nulle part dans le dépôt. À confirmer par David.
2. La `998` supprime `insight_feedback` **en entier**, alors que ce ticket
   disait « les lignes, pas la table ». Plus aucun code ne la lit ni ne
   l'écrit (les verdicts sont morts le 2026-09-21, les étoiles avec le thème),
   mais `BACKLOG.md` affirme encore « `insight_feedback` survit ». À valider.

## Answer

**La migration est `supabase/migrations/998_supprimer_le_theme.sql`, hors du
`000`**, sur le modèle du `999` : le `000` installe et doit rester rejouable,
celle-ci démolit et se joue une fois, à la main. Le `000_run_me_all.sql` cesse
en même temps d'installer le thème — sinon son prochain passage le ferait
renaître.

**Ce qu'elle détruit** : la vue `theme_regroupement` ; les tables
`theme_ga4_events`, `theme_objectifs` et `insight_feedback` **en entier** ; les
colonnes `label`/`labels`, `label_source`, `label_at` de `meta_campaign_config`,
`google_campaign_config` et `instagram_organic_posts` ; `profiles.labels`,
`campaign_labels`, `google_campaign_labels` ; les déclencheurs `trg_*_label_at`
et les fonctions `stamp_label_at*()` ; les lignes `fetch_progress` 'labels'.
Une transaction, aucun `CASCADE` : une dépendance oubliée fait échouer le
fichier sans rien supprimer. Un contrôle de 20 lignes suit, à jouer seul.

**Tranché avec David le 2026-10-01** :
- **aucune archive** des étiquettes (« rien, on perd ») — l'idée écartée est au
  `BACKLOG.md` ;
- **`insight_feedback` part en entier**, pas seulement ses lignes
  `priority_label:` : plus aucun code ne la lit ni ne l'écrit.

**Vérifié** sur PostgreSQL 15 jetable (détail dans le commentaire du
2026-10-01 ci-dessus) : 998 sur une base « prod » chargée → 20 ✓, budgets et
posts intacts ; nouveau `000` rejoué deux fois après elle et deux fois sur base
vierge → exit 0, rien ne renaît. **Pas vérifié sur la vraie base Supabase** :
c'est David qui la joue.

**Quand la jouer** : le code qui ne lit plus le thème est sur `main` (PR #3).
Attendre que Vercel ait déployé ce `main` **et** qu'un passage du worker ait
tourné dessus — le cron du jour de travail, ou `weekly-fetch.yml` lancé à la
main depuis l'onglet GitHub Actions. Puis : SQL editor → coller la `998` →
exécuter → jouer le bloc CONTRÔLE seul, toutes les lignes doivent dire ✓.
