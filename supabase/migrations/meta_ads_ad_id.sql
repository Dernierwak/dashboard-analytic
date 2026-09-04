-- ============================================================================
-- META ADS — ad_id, l'identifiant VRAIMENT unique d'une annonce (TASK-018)
-- (copie autonome de la section 22 de 000_run_me_all.sql —
--  exécuter l'un OU l'autre, jamais les deux dans la même session)
--
-- LE BUG, MESURÉ EN CONDITIONS RÉELLES (trouvé et chiffré par le checker de
-- TASK-017). Deux annonces DISTINCTES peuvent porter le même `ad_name` dans
-- la MÊME campagne — rien ne l'interdit dans Meta Ads Manager, un utilisateur
-- peut nommer deux annonces "fr_awarness" côte à côte. Constaté sur le compte
-- de test : la campagne BW_Sommer_Traffic_2026 porte deux annonces
-- "fr_awarness" avec des ad_id différents.
--
-- `upsert_meta_ads` (scripts/insert_data.py) dédupliquait les lignes reçues
-- de l'API sur (date_start, ad_name), et la contrainte d'unicité en base
-- portait la même clé (`meta_ads_insights_uq`). Résultat : l'une des deux
-- annonces écrasait SILENCIEUSEMENT l'autre à chaque récolte — la dépense de
-- l'annonce perdue disparaissait purement et simplement du dashboard. Mesuré :
-- ~17€ de dépense réelle absente de la base le 19/08/2026, ~15€ le 20/08
-- (environ 40 % de la dépense Meta quotidienne ces jours-là), alors que
-- l'API la renvoie bien.
--
-- LE FIX. `ad_id` est l'identifiant NUMÉRIQUE que Meta attribue à chaque
-- annonce à sa création — il n'est jamais dupliqué, contrairement au nom
-- lisible que l'utilisateur choisit librement. La déduplication Python et la
-- contrainte d'unicité portent désormais dessus, exactement comme
-- `google_ads_ad_insights` le fait déjà côté Google (voir google_ads_ad_insights.sql
-- / 000_run_me_all.sql §3bis) — ce fichier applique à Meta un principe déjà en
-- place ailleurs dans ce même schéma.
--
-- POURQUOI LA COLONNE EST NULLABLE, SANS DEFAULT. Les lignes déjà en base
-- n'ont jamais porté d'ad_id. Leur donner une valeur commune au backfill
-- (ex. '') ferait entrer en collision, sous la NOUVELLE contrainte
-- (user_id, date_start, ad_id), toutes les annonces d'un même jour qui
-- portaient jusqu'ici des ad_name différents — et l'ADD CONSTRAINT
-- échouerait purement et simplement sur la première violation trouvée.
-- NULL est le seul choix qui ne ment pas sur ce qu'on ne sait pas — et
-- Postgres ne considère JAMAIS deux NULL comme égaux dans une contrainte
-- UNIQUE (comportement standard SQL), donc l'ALTER passe même avec des
-- doublons d'ad_name déjà en base.
--
-- ⚠️ CETTE COHABITATION SANS ERREUR N'EST PAS UNE FIN EN SOI — ELLE DÉPLACE
-- LE PROBLÈME, ET LE VRAI FIX EST CÔTÉ CODE. Sans intervention, la récolte
-- SUIVANTE qui réécrit une date déjà connue (fenêtre de recouvrement,
-- `_RECOUVREMENT_JOURS_META = 7` jours) upserte un ad_id RÉEL qui n'entre en
-- conflit avec RIEN — la vieille ligne NULL et la nouvelle ligne cohabitent
-- dans la table, et la dépense de cette date serait comptée DEUX FOIS,
-- durablement. C'est `upsert_meta_ads` (scripts/insert_data.py) qui répare
-- ça : avant chaque upsert, il supprime explicitement les lignes
-- `ad_id IS NULL` restantes pour les dates qu'il s'apprête à réécrire (portée
-- strictement bornée à l'utilisateur et aux dates du lot en cours). C'EST
-- CETTE PARTIE-LÀ, PAS CETTE MIGRATION SEULE, QUI ÉVITE LE DOUBLE COMPTAGE —
-- jouer cette migration sans le code à jour (scripts/insert_data.py à cette
-- révision ou plus récente) laisse le risque ouvert.
--
-- CE QUE CE FIX NE RÉPARE PAS RÉTROACTIVEMENT. Les lignes déjà écrasées avant
-- lui (une des deux annonces au nom dupliqué) restent perdues tant qu'elles
-- ne sont pas redemandées à l'API. Le recouvrement de récolte les couvre
-- automatiquement pour les prochains passages, tant que la date la plus
-- récente déjà en base pour l'utilisateur ne dépasse pas sept jours après le
-- 19-20/08 — au-delà (si la récolte de ce compte n'a pas tourné depuis plus
-- d'une semaine à la date où ce fichier est joué), un rejeu manuel plus large
-- serait nécessaire pour ces deux jours précis. À vérifier au moment de jouer
-- cette migration.
--
-- Idempotent : rejouable sans risque. AUCUN DROP DE TABLE, AUCUN DELETE dans
-- CE fichier SQL. La seule opération sensible ICI est le DROP CONSTRAINT +
-- ADD CONSTRAINT ci-dessous (remplacer une contrainte d'unicité existante par
-- une autre) — signalée comme demandé par CLAUDE.md §7, et à faire valider
-- avant exécution. Même patron que `ga4_events.sql` sur `ga4_insights_uq`.
-- Le DELETE, lui, vit dans le code Python (voir plus haut), scopé et exécuté
-- à chaque récolte — pas dans cette migration ponctuelle.
-- ============================================================================

ALTER TABLE public.meta_ads_insights
    ADD COLUMN IF NOT EXISTS ad_id text;

ALTER TABLE public.meta_ads_insights DROP CONSTRAINT IF EXISTS meta_ads_insights_uq;
ALTER TABLE public.meta_ads_insights DROP CONSTRAINT IF EXISTS meta_ads_insights_uq2;
ALTER TABLE public.meta_ads_insights
    ADD CONSTRAINT meta_ads_insights_uq2 UNIQUE (user_id, date_start, ad_id);
