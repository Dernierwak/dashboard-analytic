"""`author_id` est posé à la création et jamais réécrit — et ce n'est PAS une
politique RLS qui peut le dire : une politique ne voit que la ligne d'arrivée
(CLAUDE.md §8). Ce harnais vérifie le déclencheur qui compare OLD et NEW, dans
les deux sens, et le cas qui casse un garde-fou trop zélé : la suppression d'un
membre, qui passe par ce même UPDATE."""
import sys, pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import pg, t, fixtures as F

ANCIENNE = "aaaaaaaa-0000-4000-8000-000000000001"
NEUVE = "aaaaaaaa-0000-4000-8000-000000000002"


def main():
    db = pg.demarre()
    pg.remonte(db)
    F.pose(db, pg)

    t.egal("une ligne écrite avant la migration n'a pas d'auteur — aucun backfill",
           pg.lit(db, f"SELECT coalesce(author_id::text, 'NULL') FROM public.suivi_actions WHERE id = '{ANCIENNE}';"),
           "NULL")
    t.egal("une note écrite après porte le sien",
           pg.lit(db, f"SELECT author_id FROM public.suivi_actions WHERE id = '{NEUVE}';"),
           F.MOI)

    # ── Ce que le déclencheur doit REFUSER ──────────────────────────────────
    err = pg.refuse(db, f"UPDATE public.suivi_actions SET author_id = '{F.TOI}' WHERE id = '{NEUVE}';")
    t.ok("on ne réattribue pas la note de quelqu'un d'autre", err is not None, "l'UPDATE est passé")
    t.ok("...et le refus nomme la règle, pas un code nu",
         err is not None and "ne se réécrit pas" in err, f"message : {err!r}")

    err = pg.refuse(db, f"UPDATE public.suivi_actions SET author_id = '{F.MOI}' WHERE id = '{ANCIENNE}';")
    t.ok("on ne comble pas après coup l'auteur d'une vieille ligne — ce serait le "
         "backfill que l'ADR 0004 refuse, fait à la main", err is not None, "l'UPDATE est passé")

    t.egal("après les deux refus, rien n'a bougé",
           pg.lit(db, f"SELECT coalesce(author_id::text, 'NULL') || ' ' || "
                      f"(SELECT coalesce(author_id::text, 'NULL') FROM public.suivi_actions WHERE id = '{ANCIENNE}') "
                      f"FROM public.suivi_actions WHERE id = '{NEUVE}';"),
           f"{F.MOI} NULL")

    # ── Ce qu'il doit LAISSER PASSER ────────────────────────────────────────
    t.ok("marquer une action faite ne réveille pas le déclencheur",
         pg.refuse(db, f"UPDATE public.suivi_actions SET status = 'done', done_at = current_date "
                       f"WHERE id = '{NEUVE}';") is None)
    t.ok("réécrire le texte d'une note non plus",
         pg.refuse(db, f"UPDATE public.suivi_actions SET title = 'corrigé' WHERE id = '{NEUVE}';") is None)
    t.egal("...et l'auteur est toujours là",
           pg.lit(db, f"SELECT author_id FROM public.suivi_actions WHERE id = '{NEUVE}';"), F.MOI)

    # LE CAS QUI CASSE UN GARDE-FOU TROP ZÉLÉ. `ON DELETE SET NULL` exécute un
    # UPDATE sur la ligne fille : un déclencheur qui refuserait TOUT changement
    # rendrait la suppression d'un membre impossible — donc la page /suppression
    # et toute demande RGPD.
    err = pg.refuse(db, f"DELETE FROM auth.users WHERE id = '{F.MOI}';")
    t.ok("supprimer le membre qui a écrit la note reste possible", err is None, f"refus : {err!r}")
    t.egal("...la note reste sur le compte, sans auteur",
           pg.lit(db, f"SELECT title || ' / ' || coalesce(author_id::text, 'NULL') "
                      f"FROM public.suivi_actions WHERE id = '{NEUVE}';"),
           "corrigé / NULL")

    err = pg.refuse(db, f"UPDATE public.suivi_actions SET author_id = '{F.TOI}' WHERE id = '{NEUVE}';")
    t.ok("un auteur oublié ne se réinvente pas non plus", err is not None, "l'UPDATE est passé")

    # Le compte, lui, emporte ses lignes : c'est `user_id ... ON DELETE CASCADE`,
    # posé bien avant cette migration — vérifié pour qu'on sache que la colonne
    # d'auteur ne l'a pas changé.
    pg.refuse(db, f"DELETE FROM auth.users WHERE id = '{F.COMPTE}';")
    t.egal("supprimer le COMPTE emporte bien ses lignes (inchangé)",
           pg.lit(db, "SELECT count(*)::text FROM public.suivi_actions;"), "0")

    return t.bilan("L'auteur, posé une fois et figé")


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
