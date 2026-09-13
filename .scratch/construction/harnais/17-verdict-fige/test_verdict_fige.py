"""LE VERDICT SE REND UNE FOIS — et c'est vérifié en faisant TOURNER le rapport.

Le ticket 17 de la construction part d'une prémisse écrite dans le code et
fausse : *« lui n'a pas dérivé, il a été figé à sa date »*. Vingt lignes plus
bas, la même branche réécrivait `verdict` à chaque rapport avec une valeur
recalculée contre le KPI du jour. Une ligne FAITE reste `due` pour toujours :
la colonne se réécrivait donc toutes les semaines, et un `worse` de juin
redevenait `better` en septembre parce que le compte avait bougé — pas parce
que l'hypothèse avait marché.

Ce fichier tient la propriété par les deux bouts : ce que la construction ÉCRIT
en base, et ce qu'elle SERT au client.

    python3.12 test_verdict_fige.py
"""
import pulse  # noqa: F401
from t import ok, egal, proche, bilan

from gree import CPC_DU_THEME, DECIDE_LE, ECHEANCE, action, gree, theme_plan
from saas.traitement.build_report import build_payload


def juges(payload):
    return {v["id"]: v for v in (payload.get("tracking") or {}).get("verified", [])}


def a_juger(payload):
    return {r["id"]: r for r in (payload.get("tracking") or {}).get("running", [])}


# ── 1 · LE JOUR DE LA CHUTE : on mesure, on sert, on écrit ───────────────────

def test_le_verdict_tombe_et_s_ecrit_une_fois():
    """Colonne vide + échéance passée : c'est le seul instant où un verdict se
    calcule. Le CPC du thème vaut 0,30 (30 CHF ÷ 100 clics par jour), la
    baseline 0,40 : -25 % sur un indicateur qu'on veut voir BAISSER."""
    lecteur = gree(suivi=[action()])
    p = build_payload(lecteur)
    v = juges(p).get("a-1")
    ok("l'action est jugée", v is not None)
    egal("le verdict est rendu", v and v["verdict"], "better")
    proche("il se mesure contre le CPC du thème", v and v["now"], CPC_DU_THEME)
    proche("et part de la baseline photographiée", v and v["then"], 0.40)
    proche("la variation est celle des deux", v and v["delta"], -25.0)
    egal("il est écrit en base, une fois", lecteur.verdicts_ecrits(),
         [("a-1", "better")])


# ── 2 · LES SEMAINES SUIVANTES : plus rien ne bouge ──────────────────────────

def test_un_verdict_deja_rendu_n_est_jamais_reecrit():
    """Le scénario du ticket, à l'envers du chiffre : la colonne dit `worse`,
    le compte s'est redressé depuis, une remesure dirait `better`. C'est
    exactement le mensonge qu'on refuse — le levier « argent » passerait pour
    gagnant auprès de Gemini et de `_DONE_W`."""
    lecteur = gree(suivi=[action(verdict="worse")])
    p = build_payload(lecteur)
    egal("aucune écriture n'est tentée", lecteur.verdicts_ecrits(), [])
    v = juges(p).get("a-1")
    ok("l'action reste dans les jugées", v is not None)
    egal("et elle garde SON verdict", v and v["verdict"], "worse")


def test_une_remesure_aurait_dit_l_inverse():
    """La preuve que le test précédent n'est pas gagné d'avance : sur le MÊME
    compte, colonne vide, le rapport rend `better`."""
    lecteur = gree(suivi=[action()])
    egal("le verdict recalculé contredit le verdict figé",
         juges(build_payload(lecteur))["a-1"]["verdict"], "better")


def test_le_triplet_ne_repart_pas_avec_une_mesure_du_jour():
    """`then/now/delta` n'est servi que la semaine de la chute. Rattaché plus
    tard à la même idée, ce `now`-là mesurerait la dérive du compte depuis, pas
    l'action (`CLAUDE.md` § 7). L'écran écrit alors « on suit le CPC »."""
    v = juges(build_payload(gree(suivi=[action(verdict="worse")])))["a-1"]
    for champ in ("then", "now", "delta"):
        ok(f"pas de `{champ}` sur une action déjà jugée", champ not in v,
           f"{champ} = {v.get(champ)!r}")
    egal("l'indicateur suivi reste nommé", v.get("metric_label"), "CPC")


def test_deux_rapports_de_suite_rendent_le_meme_verdict():
    """La propriété du ticket, jouée comme elle se produit en vrai : le rapport
    de la semaine A écrit le verdict, celui de la semaine B le relit sur la
    ligne. Rien ne se réécrit, et rien ne change de valeur."""
    semaine_a = gree(suivi=[action()])
    rendu_a = juges(build_payload(semaine_a))["a-1"]["verdict"]
    (ligne_id, verdict_ecrit), = semaine_a.verdicts_ecrits()
    semaine_b = gree(suivi=[action(id=ligne_id, verdict=verdict_ecrit)])
    rendu_b = juges(build_payload(semaine_b))["a-1"]["verdict"]
    egal("le second rapport rend le même verdict", rendu_b, rendu_a)
    egal("et n'écrit rien du tout", semaine_b.verdicts_ecrits(), [])


# ── 3 · CE QUI N'A PAS DE VERDICT N'EN REÇOIT TOUJOURS PAS ───────────────────

def test_une_action_pas_encore_a_echeance_n_ecrit_rien():
    lecteur = gree(suivi=[action(check_at="2026-12-01")])
    p = build_payload(lecteur)
    egal("rien n'est écrit", lecteur.verdicts_ecrits(), [])
    ok("elle reste en cours", "a-1" in a_juger(p))


def test_une_action_seulement_decidee_n_ecrit_rien():
    """`running`, c'est décidé mais pas fait. Mesurer l'effet d'un geste que
    personne n'a posé attribuerait un mouvement au hasard."""
    lecteur = gree(suivi=[action(status="running", done_at=None)])
    build_payload(lecteur)
    egal("rien n'est écrit", lecteur.verdicts_ecrits(), [])


def test_une_baseline_d_avant_la_bascule_pub_reste_sans_verdict():
    """Une hypothèse `cpc` décidée avant le 2026-09-19 porte une baseline prise
    sur la dépense Meta SEULE : elle finit « à juger soi-même », et surtout pas
    avec un verdict pris sur deux périmètres (ticket 01)."""
    lecteur = gree(suivi=[action(decided_at="2026-09-01", done_at="2026-09-01")])
    p = build_payload(lecteur)
    egal("rien n'est écrit", lecteur.verdicts_ecrits(), [])
    egal("et le client est invité à juger lui-même",
         a_juger(p).get("a-1", {}).get("due"), True)


if __name__ == "__main__":
    for nom, fn in sorted(list(globals().items())):
        if nom.startswith("test_"):
            fn()
    raise SystemExit(0 if bilan("Le verdict figé") else 1)
