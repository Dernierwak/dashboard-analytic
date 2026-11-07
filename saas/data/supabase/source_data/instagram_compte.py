"""L'écriture du relevé du compte Instagram — `instagram_compte_jours` et
`instagram_compte_periodes` (section 23 de `000_run_me_all.sql`, ticket 05 de
`.scratch/instagram-construction/`).

Tant que la section 23 n'est pas jouée, les tables n'existent pas (PGRST205) :
la récolte le dit et continue, comme `insert_instagram_releves`, plutôt que de
perdre le passage pour un relevé.
"""
from __future__ import annotations

from datetime import date


def _table_absente(e: Exception) -> bool:
    msg = str(e).lower()
    return "pgrst205" in msg or "could not find the table" in msg


def _ecrire(sb, table: str, ligne: dict, **options) -> None:
    try:
        sb.table(table).upsert(ligne, **options).execute()
    except Exception as e:
        if not _table_absente(e):
            raise
        print(f"    compte Instagram : table {table} absente — lance "
              "saas/data/supabase/migrations/000_run_me_all.sql ; rien d'écrit ce passage.")


def ecrire_jours_du_compte(sb, lignes: list[dict]) -> None:
    """Upsert sur `(user_id, jour)` : un second passage remplace les colonnes
    qu'il a lues et laisse les autres — `releve_compte` n'envoie pas une
    colonne dont l'appel a échoué.

    UN LOT PAR JEU DE COLONNES : dans un même lot, PostgREST écrit NULL pour
    une clé absente d'une ligne mais présente dans une autre (même règle que
    `meta.insert_instagram_org`) — une panne de la portée sur un jour du
    premier passage effacerait sinon la portée d'un autre."""
    lots: dict[frozenset, list[dict]] = {}
    for ligne in lignes:
        lots.setdefault(frozenset(ligne), []).append(ligne)
    for lot in lots.values():
        _ecrire(sb, "instagram_compte_jours", lot, on_conflict="user_id,jour")


def a_des_jours_avant(sb, uid: str, jour: date) -> bool:
    """Le compte a-t-il une ligne `instagram_compte_jours` antérieure à `jour` ?

    C'est ce qui distingue un premier passage (ticket 06) : le passage léger
    écrit hier et avant-hier chaque jour, donc seule une ligne plus ancienne
    dit que la remontée a déjà eu lieu. Lève si la base ne répond pas —
    l'appelant décide (il ne lance pas 130 appels Meta à l'aveugle)."""
    return bool(sb.table("instagram_compte_jours").select("jour")
                .eq("user_id", uid).lt("jour", jour.isoformat()).limit(1)
                .execute().data)


def ecrire_periode_du_compte(sb, ligne: dict) -> None:
    """Ajout seul : une période déjà enregistrée garde sa première valeur
    (`ON CONFLICT DO NOTHING`), décision de construction du ticket 05."""
    _ecrire(sb, "instagram_compte_periodes", ligne,
            on_conflict="user_id,debut,fin", ignore_duplicates=True)
