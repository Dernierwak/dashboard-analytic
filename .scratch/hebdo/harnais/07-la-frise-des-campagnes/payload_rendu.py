"""Un payload construit par `build_payload`, imprimé en JSON pour `rendu.js`.

Le compte du harnais : une campagne Meta vivante sans fin avec visuel, une
terminée, une `WITH_ISSUES`, une Google supprimée — le 29 octobre 2026.
"""
import contextlib
import io
import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
# Importer le harnais rejoue ses constats : leur sortie n'a rien à faire dans le JSON.
with contextlib.redirect_stdout(io.StringIO()):
    from test_payload import Compte, config, jours, meta  # noqa: E402
from saas.data.supabase.processed_data.weekly_report.builder import build_payload  # noqa: E402

lignes = [meta(d, "m_vit", "Automne vivante", "a1", 12.0) for d in jours(date(2026, 9, 1), date(2026, 10, 29))]
lignes += [meta(d, "m_fin", "Printemps", "a2", 8.0) for d in jours(date(2026, 3, 1), date(2026, 4, 30))]
lignes += [meta(d, "m_pb", "Signalée", "a3", 3.0) for d in jours(date(2026, 10, 23), date(2026, 10, 28))]
google = [{"date_start": d.isoformat(), "campaign_id": "g_rem", "campaign_name": "Google supprimée",
           "cost_micros": 4_000_000} for d in jours(date(2026, 5, 1), date(2026, 5, 20))]

class Branche(Compte):
    """Meta et Google branchés et récoltés sans trou (forme du ticket 04)."""

    def connexions_etat(self):
        return [{"source": s, "created_at": "2026-01-05T08:00:00+00:00", "a_reconnecter_depuis": None}
                for s in ("meta", "google")]

    def couverture(self):
        return [{"source": s, "flux": f, "sans_trou_depuis": "2026-01-01",
                 "sans_trou_jusqu_au": "2026-10-28"}
                for s in ("meta", "google") for f in ("insights", "journal")]


payload = build_payload(Branche(
    meta_rows=lignes, google_rows=google,
    config_meta=[config("m_vit", "Automne vivante", "ACTIVE", "2026-09-01"),
                 config("m_fin", "Printemps", "PAUSED", "2026-03-01", "2026-04-30"),
                 config("m_pb", "Signalée", "WITH_ISSUES", "2026-10-23")],
    config_google=[config("g_rem", "Google supprimée", "REMOVED", "2026-05-01")],
    creas=[{"ad_id": "a1", "image_url": "https://exemple.test/automne.jpg"}]))
json.dump(payload, sys.stdout, default=str)
