"""Les deux lectures que les règles payantes ont demandées.

Ce que ce fichier prouve : le détail par Annonce côté Google est PAGINÉ (sans
ça, PostgREST tronque à 1 000 lignes EN SILENCE — `CLAUDE.md` §8), et le budget
posé est relu PAR CANAL sur son propre dernier relevé.
"""
import pulse  # noqa: F401
from t import ok, egal, bilan
from faux_supabase import FauxClient

from saas.commun.fetch_data import (
    fetch_google_ads_ad_insights, fetch_platform_budgets,
)

UID = "u1"


def test_le_detail_par_annonce_est_pagine():
    """2 500 lignes : un seul `.execute()` en aurait rendu 1 000, et un compte à
    40 annonces aurait perdu tout ce qui précède ses 25 derniers jours."""
    lignes = [{"user_id": UID, "ad_id": str(i), "date_start": "2026-09-01"}
              for i in range(2500)]
    sb = FauxClient({"google_ads_ad_insights": lignes})
    out = fetch_google_ads_ad_insights(sb, UID)
    egal("toutes les lignes reviennent", len(out), 2500)
    ok("plus d'un aller-retour", len(sb.journal) >= 3, len(sb.journal))
    ok("chaque appel borne sa plage", all(a["plage"] for a in sb.journal))


def test_une_table_absente_ne_casse_rien():
    egal("pas de table, pas de lignes",
         fetch_google_ads_ad_insights(FauxClient({}), UID), [])
    egal("pas de table, pas de budget",
         fetch_platform_budgets(FauxClient({}), UID), [])


def test_le_budget_pose_est_relu_par_canal():
    """Le jour où le jeton Google expire, seul Meta est photographié. Un relevé
    commun ferait s'effondrer le budget posé, puis doubler la semaine suivante,
    sans que rien n'ait bougé chez le client (`saas/web/lib/budgets.ts`)."""
    lignes = [
        {"user_id": UID, "channel": "meta", "campaign_id": "m1",
         "captured_on": "2026-09-08", "daily_budget": 10},
        {"user_id": UID, "channel": "meta", "campaign_id": "m1",
         "captured_on": "2026-09-01", "daily_budget": 4},
        # Google n'a pas été photographié le 8 : son dernier relevé est le 1er.
        {"user_id": UID, "channel": "google", "campaign_id": "g1",
         "captured_on": "2026-09-01", "daily_budget": 7},
    ]
    out = fetch_platform_budgets(FauxClient({"platform_budgets": lignes}), UID)
    egal("une ligne par canal", len(out), 2)
    egal("Meta prend son relevé le plus récent",
         [l["daily_budget"] for l in out if l["channel"] == "meta"], [10])
    egal("Google garde le sien, plus ancien",
         [l["daily_budget"] for l in out if l["channel"] == "google"], [7])


def test_un_canal_jamais_photographie_ne_rend_rien():
    lignes = [{"user_id": UID, "channel": "meta", "campaign_id": "m1",
               "captured_on": "2026-09-08", "daily_budget": 10}]
    out = fetch_platform_budgets(FauxClient({"platform_budgets": lignes}), UID)
    egal("un seul canal connu", len(out), 1)
    egal("et c'est le bon", out[0]["channel"], "meta")


def test_le_budget_d_un_autre_compte_n_entre_jamais():
    lignes = [{"user_id": UID, "channel": "meta", "campaign_id": "m1",
               "captured_on": "2026-09-08", "daily_budget": 10},
              {"user_id": "autre", "channel": "meta", "campaign_id": "x1",
               "captured_on": "2026-09-09", "daily_budget": 999}]
    out = fetch_platform_budgets(FauxClient({"platform_budgets": lignes}), UID)
    egal("une seule ligne", len(out), 1)
    egal("celle du compte", out[0]["campaign_id"], "m1")


if __name__ == "__main__":
    for f in list(globals().values()):
        if callable(f) and getattr(f, "__name__", "").startswith("test_"):
            f()
    raise SystemExit(0 if bilan("Les lectures") else 1)
