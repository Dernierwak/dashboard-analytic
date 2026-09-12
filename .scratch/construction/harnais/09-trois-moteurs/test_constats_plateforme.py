"""Chaque constat dit SUR QUELLE PAGE il conclut — le rang 4 du gabarit.

Un constat sans plateforme se lit partout ; un constat mal placé fait conclure
une page sur des chiffres qui ne sont pas les siens (le créneau Instagram sous
les campagnes Google). Ce fichier fige la règle : le THÈME traverse tout, le
FORMAT et le CRÉNEAU sont organiques, la LOCOMOTIVE appartient à sa régie.
"""
import pulse  # noqa: F401
from t import ok, egal, bilan

from saas.recos_ia.insights import build_constats


def _matrice(**kw):
    base = {
        "period": {"since": "2026-01-01", "until": "2026-09-11", "days": 254},
        "themes": [], "formats": [], "campaigns": [], "slots": [],
        "account_reach_avg": 0.0,
        "coverage": {"posts_labeled": 0, "posts_total": 0,
                     "campaigns_labeled": 0, "campaigns_total": 0, "ga4": False},
    }
    base.update(kw)
    return base


def _un(constats, kind):
    return next((c for c in constats if c["kind"] == kind), None)


THEME_MOTEUR = {"label": "e-bike", "spend": 800.0, "revenue": 3200.0,
                "roas": 4.0, "ctr": 2.0, "posts": 9, "eng_avg": 5.0, "juge": True}
THEME_MUET = {"label": "promo été", "spend": 400.0, "revenue": 0.0,
              "roas": 0.0, "ctr": 0.4, "posts": 2, "eng_avg": 1.0, "juge": True}


def test_un_constat_de_theme_n_appartient_a_aucune_plateforme():
    cs = build_constats(_matrice(themes=[THEME_MOTEUR, THEME_MUET]), {})
    egal("theme_best · toutes plateformes", _un(cs, "theme_best")["platform"], None)
    egal("theme_worst · toutes plateformes", _un(cs, "theme_worst")["platform"], None)


def test_le_format_et_le_creneau_sont_organiques():
    cs = build_constats(_matrice(
        account_reach_avg=1000.0,
        formats=[{"format": "Reel", "posts": 8, "reach_avg": 1500.0, "eng_avg": 4.0}],
        slots=[{"dow": 1, "slot": 2, "posts": 4, "reach_avg": 1800.0}]), {})
    egal("format_best · instagram", _un(cs, "format_best")["platform"], "instagram")
    egal("slot_best · instagram", _un(cs, "slot_best")["platform"], "instagram")


def test_la_locomotive_appartient_a_sa_regie():
    for canal in ("meta", "google"):
        cs = build_constats(_matrice(
            coverage={"posts_labeled": 0, "posts_total": 0, "campaigns_labeled": 1,
                      "campaigns_total": 1, "ga4": True},
            campaigns=[{"name": "Toujours-Vert", "channel": canal, "key": "k",
                        "spend": 600.0, "clicks": 300, "impressions": 10_000,
                        "ctr": 3.0, "cpc": 2.0, "revenue": 2400.0, "label": "e-bike"}]), {})
        egal(f"campagne_locomotive · {canal}", _un(cs, "campagne_locomotive")["platform"], canal)


def test_l_angle_mort_n_appartient_a_aucune_plateforme():
    """Il ne se lit que là où il se répare — la page Thèmes. C'est le web qui
    l'y garde (`ce-qui-marche.tsx`) ; ici on fige seulement qu'il ne prétend
    appartenir à aucune régie."""
    cs = build_constats(_matrice(
        coverage={"posts_labeled": 2, "posts_total": 10, "campaigns_labeled": 1,
                  "campaigns_total": 3, "ga4": False}), {})
    a = _un(cs, "angle_mort")
    ok("l'angle mort sort", a is not None)
    egal("angle_mort · sans plateforme", a["platform"], None)


def test_le_verdict_du_client_survit_a_la_plateforme():
    """La `platform` s'ajoute au constat, elle ne déplace pas sa clé — sinon le
    verdict déjà posé cesserait de s'appliquer à la régénération suivante."""
    m = _matrice(account_reach_avg=1000.0,
                 formats=[{"format": "Reel", "posts": 8, "reach_avg": 1500.0, "eng_avg": 4.0}])
    cle = _un(build_constats(m, {}), "format_best")["key"]
    egal("la clé est restée celle d'avant", cle, "format_best:reel")
    egal("le verdict se réapplique",
         _un(build_constats(m, {cle: "reject"}), "format_best")["status"], "reject")


if __name__ == "__main__":
    test_un_constat_de_theme_n_appartient_a_aucune_plateforme()
    test_le_format_et_le_creneau_sont_organiques()
    test_la_locomotive_appartient_a_sa_regie()
    test_l_angle_mort_n_appartient_a_aucune_plateforme()
    test_le_verdict_du_client_survit_a_la_plateforme()
    raise SystemExit(0 if bilan("La plateforme d'un constat") else 1)
