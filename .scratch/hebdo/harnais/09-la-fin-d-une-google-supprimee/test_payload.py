"""Harnais du ticket 09 — la fin d'une campagne Google supprimée.

Hors ligne, depuis la racine du dépôt :
    python3.12 .scratch/hebdo/harnais/09-la-fin-d-une-google-supprimee/test_payload.py

Deux coutures :
  - le traitement, par `build_payload(Lecteur)` : une supprimée finit à la date
    structurée de sa suppression, sinon au dernier jour de dépense, sinon au
    début ;
  - la récolte, par `fetch_campaign_changes` avec la réponse HTTP de Google
    remplacée : le statut structuré s'écrit, et une liste qui touche le plafond
    de 10 000 compte comme un trou.

Compte servi le jeudi ; le rapport du jeudi 29 octobre 2026 mesure la semaine
du 22 au 28 octobre.
"""
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from commun.faux_lecteur import FauxLecteur, Constats  # noqa: E402
from saas.data.supabase.processed_data.weekly_report.builder import build_payload  # noqa: E402
from saas.data.fetch_data.sources.google.ads.fetchers import changes  # noqa: E402
from saas.data.supabase.source_data import platform  # noqa: E402

JOUR_FETCH = date(2026, 10, 29)


def jours(debut, fin):
    return [debut + timedelta(days=i) for i in range((fin - debut).days + 1)]


def config(cid, nom, statut=None, debut=None, fin=None):
    return {"campaign_id": cid, "campaign_name": nom, "effective_status": statut,
            "start_date": debut, "end_date": fin}


def depense(cid, debut, fin):
    return [{"date_start": d.isoformat(), "campaign_id": cid, "campaign_name": cid,
             "cost_micros": 5_000_000} for d in jours(debut, fin)]


def statut(cid, quand, avant, apres):
    # Google écrit l'heure du compte sans décalage, stockée telle quelle.
    return {"campaign_id": cid, "occurred_at": quand,
            "extra_data": {"statut": {"avant": avant, "apres": apres}}}


class Compte(FauxLecteur):
    def __init__(self, google_rows=(), config_google=(), statuts=()):
        super().__init__(JOUR_FETCH, "Thursday")
        self._google, self._cfg, self._statuts = list(google_rows), list(config_google), list(statuts)

    def abonnes(self):
        return [{"fetched_at": "2026-10-29T07:00:00+00:00", "followers": 500}]

    def google_ads(self): return self._google

    def campagnes_config(self, table):
        return self._cfg if table == "google_campaign_config" else []

    def statuts_google(self): return self._statuts


def campagnes(compte):
    return {c["id"]: c for c in build_payload(compte)["frise"]["campagnes"]}


constat = Constats()

# ── Le traitement ────────────────────────────────────────────────────────────
cfg = [config("g1", "Supprimée", "REMOVED", "2026-02-20", "2026-03-31"),
       config("g2", "Jamais diffusée", "REMOVED", "2026-04-01")]
goo = depense("g1", date(2026, 3, 1), date(2026, 3, 10))

f = campagnes(Compte(goo, cfg, statuts=[
    statut("g1", "2026-03-12 09:00:00", "ENABLED", "PAUSED"),
    statut("g1", "2026-03-15 23:59:00", "PAUSED", "REMOVED"),
    statut("g1", "2026-03-14 10:00:00", "ENABLED", "REMOVED"),
    statut("autre", "2026-09-01 10:00:00", "ENABLED", "REMOVED"),
]))
constat(f["g1"].get("statut") == "supprimee",
        f"REMOVED passe avant une fin déclarée dépassée : {f['g1'].get('statut')}")
constat((f["g1"]["fin"], f["g1"]["fin_declaree"]) == ("2026-03-15", False),
        f"date structurée présente : la plus récente suppression, au jour du compte — "
        f"{f['g1']['fin']}")

f = campagnes(Compte(goo, cfg, statuts=[
    statut("g1", "2026-03-12 09:00:00", "ENABLED", "PAUSED"),
    statut("g1", "2026-10-29 08:00:00", "ENABLED", "REMOVED"),
]))
constat(f["g1"]["fin"] == "2026-03-10",
        f"date structurée absente (une pause, une suppression après semaine.fin) : "
        f"repli sur le dernier jour de dépense — {f['g1']['fin']}")
constat((f["g2"]["debut"], f["g2"]["fin"]) == ("2026-04-01", "2026-04-01"),
        f"ni date ni dépense : un repère au début — {f['g2']['debut']} → {f['g2']['fin']}")

f = campagnes(Compte(goo, [config("g3", "Vivante", "ENABLED", "2026-03-01")]
                     + cfg, statuts=[statut("g3", "2026-05-01 10:00:00", "ENABLED", "REMOVED")]))
constat(f["g3"]["fin"] is None,
        "une campagne dont la config n'est pas REMOVED ne lit pas le journal : "
        f"fin = dernier jour mesuré — {f['g3']['fin']}")



class JournalIllisible(Compte):
    def statuts_google(self): raise RuntimeError("base injoignable")


f = campagnes(JournalIllisible(goo, cfg))
constat(f["g1"]["fin"] == "2026-03-10",
        f"journal illisible : la frise part, sur le repli — {f['g1']['fin']}")


class InsightsIllisibles(Compte):
    def meta_ads(self): raise RuntimeError("base injoignable")


p = build_payload(InsightsIllisibles(goo, cfg))
constat("frise" not in p and "semaine" in p,
        "une lecture des insights qui échoue : pas de frise (pas une année vide), "
        f"le reste du rapport part — clés : {sorted(k for k in p if k in ('frise', 'semaine'))}")

# ── La récolte ───────────────────────────────────────────────────────────────


class Reponse:
    def __init__(self, data): self._data = data
    def json(self): return self._data


def evenement(quand, avant, apres, cid="456"):
    return {"changeEvent": {
        "changeDateTime": quand,
        "changeResourceType": "CAMPAIGN",
        "changeResourceName": f"customers/1/campaigns/{cid}",
        "changedFields": "status",
        "resourceChangeOperation": "UPDATE",
        "oldResource": {"campaign": {"status": avant}},
        "newResource": {"campaign": {"status": apres}},
        "campaign": f"customers/1/campaigns/{cid}",
    }}


def budget(quand, cid="456"):
    return {"changeEvent": {
        "changeDateTime": quand,
        "changeResourceType": "CAMPAIGN",
        "changeResourceName": f"customers/1/campaigns/{cid}",
        "changedFields": "name",
        "resourceChangeOperation": "CREATE",
        "newResource": {"campaign": {"name": "Neuve"}},
        "campaign": f"customers/1/campaigns/{cid}",
    }}


def recolter(resultats):
    changes.http.post = lambda *a, **k: Reponse([{"results": resultats}])
    return changes.fetch_campaign_changes("jeton", "1", date.today(),
                                          noms_campagnes={"456": "Été"})


rows, err = recolter([evenement("2026-10-20 10:00:00.0", "ENABLED", "REMOVED"),
                      budget("2026-10-19 10:00:00.0")])
par_cat = {r["categorie"]: r for r in rows}
constat(par_cat["statut"].get("extra_data") == {"statut": {"avant": "ENABLED", "apres": "REMOVED"}},
        f"un changement de statut de campagne porte l'avant et l'après : "
        f"{par_cat['statut'].get('extra_data')}")
constat("REMOVED" not in par_cat["statut"]["resume"],
        f"la phrase reste une phrase : {par_cat['statut']['resume']!r}")
constat("extra_data" not in par_cat["autre"],
        "les autres lignes n'envoient pas d'extra_data (un None effacerait l'existant)")
constat(err is None, f"liste sous le plafond : aucun trou — {err!r}")

plein = [evenement(f"2026-10-20 10:00:{i % 60:02d}.{i}", "ENABLED", "PAUSED")
         for i in range(changes._CHANGE_LIMITE)]
rows, err = recolter(plein)
constat(err is not None and len(rows) > 0,
        f"liste au plafond : ce qui a été lu s'écrit, et c'est un trou — "
        f"{len(rows)} ligne(s), {err!r}")
lignes, trous = changes.recuperer(
    changes.AccesGoogle(jeton="jeton", client="1"),
    changes.Fenetre(date.today() - timedelta(days=30), date.today()))
constat(bool(trous), f"`recuperer` rend ce trou : {trous}")

ecrites = []
platform.upsert_platform_changes = lambda sb, uid, canal, rows: ecrites.extend(rows)
sans_trou = platform.journal_changements(None, "u", "google", lambda: changes.recuperer(
    changes.AccesGoogle(jeton="jeton", client="1"),
    changes.Fenetre(date.today() - timedelta(days=30), date.today()),
    noms_campagnes={"456": "Été"}))
constat(sans_trou is False and len(ecrites) == changes._CHANGE_LIMITE,
        f"`journal_changements` écrit la liste coupée et rend False : la couverture "
        f"n'avance pas — {sans_trou}, {len(ecrites)} ligne(s)")

constat.conclure()
