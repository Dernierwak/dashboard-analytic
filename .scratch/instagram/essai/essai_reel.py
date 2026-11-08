"""L'essai réel des métriques Instagram — dix questions que la doc ne tranche pas.

    python3.12 .scratch/instagram/essai/essai_reel.py --lister
    python3.12 .scratch/instagram/essai/essai_reel.py --user UID [--boost-arrete PERMALINK]

POURQUOI IL EXISTE : les recherches 02, 03 et 04 de la carte Instagram
s'arrêtent au même endroit — ce que seul un appel avec NOTRE jeton tranche
(`.scratch/instagram/issues/17-l-essai-reel-des-metriques.md`). Un script
jetable, lancé par David via `essai_reel.sh`, jamais par le workflow : le dépôt
est public.

CE QU'IL N'ÉCRIT PAS : rien en base (une seule lecture de `connected_accounts`),
et le jeton nulle part — ni à l'écran, ni dans le JSON. Les messages d'erreur
passent par `sans_jeton`, et les curseurs `paging` (qui portent le jeton) ne
sont jamais gardés.

CE QU'IL ÉCRIT : le résumé à l'écran, à recoller dans la conversation, et les
réponses brutes dans `.essais/` (ignoré par git : données client).

Les fenêtres s'arrêtent HIER (`CLAUDE.md` §7). Elles sont calées sur minuit
UTC, pas sur le fuseau du compte : l'essai juge la FORME des réponses, pas des
totaux à publier.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

RACINE = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(RACINE))

from saas.data.fetch_data.orchestration.concurrent_runner import client_service  # noqa: E402
from saas.data.fetch_data.shared import http_client as http  # noqa: E402
from saas.data.fetch_data.shared.http_client import sans_jeton  # noqa: E402
from saas.data.fetch_data.sources.meta.graph_client import GRAPH  # noqa: E402

# 200 posts : assez pour croiser des Reels, des vidéos du fil et des boosts
# anciens, en 4 pages de 50 (le maximum que `/media` rend par page).
_POSTS_MAX = 200
_PAR_PAGE = 50
# `follows` est relu sur 15 posts du fil au plus : un appel chacun, et 15
# suffisent à voir si un post sans abonné gagné rend 0 ou rien.
_FOLLOWS_ECHANTILLON = 15


class Essai:
    def __init__(self, jeton: str, ig: str) -> None:
        self._jeton, self.ig = jeton, ig
        self.brut: dict = {}
        # Le curseur `after` de chaque réponse paginée : on relit la page
        # suivante avec lui, jamais avec `paging.next`, qui porte le jeton.
        self.curseurs: dict[str, str] = {}

    def appel(self, nom: str, chemin: str, params: dict) -> tuple[dict | None, dict | None]:
        """Un GET Graph → (réponse, erreur {code, message}). Gardé dans `brut` sans jeton."""
        try:
            r = http.get(f"{GRAPH}/{chemin}",
                         params={**params, "access_token": self._jeton}, timeout=30)
            data = r.json()
        except Exception as e:
            err = {"code": None, "message": sans_jeton(f"{type(e).__name__}: {e}")}
            self.brut[nom] = {"params": params, "erreur": err}
            return None, err
        if isinstance(data, dict) and data.get("error"):
            e = data["error"] if isinstance(data["error"], dict) else {}
            err = {"code": e.get("code"), "sous_code": e.get("error_subcode"),
                   "message": sans_jeton(str(e.get("message") or "erreur Meta"))}
            self.brut[nom] = {"params": params, "erreur": err}
            return None, err
        if isinstance(data, dict):
            paging = data.pop("paging", None) or {}
            if paging.get("next") and (paging.get("cursors") or {}).get("after"):
                self.curseurs[nom] = paging["cursors"]["after"]
        self.brut[nom] = {"params": params, "reponse": data}
        return data, None


def _ts(jour: date) -> int:
    return int(datetime(jour.year, jour.month, jour.day, tzinfo=timezone.utc).timestamp())


def _fenetre(jours: int) -> dict:
    """`since`/`until` sur les `jours` derniers jours, aujourd'hui exclu."""
    aujourdhui = date.today()
    return {"since": _ts(aujourdhui - timedelta(days=jours)), "until": _ts(aujourdhui)}


def _err(e: dict | None) -> str:
    return f"ERREUR {e.get('code')}: {e.get('message')}" if e else ""


def _total_value(data: dict | None) -> tuple[float | None, list]:
    """(valeur, ventilation [(dimensions, valeur)]) d'une réponse `metric_type=total_value`."""
    if not data or not data.get("data"):
        return None, []
    tv = data["data"][0].get("total_value") or {}
    ventil = []
    for b in tv.get("breakdowns") or []:
        for res in b.get("results") or []:
            ventil.append((res.get("dimension_values"), res.get("value")))
    return tv.get("value"), ventil


# ── Les questions ────────────────────────────────────────────────────────


def q1_scopes(E: Essai, compte_ok: bool, media_ok: bool) -> str:
    data, err = E.appel("permissions", "me/permissions", {})
    if err:
        return f"permissions illisibles ({_err(err)})"
    accordees = sorted(p["permission"] for p in data.get("data", [])
                       if p.get("status") == "granted")
    pre = "pages_read_engagement" in accordees
    return (f"insights du compte : {'OK' if compte_ok else 'REFUSÉ'} ; "
            f"insights d'un post : {'OK' if media_ok else 'REFUSÉ'} ; "
            f"pages_read_engagement accordé : {'oui' if pre else 'non'} ; "
            f"permissions accordées : {', '.join(accordees)}")


def q2_follower_count(E: Essai) -> str:
    out = []
    for jours in (30, 90):
        data, err = E.appel(f"follower_count_{jours}j", f"{E.ig}/insights",
                            {"metric": "follower_count", "period": "day", **_fenetre(jours)})
        if err:
            out.append(f"{jours} j demandés → {_err(err)}")
            continue
        valeurs = (data.get("data") or [{}])[0].get("values") or []
        if valeurs:
            out.append(f"{jours} j demandés → {len(valeurs)} valeur(s), du "
                       f"{valeurs[0].get('end_time', '?')[:10]} au "
                       f"{valeurs[-1].get('end_time', '?')[:10]}")
        else:
            out.append(f"{jours} j demandés → jeu vide")
    return " ; ".join(out)


def q3_follows_and_unfollows(E: Essai) -> str:
    data, err = E.appel("follows_and_unfollows_7j", f"{E.ig}/insights",
                        {"metric": "follows_and_unfollows", "period": "day",
                         "metric_type": "total_value", "breakdown": "follow_type",
                         **_fenetre(7)})
    if err:
        return _err(err)
    total, ventil = _total_value(data)
    lignes = ", ".join(f"{d} = {v}" for d, v in ventil) or "aucune ventilation rendue"
    return f"7 j : total {total} ; ventilation {lignes}"


def q4_follows_reel(E: Essai, posts: list[dict]) -> str:
    reel = next((p for p in posts if p.get("media_product_type") == "REELS"), None)
    if not reel:
        return "aucun Reel dans les posts lus"
    data, err = E.appel("follows_sur_un_reel", f"{reel['id']}/insights", {"metric": "follows"})
    if err:
        return f"Reel du {reel.get('timestamp', '?')[:10]} → {_err(err)}"
    return (f"Reel du {reel.get('timestamp', '?')[:10]} → "
            f"{'jeu vide' if not data.get('data') else json.dumps(data['data'])[:300]}")


def q5_lifetime(E: Essai, posts: list[dict]) -> tuple[str, bool]:
    vieux = date.today() - timedelta(days=7)
    post = next((p for p in posts if p.get("media_product_type") == "FEED"
                 and p.get("media_type") in ("IMAGE", "CAROUSEL_ALBUM")
                 and p.get("timestamp", "9999")[:10] < vieux.isoformat()), None)
    if not post:
        return "aucun post du fil de plus de 7 jours", False
    out, un_ok = [], False
    for nom, params in (("sans period", {}), ("lifetime", {"period": "lifetime"}),
                        ("day", {"period": "day"})):
        data, err = E.appel(f"reach_post_{nom.replace(' ', '_')}", f"{post['id']}/insights",
                            {"metric": "reach", **params})
        if err:
            out.append(f"{nom} → {_err(err)}")
            continue
        un_ok = True
        d = (data.get("data") or [{}])[0]
        valeurs = [v.get("value") for v in d.get("values") or []]
        out.append(f"{nom} → period rendu {d.get('period')!r}, valeur(s) {valeurs}")
    return f"post du {post.get('timestamp', '?')[:10]} : " + " ; ".join(out), un_ok


def q6_reach_compte(E: Essai) -> tuple[str, bool]:
    tv, err1 = E.appel("reach_compte_total_7j", f"{E.ig}/insights",
                       {"metric": "reach", "period": "day", "metric_type": "total_value",
                        **_fenetre(7)})
    ts, err2 = E.appel("reach_compte_serie_7j", f"{E.ig}/insights",
                       {"metric": "reach", "period": "day", **_fenetre(7)})
    if err1 or err2:
        return f"total_value : {_err(err1) or 'OK'} ; time_series : {_err(err2) or 'OK'}", \
            not (err1 and err2)
    total, _ = _total_value(tv)
    valeurs = [v.get("value") for v in (ts.get("data") or [{}])[0].get("values") or []]
    somme = sum(v for v in valeurs if isinstance(v, (int, float)))
    verdict = ("égaux : NON dédoublonné" if total == somme else
               "total plus petit : dédoublonné" if total is not None and total < somme else
               "à lire")
    return (f"total_value 7 j = {total} ; somme des {len(valeurs)} jours = {somme} → {verdict}",
            True)


def q7_formats(E: Essai, posts: list[dict]) -> str:
    combos = Counter((p.get("media_type"), p.get("media_product_type")) for p in posts)
    liste = ", ".join(f"{t}/{pt} : {n}" for (t, pt), n in combos.most_common())
    fil = [p for p in posts if p.get("media_product_type") == "FEED"][:_FOLLOWS_ECHANTILLON]
    bilan = Counter()
    for p in fil:
        data, err = E.appel(f"follows_fil_{p['id']}", f"{p['id']}/insights", {"metric": "follows"})
        if err:
            bilan["erreur"] += 1
            continue
        d = data.get("data") or []
        if not d:
            bilan["jeu vide"] += 1
            continue
        v = d[0].get("value")
        if v is None:
            v = (d[0].get("values") or [{}])[0].get("value")
        bilan["0" if v == 0 else "absent dans l'objet" if v is None else "> 0"] += 1
    return (f"formats ({len(posts)} posts) : {liste} ; follows sur {len(fil)} posts du fil : "
            + ", ".join(f"{k} : {n}" for k, n in bilan.items()))


def q8_part_boostee(E: Essai) -> str:
    out = []
    for metrique in ("reach", "total_interactions"):
        seul, err1 = E.appel(f"{metrique}_compte_total_7j_seul", f"{E.ig}/insights",
                             {"metric": metrique, "period": "day",
                              "metric_type": "total_value", **_fenetre(7)})
        ventile, err2 = E.appel(f"{metrique}_compte_par_produit_7j", f"{E.ig}/insights",
                                {"metric": metrique, "period": "day",
                                 "metric_type": "total_value",
                                 "breakdown": "media_product_type", **_fenetre(7)})
        if err1 or err2:
            out.append(f"{metrique} : {_err(err1) or _err(err2)}")
            continue
        total, _ = _total_value(seul)
        _, ventil = _total_value(ventile)
        somme = sum(v for _, v in ventil if isinstance(v, (int, float)))
        ad = any("AD" in (d or []) for d, _ in ventil)
        out.append(f"{metrique} : total {total}, ventilation "
                   f"{', '.join(f'{d} = {v}' for d, v in ventil) or 'vide'} "
                   f"(somme {somme}, AD présent : {'oui' if ad else 'non'})")
    return " ; ".join(out)


def q9_q10_boost(posts: list[dict], err_boost: dict | None,
                 permalink: str | None) -> tuple[str, str]:
    if err_boost:
        refus = f"champ refusé → {_err(err_boost)}"
        return refus, "sans objet (boost_ads_list refusé)"
    boostes = [p for p in posts if (p.get("boost_ads_list") or {}).get("data")]
    entrees = [e for p in boostes for e in p["boost_ads_list"]["data"]]
    cles = sorted({k for e in entrees for k in e})
    statuts = Counter(str(v) for e in entrees for k, v in e.items() if "status" in k.lower())
    q9 = (f"OK : {len(boostes)} post(s) sur {len(posts)} avec au moins une annonce ; "
          f"champs d'une entrée : {', '.join(cles) or '—'} ; statuts vus : "
          + (", ".join(f"{s} : {n}" for s, n in statuts.items()) or "aucun"))
    inactifs = sum(n for s, n in statuts.items() if s.upper() != "ACTIVE")
    q10 = (f"oui : {inactifs} annonce(s) non actives encore listées" if inactifs else
           "aucune annonce non active vue dans les posts lus")
    if permalink:
        cible = next((p for p in posts if (p.get("permalink") or "").rstrip("/")
                      == permalink.strip().rstrip("/")), None)
        if not cible:
            q10 += f" ; le post donné n'est pas parmi les {len(posts)} derniers"
        else:
            liste = (cible.get("boost_ads_list") or {}).get("data") or []
            q10 += (f" ; post boosté puis arrêté donné → {len(liste)} annonce(s) listée(s)"
                    + (f", statuts {[e.get('ad_status', e) for e in liste]}" if liste else
                       " : les annonces terminées NE SONT PAS listées"))
    return q9, q10


# ── Le déroulé ───────────────────────────────────────────────────────────


def lire_posts(E: Essai) -> tuple[list[dict], dict | None]:
    """Les derniers posts, `boost_ads_list` compris si notre jeton l'obtient."""
    champs = "id,media_type,media_product_type,timestamp,permalink"
    nom = "posts_page_1"
    data, err_boost = E.appel(nom, f"{E.ig}/media",
                              {"fields": champs + ",boost_ads_list", "limit": _PAR_PAGE})
    if err_boost:
        # Un champ refusé fait échouer toute la requête : on relit sans lui,
        # pour que les neuf autres questions aient leurs posts.
        nom = "posts_page_1_sans_boost"
        data, err = E.appel(nom, f"{E.ig}/media", {"fields": champs, "limit": _PAR_PAGE})
        if err:
            raise SystemExit(f"Les posts ne se lisent pas : {_err(err)}")
    else:
        champs += ",boost_ads_list"
    posts = list(data.get("data") or [])
    page = 1
    while len(posts) < _POSTS_MAX and E.curseurs.get(nom):
        apres = E.curseurs[nom]
        page += 1
        nom = f"posts_page_{page}"
        data, err = E.appel(nom, f"{E.ig}/media",
                            {"fields": champs, "limit": _PAR_PAGE, "after": apres})
        if err or not data.get("data"):
            break
        posts += data["data"]
    return posts[:_POSTS_MAX], err_boost


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lister", action="store_true")
    ap.add_argument("--user")
    ap.add_argument("--boost-arrete", default="")
    args = ap.parse_args()

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

    posts, err_boost = lire_posts(E)
    r6, compte_ok = q6_reach_compte(E)
    r5, media_ok = q5_lifetime(E, posts)
    r9, r10 = q9_q10_boost(posts, err_boost, args.boost_arrete or None)
    reponses = {
        "1 · scopes": q1_scopes(E, compte_ok, media_ok),
        "2 · follower_count": q2_follower_count(E),
        "3 · follows_and_unfollows": q3_follows_and_unfollows(E),
        "4 · follows sur un Reel": q4_follows_reel(E, posts),
        "5 · lifetime": r5,
        "6 · reach du compte": r6,
        "7 · formats et follows du fil": q7_formats(E, posts),
        "8 · part boostée du compte": q8_part_boostee(E),
        "9 · boost_ads_list": r9,
        "10 · annonce terminée": r10,
    }

    print("\n──── RÉSUMÉ À COLLER (aucun jeton dedans) ────")
    print(f"essai du {date.today().isoformat()}, {len(posts)} posts lus, Graph {GRAPH[-5:]}")
    for q, rep in reponses.items():
        print(f"{q} : {rep}")
    print("──────────────────────────────────────────────")

    dossier = RACINE / ".essais"
    dossier.mkdir(exist_ok=True)
    fichier = dossier / f"essai-instagram-{datetime.now():%Y%m%d-%H%M}.json"
    fichier.write_text(json.dumps({"reponses": reponses, "brut": E.brut},
                                  ensure_ascii=False, indent=1, default=str))
    print(f"\nDétail brut : {fichier.relative_to(RACINE)} (ignoré par git)")


if __name__ == "__main__":
    main()
