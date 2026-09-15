"""Moteur de recommandations hebdo — couche 1 : FAITS (déterministe, zéro IA).

Philosophie : un GUIDE, pas un ordre. Chaque reco porte 4 choses :
  • observation  — ce que je vois (le fait + le chiffre)
  • pourquoi     — pourquoi ça peut arriver (hypothèses, jamais une certitude)
  • verifier     — comment vérifier AVANT d'agir
  • angle_mort   — ce que je ne vois PAS (le garde-fou honnête)

+ un niveau de confiance (solide / creuser / piste) qui dépend de :
  - la taille de l'échantillon (assez de données ?)
  - la complétude de la vue (a-t-on les conversions via GA4, ou juste le coût ?)
  - la franchise du signal (extrême ou limite ?)

Les recos pub sont PLAFONNÉES à "creuser" tant que GA4 n'est pas connecté :
on voit le coût, pas le retour → on ne peut pas dire "coupe" avec certitude.
Quand GA4 est branché (param `ga4`), elles peuvent passer "solide".

Une reco = dict (voir _reco()). build_recos() évalue toutes les règles,
trie par priorité (1 = plus important) et retourne la liste.
Si une règle plante, elle est ignorée — le rapport ne casse jamais.
"""

import pandas as pd

DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
HOURS = ["0-7h", "7-10h", "10-13h", "13-16h", "16-19h", "19-24h"]
FORMAT_LABELS = {"VIDEO": "Reel", "REEL": "Reel", "CAROUSEL_ALBUM": "Carrousel", "IMAGE": "Image"}

# Icône source — même langage visuel que la sidebar (◎ Instagram, ▣ Meta, ◆ Google)
# "pub" = cross-canal Meta + Google (ex. la reco ROAS, qui somme toute la pub)
PLATFORM_ICON = {"instagram": "◎", "meta": "▣", "google": "◆", "pub": "▣", "ia": "◇"}

# Jauge de confiance — cercle plein / demi / vide (géométrique, monochrome)
CONFIDENCE = {
    "solide":  {"symbol": "●", "label": "Solide"},
    "creuser": {"symbol": "◐", "label": "À creuser"},
    "piste":   {"symbol": "○", "label": "Piste"},
}

# Libellés lisibles par type de conseil (pour résumer le feedback à l'IA / l'UI)
KEY_LABELS = {
    "gaspillage": "coût des campagnes",
    "scaler": "amplifier une campagne qui marche",
    "roas": "retour sur dépense pub (ROAS/CPA)",
    "funnel": "où le funnel de vente casse",
    "ga4_muet": "données GA4 manquantes",
    "connecter_ga4": "connecter Google Analytics",
    "silence": "reprendre la cadence de publication",
    "page_endormie": "réveiller la portée de la page",
    "ai": "suggestion IA",
    # Les quatre règles payantes (`regles_payantes.py`). Ces libellés sont lus
    # par l'humain ET par Gemini (« déjà traité récemment », « jugé non
    # pertinent ») : ils disent le SUJET du conseil, jamais son geste — un
    # client qui a refusé « l'annonce qui coûte cher » n'a pas refusé de couper.
    "annonce_sans_conversion": "une annonce qui dépense sans convertir",
    "annonce_locomotive": "amplifier l'annonce qui accroche le mieux",
    "annonce_chere": "le prix du clic d'une annonce",
    "theme_hors_budget": "le budget d'un thème qui va être dépassé",
    # Les six règles payantes restantes (ticket 10). Même consigne : le SUJET,
    # jamais le geste — un client qui a refusé « l'usure d'une annonce » n'a pas
    # refusé de créer.
    "adset_inegal": "l'écart de coût entre deux Groupes d'annonces",
    "theme_deux_regies": "la répartition d'un thème entre Meta et Google",
    "budget_non_depense": "un budget posé que la campagne ne dépense pas",
    "annonce_usee": "l'usure d'une annonce à force d'être revue",
    "page_arrivee_muette": "les clics payés que Google Analytics ne voit pas",
    "creneau_pub": "le jour de la semaine où la pub coûte le plus cher",
}

SEUILS = {
    "cpc_ratio": 2.0,             # CPC > 2× le repère des voisins = signal de coût
    "cpc_spend_min": 50.0,        # ...seulement si ≥ 50 CHF dépensés sur la semaine
    "roas_spend_min": 50.0,       # ROAS calculé seulement si ≥ 50 CHF dépensés (sinon bruit)
    "roas_bon": 3.0,              # ROAS ≥ 3 = rentable avec marge → scaler
    "roas_fragile": 1.0,          # 1 ≤ ROAS < 3 = rentable mais fragile ; < 1 = alerte
    "funnel_carts_min": 5,        # ≥ 5 paniers sans achat = signal checkout
    "funnel_views_min": 50,       # ≥ 50 vues produit pour juger le taux panier
    "funnel_cart_rate_min": 0.03, # < 3 % vues→panier = fiche produit à revoir
    "ctr_ratio": 1.5,             # CTR > 1.5× ta moyenne = candidat à amplifier
    "ctr_impressions_min": 1000,  # plancher d'impressions (évite le bruit)
    "reach_rate_min": 10.0,       # portée/abonné < 10 % = page qui s'endort
    "slot_cell_min": 3,           # ≥ 3 posts dans la case gagnante (cohérent heatmap)
    "slot_total_min": 20,         # ≥ 20 posts au total (cohérent heatmap)

    # ── LES SEUILS DES SIX RÈGLES PAYANTES RESTANTES ────────────────────────
    #
    # POURQUOI CE BLOC EXISTE ALORS QUE LE TICKET 07 N'EN A AJOUTÉ AUCUN.
    # `.scratch/refonte/issues/24-conseils-payants-manquants.md` a livré quatre
    # règles d'abord précisément parce qu'elles n'avaient besoin d'aucun nombre
    # neuf ; les six restantes en demandent, et c'est ce qui les a reportées.
    # Chacun de ceux-ci porte donc sa SOURCE, et aucun ne sort d'une mémoire.
    #
    # CE QU'IL FAUT SAVOIR AVANT DE S'APPUYER DESSUS : aucune règle payante n'a
    # jamais tourné sur un vrai compte (ticket 16, le seam du payload, n'est pas
    # ouvert). Ces quatre nombres sont donc des points de départ argumentés, pas
    # des valeurs calibrées — les changer est une ligne, et le jour où un vrai
    # compte parlera, c'est ici qu'on viendra.
    #
    # LES QUATRE COMPARAISONS DE COÛT DES SIX RÈGLES N'AJOUTENT RIEN : elles
    # réutilisent `cpc_ratio` ci-dessus. « 2× » est l'écart que David a accepté
    # comme « ce n'est plus du bruit » sur de l'argent, et c'est exactement ce
    # qu'un Groupe d'annonces, un jour de semaine ou un budget posé comparent.
    # Les « 3× » et « 2× » des exemples de 24 décrivent CE QUE LE CLIENT LIT,
    # pas le seuil qui déclenche.

    # Fréquence hebdomadaire à partir de laquelle une créa Meta décroche. C'est
    # la convention du métier (Meta prospection : la performance baisse au-delà
    # de ~2,5 vues par personne et par semaine, et s'effondre au-delà de 4).
    # À SAVOIR, et c'est la recherche elle-même qui le dit : l'origine de ce 2,5
    # ne se retrouve dans aucune étude ni aucune documentation de plateforme —
    # c'est une convention d'agences répétée jusqu'à faire règle. On s'en sert
    # parce qu'il n'y a pas mieux, et parce que la règle qui le lit ne compare
    # PAS une fréquence exacte mais un PLANCHER de fréquence (voir
    # `regle_annonce_usee`) : elle se tait donc plus souvent que ce seuil ne le
    # voudrait, jamais plus.
    "freq_plancher": 2.5,
    # ...et le prix du clic qui monte AVEC elle, d'une semaine sur l'autre. La
    # fatigue publicitaire est mesurée à ~+20 % de CPC ; sans cette seconde
    # condition, une fréquence haute sur une audience volontairement étroite
    # (du retargeting) se ferait dénoncer alors qu'elle marche.
    "freq_cpc_hausse": 1.2,

    # L'écart entre les clics qu'une régie facture et les sessions que GA4
    # compte. Google documente 10 à 20 % comme normal (bouton retour, double
    # clic, bloqueurs, page quittée avant chargement) et « au-dessus de 30 % »
    # comme le signe d'un problème technique. On parle à 50 % — deux fois plus
    # prudent — parce que la règle additionne Meta ET Google : un clic Meta perd
    # plus de monde qu'un clic Google (navigateur intégré, App Tracking
    # Transparency), et un seuil de 30 % ferait parler cette règle toutes les
    # semaines sur un compte parfaitement taggé.
    "arrivee_perte_max": 0.5,

    # Un jour de la semaine ne se juge pas sur une seule occurrence. Quatre, sur
    # la fenêtre de 28 jours qui sert déjà de « norme » à un thème
    # (`_CALME_REF`, build_report.py) : c'est le plus grand nombre que cette
    # fenêtre permette, et en dessous on compare un dimanche à un autre dimanche.
    "creneau_jours_min": 4,

    # L'écart de retour entre les deux régies à partir duquel un thème mérite
    # qu'on teste un transfert. 4×, et pas le 2× des comparaisons de coût : le
    # revenu GA4 est attribué au DERNIER clic, ce qui déplace mécaniquement du
    # revenu de Meta vers Google (une campagne Meta de prospection qui déclenche
    # une recherche de marque est comptée pour Google). Un écart de 2× entre les
    # deux régies peut n'être que ce biais ; le 4× est le nombre que
    # `.scratch/refonte/issues/24-conseils-payants-manquants.md` a écrit pour
    # cette règle, et il laisse au biais la place qu'il prend.
    "regie_roas_ratio": 4.0,
}


def _reco(key, platform, title, observation, pourquoi, verifier, angle_mort,
          confidence, priority, repere="", nature=None, role=None):
    """`nature` (le Geste) et `role` (la Preuve) — les deux colonnes qu'une
    règle déclare ELLE-MÊME quand elles dépendent du chiffre du jour.

    Une même clé peut écrire plusieurs gestes : `roas` dit « augmente » au-dessus
    de 3 et « coupe » en dessous de 1. Le geste est donc une propriété de la
    BRANCHE, pas de la clé. Découper `roas` en trois clés était l'autre option,
    refusée : la clé est ce qui porte l'historique des retours du client
    (`reco_feedback`), la découper efface cet historique
    (`.scratch/refonte/issues/22-rebrancher-le-plan-de-theme.md`, décision 3).

    Laissés à `None` par les règles dont le geste ne varie pas : c'est alors la
    table `_GESTE_REGLE` (`saas/traitement/build_report.py`) qui les pose, au
    même endroit que le levier et la durée. Jamais deviné après coup : une règle
    qui ne sait pas déclarer son geste n'est pas un conseil, c'est un constat, et
    elle n'est jamais servie.
    """
    return {
        "key": key,            # clé stable du type de conseil (persiste le feedback)
        "platform": platform,
        "title": title,
        "observation": observation,
        "pourquoi": pourquoi,
        "verifier": verifier,
        "repere": repere,      # 💡 cible/seuil concret à viser (rule of thumb)
        "angle_mort": angle_mort,
        "confidence": confidence,
        "source": "rule",
        "priority": priority,
        "nature": nature,
        "role": role,
    }


# ── Objectifs (re-pondèrent les recos) ────────────────────────────────────────
# Un conseil pertinent pour l'objectif du client remonte (priorité abaissée).
OBJECTIFS = {
    "ventes": {
        "label": "Plus de ventes / contacts",
        "boost_platforms": {"meta", "google", "pub"},
        "boost_keys": {"gaspillage", "scaler", "roas", "funnel", "connecter_ga4"},
    },
    "notoriete": {
        "label": "Plus de notoriété / portée",
        "boost_platforms": {"instagram"},
        "boost_keys": {"silence", "page_endormie"},
    },
    "engagement": {
        "label": "Plus d'engagement",
        "boost_platforms": {"instagram"},
        # SANS CLÉ DEPUIS LA MORT DE `format_gagnant` ET `creneau` : c'étaient
        # les deux seules, et l'objectif tient encore par sa plateforme
        # (`instagram`). Leurs remplaçantes à l'échelle du thème (`orga_format`,
        # `orga_reaction`) ne passent PAS par cette table — elles sont ajoutées
        # après `build_recos` dans `build_report.py`, donc y écrire leur nom
        # n'aurait aucun effet et promettrait une pondération qui n'existe pas.
        "boost_keys": set(),
    },
}


# ── Règles Meta Ads ──────────────────────────────────────────────────────────
# Sans GA4, on voit le COÛT mais pas les VENTES → jamais mieux que "creuser".

def _rule_gaspillage(df_camp, ga4):
    """CPC d'une campagne nettement > médiane ET dépense réelle. Guide, pas ordre."""
    if df_camp is None or df_camp.empty or "cpc" not in df_camp.columns:
        return None
    actives = df_camp[df_camp["cpc"] > 0]
    if len(actives) < 2:
        return None  # 1 seule campagne = pas de médiane comparable
    median_cpc = actives["cpc"].median()
    if median_cpc <= 0:
        return None
    worst = actives.loc[actives["cpc"].idxmax()]
    if not (worst["cpc"] >= median_cpc * SEUILS["cpc_ratio"] and worst["spend"] >= SEUILS["cpc_spend_min"]):
        return None

    name = str(worst["campaign_name"])[:40]
    obs = (
        f"« {name} » a un coût par clic de {worst['cpc']:.2f} CHF, "
        f"soit {worst['cpc'] / median_cpc:.1f}× ta médiane ({median_cpc:.2f} CHF), "
        f"pour {worst['spend']:.0f} CHF dépensés cette semaine."
    )
    pourquoi = (
        "Un clic cher vient souvent d'une audience trop large, d'un visuel qui "
        "fatigue, ou d'une campagne récente encore en phase d'apprentissage."
    )

    if ga4 and ga4.get("connected"):
        conv = ga4.get("paid_conversions")
        rev = ga4.get("paid_revenue")
        if conv is not None and conv == 0:
            # Preuve : coût élevé ET zéro conversion → conseil ferme mais motivé
            return _reco(
                "gaspillage", "meta",
                f"« {name} » coûte cher et ne convertit pas",
                obs + " GA4 ne lui attribue aucune vente/contact sur la période.",
                pourquoi,
                "Mets-la en pause 3-4 jours et compare : si ton chiffre d'affaires "
                "ne bouge pas, tu peux la couper sereinement. Sinon, c'est qu'elle "
                "contribuait indirectement — relance-la avec une autre audience.",
                "GA4 attribue selon le dernier canal : une pub vue puis achetée plus "
                "tard via Google peut être sous-comptée.",
                "solide", 1,
                repere="Un repère simple : une campagne qui dépasse ton budget mensuel "
                       "moyen sans aucune conversion sur 7 jours mérite d'être arrêtée ou refaite.",
                # « Mets-la en pause » : le geste est d'arrêter, et la pause se
                # voit demain à l'œil dans le gestionnaire de publicités.
                nature="couper", role="generale",
            )
        if conv is not None and conv > 0:
            # Elle convertit malgré un clic cher → on nuance, on ne diabolise pas
            rev_note = (f" pour {rev:,.0f} CHF de revenu attribué" if rev else "")
            return _reco(
                "gaspillage", "meta",
                f"« {name} » coûte cher mais convertit",
                obs + f" GA4 lui attribue {conv:.0f} conversion(s){rev_note}.",
                "Un CPC élevé n'est pas un problème en soi tant que ce que ça rapporte "
                "dépasse ce que ça coûte.",
                "Compare son revenu attribué à sa dépense : si le retour est positif, "
                "garde-la. Sinon, teste une audience plus serrée pour baisser le coût.",
                "GA4 attribue au dernier canal — le revenu réel de cette campagne peut "
                "être un peu plus élevé que ce que je vois ici.",
                "creuser", 2,
                repere="Le repère clé, c'est le ROAS : vise au moins 2-3 CHF de revenu "
                       "pour 1 CHF dépensé. En dessous de 1, la campagne te coûte de l'argent.",
                # Elle convertit : on ne coupe pas, on essaie une audience plus
                # serrée. Le geste est un test, et l'audience posée se constate.
                nature="tester", role="generale",
            )

    # Sans preuve de conversion → on guide, on ne tranche pas
    return _reco(
        "gaspillage", "meta",
        f"« {name} » coûte plus que tes autres campagnes",
        obs,
        pourquoi,
        "Avant tout : regarde si elle t'amène des ventes ou des contacts. Un clic "
        "cher qui convertit reste rentable. Si après 50+ clics tu ne vois rien venir, "
        "teste une nouvelle audience plutôt que de couper d'un coup.",
        "Je vois le coût, pas tes ventes. Connecte Google Analytics pour que je juge "
        "le vrai retour, pas seulement le prix du clic.",
        "creuser", 1,
        repere="Le repère : laisse-lui au moins 50 clics avant de juger. En dessous, "
               "l'écart de CPC est souvent juste du hasard, pas un vrai problème.",
        # Sans GA4 on ne sait pas si elle vend : le conseil refuse explicitement
        # de couper d'un coup et demande une nouvelle audience — donc un test.
        nature="tester", role="generale",
    )


def _rule_scaler(df_camp, avg_ctr, ga4):
    """CTR nettement > moyenne (avec assez d'impressions) → candidat à amplifier."""
    if df_camp is None or df_camp.empty or "ctr" not in df_camp.columns or avg_ctr <= 0:
        return None
    eligibles = df_camp[df_camp["impressions"] >= SEUILS["ctr_impressions_min"]]
    if eligibles.empty:
        return None
    best = eligibles.loc[eligibles["ctr"].idxmax()]
    if best["ctr"] < avg_ctr * SEUILS["ctr_ratio"]:
        return None

    name = str(best["campaign_name"])[:40]
    obs = (
        f"« {name} » a un CTR de {best['ctr']:.2f} % contre {avg_ctr:.2f} % de "
        f"moyenne sur ton compte ({int(best['impressions']):,} impressions)."
    )
    # "solide" seulement si GA4 est connecté ET a des données sur la fenêtre —
    # connecté-mais-muet ne prouve rien (voir _rule_ga4_muet).
    conf = ("solide" if (ga4 and ga4.get("connected") and ga4.get("paid_revenue") is not None)
            else "creuser")
    return _reco(
        "scaler", "meta",
        f"« {name} » accroche mieux que les autres",
        obs,
        "Un bon CTR veut dire que le message parle à l'audience. C'est souvent le "
        "bon moment pour lui donner plus de budget — mais doucement.",
        "Monte son budget de +20 % maximum, puis attends 3 jours. Si le CTR tient "
        "et que le coût par clic ne s'envole pas, recommence. Un saut trop brutal "
        "fait souvent repartir la campagne en apprentissage et casse la perf.",
        ("" if conf == "solide" else
         "Je vois l'accroche (le clic), pas ce qui se passe après. GA4 te dirait si "
         "ces clics se transforment vraiment en clients."),
        conf, 2,
        repere="Le repère pour scaler sans casser : +20 % de budget max par palier, "
               "tous les 3-4 jours. Au-delà, Meta refait son apprentissage et la perf chute.",
        # Geste unique et invariable — il pourrait vivre dans `_GESTE_REGLE`,
        # mais la règle voisine (`_rule_gaspillage`) déclare déjà les siens :
        # les deux se lisent mieux côte à côte qu'à deux fichiers d'écart.
        nature="augmenter", role="generale",
    )


def _rule_roas(df_camp, ga4):
    """LA reco forte que GA4 débloque : relier la dépense pub au revenu réel.

    ROAS = revenu attribué au trafic payant / dépense pub TOTALE (Meta + Google :
    les producteurs fusionnent les campagnes Google dans df_camp avant l'appel).
    Sans GA4 → None (c'est _rule_connecter_ga4 qui prend le relais).
    """
    if not (ga4 and ga4.get("connected")):
        return None
    if df_camp is None or df_camp.empty or "spend" not in df_camp.columns:
        return None
    spend = float(df_camp["spend"].sum())
    if spend < SEUILS["roas_spend_min"]:
        return None  # pas assez de dépense pour que le ratio veuille dire quelque chose

    rev = ga4.get("paid_revenue")
    conv = ga4.get("paid_conversions")
    if rev is None:  # GA4 connecté mais fenêtre vide → géré par _rule_ga4_muet
        return None

    angle = (
        "GA4 attribue au dernier canal : une vente influencée par ta pub mais "
        "conclue via un autre chemin (recherche directe, e-mail) est comptée "
        "ailleurs. Le vrai retour est donc un peu au-dessus de ce chiffre. "
        "Dépense vue : Meta + Google Ads."
    )

    if rev and rev > 0:
        roas = rev / spend
        obs = (
            f"Cette semaine : {spend:,.0f} CHF de pub (Meta + Google) → {rev:,.0f} CHF "
            f"de revenu attribué au trafic payant, soit un ROAS de {roas:.1f}."
        )
        # Attribution par campagne (utm_campaign) : on nomme la locomotive…
        by_camp = ga4.get("by_campaign") or {}
        if by_camp:
            top_name, top = max(by_camp.items(), key=lambda kv: kv[1].get("revenue", 0))
            if top.get("revenue", 0) > 0:
                obs += (f" Meilleure campagne (GA4) : « {top_name[:40]} » — "
                        f"{top['revenue']:,.0f} CHF attribués.")
        # …ET la pire : le plus gros dépensier sans AUCUNE vente attribuée.
        try:
            def _norm(s):
                return str(s or "").strip().lower()
            _rev_names = {_norm(n) for n, d in by_camp.items()
                          if float((d or {}).get("revenue") or 0) > 0}
            _no_rev = df_camp[~df_camp["campaign_name"].map(lambda n: _norm(n) in _rev_names)]
            if not _no_rev.empty:
                _w = _no_rev.loc[_no_rev["spend"].idxmax()]
                _w_spend = float(_w["spend"])
                if _w_spend >= max(50.0, 0.1 * spend):
                    obs += (f" À l'inverse, « {str(_w['campaign_name'])[:40]} » a dépensé "
                            f"{_w_spend:,.0f} CHF sans aucune vente attribuée — "
                            f"c'est elle qui plombe le ratio.")
        except Exception:
            pass
        if roas >= SEUILS["roas_bon"]:
            return _reco(
                "roas", "pub",
                f"Tes pubs rapportent {roas:.1f}× leur coût",
                obs,
                "Au-dessus de 3, ta machine publicitaire est rentable avec de la marge — "
                "c'est le moment classique pour augmenter progressivement.",
                "Identifie la campagne au meilleur CTR et monte SON budget de +20 % "
                "(pas tout le compte d'un coup), puis revérifie le ROAS dans une semaine.",
                angle, "solide", 1,
                repere="Repère ROAS : < 1 tu perds, 1-2 fragile (pense aux marges), "
                       "2-3 sain, > 3 tu peux scaler.",
                # Au-dessus de 3 : « monte SON budget de +20 % ». Le budget monté
                # se constate demain, il ne se mesure pas dans quatorze jours.
                nature="augmenter", role="generale",
            )
        if roas >= SEUILS["roas_fragile"]:
            return _reco(
                "roas", "pub",
                f"Tes pubs tournent à {roas:.1f}× — rentable mais sans marge",
                obs,
                "Entre 1 et 2, la pub s'autofinance à peine : dès que tu retires tes "
                "coûts produit/livraison, la marge peut être négative.",
                "Calcule ta marge réelle par vente. Si elle est sous 50 %, un ROAS de "
                f"{roas:.1f} te fait perdre de l'argent — coupe la campagne au CPC le "
                "plus cher et regarde si le ROAS global remonte.",
                angle, "solide", 1,
                repere="Repère : ROAS minimum viable ≈ 1 / ta marge. Marge 50 % → il "
                       "te faut au moins un ROAS de 2.",
                # Entre 1 et 2 : « coupe la campagne au CPC le plus cher ».
                nature="couper", role="generale",
            )
        return _reco(
            "roas", "pub",
            f"Alerte : {spend:,.0f} CHF dépensés pour {rev:,.0f} CHF de revenu (ROAS {roas:.1f})",
            obs,
            "Sous 1, chaque franc de pub rapporte moins d'un franc : la dépense ne "
            "se justifie que si tu achètes de la notoriété en connaissance de cause.",
            "Coupe ou réduis la campagne la plus chère au clic, garde la meilleure "
            "accroche, et revérifie dans 7 jours. Si le ROAS ne remonte pas au-dessus "
            "de 1, c'est l'offre ou la page d'atterrissage qu'il faut retravailler, "
            "pas le ciblage.",
            angle, "solide", 1,
            repere="Repère : sous ROAS 1 pendant 2 semaines consécutives → stop et "
                   "retravaille l'offre avant de remettre du budget.",
            # Sous 1 : « coupe ou réduis la campagne la plus chère au clic ».
            nature="couper", role="generale",
        )

    # Pas de revenu suivi, mais des conversions (lead gen / tracking sans valeur)
    if conv and conv > 0:
        cpa = spend / conv
        return _reco(
            "roas", "pub",
            f"Tes conversions te coûtent {cpa:,.0f} CHF pièce",
            f"Cette semaine : {spend:,.0f} CHF de pub → {conv:.0f} conversions "
            f"attribuées au trafic payant, soit {cpa:,.0f} CHF par conversion (CPA).",
            "GA4 remonte tes conversions mais pas leur valeur en CHF — je peux juger "
            "le coût par contact, pas encore la rentabilité.",
            "Compare ce CPA à ce que vaut un client pour toi. Et si tes conversions "
            "ont une valeur (vente, devis moyen), configure-la dans GA4 "
            "(Admin → Événements clés → valeur) : mes conseils passeront au ROAS.",
            "Une « conversion » GA4 peut être un simple formulaire — vérifie que "
            "l'événement clé mesuré est bien celui qui compte pour ton business.",
            "creuser", 2,
            repere="Repère : ton CPA doit rester sous 1/3 de la valeur d'un client "
                   "pour financer le reste du funnel.",
            # Sans revenu suivi : « configure la valeur dans GA4 ». Ce n'est pas
            # une vérification, c'est un réglage manquant à poser — donc corriger.
            nature="corriger", role="generale",
        )

    # GA4 OK, dépense réelle, zéro conversion payante → signal fort
    return _reco(
        "roas", "pub",
        f"{spend:,.0f} CHF de pub, zéro conversion attribuée",
        f"Sur la semaine, GA4 n'attribue aucune conversion au trafic payant "
        f"malgré {spend:,.0f} CHF dépensés.",
        "Trois causes classiques : la page d'atterrissage ne convertit pas, le "
        "tracking des événements clés est cassé, ou l'audience est trop froide.",
        "D'abord vérifie le tracking : fais toi-même une conversion test et regarde "
        "si elle apparaît dans GA4 (Temps réel). Si le tracking est bon, le problème "
        "est l'offre ou la page — pas la pub.",
        "Si tes ventes se font hors ligne ou sur un autre domaine, GA4 ne les voit "
        "pas : ce zéro peut être un angle mort de mesure, pas un vrai zéro.",
        "solide", 1,
        repere="Repère : après ~100 clics payants sans aucune conversion, le problème "
               "est en aval de la pub (page, offre, tracking).",
        # Le conseil demande de réparer : le tracking s'il est cassé, l'offre ou
        # la page s'il est bon. Pas de sixième geste « vérifier » — la
        # vérification est le premier pas de la correction, pas un geste à part
        # (`.scratch/refonte/issues/22-rebrancher-le-plan-de-theme.md`, décision 4).
        nature="corriger", role="generale",
    )


def _rule_funnel(ga4):
    """Funnel e-commerce GA4 (view_item → add_to_cart → begin_checkout → purchase) :
    dit OÙ ça casse — la pub n'est pas toujours la coupable."""
    if not (ga4 and ga4.get("connected")):
        return None
    funnel = ga4.get("funnel") or {}
    views = int(funnel.get("view_item", 0))
    carts = int(funnel.get("add_to_cart", 0))
    checkouts = int(funnel.get("begin_checkout", 0))
    purchases = int(funnel.get("purchase", 0))
    if not any((views, carts, checkouts, purchases)):
        return None  # pas de tracking e-commerce → rien à dire (lead gen, etc.)

    fun_txt = (f"Funnel de la semaine : {views} vues produit → {carts} paniers → "
               f"{checkouts} checkouts → {purchases} achats.")

    # Cas 1 : des paniers mais zéro achat → le problème est au paiement, pas à la pub
    if carts >= SEUILS["funnel_carts_min"] and purchases == 0:
        return _reco(
            "funnel", "google",
            f"{carts} paniers cette semaine, zéro achat",
            fun_txt,
            "Quand les gens ajoutent au panier mais n'achètent jamais, le blocage est "
            "au checkout : frais de livraison surprise, moyen de paiement manquant "
            "(Twint ?), bug mobile, ou création de compte obligatoire.",
            "Fais toi-même un achat test sur mobile, du panier jusqu'au paiement. "
            "Le point où TU hésites ou bloques est presque toujours le bon suspect.",
            "Je vois les événements, pas l'écran : un tunnel peut « marcher » "
            "techniquement et décourager quand même.",
            "solide", 1,
            repere="Repère e-commerce : 25-40 % des paniers devraient aboutir. "
                   "0 % = problème technique ou friction majeure, pas un problème de trafic.",
        )

    # Cas 2 : beaucoup de vues produit, presque pas de paniers → la fiche produit n'embarque pas
    if views >= SEUILS["funnel_views_min"] and carts / max(views, 1) < SEUILS["funnel_cart_rate_min"]:
        rate = carts / max(views, 1) * 100
        return _reco(
            "funnel", "google",
            f"{views} vues produit, seulement {rate:.0f} % finissent en panier",
            fun_txt,
            "Le trafic arrive (la pub fait son travail) mais la fiche produit ne "
            "convainc pas : prix pas clair, photos faibles, doute sur la livraison, "
            "ou promesse de la pub qui ne colle pas à la page.",
            "Compare ce que dit ta pub et ce que montre la page d'arrivée. Si la pub "
            "promet -20 % et que la page ne le mentionne nulle part, c'est là que tu "
            "perds les gens.",
            "Un taux panier faible peut aussi être normal sur des produits chers "
            "(les gens comparent) — juge par rapport à TES semaines précédentes.",
            "creuser", 2,
            repere="Repère : 5-10 % des vues produit devraient partir au panier. "
                   "Sous 3 %, la fiche produit mérite le chantier avant la pub.",
        )

    return None


def _rule_ga4_muet(df_camp, ga4):
    """GA4 connecté mais AUCUNE donnée sur la fenêtre → alerte fraîcheur.

    Sans ça, l'utilisateur croit que ses recos sont « GA4-informées » alors que
    la fenêtre est vide (fetch en panne, mauvaise propriété, tag GA4 retiré).
    """
    if not (ga4 and ga4.get("connected")):
        return None
    if ga4.get("paid_revenue") is not None:  # données présentes → rien à dire
        return None
    return _reco(
        "ga4_muet", "google",
        "GA4 est connecté mais muet sur les 7 derniers jours",
        "Ta connexion Google Analytics est active, mais aucune donnée n'est "
        "remontée sur la fenêtre du rapport — mes conseils pub retombent donc "
        "en mode prudent.",
        "Soit le fetch n'a pas tourné récemment, soit la propriété GA4 sélectionnée "
        "n'est pas celle de ton site, soit le tag GA4 ne collecte plus.",
        "Clique « ↻ Rafraîchir maintenant » dans la barre latérale, puis vérifie "
        "dans Paramètres que la bonne propriété est sélectionnée. En dernier "
        "recours : GA4 → Temps réel pour voir si ton site envoie encore des données.",
        "Je ne peux pas distinguer « pas de visites » de « données pas récupérées » — "
        "le Temps réel GA4 tranche en 30 secondes.",
        "solide", 2,
    )


def _rule_connecter_ga4(df_camp, ga4):
    """Nudge : pub connectée mais pas GA4 → on ne voit que la moitié de l'histoire."""
    if ga4 and ga4.get("connected"):
        return None
    if df_camp is None or df_camp.empty:
        return None
    if "spend" in df_camp.columns and df_camp["spend"].sum() < SEUILS["cpc_spend_min"]:
        return None  # pas assez de budget en jeu pour que ça vaille le coup
    return _reco(
        "connecter_ga4", "google",
        "Connecte Google Analytics pour juger le vrai retour",
        "Aujourd'hui je vois ce que tes pubs coûtent, mais pas ce qu'elles rapportent.",
        "Avec GA4 branché, je peux relier ta dépense Meta à tes ventes/contacts réels "
        "et te dire quelles campagnes valent vraiment leur prix — pas juste lesquelles "
        "sont chères.",
        "Va dans Paramètres → Connecter Google Analytics (5 min, en lecture seule).",
        "Sans ça, mes conseils sur les pubs restent prudents : je préfère te guider "
        "que te faire couper une campagne qui te rapportait peut-être.",
        "piste", 6,
    )


# ── Règles Instagram organique ───────────────────────────────────────────────
#
# `_rule_format_gagnant` ET `_rule_creneau` VIVAIENT ICI, ET ELLES SONT MORTES
# LE 2026-09-12.
#
# Elles répondaient à « qu'est-ce qui marche chez toi » — la même question que
# `insights.py` (`format_best`, `slot_best`) et que le recalcul TypeScript de
# `/instagram`. Trois moteurs, deux langages, trois jeux de seuils qui pouvaient
# se contredire le même lundi : `_rule_format_gagnant` jugeait la SEMAINE contre
# l'historique (`SEUILS["format_reach_pct"]`, +15 %), `build_constats` juge un
# FORMAT sur tout l'historique contre la portée moyenne du compte
# (`C_SEUILS["format_reach_boost"]`, +20 %). Deux réponses, deux périmètres, un
# seul écran.
#
# `insights.py` gagne : il croise tout l'historique quand les deux autres
# regardent une fenêtre, il est déterministe, et ses clés stables portent déjà
# le verdict du client (`insight_feedback`). Ces deux règles redeviennent donc
# ce qu'elles étaient : des CONSTATS, pas des conseils.
# Tranché par `.scratch/refonte/issues/11-d-ou-viennent-les-conseils.md`, bâti
# par `.scratch/construction/issues/09-trois-moteurs-un-seul.md`.
#
# CE QUI RESTE POUR CONSEILLER L'ORGANIQUE : les quatre règles `orga_*` de
# `saas/traitement/build_report.py`, qui raisonnent à l'échelle d'UN THÈME —
# `orga_format` pour le contenu, `orga_rythme` pour le tempo. Les deux mortes
# raisonnaient sur le compte entier et ne se déclenchaient presque jamais depuis
# le passage au rapport par thème.

def _rule_silence(df_insta, df_week_posts):
    """0 post cette semaine alors que le compte a une cadence → relancer (doux)."""
    if df_insta is None or df_insta.empty or "date" not in df_insta.columns:
        return None
    if df_week_posts is not None and len(df_week_posts) > 0:
        return None
    _dt = pd.to_datetime(df_insta["date"], errors="coerce", utc=True).dropna()
    if _dt.empty:
        return None
    span_days = (_dt.max() - _dt.min()).days or 1
    cadence = len(df_insta) / max(1, span_days / 30)
    if cadence < 1:
        return None  # compte quasi inactif — pas de leçon à donner
    return _reco(
        "silence", "instagram",
        "Aucun post publié cette semaine",
        f"Ta cadence habituelle tourne autour de {cadence:.1f} posts par mois, "
        "et la semaine est restée vide.",
        "Les comptes qui publient régulièrement gardent une meilleure portée : "
        "l'algorithme montre surtout ce qui est récent et vivant.",
        "Pas besoin de viser la perfection : un seul post cette semaine, sur ton "
        "meilleur créneau, suffit à garder le rythme.",
        "Une semaine sans poster n'est pas grave en soi — c'est la répétition qui "
        "endort une page, pas un trou isolé.",
        "creuser", 2,
        repere="Le repère pour un petit compte : 3 à 5 posts par semaine entretiennent "
               "la portée. En dessous de 1, l'algorithme te met progressivement de côté.",
    )


def _rule_page_endormie(df_insta, followers_current):
    """Portée/abonné < 10 % → la page touche peu son audience."""
    if df_insta is None or len(df_insta) < 5 or followers_current < 100:
        return None  # trop peu de signal pour juger honnêtement
    if "reach" not in df_insta.columns:
        return None
    reach_rate = float(df_insta["reach"].mean()) / followers_current * 100
    if reach_rate >= SEUILS["reach_rate_min"]:
        return None
    return _reco(
        "page_endormie", "instagram",
        f"Un post typique ne touche que {reach_rate:.0f} % de tes abonnés",
        f"En moyenne, tes posts atteignent {reach_rate:.0f} % de ton audience. "
        "La zone normale d'un petit compte se situe entre 10 et 30 %.",
        "Sous 10 %, c'est souvent que la cadence a baissé, que le format ne crée plus "
        "de réactions, ou que l'audience s'est élargie sans rester engagée.",
        "Teste les Reels sur 2 semaines (ils touchent au-delà de tes abonnés) et "
        "regarde si ce pourcentage remonte.",
        "Ce ratio bouge naturellement ; juge-le sur la durée, pas sur une seule "
        "semaine.",
        "creuser", 3,
        repere="Le repère de portée sur tes abonnés : 30 %+ = sain, 50 %+ = l'algo te "
               "pousse fort. Sous 10 %, ta page est en sommeil — c'est là qu'il faut réagir.",
    )


# ── Orchestration ────────────────────────────────────────────────────────────
#
# LE POIDS D'UN CONSEIL « DONE », SELON CE QU'IL A RÉELLEMENT DONNÉ (TASK-025).
# Avant cette tâche, `done` valait toujours +2, qu'un verdict existe ou non, et
# quel qu'il soit — une reco confirmée « ça a marché » et une reco cochée
# « fait » sans jamais avoir eu d'effet mesurable étaient traitées à
# l'identique. Le verdict, une fois tombé (`suivi_actions.verdict`, persisté
# par `build_report.py` au moment où il est calculé), change ce poids :
#   · `None` (aucun verdict encore tombé) : +1, faible et neutre — on ne sait
#     pas encore si ça a marché, on ne dépriorise donc qu'à peine ;
#   · "stable"  : +2 — le poids d'avant cette tâche, gardé pour le seul cas où
#     il était déjà juste : traité, sans effet mesurable, laisse la place ;
#   · "better"  : +6 — même poids que `not_for_me` : confirmé, ça a marché,
#     inutile de continuer à occuper une place utile à un autre conseil ;
#   · "worse"   : -4 — ne dépriorise pas, RESURFACE au contraire : un verdict
#     qui dit que ça a empiré mérite d'être revu, pas rangé en silence.
_DONE_W = {None: 1, "stable": 2, "better": 6, "worse": -4}


def build_recos(
    df_camp=None,
    avg_ctr: float = 0.0,
    df_insta=None,
    df_week_posts=None,
    followers_current: int = 0,
    ga4: dict | None = None,
    objectif: str | None = None,
    feedback: dict | None = None,
    vision: list | None = None,
    theme: str | None = None,
    feedback_theme: dict | None = None,
    verdicts: dict | None = None,
) -> list[dict]:
    """Évalue toutes les règles, trie par priorité (1 = plus fort).

    ga4 : dict optionnel — lève le plafond de confiance des recos pub.
    objectif : 'ventes' | 'notoriete' | 'engagement' — remonte les recos pertinentes.
    feedback : {reco_key: "useful"|"not_for_me"|"done"} — la dernière réaction connue,
               COMPTE ENTIER (pas de notion de thème). 'useful' n'affecte pas la
               priorité (compté ailleurs). 'not_for_me' et 'done' sont traités
               ci-dessous (TASK-025) :
      - 'not_for_me' : les clés-règles (ex. « gaspillage ») sont GÉNÉRIQUES, pas
        namespacées par thème — un refus sur le thème A muselait donc la même
        clé sur TOUS les thèmes (bug corrigé ici). Quand `theme` et
        `feedback_theme` sont fournis (appel PAR THÈME), le museau ne se fie
        qu'à `feedback_theme` — un refus sur un AUTRE thème, ou un feedback
        posé avant la migration `reco_feedback_contexte.sql` (donc sans
        thème connu), ne muselle plus ce thème-ci. Sans `theme` (appel compte
        entier, ex. les « réglages ») le comportement est inchangé : `feedback`
        seul, comme avant cette tâche.
      - 'done' dépriorisait de +2 QUEL QUE SOIT LE RÉSULTAT MESURÉ (bug corrigé
        ici) : une reco confirmée qui a amélioré son indicateur et une reco
        cochée « fait » sans jamais avoir eu d'effet mesurable étaient traitées
        à l'identique. `verdicts` (le dernier verdict PERSISTÉ par reco_key,
        voir `suivi_actions.verdict` / `scripts/fetch_data.py::fetch_reco_verdicts`)
        fait maintenant dépendre le poids du résultat réel — voir `_DONE_W`.
    feedback_theme : {(reco_key, thème): "useful"|"not_for_me"|"done"} — la
                     dernière réaction connue SUR CE THÈME (voir plus haut).
                     Ignoré si `theme` vaut `None`.
    verdicts : {reco_key: "better"|"worse"|"stable"} — le dernier verdict connu
               (compte entier, une action ne se mesure qu'une fois par clé).
    theme : le thème de cet appel, ou `None` pour un appel compte entier (les
            « réglages » GA4/funnel, qui n'ont pas de notion de thème).
    vision : constats de la vision globale [{kind, status, …}] (worker) — un constat
             validé remonte les règles qui le prolongent, un constat rejeté les recule.
    Défensif : une règle qui plante est ignorée — le rapport ne casse jamais.
    """
    candidates = [
        lambda: _rule_roas(df_camp, ga4),          # LA reco forte GA4 (ROAS/CPA/zéro conv)
        lambda: _rule_gaspillage(df_camp, ga4),
        lambda: _rule_scaler(df_camp, avg_ctr, ga4),
        lambda: _rule_silence(df_insta, df_week_posts),
        lambda: _rule_page_endormie(df_insta, followers_current),
        lambda: _rule_funnel(ga4),                 # où le funnel casse (GA4 events)
        lambda: _rule_ga4_muet(df_camp, ga4),      # GA4 connecté mais fenêtre vide
        lambda: _rule_connecter_ga4(df_camp, ga4),
    ]
    recos = []
    for rule in candidates:
        try:
            r = rule()
        except Exception:
            r = None
        if r:
            recos.append(r)

    obj = OBJECTIFS.get(objectif or "")
    fb = feedback or {}
    fb_theme = feedback_theme or {}
    vd = verdicts or {}
    for r in recos:
        # Objectif : -3 si la reco sert l'objectif (plateforme ou key)
        if obj and (r["platform"] in obj["boost_platforms"] or r["key"] in obj["boost_keys"]):
            r["priority"] -= 3
        # Feedback : respecter ce que l'utilisateur a déjà dit.
        # 'not_for_me' : scopé par thème quand l'appel en fournit un (voir la
        # docstring) — 'done' reste lu compte entier, `fb`, comme avant cette
        # tâche : rien dans TASK-025 ne demande de scoper 'done' par thème,
        # seulement de faire dépendre son poids du verdict (`_DONE_W`).
        not_for_me = (
            fb_theme.get((r["key"], theme)) == "not_for_me"
            if theme is not None
            else fb.get(r["key"]) == "not_for_me"
        )
        if not_for_me:
            r["priority"] += 6   # pousse en bas sans masquer (un signal réel reste visible)
        elif fb.get(r["key"]) == "done":
            r["priority"] += _DONE_W.get(vd.get(r["key"]), _DONE_W[None])

    # Vision globale : les règles hebdo qui PROLONGENT un constat validé remontent,
    # celles qui s'appuient sur un constat rejeté reculent (sans jamais disparaître).
    #
    # `format_best` et `slot_best` N'Y SONT PLUS : les deux seules règles
    # qu'elles prolongeaient (`format_gagnant`, `creneau`) sont mortes, et un
    # constat ne se pondère pas lui-même. Les deux constats, eux, vivent
    # toujours — ils s'affichent maintenant (« Ce qui marche pour toi »).
    VISION_RULES = {
        "theme_best": {"roas", "scaler"},
        "campagne_locomotive": {"roas", "scaler"},
        "theme_worst": {"roas", "gaspillage"},
    }
    for c in (vision or []):
        keys = VISION_RULES.get(c.get("kind"))
        if not keys:
            continue
        status = c.get("status")
        for r in recos:
            if r["key"] not in keys:
                continue
            if status in ("agree", "new"):
                r["priority"] -= 1
            elif status == "reject":
                # Le +4 qui distinguait `format_best`/`slot_best` part avec
                # elles : les trois constats qui restent reculent tous pareil.
                r["priority"] += 2

    recos.sort(key=lambda r: r["priority"])
    return recos
