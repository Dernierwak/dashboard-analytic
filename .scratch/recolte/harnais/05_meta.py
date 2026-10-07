"""Ticket 05 — Meta : un fichier par API, l'écriture à part. Hors ligne.

    python3.12 .scratch/recolte/harnais/05_meta.py

Trois choses : la pagination unique (`meta/graph.py`), la `limite` de chaque
fichier d'API, et une récolte Meta Ads + Instagram de bout en bout contre un
faux Graph et une fausse base — pour voir que les mêmes tables reçoivent les
mêmes lignes qu'avant le déménagement.
"""
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from faux import FausseBase, brancher_http  # noqa: E402

from saas.collecte.meta import graph  # noqa: E402
from saas.collecte.meta.ads import (  # noqa: E402
    activites, budgets, campagnes, comptes, creas, images, insights,
)
from saas.collecte.meta.ads import recolte as recolte_meta  # noqa: E402
from saas.collecte.meta.graph import AccesMeta  # noqa: E402
from saas.collecte.meta.organique.instagram import compte, metriques, posts  # noqa: E402
from saas.collecte.meta.organique.instagram import recolte as recolte_ig  # noqa: E402
from saas.collecte.socle.fenetre import Fenetre  # noqa: E402

G = "/v24.0"


# ── graph.pages ───────────────────────────────────────────────────────────
def pages_de(*corps):
    """Chaque corps est une page ; la page i porte un `next` vers la page i+1."""
    def route(_m, chemin, p, _j):
        i = int(p.get("page", 0))
        c = dict(corps[i])
        if i + 1 < len(corps) and "paging" not in c:
            c["paging"] = {"next": f"https://graph.facebook.com{G}/x?page={i + 1}&access_token=T"}
        return 200, c
    return route


brancher_http(pages_de({"data": [1, 2]}, {"data": [3]}, {"data": [4]}))
assert graph.pages("https://graph.facebook.com/v24.0/x", {}, timeout=5) == ([1, 2, 3, 4], None)
brancher_http(pages_de({"data": [1, 2]}, {"data": []}, {"data": [9]}))        # page vide : arrêt
assert graph.pages("https://graph.facebook.com/v24.0/x", {}, timeout=5) == ([1, 2], None)
brancher_http(pages_de({"data": [1]}, {"data": [2]}, {"data": [3]}))
l, e = graph.pages("https://graph.facebook.com/v24.0/x", {}, timeout=5, pages_max=2)
assert l == [1, 2] and "2 pages suivies sans fin" in e, (l, e)
brancher_http(pages_de({"data": [1]}, {"error": {"message": "limite"}}))
l, e = graph.pages("https://graph.facebook.com/v24.0/x", {}, timeout=5)
assert l == [1] and e == "liste tronquée à 1 élément(s) : limite", (l, e)
brancher_http(pages_de({"error": {"message": "jeton expiré", "code": 190}}))
assert graph.pages("https://graph.facebook.com/v24.0/x", {}, timeout=5) == ([], "jeton expiré")
brancher_http(pages_de({"data": [1, 2]}, {"data": [3, 4]}, {"data": [5]}))
s = brancher_http(pages_de({"data": [1, 2]}, {"data": [3, 4]}, {"data": [5]}))
assert graph.pages("https://graph.facebook.com/v24.0/x", {}, timeout=5, limite=3) == ([1, 2, 3], None)
assert len(s.appels) == 2, s.appels                                      # pas une page de trop
brancher_http(lambda *_: (200, [1, 2]))
assert graph.pages("https://graph.facebook.com/v24.0/x", {}, timeout=5)[1] == "réponse Meta inattendue (list)"
print("graph ok")


# ── un faux Graph complet ─────────────────────────────────────────────────
AUJ = date.today()
POSTS = [{"id": f"100{i}", "timestamp": (AUJ - timedelta(days=i)).isoformat() + "T10:00:00+0000"}
         for i in range(5)]


def faux_graph(_m, chemin, p, _j):
    if chemin == f"{G}/me/adaccounts":
        return 200, {"data": [{"id": "act_1", "timezone_name": "Europe/Zurich"}]}
    if chemin == f"{G}/act_1/campaigns" and "objective" in p.get("fields", ""):
        return 200, {"data": [{"id": "c1", "name": "Été", "status": "ACTIVE",
                               "daily_budget": "5000"},
                              {"id": "c2", "name": "Hiver", "status": "PAUSED"}]}
    if chemin == f"{G}/c2/adsets":
        return 200, {"data": [{"daily_budget": "1000"}, {"daily_budget": "500"}]}
    if chemin == f"{G}/act_1/campaigns":
        return 200, {"data": [{"id": "c1", "name": "Été", "effective_status": "ACTIVE",
                               "start_time": "2026-01-01T00:00:00+0100"}]}
    if chemin == f"{G}/act_1/activities":
        return 200, {"data": [{"event_type": "update_campaign_budget",
                               "event_time": "2026-09-28T09:40:00+0000", "object_id": "c1",
                               "object_name": "Été",
                               "extra_data": '{"old_value": 5000, "new_value": 7000}'}]}
    if chemin == f"{G}/act_1/ads":
        return 200, {"data": [{"id": "a1", "creative": {"id": "cr1", "title": "T", "body": "B",
                                                        "image_hash": "h1"}}]}
    if chemin == f"{G}/act_1/adimages":
        return 200, {"data": [{"hash": "h1", "url": "https://cdn.meta/h1.jpg"}]}
    if chemin == f"{G}/act_1/insights":
        debut = __import__("json").loads(p["time_range"])["since"]
        return 200, {"data": [{"ad_id": "a1", "campaign_id": "c1", "adset_id": "s1",
                               "date_start": debut, "spend": "12.5", "impressions": "100",
                               "clicks": "3", "actions": [{"action_type": "link_click",
                                                           "value": "2"}]}]}
    if chemin == f"{G}/ig1/media":
        return 200, {"data": POSTS}
    if chemin == f"{G}/ig1":
        return 200, {"followers_count": 321}
    if chemin.endswith("/insights"):
        if p.get("metric") == "follows":
            return 200, {"data": [{"name": "follows", "value": 1}]}
        return 200, {"data": [{"name": m, "value": 7} for m in p["metric"].split(",")]}
    if chemin.startswith(f"{G}/100"):
        return 200, {"media_type": "IMAGE", "caption": "légende", "media_url": "https://cdn.ig/x.jpg",
                     "timestamp": "2026-10-01T10:00:00+0000"}
    if chemin in ("/h1.jpg", "/x.jpg"):
        return 200, b"\xff\xd8image"
    raise AssertionError(f"route inconnue {chemin} {p}")


# ── la limite de chaque fichier d'API ─────────────────────────────────────
brancher_http(faux_graph)
A = AccesMeta(jeton="T", compte="act_1", fuseau="Europe/Zurich", instagram="ig1")
F = Fenetre(AUJ - timedelta(days=200), AUJ)
assert len(comptes.recuperer(A, limite=1)[0]) == 1
assert len(budgets.recuperer(A, limite=1)[0]) == 1
assert len(campagnes.recuperer(A, limite=1)[0]) == 1
assert len(activites.recuperer(A, F, limite=1)[0]) == 1
assert len(creas.recuperer(A, limite=1)[0]) == 1
assert len(images.recuperer(A, ["h1", "h2"], limite=1)[0]) == 1
lignes, trous = insights.recuperer(A, F)
assert len(lignes) == 3 and trous == [], (len(lignes), trous)             # 3 tranches de 90 j
assert len(insights.recuperer(A, F, limite=2)[0]) == 2
assert len(posts.recuperer(A, limite=2)[0]) == 2
assert compte.recuperer(A)[0][0]["followers_count"] == 321
assert len(metriques.recuperer(A, ["1000", "1001", "1002"], limite=2)[0]) == 2
b, _ = budgets.recuperer(A)
assert b[1]["daily_budget"] == 15.0, b                                     # ad sets additionnés
print("limites ok")


# ── la récolte Meta Ads de bout en bout ───────────────────────────────────
s = brancher_http(faux_graph)
sb = FausseBase({"meta_ads_insights": [{"date_start": (AUJ - timedelta(days=3)).isoformat(),
                                        "campaign_id": "c1", "campaign_name": "Été",
                                        "adset_id": "s1", "ad_id": "a1"}]})
mot = recolte_meta.recolter(sb, "u1", "T")
assert mot == "meta: 1 lignes", mot                    # 31 jours → une tranche → une ligne
assert all(m == "GET" for m, _, _ in s.appels)
(_, _, (ins, conflit), _), = sb.ecrit("upsert", "meta_ads_insights")
assert conflit == "user_id,date_start,ad_id" and ins[0]["spend"] == 12.5 and ins[0]["link_clicks"] == 2
(_, _, (cfg, _), _), = sb.ecrit("upsert", "meta_campaign_config")
assert cfg[0]["campaign_id"] == "c1" and cfg[0]["start_date"] == "2026-01-01"
(_, _, (bud, _), _), = sb.ecrit("upsert", "platform_budgets")
assert {r["campaign_id"]: r["daily_budget"] for r in bud} == {"c1": 50.0, "c2": 15.0}
(_, _, (chg, _), _), = sb.ecrit("upsert", "platform_changes")
assert "est passé de 50,00 à 70,00 CHF" in chg[0]["resume"] and chg[0]["campaign_id"] == "c1"
assert chg[0]["fuseau"] == "Europe/Zurich"
assert sb.ecrit("upsert", "meta_ads_creatives") and sb.ecrit("upload", "ad-creatives")
print("récolte meta ok —", mot)

# le schéma en retard lève SchemaEnRetard, après budgets et changements
class _Err(Exception):
    code = "42703"


class BaseSansColonnes(FausseBase):
    def table(self, nom):
        q = super().table(nom)
        if nom == "meta_ads_insights":
            q.limit = lambda *_: (_ for _ in ()).throw(_Err())
        return q


brancher_http(faux_graph)
sb = BaseSansColonnes()
try:
    recolte_meta.recolter(sb, "u1", "T")
    raise AssertionError("SchemaEnRetard attendu")
except recolte_meta.SchemaEnRetard:
    pass
assert sb.ecrit("upsert", "platform_budgets") and not sb.ecrit("upsert", "meta_ads_insights")
print("schéma en retard ok")


# ── la récolte Instagram de bout en bout ──────────────────────────────────
brancher_http(faux_graph)
# `post_id` revient de PostgREST en ENTIER, l'inventaire Graph en CHAÎNE : le
# bug d'origine (jamais incrémental) tenait dans cette différence.
sb = FausseBase({"profiles": [{"is_paid": True}],
                 "instagram_organic_posts": [{"post_id": 1003,
                                              "media_url": "https://x.supabase.co/storage/v1/object/public/post-images/u1/1003.jpg"}]})
mot = recolte_ig.recolter(sb, "u1", A, note=lambda _e: None)
# 5 posts : 4 neufs + 1003 déjà en base mais récent (< 30 j) → relu ; son image reste
assert mot == "insta: 5 nouveaux posts", mot
(_, _, (rows, conflit), _), = sb.ecrit("upsert", "instagram_organic_posts")
assert conflit == "user_id,post_id" and rows[0]["likes"] == 7 and rows[0]["follows"] == 1
p3 = next(r for r in rows if r["post_id"] == "1003")
assert p3["media_url"].endswith("/post-images/u1/1003.jpg")
assert len(sb.ecrit("upload", "post-images")) == 4                      # 1003 pas re-téléversée
(_, _, total, _), = sb.ecrit("update", "connected_accounts")
assert total == {"total_posts_id_instagram": 5}
print("récolte instagram ok —", mot)

# un inventaire refusé lève, comme avant
brancher_http(lambda *_: (200, {"error": {"message": "jeton expiré"}}))
try:
    recolte_ig.recolter(FausseBase(), "u1", A)
    raise AssertionError("ValueError attendue")
except ValueError as e:
    assert "l'API a refusé la liste des médias : jeton expiré" in str(e)
print("TOUT VERT")
