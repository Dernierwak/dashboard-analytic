-- ============================================================================
-- SUIVI_ACTIONS — UNE NOTE NE SE SIGNE QUE DE SON PROPRE NOM
-- (copie autonome de la section 26 de 000_run_me_all.sql —
--  exécuter l'un OU l'autre, jamais les deux dans la même session)
--
-- Ticket : .scratch/construction/issues/23-auteur-forge-a-l-insertion.md
-- Harnais : .scratch/construction/harnais/23-auteur-sincere/
--
-- ────────────────────────────────────────────────────────────────────────────
-- CE QUI MANQUAIT, ET QUI A ÉTÉ REPRODUIT
--
-- La migration `suivi_actions_auteur_campagne.sql` (ticket 05) garantit
-- qu'`author_id` NE SE RÉÉCRIT JAMAIS. Elle ne garantissait rien sur sa valeur
-- À LA CRÉATION, et les trois pièces du puzzle regardaient ailleurs :
--   · `partage_insert` contrôle `peut_editer(user_id)` — LE COMPTE, jamais la
--     personne ;
--   · `suivi_actions_insert_own` contrôle `auth.uid() = user_id` — le compte
--     encore, par un autre chemin ;
--   · `trg_suivi_actions_auteur_fige` est un BEFORE UPDATE : il ne voit pas une
--     insertion.
--
-- Donc un membre « Peut agir » qui sortait de l'interface et écrivait
-- directement en PostgREST posait une note SIGNÉE DE QUELQU'UN D'AUTRE — et le
-- déclencheur de 05 la figeait ensuite dans cet état, y compris contre la
-- personne à qui elle était attribuée. Un fait déclaré attribué à qui ne l'a
-- pas déclaré, c'est un fait fabriqué (CLAUDE.md §7), pas une approximation.
--
-- Le harnais joue les deux scénarios sur un PostgreSQL réel et jetable, avec le
-- MÊME décor et à UN FICHIER PRÈS : `test_le_trou.py` remonte le schéma sans
-- celui-ci et voit passer la note forgée, `test_auteur_sincere.py` le remonte
-- avec et la voit refusée. C'est le contraste entre les deux qui prouve quelque
-- chose — pas le second tout seul, qui ne dirait pas si la règle sert.
--
-- ────────────────────────────────────────────────────────────────────────────
-- POURQUOI `AS RESTRICTIVE`, ET POURQUOI C'EST LE POINT ENTIER DU FICHIER
--
-- POSTGRESQL COMBINE LES POLITIQUES D'UNE MÊME COMMANDE EN **OU**. Le dépôt
-- l'écrit déjà noir sur blanc, deux fois, et s'en sert : « les anciennes
-- politiques "chacun ses lignes" restent en place […] donc elles n'enlèvent
-- aucun droit » (equipe_partage.sql, partage_tables_manquantes.sql).
--
-- Conséquence directe : UNE POLITIQUE PERMISSIVE DE PLUS N'INTERDIT RIEN. Posée
-- en permissive, la règle ci-dessous aurait été un troisième « oui » à côté de
-- `partage_insert` et de `suivi_actions_insert_own` — elle se serait lue comme
-- une protection, elle n'aurait rien protégé, et le harnais l'aurait montrée
-- inerte. Les politiques RESTRICTIVES, elles, se combinent en ET : c'est le
-- seul mécanisme de PostgreSQL qui RETRANCHE. Il en faut donc une ici.
--
-- AUCUN `TO` : la politique s'applique à tous les rôles. Une restrictive ne
-- peut que retrancher, donc la restreindre à `authenticated` n'aurait ajouté
-- aucun droit à personne — seulement un trou pour tout rôle oublié.
--
-- ────────────────────────────────────────────────────────────────────────────
-- POURQUOI UNE POLITIQUE SUFFIT ICI, ALORS QUE 05 A DÛ PRENDRE UN DÉCLENCHEUR
--
-- Une politique RLS ne voit que la ligne d'ARRIVÉE (CLAUDE.md §8) : c'est ce
-- qui l'empêchait, en 05, d'exprimer « cette colonne n'avait pas le droit de
-- bouger ». Ici la question ne porte sur aucun avant : à l'insertion il n'y a
-- pas de ligne d'avant, et la seule chose à regarder est justement la ligne
-- d'arrivée. Un `WITH CHECK` dit donc exactement ce qu'on veut dire — et rien
-- de plus, ce qui est la raison de ne PAS ajouter un second déclencheur.
--
-- ⚠ UNE POLITIQUE RLS N'EST PAS UNE CONTRAINTE CHECK DEVANT `NULL`. Un CHECK
-- LAISSE PASSER ce qui s'évalue à NULL — le piège que la contrainte de campagne
-- de 05 a payé, et que son commentaire raconte. Une politique fait l'inverse :
-- ce qui n'est pas VRAI est refusé, donc NULL refuse. Ça tombe bien, c'est ce
-- qu'on veut pour une session sans jeton (`auth.uid()` y rend NULL), mais la
-- règle ci-dessous ne s'appuie pas là-dessus pour être juste : elle est écrite
-- pour que personne n'ait à se rappeler laquelle des deux sémantiques
-- s'applique, et le harnais couvre le cas.
--
-- ────────────────────────────────────────────────────────────────────────────
-- LE `NULL` RESTE PERMIS, ET CE N'EST PAS UN OUBLI
--
-- Trois écritures légitimes n'ont pas d'auteur, et l'ADR 0004 tient à ce
-- qu'elles restent possibles :
--   · les lignes nées d'un conseil (`kind = 'action'`) — personne ne les a
--     « déclarées », l'app ne leur écrit jamais d'auteur ;
--   · le repli de `poserNote` (app/actions.ts), qui réécrit sans les colonnes
--     neuves tant que la migration de 05 n'est pas passée ;
--   · toutes les lignes d'avant 05 — aucun backfill, y inscrire le propriétaire
--     serait inventer un fait.
-- Oublier un auteur ne fabrique rien ; en inventer un, si.
--
-- ────────────────────────────────────────────────────────────────────────────
-- LE WORKER N'EST PAS CONCERNÉ — VÉRIFIÉ, PAS SUPPOSÉ
--
-- `build_report.py::_service_client` ouvre Supabase avec `SUPABASE_SERVICE_KEY`
-- (clé de service), et ce rôle porte BYPASSRLS : aucune politique ne le filtre,
-- celle-ci pas plus qu'une autre. Et il n'en aurait de toute façon pas besoin :
-- côté Python, `suivi_actions` n'est jamais l'objet d'un INSERT — la seule
-- écriture est `lecteur.py`, qui met à jour `verdict` (relevé sur tout `saas/`).
-- La règle ne porte que sur l'INSERT : même le jour où le worker écrirait par
-- une autre clé, un UPDATE de verdict ne la croiserait pas.
--
-- ────────────────────────────────────────────────────────────────────────────
-- CE QUE CE FICHIER NE FAIT PAS
-- La règle « une note ne s'efface que par son auteur ou par le Propriétaire »
-- est applicative : elle appartient aux tickets 12 et 19, pas au schéma.
--
-- Idempotent : rejouable sans risque. Aucun DROP TABLE, aucun DELETE, aucun
-- TRUNCATE, aucun UPDATE sur l'existant. Le `DROP POLICY IF EXISTS` ne sert
-- QU'À la rejouabilité — une politique ne se remplace pas en place.
-- ============================================================================

-- Sans `author_id`, la politique porterait sur une colonne absente et
-- PostgreSQL refuserait de la créer — avec un message qui ne dit pas quoi
-- faire. On le dit à la place (même patron que partage_tables_manquantes.sql).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                     AND table_name   = 'suivi_actions'
                     AND column_name  = 'author_id') THEN
        RAISE EXCEPTION
            'suivi_actions.author_id manque : joue suivi_actions_auteur_campagne.sql avant celui-ci.';
    END IF;
END $$;

DROP POLICY IF EXISTS "auteur_sincere" ON public.suivi_actions;

-- `(SELECT auth.uid())` plutôt que `auth.uid()` : entre parenthèses, PostgreSQL
-- l'évalue UNE FOIS pour l'instruction (InitPlan) au lieu d'une fois par ligne.
-- Sans effet sur une note à l'unité, mesurable sur un insert en lot.
CREATE POLICY "auteur_sincere" ON public.suivi_actions
    AS RESTRICTIVE
    FOR INSERT
    WITH CHECK (
        author_id IS NULL
        OR author_id = (SELECT auth.uid())
    );

COMMENT ON POLICY "auteur_sincere" ON public.suivi_actions IS
    'Une note se signe de son propre nom ou de personne. RESTRICTIVE : les '
    'politiques permissives d''une même commande se combinent en OU, donc une '
    'de plus n''aurait rien interdit. Voir le ticket 23 de la construction.';
