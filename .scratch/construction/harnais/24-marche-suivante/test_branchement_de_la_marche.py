"""La Marche suivante DANS `build_payload`, exécutée — pas lue sur le texte.

Le seam du ticket 16 est ouvert : `build_payload(lecteur)` tourne hors ligne sur
des lignes fixes, et `LecteurFige.redige` est le seul endroit par où Gemini
entre. On lui fait donc dire exactement ce qu'on veut, et on lit ce qui arrive
— ou n'arrive pas — sur la carte du thème.

Ce que ce fichier prouve, et qu'aucun test de module ne peut prouver :

  · sans Stratégie ouverte par une RÈGLE, Gemini n'est même pas appelé ;
  · sans clic « ✓ Je l'ai fait » sur la Marche précédente, non plus ;
  · une Stratégie ouverte par une piste `ai_` d'avant la coupe ne rouvre rien ;
  · quand les deux conditions sont réunies, la Marche sort sur la carte du
    thème, avec sa grammaire déclarée intacte ;
  · et elle n'écrit RIEN dans `theme_plan` — la barrière la plus importante,
    vérifiée sur les écritures réellement tentées par la construction.
"""
import json
from datetime import date

import pulse  # noqa: F401
from t import ok, egal, bilan

from lecteur_fige import compte, Campagne, Annonce
from saas.recos_ia.marche_suivante import CONFIANCE, cle_de
from saas.traitement.build_report import build_payload

AUJOURD_HUI = date(2026, 9, 13)
THEME = "Été"


def campagne(theme=THEME):
    """Assez de dépense pour être jugée, deux Annonces dont une ne convertit
    pas — le compte de référence des harnais 07/10/16."""
    return Campagne(
        f"{theme} – Search", theme=theme, depense_jour=30.0, clics_jour=100,
        impressions_jour=4000, revenu_jour=40.0,
        annonces=[Annonce(f"{theme} · visuel A", "Groupe 1", 140, 350, 14000, 7),
                  Annonce(f"{theme} · visuel B", "Groupe 1", 70, 175, 7000, 0)])


# La piste que notre faux Gemini rend. `cible` est une Annonce que la récolte a
# réellement rangée sous ce thème — sans ça, la barrière 3 la jetterait, et le
# test ne prouverait plus rien du branchement.
PISTE = {
    "titre": "Réécris l'accroche du visuel B",
    "observation": "Le visuel A est en place. L'accroche du B vient ensuite.",
    "pourquoi": "Deux annonces du même Groupe se départagent sur ce qu'elles disent.",
    "verifier": "Ouvre le gestionnaire et relis le texte de l'annonce.",
    "angle_mort": "Ça ne dit rien de l'audience qui la voit.",
    "cible": f"{THEME} · visuel B",
    "nature": "corriger", "role": "generale", "levier": "contenu",
    "metric": "roas", "effort": "1 h",
}
CLE = cle_de(PISTE["titre"])

PLAN_REGLE = {
    "theme": THEME, "reco_key": "orga_essoufflement", "levier": "contenu",
    "decided_at": "2026-08-20", "resume": "Une hypothèse testée, stable.",
    "snapshot": {"key": "orga_essoufflement", "platform": "instagram",
                 "title": "Reviens à ta cadence d'avant", "role": "hypothese"},
}

FAIT = {"reco_key": "orga_essoufflement", "theme": THEME, "status": "done",
        "title": "Reviens à ta cadence d'avant", "decided_at": "2026-08-20",
        "done_at": "2026-09-01", "check_at": "2026-09-15"}


def gree(*, plan=None, suivi=(), reponse=None, publies=()):
    """Un compte d'un seul thème étoilé, gréé pour ce ticket.

    `reponse` est ce que Gemini rend. `None` = pas de clé, comme le défaut du
    faux lecteur. Les prompts vus sont enregistrés pour pouvoir prouver
    l'ABSENCE d'appel, qui est la moitié des barrières.
    """
    prompts = []

    def redige(p):
        prompts.append(p)
        return reponse

    lecteur = compte([campagne()], etoiles=[THEME], aujourd_hui=AUJOURD_HUI,
                     plan_de_theme=dict(plan or {}), suivi=list(suivi),
                     rapports_publies=list(publies), redige=redige)
    return lecteur, prompts, build_payload(lecteur)


def marches(payload):
    """Les Marches écrites par Gemini, sur toutes les cartes de thème."""
    return [r for t in payload["themes_focus"] for r in t["recos"]
            if str(r.get("key") or "").startswith("marche_")]


def prompts_de_marche(prompts):
    """Les prompts qui sont bien ceux de la Marche suivante — le rapport en
    passe d'autres à Gemini (le brief, les astuces, le ton)."""
    return [p for p in prompts if "L'ÉTAPE SUIVANTE" in p]


# ── LA BARRIÈRE 1, VUE DEPUIS LE RAPPORT : PAS D'APPEL SANS STRATÉGIE ────────

def test_sans_plan_de_theme_gemini_n_est_pas_appele():
    """Aucune Stratégie ouverte : il n'y a aucune Marche à continuer, et on ne
    paie pas un appel pour se le faire dire."""
    _, prompts, payload = gree(suivi=[FAIT], reponse=json.dumps(PISTE))
    egal("aucun prompt de Marche", len(prompts_de_marche(prompts)), 0)
    egal("et aucune Marche servie", len(marches(payload)), 0)


def test_sans_clic_fait_gemini_n_est_pas_appele():
    """« La suivante n'arrive que lorsque la précédente est faite »
    (`CONTEXT.md`, entrée Marche). Une Stratégie ouverte dont personne n'a
    confirmé la Marche n'avance pas."""
    _, prompts, payload = gree(plan={THEME.lower(): PLAN_REGLE},
                               suivi=[], reponse=json.dumps(PISTE))
    egal("aucun prompt de Marche", len(prompts_de_marche(prompts)), 0)
    egal("aucune Marche servie", len(marches(payload)), 0)


def test_une_ligne_en_cours_sans_done_at_ne_fait_pas_avancer():
    """`status="running"`, ou un vieux `"done"` d'avant la migration `done_at` :
    dans les deux cas il n'y a PAS eu de clic « ✓ Je l'ai fait » qu'on sache
    dater. Faire avancer une Stratégie dessus attribuerait un pas à un geste
    jamais confirmé (`CLAUDE.md` §7)."""
    for ligne in (dict(FAIT, status="running", done_at=None),
                  {k: v for k, v in FAIT.items() if k != "done_at"}):
        _, prompts, payload = gree(plan={THEME.lower(): PLAN_REGLE},
                                   suivi=[ligne], reponse=json.dumps(PISTE))
        egal("aucun prompt de Marche", len(prompts_de_marche(prompts)), 0)
        egal("aucune Marche servie", len(marches(payload)), 0)


def test_une_strategie_ouverte_par_une_piste_ai_ne_rouvre_rien():
    """Une piste rédigée par Gemini AVANT la coupe de la refonte 11 est encore
    en base. La continuer remettrait à l'écran exactement ce que la décision
    retire — même garde que le blocage de fenêtre, plus bas dans le rapport."""
    plan = dict(PLAN_REGLE, reco_key="ai_piste_2026_07")
    _, prompts, payload = gree(plan={THEME.lower(): plan},
                               suivi=[dict(FAIT, reco_key="ai_piste_2026_07")],
                               reponse=json.dumps(PISTE))
    egal("aucun prompt de Marche", len(prompts_de_marche(prompts)), 0)
    egal("aucune Marche servie", len(marches(payload)), 0)


# ── LE CAS QUI PASSE, DE BOUT EN BOUT ────────────────────────────────────────

def test_stratégie_ouverte_et_marche_faite_font_sortir_la_suivante():
    _, prompts, payload = gree(plan={THEME.lower(): PLAN_REGLE},
                               suivi=[FAIT], reponse=json.dumps(PISTE))
    egal("un seul prompt de Marche", len(prompts_de_marche(prompts)), 1)
    m = marches(payload)
    egal("une Marche servie", len(m), 1)
    egal("sa clé porte l'étape", m[0]["key"], CLE)
    egal("son titre est celui écrit", m[0]["title"], PISTE["titre"])
    egal("elle vise l'Annonce nommée", m[0]["cible"], PISTE["cible"])
    egal("elle se dit écrite par l'IA", m[0]["source"], "ai")
    egal("sa confiance est celle du code", m[0]["confidence"], CONFIANCE)


def test_sa_grammaire_declaree_traverse_le_rapport_intacte():
    """`_attach_grammaire` ne REMPLACE jamais une valeur déjà là, et
    `_attach_effort` non plus : ce que Gemini a déclaré est ce qui sort."""
    _, _, payload = gree(plan={THEME.lower(): PLAN_REGLE}, suivi=[FAIT],
                         reponse=json.dumps(PISTE))
    m = marches(payload)[0]
    egal("le geste", m["nature"], "corriger")
    egal("la preuve", m["role"], "generale")
    egal("le levier", m["levier"], "contenu")
    egal("l'indicateur", m["metric"], "roas")
    egal("l'effort déclaré n'est pas écrasé par le défaut", m["effort"], "1 h")
    egal("le canal vient de la Stratégie", m["platform"], "instagram")


def test_son_indicateur_recoit_une_baseline_mesuree():
    """Le seul chiffre de la carte, et il n'est pas écrit par Gemini :
    `_attach_metric` photographie le ROAS du thème lui-même."""
    _, _, payload = gree(plan={THEME.lower(): PLAN_REGLE}, suivi=[FAIT],
                         reponse=json.dumps(PISTE))
    m = marches(payload)[0]
    egal("le libellé vient de `METRIC_INFO`", m["metric_label"], "ROAS")
    egal("et son sens aussi", m["direction"], "up")
    ok("une baseline est posée", m.get("baseline") is not None)


def test_le_prompt_nomme_les_objets_du_theme_et_lui_seul():
    _, prompts, _ = gree(plan={THEME.lower(): PLAN_REGLE}, suivi=[FAIT],
                         reponse=json.dumps(PISTE))
    p = prompts_de_marche(prompts)[0]
    ok("l'Annonce A du thème", f"{THEME} · visuel A" in p)
    ok("l'Annonce B du thème", f"{THEME} · visuel B" in p)
    ok("l'étape terminée", FAIT["title"] in p)
    ok("la mémoire du thème", "Une hypothèse testée, stable." in p)


# ── LA BARRIÈRE LA PLUS IMPORTANTE : RIEN N'ENTRE DANS `theme_plan` ──────────

def test_une_marche_de_gemini_n_ouvre_aucune_strategie():
    """`LecteurFige` enregistre ce que la construction a VOULU écrire au lieu de
    le jouer : on lit donc l'écriture elle-même, pas son absence supposée.

    La seule écriture acceptable ici serait celle d'une RÈGLE qui pose une
    Hypothèse — jamais une ligne dont la clé commence par `marche_`.
    """
    lecteur, _, _ = gree(plan={THEME.lower(): PLAN_REGLE}, suivi=[FAIT],
                         reponse=json.dumps(PISTE))
    plans = [e for e in lecteur.ecrits if e[0] == "plan_de_theme"]
    ok("aucun plan écrit sur une clé de Marche",
       all(not str(e[2]).startswith("marche_") for e in plans),
       f"écrits : {plans}")


def test_une_piste_hors_liste_fermee_ne_sort_pas_du_tout():
    """Le rejet porte sur la piste ENTIÈRE, jusque sur la carte : une seule
    colonne fausse et il ne reste RIEN, pas une carte rafistolée."""
    for champ, hors in (("nature", "vérifier"), ("role", "hypothese"),
                        ("levier", "socle"), ("metric", "sessions"),
                        ("effort", "45 min"), ("cible", "Campagne fantôme")):
        piste = dict(PISTE)
        piste[champ] = hors
        _, prompts, payload = gree(plan={THEME.lower(): PLAN_REGLE},
                                   suivi=[FAIT], reponse=json.dumps(piste))
        egal(f"`{champ}`={hors!r} : Gemini a bien été appelé",
             len(prompts_de_marche(prompts)), 1)
        egal(f"`{champ}`={hors!r} : et rien n'est servi", len(marches(payload)), 0)


def test_une_panne_de_gemini_ne_casse_pas_le_rapport():
    """Le défaut du faux lecteur, c'est Gemini sans clé — `redige` rend `None`.
    Le rapport doit sortir entier, simplement sans sa Marche."""
    _, prompts, payload = gree(plan={THEME.lower(): PLAN_REGLE}, suivi=[FAIT])
    egal("l'appel a bien eu lieu", len(prompts_de_marche(prompts)), 1)
    egal("aucune Marche", len(marches(payload)), 0)
    ok("mais la carte du thème est là",
       any(t["label"] == THEME for t in payload["themes_focus"]))


# ── ELLE CONCOURT, ELLE N'EST PAS UNE PLACE RÉSERVÉE ─────────────────────────

def test_elle_passe_les_memes_filtres_que_les_regles():
    """Le tri et le plafond appartiennent au ticket 08 et ne sont pas touchés :
    la Marche entre AVANT eux. La preuve qu'elle n'a pas de passe-droit est
    qu'une empreinte déjà servie la fait tomber comme n'importe quel conseil."""
    deja = [{"week_start": "2026-09-06",
             "payload": {"themes_focus": [{"label": THEME, "recos": [
                 {"key": CLE, "cible": PISTE["cible"]}]}]}}]
    prompts = []

    def redige(p):
        prompts.append(p)
        return json.dumps(PISTE)

    # Le clic est POSTÉRIEUR au rapport publié : sans ça, c'est la borne « un
    # clic, une Marche » qui ferait tomber la piste, et ce test ne dirait plus
    # rien de l'empreinte qu'il est censé prouver.
    lecteur = compte([campagne()], etoiles=[THEME], aujourd_hui=AUJOURD_HUI,
                     plan_de_theme={THEME.lower(): PLAN_REGLE},
                     suivi=[dict(FAIT, done_at="2026-09-08")],
                     rapports_publies=deja, redige=redige)
    payload = build_payload(lecteur)
    egal("Gemini a été appelé", len(prompts_de_marche(prompts)), 1)
    egal("mais la même instruction ne repasse pas", len(marches(payload)), 0)


# ── UNE NOTE N'EST PAS UNE MARCHE ────────────────────────────────────────────

def test_une_note_cochee_ne_fait_pas_avancer_une_strategie():
    """Depuis que le module « À faire » sait créer une ligne de suivi,
    `suivi_actions` ramène des Notes. Une Note n'a ni indicateur, ni baseline,
    ni Stratégie derrière elle : cocher un texte libre ne descend aucune
    échelle."""
    note = dict(FAIT, kind="note", reco_key="note_2026_09",
                title="J'ai refait la bannière", done_at="2026-09-02")
    _, prompts, payload = gree(plan={THEME.lower(): PLAN_REGLE},
                               suivi=[note], reponse=json.dumps(PISTE))
    egal("aucun prompt de Marche", len(prompts_de_marche(prompts)), 0)
    egal("aucune Marche servie", len(marches(payload)), 0)


def test_la_note_ne_masque_pas_une_vraie_marche_faite():
    """Le filtre RETIRE les notes, il n'écarte pas le thème : une vraie Marche
    faite à côté d'une Note fait toujours avancer la Stratégie."""
    note = dict(FAIT, kind="note", reco_key="note_2026_09",
                title="J'ai refait la bannière", done_at="2026-09-02")
    _, prompts, payload = gree(plan={THEME.lower(): PLAN_REGLE},
                               suivi=[note, FAIT], reponse=json.dumps(PISTE))
    egal("un prompt de Marche", len(prompts_de_marche(prompts)), 1)
    egal("une Marche servie", len(marches(payload)), 1)
    ok("et c'est la vraie étape qui est annoncée terminée",
       FAIT["title"] in prompts_de_marche(prompts)[0])
    ok("pas la note", "refait la bannière" not in prompts_de_marche(prompts)[0])


# ── UN CLIC FAIT AVANCER D'UNE MARCHE, PAS D'UNE PAR SEMAINE ─────────────────

def rapport_publie(semaine):
    return {"week_start": semaine, "payload": {"themes_focus": []}}


def test_un_vieux_clic_ne_refait_pas_avancer_chaque_semaine():
    """Sans cette borne, un seul « ✓ Je l'ai fait » posé il y a six mois faisait
    écrire une étape neuve CHAQUE semaine — et comme chaque étape porte sa
    propre clé, l'empreinte anti-répétition ne les voyait jamais passer."""
    _, prompts, payload = gree(plan={THEME.lower(): PLAN_REGLE},
                               suivi=[dict(FAIT, done_at="2026-03-02")],
                               publies=[rapport_publie("2026-08-31")],
                               reponse=json.dumps(PISTE))
    egal("aucun prompt de Marche", len(prompts_de_marche(prompts)), 0)
    egal("aucune Marche servie", len(marches(payload)), 0)


def test_un_clic_depuis_le_dernier_rapport_fait_avancer():
    _, prompts, payload = gree(plan={THEME.lower(): PLAN_REGLE},
                               suivi=[dict(FAIT, done_at="2026-09-03")],
                               publies=[rapport_publie("2026-08-31")],
                               reponse=json.dumps(PISTE))
    egal("un prompt de Marche", len(prompts_de_marche(prompts)), 1)
    egal("une Marche servie", len(marches(payload)), 1)


def test_sans_rapport_publie_tout_clic_est_nouveau():
    """Premier rapport du compte : il n'y a aucune « dernière fois qu'on t'a
    parlé », donc rien à rattraper — et surtout aucune borne à inventer."""
    _, prompts, payload = gree(plan={THEME.lower(): PLAN_REGLE},
                               suivi=[dict(FAIT, done_at="2026-03-02")],
                               reponse=json.dumps(PISTE))
    egal("un prompt de Marche", len(prompts_de_marche(prompts)), 1)
    egal("une Marche servie", len(marches(payload)), 1)


if __name__ == "__main__":
    for nom, fn in sorted(list(globals().items())):
        if nom.startswith("test_") and callable(fn):
            fn()
    raise SystemExit(0 if bilan("La Marche suivante dans le rapport") else 1)
