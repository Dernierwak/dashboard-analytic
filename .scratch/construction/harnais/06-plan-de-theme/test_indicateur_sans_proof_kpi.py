"""`PROOF_KPI` est retirée sans qu'aucune valeur ne bouge.

La table dupliquait `METRIC_INFO` valeur pour valeur : dix-sept lignes qui
disaient deux fois la même chose, et deux tables qui disent la même chose
finissent par ne plus la dire pareil. Ce fichier recopie la table TELLE QU'ELLE
ÉTAIT le jour de sa suppression et exige que `_METRIC_REGLE` + `_spec_mesure`
rendent exactement les mêmes cinq-uplets. C'est la seule preuve qui compte ici :
un verdict rendu sur un libellé ou un sens d'amélioration différent serait un
verdict sur une autre mesure.
"""
import pulse  # noqa: F401
from t import egal, ok, bilan

from saas.traitement.build_report import _METRIC_REGLE, _spec_mesure

# `saas/traitement/build_report.py`, `build_payload`, avant le ticket 06.
# `creneau` ET `format_gagnant` RESTENT DANS CETTE RECOPIE, ALORS QUE LES DEUX
# RÈGLES SONT MORTES (ticket 09). Ce n'est pas un oubli : leur indicateur reste
# dans `_METRIC_REGLE` en LECTURE SEULE, parce qu'une décision déjà prise sur
# l'une d'elles doit encore recevoir son Verdict — sans indicateur, la boucle du
# Verdict l'écarte AVANT la branche « en attente » et la décision disparaît sans
# un mot. Leur mort se vérifie donc sur les quatre AUTRES tables, dans le
# harnais du ticket 09 (`../09-trois-moteurs/test_moteur_unique.py`).
PROOF_KPI_AVANT = {
    "gaspillage":         ("cpc", "CPC moyen", "CHF", "down", "{:.2f}"),
    "roas":               ("roas", "ROAS", "", "up", "{:.1f}"),
    "scaler":             ("roas", "ROAS", "", "up", "{:.1f}"),
    "funnel":             ("purchases", "achats (GA4)", "", "up", "{:.0f}"),
    "silence":            ("posts", "posts publiés", "", "up", "{:.0f}"),
    "creneau":            ("eng", "engagement moyen", "%", "up", "{:.1f}"),
    "format_gagnant":     ("eng", "engagement moyen", "%", "up", "{:.1f}"),
    "page_endormie":      ("reach", "portée moyenne", "", "up", "{:,.0f}"),
    "orga_rythme":        ("posts", "posts publiés", "", "up", "{:.0f}"),
    "orga_essoufflement": ("reach", "portée moyenne", "", "up", "{:,.0f}"),
    "orga_format":        ("reach", "portée moyenne", "", "up", "{:,.0f}"),
    "orga_reaction":      ("reach", "portée moyenne", "", "up", "{:,.0f}"),
}


def test_chaque_cle_rend_le_meme_cinq_uplet():
    for cle, attendu in PROOF_KPI_AVANT.items():
        egal(f"{cle} · spec inchangée", _spec_mesure(_METRIC_REGLE.get(cle)), attendu)


def test_aucune_cle_n_a_ete_ajoutee_ni_perdue():
    # ASSOUPLI LE 2026-09-12 PAR LE TICKET 07, ET IL FAUT DIRE POURQUOI. Ce
    # test exigeait l'égalité stricte des deux jeux de clés — c'était la bonne
    # forme tant que `_METRIC_REGLE` n'était QUE la recopie de `PROOF_KPI`.
    # Le ticket 07 y ajoute quatre conseils payants qui n'existaient pas quand
    # `PROOF_KPI` a été retirée ; l'égalité stricte ferait donc échouer ce
    # fichier sur une clé neuve au lieu d'une valeur déplacée.
    #
    # CE QUE LE TEST PROTÉGEAIT RESTE ENTIER, et c'est tout ce qui compte ici :
    # aucune clé de l'ancienne table n'a disparu, et
    # `test_chaque_cle_rend_le_meme_cinq_uplet` ci-dessus vérifie déjà que
    # AUCUNE de leurs valeurs n'a bougé.
    manquantes = sorted(set(PROOF_KPI_AVANT) - set(_METRIC_REGLE))
    egal("aucune clé de PROOF_KPI n'a été perdue", manquantes, [])
    # Les clés neuves sont nommées ici plutôt que tolérées en silence : une
    # cinquième qui apparaîtrait sans ticket ferait tomber ce test.
    egal("les seules clés ajoutées depuis sont celles du ticket 07",
         sorted(set(_METRIC_REGLE) - set(PROOF_KPI_AVANT)),
         ["annonce_chere", "annonce_locomotive", "annonce_sans_conversion",
          "theme_hors_budget"])


def test_ce_qui_n_avait_pas_d_indicateur_n_en_a_toujours_pas():
    # Une veille n'a pas de verdict à mériter ; un coût par événement choisi
    # n'est pas une mesure que `_kpis_window` sait rendre. Leur donner une
    # baseline promettrait un verdict sur la mauvaise mesure.
    for cle in ("veille_campagne_neuve", "veille_theme_muette",
                "theme_event_cout", "theme_event_muet",
                "connecter_ga4", "ga4_muet"):
        ok(f"{cle} · sans indicateur", _spec_mesure(_METRIC_REGLE.get(cle)) is None)


def test_une_metrique_inconnue_ne_fabrique_rien():
    ok("metric absente", _spec_mesure(None) is None)
    ok("metric hors liste", _spec_mesure("marge") is None)


if __name__ == "__main__":
    test_chaque_cle_rend_le_meme_cinq_uplet()
    test_aucune_cle_n_a_ete_ajoutee_ni_perdue()
    test_ce_qui_n_avait_pas_d_indicateur_n_en_a_toujours_pas()
    test_une_metrique_inconnue_ne_fabrique_rien()
    raise SystemExit(0 if bilan("L'indicateur après PROOF_KPI") else 1)
