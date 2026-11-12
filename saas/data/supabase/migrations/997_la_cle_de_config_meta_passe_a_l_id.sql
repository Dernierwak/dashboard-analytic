-- ============================================================================
-- 997_la_cle_de_config_meta_passe_a_l_id.sql
--
-- ⚠️  CE FICHIER CHANGE UNE CLÉ PRIMAIRE (`CLAUDE.md` §7 : DROP CONSTRAINT).
--     Il n'est PAS inclus dans `000_run_me_all.sql` : il se joue UNE FOIS, à
--     la main, après relecture. Il ne supprime aucune ligne.
--
-- La clé de `meta_campaign_config` passe de (user_id, campaign_name) à
-- (user_id, campaign_id) : une campagne renommée dans Meta garde sa ligne au
-- lieu d'en perdre la trace. Spec `.scratch/meta-ads/spec.md`, « L'identité
-- par ID », étape B ; ticket `.scratch/meta-ads/tickets/13`.
--
-- ────────────────────────────────────────────────────────────────────────────
-- QUAND LE JOUER — APRÈS LE MERGE ET UN PASSAGE DU WORKER
--
-- 1. Le code du ticket 13 est sur `main`. Avant l'étape B, il retombe sur
--    l'ancienne clé et écrit l'ID de chaque campagne que Meta déclare. Joué
--    AVANT ce code, ce fichier ferait échouer l'écriture des statuts du code
--    d'avant (il upsert sur le nom, sans ID).
-- 2. Un passage du worker a tourné pour CHAQUE compte Meta. Le report depuis
--    les insights, plus bas, ne suffit pas : mesuré le 2026-10-04, il n'atteint
--    que 16 lignes sur 197 pour un compte — les autres campagnes n'ont jamais
--    dépensé, elles n'ont aucune ligne d'insights.
--
-- ────────────────────────────────────────────────────────────────────────────
-- CE QU'IL REFUSE, ET C'EST VOULU
--
-- Il ne tourne pas tant qu'une ligne n'a pas d'ID, ou que deux lignes portent
-- le même ID : il lève, et la transaction entière est annulée — rien n'a
-- changé. Le message liste les campagnes en cause.
--
-- Le cas attendu : une campagne RENOMMÉE, ou supprimée, dans Meta. La ligne à
-- l'ancien nom n'est plus déclarée sous ce nom ; aucun passage ne lui donne
-- d'ID. On la rattache à la main (lui poser son `campaign_id`) ou on la
-- supprime à la main, plutôt que de deviner — choisir serait inventer.
--
-- Rejouable : si la clé est déjà (user_id, campaign_id), il ne fait rien.
-- ============================================================================

BEGIN;

-- Report de l'ID depuis les insights rejoués, SEULEMENT quand un nom désigne
-- une seule campagne. Deux campagnes homonymes restent à NULL : choisir serait
-- deviner. Ne touche que les lignes sans ID.
UPDATE public.meta_campaign_config c
SET    campaign_id = u.campaign_id
FROM  (SELECT user_id, campaign_name, min(campaign_id) AS campaign_id
       FROM   public.meta_ads_insights
       WHERE  campaign_id IS NOT NULL
       GROUP  BY user_id, campaign_name
       HAVING count(DISTINCT campaign_id) = 1) u
WHERE  c.user_id = u.user_id
  AND  c.campaign_name = u.campaign_name
  AND  c.campaign_id IS NULL;

DO $$
DECLARE
    cle       text;
    cle_def   text;
    manquent  int;
    doublons  int;
    exemples  text;
BEGIN
    -- Le nom de la contrainte se LIT : `meta_campaign_config_pkey` sur la base
    -- au 2026-10-04, mais une base installée autrement peut en porter un autre.
    SELECT conname, pg_get_constraintdef(oid) INTO cle, cle_def
    FROM   pg_constraint
    WHERE  conrelid = 'public.meta_campaign_config'::regclass AND contype = 'p';

    IF cle_def = 'PRIMARY KEY (user_id, campaign_id)' THEN
        RAISE NOTICE 'meta_campaign_config : la clé est déjà (user_id, campaign_id), rien à faire';
        RETURN;
    END IF;
    IF cle_def IS DISTINCT FROM 'PRIMARY KEY (user_id, campaign_name)' THEN
        RAISE EXCEPTION 'meta_campaign_config : clé primaire inattendue (%), rien n''a été changé', coalesce(cle_def, 'aucune');
    END IF;

    SELECT count(*),
           string_agg(left(user_id::text, 8) || ' « ' || campaign_name || ' »', ', '
                      ORDER BY user_id, campaign_name)
               FILTER (WHERE rang <= 10)
      INTO manquent, exemples
    FROM  (SELECT user_id, campaign_name,
                  row_number() OVER (ORDER BY user_id, campaign_name) AS rang
           FROM   public.meta_campaign_config
           WHERE  campaign_id IS NULL) x;
    IF manquent > 0 THEN
        RAISE EXCEPTION '% campagne(s) sans campaign_id, rien n''a été changé. Laisser passer le worker, puis rattacher ou supprimer à la main celles qui restent (renommées ou supprimées dans Meta). Les premières : %', manquent, exemples;
    END IF;

    SELECT count(*),
           string_agg(left(user_id::text, 8) || ' ' || campaign_id || ' (' || noms || ')', ', ')
      INTO doublons, exemples
    FROM  (SELECT user_id, campaign_id,
                  string_agg('« ' || campaign_name || ' »', ' / ' ORDER BY campaign_name) AS noms
           FROM   public.meta_campaign_config
           GROUP  BY user_id, campaign_id
           HAVING count(*) > 1) x;
    IF doublons > 0 THEN
        RAISE EXCEPTION '% campaign_id porté(s) par plusieurs lignes — une campagne renommée a gardé sa ligne à l''ancien nom. Rien n''a été changé ; garder une ligne par ID, à la main : %', doublons, exemples;
    END IF;

    EXECUTE format(
        'ALTER TABLE public.meta_campaign_config
             DROP CONSTRAINT %I,
             ALTER COLUMN campaign_id SET NOT NULL,
             ADD PRIMARY KEY (user_id, campaign_id)', cle);
END $$;

COMMIT;

-- ── CONTRÔLE ────────────────────────────────────────────────────────────────
-- Doit rendre UNE ligne : PRIMARY KEY (user_id, campaign_id), et 0 sans ID.
SELECT conname,
       pg_get_constraintdef(oid) AS cle,
       (SELECT count(*) FROM public.meta_campaign_config
        WHERE campaign_id IS NULL) AS sans_id
FROM   pg_constraint
WHERE  conrelid = 'public.meta_campaign_config'::regclass AND contype = 'p';
