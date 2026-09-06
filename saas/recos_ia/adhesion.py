"""Taux d'adhésion — indicateur INTERNE, jamais montré à un client.

Décision (wayfinder `.scratch/recos-generales/issues/04-seuil-adhesion.md`) :
- Agrégé sur TOUTE la base de comptes, jamais par compte individuel.
- Adhésion = réaction `done` ET vérifiée par un verdict `suivi_actions` réel
  (pas seulement le clic auto-déclaré) — le couple (user_id, reco_key) doit
  avoir au moins un verdict persisté, quel qu'il soit (better/worse/stable) :
  la présence d'un verdict prouve que le système a recoupé l'action avec les
  vraies données de plateforme, indépendamment du résultat.
- Volume minimum 200 réactions avant de publier un taux — en dessous, c'est
  du bruit statistique (CLAUDE.md §7 : aucun chiffre fabriqué).
- Fenêtre glissante de 8 semaines, pas cumulé depuis le début.

Usage :
  python saas/recos_ia/adhesion.py
"""

from __future__ import annotations

from datetime import date, timedelta

VOLUME_MINIMUM = 200
FENETRE_SEMAINES = 8


def compute_adhesion_rate(supabase, recent_weeks: int = FENETRE_SEMAINES) -> dict:
    """Calcule le taux d'adhésion agrégé sur `recent_weeks` semaines glissantes.

    Returns: {"volume": int, "seuil_atteint": bool, "taux": float | None,
    "dones_verifies": int}. `taux` vaut None tant que `volume < VOLUME_MINIMUM`
    — jamais un chiffre non mesuré présenté comme mesuré.
    """
    cutoff = (date.today() - timedelta(weeks=recent_weeks)).isoformat()
    try:
        feedback_rows = (
            supabase.table("reco_feedback")
            .select("user_id, reco_key, reaction, week_start")
            .gte("week_start", cutoff)
            .not_.is_("reaction", "null")
            .execute()
        ).data or []
    except Exception:
        return {"volume": 0, "seuil_atteint": False, "taux": None, "dones_verifies": 0}

    volume = len(feedback_rows)
    if volume < VOLUME_MINIMUM:
        return {"volume": volume, "seuil_atteint": False, "taux": None, "dones_verifies": 0}

    try:
        verdict_rows = (
            supabase.table("suivi_actions")
            .select("user_id, reco_key, verdict")
            .not_.is_("verdict", "null")
            .execute()
        ).data or []
    except Exception:
        verdict_rows = []
    verified_pairs = {(v["user_id"], v["reco_key"]) for v in verdict_rows}

    dones_verifies = sum(
        1 for r in feedback_rows
        if r.get("reaction") == "done" and (r["user_id"], r["reco_key"]) in verified_pairs
    )
    taux = round(100 * dones_verifies / volume, 1)
    return {"volume": volume, "seuil_atteint": True, "taux": taux, "dones_verifies": dones_verifies}


def _service_client():
    import os
    from supabase import create_client
    from saas.commun.app_secrets import secret
    url = os.getenv("SUPABASE_URL") or secret("supabase.url")
    key = os.getenv("SUPABASE_SERVICE_KEY") or secret("supabase.service_role")
    if not url or not key:
        raise SystemExit("SUPABASE_URL / SUPABASE_SERVICE_KEY manquants (env ou secrets.toml)")
    return create_client(url, key)


if __name__ == "__main__":
    result = compute_adhesion_rate(_service_client())
    if result["seuil_atteint"]:
        print(
            f"Taux d'adhésion (done vérifié / total réactions, {FENETRE_SEMAINES} sem.) : "
            f"{result['taux']}% ({result['dones_verifies']}/{result['volume']})"
        )
    else:
        print(
            f"Volume insuffisant : {result['volume']}/{VOLUME_MINIMUM} réactions sur "
            f"{FENETRE_SEMAINES} semaines — chiffre non publiable."
        )
