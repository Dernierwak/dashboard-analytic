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

from lecteur_fige import compte, Campagne
from saas.traitement.build_report import build_payload

AUJOURD_HUI = date(2026, 9, 13)
DERNIERE_DONNEE = AUJOURD_HUI - timedelta(days=1)


def _fixture_meta(**kw):
    return compte([Campagne("Été – Meta", canal="meta",
                            depense_jour=30.0, clics_jour=100,
                            impressions_jour=4000, revenu_jour=40.0)],
                  aujourd_hui=AUJOURD_HUI, **kw)


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


# ── AUCUN CHIFFRE QUI NE SORTE DES LIGNES D'ENTRÉE ───────────────────────

def test_les_montants_du_compte_se_rebatissent_a_la_main():
    """La propriété qui protège le §7 : chaque montant du payload se recalcule
    depuis les lignes servies au lecteur, sans rien connaître du code qui l'a
    produit."""
    campagnes = [
        Campagne("Été – Google", canal="google", depense_jour=20.0,
                 clics_jour=60, impressions_jour=3000, revenu_jour=50.0),
        Campagne("Été – Meta", canal="meta", depense_jour=10.0,
                 clics_jour=40, impressions_jour=2000, revenu_jour=30.0),
    ]
    p = build_payload(compte(campagnes, aujourd_hui=AUJOURD_HUI))

    proche("les clics du compte sur la semaine",
           p["kpis"]["clicks"], (60 + 40) * 7)
    proche("la dépense du compte sur la semaine",
           p["kpis"]["spend"], (20.0 + 10.0) * 7)
    proche("le CTR du compte est bien clics ÷ impressions",
           p["kpis"]["ctr"], (60 + 40) / (3000 + 2000) * 100)


def test_aucun_infini_aucun_nan_nulle_part_dans_le_payload():
    """« Un +∞ % n'existe pas » (`CLAUDE.md` §7). Une campagne dont la
    semaine précédente était à zéro est exactement le cas qui en fabriquait un."""
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
    neuve = Campagne("Neuve – Meta", canal="meta",
                     depense_jour=25.0, clics_jour=80, impressions_jour=2500,
                     revenu_jour=40.0)
    lecteur = compte([neuve], aujourd_hui=AUJOURD_HUI)
    lecteur._meta_ads = [l for l in lecteur._meta_ads
                         if l["date_start"] >= (DERNIERE_DONNEE
                                                - timedelta(days=6)).isoformat()]
    balaie(build_payload(lecteur))


if __name__ == "__main__":
    for nom, fn in sorted(list(globals().items())):
        if nom.startswith("test_"):
            fn()
    raise SystemExit(0 if bilan("Les chiffres du payload") else 1)
