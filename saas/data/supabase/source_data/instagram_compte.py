"""L'écriture du relevé du compte Instagram — `instagram_compte_jours` et
`instagram_compte_periodes` (section 23 de `000_run_me_all.sql`, ticket 05 de
`.scratch/instagram-construction/`).

Tant que la section 23 n'est pas jouée, les tables n'existent pas (PGRST205) :
la récolte le dit et continue, comme `insert_instagram_releves`, plutôt que de
perdre le passage pour un relevé.
"""
from __future__ import annotations

from datetime import date, timedelta

# Meta documente jusqu'à 48 h de retard sur les chiffres du compte
# (`.scratch/instagram/issues/04`) : une période finissant hier ou avant-hier
# peut encore bouger, le passage suivant la corrige.
_JOURS_CORRIGEABLES = 2


def _table_absente(e: Exception) -> bool:
    msg = str(e).lower()
    return "pgrst205" in msg or "could not find the table" in msg


def _ecrire(sb, table: str, ligne, **options) -> bool:
    """Upsert → True si écrit, False si la table manque (le message le dit)."""
    try:
        sb.table(table).upsert(ligne, **options).execute()
    except Exception as e:
        if not _table_absente(e):
            raise
        print(f"    compte Instagram : table {table} absente — lance "
              "saas/data/supabase/migrations/000_run_me_all.sql ; rien d'écrit ce passage.")
        return False
    return True


def ecrire_jours_du_compte(sb, lignes: list[dict]) -> bool:
    """Upsert sur `(user_id, jour)` → True si tous les lots sont écrits.

    Un second passage remplace les colonnes qu'il a lues et laisse les autres
    — `releve_compte` n'envoie pas une colonne dont l'appel a échoué. Le
    booléen dit au premier passage s'il peut poser son marqueur (ticket 06).

    UN LOT PAR JEU DE COLONNES : dans un même lot, PostgREST écrit NULL pour
    une clé absente d'une ligne mais présente dans une autre (même règle que
    `meta.insert_instagram_org`) — une panne de la portée sur un jour du
    premier passage effacerait sinon la portée d'un autre."""
    lots: dict[frozenset, list[dict]] = {}
    for ligne in lignes:
        lots.setdefault(frozenset(ligne), []).append(ligne)
    ecrits = [_ecrire(sb, "instagram_compte_jours", lot, on_conflict="user_id,jour")
              for lot in lots.values()]
    return all(ecrits)


def ecrire_periode_du_compte(sb, ligne: dict, aujourdhui: date) -> bool:
    """Une période finissant hier ou avant-hier s'upserte : Meta peut encore
    corriger ses chiffres, et chaque passage relit ces deux périodes (revue de
    code de instagram-construction). Une plus ancienne reste en ajout seul
    (`ON CONFLICT DO NOTHING`, décision de construction du ticket 05) : plus
    rien ne la relit, elle garde sa valeur."""
    fin = date.fromisoformat(ligne["fin"])
    if fin >= aujourdhui - timedelta(days=_JOURS_CORRIGEABLES):
        return _ecrire(sb, "instagram_compte_periodes", ligne, on_conflict="user_id,debut,fin")
    return _ecrire(sb, "instagram_compte_periodes", ligne,
                   on_conflict="user_id,debut,fin", ignore_duplicates=True)
