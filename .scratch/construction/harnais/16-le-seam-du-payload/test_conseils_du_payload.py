"""`build_payload` TOURNE, et ce qu'elle rend porte la phrase du produit.

C'est la première fois du dépôt : jusqu'ici, le filtre dur et le plafond de cinq
étaient vérifiés sur le TEXTE de `build_report.py` (harnais 08), et chaque
harnais écrivait la même limite — *« un test de structure prouve qu'un appel est
sous un garde, jamais que le garde est vrai au bon moment »*. Ici la fonction est
exécutée sur des lignes fixes, et on lit ce qui en sort.

CE QUI EST « SERVI », ET CE QUI NE L'EST PAS. Un conseil servi au client vit dans
`themes_focus[].recos` (la carte de son thème) ou dans `reglages` (le socle). Le
champ `payload.recos` porte, lui, le vieux chemin compte-entier déterministe :
la spec dit qu'il **reste en place et n'est volontairement pas rebranché**, et
`saas/web/lib/report.ts` ne le lit que pour retrouver le détail d'une action
DÉJÀ prise — jamais pour proposer quoi que ce soit. Les tests d'ici portent donc
sur ce qui est servi, et vérifient au passage qu'aucune ligne de `payload.recos`
ne porte de thème.
"""
from datetime import date

import pulse  # noqa: F401
from t import ok, egal, bilan

from lecteur_fige import compte, Campagne, Annonce
from saas.recos_ia.composition import MAX_LOURDS, PLAFOND_SEMAINE
from saas.traitement.build_report import build_payload

AUJOURD_HUI = date(2026, 9, 13)


def campagne(theme, *, revenu=40.0, avec_annonces=True):
    """Une campagne Google qui dépense assez pour être jugée, et deux Annonces
    d'un même Groupe dont une seule convertit — de quoi faire parler une règle."""
    annonces = [Annonce(f"{theme} · visuel A", "Groupe 1", 140, 350, 14000, 7),
                Annonce(f"{theme} · visuel B", "Groupe 1", 70, 175, 7000, 0)]
    return Campagne(f"{theme} – Search", theme=theme, depense_jour=30.0,
                    clics_jour=100, impressions_jour=4000, revenu_jour=revenu,
                    annonces=annonces if avec_annonces else [])


def servis(payload):
    """Tous les conseils réellement servis, tous thèmes confondus."""
    return ([r for t in payload["themes_focus"] for r in t["recos"]]
            + list(payload["reglages"]))


def par_theme(payload):
    return {t["label"]: [r["key"] for r in t["recos"]] for t in payload["themes_focus"]}


# ── 1 · AUCUN CONSEIL NE PORTE UN THÈME NON ÉTOILÉ (ADR 0003) ────────────────
#
# C'est le test le plus important de la v1 : la phrase du produit, rendue
# vérifiable. Deux populations de thèmes non conseillés, et elles ne sortent pas
# par la même porte — il faut les deux.

def test_un_theme_classe_mais_non_etoile_n_a_aucune_carte():
    """Première porte : `theme_list` vaut `priority_labels` dès qu'une étoile
    existe. Un thème classé sans étoile ne traverse même pas la boucle."""
    lecteur = compte([campagne("Été"), campagne("Hiver")],
                     etoiles=["Été"], aujourd_hui=AUJOURD_HUI)
    p = build_payload(lecteur)
    egal("seul le thème étoilé a une carte", sorted(par_theme(p)), ["Été"])
    ok("et il a bien reçu des conseils", len(par_theme(p)["Été"]) > 0)


def test_au_dela_de_la_troisieme_etoile_la_carte_existe_sans_un_conseil():
    """Seconde porte, et c'est elle que le ticket 08 a écrite : cinq étoiles,
    trois thèmes conseillés. Les deux derniers gardent carte, chiffres et
    courbe — et pas un conseil."""
    noms = ["Été", "Hiver", "Printemps", "Automne", "Soldes"]
    p = build_payload(compte([campagne(n) for n in noms],
                             etoiles=noms, aujourd_hui=AUJOURD_HUI))
    cartes = {t["label"]: t for t in p["themes_focus"]}
    egal("les cinq étoiles ont leur carte", sorted(cartes), sorted(noms))
    for nom in noms:
        egal(f"« {nom} » est bien marqué prioritaire", cartes[nom]["is_priority"], True)
    conseilles = [n for n in noms if cartes[n]["conseille"]]
    egal("trois thèmes conseillés, pas cinq", conseilles, noms[:3])
    for nom in noms[3:]:
        egal(f"« {nom} » : le payload DIT qu'il n'est pas conseillé",
             cartes[nom]["conseille"], False)
        egal(f"« {nom} » : et il ne porte aucun conseil", cartes[nom]["recos"], [])


def test_aucun_conseil_servi_ne_nomme_un_theme_non_etoile():
    """La propriété, dite dans l'autre sens : on balaie TOUT ce qui est servi et
    on vérifie qu'aucune ligne ne désigne un thème hors des trois premières
    étoiles — ni par sa carte, ni par sa cible, ni par son texte."""
    noms = ["Été", "Hiver", "Printemps", "Automne", "Soldes"]
    p = build_payload(compte([campagne(n) for n in noms] + [campagne("Fourre-tout")],
                             etoiles=noms, aujourd_hui=AUJOURD_HUI))
    hors = set(noms[3:]) | {"Fourre-tout"}
    for theme in p["themes_focus"]:
        for reco in theme["recos"]:
            ok(f"« {theme['label']} » : sa carte est dans les trois premières",
               theme["label"] in noms[:3], theme["label"])
            for absent in hors:
                textes = " ".join(str(reco.get(c) or "")
                                  for c in ("title", "observation", "cible"))
                ok(f"« {reco['key']} » ne nomme pas « {absent} »", absent not in textes)


def test_le_chemin_compte_entier_ne_porte_aucun_theme():
    """`payload.recos` survit exprès (spec : « pas rebranché, ne pas le
    réparer »). Il ne doit pas être une porte dérobée : ses lignes n'ont pas de
    thème du tout, donc aucune ne peut en porter un non étoilé."""
    p = build_payload(compte([campagne("Été"), campagne("Hiver")],
                             etoiles=["Été"], aujourd_hui=AUJOURD_HUI))
    ok("le champ existe toujours", isinstance(p["recos"], list))
    for reco in p["recos"]:
        egal(f"« {reco['key']} » ne porte aucun thème", reco.get("theme"), None)
        egal(f"« {reco['key']} » ne porte aucune cible", reco.get("cible"), None)


# ── 2 · LE PLAFOND DE CINQ, QUI N'EST PAS UN QUOTA ───────────────────────────

def test_cinq_conseils_au_maximum_sur_tout_le_compte():
    noms = ["Été", "Hiver", "Printemps", "Automne", "Soldes"]
    p = build_payload(compte([campagne(n) for n in noms],
                             etoiles=noms, aujourd_hui=AUJOURD_HUI))
    total = sum(len(r) for r in par_theme(p).values())
    ok(f"au plus cinq ({total} servis)", total <= PLAFOND_SEMAINE, total)
    ok("et la liste n'est pas vide sur un compte qui a de la matière", total > 0)


def test_une_semaine_calme_rend_moins_de_cinq_et_ne_complete_pas():
    """Un seul thème, aucune Annonce à comparer : il n'y a qu'une chose à dire.
    Rien ne doit venir la compléter — ni un conseil d'un thème non prioritaire,
    ni un remplissage."""
    p = build_payload(compte([campagne("Été", avec_annonces=False),
                              campagne("Hiver", avec_annonces=False)],
                             etoiles=["Été"], aujourd_hui=AUJOURD_HUI))
    conseils = par_theme(p)["Été"]
    ok(f"moins de cinq ({len(conseils)})", len(conseils) < PLAFOND_SEMAINE, conseils)
    egal("aucune carte n'est venue en renfort", sorted(par_theme(p)), ["Été"])


def test_jamais_plus_de_deux_gestes_lourds():
    noms = ["Été", "Hiver", "Printemps"]
    p = build_payload(compte([campagne(n) for n in noms],
                             etoiles=noms, aujourd_hui=AUJOURD_HUI))
    lourds = [r for r in servis(p)
              if r.get("nature") in ("creer", "créer", "corriger")
              and r.get("effort") in ("1 h", "2 h+")]
    ok(f"au plus deux gestes lourds ({len(lourds)})", len(lourds) <= MAX_LOURDS,
       [r["key"] for r in lourds])


# ── 3 · ZÉRO ÉTOILE ──────────────────────────────────────────────────────────

def test_sans_aucune_etoile_le_point_de_vue_reste_et_les_conseils_disparaissent():
    """Le compte qui n'a rien étoilé garde ce qui se constate — le bilan de la
    semaine, la vision, les cartes de ses plus gros thèmes — et ne reçoit AUCUN
    conseil. Pas un module absent : une carte qui dit qu'elle n'en a pas."""
    p = build_payload(compte([campagne("Été"), campagne("Hiver")],
                             etoiles=[], aujourd_hui=AUJOURD_HUI))
    egal("aucun conseil servi", [r["key"] for r in servis(p)], [])
    ok("mais les cartes sont là", len(p["themes_focus"]) == 2)
    for theme in p["themes_focus"]:
        egal(f"« {theme['label']} » n'est pas prioritaire", theme["is_priority"], False)
        egal(f"« {theme['label']} » dit qu'il n'est pas conseillé",
             theme["conseille"], False)
    ok("le point de vue de la semaine existe quand même",
       bool(p["kpis"]) and p["week_label"])
    ok("et ses constats aussi", bool((p["vision"] or {}).get("constats")))


# ── 4 · L'IA NE DÉCIDE DE RIEN, ET SA PANNE NE CASSE RIEN ────────────────────

def test_une_ia_muette_ne_casse_pas_le_payload():
    """`redige` rend `None`, comme Gemini sans clé — c'est le cas par défaut du
    faux lecteur, et c'est celui du worker quand la clé manque.

    Le résumé n'est pas vide pour autant : un repli DÉTERMINISTE prend la place,
    comme partout ailleurs dans le produit. Ce qui compte est qu'il soit le même
    à chaque construction sur les mêmes lignes — un repli qui varierait serait
    une phrase inventée."""
    p = build_payload(compte([campagne("Été")], etoiles=["Été"],
                             aujourd_hui=AUJOURD_HUI))
    encore = build_payload(compte([campagne("Été")], etoiles=["Été"],
                                  aujourd_hui=AUJOURD_HUI))
    ok("le payload existe", isinstance(p, dict))
    ok("un résumé est quand même écrit", bool(p["brief"]))
    egal("et il est déterministe", p["brief"], encore["brief"])
    ok("les conseils sont là quand même", len(par_theme(p)["Été"]) > 0)


def test_l_ia_ne_change_pas_la_liste_des_conseils():
    """Le moteur trie, l'IA explique. Deux constructions sur les mêmes lignes,
    l'une muette, l'autre bavarde, doivent servir exactement les mêmes clés."""
    muet = compte([campagne("Été")], etoiles=["Été"], aujourd_hui=AUJOURD_HUI)
    bavard = compte([campagne("Été")], etoiles=["Été"], aujourd_hui=AUJOURD_HUI,
                    redige=lambda prompt: "Une semaine correcte, rien à signaler.")
    a, b = build_payload(muet), build_payload(bavard)
    egal("les mêmes clés, dans le même ordre", par_theme(a), par_theme(b))
    egal("seul le résumé change", b["brief"], "Une semaine correcte, rien à signaler.")
    ok("et il n'est pas celui du repli", a["brief"] != b["brief"])


# ── 5 · L'EMPREINTE : LA MÊME INSTRUCTION NE REVIENT PAS ─────────────────────

def test_un_conseil_deja_servi_ne_revient_pas_la_semaine_suivante():
    """On publie le rapport de la semaine, on le remet dans l'historique, on
    reconstruit : les instructions déjà données ont disparu.

    LA MOITIÉ MANQUANTE EST CONNUE ET TICKETÉE. La spec veut aussi qu'un conseil
    « avec un chiffre différent réapparaisse ». Il ne peut pas aujourd'hui :
    l'empreinte est `(clé, cible)` et AUCUNE des règles servies ici ne pose de
    `cible` — c'est le ticket 31, ouvert avant celui-ci. Ce harnais ne prétend
    donc pas vérifier cette moitié-là ; il vérifie celle qui tient.
    """
    def fixture(**kw):
        return compte([campagne("Été")], etoiles=["Été"],
                      aujourd_hui=AUJOURD_HUI, **kw)

    premier = build_payload(fixture())
    deja = par_theme(premier)["Été"]
    ok("la première semaine dit quelque chose", len(deja) > 0)

    second = build_payload(fixture(
        rapports_publies=[{"week_start": "2026-08-31", "payload": premier}]))
    revenus = [c for c in par_theme(second)["Été"] if c in deja]
    egal("aucune instruction ne revient à l'identique", revenus, [])


# ── 6 · CE QUE LA CONSTRUCTION A VOULU ÉCRIRE ────────────────────────────────

def test_aucune_ecriture_n_est_tentee_sur_un_compte_sans_strategie():
    """Les quatre règles payantes sont toutes « constatable » : aucune n'ouvre
    de Stratégie, donc aucun plan de thème n'est écrit. C'est ce que le
    ticket 06 a bâti, et le faux lecteur le rend visible au lieu de le
    supposer — il ENREGISTRE les écritures au lieu de les empêcher."""
    lecteur = compte([campagne("Été")], etoiles=["Été"], aujourd_hui=AUJOURD_HUI)
    build_payload(lecteur)
    egal("rien n'est parti en base", lecteur.ecrits, [])


if __name__ == "__main__":
    for nom, fn in sorted(list(globals().items())):
        if nom.startswith("test_"):
            fn()
    raise SystemExit(0 if bilan("Les conseils du payload") else 1)
