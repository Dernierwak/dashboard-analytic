"""Le décor humain du ticket 23 : un compte d'entreprise, et trois personnes
qui n'ont pas les mêmes droits dessus.

PATRON est le propriétaire du compte — `suivi_actions.user_id` porte SON
identifiant, et rien d'autre : `app/actions.ts` écrit `{ id: compte.uid }`
quarante-trois fois. MOI et TOI sont deux membres invités « Peut agir »
(role = 'editor'), donc deux personnes que `peut_editer(user_id)` autorise
exactement pareil. C'est là que le ticket 23 se joue : la politique partagée
ne sait pas les distinguer, et rien n'empêche MOI de signer TOI.

OEIL regarde sans toucher ('viewer') : il sert de témoin, pour qu'un refus
d'insertion se distingue d'un refus de droit d'écriture tout court.
"""
PATRON = "11111111-1111-4111-8111-111111111111"
MOI    = "22222222-2222-4222-8222-222222222222"
TOI    = "33333333-3333-4333-8333-333333333333"
OEIL   = "44444444-4444-4444-8444-444444444444"


def pose(db, pg):
    db.psql(pg.STOP + f"""
    TRUNCATE public.suivi_actions;
    DELETE FROM public.dashboard_members;
    DELETE FROM public.profiles;
    DELETE FROM auth.users;

    INSERT INTO auth.users (id, email) VALUES
        ('{PATRON}', 'patron@exemple.fr'),
        ('{MOI}',    'moi@exemple.fr'),
        ('{TOI}',    'toi@exemple.fr'),
        ('{OEIL}',   'oeil@exemple.fr');

    INSERT INTO public.dashboard_members
        (owner_id, member_email, member_id, role, accepted_at) VALUES
        ('{PATRON}', 'moi@exemple.fr',  '{MOI}',  'editor', now()),
        ('{PATRON}', 'toi@exemple.fr',  '{TOI}',  'editor', now()),
        ('{PATRON}', 'oeil@exemple.fr', '{OEIL}', 'viewer', now());
    """)


def note(reco_key, auteur, compte=PATRON):
    """L'écriture d'une note TELLE QUE `poserNote` la compose
    (`saas/web/app/actions.ts`) : le compte regardé dans `user_id`, la personne
    dans `author_id`. `auteur=None` est le repli du même code — une note sans
    auteur est une note ancienne, pas une note cassée (ADR 0004)."""
    valeur = f"'{auteur}'" if auteur else "NULL"
    return (
        "INSERT INTO public.suivi_actions "
        "(user_id, reco_key, title, check_at, kind, author_id) VALUES "
        f"('{compte}', '{reco_key}', 'refait les visuels', current_date, 'note', {valeur});"
    )
