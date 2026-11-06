"""`/{ig-user}/insights` et `followers_count` — ce que le compte Instagram dit de lui-même.

Chaque appel rend `(objet, erreur)` tel que `lire` le donne : la lecture des
chiffres vit dans `instagram/releve_compte.py`, l'écriture dans
`source_data/instagram_compte.py`. Ce fichier ne touche jamais Supabase.

UN APPEL PAR CHIFFRE, exprès : un appel multi-métriques est refusé en entier
dès qu'une seule métrique l'est (erreur 100, vu sur les posts —
`.scratch/instagram/issues/17`). Sept appels par compte et par jour, c'est le
prix pour qu'une panne de `follows_and_unfollows` n'emporte pas la portée.

Les formes de réponse viennent de l'essai réel (`.scratch/instagram/essai/
essai_reel.py`, `_total_value`, q3, q6, q8) : `metric_type=total_value` rend
`data[0].total_value.value`, ou `total_value.breakdowns[0].results` avec une
ventilation (et alors pas de `value` pour `follows_and_unfollows`).
"""
from __future__ import annotations

from datetime import date, datetime, timezone

from saas.data.fetch_data.sources.meta.graph_client import GRAPH, AccesMeta, lire

Reponse = tuple[dict | None, str | None]


def _ts(jour: date) -> int:
    """Minuit UTC du jour, en secondes — la borne que l'essai réel a employée
    (`essai_reel._ts`) et qui a rendu les chiffres comparés à l'écran Meta."""
    return int(datetime(jour.year, jour.month, jour.day, tzinfo=timezone.utc).timestamp())


def total(acces: AccesMeta, metrique: str, debut: date, fin_exclue: date,
          ventilation: str | None = None) -> Reponse:
    """`metric_type=total_value` sur `[debut, fin_exclue[`, ventilé ou non.

    Sur une période de plusieurs jours, la portée rendue est DÉDOUBLONNÉE
    (chaque compte compté une fois) : 65 980 sur 30 jours contre 101 990 pour
    la somme des jours (essai réel, `issues/17`).
    """
    params = {"metric": metrique, "period": "day", "metric_type": "total_value",
              "since": _ts(debut), "until": _ts(fin_exclue), "access_token": acces.jeton}
    if ventilation:
        params["breakdown"] = ventilation
    return lire(f"{GRAPH}/{acces.instagram}/insights", params, timeout=30)


def abonnes(acces: AccesMeta) -> Reponse:
    """`followers_count` à l'instant du passage — R5 : `sync.recolter` le lit
    aussi et le jette ; on le relit ici plutôt que de dépendre de lui (un
    champ, un appel)."""
    return lire(f"{GRAPH}/{acces.instagram}",
                {"fields": "followers_count", "access_token": acces.jeton}, timeout=30)
