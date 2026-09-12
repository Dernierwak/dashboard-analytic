"""Le coût par conversion d'un thème était jeté en silence : il devient constat.

`theme_event_cout` ne demande aucun geste — il demande de comparer un coût à sa
propre marge, ce qui se fait hors de l'outil. `_est_conseil` le refusait donc, et
personne ne le rattrapait : calculé chaque semaine depuis le ticket 06, publié
nulle part. Ce fichier fige sa nouvelle place et, surtout, ce qui la rend
honnête : une clé stable qui suit l'événement, et l'angle mort qui voyage avec le
chiffre.
"""
import ast

import pulse
from t import ok, egal, bilan

from saas.traitement.build_report import (
    RECO_FIELDS, _attach_grammaire, _constat_cout, _est_conseil, _slug_constat,
)

RECO = {
    "key": "theme_event_cout",
    "platform": "pub",
    "title": "Sur « e-bike », chaque « purchase » t'a coûté 42.00 CHF",
    "observation": "840 CHF dépensés sur les campagnes de ce thème, 20 fois « purchase ».",
    "angle_mort": "Ce qui arrive sans campagne ne rentre pas dans ce calcul.",
    "cible": "purchase",
}


FENETRE = "la semaine du 5 sep au 11 sep"


def test_ce_n_est_toujours_pas_un_conseil():
    r = _attach_grammaire(dict(RECO, source="rule"))
    egal("aucun geste posé", r.get("nature"), None)
    ok("il n'est jamais servi comme conseil", not _est_conseil(r))


def test_il_devient_un_constat_complet():
    c = _constat_cout(RECO, "e-bike", {}, FENETRE)
    egal("son genre", c["kind"], "cout_conversion")
    egal("il conclut sur la pub", c["platform"], "pub")
    egal("le titre est celui de la règle", c["title"], RECO["title"])
    ok("le détail part de son observation", c["detail"].startswith(RECO["observation"]))
    egal("l'angle mort voyage avec le chiffre", c["angle_mort"], RECO["angle_mort"])
    egal("neuf par défaut", c["status"], "new")


def test_il_dit_sa_fenetre_parce_qu_il_est_le_seul_a_en_avoir_une():
    """Tous les autres constats croisent tout l'historique, et le bloc l'annonce.
    Celui-ci porte SEPT JOURS : sans sa fenêtre écrite, une dépense de semaine se
    lirait comme un total depuis janvier (`CLAUDE.md` §7)."""
    c = _constat_cout(RECO, "e-bike", {}, FENETRE)
    ok("la fenêtre est dans le détail", FENETRE in c["detail"], c["detail"])
    ok("et il dit qu'il n'est pas comme les autres",
       "pas sur tout l'historique" in c["detail"], c["detail"])


def test_l_angle_mort_atteint_l_ia_avec_le_chiffre():
    """Le brief dit à Gemini « appuie-toi dessus » : lui donner une borne haute
    sans sa réserve, c'est lui demander de la présenter comme une mesure."""
    src = pulse.SOURCE_RAPPORT.read_text(encoding="utf-8")
    i = src.index("Vision long terme du compte (validée, appuie-toi dessus)")
    debut = src.rindex("def _pour_ia", 0, i)
    ok("le brief pose la limite à côté du chiffre",
       "[limite : {c['angle_mort']}]" in src[debut:i])


def test_la_cle_porte_le_theme_ET_l_evenement():
    c = _constat_cout(RECO, "E-Bike", {}, FENETRE)
    egal("clé normalisée", c["key"], "cout_conversion:e-bike:purchase")
    # Deux thèmes, deux clés : un verdict ne traverse pas les thèmes.
    autre = _constat_cout(RECO, "promo été", {}, FENETRE)
    ok("un autre thème, une autre clé", autre["key"] != c["key"])
    # Changer d'événement principal change le chiffre dont on parle.
    c2 = _constat_cout(dict(RECO, cible="add_to_cart"), "e-bike", {}, FENETRE)
    ok("un autre événement, une autre clé", c2["key"] != c["key"])


def test_le_verdict_du_client_se_reapplique():
    c = _constat_cout(RECO, "e-bike", {"cout_conversion:e-bike:purchase": "reject"}, FENETRE)
    egal("le refus tient", c["status"], "reject")


def test_la_normalisation_est_celle_des_autres_cles():
    egal("casse et espaces", _slug_constat("  Promo Été "), "promo-été")
    egal("rien n'est None", _slug_constat(None), "")


def test_la_cible_survit_au_payload():
    """`cible` entre dans la clé : si elle était retirée à la publication, la
    clé changerait entre deux semaines et le verdict sauterait."""
    ok("`cible` est un champ publié", "cible" in RECO_FIELDS)


def test_la_recolte_est_bien_avant_le_filtre_qui_le_jette():
    """Lu sur l'arbre : la boucle qui récolte le coût précède le filtre
    `_est_conseil`, dans le même bloc. Après lui, elle ne verrait plus rien."""
    src = pulse.SOURCE_RAPPORT.read_text(encoding="utf-8")
    i = src.index("constats.append(_constat_cout(")
    j = src.index("if _est_conseil(r)\n", i)
    ok("la récolte précède le filtre", i < j)
    egal("une seule récolte", src.count("constats.append(_constat_cout("), 1)


if __name__ == "__main__":
    test_ce_n_est_toujours_pas_un_conseil()
    test_il_devient_un_constat_complet()
    test_il_dit_sa_fenetre_parce_qu_il_est_le_seul_a_en_avoir_une()
    test_l_angle_mort_atteint_l_ia_avec_le_chiffre()
    test_la_cle_porte_le_theme_ET_l_evenement()
    test_le_verdict_du_client_se_reapplique()
    test_la_normalisation_est_celle_des_autres_cles()
    test_la_cible_survit_au_payload()
    test_la_recolte_est_bien_avant_le_filtre_qui_le_jette()
    raise SystemExit(0 if bilan("Le coût par conversion devient un constat") else 1)
