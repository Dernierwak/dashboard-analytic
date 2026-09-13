"""Le seam est FERMÉ, et l'injection n'a rien déplacé.

Deux preuves, et il faut les deux :

1. **Fermé** — dans `build_payload` et `_labels_prioritaires`, plus aucune trace
   de `sb`, de `user_id`, d'un `fetch_*`, de l'appel Gemini, de l'écriture du
   plan de thème ni de `date.today()`. Lu sur l'ARBRE, pas au grep : un
   commentaire qui nomme `fetch_meta_ads` ne doit pas faire échouer le harnais,
   et un appel caché dans une closure ne doit pas y échapper.

2. **Rien déplacé** — chaque méthode de `LecteurSupabase` atteint la même
   fonction, la même table et les mêmes arguments que `build_payload` avant
   l'injection. La référence est le fichier tel qu'il était au dernier commit
   (`git show HEAD:…`), pas une liste écrite de mémoire.

CE QUE CETTE SECONDE PREUVE N'EST PAS. Le ticket demandait « un rapport généré à
l'identique avant/après ». C'est impossible en local et ça se dit : le `.env`
racine pointe un projet Supabase qui ne répond plus (§ Testing de `spec.md`), et
AVANT l'injection la fonction ne pouvait pas tourner hors ligne du tout — il n'y
a pas de « avant » à comparer. Ce qui est vérifié est donc une **équivalence de
routage** : même destination, mêmes arguments, pour les trente points de sortie.
"""
import ast
import subprocess

import pulse
from t import ok, egal, bilan

from saas.traitement.lecteur import Lecteur, LecteurSupabase

SOURCE = pulse.SOURCE_RAPPORT.read_text(encoding="utf-8")
ARBRE = ast.parse(SOURCE)

UID = "00000000-0000-0000-0000-000000000042"


def _fonction(arbre, nom):
    for n in arbre.body:
        if isinstance(n, ast.FunctionDef) and n.name == nom:
            return n
    return None


# LE COMMIT D'AVANT L'INJECTION, ÉPINGLÉ — et pas `HEAD`.
#
# La première version lisait `HEAD`, ce qui marchait exactement une fois : au
# commit suivant, `HEAD` EST la version injectée et le « avant » disparaît. Un
# test qui se compare à un point mouvant ne compare rien. Cette référence est
# donc le dernier commit de la carte avant le ticket 16 — elle ne bouge plus.
AVANT_INJECTION = "674737c"


def _source_avant() -> str:
    """`build_report.py` juste avant l'injection du lecteur."""
    fait = subprocess.run(
        ["git", "show", f"{AVANT_INJECTION}:saas/traitement/build_report.py"],
        cwd=pulse.RACINE, capture_output=True, text=True)
    if fait.returncode != 0:
        # Clone superficiel, ou historique réécrit : on le DIT plutôt que de
        # comparer à du vide et de tout faire passer.
        raise SystemExit(
            f"Le commit {AVANT_INJECTION} est introuvable dans ce dépôt — "
            "la moitié « rien n'a été déplacé » de ce test ne peut pas être "
            "jouée. Récupérer l'historique complet, puis relancer.")
    return fait.stdout


AVANT = _source_avant()
AVANT_PAYLOAD = ast.get_source_segment(
    AVANT, _fonction(ast.parse(AVANT), "build_payload")) or ""
AVANT_PRIORITES = ast.get_source_segment(
    AVANT, _fonction(ast.parse(AVANT), "_labels_prioritaires")) or ""
AVANT_TOUT = AVANT_PAYLOAD + AVANT_PRIORITES


# ── 1 · LE SEAM EST FERMÉ ────────────────────────────────────────────────────

INTERDITS = {"sb", "user_id", "_call_gemini", "upsert_theme_plan",
             "build_user_persona", "condense_theme_memoire"}

FONCTIONS = {n.name: n for n in ARBRE.body if isinstance(n, ast.FunctionDef)}


def _noms_libres(fn, vues=None) -> set:
    """Les sorties en clair de cette fonction ET DE CELLES QU'ELLE APPELLE.

    LA TRANSITIVITÉ N'EST PAS DU ZÈLE : la première version de ce test ne
    regardait que le corps de `build_payload`, et elle a laissé passer un trou
    réel — `_themes_tips`, fonction du module appelée depuis la construction,
    appelait `_call_gemini` directement. La construction partait donc sur le
    réseau dès qu'une clé Gemini existait dans l'environnement, et un test hors
    ligne devenait dépendant de la machine qui le joue. Trouvé par la revue de
    code du ticket 16 ; le test se remonte ici pour que ça ne repasse pas.
    """
    vues = vues if vues is not None else set()
    if fn.name in vues:
        return set()
    vues.add(fn.name)
    trouves = set()
    for n in ast.walk(fn):
        if isinstance(n, ast.Name) and (n.id in INTERDITS or n.id.startswith("fetch_")):
            trouves.add(n.id)
        # Suivre l'appel : une fonction du module appelée d'ici est, pour le
        # seam, un morceau de la construction.
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name):
            appelee = FONCTIONS.get(n.func.id)
            if appelee is not None and appelee is not fn:
                trouves |= {f"{n.func.id} → {x}"
                            for x in _noms_libres(appelee, vues)}
    return trouves


def test_build_payload_ne_touche_plus_rien_dehors():
    fn = _fonction(ARBRE, "build_payload")
    ok("`build_payload` existe", fn is not None)
    egal("aucune sortie en clair dans son corps", sorted(_noms_libres(fn)), [])
    egal("elle ne prend plus qu'un lecteur",
         [a.arg for a in fn.args.args], ["lecteur"])


def test_labels_prioritaires_ne_touche_plus_rien_dehors():
    fn = _fonction(ARBRE, "_labels_prioritaires")
    egal("aucune sortie en clair dans son corps", sorted(_noms_libres(fn)), [])
    egal("elle prend le lecteur", [a.arg for a in fn.args.args][0], "lecteur")


def test_plus_aucun_import_local_dans_la_construction():
    """Les `from saas.collecte…` cachés au milieu de la fonction ont disparu.

    Ils étaient sept, et chacun était un point de sortie qu'aucun paramètre
    n'annonçait — le genre d'appel qu'une lecture de la signature ne trouve pas.
    """
    fn = _fonction(ARBRE, "build_payload")
    imports = [n for n in ast.walk(fn) if isinstance(n, (ast.Import, ast.ImportFrom))]
    egal("zéro import local", len(imports), 0)
    ok("il y en avait bien avant", AVANT_PAYLOAD.count("        from saas.") >= 5,
       f"trouvés : {AVANT_PAYLOAD.count('        from saas.')}")


def test_l_horloge_aussi_entre_par_le_lecteur():
    """Sans elle, « rejouer un autre jour ne change pas la semaine déclarée »
    ne se vérifie pas — la fonction lirait la vraie date."""
    fn = _fonction(ARBRE, "build_payload")
    aujourd = [n for n in ast.walk(fn)
               if isinstance(n, ast.Attribute) and n.attr == "today"]
    egal("aucun `date.today()` dans la construction", len(aujourd), 0)
    ok("il y en avait un avant", "today = date.today()" in AVANT_PAYLOAD)


def test_le_lecteur_lui_meme_ne_lit_aucun_secret():
    """Le module du lecteur ne connaît ni `secret()` ni `requests` : l'appel
    Gemini lui arrive par paramètre. Sans ça, un harnais hors ligne
    dépendrait de la présence d'une clé dans l'environnement."""
    src = pulse.SOURCE_LECTEUR.read_text(encoding="utf-8")
    arbre = ast.parse(src)
    importes = {a.name for n in ast.walk(arbre)
                if isinstance(n, ast.Import) for a in n.names}
    importes |= {n.module or "" for n in ast.walk(arbre) if isinstance(n, ast.ImportFrom)}
    ok("aucun `requests`", "requests" not in importes)
    ok("aucun `app_secrets`", not any("app_secrets" in m for m in importes))


# ── 2 · LE RENVOI EST IDENTIQUE ──────────────────────────────────────────────

class Espion:
    """Note l'appel et rend ce qu'on lui a donné."""

    def __init__(self, retour=None):
        self.appels = []
        self.retour = retour

    def __call__(self, *a, **kw):
        self.appels.append((a, kw))
        return self.retour


# méthode du lecteur → (fonction appelée avant, son orthographe d'alors)
RENVOIS = {
    "meta_ads": ("fetch_meta_ads", "fetch_meta_ads(sb, user_id)"),
    "publications": ("fetch_post_metrics", "fetch_post_metrics(sb, user_id)"),
    "abonnes": ("fetch_daily_followers", "fetch_daily_followers(sb, user_id)"),
    "google_ads": ("fetch_google_ads", "fetch_google_ads(sb, user_id)"),
    "google_annonces": ("fetch_google_ads_ad_insights",
                        "fetch_google_ads_ad_insights(sb, user_id)"),
    "objectif": ("fetch_objectif", "fetch_objectif(sb, user_id)"),
    "profil_onboarding": ("fetch_onboarding_profile",
                          "fetch_onboarding_profile(sb, user_id)"),
    "objectifs_par_theme": ("fetch_theme_objectifs",
                            "fetch_theme_objectifs(sb, user_id)"),
    "config_meta": ("fetch_campaign_config", "fetch_campaign_config(sb, user_id)"),
    "config_google": ("fetch_google_campaign_config",
                      "fetch_google_campaign_config(sb, user_id)"),
    "budgets_poses": ("fetch_platform_budgets", "fetch_platform_budgets(sb, user_id)"),
    "themes_regroupes": ("fetch_theme_regroupement",
                         "fetch_theme_regroupement(sb, user_id)"),
    "reco_feedback": ("fetch_reco_feedback", "fetch_reco_feedback(sb, user_id)"),
    "verdicts": ("fetch_reco_verdicts", "fetch_reco_verdicts(sb, user_id)"),
    "contexte_theme": ("fetch_reco_theme_context",
                       "fetch_reco_theme_context(sb, user_id)"),
    "plan_de_theme": ("fetch_theme_plan", "fetch_theme_plan(sb, user_id)"),
    "insight_feedback": ("fetch_insight_feedback", "fetch_insight_feedback(sb, user_id)"),
    "ga4_lignes": ("fetch_ga4_events", "_db_ga4_ev(sb, user_id)"),
    "ga4_insights": ("fetch_ga4_insights", "_fga4(sb, user_id)"),
}


def test_chaque_lecture_atteint_la_meme_fonction_avec_les_memes_arguments():
    import saas.traitement.lecteur as mod
    for methode, (fonction, orthographe_avant) in sorted(RENVOIS.items()):
        ok(f"`{orthographe_avant}` était bien appelée avant",
           orthographe_avant in AVANT_TOUT, orthographe_avant)
        espion = Espion(retour=["une ligne"])
        ancien = getattr(mod, fonction)
        setattr(mod, fonction, espion)
        try:
            rendu = getattr(LecteurSupabase("le-client", UID), methode)()
        finally:
            setattr(mod, fonction, ancien)
        egal(f"`{methode}` appelle `{fonction}` une fois", len(espion.appels), 1)
        egal(f"`{methode}` lui passe (sb, user_id)",
             espion.appels[0], (("le-client", UID), {}))
        egal(f"`{methode}` rend la réponse telle quelle", rendu, ["une ligne"])


def test_le_contexte_ga4_garde_sa_fenetre():
    """Quatre fenêtres différentes passaient par le même appel — celle de la
    semaine, la précédente, l'historique complet et celle d'un repère. Les
    quatre doivent arriver au même endroit."""
    from datetime import date
    import saas.collecte.ga4.ga4 as ga4
    espion = Espion(retour={"connected": True})
    ancien = ga4.build_ga4_context
    ga4.build_ga4_context = espion
    try:
        LecteurSupabase("le-client", UID).ga4_contexte(date(2026, 9, 6),
                                                       date(2026, 9, 12))
    finally:
        ga4.build_ga4_context = ancien
    egal("la fenêtre voyage entière", espion.appels[0],
         (("le-client", UID, date(2026, 9, 6), date(2026, 9, 12)), {}))
    ok("les quatre fenêtres existaient avant",
       AVANT_PAYLOAD.count("build_ga4_context") >= 4)


# ── Les lectures brutes : la requête est la même, chaînon par chaînon ────────

class FauxSb:
    """Enregistre la chaîne PostgREST au lieu de l'exécuter."""

    def __init__(self):
        self.chaine = []
        self.data = []

    def table(self, nom):
        self.chaine.append(("table", nom))
        return self

    def __getattr__(self, methode):
        def _etape(*a, **kw):
            self.chaine.append((methode,) + a + tuple(sorted(kw.items())))
            return self
        return _etape

    def execute(self):
        self.chaine.append(("execute",))
        return self


CHAINES = {
    "priorites_datees": (
        lambda l: l.priorites_datees(),
        [("table", "insight_feedback"),
         ("select", "insight_key, created_at"),
         ("eq", "user_id", UID),
         ("like", "insight_key", "priority_label:%"),
         ("order", "created_at"),
         ("execute",)]),
    "rapports_publies": (
        lambda l: l.rapports_publies("2026-09-07"),
        [("table", "weekly_reports"),
         ("select", "week_start, payload"),
         ("eq", "user_id", UID),
         ("lt", "week_start", "2026-09-07"),
         ("order", "week_start", ("desc", True)),
         ("limit", 8),
         ("execute",)]),
    "suivi_actions": (
        lambda l: l.suivi_actions(),
        [("table", "suivi_actions"), ("select", "*"),
         ("eq", "user_id", UID), ("execute",)]),
    "suivi_en_cours": (
        lambda l: l.suivi_en_cours(),
        [("table", "suivi_actions"), ("select", "*"),
         ("eq", "user_id", UID),
         ("in_", "status", ["running", "done"]),
         ("order", "check_at"), ("execute",)]),
    "notes_archivees": (
        lambda l: l.notes_archivees(),
        [("table", "suivi_actions"),
         ("select", "title, theme, decided_at"),
         ("eq", "user_id", UID), ("eq", "kind", "note"),
         ("eq", "status", "archived"),
         ("order", "decided_at"), ("limit", 200), ("execute",)]),
    "dates_declarees": (
        lambda l: l.dates_declarees("meta_campaign_config"),
        [("table", "meta_campaign_config"),
         ("select", "campaign_name, start_date, end_date"),
         ("eq", "user_id", UID), ("execute",)]),
}


def test_chaque_lecture_brute_rejoue_la_meme_requete():
    for methode, (appel, attendue) in sorted(CHAINES.items()):
        # `desc=True` fait partie de la chaîne comparée : sans lui, les huit
        # rapports lus seraient les PLUS VIEUX du compte.
        sb = FauxSb()
        appel(LecteurSupabase(sb, UID))
        egal(f"`{methode}` : la chaîne PostgREST est inchangée", sb.chaine, attendue)
        # Et cette chaîne n'est pas inventée : chaque chaînon marquant se lit
        # dans le fichier d'avant l'injection.
        for etape in attendue:
            if etape[0] == "table":
                # `.table(_table)` prenait une VARIABLE dans la boucle des dates
                # déclarées : on cherche le nom de la table, pas l'appel.
                morceau = f'"{etape[1]}"'
            elif etape[0] in ("select", "limit", "in_"):
                morceau = (f'.{etape[0]}("{etape[1]}"' if isinstance(etape[1], str)
                           else f".{etape[0]}({etape[1]}")
            else:
                continue
            ok(f"`{methode}` : `{morceau}` était bien là avant",
               morceau in AVANT_TOUT, morceau)


# ── Les deux écritures : détournées, jamais perdues ──────────────────────────

def test_l_ecriture_du_plan_de_theme_atteint_la_meme_fonction():
    import saas.traitement.lecteur as mod
    espion = Espion()
    ancien = mod.upsert_theme_plan
    mod.upsert_theme_plan = espion
    try:
        LecteurSupabase("le-client", UID).ecrire_plan_de_theme(
            "Été", "roas", "argent", "2026-09-13", {"key": "roas"})
    finally:
        mod.upsert_theme_plan = ancien
    egal("mêmes arguments, même ordre", espion.appels[0],
         (("le-client", UID, "Été", "roas", "argent", "2026-09-13",
           {"key": "roas"}), {}))
    ok("l'appel existait avant", "upsert_theme_plan(" in AVANT_PAYLOAD)


def test_l_ecriture_du_verdict_rejoue_la_meme_requete():
    sb = FauxSb()
    LecteurSupabase(sb, UID).ecrire_verdict("action-1", "better")
    egal("la chaîne d'écriture est inchangée", sb.chaine,
         [("table", "suivi_actions"), ("update", {"verdict": "better"}),
          ("eq", "id", "action-1"), ("execute",)])
    ok("elle était là avant",
       'sb.table("suivi_actions").update(' in AVANT_PAYLOAD)


# ── Le contrat, et rien de plus ──────────────────────────────────────────────

def test_le_faux_lecteur_honore_le_meme_contrat_que_le_vrai():
    """Un faux qui répondrait à MOINS de méthodes que le vrai ferait passer les
    tests de propriété pour de mauvaises raisons : la fonction se tairait sur
    une source au lieu de la lire."""
    from lecteur_fige import LecteurFige
    contrat = {n for n in dir(Lecteur) if not n.startswith("_")}
    ok("le contrat n'est pas vide", len(contrat) >= 25, f"{len(contrat)} méthodes")
    for methode in sorted(contrat):
        ok(f"le vrai lecteur rend `{methode}`", hasattr(LecteurSupabase, methode))
        ok(f"le faux lecteur rend `{methode}`", hasattr(LecteurFige, methode))


def test_le_redacteur_absent_ne_leve_jamais():
    """En headless sans clé Gemini, `redige` doit rendre `None` — le rapport ne
    casse jamais sur une panne d'IA."""
    egal("aucun rédacteur → aucune phrase",
         LecteurSupabase("le-client", UID).redige("écris-moi quelque chose"), None)


if __name__ == "__main__":
    for nom, fn in sorted(list(globals().items())):
        if nom.startswith("test_"):
            fn()
    raise SystemExit(0 if bilan("Le seam du payload") else 1)
