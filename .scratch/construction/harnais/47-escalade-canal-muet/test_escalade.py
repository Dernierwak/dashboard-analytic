"""Ticket 47 — un canal muet deux semaines de suite n'est plus une note.

CE QUE CE HARNAIS PROUVE. Qu'un rapport sait DEPUIS COMBIEN DE RAPPORTS
PUBLIÉS un canal est muet, et que ce compte se fait sur la seule preuve qu'on
ait — les payloads déjà publiés — jamais sur une déduction de calendrier.

POURQUOI ÇA NE SE COMPTE PAS DANS `fetch_progress`. Cette table n'a aucun
historique : une ligne par (utilisateur, canal), réécrite à chaque passage.
Elle ne sait que le dernier. Compter des semaines dedans reviendrait à les
inventer (`CLAUDE.md` §7). `weekly_reports`, lui, garde une ligne par semaine
avec son `canaux_muets` — et le seam du ticket 16 le sert déjà
(`lecteur.rapports_publies`), donc l'escalade ne coûte aucune lecture nouvelle.

Ni base, ni secret, ni réseau.
"""
from datetime import date, timedelta

import pulse  # noqa: F401
from t import ok, egal, bilan

from lecteur_fige import Campagne
from gree import compte_muet, compte_sain
from saas.traitement.build_report import build_payload, semaines_muettes
from saas.emailing.render import email_from_payload
import saas.collecte.automatisation.fetch_all as fetch_all

AUJOURD_HUI = date(2026, 9, 13)
# Le `week_start` que `build_payload` publie sur ce compte — vérifié par
# `test_la_semaine_declaree_ne_bouge_pas…` du harnais 20, et c'est lui qui
# ancre les semaines de l'historique ci-dessous.
SEMAINE = date(2026, 9, 7)

MOT_META = ("meta KO: (#190) Error validating access token: Session has "
            "expired on Saturday, 05-Sep-26 11:00:00 PDT")
MOT_GOOGLE = "google KO: AuthenticationError.NOT_ADS_USER"


def deux_regies():
    """Un thème qui dépense sur les deux régies et rapporte via GA4."""
    return [
        Campagne("Été – Meta", theme="Été", canal="meta",
                 depense_jour=40.0, clics_jour=80, impressions_jour=4000,
                 revenu_jour=60.0),
        Campagne("Été – Google", theme="Été", canal="google",
                 depense_jour=20.0, clics_jour=40, impressions_jour=2000,
                 revenu_jour=40.0),
    ]


def publie(semaines_avant: int, canaux, *, avant_le_ticket_20=False) -> dict:
    """Un rapport DÉJÀ PUBLIÉ, `semaines_avant` semaines avant celui qu'on fabrique.

    `avant_le_ticket_20` rend un payload SANS la clé `canaux_muets` — la forme
    qu'ont tous les rapports publiés avant que le trou ne soit publié. Il ne dit
    pas « aucun trou », il dit « je ne sais pas répondre ».
    """
    charge = {} if avant_le_ticket_20 else {
        "canaux_muets": [
            {"canal": c, "nom": c, "mot": "…", "depuis": None,
             "chiffres_tus": True}
            for c in canaux
        ]
    }
    return {"week_start": (SEMAINE - timedelta(days=7 * semaines_avant)).isoformat(),
            "payload": charge}


def muet(muets: dict, historique=(), **reste):
    """Le compte des deux régies, `muets` silencieux, avec son historique publié."""
    return build_payload(compte_muet(
        deux_regies(), muets=muets, aujourd_hui=AUJOURD_HUI, etoiles=["Été"],
        rapports_publies=list(historique), **reste))


def semaines(payload: dict, canal: str):
    """Le compteur porté par le payload pour ce canal, `None` s'il est absent."""
    for m in payload.get("canaux_muets") or []:
        if m.get("canal") == canal:
            return m.get("semaines_muettes")
    return None


# ── 1 · LE COMPTEUR SE FAIT SUR LES RAPPORTS PUBLIÉS, PAS SUR LE CALENDRIER ──

def test_une_premiere_semaine_muette_compte_une_semaine():
    """Le rapport qu'on fabrique compte pour un. Sans historique, c'est tout ce
    qu'on sait — et c'est le cas où l'escalade NE DOIT PAS sonner : une panne
    d'une semaine se rattrape toute seule au prochain passage réussi (ADR 0005)."""
    egal("meta en est à sa première semaine",
         semaines(muet({"meta": MOT_META}), "meta"), 1)


def test_deux_semaines_muettes_consecutives_comptent_deux():
    """Le seuil du ticket. Le rapport de la semaine d'avant portait déjà meta
    dans `canaux_muets` : la série vaut deux, et c'est là que ça sort du cycle."""
    egal("meta en est à sa deuxième semaine",
         semaines(muet({"meta": MOT_META}, [publie(1, ["meta"])]), "meta"), 2)


def test_la_serie_se_poursuit_de_rapport_en_rapport():
    egal("quatre rapports d'affilée",
         semaines(muet({"meta": MOT_META},
                       [publie(1, ["meta"]), publie(2, ["meta"]),
                        publie(3, ["meta"])]), "meta"), 4)


def test_un_rapport_ou_le_canal_etait_revenu_casse_la_serie():
    """La remise à zéro, et sa seule preuve : un rapport publié où ce canal
    n'est PAS dans `canaux_muets`. Le canal était donc revenu ce jour-là."""
    egal("la panne d'il y a trois semaines ne compte plus",
         semaines(muet({"meta": MOT_META},
                       [publie(1, []), publie(2, ["meta"]),
                        publie(3, ["meta"])]), "meta"), 1)


def test_une_semaine_sans_rapport_publie_ne_casse_pas_la_serie():
    """Un trou dans le CALENDRIER n'est pas un canal revenu. Une semaine sans
    rapport a deux causes opposées — compte sans données, worker tombé — et
    aucune des deux ne dit que le canal a répondu. On saute, on ne remet pas à
    zéro : la série se compte sur les rapports publiés, pas sur les lundis."""
    egal("la semaine manquante est sautée, pas comptée comme une guérison",
         semaines(muet({"meta": MOT_META},
                       [publie(2, ["meta"]), publie(3, ["meta"])]), "meta"), 3)


def test_un_payload_d_avant_le_ticket_20_arrete_le_compte_au_lieu_de_l_inventer():
    """Un rapport sans la clé `canaux_muets` ne sait pas répondre. On s'arrête :
    la série est alors SOUS-ESTIMÉE, jamais inventée (`CLAUDE.md` §7)."""
    egal("on ne compte que ce qu'on a mesuré",
         semaines(muet({"meta": MOT_META},
                       [publie(1, ["meta"]),
                        publie(2, [], avant_le_ticket_20=True),
                        publie(3, ["meta"])]), "meta"), 2)


# ── 2 · PAR CANAL, TOUJOURS ──────────────────────────────────────────────────

def test_deux_canaux_tombes_a_deux_dates_ne_font_pas_une_serie_commune():
    """Agréger au compte lirait « meta tombé la semaine dernière, google tombé
    cette semaine » comme deux semaines consécutives — un fait qui n'a pas eu
    lieu. C'est un chiffre fabriqué par agrégation."""
    p = muet({"meta": MOT_META, "google": MOT_GOOGLE}, [publie(1, ["meta"])])
    egal("meta en est à deux", semaines(p, "meta"), 2)
    egal("google en est à une", semaines(p, "google"), 1)


def test_un_compte_sain_ne_porte_aucun_compteur():
    p = build_payload(compte_sain(deux_regies(), aujourd_hui=AUJOURD_HUI,
                                  etoiles=["Été"]))
    egal("la liste reste vide, pas un compteur à zéro",
         p.get("canaux_muets"), [])


# ── 3 · CE QUE L'ESCALADE NE CHANGE PAS ──────────────────────────────────────

def test_le_rapport_part_quand_meme_a_la_quatrieme_semaine():
    """L'ADR 0005 ne se re-litige pas : on publie, à n'importe quel N. Retenir
    ne supprime pas le silence, il le déplace — et le rapport reste le seul
    canal par lequel on peut demander une reconnexion."""
    p = muet({"meta": MOT_META},
             [publie(1, ["meta"]), publie(2, ["meta"]), publie(3, ["meta"])])
    ok("le rapport existe", isinstance(p, dict) and bool(p))
    egal("sous la semaine qu'il mesure", p.get("week_start"), SEMAINE.isoformat())


def test_un_canal_qui_ne_tait_aucun_chiffre_compte_quand_meme():
    """L'asymétrie voulue entre les deux destinataires. Un Google Ads mort
    depuis cinq semaines sur un compte organique ne cache rien AUJOURD'HUI et
    cassera tout le jour où ce client lancera sa première campagne : David doit
    le voir. Le client, lui, ne verra rien — `chiffres_tus` reste faux."""
    p = muet({"meta": MOT_META}, [publie(1, ["meta"])], jours_de_trou=0)
    egal("il ne tait aucun chiffre",
         (p["canaux_muets"][0]).get("chiffres_tus"), False)
    egal("et il compte quand même deux semaines", semaines(p, "meta"), 2)


# ── 4 · LE COMPTEUR NE DÉPEND PAS DE L'ORDRE DE LECTURE ──────────────────────

def test_l_historique_servi_dans_le_desordre_compte_pareil():
    """`rapports_publies` trie par `week_start` décroissant côté base. Le
    compteur ne s'y fie pas : servi à l'envers, il rendrait sinon la série d'un
    autre bout — et c'est le genre d'hypothèse qui tient jusqu'au jour où une
    lecture change d'ordre."""
    croissant = [publie(3, ["meta"]), publie(2, []), publie(1, ["meta"])]
    egal("le canal revenu il y a deux semaines casse bien la série",
         semaines_muettes("meta", croissant), 2)


def test_le_compteur_ne_se_stocke_pas_il_se_relit():
    """Deux constructions du même compte rendent le même compteur : il est
    recalculé depuis l'historique, jamais gardé quelque part qui dériverait."""
    historique = [publie(1, ["meta"]), publie(2, ["meta"])]
    egal("deux passages, même compte",
         semaines(muet({"meta": MOT_META}, historique), "meta"),
         semaines(muet({"meta": MOT_META}, historique), "meta"))


# ── 5 · CE QUE LE CLIENT REÇOIT — LA DURÉE, JAMAIS LE COMPTEUR ──────────────

def muets_payload(semaines: int, *, depuis="2026-08-22", chiffres_tus=True):
    """Le `canaux_muets` d'un payload publié, réduit à ce que l'email en lit."""
    return {"canaux_muets": [{"canal": "meta", "nom": "Meta Ads",
                              "mot": MOT_META, "depuis": depuis,
                              "chiffres_tus": chiffres_tus,
                              "semaines_muettes": semaines}],
            "week_label": "semaine du 7 septembre", "kpis": {}, "todo": []}


def test_l_email_de_la_premiere_semaine_garde_son_objet():
    """Le ticket 20 n'est pas re-litigé : à la première semaine, rien ne change."""
    sujet, _ = email_from_payload("Toi", muets_payload(1), "https://exemple")
    ok("l'objet nomme la reconnexion", "à reconnecter" in sujet, sujet)


def test_l_email_de_la_deuxieme_semaine_nomme_la_duree():
    """Le seul fait NOUVEAU qu'on ait à la deuxième semaine est la durée. Sans
    lui, c'est le même email qu'avant dans une autre enveloppe — et un email
    qui ne change pas s'apprend par cœur."""
    sujet, html = email_from_payload("Toi", muets_payload(2), "https://exemple")
    ok("l'objet dit depuis quand", "ne répond plus depuis le 22 août" in sujet,
       sujet)
    ok("et le corps aussi", "22 août" in html, "date absente du corps")


def test_l_objet_ne_fabrique_pas_de_date_quand_le_canal_n_a_jamais_ecrit():
    """`depuis` vaut `None` quand le canal n'a JAMAIS rien écrit. Il n'y a alors
    aucune date à donner, et on n'en invente pas (`CLAUDE.md` §7)."""
    sujet, _ = email_from_payload("Toi", muets_payload(3, depuis=None),
                                  "https://exemple")
    ok("l'objet dit la panne sans date", "ne répond plus" in sujet, sujet)
    ok("et ne fabrique aucun jour", "depuis le" not in sujet, sujet)


def test_le_client_ne_lit_jamais_le_compteur_de_semaines():
    """Le compteur est un SEUIL INTERNE. Ce que le client lit est la date, qui
    est mesurée ; « muet depuis 4 semaines » se compte sur les rapports publiés
    et vaudrait faux dès qu'une semaine n'a pas été publiée."""
    sujet, html = email_from_payload("Toi", muets_payload(4), "https://exemple")
    ok("pas de compteur dans l'objet", "4 semaines" not in sujet, sujet)
    ok("pas de compteur dans le corps", "4 semaines" not in html)


# ── 5 bis · DEUX CANAUX, DEUX ÂGES : AUCUN FAIT NE DÉBORDE SUR L'AUTRE ──────
#
# Le piège que ces trois tests tiennent est toujours le même : une phrase écrite
# pour UN canal, appliquée à la LISTE. `canaux_muets` est trié par clé de canal
# (« google » avant « meta »), donc le canal qui a déclenché l'escalade n'est
# presque jamais le premier de la liste.

def deux_ages():
    """Google tombé cette semaine, Meta mort depuis sept rapports."""
    return {"canaux_muets": [
        {"canal": "google", "nom": "Google Ads", "mot": MOT_GOOGLE,
         "depuis": "2026-09-05", "chiffres_tus": True, "semaines_muettes": 1},
        {"canal": "meta", "nom": "Meta Ads", "mot": MOT_META,
         "depuis": "2026-08-01", "chiffres_tus": True, "semaines_muettes": 7},
    ], "week_label": "semaine du 7 septembre", "kpis": {}, "todo": []}


def test_la_date_de_l_escalade_est_celle_du_canal_QUI_dure():
    """La panne de sept semaines ne doit pas être datée du jour où l'AUTRE canal
    est tombé. Ce serait une durée mesurée, affichée fausse, et raccourcie de six
    semaines — exactement ce que `CLAUDE.md` §7 interdit."""
    sujet, html = email_from_payload("Toi", deux_ages(), "https://exemple")
    ok("l'objet date la panne qui dure", "1 août" in sujet, sujet)
    ok("et jamais celle du canal tombé cette semaine",
       "5 septembre" not in sujet, sujet)
    ok("le corps date lui aussi la bonne panne", "1 août" in html)


def test_le_canal_tombe_cette_semaine_n_herite_pas_de_la_duree():
    """« Google Ads ne répond toujours pas, et ce n'est plus la première
    semaine » est faux : c'est sa première. Les deux canaux sont dits, chacun
    dans son registre."""
    _, html = email_from_payload("Toi", deux_ages(), "https://exemple")
    ok("Google est dit au présent de la semaine",
       "Google Ads n'a pas répondu cette semaine" in html, "registre mélangé")
    ok("Meta est dit dans la durée",
       "Meta Ads ne répond plus depuis le 1 août" in html, "registre mélangé")


def test_un_seul_canal_muet_garde_la_phrase_simple():
    """Le cas courant ne doit pas payer le prix du cas rare."""
    _, html = email_from_payload("Toi", muets_payload(3), "https://exemple")
    ok("une seule phrase, celle de la durée",
       "Meta Ads ne répond plus depuis le 22 août" in html)
    ok("et rien sur une autre semaine",
       "n'a pas répondu cette semaine" not in html)


# ── 6 · CE QUE LA RUN REMONTE À DAVID ────────────────────────────────────────

def escalade(canaux: list[dict]) -> list[tuple]:
    """Ce que `fetch_all` retiendrait de ces canaux muets, pour un compte."""
    fetch_all._CANAUX_QUI_DURENT.clear()
    fetch_all._note_canaux_qui_durent("compte-1", canaux)
    return list(fetch_all._CANAUX_QUI_DURENT)


def canal(nom: str, semaines: int, *, chiffres_tus=True) -> dict:
    return {"canal": nom, "nom": nom, "mot": "…", "depuis": "2026-08-22",
            "chiffres_tus": chiffres_tus, "semaines_muettes": semaines}


def test_une_seule_semaine_muette_ne_fait_pas_rougir_la_run():
    """Une panne d'UNE semaine se rattrape toute seule au prochain passage
    réussi (ADR 0005). Sonner à la première transférerait le papier peint du
    client à David — et un signal qui sonne pour rien finit ignoré."""
    egal("rien à remonter", escalade([canal("meta", 1)]), [])


def test_deux_semaines_muettes_font_rougir_la_run():
    egal("un canal remonté", len(escalade([canal("meta", 2)])), 1)


def test_david_voit_meme_les_canaux_qui_ne_taisent_aucun_chiffre():
    """L'asymétrie voulue entre les deux destinataires. Un Google Ads mort sur
    un compte 100 % organique ne cache rien au client aujourd'hui — il ne doit
    donc pas l'alarmer — et cassera tout le jour où il lancera sa première
    campagne. David doit le voir avant ce jour-là."""
    egal("remonté quand même",
         len(escalade([canal("google", 3, chiffres_tus=False)])), 1)


def test_la_run_ne_dit_pas_que_le_client_a_ete_prevenu_quand_il_ne_l_a_pas_ete():
    """Le piège de l'asymétrie, retourné contre nous. David voit TOUS les canaux
    muets ; le client, lui, ne voit que ceux qui lui taisent des chiffres. Dire
    « le client a déjà été prévenu » sur un canal à `chiffres_tus` faux serait
    donc faux — et David, croyant que le client sait, ne l'appellerait pas.
    C'est l'inverse exact de ce que cette escalade achète."""
    ok("le canal invisible au client est marqué comme tel",
       fetch_all.vu_par_le_client(canal("google", 3, chiffres_tus=False)) is False)
    ok("le canal que le client voit aussi",
       fetch_all.vu_par_le_client(canal("meta", 3)) is True)


def test_la_ligne_remontee_porte_de_quoi_agir():
    """Un run rouge qui oblige à ouvrir Supabase pour savoir qui appeler est un
    signal qu'on finit par ignorer."""
    (uid, c), = escalade([canal("meta", 2)])
    egal("le compte", uid, "compte-1")
    ok("le canal", bool(c.get("nom")), repr(c))
    ok("depuis combien de rapports", c.get("semaines_muettes") == 2, repr(c))
    ok("et jusqu'à quel jour on a lu", bool(c.get("depuis")), repr(c))


if __name__ == "__main__":
    import sys
    for nom, fn in sorted(list(globals().items())):
        if nom.startswith("test_") and callable(fn):
            fn()
    sys.exit(0 if bilan("Ticket 47 — l'escalade du canal muet") else 1)
