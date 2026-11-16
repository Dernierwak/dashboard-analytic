"""Harnais du ticket 05 (recolte) — l'échéance du jeton s'écrit à chaque passage.

Hors ligne : une fausse base note les écritures qu'on lui demande.
    python3.12 .scratch/recolte/harnais/05-l-echeance/test_recolte.py
(depuis la racine du dépôt).
"""
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
from saas.data.fetch_data.orchestration.account_sync import noter_echeances  # noqa: E402
from saas.data.fetch_data.shared.token_status import (  # noqa: E402
    INCONNU, MORT, VALIDE, TokenStatus)
from saas.data.supabase.source_data.account import noter_echeance  # noqa: E402

echecs: list[str] = []


def constat(nom: str, vrai: bool) -> None:
    print(("ok   " if vrai else "ÉCHEC ") + nom)
    if not vrai:
        echecs.append(nom)


class Erreur(Exception):
    def __init__(self, code):
        self.code = code


class Base:
    """Note chaque update ; `panne` lève à la place, `touche` = lignes rendues."""
    def __init__(self, panne=None, touche=1):
        self.ecrits, self.panne, self.touche = [], panne, touche

    def table(self, nom):
        self.nom = nom
        return self

    def update(self, champs):
        self.champs = champs
        return self

    def eq(self, colonne, valeur):
        setattr(self, "f_" + colonne, valeur)
        return self

    def execute(self):
        if self.panne:
            raise self.panne
        self.ecrits.append((self.nom, self.f_id, self.f_user_id, dict(self.champs)))
        return type("R", (), {"data": [{}] * self.touche})()


ECHEANCE = datetime(2026, 12, 1, 8, 0, tzinfo=timezone.utc)
META, GOOGLE = {"id": 1, "meta_token": "x"}, {"id": 2, "provider": "google"}

print("— l'écriture d'une ligne")
b = Base()
constat("une échéance s'écrit en ISO, sur la bonne ligne et le bon compte",
        noter_echeance(b, "u1", META, ECHEANCE) is True
        and b.ecrits == [("connected_accounts", 1, "u1", {"jeton_expire_le": ECHEANCE.isoformat()})])
b = Base()
noter_echeance(b, "u1", GOOGLE, None)
constat("une échéance non communiquée s'écrit NULL, pas une date supposée",
        b.ecrits[0][3] == {"jeton_expire_le": None})
constat("colonne absente (42703) → None, sans lever",
        noter_echeance(Base(panne=Erreur("42703")), "u1", META, ECHEANCE) is None)
constat("colonne absente du cache PostgREST (PGRST204) → None, sans lever",
        noter_echeance(Base(panne=Erreur("PGRST204")), "u1", META, ECHEANCE) is None)
constat("zéro ligne touchée → False", noter_echeance(Base(touche=0), "u1", META, ECHEANCE) is False)
try:
    noter_echeance(Base(panne=ConnectionError("réseau")), "u1", META, ECHEANCE)
    constat("une panne réseau n'est pas une colonne absente", False)
except ConnectionError:
    constat("une panne réseau n'est pas une colonne absente", True)

print("— le passage")
b = Base()
journal = noter_echeances(b, "u1", [META, GOOGLE, {"id": 3}, {"id": 4}], {
    1: TokenStatus(VALIDE, None, ECHEANCE), 2: TokenStatus(VALIDE),
    3: TokenStatus(MORT, "expiré", ECHEANCE), 4: TokenStatus(INCONNU, "réseau")})
constat("seuls les jetons VALIDES écrivent : mort et inconnu ne touchent à rien",
        [e[1] for e in b.ecrits] == [1, 2] and journal == [])
constat("section 27 pas jouée → rien au journal, la récolte continue",
        noter_echeances(Base(panne=Erreur("42703")), "u1", [META], {1: TokenStatus(VALIDE, None, ECHEANCE)}) == [])
j = noter_echeances(Base(panne=ConnectionError("https://x?access_token=SECRET")), "u1", [META],
                    {1: TokenStatus(VALIDE, None, ECHEANCE)})
constat("une écriture ratée se dit au journal, par son type, jamais par son texte",
        len(j) == 1 and "ConnectionError" in j[0] and "SECRET" not in j[0])
constat("zéro ligne touchée se dit au journal",
        len(noter_echeances(Base(touche=0), "u1", [META], {1: TokenStatus(VALIDE, None, ECHEANCE)})) == 1)

print()
print(f"{len(echecs)} échec(s)" if echecs else "tout passe")
sys.exit(1 if echecs else 0)
