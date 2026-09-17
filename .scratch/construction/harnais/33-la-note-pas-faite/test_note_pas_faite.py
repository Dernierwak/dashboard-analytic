"""Une note qu'on n'a pas encore faite ne marque pas la frise (ticket 33).

Un repère ▲ dit « le client a décidé ceci, et ça sera jugé » — c'est écrit dans
`build_report.py` juste au-dessus de la lecture qui les pose. Une Note née
`running` est ce que le client COMPTE faire : son `decided_at` est le jour de
l'ÉCRITURE, posé par `saveNoteOuverte`, et destiné à être RÉÉCRIT au jour choisi
lors du cochage (`CONTEXT.md`, entrée Note). La poser sur la frise attribue un
mouvement de courbe à un geste jamais fait — `CLAUDE.md` §7.

CE QUE CE HARNAIS VÉRIFIE VRAIMENT. Il ne lit pas le texte du filtre : il
construit un payload avec `build_payload` et regarde les repères qui en
sortent — sur la frise du thème (`themes_focus[].series.marqueurs`) ET sur la
courbe de la boussole (`kpi_focus.marqueurs`), les deux lectures du même dict.

LA NON-VACUITÉ EST TESTÉE. Chaque ligne écartée est rejouée en version admise,
MÊME DATE, MÊME THÈME — seul `status`/`done_at` change. Sans ça, un test vert ne
dirait pas si le filtre marche ou si la date tombait hors fenêtre.

    python3.12 test_note_pas_faite.py
"""
from datetime import date, timedelta

import pulse  # noqa: F401
from t import ok, egal, bilan

from lecteur_fige import compte, Campagne
from saas.traitement.build_report import build_payload

AUJOURD_HUI = date(2026, 9, 13)
DERNIER_JOUR_PLEIN = AUJOURD_HUI - timedelta(days=1)   # 2026-09-12
THEME = "Été"

# Les dix semaines de la frise et de la boussole partagent le même découpage :
# elles finissent toutes deux au dernier jour plein. Une semaine par ligne
# testée, pour que chaque repère garde son TITRE — `_reperes` efface le titre
# dès que deux actions tombent la même semaine.
def _jour_de_la_semaine(index):
    """Le milieu de la semaine n° `index` (0 = la plus ancienne des dix)."""
    debut = DERNIER_JOUR_PLEIN - timedelta(days=7 * 10 - 1)
    return (debut + timedelta(days=7 * index + 3)).isoformat()


SEMAINE_NOTE = _jour_de_la_semaine(4)
SEMAINE_NOTE_FAITE = _jour_de_la_semaine(5)
SEMAINE_ACTION = _jour_de_la_semaine(6)
SEMAINE_AUTO = _jour_de_la_semaine(7)


def ligne(titre, jour, **champs):
    """Une ligne de `suivi_actions`. Par défaut : une hypothèse ordinaire,
    décidée ce jour-là et pas encore faite."""
    base = {"id": titre, "title": titre, "theme": THEME,
            "reco_key": "gaspillage", "metric": "cpc", "metric_label": "CPC",
            "direction": "down", "baseline": 0.40,
            "status": "running", "decided_at": jour, "done_at": None,
            "check_at": jour, "verdict": None, "detail": {"levier": "argent"}}
    base.update(champs)
    return base


def note_pas_faite(titre=u"Refaire les visuels", jour=SEMAINE_NOTE):
    """Ce que `saveNoteOuverte` écrit : une Note `running`, sans indicateur, qui
    porte DÉJÀ un `decided_at` — le jour où on l'a tapée."""
    return ligne(titre, jour, kind="note", metric=None, metric_label=None,
                 baseline=None, direction=None, detail={})


def note_cochee(titre=u"Visuels refaits", jour=SEMAINE_NOTE_FAITE,
                tapee_le=SEMAINE_NOTE):
    """Ce que `completeNote` écrit VRAIMENT — relu dans
    `saas/web/app/actions.ts` l. 635 plutôt que supposé :

        .update({ status: "archived", decided_at: quand, check_at: quand })

    Trois faits que ce harnais s'est trompé à croire avant de les lire, et qui
    décident de ce qu'il vaut :

      · le cochage écrit `archived`, **pas** `done` ;
      · il RÉÉCRIT `decided_at` au jour choisi — c'est bien lui, et non un
        champ ajouté à côté, qui porte la date du fait ;
      · il ne pose **aucun** `done_at`. Seul `resolveAction(id,"done")` en
        écrit un, et il ne passe jamais sur une note.

    Le repère d'une note cochée vient donc du `decided_at` réécrit, pas du
    `done_at` de la ligne du dessus dans `build_report.py`.
    """
    return ligne(titre, jour, kind="note", metric=None, metric_label=None,
                 baseline=None, direction=None, detail={},
                 status="archived", done_at=None)


def payload(suivi):
    return build_payload(compte(
        [Campagne(f"{THEME} – Search", theme=THEME, depense_jour=30.0,
                  clics_jour=100, impressions_jour=4000, revenu_jour=40.0)],
        etoiles=[THEME], aujourd_hui=AUJOURD_HUI, suivi=list(suivi)))


def titres_de_la_frise(p):
    for t in p["themes_focus"]:
        if t["label"] == THEME:
            serie = t.get("series") or {}
            return [m["titre"] for m in (serie.get("marqueurs") or [])]
    return None


def titres_de_la_boussole(p):
    focus = p.get("kpi_focus") or {}
    return [m["titre"] for m in (focus.get("marqueurs") or [])]


# ── 1 · LE HARNAIS SAIT VOIR UN REPÈRE ───────────────────────────────────────
#
# Sans ce premier test, tous les suivants passeraient sur un payload sans frise.

def test_une_action_ordinaire_pose_bien_son_repere_des_deux_cotes():
    p = payload([ligne("Baisser le budget Search", SEMAINE_ACTION)])
    ok("la frise du thème existe", titres_de_la_frise(p) is not None,
       "pas de carte de thème, ou pas de série")
    egal("elle porte le repère de l'action", titres_de_la_frise(p),
         ["Baisser le budget Search"])
    egal("la boussole aussi", titres_de_la_boussole(p),
         ["Baisser le budget Search"])


# ── 2 · LA NOTE PAS ENCORE FAITE NE MARQUE RIEN ──────────────────────────────

def test_une_note_running_ne_pose_aucun_repere():
    p = payload([note_pas_faite()])
    egal("rien sur la frise du thème", titres_de_la_frise(p), [])
    egal("rien sur la courbe de la boussole", titres_de_la_boussole(p), [])


def test_la_meme_note_cochee_pose_son_repere():
    """LA NON-VACUITÉ DU TEST PRÉCÉDENT. Même ligne, même thème : seul le
    cochage change. Si celle-ci ne marquait rien non plus, le test d'au-dessus
    ne prouverait que l'absence de frise."""
    p = payload([note_cochee(jour=SEMAINE_NOTE)])
    egal("une note cochée marque la frise", titres_de_la_frise(p),
         [u"Visuels refaits"])
    egal("et la boussole", titres_de_la_boussole(p), [u"Visuels refaits"])


def test_une_note_cochee_marque_le_jour_choisi_pas_le_jour_de_l_ecriture():
    """Le cochage RÉÉCRIT `decided_at` au jour choisi. La ligne tapée en
    semaine 4 et cochée « c'était en semaine 5 » doit marquer la semaine 5 —
    sinon la frise expliquerait une courbe par un geste daté du jour où on
    en a parlé."""
    cochee = note_cochee(jour=SEMAINE_NOTE_FAITE)
    egal("le cochage n'a posé aucun done_at", cochee["done_at"], None)
    marqueurs = []
    for t in payload([cochee])["themes_focus"]:
        if t["label"] == THEME:
            marqueurs = (t.get("series") or {}).get("marqueurs") or []
    egal("un seul repère", [m["titre"] for m in marqueurs], [u"Visuels refaits"])
    egal("posé au jour choisi", marqueurs[0]["date"], SEMAINE_NOTE_FAITE)
    ok("et pas au jour de la frappe", marqueurs[0]["date"] != SEMAINE_NOTE,
       f"le repère est resté au {SEMAINE_NOTE}")


# ── 3 · CE QUE LE FILTRE NE DOIT PAS EMPORTER ────────────────────────────────
#
# Consigne de repli du ticket : le filtre seul. Les deux autres gardes ont leur
# raison écrite et ne se re-litigent pas — ces tests les épinglent.

def test_une_hypothese_running_garde_son_repere():
    """Une action ordinaire décidée est un FAIT : le client a décidé, son
    `decided_at` est le jour de la décision et ne sera pas réécrit. Elle n'est
    pas une note, le filtre ne doit pas la toucher."""
    p = payload([ligne("Décidée, pas encore faite", SEMAINE_ACTION)])
    egal("elle marque la frise", titres_de_la_frise(p),
         ["Décidée, pas encore faite"])


def test_une_hypothese_auto_sans_done_at_reste_exclue():
    """Le garde du ticket 06, intact."""
    p = payload([ligne("Hypothèse jamais confirmée", SEMAINE_AUTO,
                       detail={"origin": "auto"})])
    egal("aucun repère", titres_de_la_frise(p), [])


def test_une_hypothese_auto_faite_garde_son_repere():
    """L'autre moitié du même garde : un `done_at` est la preuve d'un vrai clic
    « ✓ Je l'ai fait », quelle que soit l'origine de la ligne."""
    p = payload([ligne("Hypothèse auto, faite", SEMAINE_AUTO,
                       status="done", done_at=SEMAINE_AUTO,
                       detail={"origin": "auto"})])
    egal("le repère est là", titres_de_la_frise(p), ["Hypothèse auto, faite"])


# ── 4 · LE MÉLANGE, TEL QU'UN VRAI COMPTE LE PORTE ───────────────────────────

def test_un_compte_mele_ne_garde_que_les_faits():
    p = payload([
        note_pas_faite(u"Il faudrait refaire les visuels", SEMAINE_NOTE),
        ligne("Baisser le budget Search", SEMAINE_ACTION),
        ligne("Hypothèse jamais confirmée", SEMAINE_AUTO,
              detail={"origin": "auto"}),
    ])
    egal("seule l'action décidée marque la frise", titres_de_la_frise(p),
         ["Baisser le budget Search"])
    egal("et la boussole", titres_de_la_boussole(p),
         ["Baisser le budget Search"])


def test_une_note_pas_faite_ne_vide_pas_les_repere_des_autres():
    """Le piège nommé par le ticket : un filtre posé DANS la requête ferait
    lever l'`except` sur une base sans colonne `kind`, et viderait TOUS les
    repères en silence. Ici la note est écartée, la voisine reste."""
    p = payload([
        note_pas_faite(u"Refaire les visuels", SEMAINE_NOTE),
        ligne("Baisser le budget Search", SEMAINE_ACTION),
    ])
    egal("la voisine survit", titres_de_la_frise(p),
         ["Baisser le budget Search"])


for nom, fn in sorted(list(globals().items())):
    if nom.startswith("test_") and callable(fn):
        fn()

raise SystemExit(0 if bilan("Ticket 33 — la note pas encore faite") else 1)
