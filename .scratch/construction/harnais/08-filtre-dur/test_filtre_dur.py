"""Le filtre dur, le branchement du plafond, et les tuyaux qu'on vient de couper.

LIMITE DE CE FICHIER, ET ELLE EST LA MÊME QU'AU TICKET 07. `build_payload` prend
un client Supabase vivant et va chercher ses données elle-même ; la rendre
appelable hors ligne est le ticket [16](../../issues/16-le-seam-du-payload.md),
pas encore fait. Ce fichier lit donc le TEXTE SOURCE pour ce qui vit à
l'intérieur de cette fonction — un test de texte prouve qu'une ligne est écrite,
jamais qu'elle fait ce qu'elle dit. Tout ce qui est vérifiable sur le MODULE
l'est sur le module : la mort de `_theme_ai_recos`, la forme d'`_importance`, la
grammaire.
"""
import ast

import pulse  # noqa: F401
from t import ok, egal, bilan

import saas.traitement.build_report as rapport
from saas.traitement.build_report import (
    NATURES, ROLES, _attach_grammaire, _est_conseil, _importance,
)

SOURCE = pulse.SOURCE_RAPPORT.read_text(encoding="utf-8")


# ── LES PISTES RÉDIGÉES PAR GEMINI SONT COUPÉES ──────────────────────────────

def test_la_fonction_qui_les_ecrivait_n_existe_plus():
    ok("plus de `_theme_ai_recos`", not hasattr(rapport, "_theme_ai_recos"))
    egal("et plus aucun appel", SOURCE.count("_theme_ai_recos("), 0)
    ok("une note dit pourquoi",
       "LES PISTES RÉDIGÉES PAR GEMINI SONT COUPÉES" in SOURCE)


def test_le_decompte_force_d_une_hypothese_meurt_avec_elles():
    """Il garantissait « 2 générale + 1 hypothèse » PAR THÈME. Le décompte des
    Marches est devenu un plafond de SEMAINE, tenu par `composition.py`."""
    ok("plus de `_forcer_une_hypothese`",
       not hasattr(rapport, "_forcer_une_hypothese"))
    egal("et plus aucun appel", SOURCE.count("_forcer_une_hypothese("), 0)


def test_les_quatre_autres_appels_gemini_restent():
    """Le moteur trie, l'IA explique : seules les pistes sont coupées.

    Deux des quatre entrent PAR LE LECTEUR depuis le ticket 16 — le worker
    demande `lecteur.persona(…)` et `lecteur.memoire_theme(…)`, et c'est
    `saas/traitement/lecteur.py` qui appelle Gemini. Ce qui est vérifié reste le
    même : ces appels n'ont pas été coupés avec les pistes."""
    LECTEUR = (pulse.RACINE / "saas" / "traitement"
               / "lecteur.py").read_text(encoding="utf-8")
    ok("_themes_tips est toujours appelé", "_themes_tips(" in SOURCE)
    ok("le persona est toujours demandé", "lecteur.persona(" in SOURCE)
    ok("et le lecteur l'appelle", "build_user_persona(" in LECTEUR)
    ok("la mémoire de thème est toujours demandée", "lecteur.memoire_theme(" in SOURCE)
    ok("et le lecteur l'appelle", "condense_theme_memoire(" in LECTEUR)


def test_il_n_y_a_plus_qu_un_chemin_par_theme():
    egal("plus de `_ia_redigee`", SOURCE.count("_ia_redigee"), 0)
    egal("plus de porte `_THEMES_IA`", SOURCE.count("_THEMES_IA["), 0)


# ── LE FILTRE DUR ────────────────────────────────────────────────────────────

def test_le_jeu_des_themes_conseilles_se_lit_sur_les_etoiles():
    egal("trois au maximum", rapport._THEMES_CONSEILLES, 3)
    ok("il se lit sur `priority_labels`, jamais sur `theme_list`",
       "_themes_conseilles = {_nrm(_l) for _l in priority_labels[:_THEMES_CONSEILLES]}"
       in SOURCE)


REGLES = ("build_recos", "_orga_recos", "_reco_evenements", "regles_payantes")


def _boucle_des_themes():
    """Le nœud `for lbl in theme_list:` de `build_payload`, lu dans l'arbre.

    Un test de TEXTE dirait seulement qu'un `if _conseille:` est écrit quelque
    part. Sur l'arbre, on peut dire la seule chose qui compte : dans cette
    boucle, aucun appel de règle ne vit HORS du garde.
    """
    arbre = ast.parse(SOURCE)
    for n in ast.walk(arbre):
        if (isinstance(n, ast.For) and isinstance(n.target, ast.Name)
                and n.target.id == "lbl"
                and isinstance(n.iter, ast.Name) and n.iter.id == "theme_list"):
            return n
    return None


def test_aucune_regle_ne_tourne_hors_priorites():
    """Le filtre est posé AVANT les règles, pas après : un conseil hors thème
    prioritaire n'est pas écarté, il n'est jamais calculé."""
    boucle = _boucle_des_themes()
    ok("la boucle des thèmes existe", boucle is not None)
    gardes = [n for n in ast.walk(boucle)
              if isinstance(n, ast.If) and isinstance(n.test, ast.Name)
              and n.test.id == "_conseille"]
    egal("un seul garde, et il est dans la boucle", len(gardes), 1)
    dedans = {c.func.id for g in gardes for c in ast.walk(g)
              if isinstance(c, ast.Call) and isinstance(c.func, ast.Name)}
    total = {c.func.id for c in ast.walk(boucle)
             if isinstance(c, ast.Call) and isinstance(c.func, ast.Name)}
    for appel in REGLES:
        ok(f"{appel} tourne dans la boucle", appel in total, "il n'y est plus")
        ok(f"{appel} ne tourne QUE sous le garde", appel in dedans,
           f"{appel} est appelé hors de `if _conseille:`")


def test_le_garde_n_a_pas_de_branche_else():
    """Un `else` ici voudrait dire « et sinon, on conseille autre chose » —
    c'est exactement ce qu'un plafond-qui-n'est-pas-un-quota interdit."""
    boucle = _boucle_des_themes()
    garde = next(n for n in ast.walk(boucle)
                 if isinstance(n, ast.If) and isinstance(n.test, ast.Name)
                 and n.test.id == "_conseille")
    egal("aucun repli", garde.orelse, [])


def test_le_payload_dit_si_un_theme_recoit_des_conseils():
    ok("le champ est écrit", '"conseille": _conseille,' in SOURCE)
    egal("et l'ancien champ a disparu", SOURCE.count('"ia_redigee"'), 0)


def test_la_priorite_n_est_plus_un_critere_de_tri():
    """C'est tout le ticket : `is_priority` en tête d'`_importance` laissait
    sortir les autres thèmes plus bas. Un filtre ne se double pas d'un tri."""
    prio = dict(key="roas", confidence="solide", effort="10 min", is_priority=True)
    ordinaire = dict(prio, is_priority=False)
    egal("les deux se valent", _importance(prio), _importance(ordinaire))
    egal("le rang du thème est en tête", _importance(prio, rang=2)[0], 2)


def test_un_theme_qui_pese_plus_passe_devant():
    r = dict(key="roas", confidence="solide", effort="10 min")
    ok("rang 0 avant rang 3", _importance(r, 0) < _importance(r, 3))


# ── LE PLAFOND, BRANCHÉ AU BON ENDROIT ───────────────────────────────────────

def test_le_plafond_s_applique_avant_l_ecriture_du_plan_de_theme():
    """Une Marche que le plafond n'a pas retenue n'ouvre AUCUNE Stratégie :
    sinon la mémoire de Pulse porterait une théorie que personne n'a lue."""
    plafond = SOURCE.index("LE PLAFOND DE CINQ, SUR TOUT LE COMPTE")
    # L'écriture passe par le lecteur depuis le ticket 16 ; sa PLACE dans la
    # fonction, la seule chose que ce test mesure, n'a pas bougé.
    plan = SOURCE.index("lecteur.ecrire_plan_de_theme(", plafond)
    ok("le plafond précède l'écriture du plan", plafond < plan)


def test_le_plafond_s_applique_apres_la_pose_des_efforts():
    """La composition lit l'effort ; avant `_attach_effort`, tous les conseils
    se seraient valus sur cet axe."""
    effort = SOURCE.index("_attach_effort(_r)")
    plafond = SOURCE.index("LE PLAFOND DE CINQ, SUR TOUT LE COMPTE")
    ok("l'effort est posé avant", effort < plafond)


def test_l_empreinte_filtre_avant_la_coupe_a_trois():
    """Filtrer seulement à la fin laisserait la coupe à trois d'un thème se
    remplir de conseils déjà servis : le thème sortirait muet alors qu'un
    quatrième conseil, frais, attendait derrière."""
    # LU EN TROIS REPÈRES, PLUS EN UN BLOC RECOPIÉ. La coupe porte depuis le
    # ticket 27 un arbitrage de plus (`_une_seule_hypothese`, une seule théorie
    # par thème) : recopier son texte exact faisait tomber ce test sur un
    # changement qui ne touche en rien la propriété mesurée ici, à savoir que
    # l'empreinte filtre AVANT le `[:3]`.
    coupe = SOURCE.index("t_recos = _une_seule_hypothese(sorted(")
    filtre = SOURCE.index("empreinte_conseil(r) not in _deja_servies", coupe)
    trois = SOURCE.index("[:3]", coupe)
    ok("le filtre est dans la coupe", filtre < trois)
    lu = SOURCE.index("_deja_servies: set = set()")
    boucle = SOURCE.index("for lbl in theme_list:")
    ok("et il est lu avant la boucle des thèmes", lu < boucle)


def test_les_veilles_ne_prennent_aucune_des_cinq_places():
    ok("elles sont exclues du vivier",
       "if _est_veille(_r):\n                continue" in SOURCE)
    ok("et gardées sur leur carte",
       'if _est_veille(_r) or id(_r) in _retenus' in SOURCE)


def test_le_renvoi_sort_du_rapport():
    egal("plus de `top_recos` écrit", SOURCE.count('"top_recos":'), 0)
    ok("plus de `_diversifier`", not hasattr(rapport, "_diversifier"))


# ── LA MARCHE ÉPINGLÉE ───────────────────────────────────────────────────────

def test_une_marche_epinglee_ne_fabrique_pas_une_quatrieme_place():
    ok("elle prend la dernière des trois",
       "t_recos = t_recos[:2] + [_epingle]" in SOURCE)


def test_une_piste_redigee_par_gemini_ne_se_reaffiche_jamais():
    """Un `theme_plan` épinglé avant ce ticket porte un `snapshot` de piste IA.
    Le réafficher remettrait à l'écran exactement ce que la décision retire."""
    ok("les clés `ai_` sont refusées",
       'not str(_plan.get("reco_key") or "").startswith("ai_")' in SOURCE)


def test_l_empreinte_d_une_marche_epinglee_est_exemptee():
    ok("elle entre dans `_epingles`",
       "_epingles.add(empreinte_conseil(_epingle))" in SOURCE)
    ok("et `_epingles` est passé au plafond",
       "composer_la_semaine(\n        [_r for _, _r in _conseils_semaine], _deja_servies, _epingles)"
       in SOURCE)


# ── CE QUE PULSE NE DIT PLUS D'UN THÈME QU'IL N'A PAS REGARDÉ ────────────────

def test_le_filet_ne_parle_que_d_un_theme_conseille():
    """Ses mots sont ceux d'un thème REGARDÉ — « aucune de mes règles ne s'est
    déclenchée ici », « rends son étoile ». Sur un thème hors priorités, aucune
    règle n'a tourné et il n'y a pas d'étoile à rendre."""
    ok("le filet est sous le garde",
       "if _conseille and not t_recos and not t_veille:" in SOURCE)


def test_la_phrase_de_passage_ne_promet_pas_de_levier_sans_conseil():
    ok("elle compte les conseils, pas les cartes",
       "_n_conseils = sum(1 for t in themes_focus for r in t[\"recos\"]\n"
       "                          if not _est_veille(r))" in SOURCE)
    ok("et elle a une forme sans levier", 'f"voilà où en sont {_sur}"' in SOURCE)


def test_plus_aucun_texte_ne_renvoie_aux_trois_conseils_du_haut():
    egal("le renvoi supprimé n'est plus cité nulle part",
         SOURCE.count("les trois conseils du haut"), 0)


# ── « ◇ TROP COMPLIQUÉ » EST ENFIN LU ────────────────────────────────────────

def test_too_hard_arrive_dans_les_astuces():
    ok("le retour est relu", 'if _row.get("reaction") != "too_hard":' in SOURCE)
    ok("et il est passé à `_themes_tips`", "bloques=_bloques," in SOURCE)


def test_too_hard_ne_touche_jamais_le_tri():
    """Deux destinataires séparés, pas deux moteurs : `too_hard` va au
    savoir-faire, jamais à `_importance`."""
    debut = SOURCE.index("def _importance(")
    fin = SOURCE.index("\n\n", SOURCE.index("reco.get(\"priority\", 99)", debut))
    ok("absent du tri", "too_hard" not in SOURCE[debut:fin])


def test_les_astuces_ne_concernent_que_les_themes_conseilles():
    ok("le mode d'emploi suit le conseil",
       '[t["label"] for t in themes_focus if t.get("conseille")]' in SOURCE)


# ── LA GRAMMAIRE, RESSERRÉE ──────────────────────────────────────────────────

def test_un_geste_hors_liste_n_est_pas_un_geste():
    egal("les cinq gestes", NATURES,
         ("couper", "augmenter", "tester", "créer", "corriger"))
    ok("un geste inventé ne passe pas",
       not _est_conseil({"key": "x", "nature": "vérifier"}))
    ok("un geste de la liste passe",
       _est_conseil({"key": "x", "nature": "couper"}))
    ok("aucun geste, aucun conseil", not _est_conseil({"key": "x"}))


def test_un_role_hors_liste_est_retire_jamais_devine():
    egal("les deux rôles", ROLES, ("generale", "hypothese"))
    r = _attach_grammaire({"key": "inconnue", "nature": "couper", "role": "peut-être"})
    ok("le rôle inventé est retiré", "role" not in r, r.get("role"))
    r2 = _attach_grammaire({"key": "orga_essoufflement"})
    egal("une règle garde le sien", r2["role"], "hypothese")


def test_la_veille_et_le_socle_restent_hors_des_places():
    ok("une veille n'a pas besoin de geste",
       _est_conseil({"key": "veille_meta_Été"}))
    ok("un réglage non plus", _est_conseil({"key": "connecter_ga4"}))


if __name__ == "__main__":
    for nom, fn in sorted(list(globals().items())):
        if nom.startswith("test_"):
            fn()
    raise SystemExit(0 if bilan("Le filtre dur et le branchement") else 1)
