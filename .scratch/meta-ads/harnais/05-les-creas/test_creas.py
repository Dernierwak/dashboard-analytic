"""Harnais du ticket 05 — la récolte des créas.

Seam : « réponse de l'endpoint des créas → lignes à écrire », sans appel réseau.
Lancer depuis la racine du dépôt :

    python3.12 -m pytest .scratch/meta-ads/harnais/05-les-creas -q

Les annonces ci-dessous ont la forme que `fetch_annonces_creas` demande à Meta
(`/act_<id>/ads?fields=id,creative{…}`), d'après les pages de référence citées
dans `.scratch/meta-ads/recherche/champs-api-meta.md` § 4. Aucun appel réel n'a
encore été lu : le premier passage du worker confirme ou corrige ces formes.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))

from saas.collecte.meta.fetch_meta_ads import (  # noqa: E402
    hashes_des_creas,
    lignes_creas,
)
from saas.commun.insert_data import remplacer_creas  # noqa: E402

UID = "u-1"
STOCK = "https://x.supabase.co/storage/v1/object/public/ad-creatives/u-1/"


def _annonce(creative, ad_id="900"):
    return {"id": ad_id, "creative": {"id": "c-" + ad_id, "name": "Créa", **creative}}


def _seule(creative, stockees=None):
    creas, assets, sans_id = lignes_creas(UID, [_annonce(creative)], stockees or {})
    assert sans_id == 0 and len(creas) == 1, creas
    return creas[0], assets


# ── Les trois montages ───────────────────────────────────────────────────────

def test_le_montage_flat_se_lit_a_la_racine_de_la_crea():
    crea, assets = _seule({
        "object_type": "SHARE", "title": "Soldes", "body": "−30 % sur tout",
        "link_url": "https://boutique.ch/soldes", "call_to_action_type": "SHOP_NOW",
        "image_hash": "h1",
    }, {"h1": STOCK + "h1"})
    assert crea["montage"] == "flat"
    assert (crea["titre"], crea["texte"], crea["lien_url"], crea["call_to_action"]) == (
        "Soldes", "−30 % sur tout", "https://boutique.ch/soldes", "SHOP_NOW")
    assert (crea["image_hash"], crea["image_url"]) == ("h1", STOCK + "h1")
    assert assets == []


def test_link_data_porte_le_titre_dans_name_pas_dans_title():
    crea, _ = _seule({"object_story_spec": {"page_id": "p", "link_data": {
        "name": "Le titre", "message": "Le texte", "description": "La description",
        "link": "https://site.ch", "image_hash": "h2",
        "call_to_action": {"type": "LEARN_MORE", "value": {"link": "https://site.ch"}},
    }}})
    assert crea["montage"] == "object_story"
    assert (crea["titre"], crea["texte"], crea["description"]) == (
        "Le titre", "Le texte", "La description")
    assert (crea["lien_url"], crea["call_to_action"], crea["image_hash"]) == (
        "https://site.ch", "LEARN_MORE", "h2")


def test_video_data_rend_la_video_et_sa_vignette_stockee():
    crea, _ = _seule({"object_story_spec": {"video_data": {
        "video_id": "v1", "title": "Démo", "message": "Regardez", "link_description": "60 s",
        "image_hash": "hv",
        "call_to_action": {"type": "SIGN_UP", "value": {"link": "https://site.ch/inscription"}},
    }}}, {"hv": STOCK + "hv"})
    assert (crea["titre"], crea["texte"], crea["description"]) == ("Démo", "Regardez", "60 s")
    assert (crea["video_id"], crea["vignette_url"]) == ("v1", STOCK + "hv")
    assert crea["lien_url"] == "https://site.ch/inscription"
    # La vignette n'est pas le visuel de l'annonce : image_hash reste vide.
    assert crea["image_hash"] is None


def test_photo_data_rend_sa_legende_en_description():
    crea, _ = _seule({"object_story_spec": {"photo_data": {
        "caption": "Nouvelle collection", "image_hash": "hp"}}})
    assert (crea["montage"], crea["description"], crea["image_hash"]) == (
        "object_story", "Nouvelle collection", "hp")
    assert crea["titre"] is None and crea["texte"] is None


def test_asset_feed_rend_chaque_variante_numerotee():
    crea, assets = _seule({"object_story_spec": {"page_id": "p"}, "asset_feed_spec": {
        "bodies": [{"text": "Texte A"}, {"text": "Texte B"}],
        "titles": [{"text": "Titre A"}],
        "descriptions": [{"text": "Desc A"}],
        "images": [{"hash": "i0", "url": "https://scontent.fb/expire"}, {"hash": "i1"}],
        "videos": [{"video_id": "v9", "thumbnail_hash": "t9", "thumbnail_url": "https://fb/t"}],
        "link_urls": [{"website_url": "https://site.ch/a"}],
        "call_to_action_types": ["SHOP_NOW"],
    }}, {"i0": STOCK + "i0", "t9": STOCK + "t9"})
    assert crea["montage"] == "asset_feed"
    vu = {(a["asset_kind"], a["rang"]): a for a in assets}
    assert {a["provenance"] for a in assets} == {"asset_feed"}
    assert vu[("body", 0)]["texte"] == "Texte A" and vu[("body", 1)]["texte"] == "Texte B"
    assert vu[("title", 0)]["texte"] == "Titre A"
    assert vu[("description", 0)]["texte"] == "Desc A"
    assert (vu[("image", 0)]["image_hash"], vu[("image", 0)]["image_url"]) == ("i0", STOCK + "i0")
    assert (vu[("video", 0)]["video_id"], vu[("video", 0)]["vignette_url"]) == ("v9", STOCK + "t9")
    assert vu[("link_url", 0)]["lien_url"] == "https://site.ch/a"
    assert vu[("call_to_action", 0)]["texte"] == "SHOP_NOW"
    # 2 textes + 1 titre + 1 description + 2 images + 1 vidéo + 1 lien + 1 bouton.
    assert len(assets) == 9


def test_le_carrousel_rend_chaque_carte_et_sa_description():
    crea, assets = _seule({"object_story_spec": {"link_data": {
        "message": "Trois modèles", "link": "https://site.ch",
        "child_attachments": [
            {"name": "Modèle 1", "description": "Cuir", "link": "https://site.ch/1",
             "image_hash": "k0"},
            {"name": "Modèle 2", "image_hash": "k1"},
        ]}}}, {"k0": STOCK + "k0"})
    assert crea["montage"] == "object_story" and crea["texte"] == "Trois modèles"
    cartes = sorted((a for a in assets if a["asset_kind"] == "carousel_card"),
                    key=lambda a: a["rang"])
    assert [(c["rang"], c["texte"], c["lien_url"]) for c in cartes] == [
        (0, "Modèle 1", "https://site.ch/1"), (1, "Modèle 2", None)]
    assert (cartes[0]["image_url"], cartes[1]["image_hash"], cartes[1]["image_url"]) == (
        STOCK + "k0", "k1", None)
    descriptions = [a for a in assets if a["asset_kind"] == "description"]
    assert [(d["rang"], d["texte"]) for d in descriptions] == [(0, "Cuir")]
    assert {a["provenance"] for a in assets} == {"child_attachment"}


def test_une_publication_existante_n_est_pas_un_montage_flat():
    # Un post boosté : la créa pointe la publication, sans spec ni texte.
    crea, assets = _seule({"object_story_id": "123_456", "effective_object_story_id": "123_456"})
    assert crea["montage"] == "publication"
    assert crea["titre"] is None and crea["texte"] is None and assets == []


# ── Rien ne se fabrique ──────────────────────────────────────────────────────

def test_une_adresse_absente_reste_vide():
    crea, _ = _seule({"object_story_spec": {"link_data": {"message": "Sans lien"}},
                      "url_tags": "utm_source=meta"})
    assert crea["lien_url"] is None


def test_un_lien_absent_se_lit_dans_le_bouton_de_meta_et_nulle_part_ailleurs():
    crea, _ = _seule({"object_story_spec": {"link_data": {
        "call_to_action": {"type": "SHOP_NOW", "value": {"link": "https://site.ch/cta"}}}}})
    assert crea["lien_url"] == "https://site.ch/cta"


def test_une_image_pas_encore_stockee_garde_son_hash_sans_url_meta():
    crea, _ = _seule({"image_hash": "h1", "image_url": "https://scontent.fb/expire"})
    assert (crea["image_hash"], crea["image_url"]) == ("h1", None)


def test_un_texte_vide_vaut_null():
    crea, _ = _seule({"title": "", "body": None})
    assert crea["titre"] is None and crea["texte"] is None


def test_aucun_chiffre_par_asset():
    _, assets = _seule({"asset_feed_spec": {"bodies": [{"text": "A"}]}})
    assert set(assets[0]) == {"user_id", "ad_id", "provenance", "asset_kind", "rang",
                              "texte", "image_hash", "image_url", "video_id",
                              "vignette_url", "lien_url"}


# ── L'identité de l'annonce ──────────────────────────────────────────────────

def test_une_annonce_sans_id_est_comptee_et_ecartee():
    creas, _, sans_id = lignes_creas(UID, [{"creative": {"id": "c"}}], {})
    assert (creas, sans_id) == ([], 1)


def test_une_annonce_sans_crea_n_ecrit_rien():
    creas, assets, sans_id = lignes_creas(UID, [{"id": "900"}], {})
    assert (creas, assets, sans_id) == ([], [], 0)


def test_deux_annonces_qui_partagent_une_crea_restent_deux_lignes():
    creas, _, _ = lignes_creas(UID, [_annonce({"title": "A"}, "1"),
                                     _annonce({"title": "A"}, "2")], {})
    assert [c["ad_id"] for c in creas] == ["1", "2"]


def test_une_annonce_lue_deux_fois_n_ecrit_qu_une_ligne():
    creas, _, _ = lignes_creas(UID, [_annonce({"title": "A"}), _annonce({"title": "A"})], {})
    assert len(creas) == 1


# ── Les images à téléverser ──────────────────────────────────────────────────

def test_les_hashes_couvrent_les_trois_montages_et_les_vignettes():
    annonces = [
        _annonce({"image_hash": "a"}, "1"),
        _annonce({"object_story_spec": {"link_data": {"image_hash": "b", "child_attachments": [
            {"image_hash": "c"}]}}}, "2"),
        _annonce({"object_story_spec": {"video_data": {"image_hash": "d"}}}, "3"),
        _annonce({"asset_feed_spec": {"images": [{"hash": "e"}],
                                      "videos": [{"thumbnail_hash": "f"}]}}, "4"),
    ]
    assert hashes_des_creas(annonces) == {"a", "b", "c", "d", "e", "f"}


def test_une_annonce_sans_id_ne_fait_televerser_aucune_image():
    assert hashes_des_creas([{"creative": {"image_hash": "a"}}]) == set()


# ── L'écriture remplace les assets de l'annonce relue ────────────────────────

class _FauxClient:
    def __init__(self):
        self.appels = []

    def table(self, nom):
        return _FausseRequete(self, nom)


class _FausseRequete:
    def __init__(self, client, nom):
        self.client, self.nom, self.trace = client, nom, []

    def __getattr__(self, methode):
        def appel(*args, **kwargs):
            self.trace.append((methode, args, kwargs))
            return self
        return appel

    def execute(self):
        self.client.appels.append((self.nom, self.trace))
        return self


def test_l_ecriture_efface_les_assets_des_seules_annonces_relues_puis_insere():
    creas, assets, _ = lignes_creas(UID, [
        _annonce({"asset_feed_spec": {"bodies": [{"text": "A"}]}}, "1"),
        _annonce({"title": "plus d'asset"}, "2"),
    ], {})
    sb = _FauxClient()
    remplacer_creas(sb, UID, creas, assets)
    effacements = [t for nom, t in sb.appels
                   if nom == "meta_ads_creative_assets" and t[0][0] == "delete"]
    assert len(effacements) == 1
    filtres = {(m, (a[0], tuple(a[1]) if isinstance(a[1], list) else a[1]))
               for m, a, _ in effacements[0][1:]}
    # L'annonce 2 n'a plus d'asset : ses anciennes lignes partent quand même.
    assert ("eq", ("user_id", UID)) in filtres
    assert ("in_", ("ad_id", ("1", "2"))) in filtres
    ordre = [(nom, t[0][0]) for nom, t in sb.appels]
    assert ordre.index(("meta_ads_creative_assets", "delete")) < ordre.index(
        ("meta_ads_creative_assets", "insert"))
    ecrites = [t for nom, t in sb.appels if nom == "meta_ads_creatives"]
    assert ecrites and all("recolte_le" in r for r in ecrites[0][0][1][0])
