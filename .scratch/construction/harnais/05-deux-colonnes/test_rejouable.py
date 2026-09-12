"""`000_run_me_all.sql` doit rester REJOUABLE SANS RISQUE — c'est sa raison
d'être (CLAUDE.md §2). Donc : la migration se joue deux fois de suite sans une
erreur, elle ne duplique rien, et elle ne touche AUCUNE ligne existante."""
import sys, pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import pg, t, fixtures as F

ANCIENNE = "aaaaaaaa-0000-4000-8000-000000000001"


def inventaire(db):
    return {
        "colonnes": pg.lit(db, "SELECT count(*)::text FROM information_schema.columns "
                               "WHERE table_schema = 'public' AND table_name = 'suivi_actions' "
                               "AND column_name IN ('author_id', 'campaign_channel', 'campaign_key');"),
        "check": pg.lit(db, "SELECT count(*)::text FROM pg_constraint "
                            "WHERE conname = 'suivi_actions_campaign_ck';"),
        "declencheur": pg.lit(db, "SELECT count(*)::text FROM pg_trigger "
                                  "WHERE tgname = 'trg_suivi_actions_auteur_fige';"),
        "index": pg.lit(db, "SELECT count(*)::text FROM pg_indexes WHERE tablename = 'suivi_actions' "
                            "AND indexname IN ('idx_suivi_actions_author', 'idx_suivi_actions_campagne');"),
    }


def main():
    db = pg.demarre()
    pg.remonte(db)
    F.pose(db, pg)

    avant = inventaire(db)
    t.egal("les trois colonnes sont là", avant["colonnes"], "3")
    t.egal("la contrainte de paire aussi", avant["check"], "1")
    t.egal("le déclencheur aussi", avant["declencheur"], "1")
    t.egal("les deux index aussi", avant["index"], "2")

    ligne = pg.lit(db, f"SELECT title || '|' || coalesce(author_id::text, 'NULL') || '|' || "
                       f"coalesce(campaign_key, 'NULL') || '|' || created_at::text "
                       f"FROM public.suivi_actions WHERE id = '{ANCIENNE}';")

    # Le deuxième passage, exactement comme David rejoue le fichier « à chaque
    # fois qu'on doute ».
    err = pg.refuse(db, pg.MIGRATION.read_text())
    t.ok("la migration se rejoue sans une erreur", err is None, f"refus : {err!r}")
    t.egal("...et n'a rien dupliqué", inventaire(db), avant)
    t.egal("...et n'a pas touché la ligne qui était là avant",
           pg.lit(db, f"SELECT title || '|' || coalesce(author_id::text, 'NULL') || '|' || "
                      f"coalesce(campaign_key, 'NULL') || '|' || created_at::text "
                      f"FROM public.suivi_actions WHERE id = '{ANCIENNE}';"), ligne)

    # Le contrôle de fin de `000_run_me_all.sql` interroge la fonction par sa
    # SIGNATURE. Une signature fausse afficherait « ✗ FONCTION ABSENTE » sur une
    # base où tout est en place — un contrôle qui ment coûte plus cher que pas de
    # contrôle du tout (c'est l'en-tête même du fichier unique).
    t.egal("le contrôle de fin de fichier retrouve la fonction du déclencheur",
           pg.lit(db, "SELECT CASE WHEN to_regprocedure('public.suivi_actions_auteur_fige()') "
                      "IS NOT NULL THEN 'trouvée' ELSE 'ABSENTE' END;"), "trouvée")

    # CLAUDE.md §7 : rien de destructeur sans le signaler. Ce fichier n'a rien à
    # signaler, et ce contrôle est là pour que ça reste vrai demain.
    #
    # On lit le VERBE de chaque instruction, pas le fichier au grep : « ON
    # DELETE SET NULL » et « BEFORE UPDATE OF author_id » contiennent les mots
    # DELETE et UPDATE sans rien détruire du tout. Un contrôle qui les compte
    # comme des destructions crie au loup, et on finit par ne plus l'écouter.
    corps = pg.MIGRATION.read_text()
    executable = "\n".join(l for l in corps.splitlines() if not l.lstrip().startswith("--"))
    verbes = [f.strip().split()[0].upper() for f in executable.split(";") if f.strip()]
    for interdit in ("DELETE", "TRUNCATE", "UPDATE"):
        t.ok(f"aucune instruction ne commence par « {interdit} »", interdit not in verbes,
             f"verbes trouvés : {verbes}")
    for interdit in ("DROP TABLE", "DROP COLUMN", "DROP CONSTRAINT"):
        t.ok(f"aucun « {interdit} »", interdit not in executable.upper())
    t.ok("les seuls DROP sont ceux de la rejouabilité (DROP TRIGGER IF EXISTS)",
         executable.upper().count("DROP ") == executable.upper().count("DROP TRIGGER IF EXISTS"))

    return t.bilan("Rejouable, et sans rien détruire")


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
