"""Une théorie par thème à la fois, et son compteur ne repart pas tout seul.

Les deux défauts du ticket 27, et un troisième trouvé en MESURANT au lieu de
lire le code (`mesure.py` et `mesure2.py`, à côté) :

  1. La carte d'un thème portait DEUX Hypothèses — `adset_inegal` et
     `page_endormie` sortaient ensemble, `theme_plan` n'en suivait qu'une, et
     rien ne disait laquelle.
  2. Quand l'épinglage lâchait (ligne sans `snapshot`, verdict tombé), la clé
     servie n'était plus celle du plan : la garde d'attente, qui ne compare que
     des CLÉS, ne s'appliquait pas, et `theme_plan` repartait sur un
     `decided_at` neuf.
  3. Et quand le plan tombait sur la SECONDE Hypothèse de la carte, l'épinglage
     remplaçait la première : le thème affichait la même théorie DEUX FOIS, en
     deux formulations.

Ce que ce fichier NE prouve pas : rien n'est joué en base, et le compte gréé
ici n'est pas celui de David — il prouve un comportement, jamais un chiffre de
production (même limite que le harnais 16, dont il reprend le faux lecteur).
"""
from datetime import date, timedelta

import pulse  # noqa: F401
from t import ok, egal, bilan

from gree import compte_organique
from lecteur_fige import Annonce, Campagne
from saas.traitement.build_report import build_payload

THEME = "Piscine"
PREMIER_JOUR = date(2026, 9, 13)


def campagne():
    """Une campagne dont les deux Groupes d'annonces ne paient pas le même prix
    du clic — de quoi faire parler `adset_inegal`, la seule Hypothèse payante
    que ces lignes déclenchent."""
    return Campagne(f"{THEME} – Search", theme=THEME, depense_jour=30.0,
                    clics_jour=100, impressions_jour=4000, revenu_jour=40.0,
                    annonces=[Annonce("visuel A", "Groupe 1", 140, 350, 14000, 7),
                              Annonce("visuel B", "Groupe 2", 70, 20, 7000, 0)])


def campagne_display():
    """Une seconde campagne du même thème, dont une bannière ne convertit pas
    pendant que sa voisine convertit — de quoi faire parler une règle de PLUS
    que les trois places du thème n'en tiennent. Sans ce quatrième candidat, on
    ne pourrait pas voir si la place libérée par la théorie écartée revient à
    un conseil ou disparaît."""
    return Campagne(f"{THEME} – Display", theme=THEME, depense_jour=20.0,
                    clics_jour=60, impressions_jour=9000, revenu_jour=5.0,
                    annonces=[Annonce("bannière C", "Groupe 3", 120, 300, 20000, 0),
                              Annonce("bannière D", "Groupe 3", 60, 150, 10000, 6)])


def rapport(jour, plan=None, verdicts=None, campagnes=None):
    """Une construction complète, hors ligne. Rend le lecteur (pour lire ce
    qu'on a voulu écrire) et la carte du thème."""
    lecteur = compte_organique(campagnes or [campagne()], etoiles=[THEME],
                               aujourd_hui=jour,
                               theme_organique=THEME, plan=plan,
                               verdicts=verdicts)
    payload = build_payload(lecteur)
    return lecteur, next(t for t in payload["themes_focus"]
                         if t["label"] == THEME)


def hypotheses(tf):
    return [r["key"] for r in tf["recos"] if r.get("role") == "hypothese"]


def plans_ecrits(lecteur):
    return [e for e in lecteur.ecrits if e[0] == "plan_de_theme"]


def ligne_de_plan(cle, decided, *, levier="contenu", snapshot=True):
    """Ce que `fetch_theme_plan` rendrait pour une Stratégie déjà ouverte.

    LE LEVIER SE PASSE, IL NE SE DEVINE PAS : c'est lui qui choisit la fenêtre
    d'attente (`ATTENTE_MIN_NOUVELLE_HYPOTHESE` — 14 jours en « contenu », 21 en
    « audience »). Une ligne gréée avec le mauvais levier ferait expirer la
    Stratégie plus tôt que la vraie, et le test mesurerait cette erreur-là.

    `snapshot=False` grée la ligne d'AVANT la colonne : elle existe en base et
    ne peut pas être réaffichée, ce qui est précisément le cas où l'épinglage
    lâchait."""
    carte = {"key": cle, "role": "hypothese", "levier": levier,
             "title": "épinglée", "nature": "tester",
             "platform": "instagram", "cible": "", "confidence": "creuser",
             "priority": 3, "metric": "reach", "effort": "1 h"}
    return {"piscine": {"theme": THEME, "reco_key": cle, "levier": levier,
                        "decided_at": decided, "resume": None,
                        "snapshot": carte if snapshot else None}}


# ── LE PREMIER DÉFAUT · DEUX THÉORIES SUR LE MÊME THÈME ──────────────────────

def test_trois_theories_se_disputent_bien_le_meme_theme():
    """Le gréement d'abord : sans la concurrence, tout ce qui suit ne prouverait
    rien. On vérifie donc que la situation EXISTE — trois règles de trois
    familles différentes ouvrent une Stratégie sur le même thème la même
    semaine — avant de vérifier qu'elle est arbitrée."""
    import pandas as pd
    from saas.recos_ia.reco_engine import _rule_page_endormie
    from saas.recos_ia.regles_payantes import regles_payantes
    from saas.traitement.build_report import _GESTE_REGLE, _orga_recos
    from gree import ABONNES, publications_essoufflees

    dernier_jour = PREMIER_JOUR - timedelta(days=1)
    posts = pd.DataFrame(publications_essoufflees(THEME, dernier_jour=dernier_jour))
    for colonne in ("reach", "likes", "comments", "saved"):
        posts[colonne] = pd.to_numeric(posts[colonne])

    cles = [r["key"] for r in _orga_recos(THEME, posts, posts, dernier_jour)]
    cles += [(_rule_page_endormie(posts, ABONNES) or {}).get("key")]
    cles += [r["key"] for r in regles_payantes(
        THEME,
        [{"canal": "google", "campagne": f"{THEME} – Search",
          "groupe": "Groupe 1", "nom": "visuel A", "depense": 140.0,
          "clics": 350, "impressions": 14000, "conversions": 7.0},
         {"canal": "google", "campagne": f"{THEME} – Search",
          "groupe": "Groupe 2", "nom": "visuel B", "depense": 70.0,
          "clics": 20, "impressions": 7000, "conversions": 0.0}],
        None, {})]

    # Le rôle n'est pas encore posé à ce stade (il l'est par `_attach_grammaire`,
    # depuis `_GESTE_REGLE`) : on le lit donc à la source, comme le rapport.
    ouvrantes = [c for c in cles
                 if _GESTE_REGLE.get(c, (None, None))[1] == "hypothese"]
    egal("trois Stratégies candidates sur ce seul thème",
         sorted(ouvrantes),
         ["adset_inegal", "orga_essoufflement", "page_endormie"])


def test_une_carte_ne_porte_jamais_deux_hypotheses():
    """Le défaut nommé par le ticket : deux théories concurrentes sur le même
    thème, une seule suivie, et la carte ne dit pas laquelle."""
    _, tf = rapport(PREMIER_JOUR)
    egal("une seule Hypothèse sur la carte", len(hypotheses(tf)), 1)


def test_la_place_liberee_revient_a_un_conseil():
    """L'arbitrage se fait AVANT la coupe à trois, pas après : retirer la
    seconde théorie ne doit pas amputer la carte d'un conseil.

    Quatre candidats pour trois places, dont deux Hypothèses. Après arbitrage,
    la carte doit encore porter trois conseils — donc la place de la théorie
    écartée est revenue à un vrai conseil, pas au vide."""
    _, tf = rapport(PREMIER_JOUR, campagnes=[campagne(), campagne_display()])
    egal("la carte reste pleine", len(tf["recos"]), 3)
    egal("avec une seule Hypothèse dedans", len(hypotheses(tf)), 1)


def test_la_strategie_epinglee_n_est_pas_affichee_deux_fois():
    """Le troisième défaut, trouvé en mesurant : le plan porte la SECONDE
    Hypothèse de la carte, l'épinglage remplace la PREMIÈRE, et la même théorie
    sort deux fois."""
    _, tf = rapport(PREMIER_JOUR, plan=ligne_de_plan("page_endormie", "2026-09-06"))
    cles = [r["key"] for r in tf["recos"]]
    egal("aucune clé en double", len(cles), len(set(cles)))
    egal("et toujours une seule Hypothèse", len(hypotheses(tf)), 1)


# ── LE SECOND DÉFAUT · LE COMPTEUR QUI REPART CHAQUE SEMAINE ─────────────────

def test_une_strategie_epinglee_ne_reecrit_jamais_son_plan():
    """Trois semaines d'affilée sur les mêmes lignes : la Stratégie ouverte la
    première semaine garde SA date de décision."""
    plan = None
    dates = []
    for n in range(3):
        lecteur, _ = rapport(PREMIER_JOUR + timedelta(days=7 * n), plan=plan)
        for _, theme, cle, levier, decided in plans_ecrits(lecteur):
            dates.append(decided)
            plan = ligne_de_plan(cle, decided, levier=levier)
    egal("une seule écriture en trois semaines", len(dates), 1)
    egal("et c'est celle de la première", dates, [PREMIER_JOUR.isoformat()])


def test_le_plan_tient_meme_quand_la_regle_de_la_semaine_change_de_cle():
    """Le cœur du ticket : la garde ne compare plus des CLÉS. Le plan suit
    `page_endormie` ; la règle la mieux classée cette semaine est
    `adset_inegal`. Rien ne doit repartir."""
    lecteur, tf = rapport(PREMIER_JOUR,
                          plan=ligne_de_plan("page_endormie", "2026-09-06"))
    egal("rien n'est réécrit", plans_ecrits(lecteur), [])
    egal("et c'est bien la théorie du plan qui est servie",
         hypotheses(tf), ["page_endormie"])


def test_une_ligne_sans_snapshot_ne_repart_pas_toutes_les_semaines():
    """Une Stratégie qu'on ne peut pas réafficher (ligne d'avant la colonne
    `snapshot`) doit se refermer UNE fois, pas chaque semaine : la semaine
    d'après, le plan porte une carte et s'épingle normalement."""
    lecteur, _ = rapport(PREMIER_JOUR,
                         plan=ligne_de_plan("page_endormie", "2026-09-06",
                                            snapshot=False))
    ecrits = plans_ecrits(lecteur)
    egal("elle est remplacée une fois", len(ecrits), 1)

    _, _, cle, levier, decided = ecrits[0]
    encore, _ = rapport(PREMIER_JOUR + timedelta(days=7),
                        plan=ligne_de_plan(cle, decided, levier=levier))
    egal("et plus rien la semaine suivante", plans_ecrits(encore), [])


# ── CE QUE LA CORRECTION NE DOIT PAS EMPORTER ────────────────────────────────

def test_un_verdict_tombe_rouvre_bien_une_nouvelle_theorie():
    """La décision du wayfinder ticket 06 reste intacte :
    `ATTENTE_MIN_NOUVELLE_HYPOTHESE` ne borne QUE le cas où aucun verdict n'est
    encore arrivé. Une théorie dont le Verdict est rendu laisse la place."""
    lecteur, _ = rapport(PREMIER_JOUR,
                         plan=ligne_de_plan("page_endormie", "2026-09-06"),
                         verdicts={"page_endormie": "stable"})
    egal("une nouvelle Stratégie s'ouvre", len(plans_ecrits(lecteur)), 1)
    egal("datée d'aujourd'hui", plans_ecrits(lecteur)[0][4],
         PREMIER_JOUR.isoformat())


def test_une_cle_ai_ne_se_reaffiche_toujours_pas():
    """Une piste rédigée par Gemini avant la coupe du ticket 11 reste en base
    et ne revient pas dans un rapport : elle est remplacée, pas épinglée."""
    lecteur, tf = rapport(PREMIER_JOUR,
                          plan=ligne_de_plan("ai_vieille_piste", "2026-09-06"))
    egal("une règle reprend le thème", len(plans_ecrits(lecteur)), 1)
    ok("et la piste `ai_` n'est nulle part sur la carte",
       all(not r["key"].startswith("ai_") for r in tf["recos"]))


def test_la_strategie_ouverte_reste_la_marche_servie():
    """Ce que l'épinglage existe pour faire, et qui ne doit pas être perdu :
    tant que le Verdict n'est pas tombé, c'est la carte du plan qu'on relit."""
    _, tf = rapport(PREMIER_JOUR,
                    plan=ligne_de_plan("page_endormie", "2026-09-06"))
    marche = next(r for r in tf["recos"] if r.get("role") == "hypothese")
    egal("la carte épinglée est servie telle quelle", marche["title"], "épinglée")


if __name__ == "__main__":
    for nom, fn in sorted(list(globals().items())):
        if nom.startswith("test_") and callable(fn):
            fn()
    raise SystemExit(0 if bilan("Une théorie par thème") else 1)
