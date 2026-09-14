"""LE NOM D'UNE CAMPAGNE NE S'INVENTE PAS, ET SURTOUT IL NE S'ÉCRIT PAS.

`labeling.py` listait les campagnes Google depuis `google_ads_insights` en ne
demandant que `campaign_id` — alors que cette table porte le vrai
`campaign_name`, récolté jour par jour. Sans ligne de config préexistante, il
fabriquait `Campagne <campaign_id>` et **l'upsertait dans
`google_campaign_config`**.

Deux dégâts, mesurés sur le compte de David le 2026-09-13 :

1. le revenu ne peut plus rentrer — `Campagne 24176742897` n'apparaîtra jamais
   en `utm_campaign`, donc 352.00 CHF de revenu GA4 réel n'ont plus de thème ;
2. Gemini classe à l'aveugle — la description envoyée était
   `[Campagne Google] «Campagne 24176742897»`, sans un mot de business, d'où
   les deux campagnes tombées dans le fourre-tout « Campagne Générale ».

    python3.12 test_nom_fabrique.py
"""
import pulse  # noqa: F401
from t import ok, egal, bilan

from faux_sb import FauxSupabase
from saas.recos_ia.labeling import _collect_candidates


VRAI_NOM = "ch_de_pmax_herbst_2026"
CID = "24187314124"


def compte(**extra):
    """Un compte minimal : une campagne Google récoltée, aucune ligne de config.

    C'est le cas exact des deux campagnes muettes de David — `label_source`
    n'existait pas encore pour elles, personne n'avait jamais écrit leur
    config.
    """
    base = dict(
        profiles=[{"id": "u1", "labels": ["Été"], "business_type": "local",
                   "objectif": "ventes"}],
        instagram_organic_posts=[],
        meta_ads_insights=[],
        meta_campaign_config=[],
        google_ads_insights=[{"campaign_id": CID, "campaign_name": VRAI_NOM,
                              "date_start": "2026-09-09"}],
        google_campaign_config=[],
    )
    base.update(extra)
    return FauxSupabase(**base)


def google(candidats):
    return [c for c in candidats if c.get("kind") == "google"]


# ── 1 · CE QU'ON MONTRE À GEMINI ─────────────────────────────────────────────

def test_la_description_porte_le_vrai_nom():
    """`ch_de_pmax_herbst_2026` dit la langue, le format (pmax) et la saison.
    `Campagne 24187314124` ne dit rien — et c'est ce que Gemini recevait."""
    candidats, _ = _collect_candidates(compte(), "u1")
    goo = google(candidats)
    egal("une campagne Google est candidate", len(goo), 1)
    ok("sa description porte le vrai nom",
       VRAI_NOM in goo[0]["desc"], f"desc = {goo[0]['desc']!r}")
    ok("et plus l'identifiant déguisé en nom",
       f"Campagne {CID}" not in goo[0]["desc"], f"desc = {goo[0]['desc']!r}")


def test_le_nom_courant_gagne_sur_le_nom_recolte():
    """`google_campaign_config.campaign_name` reste la source la plus fraîche
    quand elle existe : la récolte garde le nom du JOUR de la récolte."""
    sb = compte(google_campaign_config=[
        {"campaign_id": CID, "campaign_name": "nom_courant", "label": None,
         "label_source": None}])
    goo = google(_collect_candidates(sb, "u1")[0])
    ok("la config prime", "nom_courant" in goo[0]["desc"], f"desc = {goo[0]['desc']!r}")


def test_sans_aucun_nom_connu_le_repli_reste_affichable():
    """Le repli `Campagne <id>` n'est pas interdit : il est interdit d'ÉCRITURE.
    En description, il vaut mieux qu'une ligne vide."""
    sb = compte(google_ads_insights=[{"campaign_id": CID, "campaign_name": "",
                                      "date_start": "2026-09-09"}])
    goo = google(_collect_candidates(sb, "u1")[0])
    egal("la campagne reste candidate", len(goo), 1)
    ok("avec le repli en description",
       f"Campagne {CID}" in goo[0]["desc"], f"desc = {goo[0]['desc']!r}")
    egal("et aucun nom à écrire", goo[0].get("name"), None)


# ── 2 · CE QU'ON ÉCRIT EN BASE ───────────────────────────────────────────────
#
# Le cœur du ticket. `_collect_candidates` prépare le champ `name` ; c'est lui
# que la boucle d'écriture verse dans `google_campaign_config`.

def test_le_candidat_porte_le_vrai_nom_a_ecrire():
    goo = google(_collect_candidates(compte(), "u1")[0])
    egal("le nom à écrire est le vrai", goo[0].get("name"), VRAI_NOM)


def test_un_nom_fabrique_ne_part_jamais_en_base():
    """La frontière que le défaut a franchie : `Campagne <id>` est un habillage
    d'affichage, jamais une valeur stockée."""
    sb = compte(google_ads_insights=[{"campaign_id": CID, "campaign_name": "",
                                      "date_start": "2026-09-09"}])
    goo = google(_collect_candidates(sb, "u1")[0])
    ok("aucun nom fabriqué dans le champ destiné à la base",
       goo[0].get("name") != f"Campagne {CID}", f"name = {goo[0].get('name')!r}")


def test_le_nom_le_plus_recent_gagne_entre_deux_recoltes():
    """La récolte garde le nom du jour ; après un renommage, l'historique porte
    les deux. On écrit le plus récent — `date_start desc` est déjà l'ordre de
    la requête."""
    sb = compte(google_ads_insights=[
        {"campaign_id": CID, "campaign_name": "nom_neuf", "date_start": "2026-09-09"},
        {"campaign_id": CID, "campaign_name": "nom_vieux", "date_start": "2026-08-01"}])
    goo = google(_collect_candidates(sb, "u1")[0])
    egal("le plus récent", goo[0].get("name"), "nom_neuf")


# ── 3 · L'ÉCRITURE, DE BOUT EN BOUT ──────────────────────────────────────────
#
# Les tests ci-dessus lisent le champ `name` que prépare `_collect_candidates`.
# Ceux-ci vérifient ce qui part RÉELLEMENT dans `google_campaign_config` —
# c'est là que le défaut vivait, et c'est le seul endroit qui compte.
# Gemini est remplacé par une réponse fixe : on teste notre écriture, pas la
# sienne.

def auto_label_sans_gemini(sb, themes_par_numero):
    """`auto_label` avec Gemini remplacé par une réponse fixe, et la clé API
    simulée — sinon la fonction s'arrête à la première ligne."""
    import saas.recos_ia.labeling as labeling
    vrai_gemini, vrai_secret = labeling.call_gemini_json, labeling.secret
    labeling.call_gemini_json = lambda *_a, **_k: {"labels": themes_par_numero}
    labeling.secret = lambda cle: "cle-de-test" if cle == "gemini.api_key" else vrai_secret(cle)
    try:
        return labeling.auto_label(sb, "u1")
    finally:
        labeling.call_gemini_json, labeling.secret = vrai_gemini, vrai_secret


def test_l_upsert_porte_le_vrai_nom():
    sb = compte()
    auto_label_sans_gemini(sb, {"1": "Été"})
    lignes = sb.upserts("google_campaign_config")
    egal("une ligne de config écrite", len(lignes), 1)
    egal("avec le vrai nom", lignes[0].get("campaign_name"), VRAI_NOM)
    egal("et le thème de Gemini", lignes[0].get("label"), "Été")


def test_l_upsert_n_envoie_pas_de_nom_quand_aucun_n_est_connu():
    """LE CŒUR DU TICKET. Sans nom réel, la colonne ne part pas : la valeur par
    défaut de la table (`''`) se lit comme « on ne sait pas », alors qu'un
    `Campagne <id>` écrit se fait passer pour un nom et détruit le pont du
    revenu."""
    sb = compte(google_ads_insights=[{"campaign_id": CID, "campaign_name": "",
                                      "date_start": "2026-09-09"}])
    auto_label_sans_gemini(sb, {"1": "Été"})
    lignes = sb.upserts("google_campaign_config")
    egal("la ligne est quand même écrite", len(lignes), 1)
    ok("mais sans la colonne du nom",
       "campaign_name" not in lignes[0], f"ligne = {lignes[0]!r}")
    egal("l'étiquette, elle, est bien posée", lignes[0].get("label"), "Été")


def test_aucun_upsert_ne_contient_jamais_un_nom_fabrique():
    """La garde générale : quel que soit le chemin, `Campagne <id>` ne doit
    jamais atteindre la base."""
    for insights in ([{"campaign_id": CID, "campaign_name": "", "date_start": "2026-09-09"}],
                     [{"campaign_id": CID, "campaign_name": VRAI_NOM, "date_start": "2026-09-09"}]):
        sb = compte(google_ads_insights=insights)
        auto_label_sans_gemini(sb, {"1": "Été"})
        for ligne in sb.upserts("google_campaign_config"):
            ok("aucun nom fabriqué en base",
               ligne.get("campaign_name") != f"Campagne {CID}", f"ligne = {ligne!r}")


if __name__ == "__main__":
    for f in list(globals().values()):
        if callable(f) and getattr(f, "__name__", "").startswith("test_"):
            f()
    raise SystemExit(0 if bilan("Ticket 43 — le nom fabriqué") else 1)
