"""Construit et publie le rapport hebdo précalculé (weekly_reports.payload) — headless.

Seul producteur de weekly_reports.payload : ce worker publie après le fetch
cron → Pulse est frais le lundi matin sans que personne n'ouvre quoi que ce soit.
Mêmes fenêtres (7 jours pleins ancrés sur la dernière donnée, jamais
aujourd'hui), même moteur de recos (`saas/recos_ia/reco_engine.py`), même
structure de payload que ce que rendait l'ancien Streamlit (retiré).

Le brief IA est calibré par le profil client vivant
(`saas/recos_ia/user_persona.py`, recalculé une fois par semaine à chaque
génération du rapport) — fallback déterministe si Gemini échoue, comme
partout ailleurs.

Usage :
  python saas/traitement/build_report.py --user <uuid> [--print]
  python saas/traitement/build_report.py --all
"""

from __future__ import annotations
import sys
import json
from datetime import date, timedelta
from pathlib import Path

# Permet d'importer saas/ (compat) et la racine du dépôt, quel que soit le cwd
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

import pandas as pd  # noqa: E402
import requests  # noqa: E402

from saas.commun.app_secrets import secret  # noqa: E402
from saas.commun.insert_data import upsert_weekly_report  # noqa: E402
from saas.traitement.lecteur import Lecteur, LecteurSupabase  # noqa: E402
from saas.recos_ia.reco_engine import (  # noqa: E402
    build_recos, KEY_LABELS, OBJECTIFS, SEUILS, FORMAT_LABELS,
)
from saas.recos_ia.regles_payantes import regles_payantes  # noqa: E402
from saas.recos_ia.composition import (  # noqa: E402
    composer_la_semaine, empreinte as empreinte_conseil,
)
from saas.recos_ia.insights import build_matrix, build_constats  # noqa: E402
from saas.recos_ia.marche_suivante import marche_suivante  # noqa: E402

MONTHS_FR = {1: "jan", 2: "fév", 3: "mar", 4: "avr", 5: "mai", 6: "jun",
             7: "jul", 8: "aoû", 9: "sep", 10: "oct", 11: "nov", 12: "déc"}


def _call_gemini(prompt: str) -> str | None:
    api_key = secret("gemini.api_key")
    if not api_key:
        return None
    try:
        resp = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=20,
        )
        return resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception:
        return None


# Champs d'une reco tels que stockés dans le payload (miroir du dict _reco()).
# metric/metric_label/direction/baseline : indicateur-cible + sa valeur du moment,
# pour le suivi « ▶ Je le teste » (photographie de la décision).
# `role` : le DÉLAI auquel on saura (voir `ROLES` plus bas).
# `nature`/`cible` : le TYPE de geste (voir `NATURES`) et l'objet NOMMÉ qu'il
# vise — une campagne, une annonce, un groupe d'annonces. Sans eux, un conseil
# ne nomme jamais ce qu'il demande de faire concrètement, et `cible` est la
# moitié de l'empreinte qui l'empêche de revenir à l'identique
# (`saas/recos_ia/composition.py`).
RECO_FIELDS = ("key", "platform", "title", "observation", "pourquoi", "verifier",
               "repere", "angle_mort", "confidence", "priority", "source",
               "metric", "metric_label", "direction", "baseline", "effort",
               "levier", "role", "nature", "cible")

# Effort a prevoir pour appliquer un conseil-regle : c'est la moitie de la
# decision (l'autre moitie, c'est l'indicateur vise). Affiche en pastille.
EFFORTS = ("10 min", "30 min", "1 h", "2 h+")
EFFORT_BY_KEY = {
    "gaspillage": "10 min",
    "scaler": "10 min",
    "connecter_ga4": "10 min",
    "roas": "30 min",
    "funnel": "30 min",
    "ga4_muet": "30 min",
    "silence": "1 h",
    "page_endormie": "1 h",
    "orga_rythme": "30 min",
    "orga_essoufflement": "1 h",
    "orga_format": "1 h",
    "orga_reaction": "1 h",
    # Vérifier un événement dans GA4 → Temps réel, c'est le parcours d'achat à
    # refaire soi-même : plus long qu'un réglage, plus court qu'un chantier.
    "theme_event_muet": "30 min",
    # Comparer un coût par conversion à sa propre marge ne se fait pas dans
    # l'outil : on sort sa calculette, et c'est vite fait.
    "theme_event_cout": "10 min",
    # LES QUATRE RÈGLES PAYANTES (`saas/recos_ia/regles_payantes.py`). Trois
    # tiennent en un geste dans le gestionnaire de publicités — mettre une
    # annonce en pause, monter un budget de +20 % : c'est un clic et une
    # confirmation. La quatrième demande d'ouvrir les campagnes du thème une
    # par une pour comparer leur budget posé à leur dépense réelle.
    "annonce_sans_conversion": "10 min",
    "annonce_locomotive": "10 min",
    "annonce_chere": "10 min",
    "theme_hors_budget": "30 min",
    # LES SIX RÈGLES PAYANTES RESTANTES (ticket 10). Baisser un budget posé est
    # un champ à corriger ; déplacer du budget entre deux Groupes ou deux
    # régies, comparer les campagnes d'un thème, ou aller vérifier une balise
    # dans Google Analytics → Temps réel demandent d'ouvrir l'outil et de
    # comparer — une demi-heure, pas un chantier.
    "adset_inegal": "30 min",
    "theme_deux_regies": "30 min",
    "budget_non_depense": "10 min",
    "page_arrivee_muette": "30 min",
    "creneau_pub": "30 min",
    # `annonce_usee` EST LA SEULE À DÉPASSER LA DEMI-HEURE, et c'est un écart
    # assumé avec `.scratch/refonte/issues/24-conseils-payants-manquants.md`
    # (décision 8 : « aucune règle payante au-dessus de 30 min d'effort »).
    # Elle demande de FABRIQUER une créa — un visuel neuf ou une autre accroche.
    # Ses voisines organiques qui demandent la même chose sont toutes à « 1 h »
    # (`silence`, `orga_format`, `orga_essoufflement`) : lui coller « 30 min »
    # pour tenir une estimation écrite avant la règle ferait mentir la pastille
    # sur ce qu'elle coûte vraiment. Le bac « 2 h+ » reste vide côté pub, lui,
    # et c'est bien ce que la décision 8 protégeait.
    "annonce_usee": "1 h",
}

# LES QUATRE LEVIERS, liste fermée. Un conseil-règle déclare le sien par clé
# (`_LEVIER_REGLE`, plus bas) et ne le devine jamais. `FENETRE_LEVIER` et
# `ATTENTE_MIN_NOUVELLE_HYPOTHESE`, juste en dessous, sont indexées dessus.
LEVIERS = ("argent", "contenu", "tempo", "audience")

# Fenêtre de vérification d'une hypothèse, PAR LEVIER — décision wayfinder
# (`.scratch/recos-labels/issues/03-suivi-hypothese.md`) : un levier
# "contenu"/"tempo" se lit vite (un format ou un rythme se voit en une
# semaine) ; un levier "argent"/"audience" a besoin de plus de temps pour que
# le CPC/ROAS ou le reach bougent significativement. 14 jours par défaut si le
# levier est absent/inconnu (repli sur l'ancien comportement fixe).
FENETRE_LEVIER = {"contenu": 7, "tempo": 7, "argent": 14, "audience": 14}

# Attente MAXIMALE avant de laisser Gemini proposer une NOUVELLE hypothèse
# pour un thème — distincte de `FENETRE_LEVIER` (qui ne fixe QUE la date du
# verdict). David : ne pas changer de théorie après un seul cycle, lui laisser
# 1 à 2 cycles pour prouver qu'elle ne marche pas avant d'en tester une autre.
# Concrètement : 2 cycles pour les leviers rapides (2×7j), 1.5 cycle arrondi
# pour les leviers lents (14j) — 14 à 21 jours, comme demandé.
#
# PLAFOND DE SECOURS, PAS UN PLANCHER (wayfinder ticket 06,
# `.scratch/recos-labels/issues/06-fenetre-verdict.md`, 7 septembre 2026) :
# le verdict d'une hypothèse "contenu"/"tempo" est calculé et écrit dès
# `FENETRE_LEVIER` (7 jours) — avant cette correction, la carte restait
# épinglée jusqu'à `ATTENTE_MIN_NOUVELLE_HYPOTHESE` (14 jours) MÊME QUAND le
# système savait déjà, depuis une semaine, si elle avait marché ou pas :
# une semaine d'attente vide, exactement le symptôme rapporté par David
# (« j'ai l'impression que rien ne bouge »). Le blocage plus bas se lève
# maintenant dès qu'un verdict est tombé (`verdicts`, voir
# `fetch_reco_verdicts`) ; ces durées ne bornent plus que le cas où AUCUN
# verdict n'est encore arrivé.
ATTENTE_MIN_NOUVELLE_HYPOTHESE = {"contenu": 14, "tempo": 14, "argent": 21, "audience": 21}
_ATTENTE_DEFAUT = 14

# Le nom qu'un canal porte DEVANT LE CLIENT. `meta` et `ga4` sont des noms de
# colonnes ; personne n'a connecté « ga4 ». Posé au niveau module parce que le
# verdict et la liste `canaux_muets` doivent nommer la même panne du même mot
# (ticket 20).
NOMS_CANAUX = {"meta": "Meta Ads", "google": "Google Ads",
               "instagram": "Instagram", "ga4": "Google Analytics"}

# ── LE JUGEMENT ASSEMBLÉ D'UN THÈME (wayfinder
# `.scratch/recos-labels/issues/04-analyse-assemblee.md`) ────────────────────
#
# Aucune cible chiffrée n'existe pour un objectif de thème (`theme_objectifs`
# est un enum catégoriel, vérifié) — le jugement ne peut donc jamais afficher
# un « % de l'objectif atteint », seulement une VRAIE variation mesurée entre
# la semaine et la semaine précédente, sur l'indicateur qui représente le
# mieux l'objectif du thème. `notoriete` n'a pas d'équivalent GA4 (la
# notoriété n'est pas une conversion) — décision de David : on mesure sa
# PORTÉE, pas un événement GA4 inventé pour l'occasion.
JUGEMENT_METRIC_PAR_OBJECTIF = {"ventes": "roas", "engagement": "eng", "notoriete": "reach"}

# Bascule "améliorer tout" / "cibler le plus impactant" — décision de David :
# sur une DÉGRADATION mesurée, pas sur une cible chiffrée qui n'existe pas.
# Même seuil que `verdict_tone` (compte entier, plus bas) : ±10 %.
JUGEMENT_SEUIL_DEGRADATION = -10.0

# Quand on cible, quel levier favoriser dans l'arbitrage des pistes déjà
# écrites (simple réordonnancement, jamais une piste inventée en plus) — le
# levier le plus proche de l'indicateur qui s'est dégradé.
JUGEMENT_LEVIER_PAR_METRIC = {"roas": "argent", "eng": "contenu", "reach": "audience"}
# Le vocabulaire exact que `_kpis_window` (plus bas, dans `build_payload`)
# sait mesurer — un conseil qui déclarerait une métrique hors de cette liste
# ne pourrait de toute façon jamais recevoir de verdict à 14 jours.
# `spend` est entré avec les quatre règles payantes : `theme_hors_budget` vise
# une dépense qui REDESCEND sous le budget posé, et c'est le seul indicateur qui
# dise ça. `_kpis_window` le calculait déjà (et le calcule sur les deux régies
# depuis le ticket 01) — aucune mesure neuve, juste une déclaration qui manquait.
#
# `sessions`, proposé au même moment par
# `.scratch/refonte/issues/24-conseils-payants-manquants.md`, n'est PAS ajouté :
# `_kpis_window` ne sait pas le mesurer, et un indicateur qu'on ne sait pas
# remesurer à l'échéance ne rend pas un verdict — il en fabrique un.
METRICS_MESURABLES = ("cpc", "roas", "posts", "reach", "eng", "purchases", "spend")
# Libellé, unité, sens d'amélioration et format d'affichage de chaque
# métrique déclarable. Source UNIQUE depuis le ticket 06 de la construction :
# la table `PROOF_KPI` qui vivait dans `build_payload` répétait ces six lignes
# valeur pour valeur, une fois par clé-règle, et deux tables qui disent la même
# chose finissent par ne plus la dire pareil. Une règle déclare son INDICATEUR
# par clé (`_METRIC_REGLE`, juste en dessous), et c'est ici qu'il trouve son
# libellé, son unité et son sens d'amélioration.
METRIC_INFO = {
    "cpc":       ("CPC moyen", "CHF", "down", "{:.2f}"),
    "roas":      ("ROAS", "", "up", "{:.1f}"),
    "posts":     ("posts publiés", "", "up", "{:.0f}"),
    "reach":     ("portée moyenne", "", "up", "{:,.0f}"),
    "eng":       ("engagement moyen", "%", "up", "{:.1f}"),
    "purchases": ("achats (GA4)", "", "up", "{:.0f}"),
    "spend":     ("dépense pub", "CHF", "down", "{:,.0f}"),
}

# L'INDICATEUR d'une règle — la 3ᵉ des cinq colonnes (durée · levier ·
# indicateur · geste · preuve), et celle qui rend un Verdict possible : c'est le
# chiffre photographié au moment de la décision, puis remesuré à l'échéance.
#
# Chaque conseil vise l'indicateur QU'IL fait bouger : le nombre de posts pour
# un rythme retombé, la portée pour tout le reste de l'organique.
#
# CE QUI N'Y EST PAS, ET POURQUOI :
#   · les `veille_*` — une veille n'a pas de verdict à mériter. Lui donner un
#     indicateur reviendrait à promettre une mesure dans quatorze jours sur une
#     décision qu'on n'a pas prise ;
#   · les `theme_event_*` — `_kpis_window` sait mesurer un CPC, un ROAS, des
#     posts, une portée, pas un coût par événement choisi. Leur donner `cpc` ou
#     `roas` ferait juger « chaque purchase t'a coûté 42 CHF » sur un indicateur
#     qui n'est pas le leur, et un verdict pris sur la mauvaise mesure repondère
#     ensuite tous les autres conseils (`reco_engine.py`, `_DONE_W`) ;
#   · `connecter_ga4` et `ga4_muet` — ce sont des prérequis de mesure (`socle`),
#     hors du flux des conseils ; ce qu'ils réparent, c'est la mesure elle-même.
_METRIC_REGLE = {
    "gaspillage":         "cpc",
    "roas":               "roas",
    "scaler":             "roas",
    "funnel":             "purchases",
    "silence":            "posts",
    "page_endormie":      "reach",
    # DEUX RÈGLES MORTES QUI GARDENT LEUR INDICATEUR, ET C'EST VOULU.
    # `creneau` et `format_gagnant` n'existent plus (ticket 09, elles
    # répondaient à la question des constats) : elles ont quitté les quatre
    # autres tables de grammaire, plus rien ne les produit. Mais un client a pu
    # cliquer « ▶ Je le teste » dessus la semaine d'avant, et cette décision est
    # en base (`suivi_actions`). Sans son indicateur, `_spec_mesure` rend `None`
    # et la boucle du Verdict fait `continue` AVANT la branche « en attente » :
    # la décision disparaîtrait sans un mot, tout en consommant une des quatre
    # places de `decisions[:4]`. Pulse promet de dire si ce qui a été fait a
    # marché (`CLAUDE.md` §1) — la promesse vaut pour ce qui a DÉJÀ été décidé.
    # Ces deux lignes sont donc en LECTURE SEULE : elles ne servent plus qu'aux
    # décisions passées, et elles partiront quand la dernière sera close.
    "creneau":            "eng",
    "format_gagnant":     "eng",
    "orga_rythme":        "posts",
    "orga_essoufflement": "reach",
    "orga_format":        "reach",
    "orga_reaction":      "reach",
    # Les quatre règles payantes. `annonce_chere` vise le prix du clic du thème,
    # qui est exactement ce qu'elle accuse une annonce de tirer vers le haut.
    # Les deux autres règles d'annonce déplacent de l'argent d'une créa vers une
    # autre : ce qui doit bouger, c'est le RETOUR du thème, pas son coût par
    # clic — même indicateur que `scaler`, qui demande le même genre de geste.
    "annonce_chere":           "cpc",
    "annonce_locomotive":      "roas",
    "annonce_sans_conversion": "roas",
    # Le seul conseil dont la réussite est une dépense qui redescend.
    "theme_hors_budget":       "spend",
    # LES SIX RÈGLES PAYANTES RESTANTES (ticket 10). Chacune vise l'indicateur
    # QU'ELLE fait bouger :
    #   · `adset_inegal`, `annonce_usee` et `creneau_pub` accusent toutes les
    #     trois un PRIX DU CLIC trop haut — une audience trop disputée, une créa
    #     usée, un jour trop cher — et c'est lui qui doit redescendre ;
    #   · `theme_deux_regies` déplace du budget vers ce qui rend le mieux : ce
    #     qui doit bouger, c'est le RETOUR du thème ;
    #   · `budget_non_depense` aussi, et c'est le seul point qui demande une
    #     explication. Son geste est de corriger un budget qui dort — soit en
    #     débridant la campagne, soit en remettant l'argent là où il part.
    #     `spend` aurait été le réflexe, mais son sens d'amélioration est
    #     « down » (`METRIC_INFO`) : une dépense qui REMONTE vers le budget posé
    #     se serait lue comme un échec. L'argent qui dort ne coûte rien, il ne
    #     rapporte rien non plus — ce qu'on remesure est ce que le thème rend
    #     une fois cet argent remis en circulation.
    "adset_inegal":            "cpc",
    "annonce_usee":            "cpc",
    "creneau_pub":             "cpc",
    "theme_deux_regies":       "roas",
    "budget_non_depense":      "roas",
    # `page_arrivee_muette` N'EST PAS ICI, ET C'EST LA MÊME RAISON QUE
    # `connecter_ga4` ET `ga4_muet` juste au-dessus de cette table : c'est un
    # prérequis de MESURE (levier `socle`). Ce qu'elle répare, c'est la mesure
    # elle-même — lui donner `roas` ou `purchases` reviendrait à juger sa
    # réussite avec le chiffre qu'elle vient justement de déclarer faux.
}


def _spec_mesure(metric: str | None) -> tuple | None:
    """(indicateur, libellé, unité, sens, format) — ou `None` si l'indicateur
    n'est pas mesurable. Le seul endroit qui assemble cette spec, pour une règle
    comme pour une piste IA."""
    info = METRIC_INFO.get(metric or "")
    return ((metric,) + info) if info else None


# LES CINQ GESTES, liste fermée. Sans eux, seul `levier` forçait la variété :
# trois conseils pouvaient tous dire « ajuste un budget » (même levier
# « argent », trois gestes différents — couper ce budget, l'augmenter, ou en
# tester un nouveau). Une règle déclare le sien par clé (`_GESTE_REGLE`) ou
# branche par branche quand il dépend du chiffre du jour ; `_est_conseil` rejette
# tout ce qui sort de cette liste, parce qu'un geste deviné n'en est pas un.
NATURES = ("couper", "augmenter", "tester", "créer", "corriger")

# LE RÔLE, c'est-à-dire LE DÉLAI AUQUEL ON SAURA. Liste fermée de deux :
#   generale  — une modification précise sur un élément NOMMÉ (une campagne, un
#               post, une ligne de budget), dont on peut CONSTATER DEMAIN, à
#               l'œil, dans la plateforme, qu'elle a été faite — un état, jamais
#               un KPI ;
#   hypothese — une théorie dont rien ne se voit demain et qui a besoin d'une
#               mesure. C'est la MARCHE d'une Stratégie : elle ouvre le plan du
#               thème (`theme_plan`) et attend son Verdict.
#
# Le DÉCOMPTE des Marches n'est plus une garantie par thème (« toujours 1 sur 3 »,
# du temps où Gemini rédigeait) mais un PLAFOND sur la semaine entière, tenu par
# `saas/recos_ia/composition.py` : une à deux, jamais trois théories en vol.
ROLES = ("generale", "hypothese")


# `SETUP_KEYS` (GA4 muet, connecter GA4, funnel) reste le socle d'un circuit
# d'affichage séparé, sorti du flux normal des recos-thème/recos-règles
# (voir ses usages plus bas).
SETUP_KEYS = {"ga4_muet", "connecter_ga4", "funnel"}


# LES LISTES FERMÉES, RASSEMBLÉES POUR CEUX QUI DOIVENT LES FAIRE RESPECTER.
#
# `marche_suivante` (`saas/recos_ia/`) rejette une piste dont la grammaire sort
# de ces listes — il lui faut donc les lire, et il ne peut pas les importer :
# `build_report` importe `recos_ia`, jamais l'inverse. Les recopier là-bas
# ferait les deux tables qui finissent par ne plus dire la même chose, ce qui a
# déjà coûté `PROOF_KPI` (ticket 22, décision 5). Elles se passent donc en
# paramètre, et il n'existe toujours qu'un seul endroit où elles sont écrites.
#
# `efforts` EN FAIT PARTIE, et ce n'est pas une cinquième colonne inventée :
# le plafond des gestes lourds (`composition.MAX_LOURDS`) lit `nature` ET
# `effort`, et la décision 1 du ticket 22 dit qu'il « ne servira que lorsque
# les Marches de Gemini ajouteront des `créer`/`corriger` ». Sans effort
# déclaré, une Marche retombe sur le défaut « 30 min » d'`_attach_effort` et ce
# plafond ne peut par construction jamais la voir.
GRAMMAIRE = {
    "natures": NATURES,
    "roles": ROLES,
    "leviers": LEVIERS,
    "metrics": METRICS_MESURABLES,
    "efforts": EFFORTS,
}


def _effort_de(reco: dict) -> str:
    """L'effort d'un conseil, même avant que `_attach_effort` ne l'ait posé.

    Le tri d'importance tourne AVANT l'attachement des pastilles : sans ce
    repli sur la table, tous les conseils-règles se seraient valus sur l'axe
    de l'effort, et l'axe n'aurait servi à rien.
    """
    return reco.get("effort") or EFFORT_BY_KEY.get(reco.get("key"), "30 min")


def _est_veille(reco: dict) -> bool:
    """Un conseil de VEILLE : on regarde, on n'agit pas encore."""
    return str(reco.get("key") or "").startswith("veille_")


def _veille_urgente(reco: dict) -> bool:
    """La seule veille qui COÛTE quelque chose maintenant.

    Une campagne déclarée qui ne dépense pas perd un jour par jour, et elle
    n'apparaît dans aucun chiffre du rapport — c'est précisément pour ça que
    personne ne la voit. Les autres veilles disent l'inverse : il n'y a rien à
    faire, attends. Les deux ne peuvent pas se classer pareil.
    """
    return str(reco.get("key") or "").endswith("_muette")


# Le LEVIER d'un conseil : sur quoi il demande d'agir.
#
# C'est ce qui manquait pour que « les 3 du moment » cessent de se ressembler.
# La selection triait par (priorite, confiance, facilite) puis prenait les trois
# premiers — sans regarder si les trois disaient la meme chose. Deux themes en
# gaspillage donnaient deux fois « ajuste un budget », et le lecteur en concluait
# que le produit n'a qu'une idee.
#
# Quatre leviers, parce qu'un conseil marketing agit sur l'un des quatre :
#   argent   — combien on met, et ou
#   contenu  — ce qu'on montre
#   tempo    — quand et a quelle frequence
#   audience — a qui on parle
# `socle` est a part : ce sont les prerequis (GA4, funnel), qui ne se
# concurrencent pas entre eux.
_LEVIER_REGLE = {
    "gaspillage": "argent",
    "scaler": "argent",
    "roas": "argent",
    "silence": "tempo",
    "page_endormie": "contenu",
    "funnel": "socle",
    "connecter_ga4": "socle",
    "ga4_muet": "socle",
    "orga_rythme": "tempo",
    "orga_essoufflement": "contenu",
    "orga_format": "contenu",
    # « Ce theme fait reagir mais il est peu vu » ne demande pas de refaire le
    # contenu — il demande de le mettre devant plus de monde. C'est le seul
    # conseil-regle qui tienne l'axe `audience`, qui n'etait servi que par l'IA.
    "orga_reaction": "audience",
    # Un evenement principal muet est un probleme de MESURE avant d'etre un
    # probleme commercial : tant qu'on ne sait pas si le tag marche, il n'y a
    # rien a arbitrer. C'est un prerequis, donc `socle`.
    "theme_event_muet": "socle",
    # Le cout par conversion se juge contre une marge, et ce qu'il fait bouger
    # c'est le budget du theme.
    "theme_event_cout": "argent",
    # LES QUATRE RÈGLES PAYANTES. `annonce_sans_conversion` est la seule des
    # quatre qui ne parle pas d'argent : deux annonces du même thème partagent
    # l'audience et le budget, ce qui les sépare est ce qu'elles MONTRENT —
    # d'où `contenu`, alors même que son geste est de couper.
    "annonce_sans_conversion": "contenu",
    "annonce_locomotive": "argent",
    "annonce_chere": "argent",
    "theme_hors_budget": "argent",
    # LES SIX RÈGLES PAYANTES RESTANTES (ticket 10), et elles etendent la
    # couverture des leviers la ou le payant n'allait pas :
    #   · `adset_inegal` est le PREMIER conseil payant sur l'axe `audience` —
    #     deux Groupes d'une meme campagne partagent objectif et enchere, ce qui
    #     les separe est a QUI ils parlent ;
    #   · `creneau_pub` est le premier conseil payant sur l'axe `tempo` ;
    #   · `annonce_usee` met en cause la CREA, pas le montant : une annonce usee
    #     ne se repare pas avec du budget, elle se remplace ;
    #   · `page_arrivee_muette` est un prerequis de MESURE, comme GA4 et le
    #     funnel — tant qu'on ne sait pas ou passent les clics payes, tout ce
    #     qu'on dit du retour du theme est bati sur un revenu partiel.
    "adset_inegal": "audience",
    "theme_deux_regies": "argent",
    "budget_non_depense": "argent",
    "annonce_usee": "contenu",
    "page_arrivee_muette": "socle",
    "creneau_pub": "tempo",
}

# LE GESTE ET LA PREUVE — les deux dernières des cinq colonnes d'une règle.
#
# Le GESTE (`nature`, dans `NATURES`) existe pour une seule raison, la même
# que le levier juste au-dessus : empêcher que les conseils de la semaine se
# ressemblent. C'est pour ça qu'il n'y a **pas de sixième geste « vérifier »** —
# il rendrait admissible tout ce qui ne demande rien, et brouillerait exactement
# ce que les cinq servent à distinguer. D'où le critère d'entrée qui en découle
# et que `_est_conseil` applique : **un conseil sans geste est un constat**, et
# un constat n'occupe pas une des places de la semaine.
#
# La PREUVE (`role`, dans `ROLES`) est le DÉLAI auquel on saura :
#   · `generale`  — un geste dont on constate DEMAIN, à l'œil, dans la
#                   plateforme, qu'il a été fait (un budget monté, une campagne
#                   coupée, un post publié) ;
#   · `hypothese` — une théorie dont rien ne se voit demain et qui a besoin
#                   d'une mesure : elle ouvre une Stratégie sur son thème
#                   (`theme_plan`) et attend son Verdict.
#
# Les deux colonnes de chaque ligne sont recopiées du champ `verifier` de la
# règle, jamais devinées : `orga_essoufflement` dit « reviens à ta cadence
# d'avant pendant 4 semaines » (donc couper, et rien à constater demain),
# `page_endormie` dit « teste les Reels sur 2 semaines » (donc tester, et rien
# à constater demain non plus).
#
# CE QUI N'Y EST PAS, ET POURQUOI :
#   · `roas` et `gaspillage` — leur geste dépend du CHIFFRE DU JOUR, pas de leur
#     clé : elles le déclarent branche par branche dans `_reco()`
#     (`saas/recos_ia/reco_engine.py`). La table n'est qu'un défaut ;
#   · les quatre réparations de la mesure (`connecter_ga4`, `ga4_muet`,
#     `funnel`, `theme_event_muet`) — toutes `socle` dans `_LEVIER_REGLE` : elles
#     gardent leur circuit à part (`SETUP_KEYS`, bloc « réglages »), hors des
#     places de la semaine, et `_est_conseil` ne leur demande donc aucun geste ;
#   · `theme_event_cout` — il ne demande AUCUN geste : il demande de comparer un
#     coût à sa marge. C'est un constat, et sa place est parmi les constats ;
#   · les `veille_*` — une veille dit « attends », c'est-à-dire l'absence de
#     geste. Elle est déjà hors quota partout où elle passe.
#
# Décidé dans `.scratch/refonte/issues/22-rebrancher-le-plan-de-theme.md`.
_GESTE_REGLE = {
    "scaler":             ("augmenter", "generale"),
    "silence":            ("créer", "generale"),
    "orga_rythme":        ("créer", "generale"),
    "orga_format":        ("tester", "generale"),
    "orga_reaction":      ("tester", "generale"),
    "orga_essoufflement": ("couper", "hypothese"),
    "page_endormie":      ("tester", "hypothese"),
    # LES QUATRE RÈGLES PAYANTES. Leur geste ne dépend PAS du chiffre du jour —
    # une annonce chère se coupe, une locomotive se finance — elles ont donc
    # leur ligne ici. Elles le déclarent AUSSI dans `_reco()`, à côté du texte
    # qui le justifie, exactement comme `scaler` : la table ne remplace jamais
    # ce qu'une règle a déclaré, elle garantit qu'aucune clé ne sorte sans
    # geste si la déclaration disparaissait un jour.
    # Les quatre sont « constatables » : une pause, un budget monté, un budget
    # corrigé se voient DEMAIN dans le gestionnaire, à l'œil.
    "annonce_sans_conversion": ("couper", "generale"),
    "annonce_locomotive":      ("augmenter", "generale"),
    "annonce_chere":           ("couper", "generale"),
    "theme_hors_budget":       ("corriger", "generale"),
    # LES SIX RÈGLES PAYANTES RESTANTES (ticket 10). Quatre sont
    # « constatables » — un budget corrigé, une créa remplacée, une balise
    # réparée, un jour bridé se voient DEMAIN dans l'outil, à l'œil.
    "budget_non_depense":      ("corriger", "generale"),
    "annonce_usee":            ("créer", "generale"),
    "page_arrivee_muette":     ("corriger", "generale"),
    "creneau_pub":             ("corriger", "generale"),
    # ET LES DEUX PREMIÈRES STRATÉGIES D'UN COMPTE QUI NE FAIT QUE DE LA PUB.
    # Avant elles, les deux seules clés dont la preuve était « à mesurer »
    # étaient organiques (`orga_essoufflement`, `page_endormie`) : un compte
    # sans Instagram n'ouvrait jamais de Stratégie, et Gemini n'avait donc
    # aucune Marche suivante à écrire chez lui
    # (`.scratch/refonte/issues/24-conseils-payants-manquants.md`, exigence 4).
    # Leur geste est `tester` et rien ne se constate demain : un Groupe cher
    # n'est pas forcément un mauvais Groupe, une régie qui rend moins n'est pas
    # forcément la mauvaise — on déplace une part du budget et on REGARDE.
    "adset_inegal":            ("tester", "hypothese"),
    "theme_deux_regies":       ("tester", "hypothese"),
}

# Chaque regle declare son levier par cle (`_LEVIER_REGLE`) : cette table ne
# sert donc plus qu'a un conseil qui ne serait ni une regle, ni une veille —
# gardee en repli defensif, pas en usage courant. Ordre volontaire —
# « budget » l'emporte sur « visuel » quand les deux mots sont la, parce que
# c'est le geste qui coute.
_LEVIER_MOTS = (
    ("argent", ("budget", "depense", "dépense", "investi", "cpc", "cout", "coût",
                "enchere", "enchère", "reallou", "réallou", "financ")),
    ("audience", ("audience", "ciblage", "cibl", "lookalike", "similaire",
                  "interet", "intérêt", "mot-cle", "mot-clé", "requete", "requête",
                  "exclu", "geograph", "géograph")),
    ("tempo", ("publie", "publi", "frequence", "fréquence", "rythme", "horaire",
               "creneau", "créneau", "calendrier", "regularite", "régularité")),
    ("contenu", ("visuel", "crea", "créa", "accroche", "message", "format",
                 "carrousel", "reel", "réel", "video", "vidéo", "texte", "titre",
                 "legende", "légende", "photo", "landing", "page de")),
)


def _levier(reco: dict) -> str:
    cle = reco.get("key") or ""
    if cle.startswith("veille_"):
        # Deux campagnes neuves ne font pas deux conseils : elles font un seul
        # geste, regarder. Sans ce levier commun, un compte qui lance trois
        # campagnes le meme lundi remplissait les trois places du haut de page
        # avec trois fois « attends une semaine ».
        return "veille"
    if cle in _LEVIER_REGLE:
        return _LEVIER_REGLE[cle]
    txt = f"{reco.get('title', '')} {reco.get('observation', '')}".lower()
    for nom, mots in _LEVIER_MOTS:
        if any(m in txt for m in mots):
            return nom
    return "autre"


def _attach_grammaire(reco: dict) -> dict:
    """Pose sur un conseil les colonnes qu'il n'a pas déclarées lui-même :
    le levier, le geste et la preuve. Mute `reco` et le rend.

    Le patron est celui d'`_attach_effort`/`_attach_metric` — déclarer par clé,
    poser après coup — et c'est ce qui rendait le plan de thème orphelin : les
    tables existaient, personne ne les posait sur une reco-règle. `theme_plan`
    recevait donc `levier=None` et `FENETRE_LEVIER` retombait sur son défaut.

    Ne REMPLACE jamais une valeur déjà là : une piste IA déclare ses trois
    colonnes elle-même (et se fait rejeter si elles sortent des listes fermées),
    une branche de règle déclare son geste quand il dépend du chiffre du jour.
    """
    if not reco.get("levier"):
        reco["levier"] = _levier(reco)
    if reco.get("role") not in ROLES:
        # Un rôle hors liste ne se corrige pas, il se retire : c'est le délai
        # auquel on saura, et le deviner reviendrait à promettre une preuve.
        reco.pop("role", None)
    defaut = _GESTE_REGLE.get(reco.get("key") or "")
    if defaut:
        if not reco.get("nature"):
            reco["nature"] = defaut[0]
        if not reco.get("role"):
            reco["role"] = defaut[1]
    return reco


def _est_conseil(reco: dict) -> bool:
    """Un conseil demande un GESTE. Sans geste, c'est un constat — et un constat
    n'occupe aucune des places de la semaine.

    Deux circuits restent dehors, et ce n'est pas une exception de confort :
      · la VEILLE dit « attends, ce sera lisible le 24 » — l'absence de geste
        est tout son contenu, et elle s'affiche déjà hors quota ;
      · le SOCLE (GA4, funnel, événement muet) est un prérequis de MESURE. Tant
        qu'on ne sait pas si le tag marche, il n'y a rien à arbitrer : ces
        conseils vivent dans le bloc « réglages », pas dans les places de la
        semaine.
    Le reste — une règle qui ne sait pas dire quel geste elle demande — n'est
    jamais servi : un geste hors de `NATURES` n'est pas un geste, c'est un mot.
    """
    if _est_veille(reco) or _levier(reco) == "socle":
        return True
    return reco.get("nature") in NATURES


def _une_seule_hypothese(recos: list[dict]) -> list[dict]:
    """Une théorie par thème à la fois — la première de la liste, les autres
    retirées.

    POURQUOI C'EST UNE RÈGLE ET PAS UN CONFORT (ticket 27 de la construction).
    Une Hypothèse ouvre une Stratégie sur son thème (`theme_plan`), et la
    contrainte `UNIQUE (user_id, theme)` n'en laisse tourner qu'UNE. Servies à
    deux, la carte affichait deux théories concurrentes, la boucle d'écriture
    n'en suivait qu'une (`next(...)`), et rien sur la carte ne disait laquelle.
    Mesuré hors ligne dans `.scratch/construction/harnais/27-une-theorie-par-theme/`
    (`mesure.py`) : `adset_inegal` et `page_endormie` sortaient ensemble sur le
    même thème, toutes les semaines.

    L'ARBITRE EST L'ORDRE REÇU, c'est-à-dire `_importance` — celui dont tout le
    rapport se sert déjà. `regles_payantes` tranche ses DEUX Hypothèses à elle
    sur l'argent en jeu (`_enjeu`), ce qu'elle peut faire parce qu'elle les
    connaît toutes les deux ; le cas général ne le peut pas, les règles
    organiques ne déclarent aucun enjeu en francs. Comparer un thème qui
    s'essouffle sur Instagram à un Groupe d'annonces cher demanderait une
    échelle commune qui n'existe pas — et l'inventer serait trancher là où la
    donnée ne tranche pas.

    RETIRER, ET NON DÉCLASSER EN CONSTAT : la théorie écartée n'est pas fausse,
    elle est en trop cette semaine. La garder sans son rôle ferait lire un
    geste « à mesurer » comme un geste constatable demain, ce que `ROLES` sert
    précisément à distinguer.
    """
    gardee = False
    retenus = []
    for reco in recos:
        if reco.get("role") == "hypothese":
            if gardee:
                continue
            gardee = True
        retenus.append(reco)
    return retenus


def _slug_constat(valeur) -> str:
    """La normalisation des clés de constat — la même qu'`insights.py::_slug`,
    et pour la même raison : une clé qui change de casse ou d'espace change
    d'identité, et le verdict du client la suit (`insight_feedback`)."""
    return str(valeur or "").strip().lower().replace(" ", "-")


def _constat_cout(reco: dict, theme: str, feedback: dict, fenetre: str) -> dict:
    """Transforme `theme_event_cout` en CONSTAT, la place qu'il aurait dû avoir.

    Il ne demande aucun geste : il demande de comparer un coût par conversion à
    sa propre marge, ce qui se fait hors de l'outil et ne se vérifie nulle part
    ici. `_est_conseil` le jetait donc en silence depuis le ticket 06 — calculé
    chaque semaine, publié nulle part. Le ticket 09 lui rend sa place parmi les
    constats, avec le reste de « ce qui marche chez toi ».

    LA CLÉ PORTE LE THÈME **ET** L'ÉVÉNEMENT, et c'est ce qui la rend stable au
    sens d'`insight_feedback` : un client qui change d'événement principal ne
    parle plus du même chiffre, et un « ✗ pas d'accord » posé sur l'ancien ne
    doit pas museler le nouveau. Même raisonnement que les clés d'`insights.py`.

    `angle_mort` VOYAGE AVEC LE CONSTAT — c'est la phrase qui dit ce que ce coût
    NE compte pas (ce qui arrive sans campagne n'y entre pas). Un coût par
    conversion sans elle se lit comme une mesure complète alors qu'il est une
    borne haute (`CLAUDE.md` §7).

    `fenetre` EST OBLIGATOIRE, ET C'EST LE MÊME §7. Ce constat est le SEUL du
    bloc à porter une semaine : il naît de `_reco_evenements`, nourrie de
    `_semaine_theme(lbl, cur_since, last_full_day)`, quand tous les autres
    sortent de `build_constats` qui croise tout l'historique. Le bloc qui les
    affiche annonce « tout ton historique » — sans sa fenêtre écrite dans son
    détail, une dépense de sept jours se lirait comme un total depuis janvier.
    """
    cle = f"cout_conversion:{_slug_constat(theme)}:{_slug_constat(reco.get('cible'))}"
    detail = (reco.get("observation") or "").rstrip()
    return {
        "key": cle,
        "kind": "cout_conversion",
        "title": reco.get("title") or "",
        "detail": f"{detail} Ce constat-ci porte sur {fenetre}, pas sur tout "
                  "l'historique comme les autres.",
        "angle_mort": reco.get("angle_mort") or None,
        "status": feedback.get(cle, "new"),
        "platform": "pub",
    }


# ── L'IMPORTANCE D'UN CONSEIL ────────────────────────────────────────────────
#
# Le tri qui existait classait par (theme prioritaire, confiance, facilite).
# Deux de ces trois criteres ne parlent pas d'importance :
#
#   · la CONFIANCE dit si j'ai raison, pas si ca compte. Un constat solide sur
#     un theme a 40 CHF passait devant une alerte sur un theme a 4 000 CHF ;
#   · la FACILITE dit ce que ca coute a faire. Trier dessus fabrique une liste
#     de petites taches, et une liste de petites taches n'est pas une liste des
#     choses importantes — c'est l'inverse.
#
# CE QUE LE CLIENT A DÉSIGNÉ N'EST PLUS UN CRITÈRE DE TRI, ET C'EST LE POINT DU
# TICKET 08 DE LA CONSTRUCTION. C'était le premier élément du tuple : un thème
# prioritaire passait devant, et les conseils des autres thèmes sortaient quand
# même, simplement plus bas. Ce n'est pas ce que le produit dit. Les conseils
# ne portent QUE sur les thèmes prioritaires — c'est un filtre dur, appliqué à
# la source (`_conseille`, dans `build_payload`), et un filtre ne se double pas
# d'un critère de tri : il ne reste rien à départager sur cet axe.
#
# Les criteres retenus, dans l'ordre, et pourquoi cet ordre :
#
#   1. CE QUI PESE LE PLUS. `rang` est le rang du theme du conseil dans le
#      compte — voir `_poids_theme` dans build_payload. C'est le seul critere
#      qui parle d'enjeu, il passe donc avant tous les autres.
#   2. CE QUI SE PERD PENDANT QU'ON LIT. Une campagne déclarée qui ne dépense
#      rien perd un jour par jour, et elle n'est dans aucun chiffre du rapport.
#      C'est le seul conseil dont le coût augmente tant qu'on ne l'a pas lu.
#   3. CE QUI EST LE PLUS SÛR. La confiance, une fois l'enjeu tranché.
#   4. Puis seulement la facilité, et la priorité du moteur, pour départager.
#      `priority` est le POIDS D'IMPACT déclaré par la règle qui écrit le
#      conseil : changer un CPC cible ne pèse pas ce que pèse une légende. Il
#      pondère le tri et ne sort jamais d'ici — un « impact élevé » montré au
#      client serait un chiffre fabriqué (`CLAUDE.md` §7).
#
# Et une veille ordinaire FERME LA MARCHE de son thème. Elle dit « il n'y a
# rien à faire, attends le 24 » : c'est utile à lire, ça n'a rien à faire en
# tête d'une liste de choses à faire.
#
# Ce tuple est INTERNE. Il ne devient jamais un score affiché : ce serait un
# chiffre non mesuré présenté comme mesuré.
_CONF_W = {"solide": 0, "creuser": 1, "piste": 2}
_EFF_W = {"10 min": 0, "30 min": 1, "1 h": 2, "2 h+": 3}


def _importance(reco: dict, rang: int = 0) -> tuple:
    """La clé de tri d'un conseil. Plus petit = plus important.

    `rang` : le rang du thème porteur dans le compte (0 = celui qui pèse le
    plus). À l'intérieur d'un seul thème il est constant, et le tuple se lit
    alors comme un classement de ce qu'il y a à faire sur ce thème-là.
    """
    veille, urgente = _est_veille(reco), _veille_urgente(reco)
    return (
        rang,
        0 if urgente else 1,
        1 if (veille and not urgente) else 0,
        _CONF_W.get(reco.get("confidence"), 3),
        _EFF_W.get(_effort_de(reco), 2),
        reco.get("priority", 99),
    )


# ── L'ORGANIQUE A DROIT À SES PROPRES CONSEILS ───────────────────────────────
#
# `saas/recos_ia/reco_engine.py` portait quatre règles Instagram, mais elles
# sont taillées pour le COMPTE ENTIER : `_rule_page_endormie` demande 5 posts
# plus 100 abonnés, `_rule_silence` ne parle que d'une semaine restée vide, et
# les deux autres (`_rule_creneau`, 20 posts ; `_rule_format_gagnant`) sont
# mortes au ticket 09 — elles répondaient à la question des constats. Depuis le
# passage au rapport par thème, celles qui restent tournent sur les posts D'UN
# SEUL THÈME, et à cette échelle elles ne se déclenchent presque jamais. Les
# trois places du thème partaient donc à l'IA, nourrie d'un prompt qui ne parle
# que de campagnes : l'organique n'avait pas de conseils, il avait des
# suppositions.
#
# Les quatre règles ci-dessous raisonnent à l'échelle d'un thème et ne lisent
# que ce qui est déjà en base (`instagram_organic_posts`) : la date, le format,
# la portée et les interactions de chaque publication. Aucune ne demande une
# donnée qu'on n'a pas. Même grammaire que les autres : ce que je vois,
# pourquoi ça peut arriver, comment vérifier avant d'agir, ce que je ne vois
# pas, et un niveau de confiance.
_ORGA_RECENT = 28   # « en ce moment » — quatre semaines pleines
_ORGA_REF = 84      # les trois mois d'avant, le point de comparaison


def _orga_prep(posts, jusqu_au):
    """Les colonnes dont les règles organiques ont besoin, calculées une fois."""
    if posts is None or len(posts) == 0 or "date" not in posts.columns:
        return None
    d = posts.copy()
    d["_j"] = pd.to_datetime(d["date"], errors="coerce", utc=True)
    d = d.dropna(subset=["_j"])
    if d.empty:
        return None
    d["_jour"] = d["_j"].dt.date
    for col in ("reach", "likes", "comments", "saved"):
        d[col] = (pd.to_numeric(d[col], errors="coerce").fillna(0)
                  if col in d.columns else 0.0)
    d["_inter"] = d["likes"] + d["comments"] + d["saved"]
    # La règle maison : aucune fenêtre ne mord sur le jour en cours.
    d = d[d["_jour"] <= jusqu_au]
    return d if not d.empty else None


def _orga_rythme(theme, dt, jusqu_au):
    """Le tempo du thème : ce qu'on publie maintenant contre ce qu'on publiait.

    Deux sorties possibles, et elles ne disent pas la même chose :
      · `orga_rythme`        — le thème a ralenti ;
      · `orga_essoufflement` — on publie plus et l'audience totale ne suit pas.
    Le troisième cas — publier plus et être plus vu — ne rend rien : c'est une
    félicitation, et une félicitation n'est pas un conseil.
    """
    bord = jusqu_au - timedelta(days=_ORGA_RECENT - 1)
    recent = dt[dt["_jour"] >= bord]
    ref = dt[(dt["_jour"] < bord) & (dt["_jour"] >= bord - timedelta(days=_ORGA_REF))]
    if len(ref) < 4:
        return []   # pas de passé, donc pas de tempo à comparer
    n_rec = len(recent)
    # Les deux cadences ramenées au même dénominateur : posts par 4 semaines.
    n_ref = len(ref) * _ORGA_RECENT / _ORGA_REF
    if n_ref <= 0:
        return []
    ecart = (n_rec - n_ref) / n_ref

    if ecart <= -0.4:
        r_ref = float(ref["reach"].mean())
        solide = len(ref) >= 10 and n_rec >= 1
        return [_reco_dict(
            "orga_rythme", "instagram",
            f"« {theme} » est passé de {n_ref:.0f} à {n_rec} publication"
            f"{'s' if n_rec > 1 else ''} par mois",
            f"Sur les 4 dernières semaines, {n_rec} publication"
            f"{'s' if n_rec > 1 else ''} sur ce thème. Sur les 3 mois d'avant, tu en "
            f"faisais {n_ref:.0f} par période de 4 semaines.",
            "Un thème qu'on nourrit moins sort moins : Instagram montre surtout ce "
            "qui est récent, et une thématique qui disparaît quelques semaines perd "
            "l'audience qu'elle s'était faite.",
            "Regarde d'abord si c'est voulu — une saison qui se termine, une offre "
            "retirée. Si ça ne l'est pas, remets une publication sur ce thème cette "
            f"semaine et compare sa portée aux {r_ref:,.0f} que ce thème faisait "
            "avant : c'est ce chiffre-là qui dira si l'audience est encore là.",
            "Je compte des publications, pas ce qu'elles t'ont rapporté. Publier "
            "moins mais mieux est une stratégie valable — ce chiffre ne la distingue "
            "pas d'un abandon.",
            "solide" if solide else "creuser", 3,
            repere="Le repère : un thème se tient à partir d'une publication toutes "
                   "les deux semaines. En dessous, il redevient un sujet parmi d'autres.",
        )]

    if ecart >= 0.4:
        # On publie plus. La question n'est pas la moyenne par post — elle
        # baisse mécaniquement quand on publie plus — mais la portée TOTALE :
        # est-ce que ce travail en plus va chercher du monde en plus ?
        tot_rec = float(recent["reach"].sum())
        tot_ref = float(ref["reach"].sum()) * _ORGA_RECENT / _ORGA_REF
        if tot_ref <= 0 or tot_rec > tot_ref * 1.05:
            return []
        return [_reco_dict(
            "orga_essoufflement", "instagram",
            f"Tu publies plus sur « {theme} », et tu ne touches pas plus de monde",
            f"{n_rec} publications sur les 4 dernières semaines contre {n_ref:.0f} "
            f"avant, pour une portée cumulée de {tot_rec:,.0f} contre {tot_ref:,.0f}. "
            "Le travail a augmenté, l'audience non.",
            "Deux publications la même semaine se prennent une partie de l'audience "
            "l'une à l'autre. Ça peut aussi être que la cadence a été tenue en "
            "baissant l'exigence sur ce qu'on publie.",
            "Prends les 3 publications les moins vues du mois et demande-toi si tu "
            "les aurais publiées seules. Si la réponse est non, reviens à ta cadence "
            "d'avant pendant 4 semaines et regarde si la portée cumulée tient.",
            "Je mesure la portée, pas la fatigue : une cadence intenable qui ne se "
            "voit pas encore dans les chiffres se voit quand même dans ton agenda.",
            "solide" if (n_rec >= 8 and len(ref) >= 12) else "creuser", 3,
            repere="Le repère : si doubler le nombre de posts ne fait pas monter la "
                   "portée cumulée d'au moins un tiers, la cadence te coûte plus "
                   "qu'elle ne te rapporte.",
        )]
    return []


def _art(fmt: str) -> str:
    """« le Reel », « l'Image » — l'article qui va avec un nom de format.

    Les noms viennent de `FORMAT_LABELS`, qui les capitalise pour les tableaux.
    En pleine phrase il leur faut leur article, et « le Image » se voit.
    """
    return ("l'" if str(fmt)[:1].upper() in "AEIOU" else "le ") + str(fmt)


def _orga_format(theme, dt):
    """Quel format porte CE thème — pas quel format porte le compte."""
    if "type" not in dt.columns:
        return []
    d = dt.copy()
    d["_fmt"] = d["type"].map(lambda t: FORMAT_LABELS.get(str(t).upper(), str(t)))
    g = d.groupby("_fmt")["reach"].agg(["count", "mean"])
    g = g[g["count"] >= 3]
    if len(g) < 2:
        return []
    g = g.sort_values("mean", ascending=False)
    haut, bas = g.index[0], g.index[-1]
    r_haut, r_bas = float(g.iloc[0]["mean"]), float(g.iloc[-1]["mean"])
    n_haut, n_bas = int(g.iloc[0]["count"]), int(g.iloc[-1]["count"])
    if r_bas <= 0 or r_haut / r_bas < 1.4:
        return []
    ratio = r_haut / r_bas
    return [_reco_dict(
        "orga_format", "instagram",
        f"Sur « {theme} », {_art(haut)} porte {ratio:.1f}× plus que {_art(bas)}",
        f"{n_haut} publication{'s' if n_haut > 1 else ''} en {haut} : "
        f"{r_haut:,.0f} de portée moyenne. {n_bas} en {bas} : {r_bas:,.0f}.",
        "Un format ne vaut pas mieux qu'un autre dans l'absolu, mais sur un sujet "
        "donné l'un raconte mieux que l'autre. Instagram pousse aussi les Reels "
        "au-delà de tes abonnés, ce que ne font ni l'image ni le carrousel.",
        f"Reprends un sujet que tu as déjà traité en {bas} et refais-le en {haut}. "
        "Deux versions du même sujet, c'est la seule comparaison où le format est la "
        "seule chose qui change.",
        f"Je compare des formats, pas des sujets : si tes {haut}s traitent tes "
        "meilleurs sujets, c'est le sujet que je mesure et pas le format.",
        "solide" if (n_haut >= 5 and ratio >= 1.8) else "creuser", 3,
        repere="Le repère : un écart de format se confirme sur 5 publications de "
               "chaque côté. En dessous, deux bons posts suffisent à créer l'illusion.",
    )]


def _orga_reaction(theme, dt, compte):
    """Le thème qui fait réagir ceux qui le voient, mais qui est peu vu.

    Le cas inverse — vu mais sans réaction — n'est pas écrit : il ne se termine
    par aucun geste précis (« fais du meilleur contenu » n'est pas un conseil),
    et il rate donc le test de la décision.
    """
    if len(dt) < 4 or len(compte) < 10:
        return []
    r_t, r_c = float(dt["reach"].mean()), float(compte["reach"].mean())
    i_t, i_c = float(dt["_inter"].mean()), float(compte["_inter"].mean())
    if r_c <= 0 or i_c <= 0:
        return []
    if not (r_t <= r_c * 0.75 and i_t >= i_c * 1.25):
        return []
    return [_reco_dict(
        "orga_reaction", "instagram",
        f"« {theme} » fait réagir, mais il est peu vu",
        f"Un post de ce thème récolte {i_t:.0f} interactions en moyenne, contre "
        f"{i_c:.0f} sur l'ensemble de ton compte — pour une portée de {r_t:,.0f} "
        f"contre {r_c:,.0f}.",
        "Quand un contenu fait réagir ceux qui le voient mais touche peu de monde, "
        "ce n'est pas le contenu qui coince, c'est sa diffusion : le moment de "
        "publication, le format, ou le fait qu'il ne sorte pas de tes abonnés.",
        "Republie un sujet de ce thème en Reel, sur ton meilleur créneau, et regarde "
        f"si la portée rejoint tes {r_c:,.0f} habituels. Si oui, tu tenais un "
        "problème de diffusion. Si non, le sujet parle à une partie seulement de ton "
        "audience — et c'est une information, pas un échec.",
        "Un thème très commenté peut l'être par les mêmes cinq personnes. Je compte "
        "les interactions, je ne sais pas qui les fait.",
        "solide" if len(dt) >= 8 else "creuser", 2,
        repere="Le repère : un contenu qui dépasse ta moyenne d'interactions tout en "
               "restant sous ta portée moyenne est un contenu à pousser, pas à corriger.",
    )]


def _orga_recos(theme, posts_theme, posts_compte, jusqu_au) -> list[dict]:
    """Les conseils organiques d'un thème. [] si le thème ne publie pas assez.

    Chaque règle est isolée : une qui plante n'emporte pas les autres, comme
    dans `build_recos`. Le rapport ne casse jamais pour un conseil.
    """
    dt = _orga_prep(posts_theme, jusqu_au)
    if dt is None:
        return []
    compte = _orga_prep(posts_compte, jusqu_au)
    out: list[dict] = []
    for regle in (lambda: _orga_rythme(theme, dt, jusqu_au),
                  lambda: _orga_format(theme, dt),
                  lambda: _orga_reaction(theme, dt, compte) if compte is not None else []):
        try:
            out += regle() or []
        except Exception:
            pass
    return out


# ── LA CAMPAGNE LANCÉE DEPUIS PEU ────────────────────────────────────────────
#
# Quatorze jours. La borne n'est pas ronde par confort :
#
#   · en dessous d'une semaine, rien n'est à elle. Meta comme Google passent
#     les premiers jours à chercher qui répond ; le coût par clic de ces
#     jours-là est celui de cette recherche, pas celui de la campagne. Le
#     comparer à la médiane du compte — ce que fait `_rule_gaspillage` — rend
#     un verdict sur du bruit, et un verdict faux coûte plus cher que pas de
#     verdict du tout ;
#   · au-delà de deux semaines, elle a normalement franchi les planchers à
#     partir desquels les règles du compte ont le droit de parler : 50 CHF
#     dépensés (`SEUILS["cpc_spend_min"]`), 1 000 impressions
#     (`SEUILS["ctr_impressions_min"]`), les ~50 clics dont parle le repère de
#     la règle gaspillage. Elle n'est plus une nouveauté, c'est une campagne
#     comme les autres, et elle se juge comme les autres.
#
# Quatorze jours, c'est enfin l'horloge de Pulse : le verdict d'une action se
# rend quatorze jours après qu'elle a été faite. Une campagne neuve et une
# action prise deviennent lisibles le même jour — le produit n'a qu'un tempo.
#
# Ce conseil-là ne demande RIEN à faire, et c'est le sujet : il dit ce qu'on
# surveille, à partir de quand ce sera lisible, et ce qui déclencherait une
# alerte. Sa clé commence par `veille_`, ce que le front lit pour retirer le
# bouton « Je le teste » — une veille n'a pas de verdict à mériter.
_VEILLE_JOURS = 14

# ── COMBIEN DE THÈMES REÇOIVENT DES CONSEILS ─────────────────────────────────
#
# TROIS, ET C'EST LA PHRASE DU PRODUIT. Pulse n'arbitre pas entre les thèmes :
# le client désigne ses priorités — trois au maximum — et Pulse conseille
# DEDANS. Un thème que le client n'a pas mis en priorité reçoit sa carte, ses
# chiffres, sa courbe et sa veille, mais **aucun conseil**. Tranché par
# `.scratch/refonte/issues/21-le-document-de-refonte.md`, David mot pour mot :
# « Les labels sont les recos pour les labels prio. Fin. »
#
# C'EST UN FILTRE DUR, PAS UN TRI. Le code d'avant mettait `is_priority` en tête
# d'`_importance` et laissait les autres sortir plus bas : le client voyait donc
# des conseils sur des thèmes qu'il n'avait pas désignés, simplement rangés
# après. Ici, ils n'existent pas.
#
# CE NOMBRE NE PROTÈGE PLUS UNE FACTURE. Il a porté ce rôle : il s'appelait
# `_THEMES_IA` et comptait les thèmes que Gemini rédigeait (jusqu'à deux appels
# chacun). Les pistes rédigées sont coupées — c'était le seul endroit où Pulse
# disait quelque chose que rien ne peut vérifier — et le nombre est redevenu ce
# qu'il dit : le nombre de thèmes sur lesquels on travaille.
#
# « LES TROIS PREMIERS » AU SENS DE L'ÉTOILAGE — voir `_labels_prioritaires`
# juste dessous pour le pourquoi de cet ordre-là plutôt qu'un autre. C'est le
# seul critère sur lequel le client peut agir : pour faire monter un thème, il
# retire une étoile posée avant.
_THEMES_CONSEILLES = 3


def _labels_prioritaires(lecteur, ins_fb: dict) -> list:
    """Les thèmes étoilés par le client, DU PLUS ANCIEN ÉTOILAGE AU PLUS RÉCENT.

    L'ordre n'est pas décoratif : c'est lui qui décide des `_THEMES_CONSEILLES`
    thèmes qui reçoivent des conseils. Trois candidats se présentaient, et deux
    ont été écartés.

    L'ALPHABÉTIQUE — ce qu'on faisait — ne veut rien dire, et le fichier le dit
    déjà ailleurs (`_rang_theme` : « les thèmes prioritaires arrivent triés par
    ordre alphabétique, ce qui ne veut rien dire »). Tant que le tri ne servait
    qu'à couper à trois une liste de trois, c'était sans conséquence ; il
    tranche maintenant entre six thèmes.

    LE POIDS (dépense + publications, `_poids_theme`) est le critère que le
    produit utilise partout ailleurs pour classer, et il serait défendable —
    sauf sur le seul point qui compte ici : le client ne peut pas AGIR dessus.
    La carte d'un thème sans conseils doit dire ce qu'il faut faire pour en
    avoir ; sous le poids, la réponse serait « dépense plus sur ce thème », ce
    qui est un conseil absurde et, pire, un conseil qui nous arrange.

    L'ORDRE DE L'ÉTOILAGE est le seul qui soit à la fois stable, déjà en base
    (`insight_feedback.created_at`) et RÉVERSIBLE PAR LE CLIENT : pour faire
    monter un thème, il retire une étoile posée avant. C'est aussi celui qui
    respecte le premier critère d'`_importance` — « ce que le client a désigné,
    on ne le corrige pas ».

    Le repli alphabétique n'est pas un choix, c'est un filet : si la relecture
    datée échoue (table absente, colonne absente), on préfère un ordre arbitraire
    à un thème perdu. Aucun thème étoilé ne disparaît de cette liste.
    """
    noms = {k.split(":", 1)[1] for k, v in (ins_fb or {}).items()
            if k.startswith("priority_label:") and v == "agree" and ":" in k}
    if not noms:
        return []
    ordre: list = []
    try:
        rows = lecteur.priorites_datees()
        for r in rows:
            nom = str(r.get("insight_key") or "").split(":", 1)[-1]
            if nom in noms and nom not in ordre:
                ordre.append(nom)
    except Exception:
        ordre = []
    ordre += sorted(n for n in noms if n not in ordre)
    return ordre


def _reco_veille(camp, jusqu_au) -> dict | None:
    """Le mini-conseil d'une campagne trop jeune pour être jugée."""
    debut = camp.get("debut")
    if debut is None:
        return None
    age = (jusqu_au - debut).days + 1
    if not (1 <= age <= _VEILLE_JOURS):
        return None
    nom = str(camp.get("nom") or "")[:40]
    canal = camp.get("canal") or "meta"
    cle = f"veille_{canal}_{nom}"
    lisible = debut + timedelta(days=_VEILLE_JOURS)
    lisible_txt = f"{lisible.day} {MONTHS_FR[lisible.month]}"

    if camp.get("muette"):
        # DÉCLARÉE ET MUETTE. Ce n'est pas une veille tiède, c'est le seul cas
        # où une campagne perd 100 % de ce qu'elle devait faire — et où
        # personne ne s'en aperçoit, puisqu'elle n'apparaît dans aucun chiffre.
        return _reco_dict(
            cle + "_muette", canal,
            f"« {nom} » devait démarrer le {debut.day} {MONTHS_FR[debut.month]} "
            "et n'a rien dépensé",
            f"La plateforme la déclare démarrée depuis {age} jour"
            f"{'s' if age > 1 else ''}. Aucune dépense n'est remontée sur cette "
            "période : elle n'existe dans aucun chiffre de ce rapport.",
            "Trois causes classiques, et toutes rapides à écarter : la campagne est "
            "encore en revue, le moyen de paiement du compte a été refusé, ou le "
            "budget quotidien est resté à zéro.",
            "Ouvre-la dans le gestionnaire : le statut y est écrit noir sur blanc. "
            "L'alerte, c'est un jour de plus de silence — une campagne déclarée qui "
            "ne dépense pas ne perd pas d'argent, elle perd des jours, et les jours "
            "ne se rattrapent pas.",
            "Je lis ta dépense, pas le statut de la campagne. Une récolte en retard "
            "donne exactement la même image qu'une campagne bloquée — le gestionnaire "
            "tranche en trente secondes, moi non.",
            "creuser", 1,
            repere="Le repère : une campagne validée dépense dans les 24 heures. "
                   "Passé 48 heures sans un franc, ce n'est plus un délai, c'est un "
                   "blocage.",
        )

    jours = len(camp.get("jours") or ())
    depense = float(camp.get("depense") or 0)
    clics = int(camp.get("clics") or 0)
    impr = int(camp.get("impressions") or 0)
    seuil_impr = int(SEUILS["ctr_impressions_min"])
    seuil_chf = int(SEUILS["cpc_spend_min"])
    return _reco_dict(
        cle, canal,
        f"« {nom} » tourne depuis {age} jour{'s' if age > 1 else ''} — trop tôt "
        "pour la juger",
        f"{jours} jour{'s' if jours > 1 else ''} de diffusion, {depense:,.0f} CHF "
        f"dépensés, {impr:,} impressions, {clics} clic{'s' if clics > 1 else ''}. "
        "Les autres campagnes de ce rapport sont jugées sur des semaines pleines ; "
        "celle-ci n'en a pas encore une.",
        "Meta et Google passent les premiers jours à chercher qui répond. Le coût "
        "par clic de cette période est celui de cette recherche, pas celui de la "
        "campagne — c'est pour ça qu'elle est tenue à l'écart des comparaisons de "
        "coût du rapport plutôt que d'y figurer avec un chiffre trompeur.",
        "Deux choses, et deux seulement. Qu'elle dépense tous les jours : une "
        "campagne neuve qui saute un jour est refusée ou plafonnée, pas lente. Et "
        "que les impressions montent. L'alerte : deux jours d'affilée sans une "
        f"dépense, ou {seuil_impr:,} impressions sans un seul clic — dans ce cas "
        "c'est l'annonce qu'il faut reprendre, jamais le budget.",
        "Je lis ta dépense, pas ce qu'elle rapporte : GA4 n'attribue rien de fiable "
        "à une campagne aussi jeune. Et si elle a démarré en milieu de semaine, ses "
        "chiffres se comparent à des semaines pleines — ils paraîtront petits même "
        "si elle va bien.",
        "piste", 2,
        repere=f"Elle devient lisible le {lisible_txt} : elle aura sa semaine "
               f"pleine, et les {seuil_chf} CHF et ~50 clics à partir desquels un "
               "écart de coût veut dire quelque chose. D'ici là, ce rapport la "
               "laisse tranquille.",
    )


# ── LE THÈME QUI NE DÉCLENCHE RIEN ───────────────────────────────────────────
#
# CE QUE DISAIT LA CARTE, ET POURQUOI C'ÉTAIT FAUX. Quand `recos` sortait vide,
# `theme-card.tsx` écrivait « Rien d'urgent sur ce thème cette semaine — il
# tourne dans ses normes », sous un titre qui promet « comment l'améliorer
# cette semaine ». Un module qui s'annule lui-même, et une affirmation que les
# chiffres contredisent une fois sur deux.
#
# CE QUE ÇA REPRÉSENTE, MESURÉ. Sur les dix rapports déjà publiés en base :
# 3 cartes vides sur 18 (17 %), et surtout 12 cartes sur 18 sans AUCUN
# conseil-règle — les trois quarts de ce qui s'affiche vient de Gemini. Rejeu
# des règles sur 12 semaines et 2 comptes réels, en ne gardant que les thèmes
# assez lourds pour mériter une carte : 17 cartes vides sur 120, soit 14 %.
# Ce n'est donc ni un cas rare (une carte sur sept) ni une majorité.
#
# CE QUE CES 17 CARTES SONT VRAIMENT — et c'est là que la phrase ment :
#   · 11 sur 17 sont UN thème mort depuis dix semaines (0 CHF, 0 publication) ;
#   · 6 sur 17 sont UN thème à 300–1 100 CHF par semaine et 5 000 à 14 000
#     clics, sur un compte SANS Google Analytics : on voit tout ce qu'il coûte
#     et rien de ce qu'il rapporte.
# Aucun des deux ne « tourne dans ses normes ». Le premier ne tourne plus, le
# second tourne sans qu'on sache vers quoi.
#
# LA RÉPONSE, ET CE QU'ELLE N'EST PAS. Fabriquer un conseil pour remplir le
# vide apprendrait au lecteur à sauter la section — c'est le contraire du but.
# Deux objets seulement, et ce sont des VEILLES, pas des conseils : une veille
# dit ce qu'on surveille, elle ne demande pas d'agir, elle ne porte pas
# « ▶ Je le teste » et elle n'a donc aucun verdict à mériter (clé `veille_…`,
# lue par `reco-card.tsx` comme par `_est_veille`).
_ARRET_REF_CHF = SEUILS["cpc_spend_min"]        # 50 CHF sur les 4 semaines d'avant
_ARRET_SEM_CHF = SEUILS["cpc_spend_min"] / 2    # 25 CHF la semaine juste avant
_CALME_REF = 28                                 # la « norme » d'un thème : 4 semaines
_CALME_PILOTE = 4                               # au-delà, la régularité devient le sujet
_CALME_CLICS_MIN = 50                           # même plancher que le repère de la veille


def _reco_theme_arret(theme, sem, prec, ref, posts_sem, frais) -> dict | None:
    """Un thème qui dépensait, et qui vient de s'arrêter net.

    LE TROU QU'ELLE BOUCHE. `_rule_silence` dit déjà « aucun post cette semaine
    alors que tu as une cadence ». Rien ne le disait côté publicité : toutes les
    règles pub comparent des campagnes ENTRE elles pendant la semaine, donc une
    semaine sans campagne ne leur donne rien à comparer et elles se taisent —
    c'est exactement le cas où il faudrait parler. Mesuré sur 12 semaines et
    2 comptes : 7 déclenchements, dont 5 sur des cartes où rien d'autre ne
    sortait. Environ un par compte et par trimestre.
    (Le pendant organique n'est PAS écrit : sur les 11 arrêts relevés, 3 des 4
    arrêts organiques tombaient sur une carte où `_rule_silence` parlait déjà.
    Une règle en plus qui répète une règle existante n'est pas une règle.)

    LES DEUX PLANCHERS, ET D'OÙ ILS VIENNENT. 50 CHF sur les 4 semaines d'avant,
    c'est `SEUILS["cpc_spend_min"]` — le montant à partir duquel ce produit
    s'autorise déjà à juger une dépense. 25 CHF la semaine juste avant, sa
    moitié : sans lui, un thème qui s'éteignait doucement sur six semaines
    déclenchait une « rupture » au moment où il ne restait plus rien à rompre.

    `frais` EST LA CONDITION QUI REND LE CONSTAT SOLIDE. Une récolte en retard
    donne exactement la même image qu'une campagne coupée. La règle ne parle
    donc que si la régie qui portait ce thème a des données jusqu'au dernier
    jour du rapport — sinon elle se tait, plutôt que d'annoncer un arrêt qui
    n'est qu'un retard de fetch.

    La clé finit par `_muette` : c'est le signal que `reco-card.tsx` et
    `_veille_urgente` lisent tous les deux pour la traiter comme la veille d'une
    campagne déclarée qui ne dépense pas — même nature (de l'argent qui devait
    couler et ne coule pas), même place en tête.
    """
    if not frais:
        return None
    if sem["spend"] > 0 or posts_sem > 0:
        return None
    if prec["spend"] < _ARRET_SEM_CHF or ref["spend"] < _ARRET_REF_CHF:
        return None
    return _reco_dict(
        f"veille_theme_{theme}_muette", "pub",
        f"« {theme} » n'a plus rien dépensé cette semaine",
        f"0 CHF sur les 7 jours du rapport, contre {prec['spend']:,.0f} CHF la "
        f"semaine d'avant et {ref['spend']:,.0f} CHF sur les 4 semaines "
        "précédentes. Ce thème n'apparaît plus dans aucun chiffre de ce rapport.",
        "Quatre causes, et elles donnent toutes la même image : la campagne est "
        "arrivée à sa date de fin, le budget de la période est épuisé, le moyen "
        "de paiement du compte a été refusé, ou quelqu'un a mis en pause sans "
        "prévoir la suite.",
        "Ouvre tes campagnes de ce thème dans le gestionnaire : le statut y est "
        "écrit noir sur blanc, et c'est trente secondes. Si l'arrêt est voulu, "
        "retire l'étoile de ce thème sur la page Thèmes — sa carte reviendra "
        "chaque lundi tant qu'elle y sera. S'il ne l'est pas, chaque jour de "
        "plus est un jour perdu, pas un franc perdu, et les jours ne se "
        "rattrapent pas.",
        "Je lis ta dépense, pas ton intention : un arrêt planifié et un blocage "
        "de paiement s'écrivent tous les deux « 0 CHF ». Et je ne vois que la "
        "publicité — un thème que tu continues en boutique ou par e-mail est "
        "invisible ici.",
        "solide", 1,
        repere=f"Le repère : ce thème tournait à {ref['spend'] / 4:,.0f} CHF par "
               "semaine. Une semaine à zéro est une information ; deux semaines "
               "à zéro sans décision, c'est la décision qui a été prise à ta place.",
    )


def _reco_theme_calme(theme, sem, hebdo, calmes, aveugle, silence_sem) -> dict:
    """LE FILET. Ce qu'on écrit quand aucune règle ne s'est déclenchée.

    Il ne se déclenche QU'APRÈS les règles et les pistes IA (voir `build_payload`)
    : il ne prend jamais une place, il occupe celle qui restait vide. Et il ne
    peut pas ne rien rendre — c'est tout son intérêt.

    DEUX BRANCHES, PARCE QUE « RIEN À DIRE » RECOUVRE DEUX ÉTATS OPPOSÉS :
      · le thème ne produit plus rien. Le sujet n'est pas le thème, c'est sa
        carte : elle occupe la place d'un thème vivant. La décision est sur la
        page Thèmes, pas dans le gestionnaire ;
      · le thème tourne, et rien n'en sort de sa fourchette habituelle. Là, la
        seule chose honnête est de NOMMER cette fourchette et le seuil au-delà
        duquel j'alerterai — un lecteur qui sait à partir de quand s'inquiéter
        n'a plus besoin qu'on l'inquiète.

    CE QUI L'EMPÊCHE D'ÊTRE LA MÊME PHRASE TROIS LUNDIS DE SUITE. Ses chiffres
    changent chaque semaine, mais ça ne suffirait pas. `calmes` compte les
    rapports consécutifs où ce thème n'a rien eu d'autre à dire (lu dans les
    payloads déjà publiés) : passé `_CALME_PILOTE` semaines, la répétition
    DEVIENT le sujet et la carte le dit — un thème en pilote automatique n'a pas
    besoin d'une étoile. La quatrième semaine ne ressemble donc pas à la
    première, et la carte pousse vers la sortie plutôt que vers l'habitude.

    `aveugle` PORTE LA VRAIE RAISON DU SILENCE dans le cas le plus fréquent
    relevé en base : un thème à 300–1 100 CHF par semaine sur un compte sans
    Google Analytics. Il ne manque pas de données sur ce thème — il manque la
    moitié de l'histoire pour TOUT le compte, et le dire ici, chiffres du thème
    à l'appui, vaut mieux que de le répéter dans les réglages de base.
    """
    cle = f"veille_theme_{theme}"

    # ── Branche 1 : plus rien ne passe par ce thème ──────────────────────────
    if sem["spend"] <= 0 and sem["posts"] == 0:
        _actives = [h for h in hebdo if h["spend"] > 0 or h["posts"] > 0]
        # `hebdo` ne remonte qu'à 8 semaines : au-delà, on écrit « plus de »
        # plutôt qu'un nombre qu'on ne sait pas. Sous-estimer un silence est
        # une prudence ; l'inventer précis serait un chiffre fabriqué.
        _duree = ("depuis plus de 8 semaines" if not _actives
                  else f"depuis {silence_sem} semaines" if silence_sem >= 2
                  else "cette semaine")
        if _actives:
            _quoi = " et ".join(
                x for x in (
                    (f"{_actives[0]['spend']:,.0f} CHF" if _actives[0]["spend"] > 0 else ""),
                    (f"{_actives[0]['posts']} publication"
                     f"{'s' if _actives[0]['posts'] > 1 else ''}"
                     if _actives[0]["posts"] > 0 else ""),
                ) if x)
            _passe = (f"Sa dernière semaine active remonte à {silence_sem} "
                      f"semaines, avec {_quoi}.")
        else:
            _passe = ("Je ne trouve aucune semaine active sur ce thème dans les "
                      "deux mois que je regarde.")
        return _reco_dict(
            cle, "pub",
            f"« {theme} » ne produit plus rien {_duree}",
            f"Ni dépense publicitaire ni publication sur ce thème sur les 7 jours "
            f"du rapport. {_passe}",
            "Un thème s'éteint pour trois raisons qui n'appellent pas la même "
            "suite : la saison est passée, une campagne s'est terminée sans que "
            "rien ne prenne le relais, ou tu as changé d'avis sans le dire à "
            "Pulse.",
            ("La décision n'est pas dans ton gestionnaire, elle est sur la page "
             "Thèmes : tant que ce thème garde son étoile, il consomme une carte "
             "chaque lundi pour ne rien dire. Si tu comptes le relancer, une "
             "campagne ou une publication suffit à le remettre dans ce rapport "
             "dès la semaine prochaine ; sinon, retire l'étoile et donne sa "
             "place à un thème sur lequel il se passe quelque chose.")
            + (" Et je te le redis sans détour : ça fait "
               f"{silence_sem} semaines que je t'écris la même chose. Je "
               "continuerai tant que l'étoile sera là — c'est la seule chose "
               "que cette carte sait faire."
               if silence_sem >= _CALME_PILOTE else ""),
            "Je ne vois que ce qui passe par tes comptes publicitaires et ton "
            "Instagram. Un thème travaillé en boutique, en salon ou par e-mail "
            "est invisible ici — et ce silence-là ne veut rien dire.",
            "solide", 8,
            repere="Le repère : quatre semaines sans dépense ni publication, ce "
                   "n'est plus une pause, c'est un arrêt.",
        )

    # ── Branche 2 : ça tourne, et rien n'en sort ─────────────────────────────
    faits = []
    if sem["spend"] > 0:
        faits.append(f"{sem['spend']:,.0f} CHF et {sem['clics']:,} clic"
                     f"{'s' if sem['clics'] > 1 else ''}")
    if sem["posts"] > 0:
        faits.append(f"{sem['posts']} publication{'s' if sem['posts'] > 1 else ''}")
    obs = f"Cette semaine sur ce thème : {' et '.join(faits)}."

    # LA FOURCHETTE DU THÈME, PRISE SUR SES PROPRES SEMAINES.
    #
    # C'est le MIN et le MAX observés, pas une moyenne ± deux écarts-types. La
    # version statistique a été écrite puis retirée après l'avoir vue tourner
    # sur un compte réel : sur « Offre saisonnière », moyenne 0,07 CHF et
    # écart-type 0,05 donnaient une borne basse négative, ramenée à 0,00 —
    # « une semaine normale tient entre 0,00 et 0,17 CHF le clic » ne dit rien
    # à personne et suppose en plus une distribution qu'on n'a pas vérifiée.
    # Le min et le max sont des semaines qui ont VRAIMENT existé.
    cpcs = [h["spend"] / h["clics"] for h in hebdo
            if h["clics"] >= _CALME_CLICS_MIN and h["spend"] > 0]
    repere = ""
    hors = None      # la semaine sort-elle de la fourchette du thème ?
    if len(cpcs) >= 3 and sem["clics"] >= _CALME_CLICS_MIN:
        cpc = sem["spend"] / sem["clics"]
        bas, haut = min(cpcs), max(cpcs)
        # LE TITRE NE PEUT PAS CONTREDIRE L'OBSERVATION QUI EST DESSOUS.
        # Vu au premier essai sur un compte réel : « tient sa ligne » écrit
        # au-dessus de « 0,03 CHF le clic, contre 0,07 à 0,09 d'habitude ».
        # Les deux ne peuvent pas être vrais ensemble, et c'est le titre qui a
        # tort. Une semaine hors fourchette n'est pas pour autant une tendance
        # — d'où une veille qui la SIGNALE, et non un conseil qui la tranche.
        if cpc < bas or cpc > haut:
            hors = "sous" if cpc < bas else "au-dessus"
        obs += (f" Le clic t'a coûté {cpc:.2f} CHF, contre {bas:.2f} à "
                f"{haut:.2f} CHF sur tes {len(cpcs)} dernières semaines "
                "comparables.")
        repere = (f"Le repère : sur ce thème, tes semaines tiennent entre "
                  f"{bas:.2f} et {haut:.2f} CHF le clic. Une semaine "
                  "qui sort de cette fourchette, c'est le moment de regarder — "
                  "et ce jour-là tu auras un vrai conseil ici, pas cette carte.")
    elif sem["posts"] > 0:
        reach = sem.get("reach")
        moy = [h["reach"] for h in hebdo if h.get("reach")]
        if reach and moy:
            obs += (f" Elles ont porté à {reach:,.0f} en moyenne, contre "
                    f"{min(moy):,.0f} à {max(moy):,.0f} sur tes semaines "
                    "précédentes.")
            repere = (f"Le repère : sur ce thème, une publication porte entre "
                      f"{min(moy):,.0f} et {max(moy):,.0f}. C'est en sortant de "
                      "là — dans un sens ou dans l'autre — qu'il y a quelque "
                      "chose à comprendre.")

    # TROIS TEXTES, PAS UN. La contrainte qui a décidé de cette forme : cette
    # carte ne doit pas pouvoir resservir trois lundis de suite. Les chiffres
    # changent chaque semaine, mais des chiffres qui changent sous une phrase
    # identique se lisent comme une phrase identique — le lecteur apprend à
    # sauter la carte, et c'est exactement ce qu'on cherche à éviter.
    #
    # `calmes` compte les rapports consécutifs où ce thème n'a rien eu d'autre à
    # dire (lu dans les payloads déjà publiés). Trois paliers, et le troisième
    # ne parle plus du thème mais de sa carte : au bout d'un mois sans écart, la
    # RÉPÉTITION devient l'information, et la seule sortie honnête est de rendre
    # la place. Une carte qui pousse vers sa propre suppression ne peut pas
    # devenir du décor.
    pourquoi = (
        "« Dans ses normes » est un constat sur la RÉGULARITÉ, pas sur le "
        "niveau. Mes règles cherchent des écarts — entre tes campagnes, entre "
        "tes formats, entre cette semaine et les précédentes. Un thème qui a "
        "toujours coûté trop cher n'a aucun écart à montrer, et il passera donc "
        "toujours par cette carte-ci."
    )

    if hors:
        # Ce cas passe AVANT les paliers de répétition : quand la semaine sort
        # de la fourchette, ce n'est plus une carte sur la régularité.
        titre = (f"« {theme} » sort de sa fourchette — le clic "
                 f"{'baisse' if hors == 'sous' else 'monte'} cette semaine")
        pourquoi = (
            "Aucune de mes règles n'a de quoi trancher : elles comparent tes "
            "campagnes entre elles pendant la semaine, et là c'est le thème "
            "ENTIER qui a bougé par rapport à ses propres semaines. Une "
            "enchère qui se tend, une audience qui s'épuise, une campagne qui "
            "s'arrête et laisse les autres porter le volume : les trois "
            "donnent ce mouvement."
        )
        verifier = (
            "Une semaine hors fourchette n'est pas encore une tendance — c'est "
            "la deuxième qui le dira. D'ici là, une seule chose à regarder, et "
            "elle prend deux minutes : ton taux de clic sur ce thème. S'il a "
            "bougé dans le même mouvement, c'est ton annonce qui a changé de "
            "rendement ; s'il n'a pas bougé, c'est l'enchère, et tu n'y peux "
            + ("pas grand-chose. " if hors == "au-dessus" else "rien — profites-en. ")
            + "Ne touche à aucun budget avant de savoir laquelle des deux."
        )
    elif calmes >= _CALME_PILOTE:
        titre = f"« {theme} » tourne sans toi depuis {calmes + 1} semaines"
        verifier = (
            f"{calmes + 1} semaines d'affilée sans un écart à te montrer : ce "
            "n'est pas un reproche, c'est un constat sur ce que ce thème "
            "demande — rien. Deux sorties, et aucune n'est de continuer à lire "
            "cette carte. Soit tu lui fixes un cap chiffré pour le mois (une "
            "dépense par semaine, une cadence de publication) : il y aura enfin "
            "un écart à mesurer, donc un vrai conseil ici. Soit tu rends son "
            "étoile à un thème sur lequel tu as encore des décisions à prendre."
        )
    elif calmes >= 2:
        titre = f"« {theme} » n'a rien changé — {calmes + 1}e semaine de suite"
        verifier = (
            "Trois semaines que ce thème reste dans sa fourchette. À ce "
            "stade-là, ce n'est plus une semaine calme, c'est son régime "
            "normal : arrête de le surveiller chaque lundi et fixe-toi un "
            "rendez-vous mensuel dessus. Ce que tu regarderas ce jour-là, c'est "
            "le repère ci-dessous — c'est le seul chiffre de cette carte qui "
            "vaille un aller-retour."
        )
    else:
        titre = f"« {theme} » tient sa ligne — rien n'en sort cette semaine"
        verifier = (
            "Aucune de mes règles ne s'est déclenchée ici : pas d'écart de coût "
            "entre tes campagnes, pas de format qui décroche, pas de semaine "
            "vide. Le geste de la semaine, c'est de ne pas y toucher et de "
            "mettre ton temps sur un thème qui bouge — les conseils des autres "
            "cartes te disent lequel."
        )

    if aveugle:
        verifier += (
            f" Et la chose que je ne peux pas te dire : ce que ces "
            f"{sem['clics']:,} clics t'ont rapporté. Google Analytics n'est pas "
            "branché sur ce compte, donc je vois le prix de ce thème et jamais "
            "son retour — c'est le seul réglage qui ferait passer cette carte de "
            "« régulier » à « rentable ou pas ». Il est dans les réglages de "
            "base, plus bas dans ce rapport."
        )

    return _reco_dict(
        cle, "pub", titre, obs, pourquoi, verifier,
        "Je compare ce thème à lui-même. S'il est mauvais depuis six mois, sa "
        "régularité ne le dira jamais — c'est un chiffre de marge, ou une "
        "comparaison avec ce que tu attendais, qui trancherait, et ni l'un ni "
        "l'autre n'est dans mes données.",
        "creuser" if aveugle else "solide", 8,
        repere=repere,
    )


def _reco_dict(key, platform, title, observation, pourquoi, verifier, angle_mort,
               confidence, priority, repere=""):
    """Même forme que `_reco()` du moteur — les conseils fabriqués ici entrent
    dans le même payload, la même carte et le même feedback que les autres."""
    return {
        "key": key, "platform": platform, "title": title,
        "observation": observation, "pourquoi": pourquoi, "verifier": verifier,
        "repere": repere, "angle_mort": angle_mort,
        "confidence": confidence, "source": "rule", "priority": priority,
    }


def _reco_evenements(theme, g4t, sem) -> list[dict]:
    """Les conseils que permettent les événements GA4 désignés sur un thème.

    POURQUOI ICI ET PAS DANS `saas/recos_ia/reco_engine.py` : même raison que
    `_orga_recos` et `_reco_veille` — le moteur est partagé entre le niveau
    compte et les thèmes, mais il ne connaît ni les thèmes ni le rattachement
    d'un événement à un thème.
    Ce sont des conseils-règles comme les autres : même dict, même carte, même
    feedback.

    LA RÈGLE QUI COMMANDE TOUT LE RESTE : ON NE PARLE QUE DE CE QU'ON A MESURÉ.
    `g4t["evenements"]` ne contient que les événements ayant au moins une ligne
    GA4 sur la fenêtre ; ceux qui n'en ont pas sont dans `mesure_absente` et ne
    sont JAMAIS chiffrés — ni à zéro, ni estimés, ni comparés. Un événement
    absent peut vouloir dire « ça n'a pas eu lieu » comme « le tag est cassé »,
    et rien dans les données ne tranche entre les deux.

    Le principal porte le verdict, les secondaires servent à comprendre : c'est
    exactement le partage que le client a posé sur la page Thèmes, et il se lit
    tel quel dans les deux conseils ci-dessous.
    """
    if not g4t:
        return []
    evs = g4t.get("evenements") or {}
    princ = [n for n in (g4t.get("evenements_principaux") or []) if n in evs]
    secondaires = {n: d for n, d in evs.items() if d.get("rang") == "secondaire"}
    out = []

    # ── 1. LE PRINCIPAL N'A RIEN, UN SECONDAIRE EN A ─────────────────────────
    # Le cas qui a motivé toute cette fonctionnalité : le thème produit de
    # l'intention, pas la conversion sur laquelle son propriétaire veut être
    # jugé. C'est un constat de FUNNEL, mais sur CE thème — là où `_rule_funnel`
    # parle du site entier avec les six noms standard.
    #
    # `evenements_principaux` ne contient QUE les principaux MESURÉS (voir
    # `_theme_ga4`) — un principal absent n'y entre jamais, donc l'intersection
    # avec `mesure_absente` était structurellement toujours vide. Le bon
    # ensemble est `principaux_absents` : les principaux choisis par
    # l'utilisateur et restés sans ligne mesurée.
    manquants = g4t.get("principaux_absents") or []
    if manquants and secondaires:
        _s_nom, _s = max(secondaires.items(), key=lambda kv: kv[1]["count"])
        _p = manquants[0]
        out.append(_reco_dict(
            "theme_event_muet", "pub",
            f"« {_p} » n'a aucune ligne sur ce thème, « {_s_nom} » en a {_s['count']}",
            f"Sur les campagnes de « {theme} », Google Analytics a compté "
            f"{_s['count']} fois « {_s_nom} » cette semaine, et pas une seule fois "
            f"« {_p} » — l'événement que tu as désigné comme principal.",
            "Deux explications tiennent, et elles n'ont rien à voir : soit les gens "
            "s'arrêtent avant cette étape (le blocage est sur la page, le prix, le "
            "paiement), soit l'événement n'est plus envoyé par ton site et il n'y a "
            "aucun problème commercial derrière.",
            f"Ouvre GA4 → Temps réel et fais toi-même le parcours jusqu'à déclencher "
            f"« {_p} ». S'il apparaît, le tag marche et le blocage est réel. S'il "
            f"n'apparaît pas, c'est le tag qu'il faut réparer avant de conclure quoi "
            f"que ce soit.",
            "Je ne sais pas distinguer « personne ne l'a fait » de « l'événement "
            "n'est plus envoyé » : les deux se ressemblent exactement, une ligne "
            "absente.",
            "creuser", 1,
        ))

    # ── 2. CE QUE COÛTE UNE CONVERSION SUR CE THÈME ─────────────────────────
    # Le chiffre que le rattachement rend enfin possible : la dépense DU THÈME
    # divisée par SES conversions à lui. Sans les événements choisis, ce coût se
    # calculait sur le total `conversions` de GA4, un fourre-tout qui mélangeait
    # les inscriptions newsletter et les achats.
    _dep = float((sem or {}).get("spend") or 0)
    if princ and _dep > 0:
        _p = max(princ, key=lambda n: evs[n]["count"])
        _n = evs[_p]["count"]
        if _n > 0:
            _cout = _dep / _n
            # La confiance suit l'échantillon, pas l'envie de conclure. Sous dix
            # conversions, un coût unitaire bouge de 30 % pour une conversion de
            # plus ou de moins — c'est une piste, pas une mesure.
            _conf = "solide" if _n >= 30 else "creuser" if _n >= 10 else "piste"
            _ctx = ""
            if secondaires:
                _s_nom, _s = max(secondaires.items(), key=lambda kv: kv[1]["count"])
                _ctx = (f" Pour situer : « {_s_nom} », que tu suis en secondaire, "
                        f"s'est produit {_s['count']} fois sur la même période.")
            # `cible` = L'ÉVÉNEMENT MESURÉ, et il entre dans la clé du constat
            # (`_constat_cout`) : changer d'événement principal change le
            # chiffre dont on parle, donc la clé, donc le verdict qui s'y
            # rattache. Sans elle, un « ✗ pas d'accord » posé sur le coût d'un
            # ancien événement muselait celui du nouveau.
            _cout_reco = _reco_dict(
                "theme_event_cout", "pub",
                f"Sur « {theme} », chaque « {_p} » t'a coûté {_cout:.2f} CHF",
                f"{_dep:.0f} CHF dépensés sur les campagnes de ce thème, "
                f"{_n} fois « {_p} » rattaché à ces mêmes campagnes.{_ctx}",
                "Ce coût ne se juge pas dans l'absolu : il se juge contre ce que "
                "l'action te rapporte réellement, et contre ce que le même thème "
                "coûtait les semaines d'avant.",
                "Compare-le à ta marge sur une vente (ou à ce que vaut un contact "
                "chez toi). S'il la dépasse, ce thème te coûte de l'argent même "
                "quand il convertit — et c'est un problème d'offre ou de ciblage, "
                "pas de budget.",
                "Je compte les conversions rattachées aux campagnes de ce thème par "
                "leur nom de lien : ce qui arrive sans campagne, ou par une autre "
                "voie, ne rentre pas dans ce calcul. Le vrai coût est donc au plus "
                "égal à celui-ci, jamais supérieur.",
                _conf, 2,
            )
            _cout_reco["cible"] = _p
            out.append(_cout_reco)
    return out


def _strip_reco(r: dict) -> dict:
    return {k: r.get(k) for k in RECO_FIELDS}


# COMBIEN DE CAMPAGNES LA CARTE D'UN THÈME PUBLIE — et pourquoi un plafond.
#
# Ce bloc n'est pas la liste des campagnes du thème, c'est un EXTRAIT : les plus
# grosses dépenses, assez pour reconnaître le thème et réparer une étiquette
# sans faire du payload un export. Chaque ligne y est éditable
# (`CampaignLabelSelect`), donc chacune coûte du poids ET du rendu.
#
# LE PLAFOND RESTE, ET IL SE DIT (ticket 34). Ce qui a changé, c'est que
# l'extrait ne se fait plus passer pour le tout : `n_campaigns` et
# `n_campaigns_canal` portent le compte entier, et le front en déduit ce qui
# manque au lieu de le recompter ici. Les campagnes hors de l'extrait se
# ré-étiquettent sur `/meta` et `/google`, qui les portent TOUTES.
_CAMPAGNES_PUBLIEES = 8


def _compte_par_canal(campagnes: list[dict]) -> dict:
    """Combien de campagnes ce thème porte sur chaque régie — exactement.

    Attend la liste ENTIÈRE des campagnes du thème, jamais l'extrait publié :
    c'est toute la raison d'être de cette fonction (ticket 34, et le commentaire
    posé sur `n_campaigns_canal` dans `build_payload`).
    """
    par_canal: dict = {}
    for c in campagnes:
        canal = c.get("channel")
        if canal:
            par_canal[canal] = par_canal.get(canal, 0) + 1
    return par_canal


# `_compares_channels` VIVAIT ICI, ET ELLE EST MORTE LE 2026-09-12.
#
# Elle écartait tout conseil qui nommait Meta ET Google avec un mot de
# comparaison, à la génération comme avant le tri. Son commentaire d'origine
# disait « le client n'en veut pas » — il précédait
# `.scratch/refonte/issues/02-sur-quoi-se-differencient-les-autres.md`, qui a
# mesuré sur dix produits que le thème traversant les deux régies est le SEUL
# axe encore libre, et l'ADR 0003 qui le revendique. Le filtre écartait donc
# exactement ce que le produit a décidé de dire.
#
# David, mot pour mot : « filtre à la poubelle, on verra si ça pose problème »
# (`.scratch/refonte/issues/24-conseils-payants-manquants.md`, décision 2).
# Règles ET IA : plus aucun conseil n'est écarté pour avoir comparé les régies.
#
# CE QUI EN DÉCOULAIT ET QUI N'EXISTE PLUS : ce filtre pouvait faire tomber un
# thème de 3 pistes à 1, d'où les deux tentatives d'appel à Gemini. Les pistes
# sont coupées, les deux tentatives avec elles.


# ── LES PISTES RÉDIGÉES PAR GEMINI SONT COUPÉES ──────────────────────────────
#
# `_theme_ai_recos` vivait ici : un appel Gemini par thème, qui rendait trois
# « pistes » occupant les trois places de sa carte. Elle est supprimée, et ce
# n'est pas une économie — c'est
# `.scratch/refonte/issues/11-d-ou-viennent-les-conseils.md` : sur les cinq
# sites d'appel de ce fichier, celui-ci était **le seul endroit où Pulse disait
# quelque chose que rien ne peut vérifier** — ni un chiffre du compte, ni une
# règle — et ces pistes occupaient la place des cinq conseils qu'on vient de
# plafonner.
#
# LES QUATRE AUTRES APPELS RESTENT, et la raison tient en une phrase chacun :
# les astuces (`_themes_tips`, juste en dessous) et le ton (`build_user_persona`)
# ne touchent aucun chiffre du compte ; le résumé de la semaine reformule ce
# qu'on lui donne, il lui est interdit de calculer ; la mémoire d'un thème
# condense des verdicts déjà mesurés. **Le moteur trie, l'IA explique.**
#
# CE QUE ÇA SUPPRIME AUSSI : le thème n'a plus deux chemins. Il n'y avait de
# conseils-règles que pour les thèmes qu'aucun appel Gemini ne couvrait, et
# comme la porte s'ouvrait à la QUATRIÈME étoile, un compte à trois étoiles ou
# moins n'en recevait aucun — ni `roas`, ni les quatre `orga_*`, ni les quatre
# règles payantes du ticket 07 de la construction. C'était le ticket
# [26](../../.scratch/construction/issues/26-les-regles-payantes-n-atteignent-pas-le-rapport.md) :
# la porte disparaît avec le chemin qu'elle gardait.


def _themes_tips(redige, labels: list, obj_txt: str, business: str = "",
                 bloques: list | None = None) -> list:
    """Savoir-faire de fond par thematique — PAS lie aux chiffres de la semaine.

    Les conseils hebdo repondent a « que faire maintenant » ; ceux-ci repondent a
    « comment on fait bien ce genre de contenu, en general ». Ils changent peu et
    se lisent quand on a cinq minutes. Un seul appel Gemini pour tous les themes.
    [] si Gemini echoue — jamais bloquant.

    `redige` ARRIVE PAR PARAMÈTRE, et c'est le seam du ticket 16 qui déborde
    jusqu'ici : cette fonction est appelée DEPUIS `build_payload`, donc un appel
    direct à Gemini y ouvrait un trou — la construction partait sur le réseau dès
    qu'une clé existait dans l'environnement, et un test hors ligne devenait
    dépendant de la machine qui le joue. Trouvé par la revue de code du
    ticket 16, qui l'a vu parce que la vérification d'alors ne regardait que le
    corps de `build_payload` et pas les fonctions qu'il appelle.
    """
    import json as _json
    if not labels:
        return []
    _bloc = ""
    if bloques:
        _bloc = (" Cette personne a marque les conseils suivants comme TROP "
                 "COMPLIQUES a mettre en place : "
                 + " ; ".join(f'"{b}"' for b in bloques[:6])
                 + ". Traite ces sujets EN PRIORITE, en expliquant le "
                   "savoir-faire qui manque, pas en repetant le conseil.")
    raw = redige(
        "Tu es un consultant marketing senior pour une PME suisse"
        + (f" ({business})" if business else "")
        + f". Objectif du compte : {obj_txt}.{_bloc} "
        f"Voici ses thematiques de communication : {', '.join(labels)}. "
        "Pour CHAQUE thematique, donne 2 conseils de FOND : des bonnes pratiques "
        "durables et concretes sur ce type de contenu ou de campagne (angle, "
        "format, structure d'accroche, saisonnalite, erreurs classiques). "
        "Ce ne sont PAS des conseils sur les chiffres de la semaine : ils doivent "
        "rester valables dans six mois. Pas de generalites creuses du type "
        "« publie regulierement » — du concret qu'on peut appliquer demain. "
        "Reponds UNIQUEMENT avec un tableau JSON : "
        '[{"theme":"...","tips":[{"titre":"...","texte":"..."}]}]. '
        "Titres courts (5 mots max), textes de 2 phrases. Francais, ton direct."
    )
    if not raw:
        return []
    try:
        txt = raw.strip()
        if txt.startswith("```"):
            txt = txt.strip("`")
            txt = txt[4:] if txt.lower().startswith("json") else txt
        arr = _json.loads(txt.strip())
        out = []
        for d in arr if isinstance(arr, list) else []:
            if not isinstance(d, dict):
                continue
            tips = [
                {"titre": str(t["titre"])[:70], "texte": str(t["texte"])}
                for t in (d.get("tips") or [])
                if isinstance(t, dict) and t.get("titre") and t.get("texte")
            ][:3]
            if d.get("theme") and tips:
                out.append({"theme": str(d["theme"]), "tips": tips})
        return out[:3]
    except Exception:
        return []


def build_payload(lecteur: Lecteur) -> dict | None:
    """Prépare le payload du rapport hebdo. None si pas assez de données.

    2700+ lignes, ~30 sections marquées `# ── ... ──`, variables partagées
    d'un bout à l'autre (pas de découpage sûr sans tests de non-régression —
    voir la section « Recos PAR THÈME » pour la logique IA la plus récente
    et la plus fragile). Carte pour naviguer sans tout lire :

      1.  Chargement           — fetch Meta/Google/Instagram/followers
      2.  Fenêtre              — 7 jours pleins, jamais le jour du fetch
      3.  Meta Ads             — agrégats + par campagne
      4.  Google Ads           — mêmes fenêtres, fusion dans df_camp
      5.  Instagram            — agrégats posts
      6.  Profil + GA4 + recos — même moteur que le rapport
      7.  Configs campagnes    — labels, sert matrice + bloc thèmes
      8.  Événements par thème — ceux rattachés par le client
      9.  Objectif par thème   — quand il diffère de celui du compte
      10. Vision globale       — thèmes lus dans la vue `theme_regroupement`,
                                  matrice full-history + constats validables
      11. Recos PAR THÈME      — label par label, cross-canal
      12. Poids d'un thème     — part du compte
      13. Dates déclarées      — par les plateformes
      14. Rapports publiés     — lus une seule fois
      15. Campagnes neuves     — ≤ 14 jours, thème pas encore ajouté
      16. Frise (Phase 2)      — série hebdo + repères d'actions, événement
                                  principal semaine par semaine, événements
                                  choisis ramenés aux campagnes du thème
      17. Ce qui passe par un thème, semaine par semaine — composition
          100 % Gemini (27 août 2026), filet anti-carte-muette, fallback
          quand un thème n'est pas rédigé par Gemini
      18. Verdict déterministe — même logique que le rapport
      19. Sélection            — 2 insta + 3 pub, digest 3
      20. Brief IA             — sans persona en headless + fallback
      21. Thèmes               — dépense par label × revenu GA4 (la vue)
      22. Suivi des actions    — « Je le teste », et le verdict à l'échéance
      23. Hypothèse de la semaine — entre automatiquement en suivi
      24. Les 3 du moment
      25. Vision + matrice compacte pour le payload
      26. Boussole             — LE chiffre qui compte, avec son échelle
      27. Frise                — ce qui tournait pendant ces semaines, dates
                                  déclarées, ce qui a bougé sur les plateformes
    """
    today = lecteur.aujourd_hui()

    # ── Chargement (mêmes fetchers que le rapport) ────────────────────────────
    df_meta_raw = None
    df_insta = pd.DataFrame()
    df_follows = pd.DataFrame()
    try:
        meta_data = lecteur.meta_ads()
        if meta_data:
            df_meta_raw = pd.DataFrame(meta_data)
    except Exception:
        pass
    try:
        df_insta = pd.DataFrame(lecteur.publications() or [])
    except Exception:
        pass
    try:
        df_follows = pd.DataFrame(lecteur.abonnes() or [])
    except Exception:
        pass
    df_google = pd.DataFrame()
    try:
        df_google = pd.DataFrame(lecteur.google_ads() or [])
    except Exception:
        pass
    # LE DÉTAIL ANNONCE PAR ANNONCE, CÔTÉ GOOGLE. Récolté chaque jour depuis
    # toujours, affiché par les pages web depuis toujours, et jamais lu par le
    # moteur de conseils : c'est le gisement qu'a trouvé
    # `.scratch/refonte/issues/24-conseils-payants-manquants.md`. Il porte la
    # seule mesure de CONVERSION disponible au niveau de l'Annonce — Meta n'en
    # a pas dans `meta_ads_insights`.
    df_gads = pd.DataFrame()
    try:
        df_gads = pd.DataFrame(lecteur.google_annonces() or [])
        if not df_gads.empty and "date_start" in df_gads.columns:
            # Converti UNE fois ici, pas une fois par thème : `_annonces_theme`
            # est appelée pour chacun, et un compte à quinze étoiles aurait
            # reconverti tout l'historique quinze fois.
            df_gads["date_start"] = pd.to_datetime(df_gads["date_start"],
                                                   errors="coerce")
            for _c in ("impressions", "clicks", "cost_micros", "conversions"):
                if _c in df_gads.columns:
                    df_gads[_c] = pd.to_numeric(df_gads[_c],
                                                errors="coerce").fillna(0)
    except Exception:
        df_gads = pd.DataFrame()

    # ── LE CANAL MUET : ce qui n'a pas été écrit, et que rien ne doit combler ──
    #
    # Tranché le 2026-09-14 avec `vision-produit`, ticket 20 de la construction
    # (`.scratch/construction/issues/20-rapport-publie-sur-un-canal-muet.md`).
    #
    # LA DÉCISION : on publie TOUJOURS, et ce qui dépend de la donnée absente
    # devient `None` — jamais 0, jamais une baisse. Retenir le rapport (ce que
    # faisait la garde `ad_id`) est un silence que le client ne sait pas lire ;
    # or le rapport est le SEUL canal par lequel on peut lui dire de reconnecter.
    # La règle n'est donc pas « canal tombé → rapport dégradé », c'est
    # **chaque mesure se tait si sa source est muette**, mesure par mesure : un
    # compte dont la boussole est l'engagement garde un rapport entier et bon
    # quand Meta Ads tombe, parce qu'aucun de ses chiffres ne touche la dépense.
    #
    # POURQUOI ÇA PRESSE, ET DANS L'AUTRE SENS QU'ON CROIT. Le trou n'est pas
    # symétrique : GA4 tourne dans son propre fil et écrit normalement pendant
    # que Meta ou Google échoue. Le revenu reste donc ENTIER pendant que le
    # dénominateur est amputé — le ROAS ne s'effondre pas, **il gonfle**. Le
    # rapport n'a pas l'air cassé, il a l'air excellent, et la règle `scaler`
    # conseille d'augmenter le budget sur un chiffre fabriqué par une panne.
    #
    # CE N'EST PAS UN COMPTE À ZÉRO. Trois états rendent le même nombre de
    # lignes et se traitent à l'opposé — jamais connecté, échec, zéro mesuré :
    # la distinction est faite en amont par `fetch_canaux_muets`
    # (`saas/commun/fetch_data.py`), qui ne lit QUE l'état `echec` du dernier
    # passage. Ici, on ne se demande plus pourquoi : on se demande jusqu'à quelle
    # date le canal a écrit.
    try:
        canaux_muets = dict(lecteur.canaux_muets() or {})
    except Exception:
        canaux_muets = {}
    # Seule la pub creuse un trou dans un CHIFFRE. Instagram muet coûte des
    # posts, pas une division fausse ; GA4 muet est déjà traité par `_rev is
    # None` (le ROAS se tait de lui-même, il ne gonfle pas).
    _PUB_MUETTE = ("meta", "google")
    pub_muette = {c: m for c, m in canaux_muets.items() if c in _PUB_MUETTE}

    # JUSQU'OÙ CHAQUE CANAL A RÉELLEMENT ÉCRIT. Le trou ne couvre pas tout
    # l'historique : les semaines d'avant ont été écrites par les passages
    # réussis d'avant, et elles restent bonnes. Un canal muet est aveugle
    # APRÈS sa dernière date connue, et nulle part ailleurs — c'est ce qui
    # permet aux fenêtres de référence (4 semaines, 84 jours) de rester des
    # chiffres pendant que la semaine en cours se tait.
    #
    # La date se DÉDUIT des lignes écrites, elle ne se stocke pas : c'est le
    # même raisonnement que `_depart_recolte` côté récolte — une date lue dans
    # les lignes réellement présentes ne peut pas mentir sur ce qui a été fait.
    def _derniere_date(df, col="date_start"):
        if df is None or getattr(df, "empty", True) or col not in df.columns:
            return None
        _d = pd.to_datetime(df[col], errors="coerce").max()
        return _d.date() if pd.notna(_d) else None

    _bord_muet: dict[str, object] = {}
    if "meta" in pub_muette:
        _bord_muet["meta"] = _derniere_date(df_meta_raw)
    if "google" in pub_muette:
        _bord_muet["google"] = _derniere_date(df_google)

    def _pub_aveugle(d1, d2) -> set:
        """Les canaux payants muets dont la donnée manque SUR CETTE FENÊTRE.

        Un canal muet qui n'a jamais rien écrit (`None`) est aveugle sur toute
        fenêtre : on ne peut pas prouver qu'il n'a pas dépensé.
        """
        aveugles = set()
        for _c in pub_muette:
            _bord = _bord_muet.get(_c)
            if _bord is None or d2 > _bord:
                aveugles.add(_c)
        return aveugles

    # ── Fenêtre : 7 jours pleins ancrés sur la dernière donnée (jamais aujourd'hui)
    yesterday = today - timedelta(days=1)
    # UN CANAL MUET N'ANCRE PAS LA FENÊTRE (ticket 20). Sa dernière date est
    # périmée PAR DÉFINITION — c'est le jour où il a cessé d'écrire. L'ancrer
    # dessus revient à décider que « la dernière donnée » remonte à une semaine,
    # donc à REPUBLIER LA SEMAINE PRÉCÉDENTE sous sa propre clé : le client ne
    # reçoit pas un rapport troué, il reçoit l'ancien, et la panne devient
    # invisible pour tout le monde, lui comme nous. C'est la porte de sortie la
    # plus discrète du ticket, et c'est un compte SANS Instagram — celui qui ne
    # fait que de la pub — qui l'emprunte, faute d'une autre source pour ancrer.
    _data_dates = []
    if ("meta" not in pub_muette
            and df_meta_raw is not None and "date_start" in df_meta_raw.columns):
        _d = pd.to_datetime(df_meta_raw["date_start"], errors="coerce").max()
        if pd.notna(_d):
            _data_dates.append(_d.date())
    if not df_insta.empty and "date" in df_insta.columns:
        _d = pd.to_datetime(df_insta["date"], errors="coerce", utc=True).max()
        if pd.notna(_d):
            _data_dates.append(_d.date())
    if not df_follows.empty and "fetched_at" in df_follows.columns:
        _d = pd.to_datetime(df_follows["fetched_at"], errors="coerce", utc=True).max()
        if pd.notna(_d):
            _data_dates.append(_d.date())
    last_data_date = max(_data_dates) if _data_dates else yesterday

    last_full_day = min(last_data_date, yesterday)
    cur_since = last_full_day - timedelta(days=6)
    prev_until = cur_since - timedelta(days=1)
    prev_since = prev_until - timedelta(days=6)

    # ── LA SEMAINE DE CE RAPPORT SORT DE LA FENÊTRE MESURÉE, PLUS DE `today` ──
    #
    # `week_start` était le lundi d'AUJOURD'HUI, et le numéro de semaine du
    # libellé aussi. Republier le même rapport dans une semaine calendaire
    # différente écrivait donc une DEUXIÈME ligne (la clé est
    # `(user_id, week_start)`) et le renumérotait, alors que les chiffres sont
    # identiques — deux lignes pour une même semaine, c'est deux vérités.
    # Le défaut est mesuré dans `.scratch/refonte/issues/13-entre-deux-jours-de-travail.md`
    # (« le piège à connaître si un rapport est republié à la main »).
    #
    # Ancrer sur la fenêtre rend la publication IDEMPOTENTE : tant que la
    # dernière donnée n'a pas bougé, republier écrase sa propre ligne, quel que
    # soit le jour où on le fait. C'est le même invariant que la fenêtre
    # elle-même, qui est ancrée sur la dernière donnée et non sur le jour de
    # fabrication (l. ci-dessus) — les deux se tenaient déjà, seule la clé
    # d'écriture ne suivait pas.
    #
    # CE QUE ÇA DÉPLACE EN SERVICE, une fois et une seule : pour un compte dont
    # le Jour de travail est le LUNDI, la fenêtre finit le dimanche, donc dans
    # la semaine ISO précédente — son `week_start` recule de sept jours. La
    # publication suivante tombe alors sur la ligne que la précédente occupait
    # et l'écrase (upsert, aucune suppression) : on perd le payload d'UNE
    # semaine d'historique, jamais une ligne de suivi ni une décision. Pour tous
    # les autres jours, hier est dans la même semaine ISO qu'aujourd'hui et
    # rien ne bouge.
    week_start_rapport = last_full_day - timedelta(days=last_full_day.weekday())

    # LES CANAUX PAYANTS MUETS SUR LA SEMAINE DU RAPPORT (ticket 20). Posé ICI,
    # dès que la fenêtre est connue et avant le premier chiffre qui en dépend :
    # tout ce qui publie une dépense, un CPC ou un ROAS de cette semaine le
    # teste, des cartes de thème jusqu'aux KPI de l'email. Vide = rien à taire.
    _aveugle_semaine = _pub_aveugle(cur_since, last_full_day)

    # ── Meta Ads : agrégats + par campagne ────────────────────────────────────
    total_spend = 0.0
    total_clicks = 0
    total_impr = 0
    m_clicks_prev = 0
    m_impr_prev = 0
    avg_ctr = 0.0
    clicks_delta_pct = None
    df_camp = pd.DataFrame()
    if df_meta_raw is not None and not df_meta_raw.empty:
        for col in ["impressions", "clicks", "spend"]:
            if col in df_meta_raw.columns:
                df_meta_raw[col] = pd.to_numeric(df_meta_raw[col], errors="coerce").fillna(0)
        df_meta_raw["date_start"] = pd.to_datetime(df_meta_raw["date_start"], errors="coerce")
        df_meta = df_meta_raw[
            (df_meta_raw["date_start"] >= pd.Timestamp(cur_since))
            & (df_meta_raw["date_start"] <= pd.Timestamp(last_full_day))
        ]
        df_meta_prev = df_meta_raw[
            (df_meta_raw["date_start"] >= pd.Timestamp(prev_since))
            & (df_meta_raw["date_start"] <= pd.Timestamp(prev_until))
        ]
        if not df_meta.empty:
            total_spend = float(df_meta["spend"].sum())
            total_clicks = int(df_meta["clicks"].sum())
            total_impr = int(df_meta["impressions"].sum())
            avg_ctr = (total_clicks / total_impr * 100) if total_impr > 0 else 0.0
            if not df_meta_prev.empty:
                prev_clicks = int(df_meta_prev["clicks"].sum())
                m_clicks_prev = prev_clicks
                m_impr_prev = int(df_meta_prev["impressions"].sum())
                if prev_clicks > 0:
                    clicks_delta_pct = round((total_clicks - prev_clicks) / prev_clicks * 100)
            df_camp = df_meta.groupby("campaign_name", as_index=False).agg(
                spend=("spend", "sum"), clicks=("clicks", "sum"), impressions=("impressions", "sum")
            )
            df_camp["ctr"] = df_camp.apply(
                lambda r: r["clicks"] / r["impressions"] * 100 if r["impressions"] > 0 else 0, axis=1)
            df_camp["cpc"] = df_camp.apply(
                lambda r: r["spend"] / r["clicks"] if r["clicks"] > 0 else 0, axis=1)

    # ── Google Ads : mêmes fenêtres (KPIs email) + FUSION dans df_camp ────────
    # → le moteur voit toute la pub (ROAS = revenu payant / dépense Meta+Google).
    g_spend = 0.0
    g_clicks = 0
    g_impr = 0
    g_clicks_prev = 0
    g_impr_prev = 0
    if not df_google.empty and "date_start" in df_google.columns:
        df_google["date_start"] = pd.to_datetime(df_google["date_start"], errors="coerce")
        for col in ["cost_micros", "clicks", "impressions"]:
            if col in df_google.columns:
                df_google[col] = pd.to_numeric(df_google[col], errors="coerce").fillna(0)
        df_g = df_google[
            (df_google["date_start"] >= pd.Timestamp(cur_since))
            & (df_google["date_start"] <= pd.Timestamp(last_full_day))
        ].copy()
        # Fenetre precedente : sert uniquement aux reperes du bloc metriques.
        df_g_prev = df_google[
            (df_google["date_start"] >= pd.Timestamp(prev_since))
            & (df_google["date_start"] <= pd.Timestamp(prev_until))
        ]
        if not df_g_prev.empty:
            g_clicks_prev = int(df_g_prev["clicks"].sum())
            g_impr_prev = int(df_g_prev["impressions"].sum())
        if not df_g.empty:
            g_spend = float(df_g["cost_micros"].sum()) / 1_000_000.0
            g_clicks = int(df_g["clicks"].sum())
            g_impr = int(df_g["impressions"].sum())
            if "campaign_id" in df_g.columns:
                try:
                    gnames = {str(k): (v or {}).get("campaign_name") or f"Campagne {k}"
                              for k, v in (lecteur.config_google() or {}).items()}
                except Exception:
                    gnames = {}
                df_g["_cid"] = df_g["campaign_id"].astype(str)
                gagg = df_g.groupby("_cid", as_index=False).agg(
                    spend=("cost_micros", "sum"), clicks=("clicks", "sum"),
                    impressions=("impressions", "sum"))
                gagg["spend"] = gagg["spend"] / 1_000_000.0
                gagg["campaign_name"] = gagg["_cid"].map(lambda c: gnames.get(c, f"Campagne {c}"))
                gagg["ctr"] = gagg.apply(
                    lambda r: r["clicks"] / r["impressions"] * 100 if r["impressions"] > 0 else 0, axis=1)
                gagg["cpc"] = gagg.apply(
                    lambda r: r["spend"] / r["clicks"] if r["clicks"] > 0 else 0, axis=1)
                gcols = ["campaign_name", "spend", "clicks", "impressions", "ctr", "cpc"]
                df_camp = (pd.concat([df_camp, gagg[gcols]], ignore_index=True)
                           if not df_camp.empty else gagg[gcols])

    # ── Instagram ─────────────────────────────────────────────────────────────
    followers_current = 0
    followers_delta = 0
    avg_engagement = 0.0
    week_eng = None
    week_reach = None
    hist_reach = None
    df_week_posts = pd.DataFrame()
    df_prev_posts = pd.DataFrame()
    if not df_follows.empty and "followers" in df_follows.columns:
        df_follows = df_follows.sort_values("fetched_at", ascending=False)
        followers_current = int(df_follows.iloc[0]["followers"])
        if len(df_follows) >= 7:
            followers_delta = followers_current - int(df_follows.iloc[6]["followers"])
    if not df_insta.empty:
        for col in ["likes", "reach", "comments", "saved"]:
            if col in df_insta.columns:
                df_insta[col] = pd.to_numeric(df_insta[col], errors="coerce").fillna(0)
        if "reach" in df_insta.columns:
            df_insta["eng"] = df_insta.apply(
                lambda r: (r.get("likes", 0) + r.get("comments", 0) + r.get("saved", 0)) / r["reach"] * 100
                if r["reach"] > 0 else 0, axis=1)
            avg_engagement = float(df_insta["eng"].mean())
            hist_reach = float(df_insta["reach"].mean())
            if "date" in df_insta.columns:
                _dt = pd.to_datetime(df_insta["date"], errors="coerce")
                mask_week = (_dt.dt.date >= cur_since) & (_dt.dt.date <= last_full_day)
                mask_prev = (_dt.dt.date >= prev_since) & (_dt.dt.date <= prev_until)
                df_week_posts = df_insta[mask_week]
                df_prev_posts = df_insta[mask_prev]
                if len(df_week_posts) > 0:
                    week_eng = float(df_week_posts["eng"].mean())
                    week_reach = float(df_week_posts["reach"].mean())

    # UN CANAL MUET EST UNE DONNÉE, PAS UNE ABSENCE DE DONNÉE (ticket 20).
    # Sans cette clause, le pire cas se refermait sur lui-même : un compte qui
    # ne fait QUE du Meta Ads et dont le jeton Meta vient d'expirer a
    # `total_spend == 0` sur la fenêtre, donc `has_data` faux, donc AUCUN
    # rapport et aucun email — exactement le silence que ce ticket existe pour
    # supprimer, reconstitué par une autre porte. Le rapport publié alors ne
    # porte aucun chiffre de pub (ils se taisent tous, plus haut) : il porte
    # ce qu'on n'a pas pu lire et le geste qui le répare.
    has_data = (total_spend > 0 or g_spend > 0 or followers_current > 0
                or bool(pub_muette))
    if not has_data:
        return None

    # Le numéro suit la fenêtre, pas le jour de fabrication : « Semaine 38 ·
    # 7 → 13 septembre » se contredisait tout seul pour un compte servi le
    # lundi, et republier un mardi renumérotait le même rapport.
    week_num = week_start_rapport.isocalendar()[1]
    week_label = (
        f"Semaine {week_num} · {cur_since.day} → {last_full_day.day} "
        f"{MONTHS_FR[last_full_day.month]} · 7 jours pleins"
    )

    # ── Profil + GA4 + recos (même moteur que le rapport) ────────────────────
    objectif = None
    feedback: dict = {}
    # Le verdict PERSISTÉ (voir `suivi_actions.verdict`, écrit plus bas dans la
    # boucle de mesure) — repondère `done` selon ce qu'il a réellement donné,
    # pas seulement selon le clic (`_DONE_W`, `saas/recos_ia/reco_engine.py`).
    verdicts: dict = {}
    # Le contexte par thème d'un feedback (colonnes `theme`/`title`, migration
    # `reco_feedback_contexte.sql`) — sert à museler `not_for_me` PAR THÈME
    # (pas tout le compte, voir `feedback_theme` plus bas) et à retrouver le
    # TEXTE des conseils marqués « ◇ Trop compliqué » — voir `_bloques` plus bas.
    reco_ctx: list | None = None
    try:
        objectif = lecteur.objectif()
        feedback = lecteur.reco_feedback()
        verdicts = lecteur.verdicts()
        reco_ctx = lecteur.contexte_theme()
    except Exception:
        pass
    # `reco_ctx` vaut `None` quand la requête a échoué (migration
    # `reco_feedback_contexte.sql` pas encore jouée) — DISTINCT d'une liste
    # vide (requête réussie, rien à raconter). Sert de garde-fou plus bas
    # (`theme=`/`feedback_theme=` des deux appels à `build_recos`) : tant que
    # ce signal vaut `None`, le museau `not_for_me` PAR THÈME retombe sur
    # l'ancien museau compte entier — sinon `not_for_me` perdrait tout effet
    # sur les cartes de thème tant que la migration n'est pas jouée
    # (régression relevée par le checker, 2e passe).
    _theme_ctx_ok = reco_ctx is not None
    # {(reco_key, thème normalisé): reaction} — la plus récente par couple
    # (`reco_ctx` est déjà trié du plus récent au plus ancien). `_nrm` n'est
    # défini que plus bas (dans `build_payload`) : on répète ici la même règle
    # de normalisation (`str(...).strip().lower()`) pour rester autonome.
    feedback_theme: dict = {}
    for _row in (reco_ctx or []):
        _k = _row.get("reco_key")
        _t = str(_row.get("theme") or "").strip().lower()
        if _k and _t:
            _pair = (_k, _t)
            if _pair not in feedback_theme:
                feedback_theme[_pair] = _row.get("reaction")
    # L'hypothèse ACTIVE de chaque thème (table `theme_plan`) — pas
    # l'historique, l'état courant, pour bloquer une nouvelle hypothèse tant
    # que la fenêtre d'attente de la précédente n'est pas écoulée (voir
    # `ATTENTE_MIN_NOUVELLE_HYPOTHESE` plus haut).
    try:
        theme_plan_by = lecteur.plan_de_theme()
    except Exception:
        theme_plan_by = {}
    try:
        ga4_ctx = lecteur.ga4_contexte(cur_since, last_full_day)
    except Exception:
        ga4_ctx = None
    # Meme contexte sur la fenetre precedente — sert le repere du bloc metriques.
    try:
        ga4_prev = lecteur.ga4_contexte(prev_since, prev_until)
    except Exception:
        ga4_prev = None

    # ── Configs campagnes (labels) — servent la matrice ET le bloc thèmes ─────
    try:
        meta_cfg = lecteur.config_meta() or {}
        goog_cfg = {str(k): v for k, v in (lecteur.config_google() or {}).items()}
    except Exception:
        meta_cfg, goog_cfg = {}, {}

    # ── LES ÉVÉNEMENTS QUE LE CLIENT A RATTACHÉS À SES THÈMES ────────────────
    #
    # {label: [{event_name, rang}]}, les principaux d'abord. Vide quand la
    # migration `theme_ga4_events.sql` n'est pas passée, ou quand rien n'a été
    # choisi — et dans ce cas TOUT ce qui suit se tait : aucune règle nouvelle
    # ne se déclenche, la courbe garde son indicateur d'avant. C'est la
    # propriété qui rend cette fonctionnalité non bloquante pour les comptes
    # existants.
    try:
        theme_events = lecteur.ga4_evenements_par_theme() or {}
    except Exception:
        theme_events = {}

    # ── L'OBJECTIF PROPRE D'UN THÈME, QUAND IL DIFFÈRE DE CELUI DU COMPTE ────
    #
    # {label: 'ventes'|'notoriete'|'engagement'}. Vide quand la migration
    # `theme_objectifs.sql` n'est pas passée, ou quand rien n'a été choisi — et
    # dans ce cas `_obj_theme` ci-dessous retombe systématiquement sur
    # `objectif`, l'objectif du compte. C'est ce qui rend la fonctionnalité non
    # bloquante pour les comptes existants : un thème sans réglage propre se
    # comporte exactement comme avant elle.
    try:
        theme_objectifs = lecteur.objectifs_par_theme() or {}
    except Exception:
        theme_objectifs = {}

    # `_obj_theme` est défini ICI mais lit `priority_labels`, calculée plus bas
    # (§ vision globale) — Python résout les variables libres d'une closure au
    # MOMENT DE L'APPEL, pas à la définition, et `_obj_theme` n'est jamais
    # appelée avant que `priority_labels` existe (le premier appel réel est dans
    # `_theme_series`, définie bien après). Voir `priority_labels: list = []`
    # plus bas pour la valeur de repli si la lecture échoue.
    def _obj_theme(lbl: str) -> str | None:
        """L'objectif EFFECTIF d'un thème : le sien s'il en a un ET que le
        thème est ENCORE prioritaire, sinon celui du compte.

        UNIQUEMENT SI ÉTOILÉ : ce réglage n'a de sens que pour les thèmes
        prioritaires (voir la tâche d'origine). Un thème qui perd son étoile
        retombe donc silencieusement sur l'objectif du compte — sans que sa
        ligne `theme_objectifs` soit effacée : le choix dort, il ne s'annule
        pas, et se réapplique tout seul si le thème redevient prioritaire un
        jour (voir le commentaire de `theme_objectifs.sql`)."""
        if lbl not in priority_labels:
            return objectif
        return theme_objectifs.get(lbl) or objectif

    # Les lignes datées de `ga4_events`, lues UNE fois. `build_ga4_context`
    # agrège sur une fenêtre et perd les dates ; la courbe d'un thème, elle, a
    # besoin de la ventilation par semaine — c'est exactement ce qui manquait au
    # revenu (voir la note de `_theme_series` : « by_campaign donne un revenu
    # total par campagne, sans dates »). Un événement choisi n'a pas ce défaut.
    try:
        ga4_event_rows = lecteur.ga4_lignes() or []
    except Exception:
        ga4_event_rows = []

    # ── Vision globale : matrice full-history + constats validables ──────────
    # Toute la profondeur disponible (Ads depuis le 1er janvier, posts stockés),
    # pas la fenêtre 7 jours. Les verdicts du client (insight_feedback) sont
    # réappliqués à chaque régénération — un constat rejeté reste écarté.
    #
    # LE TOTAL PAR THÈME SE LIT, IL NE SE CALCULE PLUS ICI. La vue
    # `theme_regroupement` est la seule implémentation du regroupement — Pulse
    # lit la même, ce qui est tout l'objet du ticket 04.
    #
    # CETTE LECTURE EST HORS DU `try` QUI SUIT, EXPRÈS. La vue absente est une
    # migration qui manque, pas un compte sans données : l'avaler donnerait un
    # rapport SANS AUCUNE CARTE DE THÈME, publié et envoyé par email, qui se
    # lirait comme un compte qui n'a rien fait. `publish_weekly_report` la
    # laisse remonter, le canal « rapport » finit en échec, et le journal dit
    # quelle migration jouer.
    themes_regroupes = lecteur.themes_regroupes()

    matrix = None
    constats: list = []
    priority_labels: list = []
    ins_fb: dict = {}
    try:
        hist_since = date(today.year, 1, 1)
        try:
            ga4_full = lecteur.ga4_contexte(hist_since, last_full_day)
        except Exception:
            ga4_full = None
        matrix = build_matrix(df_meta_raw, df_google,
                              df_insta if not df_insta.empty else None,
                              meta_cfg, goog_cfg, ga4_full, last_full_day,
                              themes_regroupes)
        ins_fb = lecteur.insight_feedback()
        # TOUS les thèmes étoilés (page Thèmes), dans l'ordre où ils ont été
        # étoilés — stockés dans insight_feedback sous la clé
        # priority_label:<nom>. Le `[:3]` qui coupait ici jetait la quatrième
        # étoile en silence : elle s'affichait sur la page Thèmes et le rapport
        # l'ignorait. Le plafond de LECTURE n'existe donc plus ici : toutes les
        # étoiles sont lues, et c'est `_THEMES_CONSEILLES` qui décide, plus bas,
        # lesquelles reçoivent des conseils.
        priority_labels = _labels_prioritaires(lecteur, ins_fb)
        constats = build_constats(matrix, ins_fb, priority_labels)
    except Exception:
        matrix, constats = None, []

    # ── Profil client vivant — calibre le ton/niveau de détail du brief IA ───
    # Recalculé au rythme de CET appel, donc une fois par semaine (le rapport
    # ne se génère pas plus souvent) — pas de boucle de mise à jour séparée à
    # maintenir. Voir la décision : `.scratch/recos-generales/issues/05-profil-client-vivant.md`.
    try:
        onboarding = lecteur.profil_onboarding()
    except Exception:
        onboarding = {}
    try:
        client_profile = lecteur.persona(
            objectif=objectif,
            onboarding=onboarding, feedback=feedback, verdicts=verdicts,
            insight_feedback=ins_fb, theme_feedback=feedback_theme,
        )
    except Exception:
        client_profile = None

    rule_recos = build_recos(
        df_camp=df_camp if not df_camp.empty else None,
        avg_ctr=avg_ctr,
        df_insta=df_insta if not df_insta.empty else None,
        df_week_posts=df_week_posts,
        followers_current=followers_current,
        ga4=ga4_ctx,
        objectif=objectif,
        feedback=feedback,
        # Pas de `theme` ici : les « réglages » (GA4, funnel) sont comptes
        # entier, pas par thème — `not_for_me` reste donc scopé compte entier,
        # comme avant TASK-025. `verdicts`, lui, s'applique partout : `done`
        # dépriorise selon ce qu'il a réellement donné (`_DONE_W`), pas
        # seulement selon le clic.
        verdicts=verdicts,
        vision=constats,
    )

    # ── Recos PAR THÈME : le client travaille label par label, cross-canal ────
    # Chaque thème reçoit sa carte, calculée sur SES campagnes (Meta+Google) et
    # SES posts seulement. Seules les `_THEMES_CONSEILLES` premières étoiles y
    # reçoivent des CONSEILS — les autres cartes portent leurs chiffres, leur
    # courbe et leur veille, rien de plus. Ces conseils sont tous GRATUITS : ce
    # sont les règles du moteur. Les conseils « réglages » (GA4, funnel) sont
    # sortis dans un bloc à part — `SETUP_KEYS`, définie au niveau module.
    _obj_txt0 = OBJECTIFS[objectif]["label"] if objectif in OBJECTIFS else "non défini"

    def _nrm(s):
        return str(s or "").strip().lower()

    name2label = {}
    for _n, _c in (meta_cfg or {}).items():
        if (_c or {}).get("label"):
            name2label[_nrm(_n)] = _c["label"]
    for _cid, _c in (goog_cfg or {}).items():
        if (_c or {}).get("label") and (_c or {}).get("campaign_name"):
            name2label[_nrm(_c["campaign_name"])] = _c["label"]

    # ── LE POIDS D'UN THÈME — ce qui passe par lui, en part du compte ────────
    #
    # Sert deux fois : à choisir les thèmes du rapport, et à classer les
    # conseils entre eux (`_importance`). On ne convertit RIEN : une part de
    # dépense et une part de publications restent deux grandeurs différentes,
    # on prend simplement la plus grande des deux. C'est un ordre d'attention,
    # jamais une mesure — il ne sort pas d'ici et ne s'affiche nulle part.
    _themes_matrice = (matrix or {}).get("themes", [])
    _tot_spend = sum(float(t.get("spend") or 0) for t in _themes_matrice)
    _tot_posts = sum(int(t.get("posts") or 0) for t in _themes_matrice)

    def _poids_theme(t):
        part_argent = (float(t.get("spend") or 0) / _tot_spend) if _tot_spend > 0 else 0.0
        part_contenu = (int(t.get("posts") or 0) / _tot_posts) if _tot_posts > 0 else 0.0
        return max(part_argent, part_contenu)

    theme_list = list(priority_labels)
    if not theme_list and _themes_matrice:
        # `spend > 0` EXCLUAIT L'ORGANIQUE, deux fois plutôt qu'une :
        # `matrix["themes"]` est trié par dépense décroissante, donc un thème
        # qui ne fait que publier arrivait dernier — puis le filtre le retirait.
        # Un compte sans publicité n'avait alors AUCUN thème, donc aucune carte,
        # donc aucun conseil : tout le rapport tenait dans son verdict. On
        # classe désormais par le poids ci-dessus, qui compte les publications
        # comme il compte les francs.
        #
        # Ce `[:3]`-ci RESTE. Ce n'est pas le plafond qu'on vient de lever : le
        # précédent jetait un choix explicite du client, celui-ci est un défaut
        # pour un compte qui n'a rien choisi. Personne n'a demandé quinze cartes
        # sans avoir posé une seule étoile.
        theme_list = [t["label"] for t in
                      sorted(_themes_matrice, key=_poids_theme, reverse=True)
                      if _poids_theme(t) > 0][:3]

    matrix_campaigns = (matrix or {}).get("campaigns", [])
    matrix_themes_by = {_nrm(t["label"]): t for t in (matrix or {}).get("themes", [])}

    # ── Les dates DÉCLARÉES par les plateformes ──────────────────────────────
    # Lues UNE fois, ici, parce que deux blocs en ont besoin : la veille des
    # campagnes neuves juste en dessous, et la frise tout en bas. Elles ne se
    # déduisent pas de la dépense — c'est justement leur intérêt : la dépense
    # dit qu'une campagne TOURNE, la date déclarée dit qu'elle DEVAIT tourner.
    # Voir supabase/migrations/campagnes_dates_declarees.sql.
    def _dates_declarees():
        out = {}
        for _table, _canal in (("meta_campaign_config", "meta"),
                               ("google_campaign_config", "google")):
            try:
                _rows = lecteur.dates_declarees(_table)
            except Exception:
                _rows = []   # migration pas encore passée — on reste muet
            for _row in _rows:
                _nom = (_row.get("campaign_name") or "").strip()
                if _nom:
                    # Même troncature que partout ailleurs : les deux côtés
                    # doivent porter la même forme du nom, sinon une campagne au
                    # nom long perd sa date déclarée sans que rien ne le dise.
                    out[(_canal, str(_nom)[:60])] = {"start": _row.get("start_date"),
                                                     "end": _row.get("end_date")}
        return out

    _declare_camp = _dates_declarees()

    # ── LES RAPPORTS DÉJÀ PUBLIÉS, LUS UNE SEULE FOIS ────────────────────────
    #
    # Deux blocs les lisaient — le savoir-faire de fond (« conseils proposés
    # semaine après semaine sans jamais être appliqués ») et, maintenant, le
    # filet des thèmes calmes, qui a besoin de savoir depuis combien de semaines
    # un thème n'a rien à dire. Deux requêtes sur la même table pouvaient rendre
    # deux vérités différentes si une publication passait entre les deux.
    #
    # LA SEMAINE EN COURS EST EXCLUE, et ce n'est pas un détail : ce worker
    # publie au cron du Jour de travail, et une republication à la main
    # (GitHub Actions, `report_only`) repasse par-dessus. Sans ce filtre, un
    # thème calme le matin se serait compté lui-même l'après-midi, et la carte
    # aurait changé de texte sans qu'aucune donnée n'ait bougé.
    #
    # LA BORNE EST CELLE DU RAPPORT QU'ON FABRIQUE, pas le lundi d'aujourd'hui :
    # c'est sous `week_start_rapport` que cette publication va s'écrire, donc
    # c'est cette ligne-là — et elle seule — qu'il faut tenir hors de son propre
    # historique. Les deux valeurs ne diffèrent que pour un compte servi le
    # lundi, mais c'est exactement le compte qui se serait relu lui-même.
    _rapports_publies = []
    # LA SEMAINE DU DERNIER RAPPORT PUBLIÉ, gardée à côté des payloads.
    # C'est la borne « depuis la dernière fois qu'on a parlé », et elle sert à
    # la Marche suivante : une Stratégie n'avance que d'un cran par clic
    # « ✓ Je l'ai fait », pas d'un cran par rapport. `None` = premier rapport
    # de ce compte, et alors tout clic est nouveau.
    _semaine_precedente = None
    try:
        _histo = lecteur.rapports_publies(week_start_rapport.isoformat())
        _rapports_publies = [(_h.get("payload") or {}) for _h in _histo]
        # `rapports_publies` rend les plus récents d'abord (`.order("week_start",
        # desc=True)`) — on ne re-trie pas, on prend le premier.
        _semaine_precedente = (str(_histo[0].get("week_start") or "")[:10]
                               or None) if _histo else None
    except Exception:
        _rapports_publies = []
        _semaine_precedente = None

    # ── Les campagnes lancées DEPUIS PEU (≤ 14 jours) ────────────────────────
    # Rien de nouveau n'est demandé à personne : le premier jour où une campagne
    # a dépensé est déjà en base. Deux populations, et la seconde est la plus
    # intéressante — une campagne déclarée qui n'a jamais dépensé n'apparaît
    # dans aucun chiffre du rapport, et c'est exactement pour ça qu'on ne la
    # voit jamais.
    def _campagnes_par_nom():
        agg = {}

        def _ajoute(nom, canal, jour, depense, clics, impr):
            if not nom or jour is None:
                return
            c = agg.setdefault((canal, str(nom)[:60]), {
                "nom": str(nom)[:60], "canal": canal, "debut": jour,
                "jours": set(), "depense": 0.0, "clics": 0, "impressions": 0})
            c["debut"] = min(c["debut"], jour)
            c["jours"].add(jour)
            c["depense"] += float(depense or 0)
            c["clics"] += int(clics or 0)
            c["impressions"] += int(impr or 0)

        if df_meta_raw is not None and not df_meta_raw.empty:
            _m = df_meta_raw.copy()
            _m["jourdt"] = pd.to_datetime(_m["date_start"], errors="coerce")
            for _r in _m.itertuples():
                if pd.isna(_r.jourdt) or float(getattr(_r, "spend", 0) or 0) <= 0:
                    continue
                _ajoute(getattr(_r, "campaign_name", None), "meta", _r.jourdt.date(),
                        getattr(_r, "spend", 0), getattr(_r, "clicks", 0),
                        getattr(_r, "impressions", 0))
        if not df_google.empty and "campaign_name" in df_google.columns:
            _g = df_google.copy()
            _g["jourdt"] = pd.to_datetime(_g["date_start"], errors="coerce")
            for _r in _g.itertuples():
                _cout = float(getattr(_r, "cost_micros", 0) or 0) / 1_000_000.0
                if pd.isna(_r.jourdt) or _cout <= 0:
                    continue
                _ajoute(getattr(_r, "campaign_name", None), "google", _r.jourdt.date(),
                        _cout, getattr(_r, "clicks", 0), getattr(_r, "impressions", 0))
        return agg

    _camp_recentes = []
    try:
        _borne_veille = last_full_day - timedelta(days=_VEILLE_JOURS - 1)
        _toutes = _campagnes_par_nom()
        for _c in _toutes.values():
            if _c["debut"] >= _borne_veille:
                _c["theme"] = name2label.get(_nrm(_c["nom"]))
                _c["muette"] = False
                _camp_recentes.append(_c)
        for (_canal, _nom), _d in _declare_camp.items():
            if (_canal, _nom) in _toutes or not _d.get("start"):
                continue
            try:
                _dep = date.fromisoformat(str(_d["start"])[:10])
            except (ValueError, TypeError):
                continue
            if not (_borne_veille <= _dep <= last_full_day):
                continue
            _camp_recentes.append({
                "nom": _nom, "canal": _canal, "debut": _dep, "jours": set(),
                "depense": 0.0, "clics": 0, "impressions": 0,
                "theme": name2label.get(_nrm(_nom)), "muette": True,
            })
        _camp_recentes.sort(key=lambda c: (-c["debut"].toordinal(), c["nom"]))
    except Exception:
        _camp_recentes = []

    # ── UNE CAMPAGNE NEUVE N'AJOUTE PLUS SON THÈME ───────────────────────────
    #
    # Ce bloc ajoutait ici UN thème non étoilé quand une campagne y avait
    # démarré depuis moins de `_VEILLE_JOURS`. L'intention était juste — c'est
    # la seule chose du rapport qui ne sera plus vraie dans quinze jours — mais
    # elle sortait au mauvais endroit : deux étoiles posées, trois cartes à
    # l'écran, sous un titre qui dit « Tes thèmes prioritaires ». Le rapport
    # affirmait une priorité que le client n'a pas choisie. Retiré le 15 août
    # 2026, sur signalement de David.
    #
    # LE SIGNAL, LUI, NE DISPARAÎT PAS — ET IL N'A JAMAIS EU BESOIN DE CE BLOC.
    # `changements` (plus bas) parcourt TOUTES les campagnes, pas celles de
    # `theme_list`, et écrit un fait daté par campagne neuve — `lancee`, ou
    # `jamais_lancee` quand elle est déclarée et muette — en portant son thème.
    # Côté web, un fait dont le thème n'a pas de carte tombe PAR CONSTRUCTION
    # dans le filet « Ce qu'aucun thème ne prend » (`chgOrphelins`,
    # `app/page.tsx`), qui est le complément exact des cartes. C'est-à-dire
    # exactement là où on veut le lire : quelque chose s'est produit là où aucun
    # thème ne regarde. Le bloc retiré DOUBLAIT donc ce signal, et le doublon
    # sortait sous le mauvais titre.
    #
    # CE QU'ON PERD, ET IL FAUT L'ÉCRIRE : la carte de ce thème portait aussi le
    # mini-conseil de veille (`_reco_veille`, « attends le 24 avant de juger »).
    # Une consigne sur un thème que le client ne suit pas est exactement
    # l'invité déguisé qu'on retire ; le FAIT reste, la consigne part.
    #
    # `_camp_recentes` sert encore juste en dessous : la veille reste calculée,
    # mais seulement pour les thèmes que le client a désignés.

    # Le rang d'enjeu de chaque thème retenu — l'argument n° 2 de `_importance`.
    # Il se calcule sur le POIDS et pas sur l'ordre de `theme_list` : les thèmes
    # prioritaires arrivent triés par ordre alphabétique, ce qui ne veut rien
    # dire.
    _poids_par_theme = {_nrm(t["label"]): _poids_theme(t) for t in _themes_matrice}
    _rang_theme = {n: i for i, n in enumerate(sorted(
        (_nrm(_l) for _l in theme_list),
        key=lambda n: -_poids_par_theme.get(n, 0.0)))}

    # ── Frise (Phase 2) : série hebdo de la métrique du thème + repères d'actions
    _markers = {}
    _marches_faites: dict[str, list[dict]] = {}
    try:
        # Le repere se pose au jour ou l'action a ete FAITE (a defaut, decidee).
        # On garde son TITRE avec sa date : un pointille muet ne relie rien, et
        # l'index de semaine seul ne permet pas d'ecrire ce qu'on a fait.
        #
        # UNE HYPOTHÈSE AUTO (`detail.origin == "auto"`) EST EXCLUE tant
        # qu'elle n'a jamais reçu de vraie décision client. Plus rien n'en
        # écrit depuis le ticket 06 — le garde reste pour les lignes déjà en
        # base, qui elles ne disparaissent pas. Un repère ▲ signifie « le client a décidé ceci, et
        # ça sera jugé » (voir `etat-action.tsx`, la distinction pastille
        # ronde / glyphe de plateforme) — en poser un pour une décision que
        # personne n'a prise fabrique un fait, ce que ce produit interdit
        # (CLAUDE.md §7). Cette frise ET la courbe de la boussole
        # (`kpi_focus.marqueurs`, plus bas) lisent ce même dict : le filtre à
        # la source suffit pour les deux.
        #
        # ATTENTION (rejet du checker, 3e passe) : NE PAS filtrer sur
        # `status == "auto"` — `status` change (archivée, abandonnée,
        # confirmée) sans que ça touche `detail.origin`, qui lui est durable
        # (voir le commentaire détaillé plus bas, section « suivi_actions »).
        # Un `done_at` posé est la PREUVE d'un vrai clic « ✓ Je l'ai fait »
        # (seul `resolveAction(id,"done")` l'écrit) : dès qu'il existe, la
        # ligne devient une vraie décision client, quelle que soit son
        # origine, et mérite son repère.
        for _a in lecteur.suivi_actions():
            # UNE NOTE PAS ENCORE COCHÉE N'EST PAS UN FAIT (ticket 33). Depuis
            # le ticket 11, une Note peut naître `running` : le client écrit ce
            # qu'il COMPTE faire, et la ligne ne se date qu'au moment où on la
            # coche (`CONTEXT.md`, entrée Note). Son `decided_at` est pourtant
            # déjà posé — c'est le jour de l'ÉCRITURE, que `saveNoteOuverte`
            # inscrit et que le cochage RÉÉCRIRA au jour choisi. Sans ce filtre,
            # le jour où quelqu'un tape « il faudrait refaire les visuels »
            # posait un ▲ sur la frise et sur la boussole, faisant attribuer un
            # mouvement de courbe à un geste jamais fait (`CLAUDE.md` §7). La
            # marque n'est pas perdue : elle revient au cochage, à la bonne date.
            #
            # FILTRÉ ICI ET PAS DANS LA REQUÊTE, comme la boucle de verdict plus
            # bas : un `.neq("kind", …)` échouerait sur une base où la colonne
            # n'existe pas encore, et l'`except` qui entoure cette lecture
            # viderait alors TOUS les repères en silence.
            if _a.get("kind") == "note" and _a.get("status") == "running":
                continue
            _det = _a.get("detail")
            _origine_auto = isinstance(_det, dict) and _det.get("origin") == "auto"
            if _origine_auto and not _a.get("done_at"):
                continue
            _d = _a.get("done_at") or _a.get("decided_at")
            _markers.setdefault(_nrm(_a.get("theme")), []).append(
                {"date": str(_d)[:10], "titre": (_a.get("title") or "").strip()}
            )
            # ── LES MARCHES QUE LE CLIENT DÉCLARE AVOIR FAITES ──────────────
            #
            # Ce que `marche_suivante` attend pour écrire la suivante, et
            # l'unique déclencheur qu'elle ait : « la suivante n'arrive que
            # lorsque la précédente est faite — un Verdict ne fait pas avancer
            # d'une marche, il dit si la Stratégie continue ou change »
            # (`CONTEXT.md`, entrée Marche ; `.scratch/refonte/issues/
            # 14-le-conseil-facile-et-la-degradation.md`, décision 9).
            #
            # `done_at` EST LA CONDITION, PAS `status`. C'est la seule preuve
            # d'un vrai clic « ✓ Je l'ai fait » (seul `resolveAction(id,"done")`
            # l'écrit, `saas/web/app/actions.ts`) ; `status` peut valoir "done"
            # sur une ligne d'avant la migration `done_at`, et faire avancer une
            # Stratégie sur une date qu'on n'a pas serait exactement le geste
            # jamais confirmé que le ticket 06 a retiré du carnet
            # (`CLAUDE.md` §7).
            #
            # Lu ICI et pas dans une seconde requête : `suivi_actions()` est
            # déjà en main, et la boucle par thème qui s'en sert est plus bas.
            #
            # UNE NOTE N'EST PAS UNE MARCHE, et c'est le même filtre que la
            # boucle de verdict s'impose déjà plus bas : depuis que le module
            # « À faire » sait créer une ligne de suivi (ticket 11 de la
            # construction), `suivi_actions` en ramène. Une Note n'a ni
            # indicateur, ni baseline, ni Stratégie derrière elle
            # (`CONTEXT.md`, entrée Note) — faire descendre une échelle d'un
            # cran parce que quelqu'un a coché un texte libre inventerait la
            # Stratégie que ce texte n'a jamais ouverte.
            if _a.get("done_at") and _a.get("kind") != "note":
                _marches_faites.setdefault(_nrm(_a.get("theme")), []).append(_a)
    except Exception:
        _markers = {}
        _marches_faites = {}

    # La plus récente en DERNIER — `marche_suivante` prend `[-1]` comme étape
    # qui vient d'être terminée, et lui donne les autres comme ce qu'il ne doit
    # pas répéter. Un tri par texte suffit : `done_at` est une date ISO.
    for _lst in _marches_faites.values():
        _lst.sort(key=lambda a: str(a.get("done_at") or ""))

    def _reperes(dates):
        """Les reperes d'une serie, groupes par semaine et nommes.

        Deux actions la meme semaine ne peuvent pas porter deux etiquettes au
        meme endroit : la semaine en porte une seule, qui dit combien elles
        sont. `markers` (les index nus) reste emis a cote pour les rapports
        deja publies.
        """
        par_sem = {}
        for _m in dates or []:
            try:
                _wi = _wk_idx(date.fromisoformat(_m["date"]))
            except Exception:
                _wi = None
            if _wi is not None:
                par_sem.setdefault(_wi, []).append(_m)
        out = []
        for _wi in sorted(par_sem):
            _lot = sorted(par_sem[_wi], key=lambda m: m["date"])
            out.append({
                "i": _wi,
                "date": _lot[-1]["date"],
                "titre": _lot[-1]["titre"] if len(_lot) == 1 else "",
                "n": len(_lot),
            })
        return out
    _WK = 10
    _serie_start = last_full_day - timedelta(days=7 * _WK - 1)

    def _wk_idx(d):
        n = (d - _serie_start).days
        return n // 7 if 0 <= n < 7 * _WK else None

    def _theme_series(lbl, revenu=None):
        """La courbe d'un theme. `revenu` = ce que le bilan du theme a constate.

        Il n'est PAS decoratif : sans lui, la note « le ROAS de ce theme n'est
        pas mesurable » s'ecrivait sous un bilan qui affichait « 820 CHF de
        revenu · ROAS 0,2 ». Les deux ne peuvent pas etre vrais en meme temps.
        """
        nlbl = _nrm(lbl)
        spend_w = [0.0] * _WK
        reach_w = [[] for _ in range(_WK)]
        eng_w = [[] for _ in range(_WK)]
        has_spend = False
        if df_meta_raw is not None and not df_meta_raw.empty:
            mm = df_meta_raw[df_meta_raw["campaign_name"].map(lambda n: name2label.get(_nrm(n)) == lbl)]
            for _d, _sp in zip(mm["date_start"], mm["spend"]):
                _dd = _d.date() if hasattr(_d, "date") else _d
                _wi = _wk_idx(_dd) if _dd is not None else None
                if _wi is not None:
                    spend_w[_wi] += float(_sp or 0); has_spend = True
        if df_google is not None and not df_google.empty and "campaign_id" in df_google.columns:
            gg = df_google[df_google["campaign_id"].astype(str).map(
                lambda c: (goog_cfg.get(c, {}) or {}).get("label") == lbl)]
            for _d, _cm in zip(gg["date_start"], gg["cost_micros"]):
                _dd = _d.date() if hasattr(_d, "date") else _d
                _wi = _wk_idx(_dd) if _dd is not None else None
                if _wi is not None:
                    spend_w[_wi] += float(_cm or 0) / 1e6; has_spend = True
        if df_insta is not None and not df_insta.empty and "labels" in df_insta.columns:
            _dtp = pd.to_datetime(df_insta["date"], errors="coerce")
            for _i in range(len(df_insta)):
                _lb = df_insta.iloc[_i].get("labels")
                if not (isinstance(_lb, (list, tuple)) and lbl in _lb):
                    continue
                _d = _dtp.iloc[_i]
                if pd.isna(_d):
                    continue
                _wi = _wk_idx(_d.date())
                if _wi is not None:
                    reach_w[_wi].append(float(df_insta.iloc[_i].get("reach") or 0))
                    eng_w[_wi].append(float(df_insta.iloc[_i].get("eng") or 0))
        # ── L'ÉVÉNEMENT PRINCIPAL, SEMAINE PAR SEMAINE ──────────────────────
        #
        # C'est la seule série de ce module qui vienne d'un choix EXPLICITE du
        # client : il a désigné, pour ce thème, l'événement sur lequel il veut
        # être jugé. Elle passe donc devant la dépense.
        #
        # QUAND PLUSIEURS ÉVÉNEMENTS SONT PRINCIPAUX, on prend celui qui a le
        # plus gros volume sur la fenêtre. Une courbe ne porte qu'une grandeur
        # (grammaire des modules : une seule forme par module), et additionner
        # `purchase` et `generate_lead` fabriquerait un total qui ne veut rien
        # dire. Le nom de l'événement retenu est ÉCRIT sur l'axe — sans lui, le
        # lecteur ne saurait pas lequel des deux il regarde.
        ev_pts = None
        ev_nom = None
        _princ = [c["event_name"] for c in (theme_events.get(lbl) or [])
                  if c["rang"] == "principal"]
        if _princ and ga4_event_rows:
            _par_nom: dict = {}
            for _r in ga4_event_rows:
                _nom = _r.get("event_name") or ""
                if _nom not in _princ:
                    continue
                # Le pont : l'événement n'appartient au thème que si sa campagne
                # UTM est une campagne étiquetée de ce thème. Pas de campagne,
                # ou campagne inconnue → il n'est attribué à personne.
                if name2label.get(_nrm(_r.get("campaign") or "")) != lbl:
                    continue
                try:
                    _dd = date.fromisoformat(str(_r.get("date"))[:10])
                except Exception:
                    continue
                _wi = _wk_idx(_dd)
                if _wi is None:
                    continue
                _par_nom.setdefault(_nom, [0] * _WK)[_wi] += int(_r.get("event_count") or 0)
            if _par_nom:
                ev_nom, ev_pts = max(_par_nom.items(), key=lambda kv: sum(kv[1]))

        # L'indicateur suit l'objectif DU THÈME — le sien s'il en a un, sinon
        # celui du compte (`_obj_theme`, héritage silencieux). Quand celui
        # qu'on VOULAIT suivre n'est pas mesurable (le ROAS sans valeur de
        # conversion GA4), on se rabat sur le meilleur substitut ET on le dit —
        # plutôt que d'afficher un 0,0 qui ressemble a une catastrophe.
        obj = _obj_theme(lbl)
        note = None
        if ev_pts is not None and obj not in ("notoriete", "engagement"):
            pts = list(ev_pts)
            metric_label = f"« {ev_nom} » par semaine"
        elif obj == "notoriete" and any(x for x in reach_w):
            pts = [round(sum(x) / len(x)) if x else 0 for x in reach_w]
            metric_label = "Portée moyenne"
        elif obj == "engagement" and any(x for x in eng_w):
            pts = [round(sum(x) / len(x), 2) if x else 0 for x in eng_w]
            metric_label = "Engagement moyen (%)"
        elif ev_pts is not None:
            # L'objectif visé (portée, engagement) n'a rien à mesurer sur ce
            # thème — pas de publication organique. L'événement principal
            # reprend la main plutôt que de laisser la dépense décrire un thème
            # dont on sait ce qu'il rapporte.
            pts = list(ev_pts)
            metric_label = f"« {ev_nom} » par semaine"
        elif has_spend:
            pts = [round(v, 2) for v in spend_w]
            metric_label = "Dépense (CHF)"
            # LA NOTE NE S'ECRIT QUE SI ELLE EST VRAIE. Un theme qui a du revenu
            # a un ROAS : dire « pas mesurable » au-dessus d'un « 0,2 ROAS »
            # affiche a l'ecran deux affirmations contradictoires, et c'est la
            # note qui a tort. Ce qui manque dans ce cas n'est pas la mesure,
            # c'est la VENTILATION PAR SEMAINE : `by_campaign` de GA4 donne un
            # revenu total par campagne, sans dates. La courbe reste donc sur la
            # depense — mais en silence, parce qu'il n'y a rien a corriger cote
            # GA4 et qu'envoyer l'utilisateur y regler ses evenements cles
            # serait l'envoyer chercher un probleme qu'il n'a pas.
            if obj == "ventes" and not (revenu and float(revenu) > 0):
                # DEUX MANQUES DIFFÉRENTS, DEUX PHRASES. On sait maintenant les
                # distinguer, et envoyer quelqu'un régler la valeur de ses
                # conversions dans GA4 alors qu'il n'a désigné AUCUN événement
                # pour ce thème, c'est l'envoyer au mauvais endroit.
                note = ("Le ROAS de ce thème n'est pas mesurable : Google Analytics "
                        "remonte tes conversions sans leur valeur en CHF. On suit la "
                        "dépense en attendant — configure la valeur de tes événements "
                        "clés dans GA4 et cette courbe passera au ROAS."
                        if _princ else
                        "Aucun événement n'est désigné comme principal pour ce thème : "
                        "on suit donc sa dépense, faute de savoir ce qu'elle doit "
                        "produire. Va sur la page Thèmes choisir la conversion qui "
                        "compte pour lui, et cette courbe la suivra.")
        else:
            pts = [round(sum(x) / len(x)) if x else 0 for x in reach_w]
            metric_label = "Portée moyenne"
        if sum(1 for v in pts if v > 0) < 3:
            return None  # trop clairsemé → pas de frise
        # ÉTIQUETÉ PAR LA FIN DE SEMAINE, PAS SON DÉBUT. Le dernier point porte
        # sinon une date jusqu'à 6 jours plus vieille que `last_full_day` — le
        # texte des recos (`week_label`) affiche « 24 → 30 août » pendant que le
        # point le plus récent du graphe disait « 24 août » (son propre début de
        # semaine), donnant l'impression fausse d'un graphe perimé (David,
        # TASK-039). Chaque étiquette est donc le dernier jour de son bucket —
        # le même jour que `last_full_day` pour le point le plus récent.
        labels = [(lambda d: f"{d.day} {MONTHS_FR[d.month]}")(_serie_start + timedelta(days=7 * j + 6))
                  for j in range(_WK)]
        _rep = _reperes(_markers.get(nlbl, []))
        return {
            "metric_label": metric_label,
            "note": note,
            "points": [{"label": labels[j], "value": pts[j]} for j in range(_WK)],
            "markers": [r["i"] for r in _rep],
            "marqueurs": _rep,
        }

    # Un theme ne doit voir QUE ses propres conversions GA4. Sans ce filtre, la
    # regle ROAS/CPA divise la depense DU THEME par les conversions DU COMPTE
    # ENTIER : chaque theme se voyait attribuer toutes les conversions, d'ou un
    # cout par conversion beaucoup trop flatteur et en contradiction avec le
    # resume de la semaine.
    def _theme_ga4(lbl):
        if not ga4_ctx:
            return None
        by = ga4_ctx.get("by_campaign") or {}
        conv = 0.0
        rev = 0.0
        sub = {}
        for _cname, _d in by.items():
            if name2label.get(_nrm(_cname)) != lbl:
                continue
            sub[_cname] = _d
            conv += float((_d or {}).get("conversions") or 0)
            rev += float((_d or {}).get("revenue") or 0)
        ctx = dict(ga4_ctx)
        ctx["by_campaign"] = sub
        if sub:
            ctx["paid_conversions"] = conv
            ctx["paid_revenue"] = rev
        else:
            # Rien de rattachable a ce theme (UTM absents ou differents des noms
            # de campagne) : on se tait plutot que d'afficher un chiffre faux.
            ctx["paid_conversions"] = None
            ctx["paid_revenue"] = None

        # ── LES ÉVÉNEMENTS CHOISIS, RAMENÉS AUX CAMPAGNES DE CE THÈME ────────
        #
        # Même pont que le revenu ci-dessus, même limite : `events_by_campaign`
        # est indexé par utm_campaign, et seul un nom qui correspond à une
        # campagne étiquetée franchit le pont. L'organique n'a pas de campagne,
        # donc il n'a pas d'événement de thème — jamais.
        #
        # ON NE MET DANS `evenements` QUE CE QUI A ÉTÉ MESURÉ. Un événement
        # choisi qui n'a aucune ligne sur la fenêtre n'entre pas avec un zéro :
        # il entre dans `mesure_absente`, et les règles savent qu'elles ne
        # doivent pas en parler. Un zéro mesuré (« l'événement existe, il n'a
        # pas eu lieu ») et un zéro faute de données ne sont pas la même
        # information, et ici on ne sait pas distinguer les deux — l'absence de
        # ligne GA4 peut venir d'un tag cassé comme d'un vrai zéro.
        choisis = theme_events.get(lbl) or []
        ctx["evenements"] = {}
        ctx["evenements_principaux"] = []
        ctx["mesure_absente"] = []
        # Les principaux CHOISIS par l'utilisateur qui restent muets (aucune
        # ligne mesurée) — distinct de `mesure_absente` qui mélange principaux
        # et secondaires, et distinct de `evenements_principaux` qui ne contient
        # QUE les principaux mesurés. C'est ce sous-ensemble précis que
        # `_reco_evenements` doit lire pour détecter « principal choisi, resté
        # muet, alors qu'un secondaire a des lignes ».
        ctx["principaux_absents"] = []
        if choisis:
            ev_by_camp = ga4_ctx.get("events_by_campaign") or {}
            cumul: dict = {}
            for _cname, _evs in ev_by_camp.items():
                if name2label.get(_nrm(_cname)) != lbl:
                    continue
                for _nom, _d in (_evs or {}).items():
                    slot = cumul.setdefault(_nom, {"count": 0, "value": 0.0})
                    slot["count"] += int((_d or {}).get("count") or 0)
                    slot["value"] += float((_d or {}).get("value") or 0)
            for _c in choisis:
                _nom = _c["event_name"]
                _vu = cumul.get(_nom)
                if _vu is None:
                    ctx["mesure_absente"].append(_nom)
                    if _c["rang"] == "principal":
                        ctx["principaux_absents"].append(_nom)
                    continue
                ctx["evenements"][_nom] = {
                    "count": _vu["count"], "value": _vu["value"], "rang": _c["rang"],
                }
                if _c["rang"] == "principal":
                    ctx["evenements_principaux"].append(_nom)
        return ctx

    # ── CE QUI PASSE PAR UN THÈME, SEMAINE PAR SEMAINE ───────────────────────
    #
    # Les règles du moteur regardent la semaine du rapport et rien d'autre : un
    # thème ne se compare qu'aux campagnes qui tournent en même temps que lui.
    # Les deux lecteurs ci-dessous ouvrent la seule autre comparaison honnête —
    # le thème contre LUI-MÊME, les semaines d'avant. Aucune donnée nouvelle :
    # ce sont les mêmes lignes que la frise, lues sur une autre fenêtre.
    #
    # ADDITIONNER META ET GOOGLE EST PERMIS ICI, et seulement parce qu'on
    # additionne des dépenses et des clics — deux grandeurs que chaque régie
    # mesure elle-même, comme le fait déjà `_rule_roas`. C'est le REVENU qu'on
    # ne saurait pas ventiler entre les deux, jamais le coût.
    #
    # `lbl=None` NE FILTRE RIEN : c'est toute la pub du compte sur la fenêtre.
    # Ce cas existe pour `_kpis_window`, qui mesure aussi bien un thème que le
    # compte entier et qui doit lire le même périmètre dans les deux cas.
    def _pub_fenetre(lbl, d1, d2):
        sp = im = 0.0
        cl = 0
        canaux = set()
        if df_meta_raw is not None and not df_meta_raw.empty:
            _m = df_meta_raw[(df_meta_raw["date_start"] >= pd.Timestamp(d1))
                             & (df_meta_raw["date_start"] <= pd.Timestamp(d2))]
            if lbl is not None:
                _m = _m[_m["campaign_name"].map(lambda n: name2label.get(_nrm(n)) == lbl)]
            if not _m.empty:
                sp += float(_m["spend"].sum())
                cl += int(_m["clicks"].sum())
                im += float(_m["impressions"].sum())
                canaux.add("meta")
        if (df_google is not None and not df_google.empty
                and "date_start" in df_google.columns):
            _g = df_google[(df_google["date_start"] >= pd.Timestamp(d1))
                           & (df_google["date_start"] <= pd.Timestamp(d2))]
            # L'identifiant de campagne prime sur le nom : c'est lui que porte
            # `google_campaign_config`, et deux campagnes Google peuvent
            # partager un nom.
            if lbl is not None:
                if "campaign_id" in _g.columns:
                    _g = _g[_g["campaign_id"].astype(str).map(
                        lambda c: (goog_cfg.get(c, {}) or {}).get("label") == lbl)]
                elif "campaign_name" in _g.columns:
                    _g = _g[_g["campaign_name"].map(
                        lambda n: name2label.get(_nrm(n)) == lbl)]
                else:
                    _g = _g.iloc[0:0]
            if not _g.empty:
                sp += float(_g["cost_micros"].sum()) / 1e6
                cl += int(_g["clicks"].sum())
                im += float(_g["impressions"].sum())
                canaux.add("google")
        # `aveugle` : les canaux payants qui auraient dû écrire sur cette
        # fenêtre et ne l'ont pas fait (ticket 20). `spend`, `clics` et
        # `impressions` restent des nombres — ce sont les sommes de ce qu'on a
        # VU, et les fenêtres de référence en ont besoin — mais dès que cet
        # ensemble n'est pas vide, ce ne sont plus des TOTAUX : les publier tels
        # quels revient à présenter un trou comme une baisse. C'est au lecteur
        # de se taire, pas à la somme de mentir ; chaque appelant qui publie un
        # de ces nombres teste donc `aveugle` avant.
        return {"spend": sp, "clics": cl, "impressions": im, "canaux": canaux,
                "aveugle": _pub_aveugle(d1, d2)}

    def _posts_theme(lbl, d1, d2):
        """Nombre de publications du thème sur la fenêtre, et leur portée."""
        if df_insta is None or df_insta.empty or "labels" not in df_insta.columns:
            return {"posts": 0, "reach": None}
        _j = pd.to_datetime(df_insta["date"], errors="coerce").dt.date
        _sel = df_insta[(_j >= d1) & (_j <= d2)
                        & df_insta["labels"].map(
                            lambda L: isinstance(L, (list, tuple)) and lbl in L)]
        return {
            "posts": int(len(_sel)),
            "reach": (float(_sel["reach"].mean())
                      if len(_sel) and "reach" in _sel.columns else None),
        }

    def _semaine_theme(lbl, d1, d2):
        _p = _pub_fenetre(lbl, d1, d2)
        _p.update(_posts_theme(lbl, d1, d2))
        return _p

    # ── LES ANNONCES D'UN THÈME, ET LE BUDGET POSÉ SUR SES CAMPAGNES ─────────
    #
    # Ce que lisent les quatre règles payantes
    # (`saas/recos_ia/regles_payantes.py`). Rien n'est récolté de neuf : Meta
    # arrive déjà annonce par annonce dans `df_meta_raw` (`meta_ads_insights`
    # porte `ad_name` et `adset_name`), Google dans `df_gads`, et les budgets
    # posés sont photographiés chaque semaine par `saas/collecte/`.

    # Une campagne est JEUNE quand son premier jour de dépense tient dans les
    # `_VEILLE_JOURS` derniers jours — c'est `_camp_recentes`, déjà calculé
    # pour la veille. C'est le seul proxy honnête de « campagne en test » :
    # rien en base ne dit qu'une campagne EST un test
    # (`.scratch/refonte/issues/24-conseils-payants-manquants.md`, décision 4).
    _camp_jeunes = {(_c["canal"], _c["nom"]) for _c in _camp_recentes}

    def _annonces_theme(lbl, d1, d2):
        """Une ligne par Annonce du thème sur la fenêtre, les deux régies.

        MÉTA N'ENTRE QUE SI `ad_id` EST EN BASE. `meta_ads_insights` a longtemps
        été unique sur `(user_id, date_start, ad_name)`, et deux annonces
        homonymes dans deux Groupes différents fusionnaient à l'insertion — la
        dépense de la seconde disparaissait (~40 % d'une journée mesurée, voir
        `upsert_meta_ads`). Le ticket 03 de la construction pose la colonne ;
        tant que sa migration n'est pas jouée, regrouper par nom rejouerait le
        bug des homonymes DANS LE MOTEUR DE CONSEILS, en comparant une annonce
        fantôme à ses voisines. On préfère se taire côté Meta.
        """
        out = {}

        def _pose(cle, canal, nom, groupe, campagne, impr, clics, depense, conv):
            a = out.setdefault(cle, {
                "cle": cle, "canal": canal, "nom": nom, "groupe": groupe,
                "campagne": campagne, "impressions": 0, "clics": 0,
                "depense": 0.0, "conversions": None,
                "jeune": (canal, str(campagne or "")[:60]) in _camp_jeunes,
            })
            a["impressions"] += int(impr or 0)
            a["clics"] += int(clics or 0)
            a["depense"] += float(depense or 0)
            if conv is not None:
                a["conversions"] = float(a["conversions"] or 0) + float(conv)

        if (df_meta_raw is not None and not df_meta_raw.empty
                and "ad_id" in df_meta_raw.columns):
            _m = df_meta_raw[(df_meta_raw["date_start"] >= pd.Timestamp(d1))
                             & (df_meta_raw["date_start"] <= pd.Timestamp(d2))]
            _m = _m[_m["campaign_name"].map(lambda x: name2label.get(_nrm(x)) == lbl)]
            for _r in _m.itertuples():
                _aid = str(getattr(_r, "ad_id", "") or "")
                if not _aid:
                    continue   # ligne antérieure à la migration : pas d'identité
                _pose(f"meta:{_aid}", "meta",
                      getattr(_r, "ad_name", None), getattr(_r, "adset_name", None),
                      getattr(_r, "campaign_name", None),
                      getattr(_r, "impressions", 0), getattr(_r, "clicks", 0),
                      getattr(_r, "spend", 0),
                      # Meta ne remonte pas la conversion au niveau de l'annonce
                      # dans cette table. Une absence de mesure n'est pas un
                      # zéro (`CLAUDE.md` §7) : `None`, et la règle qui compte
                      # les conversions écarte ces lignes au lieu de les compter
                      # à zéro et de conclure qu'elles ne vendent rien.
                      None)

        if not df_gads.empty and "date_start" in df_gads.columns:
            _g = df_gads[(df_gads["date_start"] >= pd.Timestamp(d1))
                         & (df_gads["date_start"] <= pd.Timestamp(d2))]
            if "campaign_id" in _g.columns:
                # L'identifiant prime sur le nom : c'est lui que porte
                # `google_campaign_config`, et deux campagnes Google peuvent
                # partager un nom (même raison que dans `_pub_fenetre`).
                _g = _g[_g["campaign_id"].astype(str).map(
                    lambda c: (goog_cfg.get(c, {}) or {}).get("label") == lbl)]
            else:
                _g = _g.iloc[0:0]
            # Une colonne `conversions` ABSENTE n'est pas une colonne à zéro :
            # sans elle on ne MESURE pas, et `annonce_sans_conversion` doit
            # écarter ces lignes au lieu de conclure qu'aucune ne vend
            # (`CLAUDE.md` §7). Elle est au schéma, mais une base plus ancienne
            # ne la porterait pas.
            _conv_mesuree = "conversions" in _g.columns
            for _r in _g.itertuples():
                _aid = str(getattr(_r, "ad_id", "") or "")
                if not _aid:
                    continue
                _pose(f"google:{_aid}", "google",
                      getattr(_r, "ad_name", None), getattr(_r, "ad_group_name", None),
                      getattr(_r, "campaign_name", None),
                      getattr(_r, "impressions", 0), getattr(_r, "clicks", 0),
                      float(getattr(_r, "cost_micros", 0) or 0) / 1e6,
                      getattr(_r, "conversions", 0) if _conv_mesuree else None)

        # Une annonce sans nom lisible ne peut être ni nommée dans un conseil,
        # ni retrouvée par le client dans son gestionnaire : elle ne sert qu'à
        # fausser une médiane.
        return [a for a in out.values() if str(a.get("nom") or "").strip()]

    # LES BUDGETS POSÉS — une photo hebdomadaire, jamais un historique.
    # Lus une seule fois pour tout le rapport. `[]` quand la table n'existe pas
    # ou qu'aucun relevé n'a encore été pris : `theme_hors_budget` se tait
    # alors, elle n'invente pas un budget de zéro.
    try:
        _budgets_poses = lecteur.budgets_poses() or []
    except Exception:
        _budgets_poses = []

    # Une campagne SUPPRIMÉE reste dans la réponse de Google et garde son budget
    # d'origine. La compter serait promettre de l'argent sur une campagne qui
    # n'existe plus. Même liste que `saas/web/lib/budgets.ts`.
    _BUDGET_MORTES = {"REMOVED", "DELETED", "ARCHIVED"}

    def _montant_sur_fenetre(ligne, d1, d2):
        """Ce qu'une ligne de budget posé pèse sur [d1, d2], en CHF.

        Portage exact de `montantSurFenetre` (`saas/web/lib/budgets.ts`) : la
        page Coûts et le conseil hebdo doivent dire le même nombre, sinon le
        client lit deux budgets prévus différents sur le même thème.
        """
        def _d(v):
            try:
                return date.fromisoformat(str(v)[:10]) if v else None
            except ValueError:
                return None

        deb_dec, fin_dec = _d(ligne.get("start_date")), _d(ligne.get("end_date"))
        # Sans date de début, la campagne est réputée courir depuis le début de
        # la fenêtre ; sans date de fin, jusqu'à sa borne droite — « sans fin
        # déclarée » ne veut pas dire « jamais diffusée ».
        deb, fin = (deb_dec or d1), (fin_dec or d2)
        if fin < d1 or deb > d2:
            return 0.0
        jours = (min(fin, d2) - max(deb, d1)).days + 1
        if jours <= 0:
            return 0.0

        _t = ligne.get("total_budget")
        total = float(_t) if _t is not None else None
        if total and total > 0:
            # UN BUDGET TOTAL SANS SES DEUX DATES N'EST PAS PRORATISABLE : les
            # bornes par défaut ci-dessus sont celles de la FENÊTRE, les
            # appliquer ici rendrait l'enveloppe entière. On préfère ne rien
            # compter plutôt qu'inventer une durée.
            if not (deb_dec and fin_dec):
                return 0.0
            duree = max(1, (fin_dec - deb_dec).days + 1)
            return total * jours / duree
        _j = ligne.get("daily_budget")
        jour = float(_j) if _j is not None else None
        return jour * jours if jour and jour > 0 else 0.0

    def _budget_theme(lbl, sem_theme):
        """Ce que les campagnes du thème ont POSÉ ce mois, et où va leur dépense.

        Le passé est MESURÉ (`depense_mois`), seul l'avenir est projeté, et au
        rythme que le rapport mesure déjà — sa fenêtre de sept jours pleins.
        C'est `regle_theme_hors_budget` qui fait la projection ; ici on ne rend
        que des faits datés.
        """
        _1er = last_full_day.replace(day=1)
        _mois_suivant = (_1er + timedelta(days=32)).replace(day=1)
        _fin_mois = _mois_suivant - timedelta(days=1)

        prevu, releve = 0.0, None
        for _l in _budgets_poses:
            if str(_l.get("status") or "").upper() in _BUDGET_MORTES:
                continue
            _canal = _l.get("channel")
            if _canal == "meta":
                _lb = name2label.get(_nrm(_l.get("campaign_name")))
            elif _canal == "google":
                _lb = (goog_cfg.get(str(_l.get("campaign_id")), {}) or {}).get("label")
            else:
                continue
            if _lb != lbl:
                continue
            _chf = _montant_sur_fenetre(_l, _1er, _fin_mois)
            if _chf <= 0:
                continue
            prevu += _chf
            _r = str(_l.get("captured_on") or "")[:10]
            if _r and (releve is None or _r < releve):
                # La date annoncée est la PLUS ANCIENNE des relevés retenus :
                # c'est à partir d'elle que l'ensemble du chiffre est vrai.
                releve = _r

        return {
            "prevu_mois": prevu,
            "depense_mois": _pub_fenetre(lbl, _1er, last_full_day)["spend"],
            "depense_semaine": float((sem_theme or {}).get("spend") or 0),
            "jours_restants": (_fin_mois - last_full_day).days,
            "jours_fenetre": (last_full_day - cur_since).days + 1,
            "releve_le": releve,
        }

    # ── CE QUE LES SIX RÈGLES PAYANTES RESTANTES ONT DEMANDÉ EN PLUS ─────────
    #
    # Ticket `.scratch/construction/issues/10-six-regles-payantes-restantes.md`.
    # Comme les deux lecteurs au-dessus : AUCUNE RÉCOLTE NOUVELLE, aucune
    # migration. Tout est déjà en base — la portée par annonce et par jour est
    # dans `meta_ads_insights` depuis toujours, le budget posé par campagne dans
    # `platform_budgets`, les sessions par campagne dans `ga4_insights`.

    # CINQ SEMAINES POUR EN EXIGER QUATRE. `creneau_pub` demande quatre lundis
    # avant de parler d'un lundi (`SEUILS["creneau_jours_min"]`), et
    # `_creneaux_theme` ne compte que les jours qui ont vraiment une ligne. Sur
    # 28 jours il y a EXACTEMENT quatre lundis : une campagne en pause un jour,
    # une journée sans diffusion ou un trou de récolte ferait tomber ce jour à
    # trois et la règle se tairait pour une raison qui n'a rien à voir avec son
    # prix. Trente-cinq jours en donnent cinq — de quoi en perdre un.
    _CRENEAU_JOURS = 35

    # Une campagne VIVANTE au dernier relevé. `_BUDGET_MORTES` (juste au-dessus)
    # retire ce qui n'existe plus ; ici on veut en plus écarter ce qui est
    # simplement EN PAUSE : une campagne en pause ne dépense pas son budget, et
    # c'est normal — `budget_non_depense` la dénoncerait toutes les semaines.
    _BUDGET_VIVES = {"ACTIVE", "ENABLED"}

    def _canal_de_campagne(nom_ou_id, canal):
        """Le thème d'une ligne de budget, par la clé propre à son canal."""
        if canal == "meta":
            return name2label.get(_nrm(nom_ou_id))
        return (goog_cfg.get(str(nom_ou_id), {}) or {}).get("label")

    def _depense_par_campagne(d1, d2):
        """{(canal, clé de campagne): dépense} sur [d1, d2], les deux régies.

        CALCULÉ UNE FOIS POUR TOUTES LES CAMPAGNES, pas une fois par campagne :
        `_budget_campagnes_theme` tourne pour chaque thème conseillé, et un
        compte à cinquante campagnes aurait relu tout l'historique cent
        cinquante fois. Même raison que la conversion de `df_gads` faite une
        seule fois au chargement.

        La clé est le NOM côté Meta (c'est celle de `meta_campaign_config`) et
        l'IDENTIFIANT côté Google — deux campagnes Google peuvent partager un
        nom, et c'est l'identifiant que porte `google_campaign_config`.
        """
        par_campagne = {}
        if df_meta_raw is not None and not df_meta_raw.empty:
            _m = df_meta_raw[(df_meta_raw["date_start"] >= pd.Timestamp(d1))
                             & (df_meta_raw["date_start"] <= pd.Timestamp(d2))]
            for _r in _m.itertuples():
                _k = ("meta", _nrm(getattr(_r, "campaign_name", "")))
                par_campagne[_k] = (par_campagne.get(_k, 0.0)
                                    + float(getattr(_r, "spend", 0) or 0))
        if (df_google is not None and not df_google.empty
                and "campaign_id" in df_google.columns):
            _g = df_google[(df_google["date_start"] >= pd.Timestamp(d1))
                           & (df_google["date_start"] <= pd.Timestamp(d2))]
            for _r in _g.itertuples():
                _k = ("google", str(getattr(_r, "campaign_id", "") or ""))
                par_campagne[_k] = (par_campagne.get(_k, 0.0)
                                    + float(getattr(_r, "cost_micros", 0) or 0) / 1e6)
        return par_campagne

    _depenses_fenetre = _depense_par_campagne(cur_since, last_full_day)

    def _jour_iso(v):
        """La date d'une colonne `date` de PostgREST, ou `None`."""
        try:
            return date.fromisoformat(str(v)[:10]) if v else None
        except ValueError:
            return None

    def _budget_campagnes_theme(lbl):
        """Le budget POSÉ par jour contre la dépense RÉELLE par jour, campagne
        par campagne — ce que lit `budget_non_depense`.

        SUR LA FENÊTRE DU RAPPORT, et elle n'est pas un paramètre : la dépense
        vient de `_depenses_fenetre`, calculée une seule fois pour toutes les
        campagnes. Une signature qui accepterait d'autres bornes promettrait de
        les respecter, et elle ne le ferait pas.

        `_budget_theme` juste au-dessus répond à une autre question : ce que le
        THÈME ENTIER va dépenser sur le MOIS. Celle-ci descend à la campagne, sur
        la fenêtre du rapport, parce que c'est une campagne qu'on ouvre pour
        corriger un budget — pas un thème.

        Les jours comptés sont ceux où la campagne AVAIT LE DROIT de dépenser :
        une campagne déclarée du 20 au 30 ne se juge pas sur les sept jours de la
        fenêtre, mais sur ceux qu'elle en couvre. Sans ça, une campagne qui
        démarre en milieu de semaine se ferait dénoncer pour n'avoir pas dépensé
        les jours d'avant sa naissance.
        """
        d1, d2 = cur_since, last_full_day
        out = []
        for _l in _budgets_poses:
            _st = str(_l.get("status") or "").upper()
            if _st and _st not in _BUDGET_VIVES:
                continue
            _canal = _l.get("channel")
            if _canal == "meta":
                _cle, _nom = _l.get("campaign_name"), _l.get("campaign_name")
            elif _canal == "google":
                _cle, _nom = _l.get("campaign_id"), _l.get("campaign_name")
            else:
                continue
            if _canal_de_campagne(_cle, _canal) != lbl:
                continue
            if (_canal, str(_nom or "")[:60]) in _camp_jeunes:
                continue   # une campagne en rodage consomme mal, et c'est normal
            _pose_fenetre = _montant_sur_fenetre(_l, d1, d2)
            if _pose_fenetre <= 0:
                continue
            # Les jours que la campagne couvre DANS la fenêtre — les mêmes
            # bornes que `_montant_sur_fenetre`, qui vient de les appliquer.
            _deb = _jour_iso(_l.get("start_date")) or d1
            _fin = _jour_iso(_l.get("end_date")) or d2
            _jours = (min(_fin, d2) - max(_deb, d1)).days + 1
            if _jours <= 0:
                continue
            out.append({
                "canal": _canal,
                "nom": _nom,
                "pose_jour": _pose_fenetre / _jours,
                "depense_jour": _depenses_fenetre.get(
                    (_canal, _nrm(_cle) if _canal == "meta" else str(_cle)),
                    0.0) / _jours,
                "jours": _jours,
                "releve_le": str(_l.get("captured_on") or "")[:10] or None,
            })
        return out

    def _usure_theme(lbl, d1, d2):
        """Une ligne par Annonce META du thème : impressions, SOMME des portées
        quotidiennes, clics, dépense, et le prix du clic de la semaine d'avant.

        MÉTA SEULEMENT, et ce n'est pas un choix : `google_ads_ad_insights` ne
        porte pas de portée. Sans portée, pas de fréquence — et une fréquence
        supposée serait un chiffre fabriqué (`CLAUDE.md` §7).

        LA SOMME DES PORTÉES N'EST PAS LA PORTÉE DE LA SEMAINE, et c'est écrit
        ici autant que dans la règle : `reach` compte des personnes
        dédoublonnées, quelqu'un touché lundi et mardi apparaît dans les deux
        lignes. La somme est donc toujours PLUS GRANDE que la portée unique, et
        le rapport impressions/somme toujours PLUS PETIT que la vraie fréquence.
        C'est exactement ce que `regle_annonce_usee` en fait : un PLANCHER.

        Même garde qu'`_annonces_theme` : sans `ad_id` en base, Meta sort
        entièrement — regrouper par nom rejouerait le bug des homonymes.
        """
        if (df_meta_raw is None or df_meta_raw.empty
                or "ad_id" not in df_meta_raw.columns
                or "reach" not in df_meta_raw.columns):
            return []

        def _cumul(a, b):
            _m = df_meta_raw[(df_meta_raw["date_start"] >= pd.Timestamp(a))
                             & (df_meta_raw["date_start"] <= pd.Timestamp(b))]
            _m = _m[_m["campaign_name"].map(lambda x: name2label.get(_nrm(x)) == lbl)]
            agg = {}
            for _r in _m.itertuples():
                _aid = str(getattr(_r, "ad_id", "") or "")
                if not _aid:
                    continue
                _a = agg.setdefault(_aid, {
                    "cle": f"meta:{_aid}", "canal": "meta",
                    "nom": getattr(_r, "ad_name", None),
                    "groupe": getattr(_r, "adset_name", None),
                    "campagne": getattr(_r, "campaign_name", None),
                    "impressions": 0, "portee_cumul": 0.0, "clics": 0,
                    "depense": 0.0, "portee_complete": True,
                    "jeune": ("meta", str(getattr(_r, "campaign_name", "") or "")[:60])
                             in _camp_jeunes,
                })
                _a["impressions"] += int(getattr(_r, "impressions", 0) or 0)
                _a["clics"] += int(getattr(_r, "clicks", 0) or 0)
                _a["depense"] += float(getattr(_r, "spend", 0) or 0)
                # UNE SEULE JOURNÉE SANS PORTÉE ET L'ANNONCE SORT. On serait
                # tenté de simplement ne pas ajouter cette portée-là ; ce serait
                # casser l'invariant qui fait toute l'honnêteté de la règle.
                # `plancher = impressions ÷ somme des portées` n'est un PLANCHER
                # de la fréquence que si les deux termes couvrent LES MÊMES
                # JOURS : une annonce diffusée sept jours dont deux seulement ont
                # une portée enregistrée verrait sept jours d'impressions
                # divisés par deux jours de portée — un nombre trois fois trop
                # GRAND, affiché sous la mention « au moins ». `regle_annonce_usee`
                # promet de se taire plus souvent qu'elle ne le devrait, jamais
                # l'inverse (`CLAUDE.md` §7) : on préfère donc perdre l'annonce.
                _reach = getattr(_r, "reach", None)
                if _reach is None or pd.isna(_reach):
                    _a["portee_complete"] = False
                else:
                    try:
                        _a["portee_cumul"] += float(_reach)
                    except (TypeError, ValueError):
                        _a["portee_complete"] = False
            return agg

        avant = _cumul(prev_since, prev_until)
        out = []
        for _cle, _a in _cumul(d1, d2).items():
            if not _a.pop("portee_complete", False):
                # Une portée trouée ne rend pas un plancher, elle rend un nombre
                # trop grand — voir la note dans `_cumul`.
                continue
            _av = avant.get(_cle)
            _clics_av = int((_av or {}).get("clics") or 0)
            _a["cpc_avant"] = (float(_av["depense"]) / _clics_av
                               if _av and _clics_av > 0 else None)
            if str(_a.get("nom") or "").strip():
                out.append(_a)
        return out

    def _creneaux_theme(lbl, d1, d2):
        """La dépense et les clics META du thème, rangés par JOUR DE LA SEMAINE.

        Meta seulement — condition posée par
        `.scratch/refonte/issues/24-conseils-payants-manquants.md` : on ne
        récolte pas la stratégie d'enchère d'une campagne Google, et brider les
        horaires d'une enchère automatique la dégrade au lieu de l'aider.

        La fenêtre est celle de `_CALME_REF` (28 jours), pas les sept du
        rapport : sept jours ne contiennent qu'UN lundi, et un lundi ne se juge
        pas contre lui-même. `occurrences` compte les jours réellement présents
        dans les données — c'est lui que la règle exige à quatre.
        """
        if df_meta_raw is None or df_meta_raw.empty:
            return []
        _m = df_meta_raw[(df_meta_raw["date_start"] >= pd.Timestamp(d1))
                         & (df_meta_raw["date_start"] <= pd.Timestamp(d2))]
        _m = _m[_m["campaign_name"].map(lambda x: name2label.get(_nrm(x)) == lbl)]
        if _m.empty:
            return []
        par_jour = {}
        for _r in _m.itertuples():
            _d = getattr(_r, "date_start", None)
            if _d is None or pd.isna(_d):
                continue
            _d = pd.Timestamp(_d).date()
            _c = par_jour.setdefault(_d.weekday(), {
                "jour": _d.weekday(), "dates": set(), "depense": 0.0, "clics": 0})
            _c["dates"].add(_d)
            _c["depense"] += float(getattr(_r, "spend", 0) or 0)
            _c["clics"] += int(getattr(_r, "clicks", 0) or 0)
        return [{"jour": _c["jour"], "occurrences": len(_c["dates"]),
                 "depense": _c["depense"], "clics": _c["clics"]}
                for _c in par_jour.values()]

    def _campagnes_ga4_theme(lbl):
        """{nom de campagne normalisé: {sessions, revenue}} pour les campagnes de
        ce thème que GA4 a su rattacher. `{}` quand GA4 n'est pas connecté.

        CE QUI N'Y EST PAS EST AUSSI IMPORTANT QUE CE QUI Y EST. `by_campaign`
        n'est rempli que pour les lignes dont le `medium` contient cpc/ppc/paid
        ET qui portent un `utm_campaign` non vide qu'on retrouve dans
        `name2label` (`saas/collecte/ga4/ga4.py`). Une campagne dont les liens
        n'ont pas de paramètres de campagne — Meta n'en pose aucun tout seul —
        n'y apparaît jamais. Ses visites ont bien eu lieu ; elles ne sont
        attribuables à personne.
        """
        by = (ga4_ctx or {}).get("by_campaign") or {}
        return {_nrm(_n): _d for _n, _d in by.items()
                if name2label.get(_nrm(_n)) == lbl}

    def _pub_par_campagne_theme(lbl, d1, d2):
        """{(canal, nom normalisé): {spend, clics}} pour les campagnes du thème.

        LA CLÉ PORTE LE NOM parce que c'est la SEULE que GA4 partage : il indexe
        par `utm_campaign`. Côté Google on passe par l'identifiant pour
        retrouver la campagne — c'est lui que porte `google_campaign_config` —
        puis on prend son nom stocké. Une campagne dont ce nom est vide ne sera
        jamais retrouvée côté GA4, et c'est exactement ce que les deux lecteurs
        en dessous doivent savoir.
        """
        out = {}
        if df_meta_raw is not None and not df_meta_raw.empty:
            _m = df_meta_raw[(df_meta_raw["date_start"] >= pd.Timestamp(d1))
                             & (df_meta_raw["date_start"] <= pd.Timestamp(d2))]
            _m = _m[_m["campaign_name"].map(lambda x: name2label.get(_nrm(x)) == lbl)]
            for _r in _m.itertuples():
                _k = ("meta", _nrm(getattr(_r, "campaign_name", "")))
                _c = out.setdefault(_k, {"spend": 0.0, "clics": 0})
                _c["spend"] += float(getattr(_r, "spend", 0) or 0)
                _c["clics"] += int(getattr(_r, "clicks", 0) or 0)
        if (df_google is not None and not df_google.empty
                and "campaign_id" in df_google.columns):
            _g = df_google[(df_google["date_start"] >= pd.Timestamp(d1))
                           & (df_google["date_start"] <= pd.Timestamp(d2))]
            _g = _g[_g["campaign_id"].astype(str).map(
                lambda c: (goog_cfg.get(c, {}) or {}).get("label") == lbl)]
            for _r in _g.itertuples():
                _cid = str(getattr(_r, "campaign_id", "") or "")
                _k = ("google", _nrm((goog_cfg.get(_cid, {}) or {}).get("campaign_name")))
                _c = out.setdefault(_k, {"spend": 0.0, "clics": 0})
                _c["spend"] += float(getattr(_r, "cost_micros", 0) or 0) / 1e6
                _c["clics"] += int(getattr(_r, "clicks", 0) or 0)
        return {_k: _v for _k, _v in out.items() if _v["spend"] > 0 or _v["clics"] > 0}

    def _arrivee_theme(lbl, d1, d2):
        """Les clics que les régies facturent contre les visites que GA4 compte —
        ce que lit `page_arrivee_muette`.

        LES DEUX CÔTÉS COMPTENT LES MÊMES CAMPAGNES, et c'est tout l'enjeu de ce
        lecteur. La version naïve comparait TOUS les clics du thème aux sessions
        que GA4 sait rattacher : une campagne Meta sans paramètres de campagne
        dans ses liens (Meta n'en pose aucun tout seul) n'apparaît jamais dans
        `by_campaign`, donc ses visites valaient zéro pendant que ses clics
        comptaient — et la règle publiait « 2 000 clics n'arrivent nulle part »
        en accusant la balise d'une page qui marche très bien. C'était un chiffre
        fabriqué (`CLAUDE.md` §7).

        On ne compare donc QUE les campagnes que GA4 rattache déjà. Ce que ça
        laisse dehors — une campagne dont les liens ne portent aucun paramètre —
        est un vrai problème, mais ce n'est pas celui de cette règle, et il
        demande une mesure qu'on n'a pas (distinguer « pas de tag » de « pas de
        trafic »).

        `sessions=None` veut dire « on n'a rien à comparer » : la règle se tait
        plutôt que d'accuser un tracking qu'elle n'a pas pu interroger.
        """
        if not ga4_ctx:
            return {"clics": 0, "depense": 0.0, "sessions": None}
        _ga4 = _campagnes_ga4_theme(lbl)
        _pub = _pub_par_campagne_theme(lbl, d1, d2)
        _communes = [(_k, _v) for _k, _v in _pub.items() if _k[1] in _ga4]
        if not _communes:
            return {"clics": 0, "depense": 0.0, "sessions": None}
        # Un nom vu des deux côtés (même campagne sur les deux régies) ne compte
        # ses sessions qu'UNE fois : elles sont indexées par le nom, pas par la
        # régie, et les additionner doublerait le dénominateur.
        _noms = {_k[1] for _k, _ in _communes}
        return {
            "clics": sum(int(_v["clics"]) for _, _v in _communes),
            "depense": sum(float(_v["spend"]) for _, _v in _communes),
            "sessions": sum(int((_ga4.get(_n) or {}).get("sessions") or 0)
                            for _n in _noms),
        }

    def _regies_theme(lbl, d1, d2):
        """Ce que le thème a coûté et rapporté, RÉGIE PAR RÉGIE — ce que lit
        `theme_deux_regies`.

        `complet` EST LE CŒUR DE CE LECTEUR, pas un détail. Le revenu d'une
        campagne n'entre que si GA4 la retrouve par son nom ; une campagne
        étiquetée dont l'`utm_campaign` ne correspond plus verse sa dépense sans
        jamais verser son revenu
        (`.scratch/construction/issues/18-revenu-google-non-rattachable.md`).
        Une règle qui compare deux régies là-dessus dirait « l'autre rend quatre
        fois mieux » alors qu'on a simplement perdu le revenu d'une campagne.
        `complet` vaut donc `True` seulement quand TOUTE campagne de ce thème
        qui a dépensé sur ce canal a été retrouvée côté GA4.

        CE LECTEUR NE TRANCHE PAS LA QUESTION DU TICKET 18 et ne la contourne
        pas : il ne change rien à la façon dont la dépense est comptée ailleurs,
        il refuse seulement de faire parler UNE règle sur une attribution dont
        il sait qu'elle est trouée.
        """
        if not ga4_ctx:
            return {}
        _ga4 = _campagnes_ga4_theme(lbl)
        depenses = {}
        for (_canal, _nom), _v in _pub_par_campagne_theme(lbl, d1, d2).items():
            if _v["spend"] > 0:
                depenses.setdefault(_canal, {})[_nom] = _v["spend"]

        # UN NOM PORTÉ PAR LES DEUX RÉGIES LES REND TOUTES DEUX INCOMPLÈTES. GA4
        # indexe par `utm_campaign`, c'est-à-dire par un NOM : si la même chaîne
        # existe des deux côtés, le même revenu serait versé aux deux
        # numérateurs et la comparaison compterait deux fois ce qui n'est arrivé
        # qu'une. On ne sait pas départager, donc on ne parle pas.
        ambigu = (len(depenses) == 2
                  and bool(set(depenses["meta"]) & set(depenses["google"])))

        return {
            _canal: {
                "spend": sum(_par_nom.values()),
                "revenue": sum(float((_ga4.get(_n) or {}).get("revenue") or 0)
                               for _n in _par_nom),
                # Une campagne sans nom stocké ne peut PAS être retrouvée côté
                # GA4 : elle rend l'attribution de ce canal incomplète, par
                # construction.
                "complet": (not ambigu) and all(_n and _n in _ga4 for _n in _par_nom),
            }
            for _canal, _par_nom in depenses.items()
        }

    def _faits_payants(lbl):
        """Les cinq lectures neuves du ticket 10, assemblées pour un thème.

        Chaque lecture est protégée séparément : une table absente ou une
        colonne qui manque fait taire SA règle, pas les cinq autres.
        """
        # UNE SEMAINE TROUÉE NE NOURRIT AUCUNE RÈGLE PAYANTE (ticket 20).
        # Les cinq lectures ci-dessous portent TOUTES sur `cur_since →
        # last_full_day`, et chacune divise, compare ou seuille une dépense
        # mesurée sur cette fenêtre. Un canal muet ne les rend pas imprécises,
        # il les retourne :
        #   · `regies` est la plus dangereuse — sa garde est la complétude de
        #     l'attribution des deux régies et un écart de 4× ; un canal à zéro
        #     la franchit MÉCANIQUEMENT et fait conseiller un transfert de
        #     budget vers un fantôme ;
        #   · `campagnes` (`budget_non_depense`) lit un budget non consommé là
        #     où la dépense n'a simplement pas été récoltée ;
        #   · `arrivee` compare des clics payés amputés à des visites GA4
        #     entières, et accuse la page d'arrivée d'un trou de récolte.
        # Le contrat du module est déjà « clé absente = on n'a pas lu ça, la
        # règle se tait » : on s'en sert tel quel plutôt que d'apprendre le trou
        # à dix règles.
        #
        # ON NE TRIE PAS PAR CANAL, et ce n'est pas de la paresse : distinguer
        # « ce thème ne dépense pas sur Google » de « Google n'a rien écrit »
        # demanderait justement le chiffre qui manque. Le silence large est la
        # seule réponse qu'on puisse défendre.
        if _aveugle_semaine:
            return {}
        faits = {}
        for _nom, _lire in (
            ("campagnes", lambda: _budget_campagnes_theme(lbl)),
            ("usure", lambda: _usure_theme(lbl, cur_since, last_full_day)),
            ("creneaux", lambda: _creneaux_theme(
                lbl, last_full_day - timedelta(days=_CRENEAU_JOURS - 1),
                last_full_day)),
            ("arrivee", lambda: _arrivee_theme(lbl, cur_since, last_full_day)),
            ("regies", lambda: _regies_theme(lbl, cur_since, last_full_day)),
        ):
            try:
                faits[_nom] = _lire()
            except Exception:
                pass   # clé absente = « on n'a pas lu ça », la règle se tait
        return faits

    # JUSQU'OÙ CHAQUE RÉGIE EST À JOUR. Une récolte en retard et une campagne
    # coupée produisent le même zéro ; sans cette borne, « ce thème s'est
    # arrêté » se déclencherait sur un fetch en panne. Même raisonnement que
    # `_couverture` dans la frise, calculé plus tôt parce qu'un conseil en
    # dépend.
    def _derniere_donnee(df, col):
        try:
            if df is None or df.empty or col not in df.columns:
                return None
            _d = pd.to_datetime(df[col], errors="coerce").max()
            return _d.date() if pd.notna(_d) else None
        except Exception:
            return None

    _couv_regie = {"meta": _derniere_donnee(df_meta_raw, "date_start"),
                   "google": _derniere_donnee(df_google, "date_start")}

    def _semaines_sans_conseil(nlbl):
        """Depuis combien de rapports d'affilée ce thème n'a-t-il rien à dire ?

        On remonte du plus récent au plus ancien et on s'arrête au premier
        rapport où ce thème portait un VRAI conseil — une veille ne compte pas,
        c'est justement ce qu'on est en train de compter. Un rapport où le thème
        n'avait pas de carte arrête aussi la série : on ne sait pas ce qu'il
        aurait dit.
        """
        n = 0
        for _pl in _rapports_publies:
            _tf = next((t for t in (_pl.get("themes_focus") or [])
                        if _nrm(t.get("label")) == nlbl), None)
            if _tf is None:
                break
            if any(not str(r.get("key") or "").startswith("veille_")
                   for r in (_tf.get("recos") or [])):
                break
            n += 1
        return n

    # LES THÈMES QUI REÇOIVENT DES CONSEILS — le filtre dur, en une ligne.
    #
    # `theme_list` peut porter quinze thèmes ; ce jeu-ci en porte trois au
    # maximum, et ce sont les trois premières ÉTOILES du client. Les douze
    # autres traversent le même code et ressortent avec leur carte, leurs
    # chiffres et leur courbe — sans un seul conseil.
    #
    # IL SE LIT SUR `priority_labels`, PAS SUR `theme_list` : les deux sont la
    # même liste quand le client a étoilé quelque chose, mais `theme_list`
    # retombe sur les trois plus gros thèmes quand il n'a rien étoilé (voir son
    # calcul plus haut). Ce repli donne des CARTES par défaut, jamais des
    # priorités — un compte qui ne classe rien ne reçoit aucun conseil, et c'est
    # exactement ce qu'on veut qu'il constate.
    _themes_conseilles = {_nrm(_l) for _l in priority_labels[:_THEMES_CONSEILLES]}

    # Les empreintes (clé + cible) qu'on s'autorise à répéter : les Marches
    # d'une Stratégie en cours, réaffichées exprès tant que leur Verdict n'est
    # pas tombé. Remplie dans la boucle ci-dessous, lue par le plafond de cinq.
    _epingles: set = set()

    # LES THÈMES DONT LA STRATÉGIE TOURNE ENCORE, décidés UNE FOIS (ticket 27).
    #
    # « Cette Stratégie tourne-t-elle encore ? » se posait à deux endroits et se
    # répondait deux fois, avec deux conditions différentes : l'épinglage plus
    # bas (qui regarde le verdict, la carte mémorisée et la coupe des pistes
    # `ai_`) et la garde d'écriture tout en bas (qui ne comparait que des CLÉS).
    # Quand elles n'étaient pas d'accord — une ligne sans `snapshot`, un verdict
    # tombé — la carte servait la règle la mieux classée de la semaine pendant
    # que la garde cherchait l'ancienne clé, ne la trouvait pas, et laissait
    # `theme_plan` repartir sur un `decided_at` neuf. Mesuré dans
    # `.scratch/construction/harnais/27-une-theorie-par-theme/mesure2.py`.
    #
    # La réponse est donc produite là où l'épinglage la calcule, et la boucle
    # d'écriture la LIT au lieu de la refaire. Elle porte sur le THÈME et plus
    # sur la clé, ce qui est le bon grain : `theme_plan` est unique par thème,
    # et « une théorie par thème à la fois » est ce que la fenêtre d'attente
    # (`ATTENTE_MIN_NOUVELLE_HYPOTHESE`) existe pour tenir.
    #
    # CE QUE ÇA NE CHANGE PAS — et c'est la raison pour laquelle ce que mesure
    # un Verdict reste intact : un thème n'entre ici que quand sa carte REJOUE
    # la Marche du plan, même `reco_key`, même baseline. Quand la Stratégie est
    # finie (Verdict rendu, ou fenêtre écoulée), le thème n'y est pas, la
    # nouvelle Hypothèse s'écrit avec sa propre date, et le Verdict suivant
    # mesure bien ce cycle-là.
    _plans_en_cours: set = set()

    # ── CE QUI A DÉJÀ ÉTÉ DEMANDÉ, CLÉ ET CIBLE ──────────────────────────────
    #
    # « On ne fait pas revenir la même reco qui change exactement la même chose »
    # (David, `.scratch/refonte/issues/14-le-conseil-facile-et-la-degradation.md`,
    # décision 10). La même clé sur une AUTRE cible repasse : c'est une nouvelle
    # Marche, le chiffre n'est pas le même.
    #
    # LU AVANT LA BOUCLE, ET PAS SEULEMENT AU PLAFOND. Filtrer seulement à la
    # fin laisserait la coupe à trois d'un thème se remplir de conseils déjà
    # servis, qui seraient écartés juste après : le thème sortirait muet alors
    # qu'un quatrième conseil, frais, attendait derrière.
    #
    # HORIZON : les huit derniers rapports publiés, ceux que `_rapports_publies`
    # relit déjà (la semaine en cours est exclue, sinon un « ↻ Recharger mes
    # conseils » se muselerait lui-même). Au-delà de huit semaines, une
    # instruction identique peut donc revenir — c'est une borne, elle est
    # assumée et elle se dit.
    _deja_servies: set = set()
    for _pl in _rapports_publies:
        for _tf0 in (_pl.get("themes_focus") or []):
            for _r0 in (_tf0.get("recos") or []):
                _deja_servies.add(empreinte_conseil(_r0))

    # LES CONSEILS « SOCLE » NÉS D'UN THÈME. `reglages` (plus bas) ne se
    # nourrissait que de `rule_recos`, qui sont des conseils de COMPTE. Le
    # ticket 10 en apporte un qui naît dans la boucle des thèmes
    # (`page_arrivee_muette`) et qui a la même nature : un prérequis de mesure,
    # pas du pilotage hebdomadaire. Il se récolte ici et rejoint le bloc
    # « réglages » — même patron que `_constat_cout`, qui sort de cette boucle
    # pour rejoindre les constats.
    _socle_themes: list[dict] = []

    themes_focus = []
    for lbl in theme_list:
        nlbl = _nrm(lbl)
        t_camps = [c for c in matrix_campaigns if _nrm(c.get("label")) == nlbl]
        # L'objectif EFFECTIF de ce thème (le sien, sinon celui du compte) —
        # il pilote les règles (`build_recos`, plus bas) et l'indicateur de sa
        # courbe.
        _obj_lbl = _obj_theme(lbl)
        # Écrit dans le payload (voir `themes_focus.append` plus bas) pour que
        # le module du rapport (`objectif-theme.tsx`) puisse dire la vérité :
        # « propre à ce thème » seulement quand c'est vraiment le cas — jamais
        # quand le thème a perdu son étoile (`_obj_theme` l'ignore alors).
        _obj_propre = lbl in priority_labels and lbl in theme_objectifs

        # Sous-ensembles de la semaine pour faire tourner les règles sur ce thème
        tc = None
        if df_camp is not None and not df_camp.empty:
            _mask = df_camp["campaign_name"].map(lambda n: name2label.get(_nrm(n)) == lbl)
            tc = df_camp[_mask]
            tc = tc if not tc.empty else None

        def _has(labels, _l=lbl):
            return isinstance(labels, (list, tuple)) and _l in labels
        ti = pd.DataFrame()
        tw = pd.DataFrame()
        if df_insta is not None and not df_insta.empty and "labels" in df_insta.columns:
            ti = df_insta[df_insta["labels"].map(_has)]
        if df_week_posts is not None and not df_week_posts.empty and "labels" in df_week_posts.columns:
            tw = df_week_posts[df_week_posts["labels"].map(_has)]

        # LE FILTRE DUR, POSÉ DÈS ICI. Hors des trois premières étoiles, aucune
        # règle ne tourne sur ce thème : « les labels sont les recos pour les
        # labels prio, fin » (David, `.scratch/refonte/issues/21`).
        _conseille = nlbl in _themes_conseilles

        # LE THÈME CONTRE LUI-MÊME. Quatre fenêtres, calculées une fois : elles
        # servent la règle de l'arrêt ci-dessous et le filet tout en bas.
        _sem_theme = _semaine_theme(lbl, cur_since, last_full_day)
        _hebdo_theme = [
            _semaine_theme(lbl, last_full_day - timedelta(days=7 * _k + 6),
                           last_full_day - timedelta(days=7 * _k))
            for _k in range(1, 9)
        ]

        # Les conversions GA4 désignées sur ce thème : `_reco_evenements` en
        # fait des conseils, `build_recos` s'en sert pour mesurer.
        _g4t_lbl = None
        try:
            _g4t_lbl = _theme_ga4(lbl)
        except Exception:
            pass

        # LA VEILLE DU THÈME (campagnes trop jeunes, thème qui s'arrête net) —
        # calculée pour les deux chemins, mais rangée différemment selon eux
        # (voir plus bas pourquoi). Une veille n'est PAS un conseil : elle ne
        # porte pas de bouton « Je le teste » et n'a aucun verdict à mériter
        # (voir `_est_veille` plus haut dans ce fichier).
        t_veille: list[dict] = []
        try:
            for _c in _camp_recentes:
                if _nrm(_c.get("theme")) != nlbl:
                    continue
                _v = _reco_veille(_c, last_full_day)
                if _v:
                    t_veille.append(_v)
        except Exception:
            pass
        try:
            _prec = _hebdo_theme[0]
            _ref = _pub_fenetre(lbl, cur_since - timedelta(days=_CALME_REF),
                                cur_since - timedelta(days=1))
            _frais = all((_couv_regie.get(_c) or date.min) >= last_full_day
                         for _c in (_ref["canaux"] or ()))
            _a = _reco_theme_arret(lbl, _sem_theme, _prec, _ref,
                                   _sem_theme["posts"], _frais)
            if _a:
                t_veille.append(_a)
        except Exception:
            pass

        # ── UN SEUL CHEMIN, ET IL COMMENCE PAR LE FILTRE DUR ─────────────
        #
        # Il y en avait deux — un thème « rédigé par Gemini » recevait trois
        # pistes et AUCUN conseil-règle, les autres recevaient les règles. Les
        # pistes sont coupées (voir la note à la place de `_theme_ai_recos`),
        # donc il ne reste qu'un chemin : les règles, pour tout le monde.
        #
        # ET SEULEMENT POUR LES THÈMES QUE LE CLIENT A DÉSIGNÉS. `_conseille`
        # est le filtre dur : hors priorités, aucune règle ne tourne, donc rien
        # à trier, rien à couper et rien à ranger plus bas. Un thème non
        # prioritaire garde sa carte, ses chiffres, sa courbe et sa veille —
        # c'est le point de vue de la semaine, un constat, pas un conseil.
        t_recos: list[dict] = []
        if _conseille:
            t_recos = build_recos(
                df_camp=tc, avg_ctr=avg_ctr,
                df_insta=ti if not ti.empty else None,
                df_week_posts=tw, followers_current=followers_current,
                ga4=_g4t_lbl, objectif=_obj_lbl, feedback=feedback, vision=constats,
                # Appel PAR THÈME (TASK-025) : `not_for_me` ne se fie qu'à
                # `feedback_theme` (un refus sur un AUTRE thème ne muselle plus
                # celui-ci) ; `verdicts` fait dépendre le poids de `done` du
                # résultat réel, comme pour `rule_recos` plus haut.
                #
                # `_theme_ctx_ok` : tant que la migration
                # `reco_feedback_contexte.sql` n'est pas jouée, `theme`/
                # `feedback_theme` retombent à `None` — `build_recos` retrouve
                # alors l'ANCIEN museau compte entier (`feedback` seul), pour ne
                # jamais faire perdre tout effet à `not_for_me` sur les cartes de
                # thème en attendant que la migration soit jouée.
                theme=(nlbl if _theme_ctx_ok else None),
                feedback_theme=(feedback_theme if _theme_ctx_ok else None),
                verdicts=verdicts,
            )
            t_recos = [r for r in t_recos if r.get("key") not in SETUP_KEYS]
            try:
                t_recos += _orga_recos(lbl, ti, df_insta, last_full_day)
            except Exception:
                pass
            try:
                t_recos += _reco_evenements(lbl, _g4t_lbl, _sem_theme)
            except Exception:
                pass
            # LES QUATRE RÈGLES PAYANTES — le trou que ce thème avait sans
            # Instagram. Avant elles, un compte qui ne fait que de la publicité
            # n'avait qu'UNE clé déterministe à lui, `roas`
            # (`.scratch/refonte/issues/22-rebrancher-le-plan-de-theme.md`).
            # Elles descendent sous la campagne — Annonce et Groupe d'annonces —
            # parce qu'à l'intérieur d'un thème une campagne n'a plus personne à
            # qui se comparer.
            try:
                # LES QUATRE PREMIÈRES RÈGLES SE TAISENT AUSSI (ticket 20).
                # `_faits_payants` rend déjà `{}` sur une semaine trouée, ce qui
                # désarme les six du ticket 10 ; mais `annonce_chere`,
                # `locomotive`, `sans_conversion` et `theme_hors_budget` lisent
                # `annonces` et `budget`, pas `faits`. `theme_hors_budget` est
                # le cas qui décide : une semaine non récoltée le fait annoncer
                # « tu es dans ton budget » — le seul verdict qu'on ne veut
                # surtout pas rendre à tort.
                _payantes = []
                if not _aveugle_semaine:
                    _payantes = regles_payantes(
                        lbl,
                        _annonces_theme(lbl, cur_since, last_full_day),
                        _budget_theme(lbl, _sem_theme),
                        _faits_payants(lbl),
                    )
                # `page_arrivee_muette` NE PREND PAS UNE DES TROIS PLACES DU
                # THÈME. C'est un prérequis de MESURE (levier `socle`) : tant
                # qu'on ne sait pas où passent les clics payés, tout ce qu'on
                # dit du retour de ce thème est bâti sur un revenu partiel —
                # elle répare la mesure dont les autres conseils dépendent, elle
                # ne se met pas en concurrence avec eux
                # (`.scratch/refonte/issues/24-conseils-payants-manquants.md`).
                for _r_pay in _payantes:
                    if _r_pay.get("key") == "page_arrivee_muette":
                        _socle_themes.append(_r_pay)
                    else:
                        t_recos.append(_r_pay)
            except Exception:
                pass

            # ── LA MARCHE SUIVANTE, ÉCRITE PAR GEMINI ───────────────────────
            #
            # Le seul endroit où Pulse laisse encore l'IA écrire un conseil, et
            # le seul qu'elle sache écrire : aucune règle déterministe ne sait
            # que « refaire la page d'arrivée » se descend en appel à l'action →
            # titre → structure. C'est du savoir-faire, pas une lecture de
            # chiffres — donc la coupe de
            # `.scratch/refonte/issues/11-d-ou-viennent-les-conseils.md` reste
            # intacte, elle visait l'idée INVENTÉE À PARTIR DE CHIFFRES et elle
            # a explicitement épargné les astuces, qui sont le même bois
            # (ticket 22, décision 6 ; bâti par le ticket 24 de la
            # construction).
            #
            # DEUX CONDITIONS, ET LA PREMIÈRE EST LA BARRIÈRE : **Gemini
            # n'ouvre jamais une Stratégie.**
            #   · une ligne `theme_plan` existe sur ce thème, posée par une
            #     RÈGLE — la clé `ai_` est refusée, c'est une piste rédigée
            #     avant la coupe de 11 et la réafficher remettrait à l'écran
            #     exactement ce que la décision retire (même garde que le
            #     blocage de fenêtre, plus bas) ;
            #   · le client a CONFIRMÉ avoir fait la Marche précédente.
            # Le module ferme la barrière une seconde fois de son côté, en
            # rejetant toute piste qui ne déclare pas `role="generale"` — et
            # `role="generale"` est précisément ce que la boucle
            # `ecrire_plan_de_theme` (tout en bas) ne ramasse pas. Rien de ce
            # qui sort d'ici ne peut devenir la Marche courante d'un plan.
            #
            # LES `facts` SONT CE QU'IL A LE DROIT DE NOMMER, et on lui donne
            # les MÊMES qu'aux règles payantes — plus les annonces, que
            # `regles_payantes` reçoit à part. Une Marche ne peut désigner
            # qu'un objet que la récolte a réellement rangé sous ce thème :
            # c'est la décision 7 de 14 (une campagne ne se nomme que si elle
            # appartient au thème traité), et c'est ce qui l'empêche de
            # conseiller sur une campagne qui n'existe pas.
            #
            # ELLE ENTRE COMME UNE CANDIDATE, JAMAIS COMME UNE PLACE RÉSERVÉE :
            # elle est ajoutée AVANT le tri par `_importance` et la coupe à
            # trois, donc elle passe les mêmes filtres que n'importe quelle
            # règle (`_est_conseil`, l'empreinte déjà servie) et peut très bien
            # ne pas sortir. Le tri et le plafond appartiennent au ticket 08,
            # et rien ici ne les touche.
            try:
                _plan_strat = theme_plan_by.get(nlbl) or {}
                _ouverte_par_regle = (
                    bool(_plan_strat.get("reco_key"))
                    and not str(_plan_strat["reco_key"]).startswith("ai_"))
                _faites = _marches_faites.get(nlbl) or []
                # UN CLIC FAIT AVANCER D'UNE MARCHE, PAS D'UNE PAR SEMAINE.
                # Sans cette borne, un seul « ✓ Je l'ai fait » posé il y a six
                # mois faisait écrire une étape neuve CHAQUE semaine — et
                # comme chaque étape porte sa propre clé, l'empreinte
                # anti-répétition ne les voyait jamais passer. On descendait
                # une échelle que plus personne ne montait.
                #
                # La borne est le `week_start` du dernier rapport publié, pas
                # un délai en jours : « depuis la dernière fois qu'on t'a
                # parlé » est la seule fenêtre que ce produit sache définir
                # sans inventer un seuil. Aucun rapport publié = premier
                # rapport du compte, et alors tout clic est nouveau.
                _neuf = (_semaine_precedente is None or (
                    _faites and str(_faites[-1].get("done_at") or "")[:10]
                    >= _semaine_precedente))
                if (_ouverte_par_regle and _faites and _neuf
                        and not _aveugle_semaine):
                    _m_suiv = marche_suivante(
                        lbl, _faites[-1],
                        {**_faits_payants(lbl),
                         "annonces": _annonces_theme(lbl, cur_since,
                                                     last_full_day)},
                        lecteur.redige, GRAMMAIRE,
                        deja_faites=[str(_a.get("title") or "").strip()
                                     for _a in _faites],
                        resume=_plan_strat.get("resume"),
                        # LE CANAL VIENT DE LA STRATÉGIE, PAS DE LA LIGNE DE
                        # SUIVI : `suivi_actions` n'a pas de colonne
                        # `platform` (voir sa table dans
                        # `supabase/migrations/000_run_me_all.sql`), et le lire
                        # là rendrait `None` à chaque fois. Le `snapshot` du
                        # plan est la carte COMPLÈTE de la règle qui a ouvert
                        # la Stratégie : une Marche reste sur le canal de la
                        # Stratégie qu'elle continue, et ça se lit au lieu de
                        # se deviner depuis le texte.
                        platform=(_plan_strat.get("snapshot")
                                  or {}).get("platform"),
                    )
                    if _m_suiv:
                        t_recos.append(_m_suiv)
            except Exception:
                pass   # une panne d'IA retire une carte, jamais le rapport
            # LE COÛT PAR CONVERSION REJOINT LES CONSTATS AU LIEU D'ÊTRE JETÉ.
            # `theme_event_cout` ne demande aucun geste : `_est_conseil` le
            # refusait deux lignes plus bas, en silence, depuis le ticket 06 —
            # calculé chaque semaine, publié nulle part. Il est récolté ICI,
            # avant le filtre qui le jette, et part dans `vision.constats` avec
            # le reste de « ce qui marche chez toi » (ticket 09).
            #
            # Il ne sort donc que pour un thème CONSEILLÉ : tout ce bloc vit
            # sous `if _conseille`, et c'est voulu — les constats se concentrent
            # sur ce que le client a désigné, comme les conseils.
            _fen_cout = (f"la semaine du {cur_since.day} {MONTHS_FR[cur_since.month]} "
                         f"au {last_full_day.day} {MONTHS_FR[last_full_day.month]}")
            for _r_cout in t_recos:
                if _r_cout.get("key") == "theme_event_cout":
                    constats.append(_constat_cout(_r_cout, lbl, ins_fb, _fen_cout))

            # LE CONSTAT SORT AVANT LA COUPE, PAS APRÈS. `_importance` ne sait
            # pas qu'un conseil sans geste n'en est pas un : le laisser concourir
            # lui ferait prendre une des places, dont le filtre de sortie le
            # chasserait ensuite — la carte tomberait à deux alors qu'un vrai
            # conseil attendait derrière.
            #
            # LA COUPE À TROIS RESTE, ET CE N'EST PLUS LE PLAFOND. Le plafond de
            # la semaine est de cinq sur TOUT le compte et il s'applique plus bas
            # (`composer_la_semaine`). Celle-ci ne fait qu'une chose : empêcher
            # qu'un seul thème présente les cinq. Avec trois thèmes conseillés au
            # maximum, elle garantit qu'au moins deux d'entre eux sont
            # représentés quand ils ont de quoi parler.
            #
            # ET UNE SEULE THÉORIE PAR THÈME, TRANCHÉE ICI (ticket 27). Elle se
            # pose ENTRE le classement et la coupe, et cet ordre est ce qui la
            # rend gratuite : après le tri, parce que « la meilleure » n'a de
            # sens qu'une fois `_importance` passé ; avant la coupe, pour que la
            # place libérée par la théorie écartée revienne à un vrai conseil au
            # lieu d'amputer la carte.
            t_recos = _une_seule_hypothese(sorted(
                [r for r in (_attach_grammaire(x) for x in t_recos)
                 if _est_conseil(r)
                 and empreinte_conseil(r) not in _deja_servies],
                key=_importance))[:3]

            # ── PAS DE NOUVELLE MARCHE AVANT LE VERDICT DE LA PRÉCÉDENTE ─────
            #
            # Une Stratégie qui change de théorie toutes les semaines n'est pas
            # une Stratégie (wayfinder `.scratch/recos-labels/issues/
            # 03-suivi-hypothese.md`). Tant que la Marche en cours n'a pas rendu
            # son Verdict, on RÉAFFICHE sa carte — même `reco_key`, donc mêmes
            # retours client et même baseline — plutôt que celle qu'une autre
            # règle propose cette semaine.
            #
            # DÉBLOQUÉ PAR LE VERDICT, PAS SEULEMENT PAR LE CALENDRIER
            # (wayfinder ticket 06) : `ATTENTE_MIN_NOUVELLE_HYPOTHESE` ne borne
            # que le cas où aucun verdict n'est encore tombé.
            #
            # UNE SEULE CHOSE A CHANGÉ EN PASSANT DES PISTES AUX RÈGLES : on
            # refuse de réafficher un `snapshot` dont la clé commence par `ai_`.
            # C'est une piste rédigée par Gemini, épinglée avant que ce ticket
            # les coupe ; la réafficher aujourd'hui remettrait à l'écran
            # exactement ce que la décision retire. Elle reste en base, elle ne
            # revient pas dans un rapport.
            _plan = theme_plan_by.get(nlbl)
            _epingle = None
            if (_plan and _plan.get("decided_at") and _plan.get("snapshot")
                    and not str(_plan.get("reco_key") or "").startswith("ai_")):
                try:
                    _decided = date.fromisoformat(str(_plan["decided_at"])[:10])
                except Exception:
                    _decided = None
                _attente = ATTENTE_MIN_NOUVELLE_HYPOTHESE.get(
                    _plan.get("levier"), _ATTENTE_DEFAUT)
                _verdict_tombe = bool(verdicts.get(_plan.get("reco_key")))
                if _decided and not _verdict_tombe and (today - _decided).days < _attente:
                    _epingle = dict(_plan["snapshot"])
            if _epingle:
                _i_hyp = next((i for i, r in enumerate(t_recos)
                               if r.get("role") == "hypothese"), None)
                if _i_hyp is None:
                    # Aucune règle n'ouvre de Marche sur ce thème cette semaine.
                    # La Stratégie en cours ne disparaît pas pour autant : elle
                    # reprend la dernière place, et la carte reste à trois — une
                    # Marche épinglée ne fabrique pas une quatrième place.
                    t_recos = t_recos[:2] + [_epingle]
                else:
                    t_recos[_i_hyp] = _epingle
                # ET LA CARTE NE DIT PAS DEUX FOIS LA MÊME CHOSE — sans rien
                # ajouter ici. Le thème servait sa théorie en double quand il
                # portait DEUX Hypothèses : la version mémorisée remplaçait la
                # première, la règle du jour restait à côté. `_une_seule_hypothese`
                # (plus haut dans la coupe) ayant déjà ramené la carte à une seule
                # Hypothèse, il n'y a plus qu'une place à remplacer — et le
                # doublon n'a plus par où entrer (ticket 27, mesuré par
                # `.scratch/construction/harnais/27-une-theorie-par-theme/mesure2.py`).
                _epingles.add(empreinte_conseil(_epingle))
                _plans_en_cours.add(nlbl)

        if _conseille and not t_recos and not t_veille:
            # ── LE FILET : AUCUNE CARTE CONSEILLÉE NE SORT MUETTE ────────────
            # Le résultat est lui-même une VEILLE (`veille_theme_…`) : elle dit
            # ce qu'on surveille et à partir de quand ce sera lisible, elle ne
            # conseille rien.
            #
            # ET IL NE SE DÉCLENCHE QUE SOUS LE GARDE, C'EST NOUVEAU. Ses mots
            # sont ceux d'un thème qu'on a REGARDÉ — « aucune de mes règles ne
            # s'est déclenchée ici », « rends son étoile à un thème sur lequel
            # tu as encore des décisions à prendre ». Sur un thème hors
            # priorités, aucune règle n'a tourné et il n'y a pas d'étoile à
            # rendre : les écrire quand même ferait dire à Pulse qu'il a
            # travaillé un thème qu'il a laissé de côté (`CLAUDE.md` §7). Une
            # carte hors priorités n'est pas muette pour autant — elle porte le
            # module VERROUILLÉ, qui dit exactement pourquoi elle est vide et ce
            # qui la remplit (`components/conseils-verrouilles.tsx`).
            try:
                _aveugle = (_sem_theme["spend"] > 0
                            and not (_g4t_lbl or {}).get("paid_revenue"))
                _sil = 1
                for _h in _hebdo_theme:
                    if _h["spend"] > 0 or _h["posts"] > 0:
                        break
                    _sil += 1
                t_veille = [_reco_theme_calme(
                    lbl, _sem_theme, _hebdo_theme,
                    _semaines_sans_conseil(nlbl), _aveugle, _sil)]
            except Exception:
                pass


        # LES CINQ COLONNES SE POSENT ICI, AVANT QUE LA CARTE SE FERME — et le
        # critère d'entrée trie juste après : ce qui ne demande aucun geste est
        # un constat, et un constat ne prend pas une des places de la semaine.
        # Les deux dans cet ordre : `_est_conseil` juge le geste POSÉ, pas le
        # geste déclaré, sinon toute règle qui s'en remet à `_GESTE_REGLE`
        # tomberait.
        _cartes = [r for r in (_attach_grammaire(x) for x in (t_recos + t_veille))
                   if _est_conseil(r)]

        tt = matrix_themes_by.get(nlbl, {})
        # CE QUE LE ROAS DE CE THÈME NE PEUT PAS VOIR (ticket 18).
        #
        # `spend_muette` est la part de `spend` dépensée par des campagnes dont
        # Google Analytics ne connaît pas le nom : elle pèse sur le dénominateur
        # et ne pourra jamais rien apporter au numérateur. Le ROAS n'est pas
        # faux, il est INCOMPLET — et sur le compte de production, 10 thèmes
        # jugés sur 17 sont dans ce cas (mesuré le 2026-09-13). Le taire serait
        # publier un ratio en sachant qu'un de ses deux côtés est amputé.
        #
        # ON PUBLIE LE ROAS ET ON ÉCRIT LA LIMITE, tranché avec David : se taire
        # complètement aurait vidé 59 % des thèmes de leur seul chiffre de
        # rentabilité.
        #
        # `None` veut dire « on ne sait pas », jamais « rien n'est muet » : la
        # vue rend NULL sur un compte où Google Analytics n'attribue aucune
        # campagne payante, et un payload d'avant ce ticket n'a pas la colonne.
        _muette = tt.get("spend_muette")
        _spend = tt.get("spend")
        summary = {
            "spend": _spend, "revenue": tt.get("revenue"), "roas": tt.get("roas"),
            "spend_muette": _muette,
            "campagnes_muettes": tt.get("campagnes_muettes"),
            # La part, calculée ici plutôt qu'à l'affichage : c'est elle qui dit
            # si le ROAS mérite d'être lu, et deux écrans ne doivent pas la
            # recalculer chacun à sa façon.
            "part_muette": (round(float(_muette) / float(_spend), 4)
                            if _muette is not None and _spend not in (None, 0)
                            else None),
            "ctr": tt.get("ctr"), "posts": tt.get("posts"),
            "reach_avg": tt.get("reach_avg"), "eng_avg": tt.get("eng_avg"),
            # LA DÉPENSE DE LA SEMAINE SE TAIT QUAND UN CANAL EST MUET
            # (ticket 20) — contrairement aux agrégats full-history juste
            # au-dessus, qui viennent de la vue et qu'une semaine trouée ne
            # déplace qu'à la marge, celui-ci EST la semaine trouée. Le publier
            # amputé le ferait comparer à la semaine d'avant et lire comme une
            # coupe de budget que personne n'a décidée.
            "spend_week": (None if _aveugle_semaine
                           else round(float(tc["spend"].sum()), 2)
                           if tc is not None else 0.0),
            "best_campaign": t_camps[0]["name"] if t_camps else None,
            "n_campaigns": len(t_camps),
            # LE COMPTE PAR RÉGIE, ET IL NE SE DÉDUIT PAS DE `campaigns`
            # (ticket 34). La liste publiée plus bas s'arrête à huit, et ce
            # sont les huit plus GROSSES DÉPENSES — `build_matrix` trie par
            # dépense décroissante (`saas/recos_ia/insights.py`). En compter
            # les canaux se trompe donc deux fois : sur le nombre (« huit »
            # sur un thème qui en porte quatorze) et, plus grave, sur la
            # PRÉSENCE — douze campagnes Meta grasses évincent les deux
            # campagnes Google du thème, et la porte vers `/google` ne
            # s'ouvre plus du tout.
            #
            # Ce compte-ci porte sur `t_camps` ENTIER. Une régie où le thème
            # ne tourne pas n'a pas de clé : un `0` écrit là serait vrai mais
            # ne dirait plus rien de plus que l'absence, et laisserait chaque
            # lecteur inventer son propre `> 0`.
            "n_campaigns_canal": _compte_par_canal(t_camps),
        }
        try:
            _series = _theme_series(lbl, summary.get("revenue"))
        except Exception:
            _series = None
        themes_focus.append({
            "label": lbl,
            "is_priority": lbl in priority_labels,
            # CE THÈME REÇOIT-IL DES CONSEILS ? C'est le filtre dur, écrit dans
            # le payload : le rapport doit pouvoir dire qu'une carte sans conseil
            # est une carte hors priorités, et non une panne. Absent des payloads
            # publiés avant ce ticket — le front traite alors l'absence comme un
            # « oui », pour ne pas coller rétroactivement une explication sur
            # d'anciens rapports.
            "conseille": _conseille,
            # L'objectif EFFECTIF de ce thème (celui qui pilote réellement sa
            # courbe et ses conseils ci-dessus), et s'il lui est PROPRE ou
            # hérité du compte. Absent des payloads publiés avant cette
            # fonctionnalité : le front traite l'absence comme « hérité »,
            # exactement ce qu'était le comportement avant elle.
            "objectif": _obj_lbl,
            "objectif_propre": _obj_propre,
            "summary": summary,
            "series": _series,
            "campaigns": [
                {k: c.get(k) for k in ("name", "channel", "key", "label",
                                       "label_source", "spend", "revenue", "ctr", "cpc")}
                for c in t_camps[:_CAMPAGNES_PUBLIEES]
            ],
            # `t_veille` est TOUJOURS AJOUTÉE, jamais mélangée à la coupe des
            # 2+1 (thèmes rédigés par Gemini) ni comptée dans les 3 (thèmes
            # règles, où elle est déjà dans `t_recos` — voir plus haut, elle
            # y est vidée après fusion pour ne pas doublonner ici).
            "recos": [_strip_reco(r) for r in _cartes],
        })

    # Réglages de base : les conseils « socle » (GA4 muet, connexion, funnel),
    # sortis du flux par thème — ce sont des prérequis, pas du pilotage hebdo.
    # Ils passent par la même pose que les autres : c'est ce qui leur donne le
    # levier `socle`, donc leur dispense de geste (voir `_est_conseil`).
    # UN SEUL `page_arrivee_muette`, CELUI QUI PERD LE PLUS DE CLICS. Un tag
    # absent d'une page d'arrivée ne se produit pas « par thème » : trois thèmes
    # prioritaires afficheraient trois fois la même réparation. On garde l'écart
    # le plus gros — c'est celui dont la réparation rapporte le plus.
    _socle_uniques, _vus = [], set()
    for _r_s in sorted(_socle_themes, key=lambda r: -(r.get("_enjeu") or 0)):
        if _r_s.get("key") in _vus:
            continue
        _vus.add(_r_s.get("key"))
        _socle_uniques.append(_r_s)

    reglages = [_strip_reco(_attach_grammaire(r))
                for r in ([r for r in sorted(rule_recos, key=lambda r: r["priority"])
                           if r.get("key") in SETUP_KEYS]
                          + _socle_uniques)][:3]

    # ── Verdict déterministe (même logique que le rapport) ───────────────────
    _signals = []
    if week_eng is not None and avg_engagement > 0:
        _signals.append(((week_eng - avg_engagement) / avg_engagement * 100,
                         "l'engagement Instagram"))
    if week_reach is not None and hist_reach:
        _signals.append(((week_reach - hist_reach) / hist_reach * 100,
                         "la portée de tes posts"))
    # LE VERDICT EST L'ENDROIT OÙ LE TROU DEVIENT UN MENSONGE LISIBLE
    # (ticket 20). `clicks_delta_pct` compare les clics de la semaine à ceux de
    # la précédente ; un canal muet met le numérateur à zéro et rend -100 %,
    # que la phrase publie en toutes lettres : « Semaine en retrait — les clics
    # publicitaires (-100 %) ». C'est LE faux verdict que ce ticket vise, servi
    # en tête du rapport et repris tel quel dans l'email.
    #
    # Les signaux Instagram, eux, restent : leur source a écrit. C'est toute la
    # doctrine — chaque mesure se tait si SA source est muette, et le verdict
    # d'un compte dont la boussole est l'engagement reste entier et bon.
    if clicks_delta_pct and not _aveugle_semaine:
        _signals.append((clicks_delta_pct, "les clics publicitaires"))
    # Le verdict sort d'ici en DEUX formes. La phrase, pour la lire ; et ses
    # trois ingredients bruts, pour que le front puisse afficher l'ecart en
    # grand. Une phrase de 26 px ne peut pas etre le niveau 1 d'une page ou un
    # autre module affiche un chiffre de 46 px : c'est la typographie qui
    # decide de la hierarchie, pas l'intention.
    verdict_pct = None
    verdict_metric = None
    verdict_tone = "stable"
    if _signals:
        _val, _name = max(_signals, key=lambda s: abs(s[0]))
        verdict_pct = round(float(_val), 1)
        verdict_metric = _name
        verdict_tone = "pos" if _val >= 10 else ("neg" if _val <= -10 else "stable")
        if _val >= 10:
            verdict = f"Semaine en progression — portée par {_name} ({_val:+.0f} %)."
        elif _val <= -10:
            verdict = f"Semaine en retrait — {_name} ({_val:.0f} %), le reste tient."
        else:
            verdict = "Semaine stable — dans tes normes habituelles."
        if followers_delta and abs(followers_delta) >= 5:
            verdict += f" {'+' if followers_delta > 0 else ''}{followers_delta} abonnés."
    elif followers_delta:
        verdict = f"{'+' if followers_delta > 0 else ''}{followers_delta} abonnés cette semaine."
    elif _aveugle_semaine:
        # Sans ce cas, un compte qui ne fait que de la pub et dont le canal
        # vient de tomber lirait « Première semaine de données » — faux, et
        # rassurant à contretemps. On nomme la panne ; le détail et le geste
        # sont dans `canaux_muets`, que l'écran et l'email affichent.
        verdict = ("Semaine incomplète — "
                   + " et ".join(NOMS_CANAUX.get(_c, _c)
                                 for _c in sorted(_aveugle_semaine))
                   + " n'a pas répondu, les chiffres de pub manquent.")
    else:
        verdict = "Première semaine de données — le rapport s'affinera avec l'historique."
    _alert = next((r for r in rule_recos
                   if r.get("confidence") == "solide"
                   and str(r.get("title", "")).startswith("Alerte")), None)
    if _alert:
        verdict += (" Un point rouge à traiter : "
                    f"{KEY_LABELS.get(_alert.get('key'), 'voir le brief ci-dessous')}.")

    # ── Sélection (2 insta + 3 pub, digest 3) — comme le rapport ─────────────
    by_section = {"instagram": [], "meta": []}
    for r in rule_recos:
        p = r.get("platform")
        if p == "instagram":
            by_section["instagram"].append(r)
        elif p in ("meta", "google", "pub"):
            by_section["meta"].append(r)
    insta_items = sorted(by_section["instagram"], key=lambda r: r["priority"])[:2]
    meta_items = sorted(by_section["meta"], key=lambda r: r["priority"])[:3]
    todos = sorted(insta_items + meta_items, key=lambda r: r["priority"])[:3]

    # ── Brief IA (calibré par le profil client vivant) + fallback déterministe ─
    _profile_txt = (
        f" Profil du client (calibre ton ton et ton niveau de détail, ne le "
        f"cite jamais mot pour mot) : {client_profile}"
        if client_profile else ""
    )
    _done = [KEY_LABELS.get(k, k) for k, v in feedback.items() if v == "done"]
    _skip = [KEY_LABELS.get(k, k) for k, v in feedback.items() if v == "not_for_me"]
    fb_txt = ""
    if _done:
        fb_txt += f" Déjà traité récemment : {', '.join(_done)}."
    if _skip:
        fb_txt += f" Jugé non pertinent (ne pas réinsister) : {', '.join(_skip)}."
    obj_txt = OBJECTIFS[objectif]["label"] if objectif in OBJECTIFS else "non défini"
    _top_todo = todos[0]["title"] if todos else None
    _prio_line = (
        f"La priorité n°1 de la semaine (déjà calculée, ne la change pas) : {_top_todo}. "
        if _top_todo else ""
    )
    # La vision globale cadre l'IA : elle s'appuie sur ce que le client a validé,
    # jamais sur ce qu'il a rejeté.
    _v_ok = [c for c in constats if c["status"] in ("agree", "new") and c["kind"] != "angle_mort"]
    _v_no = [c for c in constats if c["status"] == "reject"]
    vision_txt = ""
    if priority_labels:
        vision_txt += (" Thèmes PRIORITAIRES choisis par le client (concentre tes conseils "
                       f"dessus, ignore le reste sauf urgence) : {', '.join(priority_labels)}.")
    if _v_ok:
        # L'ANGLE MORT PART AVEC LE CHIFFRE, PAS APRÈS LUI. Un constat qui en
        # porte un est une borne haute, pas une mesure (`cout_conversion` : ce
        # qui arrive sans campagne n'entre pas dans ce coût). Le donner à Gemini
        # sans sa réserve, sous un « appuie-toi dessus », c'est lui demander de
        # présenter une borne comme un fait — exactement ce que `CLAUDE.md` §7
        # interdit, et à l'endroit le plus exposé.
        def _pour_ia(c):
            txt = f"{c['title']} — {c['detail']}"
            return f"{txt} [limite : {c['angle_mort']}]" if c.get("angle_mort") else txt

        vision_txt += (" Vision long terme du compte (validée, appuie-toi dessus) : "
                       + " | ".join(_pour_ia(c) for c in _v_ok) + ".")
    if _v_no:
        vision_txt += (" Constats REJETÉS par le client (ne t'appuie JAMAIS dessus) : "
                       + " | ".join(c["title"] for c in _v_no) + ".")
    # Digest de la semaine : TOUS les posts + TOUTES les campagnes (pas un extrait)
    _wk = []
    _npw = len(df_week_posts) if df_week_posts is not None else 0
    if _npw > 0:
        _wk.append(f"{_npw} post(s) publiés"
                   + (f", portée moyenne {week_reach:.0f}" if week_reach else "")
                   + (f", engagement {week_eng:.1f} %" if week_eng else ""))
    else:
        _wk.append("aucun post publié cette semaine")
    if not df_camp.empty:
        _ncmp = len(df_camp)
        _cw = df_camp.sort_values("spend", ascending=False)
        _cbits = "; ".join(
            f"{r['campaign_name']} ({r['spend']:.0f} CHF, CTR {r['ctr']:.1f} %)"
            for _, r in _cw.head(6).iterrows())
        _wk.append(f"{_ncmp} campagne(s) actives, {float(df_camp['spend'].sum()):.0f} CHF au total — {_cbits}")
    else:
        _wk.append("aucune campagne pub active")
    week_digest = " · ".join(_wk)

    brief = lecteur.redige(
        "Tu es un consultant marketing pour une PME. Écris un VRAI résumé de la semaine "
        "en 4 à 6 phrases (français, ton concret et direct, pas de guillemets) qui couvre "
        "À LA FOIS tous les posts ET toutes les campagnes de la semaine : "
        "1) une phrase de synthèse (la tendance générale) ; "
        "2) ce qui s'est passé côté contenu (posts, portée, engagement) ; "
        "3) ce qui s'est passé côté pub (campagnes, dépense, ce qui ressort) ; "
        "4) termine par la priorité n°1, formulée simplement. "
        "Ne compare JAMAIS Meta et Google entre eux. "
        "Vocabulaire précis : un ROAS sous 1 se dit « inférieur à 1 », jamais « négatif » ; "
        "ne déforme aucun chiffre fourni. "
        f"Objectif principal du compte : {obj_txt}.{fb_txt}{vision_txt}{_profile_txt} "
        f"{_prio_line}"
        f"Semaine : {week_digest}. "
        f"Totaux : abonnés {followers_delta:+d}, engagement {avg_engagement:.1f} %, "
        f"CTR {avg_ctr:.2f} %, dépense {total_spend:.0f} CHF. "
        "Si rien n'a vraiment marché, dis-le simplement — pas de flatterie artificielle."
    )
    if not brief:
        bits = []
        if followers_delta > 0:
            bits.append(f"+{followers_delta} abonnés cette semaine")
        if avg_engagement >= 3:
            bits.append(f"engagement à {avg_engagement:.1f}%")
        if avg_ctr >= 2:
            bits.append(f"un CTR pub de {avg_ctr:.1f}%")
        brief = ("Bonne nouvelle : " + ", ".join(bits) + "." if bits
                 else "Semaine calme — rien de marquant, mais rien qui dérape non plus.")
        if _top_todo:
            brief += f" Priorité n°1 : {_top_todo}."

    # Le Graphe A (compte entier — classificateur, candidate IA libre,
    # `recos_compte`, file `reco_news`) a existé, puis a été retiré
    # (30 août 2026), reconstruit (7 septembre 2026), puis définitivement
    # retiré (7 septembre 2026, décision de David — « on a pas de recos sur
    # le compte entier ») : voir `.scratch/recos-generales/map.md`, section
    # « Out of scope ». Le reste de cette fonction (brief hebdo, réglages,
    # recos par thème) n'en dépendait pas et reste inchangé.
    _n_done = sum(1 for v in feedback.values() if v == "done")
    _n_useful = sum(1 for v in feedback.values() if v == "useful")
    _n_skip = sum(1 for v in feedback.values() if v == "not_for_me")

    # ── Thèmes : dépense par label × revenu GA4 (même logique que le rapport) ─
    # (meta_cfg / goog_cfg déjà chargés plus haut pour la matrice)
    themes = None
    if ga4_ctx and ga4_ctx.get("by_campaign"):
        def _norm(s):
            return str(s or "").strip().lower()
        sp_lbl: dict = {}
        meta_labeled = 0.0
        if not df_camp.empty:
            for _, r in df_camp.iterrows():
                lbl = (meta_cfg.get(r["campaign_name"], {}) or {}).get("label")
                if lbl:
                    sp_lbl[lbl] = sp_lbl.get(lbl, 0.0) + float(r["spend"])
                    meta_labeled += float(r["spend"])
        google_labeled = 0.0
        if not df_google.empty and "campaign_id" in df_google.columns:
            gw = df_google[
                (df_google["date_start"] >= pd.Timestamp(cur_since))
                & (df_google["date_start"] <= pd.Timestamp(last_full_day))
            ].copy()
            if not gw.empty:
                gw["_cid"] = gw["campaign_id"].astype(str)
                gw["_chf"] = pd.to_numeric(gw["cost_micros"], errors="coerce").fillna(0) / 1_000_000.0
                for cid, chf in gw.groupby("_cid")["_chf"].sum().items():
                    lbl = (goog_cfg.get(cid, {}) or {}).get("label")
                    if lbl and chf > 0:
                        sp_lbl[lbl] = sp_lbl.get(lbl, 0.0) + float(chf)
                        google_labeled += float(chf)
        # Ce qui n'est rattaché à AUCUN thème — le même bucket « autres » que
        # sur la page Coûts (`couts/page.tsx` : total de la fenêtre moins ce
        # qui est étiqueté). AVANT ce correctif, cette place était prise par
        # le revenu GA4 sans correspondance de campagne — une notion
        # entièrement différente (du CHF de VENTE, pas de la DÉPENSE non
        # étiquetée) — donc les campagnes sans thème posé disparaissaient
        # purement et simplement du camembert au lieu d'apparaître en
        # « autres » : la ou les campagnes étiquetées se retrouvaient à tort
        # à 100 % du budget affiché.
        spend_orphan = max(0.0, (total_spend - meta_labeled) + (g_spend - google_labeled))
        name_lbl = {_norm(n): (c or {}).get("label")
                    for n, c in meta_cfg.items() if (c or {}).get("label")}
        for cid, c in goog_cfg.items():
            if (c or {}).get("label") and c.get("campaign_name"):
                name_lbl.setdefault(_norm(c["campaign_name"]), c["label"])
        rv_lbl: dict = {}
        for camp, dd in ga4_ctx["by_campaign"].items():
            rev = float(dd.get("revenue") or 0)
            lbl = name_lbl.get(_norm(camp))
            if lbl:
                rv_lbl[lbl] = rv_lbl.get(lbl, 0.0) + rev
        # Pas de troncature ici : `ThemeDonut` regroupe déjà lui-même tout ce
        # qui dépasse les 5 premières parts dans « autres » (même logique que
        # la page Coûts, qui lui passe tous les thèmes sans les couper avant).
        # Couper à 4 ici les aurait fait disparaître purement et simplement,
        # au lieu de les regrouper visiblement.
        t_rows = sorted(
            ({"label": lbl, "spend": round(s, 2), "rev": round(rv_lbl.get(lbl, 0.0), 2)}
             for lbl, s in sp_lbl.items() if s > 0),
            key=lambda r: -r["spend"],
        )
        if t_rows:
            themes = {"rows": t_rows, "orphan": round(spend_orphan, 2)}

    # ── Boucle de la preuve : les « Fait » des semaines passées, re-mesurés ───
    # Le jour où la mesure est passée du compte au thème. Voir plus bas : une
    # action antérieure garde la mesure sur laquelle elle a été photographiée.
    _BASCULE_THEME = "2026-08-12"

    # Le jour où la dépense payante est passée de Meta seul aux deux régies
    # (ticket 01). Une action photographiée avant porte une baseline `cpc` ou
    # `roas` prise sur la dépense Meta SEULE : lui opposer la mesure
    # d'aujourd'hui comparerait deux périmètres, et un verdict pris sur deux
    # périmètres est faux — puis il repondère les conseils (`_DONE_W`,
    # `saas/recos_ia/reco_engine.py`). Ces actions-là finissent donc SANS
    # verdict automatique : elles retombent dans « échéance atteinte, à juger
    # soi-même », comme une action dont l'indicateur n'est pas mesurable.
    # On ne rejoue pas l'historique et on n'invente pas de delta.
    #
    # POURQUOI CE N'EST PAS LE 2026-09-11, JOUR DE LA CORRECTION. La seule date
    # que porte une action est `decided_at`, et `startTracking`
    # (`saas/web/app/actions.ts` l. 84) y écrit le jour du CLIC, alors que
    # `baseline` (l. 83) est recopiée telle quelle du payload affiché — donc
    # photographiée au dernier rapport construit, jusqu'à une semaine plus tôt.
    # Un clic du 2026-09-13 sur un rapport du 2026-09-08 porterait une baseline
    # Meta seule tout en passant le test. La bascule prend donc la marge d'un
    # cycle hebdomadaire complet. Ce que ça coûte : les actions décidées
    # pendant cette semaine de transition partent sans verdict automatique,
    # même celles dont la baseline était déjà bonne. C'est le sens sûr.
    #
    # LIMITE QUI RESTE, et qui ne se corrige pas ici : si aucun rapport n'est
    # construit pendant plus d'une semaine, un payload plus vieux que la marge
    # survit à l'écran et son clic repasserait le test. Aucune colonne de
    # `suivi_actions` ne dit sur quel périmètre sa baseline a été prise — la
    # réparer demande une colonne, pas une constante.
    _BASCULE_PUB = "2026-09-19"
    _METRICS_PERIMETRE_PUB = ("cpc", "roas")

    # L'INDICATEUR D'UN CONSEIL SE DÉCLARE, IL NE SE RETROUVE PLUS ICI.
    #
    # `PROOF_KPI` vivait à cet endroit : dix-sept lignes qui répétaient
    # `METRIC_INFO` valeur pour valeur, une fois par clé-règle. Elle est
    # remplacée par `_METRIC_REGLE` + `_spec_mesure` (haut de fichier), qui
    # donnent la même spec à une règle (par sa clé stable) et à une piste IA
    # (par la `metric` qu'elle déclare, sa clé `ai_<theme>_<n>` changeant chaque
    # semaine). Les raisons qui excluaient les `veille_*` et les `theme_event_*`
    # de cette table sont écrites là-bas, avec la table.

    # MESURER UNE ACTION LÀ OÙ ELLE A EU LIEU.
    #
    # Sans le parametre `theme`, cette fonction rend les chiffres du COMPTE
    # ENTIER — et c'est ainsi que les verdicts etaient rendus jusqu'ici : une
    # action prise sur « Audio Tour » etait jugee sur le ROAS de tout le compte.
    # Autant dire qu'elle etait jugee sur le bruit des autres themes.
    #
    # Avec `theme`, chaque source est filtree sur ce theme : les campagnes par
    # leur etiquette, les posts par leurs labels, le revenu GA4 par les
    # campagnes du theme. Le verdict devient enfin une mesure de l'action.
    def _kpis_window(w_since, w_until, theme=None):
        k = {}
        # LE NUMÉRATEUR ET LE DÉNOMINATEUR COUVRENT LE MÊME PÉRIMÈTRE.
        #
        # Jusqu'au 2026-09-11, `spend` et `cpc` ne lisaient QUE `df_meta_raw`
        # pendant que `roas` divisait par eux le revenu GA4 de `by_campaign`,
        # qui agrège Meta ET Google : tout thème tournant sur les deux régies
        # affichait revenu(Meta+Google) ÷ dépense(Meta), donc un ROAS gonflé —
        # et le Verdict rendu sur ce chiffre disait « ça a marché » plus souvent
        # que la réalité. Mesuré par le ticket 24 de la refonte, réparé par le
        # ticket 01 de la construction.
        #
        # AUCUNE RÈGLE D'ATTRIBUTION NEUVE N'EST CHOISIE ICI. Additionner la
        # dépense des deux régies est déjà la convention du rapport : la vue
        # `theme_regroupement` calcule le ROAS d'un thème sur cette somme
        # (`supabase/migrations/`), les KPI du compte fusionnent Meta et
        # Google dans `df_camp`, et `_pub_fenetre` juste au-dessus porte la
        # raison — on additionne des dépenses et des clics, deux grandeurs que
        # chaque régie mesure elle-même ; c'est le REVENU qu'on ne saurait pas
        # ventiler entre les deux. Séparer un ROAS par canal reste, lui, une
        # décision produit non prise (`docs/mesures-impossibles.md`).
        _pub = _pub_fenetre(theme, w_since, w_until)
        # UN CANAL MUET NE REND PAS UN CHIFFRE PLUS PETIT, IL N'EN REND PAS
        # (ticket 20). `spend` amputé se lirait comme une baisse de budget, et
        # `cpc` a son numérateur ET son dénominateur amputés — le second se
        # trompe même de SENS quand les deux canaux n'ont pas le même coût du
        # clic. Les deux se taisent ensemble, parce qu'ils sortent de la même
        # somme incomplète.
        _aveugle = _pub["aveugle"]
        k["spend"] = None if _aveugle else _pub["spend"]
        k["cpc"] = (None if _aveugle
                    else (_pub["spend"] / _pub["clics"]) if _pub["clics"] > 0
                    else None)
        if not df_insta.empty and "date" in df_insta.columns and "eng" in df_insta.columns:
            dtp = pd.to_datetime(df_insta["date"], errors="coerce")
            p = df_insta[(dtp.dt.date >= w_since) & (dtp.dt.date <= w_until)]
            if theme and "labels" in p.columns:
                p = p[p["labels"].map(
                    lambda l, _t=theme: isinstance(l, (list, tuple)) and _t in l)]
            k["posts"] = float(len(p))
            k["eng"] = float(p["eng"].mean()) if len(p) else None
            k["reach"] = float(p["reach"].mean()) if len(p) and "reach" in p.columns else None
        try:
            g = lecteur.ga4_contexte(w_since, w_until)
        except Exception:
            g = None
        _rev = (g or {}).get("paid_revenue")
        if theme and g:
            # Seules les conversions rattachables aux campagnes DE CE THEME.
            # Rien de rattachable : on ne sait pas, et on se tait — plutot que
            # d'attribuer au theme le revenu du compte.
            _sub = {n: d for n, d in (g.get("by_campaign") or {}).items()
                    if name2label.get(_nrm(n)) == theme}
            _rev = sum(float((d or {}).get("revenue") or 0) for d in _sub.values()) if _sub else None
        # LE ROAS EST LE PLUS DANGEREUX DES TROIS, ET C'EST CONTRE-INTUITIF.
        # GA4 tourne dans son propre fil : quand Meta ou Google échoue, le
        # revenu reste ENTIER pendant que la dépense est amputée. Le ROAS ne
        # tombe pas, il GONFLE — le rapport n'a pas l'air cassé, il a l'air
        # excellent, et `scaler` conseille d'augmenter un budget sur un chiffre
        # fabriqué par une panne. `k["spend"]` vaut déjà `None` juste au-dessus,
        # ce qui suffit à l'empêcher, mais la condition est écrite en clair
        # plutôt que déduite : c'est elle qu'on relira.
        if _rev is not None and not _aveugle and (k.get("spend") or 0) > 0:
            k["roas"] = float(_rev) / k["spend"]
        pu = (g or {}).get("funnel", {}).get("purchase")
        # `purchases` reste un chiffre de compte : GA4 ne rattache pas un achat
        # a un theme quand l'UTM ne porte pas le nom de campagne.
        k["purchases"] = float(pu) if pu is not None else None
        return k

    # LE MOTEUR DE PREUVE COMPTE-ENTIER EST MORT ICI, LE 2026-09-13.
    #
    # Quarante-deux lignes lisaient `reco_feedback.reaction = 'done'` et
    # remesuraient ces décisions sur le COMPTE ENTIER (`_kpis_window` sans
    # `theme`), pour publier `payload.preuve`. Aucun écran ne l'a jamais lu —
    # `ProofOutcome` n'existait que dans sa déclaration.
    #
    # C'ÉTAIT UN SECOND MOTEUR, pas un trou : le rail des actions rend le même
    # verdict sur le THÈME de l'action depuis le `_BASCULE_THEME`, et les deux
    # pouvaient répondre l'inverse l'un de l'autre sur la même décision. Motif
    # du ticket 09 rejoué : quand deux moteurs répondent à la même question
    # avec des périmètres différents, celui qui mesure au bon endroit reste et
    # l'autre meurt (`.scratch/refonte/issues/08-la-memoire-du-travail.md` §1,
    # `.scratch/construction/issues/12-le-carnet-et-la-mort-de-preuve.md`).
    #
    # CE QUI LE REMPLACE NE MESURE RIEN : le bilan au niveau du compte est un
    # COMPTAGE de `suivi_actions.verdict`, déjà persisté par la boucle du rail
    # juste en dessous — « 30 derniers jours : 6 actions jugées, 4 ont marché ».
    # Il est compté à la lecture, côté web (`saas/web/lib/carnet.ts`), parce
    # qu'un comptage de lignes déjà écrites n'a pas besoin d'attendre le Jour
    # de travail. Aucune mesure nouvelle, donc aucune contradiction possible.

    # ── Suivi des actions « ▶ Je le teste » ──────────────────────────────────
    # 1) On attache à chaque conseil son indicateur-cible + sa valeur du moment :
    #    c'est la photo prise si l'utilisateur décide de le tester.
    cur_kpis = _kpis_window(cur_since, last_full_day)

    # La baseline d'un conseil se prend sur SON terrain. Un conseil « le CPC de
    # Audio Tour est trop haut » dont la baseline serait le CPC du compte
    # entier serait jugé, deux semaines plus tard, sur un chiffre qui ne parle
    # pas de lui. Le cache évite de recalculer une fenêtre par conseil.
    _kpis_theme = {}

    def _kpis_du_theme(theme):
        if theme is None:
            return cur_kpis
        if theme not in _kpis_theme:
            _kpis_theme[theme] = _kpis_window(cur_since, last_full_day, theme=theme)
        return _kpis_theme[theme]

    def _jugement_theme(lbl: str) -> dict | None:
        """Le jugement explicite d'un thème : où il en est sur SON objectif,
        avec un vrai % mesuré — jamais un % de cible fabriqué (aucune cible
        chiffrée n'existe, voir `JUGEMENT_METRIC_PAR_OBJECTIF` plus haut).
        `None` si la métrique n'est pas mesurable cette semaine (pas de
        baseline, division par zéro) — on se tait plutôt que d'afficher un
        chiffre inventé.
        """
        obj = _obj_theme(lbl)
        metric = JUGEMENT_METRIC_PAR_OBJECTIF.get(obj, "eng")
        now = _kpis_du_theme(lbl).get(metric)
        then = _kpis_window(prev_since, prev_until, theme=lbl).get(metric)
        if now is None or then is None or abs(then) < 1e-9:
            return None
        variation = round((now - then) / then * 100, 1)
        info = METRIC_INFO.get(metric, (metric, "", "up", "{:.1f}"))
        metric_label = info[0]
        mode = "cible" if variation <= JUGEMENT_SEUIL_DEGRADATION else "tout"
        if variation >= 5:
            explication = f"{metric_label} en hausse de {variation:+.1f} % vs la semaine précédente."
        elif variation <= JUGEMENT_SEUIL_DEGRADATION:
            explication = (f"{metric_label} en baisse de {variation:.1f} % vs la semaine précédente — "
                            "on cible le levier le plus impactant plutôt que de tout pousser.")
        else:
            explication = f"{metric_label} stable ({variation:+.1f} %) vs la semaine précédente."
        return {
            "objectif": obj, "metric": metric, "metric_label": metric_label,
            "variation_pct": variation, "mode": mode, "explication": explication,
            "levier_impactant": JUGEMENT_LEVIER_PAR_METRIC.get(metric) if mode == "cible" else None,
        }

    def _attach_metric(r, theme=None):
        # Une règle porte une clé STABLE (« gaspillage »), qui suffit à
        # retrouver son indicateur — `_METRIC_REGLE`. Un conseil qui déclare
        # lui-même sa `metric` (la carte d'une Marche réaffichée, relue de
        # `theme_plan`) la garde : elle est déjà passée par cette même spec, donc
        # par la même baseline et le même verdict.
        spec = _spec_mesure(_METRIC_REGLE.get(r.get("key")) or r.get("metric"))
        if not spec:
            return
        kpi, lbl_k, _unit, direction, _fmt = spec
        r["metric"], r["metric_label"], r["direction"] = kpi, lbl_k, direction
        # LA CARTE D'UNE MARCHE RÉAFFICHÉE (blocage de fenêtre plus haut,
        # `t_recos[_i_hyp] = _epingle`)
        # NE RECALCULE PAS SA BASELINE ICI. `suivi_actions`, qui rend le
        # verdict, ne la recalcule pas non plus (son propre `continue` : la
        # ligne garde la baseline posée le jour du pin). Sans cette garde, le
        # chiffre affiché sur la carte divergeait chaque semaine de celui sur
        # lequel portera le verdict — deux photos différentes de la même
        # décision.
        _plan = theme_plan_by.get(_nrm(theme)) if theme else None
        if (_plan and _plan.get("reco_key") == r.get("key")
                and r.get("baseline") is not None):
            return
        base = _kpis_du_theme(theme).get(kpi)
        r["baseline"] = round(base, 4) if base is not None else None

    def _attach_effort(r):
        # Une veille ne se « fait » pas : lui coller une pastille « ⏱ 30 min »
        # la ferait passer pour une tâche alors qu'elle demande d'attendre.
        if _est_veille(r):
            return
        if not r.get("effort"):
            r["effort"] = EFFORT_BY_KEY.get(r.get("key"), "30 min")

    for _tf in themes_focus:
        for _r in _tf["recos"]:
            _attach_metric(_r, _tf["label"])
            _attach_effort(_r)
    for _r in reglages:
        # Les réglages de base (GA4, funnel) ne portent pas de thème : ce sont
        # des prérequis du compte, leur mesure l'est aussi.
        _attach_metric(_r)
        _attach_effort(_r)

    # ── LE JUGEMENT DE CHAQUE THÈME, ET SON INFLUENCE SUR LA COMPOSITION ─────
    #
    # `_jugement_theme` a besoin de `_kpis_du_theme`/`_kpis_window`, définies
    # juste au-dessus — d'où ce passage séparé, après coup, plutôt que dans la
    # boucle par thème, bien plus haut dans ce fichier, avant que ces fonctions
    # n'existent.
    #
    # « Influence la composition » (décision de David) : en mode "cible", on ne
    # fabrique JAMAIS de conseil en plus — on réordonne ceux qui sont déjà là
    # pour que celui dont le `levier` correspond à l'indicateur dégradé passe en
    # tête (les autres restent affichés, juste pas en premier).
    for _tf in themes_focus:
        _jug = _jugement_theme(_tf["label"])
        _tf["jugement"] = _jug
        if _jug and _jug.get("mode") == "cible" and _jug.get("levier_impactant"):
            _tf["recos"].sort(key=lambda r, _lv=_jug["levier_impactant"]: r.get("levier") != _lv)

    # ── LE PLAFOND DE CINQ, SUR TOUT LE COMPTE ───────────────────────────────
    #
    # C'était trois par thème sur un nombre de thèmes ILLIMITÉ : six thèmes
    # étoilés donnaient jusqu'à dix-huit conseils. Ce n'était pas un plafond.
    # David : « faire simple au début » — et dix minutes le lundi matin ne
    # tiennent pas dix-huit conseils
    # (`.scratch/refonte/issues/11-d-ou-viennent-les-conseils.md`).
    #
    # IL S'APPLIQUE ICI, ET PAS AILLEURS, POUR TROIS RAISONS :
    #   · APRÈS `_attach_effort` — la composition lit l'effort, qui n'est posé
    #     qu'à ce moment-là ; avant, tous les conseils se seraient valus ;
    #   · APRÈS le jugement de thème, qui réordonne les conseils d'un thème qui
    #     se dégrade : c'est un ordre qu'on veut voir respecté par la coupe ;
    #   · AVANT `upsert_theme_plan`, juste en dessous — une Marche que le
    #     plafond n'a pas retenue n'ouvre AUCUNE Stratégie. L'inverse écrirait
    #     dans la mémoire de Pulse une théorie que le client n'a jamais lue.
    #
    # LES VEILLES NE SONT PAS DEDANS. Une veille dit « attends, ce sera lisible
    # le 24 » : elle ne demande aucun geste, elle ne prend donc aucune des cinq
    # places — elle reste sur la carte de son thème, en plus.
    _conseils_semaine = []
    for _tf in themes_focus:
        for _r in _tf["recos"]:
            if _est_veille(_r):
                continue
            _conseils_semaine.append((_tf, _r))

    def _rang_de(tf):
        return _rang_theme.get(_nrm(tf["label"]), 9)

    _conseils_semaine.sort(key=lambda c: _importance(c[1], _rang_de(c[0])))
    # `_deja_servies` est repassé ici alors que la boucle a déjà filtré dessus :
    # le module doit pouvoir tenir sa règle tout seul, sans supposer qu'un
    # appelant l'a fait pour lui. `_epingles` est ce qui l'en dispense — une
    # Marche en cours se réaffiche exprès, à l'identique.
    _retenus = {id(_r) for _r in composer_la_semaine(
        [_r for _, _r in _conseils_semaine], _deja_servies, _epingles)}
    for _tf in themes_focus:
        _tf["recos"] = [_r for _r in _tf["recos"]
                        if _est_veille(_r) or id(_r) in _retenus]

    # ── LA MARCHE DE LA SEMAINE ENTRE DANS LA MÉMOIRE DE PULSE, PAS AU CARNET ─
    #
    # PLUS RIEN N'ENTRE AU CARNET SANS UN CLIC (ticket 06 de la construction,
    # tranché par `.scratch/refonte/issues/22-rebrancher-le-plan-de-theme.md`,
    # décision 7). Jusqu'ici, l'Hypothèse d'un thème s'écrivait dans
    # `suivi_actions` à la publication, `status="auto"`, et recevait un verdict à
    # quatorze jours QUE LE CLIENT L'AIT FAITE OU NON. Un Verdict rendu sur un
    # geste que personne n'a confirmé attribue un mouvement de chiffres à une
    # action qui n'a peut-être jamais eu lieu : c'est `CLAUDE.md` § 7, et c'est
    # la raison pour laquelle ces dix-huit champs ont disparu d'ici.
    #
    # LA SÉPARATION QUI REND ÇA POSSIBLE EXISTAIT DÉJÀ :
    #   · `theme_plan` est la mémoire de PULSE — quelle Hypothèse tourne sur ce
    #     thème, depuis quand. Elle continue de s'écrire À LA PUBLICATION, sinon
    #     un thème changerait de théorie chaque semaine, ce que la fenêtre
    #     d'attente (`ATTENTE_MIN_NOUVELLE_HYPOTHESE`) existe précisément pour
    #     empêcher ;
    #   · `suivi_actions` est le carnet du CLIENT, et il ne reçoit qu'au clic
    #     (`startTracking` / `resolveAction`, `saas/web/app/actions.ts`).
    # Conséquence directe : l'échéance du Verdict se calcule depuis la date du
    # clic, jamais depuis la publication. Le cas « jamais cliqué » a sa sortie
    # ailleurs — la Mise en veille à deux semaines de silence.
    #
    # L'Hypothèse d'un thème peut maintenant venir d'une RÈGLE et plus seulement
    # de Gemini : c'est `_GESTE_REGLE` (et les branches qui déclarent leur geste)
    # qui posent `role="hypothese"`. `next(...)` en retient une seule par thème,
    # ce que la contrainte `UNIQUE (user_id, theme)` de `theme_plan` exige de
    # toute façon.
    for _tf in themes_focus:
        _hyp = next((r for r in _tf["recos"] if r.get("role") == "hypothese"), None)
        if not _hyp:
            continue
        # LA STRATÉGIE DE CE THÈME TOURNE-T-ELLE ENCORE ? La question a déjà été
        # tranchée, une seule fois, par l'épinglage (`_plans_en_cours`, voir son
        # commentaire près de `_epingles`). Si oui, cette Hypothèse est la
        # Marche du plan REJOUÉE : son compteur doit continuer sur SA date de
        # décision d'origine, pas repartir sur `today`.
        #
        # LA GARDE PORTE SUR LE THÈME, PLUS SUR LA CLÉ (ticket 27). Comparer les
        # clés ne protégeait rien dès que la carte changeait de règle d'une
        # semaine à l'autre — et c'est justement la semaine où il fallait
        # protéger. `theme_plan` est unique par thème : c'est le thème qui porte
        # la théorie en cours, pas la clé.
        _nlbl = _nrm(_tf["label"])
        if _nlbl in _plans_en_cours:
            continue  # déjà suivie, rien à réécrire cette semaine
        # Cette Hypothèse est NOUVELLE : elle devient la Marche courante du
        # thème, avec sa carte complète (déjà enrichie de metric/effort par la
        # boucle `_attach_metric`/`_attach_effort` plus haut) pour pouvoir la
        # réafficher fidèlement les semaines suivantes si elle est bloquée.
        lecteur.ecrire_plan_de_theme(
            _tf["label"], _hyp["key"], _hyp.get("levier"),
            today.isoformat(), dict(_hyp),
        )

    # ── « SI TU NE FAIS QUE TROIS CHOSES » N'EST PLUS DANS LE RAPPORT ────────
    #
    # C'était une sélection cross-thème rendue en tête des conseils, qui
    # pointait vers les cartes. Elle avait un sens quand douze conseils
    # sortaient : elle en désignait trois. Il y en a cinq au maximum, sur trois
    # thèmes au maximum — un renvoi vers cinq choses qui tiennent dans le même
    # écran n'aide plus, il double.
    #
    # David a déplacé l'objet, il ne l'a pas supprimé : « cela devrait être plus
    # une notification "tu as encore X recos" ; cette notification peut vivre
    # sur l'app, elle ne doit pas être rattachée à la page hebdomadaire »
    # (`.scratch/refonte/issues/11-d-ou-viennent-les-conseils.md`). Cette
    # notification est le module de commandes,
    # `.scratch/refonte/issues/12-module-de-commandes.md` — hors de cette carte.
    # Le champ `top_recos` reste LU côté web pour les payloads déjà publiés ; il
    # n'est simplement plus écrit.

    # 2) Les actions déjà lancées restent EN COURS jusqu'à être faites/vérifiées ;
    #    à l'échéance (check_at), on remesure l'indicateur → verdict.
    tracking = None
    try:
        # `"auto"` A DISPARU DE CETTE LECTURE (ticket 06 de la construction).
        # C'était le statut de l'Hypothèse posée par le worker sans clic : plus
        # rien n'en écrit, et les lignes déjà en base ne sont plus relues — leur
        # rendre un verdict aujourd'hui reviendrait à mesurer l'effet d'un geste
        # que personne n'a confirmé (`CLAUDE.md` § 7). Elles restent en base,
        # reconnaissables à `detail.origin == "auto"` : rien n'est effacé ici.
        _sa = lecteur.suivi_en_cours()
    except Exception:
        _sa = []
    # UNE NOTE N'EST PAS UNE ACTION SUIVIE. Depuis que le module « À faire » sait
    # en créer une « en cours » (ticket 11 de la construction), la lecture
    # ci-dessus en ramène : elle n'a ni indicateur ni baseline, donc aucun
    # verdict ne peut tomber dessus (`CONTEXT.md`, entrée Note) et elle n'a rien
    # à faire dans la mémoire des hypothèses d'un thème.
    #
    # Filtré ICI et pas dans la requête : un `.neq("kind", …)` échouerait sur une
    # base où la colonne n'existe pas encore, et l'`except` juste au-dessus
    # viderait alors TOUT le suivi en silence.
    _sa = [a for a in _sa if a.get("kind") != "note"]

    # ── LA NOTE ENTRE DANS LA MÉMOIRE DU THÈME, JAMAIS DANS LE REPONDÉRAGE ───
    #
    # Décidé par `.scratch/refonte/issues/08-la-memoire-du-travail.md` §3, bâti
    # par le ticket 12 de la construction. La limite est nette et tient au
    # `CLAUDE.md` §7 : la mémoire d'un thème est NARRATIVE — elle reformule, elle
    # ne calcule pas — donc y verser un fait déclaré ne fabrique aucun chiffre.
    # Repondérer un conseil sur un texte libre non mesuré, en revanche, ferait
    # peser une phrase comme un verdict : refusé. Ces lignes ne touchent donc ni
    # `running`, ni `verified`, ni `suivi_actions.verdict`, et `_DONE_W`
    # (`saas/recos_ia/reco_engine.py`) ne les voit pas.
    #
    # SEULES LES NOTES ARCHIVÉES, ET SEULES CELLES QUI PORTENT UN THÈME. Une
    # note `running` est ce qu'on COMPTE faire : elle ne se date qu'au moment où
    # on la coche (`CONTEXT.md`, entrée Note), donc elle ne raconte encore rien.
    # Une note sans thème ne peut pas nourrir la mémoire d'un thème.
    #
    # LA LECTURE EST À PART, ET C'EST VOULU : la lecture ci-dessus filtre sur
    # `status IN ('running','done')` pour les hypothèses, et l'élargir ferait
    # entrer les notes dans la boucle de verdict — celle-là même qui écrit
    # `verdict` en base.
    _notes_par_theme: dict[str, list[dict]] = {}
    _notes_labels: dict[str, str] = {}
    try:
        _notes_rows = lecteur.notes_archivees()
    except Exception:
        _notes_rows = []  # colonne `kind` absente : aucune note, aucun fait
    for _n in _notes_rows:
        _t = str(_n.get("theme") or "").strip()
        _txt = str(_n.get("title") or "").strip()
        if not _t or not _txt:
            continue
        _nk = _nrm(_t)
        _notes_labels[_nk] = _t
        _notes_par_theme.setdefault(_nk, []).append(
            {"jour": str(_n.get("decided_at"))[:10], "texte": _txt}
        )

    if _sa or _notes_par_theme:
        running, verified = [], []
        # ── LA MÉMOIRE DES THÈMES SE CONSTRUIT DANS CETTE BOUCLE ─────────────
        # (spec `.scratch/theme-memoire/spec.md`). `_sa` porte déjà tout ce
        # qu'il faut — aucune requête supplémentaire : ce qu'un thème a déjà
        # tenté, c'est ces mêmes lignes, celles qui portent un thème.
        #
        # ELLE SE NOURRIT MAINTENANT DE CE QUE LE CLIENT A FAIT, PAS DE CE QUE
        # PULSE AVAIT POSÉ (ticket 06). Le filtre était `detail.origin == "auto"`
        # — l'Hypothèse écrite à la publication, sans clic. Cette écriture est
        # morte : la mémoire garde donc les Marches que le client a réellement
        # prises et dont un verdict est tombé. C'est la même mémoire, sur une
        # matière plus sûre : ce qui n'a pas été fait ne raconte rien.
        #
        # LIMITE ASSUMÉE : une action que le client a rangée (`archived`) ou
        # abandonnée (`dropped`) n'est pas dans `_sa` — elle sort donc de la
        # mémoire. C'est cohérent (une action abandonnée n'a pas de verdict à
        # raconter), mais ce n'est pas neutre, d'où cette ligne.
        _mem_hist: dict[str, list[dict]] = {}   # thème normalisé → hypothèses mesurées
        _mem_labels: dict[str, str] = {}        # thème normalisé → son libellé réel
        _mem_nouveaux: set[str] = set()         # thèmes dont un verdict vient de tomber
        for a in _sa:
            metric = a.get("metric")
            base = a.get("baseline")
            _dec = str(a.get("decided_at"))[:10]
            # Même principe que `_sur_theme` plus bas, sur l'autre bascule :
            # voir `_BASCULE_PUB` en tête de section.
            _meme_perimetre = not (metric in _METRICS_PERIMETRE_PUB
                                   and _dec < _BASCULE_PUB)
            try:
                chk = date.fromisoformat(str(a.get("check_at"))[:10])
            except Exception:
                chk = today
            status = str(a.get("status") or "running")
            done_at = str(a.get("done_at"))[:10] if a.get("done_at") else None
            # Le compteur des 2 semaines ne tourne que sur une action FAITE —
            # `"done"`, c'est-à-dire un clic « ✓ Je l'ai fait ». Tant qu'elle est
            # `"running"` (décidée, pas encore faite), il n'y a rien à mesurer :
            # mesurer l'effet d'un geste que personne n'a posé, c'est attribuer
            # un mouvement de chiffres au hasard (`CLAUDE.md` § 7).
            due = status == "done" and today >= chk
            entry = {
                "id": a.get("id"), "title": a.get("title"), "theme": a.get("theme"),
                "reco_key": a.get("reco_key"),
                "metric_label": a.get("metric_label"),
                "status": status, "done_at": done_at,
                "decided_at": str(a.get("decided_at"))[:10],
                "check_at": str(a.get("check_at"))[:10],
            }
            _det = a.get("detail") if isinstance(a.get("detail"), dict) else {}
            _mk = _nrm(a["theme"]) if a.get("theme") else None

            # UN VERDICT SE REND UNE FOIS, ET IL NE SE REVOTE PLUS.
            #
            # UNE LIGNE FAITE RESTE `due` POUR TOUJOURS : passé son `check_at`,
            # rien ne la fait sortir de `_sa` tant que le client ne la range pas.
            # Tant que cette branche remesurait, `verdict` était RECALCULÉ contre
            # le KPI du jour puis RÉÉCRIT à chaque rapport — un `worse` d'un
            # 1er juin redevenait `better` en septembre parce que le compte avait
            # bougé, pas parce que l'hypothèse avait marché. La mémoire du thème
            # racontait alors à Gemini que le levier « argent » avait réussi, et
            # `fetch_reco_verdicts` → `_DONE_W` (`saas/recos_ia/reco_engine.py`)
            # repondérait les conseils sur ce retournement. C'est exactement le
            # mensonge que la colonne existait pour empêcher : sa migration
            # (`supabase/migrations/suivi_actions_verdict.sql`) écrit « écrite
            # UNE FOIS … au moment précis où le verdict est calculé », et c'est
            # cette ligne-ci qui l'applique. Mesuré par le ticket 17 de la
            # construction, à partir de la revue de code du ticket 01.
            #
            # CE QUE LE GARDE COÛTE, ET POURQUOI C'EST LE BON PRIX : le
            # `then/now/delta` n'est SERVI QUE LA SEMAINE DE LA CHUTE. Ensuite
            # l'écran écrit « on suit le CPC » plutôt que « CPC 1,2 → 0,9 »
            # (`Effet`, `saas/web/components/etat-action.tsx`). Ce n'est pas une
            # perte : ce `now`-là ne mesurait plus l'action, il mesurait les
            # trois mois de dérive du compte depuis. Aucune colonne ne garde la
            # valeur constatée le jour du verdict — la rendre à l'écran plus
            # tard demanderait deux colonnes, pas une constante.
            #
            # ET LA MÉMOIRE DU THÈME SE NOURRIT ICI, PAS SEULEMENT DANS LA
            # BRANCHE MESURÉE. Une hypothèse dont le verdict est déjà rendu n'a
            # besoin d'AUCUNE mesure fraîche pour faire partie du récit. Tant
            # qu'elle passait par la branche d'en dessous, elle disparaissait du
            # prompt dès que `now` valait `None` cette semaine (un `cpc` sans
            # clic, un `roas` sans revenu GA4 rattachable) ou dès que son
            # périmètre n'était plus le nôtre — et `condense_theme_memoire`
            # RÉÉCRIT `resume` en entier, ce n'est pas une fusion : le récit
            # passait de trois hypothèses à deux, définitivement.
            _verdict_fige = a.get("verdict")
            if _verdict_fige:
                entry["verdict"] = _verdict_fige
                verified.append(entry)
                if _mk:
                    _mem_labels[_mk] = a["theme"]
                    _mem_hist.setdefault(_mk, []).append({
                        "titre": a.get("title"),
                        # Écrit par `startTracking` au clic (`actions.ts`).
                        # Absent des lignes posées avant ce champ → « levier
                        # inconnu », jamais un levier déduit de l'indicateur.
                        "levier": _det.get("levier"),
                        "decided_at": entry["decided_at"],
                        "check_at": entry["check_at"],
                        "verdict": _verdict_fige,
                    })
                continue

            # LE VERDICT SE MESURE SUR LE MÊME TERRAIN QUE LA BASELINE.
            #
            # Les actions décidées AVANT la bascule ont leur baseline prise sur
            # le compte entier : les mesurer aujourd'hui sur leur thème
            # comparerait deux échelles différentes et rendrait un verdict faux
            # — puis repondérerait les conseils sur ce faux. Elles finissent
            # donc comme elles ont commencé.
            _sur_theme = bool(a.get("theme")) and _dec >= _BASCULE_THEME
            _k = _kpis_du_theme(a.get("theme")) if _sur_theme else cur_kpis
            now = _k.get(metric) if metric else None
            if due and _meme_perimetre and metric and base is not None and now is not None:
                b = float(base)
                delta = ((now - b) / b * 100) if abs(b) > 1e-9 else None
                direction = a.get("direction") or "up"
                better = delta is not None and ((delta <= -5) if direction == "down" else (delta >= 5))
                worse = delta is not None and ((delta >= 5) if direction == "down" else (delta <= -5))
                _verdict = "better" if better else ("worse" if worse else "stable")
                entry.update({
                    "then": round(b, 2), "now": round(float(now), 2),
                    "delta": round(delta, 1) if delta is not None else None,
                    "verdict": _verdict,
                })
                verified.append(entry)
                # PERSISTE LE VERDICT (TASK-025, migration `suivi_actions_verdict.sql`)
                # — sans ça, il n'existait qu'à la volée, dans CE rapport, et
                # redevenait introuvable la semaine suivante : `build_recos`
                # (`saas/recos_ia/reco_engine.py`) ne pouvait donc jamais faire
                # dépendre le poids de `done` de ce que l'action a réellement
                # donné. Écrit UNE SEULE FOIS dans la vie de la ligne : le garde
                # est ici (on n'arrive ici que la colonne vide) ET dans
                # `ecrire_verdict`, qui filtre `verdict IS NULL` côté base.
                _fige = False
                try:
                    _fige = bool(lecteur.ecrire_verdict(a.get("id"), _verdict))
                except Exception:
                    pass
                # ET LA MÉMOIRE NE SE NOURRIT QU'APRÈS, ET QUE SI L'ÉCRITURE A
                # PRIS. L'ordre n'est pas cosmétique. Une écriture peut échouer
                # sans rien dire — colonne pas encore migrée, ou refus RLS, qui
                # ne lève aucune erreur et touche zéro ligne (`CLAUDE.md` § 8).
                # La colonne reste alors vide, la ligne repasse ici au rapport
                # suivant, et son triplet est REMESURÉ contre le KPI du jour.
                # Verser ce triplet dans la mémoire sans savoir si le verdict
                # est réellement figé remettrait donc en place, dans le prompt
                # de Gemini, le chiffre qui dérive de semaine en semaine —
                # exactement ce que ce ticket retire, déplacé d'un cran. On se
                # tait plutôt que de raconter un mouvement non mérité (§ 7) :
                # la mémoire de ce thème attend que le verdict tienne.
                #
                # C'EST AUSSI LE JOUR DE LA CHUTE, ET IL N'ARRIVE QU'UNE FOIS :
                # la branche `_verdict_fige` plus haut a déjà détourné toutes
                # les lignes déjà jugées, et `_sa` a été lu avant toute écriture
                # de ce rapport. Arriver ici veut dire que la colonne était
                # vide — pas besoin d'une colonne « dernière condensation » ni
                # d'une comparaison de dates.
                if _mk and _fige:
                    _mem_labels[_mk] = a["theme"]
                    _mem_hist.setdefault(_mk, []).append({
                        "titre": a.get("title"),
                        "levier": _det.get("levier"),
                        "decided_at": entry["decided_at"],
                        "check_at": entry["check_at"],
                        "verdict": _verdict,
                        # Le triplet ne part qu'AUJOURD'HUI, avec le verdict
                        # qu'il a produit. Rattaché plus tard à la même idée, il
                        # lui attribuerait un mouvement qui ne lui appartient
                        # pas — un chiffre non mérité (`CLAUDE.md` § 7).
                        "depart": entry["then"],
                        "constate": entry["now"],
                        "variation": entry["delta"],
                        "indicateur": a.get("metric_label"),
                    })
                    _mem_nouveaux.add(_mk)
            else:
                entry["due"] = due  # échéance atteinte mais pas de chiffre auto → à juger soi-même
                # LE POINT D'ÉTAPE À SEPT JOURS.
                #
                # Le verdict tombe à quatorze jours. Attendre deux semaines pour
                # savoir qu'on part dans le mur, c'est deux semaines de budget
                # perdues : à mi-parcours, on dit ce qu'on voit — et seulement
                # ce qu'on voit.
                #
                # Trois conditions, et elles sont strictes, parce qu'un signal
                # précoce qui contredit le verdict final ruine le verdict :
                #   · l'action est FAITE depuis au moins 7 jours pleins ;
                #   · le mouvement dépasse 10 % — sous ce seuil, sept jours de
                #     données ne distinguent pas un effet d'un lundi calme ;
                #   · on ne prononce jamais « ça a marché », seulement un sens.
                #
                # L'ORIGINE DU COMPTE À REBOURS est le jour du clic « ✓ Je l'ai
                # fait » (`done_at`), jamais la publication : c'est à partir du
                # moment où le changement existe vraiment qu'il y a un effet à
                # lire. Une ligne `"done"` d'avant la migration `done_at` n'en a
                # pas — elle n'aura pas de point d'étape, plutôt qu'un point
                # d'étape compté depuis une date qui n'est pas la bonne.
                _origine = done_at if status == "done" else None
                if (
                    status == "done" and not due and _origine
                    and _meme_perimetre
                    and metric and base is not None and now is not None
                ):
                    try:
                        _fait = date.fromisoformat(_origine)
                    except ValueError:
                        _fait = None
                    if _fait and (today - _fait).days >= 7 and abs(float(base)) > 1e-9:
                        _d7 = (now - float(base)) / float(base) * 100
                        if abs(_d7) >= 10:
                            _dir = a.get("direction") or "up"
                            entry["etape"] = {
                                "jours": (today - _fait).days,
                                "delta": round(_d7, 1),
                                # « ça penche vers » — pas « ça a marché ». Le
                                # verdict reste le seul à trancher.
                                "sens": "bon" if ((_d7 <= 0) if _dir == "down" else (_d7 >= 0)) else "mauvais",
                            }
                running.append(entry)
        # `tracking` reste ABSENT du payload quand aucune action n'est suivie :
        # un thème qui n'a que des notes fait tourner la mémoire ci-dessous, il
        # ne fabrique pas un bloc de suivi vide (une absence n'est pas un zéro).
        if _sa:
            tracking = {"running": running, "verified": verified}

        # ── RÉÉCRITURE DE LA MÉMOIRE — UN APPEL PAR THÈME, ET SEULEMENT LÀ ───
        # Un appel IA par THÈME dont un verdict vient de tomber, jamais un par
        # LIGNE : deux hypothèses du même thème arrivées à échéance le même
        # jour donnent un seul appel, avec l'historique complet du thème.
        # Aucun verdict nouveau cette semaine ⇒ zéro appel IA ⇒ le `resume`
        # stocké est relu inchangé au rapport suivant.
        #
        # PLUS UN RATTRAPAGE, et il n'est pas décoratif : un verdict n'est
        # « nouveau » qu'une seule fois dans la vie d'une hypothèse (le test
        # porte sur la colonne `verdict`, écrite juste après). Sans rattrapage,
        # un seul timeout Gemini ce jour-là laissait le thème SANS AUCUNE
        # mémoire pour toujours. On repasse donc aussi sur les thèmes qui ont
        # de la matière mesurée mais rien de stocké.
        _mem_a_faire = set(_mem_nouveaux)
        for _mk in list(_mem_hist) + list(_notes_par_theme):
            if not (theme_plan_by.get(_mk) or {}).get("resume"):
                _mem_a_faire.add(_mk)
        # ON N'APPELLE L'IA QUE SI LA MÉMOIRE A UN ENDROIT OÙ SE POSER.
        #
        # Le rattrapage se disait « borné par construction : dès qu'une
        # condensation réussit, `resume` cesse d'être vide ». C'était faux dans
        # les trois cas où l'écriture ne peut JAMAIS réussir — et
        # `save_theme_resume` (`saas/commun/insert_data.py`) les nomme
        # elle-même, puisque c'est un `update` ciblé sur `(user_id, theme)` :
        #   · aucune ligne `theme_plan` pour ce thème — rien à mettre à jour ;
        #   · le client a RENOMMÉ le thème : `_mem_labels` vient de
        #     `suivi_actions`, qui garde l'ancien libellé, pendant que
        #     `theme_plan` porte le nouveau. Le `.eq("theme", …)` ne matche
        #     plus, et il ne matchera plus jamais ;
        #   · la colonne `resume` n'est pas encore migrée — `fetch_theme_plan`
        #     est alors retombé sur son `select` sans elle, donc AUCUNE ligne
        #     ne porte la clé et `.get("resume")` rend `None` pour tout le
        #     monde.
        # Dans les trois, le thème restait éligible à chaque rapport : un appel
        # Gemini par thème et par semaine, pour une écriture qui touche zéro
        # ligne. Invisible du client (l'exception est avalée), mais c'est un
        # coût IA récurrent — ticket 17 de la construction.
        #
        # DEUX CONDITIONS COUVRENT LES TROIS CAS — une ligne `theme_plan` à ce
        # nom, et la colonne `resume` réellement présente — et toutes deux se
        # lisent dans `theme_plan_by`, déjà en main : aucune requête de plus,
        # aucune colonne de plus.
        #
        # CE QUE ÇA DÉCALE, ET CE N'EST PAS UNE PERTE : `theme_plan_by` est lu
        # en tête de rapport, AVANT les `upsert_theme_plan` de celui-ci. Un
        # thème dont la toute première Stratégie s'ouvre aujourd'hui n'a donc
        # pas encore de ligne visible d'ici et attend le rapport suivant, où le
        # rattrapage le reprendra — sa ligne existera, son `resume` sera vide.
        # Une semaine de retard sur une mémoire qui n'existait pas encore, au
        # lieu d'un appel IA par semaine pour toujours.
        _memoire_ecrivable = any("resume" in (_p or {})
                                 for _p in theme_plan_by.values())
        _mem_a_faire = {_mk for _mk in _mem_a_faire
                        if _memoire_ecrivable and theme_plan_by.get(_mk)}
        # LIMITE ÉCRITE, PAS UN OUBLI : une note écrite sur un thème qui a DÉJÀ
        # une mémoire n'y entre qu'à la prochaine condensation, c'est-à-dire à la
        # chute du prochain verdict de ce thème. La cadence est événementielle
        # (voir l'en-tête de `theme_memoire.py`) et rien en base ne dit quand la
        # mémoire a été écrite pour la dernière fois — la corriger demanderait
        # une colonne, pas une constante.
        # LIMITE CONNUE, à ne pas confondre avec un bug : si l'écriture du
        # verdict ci-dessus échoue en silence (refus RLS — zéro ligne touchée,
        # aucune erreur, `CLAUDE.md` § 8 — ou colonne pas encore migrée), la
        # ligne se represente comme « nouvelle » à chaque rapport. Le coût est
        # alors d'un appel Gemini léger par thème et par semaine. C'est le
        # symptôme d'une panne qui casse DÉJÀ `fetch_reco_verdicts` et la
        # repondération des conseils : le corriger se fait là-bas, pas ici.
        # LE NOM QU'ON PASSE EST CELUI DU PLAN, PAS CELUI DU CARNET.
        #
        # Le garde juste au-dessus compare des clés NORMALISÉES (`_nrm` :
        # `strip().lower()`), alors que `save_theme_resume` écrit avec un
        # `.eq("theme", …)` — sensible à la casse et aux espaces. Un thème
        # renommé « été » → « Été » passe donc le garde (même clé) et rate
        # l'écriture (libellé différent) : un appel Gemini par semaine, pour
        # toujours, masqué par un garde qui a l'air de couvrir le cas.
        # On prend donc le libellé de la ligne `theme_plan` dont on vient de
        # prouver l'existence : c'est celui, et le seul, sur lequel l'écriture
        # retombera. Les deux replis restent pour un thème qui n'a que des
        # notes — mais le garde les a déjà écartés, ils ne servent qu'à ne pas
        # dépendre de cet ordre-là.
        for _mk in sorted(_mem_a_faire):
            try:
                lecteur.memoire_theme(
                    (theme_plan_by.get(_mk) or {}).get("theme")
                    or _mem_labels.get(_mk) or _notes_labels.get(_mk, ""),
                    _mem_hist.get(_mk),
                    _notes_par_theme.get(_mk),
                )
            except Exception:
                pass  # une panne de mémoire ne prive jamais le client du rapport

    # ── Vision + matrice compacte pour le payload ────────────────────────────
    vision = None
    if constats:
        _p_since = matrix["period"]["since"] if matrix else None
        try:
            _d = date.fromisoformat(_p_since) if _p_since else None
            period_label = (f"depuis le {_d.day} {MONTHS_FR[_d.month]}" if _d else "")
        except Exception:
            period_label = ""
        vision = {
            "generated_at": today.isoformat(),
            "period_label": period_label,
            "priorities": priority_labels,
            "constats": constats,
        }
    matrice = None
    if matrix:
        matrice = {
            "period": matrix["period"],
            "themes": matrix["themes"][:6],
            "formats": matrix["formats"][:6],
            "campaigns": matrix["campaigns"][:6],
            "slots": matrix["slots"][:3],
            "coverage": matrix["coverage"],
        }

    # LES TROIS CHIFFRES QUE L'EMAIL MET EN GROS — dépense, clics, CTR — et
    # les premiers que le client lit. Les additionner sur une semaine trouée
    # publierait un total partiel sous l'étiquette « Meta + Google » : un
    # chiffre faux, pas une approximation (ticket 20, `_aveugle_semaine`).
    _all_clicks = None if _aveugle_semaine else total_clicks + g_clicks
    _all_impr = None if _aveugle_semaine else total_impr + g_impr
    _spend_compte = None if _aveugle_semaine else round(total_spend + g_spend, 2)

    # Bloc « lecture simple » des métriques clés de la semaine (section Où on en est).
    _vues = None
    if df_week_posts is not None and not df_week_posts.empty and "views" in df_week_posts.columns:
        _vues = int(pd.to_numeric(df_week_posts["views"], errors="coerce").fillna(0).sum())
    _trafic = None
    try:
        if ga4_ctx:
            _s = ga4_ctx.get("total_sessions")
            _trafic = int(_s) if _s else None
    except Exception:
        _trafic = None
    metrics_read = {
        "trafic": _trafic,   # sessions GA4 (None tant que Google muet)
        "vues": _vues,       # vues Instagram de la semaine
        "clics": _all_clicks,
        "ctr": (round((_all_clicks / _all_impr * 100), 2)
                if _all_impr else None),
    }

    # Les memes metriques sur la fenetre PRECEDENTE : un chiffre sans repere ne
    # dit rien, le lecteur invente une conclusion. None = pas comparable, et la
    # tuile reste alors muette plutot que d'afficher une variation inventee.
    _vues_prev = None
    if df_prev_posts is not None and not df_prev_posts.empty and "views" in df_prev_posts.columns:
        _vues_prev = int(pd.to_numeric(df_prev_posts["views"], errors="coerce").fillna(0).sum())
    _trafic_prev = None
    try:
        if ga4_prev:
            _sp = ga4_prev.get("total_sessions")
            _trafic_prev = int(_sp) if _sp else None
    except Exception:
        _trafic_prev = None
    _clicks_prev = m_clicks_prev + g_clicks_prev
    _impr_prev = m_impr_prev + g_impr_prev
    metrics_prev = {
        "trafic": _trafic_prev,
        "vues": _vues_prev,
        "clics": _clicks_prev or None,
        "ctr": round((_clicks_prev / _impr_prev * 100), 2) if _impr_prev > 0 else None,
    }

    # ── Ta boussole : LE chiffre qui compte, avec son échelle ────────────────
    # Un nombre seul ne dit rien. Ce module donne les trois choses qui le
    # rendent lisible d'un coup d'oeil : sa valeur, sa trajectoire sur 10
    # semaines, et surtout la ZONE où il se situe (« tu perds » / « sain » /
    # « scalable ») — c'est la zone qui transforme un chiffre en décision.
    def _semaines(nb=10):
        out = []
        for k in range(nb):
            fin = last_full_day - timedelta(days=7 * (nb - 1 - k))
            out.append((fin - timedelta(days=6), fin))
        return out

    def _pub_semaine(d1, d2, canal=None):
        """Depense, clics et impressions d'une semaine. `canal` restreint a une
        regie — sans lui, les deux sont additionnees comme avant.

        Les deux regies vivent dans deux dataframes distincts : separer par
        plateforme ne demande donc aucune donnee de plus, seulement de ne pas
        additionner. C'est ce qui rend possible « ▣ Meta » et « ◆ Google » en
        deux rangees dans la boussole.
        """
        sp = cl = im = 0.0
        if canal in (None, "meta") and df_meta_raw is not None and not df_meta_raw.empty:
            m = df_meta_raw[(df_meta_raw["date_start"] >= pd.Timestamp(d1))
                            & (df_meta_raw["date_start"] <= pd.Timestamp(d2))]
            sp += float(m["spend"].sum()); cl += float(m["clicks"].sum()); im += float(m["impressions"].sum())
        if (canal in (None, "google") and df_google is not None
                and not df_google.empty and "date_start" in df_google.columns):
            g = df_google[(df_google["date_start"] >= pd.Timestamp(d1))
                          & (df_google["date_start"] <= pd.Timestamp(d2))]
            sp += float(g["cost_micros"].sum()) / 1_000_000.0
            cl += float(g["clicks"].sum()); im += float(g["impressions"].sum())
        return sp, cl, im

    def _insta_semaine(d1, d2):
        if df_insta is None or df_insta.empty or "date" not in df_insta.columns:
            return None, None, 0
        dt = pd.to_datetime(df_insta["date"], errors="coerce")
        w = df_insta[(dt.dt.date >= d1) & (dt.dt.date <= d2)]
        if len(w) == 0:
            return None, None, 0
        eng = float(w["eng"].mean()) if "eng" in w.columns else None
        rch = float(w["reach"].mean()) if "reach" in w.columns else None
        return eng, rch, len(w)

    # Revenu payant par semaine : UNE seule lecture GA4 pour les 10 fenêtres.
    _rev_par_sem = {}
    _sess_par_jour = {}
    try:
        for _r in (lecteur.ga4_insights() or []):
            _d = str(_r.get("date") or "")[:10]
            if not _d:
                continue
            _sess_par_jour[_d] = _sess_par_jour.get(_d, 0) + int(_r.get("sessions") or 0)
            _m = str(_r.get("medium") or "").lower()
            if any(k in _m for k in ("cpc", "ppc", "paid")):
                _rev_par_sem[_d] = _rev_par_sem.get(_d, 0.0) + float(_r.get("revenue") or 0)
    except Exception:
        _rev_par_sem, _sess_par_jour = {}, {}

    def _revenu_semaine(d1, d2):
        if not _rev_par_sem:
            return None
        tot, j = 0.0, d1
        while j <= d2:
            tot += _rev_par_sem.get(j.isoformat(), 0.0)
            j += timedelta(days=1)
        return tot

    _BANDES = {
        "roas": [(1, "tu perds", "neg"), (2, "fragile", "warn"),
                 (3, "sain", "pos"), (None, "tu peux scaler", "pos")],
        "eng": [(1, "faible", "neg"), (3, "correct", "warn"),
                (6, "bon", "pos"), (None, "excellent", "pos")],
        "ctr": [(1, "faible", "neg"), (2, "moyen", "warn"),
                (5, "bon", "pos"), (None, "excellent", "pos")],
    }

    kpi_focus = None
    metrics_series = None
    try:
        _sems = _semaines(10)
        _pts, _lab = [], []
        _cle = _unite = _titre = _repere = None
        _sens = "up"
        for (d1, _d2) in _sems:
            # Fin de semaine, pas début — même raison qu'à `_theme_series`
            # (TASK-039) : le dernier point doit porter `last_full_day`, pas
            # une date jusqu'à 6 jours plus vieille.
            _lab.append(f"{_d2.day} {MONTHS_FR[_d2.month]}")
        _rev_now = _revenu_semaine(*_sems[-1])
        if objectif == "ventes" and _rev_now is not None and _rev_now > 0:
            _cle, _titre, _unite = "roas", "ROAS", ""
            _repere = ("Sous 1 tu perds de l'argent. Entre 1 et 2, la pub s'autofinance "
                       "à peine. Au-dessus de 3, tu peux augmenter les budgets.")
            for (d1, d2) in _sems:
                sp, _, _ = _pub_semaine(d1, d2)
                rv = _revenu_semaine(d1, d2)
                _pts.append(round(rv / sp, 2) if (sp > 0 and rv is not None) else None)
        elif objectif == "engagement":
            _cle, _titre, _unite, _sens = "eng", "Engagement moyen", " %", "up"
            _repere = ("Part de ton audience touchée qui réagit. Sous 1 % le contenu "
                       "glisse ; au-dessus de 3 % il accroche vraiment.")
            for (d1, d2) in _sems:
                e, _, _ = _insta_semaine(d1, d2)
                _pts.append(round(e, 2) if e is not None else None)
        elif objectif == "notoriete":
            _cle, _titre, _unite = "reach", "Portée moyenne par post", ""
            _repere = ("Nombre de comptes touchés par publication. Ce qui compte n'est "
                       "pas le niveau absolu mais sa pente sur plusieurs semaines.")
            for (d1, d2) in _sems:
                _, r, _ = _insta_semaine(d1, d2)
                _pts.append(round(r) if r is not None else None)
        else:
            _cle, _titre, _unite = "ctr", "CTR publicitaire", " %"
            _repere = ("Part des gens qui cliquent après avoir vu ta pub. Sous 1 % le "
                       "message ne parle pas à l'audience visée.")
            for (d1, d2) in _sems:
                _, cl, im = _pub_semaine(d1, d2)
                _pts.append(round(cl / im * 100, 2) if im > 0 else None)

        # Toutes les metriques suivables, pour que le module soit pilotable :
        # on ne sait jamais mieux que l'utilisateur ce qu'il veut regarder ce
        # jour-la. Celle de son objectif reste celle ouverte par defaut.
        def _serie(f):
            return [f(d1, d2) for (d1, d2) in _sems]

        def _f_roas(d1, d2):
            sp, _, _ = _pub_semaine(d1, d2)
            rv = _revenu_semaine(d1, d2)
            return round(rv / sp, 2) if (sp > 0 and rv is not None) else None

        def _f_ctr(d1, d2):
            _, cl, im = _pub_semaine(d1, d2)
            return round(cl / im * 100, 2) if im > 0 else None

        def _f_cpc(d1, d2):
            sp, cl, _ = _pub_semaine(d1, d2)
            return round(sp / cl, 2) if cl > 0 else None

        def _f_eng(d1, d2):
            e, _, _ = _insta_semaine(d1, d2)
            return round(e, 2) if e is not None else None

        def _f_reach(d1, d2):
            _, r, _ = _insta_semaine(d1, d2)
            return round(r) if r is not None else None

        # LES QUATRE INDICATEURS DE REGIE SE DEDOUBLENT PAR PLATEFORME.
        #
        # « Meta + Google confondus » cachait exactement ce qu'on cherche : un
        # CTR global de 9,8 % peut etre 2 % chez l'un et 15 % chez l'autre, et
        # la moyenne ne dit pas laquelle des deux il faut aller regarder.
        #
        # LE ROAS, LUI, RESTE COMMUN, ET CE N'EST PAS UN OUBLI. Le revenu vient
        # de GA4 (`_revenu_semaine`), qui le donne par JOUR pour tout le compte
        # — sans dimension de regie. Un « ROAS Meta » se calculerait donc en
        # divisant le revenu de TOUT le compte par la seule depense Meta : un
        # chiffre faux, et flatteur. On ne le fabrique pas.
        def _par_canal(f, canal):
            return lambda d1, d2: f(d1, d2, canal)

        def _f_ctr_c(d1, d2, canal=None):
            _, cl, im = _pub_semaine(d1, d2, canal)
            return round(cl / im * 100, 2) if im > 0 else None

        def _f_cpc_c(d1, d2, canal=None):
            sp, cl, _ = _pub_semaine(d1, d2, canal)
            return round(sp / cl, 2) if cl > 0 else None

        def _f_spend_c(d1, d2, canal=None):
            sp, _, _ = _pub_semaine(d1, d2, canal)
            return round(sp, 2) if sp > 0 else None

        def _f_clics_c(d1, d2, canal=None):
            _, cl, _ = _pub_semaine(d1, d2, canal)
            return int(cl) if cl > 0 else None

        _PAR_REGIE = [
            ("ctr", "CTR", " %", "up", _f_ctr_c,
             "Part des gens qui cliquent apres avoir vu ta pub. Sous 1 % le message "
             "ne parle pas a l'audience visee."),
            ("cpc", "Coût par clic", " CHF", "down", _f_cpc_c,
             "Ce que te coûte une visite. Plus il baisse a volume egal, mieux ton "
             "ciblage et ta creation travaillent."),
            ("spend", "Dépense", " CHF", "up", _f_spend_c,
             "Ce que tu investis chaque semaine sur cette regie."),
            ("clics", "Clics", "", "up", _f_clics_c,
             "Clics sur tes publicites de cette regie."),
        ]
        _REGIES = [("meta", "Meta"), ("google", "Google")]

        _CANDIDATS = [
            ("roas", "ROAS", "", "up", _f_roas,
             "Ce que chaque franc de pub te rapporte, toutes régies confondues. "
             "Sous 1 tu perds de l'argent ; au-dessus de 3 tu peux augmenter les budgets."),
            ("eng", "Engagement moyen", " %", "up", _f_eng,
             "Part de ton audience touchee qui reagit. Sous 1 % le contenu glisse ; "
             "au-dessus de 3 % il accroche vraiment."),
            ("reach", "Portée moyenne par post", "", "up", _f_reach,
             "Nombre de comptes touches par publication. Ce qui compte n'est pas le "
             "niveau absolu mais sa pente sur plusieurs semaines."),
        ]

        def _ajoute_option(dest, ck, ct, cu, cd, cf, cr, bandes_de=None):
            pts = _serie(cf)
            reels = [v for v in pts if v is not None]
            if len(reels) < 2:
                return
            val = pts[-1] if pts[-1] is not None else reels[-1]
            prev = next((v for v in reversed(pts[:-1]) if v is not None), None)
            dest.append({
                "key": ck, "titre": ct, "unite": cu, "direction": cd,
                "valeur": val, "precedent": prev, "repere": cr,
                "points": pts,
                "bandes": [{"max": m, "label": l, "tone": t}
                           for (m, l, t) in _BANDES.get(bandes_de or ck, [])],
            })

        _options = []
        for (ck, ct, cu, cd, cf, cr) in _CANDIDATS:
            _ajoute_option(_options, ck, ct, cu, cd, cf, cr)

        # Une regie sans donnees ne produit aucune option : un compte qui n'a
        # que Meta n'aura donc jamais de rangee Google vide. C'est
        # `_ajoute_option` qui s'en charge — moins de deux points, on n'ecrit
        # rien. La cle porte la regie (`ctr:meta`) pour que l'affichage puisse
        # regrouper sans avoir a deviner.
        for _cid, _cnom in _REGIES:
            for (ck, ct, cu, cd, cf, cr) in _PAR_REGIE:
                _ajoute_option(_options, f"{ck}:{_cid}", f"{ct} {_cnom}", cu, cd,
                               _par_canal(cf, _cid), cr, bandes_de=ck)

        if _options:
            _def = next((o for o in _options if o["key"] == _cle), _options[0])
            # Les memes reperes ▲ que sur les frises par theme, mais TOUS
            # themes confondus. La courbe de la boussole est la premiere du
            # rapport : c'est la qu'on doit pouvoir relier « j'ai fait ca » a
            # « ca a bouge », pas trois sections plus bas.
            # La boussole regarde TOUS les themes : ses semaines sont celles de
            # `_sems` (10 semaines glissantes), pas celles de `_wk_idx`.
            _par_sem = {}
            for _dates in _markers.values():
                for _m in _dates:
                    try:
                        _dx = date.fromisoformat(str(_m["date"])[:10])
                    except Exception:
                        continue
                    for _j, (_a1, _a2) in enumerate(_sems):
                        if _a1 <= _dx <= _a2:
                            _par_sem.setdefault(_j, []).append(_m)
                            break
            _kmq = []
            for _j in sorted(_par_sem):
                _lot = sorted(_par_sem[_j], key=lambda m: m["date"])
                _kmq.append({
                    "i": _j,
                    "date": _lot[-1]["date"],
                    "titre": _lot[-1]["titre"] if len(_lot) == 1 else "",
                    "n": len(_lot),
                })
            kpi_focus = {
                "labels": _lab,
                "defaut": _def["key"],
                "options": _options,
                "markers": [r["i"] for r in _kmq],
                "marqueurs": _kmq,
            }

        # Les memes 10 semaines pour les quatre tuiles de lecture rapide.
        def _f_trafic(d1, d2):
            if not _sess_par_jour:
                return None
            tot, j = 0, d1
            while j <= d2:
                tot += _sess_par_jour.get(j.isoformat(), 0)
                j += timedelta(days=1)
            return tot or None

        def _f_vues(d1, d2):
            if df_insta is None or df_insta.empty or "views" not in df_insta.columns:
                return None
            dt = pd.to_datetime(df_insta["date"], errors="coerce")
            w = df_insta[(dt.dt.date >= d1) & (dt.dt.date <= d2)]
            if len(w) == 0:
                return None
            return int(pd.to_numeric(w["views"], errors="coerce").fillna(0).sum())

        def _f_clics(d1, d2):
            _, cl, _ = _pub_semaine(d1, d2)
            return int(cl) if cl > 0 else None

        metrics_series = {
            "labels": _lab,
            "trafic": _serie(_f_trafic),
            "vues": _serie(_f_vues),
            "clics": _serie(_f_clics),
            "ctr": _serie(_f_ctr),
        }

        # Ces trois-la rejoignent la boussole : un seul module pour tout suivre,
        # au lieu de tuiles qui repetaient la meme information a cote.
        if kpi_focus:
            _EXTRAS = [
                ("trafic", "Trafic (sessions)", "", metrics_series["trafic"],
                 "Visites sur ton site, tous canaux confondus (GA4)."),
                ("vues", "Vues Instagram", "", metrics_series["vues"],
                 "Vues de tes posts Instagram, semaine par semaine."),
                # `clics` global ne rejoint plus la boussole : il y vit
                # maintenant dedouble par regie (`clics:meta`, `clics:google`).
                # Il reste dans `metrics_series`, que d'autres modules lisent.
            ]
            for ck, ct, cu, pts, cr in _EXTRAS:
                reels = [v for v in pts if v is not None]
                if len(reels) < 2:
                    continue
                val = pts[-1] if pts[-1] is not None else reels[-1]
                prev = next((v for v in reversed(pts[:-1]) if v is not None), None)
                kpi_focus["options"].append({
                    "key": ck, "titre": ct, "unite": cu, "direction": "up",
                    "valeur": val, "precedent": prev, "repere": cr,
                    "points": pts, "bandes": [],
                })
    except Exception:
        kpi_focus = None
        metrics_series = None

    # Phrase de passage constat -> conseils. Sans elle, le lecteur voit des
    # chiffres puis une liste de conseils sans comprendre que les seconds
    # decoulent des premiers. Deterministe : le verdict est deja calcule, on
    # ne rappelle pas l'IA pour une phrase de liaison.
    themes_intro = None
    if themes_focus:
        _noms = [t["label"] for t in themes_focus[:3]]
        _sur = (_noms[0] if len(_noms) == 1
                else " et ".join([", ".join(_noms[:-1]), _noms[-1]]))
        # Au-delà de trois, on ne les nomme pas tous — une phrase de passage qui
        # énumère huit thèmes n'est plus une phrase de passage. Mais on dit
        # COMBIEN il y en a : trois noms suivis d'un point laisseraient croire
        # que le rapport s'arrête là, et cinq cartes plus bas passeraient pour
        # un bonus, pas pour la suite.
        _reste = len(themes_focus) - len(_noms)
        if _reste > 0:
            _sur += f" — et {_reste} autre{'s' if _reste > 1 else ''} plus bas"
        # Le verdict peut compter plusieurs phrases : on ne reprend que la
        # premiere, sinon la phrase de passage devient un pave.
        _tete = (verdict or "").split(".")[0].strip()
        # ELLE COMPTE LES CONSEILS, PAS LES CARTES. Une veille n'est pas un
        # levier : elle dit « attends ». Un compte sans thème prioritaire n'a
        # que des veilles, et « voilà les leviers sur A, B et C » y annoncerait
        # des conseils que la page ne contient pas — la phrase de passage
        # mentirait sur ce qu'elle relie (`CLAUDE.md` §7).
        _n_conseils = sum(1 for t in themes_focus for r in t["recos"]
                          if not _est_veille(r))
        if _n_conseils == 0:
            _corps = f"voilà où en sont {_sur}"
        else:
            _corps = ("voilà le levier" if _n_conseils == 1 else "voilà les leviers")
            _corps += f" sur {_sur}"
        themes_intro = (f"{_tete} — {_corps}." if _tete
                        else f"{_corps[0].upper()}{_corps[1:]}.")

    # ── « POUR ALLER PLUS LOIN », ET LE RETOUR QUI LE COMMANDE ───────────────
    #
    # « ◇ Trop compliqué » est à l'écran depuis le début et il était collecté
    # depuis toujours ; son consommateur — le paramètre `bloques` de
    # `_themes_tips`, avec le prompt exact déjà écrit — n'a jamais reçu
    # d'argument. Pendant ce temps `components/reco-actions.tsx` promettait par
    # écrit que ce retour « remonte dans "Pour aller plus loin" la semaine
    # suivante ». Tuyau posé, raccordé au mauvais bout, documenté comme s'il
    # coulait (`.scratch/refonte/issues/14-le-conseil-facile-et-la-degradation.md`).
    #
    # DEUX DESTINATAIRES SÉPARÉS, PAS DEUX MOTEURS. `too_hard` NE VA PAS AU
    # TRI — il va au savoir-faire : c'est le seul signal qui dise *quel*
    # savoir-faire manque. Le moteur, lui, ne fait que trier. Et le silence ne
    # dit rien du tout : deux semaines sans réponse mettent un conseil en veille,
    # elles ne le déclarent pas trop dur (`CLAUDE.md` §7 — lire une absence,
    # c'est inventer une intention).
    #
    # SUR LES THÈMES CONSEILLÉS. Un mode d'emploi pour un thème dont on ne dit
    # rien cette semaine serait du décor.
    _bloques = []
    for _row in (reco_ctx or []):
        if _row.get("reaction") != "too_hard":
            continue
        _txt = str(_row.get("title") or "").strip()
        if _txt and _txt not in _bloques:
            _bloques.append(_txt)
    try:
        themes_tips = _themes_tips(
            lecteur.redige,
            [t["label"] for t in themes_focus if t.get("conseille")],
            _obj_txt0, bloques=_bloques,
        )
    except Exception:
        themes_tips = []


    # ── Frise : ce qui TOURNAIT pendant ces semaines ─────────────────────────
    # Les chiffres disent ce que la semaine a donne. Ils ne disent pas ce qui
    # etait en l'air pour l'obtenir. Une campagne lancee le mercredi n'a eu que
    # la moitie de la semaine, et on lui compare pourtant des chiffres de
    # semaine pleine ; un creux de portee suivi de dix jours sans publication
    # n'est pas un probleme d'algorithme.
    #
    # Fenetre d'un AN. Une campagne dure 82 jours en mediane sur le compte
    # reel, et la saisonnalite — printemps, ete, fetes — ne se lit pas sur un
    # trimestre. L'affichage defile horizontalement et s'ouvre sur aujourd'hui ;
    # la semaine du rapport est marquee a part pour qu'on la retrouve sans
    # chercher.
    #
    # Aucune requete supplementaire : les jours ou une campagne a DEPENSE sont
    # deja en base, et ils donnent son debut et sa fin de diffusion reels —
    # mieux que des dates declarees, qui ne disent pas si elle a tourne.
    frise = None
    changements = []
    try:
        # De janvier de l'annee PRECEDENTE a fin decembre de l'annee EN COURS —
        # deux ans, et les deux bornes viennent des donnees reelles : des
        # campagnes ont demarre le 1er janvier 2025, que la fenetre glissante de
        # 365 jours coupait net, et d'autres sont programmees jusqu'a fin 2026,
        # ou l'on doit pouvoir aller regarder.
        #
        # La borne de gauche se resserre sur le premier evenement : sans ca, un
        # compte ouvert en mars afficherait quatorze mois de vide avant sa
        # premiere campagne. La borne de droite, elle, ne bouge pas : c'est le
        # futur, il est vide par nature. Ce qui suit la derniere donnee recoltee
        # est marque « a venir » a l'affichage — jamais presente comme mesure.
        _f_fin = date(today.year, 12, 31)
        _f_debut = date(today.year - 1, 1, 1)

        def _f_theme(nom):
            return name2label.get(_nrm(nom)) or None

        _camps = {}

        def _ajoute(nom, canal, jour, montant):
            if not nom or jour is None:
                return
            if not (_f_debut <= jour <= _f_fin):
                return
            c = _camps.setdefault((canal, str(nom)), {
                "nom": str(nom)[:60], "canal": canal, "theme": _f_theme(nom),
                "debut": jour, "fin": jour, "jours": set(), "depense": 0.0,
                # Le montant JOUR PAR JOUR. La frise n'en a pas besoin, le
                # registre des changements si : un budget doublé ne se voit
                # nulle part ailleurs — aucune API ne nous donne le budget.
                "parjour": {},
            })
            c["debut"] = min(c["debut"], jour)
            c["fin"] = max(c["fin"], jour)
            c["jours"].add(jour)
            c["depense"] += float(montant or 0)
            c["parjour"][jour] = c["parjour"].get(jour, 0.0) + float(montant or 0)

        if df_meta_raw is not None and not df_meta_raw.empty:
            _m = df_meta_raw.copy()
            _m["jourdt"] = pd.to_datetime(_m["date_start"], errors="coerce")
            for _r in _m.itertuples():
                if pd.isna(_r.jourdt) or float(getattr(_r, "spend", 0) or 0) <= 0:
                    continue
                _ajoute(getattr(_r, "campaign_name", None), "meta",
                        _r.jourdt.date(), getattr(_r, "spend", 0))

        if not df_google.empty and "campaign_name" in df_google.columns:
            _g = df_google.copy()
            _g["jourdt"] = pd.to_datetime(_g["date_start"], errors="coerce")
            for _r in _g.itertuples():
                _cost = float(getattr(_r, "cost_micros", 0) or 0) / 1_000_000.0
                if pd.isna(_r.jourdt) or _cost <= 0:
                    continue
                _ajoute(getattr(_r, "campaign_name", None), "google", _r.jourdt.date(), _cost)

        # ── Les dates DECLAREES dans la plateforme ────────────────────────
        # Elles ne se deduisent pas de la depense, d'ou la lecture separee. La
        # distinction qui compte : une ligne SANS end_date veut dire « declaree
        # sans date de fin » ; PAS de ligne du tout veut dire « on ne sait
        # pas ». Le premier cas s'affiche, le second reste muet.
        #
        # Lues une seule fois pour tout le rapport (voir `_dates_declarees`,
        # plus haut) : la veille des campagnes neuves s'appuie sur exactement
        # les memes lignes, et deux lectures de la meme table pouvaient rendre
        # deux verites differentes si une recolte passait entre les deux.
        _declare = _declare_camp

        # Une campagne DECLAREE mais qui n'a rien depense n'existe nulle part
        # dans les insights : elle n'aurait aucune barre. C'est pourtant celle
        # qu'on veut le plus voir — elle est programmee et elle arrive.
        _deja = {(c["canal"], c["nom"]) for c in _camps.values()}
        for (_canal, _nom), _d in _declare.items():
            if (_canal, _nom) in _deja or not _d["start"]:
                continue
            try:
                _dep = date.fromisoformat(str(_d["start"])[:10])
            except ValueError:
                continue
            if not (_f_debut <= _dep <= _f_fin):
                continue
            _camps[(_canal, _nom)] = {
                "nom": str(_nom)[:60], "canal": _canal, "theme": _f_theme(_nom),
                "debut": _dep, "fin": _dep, "jours": set(), "depense": 0.0,
                "parjour": {}, "planifiee": True,
            }

        _campagnes = sorted(_camps.values(), key=lambda c: -c["depense"])

        def _sortie(c):
            out = {
                "nom": c["nom"], "canal": c["canal"], "theme": c["theme"],
                "debut": c["debut"].isoformat(), "fin": c["fin"].isoformat(),
                "jours": len(c["jours"]),
                # Un trou au milieu d'une diffusion (campagne coupee puis
                # relancee) doit se voir : sinon la barre ment sur la
                # continuite.
                "continu": len(c["jours"]) == (c["fin"] - c["debut"]).days + 1,
                "depense": round(c["depense"], 2),
            }
            if c.get("planifiee"):
                out["planifiee"] = True
            _d = _declare.get((c["canal"], c["nom"]))
            if _d is not None:
                # `None` est une VALEUR ici (« sans date de fin »), pas une
                # absence : la cle est donc toujours ecrite quand la ligne
                # existe, et jamais quand elle n'existe pas.
                out["fin_prevue"] = str(_d["end"])[:10] if _d["end"] else None
            return out

        _campagnes = [_sortie(c) for c in _campagnes]

        _pubs = []
        if not df_insta.empty and "date" in df_insta.columns:
            _i = df_insta.copy()
            _i["jourdt"] = pd.to_datetime(_i["date"], errors="coerce", utc=True)
            for _r in _i.itertuples():
                if pd.isna(_r.jourdt):
                    continue
                _dj = _r.jourdt.date()
                if not (_f_debut <= _dj <= _f_fin):
                    continue
                _lbls = getattr(_r, "labels", None) or []
                _pubs.append({
                    # La plateforme est portee explicitement, meme si une seule
                    # source existe aujourd'hui : le jour ou TikTok ou LinkedIn
                    # arrivent, la frise les distingue sans changer de format de
                    # payload — et tant qu'il n'y en a qu'une, l'affichage se
                    # rabat sur le format du post, qui lui differencie vraiment.
                    "plateforme": "instagram",
                    "date": _dj.isoformat(),
                    "theme": str(_lbls[0]) if len(_lbls) else None,
                    "type": str(getattr(_r, "type", "") or ""),
                })
        _pubs.sort(key=lambda x: x["date"])

        # Jusqu'ou chaque source est REELLEMENT a jour. Sans cette limite, une
        # barre qui s'arrete au dernier jour recolte se lit « campagne
        # terminee » alors que ce sont les donnees qui s'arretent — les canaux
        # ne se rafraichissent pas tous le meme jour. C'est la regle maison :
        # aucun chiffre non mesure presente comme mesure.
        def _dernier(df, col, utc=False):
            try:
                if df is None or df.empty or col not in df.columns:
                    return None
                _d = pd.to_datetime(df[col], errors="coerce", utc=utc).max()
                return _d.date().isoformat() if pd.notna(_d) else None
            except Exception:
                return None

        _couverture = {
            "meta": _dernier(df_meta_raw, "date_start"),
            "google": _dernier(df_google, "date_start"),
            "instagram": _dernier(df_insta, "date", utc=True),
        }

        # La borne de gauche se cale sur le premier evenement reel, sans jamais
        # depasser la semaine du rapport (qui doit rester dans le cadre).
        _premiers = [c["debut"] for c in _camps.values()]
        _premiers += [date.fromisoformat(p["date"]) for p in _pubs]
        if _premiers:
            _f_debut = max(_f_debut, min(min(_premiers), cur_since))

        # ── CE QUI A BOUGÉ SUR TES PLATEFORMES ────────────────────────────
        #
        # Le fil d'actions ne voyait que ce qu'on décide DANS Pulse. Or
        # l'essentiel se fait ailleurs : une campagne lancée un mardi soir dans
        # le gestionnaire Meta, une autre coupée, un budget doublé. Sans ça, le
        # fil raconte un tiers de l'histoire — et quand la courbe bouge, rien
        # n'explique pourquoi.
        #
        # Tout ce qui suit est DÉDUIT de la dépense quotidienne, jamais d'un
        # champ d'API : aucune plateforme ne nous dit « le budget a changé le
        # 2 août ». On écrit donc ce qu'on observe (« la dépense est passée de
        # 30 à 75 CHF par jour »), pas ce qu'on suppose (« tu as doublé le
        # budget »). C'est plus prudent et c'est plus utile : c'est la dépense
        # qui compte, pas le réglage.
        _FENETRE_CHG = 60      # jours d'historique — au-delà, ce n'est plus une nouvelle
        _SAUT = 0.6            # ±60 % de dépense quotidienne pour parler d'un saut
        _chg = []
        _borne = last_full_day - timedelta(days=_FENETRE_CHG)

        def _couv_canal(canal):
            _c = _couverture.get(canal)
            try:
                return date.fromisoformat(_c) if _c else last_full_day
            except Exception:
                return last_full_day

        for _c in _camps.values():
            _canal, _nom = _c["canal"], _c["nom"]
            _base = {"canal": _canal, "campagne": _nom, "theme": _c["theme"]}

            if _c.get("planifiee"):
                # « PROGRAMMÉE » PROMET UN ÉVÉNEMENT À VENIR. Le test ne portait
                # que sur « déclarée et n'a jamais dépensé », et ce type-là
                # échappait en plus à la fenêtre de 60 jours qui borne tous les
                # autres. Résultat vu chez un client en août 2026 : vingt lignes
                # « est programmée — aucune dépense encore », dont une campagne
                # de Noël 2025 et une campagne saisonnière 2025. Elles ne sont
                # pas programmées, elles n'ont jamais tourné — et elles
                # noyaient les trois faits de la semaine.
                #
                # Deux cas, deux phrases, et le troisième ne s'écrit pas :
                #   · début À VENIR              → elle arrive, c'est une nouvelle ;
                #   · début passé, moins de 60 j → elle devait démarrer et n'a
                #     rien dépensé : ça, c'est un problème, pas une annonce ;
                #   · début passé de plus de 60 j → rien. Ce n'est plus une
                #     nouvelle, c'est un état, et un état ne se raconte pas.
                if _c["debut"] > last_full_day:
                    _chg.append(dict(_base, date=_c["debut"].isoformat(), type="planifiee"))
                elif _c["debut"] >= _borne:
                    _chg.append(dict(_base, date=_c["debut"].isoformat(), type="jamais_lancee"))
                continue

            _jours = sorted(_c["jours"])
            if not _jours:
                continue

            if _jours[0] >= _borne:
                _chg.append(dict(_base, date=_jours[0].isoformat(), type="lancee"))

            # ARRÊTÉE : plus de dépense depuis 3 jours pleins alors que le canal,
            # lui, a des données plus récentes. Sans cette seconde condition on
            # annoncerait un arrêt à chaque fois qu'un canal prend du retard.
            _fin, _couv = _jours[-1], _couv_canal(_canal)
            if _fin >= _borne and (_couv - _fin).days >= 3:
                _chg.append(dict(_base, date=_fin.isoformat(), type="arretee"))

            # REPRISE : un trou d'au moins 3 jours refermé. On ne signale que la
            # dernière — une campagne en pointillé produirait sinon dix lignes.
            _reprise = None
            for _a, _b in zip(_jours, _jours[1:]):
                if (_b - _a).days >= 4 and _b >= _borne:
                    _reprise = (_b, (_b - _a).days - 1)
            if _reprise:
                _chg.append(dict(_base, date=_reprise[0].isoformat(), type="reprise",
                                 detail=f"après {_reprise[1]} jours d'arrêt"))

            # SAUT DE DÉPENSE : la moyenne des 7 derniers jours actifs contre les
            # 7 précédents. Sept jours de chaque côté, parce qu'un seul jour se
            # laisse emporter par un week-end.
            if len(_jours) >= 10:
                _av = [_c["parjour"].get(j, 0.0) for j in _jours[-14:-7]]
                _ap = [_c["parjour"].get(j, 0.0) for j in _jours[-7:]]
                _ma = sum(_av) / len(_av) if _av else 0.0
                _mb = sum(_ap) / len(_ap) if _ap else 0.0
                if _ma > 1 and _jours[-1] >= _borne and abs(_mb - _ma) / _ma >= _SAUT:
                    _chg.append(dict(
                        _base, date=_jours[-7].isoformat(), type="depense",
                        detail=f"{_ma:.0f} → {_mb:.0f} CHF par jour",
                    ))

        _chg.sort(key=lambda x: x["date"], reverse=True)
        changements = _chg[:40]

        if _campagnes or _pubs:
            frise = {
                "debut": _f_debut.isoformat(),
                "fin": _f_fin.isoformat(),
                "semaine_debut": cur_since.isoformat(),
                "couverture": _couverture,
                "campagnes": _campagnes,
                "posts": _pubs,
            }
    except Exception:
        frise = None
        changements = []

    # ── CE QU'ON N'A PAS PU LIRE, DIT AU CLIENT (ticket 20) ──────────────────
    # Le payload porte le trou lui-même, pas seulement ses conséquences. Sans
    # cette liste, l'écran et l'email verraient des `None` sans savoir les
    # expliquer — et un « — » sans raison se lit comme un bug de Pulse, pas
    # comme une connexion à refaire. C'est la moitié qui transforme un silence
    # en geste : le client doit comprendre POURQUOI il ne voit rien, sinon on a
    # juste déplacé le silence.
    #
    # `mot` vient de `fetch_progress.mot_de_fin`, c'est-à-dire de la ligne que
    # le worker a déjà imprimée dans son journal. On ne la réécrit pas : elle
    # nomme l'exception telle qu'elle est tombée. Le NOM DE VARIABLE peut y
    # apparaître, jamais sa valeur (`CLAUDE.md` §7).
    canaux_muets_payload = [
        {
            "canal": _c,
            "nom": NOMS_CANAUX.get(_c, _c),
            "mot": _m,
            # Le dernier jour que ce canal a réellement écrit — ce qui borne le
            # trou. `None` quand il n'a jamais rien écrit.
            "depuis": (_bord_muet.get(_c).isoformat()
                       if _bord_muet.get(_c) else None),
            # `True` quand ce canal fait taire des chiffres de CETTE semaine.
            # Un canal en échec dont la dernière date couvre déjà la fenêtre
            # n'a rien creusé : il est signalé, mais il ne tait rien.
            "chiffres_tus": _c in _aveugle_semaine,
        }
        for _c, _m in sorted(pub_muette.items())
    ]

    return {
        "version": 2,
        # La liste est TOUJOURS présente, vide quand tout va bien : un écran qui
        # doit distinguer « pas de trou » de « payload d'avant le ticket 20 »
        # lirait autrement une absence comme une absence de trou.
        "canaux_muets": canaux_muets_payload,
        "changements": changements,
        "vision": vision,
        "matrice": matrice,
        "metrics_read": metrics_read,
        "metrics_prev": metrics_prev,
        "kpi_focus": kpi_focus,
        "frise": frise,
        "metrics_series": metrics_series,
        "kpis": {
            # Chiffres bruts (l'email les met en forme) — mêmes fenêtres que Pulse
            # `None` et jamais 0 quand un canal payant est muet : l'email
            # affiche alors « — » (voir `saas/emailing/render.py`), ce qu'il
            # savait déjà faire. Un 0 se lirait « tu n'as rien dépensé ».
            "spend": _spend_compte,
            "clicks": _all_clicks,
            "ctr": ((_all_clicks / _all_impr * 100) if _all_impr else None),
            "followers_delta": followers_delta,
            "followers_total": followers_current,
        },
        "week_label": week_label,
        # LA LIGNE SOUS LAQUELLE CE PAYLOAD DOIT S'ÉCRIRE — dérivée de la
        # fenêtre mesurée, jamais du jour de fabrication. C'est ce qui rend la
        # republication idempotente (voir le bloc `week_start_rapport`).
        # `publish_weekly_report` la lit ; personne d'autre n'en a besoin, mais
        # elle voyage dans le payload parce que c'est `build_payload` qui
        # connaît la fenêtre.
        "week_start": week_start_rapport.isoformat(),
        "since": cur_since.isoformat(),
        "until": last_full_day.isoformat(),
        "verdict": verdict,
        # Les ingredients du verdict, pour l'afficher en grand. Absents des
        # payloads deja publies → le front retombe sur la phrase seule.
        "verdict_pct": verdict_pct,
        "verdict_metric": verdict_metric,
        "verdict_tone": verdict_tone,
        "brief": brief,
        "suivi": {"applique": _n_done, "utile": _n_useful, "ecarte": _n_skip},
        "todo": [
            {"key": r["key"], "title": r["title"], "platform": r["platform"],
             "done": feedback.get(r["key"]) == "done"}
            for r in todos
        ],
        "recos": [
            {k: r.get(k) for k in (
                "key", "platform", "title", "observation", "pourquoi",
                "verifier", "repere", "angle_mort", "confidence", "priority", "source")}
            for r in sorted(insta_items + meta_items, key=lambda r: r["priority"])
        ],
        # Le cœur du rapport v2 : conseils regroupés PAR THÈME (cross-canal).
        "themes_focus": themes_focus,
        "themes_intro": themes_intro,
        "themes_tips": themes_tips,
        "reglages": reglages,
        "tracking": tracking,
        "themes": themes,
    }


def _display_name(sb, user_id: str, fallback_email: str | None) -> str:
    """Nom pour le « Bonjour … » : compte Instagram connecté, sinon début de l'email."""
    try:
        rows = (sb.table("connected_accounts")
                .select("account_name, instagram_business_id")
                .eq("user_id", user_id).execute().data) or []
        for r in rows:
            if r.get("instagram_business_id") and r.get("account_name"):
                return r["account_name"]
    except Exception:
        pass
    return (fallback_email or "").split("@")[0] or "toi"


def publish_weekly_report(sb, user_id: str, email_to: str | None = None) -> str:
    """Construit + publie le rapport d'un utilisateur ; envoie l'email si email_to.

    L'email lit le MÊME payload que Pulse (une seule source de vérité).
    Sans RESEND_API_KEY, send_email passe en dry-run → aucun envoi, juste un log.
    """
    payload = build_payload(LecteurSupabase(sb, user_id, _call_gemini))
    if payload is None:
        return "rapport: pas de données"
    # LA SEMAINE VIENT DU PAYLOAD, donc de la FENÊTRE MESURÉE : republier ne
    # doit jamais créer une deuxième ligne pour les mêmes chiffres (la clé est
    # `(user_id, week_start)`). Le repli sur le lundi d'aujourd'hui ne sert que
    # si `build_payload` n'a pas posé la clé — il la pose toujours depuis le
    # ticket 13 de la construction ; garder le repli évite qu'un payload forgé
    # par un test fasse tomber la publication.
    week_start = (payload.get("week_start")
                  or (date.today() - timedelta(days=date.today().weekday())).isoformat())
    upsert_weekly_report(sb, user_id, week_start, payload)
    log = f"rapport publié ({len(payload['recos'])} conseils)"

    if email_to:
        import os
        from emailing.render import email_from_payload
        from emailing.send import send_email
        app_url = os.getenv("EMAIL_APP_URL", "https://dashboard-analytic-green.vercel.app")
        subject, html = email_from_payload(_display_name(sb, user_id, email_to), payload, app_url)
        res = send_email(to=email_to, subject=subject, html=html)
        log += (f" · email {res['provider']}: "
                f"{'envoyé' if res['ok'] and res['provider'] != 'dry' else res['detail']}")
    return log


def _service_client():
    import os
    from supabase import create_client
    url = os.getenv("SUPABASE_URL") or secret("supabase.url")
    key = os.getenv("SUPABASE_SERVICE_KEY") or secret("supabase.service_role")
    if not url or not key:
        raise SystemExit("SUPABASE_URL / SUPABASE_SERVICE_KEY manquants (env ou secrets.toml)")
    return create_client(url, key)


if __name__ == "__main__":
    args = sys.argv[1:]
    sb = _service_client()
    if "--all" in args:
        profiles = (sb.table("profiles").select("id").execute().data) or []
        for p in profiles:
            print(f"{p['id']} → {publish_weekly_report(sb, p['id'])}")
    elif "--user" in args:
        uid = args[args.index("--user") + 1]
        if "--print" in args:
            payload = build_payload(LecteurSupabase(sb, uid, _call_gemini))
            print(json.dumps(payload, ensure_ascii=False, indent=2, default=str))
        else:
            print(publish_weekly_report(sb, uid))
    else:
        print(__doc__)
