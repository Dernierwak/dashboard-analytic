-- ============================================================================
-- 000_run_me_all.sql  —  LE SCHÉMA COMPLET DE PULSE, EN UN SEUL FICHIER.
-- À coller dans Supabase → SQL editor, et à REJOUER à chaque fois qu'on doute.
--
-- ────────────────────────────────────────────────────────────────────────────
-- POURQUOI CE FICHIER A ÉTÉ REPRIS (août 2026)
--
-- Il s'annonçait comme « le fichier unique qui installe tout » et il s'arrêtait
-- à la section 12 — dont le contenu, d'ailleurs, n'était même pas là : un
-- commentaire renvoyait vers `equipe_partage.sql`. Neuf migrations écrites
-- depuis n'y étaient jamais entrées. Le résultat se lit dans l'usage : on
-- découvrait chaque colonne manquante par un message d'erreur, une
-- fonctionnalité à la fois (« Enregistrement impossible — rejoue le SQL
-- site_client.sql »), sans jamais savoir combien il en restait derrière.
--
-- Un document qui prétend être la source d'installation et qui ment coûte plus
-- cher que pas de document du tout : on lui fait confiance. Ce fichier reprend
-- donc TOUT le contenu du dossier `supabase/migrations/`, dans l'ordre où les
-- dépendances l'exigent.
--
-- ────────────────────────────────────────────────────────────────────────────
-- CE QU'IL INSTALLE
--
--   0)     Socle publicitaire : meta_ads_insights, meta_campaign_config,
--          google_ads_insights, google_campaign_config
--   0bis)  Les créas Meta : meta_ads_creatives, meta_ads_creative_assets
--   2)     GA4 : ga4_insights (+ campagne UTM) et ga4_events (funnel)
--   3)     profiles.objectif + fetch_schedule
--   3bis)  google_ads_ad_insights — le détail par annonce
--   3ter)  channel_budgets — le budget saisi, par mois et par canal
--   4)     Tous les jetons Google dans connected_accounts (provider='google')
--   6)     weekly_reports — le rapport hebdo précalculé
--   7)     Onboarding express (secteur, budget, temps, frustration)
--   12)    Partage d'accès : dashboard_members + a_acces() / peut_editer()
--   13)    platform_budgets — le budget PLANIFIÉ, relevé par relevé
--   14)    platform_changes — ce que les plateformes déclarent avoir changé
--   14bis) profiles.ga4_event_catalog — les événements que GA4 émet vraiment
--   14ter) fetch_progress — l'avancement RÉEL de la récolte, canal par canal.
--          AVANT la section 15 elle aussi, même raison.
--   15)    Partage : la liste COMPLÈTE des tables, et le contrôle des jetons
--   16)    Dates déclarées des campagnes (start_date / end_date)
--   18)    profiles.site_url — le site du client
--   21)    (volontairement absent — voir la section, il faut ta décision)
--   26)    email_envois — ce qu'est devenu l'email hebdo (ticket 50). APRÈS la
--          section 15, et sans jamais y entrer : RLS activée, aucune policy,
--          service_role seul. Mesure d'exploitation, pas information produit.
--   14sexies) reco_news — DROP, retirée le 7 septembre 2026 (plus de recos
--          sur le compte entier — voir la section elle-même).
--
--   Les sections 1, 8, 14quater, 20 et 24 portaient le thème et le label.
--   Le thème a quitté le produit le 2026-09-30 : elles sont retirées d'ici, et
--   ce qu'elles avaient installé est détruit par `998_supprimer_le_theme.sql`,
--   joué une fois, à la main. Les laisser ici les ferait RENAÎTRE au prochain
--   passage de ce fichier.
--
--   La section 17 installait `landing_url`, la page d'arrivée saisie à la main
--   pour une campagne. Son seul écran était `/labels` ; David, le 2026-10-03 :
--   « on n'en a plus du tout besoin ». L'adresse vers laquelle une annonce
--   envoie se lit dans sa créa Meta (`object_story_spec.link_data.link`), pas
--   dans une déclaration. Même sort : la `998` détruit la colonne.
--
-- ────────────────────────────────────────────────────────────────────────────
-- CE QU'IL SUPPOSE DÉJÀ LÀ
--
-- Quatre tables ne sont créées par aucune migration du dossier : elles datent
-- d'avant, posées à la main dans l'interface Supabase. Ce fichier les MODIFIE
-- sans jamais les créer, et s'arrêtera net si elles manquent :
--     profiles · connected_accounts · instagram_organic_posts · followers_history
--
-- ────────────────────────────────────────────────────────────────────────────
-- IL EST REJOUABLE, ET C'EST LA PROPRIÉTÉ QUI COMPTE
--
-- Une partie de ces fichiers a déjà été jouée à la main, dans le désordre, sur
-- une base qui porte de vraies données. Tout est donc écrit pour qu'un second
-- passage ne casse rien et n'efface rien : `IF NOT EXISTS` partout où PostgreSQL
-- le propose, et le motif `DO $$ … EXCEPTION WHEN duplicate_object THEN NULL`
-- pour ce qui n'en dispose pas (les CHECK). Le backfill des budgets
-- est gardé par une condition qui le rend muet au deuxième passage : il ne
-- réécrase jamais ce que tu auras saisi entre-temps.
--
-- Une seule instruction de ce fichier retire quelque chose : la section 4
-- supprime de `profiles` les trois colonnes Google APRÈS les avoir recopiées
-- dans `connected_accounts`. Elle est là depuis l'origine, elle a déjà tourné,
-- et elle est signalée sur place.
--
-- ────────────────────────────────────────────────────────────────────────────
-- COMMENT SAVOIR QUE ÇA A MARCHÉ
--
-- Une REQUÊTE DE CONTRÔLE, juste avant la toute fin du fichier, liste toutes
-- les tables, colonnes et fonctions attendues et met en HAUT du résultat ce
-- qui manque encore. Rien à interpréter — si la première ligne affiche « ✓ »,
-- il ne manque rien. Elle vérifie aussi, dans le même tableau, que les jetons
-- Meta/Google ne sont lisibles par aucun membre invité.
--
-- ATTENTION : ce n'est PLUS la dernière instruction du fichier — un
-- `NOTIFY pgrst, 'reload schema'` la suit, pour que PostgREST connaisse tout
-- de suite les tables tout juste créées (voir la note en toute fin de
-- fichier). Or le SQL editor de Supabase n'affiche que le résultat de la
-- TOUTE DERNIÈRE instruction jouée : rejouer le fichier en entier affichera
-- donc « Success. No rows returned », pas le tableau de contrôle. Pour lire
-- ce tableau, sélectionne uniquement le bloc CONTRÔLE ci-dessous (du `WITH
-- attendu` jusqu'au `ORDER BY` qui le termine) et exécute cette sélection
-- seule (Cmd/Ctrl+Entrée sur le texte sélectionné) — APRÈS avoir joué le
-- fichier complet, jamais avant : lue trop tôt, sur une base où tout n'est
-- pas encore installé, elle remonte des ✗ normaux (rien n'a de raison d'être
-- là) qui n'ont rien à voir avec un échec. C'est seulement une fois le
-- fichier entier rejoué que ces mêmes ✗ deviennent le signal utile.
-- ============================================================================

-- Fonction trigger updated_at (réutilisée par plusieurs tables) ---------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 0) LE SOCLE PUBLICITAIRE — les quatre tables dont tout le reste dépend.
--    Voir meta_ads_insights.sql, meta_campaign_config.sql,
--    meta_campaign_status.sql et google_ads.sql (sources de vérité).
--
--    POURQUOI CETTE SECTION EXISTE, ALORS QU'ELLE EST LA PLUS ANCIENNE.
--    Elle manquait. Le fichier commençait à la section 1 en supposant ces
--    tables déjà là — ce qui est vrai sur la base de production, et faux
--    partout ailleurs. La section 3ter, en particulier, ne pardonnait pas :
--    elle lit `profiles.meta_budget_global` et `profiles.google_budget_global`
--    pour reprendre les budgets existants. Sans le socle, elle échoue — donc
--    tout ce qui suit aussi,
--    l'éditeur SQL de Supabase jouant le fichier d'un bloc.
-- ============================================================================

-- ── Meta Ads : une ligne par annonce × jour ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meta_ads_insights (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date_start    date NOT NULL,
    campaign_name text NOT NULL DEFAULT '',
    adset_name    text NOT NULL DEFAULT '',
    ad_name       text NOT NULL DEFAULT '',
    impressions   integer NOT NULL DEFAULT 0,
    clicks        integer NOT NULL DEFAULT 0,
    reach         integer,
    link_clicks   integer,
    spend         numeric(10, 4) NOT NULL DEFAULT 0,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT meta_ads_insights_uq UNIQUE (user_id, date_start, ad_name)
);

CREATE INDEX IF NOT EXISTS idx_meta_ads_insights_user_date
    ON public.meta_ads_insights (user_id, date_start DESC);

DROP TRIGGER IF EXISTS trg_meta_ads_insights_updated_at ON public.meta_ads_insights;
CREATE TRIGGER trg_meta_ads_insights_updated_at
    BEFORE UPDATE ON public.meta_ads_insights
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.meta_ads_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meta_ads_select_own" ON public.meta_ads_insights;
DROP POLICY IF EXISTS "meta_ads_insert_own" ON public.meta_ads_insights;
DROP POLICY IF EXISTS "meta_ads_update_own" ON public.meta_ads_insights;
DROP POLICY IF EXISTS "meta_ads_delete_own" ON public.meta_ads_insights;
CREATE POLICY "meta_ads_select_own" ON public.meta_ads_insights
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "meta_ads_insert_own" ON public.meta_ads_insights
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meta_ads_update_own" ON public.meta_ads_insights
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meta_ads_delete_own" ON public.meta_ads_insights
    FOR DELETE USING (auth.uid() = user_id);

-- ── Meta Ads : ad_id, l'identifiant vraiment unique (voir meta_ads_ad_id.sql) ─
--
-- POURQUOI. `ad_name` est le nom LISIBLE que l'annonceur choisit librement :
-- rien dans Meta Ads Manager n'interdit deux annonces « fr_awarness » côte à
-- côte, et c'est le cas courant dès qu'on réutilise « Video 1 » dans deux
-- Groupes. La clé d'unicité portait dessus — donc l'une des deux écrasait
-- l'autre en silence, et sa dépense ne disparaissait pas du dashboard : elle
-- n'entrait jamais en base. Mesuré sur le compte de test au 19-20/08/2026 :
-- ~17 € puis ~15 €, environ 40 % de la dépense Meta de ces jours-là.
-- `ad_id` est le numéro que Meta attribue à la création — jamais dupliqué.
-- C'est déjà le principe de `google_ads_ad_insights` côté Google (§3bis).
--
-- LA COLONNE EST NULLABLE ET SANS DEFAULT, exprès. Les lignes déjà en base
-- n'ont pas d'ad_id ; leur donner une valeur commune ('') les ferait toutes
-- entrer en collision sous la nouvelle contrainte, et l'ADD CONSTRAINT
-- échouerait. Postgres ne considère jamais deux NULL comme égaux dans une
-- contrainte UNIQUE, donc l'ALTER passe même avec des homonymes déjà stockés.
--
-- ⚠ CE FICHIER NE SUFFIT PAS SEUL. Une fois la contrainte déplacée, la récolte
-- suivante réécrit une date déjà connue (recouvrement de 7 jours) avec un
-- ad_id réel qui n'entre en conflit avec rien : la vieille ligne NULL et la
-- neuve cohabiteraient, et la dépense de cette date serait comptée DEUX FOIS.
-- Ce qui l'empêche vit dans `upsert_meta_ads` (`saas/commun/insert_data.py`),
-- qui efface les lignes `ad_id IS NULL` des dates qu'il s'apprête à réécrire,
-- bornées à l'utilisateur et au lot en cours. Jouer ce fichier sur une base
-- dont le code Python n'est PAS à cette révision laisse le double comptage
-- ouvert.
--
-- ⚠ OPÉRATION SENSIBLE, signalée comme l'exige CLAUDE.md §7 : le DROP
-- CONSTRAINT ci-dessous remplace une contrainte d'unicité existante. Aucune
-- ligne n'est effacée ici. Même patron que `ga4_insights_uq` en section 2.
ALTER TABLE public.meta_ads_insights
    ADD COLUMN IF NOT EXISTS ad_id text;
ALTER TABLE public.meta_ads_insights DROP CONSTRAINT IF EXISTS meta_ads_insights_uq;
ALTER TABLE public.meta_ads_insights DROP CONSTRAINT IF EXISTS meta_ads_insights_uq2;
ALTER TABLE public.meta_ads_insights
    ADD CONSTRAINT meta_ads_insights_uq2 UNIQUE (user_id, date_start, ad_id);

-- ── Meta Ads : l'identité par ID, la fenêtre d'attribution, les résultats ───
-- Carte meta-ads, spec § « L'identité par ID » (étape A) et § « Les colonnes
-- et tables nouvelles ». Tout est nullable, sans DEFAULT, pour la même raison
-- qu'ad_id ci-dessus : les lignes déjà en base n'ont rien de tout ça, et
-- un '' ou un 0 écrit à leur place serait un chiffre fabriqué.
--
-- campaign_id / adset_id : le nom d'une campagne se change dans Ads Manager,
-- son ID jamais ; deux campagnes peuvent porter le même nom. La récolte les
-- demande dans la même requête /insights (zéro appel de plus). Les lignes
-- anciennes se remplissent par un REJEU de la récolte (`weekly-fetch.yml`,
-- `meta_since`), jamais par une jointure sur le nom.
--
-- attribution_setting : la fenêtre que Meta a appliquée à la ligne (« 7d_click_1d_view »…).
-- NULL quand Meta ne la rend pas — ne se lit jamais comme une fenêtre par défaut.
--
-- results : la colonne « Résultats » d'Ads Manager, stockée BRUTE, telle que
-- Meta la rend — une liste. Sa forme d'élément n'est documentée nulle part
-- (recherche champs-api-meta.md, « Pas encore établi ») : elle se lira dans la
-- base après le premier passage du worker. D'où jsonb et pas des colonnes.
-- Champ absent → NULL, liste vide → '[]' : les deux ne veulent pas dire pareil.
--
-- NE SE CONSTRUISENT PAS, décision de la spec : `date_stop` et
-- `inline_link_clicks` (rien ne les lit), et la table `meta_ads_actions` (les
-- conversions viennent de `results`, pas de la liste `actions`).
ALTER TABLE public.meta_ads_insights
    ADD COLUMN IF NOT EXISTS campaign_id         text,
    ADD COLUMN IF NOT EXISTS adset_id            text,
    ADD COLUMN IF NOT EXISTS attribution_setting text,
    ADD COLUMN IF NOT EXISTS results             jsonb;

-- ── Meta : la config par campagne (budget, statut) ──────────────────────────
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS meta_budget_global numeric(12, 2) NOT NULL DEFAULT 0;

-- Une base NEUVE naît avec la clé par ID. Une base existante garde la sienne
-- (`IF NOT EXISTS`) jusqu'à l'étape B, jouée à la main :
-- 997_la_cle_de_config_meta_passe_a_l_id.sql.
CREATE TABLE IF NOT EXISTS public.meta_campaign_config (
    user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_id   text NOT NULL,
    campaign_name text NOT NULL,
    budget_max    numeric(12, 2) NOT NULL DEFAULT 0,
    updated_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_campaign_config_user
    ON public.meta_campaign_config (user_id);

DROP TRIGGER IF EXISTS trg_meta_campaign_config_updated_at ON public.meta_campaign_config;
CREATE TRIGGER trg_meta_campaign_config_updated_at
    BEFORE UPDATE ON public.meta_campaign_config
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.meta_campaign_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meta_campaign_config_select_own" ON public.meta_campaign_config;
DROP POLICY IF EXISTS "meta_campaign_config_insert_own" ON public.meta_campaign_config;
DROP POLICY IF EXISTS "meta_campaign_config_update_own" ON public.meta_campaign_config;
DROP POLICY IF EXISTS "meta_campaign_config_delete_own" ON public.meta_campaign_config;
CREATE POLICY "meta_campaign_config_select_own" ON public.meta_campaign_config
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "meta_campaign_config_insert_own" ON public.meta_campaign_config
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meta_campaign_config_update_own" ON public.meta_campaign_config
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meta_campaign_config_delete_own" ON public.meta_campaign_config
    FOR DELETE USING (auth.uid() = user_id);

-- Le statut Meta de la campagne (ACTIVE / PAUSED / WITH_ISSUES / …), remis à
-- jour à chaque récolte. Voir meta_campaign_status.sql.
ALTER TABLE public.meta_campaign_config
    ADD COLUMN IF NOT EXISTS effective_status text DEFAULT NULL;

-- L'ID Meta de la campagne — étape A de la spec meta-ads, § « L'identité par
-- ID ». Sur une base d'avant le ticket 13, la colonne arrive nullable : les
-- lignes en place n'en ont pas, et la clé reste (user_id, campaign_name) TANT
-- QUE l'étape B (997_la_cle_de_config_meta_passe_a_l_id.sql) n'est pas jouée —
-- celle-ci refuse de tourner tant qu'une ligne n'a pas d'ID. Une ligne sans ID
-- n'est jamais rattachée par son nom à une autre.
ALTER TABLE public.meta_campaign_config
    ADD COLUMN IF NOT EXISTS campaign_id text;

-- ── Google Ads : insights par campagne × jour, et config par campagne ───────
CREATE TABLE IF NOT EXISTS public.google_ads_insights (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date_start     date NOT NULL,
    campaign_id    text NOT NULL,
    campaign_name  text NOT NULL DEFAULT '',
    impressions    integer NOT NULL DEFAULT 0,
    clicks         integer NOT NULL DEFAULT 0,
    conversions    numeric(12, 2) NOT NULL DEFAULT 0,
    cost_micros    bigint NOT NULL DEFAULT 0,   -- Google compte en micros (1 CHF = 1 000 000)
    ctr            numeric(8, 4) NOT NULL DEFAULT 0,
    avg_cpc_micros bigint NOT NULL DEFAULT 0,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT google_ads_insights_uq UNIQUE (user_id, date_start, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_google_ads_insights_user_date
    ON public.google_ads_insights (user_id, date_start DESC);

DROP TRIGGER IF EXISTS trg_google_ads_insights_updated_at ON public.google_ads_insights;
CREATE TRIGGER trg_google_ads_insights_updated_at
    BEFORE UPDATE ON public.google_ads_insights
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.google_ads_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "google_ads_select_own" ON public.google_ads_insights;
DROP POLICY IF EXISTS "google_ads_insert_own" ON public.google_ads_insights;
DROP POLICY IF EXISTS "google_ads_update_own" ON public.google_ads_insights;
DROP POLICY IF EXISTS "google_ads_delete_own" ON public.google_ads_insights;
CREATE POLICY "google_ads_select_own" ON public.google_ads_insights
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "google_ads_insert_own" ON public.google_ads_insights
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "google_ads_update_own" ON public.google_ads_insights
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "google_ads_delete_own" ON public.google_ads_insights
    FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.google_campaign_config (
    user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_id      text NOT NULL,
    campaign_name    text NOT NULL DEFAULT '',
    budget_max       numeric(12, 2) NOT NULL DEFAULT 0,
    effective_status text,
    updated_at       timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_google_campaign_config_user
    ON public.google_campaign_config (user_id);

DROP TRIGGER IF EXISTS trg_google_campaign_config_updated_at ON public.google_campaign_config;
CREATE TRIGGER trg_google_campaign_config_updated_at
    BEFORE UPDATE ON public.google_campaign_config
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.google_campaign_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "google_campaign_config_select_own" ON public.google_campaign_config;
DROP POLICY IF EXISTS "google_campaign_config_insert_own" ON public.google_campaign_config;
DROP POLICY IF EXISTS "google_campaign_config_update_own" ON public.google_campaign_config;
DROP POLICY IF EXISTS "google_campaign_config_delete_own" ON public.google_campaign_config;
CREATE POLICY "google_campaign_config_select_own" ON public.google_campaign_config
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "google_campaign_config_insert_own" ON public.google_campaign_config
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "google_campaign_config_update_own" ON public.google_campaign_config
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "google_campaign_config_delete_own" ON public.google_campaign_config
    FOR DELETE USING (auth.uid() = user_id);

-- Colonnes au niveau du compte, en parallèle des colonnes Meta ci-dessus.
-- La migration d'origine (google_ads.sql) ajoutait ici deux colonnes de plus,
-- google_refresh_token et google_customer_id. Elles ne sont PAS reprises :
-- la section 4 les recrée elle-même juste avant de les recopier dans
-- connected_accounts, puis les retire de profiles. Les poser ici ne ferait que
-- les créer pour les supprimer trente lignes plus bas.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS google_budget_global numeric(12, 2) NOT NULL DEFAULT 0;


-- ============================================================================
-- 0bis) LES CRÉAS META — ce que dit une annonce, pas ce qu'elle a mesuré.
--     Carte meta-ads, spec § « Les colonnes et tables nouvelles » ; la forme
--     vient de `.scratch/meta-ads/recherche/champs-api-meta.md`, § « Le SQL
--     proposé » (c) et (d). Remplies par la récolte des créas (ticket 05).
--
--     POURQUOI PAS DANS meta_ads_insights : cette table est une ligne par
--     annonce × JOUR. Le texte d'une annonce ne change pas d'un jour à
--     l'autre ; l'y mettre le recopierait sur chaque journée et ferait d'un
--     changement de texte une réécriture de tout l'historique.
--
--     AUCUN CHIFFRE ICI, décision de la spec (§ « Les créas ») : pas de
--     mesure par asset. Le Panneau le dit en une phrase.
-- ============================================================================

-- ── Une ligne par annonce ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meta_ads_creatives (
    user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ad_id          text NOT NULL,
    creative_id    text,
    creative_name  text,
    -- Lequel des montages a répondu : 'flat' | 'object_story' |
    -- 'asset_feed' | 'publication' (un post existant boosté, `object_story_id`,
    -- dont le texte vit dans le post — ticket 05). Sans lui, un champ vide et un montage absent se confondent :
    -- une créa bâtie sur object_story_spec ne rend PAS title/body/image_url au
    -- niveau racine (« readable fields are the same as those specified when
    -- you created the object » —
    -- https://developers.facebook.com/docs/marketing-api/creative/).
    -- Pas de CHECK, comme email_envois (section 26) : le jour où Meta rend un
    -- quatrième montage, un CHECK ferait échouer l'écriture sur le fait même
    -- qu'on cherche à apprendre.
    montage        text,
    object_type    text,
    -- link_data.name / video_data.title / creative.title
    titre          text,
    -- link_data.message / video_data.message / creative.body
    texte          text,
    -- link_data.description / video_data.link_description / photo_data.caption
    description    text,
    -- L'adresse de destination — ce que la section 17 (`landing_url`, retirée)
    -- faisait saisir à la main.
    lien_url       text,
    call_to_action text,
    -- La SEULE clé stable d'une image chez Meta : AdImage.url est « a temporary
    -- URL » (https://developers.facebook.com/docs/marketing-api/reference/ad-image/).
    -- C'est elle qui évite de téléverser deux fois la même image.
    image_hash     text,
    -- L'URL de l'image dans Supabase Storage, pas celle de Meta : les URL de
    -- Meta expirent. Bucket public `ad-creatives`, créé plus bas.
    image_url      text,
    video_id       text,
    vignette_url   text,
    -- Quand la récolte a lu la créa : c'est elle qui l'écrit à chaque passage,
    -- le DEFAULT ne joue qu'à la première insertion.
    recolte_le    timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    -- Une clé primaire et pas un simple UNIQUE : sans elle, l'éditeur de
    -- tables de Supabase rend les lignes en lecture seule. Même forme que
    -- meta_campaign_config.
    CONSTRAINT meta_ads_creatives_uq PRIMARY KEY (user_id, ad_id)
);

DROP TRIGGER IF EXISTS trg_meta_ads_creatives_updated_at ON public.meta_ads_creatives;
CREATE TRIGGER trg_meta_ads_creatives_updated_at
    BEFORE UPDATE ON public.meta_ads_creatives
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.meta_ads_creatives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meta_ads_creatives_select_own" ON public.meta_ads_creatives;
DROP POLICY IF EXISTS "meta_ads_creatives_insert_own" ON public.meta_ads_creatives;
DROP POLICY IF EXISTS "meta_ads_creatives_update_own" ON public.meta_ads_creatives;
DROP POLICY IF EXISTS "meta_ads_creatives_delete_own" ON public.meta_ads_creatives;
CREATE POLICY "meta_ads_creatives_select_own" ON public.meta_ads_creatives
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "meta_ads_creatives_insert_own" ON public.meta_ads_creatives
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meta_ads_creatives_update_own" ON public.meta_ads_creatives
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meta_ads_creatives_delete_own" ON public.meta_ads_creatives
    FOR DELETE USING (auth.uid() = user_id);

-- ── Plusieurs assets sous une annonce ───────────────────────────────────────
-- Couvre les DEUX montages multi-assets :
--  · asset_feed_spec (Dynamic Creative) — plafonné à 10 images, 10 vidéos,
--    5 textes, 5 titres.
--    https://developers.facebook.com/docs/marketing-api/dynamic-creative/asset-feed-spec/
--  · object_story_spec.link_data.child_attachments — le carrousel, « a 2-5
--    element array of link objects ».
--    https://developers.facebook.com/docs/marketing-api/reference/ad-creative-link-data/
--
-- LA CLÉ EST LE RANG, PAS UN asset_id. Aucune page de référence des assets
-- (AdAssetFeedSpecImage/Video/Body/Title/Description) ne documente un champ
-- `id` : l'identifiant d'un asset n'apparaît que dans les ventilations
-- d'insights, qui sont de la mesure. Stocker un asset_id qu'on n'a pas serait
-- un chiffre fabriqué.
CREATE TABLE IF NOT EXISTS public.meta_ads_creative_assets (
    user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ad_id        text NOT NULL,
    -- 'asset_feed' | 'child_attachment' : deux montages, deux sens du rang.
    -- Les confondre mélangerait une variante A/B et une carte de carrousel.
    provenance   text NOT NULL,
    -- 'image' | 'video' | 'body' | 'title' | 'description' | 'link_url'
    -- | 'call_to_action' | 'carousel_card'
    asset_kind   text NOT NULL,
    -- Position dans la liste rendue par Meta, à partir de 0. Le seul
    -- identifiant qu'on ait — voir plus haut.
    rang         integer NOT NULL,
    texte        text,
    image_hash   text,
    image_url    text,
    video_id     text,
    vignette_url text,
    lien_url     text,
    updated_at   timestamptz NOT NULL DEFAULT now(),
    -- ⚠ Une clé sur le rang ne retire rien : si une annonce passe de 5 textes
    -- à 3, un upsert laisse les rangs 3 et 4 en place. La récolte (ticket 05)
    -- remplace donc TOUS les assets d'une annonce à chaque passage.
    CONSTRAINT meta_ads_creative_assets_uq
        PRIMARY KEY (user_id, ad_id, provenance, asset_kind, rang)
);

DROP TRIGGER IF EXISTS trg_meta_ads_creative_assets_updated_at ON public.meta_ads_creative_assets;
CREATE TRIGGER trg_meta_ads_creative_assets_updated_at
    BEFORE UPDATE ON public.meta_ads_creative_assets
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.meta_ads_creative_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meta_ads_creative_assets_select_own" ON public.meta_ads_creative_assets;
DROP POLICY IF EXISTS "meta_ads_creative_assets_insert_own" ON public.meta_ads_creative_assets;
DROP POLICY IF EXISTS "meta_ads_creative_assets_update_own" ON public.meta_ads_creative_assets;
DROP POLICY IF EXISTS "meta_ads_creative_assets_delete_own" ON public.meta_ads_creative_assets;
CREATE POLICY "meta_ads_creative_assets_select_own" ON public.meta_ads_creative_assets
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "meta_ads_creative_assets_insert_own" ON public.meta_ads_creative_assets
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meta_ads_creative_assets_update_own" ON public.meta_ads_creative_assets
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meta_ads_creative_assets_delete_own" ON public.meta_ads_creative_assets
    FOR DELETE USING (auth.uid() = user_id);

-- ── Le bucket des visuels d'annonces ────────────────────────────────────────
-- PUBLIC, comme `post-images` d'Instagram : décision de David au ticket 05
-- (2026-10-05). Ces visuels sont déjà diffusés publiquement par Meta ; le prix
-- accepté est qu'une annonce en pause ou jamais diffusée devient lisible par
-- qui connaît son URL (`<user_id>/<image_hash>`, pas devinable). Aucune
-- politique d'écriture : seule la récolte écrit, avec la clé de service, qui
-- passe outre la RLS de storage.objects.
-- DO NOTHING et pas DO UPDATE : rejouer ce fichier ne repasse jamais en public
-- un bucket qu'on aurait rendu privé à la main.
INSERT INTO storage.buckets (id, name, public)
VALUES ('ad-creatives', 'ad-creatives', true)
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 2) GA4  →  table ga4_insights  (1 ligne par date × source/medium)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ga4_insights (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date         date NOT NULL,
    source       text NOT NULL DEFAULT '',
    medium       text NOT NULL DEFAULT '',
    sessions     integer NOT NULL DEFAULT 0,
    conversions  numeric(12, 2) NOT NULL DEFAULT 0,
    revenue      numeric(14, 2) NOT NULL DEFAULT 0,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ga4_insights_uq UNIQUE (user_id, date, source, medium)
);

CREATE INDEX IF NOT EXISTS idx_ga4_insights_user_date
    ON public.ga4_insights (user_id, date DESC);

DROP TRIGGER IF EXISTS trg_ga4_insights_updated_at ON public.ga4_insights;
CREATE TRIGGER trg_ga4_insights_updated_at
    BEFORE UPDATE ON public.ga4_insights
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ga4_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ga4_select_own" ON public.ga4_insights;
DROP POLICY IF EXISTS "ga4_insert_own" ON public.ga4_insights;
DROP POLICY IF EXISTS "ga4_update_own" ON public.ga4_insights;
DROP POLICY IF EXISTS "ga4_delete_own" ON public.ga4_insights;
CREATE POLICY "ga4_select_own" ON public.ga4_insights
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ga4_insert_own" ON public.ga4_insights
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ga4_update_own" ON public.ga4_insights
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ga4_delete_own" ON public.ga4_insights
    FOR DELETE USING (auth.uid() = user_id);


-- ── GA4 v2 : campagne UTM + funnel par événement (voir ga4_events.sql) ───────
ALTER TABLE public.ga4_insights
    ADD COLUMN IF NOT EXISTS campaign text NOT NULL DEFAULT '';
ALTER TABLE public.ga4_insights DROP CONSTRAINT IF EXISTS ga4_insights_uq;
ALTER TABLE public.ga4_insights DROP CONSTRAINT IF EXISTS ga4_insights_uq2;
ALTER TABLE public.ga4_insights
    ADD CONSTRAINT ga4_insights_uq2 UNIQUE (user_id, date, source, medium, campaign);

CREATE TABLE IF NOT EXISTS public.ga4_events (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date         date NOT NULL,
    source       text NOT NULL DEFAULT '',
    medium       text NOT NULL DEFAULT '',
    campaign     text NOT NULL DEFAULT '',
    event_name   text NOT NULL,
    event_count  integer NOT NULL DEFAULT 0,
    event_value  numeric(14, 2) NOT NULL DEFAULT 0,
    created_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ga4_events_uq UNIQUE (user_id, date, source, medium, campaign, event_name)
);
CREATE INDEX IF NOT EXISTS idx_ga4_events_user_date
    ON public.ga4_events (user_id, date DESC);
ALTER TABLE public.ga4_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ga4ev_select_own" ON public.ga4_events;
DROP POLICY IF EXISTS "ga4ev_insert_own" ON public.ga4_events;
DROP POLICY IF EXISTS "ga4ev_update_own" ON public.ga4_events;
DROP POLICY IF EXISTS "ga4ev_delete_own" ON public.ga4_events;
CREATE POLICY "ga4ev_select_own" ON public.ga4_events
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ga4ev_insert_own" ON public.ga4_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ga4ev_update_own" ON public.ga4_events
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ga4ev_delete_own" ON public.ga4_events
    FOR DELETE USING (auth.uid() = user_id);


-- ============================================================================
-- 3) L'OBJECTIF DU COMPTE + le jour de récolte par défaut
-- ============================================================================

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS objectif text DEFAULT NULL;

-- fetch_schedule : jour par défaut (lundi) + backfill des NULL, sinon le profil
-- n'est jamais fetché par le cron. Voir supabase/migrations/fetch_schedule_default.sql
ALTER TABLE public.profiles
    ALTER COLUMN fetch_schedule SET DEFAULT 'Monday';
UPDATE public.profiles
    SET fetch_schedule = 'Monday'
    WHERE fetch_schedule IS NULL;


-- ============================================================================
-- 3bis) GOOGLE ADS — détail par annonce × jour (drill-down Campagne → Groupe
--       d'annonces → Annonce, mirror Meta). Voir google_ads_ad_insights.sql.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.google_ads_ad_insights (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date_start     date NOT NULL,
    campaign_id    text NOT NULL,
    campaign_name  text NOT NULL DEFAULT '',
    ad_group_id    text NOT NULL,
    ad_group_name  text NOT NULL DEFAULT '',
    ad_id          text NOT NULL,
    ad_name        text NOT NULL DEFAULT '',
    impressions    integer NOT NULL DEFAULT 0,
    clicks         integer NOT NULL DEFAULT 0,
    cost_micros    bigint  NOT NULL DEFAULT 0,
    conversions    numeric(12, 2) NOT NULL DEFAULT 0,
    created_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT google_ads_ad_insights_uq UNIQUE (user_id, date_start, ad_id)
);

CREATE INDEX IF NOT EXISTS idx_gads_ad_insights_user_date
    ON public.google_ads_ad_insights (user_id, date_start DESC);

ALTER TABLE public.google_ads_ad_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gads_ad_select_own" ON public.google_ads_ad_insights;
DROP POLICY IF EXISTS "gads_ad_insert_own" ON public.google_ads_ad_insights;
DROP POLICY IF EXISTS "gads_ad_update_own" ON public.google_ads_ad_insights;
DROP POLICY IF EXISTS "gads_ad_delete_own" ON public.google_ads_ad_insights;
CREATE POLICY "gads_ad_select_own" ON public.google_ads_ad_insights
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "gads_ad_insert_own" ON public.google_ads_ad_insights
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gads_ad_update_own" ON public.google_ads_ad_insights
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gads_ad_delete_own" ON public.google_ads_ad_insights
    FOR DELETE USING (auth.uid() = user_id);


-- ============================================================================
-- 3ter) BUDGETS PAR MOIS — voir channel_budgets.sql (source de vérité).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.channel_budgets (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channel     text NOT NULL,
    month       date NOT NULL,
    amount      numeric(12, 2) NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT channel_budgets_uq UNIQUE (user_id, channel, month)
);
CREATE INDEX IF NOT EXISTS idx_channel_budgets_user
    ON public.channel_budgets (user_id, month DESC);
DROP TRIGGER IF EXISTS trg_channel_budgets_updated_at ON public.channel_budgets;
CREATE TRIGGER trg_channel_budgets_updated_at
    BEFORE UPDATE ON public.channel_budgets
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.channel_budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chbud_select_own" ON public.channel_budgets;
DROP POLICY IF EXISTS "chbud_insert_own" ON public.channel_budgets;
DROP POLICY IF EXISTS "chbud_update_own" ON public.channel_budgets;
DROP POLICY IF EXISTS "chbud_delete_own" ON public.channel_budgets;
CREATE POLICY "chbud_select_own" ON public.channel_budgets
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "chbud_insert_own" ON public.channel_budgets
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chbud_update_own" ON public.channel_budgets
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chbud_delete_own" ON public.channel_budgets
    FOR DELETE USING (auth.uid() = user_id);

INSERT INTO public.channel_budgets (user_id, channel, month, amount)
SELECT id, 'meta', date_trunc('month', now())::date, meta_budget_global
FROM public.profiles WHERE coalesce(meta_budget_global, 0) > 0
ON CONFLICT (user_id, channel, month) DO NOTHING;
INSERT INTO public.channel_budgets (user_id, channel, month, amount)
SELECT id, 'google', date_trunc('month', now())::date, google_budget_global
FROM public.profiles WHERE coalesce(google_budget_global, 0) > 0
ON CONFLICT (user_id, channel, month) DO NOTHING;


-- ============================================================================
-- 4) TOKENS UNIFIÉS  →  tout dans connected_accounts (provider='google')
--    On déplace google_refresh_token / google_customer_id / ga4_property_id
--    de profiles vers connected_accounts, puis on supprime les colonnes profiles.
-- ============================================================================

-- On garantit la présence des colonnes SOURCE sur profiles (no-op si déjà là)
-- pour que la copie ci-dessous ne casse jamais, même si les migrations GA4/Google
-- n'avaient pas été passées.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS google_refresh_token text,
    ADD COLUMN IF NOT EXISTS google_customer_id   text,
    ADD COLUMN IF NOT EXISTS ga4_property_id       text;

-- Nouvelles colonnes sur connected_accounts (le seul endroit pour les tokens).
ALTER TABLE public.connected_accounts
    ADD COLUMN IF NOT EXISTS provider             text NOT NULL DEFAULT 'meta',
    ADD COLUMN IF NOT EXISTS google_refresh_token text,
    ADD COLUMN IF NOT EXISTS google_customer_id   text,
    ADD COLUMN IF NOT EXISTS ga4_property_id       text;

-- Une ligne provider='meta' n'a pas de token Google, et une ligne
-- provider='google' n'a pas de meta_token / instagram_business_id : on relâche
-- les NOT NULL éventuels pour que la ligne google soit insérable.
ALTER TABLE public.connected_accounts ALTER COLUMN meta_token            DROP NOT NULL;
ALTER TABLE public.connected_accounts ALTER COLUMN instagram_business_id DROP NOT NULL;

-- Une seule ligne google par utilisateur.
CREATE UNIQUE INDEX IF NOT EXISTS connected_accounts_google_uniq
    ON public.connected_accounts (user_id) WHERE provider = 'google';

-- Copie de l'existant profiles.* -> ligne provider='google'.
INSERT INTO public.connected_accounts
    (user_id, provider, account_name, google_refresh_token, google_customer_id, ga4_property_id)
SELECT id, 'google', 'Google', google_refresh_token, google_customer_id, ga4_property_id
FROM public.profiles
WHERE google_refresh_token IS NOT NULL
ON CONFLICT (user_id) WHERE provider = 'google'
DO UPDATE SET
    google_refresh_token = EXCLUDED.google_refresh_token,
    google_customer_id   = EXCLUDED.google_customer_id,
    ga4_property_id      = EXCLUDED.ga4_property_id;

-- ⚠ LA SEULE INSTRUCTION DESTRUCTIVE DU FICHIER, ET ELLE EST D'ORIGINE.
-- Elle retire de `profiles` les trois colonnes que l'INSERT ci-dessus vient de
-- recopier dans `connected_accounts`. Elle a déjà tourné sur la base de
-- production : les colonnes n'y sont plus, et `IF EXISTS` la rend muette au
-- deuxième passage. Elle est laissée en place parce que la retirer ferait
-- réapparaître les jetons Google sur `profiles` — une table qui, elle, EST
-- partagée avec les membres invités (section 15). Le nettoyage est donc aussi
-- une mesure de cloisonnement, pas seulement du rangement.
ALTER TABLE public.profiles
    DROP COLUMN IF EXISTS google_refresh_token,
    DROP COLUMN IF EXISTS google_customer_id,
    DROP COLUMN IF EXISTS ga4_property_id;

-- ============================================================================
-- 6) weekly_reports — rapport hebdo précalculé (payload JSON)
--    Lu par Pulse (Next.js, saas/web) et l'email hebdo.
--    Écrit en headless par saas/traitement/build_report.py, au fetch cron.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.weekly_reports (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start  date NOT NULL,
    payload     jsonb NOT NULL,
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, week_start)
);

ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "weekly_reports_select_own" ON public.weekly_reports;
CREATE POLICY "weekly_reports_select_own" ON public.weekly_reports
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "weekly_reports_insert_own" ON public.weekly_reports;
CREATE POLICY "weekly_reports_insert_own" ON public.weekly_reports
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "weekly_reports_update_own" ON public.weekly_reports;
CREATE POLICY "weekly_reports_update_own" ON public.weekly_reports
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- (Ce n'est pas la fin du fichier : un « FIN » traînait ici alors que dix
--  sections suivaient. Le contrôle complet est tout en bas.)

-- ============================================================================
-- 7) Onboarding express Pulse — profil (business, budget, temps dispo)
-- ============================================================================

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS business_type text,
    ADD COLUMN IF NOT EXISTS budget_range  text,
    ADD COLUMN IF NOT EXISTS time_budget   text,
    ADD COLUMN IF NOT EXISTS frustration   text;

-- ============================================================================
-- 12) PARTAGE D'ACCÈS — inviter quelqu'un sur son dashboard.
--     Voir equipe_partage.sql (source de vérité). Cette section ne renvoyait
--     autrefois QUE vers ce fichier : c'était le trou principal du bundle.
--     Le contenu est maintenant là.
--
--     Le principe : les données restent rangées sous le user_id de leur
--     PROPRIÉTAIRE. On n'en duplique aucune. On élargit seulement la règle de
--     lecture/écriture pour qu'un membre invité voie le compte de celui qui
--     l'a invité.
--
--     Deux rôles :
--       'viewer' — il regarde, il ne touche à rien
--       'editor' — il coche des actions, reclasse des campagnes, choisit des
--                  priorités. Il ne peut jamais inviter ni révoquer.
--
--     connected_accounts n'est PAS partagée, et ne le sera jamais : elle porte
--     les jetons Meta et Google. Un membre voit les données récoltées, jamais
--     de quoi les récolter lui-même. La section 15 le VÉRIFIE au lieu de le
--     supposer.
--
--     ORDRE : cette section doit passer AVANT les sections 13 et 14.
--     platform_budgets et platform_changes testent la présence de a_acces() /
--     peut_editer() pour choisir entre « partagé » et « chacun ses lignes ».
--     Jouées avant, elles retomberaient sur la règle restreinte et l'invité
--     verrait deux modules vides, sans la moindre erreur nulle part.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dashboard_members (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    member_email text NOT NULL,      -- on invite un e-mail, pas un compte : la
                                     -- personne n'a peut-être rien créé encore
    member_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    owner_email  text,               -- pour nommer le compte dans le sélecteur
                                     -- (auth.users n'est pas lisible côté client)
    role         text NOT NULL DEFAULT 'editor',   -- 'viewer' | 'editor'
    created_at   timestamptz NOT NULL DEFAULT now(),
    accepted_at  timestamptz,
    CONSTRAINT dashboard_members_role_chk CHECK (role IN ('viewer', 'editor')),
    CONSTRAINT dashboard_members_uq UNIQUE (owner_id, member_email)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_members_member
    ON public.dashboard_members (member_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_members_email
    ON public.dashboard_members (lower(member_email));

ALTER TABLE public.dashboard_members ENABLE ROW LEVEL SECURITY;

-- Le propriétaire gère ses invitations ; le membre voit seulement la sienne.
DROP POLICY IF EXISTS "dm_select" ON public.dashboard_members;
DROP POLICY IF EXISTS "dm_insert" ON public.dashboard_members;
DROP POLICY IF EXISTS "dm_update" ON public.dashboard_members;
DROP POLICY IF EXISTS "dm_delete" ON public.dashboard_members;
CREATE POLICY "dm_select" ON public.dashboard_members
    FOR SELECT USING (auth.uid() = owner_id OR auth.uid() = member_id
                      OR lower(member_email) = lower(auth.jwt() ->> 'email'));
CREATE POLICY "dm_insert" ON public.dashboard_members
    FOR INSERT WITH CHECK (auth.uid() = owner_id);
-- L'update sert à DEUX choses, et deux seulement : le propriétaire change un
-- rôle, et l'invité rattache son compte à l'invitation qui porte son e-mail
-- (il écrit member_id et accepted_at, rien d'autre).
--
-- POURQUOI IL Y A UN WITH CHECK, ET POURQUOI IL NE SUFFIT PAS.
--
-- Sans WITH CHECK, PostgreSQL réutilise l'expression du USING pour valider la
-- ligne APRÈS modification. Or cette expression reste vraie quand c'est
-- justement `owner_id` qu'on vient de changer : l'invité gardait son e-mail
-- dans `member_email`, donc la ligne restait « la sienne » et passait le
-- contrôle. Il pouvait repointer son invitation vers le compte de n'importe
-- qui. Reproduit sur PostgreSQL 17 : `UPDATE 1`, puis lecture et écriture
-- complètes chez le tiers.
--
-- Le WITH CHECK ci-dessous ferme ça. Mais il ne peut pas tout fermer, et c'est
-- une limite de fond du modèle : une policy ne voit que la ligne d'ARRIVÉE.
-- Elle sait dire « cette ligne doit t'appartenir » ; elle ne sait pas dire
-- « cette colonne-là n'avait pas le droit de bouger ». Un invité qui se
-- contente de passer son propre `role` à 'editor' produit une ligne qui lui
-- appartient toujours — donc conforme, donc acceptée.
--
-- D'où le USING resserré (l'invité ne vise qu'une invitation PAS ENCORE
-- rattachée, `member_id IS NULL` — c'est exactement ce que fait
-- saas/web/lib/account.ts) ET le trigger de garde juste en dessous, qui épingle
-- les colonnes que seul le propriétaire peut toucher. Les trois ensemble, pas
-- l'un des trois.
CREATE POLICY "dm_update" ON public.dashboard_members
    FOR UPDATE
    USING (auth.uid() = owner_id
           OR (lower(member_email) = lower(auth.jwt() ->> 'email')
               AND member_id IS NULL))
    WITH CHECK (auth.uid() = owner_id
                OR (lower(member_email) = lower(auth.jwt() ->> 'email')
                    AND member_id = auth.uid()));
CREATE POLICY "dm_delete" ON public.dashboard_members
    FOR DELETE USING (auth.uid() = owner_id);

-- ── Le garde-fou que la RLS ne peut pas exprimer ────────────────────────────
-- Ce qui reste ouvert sans lui, et qui a été reproduit : n'importe qui peut
-- s'INSCRIRE une invitation à son propre nom (dm_insert n'exige que
-- `auth.uid() = owner_id`), puis, EN UNE SEULE requête, la rattacher à lui
-- (`member_id`), la repointer vers le compte d'un tiers (`owner_id`) et se
-- donner le rôle 'editor'. La ligne d'arrivée lui appartient, donc les deux
-- policies la laissent passer — et `a_acces()` / `peut_editer()` répondent
-- « oui » sur un compte qui ne l'a jamais invité.
--
-- Le trigger compare l'AVANT et l'APRÈS, ce qu'une policy ne peut pas faire.
CREATE OR REPLACE FUNCTION public.dashboard_members_garde()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Sans contexte utilisateur (service_role, worker cron, éditeur SQL de
    -- Supabase) la RLS est de toute façon contournée : ce n'est pas au trigger
    -- d'inventer une règle que les policies n'appliquent pas.
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    -- `owner_id` NE BOUGE JAMAIS, POUR PERSONNE — pas même pour le
    -- propriétaire de la ligne. C'est LA ligne qui ferme l'auto-invitation
    -- détournée, et elle a coûté un test pour être trouvée : dispenser le
    -- propriétaire de ce contrôle rouvrait tout le trou. N'importe qui peut
    -- s'insérer une invitation à SON nom (dm_insert l'autorise, `owner_id =
    -- auth.uid()`) ; il en est alors le propriétaire, donc toute exemption
    -- « le propriétaire fait ce qu'il veut » le laissait ensuite déplacer la
    -- ligne vers le compte d'un tiers.
    --
    -- Aucun usage légitime n'en a besoin : `owner_id` fait partie de la clé
    -- unique (owner_id, member_email), il est posé à la création et aucun
    -- chemin de l'application ne le réécrit.
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
        RAISE EXCEPTION 'Le compte auquel une invitation donne accès ne se change pas.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Le propriétaire, lui, dispose librement du reste : rôle, libellé.
    IF auth.uid() = OLD.owner_id THEN
        RETURN NEW;
    END IF;

    -- Tout le reste, c'est l'invité. Il ne touche à RIEN de ce qui définit
    -- l'invitation : ni à qui elle s'adresse, ni le niveau de droit qu'elle
    -- accorde.
    IF NEW.owner_email  IS DISTINCT FROM OLD.owner_email
    OR NEW.member_email IS DISTINCT FROM OLD.member_email
    OR NEW.role         IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION
            'Seul le propriétaire d''une invitation peut en changer l''adresse ou le rôle.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Et il ne rattache l'invitation qu'à LUI-MÊME.
    IF NEW.member_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Une invitation ne se rattache qu''à son propre compte.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dashboard_members_garde ON public.dashboard_members;
CREATE TRIGGER trg_dashboard_members_garde
    BEFORE UPDATE ON public.dashboard_members
    FOR EACH ROW EXECUTE FUNCTION public.dashboard_members_garde();

-- ── Les deux fonctions qui portent toute la règle d'accès ───────────────────
-- SECURITY DEFINER : sans ça, lire dashboard_members depuis la policy d'une
-- autre table repasserait par la RLS de dashboard_members — récursion.
-- SET search_path = public : sans ça, un search_path hostile ferait résoudre
-- `dashboard_members` vers une table maison. Les deux vont ensemble.

CREATE OR REPLACE FUNCTION public.a_acces(cible uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT cible = auth.uid()
      OR EXISTS (
           SELECT 1 FROM public.dashboard_members m
           WHERE m.owner_id = cible
             AND m.member_id = auth.uid()
         );
$$;

CREATE OR REPLACE FUNCTION public.peut_editer(cible uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT cible = auth.uid()
      OR EXISTS (
           SELECT 1 FROM public.dashboard_members m
           WHERE m.owner_id = cible
             AND m.member_id = auth.uid()
             AND m.role = 'editor'
         );
$$;

GRANT EXECUTE ON FUNCTION public.a_acces(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.peut_editer(uuid) TO authenticated;

-- L'ouverture des tables de données elle-même est faite en section 15, avec la
-- liste COMPLÈTE. La boucle d'origine de equipe_partage.sql est volontairement
-- omise ici : elle posait exactement les mêmes politiques sur un sous-ensemble
-- de tables, la rejouer ne ferait que doubler le travail de la section 15.


-- ============================================================================
-- 13) platform_budgets — le budget PLANIFIÉ, tel qu'il est posé dans les
--     campagnes. Voir platform_budgets.sql (source de vérité).
--
--     Pulse ne connaissait que le budget DÉPENSÉ. Ce qui a été PROMIS
--     n'existait nulle part : un compte réglé à 200 CHF/jour qui n'en consomme
--     que 60 se lisait comme un compte à 60 CHF/jour, sans qu'on puisse dire
--     s'il sous-dépense ou s'il est à sa cible.
--
--     UNE SUITE DE PHOTOS, PAS UN HISTORIQUE : aucune des deux plateformes ne
--     sait dire ce que valait un budget il y a trois mois. Chaque récolte écrit
--     une ligne datée du jour du relevé ; ce qui précède le premier relevé
--     restera à jamais inconnu.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_budgets (
    user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channel       text NOT NULL CHECK (channel IN ('meta', 'google')),
    campaign_id   text NOT NULL,
    campaign_name text,
    captured_on   date NOT NULL,          -- le jour du relevé, pas le jour du budget
    daily_budget  numeric,                -- CHF/jour   (exclusif avec total_budget)
    total_budget  numeric,                -- CHF pour toute la durée
    start_date    date,
    end_date      date,                   -- NULL = déclarée sans date de fin
    status        text,
    PRIMARY KEY (user_id, channel, campaign_id, captured_on)
);

CREATE INDEX IF NOT EXISTS idx_platform_budgets_user_date
    ON public.platform_budgets (user_id, captured_on DESC);

ALTER TABLE public.platform_budgets ENABLE ROW LEVEL SECURITY;

-- On teste la présence des fonctions de partage plutôt que de la supposer :
-- la migration d'origine doit pouvoir tourner seule, sur une base où le partage
-- n'est pas installé. Ici, jouée après la section 12, elle prend toujours la
-- branche « partagé ».
DO $$
DECLARE
    partage boolean := to_regprocedure('public.a_acces(uuid)') IS NOT NULL
                   AND to_regprocedure('public.peut_editer(uuid)') IS NOT NULL;
BEGIN
    DROP POLICY IF EXISTS "partage_select" ON public.platform_budgets;
    DROP POLICY IF EXISTS "partage_insert" ON public.platform_budgets;
    DROP POLICY IF EXISTS "partage_update" ON public.platform_budgets;
    DROP POLICY IF EXISTS "partage_delete" ON public.platform_budgets;

    IF partage THEN
        CREATE POLICY "partage_select" ON public.platform_budgets
            FOR SELECT USING (public.a_acces(user_id));
        CREATE POLICY "partage_insert" ON public.platform_budgets
            FOR INSERT WITH CHECK (public.peut_editer(user_id));
        CREATE POLICY "partage_update" ON public.platform_budgets
            FOR UPDATE USING (public.peut_editer(user_id))
            WITH CHECK (public.peut_editer(user_id));
        CREATE POLICY "partage_delete" ON public.platform_budgets
            FOR DELETE USING (public.peut_editer(user_id));
    ELSE
        CREATE POLICY "partage_select" ON public.platform_budgets
            FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "partage_insert" ON public.platform_budgets
            FOR INSERT WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "partage_update" ON public.platform_budgets
            FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "partage_delete" ON public.platform_budgets
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;


-- ============================================================================
-- 14) platform_changes — ce que les plateformes DÉCLARENT avoir changé.
--     Voir platform_changes.sql (source de vérité).
--
--     Le fil sait déjà DÉDUIRE cinq faits de la dépense quotidienne, et c'est
--     aveugle : mettre un mot-clé en pause ou changer une audience ne fait pas
--     forcément bouger la dépense du jour. Ces gestes-là n'apparaissaient nulle
--     part, et une courbe qui bouge restait sans explication.
--
--     LA FENÊTRE DE GOOGLE EST LE FAIT DUR DE CETTE TABLE : `change_event` ne
--     remonte que 30 jours. Au-delà, l'information n'existe plus nulle part —
--     ce qui n'a pas été récolté à temps est perdu. D'où le stockage, et d'où
--     `change_id`, un hachage stable qui rend chaque récolte idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_changes (
    user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channel       text NOT NULL CHECK (channel IN ('meta', 'google')),
    change_id     text NOT NULL,          -- hachage stable (canal, horodatage, ressource, champ)
    occurred_at   timestamptz NOT NULL,
    categorie     text NOT NULL CHECK (categorie IN
                      ('budget', 'motcle', 'enchere', 'statut', 'audience', 'creatif', 'creation', 'autre')),
    campaign_id   text,
    campaign_name text,
    resume        text NOT NULL,          -- déjà rédigé en français à la récolte
    PRIMARY KEY (user_id, channel, change_id)
);

-- « creation » : Meta déclare la création d'une campagne, d'un ensemble ou
-- d'une annonce (`create_campaign_group`, `create_ad_set`, `create_ad`), que la
-- récolte garde depuis le ticket 04 de meta-ads. La ranger en « autre » la
-- ferait lire « réglage » à l'écran. Le CREATE TABLE ci-dessus ne touche pas
-- une table déjà là : la contrainte se remplace, sans toucher une ligne. Les
-- lignes existantes satisfont la nouvelle liste, qui ne fait qu'ajouter.
-- SANS ÇA, le premier passage du worker qui rencontre une création voit TOUT
-- son lot de changements Meta refusé.
ALTER TABLE public.platform_changes DROP CONSTRAINT IF EXISTS platform_changes_categorie_check;
ALTER TABLE public.platform_changes ADD CONSTRAINT platform_changes_categorie_check
    CHECK (categorie IN
        ('budget', 'motcle', 'enchere', 'statut', 'audience', 'creatif', 'creation', 'autre'));

-- `fuseau` (meta-ads, ticket 17) : le `timezone_name` du compte publicitaire,
-- récolté avec chaque changement. Meta écrit `event_time` en UTC, alors que
-- les jours des insights sont ceux du compte : sans lui, l'écran poserait la
-- veille un geste fait à Zurich entre minuit et deux heures. NULL = pas encore
-- récolté (lignes d'avant, Google) — l'écran découpe alors en UTC et le dit.
-- Ajout seul, rien n'est réécrit ; le prochain passage du worker remplit les
-- 180 jours qu'il relit.
ALTER TABLE public.platform_changes ADD COLUMN IF NOT EXISTS fuseau text;

CREATE INDEX IF NOT EXISTS idx_platform_changes_user_date
    ON public.platform_changes (user_id, occurred_at DESC);

ALTER TABLE public.platform_changes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    partage boolean := to_regprocedure('public.a_acces(uuid)') IS NOT NULL
                   AND to_regprocedure('public.peut_editer(uuid)') IS NOT NULL;
BEGIN
    DROP POLICY IF EXISTS "partage_select" ON public.platform_changes;
    DROP POLICY IF EXISTS "partage_insert" ON public.platform_changes;
    DROP POLICY IF EXISTS "partage_update" ON public.platform_changes;
    DROP POLICY IF EXISTS "partage_delete" ON public.platform_changes;

    IF partage THEN
        CREATE POLICY "partage_select" ON public.platform_changes
            FOR SELECT USING (public.a_acces(user_id));
        CREATE POLICY "partage_insert" ON public.platform_changes
            FOR INSERT WITH CHECK (public.peut_editer(user_id));
        CREATE POLICY "partage_update" ON public.platform_changes
            FOR UPDATE USING (public.peut_editer(user_id))
            WITH CHECK (public.peut_editer(user_id));
        CREATE POLICY "partage_delete" ON public.platform_changes
            FOR DELETE USING (public.peut_editer(user_id));
    ELSE
        CREATE POLICY "partage_select" ON public.platform_changes
            FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "partage_insert" ON public.platform_changes
            FOR INSERT WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "partage_update" ON public.platform_changes
            FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "partage_delete" ON public.platform_changes
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;


-- ============================================================================
-- 14bis) LE CATALOGUE DES ÉVÉNEMENTS GA4 — profiles.ga4_event_catalog.
--
--     Le funnel GA4 était une liste de six noms écrits en dur dans
--     `collecte/ga4/fetch_ga4.py`, devinés pour un e-commerce standard. Un
--     site qui nomme ses conversions autrement ne remontait rien, en silence.
--     Ce catalogue est LA LISTE des événements que la propriété émet vraiment,
--     avec leur volume et la marque « événement clé » de GA4. /conversions la
--     lit. C'est un cache : lu en entier, pour un seul utilisateur, jamais
--     joint. D'où le jsonb plutôt qu'une table.
--
--     Il est né avec `theme_ga4_events`, qui disait quel événement comptait
--     pour quel thème. Le thème a quitté le produit le 2026-09-30 ; la table
--     est détruite par `998_supprimer_le_theme.sql`, le catalogue reste.
-- ============================================================================

-- `maj` vit DANS le jsonb et non dans une colonne à côté : une colonne nommée
-- `..._refreshed_at` déclencherait le contrôle de sécurité de fin de fichier,
-- qui refuse toute colonne de `profiles` dont le nom contient
-- token/secret/refresh — cette table étant partagée avec les invités.
-- Forme : {"maj": "2026-08-18", "evenements": [{"nom","volume","valeur","cle"}]}
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS ga4_event_catalog jsonb NOT NULL DEFAULT '{}'::jsonb;


-- ============================================================================
-- 14ter) fetch_progress — l'avancement RÉEL de la récolte (voir
--        fetch_progress.sql, source de vérité).
--
--        AVANT LA SECTION 15, qui doit la partager : sans ça, un membre invité
--        verrait un panneau de récolte vide, sans erreur nulle part.
--
--        Elle existe parce que la barre de « ↻ Mes données » ne mesurait rien —
--        `avancement(sec)` est une exponentielle sur le temps écoulé, et la
--        liste des étapes est horodatée à la main. Depuis que les quatre
--        plateformes tournent en parallèle, ces étapes sont fausses par
--        construction. Le worker écrit désormais où il en est, canal par canal.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.fetch_progress (
    user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    canal      text NOT NULL CHECK (canal IN
                   ('meta', 'instagram', 'google', 'ga4', 'labels', 'rapport')),
    -- Le passage (horodatage ISO du départ). L'écran n'affiche que le run_id le
    -- plus grand : sur un ISO en UTC, le tri texte donne le plus récent.
    run_id     text NOT NULL,
    -- 'saute' n'est pas un échec : c'est « pas appelé, et voici pourquoi ».
    etat       text NOT NULL CHECK (etat IN
                   ('attente', 'en_cours', 'fini', 'echec', 'saute')),
    -- L'étape franchie DANS le canal, en clair. Jamais un pourcentage : le
    -- nombre d'appels API d'un canal n'est pas connu d'avance.
    etape      text,
    -- La ligne que le journal du worker imprime déjà. On la range, on ne la
    -- réécrit pas.
    mot_de_fin text,
    debut_a    timestamptz,
    fin_a      timestamptz,
    maj_a      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, canal)
);

-- « Chacun ses lignes » n'est PAS posé ici : cette table est neuve et n'a
-- jamais eu d'autre règle. La section 15, juste en
-- dessous, lui pose ses politiques `partage_*` et c'est la seule source.
ALTER TABLE public.fetch_progress ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 14quinquies) conversion_categories + ga4_event_categories — les catégories
--              de conversions (voir conversion_categories.sql, source de vérité).
--
--              AVANT LA SECTION 15, qui doit les partager, même raison que
--              14ter.
--
--              Ceci dit à quel GENRE de conversion appartient chaque
--              événement (Ventes, Contacts…) — PAR NOM D'ÉVÉNEMENT : un même
--              événement signifie la même chose partout, et c'est ce qui permet au camembert de
--              /conversions de compter « conversions par catégorie » sur tout
--              le compte. `category_source` rejoue la règle d'or de la
--              labellisation IA : un choix humain n'est jamais écrasé par la
--              classification automatique (`saas/recos_ia/categorizing.py`).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.conversion_categories (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name        text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT conversion_categories_uq UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_conversion_categories_user
    ON public.conversion_categories (user_id);

DROP TRIGGER IF EXISTS trg_conversion_categories_updated_at ON public.conversion_categories;
CREATE TRIGGER trg_conversion_categories_updated_at
    BEFORE UPDATE ON public.conversion_categories
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.ga4_event_categories (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_name      text NOT NULL,
    category        text NOT NULL,
    category_source text NOT NULL DEFAULT 'user',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ga4_event_categories_uq UNIQUE (user_id, event_name)
);

DO $$
BEGIN
    ALTER TABLE public.ga4_event_categories
        ADD CONSTRAINT ga4_event_categories_source_ck
        CHECK (category_source IN ('user', 'ai'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_ga4_event_categories_user
    ON public.ga4_event_categories (user_id);

DROP TRIGGER IF EXISTS trg_ga4_event_categories_updated_at ON public.ga4_event_categories;
CREATE TRIGGER trg_ga4_event_categories_updated_at
    BEFORE UPDATE ON public.ga4_event_categories
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- « Chacun ses lignes ». Le partage d'équipe est posé par la section 15, qui
-- suit immédiatement et qui porte ces deux tables dans sa liste.
ALTER TABLE public.conversion_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cc_select_own" ON public.conversion_categories;
DROP POLICY IF EXISTS "cc_insert_own" ON public.conversion_categories;
DROP POLICY IF EXISTS "cc_update_own" ON public.conversion_categories;
DROP POLICY IF EXISTS "cc_delete_own" ON public.conversion_categories;
CREATE POLICY "cc_select_own" ON public.conversion_categories
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cc_insert_own" ON public.conversion_categories
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cc_update_own" ON public.conversion_categories
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cc_delete_own" ON public.conversion_categories
    FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.ga4_event_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gec_select_own" ON public.ga4_event_categories;
DROP POLICY IF EXISTS "gec_insert_own" ON public.ga4_event_categories;
DROP POLICY IF EXISTS "gec_update_own" ON public.ga4_event_categories;
DROP POLICY IF EXISTS "gec_delete_own" ON public.ga4_event_categories;
CREATE POLICY "gec_select_own" ON public.ga4_event_categories
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "gec_insert_own" ON public.ga4_event_categories
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gec_update_own" ON public.ga4_event_categories
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gec_delete_own" ON public.ga4_event_categories
    FOR DELETE USING (auth.uid() = user_id);


-- ============================================================================
-- 14sexies) reco_news — RETIRÉE le 7 septembre 2026.
--
--     Portait la file du classificateur du Graphe A (recos sur le compte
--     entier), retiré en bloc le même jour sur décision de David : « on a
--     pas de recos sur le compte entier, je veux que ça soit supprimé de
--     partout » — voir `.scratch/recos-generales/map.md`, section « Out of
--     scope », pour l'historique complet (troisième retournement sur ce
--     sujet). Le code (`saas/traitement/build_report.py`) ne l'alimente
--     plus depuis ce commit ; ce DROP est le geste explicitement validé par
--     David pour la donnée elle-même (CLAUDE.md §7 : rien de destructeur
--     sans le signaler et le faire valider — signalé, validé).
--
--     `IF EXISTS` : rejouable sans risque, que la table ait déjà été
--     supprimée ou n'ait jamais existé sur cette base (migration jamais
--     jouée avant le retrait).
-- ============================================================================

DROP TABLE IF EXISTS public.reco_news;


-- ============================================================================
-- 15) PARTAGE — toutes les tables au même niveau, et le contrôle des jetons.
--     Voir partage_tables_manquantes.sql (source de vérité).
--
--     POURQUOI CETTE SECTION VIENT APRÈS TOUTES LES CRÉATIONS DE TABLES.
--     La boucle d'origine (equipe_partage.sql) est une PHOTO : elle ne connaît
--     que les tables existant le jour où on l'a écrite, et elle passe son
--     chemin EN SILENCE sur les autres. Une table née ensuite sans sa règle de
--     partage reste invisible à l'invité — module par module, sans erreur nulle
--     part : le dashboard s'affiche, il est juste vide à cet endroit-là. C'est
--     le genre de trou qui ne se voit qu'en production, et seulement chez
--     l'invité. Ici la liste est complète, et une table absente est SIGNALÉE.
-- ============================================================================

-- ── 15.0 Les fonctions doivent être là ──────────────────────────────────────
DO $$
BEGIN
    IF to_regprocedure('public.a_acces(uuid)') IS NULL
       OR to_regprocedure('public.peut_editer(uuid)') IS NULL THEN
        RAISE EXCEPTION
            'a_acces() / peut_editer() manquent : la section 12 n''a pas été jouée.';
    END IF;
END $$;

-- ── 15.1 La liste complète, appliquée ───────────────────────────────────────
DO $$
DECLARE
    t   text;
    col text;
    tables text[] := ARRAY[
        -- régies publicitaires
        'meta_ads_insights', 'google_ads_insights', 'google_ads_ad_insights',
        'meta_campaign_config', 'google_campaign_config',
        -- ce que disent les annonces Meta (section 0bis)
        'meta_ads_creatives', 'meta_ads_creative_assets',
        -- organique et analytics
        'instagram_organic_posts', 'followers_history',
        'ga4_insights', 'ga4_events',
        -- ce que Pulse produit et ce que l'utilisateur y répond
        'weekly_reports',
        -- les catégories de conversions
        'conversion_categories', 'ga4_event_categories',
        -- budgets et journal des plateformes
        'channel_budgets', 'platform_budgets', 'platform_changes',
        -- l'avancement de la récolte, lu par le panneau de « ↻ Mes données »
        'fetch_progress',
        -- le profil : objectif, persona IA, site du client
        'profiles'
    ];
    -- NB : 'meta_campaign_status' figurait dans la liste d'origine. Ce n'est
    -- pas une table, c'est le nom d'une migration qui ajoute une colonne à
    -- meta_campaign_config. La boucle la sautait sans rien dire ; on l'a
    -- retirée plutôt que de laisser croire à une table oubliée.
    --
    -- 'dashboard_members' n'y est pas non plus, et c'est voulu : elle a ses
    -- propres règles (dm_*). L'ouvrir au partage laisserait un invité lire —
    -- et réécrire — la liste des invitations.
    --
    -- 'email_envois' (section 26) non plus, et c'est voulu aussi : RLS activée
    -- SANS AUCUNE POLICY, service_role seul. C'est une mesure d'exploitation —
    -- ce qu'est devenu l'email hebdo — pas une information produit. Ni le
    -- propriétaire du compte ni un invité n'ont rien à y voir. Lui ajouter une
    -- ligne ici reviendrait sur l'ADR 0007, pas sur un oubli.
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                       WHERE table_schema = 'public' AND table_name = t) THEN
            RAISE WARNING 'table % absente — sa migration n''a pas été jouée', t;
            CONTINUE;
        END IF;

        -- profiles se repère par id, toutes les autres par user_id.
        col := CASE WHEN t = 'profiles' THEN 'id' ELSE 'user_id' END;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'public' AND table_name = t
                         AND column_name = col) THEN
            RAISE WARNING 'table % sans colonne % — partage impossible', t, col;
            CONTINUE;
        END IF;

        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS "partage_select" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "partage_insert" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "partage_update" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "partage_delete" ON public.%I', t);

        EXECUTE format(
            'CREATE POLICY "partage_select" ON public.%I FOR SELECT USING (public.a_acces(%I))', t, col);
        EXECUTE format(
            'CREATE POLICY "partage_insert" ON public.%I FOR INSERT WITH CHECK (public.peut_editer(%I))', t, col);
        EXECUTE format(
            'CREATE POLICY "partage_update" ON public.%I FOR UPDATE USING (public.peut_editer(%I)) WITH CHECK (public.peut_editer(%I))', t, col, col);
        EXECUTE format(
            'CREATE POLICY "partage_delete" ON public.%I FOR DELETE USING (public.peut_editer(%I))', t, col);
    END LOOP;
END $$;

-- Les anciennes politiques « chacun ses lignes » restent en place : PostgreSQL
-- combine en OU les politiques d'une même commande, donc elles n'enlèvent aucun
-- droit et garantissent au propriétaire de garder le sien quoi qu'il arrive.

-- ── 15.2 connected_accounts : on vérifie qu'elle est restée fermée ──────────
-- Deux gestes, aucun risque :
--   · on retire toute politique de partage qui aurait atterri là par
--     inadvertance (une liste recopiée trop vite suffirait) — c'est le seul
--     DROP de cette section, et il ne peut qu'ENLEVER un accès, jamais en
--     donner un ;
--   · on refuse d'activer la RLS sur une table qui n'aurait aucune politique —
--     ce serait fermer la porte au propriétaire lui-même et casser toute la
--     page Connexions. Dans ce cas on avertit, on ne touche à rien.

DO $$
DECLARE
    r        record;
    nb_pol   integer;
    rls_on   boolean;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'public' AND table_name = 'connected_accounts') THEN
        RAISE WARNING 'connected_accounts absente — rien à vérifier';
        RETURN;
    END IF;

    FOR r IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'connected_accounts'
          AND (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
              ~ '(a_acces|peut_editer)'
    LOOP
        EXECUTE format('DROP POLICY %I ON public.connected_accounts', r.policyname);
        RAISE WARNING
            'politique de PARTAGE retirée de connected_accounts : % — les jetons Meta/Google ne se partagent pas',
            r.policyname;
    END LOOP;

    SELECT count(*) INTO nb_pol
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'connected_accounts';

    SELECT relrowsecurity INTO rls_on
    FROM pg_class WHERE oid = 'public.connected_accounts'::regclass;

    IF nb_pol = 0 THEN
        RAISE WARNING
            'connected_accounts n''a AUCUNE politique. On n''active pas la RLS (plus personne ne lirait ses propres connexions). À regarder à la main.';
    ELSIF NOT rls_on THEN
        ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS activée sur connected_accounts (% politique(s) déjà en place)', nb_pol;
    ELSE
        RAISE NOTICE 'connected_accounts : RLS active, % politique(s), aucune de partage. Conforme.', nb_pol;
    END IF;
END $$;


-- ============================================================================
-- 16) LES DATES DÉCLARÉES D'UNE CAMPAGNE — début et fin programmés.
--     Voir campagnes_dates_declarees.sql (source de vérité).
--
--     Elles ne se déduisent pas de ce qu'on a déjà : nos barres de frise
--     viennent des jours où une campagne a RÉELLEMENT dépensé. Une campagne
--     programmée jusqu'en décembre et une campagne arrêtée hier laissent
--     exactement la même trace. La seule façon de distinguer les deux, c'est de
--     demander à la plateforme ce qui y est écrit.
--
--     `end_date` NULL a DEUX sens qu'il faut savoir distinguer à la lecture :
--       · la ligne existe et end_date est NULL → pas de fin programmée ;
--       · aucune ligne → on n'a rien récolté, on ne sait pas.
--     L'affichage ne montre un prévisionnel que dans le premier cas.
-- ============================================================================

ALTER TABLE public.meta_campaign_config
    ADD COLUMN IF NOT EXISTS start_date date DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS end_date   date DEFAULT NULL;

ALTER TABLE public.google_campaign_config
    ADD COLUMN IF NOT EXISTS start_date date DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS end_date   date DEFAULT NULL;


-- ============================================================================
-- 18) LE SITE DU CLIENT — profiles.site_url. Voir site_client.sql.
--
--     C'EST LA COLONNE PAR LAQUELLE ON A DÉCOUVERT QUE CE FICHIER MENTAIT :
--     « Enregistrement impossible — rejoue le SQL site_client.sql ».
--
--     Pulse connaît les chiffres d'un compte sans savoir ce que ce compte VEND.
--     L'onboarding demande le secteur (« e-commerce », « commerce local ») :
--     c'est une case, pas une entreprise. Le domaine, lui, dit tout d'un coup —
--     la gamme, le prix, la langue, le pays, le ton.
--
--     FACULTATIF PAR CONSTRUCTION : nullable, aucun défaut, aucun NOT NULL.
--     Beaucoup de clients n'ont qu'une page Instagram, d'autres ne veulent pas
--     donner leur adresse à la première minute. Un onboarding qui se referme
--     sur ce champ ne perd pas un champ, il perd le client entier.
--
--     Même précaution SSRF qu'en section 17 : on la stocke, le serveur ne la
--     visite jamais.
-- ============================================================================

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS site_url text;

DO $$
BEGIN
    ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_site_url_ck
        CHECK (
            site_url IS NULL
            OR (site_url ~* '^https?://[^[:space:]]+\.[^[:space:]]+$'
                AND length(site_url) <= 2048)
        );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.profiles.site_url IS
    'Site ou page d''accueil du client, facultatif. Stocké, jamais visité par le serveur (SSRF).';


-- ============================================================================
-- 21) instagram_posts_par_user.sql — VOLONTAIREMENT ABSENT DE CE FICHIER.
--
--     C'est la seule migration du dossier qui EFFACE des lignes. Elle corrige
--     un vrai bug (post_id était unique GLOBALEMENT : deux comptes Pulse
--     suivant la même page Instagram se volaient leurs posts à chaque récolte,
--     mesuré à 200/200 en production), et pour poser la bonne unicité
--     (user_id, post_id) elle doit d'abord dédoublonner :
--
--         DELETE FROM public.instagram_organic_posts a
--         USING public.instagram_organic_posts b
--         WHERE a.user_id = b.user_id AND a.post_id = b.post_id AND a.id < b.id;
--
--     …précédé de deux boucles qui suppriment la contrainte et l'index uniques
--     hérités. Ce fichier-ci se veut rejouable les yeux fermés : on n'y met
--     rien qui efface. Un DELETE se lance en le regardant, une fois, en sachant
--     ce qu'on fait.
--
--     À FAIRE, SÉPARÉMENT ET UNE SEULE FOIS :
--         supabase/migrations/instagram_posts_par_user.sql
--     Tant qu'elle n'a pas tourné, le bug de vol de posts reste ouvert dès que
--     deux comptes suivent la même page Instagram.
--
--     Seul l'index de LECTURE en est repris ci-dessous : il ne supprime rien,
--     ne peut pas échouer sur des doublons, et toutes les requêtes de l'app
--     filtrent par user_id puis trient par date.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_instagram_posts_user_date
    ON public.instagram_organic_posts (user_id, date DESC);


-- ============================================================================
-- 26) email_envois — CE QU'EST DEVENU L'EMAIL HEBDO QU'ON A ENVOYÉ (ticket 50)
--
-- Copie fidèle de `supabase/migrations/email_envois.sql` — s'y reporter pour le
-- raisonnement complet. L'essentiel tient en trois lignes :
--
--   · Le ticket 47 alerte David au motif que « le client a déjà été prévenu ».
--     On ne savait pas s'il avait ouvert. Cette table range ce fait.
--   · UNE NON-OUVERTURE NE PROUVE RIEN (pixel bloqué, prévisualisation). La
--     table ne porte donc jamais « pas ouvert », seulement `dernier_evenement`,
--     ce que le fournisseur a remonté, tel quel.
--   · RLS ACTIVÉE, AUCUNE POLICY, ET C'EST LA DÉCISION — pas un oubli. Mesure
--     d'exploitation, pas information produit : le client n'a rien à y voir, un
--     invité non plus. D'où son absence VOLONTAIRE de la section 15.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_envois (
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start  date NOT NULL,
    -- 'resend', 'dry'… Sans clé configurée, `send_email` passe en dry-run : la
    -- ligne existe quand même et dit que RIEN n'est parti. Un dry-run lu comme
    -- un envoi ferait conclure « jamais ouvert » sur un email qui n'a jamais
    -- quitté la machine.
    fournisseur text NOT NULL,
    -- NULL en dry-run et sur un envoi en échec : il n'y a rien à relire.
    message_id  text,
    -- Un fait plus fort qu'une ouverture, et il se perdait dans un log.
    envoi_ok    boolean NOT NULL,
    envoye_a    timestamptz NOT NULL DEFAULT now(),
    -- Aucune contrainte CHECK, volontairement : le jour où Resend ajoute un
    -- événement, un CHECK ferait échouer l'écriture du worker sur le fait
    -- qu'on cherchait à apprendre. C'est le code qui traduit, et il range ce
    -- qu'il ne connaît pas dans « inconnu », jamais dans « sans réponse ».
    dernier_evenement text,
    -- NULL = on n'a pas encore demandé. Ce n'est pas « on a demandé et rien
    -- n'est remonté ». Sans cette colonne, les deux se liraient pareil.
    releve_a    timestamptz,
    PRIMARY KEY (user_id, week_start)
);

ALTER TABLE public.email_envois ENABLE ROW LEVEL SECURITY;
-- Aucune policy — voir l'en-tête. RLS active + zéro policy = zéro ligne
-- visible, pour tout le monde sauf la clé service_role.


-- ============================================================================
-- CONTRÔLE — juste avant la toute fin du fichier. Un `NOTIFY pgrst, 'reload
-- schema'` la suit (voir la note en toute fin de fichier) : ce n'est donc PLUS
-- la dernière instruction, et le SQL editor de Supabase n'affiche que le
-- résultat de la toute dernière instruction jouée. Rejouer le fichier en
-- entier affichera « Success. No rows returned », pas ce tableau. Pour le
-- voir, sélectionne uniquement ce bloc (du `WITH attendu` ci-dessous jusqu'au
-- `ORDER BY` qui le termine) et exécute cette sélection seule
-- (Cmd/Ctrl+Entrée) — APRÈS avoir joué le fichier complet, jamais avant : lue
-- trop tôt, sur une base où tout n'est pas encore installé, elle remonte des
-- ✗ normaux (rien n'a de raison d'être là) qui n'ont rien à voir avec un
-- échec. C'est seulement une fois le fichier entier rejoué que ces mêmes ✗
-- deviennent le signal utile.
--
-- Ce qui manque remonte EN HAUT du tableau. Si la première ligne dit « ✓ »,
-- il ne manque rien. Rien à interpréter, rien à comparer à la main.
--
-- Trois familles dans le même tableau :
--   table / colonne / fonction — ce que ce fichier installe
--   sécurité                   — les jetons ne sont lisibles par aucun invité
--   réglage                    — les défauts qui, absents, échouent en silence
-- ============================================================================

WITH attendu(kind, obj, col) AS (VALUES
    -- ── Tables supposées déjà là (posées à la main avant les migrations) ────
    ('t', 'profiles',                 NULL::text),
    ('t', 'connected_accounts',       NULL),
    ('t', 'instagram_organic_posts',  NULL),
    ('t', 'followers_history',        NULL),
    -- ── Tables installées par ce fichier ───────────────────────────────────
    ('t', 'meta_ads_insights',        NULL),
    ('t', 'meta_campaign_config',     NULL),
    ('t', 'google_ads_insights',      NULL),
    ('t', 'google_campaign_config',   NULL),
    ('t', 'google_ads_ad_insights',   NULL),
    ('t', 'meta_ads_creatives',       NULL),   -- §0bis
    ('t', 'meta_ads_creative_assets', NULL),   -- §0bis
    ('t', 'ga4_insights',             NULL),
    ('t', 'ga4_events',               NULL),
    ('t', 'channel_budgets',          NULL),
    ('t', 'weekly_reports',           NULL),
    ('t', 'email_envois',             NULL),
    ('t', 'dashboard_members',        NULL),
    ('t', 'platform_budgets',         NULL),
    ('t', 'platform_changes',         NULL),
    ('t', 'fetch_progress',           NULL),   -- §14ter
    ('t', 'conversion_categories',    NULL),   -- §14quinquies
    ('t', 'ga4_event_categories',     NULL),   -- §14quinquies
    -- ── Colonnes : chacune est une fonctionnalité qui, sinon, refuse de ─────
    --    s'enregistrer avec un message d'erreur
    ('c', 'profiles',                 'objectif'),             -- §3
    ('c', 'profiles',                 'business_type'),        -- §7
    ('c', 'profiles',                 'budget_range'),         -- §7
    ('c', 'profiles',                 'time_budget'),          -- §7
    ('c', 'profiles',                 'frustration'),          -- §7
    ('c', 'profiles',                 'site_url'),             -- §18
    ('c', 'profiles',                 'ga4_event_catalog'),    -- §14bis
    ('c', 'connected_accounts',       'provider'),             -- §4
    ('c', 'connected_accounts',       'google_refresh_token'), -- §4
    ('c', 'connected_accounts',       'google_customer_id'),   -- §4
    ('c', 'connected_accounts',       'ga4_property_id'),      -- §4
    ('c', 'ga4_insights',             'campaign'),             -- §2
    ('c', 'meta_campaign_config',     'effective_status'),     -- §0
    ('c', 'meta_campaign_config',     'campaign_id'),          -- §0
    ('c', 'meta_ads_insights',        'campaign_id'),          -- §0
    ('c', 'meta_ads_insights',        'adset_id'),             -- §0
    ('c', 'meta_ads_insights',        'attribution_setting'),  -- §0
    ('c', 'meta_ads_insights',        'results'),              -- §0
    ('c', 'meta_campaign_config',     'start_date'),           -- §16
    ('c', 'meta_campaign_config',     'end_date'),             -- §16
    ('c', 'google_campaign_config',   'start_date'),           -- §16
    ('c', 'google_campaign_config',   'end_date'),             -- §16
    -- ── Fonctions ──────────────────────────────────────────────────────────
    ('f', 'public.set_updated_at()',       NULL),
    ('f', 'public.a_acces(uuid)',          NULL),   -- §12
    ('f', 'public.peut_editer(uuid)',      NULL)    -- §12
),
catalogue AS (
    SELECT
        CASE a.kind WHEN 't' THEN 'table'
                    WHEN 'c' THEN 'colonne'
                    ELSE          'fonction' END        AS famille,
        a.obj || coalesce('.' || a.col, '')             AS objet,
        CASE
            WHEN a.kind = 'f' THEN
                CASE WHEN to_regprocedure(a.obj) IS NOT NULL
                     THEN '✓' ELSE '✗ FONCTION ABSENTE' END
            WHEN to_regclass('public.' || a.obj) IS NULL THEN '✗ TABLE ABSENTE'
            WHEN a.kind = 't' THEN '✓'
            WHEN EXISTS (SELECT 1 FROM information_schema.columns c
                         WHERE c.table_schema = 'public'
                           AND c.table_name   = a.obj
                           AND c.column_name  = a.col) THEN '✓'
            ELSE '✗ COLONNE ABSENTE'
        END                                             AS etat
    FROM attendu a
),
securite AS (
    SELECT 'sécurité'::text,
           'connected_accounts — aucune politique de partage'::text,
           CASE WHEN EXISTS (
                    SELECT 1 FROM pg_policies
                    WHERE schemaname = 'public' AND tablename = 'connected_accounts'
                      AND (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
                          ~ '(a_acces|peut_editer)')
                THEN '✗ FUITE DE JETONS — un invité lit connected_accounts'
                ELSE '✓' END
    UNION ALL
    SELECT 'sécurité',
           'connected_accounts — RLS active',
           CASE WHEN coalesce((SELECT c.relrowsecurity FROM pg_class c
                               WHERE c.oid = to_regclass('public.connected_accounts')), false)
                THEN '✓' ELSE '✗ RLS ÉTEINTE SUR LA TABLE DES JETONS' END
    UNION ALL
    SELECT 'sécurité',
           'profiles — aucun jeton (cette table EST partagée)',
           CASE WHEN EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'profiles'
                      AND column_name ~ '(token|secret|refresh)')
                THEN '✗ UN JETON TRAÎNE SUR profiles, LU PAR LES INVITÉS'
                ELSE '✓' END
    UNION ALL
    SELECT 'réglage',
           'profiles.fetch_schedule — défaut ''Monday''',
           CASE WHEN coalesce((SELECT column_default FROM information_schema.columns
                               WHERE table_schema = 'public' AND table_name = 'profiles'
                                 AND column_name = 'fetch_schedule'), '') LIKE '%Monday%'
                THEN '✓' ELSE '✗ sans défaut, un profil n''est jamais récolté' END
)
SELECT famille, objet, etat
FROM (SELECT * FROM catalogue UNION ALL SELECT * FROM securite) r(famille, objet, etat)
ORDER BY (etat = '✓'), famille, objet;

-- ============================================================================
-- FIN — la dernière section de FOND du fichier (tables, policies, contrôle).
-- Ce qui suit n'installe plus rien : deux requêtes de contrôle annexes, à
-- lancer à part (A et B ci-dessous), puis un unique `NOTIFY pgrst, 'reload
-- schema'` exécutable, tout en bas du fichier — voir la note qui l'accompagne.
--
-- Deux contrôles qui ne tiennent pas dans le tableau ci-dessus, à lancer à part
-- le jour où le partage d'équipe pose question :
--
--   A) Ce que l'invité peut lire — doit lister les 19 tables de la section 15.
--      (Mesuré le 2026-10-03 sur un PostgreSQL local, après l'arrivée de
--      meta_ads_creatives et meta_ads_creative_assets : 19 tables distinctes
--      portent une politique `partage_*`.)
--      SELECT tablename, policyname FROM pg_policies
--      WHERE schemaname = 'public' AND policyname LIKE 'partage_%'
--      ORDER BY tablename, policyname;
--
--   B) Les tables qu'un invité NE voit PAS. Attendu : connected_accounts
--      (volontaire), email_envois (volontaire aussi — mesure d'exploitation,
--      section 26 : RLS activée sans aucune policy, service_role seul),
--      dashboard_members (règle propre dm_select), et les tables de l'ancien
--      Streamlit (ai_recommendations, ai_feedback, free_data, paid_data).
--      Toute AUTRE ligne est un module que l'invité verra vide :
--      SELECT c.relname
--      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--      WHERE n.nspname = 'public' AND c.relkind = 'r'
--        AND EXISTS (SELECT 1 FROM information_schema.columns
--                    WHERE table_schema = 'public' AND table_name = c.relname
--                      AND column_name IN ('user_id', 'id'))
--        AND NOT EXISTS (SELECT 1 FROM pg_policies p
--                        WHERE p.schemaname = 'public' AND p.tablename = c.relname
--                          AND p.cmd IN ('SELECT', 'ALL')
--                          AND coalesce(p.qual, '') ~ 'a_acces')
--      ORDER BY 1;
-- ============================================================================

-- Supabase recharge normalement le cache de schéma de PostgREST après un DDL
-- passé par le SQL editor — sans ça, aucune des tables de ce fichier ne
-- répondrait jamais en REST, alors qu'elles le font toutes aujourd'hui. Mais
-- ce rechargement automatique n'est pas garanti instantané ni infaillible :
-- s'il prend du retard ou ne se déclenche pas pour une table neuve (ex.
-- fetch_progress, créée section 14ter), elle peut répondre PGRST205 (« table
-- introuvable ») côté API alors qu'elle existe bien en base — et ça vaut pour
-- TOUTE requête REST vers cette table, écriture comme lecture, y compris avec
-- la clé service_role : cette clé fait sauter la RLS, pas ce cache. Voir le
-- commentaire détaillé en fin de `fetch_progress.sql` pour le symptôme que ça
-- produit côté écran. NOTIFY force ce rechargement explicitement, en secours —
-- commande standard, non destructive.
NOTIFY pgrst, 'reload schema';
