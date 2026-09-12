"""Le plafond de cinq, sa composition, et l'empreinte qui empêche la répétition.

Ce que ce fichier prouve : cinq conseils au maximum sur tout le compte, jamais
plus de deux Marches ni plus de deux gestes de fabrication à une heure ou plus,
et jamais deux fois la même instruction — même clé ET même cible. Il prouve
AUSSI le contraire de chacun : un plafond n'est pas un quota, donc rien ne se
complète pour atteindre cinq.
"""
import pulse  # noqa: F401
from t import ok, egal, bilan

from saas.recos_ia.composition import (
    MAX_LOURDS, MAX_MARCHES, PLAFOND_SEMAINE,
    composer_la_semaine, empreinte,
)


def conseil(cle, *, cible="", role="generale", nature="tester", effort="10 min"):
    return {"key": cle, "cible": cible, "role": role,
            "nature": nature, "effort": effort}


def cles(sortie):
    return [r["key"] for r in sortie]


# ── LE PLAFOND ───────────────────────────────────────────────────────────────

def test_cinq_au_maximum_sur_tout_le_compte():
    pool = [conseil(f"r{i}") for i in range(12)]
    sortie = composer_la_semaine(pool)
    egal("cinq servis", len(sortie), PLAFOND_SEMAINE)
    egal("les cinq premiers de l'ordre reçu", cles(sortie),
         ["r0", "r1", "r2", "r3", "r4"])


def test_l_ordre_recu_est_l_ordre_servi():
    """Ce module COUPE, il ne trie pas : le tri connaît le rang du thème."""
    pool = [conseil("c"), conseil("a"), conseil("b")]
    egal("aucun reclassement", cles(composer_la_semaine(pool)), ["c", "a", "b"])


def test_moins_de_cinq_candidats_rend_moins_de_cinq():
    """Un plafond, jamais un quota : on ne complète avec rien."""
    sortie = composer_la_semaine([conseil("r0"), conseil("r1")])
    egal("deux dedans, deux dehors", len(sortie), 2)


def test_aucun_candidat_rend_une_liste_vide():
    egal("rien à servir", composer_la_semaine([]), [])


# ── LES MARCHES D'UNE STRATÉGIE ──────────────────────────────────────────────

def test_jamais_plus_de_deux_marches():
    pool = [conseil(f"m{i}", role="hypothese") for i in range(5)]
    sortie = composer_la_semaine(pool)
    egal("deux Marches au maximum", len(sortie), MAX_MARCHES)


def test_une_troisieme_marche_laisse_sa_place_a_un_geste():
    pool = [conseil("m0", role="hypothese"), conseil("m1", role="hypothese"),
            conseil("m2", role="hypothese"), conseil("g0"), conseil("g1")]
    egal("la 3e Marche saute, les gestes passent",
         cles(composer_la_semaine(pool)), ["m0", "m1", "g0", "g1"])


def test_une_seule_marche_ne_force_rien():
    """Un plafond, pas un plancher : personne ne fabrique une 2e Marche."""
    pool = [conseil("m0", role="hypothese"), conseil("g0"), conseil("g1")]
    egal("on sert ce qu'on a", len(composer_la_semaine(pool)), 3)


def test_zero_marche_est_une_semaine_valide():
    pool = [conseil(f"g{i}") for i in range(3)]
    sortie = composer_la_semaine(pool)
    egal("trois gestes, aucune Marche", len(sortie), 3)
    ok("et aucune Marche inventée",
       all(r["role"] == "generale" for r in sortie))


# ── LES GESTES DE FABRICATION ────────────────────────────────────────────────

def lourd(cle, **kw):
    return conseil(cle, nature="créer", effort="1 h", **kw)


def test_jamais_plus_de_deux_fabrications_a_une_heure():
    pool = [lourd(f"l{i}") for i in range(5)]
    egal("deux lourds au maximum", len(composer_la_semaine(pool)), MAX_LOURDS)


def test_corriger_compte_comme_creer():
    pool = [lourd("l0"), conseil("l1", nature="corriger", effort="2 h+"),
            conseil("l2", nature="corriger", effort="1 h")]
    egal("le troisième saute", cles(composer_la_semaine(pool)), ["l0", "l1"])


def test_creer_en_dix_minutes_n_est_pas_lourd():
    """Le plafond porte sur le GESTE ET la durée, jamais sur l'un des deux."""
    pool = [conseil(f"c{i}", nature="créer", effort="10 min") for i in range(4)]
    egal("aucun n'est lourd", len(composer_la_semaine(pool)), 4)


def test_couper_une_heure_n_est_pas_lourd():
    pool = [conseil(f"c{i}", nature="couper", effort="1 h") for i in range(4)]
    egal("couper n'est pas fabriquer", len(composer_la_semaine(pool)), 4)


def test_les_deux_plafonds_se_cumulent_sans_se_confondre():
    """Une Marche lourde compte dans les deux — elle n'est pas comptée deux
    fois dans le même, et elle n'échappe à aucun."""
    pool = [lourd("m0", role="hypothese"), lourd("m1", role="hypothese"),
            lourd("l2"), conseil("g3"), conseil("g4"), conseil("g5")]
    sortie = cles(composer_la_semaine(pool))
    egal("la 3e fabrication saute, les gestes légers passent",
         sortie, ["m0", "m1", "g3", "g4", "g5"])


# ── L'EMPREINTE : CLÉ + CIBLE ────────────────────────────────────────────────

def test_l_empreinte_est_la_cle_et_la_cible():
    egal("les deux, jamais l'une",
         empreinte({"key": "roas", "cible": "Été 2026"}), ("roas", "été 2026"))


def test_l_empreinte_ignore_la_casse_et_les_espaces():
    egal("même cible écrite autrement",
         empreinte({"key": "roas", "cible": "  Été 2026 "}),
         empreinte({"key": "roas", "cible": "été 2026"}))


def test_une_cible_absente_reste_une_empreinte():
    egal("cible vide, pas None", empreinte({"key": "silence"}), ("silence", ""))


def test_la_meme_instruction_ne_revient_pas():
    servi = {empreinte(conseil("roas", cible="Été"))}
    sortie = composer_la_semaine(
        [conseil("roas", cible="Été"), conseil("roas", cible="Hiver")], servi)
    egal("seule la cible neuve passe", cles(sortie), ["roas"])
    egal("et c'est bien l'autre cible", sortie[0]["cible"], "Hiver")


def test_la_meme_cle_sur_une_autre_cible_passe():
    """« Le X ne sera pas le même » — une nouvelle Marche, pas une répétition."""
    servi = {empreinte(conseil("annonce_chere", cible="Annonce A"))}
    sortie = composer_la_semaine([conseil("annonce_chere", cible="Annonce B")], servi)
    egal("elle passe", len(sortie), 1)


def test_une_autre_cle_sur_la_meme_cible_passe():
    servi = {empreinte(conseil("annonce_chere", cible="Annonce A"))}
    sortie = composer_la_semaine([conseil("annonce_locomotive", cible="Annonce A")], servi)
    egal("la clé fait partie de l'empreinte", len(sortie), 1)


def test_une_marche_epinglee_se_reaffiche_a_l_identique():
    """Le seul cas où répéter est le comportement voulu : une Stratégie en
    cours réaffiche sa Marche tant que son Verdict n'est pas tombé."""
    c = conseil("page_endormie", cible="Compte", role="hypothese")
    servi = {empreinte(c)}
    egal("bloquée sans épingle", len(composer_la_semaine([c], servi)), 0)
    egal("servie avec épingle", len(composer_la_semaine([c], servi, {empreinte(c)})), 1)


def test_un_conseil_ecarte_ne_consomme_aucune_place():
    servi = {empreinte(conseil("r0"))}
    pool = [conseil("r0")] + [conseil(f"r{i}") for i in range(1, 7)]
    egal("cinq servis quand même",
         cles(composer_la_semaine(pool, servi)), ["r1", "r2", "r3", "r4", "r5"])


def test_le_pool_recu_n_est_jamais_modifie():
    pool = [conseil(f"r{i}") for i in range(8)]
    composer_la_semaine(pool)
    egal("le module est pur", len(pool), 8)


if __name__ == "__main__":
    for nom, fn in sorted(list(globals().items())):
        if nom.startswith("test_"):
            fn()
    raise SystemExit(0 if bilan("Plafond de cinq et composition") else 1)
