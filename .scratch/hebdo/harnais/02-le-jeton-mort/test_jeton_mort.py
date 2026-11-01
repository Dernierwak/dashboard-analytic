"""Harnais du ticket 02 — ce que la récolte fait d'un jeton mort, valide ou inconnu.

Hors ligne : l'appel réseau (`verifier`) n'est pas testé ici ; on donne au plan
les états qu'il aurait rendus, et à l'écriture une fausse base qui note ce
qu'on lui demande.
    python3.12 .scratch/hebdo/harnais/02-le-jeton-mort/test_jeton_mort.py
(depuis la racine du worktree).
"""
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
from saas.data.fetch_data.orchestration.execution_plan import planifier  # noqa: E402
from saas.data.fetch_data.shared.token_status import (  # noqa: E402
    INCONNU, MORT, VALIDE, TokenStatus)
from saas.data.supabase.source_data.account import marquer_a_reconnecter  # noqa: E402

JETON_META = "EAAB-faux-jeton-meta"
JETON_GOOGLE = "1//faux-refresh-google"

META = {"id": "m1", "provider": "meta", "meta_token": JETON_META,
        "instagram_business_id": "ig1", "a_reconnecter_depuis": None}
GOOGLE = {"id": "g1", "provider": "google", "google_refresh_token": JETON_GOOGLE,
          "google_customer_id": "123", "ga4_property_id": "properties/9",
          "a_reconnecter_depuis": None}

echecs: list[str] = []


def constat(nom: str, vrai: bool) -> None:
    print(("ok   " if vrai else "ÉCHEC ") + nom)
    if not vrai:
        echecs.append(nom)


def canaux_planifies(plan) -> set[str]:
    return {t.canal for f in plan.fils for t in f}


def sautes(plan) -> dict[str, str]:
    return dict(plan.sautes)


# ── Le plan : mort → sauté et à marquer ; inconnu → récolté, rien à marquer ──

tous_valides = planifier([META, GOOGLE], {"m1": TokenStatus(VALIDE), "g1": TokenStatus(VALIDE)})
constat("jetons valides : les quatre canaux sont récoltés",
        canaux_planifies(tous_valides) == {"meta", "instagram", "google", "ga4"})
constat("jetons valides : rien à marquer", tous_valides.a_marquer == [])

sans_etat = planifier([META, GOOGLE])
constat("sans vérification (appel historique) : plan inchangé",
        canaux_planifies(sans_etat) == {"meta", "instagram", "google", "ga4"}
        and sans_etat.a_marquer == [])

meta_mort = planifier([META, GOOGLE], {"m1": TokenStatus(MORT, "Session has expired"),
                                       "g1": TokenStatus(VALIDE)})
constat("jeton Meta mort : Meta Ads ET Instagram sont sautés",
        canaux_planifies(meta_mort) == {"google", "ga4"}
        and {"meta", "instagram"} <= set(sautes(meta_mort)))
constat("jeton Meta mort : la raison de Meta est dans le saut",
        "Session has expired" in sautes(meta_mort)["meta"])
constat("jeton Meta mort : la ligne Meta (et elle seule) est à marquer",
        [(c["id"], r) for c, r in meta_mort.a_marquer] == [("m1", "Session has expired")])
constat("jeton Meta mort : le journal le dit pour meta",
        any(c == "meta" and "Session has expired" in m for c, m in meta_mort.journal))

google_mort = planifier([META, GOOGLE], {"m1": TokenStatus(VALIDE),
                                         "g1": TokenStatus(MORT, "Google refuse le jeton : invalid_grant")})
constat("jeton Google mort : Google Ads ET GA4 sont sautés",
        canaux_planifies(google_mort) == {"meta", "instagram"}
        and {"google", "ga4"} <= set(sautes(google_mort)))
constat("jeton Google mort : la ligne Google est à marquer",
        [c["id"] for c, _ in google_mort.a_marquer] == ["g1"])

inconnu = planifier([META, GOOGLE], {"m1": TokenStatus(INCONNU, "META_APP_ID ou META_APP_SECRET absent — jeton Meta non vérifié"),
                                     "g1": TokenStatus(INCONNU, "Google injoignable (Timeout)")})
constat("jeton inconnu : les quatre canaux sont récoltés comme aujourd'hui",
        canaux_planifies(inconnu) == {"meta", "instagram", "google", "ga4"})
constat("jeton inconnu : rien n'est marqué", inconnu.a_marquer == [])
constat("jeton inconnu : le journal nomme la variable absente",
        any(c == "meta" and "META_APP_ID" in m for c, m in inconnu.journal))

deux_meta = planifier([META, {**META, "id": "m2", "meta_token": "EAAB-autre"}],
                      {"m1": TokenStatus(MORT, "expiré"), "m2": TokenStatus(VALIDE)})
constat("deux comptes Meta, un mort : l'autre est récolté, seul le mort est marqué",
        "meta" in canaux_planifies(deux_meta)
        and [c["id"] for c, _ in deux_meta.a_marquer] == ["m1"])
constat("deux comptes Meta, un mort : meta n'est pas annoncé sauté (il tourne)",
        "meta" not in sautes(deux_meta))

tout_le_texte = repr(meta_mort.sautes + meta_mort.journal + google_mort.sautes
                     + google_mort.journal + inconnu.journal)
constat("aucun jeton dans les sauts ni le journal",
        JETON_META not in tout_le_texte and JETON_GOOGLE not in tout_le_texte)


# ── L'écriture : la date posée si absente, jamais écrasée ; la raison toujours ──

class FausseBase:
    """Note les updates ; rend `touchees` lignes (0 = un refus silencieux)."""

    def __init__(self, touchees: int = 1):
        self.touchees, self.updates, self.filtres = touchees, [], []

    def table(self, nom):
        self.nom = nom
        return self

    def update(self, champs):
        self.updates.append(champs)
        return self

    def eq(self, col, val):
        self.filtres.append((col, val))
        return self

    def execute(self):
        return type("R", (), {"data": [{}] * self.touchees})()


T = datetime(2026, 11, 2, 7, 0, tzinfo=timezone.utc)

sb = FausseBase()
ecrit = marquer_a_reconnecter(sb, "u1", META, "expiré", maintenant=T)
constat("premier marquage : la date et la raison sont posées",
        sb.updates == [{"a_reconnecter_depuis": T.isoformat(), "a_reconnecter_raison": "expiré"}])
constat("premier marquage : filtré par id ET user_id, sur connected_accounts",
        sb.nom == "connected_accounts" and set(sb.filtres) == {("id", "m1"), ("user_id", "u1")})
constat("premier marquage : l'écriture est confirmée", ecrit is True)

sb = FausseBase()
marquer_a_reconnecter(sb, "u1", {**META, "a_reconnecter_depuis": "2026-10-01T07:00:00+00:00"},
                      "expiré", maintenant=T)
constat("déjà marqué : la date n'est pas écrasée, la raison est réécrite",
        sb.updates == [{"a_reconnecter_raison": "expiré"}])

constat("aucune ligne touchée : l'écriture n'est pas confirmée",
        marquer_a_reconnecter(FausseBase(touchees=0), "u1", META, "expiré", maintenant=T) is False)


# ── La vérification : chaque jeton va à sa plateforme, une exception n'est pas un mort ──
# Les deux `verifier` sont remplacés : l'appel réseau, lui, ne se teste qu'en ligne.

from saas.data.fetch_data.orchestration import account_sync  # noqa: E402

vus = []
account_sync.jeton_meta.verifier = lambda j: vus.append(("meta", j)) or TokenStatus(VALIDE)
account_sync.jeton_google.verifier = lambda r: (vus.append(("google", r)) or TokenStatus(MORT, "invalid_grant"), None)
etats = account_sync.verifier_jetons([META, GOOGLE, {"id": "x", "provider": "meta"}])
constat("vérification : le jeton Meta à Meta, le refresh Google à Google, rien pour une ligne vide",
        vus == [("meta", JETON_META), ("google", JETON_GOOGLE)] and set(etats) == {"m1", "g1"})
constat("vérification : l'état Google est extrait du couple (état, jeton d'accès)",
        etats["g1"].etat == MORT)


def explose(_):
    raise RuntimeError(f"https://graph.facebook.com/debug_token?input_token={JETON_META}")


account_sync.jeton_meta.verifier = explose
etat = account_sync.verifier_jetons([META])["m1"]
constat("vérification qui lève : INCONNU, et le message ne porte pas le jeton",
        etat.etat == INCONNU and JETON_META not in (etat.raison or ""))

print()
if echecs:
    print(f"{len(echecs)} constat(s) en échec")
    sys.exit(1)
print("tous les constats tiennent")
