"""Harnais du ticket 20 : qui a fait le changement, une personne ou Meta.

Forme lue sur `/activities` du 17 avril au 14 octobre 2026, sur les deux
connexions (lecture seule, 2026-10-14) : 988 activités, dont 291 de Meta —
toutes avec `actor_id` « 0 » et `actor_name` « Meta », dans les deux langues
de jeton —, les autres réparties sur 4 `actor_id` de personnes, aucun égal à
« 0 ». Le 18 septembre, 14:05 UTC (16:05 à Zurich) est une personne, 14:09
UTC est Meta, comme dans la colonne « Modifié par » d'Ads Manager. Les IDs
de personnes sont remplacés : le dépôt est public.

    python3.12 .scratch/journal-meta/harnais/20/verifier.py
"""
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))

from saas.data.fetch_data.sources.meta.ads.fetchers import activities  # noqa: E402
from saas.data.fetch_data.sources.meta.ads.fetchers.activities import (  # noqa: E402
    hierarchie_depuis_insights, lignes_activites,
)
from saas.data.fetch_data.sources.meta.graph_client import AccesMeta  # noqa: E402
from saas.data.fetch_data.shared.date_ranges import Fenetre  # noqa: E402

parents = hierarchie_depuis_insights([
    {"date_start": "2026-09-18", "campaign_id": "100", "campaign_name": "Campagne A",
     "adset_id": "200", "ad_id": "300"},
])

echecs: list[str] = []


def verifie(nom: str, ok: bool, detail: str = "") -> None:
    print(("ok   " if ok else "ÉCHEC ") + nom + (f" — {detail}" if detail and not ok else ""))
    if not ok:
        echecs.append(nom)


def statut(t: str, avant: str, apres: str, **acteur) -> dict:
    return {"event_type": "update_ad_run_status", "event_time": t,
            "object_id": "300", "object_name": "Annonce C",
            "extra_data": json.dumps({"old_value": avant, "new_value": apres, "type": "run_status"}),
            **acteur}


# Le 18 septembre : une personne relance l'examen, Meta le termine.
lignes = lignes_activites([
    statut("2026-09-18T14:05:11+0000", "Pending Process", "Pending Review", actor_id="98765"),
    statut("2026-09-18T14:09:19+0000", "Pending Review", "Active", actor_id="0"),
], parents, "Europe/Zurich")
par_heure = {l["occurred_at"][11:16]: l for l in lignes}
verifie("14:05 : une personne", par_heure.get("14:05", {}).get("acteur") == "personne", str(lignes))
verifie("14:09 : Meta", par_heure.get("14:09", {}).get("acteur") == "meta", str(lignes))

# Meta envoie l'ID en chaîne ; un nombre nu se lit pareil.
[l] = lignes_activites([statut("2026-09-18T14:09:19+0000", "Pending Review", "Active", actor_id=0)],
                       parents, "Europe/Zurich")
verifie("actor_id 0 en nombre : Meta", l.get("acteur") == "meta", str(l))

# Aucun ID : on ne sait pas, et on ne l'écrit pas — chaque passage relit
# 180 jours, une clé à None effacerait par upsert ce qu'un passage a écrit.
for absent in ({}, {"actor_id": ""}, {"actor_id": None}):
    [l] = lignes_activites([statut("2026-09-18T14:05:11+0000", "Pending Process", "Pending Review", **absent)],
                           parents, "Europe/Zurich")
    verifie(f"sans actor_id {absent} : rien d'écrit", "acteur" not in l, str(l))

# Le nom n'entre jamais dans la ligne, même si Meta l'envoyait.
[l] = lignes_activites([statut("2026-09-18T14:05:11+0000", "Pending Process", "Pending Review",
                               actor_id="98765", actor_name="Prénom Nom")], parents, "Europe/Zurich")
verifie("le nom d'une personne n'est pas gardé",
        "Prénom Nom" not in json.dumps(l, ensure_ascii=False), str(l))

# L'acteur n'entre pas dans `change_id` : les lignes déjà en base se
# complètent au prochain passage au lieu de se doubler.
sans = lignes_activites([statut("2026-09-18T14:05:11+0000", "Pending Process", "Pending Review")],
                        parents, "Europe/Zurich")
avec = lignes_activites([statut("2026-09-18T14:05:11+0000", "Pending Process", "Pending Review",
                                actor_id="98765")], parents, "Europe/Zurich")
verifie("change_id inchangé par l'acteur", sans[0]["change_id"] == avec[0]["change_id"])

# La requête demande l'ID et jamais le nom : le nom d'un tiers ne quitte pas Meta.
demandes: list[dict] = []
vrai_pages = activities.pages
activities.pages = lambda url, params, **kw: (demandes.append(params), ([], None))[1]
try:
    activities.recuperer(AccesMeta("jeton", "act_1"), Fenetre(date(2026, 9, 1), date(2026, 9, 30)))
finally:
    activities.pages = vrai_pages
champs = demandes[0]["fields"].split(",") if demandes else []
verifie("la requête demande actor_id", "actor_id" in champs, str(champs))
verifie("la requête ne demande pas actor_name", "actor_name" not in champs, str(champs))

print()
print("ÉCHECS :", echecs) if echecs else print("Tout passe.")
sys.exit(1 if echecs else 0)
