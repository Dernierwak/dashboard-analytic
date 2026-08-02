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
-- Mesuré en production : les 200 posts que cible la récolte du compte A sont
-- détenus à 200/200 par le compte B, qui récolte plus tard dans la semaine.
--
-- LA CORRECTION
-- L'unicité porte sur (user_id, post_id). Chaque compte a sa propre copie du
-- post, avec ses propres métriques et ses propres thèmes.
--
-- Idempotent : rejouable sans risque.
-- ============================================================================

-- 1. Retirer toute contrainte d'unicité portant sur post_id SEUL.
--    Son nom dépend de la façon dont la table a été créée à l'époque, on le
--    cherche plutôt que de le deviner. La clé primaire (colonne `id`) n'est
--    pas concernée : on ne regarde que les contraintes de type « unique ».
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
          AND c.contype = 'u'
          AND array_length(c.conkey, 1) = 1
          AND (
            SELECT a.attname
            FROM pg_attribute a
            WHERE a.attrelid = t.oid AND a.attnum = c.conkey[1]
          ) = 'post_id'
    LOOP
        EXECUTE format('ALTER TABLE public.instagram_organic_posts DROP CONSTRAINT %I', r.conname);
        RAISE NOTICE 'contrainte % retirée', r.conname;
    END LOOP;
END $$;

-- 2. Même chose pour un index unique posé hors contrainte.
--    (Ceux qui servent une contrainte ont déjà disparu à l'étape 1 ; on les
--     exclut explicitement, un index de contrainte ne se supprime pas seul.)
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT i.indexrelid::regclass::text AS idxname
        FROM pg_index i
        JOIN pg_class t ON t.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'instagram_organic_posts'
          AND i.indisunique
          AND NOT i.indisprimary
          AND i.indnatts = 1
          AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = i.indexrelid)
          AND (
            SELECT a.attname
            FROM pg_attribute a
            WHERE a.attrelid = t.oid AND a.attnum = i.indkey[0]
          ) = 'post_id'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %s', r.idxname);
        RAISE NOTICE 'index % retiré', r.idxname;
    END LOOP;
END $$;

-- 3. Dédoublonner avant de poser la nouvelle unicité — sans quoi la création
--    de l'index échouerait sur des lignes en double héritées du passé.
--    On garde la plus récemment insérée de chaque paire.
DELETE FROM public.instagram_organic_posts a
USING public.instagram_organic_posts b
WHERE a.user_id = b.user_id
  AND a.post_id = b.post_id
  AND a.id < b.id;

-- 4. La bonne unicité : un post par utilisateur.
CREATE UNIQUE INDEX IF NOT EXISTS instagram_organic_posts_user_post_uq
    ON public.instagram_organic_posts (user_id, post_id);

-- 5. Index de lecture : toutes les requêtes de l'app filtrent par user_id
--    puis trient par date.
CREATE INDEX IF NOT EXISTS idx_instagram_posts_user_date
    ON public.instagram_organic_posts (user_id, date DESC);

-- ── Contrôle après exécution ────────────────────────────────────────────────
-- Doit lister instagram_organic_posts_user_post_uq (user_id, post_id) et plus
-- aucun index unique sur post_id seul :
--
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE tablename = 'instagram_organic_posts';
