"""Ticket 07 — la relecture sans plafond et le compte gratuit qui grandit.

Lancer depuis la racine du dépôt :

    python3.12 -I .scratch/instagram-construction/harnais/07-la-relecture-sans-plafond/test_relecture_sans_plafond.py

Coutures, sans réseau ni base :
  1. `sync.posts_a_relire` — la liste à relire d'un payant et d'un gratuit à des
     dates données (spec § La récolte — Ce qui s'ajoute, « La relecture » et
     « Le compte gratuit ») ;
  2. `sync._a_relire` — la lecture des posts en base passe les 1 000 lignes ;
  3. `instagram_reread.trimestriel_du` — « tous les 3 mois », sur une date lue ;
  4. `instagram_reread.relire_si_du` et `main` — la date du dernier passage
     complet est lue en base et réécrite après un passage réussi, jamais après
     une panne ;
  5. `scheduled_update` — le trimestriel tourne au cron, après le léger.
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

RACINE = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(RACINE))

from saas.data.fetch_data.shared.token_status import MORT, VALIDE, TokenStatus  # noqa: E402
from saas.data.fetch_data.sources.meta.instagram import sync  # noqa: E402
from saas.data.fetch_data.cockpit import instagram_reread, scheduled_update  # noqa: E402

ECHECS: list[str] = []


def verifier(nom, obtenu, attendu):
    if obtenu != attendu:
        ECHECS.append(nom)
        print(f"✗ {nom}\n    obtenu  : {obtenu!r}\n    attendu : {attendu!r}")
    else:
        print(f"✓ {nom}")


MAINTENANT = datetime(2026, 11, 10, 7, 0, tzinfo=timezone.utc)
STOCK = "https://x.supabase.co/storage/v1/object/public/post-images/u/{}.jpg"


def _inventaire(n: int, pas_heures: int = 12) -> list[dict]:
    """n posts, du plus récent (id « 1 », il y a 1 h) au plus ancien, un toutes
    les `pas_heures` heures. Rendu dans le désordre, comme rien ne garantit
    l'ordre de Meta."""
    medias = [{"id": str(i),
               "timestamp": (MAINTENANT - timedelta(hours=1 + (i - 1) * pas_heures))
               .strftime("%Y-%m-%dT%H:%M:%S+0000")}
              for i in range(1, n + 1)]
    return medias[::-2] + medias[-2::-2]


def _en_base(ids) -> dict[str, dict]:
    return {str(i): {"media_url": STOCK.format(i)} for i in ids}


# ── 1 · Le payant : plus de plafond 200, plus de reprise à 40 ──────────────
# 300 posts, un toutes les 12 h : le n-ième a 1 + 12(n−1) heures, donc moins
# de 30 jours (720 h) jusqu'au 60e (709 h) ; le 61e a 721 h.
inventaire = _inventaire(300)
# Les 200 plus récents en base (l'ancien plafond), dont le 150e avec une image
# restée sur le CDN (l'envoi au stockage avait échoué).
connus = _en_base(range(1, 201))
connus["150"]["media_url"] = "https://cdn.instagram.example/150.jpg"
liste = sync.posts_a_relire(inventaire, connus, MAINTENANT, is_paid=True)
verifier("Payant : les 60 posts en base de moins de 30 jours, tous (plus de reprise à 40)",
         [p for p in liste if int(p) <= 60], [str(i) for i in range(1, 61)])
# Ticket 08 : les absents de plus de 30 jours n'entrent plus que par le
# Rattrapage par blocs (`sync.rattrapage`), plus par le passage complet.
verifier("Payant : les absents au-delà du 200e (plus de 30 jours) sont laissés au Rattrapage",
         [p for p in liste if int(p) > 200], [])
verifier("Payant : un vieux post dont l'image n'a jamais atteint le stockage est repris",
         "150" in liste, True)
verifier("Payant : un vieux post en base, image en stockage, n'est pas relu au Jour de travail",
         [p for p in liste if 60 < int(p) <= 200], ["150"])
verifier("Payant : la liste suit l'inventaire, du plus récent au plus ancien",
         liste, sorted(liste, key=int))

# Arrivée d'un payant : rien en base, ses posts de moins de 30 jours ; le
# reste vient du Rattrapage par blocs (ticket 08).
verifier("Payant à l'arrivée : ses 60 posts de moins de 30 jours, le reste au Rattrapage",
         sync.posts_a_relire(inventaire, {}, MAINTENANT, is_paid=True),
         [str(i) for i in range(1, 61)])

# ── 2 · Le gratuit : 10 à l'arrivée, puis il grandit, sans Rattrapage ──────
verifier("Gratuit à l'arrivée : ses 10 plus récents",
         sync.posts_a_relire(inventaire, {}, MAINTENANT, is_paid=False),
         [str(i) for i in range(1, 11)])

# Trois mois plus tard : il avait ses 10 posts (ids 41 à 50) ; 40 posts ont été
# publiés depuis (ids 1 à 40, un toutes les 12 h → 20 jours).
connus = _en_base(range(41, 51))
liste = sync.posts_a_relire(inventaire, connus, MAINTENANT, is_paid=False)
verifier("Gratuit ensuite : tout post plus récent que sa base s'ajoute, au-delà du 10e",
         [p for p in liste if int(p) <= 40], [str(i) for i in range(1, 41)])
verifier("Gratuit : ses posts en base de moins de 30 jours sont relus comme le payant",
         [p for p in liste if 40 < int(p) <= 50], [str(i) for i in range(41, 51)])
verifier("Gratuit : pas de Rattrapage — rien de plus ancien que sa base",
         [p for p in liste if int(p) > 50], [])

# Un gratuit dont les posts en base ont tous plus de 30 jours, rien de neuf :
# rien à relire au Jour de travail (le trimestriel s'en charge).
vieux = _inventaire(80, pas_heures=24)
connus = _en_base(range(1, 11))
verifier("Gratuit sans post neuf, base de moins de 30 jours relue, rien d'autre",
         sync.posts_a_relire(vieux, connus, MAINTENANT, is_paid=False),
         [str(i) for i in range(1, 11)])
connus = _en_base(range(31, 41))
# Base 31 à 40 (721 h et plus) : les 30 plus récents s'ajoutent, la base n'est
# pas relue au Jour de travail, rien de plus ancien n'est pris.
verifier("Gratuit, base de plus de 30 jours : les neufs seulement",
         sync.posts_a_relire(vieux, connus, MAINTENANT, is_paid=False),
         [str(i) for i in range(1, 31)])

# Un post en base à la date illisible n'est relu ni par la fenêtre ni par un
# plancher (le plancher de 6 est parti avec le plafond).
illisible = [{"id": "1", "timestamp": "pas une date"},
             {"id": "2", "timestamp": "2020-01-01T00:00:00+0000"}]
verifier("Date illisible en base : pas relu au Jour de travail",
         sync.posts_a_relire(illisible, _en_base([1, 2]), MAINTENANT, is_paid=True), [])


# ── 3 · `_a_relire` : au-delà de 1 000 posts en base, rien n'est tronqué ───
class BaseDesPosts:
    """`profiles` et `instagram_organic_posts`, avec le plafond silencieux de
    PostgREST à 1 000 lignes (`CLAUDE.md` §8)."""

    def __init__(self, posts, is_paid):
        self.posts, self.is_paid = posts, is_paid
        self.ranges = []

    def table(self, nom):
        self._nom, self._debut, self._fin = nom, 0, None
        return self

    def select(self, *_):
        return self

    def eq(self, *_):
        return self

    def in_(self, *_):
        return self

    def order(self, *_ , **__):
        return self

    def range(self, debut, fin):
        self.ranges.append((debut, fin))
        self._debut, self._fin = debut, fin
        return self

    def execute(self):
        if self._nom == "profiles":
            self.data = [{"is_paid": self.is_paid}]
            return self
        fin = len(self.posts) if self._fin is None else self._fin + 1
        self.data = self.posts[self._debut:min(fin, self._debut + 1000)]
        return self


sync.insert_instagram_total_posts_id = lambda **_: None
gros = _inventaire(1500, pas_heures=24)
base = BaseDesPosts([{"post_id": i, "media_url": STOCK.format(i)} for i in range(1, 1501)],
                    is_paid=True)
liste, en_base = sync._a_relire(base, "u", gros, maintenant=MAINTENANT)
verifier("1 500 posts en base : les 1 500 sont lus (paginé), aucun repris comme neuf",
         (len(en_base), liste), (1500, [str(i) for i in range(1, 31)]))

# ── 4 · « Tous les 3 mois » ─────────────────────────────────────────────────
du = instagram_reread.trimestriel_du
verifier("Jamais passé (NULL en base) : dû", du(None, MAINTENANT), True)
verifier("Passé il y a 3 mois jour pour jour : dû",
         du("2026-08-10T07:12:00+00:00", MAINTENANT), True)
verifier("Passé il y a 3 mois moins un jour : pas dû",
         du("2026-08-11T06:00:00+00:00", MAINTENANT), False)
verifier("Compté en jours : le cron de 07:00 ne rate pas son jour parce qu'il "
         "démarre quelques minutes plus tôt que le passage d'il y a 3 mois",
         du("2026-08-10T07:59:00+00:00", MAINTENANT), True)
verifier("Fin de mois : 31 août + 3 mois = 30 novembre",
         (du("2026-08-31T07:00:00+00:00", datetime(2026, 11, 29, 7, tzinfo=timezone.utc)),
          du("2026-08-31T07:00:00+00:00", datetime(2026, 11, 30, 7, tzinfo=timezone.utc))),
         (False, True))


# ── 5 · Le trimestriel lit et écrit sa date en base ────────────────────────
class BaseDesConnexions:
    def __init__(self, connexions, colonne_absente=False, ecriture_refusee=False):
        self.connexions = connexions
        self.colonne_absente, self.ecriture_refusee = colonne_absente, ecriture_refusee
        self.ecrit: list[tuple[str, dict]] = []
        self.tables: list[str] = []

    def table(self, nom):
        self.tables.append(nom)
        self._nom, self._filtres, self._maj, self._cols = nom, {}, None, ""
        return self

    def select(self, cols="*"):
        self._cols = cols
        return self

    def update(self, champs):
        self._maj = champs
        return self

    def eq(self, colonne, valeur):
        self._filtres[colonne] = valeur
        return self

    def execute(self):
        if self._nom == "profiles":
            self.data = [{"id": c["user_id"]} for c in self.connexions]
            return self
        lignes = [c for c in self.connexions
                  if all(c.get(k) == v for k, v in self._filtres.items())]
        if self.colonne_absente and ("relecture_instagram_le" in self._cols
                                     or (self._maj and "relecture_instagram_le" in self._maj)):
            raise RuntimeError("{'code': '42703', 'message': 'column "
                               "connected_accounts.relecture_instagram_le does not exist'}")
        if self._maj is not None:
            if self.ecriture_refusee:
                self.data = []
                return self
            for c in lignes:
                self.ecrit.append((c["id"], dict(self._maj)))
                c.update(self._maj)
        self.data = [dict(c) for c in lignes]
        return self


RELUS: list[str] = []


def _relire(sb, uid, acces, maintenant=None):
    RELUS.append(acces.instagram)
    if acces.instagram == "panne":
        raise RuntimeError("https://graph.facebook.com/x?access_token=SECRET boum")
    return "insta relecture: ok"


instagram_reread.recolte_instagram.relire_tous = _relire
instagram_reread.marquer_a_reconnecter = lambda *a, **k: True
instagram_reread.passage.verifier_jetons = lambda lignes: {
    c["id"]: TokenStatus(MORT if c["meta_token"] == "mort" else VALIDE, "") for c in lignes}


def _connexion(cid, uid, ig, le, jeton="bon"):
    return {"id": cid, "user_id": uid, "provider": "meta", "meta_token": jeton,
            "instagram_business_id": ig, "relecture_instagram_le": le}


connexions = [
    _connexion("c1", "u-1", "ig-du", "2026-08-01T07:00:00+00:00"),
    _connexion("c2", "u-1", "ig-pas-du", "2026-10-01T07:00:00+00:00"),
    _connexion("c3", "u-1", "ig-jamais", None),
    _connexion("c4", "u-1", "panne", None),
    _connexion("c5", "u-1", "ig-mort", None, jeton="mort"),
]
sb = BaseDesConnexions(connexions)
journal = instagram_reread.relire_si_du(sb, "u-1", MAINTENANT)
verifier("Relit les connexions dont le dernier passage date de 3 mois ou jamais, au jeton valide",
         RELUS, ["ig-du", "ig-jamais", "panne"])
verifier("Écrit la date du passage sur la ligne relue, pas sur les autres ; rien après une panne",
         sb.ecrit, [("c1", {"relecture_instagram_le": MAINTENANT.isoformat()}),
                    ("c3", {"relecture_instagram_le": MAINTENANT.isoformat()})])
verifier("La panne se dit, sans le jeton",
         any("KO" in l for l in journal) and not any("SECRET" in l for l in journal), True)
RELUS.clear()
instagram_reread.relire_si_du(sb, "u-1", MAINTENANT + timedelta(days=1))
verifier("Le lendemain : seule la connexion en panne est reprise (sa date n'a pas bougé)",
         RELUS, ["panne"])

RELUS.clear()
sb = BaseDesConnexions([_connexion("c1", "u-1", "ig-du", None)], colonne_absente=True)
journal = instagram_reread.relire_si_du(sb, "u-1", MAINTENANT)
verifier("Colonne absente (section 23 pas jouée) : le cron ne devine pas, il ne relit pas "
         "et le dit", (RELUS, any("relecture_instagram_le" in l for l in journal)), ([], True))

RELUS.clear()
sb = BaseDesConnexions([_connexion("c1", "u-1", "ig-du", None)], ecriture_refusee=True)
journal = instagram_reread.relire_si_du(sb, "u-1", MAINTENANT)
verifier("Date non écrite (0 ligne touchée) : ça se dit (CLAUDE.md §8)",
         any("NON écrite" in l for l in journal), True)

# Le lancement à la main (drapeau `relecture_instagram`) est un passage complet :
# il relit tout, dû ou non, et pose la date.
RELUS.clear()
sb = BaseDesConnexions([_connexion("c2", "u-1", "ig-pas-du", "2026-10-01T07:00:00+00:00")])
instagram_reread.main(["--user", "u-1"], sb=sb)
verifier("À la main : relu même s'il n'est pas dû, et la date posée",
         (RELUS, [cid for cid, _ in sb.ecrit]), (["ig-pas-du"], ["c2"]))

# ── 6 · Le cron : le trimestriel après le léger, avant le complet ──────────
VU: list[tuple[str, str]] = []
scheduled_update.passage.leger = lambda sb, uid: VU.append(("leger", uid)) or []
scheduled_update.passage.passer = lambda sb, uid, depuis=None: VU.append(("complet", uid)) or []
scheduled_update.passage.republier = lambda sb, uid: VU.append(("rapport", uid)) or []
scheduled_update.passage.entete = lambda *a: None
scheduled_update.passage.avertir_secrets_google = lambda: None
scheduled_update.instagram_reread.relire_si_du = (
    lambda sb, uid, maintenant: VU.append(("trimestriel", uid)) or [])


class Profils:
    def table(self, _):
        return self

    def select(self, *_):
        return self

    def execute(self):
        self.data = [{"id": "lundi", "fetch_schedule": "Monday"},
                     {"id": "mardi", "fetch_schedule": "Tuesday"}]
        return self


scheduled_update.client_service = Profils
scheduled_update.ScheduledUpdate(aujourdhui=MAINTENANT).executer()   # un mardi
verifier("Le cron : léger puis trimestriel pour tous, complet pour le compte du jour",
         VU, [("leger", "lundi"), ("trimestriel", "lundi"),
              ("leger", "mardi"), ("trimestriel", "mardi"), ("complet", "mardi")])
VU.clear()
scheduled_update.ScheduledUpdate(seul="lundi", rapport_seulement=True,
                                 aujourdhui=MAINTENANT).executer()
verifier("Rapport seulement : pas de trimestriel", VU, [("rapport", "lundi")])

print()
if ECHECS:
    print(f"{len(ECHECS)} ÉCHEC(S)")
    sys.exit(1)
print("TOUT EST VERT")
