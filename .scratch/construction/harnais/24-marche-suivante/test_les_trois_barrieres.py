"""Les trois barrières dures de la Marche suivante, et le rejet qui les tient.

Ce que ce fichier prouve, sur le MODULE seul (aucune base, aucun réseau, aucun
appel Gemini — `redige` est une fonction qui rend une chaîne qu'on lui a
donnée) :

  1. Gemini n'ouvre jamais une Stratégie — pas de Marche faite, pas d'appel ;
     et une piste qui ne déclare pas `role="generale"` est rejetée.
  2. Chacune des cinq colonnes de grammaire hors liste fermée fait tomber la
     piste ENTIÈRE — jamais une valeur corrigée, jamais une piste rafistolée.
  3. La cible doit être un objet présent dans les `facts` du thème.

Et le contraire de chacune : une piste conforme passe, et elle passe entière.
"""
import pulse  # noqa: F401
from t import ok, egal, bilan

from saas.recos_ia.marche_suivante import (
    CHAMPS_IA, CONFIANCE, PRIORITE, ROLE_EXIGE,
    build_prompt, cle_de, marche_suivante, objets_nommables, valider_marche,
)
from saas.traitement.build_report import GRAMMAIRE

# Les `facts` d'un thème, dans la forme exacte que `build_report.py` assemble :
# les cinq lectures du ticket 10 plus les annonces, chacune une liste de dicts
# qui portent un `nom`.
FACTS = {
    "campagnes": [{"canal": "meta", "nom": "Rentrée 2026", "pose_jour": 30.0},
                  {"canal": "google", "nom": "Marque - Search"}],
    "usure": [{"nom": "Visuel plage", "clics": 120}],
    "creneaux": [{"jour": 0, "occurrences": 4, "depense": 80.0}],
    "arrivee": {"clics": 400, "sessions": 310},
    "regies": {"meta": {"spend": 500.0}, "google": {"spend": 200.0}},
    "annonces": [{"nom": "Carrousel automne", "canal": "meta"}],
}

OBJETS = objets_nommables(FACTS)
FAITE = {"title": "Change l'appel à l'action de la page d'arrivée",
         "done_at": "2026-09-08", "theme": "Piscine"}

CONFORME = {
    "titre": "Réécris le titre de la page",
    "observation": "L'appel à l'action est posé. Le titre vient ensuite.",
    "pourquoi": "Un visiteur lit le titre avant le bouton.",
    "verifier": "Ouvre la page et relis son premier écran.",
    "angle_mort": "Ça ne dit rien du trafic qui arrive dessus.",
    "cible": "Rentrée 2026",
    "nature": "corriger", "role": "generale", "levier": "contenu",
    "metric": "roas", "effort": "1 h",
}


def piste(**modif):
    d = dict(CONFORME)
    d.update(modif)
    return d


# ── LE CAS QUI PASSE, D'ABORD ────────────────────────────────────────────────

def test_une_piste_conforme_passe_et_passe_entiere():
    r = valider_marche(CONFORME, OBJETS, GRAMMAIRE)
    ok("elle passe", r is not None)
    egal("le geste déclaré est gardé", r["nature"], "corriger")
    egal("le levier déclaré est gardé", r["levier"], "contenu")
    egal("l'indicateur déclaré est gardé", r["metric"], "roas")
    egal("l'effort déclaré est gardé", r["effort"], "1 h")
    egal("la cible est gardée", r["cible"], "Rentrée 2026")
    egal("elle se dit écrite par l'IA", r["source"], "ai")
    egal("la confiance est posée par le code", r["confidence"], CONFIANCE)
    egal("la priorité aussi", r["priority"], PRIORITE)


def test_la_pastille_chiffree_est_toujours_vide():
    """`repere`, c'est « 💡 vise X » — un seuil, donc un chiffre. Ce module n'a
    pas le droit d'en écrire un (`CLAUDE.md` §7), et il n'a pas de place pour
    en mettre un : Gemini ne peut même pas le remplir."""
    egal("`repere` vide", valider_marche(CONFORME, OBJETS, GRAMMAIRE)["repere"], "")
    ok("et il n'est pas demandé à Gemini", "repere" not in CHAMPS_IA)
    r = valider_marche(piste(repere="vise un CPC de 0,40 CHF"), OBJETS, GRAMMAIRE)
    egal("un `repere` glissé par l'IA est ignoré", r["repere"], "")


# ── BARRIÈRE 1 · IL N'OUVRE JAMAIS UNE STRATÉGIE ─────────────────────────────

def test_sans_marche_faite_aucun_appel_gemini():
    """La condition d'existence du module : « la suivante n'arrive que lorsque
    la précédente est faite » (`CONTEXT.md`, entrée Marche)."""
    appels = []

    def espion(prompt):
        appels.append(prompt)
        return "{}"

    egal("rien rendu sans Marche faite",
         marche_suivante("Piscine", None, FACTS, espion, GRAMMAIRE), None)
    egal("et aucun appel IA n'a été payé", len(appels), 0)
    egal("une Marche faite sans titre ne compte pas",
         marche_suivante("Piscine", {"title": "  "}, FACTS, espion, GRAMMAIRE), None)
    egal("toujours aucun appel", len(appels), 0)


def test_un_role_hypothese_est_rejete():
    """Une Hypothèse OUVRE une Stratégie (`theme_plan`). Gemini n'a pas le
    droit d'en ouvrir une — décision 11 de la refonte 14 : la Marche proposée
    doit être `role: generale`, donc constatable demain."""
    egal("le rôle exigé", ROLE_EXIGE, "generale")
    egal("`hypothese` rejeté",
         valider_marche(piste(role="hypothese"), OBJETS, GRAMMAIRE), None)
    ok("alors qu'il EST dans la liste fermée", "hypothese" in GRAMMAIRE["roles"])


def test_le_role_produit_ne_peut_pas_ouvrir_de_plan_de_theme():
    """Le second verrou, et il est en aval : la boucle qui écrit `theme_plan`
    ne ramasse que `role == "hypothese"`. Tant que ce qui sort d'ici vaut
    `generale`, aucune Marche de Gemini ne peut devenir la Marche courante
    d'un plan, même si un jour quelqu'un se trompait de branche."""
    r = valider_marche(CONFORME, OBJETS, GRAMMAIRE)
    egal("ce qui sort est `generale`", r["role"], "generale")
    SOURCE = pulse.SOURCE_RAPPORT.read_text(encoding="utf-8")
    ok("et le plan ne ramasse que les hypothèses",
       'r.get("role") == "hypothese"' in SOURCE)


# ── BARRIÈRE 2 · LES LISTES FERMÉES ──────────────────────────────────────────

def test_chaque_colonne_hors_liste_fait_tomber_la_piste_entiere():
    for champ, hors in (("nature", "vérifier"),      # le 6e geste qui n'existe pas
                        ("levier", "socle"),          # réservé aux prérequis
                        ("metric", "sessions"),       # `_kpis_window` ne sait pas
                        ("effort", "45 min"),
                        ("role", "marche")):
        egal(f"`{champ}` = {hors!r} → piste jetée",
             valider_marche(piste(**{champ: hors}), OBJETS, GRAMMAIRE), None)


def test_une_colonne_manquante_n_est_jamais_devinee():
    for champ in ("nature", "levier", "metric", "effort", "role"):
        egal(f"`{champ}` absent → piste jetée",
             valider_marche(piste(**{champ: ""}), OBJETS, GRAMMAIRE), None)


def test_les_cinq_textes_de_la_carte_sont_obligatoires():
    """Une carte à trous n'est pas une carte : le client lirait un conseil
    sans savoir comment le vérifier, ni ce qu'il ne règle pas."""
    for champ in ("titre", "observation", "pourquoi", "verifier", "angle_mort"):
        egal(f"`{champ}` vide → piste jetée",
             valider_marche(piste(**{champ: ""}), OBJETS, GRAMMAIRE), None)


def test_une_reponse_qui_n_est_pas_un_objet_ne_casse_rien():
    for brut in (None, [], "RIEN", 42):
        egal(f"{brut!r} → None", valider_marche(brut, OBJETS, GRAMMAIRE), None)


# ── BARRIÈRE 3 · UN OBJET PRÉSENT DANS LES `facts` ───────────────────────────

def test_les_objets_nommables_sont_les_noms_des_facts():
    egal("les quatre noms, dans l'ordre rencontré", OBJETS,
         ["Rentrée 2026", "Marque - Search", "Visuel plage", "Carrousel automne"])


def test_ce_qui_n_a_pas_de_nom_n_est_pas_nommable():
    """`creneaux` ne porte qu'un numéro de jour, `arrivee` et `regies` sont des
    agrégats : ce ne sont pas des objets qu'on ouvre pour les corriger."""
    for absent in ("meta", "google", "0", "lundi", "arrivee", "regies"):
        ok(f"« {absent} » n'est pas nommable", absent not in OBJETS)


def test_une_cible_absente_des_facts_fait_tomber_la_piste():
    egal("campagne inventée → piste jetée",
         valider_marche(piste(cible="Campagne fantôme"), OBJETS, GRAMMAIRE), None)
    egal("cible vide → piste jetée",
         valider_marche(piste(cible=""), OBJETS, GRAMMAIRE), None)


def test_la_cible_est_rendue_telle_qu_elle_est_en_base():
    """L'empreinte anti-répétition est (clé, cible) : deux graphies du même
    objet y feraient deux empreintes, et la même instruction repasserait la
    semaine d'après à une majuscule près."""
    r = valider_marche(piste(cible="rentree  2026"), OBJETS, GRAMMAIRE)
    ok("la graphie approchée est acceptée", r is not None)
    egal("mais c'est le nom de la base qui sort", r["cible"], "Rentrée 2026")


def test_sans_aucun_objet_nommable_aucun_appel_gemini():
    """Barrière 3 rendrait la piste invalide de toute façon : autant ne pas
    payer l'appel."""
    appels = []

    def espion(prompt):
        appels.append(prompt)
        return "{}"

    egal("rien rendu", marche_suivante("Piscine", FAITE, {"regies": {"meta": {}}},
                                       espion, GRAMMAIRE), None)
    egal("aucun appel IA", len(appels), 0)


# ── LA CLÉ, ET L'ÉCHELLE QU'ELLE DOIT LAISSER MONTER ─────────────────────────

def test_deux_marches_differentes_sur_la_meme_cible_ont_deux_cles():
    """C'est toute l'échelle : appel à l'action → titre → structure visent la
    MÊME page. Une clé constante les aurait muselées l'une après l'autre."""
    a = cle_de("Change l'appel à l'action")
    b = cle_de("Réécris le titre de la page")
    ok("deux clés distinctes", a != b, f"{a} == {b}")
    ok("préfixées `marche_`", a.startswith("marche_") and b.startswith("marche_"))


def test_la_meme_instruction_rend_la_meme_cle():
    egal("stable à la casse et aux accents près",
         cle_de("Réécris LE Titre"), cle_de("reecris le titre"))


def test_un_titre_vide_ne_fabrique_pas_une_cle_vide():
    egal("clé de repli", cle_de(""), "marche_sans-titre")


# ── LE PROMPT — CE QU'IL DIT, ET CE QU'IL NE DIT PAS ─────────────────────────

def test_le_prompt_ne_contient_aucun_chiffre_du_compte():
    """La propriété qui protège « aucun chiffre fabriqué » : Gemini ne reçoit
    aucune donnée du compte, donc il ne peut en reformuler aucune de travers.
    Les `facts` entrent par leurs NOMS seuls."""
    p = build_prompt("Piscine", FAITE, OBJETS, GRAMMAIRE)
    for chiffre in ("30.0", "120", "400", "310", "500.0", "200.0", "80.0"):
        ok(f"« {chiffre} » absent du prompt", chiffre not in p)


def test_le_prompt_liste_les_valeurs_autorisees():
    p = build_prompt("Piscine", FAITE, OBJETS, GRAMMAIRE)
    for v in GRAMMAIRE["natures"] + GRAMMAIRE["leviers"]:
        ok(f"« {v} » proposé", v in p)
    for v in GRAMMAIRE["metrics"] + GRAMMAIRE["efforts"]:
        ok(f"« {v} » proposé", v in p)
    ok("le rôle est imposé, pas proposé", "obligatoirement : generale" in p)
    ok("et `hypothese` n'est jamais offert", "hypothese" not in p)


def test_le_prompt_nomme_les_objets_et_la_marche_faite():
    p = build_prompt("Piscine", FAITE, OBJETS, GRAMMAIRE)
    ok("le thème", "Piscine" in p)
    ok("l'étape terminée", FAITE["title"] in p)
    for o in OBJETS:
        ok(f"l'objet « {o} »", o in p)


def test_le_prompt_interdit_le_chiffre_et_le_verdict():
    p = build_prompt("Piscine", FAITE, OBJETS, GRAMMAIRE)
    ok("aucun chiffre", "N'ÉCRIS AUCUN CHIFFRE" in p)
    ok("rien sur ce que l'étape a donné",
       "pas si elle a marché" in p)
    ok("constatable demain", "CONSTATABLE DEMAIN" in p)


def test_les_etapes_deja_faites_entrent_dans_le_prompt():
    """L'anti-boucle : sans elle, Gemini pouvait reformuler éternellement la
    même étape — le slug changeait, l'empreinte aussi, et rien ne l'arrêtait."""
    p = build_prompt("Piscine", FAITE, OBJETS, GRAMMAIRE,
                     deja_faites=["Change l'appel à l'action", "Ajoute un avis"])
    ok("la première est écrite", "Change l'appel à l'action" in p)
    ok("la seconde aussi", "Ajoute un avis" in p)
    ok("avec l'ordre de ne pas les refaire", "à ne répéter sous" in p)


def test_la_memoire_du_theme_entre_quand_elle_existe():
    p = build_prompt("Piscine", FAITE, OBJETS, GRAMMAIRE,
                     resume="Deux hypothèses testées, toutes deux stables.")
    ok("le résumé est là", "toutes deux stables" in p)
    sans = build_prompt("Piscine", FAITE, OBJETS, GRAMMAIRE)
    ok("et rien n'est inventé quand il manque", "Où en est ce thème" not in sans)


# ── LE PILOTE, DE BOUT EN BOUT (hors ligne) ──────────────────────────────────

def test_le_pilote_rend_une_marche_complete():
    import json
    r = marche_suivante("Piscine", FAITE, FACTS,
                        lambda p: json.dumps(CONFORME), GRAMMAIRE,
                        platform="meta")
    ok("une Marche est rendue", r is not None)
    egal("le canal vient de la Stratégie", r["platform"], "meta")
    egal("la clé porte l'étape", r["key"], cle_de(CONFORME["titre"]))


def test_le_pilote_avale_les_clotures_markdown():
    import json
    raw = "```json\n" + json.dumps(CONFORME) + "\n```"
    ok("la réponse emballée est lue",
       marche_suivante("Piscine", FAITE, FACTS, lambda p: raw, GRAMMAIRE) is not None)


def test_une_panne_de_gemini_ne_leve_jamais():
    for reponse in (None, "", "RIEN", "pas du json", "{", "[]"):
        egal(f"{reponse!r} → None",
             marche_suivante("Piscine", FAITE, FACTS,
                             lambda p: reponse, GRAMMAIRE), None)


def test_la_derniere_marche_faite_est_celle_qu_on_continue():
    """`marche_suivante` prend `[-1]` : l'appelant lui passe la liste triée par
    `done_at`, la plus récente en dernier."""
    vu = {}
    marche_suivante("Piscine", {"title": "Étape trois"}, FACTS,
                    lambda p: vu.setdefault("p", p) and None, GRAMMAIRE,
                    deja_faites=["Étape une", "Étape deux", "Étape trois"])
    ok("c'est elle que le prompt annonce comme terminée",
       "vient de terminer : « Étape trois »" in vu.get("p", ""))


if __name__ == "__main__":
    for nom, fn in sorted(list(globals().items())):
        if nom.startswith("test_") and callable(fn):
            fn()
    raise SystemExit(0 if bilan("Les trois barrières de la Marche suivante") else 1)
