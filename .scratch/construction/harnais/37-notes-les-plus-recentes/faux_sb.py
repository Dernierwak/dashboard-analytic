"""Un faux `supabase` qui n'exécute rien : il ENREGISTRE la requête.

Le défaut du ticket 37 n'est pas dans le résultat, il est dans la DEMANDE :
`.order("decided_at")` sans `desc=True`. Un faux client qui rendrait des lignes
déjà triées ne l'aurait jamais vu — c'est exactement l'erreur que le faux
lecteur du harnais 16 a commise pendant tout ce temps. Ici on regarde l'appel.
"""


class Requete:
    def __init__(self, journal, table):
        self._j = journal
        self._j["table"] = table
        self._j["order"] = []
        self._lignes = []

    def select(self, *a, **k): return self
    def eq(self, colonne, valeur):
        self._j.setdefault("eq", []).append((colonne, valeur))
        return self

    def order(self, colonne, **k):
        self._j["order"].append((colonne, k.get("desc", False)))
        return self

    def limit(self, n):
        self._j["limite"] = n
        return self

    def execute(self):
        return type("R", (), {"data": list(self._lignes)})()


class FauxSupabase:
    """`self.journal` garde la dernière requête construite, `self.lignes` ce
    que `execute()` rendra."""

    def __init__(self, lignes):
        self.journal = {}
        self.lignes = lignes

    def table(self, nom):
        r = Requete(self.journal, nom)
        r._lignes = self.lignes
        return r
