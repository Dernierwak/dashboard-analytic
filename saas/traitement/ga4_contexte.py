"""Le contexte GA4 que le rapport lit — construit depuis les données GA4 STOCKÉES.

Il vivait dans la récolte (`saas/collecte/ga4/ga4.py`) alors qu'il ne récolte
rien : il lit la base et met en forme pour le rapport. C'est du traitement.
"""
from datetime import date

from saas.commun.fetch_data import (
    fetch_ga4_events as db_fetch_ga4_events,
    fetch_ga4_insights as db_fetch_ga4,
)


def build_ga4_context(
    supabase,
    user_id: str,
    since: "date",
    until: "date",
) -> dict | None:
    """Construit le dict ga4 pour build_recos() depuis les données stockées.

    Retourne None si GA4 n'est pas connecté (aucune donnée) → le moteur garde
    ses recos pub prudentes + affiche le nudge "Connecte Google Analytics".

    Sinon : {connected, paid_conversions, paid_revenue, paid_sessions,
             total_conversions, total_revenue,
             funnel: {view_item, add_to_cart, begin_checkout, purchase, ...},
             by_campaign: {campagne: {conversions, revenue, sessions}} (payant),
             events_by_campaign: {campagne: {event_name: {count, value}}},
             events_sans_campagne: {event_name: {count, value}}}
    sur la fenêtre [since, until]. 'paid_*' = medium contenant cpc/ppc/paid.
    """
    rows = db_fetch_ga4(supabase, user_id)
    if not rows:
        return None

    since_s, until_s = since.isoformat(), until.isoformat()
    ctx = {
        "connected": True,
        "paid_conversions": 0.0, "paid_revenue": 0.0, "paid_sessions": 0,
        "total_conversions": 0.0, "total_revenue": 0.0, "total_sessions": 0,
        "funnel": {}, "by_campaign": {},
        "events_by_campaign": {}, "events_sans_campagne": {},
    }
    in_window = False
    for r in rows:
        d = str(r.get("date", ""))
        if not (since_s <= d <= until_s):
            continue
        in_window = True
        conv = float(r.get("conversions") or 0)
        rev = float(r.get("revenue") or 0)
        ctx["total_conversions"] += conv
        ctx["total_revenue"] += rev
        # Sessions tous canaux — c'est le « trafic » lu dans le rapport hebdo.
        ctx["total_sessions"] += int(r.get("sessions") or 0)
        if any(k in str(r.get("medium", "")).lower() for k in ("cpc", "ppc", "paid")):
            ctx["paid_conversions"] += conv
            ctx["paid_revenue"] += rev
            ctx["paid_sessions"] += int(r.get("sessions") or 0)
            # Attribution par campagne (utm_campaign) — le lien direct campagne → CA
            camp = (r.get("campaign") or "").strip()
            if camp:
                c = ctx["by_campaign"].setdefault(camp, {"conversions": 0.0, "revenue": 0.0, "sessions": 0})
                c["conversions"] += conv
                c["revenue"] += rev
                c["sessions"] += int(r.get("sessions") or 0)

    # ── Les événements, sur trois plans ──────────────────────────────────────
    #
    # `funnel`              — tous canaux confondus. C'est ce que lit
    #                         `_rule_funnel` (« des paniers, zéro achat »), un
    #                         conseil sur le SITE : il n'a pas à être découpé
    #                         par campagne.
    # `events_by_campaign`  — par campagne UTM. Il ne franchit pas l'organique.
    # `events_sans_campagne`— ce qui n'a AUCUNE campagne. Ces événements ont eu
    #                         lieu ; ils ne sont attribuables à personne. On les
    #                         garde pour pouvoir DIRE combien on ne rattache
    #                         pas, plutôt que de les faire disparaître.
    #
    # POURQUOI PAS DE FILTRE `medium` ICI, alors que `by_campaign` en a un.
    # Le revenu de `by_campaign` se calcule dans la branche « trafic payant »,
    # historiquement, parce qu'il servait à juger la pub. Un événement, lui, se
    # rattache par le NOM DE CAMPAGNE et par rien d'autre : si `utm_campaign`
    # porte le nom d'une campagne qu'on connaît, c'est elle — que l'annonceur
    # ait écrit `utm_medium=cpc`, `paid_social` ou `social`. Filtrer sur le
    # medium jetterait en silence les campagnes mal taguées, c'est-à-dire
    # exactement celles dont on veut parler.
    for e in db_fetch_ga4_events(supabase, user_id):
        d = str(e.get("date", ""))
        if not (since_s <= d <= until_s):
            continue
        name = e.get("event_name", "")
        if not name:
            continue
        cnt = int(e.get("event_count") or 0)
        val = float(e.get("event_value") or 0)
        ctx["funnel"][name] = ctx["funnel"].get(name, 0) + cnt
        camp = (e.get("campaign") or "").strip()
        cible = (ctx["events_by_campaign"].setdefault(camp, {}) if camp
                 else ctx["events_sans_campagne"])
        slot = cible.setdefault(name, {"count": 0, "value": 0.0})
        slot["count"] += cnt
        slot["value"] += val

    # Connecté mais aucune donnée sur la fenêtre → on reste prudent (pas de preuve)
    if not in_window:
        ctx["paid_conversions"] = None
        ctx["paid_revenue"] = None
        ctx["paid_sessions"] = None
        ctx["total_sessions"] = None
    return ctx
