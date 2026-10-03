"""Worker de fetch automatique — récolte les données SANS personne connecté.

Branché sur un cron (GitHub Actions), tourne chaque jour : pour chaque utilisateur
dont c'est le jour de mise à jour, récupère Meta Ads + Google Ads + GA4 + Instagram
et écrit dans le même Supabase que l'app. C'est le « ça marche sans moi ».

Réutilise la logique de fetch existante (rendue headless) :
  - Meta Ads / Instagram : token utilisateur (connected_accounts.meta_token)
  - Google Ads / GA4      : refresh_token Google + secrets app (via commun.app_secrets)

Variables d'env requises :
  SUPABASE_URL            (sinon lu dans secrets.toml [supabase].url)
  SUPABASE_SERVICE_KEY    (clé service_role — bypass RLS pour lire tous les users)
  GOOGLE_ADS_*            (client_id, client_secret, developer_token) pour Google
"""

from __future__ import annotations
import os
import re
import sys
import json
import threading
import traceback
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta
from pathlib import Path

import requests

# Racine du projet sur le path (pour importer saas/ (collecte/, traitement/) depuis la racine du dépôt)
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from supabase import create_client                                        # noqa: E402
from saas.commun.app_secrets import secret                                    # noqa: E402
from saas.commun.fetch_data import (                                          # noqa: E402
    fetch_meta_ads_latest_date, fetch_google_ads_latest_date,
    fetch_google_ads_ad_insights_latest_date,
)
from saas.commun.insert_data import (                                         # noqa: E402
    upsert_meta_ads, upsert_campaign_statuses,
    upsert_google_ads, upsert_google_ads_ad_insights, upsert_google_campaign_statuses,
    insert_instagram_org, upsert_platform_budgets, upsert_platform_changes,
)
from saas.collecte.commun.fetch_token import get_access_token_from_refresh        # noqa: E402
from saas.collecte.google.fetch_google_ads import (                               # noqa: E402
    fetch_campaign_insights, fetch_ad_insights, fetch_campaign_statuses,
    fetch_campaign_budgets as google_budgets,
    fetch_campaign_changes as google_changes,
)
from saas.collecte.meta.fetch_meta_ads import (                                   # noqa: E402
    fetch_campaign_budgets as meta_budgets,
    fetch_activities as meta_changes,
    lignes_meta_ads,
)
from saas.collecte.automatisation.suivi import Suivi, CANAUX                                # noqa: E402

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
# ② LES CHIFFRES QUE LA RÉGIE RÉVISE APRÈS COUP. Un jour déjà en base
#    continue de bouger pendant des jours après sa première lecture — chaque
#    régie pour ses raisons, dites plus bas. Repartir à `latest + 1` le fige
#    sur sa version la plus jeune, c'est-à-dire la plus fausse.
#
# POURQUOI ON RÉÉCRIT AU LIEU DE COMPARER — c'est contre-intuitif, et
# quelqu'un voudra le « corriger » un jour, alors autant l'écrire ici : on ne
# compare RIEN avec la plateforme, on redemande la plage et on la réécrit.
# Les trois tables portent une clé d'unicité — meta_ads_insights
# (user_id, date_start, ad_id), google_ads_insights (user_id, date_start,
# campaign_id), instagram_organic_posts (user_id, post_id) — et les écritures
# sont des upserts sur ces clés exactes. Réécrire un jour connu REMPLACE donc
# la ligne, il n'en ajoute pas une. Une comparaison ligne à ligne coûterait de
# relire toute la base, de faire un diff, et se tromperait le jour où un champ
# change de forme ; la réécriture ne peut pas se tromper, et elle se répare
# toute seule : une récolte ratée est rattrapée par la suivante sans que
# personne ait à le savoir.
#
# Meta — 28 jours, la borne que Meta documente : « Insights refresh every 15
# minutes and do not change after 28 days of being reported ». En deçà, un jour
# connu peut encore changer chez Meta ; au-delà, plus rien ne bouge, et le relire
# ne sert à rien. 7 laissait 21 jours où Meta corrigeait sans que personne
# relise — la soustraction de deux nombres de la doc, pas une hypothèse.
# Les actions — donc `results`, la colonne « Résultats » — ont une raison
# connue de bouger : depuis le 10 juin 2025 l'API suit le réglage
# d'attribution de chaque ad set et rapporte en `action_report_time=mixed` :
# une action sur Meta (un clic sur le lien) se
# pose au jour de l'IMPRESSION, donc jusqu'à la fenêtre de l'ad set en arrière ;
# une action hors Meta (un achat pixel) au jour de la CONVERSION. La doc ne dit
# pas quelle part des corrections survient après le 7e jour : 28 se justifie
# par la borne, pas par une mesure.
# https://developers.facebook.com/docs/marketing-api/insights/best-practices/
# Sources lues et citées : .scratch/meta-ads/recherche/champs-api-meta.md §3.
_RECOUVREMENT_JOURS_META = 28

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

# CE QUE ÇA COÛTE — compté, pas supposé. Les deux boucles découpent déjà la
# plage en tranches de 90 jours (`_CHUNK`), et un recouvrement de 28 ou 30 jours
# tient dans la tranche que la récolte demandait de toute façon : ZÉRO tranche
# supplémentaire sur un passage de routine. Ce qui grossit, ce sont les lignes
# rendues puis réécrites. Sur une récolte hebdomadaire :
#  · Google, 10 campagnes actives — on passe de 7 à 37 jours, soit ~370 lignes
#    au lieu de ~70, dans le même et unique searchStream ;
#  · Meta, 20 pubs actives — on passe de 7 à 35 jours, soit ~700 lignes au
#    lieu de ~140 : DEUX pages de `limit=500` au lieu d'une, donc une requête
#    de pagination de plus par passage.
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


# Meta : « the start date of the time range cannot be beyond 37 months from the
# current date ». 1 126 jours, et pas `37 * 30` : trente-sept mois de 30 jours
# font 1 110 jours, soit 36,5 mois — on refuserait des dates que l'API accepte,
# en affichant « dépasse les 37 mois ». Le chiffre est celui de la note
# PROFONDEUR D'HISTORIQUE juste en dessous.
_PROFONDEUR_META_JOURS = 1126


def _date_forcee(valeur: str, today: date) -> date:
    """La date de départ imposée à la main, validée AVANT le premier appel.

    Elle existe pour rejouer un historique — typiquement après le passage à
    `ad_id`, où les lignes anciennes n'en portent pas. Le rejeu se fait par
    cette date, JAMAIS par un DELETE : `upsert_meta_ads` efface les lignes
    `ad_id IS NULL` des seules dates qu'il réécrit, donc la table n'est jamais
    vide et une récolte interrompue ne laisse aucune fenêtre sans donnée.

    Les deux bornes sont vérifiées ici plutôt que subies plus loin, parce que
    `_meta_chunk` avale ses erreurs et rend une liste vide : une date refusée
    par Meta ne se lirait pas comme un refus, elle se lirait comme « ce compte
    n'a rien dépensé ».
    """
    try:
        jour = date.fromisoformat(valeur)
    except ValueError:
        raise ValueError(f"--meta-since : date illisible « {valeur} », attendu AAAA-MM-JJ.")
    if jour > today:
        raise ValueError(f"--meta-since : {jour} est dans le futur, rien à récolter.")
    plancher = today - timedelta(days=_PROFONDEUR_META_JOURS)
    if jour < plancher:
        raise ValueError(
            f"--meta-since : {jour} dépasse les 37 mois que l'API Meta accepte "
            f"(pas avant {plancher}).")
    return jour


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
from saas.collecte.ga4.ga4 import run_ga4_fetch                                    # noqa: E402
from saas.collecte.meta.fetch_instagram import OrganicInstagramm                  # noqa: E402

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

_JETON_DANS_UNE_URL = re.compile(
    r"((?:access_token|appsecret_proof|refresh_token|token)=)[^&\s)\"']*", re.I)


def _sans_jeton(message: str) -> str:
    """Un message d'erreur nomme la variable, jamais sa valeur — `CLAUDE.md` §7.

    CE N'EST PAS UNE PRÉCAUTION THÉORIQUE. `requests` construit l'URL complète
    avant de se connecter et la RECOPIE dans l'exception :

        ConnectionError : HTTPSConnectionPool(host='graph.facebook.com', …):
        Max retries exceeded with url: /v24.0/act_42/campaigns?access_token=EAA…

    Et le curseur `paging.next` de Meta porte le jeton par construction. Sans
    ce filtre, une coupure réseau pendant une récolte écrit le jeton Meta d'un
    client EN CLAIR dans le journal de run de GitHub Actions, qui est public.
    """
    return _JETON_DANS_UNE_URL.sub(r"\1…", message)


def _meta_chunk(token, ad_account_id, since_iso, until_iso) -> tuple[list, str | None]:
    params = {
        "access_token": token, "level": "ad",
        # `ad_id` porte l'identité de l'annonce ; `ad_name` n'est qu'une
        # étiquette que l'annonceur peut réutiliser à volonté. Sans lui, deux
        # annonces homonymes se confondent et la dépense de la seconde n'entre
        # jamais en base (voir `upsert_meta_ads` et la section ad_id de
        # 000_run_me_all.sql). Même raison pour `campaign_id` et `adset_id` :
        # une campagne renommée reste une campagne
        # (`.scratch/meta-ads/spec.md`, « L'identité par ID »). `results` est
        # la colonne « Résultats » d'Ads Manager, et `attribution_setting` dit
        # selon quel réglage elle est comptée
        # (`.scratch/meta-ads/recherche/colonne-resultats.md`). Champs de la
        # même requête : zéro appel de plus.
        "fields": "campaign_name,campaign_id,adset_name,adset_id,ad_name,ad_id,"
                  "impressions,clicks,reach,spend,actions,results,"
                  "attribution_setting,date_start",
        "time_increment": 1,
        "time_range": json.dumps({"since": since_iso, "until": until_iso}),
        "limit": 500,
    }
    # LA TRANCHE DIT SI ELLE EST COMPLÈTE — elle ne rend plus une liste vide
    # pour « échec » ET pour « ce compte n'a rien dépensé ». Les deux se
    # confondaient, et le rejeu d'historique rend la confusion coûteuse : une
    # limite de débit Meta au milieu d'un rejeu de treize tranches en perdait
    # quatre-vingt-dix jours, sans un mot, sur une run verte.
    # Retour : (lignes, erreur) — `erreur` à None quand la tranche est entière.
    try:
        data = requests.get(f"{_GRAPH}/{ad_account_id}/insights", params=params, timeout=60).json()
    except Exception as e:
        return [], _sans_jeton(f"{since_iso}→{until_iso} : {type(e).__name__}: {e}")
    if isinstance(data, dict) and data.get("error"):
        # Meta répond 200 avec un objet `error` : le message porte la cause
        # (limite de débit, jeton expiré). On ne montre jamais les params —
        # ils portent le jeton.
        return [], f"{since_iso}→{until_iso} : {data['error'].get('message', 'erreur Meta')}"
    rows = data.get("data", [])
    nxt = data.get("paging", {}).get("next")
    while nxt:
        try:
            resp = requests.get(nxt, timeout=60).json()
        except Exception as e:
            # Une pagination interrompue rend une tranche TRONQUÉE, pas vide :
            # c'est le cas le plus traître, il faut le dire aussi.
            return rows, _sans_jeton(
                f"{since_iso}→{until_iso} : pagination interrompue ({type(e).__name__}: {e})")
        rows += resp.get("data", [])
        nxt = resp.get("paging", {}).get("next")
    return rows, None


_CAMPAGNES_PAR_PAGE = 200
_CAMPAGNES_PAGES_MAX = 50


def _meta_campagnes(token, ad_account_id) -> tuple[list, str | None]:
    """Les campagnes DÉCLARÉES du compte — toutes, `paging.next` suivi au bout.

    Une seule page valait 200 campagnes et le curseur était ignoré : au-delà,
    la liste était tronquée SANS UN MOT, et la 201e campagne recevait le même
    `UNKNOWN` qu'une campagne dont Meta ignore vraiment le statut. C'est le
    piège de `CLAUDE.md` §8 sur PostgREST (« au-delà, il tronque en silence »)
    sur une autre API — et il ne se voyait nulle part, parce qu'une liste
    courte a exactement la forme d'un petit compte.

    Retour : (campagnes, erreur) — `erreur` à None quand la liste est ENTIÈRE.
    Même contrat que `_meta_chunk`, et pour la même raison : sans lui, « ce
    compte n'a que 200 campagnes » et « on s'est arrêté à 200 » se confondent.

    Cette liste ne porte aucune dépense : son échec ne doit jamais coûter la
    semaine d'insights. Elle rend donc son erreur à l'appelant plutôt que de
    lever.
    """
    params = {
        "access_token": token,
        "fields": "name,effective_status,start_time,stop_time",
        "limit": _CAMPAGNES_PAR_PAGE,
    }
    try:
        data = requests.get(f"{_GRAPH}/{ad_account_id}/campaigns",
                            params=params, timeout=30).json()
    except Exception as e:
        return [], _sans_jeton(f"{type(e).__name__}: {e}")
    if not isinstance(data, dict):
        # Un proxy ou une page d'erreur peut rendre du JSON parfaitement valide
        # qui n'est pas un objet. `data.get` lèverait alors un AttributeError
        # au travers d'une fonction qui a promis de ne pas lever — et le canal
        # Meta tomberait tout entier pour une liste de campagnes.
        return [], f"réponse Meta inattendue ({type(data).__name__})"
    if data.get("error"):
        # Meta répond 200 avec un objet `error`. On ne montre jamais les
        # params — ils portent le jeton.
        return [], data["error"].get("message", "erreur Meta")
    campagnes = data.get("data", []) or []
    nxt = (data.get("paging") or {}).get("next")
    # LE PLAFOND N'EST PAS UNE LIMITE DE PRODUIT, C'EST UN COUPE-CIRCUIT. Meta
    # sait rendre une page VIDE qui porte encore un `paging.next` ; le curseur
    # tourne alors en rond, à 30 s par requête, et le worker de ce client
    # n'arrive jamais au bout — sans une ligne de journal. Cinquante pages,
    # c'est dix mille campagnes : aucun compte Pulse n'en approche, et le jour
    # où l'un s'en approcherait, il le lirait dans le journal au lieu de
    # découvrir une run qui ne finit pas.
    pages_restantes = _CAMPAGNES_PAGES_MAX
    while nxt and pages_restantes:
        pages_restantes -= 1
        # Le curseur `next` est une URL COMPLÈTE, jeton compris : repasser
        # `params` dessus écraserait la position et relirait la page 1 sans
        # fin.
        try:
            page = requests.get(nxt, timeout=30).json()
        except Exception as e:
            return campagnes, _sans_jeton(
                f"liste tronquée à {len(campagnes)} campagne(s) "
                f"({type(e).__name__}: {e})")
        if not isinstance(page, dict):
            return campagnes, (f"liste tronquée à {len(campagnes)} campagne(s) : "
                               f"réponse Meta inattendue ({type(page).__name__})")
        if page.get("error"):
            return campagnes, (f"liste tronquée à {len(campagnes)} campagne(s) : "
                               f"{page['error'].get('message', 'erreur Meta')}")
        campagnes += page.get("data", []) or []
        nxt = (page.get("paging") or {}).get("next")
    if nxt:
        return campagnes, (f"liste tronquée à {len(campagnes)} campagne(s) : "
                           f"{_CAMPAGNES_PAGES_MAX} pages suivies sans fin de "
                           f"curseur")
    return campagnes, None


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
            print(f"    budgets {canal} ignorés : {_sans_jeton(str(err))}")
    except Exception as e:
        print(f"    budgets {canal} KO : {_sans_jeton(str(e))}")


def _journal_changements(sb, uid, canal: str, recolte) -> None:
    """Le journal des changements déclarés. Best-effort, JAMAIS bloquant —
    même raison que `_photo_budget` : le fil se passe d'une ligne, pas la
    récolte d'une semaine d'insights."""
    try:
        rows, err = recolte()
        if rows:
            upsert_platform_changes(sb, uid, canal, rows)
        elif err:
            print(f"    changements {canal} ignorés : {_sans_jeton(str(err))}")
    except Exception as e:
        print(f"    changements {canal} KO : {_sans_jeton(str(e))}")


def _rien(_etape: str) -> None:
    """Le rapporteur d'étapes par défaut : celui qui ne rapporte à personne.

    Il existe pour que ces fonctions restent appelables hors du worker (essai à
    la main, ancien Streamlit) sans traîner un objet de suivi."""
    return None


# UNE RUN VERTE SANS META EST PIRE QU'UNE RUN ROUGE. Si la colonne `ad_id`
# manque — SQL pas encore joué, code neuf déjà déployé — la récolte Meta ne
# peut pas écrire. Laisser la run finir au vert, c'est une semaine de dépense
# publicitaire absente que personne ne voit passer, et que le rapport de la
# semaine suivante lirait comme une BAISSE : un faux verdict, pas un trou
# visible.
#
# CE QUE CET ENSEMBLE NE FAIT PLUS : retenir la publication. Depuis le
# ticket 20, un trou de récolte ne fait plus taire le rapport entier — il fait
# taire les mesures qui le traversent, et le rapport NOMME le canal muet
# (`build_payload`, clé `canaux_muets`). Retenir ne couvrait qu'une cause sur
# cinq et privait le client du seul message capable de lui dire de reconnecter.
#
# CE QU'IL FAIT ENCORE, ET QUI RESTE UTILE : finir la run en ROUGE. C'est le
# seul signal qui dise à David qu'une migration attend — le client, lui, voit
# déjà le trou dans son rapport. Les fils
# Meta de plusieurs utilisateurs n'écrivent jamais en même temps (les profils
# se suivent en série), mais l'ensemble est quand même verrouillé — il coûte
# trois lignes et se relit sans avoir à vérifier cette hypothèse.
_ECRITURES_SAUTEES: set[str] = set()
_VERROU_SAUTEES = threading.Lock()


def _note_ecriture_sautee(uid: str) -> None:
    with _VERROU_SAUTEES:
        _ECRITURES_SAUTEES.add(uid)


# LES PANNES QUI DURENT (ticket 47). Un canal muet UNE semaine est une note dans
# le rapport, et ça suffit : le prochain passage réussi réécrit la semaine
# trouée (ADR 0005). À la DEUXIÈME, le client a reçu deux fois la même absence
# poliment formulée, la run est restée verte, et personne n'a vu le compte
# dériver. On aurait remplacé un chiffre faux par un message que personne n'agit.
#
# L'ESCALADE CHANGE DE DESTINATAIRE, PAS DE VOLUME. Le client a DÉJÀ été
# prévenu — bandeau ambre en tête du rapport, objet d'email réécrit, lien vers
# la reconnexion. Lui renvoyer un email dédié répéterait la même phrase dans une
# autre enveloppe : aucune information nouvelle, donc aucune décision nouvelle.
# Ce rouge-ci s'adresse à David, le seul qui puisse décrocher son téléphone.
#
# LE TUYAU EST CELUI QUI EXISTE DÉJÀ : GitHub envoie un email au propriétaire du
# dépôt quand un workflow échoue. Construire un webhook ou une page de statut
# pour une poignée de comptes serait de l'outillage d'exploitation avant d'avoir
# la preuve qu'on en a besoin. Tranché avec `vision-produit` le 2026-09-20.
#
# `report_only` LE REMPLIT AUSSI, et c'est voulu : c'est le mode par lequel on
# republie un rapport à la main, donc celui par lequel on vérifie. Taire le
# signal exactement là où on vient le chercher serait le rendre invisible au
# seul moment où on le regarde.
#
# Rempli dans la boucle des profils, qui se suivent en SÉRIE — pas de verrou,
# contrairement à `_ECRITURES_SAUTEES`, que les fils Meta touchent.
_CANAUX_QUI_DURENT: list[tuple[str, dict]] = []


def _note_canaux_qui_durent(uid: str, canaux_muets: list[dict]) -> None:
    """Retient les canaux muets depuis au moins `SEUIL_ESCALADE` rapports.

    ON NE FILTRE PAS SUR `chiffres_tus`, et c'est la seule asymétrie voulue
    entre les deux destinataires. Le client ne voit que les canaux qui lui
    cachent quelque chose — alarmer sur un canal qui ne tait rien userait
    l'alarme. David, lui, les voit tous : un Google Ads mort depuis cinq
    semaines sur un compte 100 % organique ne cache rien AUJOURD'HUI et cassera
    tout le jour où ce client lancera sa première campagne.
    """
    from saas.traitement.build_report import SEUIL_ESCALADE
    _CANAUX_QUI_DURENT.extend(
        (uid, c) for c in (canaux_muets or [])
        if (c.get("semaines_muettes") or 0) >= SEUIL_ESCALADE)


def vu_par_le_client(canal: dict) -> bool:
    """Ce canal a-t-il été dit au client, dans son rapport et dans son email ?

    C'EST LE REVERS DE L'ASYMÉTRIE CI-DESSUS, et il ne va pas de soi. Les deux
    surfaces client (`canal-muet.tsx`, `emailing/render.py`) ne montrent que les
    canaux à `chiffres_tus` vrai ; David, lui, les voit tous. Donc pour la moitié
    exacte des cas que cette escalade existe pour attraper — le canal qui ne tait
    rien aujourd'hui — le client n'a RIEN reçu.

    Sans cette distinction, la run imprimerait « le client a déjà été prévenu »
    sur un canal dont il n'a jamais entendu parler : David en conclurait qu'il
    sait, ne l'appellerait pas, et l'escalade aurait acheté l'inverse de ce
    qu'elle promet.
    """
    return bool(canal.get("chiffres_tus"))


# CE QU'EST DEVENU L'EMAIL DE LA SEMAINE D'AVANT (ticket 50). L'escalade
# ci-dessus n'alerte David plutôt que le client qu'au motif que « le client a
# déjà été prévenu » — une phrase que personne ne savait vérifier. Elle se
# vérifie maintenant, à un appel HTTP par compte et par passage.
#
# ET ELLE NE SE VÉRIFIE QU'À MOITIÉ, VOLONTAIREMENT. « Ouvert » et « cliqué »
# et « pas arrivé » sont des faits ; « rien remonté » n'en est pas un — un pixel
# bloqué, une prévisualisation, un suivi non activé chez le fournisseur donnent
# le même silence qu'un email jamais lu. Le vocabulaire de
# `saas/emailing/evenements.py` n'a donc aucune valeur « pas ouvert », et ce
# qu'on a le droit d'en conclure est écrit dans `docs/mesures-impossibles.md`.
#
# CE QU'ON N'EN FAIT PAS : aucun taux d'ouverture, nulle part, et surtout pas
# dans le rapport du client. C'est une mesure d'exploitation — elle sert à
# David pour décider s'il décroche son téléphone, et à rien d'autre.
_OUVERTURES: dict[str, str] = {}

# ON NE RELIT PAS UN EMAIL PARTI IL Y A UNE HEURE, et on ne redemande pas deux
# fois le même jour. Le cas n'est pas théorique — un `--force` relancé le jour
# même repasse sur le compte quelques minutes après l'envoi, et un `report_only`
# lancé à la main peut repasser dix fois dans l'après-midi.
_DELAI_RELEVE_H = 24


def _assez_vieux(iso: str | None, maintenant: datetime) -> bool:
    """Cet horodatage a-t-il au moins `_DELAI_RELEVE_H` ? Absent ou illisible → oui.

    UN HORODATAGE AVEC FUSEAU SE RAMÈNE EN UTC AVANT D'ÊTRE COMPARÉ. Postgres
    rend `timestamptz` avec un décalage (`+02:00`) ou un `Z` ; le comparer tel
    quel à un `utcnow()` naïf lève `TypeError`, que le `try` de
    `_relever_ouverture` avalerait — le relevé ne partirait alors jamais, en
    silence.
    """
    if not iso:
        return True
    try:
        quand = datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
    except ValueError:
        return True
    if quand.tzinfo is not None:
        quand = quand.replace(tzinfo=None) - quand.utcoffset()
    return (maintenant - quand) >= timedelta(hours=_DELAI_RELEVE_H)


def a_relever(envoi: dict | None, maintenant: datetime) -> bool:
    """Faut-il redemander au fournisseur ce qu'est devenu cet envoi ?

    Quatre non, et chacun pour une raison différente :
      · rien à relire — pas de `message_id` (dry-run, envoi en échec), ou un
        fournisseur que ce code ne sait pas interroger. Il ne faut surtout pas
        en conclure une non-ouverture ;
      · la réponse est DÉFINITIVE — ouvert, cliqué, signalé, pas arrivé :
        redemander paierait un appel pour la même réponse ;
      · l'envoi est trop récent — voir `_DELAI_RELEVE_H` ;
      · on a déjà demandé il y a moins de `_DELAI_RELEVE_H`.

    ET UN SILENCE N'EST PAS UNE RÉPONSE DÉFINITIVE, c'est ce qui commande tout
    le reste. La plupart des ouvertures arrivent APRÈS le premier jour : figer
    la réponse au premier relevé — comme le faisait la version d'avant, qui
    s'arrêtait dès que `releve_a` était posé — perdrait systématiquement le
    fait qu'on cherche, et d'autant plus sûrement qu'un `report_only` lancé à
    la main 25 h après l'envoi suffisait à le figer pour de bon.
    """
    from saas.emailing.evenements import (ETATS_DEFINITIFS,
                                          FOURNISSEURS_RELISIBLES,
                                          etat_ouverture)
    if not envoi or not envoi.get("message_id"):
        return False
    if (envoi.get("fournisseur") or "") not in FOURNISSEURS_RELISIBLES:
        return False
    if etat_ouverture(envoi.get("dernier_evenement")) in ETATS_DEFINITIFS:
        return False
    return (_assez_vieux(envoi.get("envoye_a"), maintenant)
            and _assez_vieux(envoi.get("releve_a"), maintenant))


def mot_du_releve(envoi: dict, evenement: str | None) -> str:
    """La ligne de journal : de quand datait l'email, et ce qu'il est devenu.

    LA SEMAINE EST NOMMÉE, parce que le relevé porte sur l'email de la semaine
    PRÉCÉDENTE — celui de cette semaine vient à peine de partir. Sans la date,
    la ligne se lirait comme un verdict sur l'email du jour.
    """
    from saas.emailing.evenements import phrase_ouverture
    return f"email du {envoi.get('week_start')} : {phrase_ouverture(evenement)}"


def _relever_ouverture(sb, uid: str, logs: list[str]) -> None:
    """Relit chez le fournisseur l'email de la semaine d'avant, et le range.

    APPELÉ AVANT LA PUBLICATION, et l'ordre porte tout : `fetch_dernier_envoi_email`
    rend la ligne la plus récente, et publier d'abord en écrirait une neuve —
    on relèverait alors l'email de la minute, pas celui de la semaine passée.

    REMPLIT `_OUVERTURES` DÈS QU'ON SAIT, PAS SEULEMENT QUAND ON VIENT
    D'APPRENDRE. Un `report_only` lancé à la main le matin relève la ligne et
    fige `releve_a` ; la récolte qui suit ne redemanderait rien, et la ligne
    rouge perdrait l'ouverture alors qu'elle est en base depuis une heure. Un
    fait déjà rangé se relit, il ne se redemande pas.

    Ne lève jamais. Une mesure d'exploitation ne fait pas tomber une récolte.
    """
    try:
        from saas.commun.fetch_data import fetch_dernier_envoi_email
        from saas.commun.insert_data import maj_evenement_email
        from saas.emailing.evenements import etat_email, phrase_ouverture

        envoi = fetch_dernier_envoi_email(sb, uid)
        if not envoi:
            return
        if a_relever(envoi, datetime.utcnow()):
            lu = etat_email(envoi.get("message_id"))
            # UN APPEL RATÉ NE FIGE RIEN. Écrire ici poserait `releve_a` sur
            # une coupure réseau : la ligne serait marquée « demandée » pour
            # toujours, et une panne de vingt secondes se lirait ensuite comme
            # un client qui n'ouvre pas. On le dit, et on n'en conclut rien.
            if not lu.get("ok"):
                logs.append(f"ouverture non relevée ({envoi.get('week_start')}) : "
                            f"{lu.get('detail')}")
                return
            evenement = lu.get("evenement")
            maj_evenement_email(sb, uid, str(envoi.get("week_start")), evenement)
            logs.append(mot_du_releve(envoi, evenement))
        elif envoi.get("releve_a"):
            # Déjà relevé : réponse définitive, ou relevé de moins de 24 h. On
            # relit ce qui est rangé, sans appel ni ligne de journal — la ligne
            # a déjà été imprimée le jour où le fait est arrivé.
            evenement = envoi.get("dernier_evenement")
        else:
            # Trop récent, dry-run, envoi raté : on ne sait rien, et on se garde
            # de le dire comme si on savait.
            return
        _OUVERTURES[uid] = phrase_ouverture(evenement)
    except Exception as e:
        logs.append(f"relevé d'ouverture KO: {e}")


class SchemaEnRetard(RuntimeError):
    """Le schéma en base est en retard sur le code — colonne absente (42703) ou
    contrainte d'unicité pas encore déplacée (42P10). Rattrapable en jouant la
    migration ; jamais silencieux, parce qu'un silence ici se lit comme une
    baisse de dépense."""


# Les colonnes que `lignes_meta_ads` écrit en plus du socle historique :
# `ad_id` (section ad_id du `000`), puis les quatre du ticket 02
# (`.scratch/meta-ads/tickets/02-le-schema-meta-s-elargit.md`). Une seule
# absente fait refuser l'upsert ENTIER par PostgREST (PGRST204), donc toute la
# dépense Meta de la semaine.
_COLONNES_META_ECRITES = "ad_id,campaign_id,adset_id,attribution_setting,results"


def _colonnes_meta_presentes(sb) -> bool:
    """Les colonnes que la récolte écrit existent-elles dans meta_ads_insights ?

    Un `select` d'une seule ligne suffit : PostgREST refuse la requête entière
    avec le code Postgres `42703` (« undefined_column ») quand UNE des
    colonnes demandées n'existe pas, et rend `data: []` sans erreur quand la
    table est simplement vide. Les deux cas ne se confondent donc pas.

    SEUL 42703 rend False. Un `except Exception` large lirait une coupure
    réseau comme une colonne manquante : on sauterait la récolte Meta d'une
    semaine sur un hoquet, et on la rendrait rouge pour rien. Tout autre échec
    remonte donc tel quel — le fil l'attrape déjà et marque le canal en échec,
    sans prétendre en connaître la cause.
    """
    try:
        sb.table("meta_ads_insights").select(_COLONNES_META_ECRITES).limit(1).execute()
        return True
    except Exception as e:
        if getattr(e, "code", None) == "42703":
            return False
        raise


def _fetch_meta(sb, uid, token, note=_rien, since_forcee: date | None = None) -> str:
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
    # LE GARDE-FOU SE POSE AVANT LA PREMIÈRE REQUÊTE D'INSIGHTS, pas juste
    # avant l'écriture : sans ses colonnes, ces appels ne servent à rien et
    # `upsert_meta_ads` upserterait sur une clé de conflit inexistante. Les
    # budgets et le journal des changements, eux, sont déjà passés — ils ne
    # touchent pas cette table et n'ont pas à être punis.
    if not _colonnes_meta_presentes(sb):
        _note_ecriture_sautee(uid)
        raise SchemaEnRetard(
            f"une colonne de meta_ads_insights manque ({_COLONNES_META_ECRITES}) — "
            "écriture Meta Ads sautée. "
            "Jouer supabase/migrations/000_run_me_all.sql, puis relancer. "
            "La run finit ROUGE exprès : sans ça, cette semaine de dépense manquerait "
            "en silence et le rapport la lirait comme une baisse.")
    if since_forcee:
        # La date imposée REMPLACE le point de reprise, elle ne s'y ajoute pas :
        # inutile d'aller lire la dernière date connue, on repart d'où on a dit.
        since = since_forcee
        print(f"    meta: départ forcé au {since} (rejeu d'historique)")
    else:
        since = _depart_recolte(fetch_meta_ads_latest_date(sb, uid),
                                today, _RECOUVREMENT_JOURS_META)
    # Le raccourci « meta: à jour » a disparu, et pas par distraction : avec un
    # recouvrement il ne pouvait plus se déclencher (`latest - 28` est toujours
    # antérieur à aujourd'hui), et surtout il n'a plus de sens. Il n'y a plus de
    # « à jour » — il y a une fenêtre qu'on relit à chaque passage.
    rows, trous, cur = [], [], since
    while cur <= today:
        end = min(cur + timedelta(days=_CHUNK - 1), today)
        lignes, err = _meta_chunk(token, ad_account_id, cur.isoformat(), end.isoformat())
        rows += lignes
        if err:
            trous.append(err)
        cur = end + timedelta(days=1)
    if trous:
        # UN REJEU INCOMPLET NE S'ÉCRIT PAS. Sur un rejeu, chaque tranche
        # manquante est une période dont les lignes gardent leur `ad_id` à
        # NULL : écrire le reste donnerait une base à moitié réparée qu'aucune
        # trace ne distingue d'une base réparée. On préfère ne rien écrire et
        # redemander le même rejeu.
        # Sur une récolte de ROUTINE, au contraire, on écrit ce qu'on a : la
        # fenêtre de recouvrement de 28 jours redemandera les dates manquées
        # au prochain passage, et refuser d'écrire perdrait aussi les tranches
        # réussies.
        if since_forcee:
            raise RuntimeError(
                f"rejeu depuis {since_forcee} INCOMPLET, rien n'a été écrit — "
                f"{len(trous)} tranche(s) refusée(s) par Meta : {' | '.join(trous)}. "
                f"Relancer le même --meta-since.")
        print(f"    meta: {len(trous)} tranche(s) incomplète(s), "
              f"reprises au prochain recouvrement : {' | '.join(trous)}")
    # On demande aussi les dates DECLAREES. Elles ne se deduisent pas de la
    # depense : une campagne programmee jusqu'en decembre et une campagne
    # arretee hier laissent exactement la meme trace dans les insights.
    note("statuts")
    campagnes, trou_statuts = _meta_campagnes(token, ad_account_id)

    def _jour(v):
        return str(v)[:10] if v else None

    status_map = {
        c["name"]: {
            "status": c.get("effective_status", "UNKNOWN"),
            "start_date": _jour(c.get("start_time")),
            # stop_time absent = campagne sans date de fin programmee.
            "end_date": _jour(c.get("stop_time")),
        }
        for c in campagnes if c.get("name")
    }
    # LE COMPTE SE DIT À CHAQUE PASSAGE, MÊME QUAND TOUT VA BIEN. C'est le seul
    # repère qui sépare « ce compte a 200 campagnes » de « on s'est arrêté à
    # 200 » dans une run verte — le défaut d'origine tenait entièrement dans ce
    # silence-là.
    if trou_statuts:
        # La run reste VERTE : ces statuts ne portent aucune dépense, et une
        # semaine d'insights vaut plus qu'une liste de campagnes complète. Les
        # campagnes non vues gardent le statut de la récolte précédente —
        # `upsert_campaign_statuses` ne touche que les lignes qu'on lui donne.
        print(f"    meta: liste des campagnes INCOMPLÈTE, "
              f"{len(status_map)} campagne(s) vue(s) : {trou_statuts}")
    else:
        print(f"    meta: {len(status_map)} campagne(s) déclarée(s)")
    # LES STATUTS S'ÉCRIVENT SEULS, ILS N'ATTENDENT PLUS UNE DÉPENSE. Cette
    # écriture vivait sous le `if rows:` des insights, alors qu'elle vient
    # d'une autre requête et remplit une autre table. Un compte qui ne dépense
    # plus — ou dont toutes les tranches d'insights ont échoué — n'écrivait
    # donc aucun statut, et `channels.ts` / `couverture.ts` montraient
    # l'`ACTIVE` de la dernière semaine dépensière comme s'il était courant,
    # sur une run verte qui venait d'imprimer le nombre de campagnes vues.
    # `upsert_campaign_statuses` rend la main sur une carte vide : rien à
    # garder ici.
    upsert_campaign_statuses(sb, uid, status_map)
    # `effective_status` ne se pose plus sur la ligne d'insight : personne ne le
    # lisait. `upsert_meta_ads` ne l'envoie pas — le statut vit dans
    # `meta_campaign_config`, une table par CAMPAGNE, pas par date. Le poser ici
    # ne faisait qu'une chose : fabriquer un « UNKNOWN » pour toute campagne
    # absente d'une liste tronquée.
    records, sans_id = lignes_meta_ads(uid, rows)
    if sans_id:
        print(f"    meta: {sans_id} ligne(s) sans ad_id, ignorées")
    if records:
        # LA MIGRATION A DEUX MOITIÉS, ET LA SECONDE NE SE VOIT QU'ICI. Le
        # garde-fou plus haut prouve que la COLONNE existe ; il ne prouve pas
        # que la CONTRAINTE d'unicité a été déplacée sur `ad_id`. Une base où
        # seul l'`ADD COLUMN` a été joué laisse passer le garde-fou, puis fait
        # échouer l'upsert sur `42P10` (« no unique constraint matching the ON
        # CONFLICT specification »). Sans ce rattrapage, cet échec-là ne serait
        # qu'un canal en erreur : run verte, rapport publié, email parti sur
        # une semaine sans dépense Meta.
        try:
            upsert_meta_ads(sb, uid, records)
        except Exception as e:
            if getattr(e, "code", None) == "42P10":
                _note_ecriture_sautee(uid)
                raise SchemaEnRetard(
                    "la contrainte d'unicité de meta_ads_insights ne porte pas encore "
                    "sur ad_id (42P10) — migration jouée à moitié, écriture Meta Ads "
                    "sautée. Rejouer supabase/migrations/000_run_me_all.sql en ENTIER "
                    "(section ad_id), puis relancer.") from e
            raise
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

    # Détail par annonce (drill-down campagne → groupe → annonce), table à
    # part : sa fraîcheur se déduit d'elle-même, pas de google_ads_insights —
    # les deux récoltes ne sont pas à la même profondeur tant que l'une des
    # deux n'a jamais tourné (voir fetch_google_ads_ad_insights_latest_date).
    note("détail annonces")
    latest_ad = fetch_google_ads_ad_insights_latest_date(sb, uid)
    since_ad = _depart_recolte(latest_ad, today, _RECOUVREMENT_JOURS_GOOGLE)
    ad_rows, cur = [], since_ad
    while cur <= today:
        end = min(cur + timedelta(days=_CHUNK - 1), today)
        chunk, err = fetch_ad_insights(access, customer_id, cur, end)
        if not err:
            ad_rows += chunk
        cur = end + timedelta(days=1)
    if ad_rows:
        upsert_google_ads_ad_insights(sb, uid, ad_rows)

    return f"google: {len(rows)} lignes, {len(ad_rows)} lignes annonces"


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
        return [(canal, _sans_jeton(f"{canal} KO: client Supabase indisponible "
                                   f"({type(e).__name__}: {e})"))
                for canal, _ in taches]

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
            #
            # ET C'EST ICI QUE LE JETON SORTIRAIT. Ce `mot` ne fait pas que
            # s'imprimer dans un journal public : `suivi.termine` l'écrit dans
            # `fetch_progress.mot_de_fin`, que l'app relit et montre. Une
            # exception `requests` recopie l'URL appelée, jeton compris — le
            # `refresh_token` Google autant que le jeton Meta. Sans ce filtre,
            # une coupure réseau publie un jeton de `connected_accounts` à
            # tout membre invité du compte (`CLAUDE.md` §7).
            mot = _sans_jeton(f"{canal} KO: {e}")
            sorties.append((canal, mot))
            suivi.termine(sb_fil, canal, "echec", mot)
    return sorties


def run(force: bool = False, only_user: str | None = None,
        report_only: bool = False, meta_since: date | None = None) -> None:
    sb = _service_client()
    profiles = (sb.table("profiles")
                .select("id, fetch_schedule")
                .execute().data) or []
    if only_user:
        # Bouton « Mes données » de Pulse : un seul user, sans attendre son jour
        profiles = [p for p in profiles if p["id"] == only_user]
        force = True
    _mode = " · rapport seulement" if report_only else ""
    print(f"[{datetime.utcnow():%Y-%m-%d %H:%M} UTC] {len(profiles)} profils{_mode}")

    # Sans ces secrets, le refresh du token Google echoue et TOUT Google Ads +
    # GA4 est saute en silence. On le dit fort une fois, en tete de run.
    if not report_only:
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

        # `report_only` : republie juste le rapport à partir des données déjà
        # en base (aucun fetch réseau) — ~30 s. Plus aucun bouton de
        # l'app ne le déclenche ; c'est un mode de TEST, lancé depuis l'onglet
        # GitHub Actions
        # (.scratch/construction/issues/15-le-client-ne-declenche-plus-rien.md).
        if report_only:
            # AVANT de republier, comme dans la récolte complète : la ligne
            # relevée doit être celle de l'email de la semaine d'avant.
            # `report_only` n'envoie rien, mais c'est un mode de VÉRIFICATION —
            # taire le relevé là où on vient le chercher le rendrait invisible
            # (même raison qu'au ticket 47 pour `_note_canaux_qui_durent`).
            _relever_ouverture(sb, uid, logs)
            try:
                from saas.traitement.build_report import publish_weekly_report
                _mot, _muets = publish_weekly_report(sb, uid)
                logs.append(_mot)
                _note_canaux_qui_durent(uid, _muets)
            except Exception as e:
                logs.append(f"rapport KO: {e}")
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
            # LE REJEU NE TOUCHE QUE META, et ce n'est pas une commodité. Un
            # `--since` global atteindrait Google, où `change_event` plafonne à
            # 30 jours et où une fenêtre plus large fait REJETER LA REQUÊTE
            # ENTIÈRE au lieu de la tronquer : un drapeau global fabriquerait
            # la panne que la constante _CHANGES_JOURS_GOOGLE raconte déjà.
            fil_meta.append(("meta",
                             lambda sb_f, note, t=token, s=meta_since:
                             _fetch_meta(sb_f, uid, t, note=note, since_forcee=s)))
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
            prevus += ["rapport"]
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

        # Rapport hebdo précalculé → weekly_reports (lu par Pulse) + email hebdo.
        # Données fraîches du jour → le rapport publié est à jour lui aussi.
        # L'email part le jour de fetch de l'utilisateur (défaut lundi) ; sans
        # RESEND_API_KEY, send_email passe en dry-run (aucun envoi).
        # LE RAPPORT PART, ET IL DIT CE QU'IL N'A PAS PU LIRE (ticket 20).
        #
        # CE BLOC RETENAIT LA PUBLICATION quand l'écriture Meta avait été sautée
        # pour cause de schéma en retard. La raison était juste — un rapport
        # publié sur une semaine sans dépense Meta présente le trou comme une
        # BAISSE — mais la retenue ne l'était pas, pour deux motifs mesurés par
        # le ticket 20 :
        #
        # ① ELLE NE COUVRAIT QU'UNE CAUSE SUR CINQ. Le schéma en retard était
        #    le seul cas retenu ; un jeton Meta expiré (le plus courant), un 500,
        #    une limite de débit ou n'importe quelle exception attrapée par `_fil`
        #    laissaient le rapport partir, l'email avec, et la run finir VERTE.
        # ② RETENIR, C'EST DÉPLACER LE SILENCE. Un compte au jeton mort ne
        #    recevait plus rien, sans jamais apprendre pourquoi — or le rapport
        #    est le seul canal par lequel on peut lui dire de reconnecter.
        #
        # Ce que le rapport fait maintenant, il le fait pour TOUTES les causes à
        # la fois, parce qu'il ne les distingue plus : `build_payload` lit
        # `fetch_progress` (état `echec` du dernier passage), fait taire chaque
        # mesure dont la source est muette — dépense, CPC, ROAS, verdict,
        # conseils payants — et publie le trou sous `canaux_muets`. Tranché avec
        # `vision-produit` le 2026-09-14,
        # `.scratch/construction/issues/20-rapport-publie-sur-un-canal-muet.md`.
        #
        # `_ECRITURES_SAUTEES` reste, et seulement pour ce qu'il sait vraiment :
        # faire finir la run en ROUGE quand une migration attend. Il ne commande
        # plus la publication.

        # CE QU'EST DEVENU L'EMAIL DE LA SEMAINE D'AVANT (ticket 50), et il se
        # relève AVANT que celui de cette semaine ne parte — sinon la ligne la
        # plus récente serait celle qu'on vient d'écrire.
        if a_tente:
            _relever_ouverture(sb, uid, logs)
            suivi.commence(sb, "rapport")
            try:
                from saas.traitement.build_report import publish_weekly_report
                email_to = None
                try:
                    email_to = sb.auth.admin.get_user_by_id(uid).user.email
                except Exception:
                    pass
                _mot, _muets = publish_weekly_report(sb, uid, email_to=email_to)
                _note_canaux_qui_durent(uid, _muets)
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
    report_only = False
    if "--report-only" in sys.argv:  # republie juste le rapport, ~30 s
        only_user = sys.argv[sys.argv.index("--report-only") + 1]
        report_only = True
    meta_since = None
    if "--meta-since" in sys.argv:   # rejeu d'historique Meta SEUL, depuis cette date
        try:
            meta_since = _date_forcee(
                sys.argv[sys.argv.index("--meta-since") + 1], date.today())
        except (IndexError, ValueError) as e:
            print(f"!! {e}" if isinstance(e, ValueError)
                  else "!! --meta-since attend une date AAAA-MM-JJ.")
            sys.exit(1)
        # UN REJEU VISE UN COMPTE, ET LE REFUS N'EST PAS UNE COQUETTERIE.
        # `--meta-since` force le passage (sinon il ne rendrait rien hors du
        # jour planifié) — mais sans `--user`, ce forçage vaut pour TOUS les
        # profils : chacun recevrait son rapport ET son email hebdo un jour qui
        # n'est le jour de personne, `publish_weekly_report` envoyant dès qu'il
        # a une adresse, sans contrôle de jour. Un rejeu d'historique ne doit
        # pas pouvoir écrire à toute la clientèle.
        if not only_user:
            print("!! --meta-since exige --user <uid> : sans lui, le rejeu forcerait "
                  "le passage de TOUS les comptes et leur enverrait l'email hebdo "
                  "hors de leur jour.")
            sys.exit(1)
        force = True
    try:
        run(force=force, only_user=only_user, report_only=report_only,
            meta_since=meta_since)
    except Exception:
        traceback.print_exc()
        sys.exit(1)
    # LE ROUGE TOMBE ICI, APRÈS TOUT LE RESTE. Google, GA4, Instagram et le
    # rapport ont fini leur travail — on ne perd pas une récolte
    # entière parce qu'une colonne Meta manque. Mais la run ne ment pas sur ce
    # qu'elle a écrit.
    #
    # DEUX CAUSES DE ROUGE, ET AUCUNE NE DOIT MASQUER L'AUTRE. Elles s'impriment
    # toutes les deux, puis on sort une seule fois : un `sys.exit` posé sous la
    # première aurait rendu la seconde invisible le jour où les deux tombent
    # ensemble — et c'est exactement le jour où il faut les lire.
    _rouge = False

    # LA PANNE QUI DURE (ticket 47). La ligne nomme de quoi AGIR : le compte, le
    # canal, depuis combien de rapports, et jusqu'à quel jour on a lu. Un run
    # rouge qui oblige à ouvrir Supabase pour savoir qui appeler est un signal
    # qu'on finit par ignorer — c'est le papier peint déplacé d'un cran.
    #
    # `mot` est le mot de la fin du worker, déjà imprimé tel quel plus haut dans
    # ce même journal : il nomme l'exception, jamais la valeur d'un jeton
    # (`CLAUDE.md` §7).
    if _CANAUX_QUI_DURENT:
        print(f"!! ÉCHEC : {len(_CANAUX_QUI_DURENT)} canal/canaux muets depuis "
              f"au moins deux rapports — une note dans le rapport ne suffit "
              f"plus (ticket 47).")
        for _uid, _c in _CANAUX_QUI_DURENT:
            _depuis = (f"lu jusqu'au {_c.get('depuis')}" if _c.get("depuis")
                       else "aucune donnée jamais reçue")
            # CE QUE LE CLIENT SAIT, DIT LIGNE PAR LIGNE. Sur un canal qui ne
            # tait aucun chiffre, les deux surfaces client se taisent : il n'a
            # rien reçu. L'écrire ici est ce qui décide si David a besoin de
            # l'appeler ou seulement de reconnecter.
            #
            # « REÇU », PAS « VU » (ticket 50). Cette ligne disait « le client
            # l'a vu » : personne ne l'avait mesuré, et c'est exactement la
            # phrase invérifiable sur laquelle reposait tout l'arbitrage du
            # ticket 47. Ce qui est mesuré, c'est que le rapport et l'email
            # portaient la note — donc « reçu ». Ce qu'il en a fait, s'il est
            # connu, tient dans la ligne d'ouverture juste en dessous.
            _su = ("le client l'a reçu dans son rapport et son email"
                   if vu_par_le_client(_c)
                   else "INVISIBLE POUR LE CLIENT — ce canal ne lui tait aucun "
                        "chiffre, il n'en a jamais entendu parler")
            print(f"   {_uid} · {_c.get('nom') or _c.get('canal')} — muet depuis "
                  f"{_c.get('semaines_muettes')} rapports, {_depuis} — "
                  f"{_c.get('mot')}")
            print(f"        → {_su}")
            # L'OUVERTURE, QUAND ON LA CONNAÎT, ET SEULEMENT ALORS. Aucune
            # ligne tant qu'aucun envoi n'a été relevé pour ce compte :
            # imprimer « ouverture inconnue » à chaque escalade apprendrait à
            # ne plus lire la ligne le jour où elle dit quelque chose.
            if _uid in _OUVERTURES:
                print(f"        → {_OUVERTURES[_uid]}")
        print("   Reconnecter le canal sur le compte, puis relancer "
              "weekly-fetch.yml (force + user_id) : le recouvrement réécrira "
              "les semaines trouées.")
        _rouge = True

    if _ECRITURES_SAUTEES:
        print(f"!! ÉCHEC : écriture Meta Ads sautée pour {len(_ECRITURES_SAUTEES)} "
              f"utilisateur(s) — colonne absente de meta_ads_insights "
              f"({_COLONNES_META_ECRITES}). "
              f"Leur rapport a été publié SANS chiffre de dépense Meta, en "
              f"nommant le trou (ticket 20). Le reste de la récolte a bien "
              f"tourné. Jouer supabase/migrations/000_run_me_all.sql, puis "
              f"relancer : le recouvrement de {_RECOUVREMENT_JOURS_META} jours "
              f"rattrapera la semaine.")
        _rouge = True

    if _rouge:
        sys.exit(1)
