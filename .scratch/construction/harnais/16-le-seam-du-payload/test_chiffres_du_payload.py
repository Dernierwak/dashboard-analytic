"""Les chiffres du payload, mesurés contre les lignes qui les ont produits.

C'est `CLAUDE.md` §7 rendu vérifiable : aucun chiffre fabriqué, une absence de
donnée n'est pas un zéro, et toute comparaison exclut le jour en cours. Jusqu'ici
ces propriétés étaient tenues par relecture ; ici on les mesure sur ce que la
construction rend vraiment.

CHAQUE ATTENDU EST RECALCULÉ DANS LE TEST à partir de la description des
campagnes — jamais lu dans le payload qu'on vérifie. Sinon on comparerait un
chiffre à lui-même.
"""
from datetime import date, timedelta

import pulse  # noqa: F401
from t import ok, egal, proche, bilan

from lecteur_fige import compte, Campagne, Annonce, JOURS
from saas.traitement.build_report import build_payload

AUJOURD_HUI = date(2026, 9, 13)
DERNIERE_DONNEE = AUJOURD_HUI - timedelta(days=1)


def carte(payload, label):
    for t in payload["themes_focus"]:
        if t["label"] == label:
            return t
    return None


# ── 1 · LE ROAS D'UN THÈME BI-RÉGIE (ticket 01) ──────────────────────────────

def test_le_roas_d_un_theme_couvre_le_meme_perimetre_des_deux_cotes():
    """Le défaut d'origine : un revenu Meta+Google divisé par une dépense Meta
    seule. Ici le thème dépense sur les DEUX régies, et les deux montants du
    payload doivent contenir les deux.
    """
    google = Campagne("Été – Google", theme="Été", canal="google",
                      depense_jour=20.0, clics_jour=60, impressions_jour=3000,
                      revenu_jour=50.0)
    meta = Campagne("Été – Meta", theme="Été", canal="meta",
                    depense_jour=10.0, clics_jour=40, impressions_jour=2000,
                    revenu_jour=30.0)
    p = build_payload(compte([google, meta], etoiles=["Été"],
                             aujourd_hui=AUJOURD_HUI))
    bilan_theme = carte(p, "Été")["summary"]

    depense_attendue = (20.0 + 10.0) * JOURS
    revenu_attendu = (50.0 + 30.0) * JOURS
    proche("la dépense porte les deux régies", bilan_theme["spend"], depense_attendue)
    proche("le revenu porte les deux régies", bilan_theme["revenue"], revenu_attendu)
    proche("et le ROAS est bien leur quotient", bilan_theme["roas"],
           round(revenu_attendu / depense_attendue, 2))
    ok("une seule régie ne suffirait pas à ce chiffre",
       bilan_theme["spend"] > 20.0 * JOURS,
       f"{bilan_theme['spend']} vs {20.0 * JOURS}")


def test_le_roas_ne_se_prononce_pas_sous_le_seuil_de_jugement():
    """Le seuil des 100 CHF vit dans la vue (`juge`), plus en Python. Sous lui,
    pas de ROAS du tout — pas un ROAS « prudent »."""
    petite = Campagne("Test – Google", theme="Test", canal="google",
                      depense_jour=0.5, clics_jour=2, impressions_jour=100,
                      revenu_jour=1.0)
    lecteur = compte([petite], etoiles=["Test"], aujourd_hui=AUJOURD_HUI)
    vue = {l["label"]: l for l in lecteur.themes_regroupes()}
    ok("la vue dit que le thème n'est pas jugeable", vue["Test"]["juge"] is False)
    egal("et elle ne rend aucun ROAS", vue["Test"]["roas"], None)
    p = build_payload(lecteur)
    egal("le payload non plus", carte(p, "Test")["summary"]["roas"], None)


# ── 2 · UN THÈME SANS REVENU CONFIRMÉ NE PORTE AUCUN REVENU ──────────────────

def test_un_theme_sans_revenu_confirme_ne_porte_ni_zero_ni_estimation():
    """Sans réponse de la vue, pas de revenu — et on le dit (spec, § « le seul
    endroit où le regroupement est implémenté »).

    UNE EXCEPTION MESURÉE ET TICKETÉE : `payload.themes.rows[].rev` écrit `0.0`
    au lieu de rien. Elle est nommée ici plutôt que contournée — voir le
    ticket 40, ouvert par ce harnais.
    """
    avec = Campagne("Été – Google", theme="Été", canal="google",
                    depense_jour=30.0, clics_jour=100, impressions_jour=4000,
                    revenu_jour=60.0)
    sans = Campagne("Muet – Google", theme="Muet", canal="google",
                    depense_jour=15.0, clics_jour=30, impressions_jour=1500,
                    revenu_jour=None)
    p = build_payload(compte([avec, sans], etoiles=["Été", "Muet"],
                             aujourd_hui=AUJOURD_HUI))

    muet = carte(p, "Muet")["summary"]
    egal("aucun revenu sur la carte", muet["revenue"], None)
    egal("aucun ROAS non plus", muet["roas"], None)
    ok("mais la dépense, elle, est bien là", (muet["spend"] or 0) > 0)

    matrice = {t["label"]: t for t in p["matrice"]["themes"]}
    egal("aucun revenu dans la matrice", matrice["Muet"]["revenue"], None)
    egal("aucun ROAS dans la matrice", matrice["Muet"]["roas"], None)
    ok("le thème qui en a, lui, l'affiche", matrice["Été"]["revenue"] is not None)


# ── 3 · DEUX ANNONCES HOMONYMES RESTENT DEUX ANNONCES (ticket 03) ────────────

def test_deux_annonces_au_meme_nom_restent_deux_dans_les_comparaisons():
    """Deux Annonces d'un même Groupe portent le MÊME nom et des identifiants
    différents. Si elles fusionnaient — le bug que le ticket 03 répare —, le
    Groupe n'aurait plus qu'une annonce mesurée et la règle qui compare deux
    voisines se tairait. Sa présence est donc la preuve qu'elles sont restées
    deux."""
    homonymes = Campagne(
        "Été – Search", theme="Été", canal="google", depense_jour=30.0,
        clics_jour=100, impressions_jour=4000, revenu_jour=40.0,
        annonces=[Annonce("Visuel", "Groupe 1", 140, 350, 14000, 7),
                  Annonce("Visuel", "Groupe 1", 70, 175, 7000, 0)])
    p = build_payload(compte([homonymes], etoiles=["Été"], aujourd_hui=AUJOURD_HUI))
    cles = [r["key"] for r in carte(p, "Été")["recos"]]
    ok("la comparaison entre deux voisines a parlé",
       "annonce_sans_conversion" in cles, cles)

    seule = Campagne(
        "Été – Search", theme="Été", canal="google", depense_jour=30.0,
        clics_jour=100, impressions_jour=4000, revenu_jour=40.0,
        annonces=[Annonce("Visuel", "Groupe 1", 140, 350, 14000, 7)])
    p2 = build_payload(compte([seule], etoiles=["Été"], aujourd_hui=AUJOURD_HUI))
    cles2 = [r["key"] for r in carte(p2, "Été")["recos"]]
    ok("et elle se tait quand il n'y a vraiment qu'une annonce",
       "annonce_sans_conversion" not in cles2, cles2)


# ── 4 · LA FENÊTRE, LES DATES, ET LA PUBLICATION IDEMPOTENTE (ticket 13) ────

def _fixture_meta(**kw):
    return compte([Campagne("Été – Meta", theme="Été", canal="meta",
                            depense_jour=30.0, clics_jour=100,
                            impressions_jour=4000, revenu_jour=40.0)],
                  etoiles=["Été"], aujourd_hui=AUJOURD_HUI, **kw)


def test_la_fenetre_fait_sept_jours_pleins_et_exclut_le_jour_en_cours():
    p = build_payload(_fixture_meta())
    debut = date.fromisoformat(p["since"])
    fin = date.fromisoformat(p["until"])
    egal("sept jours pleins", (fin - debut).days + 1, 7)
    egal("elle finit à la dernière donnée", fin, DERNIERE_DONNEE)
    ok("et jamais aujourd'hui", fin < AUJOURD_HUI)


def test_la_semaine_declaree_sort_de_la_fenetre_et_non_du_jour_de_fabrication():
    """Le défaut réparé par le ticket 13 : republier dans une autre semaine
    calendaire écrivait une DEUXIÈME ligne pour les mêmes chiffres. Vérifié
    jusqu'ici sur le texte du worker ; ici la construction est rejouée pour de
    bon, sur les mêmes lignes, trois jours de fabrication différents."""
    import copy
    reference = _fixture_meta()
    attendus = None
    for jour in (AUJOURD_HUI, AUJOURD_HUI + timedelta(days=3),
                 AUJOURD_HUI + timedelta(days=21)):
        lecteur = copy.deepcopy(reference)
        lecteur._aujourd_hui = jour
        p = build_payload(lecteur)
        trois = (p["week_start"], p["since"], p["until"], p["week_label"])
        if attendus is None:
            attendus = trois
            egal("la semaine sort du lundi de la FENÊTRE",
                 p["week_start"],
                 (DERNIERE_DONNEE - timedelta(days=DERNIERE_DONNEE.weekday())).isoformat())
        egal(f"fabriqué le {jour} : la même ligne d'écriture", trois, attendus)


def test_les_bornes_de_la_fenetre_sont_dans_le_payload_et_lisibles():
    """Deux des trois dates en tête du rapport sortent d'ici — « mesuré du X au
    X ». Les deux autres (publié, mis à jour) vivent sur la LIGNE en base, pas
    dans le payload : ce harnais ne peut donc pas les voir, et ne le prétend
    pas."""
    p = build_payload(_fixture_meta())
    for champ in ("since", "until", "week_start"):
        ok(f"`{champ}` est une date ISO lisible",
           len(str(p[champ])) == 10 and date.fromisoformat(p[champ]))
    ok("le libellé de semaine dit la fenêtre, pas aujourd'hui",
       str(DERNIERE_DONNEE.day) in p["week_label"])


# ── 5 · AUCUN CHIFFRE QUI NE SORTE DES LIGNES D'ENTRÉE ───────────────────────

def test_les_montants_d_un_theme_se_rebatissent_a_la_main():
    """La propriété qui protège le §7 : chaque montant du payload se recalcule
    depuis les lignes servies au lecteur, sans rien connaître du code qui l'a
    produit."""
    campagnes = [
        Campagne("Été – Google", theme="Été", canal="google", depense_jour=20.0,
                 clics_jour=60, impressions_jour=3000, revenu_jour=50.0),
        Campagne("Été – Meta", theme="Été", canal="meta", depense_jour=10.0,
                 clics_jour=40, impressions_jour=2000, revenu_jour=30.0),
    ]
    p = build_payload(compte(campagnes, etoiles=["Été"], aujourd_hui=AUJOURD_HUI))
    bilan_theme = carte(p, "Été")["summary"]

    proche("la dépense de la SEMAINE = sept jours de dépense",
           bilan_theme["spend_week"], (20.0 + 10.0) * 7)
    proche("la dépense TOTALE = tout l'historique servi",
           bilan_theme["spend"], (20.0 + 10.0) * JOURS)
    proche("les clics du compte sur la semaine",
           p["kpis"]["clicks"], (60 + 40) * 7)
    proche("la dépense du compte sur la semaine",
           p["kpis"]["spend"], (20.0 + 10.0) * 7)
    proche("le CTR du compte est bien clics ÷ impressions",
           p["kpis"]["ctr"], (60 + 40) / (3000 + 2000) * 100)


def test_aucun_infini_aucun_nan_nulle_part_dans_le_payload():
    """« Un +∞ % n'existe pas » (`CLAUDE.md` §7). Un thème dont la semaine
    précédente était à zéro est exactement le cas qui en fabriquait un."""
    import math

    def balaie(valeur, chemin="payload"):
        if isinstance(valeur, dict):
            for cle, v in valeur.items():
                balaie(v, f"{chemin}.{cle}")
        elif isinstance(valeur, (list, tuple)):
            for i, v in enumerate(valeur):
                balaie(v, f"{chemin}[{i}]")
        elif isinstance(valeur, float):
            ok(f"{chemin} est un nombre fini", math.isfinite(valeur), valeur)

    # Une campagne qui DÉMARRE dans la fenêtre : la semaine précédente est à zéro.
    neuve = Campagne("Neuve – Meta", theme="Neuve", canal="meta",
                     depense_jour=25.0, clics_jour=80, impressions_jour=2500,
                     revenu_jour=40.0)
    lecteur = compte([neuve], etoiles=["Neuve"], aujourd_hui=AUJOURD_HUI)
    lecteur._meta_ads = [l for l in lecteur._meta_ads
                         if l["date_start"] >= (DERNIERE_DONNEE
                                                - timedelta(days=6)).isoformat()]
    balaie(build_payload(lecteur))


if __name__ == "__main__":
    for nom, fn in sorted(list(globals().items())):
        if nom.startswith("test_"):
            fn()
    raise SystemExit(0 if bilan("Les chiffres du payload") else 1)
