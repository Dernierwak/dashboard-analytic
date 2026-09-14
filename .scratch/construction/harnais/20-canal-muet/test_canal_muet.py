"""Un canal muet ne fabrique plus de chiffre — ticket 20 de la construction.

LA PROPRIÉTÉ, EN UNE PHRASE : quand un canal payant avait quelque chose à écrire
et n'a rien écrit, toute mesure qui traverse son trou vaut `None` — jamais 0,
jamais une baisse, jamais un ROAS gonflé (`CLAUDE.md` §7, « une absence de
donnée n'est pas un zéro »).

CHAQUE TEST TIENT SON TÉMOIN. Le même compte, aux mêmes chiffres, une fois sain
et une fois troué : sans lui, un `None` pourrait venir d'un compte mal gréé
plutôt que du trou, et le test passerait pour une mauvaise raison.
"""
from datetime import date, timedelta

import pulse  # noqa: F401
from t import ok, egal, bilan

from lecteur_fige import Campagne
from gree import compte_muet, compte_sain
from saas.traitement.build_report import build_payload

AUJOURD_HUI = date(2026, 9, 13)

MOT_META = ("meta KO: (#190) Error validating access token: Session has "
            "expired on Saturday, 05-Sep-26 11:00:00 PDT")


def deux_regies():
    """Un thème qui dépense sur les deux régies et rapporte via GA4."""
    return [
        Campagne("Été – Meta", theme="Été", canal="meta",
                 depense_jour=40.0, clics_jour=80, impressions_jour=4000,
                 revenu_jour=60.0),
        Campagne("Été – Google", theme="Été", canal="google",
                 depense_jour=20.0, clics_jour=40, impressions_jour=2000,
                 revenu_jour=40.0),
    ]


def carte(payload, label):
    for t in payload.get("themes_focus") or []:
        if t["label"] == label:
            return t
    return None


# ── 1 · LE CŒUR : LE ROAS GONFLE, ET C'EST LUI QU'ON ATTRAPE ─────────────────

def test_le_roas_ne_se_calcule_pas_sur_une_depense_amputee():
    """Le piège que ce ticket vise, et il va dans le sens contre-intuitif.

    GA4 écrit normalement pendant que Meta échoue : le revenu reste ENTIER,
    la dépense perd sa part Meta. Le ROAS ne tombe donc pas — il MONTE. Un
    rapport publié dessus n'a pas l'air cassé, il a l'air excellent, et la
    règle `scaler` conseille d'augmenter le budget là-dessus.
    """
    sain = build_payload(compte_sain(deux_regies(), aujourd_hui=AUJOURD_HUI,
                                     etoiles=["Été"]))
    troue = build_payload(compte_muet(deux_regies(), muets={"meta": MOT_META},
                                      aujourd_hui=AUJOURD_HUI, etoiles=["Été"]))

    ok("le compte sain publie bien un rapport", sain is not None)
    ok("le compte troué publie AUSSI un rapport (on ne retient plus)",
       troue is not None)

    # Le témoin : sur le compte sain, les trois chiffres existent.
    ok("témoin — la dépense du compte est un nombre",
       isinstance(sain["kpis"]["spend"], (int, float)),
       repr(sain["kpis"]["spend"]))
    ok("témoin — les clics du compte sont un nombre",
       isinstance(sain["kpis"]["clicks"], int), repr(sain["kpis"]["clicks"]))

    egal("la dépense du compte se tait", troue["kpis"]["spend"], None)
    egal("les clics du compte se taisent", troue["kpis"]["clicks"], None)
    egal("le CTR du compte se tait", troue["kpis"]["ctr"], None)


def test_la_depense_ne_devient_jamais_zero():
    """§7 : une absence de donnée n'est pas un zéro. `0` passerait tous les
    tests de type et se lirait « tu n'as rien dépensé cette semaine »."""
    troue = build_payload(compte_muet(deux_regies(), muets={"meta": MOT_META},
                                      aujourd_hui=AUJOURD_HUI, etoiles=["Été"]))
    for cle in ("spend", "clicks", "ctr"):
        _v = troue["kpis"][cle]
        # `is None` et pas `== None` : `0 == None` est faux, mais `0` est
        # exactement la valeur qu'on refuse — on vérifie donc le None, pas
        # l'absence de zéro, sinon un `0.0` passerait par la fenêtre du float.
        ok(f"`{cle}` vaut None et jamais 0", _v is None, repr(_v))


# ── 2 · LE VERDICT, QUI EST CE QUE LE CLIENT LIT EN PREMIER ──────────────────

def test_le_verdict_ne_lit_plus_le_trou_comme_un_retrait():
    """Sans la correction, `clicks_delta_pct` vaut -100 % et la phrase publiée
    est « Semaine en retrait — les clics publicitaires (-100 %) »."""
    troue = build_payload(compte_muet(deux_regies(), muets={"meta": MOT_META},
                                      aujourd_hui=AUJOURD_HUI, etoiles=["Été"]))
    verdict = troue["verdict"]
    ok("le verdict ne parle pas de retrait des clics",
       "retrait" not in verdict or "clics publicitaires" not in verdict, verdict)
    ok("aucun pourcentage de clics publicitaires n'est publié",
       troue["verdict_metric"] != "les clics publicitaires",
       repr(troue["verdict_metric"]))
    ok("le verdict nomme la panne", "incomplète" in verdict.lower()
       or "n'a pas répondu" in verdict, verdict)


# ── 3 · LE CLIENT DOIT POUVOIR COMPRENDRE, SINON ON A DÉPLACÉ LE SILENCE ─────

def test_le_payload_porte_le_trou_et_de_quoi_l_expliquer():
    troue = build_payload(compte_muet(deux_regies(), muets={"meta": MOT_META},
                                      aujourd_hui=AUJOURD_HUI, etoiles=["Été"]))
    muets = troue.get("canaux_muets")
    ok("la liste des canaux muets existe", isinstance(muets, list), repr(muets))
    egal("elle porte le seul canal tombé", [m["canal"] for m in muets], ["meta"])
    egal("sous son nom client", muets[0]["nom"], "Meta Ads")
    ok("avec le mot de la fin du worker", MOT_META[:20] in muets[0]["mot"],
       muets[0]["mot"])
    ok("et la date jusqu'à laquelle on a lu", muets[0]["depuis"] is not None)
    egal("et le fait qu'il tait des chiffres", muets[0]["chiffres_tus"], True)


def test_un_compte_sain_porte_une_liste_vide_pas_une_absence():
    """Un écran doit pouvoir distinguer « pas de trou » de « vieux payload »."""
    sain = build_payload(compte_sain(deux_regies(), aujourd_hui=AUJOURD_HUI,
                                     etoiles=["Été"]))
    egal("la clé est là, et vide", sain.get("canaux_muets"), [])


# ── 4 · LES TROIS ÉTATS QUI SE RESSEMBLENT (le piège du ticket) ──────────────

def test_un_canal_jamais_connecte_ne_tait_rien():
    """① jamais connecté — le canal n'existe pas pour ce compte. Aucun trou,
    aucune mention : il n'y a rien à manquer. Un compte 100 % Google doit
    publier ses chiffres comme avant."""
    google_seul = [Campagne("Été – Google", theme="Été", canal="google",
                            depense_jour=20.0, clics_jour=40,
                            impressions_jour=2000, revenu_jour=40.0)]
    p = build_payload(compte_sain(google_seul, aujourd_hui=AUJOURD_HUI,
                                  etoiles=["Été"]))
    ok("la dépense reste un nombre", isinstance(p["kpis"]["spend"], (int, float)),
       repr(p["kpis"]["spend"]))
    egal("et rien n'est déclaré muet", p.get("canaux_muets"), [])


def test_un_canal_muet_qui_n_a_rien_manque_ne_tait_rien():
    """③ le canal a échoué APRÈS avoir écrit la fenêtre entière. Le rapport le
    signale, mais il ne tait aucun chiffre : il n'y a pas de trou à couvrir."""
    p = build_payload(compte_muet(deux_regies(), muets={"meta": MOT_META},
                                  aujourd_hui=AUJOURD_HUI, jours_de_trou=0,
                                  etoiles=["Été"]))
    ok("la dépense reste un nombre",
       isinstance(p["kpis"]["spend"], (int, float)), repr(p["kpis"]["spend"]))
    egal("le canal est signalé", [m["canal"] for m in p["canaux_muets"]], ["meta"])
    egal("mais il ne tait rien", p["canaux_muets"][0]["chiffres_tus"], False)


# ── 5 · LE PIRE CAS : LE COMPTE QUI NE FAIT QUE DU META ──────────────────────

def test_un_compte_meta_seul_au_jeton_mort_recoit_QUAND_MEME_son_rapport():
    """Le cas qui se refermait sur lui-même. `has_data` lit la dépense de la
    fenêtre : Meta muet la met à 0, donc « pas de données », donc aucun rapport
    et aucun email — le silence que ce ticket supprime, reconstitué par une
    autre porte."""
    meta_seul = [Campagne("Été – Meta", theme="Été", canal="meta",
                          depense_jour=40.0, clics_jour=80,
                          impressions_jour=4000, revenu_jour=60.0)]
    p = build_payload(compte_muet(meta_seul, muets={"meta": MOT_META},
                                  aujourd_hui=AUJOURD_HUI, etoiles=["Été"]))
    ok("le rapport est publié malgré tout", p is not None)
    if p:
        egal("sans aucun chiffre de dépense", p["kpis"]["spend"], None)
        egal("et en nommant ce qui manque",
             [m["canal"] for m in p["canaux_muets"]], ["meta"])


# ── 6 · AUCUN CONSEIL PAYANT NE SORT D'UNE SEMAINE TROUÉE ────────────────────

def test_aucun_conseil_payant_n_est_rendu_sur_une_semaine_trouee():
    """`theme_hors_budget` annoncerait « tu es dans ton budget » et
    `theme_deux_regies` conseillerait un transfert vers un canal fantôme."""
    troue = build_payload(compte_muet(deux_regies(), muets={"meta": MOT_META},
                                      aujourd_hui=AUJOURD_HUI, etoiles=["Été"]))
    PAYANTES = {"annonce_chere", "annonce_locomotive", "annonce_sans_conversion",
                "theme_hors_budget", "adset_inegal", "theme_deux_regies",
                "budget_non_depense", "annonce_usee", "page_arrivee_muette",
                "creneau_pub"}
    c = carte(troue, "Été")
    rendus = {r.get("key") for r in ((c or {}).get("cartes") or [])}
    egal("aucune règle payante n'a tourné", sorted(rendus & PAYANTES), [])


# ── 7 · CE QUI NE DÉPEND PAS DU TROU RESTE ENTIER ────────────────────────────

def test_la_semaine_declaree_ne_bouge_pas_parce_qu_un_canal_est_tombe():
    """La fenêtre est ancrée sur la dernière donnée TOUTES SOURCES. Un canal
    muet ne doit pas la faire reculer, sinon le rapport change de semaine à
    chaque panne et l'historique se dédouble."""
    sain = build_payload(compte_sain(deux_regies(), aujourd_hui=AUJOURD_HUI,
                                     etoiles=["Été"]))
    troue = build_payload(compte_muet(deux_regies(), muets={"meta": MOT_META},
                                      aujourd_hui=AUJOURD_HUI, etoiles=["Été"]))
    egal("même semaine publiée", troue["week_start"], sain["week_start"])
    egal("même fenêtre de fin", troue["until"], sain["until"])


if __name__ == "__main__":
    import sys
    for nom, fn in sorted(list(globals().items())):
        if nom.startswith("test_") and callable(fn):
            fn()
    sys.exit(0 if bilan("Ticket 20 — le canal muet") else 1)
