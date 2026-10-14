"""La récolte Google Ads d'un compte : l'ordre des appels, et ce qui s'écrit.

Les appels vivent un par fichier dans ce dossier (`budgets`, `statuts`,
`changements`, `insights_campagnes`, `insights_annonces`) ; les écritures dans
`saas/data/supabase/source_data/`.
"""
from __future__ import annotations

from datetime import date, timedelta

from saas.data.supabase.source_data.google import (
    upsert_google_ads, upsert_google_ads_ad_insights, upsert_google_campaign_statuses,
)
from saas.data.supabase.source_data.platform import journal_changements, photo_budget
from saas.data.fetch_data.sources.google.client import AccesGoogle
from saas.data.fetch_data.sources.google.ads.fetchers import (
    ads as insights_annonces,
    budgets,
    campaigns as insights_campagnes,
    changes as changements,
    statuses as statuts,
)
from saas.data.fetch_data.sources.google.auth.oauth import get_access_token_from_refresh
from saas.data.fetch_data.shared.date_ranges import Fenetre, depart_recolte
from saas.data.supabase.fetch_state.state import (
    fetch_google_ads_ad_insights_latest_date, fetch_google_ads_latest_date,
)

# LES DEUX RÉGIES N'OUBLIENT PAS À LA MÊME VITESSE, ET UNE SEULE CONSTANTE POUR
# LES DEUX FAISAIT PERDRE À META CE QUE GOOGLE NE PEUT PAS DONNER.
#
# Google — 30 jours, et c'est écrit noir sur blanc. La doc de `change_event`
# pose trois contraintes : « The date range must be within the past 30 days »,
# la liste DOIT être filtrée par date, et la requête DOIT porter un `LIMIT` d'au
# plus 10 000 lignes. Les trois sont tenues dans `changements.fetch_campaign_changes`. Une
# fenêtre plus large ne rogne pas le résultat : elle fait rejeter la requête
# ENTIÈRE — zéro changement au lieu de trente jours. Et ce qui sort par le fond
# ne revient jamais, donc plus une première récolte tarde, plus l'historique est
# définitivement perdu.
# https://developers.google.com/google-ads/api/docs/change-event
#
# Meta — 180 jours : `_CHANGES_JOURS_META`, avec sa source, dans
# `meta/ads/sync.py`.
#
# La fenêtre est redemandée EN ENTIER à chaque passage, jamais depuis le
# dernier connu : c'est ce qui rattrape un worker à l'arrêt. L'écriture est
# idempotente — `platform_changes` est upserté sur `change_id`.
_CHANGES_JOURS_GOOGLE = 30

# ── LE RECOUVREMENT — pourquoi on relit des jours déjà connus : pavé « LE
# RECOUVREMENT » de `socle/date_ranges.py`. Ce qui est propre à Google :
#
# Google — 30 jours, et là aussi le chiffre vient de la doc, pas du doigt
# mouillé. Deux raisons qui s'additionnent :
#  · la fenêtre de conversion. « If you don't customize the click-through
#    conversion window when you create a new conversion, the default window is
#    30 days » — une conversion peut donc arriver trente jours après le clic et
#    se poser sur le jour du CLIC — et `metrics.conversions` est une colonne
#    de google_ads_insights.
#  · la fraîcheur. Clics, impressions et coût sont rafraîchis toutes les heures
#    (« 1-hour data freshness SLO »), mais les conversions non-dernier-clic —
#    c'est-à-dire l'attribution data-driven, devenue le défaut — ne sont
#    rafraîchies qu'UNE FOIS PAR SEMAINE, « 3:00 PM Monday » heure de San
#    Francisco. Avec une récolte hebdomadaire et un recouvrement de deux jours,
#    un jour lu juste avant le rafraîchissement ne verrait jamais sa vraie
#    valeur. Google prévient d'ailleurs que « your reporting metrics may
#    occasionally be updated one or more days after an event occurs ».
# https://support.google.com/google-ads/answer/3123169
# https://support.google.com/google-ads/answer/2544985
_RECOUVREMENT_JOURS_GOOGLE = 30


def _rien(_etape: str) -> None:
    return None


def recolter(sb, uid, refresh, customer_id, note=_rien, depuis: date | None = None) -> str:
    """La récolte Google Ads d'un compte → le mot de fin du canal.

    `depuis` (récolte complète) remplace le point de reprise des INSIGHTS
    seulement. `change_event`, lui, garde sa fenêtre de 30 jours : une fenêtre
    plus large y fait REJETER LA REQUÊTE ENTIÈRE au lieu de la tronquer — un
    départ global fabriquerait la panne que `_CHANGES_JOURS_GOOGLE` raconte.
    """
    note("jeton")
    access = get_access_token_from_refresh(refresh)
    if not access:
        return "google: token invalide"
    acces = AccesGoogle(jeton=access, client=customer_id)
    today = date.today()
    note("budgets")
    photo_budget(sb, uid, "google",
                 lambda: budgets.recuperer(acces), today)

    # Les statuts remontent AVANT le test de fraîcheur : ils portent les noms de
    # campagnes, et sans eux `change_event` ne rendrait que des noms de
    # ressources — « customers/…/campaigns/456 » n'est pas une phrase.
    note("statuts")
    smap, _ = statuts.fetch_campaign_statuses(access, customer_id)
    noms = {cid: v[0] for cid, v in (smap or {}).items()}
    note("changements")
    journal_changements(sb, uid, "google", lambda: changements.recuperer(
        acces, Fenetre(today - timedelta(days=_CHANGES_JOURS_GOOGLE), today),
        noms_campagnes=noms))

    note("insights")
    since = depuis or depart_recolte(fetch_google_ads_latest_date(sb, uid),
                                     today, _RECOUVREMENT_JOURS_GOOGLE)
    # Même disparition que côté Meta : plus de raccourci « à jour ». Les statuts
    # qu'il upsertait au passage sont écrits en fin de fonction de toute façon.
    rows, trous = insights_campagnes.recuperer(acces, Fenetre(since, today))
    if rows:
        upsert_google_ads(sb, uid, rows)
    if smap:
        upsert_google_campaign_statuses(sb, uid, smap)

    # Détail par annonce (drill-down campagne → groupe → annonce), table à
    # part : sa fraîcheur se déduit d'elle-même, pas de google_ads_insights —
    # les deux récoltes ne sont pas à la même profondeur tant que l'une des
    # deux n'a jamais tourné (voir fetch_google_ads_ad_insights_latest_date).
    note("détail annonces")
    since_ad = depuis or depart_recolte(fetch_google_ads_ad_insights_latest_date(sb, uid),
                                        today, _RECOUVREMENT_JOURS_GOOGLE)
    ad_rows, trous_ad = insights_annonces.recuperer(acces, Fenetre(since_ad, today))
    if ad_rows:
        upsert_google_ads_ad_insights(sb, uid, ad_rows)

    mot = f"google: {len(rows)} lignes, {len(ad_rows)} lignes annonces"
    for quoi, liste in (("campagnes", trous), ("annonces", trous_ad)):
        if liste:
            print(f"    google: {len(liste)} tranche(s) {quoi} refusée(s) : "
                  f"{' | '.join(liste)}")
            mot += f" · {len(liste)} tranche(s) {quoi} REFUSÉE(S) : {liste[0]}"
    return mot
