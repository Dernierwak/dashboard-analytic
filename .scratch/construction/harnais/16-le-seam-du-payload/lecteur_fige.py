"""Le faux lecteur, et de quoi gréer un compte entier sur des lignes fixes.

C'est ce que le ticket 16 appelle « un faux lecteur gréé sur des lignes fixes » :
il rend le contrat de `saas/traitement/lecteur.py` sans base, sans secret, sans
réseau — et il **enregistre** les deux écritures au lieu de les jouer.

DEUX RÈGLES QUE CE FICHIER S'IMPOSE, parce qu'elles décident de ce que les tests
valent :

1. **Tout descend des lignes d'entrée.** Les totaux par thème (ce que la vue
   `theme_regroupement` rendrait) et le contexte GA4 sont CALCULÉS ici à partir
   des campagnes décrites, jamais posés à la main à côté d'elles. Sans ça, la
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
    theme: str
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
                 google_annonces, config_meta, config_google,
                 themes_regroupes, insight_feedback, priorites_datees,
                 ga4_par_campagne, rapports_publies=(), suivi=(),
                 notes=(), plan_de_theme=None, budgets=(), objectif="ventes",
                 redige=None):
        self._aujourd_hui = aujourd_hui
        self._meta_ads = list(meta_ads)
        self._google_ads = list(google_ads)
        self._google_annonces = list(google_annonces)
        self._config_meta = dict(config_meta)
        self._config_google = dict(config_google)
        self._themes_regroupes = list(themes_regroupes)
        self._insight_feedback = dict(insight_feedback)
        self._priorites_datees = list(priorites_datees)
        self._ga4_par_campagne = dict(ga4_par_campagne)   # nom → revenu/jour
        self._rapports_publies = list(rapports_publies)
        self._suivi = list(suivi)
        self._notes = list(notes)
        self._plan_de_theme = dict(plan_de_theme or {})
        self._budgets = list(budgets)
        self._objectif = objectif
        self._redige = redige
        # Ce que la construction a voulu ÉCRIRE. Rien ne part en base : c'est ce
        # qui rend l'écriture vérifiable au lieu d'être seulement empêchée.
        self.ecrits: list[tuple] = []

    # ── La récolte ───────────────────────────────────────────────────────────
    def meta_ads(self): return self._meta_ads
    def publications(self): return []
    def abonnes(self): return []
    def google_ads(self): return self._google_ads
    def google_annonces(self): return self._google_annonces

    # ── Les réglages du compte ───────────────────────────────────────────────
    def objectif(self): return self._objectif
    def profil_onboarding(self): return {}
    def objectifs_par_theme(self): return {}
    def config_meta(self): return self._config_meta
    def config_google(self): return self._config_google
    def budgets_poses(self): return self._budgets
    def themes_regroupes(self): return self._themes_regroupes

    # ── Ce que le client a répondu ───────────────────────────────────────────
    def reco_feedback(self): return {}
    def verdicts(self): return {}
    def contexte_theme(self): return []
    def plan_de_theme(self): return self._plan_de_theme
    def insight_feedback(self): return self._insight_feedback
    def priorites_datees(self): return self._priorites_datees

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

    def ga4_evenements_par_theme(self): return {}
    def ga4_lignes(self): return []
    def ga4_insights(self): return []

    # ── Les lectures brutes ──────────────────────────────────────────────────
    def dates_declarees(self, table): return []

    def rapports_publies(self, avant, limite=8):
        return [r for r in self._rapports_publies
                if str(r.get("week_start") or "") < avant][:limite]

    def suivi_actions(self): return self._suivi

    def suivi_en_cours(self):
        return [a for a in self._suivi if a.get("status") in ("running", "done")]

    def notes_archivees(self, limite=200): return self._notes[:limite]

    # ── L'IA ─────────────────────────────────────────────────────────────────
    def redige(self, prompt):
        return self._redige(prompt) if callable(self._redige) else None

    def persona(self, **kwargs): return None

    def memoire_theme(self, theme, historique, faits): return None

    # ── Les deux écritures ───────────────────────────────────────────────────
    def ecrire_plan_de_theme(self, theme, reco_key, levier, decided_at, carte):
        self.ecrits.append(("plan_de_theme", theme, reco_key, levier, decided_at))

    def ecrire_verdict(self, action_id, verdict):
        """Rend `True` : une base saine touche bien la ligne. Le vrai lecteur
        rend `False` quand l'`update` n'atteint personne (refus RLS, colonne
        pas migrée) et l'appelant en dépend — la mémoire du thème ne se nourrit
        que d'un verdict réellement figé."""
        self.ecrits.append(("verdict", action_id, verdict))
        return True

    # ── L'horloge ────────────────────────────────────────────────────────────
    def aujourd_hui(self): return self._aujourd_hui


# ── Le constructeur de compte ────────────────────────────────────────────────

def compte(campagnes, *, etoiles=(), aujourd_hui=date(2026, 9, 13), **reste):
    """Un `LecteurFige` cohérent, entièrement dérivé de `campagnes`.

    `etoiles` est l'ordre d'étoilage — c'est lui, et pas l'alphabétique, qui
    décide des thèmes conseillés (`_labels_prioritaires`).
    """
    derniere = aujourd_hui - timedelta(days=1)
    jours = [derniere - timedelta(days=n) for n in range(JOURS)]
    fenetre = [derniere - timedelta(days=n) for n in range(7)]

    meta_ads, google_ads, google_annonces = [], [], []
    config_meta, config_google, ga4 = {}, {}, {}

    for c in campagnes:
        if c.canal == "meta":
            config_meta[c.nom] = {"label": c.theme, "label_source": "manual",
                                  "budget_max": 0.0, "effective_status": "ACTIVE"}
        else:
            config_google[c.identifiant] = {
                "campaign_name": c.nom, "label": c.theme,
                "label_source": "manual", "budget_max": 0.0,
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
        google_annonces=google_annonces, config_meta=config_meta,
        config_google=config_google,
        themes_regroupes=_vue_regroupement(campagnes, len(jours)),
        insight_feedback={f"priority_label:{n}": "agree" for n in etoiles},
        priorites_datees=[
            {"insight_key": f"priority_label:{n}",
             "created_at": (date(2026, 1, 1) + timedelta(days=i)).isoformat()}
            for i, n in enumerate(etoiles)],
        ga4_par_campagne=ga4, **reste)


def _vue_regroupement(campagnes, jours: int) -> list[dict]:
    """Ce que la vue `theme_regroupement` rendrait sur ces campagnes.

    Les mêmes règles que `supabase/migrations/theme_regroupement.sql`, et elles
    ne sont pas décoratives : le seuil de 100 CHF (`juge`), le ROAS qui n'existe
    QUE sous ce seuil, et surtout **pas de revenu du tout** quand GA4 ne répond
    pas — ni zéro, ni estimation (`CLAUDE.md` §7).
    """
    par_theme: dict[str, dict] = {}
    for c in campagnes:
        t = par_theme.setdefault(c.theme, {
            "label": c.theme, "spend": 0.0, "clicks": 0, "impressions": 0,
            "posts": 0, "reach_avg": None, "eng_avg": None, "revenue": None})
        t["spend"] += c.depense_jour * jours
        t["clicks"] += c.clics_jour * jours
        t["impressions"] += c.impressions_jour * jours
        if c.revenu_jour is not None:
            t["revenue"] = (t["revenue"] or 0.0) + c.revenu_jour * jours

    lignes = []
    for t in par_theme.values():
        t["spend"] = round(t["spend"], 2)
        if t["revenue"] is not None:
            t["revenue"] = round(t["revenue"], 2)
        t["ctr"] = (round(t["clicks"] / t["impressions"] * 100, 2)
                    if t["impressions"] else None)
        t["juge"] = t["spend"] >= 100
        t["roas"] = (round(t["revenue"] / t["spend"], 2)
                     if t["juge"] and t["revenue"] is not None and t["spend"]
                     else None)
        lignes.append(t)
    return sorted(lignes, key=lambda l: l["label"])
