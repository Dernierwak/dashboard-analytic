"""Harnais du ticket 12 : la récolte garde l'élément et ce que Meta envoie.

Exécute `lignes_activites` et `upsert_platform_changes` sur les formes réelles
du ticket 02 (noms et IDs remplacés : le dépôt est public) et sur la forme de
budget de la recherche (`recherche/activities.md`), sans réseau ni base.

    python3.12 .scratch/journal-meta/harnais/12/verifier.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))

from saas.data.fetch_data.sources.meta.ads.fetchers.activities import (  # noqa: E402
    hierarchie_depuis_insights, lignes_activites,
)
from saas.data.supabase.source_data.platform import upsert_platform_changes  # noqa: E402

CAMPAGNE, GROUPE, ANNONCE, GROUPE_NEUF, ANNONCE_NEUVE = "100", "200", "300", "210", "310"

insights = [
    {"date_start": "2026-08-01", "campaign_id": CAMPAGNE, "campaign_name": "Campagne A",
     "adset_id": GROUPE, "ad_id": ANNONCE},
    {"date_start": "2026-08-02", "campaign_id": CAMPAGNE, "campaign_name": "Campagne A",
     "adset_id": GROUPE_NEUF, "ad_id": None},
]
parents = hierarchie_depuis_insights(insights)


def acte(typ, oid, nom, extra, t="2026-09-30T16:10:00+0000"):
    return {"event_type": typ, "event_time": t, "object_id": oid, "object_name": nom,
            "extra_data": extra if isinstance(extra, str) or extra is None else json.dumps(extra)}


cas = {
    "statut_groupe": acte("update_ad_set_run_status", GROUPE, "Groupe B",
        {"old_value": "Actif", "new_value": "En attente de traitement",
         "run_status": {"old_value": 1, "new_value": 17}, "type": "run_status"}),
    "statut_annonce": acte("update_ad_run_status", ANNONCE, "Annonce C",
        {"old_value": "En attente d'examen", "new_value": "Actif",
         "run_status": {"old_value": 9, "new_value": 1}, "type": "run_status"}),
    "statut_campagne": acte("update_campaign_run_status", CAMPAGNE, "Campagne A",
        {"old_value": "Actif", "new_value": "Inactif", "type": "run_status"}),
    "ciblage_groupe": acte("update_ad_set_target_spec", GROUPE, "Groupe B",
        {"old_value": [{"content": "Lieu :", "children": ["Suisse"]}],
         "new_value": [{"content": "Lieu :", "children": ["Suisse"]},
                       {"content": "Âge :", "children": ["25 - 65+"]}],
         "type": "targets_spec"}),
    "ciblage_annonce": acte("update_ad_targets_spec", ANNONCE, "Annonce C",
        {"old_value": [], "new_value": [{"content": "Lieu :", "children": ["Suisse"]}]}),
    "crea": acte("update_ad_creative", ANNONCE, "Annonce C",
        {"old_value": ["https://x/img.jpg?sig=1", "Titre", "Texte", "900"],
         "new_value": ["https://x/img.jpg?sig=2", "Titre", "Texte", "901"]}),
    "objectif": acte("update_ad_set_optimization_goal", GROUPE, "Groupe B",
        {"new_value": "Vues de page de destination", "old_value": None,
         "type": "optimization_goal"}),
    "strategie": acte("update_ad_set_bid_strategy", GROUPE, "Groupe B",
        {"new_value": "LOWEST_COST_BID_STRATEGY",
         "additional_value": {"currency": "CHF", "type": "payment_amount"}, "type": "bid_type"}),
    "creation_groupe": acte("create_ad_set", GROUPE_NEUF, "Groupe neuf",
        {"new_value": {"type": "payment_amount", "currency": "CHF", "new_value": 20000,
                       "additional_value": "Budget global"}, "type": "composite_data"}),
    "creation_annonce": acte("create_ad", ANNONCE_NEUVE, "Annonce neuve",
        {"campaign_id": {"mutation_input": int(GROUPE_NEUF), "new": int(GROUPE_NEUF)}}),
    "calendrier": acte("update_ad_set_duration", GROUPE, "Groupe B",
        {"old_value": {"time_start": "août 27, 2026, 11:00 AM", "time_stop": None},
         "new_value": {"time_start": "août 27, 2026, 11:00 AM",
                       "time_stop": "sept. 30, 2026, 11:00 PM"}, "type": "duration"}),
    "budget": acte("update_ad_set_budget", GROUPE, "Groupe B",
        {"old_value": {"type": "payment_amount", "currency": "USD", "old_value": 1000,
                       "additional_type": "status_string", "additional_value": ""},
         "new_value": {"type": "payment_amount", "currency": "USD", "new_value": 2000,
                       "additional_type": "status_string", "additional_value": "Per day"},
         "type": "composite_data"}),
    "budget_illisible": acte("update_campaign_budget", CAMPAGNE, "Campagne A", None),
    "sans_nom": acte("update_ad_set_target_spec", "999", "", {"type": "targets_spec"}),
    "extra_pas_json": acte("update_ad_creative", ANNONCE, "Annonce C", "pas du json",
                           t="2026-09-30T17:00:00+0000"),
    "facturation": acte("ad_account_billing_charge", "1", "Compte", {"action": 67}),
}

lignes = lignes_activites(list(cas.values()), parents, "Europe/Zurich")
par_objet = {}
for nom, a in cas.items():
    from saas.data.fetch_data.sources.meta.ads.fetchers.activities import _cle_meta
    cle = _cle_meta(a["event_time"], a["event_type"], a["object_id"])
    par_objet[nom] = next((r for r in lignes if r["change_id"] == cle), None)

echecs: list[str] = []


def verifie(nom, condition, detail=""):
    print(("ok   " if condition else "ÉCHEC"), nom, detail)
    if not condition:
        echecs.append(nom)


r = par_objet
verifie("statut en français gardé, recopié sans traduction",
        r["statut_groupe"]["resume"] == 'le statut du groupe d\'annonces "Groupe B" est passé de « Actif » à « En attente de traitement »',
        r["statut_groupe"]["resume"])
verifie("statut : extra_data copie exacte, code chiffré compris",
        r["statut_groupe"]["extra_data"]["run_status"] == {"old_value": 1, "new_value": 17})
verifie("groupe : niveau, élément, adset_id = lui-même, campagne",
        {k: r["statut_groupe"].get(k) for k in ("niveau", "object_id", "object_name", "adset_id", "campaign_id", "campaign_name")}
        == {"niveau": "groupe", "object_id": GROUPE, "object_name": "Groupe B", "adset_id": GROUPE,
            "campaign_id": CAMPAGNE, "campaign_name": "Campagne A"})
verifie("annonce : son groupe retrouvé par la hiérarchie",
        r["statut_annonce"]["niveau"] == "annonce" and r["statut_annonce"]["adset_id"] == GROUPE
        and r["statut_annonce"]["campaign_id"] == CAMPAGNE)
verifie("campagne : campaign_id = l'objet, pas d'adset_id",
        r["statut_campagne"]["niveau"] == "campagne" and r["statut_campagne"]["campaign_id"] == CAMPAGNE
        and "adset_id" not in r["statut_campagne"], r["statut_campagne"]["resume"])
verifie("ciblage d'annonce récolté", r["ciblage_annonce"]["categorie"] == "audience"
        and r["ciblage_annonce"]["niveau"] == "annonce", r["ciblage_annonce"]["resume"])
verifie("ciblage de groupe : listes gardées telles quelles",
        r["ciblage_groupe"]["extra_data"]["new_value"][1]["children"] == ["25 - 65+"])
verifie("créa : « modifiée », pas « remplacée »", r["crea"]["resume"] == 'la créa de l\'annonce "Annonce C" a été modifiée')
verifie("objectif sans avant", r["objectif"]["categorie"] == "objectif"
        and r["objectif"]["resume"].endswith("a été réglé sur « Vues de page de destination »"), r["objectif"]["resume"])
verifie("stratégie d'enchère", r["strategie"]["categorie"] == "enchere", r["strategie"]["resume"])
verifie("création de groupe, campagne par la hiérarchie",
        r["creation_groupe"]["resume"] == 'le groupe d\'annonces "Groupe neuf" a été créé'
        and r["creation_groupe"]["campaign_id"] == CAMPAGNE)
verifie("création d'annonce : groupe lu dans extra_data.campaign_id, campagne par ce groupe",
        r["creation_annonce"]["adset_id"] == GROUPE_NEUF and r["creation_annonce"]["campaign_id"] == CAMPAGNE,
        str({k: r["creation_annonce"].get(k) for k in ("adset_id", "campaign_id")}))
verifie("calendrier", r["calendrier"]["categorie"] == "calendrier", r["calendrier"]["resume"])
verifie("budget composite_data (forme réelle : harnais 18)",
        r["budget"]["resume"] == 'le budget du groupe d\'annonces "Groupe B" est passé de 10,00 à 20,00 USD',
        r["budget"]["resume"])
verifie("budget illisible : « modifié », sans extra_data",
        r["budget_illisible"]["resume"] == 'le budget de la campagne "Campagne A" a été modifié'
        and "extra_data" not in r["budget_illisible"])
verifie("sans nom : gardé, dit par son ID", r["sans_nom"] is not None
        and r["sans_nom"]["resume"] == "le ciblage du groupe d'annonces 999 a été modifié"
        and "object_name" not in r["sans_nom"], r["sans_nom"] and r["sans_nom"]["resume"])
verifie("extra_data illisible : gardé comme chaîne", r["extra_pas_json"]["extra_data"] == "pas du json")
verifie("facturation : pas un geste du client, écartée", r["facturation"] is None)
verifie("aucune valeur None envoyée", all(v is not None for l in lignes for v in l.values()))
verifie("tous les types retenus donnent une ligne",
        sum(1 for v in r.values() if v) == len(cas) - 1)


class _Table:
    def __init__(self, envois):
        self.envois = envois

    def upsert(self, lot, on_conflict):
        self.envois.append(lot)
        return self

    def execute(self):
        return None


class _Client:
    def __init__(self):
        self.envois: list[list[dict]] = []

    def table(self, nom):
        return _Table(self.envois)


client = _Client()
upsert_platform_changes(client, "u", "meta", lignes)
envoyes = [rec for lot in client.envois for rec in lot]
verifie("upsert : toutes les lignes envoyées", len(envoyes) == len(lignes))
verifie("upsert : un seul jeu de clés par lot", all(len({frozenset(x) for x in lot}) == 1 for lot in client.envois))
verifie("upsert : les nouvelles colonnes passent",
        all(k in next(x for x in envoyes if x["change_id"] == r["statut_annonce"]["change_id"])
            for k in ("niveau", "object_id", "object_name", "adset_id", "extra_data", "fuseau")))
verifie("upsert : aucun NULL sur une colonne « si connue »",
        all(x.get(k) is not None for x in envoyes for k in ("niveau", "object_id", "adset_id", "extra_data") if k in x))

print()
for l in lignes:
    print(f'  [{l["categorie"]:<10}] {l["resume"]}')
print()
print("ÉCHECS :", echecs) if echecs else print("Tout passe.")
sys.exit(1 if echecs else 0)
