"""LA LISTE DES CAMPAGNES META NE S'ARRÊTE PLUS À LA PREMIÈRE PAGE — ticket 21.

`_fetch_meta` demandait les campagnes avec `limit: 200` et lisait `data` tel
quel : `paging.next` était ignoré. Au-delà de 200 campagnes, `status_map` était
amputé SANS UN MOT, et la 201e campagne recevait le même `UNKNOWN` qu'une
campagne dont Meta ignore vraiment le statut. C'est le piège de `CLAUDE.md` §8
sur PostgREST — « au-delà, il tronque en silence » — sur une autre API.

LA PROPRIÉTÉ, EN UNE PHRASE : ce qui manque se dit. Ou bien la liste est
entière, ou bien le journal nomme combien de campagnes ont été vues et
pourquoi il n'y en a pas plus.

    python3.12 test_campagnes_paginees.py
"""
import io
import contextlib
from datetime import date, timedelta

import pulse  # noqa: F401
from t import ok, egal, bilan

from faux_graph import FauxGraph, campagne, lot
from saas.collecte.automatisation import fetch_all


AUJOURD_HUI = date.today()

# `_recolte` neutralise `_meta_chunk` pour isoler le chemin des statuts.
# On garde le vrai sous la main : un test le fait tourner pour de bon.
_VRAI_META_CHUNK = fetch_all._meta_chunk


# ── 1 · LE CŒUR : LA 201e CAMPAGNE EXISTE ────────────────────────────────────

def test_les_campagnes_de_la_deuxieme_page_remontent():
    """440 campagnes, 200 par page : sans pagination il en manquait 240."""
    graph = FauxGraph(lot(440))
    fetch_all.requests = graph
    campagnes, err = fetch_all._meta_campagnes("JETON", "act_42")
    egal("les 440 campagnes remontent", len(campagnes), 440)
    egal("la liste se dit entière", err, None)
    ok("la dernière page a bien été demandée",
       any("after=3" in u for u in graph.appels), f"appels = {graph.appels}")


def test_un_compte_qui_tient_sur_une_page_ne_demande_rien_de_plus():
    """Le cas ordinaire ne doit pas payer la pagination d'une seconde requête."""
    graph = FauxGraph(lot(12))
    fetch_all.requests = graph
    campagnes, err = fetch_all._meta_campagnes("JETON", "act_42")
    egal("les 12 campagnes remontent", len(campagnes), 12)
    egal("aucune erreur", err, None)
    egal("une seule requête", len(graph.appels), 1)


# ── 2 · CE QUI MANQUE SE DIT ─────────────────────────────────────────────────

def test_une_pagination_interrompue_rend_ce_qu_elle_a_ET_le_dit():
    """Le cas le plus traître : la liste n'est pas vide, elle est TRONQUÉE.

    Rendre les 200 premières sans un mot, c'est exactement le défaut d'origine
    — avec une excuse en plus.
    """
    graph = FauxGraph(lot(440), erreur_a_la_page=2)
    fetch_all.requests = graph
    campagnes, err = fetch_all._meta_campagnes("JETON", "act_42")
    egal("la première page est gardée", len(campagnes), 200)
    ok("et l'erreur est rendue", err is not None, f"err = {err!r}")
    ok("elle dit que la liste est tronquée",
       err and "tronqu" in err.lower(), f"err = {err!r}")


def test_une_erreur_meta_ne_rend_aucune_campagne_et_aucun_jeton():
    """Meta répond 200 avec un objet `error`. Le message porte la cause ; il ne
    doit jamais porter le jeton (`CLAUDE.md` §7)."""
    graph = FauxGraph(lot(10), erreur_meta="Session has expired")
    fetch_all.requests = graph
    campagnes, err = fetch_all._meta_campagnes("JETON", "act_42")
    egal("rien ne remonte", campagnes, [])
    ok("la cause est nommée", err and "Session has expired" in err, f"err = {err!r}")
    ok("le jeton ne fuite pas", err and "JETON" not in err, f"err = {err!r}")


def test_une_premiere_requete_qui_casse_ne_leve_pas():
    """Un statut manquant ne doit pas coûter la semaine d'insights : la liste
    des campagnes échoue sur le côté, elle ne remonte pas en exception."""
    graph = FauxGraph(lot(10), erreur_a_la_page=1)
    fetch_all.requests = graph
    campagnes, err = fetch_all._meta_campagnes("JETON", "act_42")
    egal("rien ne remonte", campagnes, [])
    ok("mais l'échec est nommé", err is not None, f"err = {err!r}")


# ── 2bis · LE JETON NE SORT PAR AUCUN MESSAGE ────────────────────────────────
#
# `requests` fusionne les params dans l'URL avant de se connecter et la RECOPIE
# dans son exception ; le curseur `paging.next` de Meta porte le jeton par
# construction. Sans filtre, une coupure réseau écrit le jeton Meta d'un client
# EN CLAIR dans le journal de run de GitHub Actions, qui est public
# (`CLAUDE.md` §7 : « un message d'erreur nomme la variable, jamais sa valeur »).

def test_une_coupure_sur_la_premiere_page_ne_recrache_pas_le_jeton():
    graph = FauxGraph(lot(10), erreur_a_la_page=1)
    fetch_all.requests = graph
    _, err = fetch_all._meta_campagnes("EAAsecret123", "act_42")
    ok("le jeton est masqué", err and "EAAsecret123" not in err, f"err = {err!r}")
    ok("mais la cause reste lisible",
       err and "access_token=…" in err, f"err = {err!r}")


def test_une_coupure_en_pagination_ne_recrache_pas_le_jeton():
    """Le pire des deux : le curseur `next` porte TOUJOURS le jeton."""
    graph = FauxGraph(lot(440), erreur_a_la_page=2)
    fetch_all.requests = graph
    _, err = fetch_all._meta_campagnes("EAAsecret123", "act_42")
    ok("le jeton du curseur est masqué",
       err and "SECRET" not in err, f"err = {err!r}")
    ok("et le compte vu reste dit",
       err and "200" in err, f"err = {err!r}")


def test_le_filtre_laisse_intact_un_message_sans_jeton():
    """Un filtre qui mange autre chose que le jeton rendrait le journal muet —
    exactement le défaut que ce ticket corrige, par l'autre bout."""
    egal("rien à masquer, rien de masqué",
         fetch_all._sans_jeton("2026-09-01→2026-09-07 : limite de débit atteinte"),
         "2026-09-01→2026-09-07 : limite de débit atteinte")


def test_la_tranche_d_insights_ne_recrache_pas_le_jeton_non_plus():
    """`_meta_chunk` portait la même fuite, par le même chemin — corrigée dans
    le même geste : c'est le seul autre appel Meta qui imprime son exception."""
    graph = FauxGraph([])
    fetch_all.requests = graph
    lignes, err = _VRAI_META_CHUNK("EAAsecret123", "act_42", "2026-09-01", "2026-09-07")
    egal("la première page est gardée", len(lignes), 1)
    ok("l'erreur est rendue", err is not None, f"err = {err!r}")
    ok("et le jeton du curseur est masqué",
       err and "SECRET" not in err, f"err = {err!r}")


# ── 3 · CE QUE `_fetch_meta` EN FAIT ─────────────────────────────────────────

class _Espion:
    """Ce que la récolte a voulu écrire, sans base ni réseau."""

    def __init__(self):
        self.statuts = None
        self.lignes = None


def _recolte(graph, espion, lignes_insights):
    """Fait tourner `_fetch_meta` hors ligne et rend ce qu'il a imprimé.

    Tout ce qui n'est pas le sujet du ticket est neutralisé : budgets, journal
    des changements, garde-fou de schéma et tranches d'insights. Ce qui reste
    est exactement le chemin des statuts.
    """
    fetch_all.requests = graph
    fetch_all._photo_budget = lambda *a, **k: None
    fetch_all._journal_changements = lambda *a, **k: None
    fetch_all._colonne_ad_id_presente = lambda sb: True
    fetch_all._meta_chunk = lambda *a, **k: (list(lignes_insights), None)
    fetch_all.fetch_meta_ads_latest_date = lambda sb, uid: (
        AUJOURD_HUI - timedelta(days=1)).isoformat()
    fetch_all.upsert_meta_ads = lambda sb, uid, rows: setattr(espion, "lignes", rows)
    fetch_all.upsert_campaign_statuses = lambda sb, uid, m: setattr(espion, "statuts", m)
    sortie = io.StringIO()
    with contextlib.redirect_stdout(sortie):
        resume = fetch_all._fetch_meta(None, "u1", "JETON")
    return resume, sortie.getvalue()


def test_la_campagne_de_la_page_deux_recoit_son_vrai_statut():
    """LE DÉFAUT DU TICKET, VU D'EN HAUT. `camp-201` est en pause depuis des
    semaines ; sans pagination elle était upsertée `UNKNOWN`, indistinguable
    d'une campagne que Meta ne sait pas décrire."""
    campagnes = lot(200) + [campagne("camp-201", "PAUSED")]
    espion = _Espion()
    _recolte(FauxGraph(campagnes), espion,
             [{"campaign_name": "camp-201", "actions": []}])
    egal("les 201 statuts sont écrits", len(espion.statuts or {}), 201)
    egal("et le 201e est le vrai",
         (espion.statuts or {}).get("camp-201", {}).get("status"), "PAUSED")


def test_le_journal_compte_les_campagnes_vues():
    """« un statut manquant ne se distingue pas d'une campagne sans statut » :
    le nombre vu est la seule chose qui les sépare dans une run verte."""
    espion = _Espion()
    _, journal = _recolte(FauxGraph(lot(440)), espion,
                          [{"campaign_name": "camp-001", "actions": []}])
    ok("le journal dit combien de campagnes ont été vues",
       "440" in journal, f"journal = {journal!r}")


def test_une_liste_tronquee_ne_passe_pas_pour_entiere():
    """La run reste VERTE — une liste de campagnes incomplète ne vaut pas une
    semaine d'insights perdue — mais elle ne se tait pas."""
    espion = _Espion()
    _, journal = _recolte(FauxGraph(lot(440), erreur_a_la_page=2), espion,
                          [{"campaign_name": "camp-001", "actions": []}])
    ok("le journal signale l'incomplétude",
       "INCOMPLÈTE" in journal or "incomplète" in journal, f"journal = {journal!r}")
    ok("il dit combien on a vu", "200" in journal, f"journal = {journal!r}")
    egal("et les 200 statuts connus sont tout de même écrits",
         len(espion.statuts or {}), 200)


def test_les_insights_s_ecrivent_meme_sans_aucun_statut():
    """Une dépense mesurée ne doit jamais être perdue parce que la liste des
    campagnes a échoué : ce sont deux requêtes, et une seule porte l'argent."""
    espion = _Espion()
    resume, _ = _recolte(FauxGraph(lot(10), erreur_meta="Session has expired"),
                         espion, [{"campaign_name": "camp-001", "actions": []}])
    egal("la ligne d'insight est écrite", len(espion.lignes or []), 1)
    egal("et la récolte rend son compte", resume, "meta: 1 lignes")


# ── 4 · CE QUE LA REVUE A TROUVÉ ─────────────────────────────────────────────

def test_un_curseur_qui_tourne_en_rond_s_arrete_et_le_dit():
    """Meta sait rendre une page VIDE qui porte encore un `paging.next`. Sans
    plafond, le worker de ce client tourne à 30 s par requête sans jamais finir
    ni rien dire — une run qui ne rend pas la main."""
    graph = FauxGraph(lot(440), curseur_sans_fin=True)
    fetch_all.requests = graph
    campagnes, err = fetch_all._meta_campagnes("JETON", "act_42")
    ok("la boucle s'arrête", err is not None, f"err = {err!r}")
    ok("et dit pourquoi", err and "sans fin" in err, f"err = {err!r}")
    ok("sans dépasser le plafond",
       len(graph.appels) <= fetch_all._CAMPAGNES_PAGES_MAX + 1,
       f"{len(graph.appels)} appels")


def test_une_reponse_qui_n_est_pas_un_objet_ne_leve_pas():
    """La fonction a promis de rendre son erreur, pas de lever : un
    AttributeError ici ferait tomber tout le canal Meta — et la semaine
    d'insights avec — pour une liste de campagnes."""
    fetch_all.requests = FauxGraph([], reponse_brute=["pas un objet"])
    campagnes, err = fetch_all._meta_campagnes("JETON", "act_42")
    egal("rien ne remonte", campagnes, [])
    ok("et l'erreur nomme la forme reçue",
       err and "inattendue" in err, f"err = {err!r}")


def test_les_statuts_s_ecrivent_meme_sans_une_seule_ligne_de_depense():
    """L'écriture des statuts vivait sous le `if rows:` des insights. Un compte
    qui ne dépense plus gardait donc l'`ACTIVE` de sa dernière semaine
    dépensière, montré comme courant par `channels.ts` — sur une run verte qui
    venait d'imprimer le nombre de campagnes vues."""
    espion = _Espion()
    _recolte(FauxGraph([campagne("camp-001", "PAUSED")]), espion, [])
    egal("le statut est écrit malgré zéro ligne d'insight",
         (espion.statuts or {}).get("camp-001", {}).get("status"), "PAUSED")
    egal("et aucune ligne d'insight n'est inventée", espion.lignes, None)


def test_le_mot_de_la_fin_d_un_canal_ne_porte_pas_le_jeton():
    """LE CHEMIN LE PLUS GRAVE, ET IL NE S'ARRÊTE PAS AU JOURNAL. Le `mot` de
    `_fil` s'écrit dans `fetch_progress.mot_de_fin`, que l'app relit et montre :
    un membre invité y lirait un jeton de `connected_accounts` (`CLAUDE.md` §7,
    « les jetons ne sont jamais partagés avec un membre invité »)."""
    import saas.collecte.automatisation.suivi as suivi_mod

    class _SuiviMuet(suivi_mod.Suivi):
        def __init__(self):
            self.mots = []

        def commence(self, *a, **k):
            pass

        def note(self, *a, **k):
            pass

        def termine(self, sb, canal, etat, mot):
            self.mots.append(mot)

    def _tombe(sb, note):
        raise ConnectionError(
            "HTTPSConnectionPool(host='graph.facebook.com', port=443): Max "
            "retries exceeded with url: /v24.0/me/adaccounts?fields=id"
            "&access_token=EAAsecret123")

    suivi = _SuiviMuet()
    fetch_all._service_client = lambda: None
    sorties = fetch_all._fil([("meta", _tombe)], suivi)
    mot = sorties[0][1]
    ok("le jeton ne part pas dans le journal",
       "EAAsecret123" not in mot, f"mot = {mot!r}")
    ok("ni en base", all("EAAsecret123" not in m for m in suivi.mots),
       f"mots = {suivi.mots!r}")
    ok("et la cause reste lisible",
       "Max retries exceeded" in mot and "access_token=…" in mot,
       f"mot = {mot!r}")


if __name__ == "__main__":
    import sys
    for nom, fn in sorted(globals().items()):
        if nom.startswith("test_") and callable(fn):
            fn()
    sys.exit(0 if bilan("Ticket 21 — campagnes Meta paginées") else 1)
