-- ============================================================================
-- LE SITE DU CLIENT
--
-- POURQUOI
-- Pulse connaît les chiffres d'un compte sans savoir ce que ce compte VEND.
-- L'onboarding demande le secteur (« e-commerce », « commerce local ») : c'est
-- une case, pas une entreprise. Le domaine, lui, dit tout d'un coup — la
-- gamme, le prix, la langue, le pays, le ton. C'est la réponse la plus courte
-- à « qui est ce client », et elle ne peut venir que de lui : ni Meta ni Google
-- ne l'exposent de façon fiable au niveau du compte.
--
-- Même famille que `campagne_landing.sql`, autre échelle : là-bas c'est la page
-- où une campagne ATTERRIT, ici c'est la maison. Les deux ensemble permettront
-- de dire « ta campagne pousse vers la page d'accueil alors qu'elle vend un
-- produit précis » — un conseil qu'aucune des deux colonnes ne porte seule.
--
-- FACULTATIF PAR CONSTRUCTION
-- Colonne nullable, aucune valeur par défaut, aucun NOT NULL. Beaucoup de
-- clients n'ont qu'une page Instagram, d'autres ne veulent pas donner leur
-- adresse à la première minute. Un onboarding qui se referme sur ce champ ne
-- perd pas un champ, il perd le client entier.
--
-- CE QU'ON EN FAIT, ET CE QU'ON N'EN FAIT PAS
-- On la STOCKE. On ne la VISITE pas depuis le serveur : rien de ce qui est
-- écrit ici ne déclenche de requête sortante. Un champ libre dans lequel
-- l'utilisateur colle une adresse, et que le serveur irait chercher tout seul,
-- c'est une SSRF offerte — il suffirait d'y mettre une adresse interne
-- (169.254.169.254, un service du réseau privé) pour faire lire au serveur ce
-- qu'il est le seul à pouvoir atteindre. Le jour où une reco voudra vraiment
-- lire la page, ce sera par un chemin explicite, avec une liste d'hôtes
-- autorisée, et ça se décidera à ce moment-là.
--
-- LE CHECK N'EST PAS UNE VALIDATION D'URL, C'EST UN GARDE-FOU
-- La vraie validation vit dans `urlPropre` (saas/web/app/actions.ts), partagée
-- avec la page d'arrivée des campagnes : `new URL()`, http(s) seulement, pas
-- d'identifiant dans l'adresse, un nom de domaine obligatoire. Le CHECK
-- ci-dessous ne fait qu'interdire à la base d'accepter ce qui ne ressemble même
-- pas à une adresse — parce qu'un jour un script écrira dans cette colonne sans
-- passer par l'application.
--
-- Idempotent : rejouable sans risque.
-- ============================================================================

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS site_url text;

-- `ADD CONSTRAINT IF NOT EXISTS` n'existe pas pour un CHECK : on rattrape
-- l'erreur de doublon plutôt que de la deviner.
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
