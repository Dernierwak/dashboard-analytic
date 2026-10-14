"""Harnais du ticket 19 : le début de la distribution d'une annonce.

`extra_data` recopié de la réponse de `/activities` du 26 au 29 août 2026, sur
les deux connexions (lecture seule, 2026-10-14) : seuls les IDs et les noms
sont remplacés, le dépôt est public. Meta écrit `new_value` dans la langue du
jeton — « Début de la distribution » sur une connexion, « Auslieferung
gestartet » sur l'autre — et le `campaign_id` en NOMBRE : c'est l'ID du groupe
de l'annonce, comme sur `create_ad`.

    python3.12 .scratch/journal-meta/harnais/19/verifier.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))

from saas.data.fetch_data.sources.meta.ads.fetchers.activities import (  # noqa: E402
    hierarchie_depuis_insights, lignes_activites,
)

CAMPAGNE, GROUPE, ANNONCE = "100", "200", "300"
parents = hierarchie_depuis_insights([
    {"date_start": "2026-08-27", "campaign_id": CAMPAGNE, "campaign_name": "Campagne A",
     "adset_id": GROUPE, "ad_id": ANNONCE},
])


def reel(libelle: str, groupe=int(GROUPE)) -> str:
    """La chaîne JSON telle que Meta l'envoie, au libellé et aux IDs près."""
    return json.dumps({"campaign_id": groupe, "old_value": None, "new_value": libelle,
                       "type": "delivery_event"}, separators=(",", ":"))


def acte(extra: str, oid: str = ANNONCE, t: str = "2026-08-27T09:00:50+0000") -> dict:
    return {"event_type": "first_delivery_event", "event_time": t,
            "object_id": oid, "object_name": "Annonce C", "extra_data": extra}


echecs: list[str] = []


def verifie(nom: str, ok: bool, detail: str = "") -> None:
    print(("ok   " if ok else "ÉCHEC ") + nom + (f" — {detail}" if detail and not ok else ""))
    if not ok:
        echecs.append(nom)


PHRASE = 'l\'annonce "Annonce C" a commencé à diffuser'

for libelle in ("Début de la distribution", "Auslieferung gestartet"):
    lignes = lignes_activites([acte(reel(libelle))], parents, "Europe/Zurich")
    verifie(f"{libelle} : récolté", len(lignes) == 1, str(lignes))
    if not lignes:
        continue
    [l] = lignes
    verifie(f"{libelle} : catégorie diffusion, niveau annonce",
            l["categorie"] == "diffusion" and l["niveau"] == "annonce", str(l))
    verifie(f"{libelle} : la phrase", l["resume"] == PHRASE, l["resume"])
    verifie(f"{libelle} : extra_data gardé tel quel",
            l["extra_data"] == json.loads(reel(libelle)), str(l.get("extra_data")))
    verifie(f"{libelle} : rangé sous son groupe et sa campagne",
            l.get("adset_id") == GROUPE and l.get("campaign_id") == CAMPAGNE, str(l))

# Une annonce que les insights ne connaissent pas encore (elle vient de
# démarrer) : son groupe se lit dans `extra_data`, la campagne reste vide.
[l] = lignes_activites([acte(reel("Début de la distribution", 210), oid="310")], parents, "Europe/Zurich")
verifie("annonce inconnue des insights : le groupe vient d'extra_data",
        l.get("adset_id") == "210" and "campaign_id" not in l, str(l))

# Le cas courant : l'annonce vient de démarrer, les insights ne la connaissent
# pas encore, mais son groupe y est — la campagne vient du groupe.
[l] = lignes_activites([acte(reel("Début de la distribution"), oid="310")], parents, "Europe/Zurich")
verifie("annonce neuve d'un groupe connu : campagne lue par le groupe",
        l.get("adset_id") == GROUPE and l.get("campaign_id") == CAMPAGNE, str(l))

# La même activité relue ne se double pas ; la même annonce à deux instants
# donne deux lignes — rien n'est fusionné à la récolte.
deux = [acte(reel("Début de la distribution")), acte(reel("Début de la distribution"))]
verifie("la même activité relue ne se double pas",
        len(lignes_activites(deux, parents, "Europe/Zurich")) == 1)
instants = [acte(reel("Début de la distribution")),
            acte(reel("Début de la distribution"), t="2026-08-28T03:13:15+0000")]
verifie("la même annonce à deux instants donne deux lignes",
        len(lignes_activites(instants, parents, "Europe/Zurich")) == 2)

# La revue de Meta reste écartée : seul le début de la distribution entre.
revue = {"event_type": "ad_review_approved", "event_time": "2026-08-27T09:00:50+0000",
         "object_id": ANNONCE, "object_name": "Annonce C", "extra_data": "{}"}
verifie("la revue de Meta n'est toujours pas récoltée",
        lignes_activites([revue], parents, "Europe/Zurich") == [])

print()
print("ÉCHECS :", echecs) if echecs else print("Tout passe.")
sys.exit(1 if echecs else 0)
