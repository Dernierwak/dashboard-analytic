"""`theme_deux_regies` — le thème qui ne rend pas pareil sur les deux régies.

Ce que ce fichier prouve, et c'est le cœur : la règle SE TAIT dès que
l'attribution d'un canal est incomplète. Une campagne étiquetée dont
l'`utm_campaign` ne correspond plus verse sa dépense sans jamais verser son
revenu (`.scratch/construction/issues/18-revenu-google-non-rattachable.md`) — la
règle dirait alors « l'autre rend quatre fois mieux » alors qu'on a simplement
perdu le revenu d'une campagne.

Prouve aussi qu'un « ×∞ » ne s'écrit jamais (`CLAUDE.md` §7) et que le champ
`pourquoi` NOMME le biais du dernier clic — condition posée par
`.scratch/refonte/issues/24-conseils-payants-manquants.md`.
"""
import pulse  # noqa: F401
from t import ok, egal, bilan

from saas.recos_ia.reco_engine import SEUILS
from saas.recos_ia.regles_payantes import regle_theme_deux_regies

RATIO = SEUILS["regie_roas_ratio"]   # 4.0 — la place laissée au biais last-click
PLANCHER = SEUILS["cpc_spend_min"]   # 50 CHF par canal


def regies(meta_rev=200.0, google_rev=1000.0, meta_spend=200.0,
           google_spend=200.0, meta_complet=True, google_complet=True):
    return {"meta": {"spend": meta_spend, "revenue": meta_rev, "complet": meta_complet},
            "google": {"spend": google_spend, "revenue": google_rev,
                       "complet": google_complet}}


def test_elle_denonce_l_ecart():
    r = regle_theme_deux_regies("Été", regies())   # ROAS 1.0 contre 5.0
    ok("un conseil sort", r is not None)
    egal("clé", r["key"], "theme_deux_regies")
    egal("geste", r["nature"], "tester")
    egal("preuve — elle ouvre une Stratégie", r["role"], "hypothese")
    ok("les deux régies sont nommées",
       "Google" in r["title"] and "Meta" in r["title"], r["title"])
    egal("la cible porte le THÈME et le sens du transfert",
         r.get("cible"), "Été:meta->google")
    ok("sans le thème, elle n'aurait que deux valeurs pour tout le compte",
       regle_theme_deux_regies("Hiver", regies()).get("cible") != r.get("cible"))


def test_le_pourquoi_nomme_le_biais_du_dernier_clic():
    """Condition posée par 24 : sans cette phrase, la règle pousse le budget dans
    une seule direction en prenant un artefact de mesure pour un fait."""
    r = regle_theme_deux_regies("Été", regies())
    ok("le dernier clic est nommé", "DERNIER clic" in r["pourquoi"], r["pourquoi"])
    ok("l'exemple Meta → recherche de marque → Google y est",
       "recherche de ton nom" in r["pourquoi"], r["pourquoi"])


def test_une_attribution_incomplete_la_fait_taire():
    egal("Google incomplet",
         regle_theme_deux_regies("Été", regies(google_complet=False)), None)
    egal("Meta incomplet",
         regle_theme_deux_regies("Été", regies(meta_complet=False)), None)


def test_un_revenu_absent_n_est_pas_un_revenu_nul():
    egal("revenue à None",
         regle_theme_deux_regies("Été", regies(meta_rev=None)), None)


def test_elle_se_place_pile_sur_le_ratio():
    # Meta : ROAS 1.0. Google à 4× fait ROAS 4.0, donc 800 CHF de revenu.
    sous = regle_theme_deux_regies("Été", regies(google_rev=200.0 * RATIO - 1))
    egal("un franc sous le ratio, silence", sous, None)
    pile = regle_theme_deux_regies("Été", regies(google_rev=200.0 * RATIO))
    ok("au ratio exact, un conseil", pile is not None)


def test_un_canal_sans_argent_en_jeu_sort():
    egal("Meta sous le plancher",
         regle_theme_deux_regies("Été", regies(meta_spend=PLANCHER - 1)), None)
    ok("au plancher exact, un conseil",
       regle_theme_deux_regies("Été", regies(meta_spend=PLANCHER, meta_rev=0.0))
       is not None)


def test_un_seul_canal_ne_s_arbitre_pas():
    egal("Google seul", regle_theme_deux_regies("Été", {"google": {
        "spend": 500.0, "revenue": 2000.0, "complet": True}}), None)
    egal("rien du tout", regle_theme_deux_regies("Été", {}), None)
    egal("None", regle_theme_deux_regies("Été", None), None)


def test_zero_revenu_d_un_cote_n_ecrit_jamais_un_multiplicateur():
    """Un « ×∞ » n'existe pas (`CLAUDE.md` §7) : on écrit les deux chiffres."""
    r = regle_theme_deux_regies("Été", regies(meta_rev=0.0))
    ok("un conseil sort", r is not None)
    ok("aucun multiplicateur dans le titre", "×" not in r["title"], r["title"])
    # Le gabarit de l'autre branche est « X rapporte N× mieux que Y ». Y glisser
    # « rapporte, l'autre pas » produisait « Meta rapporte, l'autre pas que
    # Google » : une phrase cassée, sortie telle quelle au client.
    egal("le titre est une phrase française",
         r["title"], "« Été » : Google rapporte, Meta pas encore")
    ok("le zéro est dit en clair",
       "zéro revenu attribué" in r["observation"], r["observation"])


def test_aucune_des_deux_ne_rapporte_n_est_pas_un_arbitrage():
    egal("zéro des deux côtés",
         regle_theme_deux_regies("Été", regies(meta_rev=0.0, google_rev=0.0)), None)


def test_le_geste_est_un_transfert_partiel_jamais_une_coupe():
    r = regle_theme_deux_regies("Été", regies())
    ok("un quart du budget", "quart du budget" in r["verifier"], r["verifier"])
    ok("le repère l'interdit explicitement",
       "jamais tout" in r["repere"], r["repere"])
    ok("l'angle mort dit pourquoi",
       "TRANSFERT partiel" in r["angle_mort"], r["angle_mort"])
    ok("le quart est chiffré en CHF", "50 CHF" in r["verifier"], r["verifier"])


for _f in list(globals().values()):
    if callable(_f) and getattr(_f, "__name__", "").startswith("test_"):
        _f()
raise SystemExit(0 if bilan("theme_deux_regies") else 1)
