"""La récolte GA4 d'une propriété : catalogue, insights, événements, et l'écriture.

Les appels vivent dans `insights.py`, `evenements.py` et `catalogue.py` ; les
écritures dans `collecte/ecriture/google.py`.
"""
from datetime import date, timedelta

from saas.collecte.ecriture.google import (
    upsert_ga4_event_catalog, upsert_ga4_events, upsert_ga4_insights,
)
from saas.collecte.google.analytics import catalogue as catalogue_api
from saas.collecte.google.analytics import evenements, insights
from saas.collecte.google.auth.oauth import get_access_token_from_refresh
from saas.collecte.socle.fenetre import depart_recolte, tranches
from saas.commun.fetch_data import fetch_ga4_latest_date

# Fenêtre du catalogue : ce que la propriété a émis sur les 90 derniers jours.
# Ni la fenêtre incrémentale de la récolte (qui peut ne couvrir qu'un jour, et
# un jour creux ne montrerait presque aucun événement), ni tout l'historique
# (qui ressusciterait à l'écran des événements retirés du site depuis).
_CATALOGUE_JOURS = 90

# ── LE RECOUVREMENT GA4 — 12 jours, et le chiffre est DOCUMENTÉ ───────────────
#
# La reprise partait de « dernière date en base + 1 jour ». C'est le défaut
# corrigé pour Meta et Google — voir le pavé « LE RECOUVREMENT » de
# `saas/collecte/socle/fenetre.py`, qui y explique les deux trous : la journée à moitié
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
#    et `totalRevenue` sont deux des trois métriques de `insights.py`.
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


def recolter(
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
        catalogue, cat_err = catalogue_api.fetch_ga4_event_catalog(
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
            # quand elle a réussi. Voir `collecte/ecriture/google.py`.
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

    # LE MÊME DÉPART QUE META ET GOOGLE, ET LA MÊME FONCTION — pas une seconde
    # copie de la règle (`socle/fenetre.py`).

    latest = fetch_ga4_latest_date(supabase, user_id) if not force_full else None
    since = depart_recolte(latest, today, _RECOUVREMENT_JOURS_GA4)
    if since_date:
        since = since_date  # choix explicite du pop-up « Mes données »
    # Ce garde-fou ne peut plus se déclencher sur une reprise (`latest - 12` est
    # toujours antérieur à aujourd'hui) : il ne reste que pour une date de
    # départ saisie dans le futur depuis le pop-up « Mes données ».
    if since > today:
        return {"success": True, "rows": 0,
                "message": _avec_catalogue("Départ demandé après aujourd'hui : rien à récolter")}

    # Chunking par 90 jours (cohérent Meta/Google Ads)
    chunks = tranches(since, today)

    rows = []
    event_rows = []
    # Les tranches refusées, gardées TOUTES. Un seul `last_error` ne parlait que
    # quand AUCUNE tranche n'avait rendu de lignes : dès qu'une passait, les
    # autres disparaissaient sans un mot sur une run verte. Les événements,
    # eux, n'étaient jamais signalés.
    trous: list[str] = []
    trous_ev: list[str] = []
    for i, (c_since, c_until) in enumerate(chunks):
        _p(int(10 + (i / max(len(chunks), 1)) * 75),
           f"Chargement {c_since:%b %Y} → {c_until:%b %Y}… ({len(rows)} lignes)")
        chunk_rows, err = insights.tranche(access_token, property_id, c_since, c_until)
        if err:
            trous.append(f"{c_since.isoformat()}→{c_until.isoformat()} : {err}")
            continue
        rows += chunk_rows
        # Détail par événement : ne bloque pas le fetch principal, mais se dit.
        chunk_events, ev_err = evenements.tranche(
            access_token, property_id, c_since, c_until)
        if ev_err:
            trous_ev.append(f"{c_since.isoformat()}→{c_until.isoformat()} : {ev_err}")
        else:
            event_rows += chunk_events

    def _avec_trous(msg: str) -> str:
        for quoi, liste in (("insights", trous), ("événements", trous_ev)):
            if liste:
                msg += f" · {len(liste)} tranche(s) {quoi} REFUSÉE(S) : {liste[0]}"
        return msg

    if not rows:
        # Avec le recouvrement, la fenêtre couvre toujours au moins 12 jours
        # DÉJÀ connus : zéro ligne ne veut donc plus dire « rien de neuf », ça
        # veut dire que la propriété ne rend rien du tout sur cette fenêtre.
        msg = (f"aucune ligne sur {since:%d/%m}→{today:%d/%m}"
               + ("" if trous else " — la propriété ne rend rien"))
        return {"success": not trous, "rows": 0,
                "message": _avec_catalogue(_avec_trous(msg))}

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
            "message": _avec_catalogue(_avec_trous(
                f"{len(rows)} lignes GA4 depuis le {since:%d/%m} "
                f"(+ {len(event_rows)} lignes d'événements){ev_note}"))}
