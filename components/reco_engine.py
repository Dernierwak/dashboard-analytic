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
    "format_gagnant": "reproduire un format gagnant",
    "silence": "reprendre la cadence de publication",
    "page_endormie": "réveiller la portée de la page",
    "creneau": "publier au bon créneau",
    "ai": "suggestion IA",
}

SEUILS = {
    "cpc_ratio": 2.0,             # CPC > 2× ta médiane = signal de coût
    "cpc_spend_min": 50.0,        # ...seulement si ≥ 50 CHF dépensés sur la semaine
    "roas_spend_min": 50.0,       # ROAS calculé seulement si ≥ 50 CHF dépensés (sinon bruit)
    "roas_bon": 3.0,              # ROAS ≥ 3 = rentable avec marge → scaler
    "roas_fragile": 1.0,          # 1 ≤ ROAS < 3 = rentable mais fragile ; < 1 = alerte
    "funnel_carts_min": 5,        # ≥ 5 paniers sans achat = signal checkout
    "funnel_views_min": 50,       # ≥ 50 vues produit pour juger le taux panier
    "funnel_cart_rate_min": 0.03, # < 3 % vues→panier = fiche produit à revoir
    "ctr_ratio": 1.5,             # CTR > 1.5× ta moyenne = candidat à amplifier
    "ctr_impressions_min": 1000,  # plancher d'impressions (évite le bruit)
    "format_reach_pct": 15.0,     # posts semaine ≥ +15 % vs ton post moyen
    "format_sample_solide": 3,    # ≥ 3 posts la semaine = signal moins fragile
    "reach_rate_min": 10.0,       # portée/abonné < 10 % = page qui s'endort
    "slot_cell_min": 3,           # ≥ 3 posts dans la case gagnante (cohérent heatmap)
    "slot_total_min": 20,         # ≥ 20 posts au total (cohérent heatmap)
}


def _reco(key, platform, title, observation, pourquoi, verifier, angle_mort,
          confidence, priority, repere=""):
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
        "boost_keys": {"silence", "page_endormie", "creneau"},
    },
    "engagement": {
        "label": "Plus d'engagement",
        "boost_platforms": {"instagram"},
        "boost_keys": {"format_gagnant", "creneau"},
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

def _rule_format_gagnant(df_week_posts, df_insta):
    """Posts de la semaine nettement au-dessus de ton post moyen → reproduire."""
    if df_week_posts is None or len(df_week_posts) == 0:
        return None
    if df_insta is None or df_insta.empty or "reach" not in df_insta.columns:
        return None
    if "reach" not in df_week_posts.columns:
        return None
    hist_reach = float(df_insta["reach"].mean())
    week_reach = float(df_week_posts["reach"].mean())
    if hist_reach <= 0:
        return None
    diff_pct = (week_reach - hist_reach) / hist_reach * 100
    if diff_pct < SEUILS["format_reach_pct"]:
        return None

    n = len(df_week_posts)
    fmt_note = ""
    if "type" in df_week_posts.columns:
        try:
            top = str(df_week_posts["type"].value_counts().idxmax()).upper()
            fmt_note = f", surtout en {FORMAT_LABELS.get(top, top)}"
        except Exception:
            pass
    # Confiance selon l'échantillon : 1-2 posts = piste, 3+ = on creuse
    solide_enough = n >= SEUILS["format_sample_solide"]
    return _reco(
        "format_gagnant", "instagram",
        f"Tes posts de la semaine portent +{diff_pct:.0f} % de plus que d'habitude",
        f"Tes {n} post{'s' if n > 1 else ''} de la semaine font {week_reach:,.0f} de "
        f"portée moyenne, contre {hist_reach:,.0f} sur ton historique{fmt_note}.",
        "Quand un format décolle, c'est que le sujet, le ton ou le moment ont touché "
        "juste. Ça vaut la peine de comprendre quoi, pour le refaire.",
        "Reprends ce qui a marché — même format, même angle — sur 1 ou 2 prochains "
        "posts et regarde si l'effet se confirme.",
        ("" if solide_enough else
         f"Sur seulement {n} post{'s' if n > 1 else ''}, ça peut être un coup de "
         "chance. Attends d'en avoir publié quelques-uns avant d'en faire une règle."),
        "creuser" if solide_enough else "piste",
        3,
        repere="Le repère : un post qui dépasse +20 % de ta portée moyenne vaut d'être "
               "décliné. À +50 %, c'est un format à industrialiser (série, rubrique récurrente).",
    )


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


def _rule_creneau(df_insta):
    """Meilleur créneau fiable (mêmes seuils que la heatmap) → planifier dessus."""
    if df_insta is None or df_insta.empty:
        return None
    if "date" not in df_insta.columns or "reach" not in df_insta.columns:
        return None
    d = df_insta.copy()
    d["_dt"] = pd.to_datetime(d["date"], errors="coerce", utc=True)
    try:
        d["_dt"] = d["_dt"].dt.tz_convert("Europe/Zurich")
    except Exception:
        pass
    d = d.dropna(subset=["_dt"])
    if len(d) < SEUILS["slot_total_min"]:
        return None
    d["_dow"] = d["_dt"].dt.dayofweek
    d["_hour"] = d["_dt"].dt.hour
    if not any(int(h) > 0 for h in d["_hour"].dropna().unique()):
        return None  # heures non stockées (backfill) → créneau non fiable
    bins = [0, 7, 10, 13, 16, 19, 24]
    d["_slot"] = pd.cut(d["_hour"], bins=bins, labels=range(6), right=False)
    g = d.groupby(["_dow", "_slot"], observed=True)["reach"].agg(["count", "mean"])
    g = g[g["count"] >= SEUILS["slot_cell_min"]]
    if g.empty:
        return None
    best_key = g["mean"].idxmax()
    row = g.loc[best_key]
    dow, slot = int(best_key[0]), int(best_key[1])
    return _reco(
        "creneau", "instagram",
        f"Ton meilleur créneau : {DAYS[dow]} entre {HOURS[slot]}",
        f"Sur {int(row['count'])} posts publiés à ce moment, tu fais {row['mean']:,.0f} "
        "de portée moyenne — ton créneau le plus régulier.",
        "Publier quand ton audience est active donne un coup de pouce de départ que "
        "l'algorithme amplifie ensuite.",
        "Programme ton prochain post important sur ce créneau et compare-le à tes "
        "publications hors créneau.",
        "C'est une tendance sur ton historique, pas une garantie : le contenu compte "
        "toujours plus que l'heure.",
        "solide", 4,
        repere="Le repère : publie quand TON audience à toi est active (ce créneau), pas "
               "selon les « meilleures heures » génériques d'Internet — elles ne valent rien pour ton compte.",
    )


# ── Orchestration ────────────────────────────────────────────────────────────

def build_recos(
    df_camp=None,
    avg_ctr: float = 0.0,
    df_insta=None,
    df_week_posts=None,
    followers_current: int = 0,
    ga4: dict | None = None,
    objectif: str | None = None,
    feedback: dict | None = None,
) -> list[dict]:
    """Évalue toutes les règles, trie par priorité (1 = plus fort).

    ga4 : dict optionnel — lève le plafond de confiance des recos pub.
    objectif : 'ventes' | 'notoriete' | 'engagement' — remonte les recos pertinentes.
    feedback : {reco_key: "useful"|"not_for_me"|"done"} — la dernière réaction connue ;
               'not_for_me' déprioritise, 'done' déprioritise légèrement (déjà traité).
    Défensif : une règle qui plante est ignorée — le rapport ne casse jamais.
    """
    candidates = [
        lambda: _rule_roas(df_camp, ga4),          # LA reco forte GA4 (ROAS/CPA/zéro conv)
        lambda: _rule_gaspillage(df_camp, ga4),
        lambda: _rule_scaler(df_camp, avg_ctr, ga4),
        lambda: _rule_silence(df_insta, df_week_posts),
        lambda: _rule_format_gagnant(df_week_posts, df_insta),
        lambda: _rule_page_endormie(df_insta, followers_current),
        lambda: _rule_creneau(df_insta),
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
    for r in recos:
        # Objectif : -3 si la reco sert l'objectif (plateforme ou key)
        if obj and (r["platform"] in obj["boost_platforms"] or r["key"] in obj["boost_keys"]):
            r["priority"] -= 3
        # Feedback : respecter ce que l'utilisateur a déjà dit
        react = fb.get(r["key"])
        if react == "not_for_me":
            r["priority"] += 6   # pousse en bas sans masquer (un signal réel reste visible)
        elif react == "done":
            r["priority"] += 2   # déjà traité cette semaine → laisse la place au reste

    recos.sort(key=lambda r: r["priority"])
    return recos
