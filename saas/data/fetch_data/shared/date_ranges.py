"""Les dates de la récolte : où elle reprend, et comment elle se découpe.

Rien ici n'est propre à une plateforme. Les constantes de recouvrement et de
profondeur restent chacune à côté de sa plateforme, avec la source qui les a
fixées : ce module les reçoit en argument.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

# Les quatre récoltes datées (Meta, Google campagnes, Google annonces, GA4)
# demandent toutes leurs insights par tranches de 90 jours : la boucle existait
# en quatre exemplaires, qui ne pouvaient que diverger.
TRANCHE_JOURS = 90

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
#    régie pour ses raisons, dites à côté de sa constante :
#    `_RECOUVREMENT_JOURS_META` (`meta/ads/sync.py`),
#    `_RECOUVREMENT_JOURS_GOOGLE` (`google/ads/sync.py`),
#    `_RECOUVREMENT_JOURS_GA4` (`google/analytics/sync.py`). Repartir à `latest + 1` le fige
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

# CE QUE ÇA COÛTE — compté, pas supposé. Les deux boucles découpent déjà la
# plage en tranches de 90 jours (`tranches`, plus bas), et un recouvrement de 28 ou 30 jours
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

# ── PROFONDEUR D'HISTORIQUE — chiffré, PAS appliqué ───────────────────────────
#
# La première récolte part du 1er janvier de l'année en cours. Un client qui
# s'inscrit le 5 janvier repart donc avec quatre jours, et les vues historiques
# ont peu de profondeur. Ce que les plateformes accepteraient :
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
#    Et il est déjà borné à 200 posts (`limite` en payant, `meta/instagram/sync.py`), donc élargir
#    la profondeur des régies ne le touche pas.
# Autrement dit un backfill 37 mois des deux régies coûte ~65 requêtes et
# quelques minutes, une seule fois par compte. Le vrai obstacle n'est pas
# l'API, c'est l'écriture : `upsert_meta_ads` envoie TOUT en un seul appel
# PostgREST, et 22 500 lignes d'un coup n'ont jamais été essayées. À découper
# avant d'élargir quoi que ce soit.


@dataclass(frozen=True)
class Fenetre:
    """La période qu'un fichier d'API lit, bornes comprises.

    Un seul type pour toutes les plateformes : c'est ce qui permet à la mise à
    jour, à la récolte complète et à l'essai d'appeler les mêmes fichiers
    d'API en ne changeant que la période.
    """
    debut: date
    fin: date


def tranches(since: date, until: date, jours: int = TRANCHE_JOURS
             ) -> list[tuple[date, date]]:
    """[(début, fin)] bornes comprises, de `since` à `until`. Vide si since > until."""
    sortie, cur = [], since
    while cur <= until:
        fin = min(cur + timedelta(days=jours - 1), until)
        sortie.append((cur, fin))
        cur = fin + timedelta(days=1)
    return sortie


def depart_recolte(latest: str | None, today: date, recouvrement: int) -> date:
    """Le jour où la récolte reprend.

    Aucun repère n'est stocké — ni table, ni colonne de suivi. Le point de
    reprise est DÉDUIT de la donnée elle-même (la date la plus récente en
    base), puis reculé du recouvrement. C'est volontaire et c'est mieux qu'un
    état stocké : une récolte qui note « fait jusqu'au 12 » puis plante en
    écrivant perd le 12 pour toujours, alors qu'une date lue dans les lignes
    réellement écrites ne peut pas mentir sur ce qui a été fait.

    Première récolte (rien en base) : 1er janvier de l'année en cours — voir la
    note « PROFONDEUR D'HISTORIQUE » plus haut, ce chiffre est discutable et
    n'est pas discuté ici.
    """
    if not latest:
        return date(today.year, 1, 1)
    # Pas de plancher au 1er janvier : reculer de quelques jours avant la plus
    # ancienne date connue ne rend que des jours vides, ça ne coûte pas un
    # appel de plus (même tranche) et ça ne casse rien.
    return date.fromisoformat(latest) - timedelta(days=recouvrement)


def date_forcee(valeur: str, today: date, profondeur_jours: int) -> date:
    """La date de départ imposée à la main, validée AVANT le premier appel.

    Elle existe pour rejouer un historique — typiquement après le passage à
    `ad_id`, où les lignes anciennes n'en portent pas. Le rejeu se fait par
    cette date, JAMAIS par un DELETE : `upsert_meta_ads` efface les lignes
    `ad_id IS NULL` des seules dates qu'il réécrit, donc la table n'est jamais
    vide et une récolte interrompue ne laisse aucune fenêtre sans donnée.

    Les deux bornes sont vérifiées ici plutôt que subies plus loin : une date
    refusée par la plateforme se lirait comme un trou de récolte, pas comme une
    date mal choisie. `profondeur_jours` est celle que la plateforme accepte
    (Meta : `_PROFONDEUR_META_JOURS`, avec sa source).
    """
    try:
        jour = date.fromisoformat(valeur)
    except ValueError:
        raise ValueError(f"date illisible « {valeur} », attendu AAAA-MM-JJ.")
    if jour > today:
        raise ValueError(f"{jour} est dans le futur, rien à récolter.")
    plancher = today - timedelta(days=profondeur_jours)
    if jour < plancher:
        raise ValueError(
            f"{jour} dépasse les {profondeur_jours} jours que l'API accepte "
            f"(pas avant {plancher}).")
    return jour
