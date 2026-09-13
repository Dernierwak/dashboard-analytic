"""Le branchement des six règles dans le rapport.

CE FICHIER LIT DU TEXTE SOURCE, et c'est sa limite — la même que
`test_branchement.py` du harnais 07. Les cinq lectures que le ticket 10 ajoute
(`_budget_campagnes_theme`, `_usure_theme`, `_creneaux_theme`, `_arrivee_theme`,
`_regies_theme`) sont des CLOSURES de `build_payload`, qui prend un client
Supabase vivant : elles ne sont pas appelables hors ligne tant que le ticket 16
(le seam du payload) n'est pas fait. Un test de texte ne prouve pas qu'un appel
FONCTIONNE — il prouve qu'il EXISTE, qu'il n'a pas été oublié en chemin, et que
les gardes annoncées sont bien dans le code.
"""
import pulse  # noqa: F401
from t import ok, egal, bilan

from saas.recos_ia.reco_engine import SEUILS

SOURCE = pulse.SOURCE_RAPPORT.read_text(encoding="utf-8")
MOTEUR = pulse.SOURCE_MOTEUR.read_text(encoding="utf-8")


def test_les_six_regles_recoivent_leurs_faits():
    ok("l'orchestrateur reçoit `faits`", "_faits_payants(lbl)," in SOURCE)
    ok("et il est défini", "def _faits_payants(lbl):" in SOURCE)
    for lecteur in ("_budget_campagnes_theme", "_usure_theme", "_creneaux_theme",
                    "_arrivee_theme", "_regies_theme"):
        ok(f"{lecteur} est défini", f"def {lecteur}(" in SOURCE)
        ok(f"{lecteur} est appelé par `_faits_payants`",
           f"{lecteur}(" in SOURCE.split("def _faits_payants(lbl):")[1])


def test_chaque_lecture_tombe_seule_si_elle_echoue():
    """Une table absente ou une colonne qui manque doit faire taire SA règle,
    pas les cinq autres : c'est le `try` par lecture dans `_faits_payants`."""
    bloc = SOURCE.split("def _faits_payants(lbl):")[1].split("\n    # ")[0]
    ok("un try par lecture", bloc.count("try:") == 1 and "for _nom, _lire in" in bloc,
       bloc[:200])
    ok("et une clé absente vaut « on n'a pas lu ça »",
       "la règle se tait" in bloc, bloc[-300:])


def test_page_arrivee_muette_ne_prend_pas_une_place_du_theme():
    """Son levier est `socle` : c'est un prérequis de MESURE. Elle rejoint le
    bloc « réglages », pas les trois places du thème
    (`.scratch/refonte/issues/24-conseils-payants-manquants.md`)."""
    ok("elle est routée à part", '_socle_themes.append(_r_pay)' in SOURCE)
    ok("la liste existe", "_socle_themes: list[dict] = []" in SOURCE)
    ok("et elle alimente `reglages`", "+ _socle_uniques)" in SOURCE)
    ok("une seule, celle qui perd le plus de clics",
       'r.get("_enjeu") or 0' in SOURCE and "_vus.add" in SOURCE)


def test_l_usure_est_meta_seulement_et_garde_l_identifiant():
    """Sans `ad_id`, regrouper par nom rejouerait le bug des homonymes DANS le
    moteur de conseils ; sans `reach`, il n'y a pas de fréquence du tout."""
    bloc = SOURCE.split("def _usure_theme(")[1].split("\n    def ")[0]
    ok("elle garde sur `ad_id`", '"ad_id" not in df_meta_raw.columns' in bloc, bloc[:400])
    ok("et sur `reach`", '"reach" not in df_meta_raw.columns' in bloc, bloc[:400])
    ok("elle ne lit QUE Meta", "df_gads" not in bloc and "df_google" not in bloc)
    # UNE SEULE JOURNÉE SANS PORTÉE ET L'ANNONCE SORT. Ne pas ajouter cette
    # portée-là tout en gardant ses impressions casserait l'invariant : sept
    # jours d'impressions divisés par deux jours de portée donnent un nombre
    # TROIS FOIS TROP GRAND, affiché sous la mention « au moins ».
    ok("une portée absente marque l'annonce", "pd.isna(_reach)" in bloc, bloc[-900:])
    ok("et l'annonce sort entièrement",
       'if not _a.pop("portee_complete", False):' in bloc, bloc[-900:])
    ok("elle compare à la semaine d'avant",
       "_cumul(prev_since, prev_until)" in bloc, bloc[-800:])


def test_le_creneau_est_meta_seulement_et_sur_quatre_semaines():
    bloc = SOURCE.split("def _creneaux_theme(")[1].split("\n    def ")[0]
    ok("elle ne lit QUE Meta", "df_gads" not in bloc and "df_google" not in bloc)
    ok("les occurrences comptent des jours distincts",
       'len(_c["dates"])' in bloc, bloc[-400:])
    # CINQ SEMAINES POUR EN EXIGER QUATRE. Sur 28 jours il y a EXACTEMENT
    # quatre lundis : une campagne en pause un jour, une journée sans diffusion
    # ou un trou de récolte ferait tomber ce jour à trois et la règle se
    # tairait pour une raison qui n'a rien à voir avec son prix.
    ok("la fenêtre fait cinq semaines", "_CRENEAU_JOURS = 35" in SOURCE)
    ok("et c'est elle que `_faits_payants` passe",
       "_CRENEAU_JOURS - 1" in SOURCE.split("def _faits_payants(lbl):")[1])
    ok("elle est plus large que le minimum exigé",
       35 // 7 > SEUILS["creneau_jours_min"] - 1)


def test_le_budget_par_campagne_ecarte_la_pause_et_le_rodage():
    bloc = SOURCE.split("def _budget_campagnes_theme(")[1].split("\n    def ")[0]
    ok("les campagnes en pause sortent", "_BUDGET_VIVES" in bloc, bloc[:600])
    ok("la liste est définie", '_BUDGET_VIVES = {"ACTIVE", "ENABLED"}' in SOURCE)
    ok("les campagnes jeunes sortent", "_camp_jeunes" in bloc, bloc[:900])
    ok("les jours comptés sont ceux que la campagne couvre",
       "min(_fin, d2) - max(_deb, d1)" in bloc, bloc[-800:])


def test_l_arrivee_compare_les_memes_campagnes_des_deux_cotes():
    """La version naïve comparait TOUS les clics du thème aux sessions que GA4
    sait rattacher. Une campagne Meta sans paramètres de campagne dans ses liens
    (Meta n'en pose aucun tout seul) n'apparaît jamais dans `by_campaign` : ses
    visites valaient zéro pendant que ses clics comptaient, et la règle
    publiait « 2 000 clics n'arrivent nulle part » en accusant une balise qui
    marche. Un chiffre fabriqué au sens du §7."""
    bloc = SOURCE.split("def _arrivee_theme(")[1].split("\n    def ")[0]
    ok("les deux côtés sont intersectés",
       '_communes = [(_k, _v) for _k, _v in _pub.items() if _k[1] in _ga4]' in bloc,
       bloc[-900:])
    ok("rien en commun ⇒ `sessions=None`, donc silence",
       'if not _communes:' in bloc and '"sessions": None' in bloc, bloc[-900:])
    ok("elle ne lit plus le total du thème", "_pub_fenetre(" not in bloc, bloc[:400])
    ok("un nom vu des deux régies ne compte ses sessions qu'une fois",
       "_noms = {_k[1] for _k, _ in _communes}" in bloc, bloc[-600:])
    ok("et la limite est écrite dans la docstring",
       "pas celui de cette règle" in bloc, bloc[:2000])


def test_les_regies_refusent_de_parler_sur_une_attribution_trouee():
    """Le fait du ticket 18 : une campagne étiquetée dont le nom ne correspond
    plus verse sa dépense sans jamais verser son revenu."""
    bloc = SOURCE.split("def _regies_theme(")[1]
    ok("le drapeau existe", '"complet":' in bloc[:4000], bloc[:1500])
    ok("il exige TOUTES les campagnes dépensières",
       "all(_n and _n in _ga4 for _n in _par_nom)" in bloc[:4000])
    ok("et un nom porté par les deux régies les rend toutes deux incomplètes",
       'set(depenses["meta"]) & set(depenses["google"])' in bloc[:4000])
    ok("les deux lecteurs partagent la même lecture par campagne — une seule "
       "définition, deux appels",
       SOURCE.count("_pub_par_campagne_theme(") == 3,
       SOURCE.count("_pub_par_campagne_theme("))
    ok("le ticket 18 est cité", "18-revenu-google-non-rattachable" in bloc)
    ok("et il est dit qu'on ne le tranche pas",
       "NE TRANCHE PAS LA QUESTION DU TICKET 18" in bloc)


def test_les_quatre_seuils_neufs_portent_leur_source():
    """`CLAUDE.md` §7 : un seuil invoqué de mémoire se vérifie avant d'être
    invoqué, et un commentaire dit POURQUOI avec la mesure qui a tranché."""
    bloc = MOTEUR.split("SEUILS = {")[1].split("\n}")[0]
    for seuil in ("freq_plancher", "freq_cpc_hausse", "arrivee_perte_max",
                  "creneau_jours_min", "regie_roas_ratio"):
        ok(f"{seuil} est dans SEUILS", f'"{seuil}"' in bloc)
    ok("l'avertissement « jamais tourné sur un vrai compte » y est",
       "jamais tourné sur un vrai compte" in bloc, bloc[:100])
    ok("la convention 2,5 est donnée pour ce qu'elle est",
       "convention d'agences" in bloc)
    ok("les 30 % de Google sont cités", "30 %" in bloc)
    ok("le biais du dernier clic justifie le 4×", "DERNIER clic" in bloc)


def test_aucune_recolte_nouvelle_aucune_migration():
    """Le ticket 10 ne touche ni `saas/collecte/` ni `supabase/migrations/` : ce
    qu'il lit était déjà en base. Les trois lectures qu'il utilise sont celles
    que le ticket 07 avait déjà branchées, plus `by_campaign` de GA4."""
    # Les quatre entrent PAR LE LECTEUR depuis le ticket 16 : le worker les
    # DEMANDE, `saas/traitement/lecteur.py` va les chercher. Ce que ce test
    # prouve ne change pas — aucune lecture nouvelle n'a été ajoutée pour 10.
    LECTEUR = (pulse.RACINE / "saas" / "traitement"
               / "lecteur.py").read_text(encoding="utf-8")
    for demande, lecture in (("lecteur.meta_ads()", "fetch_meta_ads"),
                             ("lecteur.google_annonces()", "fetch_google_ads_ad_insights"),
                             ("lecteur.budgets_poses()", "fetch_platform_budgets"),
                             ("lecteur.ga4_contexte(", "build_ga4_context")):
        ok(f"{demande} est demandé par le worker", demande in SOURCE)
        ok(f"{lecture} était déjà là", f"{lecture}(" in LECTEUR)
    ok("aucun nouveau fetcher n'est importé pour ce ticket",
       "fetch_ga4_sessions" not in SOURCE and "fetch_meta_reach" not in SOURCE)


for _f in list(globals().values()):
    if callable(_f) and getattr(_f, "__name__", "").startswith("test_"):
        _f()
raise SystemExit(0 if bilan("Le branchement des six") else 1)
