"""Harnais du ticket 13 — la clé de la config de campagne passe à l'ID.

Seams : « réponse /campaigns → lignes de config », puis « lignes → upsert »
contre un faux client Supabase. Sans réseau. Lancer depuis la racine du dépôt :

    python3.12 -m pytest .scratch/meta-ads/harnais/13-la-cle-de-config -q

Le SQL de l'étape B ne se teste pas ici : il se vérifie sur un PostgreSQL
jetable (voir le ticket).
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))

from saas.collecte.meta.ads import campagnes as campagnes_api  # noqa: E402
from saas.collecte.meta.ads.campagnes import lignes_config_meta  # noqa: E402
from saas.collecte.meta.graph import AccesMeta  # noqa: E402
from saas.collecte.socle import http  # noqa: E402
from saas.collecte.ecriture.meta import upsert_campaign_statuses  # noqa: E402


def _campagne(**k):
    base = {"id": "120001", "name": "Camp A", "effective_status": "ACTIVE",
            "start_time": "2026-09-01T00:00:00+0200", "stop_time": None}
    base.update(k)
    return base


# ── /campaigns → lignes de config ────────────────────────────────────────────

def test_la_ligne_porte_l_id_et_le_nom_actuel():
    (ligne,), _ = lignes_config_meta("u1", [_campagne()])
    assert ligne == {"user_id": "u1", "campaign_id": "120001",
                     "campaign_name": "Camp A", "effective_status": "ACTIVE",
                     "start_date": "2026-09-01", "end_date": None}


def test_une_campagne_sans_id_est_ecartee_et_comptee():
    lignes, sans_id = lignes_config_meta("u1", [_campagne(id=None), _campagne()])
    assert [l["campaign_id"] for l in lignes] == ["120001"]
    assert sans_id == 1


def test_deux_campagnes_homonymes_restent_deux_lignes():
    lignes, _ = lignes_config_meta("u1", [_campagne(id="1"), _campagne(id="2")])
    assert sorted(l["campaign_id"] for l in lignes) == ["1", "2"]


def test_un_statut_absent_reste_absent():
    sans = _campagne()
    del sans["effective_status"]
    (ligne,), _ = lignes_config_meta("u1", [sans])
    assert ligne["effective_status"] is None


def test_la_meme_campagne_vue_deux_fois_ne_s_ecrit_qu_une_fois():
    lignes, _ = lignes_config_meta("u1", [_campagne(), _campagne()])
    assert len(lignes) == 1


# ── La requête demande l'id, en un appel ─────────────────────────────────────

def test_la_liste_des_campagnes_demande_l_id(monkeypatch):
    appels = []

    class _Rep:
        def json(self):
            return {"data": [_campagne()]}

    def faux_get(url, params=None, timeout=None, headers=None):
        appels.append(params)
        return _Rep()

    monkeypatch.setattr(http, "get", faux_get)
    campagnes, trous = campagnes_api.recuperer(AccesMeta(jeton="JETON", compte="act_42"))
    assert trous == []
    assert len(appels) == 1
    assert "id" in appels[0]["fields"].split(",")


# ── L'écriture : par ID, et par le nom tant que l'étape B n'est pas jouée ────

class _Err(Exception):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


class _FauxSb:
    """Refuse l'upsert dont la clé de conflit n'est pas la clé primaire."""

    def __init__(self, cle, erreur=None):
        self.cle = cle
        self.erreur = erreur
        self.essais = []

    def table(self, nom):
        assert nom == "meta_campaign_config"
        return self

    def upsert(self, lot, on_conflict=None):
        self.essais.append((on_conflict, list(lot)))
        self._conflit = on_conflict
        return self

    def execute(self):
        if self.erreur:
            raise self.erreur
        if self._conflit != self.cle:
            raise _Err("42P10")
        return None


def test_apres_l_etape_b_l_upsert_porte_sur_l_id():
    sb = _FauxSb("user_id,campaign_id")
    lignes, _ = lignes_config_meta("u1", [_campagne()])
    upsert_campaign_statuses(sb, "u1", lignes)
    assert [c for c, _ in sb.essais] == ["user_id,campaign_id"]


def test_avant_l_etape_b_l_upsert_retombe_sur_le_nom_et_ecrit_l_id():
    sb = _FauxSb("user_id,campaign_name")
    lignes, _ = lignes_config_meta("u1", [_campagne()])
    upsert_campaign_statuses(sb, "u1", lignes)
    assert [c for c, _ in sb.essais] == ["user_id,campaign_id", "user_id,campaign_name"]
    assert sb.essais[1][1][0]["campaign_id"] == "120001"


def test_avant_l_etape_b_un_nom_homonyme_n_est_pas_ecrit():
    # Sous la clé par nom, deux campagnes homonymes viseraient la même ligne :
    # en garder une serait choisir au hasard laquelle porte l'ID.
    sb = _FauxSb("user_id,campaign_name")
    lignes, _ = lignes_config_meta("u1", [_campagne(id="1"), _campagne(id="2"),
                                          _campagne(id="3", name="Camp B")])
    sautees = upsert_campaign_statuses(sb, "u1", lignes)
    assert [l["campaign_id"] for l in sb.essais[1][1]] == ["3"]
    assert sautees == 2


def test_apres_l_etape_b_rien_n_est_saute():
    sb = _FauxSb("user_id,campaign_id")
    lignes, _ = lignes_config_meta("u1", [_campagne(id="1"), _campagne(id="2")])
    assert upsert_campaign_statuses(sb, "u1", lignes) == 0


def test_une_autre_erreur_remonte_telle_quelle():
    sb = _FauxSb("user_id,campaign_id", erreur=_Err("42501"))
    lignes, _ = lignes_config_meta("u1", [_campagne()])
    with pytest.raises(_Err):
        upsert_campaign_statuses(sb, "u1", lignes)
    assert len(sb.essais) == 1


def test_rien_a_ecrire_aucun_appel():
    sb = _FauxSb("user_id,campaign_id")
    upsert_campaign_statuses(sb, "u1", [])
    assert sb.essais == []
