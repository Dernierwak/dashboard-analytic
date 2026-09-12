"""Un conseil sans Geste est un constat — et un constat n'est jamais servi.

Il n'y a pas de sixième geste « vérifier » : ajouter un geste fourre-tout aurait
rendu admissible tout ce qui ne demande rien, et c'est exactement ce que les
cinq gestes servent à distinguer. Deux circuits restent dehors, et ce fichier
vérifie que ce sont bien les deux prévus — la veille, et le socle.
"""
import pulse  # noqa: F401
from t import ok, egal, bilan

from saas.traitement.build_report import (
    NATURES_IA, _GESTE_REGLE, _LEVIER_REGLE, _attach_grammaire, _est_conseil,
)


def conseil(cle, **champs):
    return _attach_grammaire(dict({"key": cle, "source": "rule"}, **champs))


def test_le_constat_du_cout_par_evenement_sort_des_places_de_la_semaine():
    # `theme_event_cout` ne demande aucun geste : il demande de comparer un coût
    # à sa marge. C'est un constat, mesuré comme tel dans le ticket 22.
    r = conseil("theme_event_cout")
    egal("aucun geste déclaré", r.get("nature"), None)
    egal("son levier reste argent", r.get("levier"), "argent")
    ok("il n'est pas servi comme conseil", not _est_conseil(r))
    ok("il n'est pas dans la table des gestes", "theme_event_cout" not in _GESTE_REGLE)


def test_une_veille_ne_reclame_aucun_geste():
    # Une veille dit « attends » : l'absence de geste est tout son contenu.
    for cle in ("veille_campagne_neuve", "veille_theme_muette", "veille_theme_calme"):
        r = conseil(cle)
        egal(f"{cle} · levier de veille", r.get("levier"), "veille")
        ok(f"{cle} · servi sans geste", _est_conseil(r))


def test_le_socle_ne_reclame_aucun_geste():
    for cle, levier in _LEVIER_REGLE.items():
        if levier != "socle":
            continue
        r = conseil(cle)
        ok(f"{cle} · servi sans geste", _est_conseil(r))


def test_une_regle_muette_sur_son_geste_n_est_jamais_servie():
    # La mécanique de rejet, sur une clé qui n'est ni veille ni socle : pas de
    # geste, pas de place. Aucun geste n'est deviné à sa place.
    r = conseil("regle_inconnue_de_demain")
    egal("rien n'a été deviné", r.get("nature"), None)
    ok("elle n'est pas servie", not _est_conseil(r))
    # Et dès qu'elle en déclare un, elle entre.
    r2 = conseil("regle_inconnue_de_demain", nature="couper")
    ok("avec un geste, elle entre", _est_conseil(r2))


def test_les_cinq_gestes_et_pas_un_de_plus():
    egal("les cinq gestes", NATURES_IA,
         ("couper", "augmenter", "tester", "créer", "corriger"))
    ok("pas de geste « vérifier »", "vérifier" not in NATURES_IA)


if __name__ == "__main__":
    test_le_constat_du_cout_par_evenement_sort_des_places_de_la_semaine()
    test_une_veille_ne_reclame_aucun_geste()
    test_le_socle_ne_reclame_aucun_geste()
    test_une_regle_muette_sur_son_geste_n_est_jamais_servie()
    test_les_cinq_gestes_et_pas_un_de_plus()
    raise SystemExit(0 if bilan("Le critère d'entrée") else 1)
