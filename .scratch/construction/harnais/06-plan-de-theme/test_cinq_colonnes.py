"""Les cinq colonnes d'une règle : durée · levier · indicateur · geste · preuve.

Ce que ce fichier prouve : après `_attach_grammaire`, une reco-règle porte les
cinq, et aucune ne sort de sa liste fermée. C'est la panne exacte que le ticket
réparait — les tables existaient, personne ne les posait sur une reco-règle, et
`theme_plan` recevait donc `levier=None`.
"""
import pulse  # noqa: F401  (pose `saas/` sur le chemin d'import)
from t import ok, egal, bilan

from saas.traitement.build_report import (
    EFFORTS, EFFORT_BY_KEY, LEVIERS_IA, METRICS_IA, METRIC_INFO_IA,
    NATURES_IA, ROLES_IA, SETUP_KEYS,
    _GESTE_REGLE, _LEVIER_REGLE, _METRIC_REGLE,
    _attach_grammaire, _effort_de, _est_conseil, _spec_mesure,
)

# Les clés qui concourent pour les places de la semaine : tout `_LEVIER_REGLE`
# moins le socle (prérequis de mesure, circuit à part) et moins les constats.
CONSEILS = [c for c, lv in _LEVIER_REGLE.items()
            if lv != "socle" and c != "theme_event_cout"]

# Ces deux-là écrivent plusieurs gestes selon le chiffre du jour : la table ne
# peut rien en dire, et c'est `test_geste_par_branche.py` qui vérifie leurs cinq
# colonnes sur de vraies sorties de règle.
DECLARENT_PAR_BRANCHE = ("roas", "gaspillage")


def test_chaque_conseil_porte_les_cinq_colonnes():
    for cle in CONSEILS:
        if cle in DECLARENT_PAR_BRANCHE:
            continue
        # Une reco telle que la rendrait sa règle quand le geste ne dépend pas
        # du chiffre du jour : rien de déclaré, tout à poser.
        r = _attach_grammaire({"key": cle, "source": "rule"})
        ok(f"{cle} · levier posé", r.get("levier") in LEVIERS_IA, r.get("levier"))
        ok(f"{cle} · geste posé", r.get("nature") in NATURES_IA, r.get("nature"))
        ok(f"{cle} · preuve posée", r.get("role") in ROLES_IA, r.get("role"))
        ok(f"{cle} · durée posée", _effort_de(r) in EFFORTS, _effort_de(r))
        spec = _spec_mesure(_METRIC_REGLE.get(cle))
        ok(f"{cle} · indicateur mesurable", spec is not None and spec[0] in METRICS_IA,
           _METRIC_REGLE.get(cle))
        ok(f"{cle} · servi", _est_conseil(r))


def test_le_socle_garde_son_circuit_a_part():
    for cle in ("connecter_ga4", "ga4_muet", "funnel", "theme_event_muet"):
        r = _attach_grammaire({"key": cle, "source": "rule"})
        egal(f"{cle} · levier socle", r.get("levier"), "socle")
        egal(f"{cle} · aucun geste à déclarer", r.get("nature"), None)
        ok(f"{cle} · servi quand même", _est_conseil(r))
    # Trois des quatre passent par le bloc « réglages », le quatrième vit sur la
    # carte de son thème — la liste ne change pas, on la fige.
    egal("SETUP_KEYS inchangée", SETUP_KEYS, {"ga4_muet", "connecter_ga4", "funnel"})


def test_la_table_ne_dit_rien_de_ce_qu_une_branche_declare():
    # `_GESTE_REGLE` n'est qu'un DÉFAUT : une règle qui a déclaré son geste
    # garde le sien, même si la table en propose un autre.
    r = _attach_grammaire({"key": "silence", "source": "rule",
                           "nature": "couper", "role": "hypothese"})
    egal("le geste déclaré tient", r["nature"], "couper")
    egal("la preuve déclarée tient", r["role"], "hypothese")
    egal("la table proposait autre chose", _GESTE_REGLE["silence"], ("créer", "generale"))


def test_une_piste_ia_garde_ses_declarations():
    # Elle déclare ses trois colonnes elle-même et se fait rejeter à la
    # génération si elles sortent des listes — rien à poser après coup.
    r = _attach_grammaire({"key": "ai_audio_1", "source": "ai", "levier": "audience",
                           "metric": "reach", "nature": "tester", "role": "hypothese"})
    egal("levier IA intact", r["levier"], "audience")
    egal("geste IA intact", r["nature"], "tester")
    egal("preuve IA intacte", r["role"], "hypothese")


def test_les_tables_couvrent_les_memes_cles():
    # Une clé qui aurait une durée mais pas de levier (ou l'inverse) sortirait
    # avec quatre colonnes sur cinq, sans que rien ne le signale.
    egal("durée et levier couvrent les mêmes clés",
         sorted(EFFORT_BY_KEY), sorted(_LEVIER_REGLE))
    for cle in CONSEILS:
        ok(f"{cle} · a un indicateur", cle in _METRIC_REGLE)
    for cle, metric in _METRIC_REGLE.items():
        ok(f"{cle} · indicateur connu de METRIC_INFO_IA", metric in METRIC_INFO_IA)
    for cle, (nature, role) in _GESTE_REGLE.items():
        ok(f"{cle} · geste dans la liste fermée", nature in NATURES_IA, nature)
        ok(f"{cle} · preuve dans la liste fermée", role in ROLES_IA, role)
        ok(f"{cle} · la table ne double pas une branche",
           cle not in DECLARENT_PAR_BRANCHE)


if __name__ == "__main__":
    test_chaque_conseil_porte_les_cinq_colonnes()
    test_le_socle_garde_son_circuit_a_part()
    test_la_table_ne_dit_rien_de_ce_qu_une_branche_declare()
    test_une_piste_ia_garde_ses_declarations()
    test_les_tables_couvrent_les_memes_cles()
    raise SystemExit(0 if bilan("Les cinq colonnes") else 1)
