-- ============================================================================
-- Les posts Instagram appartiennent à UN UTILISATEUR, pas au monde entier.
--
-- LE BUG
-- `instagram_organic_posts.post_id` était unique GLOBALEMENT, et la récolte
-- écrivait avec `on_conflict="post_id"`. Or deux comptes Pulse peuvent très
-- bien suivre la même page Instagram — c'est même le cas normal quand deux
-- personnes d'une même équipe s'inscrivent chacune de leur côté.
--
-- Conséquence : chaque récolte ne créait pas une ligne, elle VOLAIT celle de
-- l'autre. L'upsert écrasait le `user_id` de la ligne existante. Le dernier
-- qui récoltait dans la semaine repartait avec la totalité des posts, et
-- l'autre se retrouvait avec un dashboard Instagram quasi vide — sans la
-- moindre erreur nulle part, puisque du point de vue de la base tout s'était
-- bien passé.
--
-- Signature observée : deux comptes suivant la même page, 201 posts d'un côté,
-- 4 de l'autre, et AUCUN post_id en commun.
--
-- LA CORRECTION
-- L'unicité porte sur (user_id, post_id). Chaque compte a sa propre copie du
-- post, avec ses propres métriques et ses propres thèmes.
--
-- Idempotent : rejouable sans risque.
-- ============================================================================

-- 1. Retirer toute contrainte/index d'unicité portant sur post_id SEUL.
--    Le nom varie selon la façon dont la table a été créée, on le cherche.
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'instagram_organic_posts'
          AND c.contype IN ('u', 'p')
          AND (
            SELECT array_agg(a.attname ORDER BY a.attname)
            FROM unnest(c.conkey) k
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k
          ) = ARRAY['post_id']
    LOOP
        EXECUTE format('ALTER TABLE public.instagram_organic_posts DROP CONSTRAINT %I', r.conname);
        RAISE NOTICE 'contrainte % retirée', r.conname;
    END LOOP;

    -- Même chose pour un index unique posé hors contrainte.
    FOR r IN
        SELECT i.indexrelid::regclass::text AS idxname
        FROM pg_index i
        JOIN pg_class t ON t.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'instagram_organic_posts'
          AND i.indisunique
          AND NOT i.indisprimary
          AND (
            SELECT array_agg(a.attname ORDER BY a.attname)
            FROM unnest(i.indkey::int[]) k
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k
          ) = ARRAY['post_id']
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %s', r.idxname);
        RAISE NOTICE 'index % retiré', r.idxname;
    END LOOP;
END $$;

-- 2. La bonne unicité : un post par utilisateur.
--    (Si des doublons existent déjà, la création échouera — dédoublonner
--     d'abord avec la requête commentée plus bas.)
CREATE UNIQUE INDEX IF NOT EXISTS instagram_organic_posts_user_post_uq
    ON public.instagram_organic_posts (user_id, post_id);

-- Dédoublonnage préalable, à décommenter seulement si l'index refuse de se
-- créer (garde la ligne la plus récemment insérée pour chaque paire) :
--
-- DELETE FROM public.instagram_organic_posts a
-- USING public.instagram_organic_posts b
-- WHERE a.user_id = b.user_id
--   AND a.post_id = b.post_id
--   AND a.id < b.id;

-- 3. Index de lecture : toutes les requêtes de l'app filtrent par user_id
--    puis trient par date.
CREATE INDEX IF NOT EXISTS idx_instagram_posts_user_date
    ON public.instagram_organic_posts (user_id, date DESC);
