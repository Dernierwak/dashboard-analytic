"""La campagne désignée par une note ou une action : une PAIRE (régie, clé),
jamais l'une sans l'autre. Ce harnais vérifie que la base refuse les moitiés —
c'est la seule barrière, il n'y a aucune clé étrangère possible vers deux tables
de configuration différentes."""
import sys, pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import pg, t, fixtures as F

N = 0


def ecrit(db, channel, key):
    """Une ligne neuve à chaque appel — la clé d'unicité porte sur reco_key."""
    global N
    N += 1
    c = "NULL" if channel is None else f"'{channel}'"
    k = "NULL" if key is None else f"'{key}'"
    return pg.refuse(db, f"""
        INSERT INTO public.suivi_actions
            (user_id, reco_key, title, check_at, kind, campaign_channel, campaign_key)
        VALUES ('{F.COMPTE}', 'note:{N}', 'essai', current_date, 'note', {c}, {k});""")


def main():
    db = pg.demarre()
    pg.remonte(db)
    F.pose(db, pg)

    t.ok("une note sans campagne passe — c'est le cas courant", ecrit(db, None, None) is None)
    t.ok("une campagne Meta est désignée par son NOM", ecrit(db, "meta", "BW_Sommer_Traffic_2026") is None)
    t.ok("une campagne Google par son IDENTIFIANT", ecrit(db, "google", "22334455") is None)

    t.ok("une clé sans régie est refusée — on ne saurait pas dans quelle table "
         "la chercher, et deviner serait inventer", ecrit(db, None, "22334455") is not None)
    t.ok("une régie sans clé est refusée — elle ne désigne rien",
         ecrit(db, "meta", None) is not None)
    t.ok("une clé vide est refusée — une chaîne vide n'est pas une campagne",
         ecrit(db, "meta", "   ") is not None)
    t.ok("une régie inconnue est refusée — Pulse n'en récolte que deux",
         ecrit(db, "tiktok", "abc") is not None)

    t.egal("les lignes déjà en base n'ont désigné aucune campagne (migration additive)",
           pg.lit(db, "SELECT count(*)::text FROM public.suivi_actions "
                      "WHERE reco_key LIKE 'note:ancienne%' AND campaign_key IS NULL;"), "1")

    # La question que le carnet pose : « tout ce que j'ai fait pour CETTE
    # campagne ». Elle doit trouver un index, pas balayer la table. On vérifie
    # que l'index EXISTE et qu'il porte la bonne condition — pas la forme du
    # plan : sur neuf lignes PostgreSQL lit la table entière, et il a raison.
    t.ok("l'index partiel de la campagne existe",
         pg.lit(db, "SELECT count(*)::text FROM pg_indexes WHERE tablename = 'suivi_actions' "
                    "AND indexname = 'idx_suivi_actions_campagne';") == "1")
    t.ok("...et il ne porte QUE les lignes qui désignent une campagne",
         "campaign_key IS NOT NULL" in pg.lit(
             db, "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_suivi_actions_campagne';"))

    return t.bilan("La campagne, une paire ou rien")


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
