"""Faux Supabase et faux transport HTTP pour les harnais de la récolte — aucun réseau.

FausseBase enregistre chaque écriture (`ecrits`) et rend, pour une lecture, les
lignes de `lignes[table]`. FausseSession route chaque appel HTTP vers une
fonction `route(methode, url, params, json) -> (statut, corps)`.
"""
import json
from urllib.parse import parse_qs, urlparse

from saas.collecte.socle import http


class _Rep:
    def __init__(self, statut, corps, entetes=None):
        self.status_code = statut
        self.content = corps if isinstance(corps, bytes) else json.dumps(corps).encode()
        self.headers = entetes or {}

    def json(self):
        return json.loads(self.content)


class FausseSession:
    def __init__(self, route):
        self.route, self.appels = route, []

    def request(self, methode, url, params=None, headers=None, json=None, data=None,
                timeout=None):
        assert timeout, f"appel sans timeout : {url}"
        p = dict(params or {})
        # un curseur `next` porte ses paramètres dans l'URL
        p.update({k: v[0] for k, v in parse_qs(urlparse(url).query).items()})
        self.appels.append((methode, urlparse(url).path, p))
        statut, corps = self.route(methode, urlparse(url).path, p, json)
        return _Rep(statut, corps)


def brancher_http(route) -> FausseSession:
    s = FausseSession(route)
    http._local.session = s
    http._dormir = lambda _s: None
    return s


class _Requete:
    def __init__(self, base, table):
        self.base, self.table, self.op, self.charge, self.filtres = base, table, "select", None, []

    def __getattr__(self, nom):          # eq, order, limit, range, is_, in_, not_, gte…
        def filtre(*a, **k):
            self.filtres.append((nom, a, k))
            return self
        return filtre

    @property
    def not_(self):
        return self

    def select(self, *a, **k):
        self.op = "select"
        return self

    def upsert(self, lignes, on_conflict=None):
        self.op, self.charge = "upsert", (lignes, on_conflict)
        return self

    def insert(self, lignes):
        self.op, self.charge = "insert", lignes
        return self

    def update(self, valeurs):
        self.op, self.charge = "update", valeurs
        return self

    def delete(self):
        self.op = "delete"
        return self

    def execute(self):
        class R:
            pass
        r = R()
        if self.op == "select":
            r.data = list(self.base.lignes.get(self.table, []))
            # `range(a, b)` : une seule page suffit aux harnais
            if any(f[0] == "range" and f[1][0] > 0 for f in self.filtres):
                r.data = []
        else:
            if self.base.lecture_seule:
                raise AssertionError(f"écriture interdite : {self.op} {self.table}")
            self.base.ecrits.append((self.op, self.table, self.charge, self.filtres))
            # Un `update` rend la ligne touchée : un refus RLS en rendrait zéro
            # (`CLAUDE.md` §8), et certaines écritures le vérifient.
            r.data = [{}] if self.op == "update" else []
        return r


class _Dossier:
    def __init__(self, base, bucket):
        self.base, self.bucket = base, bucket

    def list(self, *_a, **_k):
        return []

    def upload(self, path, file, file_options=None):
        if self.base.lecture_seule:
            raise AssertionError(f"téléversement interdit : {self.bucket}/{path}")
        self.base.ecrits.append(("upload", self.bucket, path, None))

    def get_public_url(self, chemin):
        return f"https://x.supabase.co/storage/v1/object/public/{self.bucket}/{chemin}"


class FausseBase:
    def __init__(self, lignes=None, lecture_seule=False):
        self.lignes, self.ecrits, self.lecture_seule = lignes or {}, [], lecture_seule

        class _Stockage:
            def from_(s, bucket):
                return _Dossier(self, bucket)
        self.storage = _Stockage()

    def table(self, nom):
        return _Requete(self, nom)

    def ecrit(self, op, table):
        return [e for e in self.ecrits if e[0] == op and e[1] == table]
