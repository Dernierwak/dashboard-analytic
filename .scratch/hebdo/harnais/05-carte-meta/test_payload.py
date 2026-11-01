"""Harnais du ticket 05 — la carte Meta du module des canaux.

Hors ligne, depuis la racine du dépôt :
    python3.12 .scratch/hebdo/harnais/05-carte-meta/test_payload.py

Un compte servi le lundi, rapport du lundi 2 novembre 2026 : la semaine va du
26 octobre au 1er novembre. Chaque jour Meta écrit 1 000 impressions et
10 clics ; la dépense par jour vaut 10 × k la k-ième semaine avant celle du
rapport, pour k = 1…6 — soit un CPC de 1…6 CHF et un CPM de 10…60 CHF. Les
semaines 7 à 12 n'ont aucune ligne. La semaine du rapport dépense 60 CHF par
jour (CPC 6, CPM 60). Chaque cas change UNE chose.
"""
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from commun.faux_lecteur import FauxLecteur, Constats  # noqa: E402
from saas.data.supabase.processed_data.weekly_report.builder import build_payload  # noqa: E402

AUJOURD_HUI = date(2026, 11, 2)
DEBUT, FIN = date(2026, 10, 26), date(2026, 11, 1)
UNE_SEMAINE = timedelta(days=7)

META = {"source": "meta", "created_at": "2026-05-03T12:00:00+00:00",
        "a_reconnecter_depuis": None}
GOOGLE = {"source": "google", "created_at": "2026-06-10T08:30:00+00:00",
          "a_reconnecter_depuis": None}


def couvert(source, flux, jusqu_au=FIN):
    return {"source": source, "flux": flux, "sans_trou_depuis": "2026-01-01",
            "sans_trou_jusqu_au": jusqu_au.isoformat()}


TOUT_COUVERT = [couvert(s, f) for s in ("meta", "google") for f in ("insights", "journal")]


def ligne(jour, depense, impressions=1000, clics=10):
    return {"date_start": jour.isoformat(), "campaign_id": "c1", "ad_id": "a1",
            "spend": str(depense), "impressions": str(impressions), "clicks": str(clics)}


def semaine_de(k):
    """Les 7 jours de la k-ième semaine avant celle du rapport (k = 0 : elle)."""
    return [DEBUT - UNE_SEMAINE * k + timedelta(days=i) for i in range(7)]


class Compte(FauxLecteur):
    def __init__(self, connexions=(META,), couverture=TOUT_COUVERT, historique=range(1, 7),
                 semaine=lambda j: ligne(j, 60)):
        super().__init__(AUJOURD_HUI, "Monday")
        self._connexions, self._couverture = list(connexions), list(couverture)
        self._historique, self._semaine = list(historique), semaine

    def meta_ads(self):
        lignes = [ligne(j, 10 * k) for k in self._historique for j in semaine_de(k)]
        if self._semaine:
            lignes += [self._semaine(j) for j in semaine_de(0)]
        # Le jour du fetch, incomplet : jamais compté (CLAUDE.md §7).
        lignes.append(ligne(AUJOURD_HUI, 9999, 1, 1))
        return lignes

    def connexions_etat(self):
        return [dict(c) for c in self._connexions]

    def couverture(self):
        return [dict(c) for c in self._couverture]


constat = Constats()

# ── Le cas nominal : 6 semaines d'historique ────────────────────────────────
p = build_payload(Compte())
meta = (p.get("canaux") or {}).get("meta")
constat(meta is not None, f"canaux.meta existe : {p.get('canaux')}")
if meta is None:
    constat.conclure()
constat(meta["volumes"] == {"depense": 420.0, "impressions": 7000, "clics": 70},
        f"volumes de la semaine, jour du fetch exclu : {meta['volumes']}")
cpc = meta["ratios"]["cpc"]
constat(cpc["valeur"] == 6.0, f"CPC = dépense ÷ clics = 6 : {cpc['valeur']}")
constat(sorted(cpc["semaines"]) == [1.0, 2.0, 3.0, 4.0, 5.0, 6.0] and cpc["n"] == 6,
        f"12 semaines lues, les 6 sans ligne exclues, chacune sur ses totaux : {cpc['semaines']} n={cpc['n']}")
constat((cpc["q1"], cpc["mediane"], cpc["q3"]) == (1.75, 3.5, 5.25),
        f"quartiles « exclusive » sur [1…6] → 1,75 / 3,5 / 5,25 : {cpc['q1']} {cpc['mediane']} {cpc['q3']}")
constat(cpc["etat"] == "au_dessus", f"6 > q3 → au_dessus (le sens se décide à l'affichage) : {cpc['etat']}")
cpm = meta["ratios"]["cpm"]
constat(cpm["valeur"] == 60.0 and (cpm["q1"], cpm["q3"]) == (17.5, 52.5),
        f"CPM = dépense ÷ impressions × 1 000 : {cpm['valeur']} q1={cpm['q1']} q3={cpm['q3']}")
ctr = meta["ratios"]["ctr"]
constat(ctr["valeur"] == 1.0 and ctr["etat"] == "dans",
        f"CTR = clics ÷ impressions × 100, égal à toutes ses semaines → dans : {ctr['valeur']} {ctr['etat']}")

# Une semaine sous la boîte.
p = build_payload(Compte(semaine=lambda j: ligne(j, 10)))
constat(p["canaux"]["meta"]["ratios"]["cpc"]["etat"] == "en_dessous", "CPC 1 < q1 → en_dessous")

# Une semaine de l'historique sans impression n'a ni CTR ni CPM : elle sort,
# sans faire tomber son CPC (calculé sur ses clics).
class SansImpression(Compte):
    def meta_ads(self):
        k6 = set(d.isoformat() for d in semaine_de(6))
        return [dict(l, impressions="0") if l["date_start"] in k6 else l
                for l in super().meta_ads()]


p = build_payload(SansImpression())
r = p["canaux"]["meta"]["ratios"]
constat(r["ctr"]["n"] == 5 and r["cpm"]["n"] == 5 and r["cpc"]["n"] == 6,
        f"semaine à 0 impression : exclue du CTR et du CPM, gardée au CPC : "
        f"{r['ctr']['n']} {r['cpm']['n']} {r['cpc']['n']}")

# ── Historique < 6 semaines ─────────────────────────────────────────────────
p = build_payload(Compte(historique=range(1, 6)))
cpc = p["canaux"]["meta"]["ratios"]["cpc"]
constat(cpc["n"] == 5 and cpc["valeur"] == 6.0, f"5 semaines : n=5, la valeur reste : {cpc}")
constat(cpc["q1"] is None and cpc["mediane"] is None and cpc["q3"] is None and cpc["etat"] is None,
        "n < 6 → quartiles et état null")

# ── Dénominateur nul ────────────────────────────────────────────────────────
p = build_payload(Compte(semaine=lambda j: ligne(j, 5, impressions=300, clics=0)))
r = p["canaux"]["meta"]["ratios"]
constat(r["cpc"]["valeur"] is None and r["cpc"]["etat"] is None, f"0 clic → CPC null, pas 0 : {r['cpc']['valeur']}")
constat(r["ctr"]["valeur"] == 0.0, f"0 clic sur 2 100 impressions → CTR 0, un vrai 0 : {r['ctr']['valeur']}")

# ── Répondu sans diffusion ──────────────────────────────────────────────────
# Depuis le ticket 10, le rapport sort dès qu'une source est branchée : Meta
# seul, sans aucune ligne cette semaine, suffit.
class GoogleDepense(Compte):
    def google_ads(self):
        return [{"date_start": j.isoformat(), "campaign_id": "g1", "cost_micros": 5_000_000,
                 "impressions": 500, "clicks": 10} for j in semaine_de(0)]


p = build_payload(Compte(semaine=None))
meta = p["canaux"]["meta"]
constat(meta["volumes"] == {"depense": 0, "impressions": 0, "clics": 0},
        f"recolte sans ligne → volumes 0 CHF / 0 / 0 : {meta['volumes']}")
constat(all(meta["ratios"][k]["valeur"] is None and meta["ratios"][k]["etat"] is None
            for k in ("ctr", "cpc", "cpm")), "…et ratios « — » (null)")

# ── Jeton mort, panne ───────────────────────────────────────────────────────
mort = dict(META, a_reconnecter_depuis="2026-10-30T07:02:00+00:00")
for nom, compte in (("jeton mort", Compte(connexions=(mort,))),
                    ("panne", Compte(couverture=[couvert("meta", "insights", FIN - timedelta(days=1))]))):
    p = build_payload(compte)
    meta = p["canaux"]["meta"]
    constat(meta["volumes"] == {"depense": None, "impressions": None, "clics": None},
            f"{nom} → volumes null, même avec des lignes : {meta['volumes']}")
    constat(all(meta["ratios"][k]["valeur"] is None and meta["ratios"][k]["etat"] is None
                for k in ("ctr", "cpc", "cpm")), f"{nom} → ratios null")

# ── Périmètre ───────────────────────────────────────────────────────────────
p = build_payload(Compte(connexions=(META, GOOGLE)))
constat(set(p["canaux"]) == {"meta"}, f"Google n'entre pas au module aujourd'hui : {set(p['canaux'])}")
p = build_payload(Compte(connexions=()))
constat(p is None, "aucune source branchée → aucun rapport, donc pas de clé canaux (ticket 10)")


class Illisible(GoogleDepense):
    def meta_ads(self):
        raise RuntimeError("base injoignable")


p = build_payload(Illisible(connexions=(META, GOOGLE)))
meta = (p.get("canaux") or {}).get("meta")
constat(meta is not None and meta["volumes"]["depense"] is None
        and meta["ratios"]["cpc"]["valeur"] is None and meta["ratios"]["cpc"]["n"] == 0,
        f"lecture qui échoue → null, pas 0 : {meta}")

constat.conclure()
