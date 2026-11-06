"""L'écriture du relevé du compte Instagram — `instagram_compte_jours` et
`instagram_compte_periodes` (section 23 de `000_run_me_all.sql`, ticket 05 de
`.scratch/instagram-construction/`).

Tant que la section 23 n'est pas jouée, les tables n'existent pas (PGRST205) :
la récolte le dit et continue, comme `insert_instagram_releves`, plutôt que de
perdre le passage pour un relevé.
"""
from __future__ import annotations


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


def ecrire_jour_du_compte(sb, ligne: dict) -> None:
    """Upsert sur `(user_id, jour)` : un second passage le même jour remplace
    les colonnes qu'il a lues et laisse les autres — `releve_compte` n'envoie
    pas une colonne dont l'appel a échoué."""
    _ecrire(sb, "instagram_compte_jours", ligne, on_conflict="user_id,jour")


def ecrire_periode_du_compte(sb, ligne: dict) -> None:
    """Ajout seul : une période déjà enregistrée garde sa première valeur
    (`ON CONFLICT DO NOTHING`), décision de construction du ticket 05."""
    _ecrire(sb, "instagram_compte_periodes", ligne,
            on_conflict="user_id,debut,fin", ignore_duplicates=True)
