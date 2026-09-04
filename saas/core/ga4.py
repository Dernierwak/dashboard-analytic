"""GA4 — orchestration du fetch + helper de contexte pour le moteur de recos.

Réutilise le refresh_token Google déjà stocké (profiles.google_refresh_token).
"""

from datetime import date, timedelta

from saas.google_script.fetch_token import get_access_token_from_refresh
from saas.google_script.fetch_ga4 import (
    fetch_ga4_insights,
    fetch_ga4_events,
    fetch_ga4_event_catalog,
)
from saas.scripts.fetch_data import (
    fetch_ga4_latest_date,
    fetch_ga4_insights as db_fetch_ga4,
    fetch_ga4_events as db_fetch_ga4_events,
)
from saas.scripts.insert_data import (
    upsert_ga4_insights,
    upsert_ga4_events,
    upsert_ga4_event_catalog,
)

# Fenêtre du catalogue : ce que la propriété a émis sur les 90 derniers jours.
# Ni la fenêtre incrémentale de la récolte (qui peut ne couvrir qu'un jour, et
# un jour creux ne montrerait presque aucun événement), ni tout l'historique
# (qui ressusciterait à l'écran des événements retirés du site depuis).
_CATALOGUE_JOURS = 90

# ── LE RECOUVREMENT GA4 — 12 jours, et le chiffre est DOCUMENTÉ ───────────────
#
# La reprise partait de « dernière date en base + 1 jour ». C'est le défaut
# corrigé pour Meta et Google dans `saas/worker/fetch_all.py` (voir le pavé
# « LE RECOUVREMENT » qui y explique les deux trous : la journée à moitié
# écoulée gravée pour toujours, et les chiffres que la plateforme révise après
# coup). GA4 avait le même, en pire : la boucle va jusqu'à aujourd'hui, donc
# `latest` devenait aujourd'hui, et le passage suivant repartait de demain.
#
# CE QUE GA4 DIT DE SES PROPRES CHIFFRES, et c'est plus dur que Meta ou Google :
#  · « Data processing can take 24-48 hours. During that time, data in your
#    reports may change. » Deux jours rien que pour que la journée se pose.
#  · « Attribution credit for key events can change for up to 12 days after the
#    key event is recorded », au fur et à mesure que la modélisation s'affine.
#    Et c'est exactement ce qu'on stocke : `conversions` (les événements clés)
#    et `totalRevenue` sont deux des trois métriques de `fetch_ga4_insights`.
# https://support.google.com/analytics/answer/11198161
# https://support.google.com/analytics/answer/12233314
#
# Douze est donc le plus long des deux délais que Google écrit noir sur blanc —
# ce n'est pas un pari comme les 30 jours d'Instagram, c'est le nombre au-delà
# duquel Google n'annonce plus de révision. Google précise aussi que ces durées
# « are not a guarantee, nor an SLA or an SLO » : elles peuvent donc être
# dépassées, et une valeur relue reste une valeur relue.
#
# CE QUE ÇA COÛTE : rien en appels. La boucle découpe en tranches de 90 jours,
# et 12 jours de recouvrement tiennent dans la tranche que la récolte demandait
# de toute façon — ZÉRO requête supplémentaire sur un passage de routine. Les
# lignes réécrites le sont par upsert sur (user_id, date, source, medium,
# campaign), donc elles REMPLACENT, elles ne s'ajoutent pas.
_RECOUVREMENT_JOURS_GA4 = 12


def fetch_theme_ga4_events(supabase, user_id: str) -> dict[str, list[dict]]:
    """Les événements GA4 rattachés à chaque thème.

    SA PLACE EST DISCUTABLE ET ELLE EST ASSUMÉE : toutes les autres lectures
    Supabase de GA4 vivent dans `scripts/fetch_data.py`, et celle-ci ferait un
    voisin naturel de `fetch_ga4_events`. Elle est ici parce que ce module est
    le SEUL consommateur côté Python — la récolte s'en sert pour savoir quoi
    demander à l'API, le worker la réutilise via `build_ga4_context`, et Pulse
    lit la table directement en SQL (`lib/channels.ts::getThemeEvenements`).
    Une lecture à un seul appelant se range avec son appelant.

    Returns: {label: [{"event_name": str, "rang": "principal"|"secondaire"}]},
    les principaux d'abord dans chaque liste. {} si la table est absente
    (migration `theme_ga4_events.sql` pas passée) — l'appelant retombe alors sur
    le seul plancher `FUNNEL_EVENTS`, exactement comme avant cette
    fonctionnalité. C'est ce qui rend la migration non bloquante.
    """
    try:
        rows = (
            supabase.table("theme_ga4_events")
            .select("label, event_name, rang")
            .eq("user_id", user_id)
            .execute()
            .data
        ) or []
    except Exception:
        return {}
    out: dict[str, list[dict]] = {}
    for r in rows:
        lbl = (r.get("label") or "").strip()
        nom = (r.get("event_name") or "").strip()
        if not lbl or not nom:
            continue
        out.setdefault(lbl, []).append({
            "event_name": nom,
            "rang": r.get("rang") or "secondaire",
        })
    for lst in out.values():
        lst.sort(key=lambda e: (e["rang"] != "principal", e["event_name"]))
    return out


def run_ga4_fetch(
    supabase,
    user_id: str,
    refresh_token: str,
    property_id: str,
    force_full: bool = False,
    progress_cb=None,
    since_date=None,
) -> dict:
    """Fetch GA4 (jour × source/medium) et sauvegarde Supabase.
    since_date : date de départ explicite (pop-up « Mes données ») — prime sur tout.
    Returns: {success, rows, message}
    """
    def _p(pct, txt):
        if progress_cb:
            try:
                progress_cb(pct, txt)
            except Exception:
                pass

    _p(5, "Authentification Google…")
    access_token = get_access_token_from_refresh(refresh_token)
    if not access_token:
        return {"success": False, "rows": 0, "message": "Refresh token invalide. Reconnecte-toi à Google."}

    today = date.today()

    # ── LE CATALOGUE D'ABORD, ET QUOI QU'IL ARRIVE ENSUITE ──────────────────
    # Il est rafraîchi AVANT les sorties anticipées (« la propriété ne rend
    # rien », départ dans le futur) : c'est lui qui alimente l'écran où le client
    # choisit ses événements, et cet écran doit rester utilisable un jour où il
    # n'y a rien de neuf à récolter. Deux appels d'API, une ligne par nom
    # d'événement — le coût est négligeable devant la récolte elle-même.
    # ET IL SE JOURNALISE, QUOI QU'IL ARRIVE. `_cat_err` était lu puis jeté, et
    # `except Exception: pass` avalait le reste : une propriété injoignable, un
    # scope OAuth absent ou une migration non jouée donnaient tous les trois le
    # même écran vide et le même « terminé » dans les logs. Le cache ne fait
    # toujours pas échouer la récolte — mais il DIT ce qui lui est arrivé.
    catalogue_note = None
    try:
        catalogue, cat_err = fetch_ga4_event_catalog(
            access_token, property_id,
            today - timedelta(days=_CATALOGUE_JOURS), today,
        )
        if cat_err:
            catalogue_note = f"catalogue NON lu (API GA4) : {cat_err}"
        elif not catalogue:
            catalogue_note = (f"catalogue vide : la propriété n'a émis AUCUN événement "
                              f"sur {_CATALOGUE_JOURS} jours")
        else:
            # Le retour porte la raison quand l'écriture n'a pas eu lieu ; None
            # quand elle a réussi. Voir `scripts/insert_data.py`.
            echec = upsert_ga4_event_catalog(supabase, user_id, catalogue, today.isoformat())
            catalogue_note = echec or f"catalogue : {len(catalogue)} événements"
    except Exception as e:
        catalogue_note = f"catalogue KO : {e}"

    def _avec_catalogue(msg: str) -> str:
        """Le mot du catalogue est collé à CHAQUE sortie de la fonction.

        Les sorties anticipées le perdaient, et c'est précisément là qu'un
        écran d'événements vide est inexplicable : la récolte rend « 0 ligne »
        sans jamais dire si la liste des événements, elle, a été écrite.
        """
        return f"{msg} · {catalogue_note}" if catalogue_note else msg

    # Les événements que le client a rattachés à ses thèmes : ce sont EUX qu'on
    # récolte au jour le jour, en plus du plancher du funnel. Voir
    # `google_script/fetch_ga4.py::fetch_ga4_events` pour le raisonnement de
    # volumétrie qui interdit de tout prendre.
    try:
        _choisis = sorted({
            e["event_name"]
            for lst in (fetch_theme_ga4_events(supabase, user_id) or {}).values()
            for e in lst
        })
    except Exception:
        _choisis = []

    # LE MÊME DÉPART QUE META ET GOOGLE, ET LA MÊME FONCTION — pas une seconde
    # copie de la règle. L'import est LOCAL parce qu'il serait circulaire au
    # niveau du module : `saas/worker/fetch_all.py` importe `run_ga4_fetch` d'ici.
    # À l'exécution, l'appelant est déjà chargé, donc l'import ne coûte rien.
    from saas.worker.fetch_all import _depart_recolte

    latest = fetch_ga4_latest_date(supabase, user_id) if not force_full else None
    since = _depart_recolte(latest, today, _RECOUVREMENT_JOURS_GA4)
    if since_date:
        since = since_date  # choix explicite du pop-up « Mes données »
    # Ce garde-fou ne peut plus se déclencher sur une reprise (`latest - 12` est
    # toujours antérieur à aujourd'hui) : il ne reste que pour une date de
    # départ saisie dans le futur depuis le pop-up « Mes données ».
    if since > today:
        return {"success": True, "rows": 0,
                "message": _avec_catalogue("Départ demandé après aujourd'hui : rien à récolter")}

    # Chunking par 90 jours (cohérent Meta/Google Ads)
    CHUNK = 90
    chunks = []
    cur = since
    while cur <= today:
        end = min(cur + timedelta(days=CHUNK - 1), today)
        chunks.append((cur, end))
        cur = end + timedelta(days=1)

    rows = []
    event_rows = []
    last_error = None
    for i, (c_since, c_until) in enumerate(chunks):
        _p(int(10 + (i / max(len(chunks), 1)) * 75),
           f"Chargement {c_since:%b %Y} → {c_until:%b %Y}… ({len(rows)} lignes)")
        chunk_rows, err = fetch_ga4_insights(access_token, property_id, c_since, c_until)
        if err:
            last_error = err
            continue
        rows += chunk_rows
        # Détail par événement (best-effort : ne bloque pas le fetch principal)
        chunk_events, _ev_err = fetch_ga4_events(
            access_token, property_id, c_since, c_until, event_names=_choisis)
        if not _ev_err:
            event_rows += chunk_events

    if not rows:
        # Avec le recouvrement, la fenêtre couvre toujours au moins 12 jours
        # DÉJÀ connus : zéro ligne ne veut donc plus dire « rien de neuf », ça
        # veut dire que la propriété ne rend rien du tout sur cette fenêtre.
        msg = (f"aucune ligne sur {since:%d/%m}→{today:%d/%m} — la propriété ne rend rien"
               + (f". Erreur : {last_error}" if last_error else ""))
        return {"success": last_error is None, "rows": 0, "message": _avec_catalogue(msg)}

    _p(92, "Sauvegarde Supabase…")
    try:
        upsert_ga4_insights(supabase, user_id, rows)
    except Exception as e:
        return {"success": False, "rows": 0, "message": _avec_catalogue(f"sauvegarde échouée : {e}")}
    # Le détail par événement : non bloquant, mais plus muet. La table absente
    # (migration `ga4_events.sql` non jouée) est le cas le plus probable, et
    # c'est aussi celui qui vide l'écran des événements sans rien expliquer.
    ev_note = ""
    try:
        upsert_ga4_events(supabase, user_id, event_rows)
    except Exception as e:
        ev_note = f" · événements NON écrits : {e}"

    return {"success": True, "rows": len(rows),
            "message": _avec_catalogue(
                f"{len(rows)} lignes GA4 depuis le {since:%d/%m} "
                f"(+ {len(event_rows)} lignes d'événements){ev_note}")}


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
    # `events_by_campaign`  — par campagne UTM. C'est le seul pont possible vers
    #                         un thème, et il ne franchit pas l'organique.
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
