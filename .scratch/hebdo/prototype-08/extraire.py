"""PROTOTYPE, jetable — ticket 08 « La page entière, en maquette ».

Écrit `donnees.local.js` (ignoré par git) à partir de la base, en lecture seule :
    python3.12 -I extraire.py <chemin du .env du worker> <début du user_id>

La clé se lit dans le .env, ne s'affiche jamais. Tout ce que la page montre
est calculé ici, pour que les trois variantes lisent exactement les mêmes
chiffres et ne diffèrent que par la forme.
"""
import datetime as dt
import json
import os
import statistics
import sys
import urllib.request
from collections import defaultdict

env_path, prefixe = sys.argv[1], sys.argv[2]
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


profil = next(p for p in get("profiles?select=id,fetch_schedule") if p["id"].startswith(prefixe))
uid = profil["id"]

# ── La semaine : 7 jours pleins calés sur le Jour de travail (ticket 02) ──
JOURS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
sched = (profil.get("fetch_schedule") or "").lower()
jour_travail = next((i for i, j in enumerate(JOURS) if j in sched or j[:3] == sched[:3]), 0)
aujourd_hui = dt.date.today()
dernier_jt = aujourd_hui - dt.timedelta(days=(aujourd_hui.weekday() - jour_travail) % 7)
fin = dernier_jt - dt.timedelta(days=1)  # le Jour de travail lui-même est exclu (§7)
debut = fin - dt.timedelta(days=6)


def semaine_de(d):
    """Index de semaine : 0 = la semaine regardée, 1 = celle d'avant…"""
    return (fin - d).days // 7


meta = get(
    f"meta_ads_insights?user_id=eq.{uid}&campaign_id=not.is.null"
    "&select=date_start,campaign_id,campaign_name,ad_id,spend,impressions,clicks&order=date_start,id"
)
google = get(
    f"google_ads_insights?user_id=eq.{uid}"
    "&select=date_start,campaign_id,campaign_name,cost_micros,impressions,clicks&order=date_start,id"
)
for r in meta:
    r["d"] = dt.date.fromisoformat(r["date_start"])
for r in google:
    r["d"] = dt.date.fromisoformat(r["date_start"])

# Une source « a répondu » pour la semaine si sa récolte a écrit au moins
# jusqu'au dernier jour : sans ça, une semaine vide est une panne, pas un 0.
meta_couvre = bool(meta) and max(r["d"] for r in meta) >= fin
google_couvre = bool(google) and max(r["d"] for r in google) >= fin


def somme(rows, idx, champ):
    return sum(float(r[champ] or 0) for r in rows if semaine_de(r["d"]) == idx and r["d"] <= fin)


totaux = {
    "depense": {
        "Meta": round(somme(meta, 0, "spend"), 2) if meta_couvre else None,
        "Google Ads": round(somme(google, 0, "cost_micros") / 1e6, 2) if google_couvre else None,
    },
    "impressions": {
        "Meta": int(somme(meta, 0, "impressions")) if meta_couvre else None,
        "Google Ads": int(somme(google, 0, "impressions")) if google_couvre else None,
    },
    # Aucune table ne garde la portée du compte par semaine — seulement celle
    # de chaque post. Additionner des portées de posts compte plusieurs fois la
    # même personne : on ne l'écrit pas.
    "portee": {"Instagram": None, "Facebook": None, "TikTok": None},
}

# ── Le module des canaux : Meta, volumes + ratios face à la semaine type (ticket 03) ──
par_sem = defaultdict(lambda: [0.0, 0, 0])
for r in meta:
    i = semaine_de(r["d"])
    if 0 <= i <= 12 and r["d"] <= fin:
        x = par_sem[i]
        x[0] += float(r["spend"] or 0)
        x[1] += r["impressions"] or 0
        x[2] += r["clicks"] or 0


def ratios(x):
    dep, imp, clk = x
    return {
        "ctr": clk / imp * 100 if imp else None,
        "cpc": dep / clk if clk else None,
        "cpm": dep / imp * 1000 if imp else None,
    }


sem0 = par_sem.get(0, [0.0, 0, 0])
r0 = ratios(sem0)
reference = {}
for m in ("ctr", "cpc", "cpm"):
    vals = [ratios(par_sem[i])[m] for i in range(1, 13) if i in par_sem]
    vals = [v for v in vals if v is not None]
    if len(vals) < 6:
        reference[m] = {"n": len(vals), "med": None}
        continue
    q = statistics.quantiles(vals, n=4)
    reference[m] = {"n": len(vals), "med": statistics.median(vals), "q1": q[0], "q3": q[2],
                    "semaines": vals}
canal_meta = {
    "repond": meta_couvre,
    "depense": round(sem0[0], 2), "impressions": sem0[1], "clics": sem0[2],
    "ratios": r0, "reference": reference,
}

# ── Les changements : ce que Meta a écrit, semaine mesurée, catégories retenues (ticket 05) ──
GARDEES = {"budget", "enchere", "audience", "creatif", "objectif", "motcle", "diffusion", "calendrier", "autre"}
ch = get(
    f"platform_changes?user_id=eq.{uid}&occurred_at=gte.{debut}T00:00:00Z&occurred_at=lt.{dernier_jt}T00:00:00Z"
    "&select=channel,occurred_at,categorie,campaign_id,campaign_name,resume,niveau,object_name&order=occurred_at.desc"
)
changements = [
    {"plateforme": "Meta" if c["channel"] == "meta" else "Google Ads", "quand": c["occurred_at"],
     "cat": c["categorie"], "campagne": c["campaign_name"] or "—", "cid": c["campaign_id"],
     "resume": c["resume"], "niveau": c["niveau"], "objet": c["object_name"]}
    for c in ch if c["categorie"] in GARDEES
]

# ── La frise : campagnes et posts de l'année (tickets 04 et 11) ──
annee = fin.year
conf_meta = {c["campaign_id"]: c for c in get(
    f"meta_campaign_config?user_id=eq.{uid}&select=campaign_id,campaign_name,effective_status,start_date,end_date")}
conf_google = {c["campaign_id"]: c for c in get(
    f"google_campaign_config?user_id=eq.{uid}&select=campaign_id,campaign_name,effective_status,start_date,end_date")}
creas = {c["ad_id"]: c.get("image_url") or c.get("vignette_url") for c in get(
    f"meta_ads_creatives?user_id=eq.{uid}&select=ad_id,image_url,vignette_url")}


def campagnes(rows, conf, plateforme, champ_dep, diviseur):
    acc = {}
    for r in rows:
        c = acc.setdefault(r["campaign_id"], {"nom": r["campaign_name"], "jours": [], "dep": 0.0,
                                              "ads": defaultdict(float)})
        c["nom"] = r["campaign_name"]  # trié par date : le nom actuel gagne
        dep = float(r[champ_dep] or 0) / diviseur
        if dep > 0:
            c["jours"].append(r["d"])
        if r["d"].year == annee:
            c["dep"] += dep
            if r.get("ad_id"):
                c["ads"][r["ad_id"]] += dep
    out = []
    for cid, c in acc.items():
        cf = conf.get(cid) or {}
        d0 = cf.get("start_date") or (min(c["jours"]).isoformat() if c["jours"] else None)
        d1 = cf.get("end_date") or (max(c["jours"]).isoformat() if c["jours"] else None)
        # Une fin non déclarée ne fait pas une campagne de l'année : la config
        # garde des campagnes « actives » sans fin qui n'ont rien diffusé depuis
        # des années. Elle entre si elle a dépensé cette année, ou si ses dates
        # déclarées touchent l'année.
        dans_annee = c["dep"] > 0 or (d0 and d0 >= f"{annee}-01-01") or (cf.get("end_date") or "") >= f"{annee}-01-01"
        if not d0 or not dans_annee:
            continue
        visuels = []
        for ad, _ in sorted(c["ads"].items(), key=lambda kv: -kv[1]):
            u = creas.get(ad)
            if u and u not in visuels:
                visuels.append(u)
            if len(visuels) == 4:
                break
        out.append({"id": cid, "plateforme": plateforme, "nom": cf.get("campaign_name") or c["nom"],
                    "debut": d0, "fin": d1, "fin_declaree": bool(cf.get("end_date")),
                    "statut": cf.get("effective_status"), "depense": round(c["dep"], 2),
                    "visuels": visuels})
    return out


# Les campagnes présentes seulement dans la config (prévues, jamais dépensé).
for cid, cf in conf_meta.items():
    if not any(r["campaign_id"] == cid for r in meta) and cf.get("start_date"):
        meta.append({"campaign_id": cid, "campaign_name": cf["campaign_name"], "d": dt.date.fromisoformat(cf["start_date"]),
                     "spend": 0, "ad_id": None})
liste = campagnes(meta, conf_meta, "Meta", "spend", 1) + campagnes(google, conf_google, "Google Ads", "cost_micros", 1e6)

posts = [
    {"plateforme": "Instagram", "type": p["type"], "date": p["date"][:10], "media": p["media_url"],
     "legende": (p["caption"] or "")[:80]}
    for p in get(f"instagram_organic_posts?user_id=eq.{uid}&date=gte.{annee}-01-01&select=type,date,media_url,caption&order=date")
]

donnees = {
    "aujourdhui": aujourd_hui.isoformat(), "jour_travail": JOURS[jour_travail],
    "semaine": {"debut": debut.isoformat(), "fin": fin.isoformat(), "numero": fin.isocalendar()[1]},
    "totaux": totaux, "meta": canal_meta, "changements": changements,
    "campagnes": liste, "posts": posts,
}
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "donnees.local.js")
with open(out, "w", encoding="utf-8") as f:
    f.write("window.DONNEES = ")
    json.dump(donnees, f, ensure_ascii=False)
    f.write(";\n")
hotes = defaultdict(int)
for p in posts:
    hotes[(p["media"] or "").split("/")[2] if p["media"] else None] += 1
print(f"semaine {debut} → {fin} (Jour de travail : {JOURS[jour_travail]}, planning brut « {sched} »)")
print(f"Meta couvre : {meta_couvre} · Google couvre : {google_couvre}")
print(f"référence : { {m: (v['n'], v['med'] is not None) for m, v in reference.items()} }")
print(f"{len(changements)} changements retenus sur {len(ch)} · {len(liste)} campagnes · {len(posts)} posts")
print(f"campagnes avec visuels : {sum(1 for c in liste if c['visuels'])} · statuts : {sorted({str(c['statut']) for c in liste})}")
print(f"hôtes des visuels de posts : {dict(hotes)}")
