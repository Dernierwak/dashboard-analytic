"""Harnais du ticket 04 — le journal des changements s'élargit.

Seam : « réponse /activities → lignes à écrire », sans appel réseau.
Lancer depuis la racine du dépôt :

    python3.12 -m pytest .scratch/meta-ads/harnais/04-le-journal -q

Les activités ci-dessous ont la forme que `fetch_activities` demande à Meta
(`event_type, event_time, object_id, object_name, extra_data`). Aucun
`extra_data` réel n'a encore été lu pour les nouveaux types : les tests
vérifient donc que leurs phrases n'en tirent aucune valeur.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))

from saas.collecte.meta.fetch_meta_ads import (  # noqa: E402
    hierarchie_depuis_insights,
    lignes_activites,
)

QUAND = "2026-09-28T09:40:00+0000"


def _acte(event_type, object_id="111", object_name="Acheteurs 30 j", extra=None):
    return {"event_type": event_type, "event_time": QUAND, "object_id": object_id,
            "object_name": object_name, "extra_data": extra}


def _une(acte, parents=None):
    lignes = lignes_activites([acte], parents or {})
    assert len(lignes) == 1, lignes
    return lignes[0]


# ── Chaque nouveau type connu rend sa phrase ─────────────────────────────────

def test_une_enchere_de_groupe_d_annonces_rend_sa_phrase():
    ligne = _une(_acte("update_ad_set_bidding"))
    assert (ligne["categorie"], ligne["resume"]) == (
        "enchere", 'l\'enchère du groupe d\'annonces "Acheteurs 30 j" a été modifiée')


def test_une_strategie_d_enchere_rend_sa_phrase():
    ligne = _une(_acte("update_ad_set_bid_strategy"))
    assert (ligne["categorie"], ligne["resume"]) == (
        "enchere", 'la stratégie d\'enchère du groupe d\'annonces "Acheteurs 30 j" a été modifiée')


def test_une_enchere_d_annonce_rend_sa_phrase():
    ligne = _une(_acte("update_ad_bid_info", object_name="Vidéo 15 s"))
    assert (ligne["categorie"], ligne["resume"]) == (
        "enchere", 'l\'enchère de l\'annonce "Vidéo 15 s" a été modifiée')


def test_le_statut_d_une_annonce_rend_sa_phrase():
    ligne = _une(_acte("update_ad_run_status", object_name="Vidéo 15 s"))
    assert (ligne["categorie"], ligne["resume"]) == (
        "statut", 'le statut de l\'annonce "Vidéo 15 s" a été modifié')


def test_les_trois_creations_rendent_leur_phrase():
    attendu = {
        "create_campaign_group": 'la campagne "X" a été créée',
        "create_ad_set": 'le groupe d\'annonces "X" a été créé',
        "create_ad": 'l\'annonce "X" a été créée',
    }
    for typ, phrase in attendu.items():
        ligne = _une(_acte(typ, object_name="X"))
        assert (ligne["categorie"], ligne["resume"]) == ("creation", phrase), typ


def test_un_extra_data_non_lu_ne_fabrique_aucune_valeur():
    # Une valeur glissée dans extra_data ne doit pas apparaître : sa forme
    # n'a jamais été vue pour ces types.
    extra = '{"old_value": "1500", "new_value": "PAUSED"}'
    for typ in ("update_ad_set_bidding", "update_ad_run_status"):
        resume = _une(_acte(typ, extra=extra))["resume"]
        assert "15" not in resume and "pause" not in resume, resume


# ── Le groupe d'annonces se dit au masculin (CONTEXT.md, ticket 16) ──────────

def test_le_budget_d_un_groupe_d_annonces_dit_du_groupe():
    ligne = _une(_acte("update_ad_set_budget",
                       extra='{"old_value": "4000", "new_value": "6000"}'))
    assert ligne["resume"] == (
        'le budget du groupe d\'annonces "Acheteurs 30 j" est passé de 40,00 à 60,00 CHF')


def test_un_groupe_d_annonces_est_mis_en_pause_au_masculin():
    ligne = _une(_acte("update_ad_set_run_status",
                       extra='{"old_value": "ACTIVE", "new_value": "PAUSED"}'))
    assert ligne["resume"] == 'le groupe d\'annonces "Acheteurs 30 j" a été mis en pause'


def test_une_campagne_reste_mise_en_pause_au_feminin():
    ligne = _une(_acte("update_campaign_run_status", object_id="900", object_name="Soldes",
                       extra='{"old_value": "ACTIVE", "new_value": "PAUSED"}'))
    assert ligne["resume"] == 'la campagne "Soldes" a été mise en pause'


def test_le_ciblage_d_un_groupe_d_annonces_rend_sa_phrase():
    ligne = _une(_acte("update_ad_set_target_spec"))
    assert ligne["resume"] == 'le ciblage du groupe d\'annonces "Acheteurs 30 j" a été modifié'


def test_aucune_phrase_de_groupe_d_annonces_ne_dit_ensemble():
    extra = '{"old_value": "ACTIVE", "new_value": "ARCHIVED"}'
    for typ in ("update_ad_set_budget", "update_ad_set_run_status", "update_ad_set_target_spec",
                "update_ad_set_bidding", "update_ad_set_bid_strategy", "create_ad_set"):
        resume = _une(_acte(typ, extra=extra))["resume"]
        assert "ensemble" not in resume, (typ, resume)


# ── Un type inconnu ne rend rien ─────────────────────────────────────────────

def test_la_revue_de_meta_n_est_pas_retenue():
    assert lignes_activites([_acte("ad_review_declined")], {}) == []


def test_un_type_inconnu_ne_rend_rien():
    assert lignes_activites([_acte("update_ad_set_name")], {}) == []


# ── Les types déjà récoltés ne bougent pas ───────────────────────────────────

def test_un_budget_de_campagne_garde_sa_phrase_et_sa_campagne():
    ligne = _une(_acte("update_campaign_budget", object_id="900", object_name="Soldes",
                       extra='{"old_value": "5000", "new_value": "7000"}'))
    assert ligne["resume"] == 'le budget de la campagne "Soldes" est passé de 50,00 à 70,00 CHF'
    assert (ligne["campaign_id"], ligne["campaign_name"]) == ("900", "Soldes")


# ── La campagne parente se retrouve par l'ID ─────────────────────────────────

PARENTS = {"111": ("900", "Soldes d'automne"), "222": ("900", "Soldes d'automne")}


def test_un_changement_de_groupe_d_annonces_porte_sa_campagne():
    ligne = _une(_acte("update_ad_set_budget", object_id="111"), PARENTS)
    assert (ligne["campaign_id"], ligne["campaign_name"]) == ("900", "Soldes d'automne")


def test_un_changement_d_annonce_porte_sa_campagne():
    ligne = _une(_acte("create_ad", object_id="222", object_name="Vidéo"), PARENTS)
    assert (ligne["campaign_id"], ligne["campaign_name"]) == ("900", "Soldes d'automne")


def test_une_creation_de_campagne_porte_sa_propre_campagne():
    ligne = _une(_acte("create_campaign_group", object_id="901", object_name="Noël"), PARENTS)
    assert (ligne["campaign_id"], ligne["campaign_name"]) == ("901", "Noël")


def test_un_id_inconnu_laisse_la_campagne_absente():
    ligne = _une(_acte("update_ad_set_target_spec", object_id="333"), PARENTS)
    assert (ligne["campaign_id"], ligne["campaign_name"]) == (None, None)


def test_le_nom_d_un_groupe_d_annonces_ne_rattache_a_rien():
    # Le rattachement passe par l'ID, jamais par un nom qui se réutilise.
    parents = {"Acheteurs 30 j": ("900", "Soldes")}
    ligne = _une(_acte("update_ad_set_budget", object_id="333"), parents)
    assert ligne["campaign_id"] is None


# ── La hiérarchie se lit dans les lignes d'insights ──────────────────────────

def test_la_hierarchie_rattache_groupes_d_annonces_et_annonces():
    lignes = [{"date_start": "2026-09-01", "campaign_id": "900", "campaign_name": "Soldes",
               "adset_id": "111", "ad_id": "222"}]
    assert hierarchie_depuis_insights(lignes) == {"111": ("900", "Soldes"),
                                                  "222": ("900", "Soldes")}


def test_une_ligne_sans_campaign_id_ne_rattache_rien():
    # Les lignes d'avant le rejeu du ticket 03 n'ont pas d'ID : on ne devine pas.
    lignes = [{"date_start": "2026-01-01", "campaign_id": None, "campaign_name": "Soldes",
               "adset_id": None, "ad_id": "222"}]
    assert hierarchie_depuis_insights(lignes) == {}


def test_une_campagne_renommee_prend_son_nom_le_plus_recent():
    lignes = [
        {"date_start": "2026-09-02", "campaign_id": "900", "campaign_name": "Soldes 2026",
         "adset_id": "111", "ad_id": "222"},
        {"date_start": "2026-09-01", "campaign_id": "900", "campaign_name": "Soldes",
         "adset_id": "111", "ad_id": "223"},
    ]
    parents = hierarchie_depuis_insights(lignes)
    assert parents["223"] == ("900", "Soldes 2026")


# ── Un passage qui ne retrouve plus la campagne ne l'efface pas ──────────────

def test_un_changement_sans_campagne_n_envoie_pas_la_colonne():
    from saas.commun.insert_data import lots_sans_effacer_la_campagne
    lots = lots_sans_effacer_la_campagne([
        {"change_id": "a", "campaign_id": "900", "campaign_name": "Soldes", "resume": "x"},
        {"change_id": "b", "campaign_id": None, "campaign_name": None, "resume": "y"},
    ])
    assert lots == [[{"change_id": "a", "campaign_id": "900", "campaign_name": "Soldes", "resume": "x"}],
                    [{"change_id": "b", "resume": "y"}]]


# ── Le fuseau du compte voyage avec chaque changement (ticket 17) ────────────
#
# Meta écrit `event_time` en UTC ; les jours des insights sont ceux du compte.
# Sans le fuseau, l'écran ne peut que découper en UTC et poser la veille un
# geste fait entre minuit et deux heures à Zurich.

def test_chaque_changement_porte_le_fuseau_du_compte():
    lignes = lignes_activites([_acte("update_ad_set_budget")], {}, "Europe/Zurich")
    assert [l["fuseau"] for l in lignes] == ["Europe/Zurich"]


def test_un_fuseau_inconnu_n_envoie_pas_la_colonne():
    # Un `fuseau: None` réécrirait à NULL, par upsert, le fuseau déjà acquis
    # des 180 jours relus à chaque passage.
    lignes = lignes_activites([_acte("update_ad_set_budget")], {}, None)
    assert "fuseau" not in lignes[0]


def test_l_horodatage_reste_tel_que_meta_l_ecrit():
    # La conversion se fait à l'affichage : l'instant stocké reste juste.
    ligne = lignes_activites([_acte("update_ad_set_budget")], {}, "Europe/Zurich")[0]
    assert ligne["occurred_at"] == QUAND


def test_le_fuseau_se_lit_avec_le_compte():
    from saas.collecte.meta.fetch_meta_ads import compte_et_fuseau
    assert compte_et_fuseau([{"id": "act_1", "timezone_name": "Europe/Zurich"}]) == ("act_1", "Europe/Zurich")
    assert compte_et_fuseau([{"id": "act_1"}]) == ("act_1", None)
    assert compte_et_fuseau([{"id": "act_1", "timezone_name": "  "}]) == ("act_1", None)
    assert compte_et_fuseau([]) == (None, None)


def test_l_upsert_ecrit_le_fuseau_et_ne_l_efface_jamais():
    from saas.commun.insert_data import upsert_platform_changes

    class Table:
        def __init__(self, envois): self.envois = envois
        def upsert(self, lot, on_conflict): self.envois.append(lot); return self
        def execute(self): return None

    class Base:
        def __init__(self): self.envois = []
        def table(self, _nom): return Table(self.envois)

    base = Base()
    upsert_platform_changes(base, "u", "meta", [
        {"change_id": "a", "occurred_at": QUAND, "resume": "x", "campaign_id": "900", "fuseau": "Europe/Zurich"},
        {"change_id": "b", "occurred_at": QUAND, "resume": "y"},
    ])
    envoyes = {r["change_id"]: r for lot in base.envois for r in lot}
    assert envoyes["a"]["fuseau"] == "Europe/Zurich"
    assert "fuseau" not in envoyes["b"]


def test_un_lot_mixte_ne_met_jamais_le_fuseau_a_null():
    # PostgREST prend l'union des clés d'un lot et écrit NULL là où une ligne
    # n'a pas la clé : une ligne sans fuseau doit partir dans un lot à part.
    from saas.commun.insert_data import lots_sans_effacer_la_campagne
    lots = lots_sans_effacer_la_campagne([
        {"change_id": "a", "campaign_id": "900", "fuseau": "Europe/Zurich", "resume": "x"},
        {"change_id": "b", "campaign_id": "900", "resume": "y"},
    ])
    for lot in lots:
        assert len({frozenset(r) for r in lot}) == 1, lot
    assert sorted(r["change_id"] for lot in lots for r in lot) == ["a", "b"]
