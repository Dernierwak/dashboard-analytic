"""Harnais du ticket 08 — l'écriture des posts (`source_data/meta.py`), sur un
faux client Supabase. La récolte elle-même parle à Meta et ne se teste pas
hors ligne ; ce qui se teste ici, c'est ce qu'on envoie à PostgREST.

    python3.12 .scratch/hebdo/harnais/08-les-posts/test_ecriture.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from commun.faux_lecteur import Constats  # noqa: E402
from saas.data.supabase.source_data import meta  # noqa: E402

REFUS = ("{'code': 'PGRST204', 'message': \"Could not find the 'permalink' column of "
         "'instagram_organic_posts' in the schema cache\"}")


class FauxSupabase:
    def __init__(self, migre: bool):
        self.migre, self.envois = migre, []

    def table(self, nom):
        return self

    def upsert(self, lot, on_conflict):
        self._lot = lot
        return self

    def execute(self):
        if not self.migre and any("permalink" in r for r in self._lot):
            raise Exception(REFUS)
        self.envois.append(self._lot)


POSTS = [{"post_id": 1, "user_id": "u", "permalink": "https://www.instagram.com/p/a/",
          "media_product_type": "REELS"},
         {"post_id": 2, "user_id": "u"}]

constat = Constats()

sb = FauxSupabase(migre=True)
meta.insert_instagram_org(sb, POSTS)
constat(all(len({frozenset(r) for r in lot}) == 1 for lot in sb.envois),
        "un lot par jeu de clés : un post sans permalink n'efface pas celui d'un autre")
constat(sum(len(l) for l in sb.envois) == 2, "les deux posts sont écrits")

sb = FauxSupabase(migre=False)
meta.insert_instagram_org(sb, POSTS)
constat(sum(len(l) for l in sb.envois) == 2
        and not any("permalink" in r for l in sb.envois for r in l),
        "migration pas passée : les posts s'écrivent sans les deux colonnes")

constat.conclure()
