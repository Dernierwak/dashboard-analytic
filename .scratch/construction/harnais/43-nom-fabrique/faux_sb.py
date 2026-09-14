"""Un faux client Supabase, juste assez pour `_collect_candidates` et la boucle
d'écriture de `labeling.py`.

POURQUOI UN FAUX CLIENT ET PAS UN FAUX LECTEUR. Les harnais 16/17 passent par
`Lecteur`, le seam du payload. `labeling.py` n'en a pas : il parle à Supabase
directement, et le défaut du ticket 43 est justement une ÉCRITURE. Ce qu'on
doit pouvoir observer, c'est le `payload` de l'upsert — pas un chiffre lu.

Ce faux client n'imite que ce que `labeling.py` appelle réellement :
`.table().select().eq().order().range().execute()` pour lire, `.upsert()` et
`.update()` pour écrire. Toute autre méthode lèverait — et c'est voulu : un
appel non prévu doit casser le harnais, pas passer inaperçu.
"""


class _Resultat:
    def __init__(self, data):
        self.data = data


class _Requete:
    def __init__(self, base, table):
        self._base = base
        self._table = table
        self._colonnes = "*"

    def select(self, colonnes="*"):
        self._colonnes = colonnes
        return self

    def eq(self, *_a, **_k):
        return self

    def neq(self, *_a, **_k):
        return self

    def is_(self, *_a, **_k):
        return self

    def or_(self, *_a, **_k):
        return self

    def order(self, *_a, **_k):
        return self

    def range(self, debut, fin):
        self._tranche = (debut, fin)
        return self

    def execute(self):
        lignes = self._base.tables.get(self._table, [])
        debut, fin = getattr(self, "_tranche", (0, None))
        lignes = lignes[debut:] if fin is None else lignes[debut:fin + 1]
        if self._colonnes == "*":
            return _Resultat([dict(l) for l in lignes])
        voulues = [c.strip() for c in self._colonnes.split(",")]
        manquantes = {c for l in lignes for c in voulues if c not in l}
        if manquantes:
            # Supabase lève sur une colonne inconnue ; le repli du code en dépend.
            raise RuntimeError(f"colonnes absentes de {self._table} : {sorted(manquantes)}")
        return _Resultat([{c: l.get(c) for c in voulues} for l in lignes])

    def upsert(self, payload, **kwargs):
        self._base.ecritures.append((self._table, "upsert", payload, kwargs))
        return self

    def update(self, payload, **kwargs):
        self._base.ecritures.append((self._table, "update", payload, kwargs))
        return self


class FauxSupabase:
    """`tables` : {nom: [lignes]}. `ecritures` : tout ce que le code a voulu écrire."""

    def __init__(self, **tables):
        self.tables = {k: list(v) for k, v in tables.items()}
        self.ecritures = []

    def table(self, nom):
        return _Requete(self, nom)

    def upserts(self, table):
        return [p for t, op, p, _ in self.ecritures if t == table and op == "upsert"]
