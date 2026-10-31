"""PROTOTYPE, jetable — ticket 07 « Le meilleur du compte ».

Écrit `donnees.local.js` (ignoré par git) à partir de la base, en lecture seule :
    python3.12 -I extraire.py <chemin du .env du worker> <user_id>

La clé se lit dans le .env, ne s'affiche jamais.
"""
import json
import os
import sys
import urllib.request
from collections import defaultdict

env_path, user_id = sys.argv[1], sys.argv[2]
env = {}
for line in open(env_path, encoding="utf-8"):
    line = line.strip()
    if "=" in line and not line.startswith("#"):
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip()
url = env["SUPABASE_URL"].rstrip("/")
key = env.get("SUPABASE_SECRET_KEY") or env["SUPABASE_SERVICE_ROLE_KEY"]


def get(path):
    out, de = [], 0
    while True:
        req = urllib.request.Request(
            f"{url}/rest/v1/{path}", headers={"apikey": key, "Range": f"{de}-{de + 999}"}
        )
        rows = json.load(urllib.request.urlopen(req))
        out += rows
        if len(rows) < 1000:  # PostgREST tronque à 1 000 sans le dire
            return out
        de += 1000


meta = get(
    f"meta_ads_insights?user_id=eq.{user_id}&campaign_id=not.is.null"
    "&select=date_start,campaign_id,campaign_name,spend,impressions,clicks,results&order=date_start,id"
)
ig = get(
    f"instagram_organic_posts?user_id=eq.{user_id}"
    "&select=post_id,type,caption,date,likes,comments,saved,reach,views,follows,media_url&order=date,id"
)

# Une ligne par (campagne, jour, indicateur) : une ligne Meta porte un seul
# indicateur, donc la dépense d'un indicateur est exacte, sans répartition.
agg = defaultdict(lambda: [0.0, 0, 0, 0.0, False])
noms = {}
for r in meta:
    noms[r["campaign_id"]] = r["campaign_name"]  # trié par date : le nom actuel gagne
    items = r["results"] or []
    ind = items[0].get("indicator") if items else None
    x = agg[(r["campaign_id"], r["date_start"], ind)]
    x[0] += float(r["spend"] or 0)
    x[1] += r["impressions"] or 0
    x[2] += r["clicks"] or 0
    for it in items:
        for v in it.get("values") or []:
            x[3] += float(v.get("value") or 0)
            x[4] = True

lignes = [
    {"c": c, "j": j, "ind": ind, "dep": round(v[0], 2), "imp": v[1], "clk": v[2],
     "res": v[3] if v[4] else (0 if ind else None)}
    for (c, j, ind), v in sorted(agg.items(), key=lambda kv: kv[0][1])
]
posts = [
    {"id": p["post_id"], "type": p["type"], "legende": (p["caption"] or "")[:90], "date": p["date"],
     "portee": p["reach"], "vues": p["views"], "likes": p["likes"], "comm": p["comments"],
     "enreg": p["saved"], "abonnes": p["follows"], "media": p["media_url"]}
    for p in ig
]
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "donnees.local.js")
with open(out, "w", encoding="utf-8") as f:
    f.write("window.DONNEES = ")
    json.dump({"campagnes": noms, "lignes": lignes, "posts": posts}, f, ensure_ascii=False)
    f.write(";\n")
print(f"{len(lignes)} lignes de campagne, {len(noms)} campagnes, {len(posts)} posts → {out}")
