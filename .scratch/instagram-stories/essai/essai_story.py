"""L'essai réel d'une story Instagram — six questions que la doc ne tranche pas.

    python3.12 .scratch/instagram-stories/essai/essai_story.py --lister
    python3.12 .scratch/instagram-stories/essai/essai_story.py --user UID
    python3.12 .scratch/instagram-stories/essai/essai_story.py --retelecharger

POURQUOI IL EXISTE : le circuit des stories (`.scratch/instagram-stories/map.md`)
repose sur ce que notre jeton obtient d'une story en ligne — ticket
`.scratch/instagram-stories/issues/02-l-essai-reel-d-une-story.md`. Script
jetable, lancé par David via `essai_story.sh`, jamais par le workflow : le dépôt
est public.

CE QU'IL N'ÉCRIT PAS : rien en base, et le jeton nulle part. Il reprend la
mécanique de l'essai des posts (`Essai.appel` : erreurs passées par
`sans_jeton`, curseurs `paging` jamais gardés). Les images ne sont pas gardées :
on mesure leur téléchargement, on ne les stocke pas.

CE QU'IL ÉCRIT : le résumé à l'écran, et les réponses brutes dans `.essais/`
(ignoré par git : données client). `--retelecharger` relit le dernier de ces
fichiers et retente les `media_url`, pour mesurer quand ils expirent.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlparse

RACINE = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(RACINE))
# La mécanique d'appel sans jeton vit déjà dans l'essai des posts : la recopier
# ferait deux versions de la même garde à tenir.
sys.path.insert(0, str(RACINE / ".scratch" / "instagram" / "essai"))

from essai_reel import Essai, _err, _total_value, _ts  # noqa: E402
from saas.data.fetch_data.orchestration.concurrent_runner import client_service  # noqa: E402
from saas.data.fetch_data.shared import http_client as http  # noqa: E402
from saas.data.fetch_data.shared.http_client import sans_jeton  # noqa: E402
from saas.data.fetch_data.sources.meta.graph_client import GRAPH  # noqa: E402

DOSSIER = RACINE / ".essais"
_PREFIXE = "essai-story-"

# Cinq stories suffisent pour voir la forme des réponses : chacune coûte un
# appel par métrique (une erreur sur une métrique ferait échouer les autres si
# on les demandait ensemble).
_STORIES_MAX = 5

# (nom affiché, paramètres) — la liste de la doc pour une STORY, recherche du
# 2026-11-01. Les métriques ventilées exigent `metric_type=total_value`.
_METRIQUES = [
    ("reach", {"metric": "reach"}),
    ("views", {"metric": "views"}),
    ("shares", {"metric": "shares"}),
    ("reposts", {"metric": "reposts"}),
    ("total_interactions", {"metric": "total_interactions"}),
    ("follows", {"metric": "follows"}),
    ("profile_visits", {"metric": "profile_visits"}),
    ("profile_activity", {"metric": "profile_activity", "metric_type": "total_value",
                          "breakdown": "action_type"}),
    ("link_clicks", {"metric": "link_clicks"}),
    ("navigation", {"metric": "navigation"}),
    ("navigation ventilée", {"metric": "navigation", "metric_type": "total_value",
                             "breakdown": "story_navigation_action_type"}),
    ("replies", {"metric": "replies"}),
]


def _valeur(data: dict | None) -> tuple[str, object]:
    """('valeur' | 'vide', valeur lisible) d'une réponse d'insights de média."""
    d = (data or {}).get("data") or []
    if not d:
        return "vide", None
    total, ventil = _total_value(data)
    if ventil:
        return "valeur", {str(dims): v for dims, v in ventil}
    if total is not None:
        return "valeur", total
    valeurs = d[0].get("values") or []
    return ("valeur", valeurs[0].get("value")) if valeurs else ("vide", None)


def _age(ts: str) -> str:
    try:
        quand = datetime.strptime(ts, "%Y-%m-%dT%H:%M:%S%z")
    except (TypeError, ValueError):
        return "?"
    heures = (datetime.now(timezone.utc) - quand).total_seconds() / 3600
    return f"{heures:.1f} h"


def _expiration_cdn(url: str) -> str:
    """Le paramètre `oe` des URL du CDN Meta, lu comme un horodatage hexadécimal.

    Déduction, pas documentation : aucune page Meta ne décrit `oe`. Le
    `--retelecharger` dit la vérité ; ceci ne fait que la prédire.
    """
    oe = (parse_qs(urlparse(url).query).get("oe") or [""])[0]
    try:
        return datetime.fromtimestamp(int(oe, 16), timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    except ValueError:
        return "pas de paramètre oe"


def _telecharger(url: str) -> str:
    """Statut d'un GET sans jeton sur un `media_url` — l'image n'est pas gardée."""
    try:
        r = http.get(url, timeout=30)
    except Exception as e:
        return f"échec ({sans_jeton(type(e).__name__)})"
    taille = len(r.content or b"")
    return f"HTTP {r.status_code}, {r.headers.get('Content-Type', '?')}, {taille // 1024} Ko"


# ── Les questions ────────────────────────────────────────────────────────


def q1_stories(E: Essai) -> tuple[str, list[dict]]:
    champs = "id,media_type,media_product_type,media_url,thumbnail_url,timestamp,permalink"
    data, err = E.appel("stories", f"{E.ig}/stories", {"fields": champs})
    if err:
        return f"/stories REFUSÉ → {_err(err)}", []
    stories = list(data.get("data") or [])
    if not stories:
        return "/stories répond, mais aucune story en ligne : relancer avec une story publiée", []
    rendus = Counter(k for s in stories for k in s)
    manquants = [c for c in champs.split(",") if c not in rendus]
    return (f"OK : {len(stories)} story(s) en ligne ; champs rendus "
            f"{', '.join(f'{k} ({n})' for k, n in rendus.items())} ; jamais rendus : "
            f"{', '.join(manquants) or 'aucun'}"), stories


def q2_metriques(E: Essai, stories: list[dict]) -> tuple[list[str], dict]:
    """Une ligne par métrique : combien de valeurs, de vides, d'erreurs (et lesquelles)."""
    par_story: dict = {}
    lignes = []
    for nom, params in _METRIQUES:
        bilan, exemples = Counter(), []
        for s in stories:
            data, err = E.appel(f"{nom}_{s['id']}", f"{s['id']}/insights", params)
            if err:
                bilan[f"erreur {err.get('code')}"] += 1
                exemples.append(f"erreur {err.get('code')}: {err.get('message', '')[:90]}")
                par_story.setdefault(s["id"], {})[nom] = f"erreur {err.get('code')}"
                continue
            etat, v = _valeur(data)
            bilan[etat] += 1
            par_story.setdefault(s["id"], {})[nom] = v if etat == "valeur" else "vide"
            if etat == "valeur":
                exemples.append(json.dumps(v, ensure_ascii=False)[:120])
        exemple = f" ; ex. {exemples[0]}" if exemples else ""
        lignes.append(f"{nom} : " + ", ".join(f"{k} {n}" for k, n in bilan.items()) + exemple)
    return lignes, par_story


def q3_par_story(stories: list[dict], par_story: dict) -> str:
    """Une story avec lien et une sans : David dit laquelle avait un lien."""
    morceaux = []
    for s in stories:
        m = par_story.get(s["id"], {})
        morceaux.append(f"[{s.get('timestamp', '?')[11:16]} UTC, {s.get('media_type')}, "
                        f"âge {_age(s.get('timestamp'))}] link_clicks = {m.get('link_clicks')!r}, "
                        f"reach = {m.get('reach')!r}")
    return " ; ".join(morceaux) + " — dire laquelle portait un lien"


def q4_images(stories: list[dict]) -> str:
    out = []
    for s in stories:
        for champ in ("media_url", "thumbnail_url"):
            url = s.get(champ)
            if url:
                out.append(f"{s.get('timestamp', '?')[11:16]} {champ} : {_telecharger(url)}, "
                           f"oe → {_expiration_cdn(url)} (déduction)")
    return " ; ".join(out) or "aucune URL d'image rendue"


def q5_portee_story_du_compte(E: Essai) -> str:
    """La portée `STORY` du compte, jour par jour sur 7 jours, hier compris."""
    out = []
    hier = date.today() - timedelta(days=1)
    for i in range(7):
        jour = hier - timedelta(days=i)
        data, err = E.appel(f"reach_compte_par_produit_{jour}", f"{E.ig}/insights",
                            {"metric": "reach", "period": "day", "metric_type": "total_value",
                             "breakdown": "media_product_type",
                             "since": _ts(jour), "until": _ts(jour + timedelta(days=1))})
        if err:
            out.append(f"{jour} : {_err(err)}")
            continue
        _, ventil = _total_value(data)
        story = next((v for d, v in ventil if "STORY" in (d or [])), None)
        out.append(f"{jour} : STORY = {story if story is not None else 'absent'}")
    return " ; ".join(out)


def q6_peu_de_spectateurs(par_story: dict) -> str:
    # Code 10 = « Not enough viewers » selon la doc ; les autres erreurs sont
    # déjà comptées métrique par métrique à la question 2.
    stories_10 = sum(1 for m in par_story.values() if "erreur 10" in m.values())
    if not stories_10:
        return "aucune erreur 10 sur les stories lues (aucune sous 5 spectateurs, ou autre forme)"
    return f"erreur 10 sur {stories_10} story(s) sur {len(par_story)}"


# ── Le déroulé ───────────────────────────────────────────────────────────


def retelecharger() -> None:
    fichiers = sorted(DOSSIER.glob(f"{_PREFIXE}*.json"))
    if not fichiers:
        raise SystemExit("Aucun essai de story dans .essais/ : lancer l'essai d'abord.")
    brut = json.loads(fichiers[-1].read_text())["brut"].get("stories", {})
    stories = (brut.get("reponse") or {}).get("data") or []
    print(f"Relecture des images de {fichiers[-1].name}, à {datetime.now():%Y-%m-%d %H:%M} :")
    for s in stories:
        for champ in ("media_url", "thumbnail_url"):
            if s.get(champ):
                print(f"  story de {s.get('timestamp', '?')[:16]} {champ} : "
                      f"{_telecharger(s[champ])}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lister", action="store_true")
    ap.add_argument("--user")
    ap.add_argument("--retelecharger", action="store_true")
    args = ap.parse_args()

    if args.retelecharger:
        retelecharger()
        return

    sb = client_service()
    lignes = sb.table("connected_accounts").select(
        "user_id, instagram_business_id, meta_token"
    ).not_.is_("instagram_business_id", "null").execute().data or []

    if args.lister or not args.user:
        print("Comptes avec un Instagram branché :")
        for c in lignes:
            print(f"  {c['user_id']}  instagram {c['instagram_business_id']}  "
                  f"jeton présent : {'oui' if c.get('meta_token') else 'NON'}")
        return

    c = next((c for c in lignes if c["user_id"] == args.user), None)
    if not c or not c.get("meta_token"):
        raise SystemExit("Aucun Instagram branché avec un jeton pour ce user_id "
                         "(connected_accounts.meta_token vide).")
    E = Essai(c["meta_token"], c["instagram_business_id"])

    r1, stories = q1_stories(E)
    lues = stories[:_STORIES_MAX]
    lignes_metriques, par_story = q2_metriques(E, lues) if lues else ([], {})
    reponses = {
        "1 · /stories": r1,
        **{f"2 · {ligne.split(' : ')[0]}": ligne.split(" : ", 1)[1] for ligne in lignes_metriques},
        "3 · link_clicks story par story": q3_par_story(lues, par_story) if lues else "sans story",
        "4 · images": q4_images(lues) if lues else "sans story",
        "5 · portée STORY du compte": q5_portee_story_du_compte(E),
        "6 · moins de 5 spectateurs": q6_peu_de_spectateurs(par_story) if lues else "sans story",
    }

    # `sans_jeton` ne masque le jeton que dans une URL (`access_token=…`). Ce
    # résumé est fait pour être collé dans une conversation : la valeur exacte
    # est retirée en plus, où qu'elle apparaisse (essai hors ligne du
    # 2026-11-25 : un jeton nu dans un message d'erreur passait).
    def masque(texte: str) -> str:
        return texte.replace(c["meta_token"], "…")

    print("\n──── RÉSUMÉ À COLLER (aucun jeton dedans) ────")
    print(f"essai du {datetime.now():%Y-%m-%d %H:%M}, {len(stories)} story(s) en ligne, "
          f"{len(lues)} lue(s), Graph {GRAPH.rsplit('/', 1)[-1]}")
    for q, rep in reponses.items():
        print(masque(f"{q} : {rep}"))
    print("──────────────────────────────────────────────")

    DOSSIER.mkdir(exist_ok=True)
    fichier = DOSSIER / f"{_PREFIXE}{datetime.now():%Y%m%d-%H%M}.json"
    fichier.write_text(masque(json.dumps(
        {"reponses": reponses, "par_story": par_story, "brut": E.brut},
        ensure_ascii=False, indent=1, default=str)))
    print(f"\nDétail brut : {fichier.relative_to(RACINE)} (ignoré par git)")
    print("Dans quelques heures, relancer avec --retelecharger pour voir si les images "
          "se téléchargent encore.")


if __name__ == "__main__":
    main()
