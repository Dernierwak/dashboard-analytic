# La migration qui retire le thème de la base

Type: task
Status: claimed
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
