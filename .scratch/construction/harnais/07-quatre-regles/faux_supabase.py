"""Un client PostgREST de laboratoire — assez pour prouver la pagination.

Il n'imite pas Supabase : il enregistre les filtres posés, applique `.range()`
sur les lignes qu'on lui a données, et rend `{data: [...]}`. C'est tout ce dont
`fetch_data.py` a besoin, et ça évite une base pour vérifier la seule chose qui
compte ici — qu'on ne s'arrête pas au plafond de 1 000 lignes.
"""


class _Reponse:
    def __init__(self, data):
        self.data = data


class _Requete:
    def __init__(self, lignes, journal, table):
        self._lignes = lignes
        self._filtres = {}
        self._limite = None
        self._plage = None
        self._journal = journal
        self._table = table

    def select(self, *a, **k):
        return self

    def order(self, *a, **k):
        return self

    def eq(self, colonne, valeur):
        self._filtres[colonne] = valeur
        return self

    def limit(self, n):
        self._limite = n
        return self

    def range(self, debut, fin):
        self._plage = (debut, fin)
        return self

    def execute(self):
        out = [l for l in self._lignes
               if all(str(l.get(c)) == str(v) for c, v in self._filtres.items())]
        self._journal.append({"table": self._table, "filtres": dict(self._filtres),
                              "plage": self._plage, "limite": self._limite})
        if self._plage:
            out = out[self._plage[0]:self._plage[1] + 1]
        if self._limite is not None:
            out = out[:self._limite]
        return _Reponse(out)


class FauxClient:
    def __init__(self, tables: dict):
        self.tables = tables
        self.journal: list = []

    def table(self, nom):
        if nom not in self.tables:
            raise RuntimeError(f'relation "public.{nom}" does not exist')
        return _Requete(self.tables[nom], self.journal, nom)
