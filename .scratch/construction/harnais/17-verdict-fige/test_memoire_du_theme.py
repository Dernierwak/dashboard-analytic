"""CE QU'UN THÈME A DÉJÀ TENTÉ NE DÉPEND PAS DE CE QUI EST MESURABLE CETTE
SEMAINE.

La mémoire d'un thème (`saas/recos_ia/theme_memoire.py`) est le récit que Gemini
relit avant de proposer l'hypothèse suivante : « trois hypothèses argent, deux
worse une stable ». Elle ne se nourrissait que de la branche MESURÉE — donc une
hypothèse au verdict pourtant déjà rendu tombait du récit dès qu'un `roas`
n'avait pas de revenu rattachable cette semaine, ou dès que son périmètre de
dépense n'était plus le nôtre. Et `condense_theme_memoire` RÉÉCRIT `resume` en
entier : ce n'est pas une fusion, l'hypothèse tombée disparaissait pour de bon.

    python3.12 test_memoire_du_theme.py
"""
import pulse  # noqa: F401
from t import ok, egal, proche, bilan

from gree import action, gree
from saas.traitement.build_report import build_payload


def par_titre(historique):
    return {h["titre"]: h for h in (historique or [])}


# ── 1 · UN VERDICT DÉJÀ RENDU RESTE DANS LE RÉCIT ────────────────────────────

def test_une_hypothese_jugee_reste_sans_mesure_fraiche():
    """Un `roas` sur un thème dont aucune conversion GA4 n'est rattachable
    n'est pas mesurable cette semaine — et n'a pas à l'être : son verdict est
    tombé à sa date, il est en base."""
    lecteur = gree(revenu=None, suivi=[action(
        metric="roas", metric_label="ROAS", direction="up",
        baseline=2.0, verdict="worse", title="Monter le budget")])
    build_payload(lecteur)
    hist = lecteur.historique("Été")
    ok("la mémoire du thème est écrite", hist is not None)
    ok("l'hypothèse jugée y est", "Monter le budget" in par_titre(hist))
    egal("avec son verdict, celui de sa date",
         par_titre(hist).get("Monter le budget", {}).get("verdict"), "worse")


def test_une_hypothese_d_un_autre_perimetre_reste_dans_le_recit():
    """Toutes les lignes `cpc`/`roas` d'avant le 2026-09-19 sont dans ce cas
    depuis le ticket 01 : on ne leur rend plus de verdict automatique, mais
    celui qu'elles ont DÉJÀ reçu jugeait sur le périmètre d'alors et reste vrai
    — on ne rejoue pas l'historique."""
    lecteur = gree(suivi=[action(
        decided_at="2026-09-01", done_at="2026-09-01",
        verdict="stable", title="Décaler la diffusion")])
    build_payload(lecteur)
    hist = par_titre(lecteur.historique("Été"))
    ok("l'hypothèse d'avant la bascule y est", "Décaler la diffusion" in hist)
    egal("avec son verdict figé",
         hist.get("Décaler la diffusion", {}).get("verdict"), "stable")


def test_trois_hypotheses_restent_trois():
    """Le scénario du ticket, en entier : trois hypothèses sur le même thème,
    une seule mesurable aujourd'hui. Le récit doit en porter trois — c'est la
    condensation qui réécrit `resume` en ENTIER qui rend la perte définitive."""
    lecteur = gree(revenu=None, suivi=[
        action(id="a-1", verdict="worse", title="Baisser le budget"),
        action(id="a-2", verdict="better", title="Changer l'audience",
               decided_at="2026-09-01", done_at="2026-09-01"),
        action(id="a-3", metric="roas", metric_label="ROAS", direction="up",
               baseline=2.0, verdict="stable", title="Monter le budget"),
    ])
    build_payload(lecteur)
    egal("les trois sont dans le récit", sorted(par_titre(lecteur.historique("Été"))),
         ["Baisser le budget", "Changer l'audience", "Monter le budget"])
    egal("et elles n'ont demandé QU'UN appel IA", len(lecteur.memoires), 1)


# ── 2 · LE TRIPLET MESURÉ NE PART QU'UNE FOIS ────────────────────────────────

def test_le_chiffre_part_avec_le_verdict_le_jour_de_la_chute():
    """`_mesure_txt` (`theme_memoire.py`) n'écrit « CPC passé de 0,4 à 0,3 »
    que si `depart`/`constate` sont là. Le jour de la chute, ils le sont."""
    lecteur = gree(suivi=[action()])
    build_payload(lecteur)
    item = par_titre(lecteur.historique("Été"))["Baisser le budget de la Search"]
    proche("le départ est la baseline", item.get("depart"), 0.40)
    proche("le constaté est le CPC du jour de la chute", item.get("constate"), 0.30)
    egal("l'indicateur est nommé", item.get("indicateur"), "CPC")


def test_le_chiffre_ne_repart_pas_les_semaines_suivantes():
    """Trois mois plus tard, ce `constate` mesurerait la dérive du compte, pas
    l'idée : un chiffre non mérité (`CLAUDE.md` § 7). Seul le verdict reste."""
    lecteur = gree(suivi=[action(verdict="worse")])
    build_payload(lecteur)
    item = par_titre(lecteur.historique("Été"))["Baisser le budget de la Search"]
    egal("le verdict est là", item.get("verdict"), "worse")
    for champ in ("depart", "constate", "variation", "indicateur"):
        ok(f"pas de `{champ}`", item.get(champ) is None, f"{champ} = {item.get(champ)!r}")


def test_un_verdict_refuse_ne_verse_aucun_chiffre_dans_la_memoire():
    """Un refus RLS sur l'`update` ne lève rien et touche zéro ligne
    (`CLAUDE.md` § 8). La colonne reste vide, donc la ligne sera REMESURÉE au
    rapport suivant : verser son triplet maintenant remettrait dans le prompt
    de Gemini le chiffre qui dérive de semaine en semaine — la dérive déplacée
    d'un cran au lieu d'être retirée. On se tait, la mémoire attend."""
    lecteur = gree(suivi=[action()], verdict_refuse=True)
    build_payload(lecteur)
    hist = lecteur.historique("Été") or []
    egal("rien n'entre dans le récit", par_titre(hist), {})


def test_une_ecriture_qui_prend_verse_bien_le_chiffre():
    """La preuve que le test précédent ne passe pas pour la mauvaise raison :
    même compte, écriture acceptée, le triplet part."""
    lecteur = gree(suivi=[action()])
    build_payload(lecteur)
    ok("l'hypothèse est dans le récit",
       "Baisser le budget de la Search" in par_titre(lecteur.historique("Été")))


def test_le_levier_ne_se_devine_jamais():
    """Une ligne posée avant que `detail.levier` existe reste « levier
    inconnu » — jamais un levier déduit de l'indicateur."""
    lecteur = gree(suivi=[action(verdict="worse", detail={})])
    build_payload(lecteur)
    item = par_titre(lecteur.historique("Été"))["Baisser le budget de la Search"]
    egal("aucun levier inventé", item.get("levier"), None)


if __name__ == "__main__":
    for nom, fn in sorted(list(globals().items())):
        if nom.startswith("test_"):
            fn()
    raise SystemExit(0 if bilan("La mémoire du thème") else 1)
