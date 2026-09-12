-- ============================================================================
-- SUIVI_ACTIONS — L'AUTEUR D'UNE NOTE, ET LA CAMPAGNE QU'ELLE DÉSIGNE
-- (copie autonome de la section 25 de 000_run_me_all.sql —
--  exécuter l'un OU l'autre, jamais les deux dans la même session)
--
-- POURQUOI CES COLONNES, ET POURQUOI DANS LA MÊME MIGRATION
-- Trois tickets les réclament, et la carte de refonte a écrit qu'elles partent
-- ensemble : une seule migration, une seule fenêtre de déploiement.
--   · l'auteur   — .scratch/refonte/issues/16-compteur-partage.md
--   · la campagne — .scratch/refonte/issues/08-la-memoire-du-travail.md §5
--                   et .scratch/refonte/issues/04-ce-qui-doit-etre-valide-en-premier.md
-- Le ticket de construction est .scratch/construction/issues/05-migration-deux-colonnes.md.
--
-- ────────────────────────────────────────────────────────────────────────────
-- 1) L'AUTEUR — ce que la fiche ADR 0004 a tranché, et son prix
--
-- Un compte Pulse appartient à une ENTREPRISE : plusieurs paires d'yeux
-- travaillent dessus, et `user_id` porte le compte, jamais la personne
-- (`app/actions.ts` écrit `{ id: compte.uid }` 43 fois sans une exception).
-- Deux objets y coexistent, traités à l'inverse l'un de l'autre :
--   · une NOTE est le récit d'une personne — elle porte son auteur ;
--   · le STATUT d'une action suivie est un fait de l'entreprise — il n'en a
--     pas, et n'en aura pas. Le premier qui juge l'emporte, l'écran ne nomme
--     personne.
-- Voir docs/adr/0004-une-note-a-un-auteur-un-statut-non.md. Le prix est écrit
-- et accepté : ON NE SAURA JAMAIS QUI A JUGÉ QUOI. Ne pas « réparer » ça plus
-- tard en ajoutant une colonne d'auteur au verdict.
--
-- AUCUN BACKFILL, ET C'EST LA RAISON D'ÊTRE DU `NULL`. Les lignes déjà en base
-- n'ont pas d'auteur connu ; y inscrire le propriétaire du compte serait
-- inventer un fait (CLAUDE.md §7). Une note sans auteur est une note ancienne,
-- pas une note cassée. Migration additive pure : aucune ligne existante n'est
-- lue, modifiée ni effacée.
--
-- ON DELETE SET NULL, ET PAS AUTRE CHOSE. Si la personne qui a écrit une note
-- quitte Pulse, la note reste : elle appartient au compte, pas à elle. Le
-- défaut (NO ACTION) ferait ÉCHOUER la suppression du compte d'un membre —
-- c'est-à-dire la page /suppression, donc une demande RGPD. Un CASCADE, lui,
-- effacerait le travail de l'entreprise avec le départ d'un membre.
--
-- ────────────────────────────────────────────────────────────────────────────
-- 2) POURQUOI UN DÉCLENCHEUR ET PAS UNE POLITIQUE RLS
--
-- `author_id` est posé à la création et JAMAIS réécrit. Une politique RLS ne
-- peut pas porter cette règle : elle ne voit que la ligne d'ARRIVÉE, donc elle
-- ne sait pas ce que la colonne valait avant (CLAUDE.md §8). Un CHECK non plus,
-- pour la même raison. Seul un déclencheur compare `OLD` et `NEW`.
--
-- CE QUE LE DÉCLENCHEUR REFUSE, ET CE QU'IL LAISSE PASSER. Il refuse toute
-- écriture qui DONNE un auteur à une ligne qui en avait un autre, ou qui en
-- avait aucun : personne ne peut s'attribuer une note, ni attribuer la sienne à
-- quelqu'un d'autre, ni combler après coup l'auteur manquant d'une vieille
-- ligne (ce serait le backfill que la fiche refuse, fait à la main).
-- Il laisse passer le retour à NULL — parce que c'est exactement ce que fait le
-- `ON DELETE SET NULL` ci-dessus, qui exécute un UPDATE sur la ligne fille :
-- un déclencheur qui refuserait TOUT changement rendrait la suppression d'un
-- membre impossible. Oublier un auteur ne fabrique aucun fait ; en inventer un
-- si.
--
-- ────────────────────────────────────────────────────────────────────────────
-- 3) LA CAMPAGNE — POURQUOI ELLE PREND DEUX COLONNES ET NON UNE
--
-- `suivi_actions` ne porte aujourd'hui que `theme`. Sans colonne de campagne,
-- le carnet ne peut pas répondre à « montre-moi tout ce que j'ai fait pour
-- cette campagne », qui est la demande écrite en 08 §5.
--
-- Le ticket annonce « deux colonnes » en comptant l'auteur et la campagne comme
-- un objet chacun. La campagne en demande deux à elle seule, et ce n'est pas un
-- élargissement de périmètre : DANS CE CODE, L'IDENTITÉ D'UNE CAMPAGNE EST UNE
-- PAIRE. `ThemeCampaign` (saas/web/lib/report.ts l. 292) porte `channel` ET
-- `key`, parce que Meta identifie une campagne par son NOM
-- (`meta_campaign_config`, clé primaire `(user_id, campaign_name)`) et Google
-- par son IDENTIFIANT (`google_campaign_config`, `(user_id, campaign_id)`).
-- `platform_changes` (§14) stocke déjà la même paire, pour la même raison.
--
-- Garder une seule colonne obligerait à deviner de quelle régie vient la clé —
-- or rien n'interdit d'appeler une campagne Meta « 22334455 », et la note
-- basculerait alors sur une campagne Google homonyme. C'est très exactement le
-- bug que le ticket 03 vient de payer côté Meta : identifier par un nom
-- réutilisable. Si tu préfères la lettre du ticket à ce raisonnement, la
-- colonne `campaign_channel` se retire seule — mais alors le carnet devra
-- chercher la clé dans les deux tables de configuration et trancher au hasard
-- quand les deux répondent.
--
-- AUCUNE CLÉ ÉTRANGÈRE, VOLONTAIREMENT. Deux tables de configuration
-- différentes ne peuvent pas être référencées par une seule colonne ; et même
-- si elles le pouvaient, une note est un RÉCIT : elle doit survivre à la
-- campagne qu'elle raconte, y compris quand celle-ci disparaît de la récolte.
-- Conséquence connue, à ne pas découvrir plus tard : côté Meta, RENOMMER une
-- campagne change sa clé, donc les notes écrites avant le renommage ne la
-- suivent pas. C'est la limite de l'identification par le nom, déjà relevée au
-- ticket 18 de la construction — on ne la corrige pas ici en silence.
--
-- ────────────────────────────────────────────────────────────────────────────
-- CE QUE CE FICHIER NE FAIT PAS
-- Il n'ajoute ni ne modifie AUCUNE politique RLS : `suivi_actions` est déjà
-- partagée par la section 15 (`partage_select` / `partage_insert` …), et la
-- règle « une note ne s'efface que par son auteur ou par le propriétaire »
-- appartient à `deleteNote` (app/actions.ts) — c'est du code applicatif, pas du
-- schéma, et ça change ce qu'un membre a le droit de faire : ça se propose.
--
-- Idempotent : rejouable sans risque. Aucun DROP TABLE, aucun DELETE, aucun
-- TRUNCATE, aucun UPDATE sur l'existant. Les `DROP TRIGGER IF EXISTS` et
-- `CREATE OR REPLACE FUNCTION` ne servent QU'À la rejouabilité.
-- ============================================================================

-- ── 1 · L'auteur ────────────────────────────────────────────────────────────
ALTER TABLE public.suivi_actions
    ADD COLUMN IF NOT EXISTS author_id uuid
        REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.suivi_actions.author_id IS
    'Qui a ÉCRIT la ligne. Posé à la création, jamais réécrit (déclencheur '
    'trg_suivi_actions_auteur_fige). NULL = ligne antérieure à cette migration, '
    'ou auteur parti : aucun backfill, voir ADR 0004.';

CREATE OR REPLACE FUNCTION public.suivi_actions_auteur_fige()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    -- `IS DISTINCT FROM` et non `<>` : le cas qui compte ici est justement
    -- OLD NULL (une ligne d'avant la migration) et NEW non nul — le backfill à
    -- la main que l'ADR 0004 refuse. `NEW <> OLD` y rendrait NULL, donc la
    -- condition serait fausse et le garde-fou muet pile là où il sert.
    IF NEW.author_id IS NOT NULL AND NEW.author_id IS DISTINCT FROM OLD.author_id THEN
        RAISE EXCEPTION
            'suivi_actions.author_id est posé à la création et ne se réécrit pas (id = %)',
            OLD.id
            USING ERRCODE = '23514';   -- check_violation : c'est bien une contrainte
                                       -- que la table ne peut pas porter elle-même.
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_suivi_actions_auteur_fige ON public.suivi_actions;
-- `UPDATE OF author_id` : le déclencheur ne se réveille que si la colonne
-- figure dans le SET. Marquer une action « faite » ne le paie donc jamais.
CREATE TRIGGER trg_suivi_actions_auteur_fige
    BEFORE UPDATE OF author_id ON public.suivi_actions
    FOR EACH ROW EXECUTE FUNCTION public.suivi_actions_auteur_fige();

-- Le `ON DELETE SET NULL` doit RETROUVER les lignes d'un membre supprimé :
-- sans index, chaque suppression de compte balaie toute la table. Partiel,
-- parce que la grande majorité des lignes n'a pas d'auteur (aucun backfill).
CREATE INDEX IF NOT EXISTS idx_suivi_actions_author
    ON public.suivi_actions (author_id)
    WHERE author_id IS NOT NULL;

-- ── 2 · La campagne ─────────────────────────────────────────────────────────
ALTER TABLE public.suivi_actions
    ADD COLUMN IF NOT EXISTS campaign_channel text,
    ADD COLUMN IF NOT EXISTS campaign_key     text;

COMMENT ON COLUMN public.suivi_actions.campaign_channel IS
    'La régie de la campagne désignée : ''meta'' ou ''google''. NULL avec '
    'campaign_key NULL = la ligne ne désigne aucune campagne.';
COMMENT ON COLUMN public.suivi_actions.campaign_key IS
    'La clé de la campagne dans sa régie : campaign_name (Meta) | campaign_id '
    '(Google) — la même paire que ThemeCampaign côté web. Aucune clé étrangère : '
    'une note survit à la campagne qu''elle raconte.';

-- Les deux colonnes vont ensemble ou pas du tout : une clé sans régie ne
-- désigne rien de lisible, et une régie sans clé ne désigne rien tout court.
--
-- ⚠ LES `IS NOT NULL` NE SONT PAS REDONDANTS, et le harnais l'a prouvé : UN
-- CHECK LAISSE PASSER CE QUI S'ÉVALUE À NULL, pas seulement ce qui est vrai.
-- Écrit sans eux, `campaign_channel IN ('meta','google')` rendait NULL sur une
-- régie absente, donc `FAUX OR NULL` = NULL, donc la ligne PASSAIT : une clé
-- orpheline entrait en base, et le carnet aurait dû deviner sa régie.
--
-- `ADD CONSTRAINT IF NOT EXISTS` n'existe pas pour un CHECK — on rattrape le
-- doublon plutôt que de le deviner (même patron que campagne_landing.sql).
DO $$
BEGIN
    ALTER TABLE public.suivi_actions
        ADD CONSTRAINT suivi_actions_campaign_ck
        CHECK (
            (campaign_channel IS NULL AND campaign_key IS NULL)
            OR (campaign_channel IS NOT NULL
                AND campaign_channel IN ('meta', 'google')
                AND campaign_key IS NOT NULL
                AND btrim(campaign_key) <> '')
        );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- La question que le carnet pose : « tout ce que j'ai fait pour CETTE
-- campagne », du plus récent au plus ancien. Partiel : une ligne sans campagne
-- n'a rien à faire dans cet index — la plupart des notes n'en désignent pas.
CREATE INDEX IF NOT EXISTS idx_suivi_actions_campagne
    ON public.suivi_actions (user_id, campaign_channel, campaign_key, decided_at DESC)
    WHERE campaign_key IS NOT NULL;
