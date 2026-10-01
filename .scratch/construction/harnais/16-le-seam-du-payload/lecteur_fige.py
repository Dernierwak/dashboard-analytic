"""Le faux lecteur, et de quoi gréer un compte entier sur des lignes fixes.

C'est ce que le ticket 16 appelle « un faux lecteur gréé sur des lignes fixes » :
il rend le contrat de `saas/traitement/lecteur.py` sans base, sans secret, sans
réseau.

DEUX RÈGLES QUE CE FICHIER S'IMPOSE, parce qu'elles décident de ce que les tests
valent :

1. **Tout descend des lignes d'entrée.** Le contexte GA4 est CALCULÉ ici à
   partir des campagnes décrites, jamais posé à la main à côté d'elles. Sans ça, la
   propriété « aucun nombre du payload n'est absent des lignes d'entrée »
   (`CLAUDE.md` §7) se vérifierait contre des chiffres qu'on aurait écrits pour
   qu'elle passe.
2. **L'IA est muette par défaut.** `redige` rend `None`, comme Gemini sans clé.
   Un test qui dépendrait d'une phrase écrite par un modèle ne serait pas
   rejouable — et le rapport doit de toute façon tenir sans lui.
"""
from dataclasses import dataclass, field
from datetime import date, timedelta

# Assez de profondeur pour la matrice full-history, la frise sur dix semaines et
# la fenêtre de 28 jours des créneaux — sans faire un jeu illisible.
JOURS = 120


@dataclass
class Annonce:
    """Une Annonce Google, telle que `google_ads_ad_insights` la porte.

    Les montants sont ceux de la FENÊTRE de sept jours : le constructeur les
    étale jour par jour. `conversions=None` dit « pas mesuré » et jamais zéro.
    """
    nom: str
    groupe: str
    depense: float
    clics: int
    impressions: int
    conversions: float | None = None


@dataclass
class Campagne:
    nom: str
    canal: str = "google"          # "meta" ou "google"
    depense_jour: float = 0.0
    clics_jour: int = 0
    impressions_jour: int = 0
    revenu_jour: float | None = None   # revenu GA4 attribué à CE nom de campagne
    annonces: list[Annonce] = field(default_factory=list)

    @property
    def identifiant(self) -> str:
        return f"g-{abs(hash(self.nom)) % 10**8}"


class LecteurFige:
    """Le contrat de `Lecteur`, servi depuis des listes en mémoire."""

    def __init__(self, *, aujourd_hui: date, meta_ads, google_ads,
                 google_annonces, config_google, ga4_par_campagne,
                 rapports_publies=(), objectif="ventes"):
        self._aujourd_hui = aujourd_hui
        self._meta_ads = list(meta_ads)
        self._google_ads = list(google_ads)
        self._google_annonces = list(google_annonces)
        self._config_google = dict(config_google)
        self._ga4_par_campagne = dict(ga4_par_campagne)   # nom → revenu/jour
        self._rapports_publies = list(rapports_publies)
        self._objectif = objectif

    # ── La récolte ───────────────────────────────────────────────────────────
    def meta_ads(self): return self._meta_ads
    def publications(self): return []
    def abonnes(self): return []
    def google_ads(self): return self._google_ads
    def google_annonces(self): return self._google_annonces

    # ── Les réglages du compte ───────────────────────────────────────────────
    def objectif(self): return self._objectif
    def config_google(self): return self._config_google
    # Aucun canal muet par défaut : le compte de référence est un compte
    # dont la récolte a réussi. Le ticket 20 grée le trou par-dessus
    # (`../20-canal-muet/gree.py`), il ne le pose pas ici.
    def canaux_muets(self): return {}

    # ── GA4 ──────────────────────────────────────────────────────────────────
    def ga4_contexte(self, since: date, until: date):
        """Le même dict que `build_ga4_context`, borné à [since, until].

        Le revenu est RECALCULÉ sur la fenêtre à partir du revenu par jour des
        campagnes — comme le ferait la vraie fonction sur les lignes de
        `ga4_insights`. Poser un total à la main aurait laissé passer une
        fenêtre mal découpée sans qu'aucun test ne s'en aperçoive.
        """
        if not self._ga4_par_campagne:
            return None
        jours = (until - since).days + 1
        if jours <= 0:
            return None
        jours = min(jours, JOURS)
        par_campagne = {
            nom: {"revenue": round(rev * jours, 2),
                  "conversions": float(jours),
                  "sessions": 10 * jours}
            for nom, rev in self._ga4_par_campagne.items() if rev
        }
        if not par_campagne:
            return None
        total = sum(d["revenue"] for d in par_campagne.values())
        return {
            "connected": True,
            "paid_revenue": total, "total_revenue": total,
            "paid_conversions": float(jours * len(par_campagne)),
            "total_conversions": float(jours * len(par_campagne)),
            "paid_sessions": 10 * jours * len(par_campagne),
            "total_sessions": 10 * jours * len(par_campagne),
            "funnel": {}, "by_campaign": par_campagne,
            "events_by_campaign": {}, "events_sans_campagne": {},
        }

    def ga4_insights(self): return []

    # ── Les lectures brutes ──────────────────────────────────────────────────
    def dates_declarees(self, table): return []

    def rapports_publies(self, avant, limite=8):
        return [r for r in self._rapports_publies
                if str(r.get("week_start") or "") < avant][:limite]

    # ── L'horloge ────────────────────────────────────────────────────────────
    def aujourd_hui(self): return self._aujourd_hui


# ── Le constructeur de compte ────────────────────────────────────────────────

def compte(campagnes, *, aujourd_hui=date(2026, 9, 13), **reste):
    """Un `LecteurFige` cohérent, entièrement dérivé de `campagnes`."""
    derniere = aujourd_hui - timedelta(days=1)
    jours = [derniere - timedelta(days=n) for n in range(JOURS)]
    fenetre = [derniere - timedelta(days=n) for n in range(7)]

    meta_ads, google_ads, google_annonces = [], [], []
    config_google, ga4 = {}, {}

    for c in campagnes:
        if c.canal == "google":
            config_google[c.identifiant] = {
                "campaign_name": c.nom, "budget_max": 0.0,
                "effective_status": "ENABLED"}
        if c.revenu_jour:
            ga4[c.nom] = c.revenu_jour

        for j in jours:
            if c.canal == "meta":
                meta_ads.append({
                    "date_start": j.isoformat(), "campaign_name": c.nom,
                    "spend": c.depense_jour, "clicks": c.clics_jour,
                    "impressions": c.impressions_jour,
                })
            else:
                google_ads.append({
                    "date_start": j.isoformat(), "campaign_id": c.identifiant,
                    "campaign_name": c.nom,
                    "cost_micros": int(c.depense_jour * 1_000_000),
                    "clicks": c.clics_jour, "impressions": c.impressions_jour,
                })

        # Les Annonces vivent sur la fenêtre de sept jours, une ligne par jour :
        # c'est la seule fenêtre sur laquelle les règles payantes comparent.
        for rang, a in enumerate(c.annonces):
            for j in fenetre:
                google_annonces.append({
                    "date_start": j.isoformat(), "campaign_id": c.identifiant,
                    "campaign_name": c.nom,
                    "ad_id": f"{c.identifiant}-{rang}", "ad_name": a.nom,
                    "ad_group_name": a.groupe,
                    "cost_micros": int(a.depense / 7 * 1_000_000),
                    "clicks": a.clics // 7, "impressions": a.impressions // 7,
                    "conversions": (None if a.conversions is None
                                    else a.conversions / 7),
                })

    return LecteurFige(
        aujourd_hui=aujourd_hui, meta_ads=meta_ads, google_ads=google_ads,
        google_annonces=google_annonces, config_google=config_google,
        ga4_par_campagne=ga4, **reste)
