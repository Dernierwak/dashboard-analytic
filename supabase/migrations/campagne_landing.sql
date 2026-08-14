-- ============================================================================
-- LA PAGE D'ARRIVÉE D'UNE CAMPAGNE
--
-- POURQUOI
-- Pulse sait ce qu'une campagne COÛTE et ce qu'elle rapporte en clics. Il ne
-- sait rien de ce qu'elle VEND : le nom « CH_DE_Prospection_Q3_v2 » ne dit ni
-- le produit, ni le prix, ni la promesse. C'est ce trou qui limite les conseils
-- — on peut dire « ton CPC monte », jamais « ta page d'arrivée demande cinq
-- champs pour un produit à 39 CHF ».
--
-- L'adresse de destination est la seule information qui referme ce trou, et
-- elle ne peut venir que de l'utilisateur : ni Meta ni Google ne l'exposent de
-- façon fiable au niveau campagne (Meta la met au niveau annonce, Google la
-- répartit entre `final_urls` et les extensions).
--
-- CE QU'ON EN FAIT, ET CE QU'ON N'EN FAIT PAS
-- On la STOCKE. On ne la VISITE pas depuis le serveur : aucune requête sortante
-- n'est déclenchée par ce qui est écrit ici. Un champ libre dans lequel
-- l'utilisateur colle une adresse, et que le serveur irait chercher tout seul,
-- c'est une SSRF offerte — il suffirait d'y mettre une adresse interne pour
-- faire lire au serveur ce qu'il est le seul à pouvoir atteindre. Le jour où
-- une reco voudra vraiment lire la page, ce sera par un chemin explicite, avec
-- une liste d'hôtes autorisée, et ça se décidera à ce moment-là.
--
-- LE CHECK N'EST PAS UNE VALIDATION D'URL, C'EST UN GARDE-FOU
-- La vraie validation vit dans `setCampaignLanding` (saas/web/app/actions.ts) :
-- elle passe par `new URL()`, refuse les identifiants dans l'adresse et exige
-- un nom de domaine. Le CHECK ci-dessous ne fait qu'interdire à la base
-- d'accepter ce qui ne ressemble même pas à une adresse — parce qu'un jour un
-- script écrira dans cette colonne sans passer par l'application.
--
-- Idempotent : rejouable sans risque.
-- ============================================================================

ALTER TABLE public.meta_campaign_config
    ADD COLUMN IF NOT EXISTS landing_url text;

ALTER TABLE public.google_campaign_config
    ADD COLUMN IF NOT EXISTS landing_url text;

-- `ADD CONSTRAINT IF NOT EXISTS` n'existe pas pour un CHECK : on rattrape
-- l'erreur de doublon plutôt que de la deviner.
DO $$
BEGIN
    ALTER TABLE public.meta_campaign_config
        ADD CONSTRAINT meta_campaign_config_landing_url_ck
        CHECK (
            landing_url IS NULL
            OR (landing_url ~* '^https?://[^[:space:]]+\.[^[:space:]]+$'
                AND length(landing_url) <= 2048)
        );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE public.google_campaign_config
        ADD CONSTRAINT google_campaign_config_landing_url_ck
        CHECK (
            landing_url IS NULL
            OR (landing_url ~* '^https?://[^[:space:]]+\.[^[:space:]]+$'
                AND length(landing_url) <= 2048)
        );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
