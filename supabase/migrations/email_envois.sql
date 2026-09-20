-- ============================================================================
-- email_envois — CE QU'EST DEVENU L'EMAIL HEBDO QU'ON A ENVOYÉ (ticket 50).
--
-- POURQUOI CETTE TABLE EXISTE.
-- Le ticket 47 a tranché qu'une panne qui dure alerte David plutôt que le
-- client, et tout cet arbitrage tient sur une phrase qu'on ne savait pas
-- vérifier : « le client a déjà été prévenu ». Il a été prévenu dans un
-- rapport et dans un email. Personne ne savait s'il les avait ouverts.
--
-- La différence commande la suite : un email OUVERT et ignoré désigne la
-- friction du parcours de reconnexion (ticket 49) ; un email qui n'arrive
-- même pas désigne l'adresse. Deux réponses opposées, même symptôme.
--
-- CE QU'ELLE NE PROMET PAS, ET C'EST L'ESSENTIEL.
-- Une ouverture est un pixel chargé. Un pixel bloqué, un volet de
-- prévisualisation, un client mail qui précharge : la mesure est fausse dans
-- les deux sens. **Une non-ouverture ne prouve donc RIEN**, et cette table ne
-- porte nulle part la valeur « pas ouvert » — elle porte `dernier_evenement`,
-- c'est-à-dire ce que le fournisseur a remonté, tel quel, et rien d'autre.
-- Ce que ça autorise à conclure est écrit dans `docs/mesures-impossibles.md`
-- AVANT d'être invoqué (CLAUDE.md §7).
--
-- POURQUOI UNE TABLE, ET PAS UNE COLONNE SUR `weekly_reports`.
-- ① Le fait s'écrit en DEUX temps, à une semaine d'écart : l'identifiant au
--    moment de l'envoi, l'événement au passage suivant du worker. Une colonne
--    sur le rapport mélangerait ce que le rapport DIT avec ce qu'on a appris
--    de son enveloppe.
-- ② `weekly_reports` est lisible par le client (policy `select_own`). Ceci
--    est une mesure d'EXPLOITATION, pas une information produit : un taux
--    d'ouverture ou un quelconque chiffre de « performance Pulse » dans le
--    rapport d'un client est exactement ce que le ticket 50 interdit.
--
-- D'où : RLS ACTIVÉE ET AUCUNE POLICY. Ce n'est pas un oubli, c'est la
-- décision. RLS active sans policy échoue fermé — aucune ligne visible à
-- personne. Seule la clé `service_role` du worker, qui passe au-dessus de la
-- RLS, lit et écrit ici. Cette table est donc VOLONTAIREMENT absente de la
-- section 15 (le partage d'équipe) du bundle : ni le propriétaire du compte,
-- ni un membre invité n'ont rien à y voir. Y ajouter une policy de lecture
-- serait revenir sur le ticket 50, pas corriger une omission.
--
-- UNE LIGNE PAR (utilisateur, semaine) : il part un email hebdo par rapport,
-- et republier la même semaine remplace la ligne — c'est le dernier envoi qui
-- compte, les précédents ne sont plus dans aucune boîte.
--
-- Rejouable sans risque : `CREATE TABLE IF NOT EXISTS`, aucun DELETE, aucun DROP.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_envois (
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start  date NOT NULL,

    -- Le fournisseur qui a (ou n'a pas) envoyé : 'resend', 'dry'… Sans clé
    -- configurée, `send_email` passe en dry-run : la ligne existe quand même,
    -- et elle dit que RIEN n'est parti. Un dry-run lu comme un envoi ferait
    -- conclure « jamais ouvert » sur un email qui n'a jamais quitté la machine.
    fournisseur text NOT NULL,

    -- L'identifiant rendu par le fournisseur, et le seul moyen de lui
    -- redemander plus tard ce que l'email est devenu. NULL en dry-run et sur
    -- un envoi en échec : il n'y a alors rien à relire.
    message_id  text,

    -- L'envoi lui-même a-t-il abouti ? C'est un fait plus fort qu'une
    -- ouverture, et il se perdait jusqu'ici dans une ligne de journal.
    envoi_ok    boolean NOT NULL,
    envoye_a    timestamptz NOT NULL DEFAULT now(),

    -- CE QUE LE FOURNISSEUR A REMONTÉ, TEL QUEL ('delivered', 'opened',
    -- 'bounced'…). Aucune contrainte CHECK, volontairement : le jour où Resend
    -- ajoute un événement, un CHECK ferait échouer l'écriture du worker sur un
    -- fait qu'on cherchait justement à apprendre. C'est le code qui traduit
    -- (`saas/emailing/evenements.py`), et il range tout ce qu'il ne connaît
    -- pas dans « inconnu », jamais dans « sans réponse ».
    dernier_evenement text,

    -- QUAND on a demandé. NULL = on n'a pas encore demandé, ce qui n'est pas
    -- la même chose que « on a demandé et rien n'est remonté ». Sans cette
    -- colonne, les deux se liraient pareil.
    releve_a    timestamptz,

    PRIMARY KEY (user_id, week_start)
);

-- La lecture est toujours « le dernier envoi de CET utilisateur » : la clé
-- primaire porte déjà `user_id` en tête, et un compte n'a qu'une ligne par
-- semaine. Aucun index de plus n'a de raison d'être.

ALTER TABLE public.email_envois ENABLE ROW LEVEL SECURITY;
-- Aucune policy — voir l'en-tête. RLS active + zéro policy = zéro ligne
-- visible, pour tout le monde sauf la clé service_role.

-- Table neuve : PostgREST peut répondre PGRST205 (« table introuvable ») tant
-- que son cache de schéma n'a pas été rechargé, y compris avec la clé
-- service_role — cette clé fait sauter la RLS, pas ce cache. Le worker
-- écrirait alors dans le vide. Voir la note détaillée en fin de
-- `fetch_progress.sql`.
NOTIFY pgrst, 'reload schema';
