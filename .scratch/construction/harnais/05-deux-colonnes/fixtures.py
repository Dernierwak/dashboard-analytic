"""Le décor : deux personnes sur un compte, et une ligne écrite par chacune."""
COMPTE = "11111111-1111-4111-8111-111111111111"
MOI    = "22222222-2222-4222-8222-222222222222"
TOI    = "33333333-3333-4333-8333-333333333333"


def pose(db, pg):
    db.psql(pg.STOP + f"""
    TRUNCATE public.suivi_actions;
    DELETE FROM auth.users;
    INSERT INTO auth.users (id) VALUES ('{COMPTE}'), ('{MOI}'), ('{TOI}');

    -- Une ligne SANS auteur : c'est l'état de toutes les lignes déjà en base
    -- le jour où la migration passe. Aucun backfill ne la touchera.
    INSERT INTO public.suivi_actions (id, user_id, reco_key, title, check_at, kind)
    VALUES ('aaaaaaaa-0000-4000-8000-000000000001', '{COMPTE}', 'note:ancienne',
            'écrite avant la migration', current_date, 'note');

    -- Une note écrite APRÈS : elle porte son auteur.
    INSERT INTO public.suivi_actions (id, user_id, reco_key, title, check_at, kind, author_id)
    VALUES ('aaaaaaaa-0000-4000-8000-000000000002', '{COMPTE}', 'note:neuve',
            'refait les visuels', current_date, 'note', '{MOI}');
    """)
