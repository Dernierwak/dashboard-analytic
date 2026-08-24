"""Worker de fetch automatique — récolte les données SANS personne connecté.

Branché sur un cron (GitHub Actions), tourne chaque jour : pour chaque utilisateur
dont c'est le jour de mise à jour, récupère Meta Ads + Google Ads + GA4 + Instagram
et écrit dans le même Supabase que l'app. C'est le « ça marche sans moi ».

Réutilise la logique de fetch existante (rendue headless) :
  - Meta Ads / Instagram : token utilisateur (connected_accounts.meta_token)
  - Google Ads / GA4      : refresh_token Google + secrets app (via scripts.app_secrets)

Variables d'env requises :
  SUPABASE_URL            (sinon lu dans secrets.toml [supabase].url)
  SUPABASE_SERVICE_KEY    (clé service_role — bypass RLS pour lire tous les users)
  GOOGLE_ADS_*            (client_id, client_secret, developer_token) pour Google
"""

from __future__ import annotations
import os
import sys
import json
import traceback
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta
from pathlib import Path

import requests

# Racine du projet sur le path (pour importer scripts/, google_script/, meta_script/, components/)
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from supabase import create_client                                        # noqa: E402
from scripts.app_secrets import secret                                    # noqa: E402
from scripts.fetch_data import fetch_meta_ads_latest_date, fetch_google_ads_latest_date  # noqa: E402
from scripts.insert_data import (                                         # noqa: E402
    upsert_meta_ads, upsert_campaign_statuses,
    upsert_google_ads, upsert_google_campaign_statuses,
    insert_instagram_org, upsert_platform_budgets, upsert_platform_changes,
)
from google_script.fetch_token import get_access_token_from_refresh        # noqa: E402
from google_script.fetch_google_ads import (                               # noqa: E402
    fetch_campaign_insights, fetch_campaign_statuses,
    fetch_campaign_budgets as google_budgets,
    fetch_campaign_changes as google_changes,
)
from meta_script.fetch_meta_ads import (                                   # noqa: E402
    fetch_campaign_budgets as meta_budgets,
    fetch_activities as meta_changes,
)
from saas.worker.suivi import Suivi, CANAUX                                # noqa: E402

# ═══ LA RÉCOLTE EN PARALLÈLE — trois fils, et le compte est fait ══════════════
#
# Ce sont des appels réseau qui ATTENDENT : le GIL n'entre pas en jeu, des fils
# suffisent. Restaient trois questions, et deux d'entre elles ont changé la
# forme retenue.
#
# ① LE CLIENT SUPABASE EST-IL SÛR ENTRE PLUSIEURS FILS ? Pas tout à fait, et ça
#    se lit dans la bibliothèque installée (supabase 2.27.2 / httpx 0.28.1) :
#     · CE QUI EST SÛR — `postgrest/_sync/request_builder.py` construit un objet
#       `Headers` NEUF par requête et n'écrit jamais dans l'état partagé ; et le
#       transport `httpx` s'appuie sur `httpcore`, dont `ConnectionPool` protège
#       sa liste de connexions par un `ThreadLock` et dont les connexions HTTP/2
#       portent quatre verrous (`_init_lock`, `_state_lock`, `_read_lock`,
#       `_write_lock`). Deux `.execute()` simultanés ne se marchent pas dessus.
#     · CE QUI NE L'EST PAS — `supabase/_sync/client.py` construit ses
#       sous-clients PARESSEUSEMENT, en `if self._postgrest is None: … = …`,
#       SANS verrou. Trois fils qui touchent le même client au même instant pour
#       la PREMIÈRE fois en fabriquent chacun un, avec chacun son pool de
#       connexions ; deux sont abandonnés sans jamais être fermés. Même schéma
#       sur `.storage`, que la récolte Instagram utilise pour les images.
#    La réponse n'est donc PAS nette, et on ne parie pas : **un client par fil**,
#    créé dans le fil. Le coût est nul en réseau — `create_client` ne fait aucun
#    aller-retour (la session est lue dans un stockage mémoire vide) — et il
#    supprime la question au lieu de l'arbitrer.
#
# ② META ADS ET INSTAGRAM TAPENT LA MÊME API AVEC LE MÊME JETON. Les séparer
#    rapporte quoi, exactement ? La mesure de la veille, en appels par récolte :
#    Meta ~5-6, Google ~5-6, GA4 ~5, **Instagram 100 à 130**. Sur ~131 appels au
#    total, le chemin le plus long vaut 120 en trois fils (Meta+Instagram) contre
#    115 en quatre. Séparer Meta d'Instagram gagne donc ~4 % du chemin critique,
#    en échange d'une contention sur les compteurs de débit de Meta que personne
#    ici ne peut mesurer sans jeton. Un gain de 4 % ne s'achète pas avec un
#    risque non mesurable : **trois fils**.
#      · fil 1 — Meta Ads puis Instagram, EN SÉRIE ;
#      · fil 2 — Google Ads ;
#      · fil 3 — GA4.
#    (Google Ads et GA4 partagent le jeton Google mais pas l'API ni le quota :
#     l'un parle à googleads.googleapis.com, l'autre à analyticsdata.)
#
# ③ CE QUE ÇA FAIT GAGNER, HONNÊTEMENT. Instagram pèse 115 appels sur 131, soit
#    88 % du total. La loi d'Amdahl plafonne donc l'accélération à 1 / 0,88 =
#    1,14× — **environ 12 % au mieux, ~8 % avec la forme retenue**. Et l'appel
#    n'est qu'un PROXY grossier de la durée : le téléchargement d'image puis
#    l'envoi au stockage que fait Instagram durent bien plus qu'un GET Graph, ce
#    qui rend Instagram encore plus dominant, donc le gain encore plus petit.
#    Le vrai levier était ailleurs, et il est dans `_fetch_insta_post_id`.
#
# UNE PLATEFORME QUI ÉCHOUE N'EMPORTE PAS LES AUTRES : chaque canal est attrapé
# dans son fil. Et le journal est TRIÉ À L'ARRIVÉE dans l'ordre de `CANAUX` —
# en parallèle, l'ordre d'exécution n'est plus un ordre, c'est le hasard des
# latences.
_FILS_MAX = 3

# LES DEUX RÉGIES N'OUBLIENT PAS À LA MÊME VITESSE, ET UNE SEULE CONSTANTE POUR
# LES DEUX FAISAIT PERDRE À META CE QUE GOOGLE NE PEUT PAS DONNER.
#
# Google — 30 jours, et c'est écrit noir sur blanc. La doc de `change_event`
# pose trois contraintes : « The date range must be within the past 30 days »,
# la liste DOIT être filtrée par date, et la requête DOIT porter un `LIMIT` d'au
# plus 10 000 lignes. Les trois sont tenues dans `fetch_campaign_changes`. Une
# fenêtre plus large ne rogne pas le résultat : elle fait rejeter la requête
# ENTIÈRE — zéro changement au lieu de trente jours. Et ce qui sort par le fond
# ne revient jamais, donc plus une première récolte tarde, plus l'historique est
# définitivement perdu.
# https://developers.google.com/google-ads/api/docs/change-event
#
# Meta — 180 jours, et c'est un PARI ASSUMÉ, pas une garantie lue quelque part.
# Ce que la doc dit vraiment de l'edge `activities` : `since` = « The start time
# to query account history. Default is 7 days prior », `until` = « Default is
# now » ; la page de l'edge au niveau COMPTE, elle, ne documente aucun paramètre
# et aucune rétention. Donc : aucune limite de fenêtre et aucun plafond de
# pagination ne sont écrits nulle part — mais un silence de la doc n'est pas une
# promesse, et personne n'a encore appelé l'edge avec un `since` à six mois (pas
# de token dans cet environnement). Ce qui EST certain, c'est que les 30 jours
# qu'on infligeait ici étaient une symétrie avec Google que Meta n'a jamais
# demandée. Si Meta refusait la fenêtre, la récolte le dirait sans rien casser :
# `_journal_changements` est best-effort et imprime l'erreur.
# https://developers.facebook.com/docs/marketing-api/reference/ad-campaign/activities/
# https://developers.facebook.com/docs/marketing-api/reference/ad-activity/
#
# Six mois plutôt qu'un an, parce que c'est le premier chiffre qui rend le
# worker RATTRAPABLE sans rendre la pagination folle : le fil n'affiche que
# 60 jours, une récolte arrêtée quatre mois se rattrape donc entièrement au
# redémarrage, et `fetch_activities` borne désormais son nombre de pages
# (`_ACTIVITES_PAGES_MAX`), ce qui plafonne le coût d'un compte très actif.
#
# Les deux fenêtres sont redemandées EN ENTIER à chaque passage, jamais depuis
# le dernier connu : c'est ce qui rattrape un worker à l'arrêt. L'écriture est
# idempotente — `platform_changes` est upserté sur `change_id`.
_CHANGES_JOURS_GOOGLE = 30
_CHANGES_JOURS_META = 180

# ── LE RECOUVREMENT — on redemande N jours DÉJÀ connus à chaque passage ───────
#
# La reprise partait de « dernière date en base + 1 jour ». Deux trous en
# découlaient, et le second ne se voyait nulle part.
#
# ① LE DEMI-JOUR GRAVÉ POUR TOUJOURS. La boucle de récolte va jusqu'à
#    aujourd'hui, donc elle écrit une journée à moitié écoulée. `latest`
#    devenait aujourd'hui, et le passage suivant repartait de demain : la
#    journée arrêtée à 14 h 28 n'était JAMAIS relue. Et ce n'est pas seulement
#    « des chiffres un peu bas » — `latest` est un maximum GLOBAL, donc une pub
#    qui ne dépense qu'à partir de 18 h n'a aucune ligne ce jour-là et n'en
#    aura jamais, alors que la journée compte comme récoltée.
#
# ② LES CHIFFRES QUE LA RÉGIE RÉVISE APRÈS COUP. Les deux plateformes
#    rattachent une conversion au jour du CLIC, pas au jour de la conversion.
#    Un jour déjà en base continue donc de bouger pendant des jours après sa
#    première lecture. Repartir à `latest + 1` le fige sur sa version la plus
#    jeune, c'est-à-dire la plus fausse.
#
# POURQUOI ON RÉÉCRIT AU LIEU DE COMPARER — c'est contre-intuitif, et
# quelqu'un voudra le « corriger » un jour, alors autant l'écrire ici : on ne
# compare RIEN avec la plateforme, on redemande la plage et on la réécrit.
# Les trois tables portent une clé d'unicité — meta_ads_insights
# (user_id, date_start, ad_name), google_ads_insights (user_id, date_start,
# campaign_id), instagram_organic_posts (user_id, post_id) — et les écritures
# sont des upserts sur ces clés exactes. Réécrire un jour connu REMPLACE donc
# la ligne, il n'en ajoute pas une. Une comparaison ligne à ligne coûterait de
# relire toute la base, de faire un diff, et se tromperait le jour où un champ
# change de forme ; la réécriture ne peut pas se tromper, et elle se répare
# toute seule : une récolte ratée est rattrapée par la suivante sans que
# personne ait à le savoir.
#
# Meta — 7 jours, le nombre que Meta documente lui-même. On n'envoie pas
# `action_attribution_windows`, donc c'est `default` qui s'applique, et la
# référence de /act_<id>/insights dit noir sur blanc que `default` « means
# ["7d_click","1d_view"] » : une action peut être rattachée à un clic vieux de
# sept jours ou à une impression de la veille.
# Pour ce qu'on stocke AUJOURD'HUI (spend, impressions, clicks, reach,
# link_clicks) deux jours suffiraient : la seule valeur qui sorte du tableau
# `actions` est `link_click`, et seule la moitié `1d_view` de la fenêtre peut
# le reculer d'un jour. On prend quand même les 7 que Meta annonce, parce que
# le surcoût est nul (voir le décompte plus bas) et que le jour où une colonne
# de conversions entrera dans meta_ads_insights, personne n'ira relire ce
# commentaire pour élargir la fenêtre.
# https://developers.facebook.com/docs/marketing-api/reference/ad-account/insights/
_RECOUVREMENT_JOURS_META = 7

# Google — 30 jours, et là aussi le chiffre vient de la doc, pas du doigt
# mouillé. Deux raisons qui s'additionnent :
#  · la fenêtre de conversion. « If you don't customize the click-through
#    conversion window when you create a new conversion, the default window is
#    30 days » — une conversion peut donc arriver trente jours après le clic et
#    se poser sur le jour du CLIC. Et contrairement à Meta,
#    `metrics.conversions` EST une colonne de google_ads_insights.
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

# CE QUE ÇA COÛTE — compté, pas supposé. Les deux boucles découpent déjà la
# plage en tranches de 90 jours (`_CHUNK`), et un recouvrement de 7 ou 30 jours
# tient dans la tranche que la récolte demandait de toute façon : ZÉRO appel
# supplémentaire sur un passage de routine. Ce qui grossit, ce sont les lignes
# rendues puis réécrites. Sur une récolte hebdomadaire :
#  · Google, 10 campagnes actives — on passe de 7 à 37 jours, soit ~70 lignes
#    au lieu de ~370, dans le même et unique searchStream ;
#  · Meta, 20 pubs actives — de 7 à 14 jours, soit ~140 lignes au lieu de
#    ~280, toujours une seule page (`limit=500`).
# Les quotas ne bronchent pas : en accès standard, Ads Insights autorise
# « 600 + 400 * Number of Active ads » appels par heure, soit 8 600/h pour
# 20 pubs — la récolte en fait moins de dix.
# https://developers.facebook.com/docs/graph-api/overview/rate-limiting/


def _depart_recolte(latest: str | None, today: date, recouvrement: int) -> date:
    """Le jour où la récolte reprend.

    Aucun repère n'est stocké — ni table, ni colonne de suivi. Le point de
    reprise est DÉDUIT de la donnée elle-même (la date la plus récente en
    base), puis reculé du recouvrement. C'est volontaire et c'est mieux qu'un
    état stocké : une récolte qui note « fait jusqu'au 12 » puis plante en
    écrivant perd le 12 pour toujours, alors qu'une date lue dans les lignes
    réellement écrites ne peut pas mentir sur ce qui a été fait.

    Première récolte (rien en base) : 1er janvier de l'année en cours — voir la
    note « profondeur d'historique » plus bas, ce chiffre est discutable et
    n'est pas discuté ici.
    """
    if not latest:
        return date(today.year, 1, 1)
    # Pas de plancher au 1er janvier : reculer de quelques jours avant la plus
    # ancienne date connue ne rend que des jours vides, ça ne coûte pas un
    # appel de plus (même tranche) et ça ne casse rien.
    return date.fromisoformat(latest) - timedelta(days=recouvrement)


# ── PROFONDEUR D'HISTORIQUE — chiffré, PAS appliqué ───────────────────────────
#
# La première récolte part du 1er janvier de l'année en cours. Un client qui
# s'inscrit le 5 janvier repart donc avec quatre jours, et la matrice
# full-history n'a rien à croiser. Ce que les plateformes accepteraient :
#  · Meta — « the start date of the time range cannot be beyond 37 months from
#    the current date ». 37 mois ≈ 1 126 jours = 13 tranches de 90 jours ;
#    20 pubs × 1 126 jours ≈ 22 500 lignes ≈ 45 pages de 500, donc ~52 requêtes
#    en tout, soit deux à trois minutes UNE FOIS. Le quota horaire ne le voit
#    même pas passer. Un piège quand même : `reach` est un compte unique, et
#    Meta l'a plafonné à 13 mois — au-delà la colonne revient vide. Ce n'est
#    pas un bug à corriger, c'est de la donnée qui n'existe plus.
#  · Google — aucun plafond documenté sur `segments.date` ; 13 searchStream,
#    10 campagnes × 1 126 jours ≈ 11 300 lignes. Moins d'une minute.
#  · Instagram — le coût n'est pas dans les jours, il est dans les POSTS :
#    trois appels Graph + un téléchargement + un envoi de fichier par post.
#    Et il est déjà borné à 200 posts (`self.limit` en payant), donc élargir
#    la profondeur des régies ne le touche pas.
# Autrement dit un backfill 37 mois des deux régies coûte ~65 requêtes et
# quelques minutes, une seule fois par compte. Le vrai obstacle n'est pas
# l'API, c'est l'écriture : `upsert_meta_ads` envoie TOUT en un seul appel
# PostgREST, et 22 500 lignes d'un coup n'ont jamais été essayées. À découper
# avant d'élargir quoi que ce soit.
from components.ga4 import run_ga4_fetch                                   # noqa: E402
from meta_script.fetch_instagram import OrganicInstagramm                  # noqa: E402

_GRAPH = "https://graph.facebook.com/v24.0"
_CHUNK = 90


def _service_client():
    url = os.getenv("SUPABASE_URL") or secret("supabase.url")
    key = os.getenv("SUPABASE_SERVICE_KEY") or secret("supabase.service_role")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_KEY manquants (env ou secrets.toml).")
    return create_client(url, key)


def _due_today(fetch_schedule: str | None) -> bool:
    """True si c'est le jour de mise à jour de l'utilisateur.
    Pas de jour défini → on prend lundi par défaut (évite de fetch tous les jours)."""
    today = datetime.utcnow().strftime("%A")  # 'Monday', ...
    return (fetch_schedule or "Monday") == today


# ── Meta Ads (token utilisateur) ──────────────────────────────────────────────

def _meta_chunk(token, ad_account_id, since_iso, until_iso) -> list:
    params = {
        "access_token": token, "level": "ad",
        "fields": "campaign_name,adset_name,ad_name,impressions,clicks,reach,spend,actions,date_start",
        "time_increment": 1,
        "time_range": json.dumps({"since": since_iso, "until": until_iso}),
        "limit": 500,
    }
    try:
        data = requests.get(f"{_GRAPH}/{ad_account_id}/insights", params=params, timeout=60).json()
    except Exception:
        return []
    rows = data.get("data", [])
    nxt = data.get("paging", {}).get("next")
    while nxt:
        try:
            resp = requests.get(nxt, timeout=60).json()
        except Exception:
            break
        rows += resp.get("data", [])
        nxt = resp.get("paging", {}).get("next")
    return rows


def _photo_budget(sb, uid, canal: str, recolte, jour: date) -> None:
    """Photographie le budget PLANIFIÉ du canal. Best-effort, JAMAIS bloquant.

    Un budget manquant coûte une case vide sur la page Coûts ; un budget qui
    fait échouer la récolte coûte une semaine entière d'insights. C'est pour ça
    que tout est attrapé ici plutôt que remonté à l'appelant.
    """
    try:
        rows, err = recolte()
        if rows:
            upsert_platform_budgets(sb, uid, canal, rows, jour.isoformat())
        elif err:
            print(f"    budgets {canal} ignorés : {err}")
    except Exception as e:
        print(f"    budgets {canal} KO : {e}")


def _journal_changements(sb, uid, canal: str, recolte) -> None:
    """Le journal des changements déclarés. Best-effort, JAMAIS bloquant —
    même raison que `_photo_budget` : le fil se passe d'une ligne, pas la
    récolte d'une semaine d'insights."""
    try:
        rows, err = recolte()
        if rows:
            upsert_platform_changes(sb, uid, canal, rows)
        elif err:
            print(f"    changements {canal} ignorés : {err}")
    except Exception as e:
        print(f"    changements {canal} KO : {e}")


def _rien(_etape: str) -> None:
    """Le rapporteur d'étapes par défaut : celui qui ne rapporte à personne.

    Il existe pour que ces fonctions restent appelables hors du worker (essai à
    la main, ancien Streamlit) sans traîner un objet de suivi."""
    return None


def _fetch_meta(sb, uid, token, note=_rien) -> str:
    # `note` marque une étape FRANCHIE, pas un pourcentage : la séquence est
    # écrite ici, mais le nombre d'appels de chacune ne l'est pas.
    note("comptes")
    r = requests.get(f"{_GRAPH}/me/adaccounts", params={"fields": "id", "access_token": token}, timeout=30)
    accts = r.json().get("data", [])
    if not accts:
        return "meta: aucun compte pub"
    ad_account_id = accts[0]["id"]
    today = date.today()
    note("budgets")
    # Avant tout test de fraîcheur : la photo du budget doit être prise même
    # quand les insights sont déjà à jour. Sinon un compte qui ne dépense plus
    # n'aurait plus aucun relevé, et la page Coûts le lirait « rien de prévu ».
    _photo_budget(sb, uid, "meta", lambda: meta_budgets(token, ad_account_id), today)
    note("changements")
    _journal_changements(sb, uid, "meta", lambda: meta_changes(
        token, ad_account_id,
        (today - timedelta(days=_CHANGES_JOURS_META)).isoformat(), today.isoformat()))
    note("insights")
    latest = fetch_meta_ads_latest_date(sb, uid)
    since = _depart_recolte(latest, today, _RECOUVREMENT_JOURS_META)
    # Le raccourci « meta: à jour » a disparu, et pas par distraction : avec un
    # recouvrement il ne pouvait plus se déclencher (`latest - 7` est toujours
    # antérieur à aujourd'hui), et surtout il n'a plus de sens. Il n'y a plus de
    # « à jour » — il y a une fenêtre qu'on relit à chaque passage.
    rows, cur = [], since
    while cur <= today:
        end = min(cur + timedelta(days=_CHUNK - 1), today)
        rows += _meta_chunk(token, ad_account_id, cur.isoformat(), end.isoformat())
        cur = end + timedelta(days=1)
    # On demande aussi les dates DECLAREES. Elles ne se deduisent pas de la
    # depense : une campagne programmee jusqu'en decembre et une campagne
    # arretee hier laissent exactement la meme trace dans les insights.
    note("statuts")
    camp = requests.get(
        f"{_GRAPH}/{ad_account_id}/campaigns",
        params={"access_token": token,
                "fields": "name,effective_status,start_time,stop_time",
                "limit": 200},
        timeout=30).json()

    def _jour(v):
        return str(v)[:10] if v else None

    status_map = {
        c["name"]: {
            "status": c.get("effective_status", "UNKNOWN"),
            "start_date": _jour(c.get("start_time")),
            # stop_time absent = campagne sans date de fin programmee.
            "end_date": _jour(c.get("stop_time")),
        }
        for c in camp.get("data", []) if c.get("name")
    }
    for row in rows:
        lc = next((it for it in row.get("actions", []) if it.get("action_type") == "link_click"), None)
        row["link_clicks"] = int(lc.get("value", 0)) if lc else 0
        row["effective_status"] = (
            status_map.get(row.get("campaign_name", ""), {}).get("status") or "UNKNOWN"
        )
    if rows:
        upsert_meta_ads(sb, uid, rows)
        upsert_campaign_statuses(sb, uid, status_map)
    return f"meta: {len(rows)} lignes"


# ── Google Ads (refresh_token + secrets app) ──────────────────────────────────

def _fetch_google(sb, uid, refresh, customer_id, note=_rien) -> str:
    note("jeton")
    access = get_access_token_from_refresh(refresh)
    if not access:
        return "google: token invalide"
    today = date.today()
    note("budgets")
    _photo_budget(sb, uid, "google",
                  lambda: google_budgets(access, customer_id), today)

    # Les statuts remontent AVANT le test de fraîcheur : ils portent les noms de
    # campagnes, et sans eux `change_event` ne rendrait que des noms de
    # ressources — « customers/…/campaigns/456 » n'est pas une phrase.
    note("statuts")
    smap, _ = fetch_campaign_statuses(access, customer_id)
    noms = {cid: v[0] for cid, v in (smap or {}).items()}
    note("changements")
    _journal_changements(sb, uid, "google", lambda: google_changes(
        access, customer_id, today - timedelta(days=_CHANGES_JOURS_GOOGLE),
        noms_campagnes=noms))

    note("insights")
    latest = fetch_google_ads_latest_date(sb, uid)
    since = _depart_recolte(latest, today, _RECOUVREMENT_JOURS_GOOGLE)
    # Même disparition que côté Meta : plus de raccourci « à jour ». Les statuts
    # qu'il upsertait au passage sont écrits en fin de fonction de toute façon.
    rows, cur = [], since
    while cur <= today:
        end = min(cur + timedelta(days=_CHUNK - 1), today)
        chunk, err = fetch_campaign_insights(access, customer_id, cur, end)
        if not err:
            rows += chunk
        cur = end + timedelta(days=1)
    if rows:
        upsert_google_ads(sb, uid, rows)
    if smap:
        upsert_google_campaign_statuses(sb, uid, smap)
    return f"google: {len(rows)} lignes"


# ── Instagram organique (token utilisateur) ───────────────────────────────────

def _fetch_instagram(sb, uid, token, biz_id, note=_rien) -> str:
    org = OrganicInstagramm(meta_long_token=token, supabase_client=sb,
                            supabase_user_id=uid, instagram_business_id=biz_id)
    # Instagram est le SEUL canal qui peut chiffrer honnêtement son avancement :
    # la liste des posts à relire est arrêtée avant d'entrer dans la boucle, donc
    # « posts 12/37 » est un compte réel, pas une estimation.
    org.fetch_headless(note=note)
    note("écriture")
    if org.new_results:
        insert_instagram_org(supabase=sb, results=org.new_results)
    return f"insta: {len(org.new_results)} nouveaux posts"


# ── Orchestration ─────────────────────────────────────────────────────────────

def _fil(taches: list, suivi: Suivi) -> list[tuple[str, str]]:
    """Un fil d'exécution : ses canaux joués EN SÉRIE, avec son PROPRE client.

    `taches` : [(canal, appel)] où `appel(sb, note) -> str` rend le mot de la fin.
    Retour   : [(canal, mot)] — jamais d'exception, quoi qu'il arrive dedans.

    Le client Supabase est créé ICI, dans le fil, et pas partagé : voir la note
    « LA RÉCOLTE EN PARALLÈLE » en tête de fichier, point ①.
    """
    try:
        sb_fil = _service_client()
    except Exception as e:
        # Sans client, ce fil ne peut RIEN faire — pas même écrire son propre
        # état, puisque l'écrire demanderait justement un client. Les lignes de
        # suivi restent donc à « attente » ; l'écran les lira comme
        # interrompues, ce qu'elles sont. Le journal, lui, dit pourquoi.
        return [(canal, f"{canal} KO: client Supabase indisponible "
                        f"({type(e).__name__}: {e})") for canal, _ in taches]

    sorties: list[tuple[str, str]] = []
    for canal, appel in taches:
        suivi.commence(sb_fil, canal)
        try:
            mot = appel(sb_fil, lambda etape, c=canal: suivi.note(sb_fil, c, etape))
            sorties.append((canal, mot))
            suivi.termine(sb_fil, canal, "fini", mot)
        except Exception as e:
            # Le canal tombe, les deux autres fils continuent. C'est tout
            # l'intérêt d'attraper ici plutôt qu'autour de l'executor.
            mot = f"{canal} KO: {e}"
            sorties.append((canal, mot))
            suivi.termine(sb_fil, canal, "echec", mot)
    return sorties


def run(force: bool = False, only_user: str | None = None,
        label_only: bool = False, categorize_only: bool = False,
        report_only: bool = False) -> None:
    sb = _service_client()
    profiles = (sb.table("profiles")
                .select("id, fetch_schedule")
                .execute().data) or []
    if only_user:
        # Bouton « Mes données » de Pulse : un seul user, sans attendre son jour
        profiles = [p for p in profiles if p["id"] == only_user]
        force = True
    _mode = (" · labels seulement" if label_only
             else " · catégories seulement" if categorize_only
             else " · rapport seulement" if report_only else "")
    print(f"[{datetime.utcnow():%Y-%m-%d %H:%M} UTC] {len(profiles)} profils{_mode}")

    # Sans ces secrets, le refresh du token Google echoue et TOUT Google Ads +
    # GA4 est saute en silence. On le dit fort une fois, en tete de run.
    if not (label_only or categorize_only or report_only):
        _needed = {
            "GOOGLE_ADS_CLIENT_ID": "google_ads.client_id",
            "GOOGLE_ADS_CLIENT_SECRET": "google_ads.client_secret",
            "GOOGLE_ADS_DEVELOPER_TOKEN": "google_ads.developer_token",
        }
        _missing = []
        for _env, _path in _needed.items():
            try:
                _val = os.getenv(_env) or secret(_path)
            except Exception:
                _val = None
            if not _val:
                _missing.append(_env)
        if _missing:
            print("!! ATTENTION - secrets Google absents : " + ", ".join(_missing)
                  + " -> Google Ads et GA4 ne seront PAS mis a jour "
                    "(a ajouter dans les secrets GitHub du repo).")

    for p in profiles:
        uid = p["id"]
        if not force and not _due_today(p.get("fetch_schedule")):
            continue
        logs = []

        # Bouton « ↻ Recharger mes conseils » : republie juste le rapport à partir
        # des données déjà en base (ni fetch réseau, ni relabel) — ~30 s.
        if report_only:
            try:
                from saas.worker.build_report import publish_weekly_report
                logs.append(publish_weekly_report(sb, uid))
            except Exception as e:
                logs.append(f"rapport KO: {e}")
            print(f"  {uid} → " + " | ".join(logs))
            continue

        # Bouton « ✨ Classer mes contenus » : labellisation IA + republication du
        # rapport, sans re-fetch réseau (~1 min au lieu de 2-3).
        if label_only:
            try:
                from saas.worker.labeling import auto_label
                logs.append(auto_label(sb, uid))
            except Exception as e:
                logs.append(f"labels KO: {e}")
            try:
                from saas.worker.build_report import publish_weekly_report
                logs.append(publish_weekly_report(sb, uid))
            except Exception as e:
                logs.append(f"rapport KO: {e}")
            print(f"  {uid} → " + " | ".join(logs))
            continue

        # Bouton « ✨ Classer mes conversions » (page /conversions) : classement
        # IA des événements GA4 sans catégorie, sans re-fetch réseau. Ne republie
        # PAS le rapport : une catégorie de conversion n'influence aucun conseil
        # ni aucun chiffre du rapport, contrairement à un thème (label_only,
        # ci-dessus, republie parce que le thème EST ce que le rapport lit).
        if categorize_only:
            try:
                from saas.worker.categorizing import auto_categorize
                logs.append(auto_categorize(sb, uid))
            except Exception as e:
                logs.append(f"categories KO: {e}")
            print(f"  {uid} → " + " | ".join(logs))
            continue

        # Toutes les connexions de l'utilisateur (Meta + Google) vivent dans
        # connected_accounts. provider='google' porte les tokens Google (Ads + GA4).
        try:
            accts = sb.table("connected_accounts").select(
                "provider, meta_token, instagram_business_id, "
                "google_refresh_token, google_customer_id, ga4_property_id"
            ).eq("user_id", uid).execute().data or []
        except Exception:
            accts = []

        suivi = Suivi(uid)
        # LE JOURNAL PORTE SON CANAL, il ne se devine pas. Les lignes
        # s'ajoutaient dans l'ordre d'exécution ; en parallèle, cet ordre est
        # celui des latences réseau et ne veut plus rien dire. Chaque ligne est
        # donc rangée avec son canal, et `journal` est trié dans l'ordre de
        # `CANAUX` juste avant l'impression — le même ordre que le panneau, de
        # sorte que deux récoltes se comparent ligne à ligne.
        journal: list[tuple[int, str]] = []
        _rang = {c: i for i, c in enumerate(CANAUX)}

        # ── QUI TOURNE, ET DANS QUEL FIL ────────────────────────────────────
        # On construit d'abord le plan, on l'exécute ensuite. Séparer les deux
        # est ce qui permet d'annoncer à l'écran les canaux « en attente » AVANT
        # que le premier appel réseau ne parte.
        fil_meta: list[tuple[str, object]] = []   # même jeton, même API → en série
        fil_google: list[tuple[str, object]] = []
        fil_ga4: list[tuple[str, object]] = []
        # Les canaux volontairement NON appelés, avec leur raison. Ils vont dans
        # `fetch_progress` pour que le panneau montre les six lignes, jamais un
        # trou — mais seul GA4 en parle dans le journal, comme avant.
        non_appeles: list[tuple[str, str]] = []

        # Meta Ads + Instagram (token utilisateur) — la ligne google n'a pas de meta_token.
        # S'il y avait plusieurs comptes Meta, leurs tâches s'empileraient dans
        # le même fil et se partageraient une seule ligne de suivi par canal ; le
        # journal, lui, garderait les deux lignes.
        _meta_vu = False
        for a in accts:
            token = a.get("meta_token")
            if not token:
                continue
            _meta_vu = True
            fil_meta.append(("meta",
                             lambda sb_f, note, t=token: _fetch_meta(sb_f, uid, t, note=note)))
            biz = a.get("instagram_business_id")
            if biz:
                fil_meta.append(("instagram",
                                 lambda sb_f, note, t=token, b=biz:
                                 _fetch_instagram(sb_f, uid, t, b, note=note)))
            else:
                non_appeles.append(("instagram",
                                    "aucun compte Instagram Business lié — colonne vide "
                                    "dans connected_accounts : instagram_business_id"))
        if not _meta_vu:
            non_appeles.append(("meta", "aucune connexion Meta sur ce compte "
                                        "→ Comptes → Connexions"))
            non_appeles.append(("instagram", "aucune connexion Meta sur ce compte "
                                             "→ Comptes → Connexions"))

        # Connexion Google (provider='google') → Ads + GA4 partagent le token,
        # mais ni l'API ni le quota : ils peuvent tourner dans deux fils.
        g = next((a for a in accts if a.get("provider") == "google"), {})

        if g.get("google_refresh_token") and g.get("google_customer_id"):
            fil_google.append(("google",
                               lambda sb_f, note, r=g["google_refresh_token"],
                               c=g["google_customer_id"]:
                               _fetch_google(sb_f, uid, r, c, note=note)))
        else:
            non_appeles.append(("google", "aucune connexion Google Ads sur ce compte "
                                          "→ Comptes → Connexions"))

        # GA4 (run_ga4_fetch est déjà headless)
        #
        # LE SAUT SE JOURNALISE — c'était tout l'objet de la branche `else`. Le
        # `logs.append` a vécu À L'INTÉRIEUR du `if` : quand l'une des deux
        # conditions manquait, GA4 n'était pas appelé ET rien n'était écrit. La
        # récolte annonçait « terminé », et personne ne pouvait savoir que GA4
        # n'avait jamais été demandé. On nomme la COLONNE qui manque, jamais son
        # contenu — un refresh_token ne s'écrit nulle part.
        if g.get("ga4_property_id") and g.get("google_refresh_token"):
            fil_ga4.append(("ga4",
                            lambda sb_f, note, r=g["google_refresh_token"],
                            p=g["ga4_property_id"]:
                            "ga4: " + str(run_ga4_fetch(
                                sb_f, uid, refresh_token=r,
                                property_id=p).get("message", ""))))
        elif not g:
            _mot_ga4 = ("ga4 SAUTÉ : aucune connexion Google sur ce compte "
                        "(aucune ligne connected_accounts avec provider='google') "
                        "→ Comptes → Connexions")
            non_appeles.append(("ga4", _mot_ga4))
            journal.append((_rang["ga4"], _mot_ga4))
        else:
            _absents = [c for c in ("ga4_property_id", "google_refresh_token")
                        if not g.get(c)]
            _quoi = {
                "ga4_property_id": "aucune propriété GA4 choisie",
                "google_refresh_token": "aucun jeton Google (reconnexion à faire)",
            }
            _mot_ga4 = ("ga4 SAUTÉ : " + " et ".join(_quoi[c] for c in _absents)
                        + " — colonne(s) vide(s) dans connected_accounts : "
                        + ", ".join(_absents))
            non_appeles.append(("ga4", _mot_ga4))
            journal.append((_rang["ga4"], _mot_ga4))

        # CE QUI DÉCLENCHE LA SUITE, ET POURQUOI CE N'EST PAS `logs`.
        # La labellisation, le rapport et l'email étaient gardés par `if logs:`
        # — c'est-à-dire « quelque chose a été écrit dans le journal ». Ça
        # marchait tant que le journal ne contenait QUE des récoltes. Depuis
        # qu'un saut de GA4 s'y journalise, `logs` n'est plus jamais vide : un
        # compte sans aucune connexion déclencherait un rapport et un email sur
        # zéro donnée. `a_tente` dit ce que `logs` disait vraiment : au moins une
        # plateforme a été appelée.
        fils = [f for f in (fil_meta, fil_google, fil_ga4) if f]
        a_tente = bool(fils)

        # ── L'ANNONCE, PUIS L'EXÉCUTION ─────────────────────────────────────
        # `planifie` pose tous les canaux prévus à « attente » avec un run_id
        # neuf. C'est aussi ce qui EFFACE un « en cours » laissé par un worker
        # mort au passage précédent : l'écran n'a jamais à deviner l'âge d'une
        # ligne, il ne lit que le run_id le plus récent.
        # DÉDOUBLONNÉ, et ce n'est pas de la coquetterie : `planifie` envoie un
        # upsert unique, et Postgres refuse un `ON CONFLICT DO UPDATE` qui
        # toucherait deux fois la même ligne. Deux comptes Meta sur un même
        # utilisateur feraient donc échouer TOUTE l'annonce. `dict.fromkeys`
        # dédoublonne en gardant l'ordre.
        prevus = list(dict.fromkeys(c for f in fils for c, _ in f))
        if a_tente:
            prevus += ["labels", "rapport"]
        suivi.planifie(sb, prevus)
        for canal, pourquoi in non_appeles:
            suivi.saute(sb, canal, pourquoi)

        if fils:
            # `map` rend les résultats DANS L'ORDRE DES FILS, pas dans l'ordre où
            # ils finissent — mais chaque ligne porte son canal, donc l'ordre du
            # journal ne dépend pas de celui-là.
            with ThreadPoolExecutor(max_workers=min(_FILS_MAX, len(fils))) as ex:
                for sorties in ex.map(lambda f: _fil(f, suivi), fils):
                    journal += [(_rang.get(canal, len(CANAUX)), mot)
                                for canal, mot in sorties]

        # Labellisation IA des nouveaux contenus (posts + campagnes sans thème).
        # Best-effort : jamais bloquant, ne touche jamais un label posé à la main.
        # Séquentiel et sur le client principal : il lit ce que les trois fils
        # viennent d'écrire, il ne peut donc pas partir avant leur jointure.
        if a_tente:
            suivi.commence(sb, "labels")
            try:
                from saas.worker.labeling import auto_label
                _mot = auto_label(sb, uid)
                journal.append((_rang["labels"], _mot))
                suivi.termine(sb, "labels", "fini", _mot)
            except Exception as e:
                _mot = f"labels KO: {e}"
                journal.append((_rang["labels"], _mot))
                suivi.termine(sb, "labels", "echec", _mot)

        # Rapport hebdo précalculé → weekly_reports (lu par Pulse) + email hebdo.
        # Données fraîches du jour → le rapport publié est à jour lui aussi.
        # L'email part le jour de fetch de l'utilisateur (défaut lundi) ; sans
        # RESEND_API_KEY, send_email passe en dry-run (aucun envoi).
        if a_tente:
            suivi.commence(sb, "rapport")
            try:
                from saas.worker.build_report import publish_weekly_report
                email_to = None
                try:
                    email_to = sb.auth.admin.get_user_by_id(uid).user.email
                except Exception:
                    pass
                _mot = publish_weekly_report(sb, uid, email_to=email_to)
                journal.append((_rang["rapport"], _mot))
                suivi.termine(sb, "rapport", "fini", _mot)
            except Exception as e:
                _mot = f"rapport KO: {e}"
                journal.append((_rang["rapport"], _mot))
                suivi.termine(sb, "rapport", "echec", _mot)

        # Tri STABLE sur le seul rang : deux lignes d'un même canal gardent
        # l'ordre où elles ont été produites.
        journal.sort(key=lambda r: r[0])
        logs += [mot for _, mot in journal]
        suivi.bilan()

        if logs:
            print(f"  {uid} → " + " | ".join(logs))

    print("Terminé.")


if __name__ == "__main__":
    force = "--force" in sys.argv  # ignore le jour planifié (utile pour tester)
    only_user = None
    if "--user" in sys.argv:       # un seul utilisateur (bouton Pulse), force implicite
        only_user = sys.argv[sys.argv.index("--user") + 1]
    label_only = False
    if "--label-only" in sys.argv:  # labellisation IA + republication, sans fetch
        only_user = sys.argv[sys.argv.index("--label-only") + 1]
        label_only = True
    categorize_only = False
    if "--categorize-only" in sys.argv:  # catégorisation IA des conversions GA4, sans fetch
        only_user = sys.argv[sys.argv.index("--categorize-only") + 1]
        categorize_only = True
    report_only = False
    if "--report-only" in sys.argv:  # republie juste le rapport (conseils), ~30 s
        only_user = sys.argv[sys.argv.index("--report-only") + 1]
        report_only = True
    try:
        run(force=force, only_user=only_user, label_only=label_only,
            categorize_only=categorize_only, report_only=report_only)
    except Exception:
        traceback.print_exc()
        sys.exit(1)
