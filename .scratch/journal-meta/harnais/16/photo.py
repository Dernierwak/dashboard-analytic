"""Harnais du ticket 16 : ce que le passage du worker a fait aux lignes Meta.

Lecture seule. La photo contient des données client : elle s'écrit HORS du
dépôt (public), dans le chemin donné.

Les credentials passent par `saas/config/secrets.py`, seul lecteur
autorisé : `SUPABASE_URL` et `SUPABASE_SECRET_KEY` dans l'environnement, ou
dans le `.env` à la racine du dépôt.

    python3.12 -I photo.py prendre  <photo.json>
    python3.12 -I photo.py comparer <avant.json> <apres.json>
"""
from __future__ import annotations

import json
import sys
import urllib.request
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))

from saas.config.secrets import secret  # noqa: E402

COLONNES = ("user_id,channel,change_id,occurred_at,categorie,campaign_id,resume,"
            "niveau,object_id,object_name,adset_id,extra_data,fuseau")
# PostgREST tronque en silence à 1 000 lignes : on pagine par tranches.
TRANCHE = 1000
DETAILS = ("niveau", "object_id", "object_name", "adset_id", "extra_data", "fuseau", "campaign_id")


def _requis(chemin: str) -> str:
    """Le secret, ou un arrêt qui nomme la variable — jamais sa valeur."""
    valeur = secret(chemin)
    if not valeur:
        sys.exit(f"{chemin.replace('.', '_').upper()} manquant "
                 "(environnement ou .env à la racine du dépôt)")
    return valeur


def prendre(sortie: str) -> None:
    base = _requis("supabase.url")
    # La clé secrète du nouveau format ; l'ancienne clé JWT service_role répond 401.
    cle = _requis("supabase.secret_key")
    lignes, debut = [], 0
    while True:
        url = (f"{base}/rest/v1/platform_changes?select={COLONNES}"
               f"&channel=eq.meta&order=change_id")
        req = urllib.request.Request(url, headers={
            "apikey": cle,
            "Range": f"{debut}-{debut + TRANCHE - 1}"})
        with urllib.request.urlopen(req) as r:
            page = json.load(r)
        lignes += page
        if len(page) < TRANCHE:
            break
        debut += TRANCHE
    json.dump({"prise_le": datetime.now(timezone.utc).isoformat(), "lignes": lignes},
              open(sortie, "w", encoding="utf-8"))
    print(f"{len(lignes)} lignes Meta photographiées")
    resumer(lignes)


def _recentes(lignes: list[dict], jours: int = 180) -> list[dict]:
    seuil = (datetime.now(timezone.utc) - timedelta(days=jours)).isoformat()
    return [l for l in lignes if (l.get("occurred_at") or "") >= seuil]


def resumer(lignes: list[dict]) -> None:
    recentes = _recentes(lignes)
    print(f"  dont {len(recentes)} des 180 derniers jours")
    print("  sans resume :", sum(1 for l in lignes if not l.get("resume")))
    print("  180 j avec niveau :", sum(1 for l in recentes if l.get("niveau")))
    print("  180 j avec extra_data :", sum(1 for l in recentes if l.get("extra_data")))
    print("  niveaux (180 j) :", dict(Counter(l.get("niveau") for l in recentes)))
    annonces = [l for l in recentes if l.get("niveau") == "annonce"]
    print("  annonces sans adset_id :", sum(1 for l in annonces if not l.get("adset_id")))
    pauses = [l for l in annonces if "pause" in (l.get("resume") or "").lower()]
    print(f"  annonces mises en pause : {len(pauses)}, dont sans adset_id :",
          sum(1 for l in pauses if not l.get("adset_id")))


def comparer(avant_json: str, apres_json: str) -> None:
    # La clé d'unicité de la table : deux comptes peuvent porter le même change_id.
    avant = {(l["user_id"], l["change_id"]): l for l in json.load(open(avant_json))["lignes"]}
    apres = {(l["user_id"], l["change_id"]): l for l in json.load(open(apres_json))["lignes"]}
    disparues = set(avant) - set(apres)
    print("lignes disparues :", len(disparues))
    print("lignes nouvelles :", len(set(apres) - set(avant)))
    perdus, exemples = Counter(), []
    resume_change = 0
    for cle, l in avant.items():
        if cle not in apres:
            continue
        for col in DETAILS:
            if l.get(col) is not None and apres[cle].get(col) is None:
                perdus[col] += 1
                exemples.append((col, (l.get("occurred_at") or "")[:10]))
        if l.get("resume") != apres[cle].get("resume"):
            resume_change += 1
    print("détails perdus (valeur avant, NULL après) :", dict(perdus) or "aucun")
    print("  exemples (colonne, date) :", exemples[:10])
    print("resume réécrit :", resume_change)
    print("── après ──")
    resumer(list(apres.values()))


if __name__ == "__main__":
    {"prendre": prendre, "comparer": comparer}[sys.argv[1]](*sys.argv[2:])
