"""LE COMPTE DES CAMPAGNES D'UN THÈME NE SE DÉDUIT PLUS DE LA LISTE — ticket 34.

`themes_focus[].campaigns` est plafonnée à huit, et ce sont les huit plus
grosses dépenses (`insights.build_matrix` trie par dépense décroissante). En
compter les éléments répond donc « huit » sur un thème qui en porte quatorze,
et « Meta seulement » sur un thème qui dépense aussi chez Google — deux
chiffres fabriqués au sens de `CLAUDE.md` §7, l'un sur le NOMBRE, l'autre sur la
PRÉSENCE.

LA PROPRIÉTÉ, EN UNE PHRASE : tout ce qui se lit sur le compte des campagnes
d'un thème vient de `summary` (`n_campaigns`, `n_campaigns_canal`), qui porte
`t_camps` ENTIER — jamais de la liste publiée, qui est un extrait et le dit.

    python3.12 test_compte_des_campagnes.py
"""
from datetime import date

import pulse  # noqa: F401
from t import ok, egal, bilan

from lecteur_fige import compte, Campagne
from saas.traitement.build_report import build_payload, _compte_par_canal

AUJOURD_HUI = date(2026, 9, 13)

# Le plafond de la liste publiée, tel que le worker l'écrit (`t_camps[:8]`).
# Il est recopié ici EXPRÈS : si quelqu'un le déplace, ce harnais doit tomber
# et forcer à relire ce que le front en déduit, pas suivre en silence.
PLAFOND_PUBLIE = 8


def carte(payload, label):
    for t in payload["themes_focus"]:
        if t["label"] == label:
            return t
    return None


def theme_a_deux_regies():
    """Douze campagnes Meta grasses, deux campagnes Google maigres.

    Les huit plus grosses dépenses sont donc TOUTES Meta : c'est le jeu
    minimal où la liste publiée perd une régie entière.
    """
    grosses = [Campagne(f"Hiver – Meta {i}", theme="Hiver", canal="meta",
                        depense_jour=10.0, clics_jour=40, impressions_jour=2000,
                        revenu_jour=30.0)
               for i in range(12)]
    maigres = [Campagne(f"Hiver – Google {i}", theme="Hiver", canal="google",
                        depense_jour=0.5, clics_jour=3, impressions_jour=200,
                        revenu_jour=1.0)
               for i in range(2)]
    return grosses + maigres


# ── 1 · LE NOMBRE ────────────────────────────────────────────────────────────

def test_la_liste_publiee_reste_un_extrait_et_le_compte_reste_entier():
    """Le fait du ticket : la liste plafonne, le compte ne plafonne pas."""
    p = build_payload(compte(theme_a_deux_regies(), etoiles=["Hiver"],
                             aujourd_hui=AUJOURD_HUI))
    t = carte(p, "Hiver")
    egal("la liste publiée s'arrête au plafond",
         len(t["campaigns"]), PLAFOND_PUBLIE)
    egal("le compte, lui, porte les quatorze", t["summary"]["n_campaigns"], 14)
    ok("et les deux ne se confondent pas",
       t["summary"]["n_campaigns"] > len(t["campaigns"]),
       f"{t['summary']['n_campaigns']} vs {len(t['campaigns'])}")


# ── 2 · LA PRÉSENCE ──────────────────────────────────────────────────────────

def test_la_liste_publiee_perd_une_regie_entiere():
    """Le défaut qu'on répare, montré sur la liste elle-même.

    Sans ce test, `n_campaigns_canal` ressemblerait à un champ de confort :
    c'est lui qui prouve que le déduire de `campaigns` répondrait FAUX.
    """
    p = build_payload(compte(theme_a_deux_regies(), etoiles=["Hiver"],
                             aujourd_hui=AUJOURD_HUI))
    t = carte(p, "Hiver")
    egal("les huit gardées sont toutes Meta",
         sorted({c["channel"] for c in t["campaigns"]}), ["meta"])


def test_le_compte_par_regie_voit_la_regie_que_la_liste_perd():
    p = build_payload(compte(theme_a_deux_regies(), etoiles=["Hiver"],
                             aujourd_hui=AUJOURD_HUI))
    par_canal = carte(p, "Hiver")["summary"]["n_campaigns_canal"]
    egal("les douze Meta sont comptées", par_canal.get("meta"), 12)
    egal("les deux Google aussi", par_canal.get("google"), 2)


def test_le_compte_par_regie_boucle_avec_le_compte_total():
    """Deux chiffres du même payload qui se contrediraient seraient pires
    qu'un seul : la somme des régies EST le total, par construction."""
    p = build_payload(compte(theme_a_deux_regies(), etoiles=["Hiver"],
                             aujourd_hui=AUJOURD_HUI))
    bilan_theme = carte(p, "Hiver")["summary"]
    egal("la somme des régies fait le total",
         sum(bilan_theme["n_campaigns_canal"].values()),
         bilan_theme["n_campaigns"])


# ── 3 · LES BORDS ────────────────────────────────────────────────────────────

def test_un_theme_sous_le_plafond_compte_exactement_pareil():
    """Le cas ordinaire ne doit pas payer la réparation : sous le plafond, la
    liste et le compte disent la même chose, et le front doit pouvoir s'en
    servir pour décider s'il manque quelque chose."""
    camps = [Campagne("Été – Meta", theme="Été", canal="meta",
                      depense_jour=10.0, clics_jour=40, impressions_jour=2000,
                      revenu_jour=30.0),
             Campagne("Été – Google", theme="Été", canal="google",
                      depense_jour=20.0, clics_jour=60, impressions_jour=3000,
                      revenu_jour=50.0)]
    p = build_payload(compte(camps, etoiles=["Été"], aujourd_hui=AUJOURD_HUI))
    t = carte(p, "Été")
    egal("la liste porte tout", len(t["campaigns"]), 2)
    egal("le compte dit la même chose", t["summary"]["n_campaigns"], 2)
    egal("rien ne manque, donc rien à annoncer",
         t["summary"]["n_campaigns"] - len(t["campaigns"]), 0)
    egal("et chaque régie est comptée une fois",
         t["summary"]["n_campaigns_canal"], {"meta": 1, "google": 1})


def test_une_regie_absente_n_est_pas_comptee_a_zero():
    """Une régie où le thème ne tourne pas n'a pas de clé — un `0` écrit là
    serait un chiffre vrai mais une porte à ouvrir pour rien, et le front
    n'aurait plus qu'un `> 0` pour les distinguer."""
    camps = [Campagne("Solo – Meta", theme="Solo", canal="meta",
                      depense_jour=10.0, clics_jour=40, impressions_jour=2000,
                      revenu_jour=30.0)]
    p = build_payload(compte(camps, etoiles=["Solo"], aujourd_hui=AUJOURD_HUI))
    par_canal = carte(p, "Solo")["summary"]["n_campaigns_canal"]
    egal("la régie présente est là", par_canal.get("meta"), 1)
    ok("la régie absente n'est nulle part", "google" not in par_canal,
       f"obtenu {par_canal!r}")


def test_un_theme_sans_campagne_rend_un_compte_vide_et_pas_une_absence():
    """`{}` se lit « aucune campagne », `None` se lirait « on ne sait pas ».

    Le cas se pose pour de vrai — un thème purement organique a une carte et
    zéro campagne — mais le faux lecteur ne grée PAS les publications Instagram
    (limite écrite dans le LISEZMOI du harnais 16). On mesure donc la fonction
    qui décide, et pas le payload : une campagne à 0 CHF reste une campagne, ce
    n'est pas ce cas-là.
    """
    egal("aucune campagne rend un détail vide", _compte_par_canal([]), {})
    egal("et une campagne sans canal ne fabrique pas de régie",
         _compte_par_canal([{"name": "Sans canal"}]), {})


if __name__ == "__main__":
    import sys
    for _nom, _f in sorted(list(globals().items())):
        if _nom.startswith("test_"):
            _f()
    sys.exit(0 if bilan("Le compte des campagnes d'un thème (34)") else 1)
