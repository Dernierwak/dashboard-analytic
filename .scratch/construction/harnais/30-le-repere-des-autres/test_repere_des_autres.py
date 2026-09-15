"""Une candidate ne fait jamais partie du repère qui la juge — ticket 30.

Ce que ce fichier prouve, et que le harnais 07 ne pouvait pas voir parce que ses
fixtures montent toujours TROIS annonces par Groupe :

  · `regle_annonce_chere` parle sur un Groupe de DEUX annonces — c'est la forme
    canonique d'un test A/B, et c'était le cas où elle était muette ;
  · elle reste muette quand l'écart est honnête, à deux comme à trois ;
  · le repère est pondéré par les clics, donc un petit voisin ne le commande pas ;
  · les gardes du ticket 07 (campagne jeune, plancher de dépense, canal, Groupe
    inconnu) tiennent toujours ;
  · le conseil ne dit jamais « les 1 autres annonces ».

Les CHIFFRES restent dans ce fichier, jamais dans une fixture : un test dont les
nombres sont cachés ne dit plus contre quel seuil il se place.
"""
import pulse  # noqa: F401
from t import ok, egal, bilan
from fixtures import annonce

from saas.recos_ia.reco_engine import SEUILS
from saas.recos_ia.regles_payantes import (
    _les_autres, regle_annonce_chere, regle_annonce_locomotive,
)

RATIO = SEUILS["cpc_ratio"]            # 2.0
PLANCHER = SEUILS["cpc_spend_min"]     # 50 CHF


def ad(cle, cpc, clics, *, groupe="Groupe A", canal="google", jeune=False):
    """Une annonce au prix du clic voulu, EXACTEMENT — la dépense en découle."""
    return annonce(cle, cle, groupe=groupe, canal=canal, clics=clics,
                   depense=cpc * clics, jeune=jeune)


# ── Le cœur du ticket : deux annonces ────────────────────────────────────────

def test_deux_annonces_un_ecart_enorme_elle_parle():
    """40 CHF le clic à côté de 4 CHF. La médiane valait 22 et la règle se
    taisait : il aurait fallu que la candidate dépasse 44, or elle EST le haut
    de la médiane. Aucun nombre positif ne le permettait."""
    r = regle_annonce_chere("Été", [ad("chere", 40.0, 100), ad("saine", 4.0, 100)])
    ok("un conseil sort sur un Groupe de deux", r is not None)
    egal("clé", r["key"], "annonce_chere")
    ok("le repère est celui de la voisine, 4.00",
       "4.00" in r["observation"], r["observation"])
    ok("l'écart annoncé est 10×", "10.0×" in r["observation"], r["observation"])


def test_deux_annonces_pile_au_seuil():
    """Le seuil se franchit à 2.00× exactement, pas à 2.01×."""
    r = regle_annonce_chere("Été", [ad("chere", 4.0 * RATIO, 100),
                                    ad("saine", 4.0, 100)])
    ok("pile au ratio, elle parle", r is not None)


def test_deux_annonces_juste_sous_le_seuil_elle_se_tait():
    r = regle_annonce_chere("Été", [ad("chere", 4.0 * RATIO - 0.04, 100),
                                    ad("saine", 4.0, 100)])
    egal("juste sous le ratio, aucun conseil", r, None)


def test_deux_annonces_ecart_honnete_elle_se_tait():
    """5 CHF contre 4 CHF n'est pas un problème de créa."""
    egal("écart honnête, aucun conseil",
         regle_annonce_chere("Été", [ad("chere", 5.0, 100), ad("saine", 4.0, 100)]),
         None)


# ── Le repère est pondéré, et la candidate n'en fait pas partie ──────────────

def test_un_petit_voisin_ne_commande_pas_le_repere():
    """La livraison concentre les clics sur l'annonce qui marche : dans un vrai
    Groupe les volumes sont très inégaux. Le Groupe paie 1 CHF le clic sur
    10 000 clics ; deux miettes à 30 CHF ne doivent pas faire du repère 30."""
    ads = [ad("mini1", 30.0, 5), ad("mini2", 30.0, 5),
           ad("gros", 1.0, 10000), ad("moyenne", 25.0, 400)]
    r = regle_annonce_chere("Été", ads)
    ok("la règle parle malgré les deux miettes chères", r is not None)
    # Le repère pondéré vaut 1.94 CHF — (10000×1 + 5×30 + 400×25) / 10405.
    # Une médiane non pondérée des quatre aurait donné 27.50 et la règle se
    # serait tue : c'est tout l'écart entre les deux définitions du repère.
    ok("le repère est celui que le Groupe paie vraiment, pas la médiane",
       "1.94 CHF" in r["observation"], r["observation"])


def test_deux_annonces_cheres_ne_font_plus_taire_la_regle():
    """L'inquiétude écrite dans le ticket 30, mise à l'épreuve : quand DEUX
    annonces sur quatre brûlent, le repère des autres monte — mais pas assez
    pour étouffer la règle."""
    ads = [ad("chere1", 40.0, 100), ad("chere2", 40.0, 100),
           ad("saine1", 4.0, 100), ad("saine2", 4.0, 100)]
    ok("elle parle encore", regle_annonce_chere("Été", ads) is not None)


def test_la_candidate_ne_se_compare_jamais_a_elle_meme():
    """Trois annonces identiques n'ont aucun écart — si la candidate entrait
    dans son propre repère, le ratio serait faussé dans un sens ou dans l'autre."""
    ads = [ad(f"a{i}", 6.0, 100) for i in range(3)]
    egal("aucun écart, aucun conseil", regle_annonce_chere("Été", ads), None)


# ── Les gardes du ticket 07 tiennent toujours ───────────────────────────────

def test_le_plancher_de_depense_tient_a_deux():
    """Une annonce chère qui n'a presque rien dépensé ne vaut pas un conseil."""
    petite = ad("chere", 40.0, 1)          # 40 CHF dépensés, sous le plancher
    egal("sous le plancher, aucun conseil",
         regle_annonce_chere("Été", [petite, ad("saine", 4.0, 100)]), None)
    ok("le plancher testé est bien celui du moteur", PLANCHER > 40.0)


def test_une_campagne_jeune_sort_des_deux_cotes_a_deux_annonces():
    """Un Groupe de deux dont l'une est jeune n'a plus qu'une comparable."""
    egal("la jeune ne peut pas être dénoncée",
         regle_annonce_chere("Été", [ad("chere", 40.0, 100, jeune=True),
                                     ad("saine", 4.0, 100)]), None)
    egal("et elle ne sert pas non plus de repère",
         regle_annonce_chere("Été", [ad("chere", 40.0, 100),
                                     ad("saine", 4.0, 100, jeune=True)]), None)


def test_deux_canaux_ne_se_comparent_jamais_a_deux():
    """La leçon de `_par_groupe` : un clic Search et un clic social n'ont pas
    le même prix, et l'écart mesurerait le mélange de canaux."""
    egal("deux canaux, aucun conseil",
         regle_annonce_chere("Été", [ad("chere", 40.0, 100, canal="google"),
                                     ad("saine", 4.0, 100, canal="meta")]), None)


def test_une_annonce_sans_clic_reste_dehors_des_deux_cotes():
    """Zéro clic → pas de prix du clic calculable. L'inclure au repère à 0 CHF
    le tirerait vers le bas et ferait parler la règle pour rien."""
    muette = annonce("muette", "Muette", groupe="Groupe A", canal="google",
                     clics=0, depense=500.0)
    egal("deux annonces dont une muette, aucun conseil",
         regle_annonce_chere("Été", [ad("chere", 6.0, 100), muette]), None)


# ── Le français du conseil ──────────────────────────────────────────────────

def test_jamais_les_1_autres_annonces():
    egal("une seule voisine", _les_autres(1, "annonce"), "l'autre annonce")
    egal("plusieurs voisines", _les_autres(3, "annonce"), "les 3 autres annonces")
    egal("le mot est libre", _les_autres(1, "Groupe"), "l'autre Groupe")

    r = regle_annonce_chere("Été", [ad("chere", 40.0, 100), ad("saine", 4.0, 100)])
    ok("le conseil ne dit pas « les 1 autres »",
       "1 autres" not in r["observation"], r["observation"])
    ok("il dit « l'autre annonce »",
       "l'autre annonce" in r["observation"], r["observation"])


def test_la_locomotive_aussi_parle_francais_a_deux():
    """Même helper, même défaut évité : `locomotive` comparait déjà au repère
    des autres, mais écrivait « les 1 autres annonces » sur un Groupe de deux."""
    plancher = SEUILS["ctr_impressions_min"]
    forte = annonce("forte", "Forte", groupe="G", canal="google",
                    impressions=plancher, clics=int(plancher * 0.05))
    faible = annonce("faible", "Faible", groupe="G", canal="google",
                     impressions=plancher, clics=int(plancher * 0.01))
    r = regle_annonce_locomotive("Été", [forte, faible])
    ok("un conseil sort sur un Groupe de deux", r is not None)
    ok("et il dit « l'autre annonce »",
       "l'autre annonce" in r["observation"], r["observation"])


for _nom_test, _fn in sorted(list(globals().items())):
    if _nom_test.startswith("test_"):
        _fn()

raise SystemExit(0 if bilan("Le repère des autres (ticket 30)") else 1)
