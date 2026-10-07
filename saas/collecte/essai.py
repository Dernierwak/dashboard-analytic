"""L'essai — le VRAI code de récolte, N éléments par API, un JSON local, rien en base.

    python3.12 saas/collecte/essai.py --user UID
    python3.12 saas/collecte/essai.py --user UID -n 5 --plateforme meta

POURQUOI IL EXISTE (David, 2026-10-07) : « si je veux tester que tout
fonctionne, je ne veux pas avoir à tout prendre ». La mise à jour écrit en base,
publie le rapport et ENVOIE l'email : ce n'est pas un test. L'essai appelle les
MÊMES fichiers d'API que la récolte (pas une copie), avec `limite=N` et une
fenêtre de 7 jours, et s'arrête avant toute écriture.

CE QU'IL N'ÉCRIT PAS, ET COMMENT C'EST GARANTI : le client Supabase qu'il reçoit
est enveloppé dans `LectureSeule`, qui LÈVE sur tout upsert, insert, update,
delete ou téléversement. Les fichiers d'API ne touchent pas Supabase de toute
façon (`saas/collecte/CLAUDE.md`) ; l'enveloppe est la ceinture des bretelles.
Aucun rapport n'est construit, aucun email ne part.

CE QU'IL ÉCRIT : un JSON dans `.essais/` à la racine du dépôt — ignoré par git,
parce qu'il porte des données client (le dépôt est PUBLIC). Aucun jeton dedans.
C'est aussi pourquoi l'essai n'est pas un mode de `weekly-fetch.yml`.

« TOUT EST-IL PRIS ? » NE SE DÉDUIT PAS D'UN ÉCHANTILLON. Chaque plateforme est
comparée à un total qu'elle donne elle-même, lu SANS limite sur la même fenêtre :
  · Meta Ads   — dépense du compte (`level=account`) = somme des annonces ;
  · Instagram  — `media_count` du compte = posts inventoriés ;
  · Google Ads — coût du compte (`FROM customer`) = somme des campagnes ;
  · GA4        — sessions sans dimension ≈ somme des lignes source/medium.
Un total que la plateforme ne rend pas s'écrit « non vérifiable » avec sa raison :
jamais un écart supposé nul.

La fenêtre s'arrête HIER : la journée en cours est incomplète (`CLAUDE.md` §7),
et ses chiffres bougeraient entre les deux lectures d'un même contrôle.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RACINE))

from saas.collecte import plan as plans  # noqa: E402
from saas.collecte.automatisation.fils import client_service  # noqa: E402
from saas.collecte.google.acces import AccesGoogle  # noqa: E402
from saas.collecte.google.ads import (  # noqa: E402
    budgets as g_budgets, changements as g_changements,
    insights_annonces as g_annonces, insights_campagnes as g_campagnes,
    statuts as g_statuts,
)
from saas.collecte.google.analytics import (  # noqa: E402
    catalogue as ga4_catalogue, evenements as ga4_evenements, insights as ga4_insights,
)
from saas.collecte.google.auth.oauth import get_access_token_from_refresh  # noqa: E402
from saas.collecte.meta.ads import (  # noqa: E402
    activites, budgets, campagnes, comptes, creas, images, insights,
)
from saas.collecte.meta.graph import AccesMeta  # noqa: E402
from saas.collecte.meta.organique.instagram import (  # noqa: E402
    compte as ig_compte, metriques as ig_metriques, posts as ig_posts,
)
from saas.collecte.socle.fenetre import Fenetre  # noqa: E402
from saas.collecte.socle.http import sans_jeton  # noqa: E402

PLATEFORMES = ("meta", "instagram", "google", "ga4")
_JOURS = 7
# Un centime : en deçà, deux additions du même montant ne diffèrent que par
# l'arrondi des flottants, pas par une ligne manquante.
_TOLERANCE_MONTANT = 0.01
_ECHANTILLON = 2


class _Interdit(RuntimeError):
    pass


class _RequeteLue:
    _ECRITURES = {"upsert", "insert", "update", "delete"}

    def __init__(self, requete, table):
        self._r, self._table = requete, table

    def __getattr__(self, nom):
        if nom in self._ECRITURES:
            raise _Interdit(f"l'essai n'écrit pas : {nom} sur {self._table}")
        attr = getattr(self._r, nom)
        if not callable(attr):
            return attr
        def suite(*a, **k):
            res = attr(*a, **k)
            return _RequeteLue(res, self._table) if hasattr(res, "execute") else res
        return suite


class LectureSeule:
    """Un client Supabase qui LÈVE sur toute écriture — tables et stockage."""

    def __init__(self, sb):
        self._sb = sb

    def table(self, nom):
        return _RequeteLue(self._sb.table(nom), nom)

    @property
    def storage(self):
        class _Stockage:
            def from_(_s, bucket):
                class _Dossier:
                    def __getattr__(_d, nom):
                        if nom in ("upload", "update", "remove", "move", "copy"):
                            raise _Interdit(f"l'essai n'écrit pas : {nom} dans {bucket}")
                        return getattr(self._sb.storage.from_(bucket), nom)
                return _Dossier()
        return _Stockage()


def _mesure(appel) -> tuple[dict, list]:
    """(résumé JSON, lignes) d'un fichier d'API. Une exception devient un trou."""
    try:
        lignes, trous = appel()
    except Exception as e:
        lignes, trous = [], [sans_jeton(f"{type(e).__name__}: {e}")]
    if isinstance(lignes, dict):                 # images.recuperer : {hash: url}
        lignes = [{"hash": h, "url": u} for h, u in lignes.items()]
    return ({"lu": not trous, "elements": len(lignes),
             "echantillon": lignes[:_ECHANTILLON], "trous": trous}, lignes)


def _controle(nom_total: str, total, err, lu: float, montant: bool) -> dict:
    if total is None:
        return {"verdict": "non vérifiable", "raison": err, "lu": lu}
    ecart = lu - total
    complet = abs(ecart) <= _TOLERANCE_MONTANT if montant else ecart == 0
    return {"verdict": "complet" if complet else "ÉCART", nom_total: total,
            "lu": lu, "ecart": round(ecart, 6)}


class Essai:
    """Lit N éléments par API d'un compte, contrôle la complétude, écrit un JSON."""

    def __init__(self, uid: str, n: int = 5, plateformes=PLATEFORMES,
                 dossier: Path = RACINE / ".essais") -> None:
        self.uid, self.n, self.plateformes, self.dossier = uid, n, set(plateformes), dossier
        hier = date.today() - timedelta(days=1)
        self.fenetre = Fenetre(hier - timedelta(days=_JOURS - 1), hier)

    def executer(self, sb=None) -> dict:
        sb = LectureSeule(sb or client_service())
        connexions = sb.table("connected_accounts").select(
            "provider, meta_token, instagram_business_id, "
            "google_refresh_token, google_customer_id, ga4_property_id"
        ).eq("user_id", self.uid).execute().data or []
        le_plan = plans.planifier(connexions)
        rapport = {"compte": self.uid, "n": self.n,
                   "fenetre": [self.fenetre.debut.isoformat(), self.fenetre.fin.isoformat()],
                   "lance_le": datetime.utcnow().isoformat(timespec="seconds") + "Z",
                   "sautes": dict(le_plan.sautes), "api": {}, "controles": {}}
        for tache in (t for f in le_plan.fils for t in f):
            if tache.canal in self.plateformes:
                getattr(self, f"_{tache.canal}")(tache.connexion, rapport)
        return rapport

    # ── Meta Ads ──────────────────────────────────────────────────────────
    def _meta(self, c: dict, rapport: dict) -> None:
        api, n, F = rapport["api"], self.n, self.fenetre
        api["meta/comptes"], liste = _mesure(lambda: comptes.recuperer(AccesMeta(c["meta_token"])))
        compte, fuseau = comptes.compte_et_fuseau(liste)
        if not compte:
            return
        A = AccesMeta(jeton=c["meta_token"], compte=compte, fuseau=fuseau)
        api["meta/budgets"], _ = _mesure(lambda: budgets.recuperer(A, limite=n))
        api["meta/campagnes"], _ = _mesure(lambda: campagnes.recuperer(A, limite=n))
        api["meta/activites"], _ = _mesure(lambda: activites.recuperer(A, F, limite=n))
        api["meta/creas"], annonces = _mesure(lambda: creas.recuperer(A, limite=n))
        hashes = sorted(creas.hashes_des_creas(annonces))
        api["meta/images"], _ = _mesure(lambda: images.recuperer(A, hashes, limite=n))
        api["meta/insights"], _ = _mesure(lambda: insights.recuperer(A, F, limite=n))
        tout, trous = insights.recuperer(A, F)
        total, err = insights.total_compte(A, F)
        rapport["controles"]["meta/depense"] = (
            {"verdict": "non vérifiable", "raison": " | ".join(trous)} if trous else
            _controle("depense_compte", total, err,
                      round(sum(float(r.get("spend") or 0) for r in tout), 2), montant=True))

    # ── Instagram ─────────────────────────────────────────────────────────
    def _instagram(self, c: dict, rapport: dict) -> None:
        api, n = rapport["api"], self.n
        A = AccesMeta(jeton=c["meta_token"], instagram=c["instagram_business_id"])
        api["instagram/compte"], compte = _mesure(lambda: ig_compte.recuperer(A))
        api["instagram/posts"], posts = _mesure(lambda: ig_posts.recuperer(A, limite=n))
        ids = [str(p["id"]) for p in posts if p.get("id")]
        api["instagram/metriques"], _ = _mesure(lambda: ig_metriques.recuperer(A, ids, limite=n))
        tout, trous = ig_posts.recuperer(A)
        total = (compte[0].get("media_count") if compte else None)
        rapport["controles"]["instagram/posts"] = (
            {"verdict": "non vérifiable", "raison": " | ".join(trous)} if trous else
            _controle("media_count", total, "media_count absent de la réponse",
                      len(tout), montant=False))

    # ── Google Ads ────────────────────────────────────────────────────────
    def _acces_google(self, c: dict, rapport: dict) -> AccesGoogle | None:
        jeton = get_access_token_from_refresh(c["google_refresh_token"])
        if not jeton:
            rapport["api"]["google/jeton"] = {"lu": False, "elements": 0, "echantillon": [],
                                              "trous": ["le refresh token ne rend plus de "
                                                        "jeton d'accès"]}
        return AccesGoogle(jeton=jeton, client=c.get("google_customer_id"),
                           propriete=c.get("ga4_property_id")) if jeton else None

    def _google(self, c: dict, rapport: dict) -> None:
        A = self._acces_google(c, rapport)
        if not A:
            return
        api, n, F = rapport["api"], self.n, self.fenetre
        api["google/budgets"], _ = _mesure(lambda: g_budgets.recuperer(A, limite=n))
        api["google/statuts"], _ = _mesure(lambda: g_statuts.recuperer(A, limite=n))
        api["google/changements"], _ = _mesure(lambda: g_changements.recuperer(A, F, limite=n))
        api["google/insights_campagnes"], _ = _mesure(lambda: g_campagnes.recuperer(A, F, limite=n))
        api["google/insights_annonces"], _ = _mesure(lambda: g_annonces.recuperer(A, F, limite=n))
        tout, trous = g_campagnes.recuperer(A, F)
        total, err = g_campagnes.total_client(A, F)
        rapport["controles"]["google/cout_micros"] = (
            {"verdict": "non vérifiable", "raison": " | ".join(trous)} if trous else
            _controle("cout_compte", total, err,
                      float(sum(r.get("cost_micros") or 0 for r in tout)), montant=True))

    # ── GA4 ───────────────────────────────────────────────────────────────
    def _ga4(self, c: dict, rapport: dict) -> None:
        A = self._acces_google(c, rapport)
        if not A:
            return
        api, n, F = rapport["api"], self.n, self.fenetre
        api["ga4/insights"], _ = _mesure(lambda: ga4_insights.recuperer(A, F, limite=n))
        api["ga4/evenements"], _ = _mesure(lambda: ga4_evenements.recuperer(A, F, limite=n))
        api["ga4/catalogue"], _ = _mesure(lambda: ga4_catalogue.recuperer(A, F, limite=n))
        tout, trous = ga4_insights.recuperer(A, F)
        total, err = ga4_insights.total_sessions(A, F)
        rapport["controles"]["ga4/sessions"] = (
            {"verdict": "non vérifiable", "raison": " | ".join(trous)} if trous else
            _controle("sessions_propriete", total, err,
                      float(sum(r.get("sessions") or 0 for r in tout)), montant=False))

    # ── la sortie ─────────────────────────────────────────────────────────
    def ecrire(self, rapport: dict) -> Path:
        self.dossier.mkdir(parents=True, exist_ok=True)
        chemin = self.dossier / f"essai-{self.uid[:8]}-{datetime.utcnow():%Y%m%d-%H%M%S}.json"
        chemin.write_text(json.dumps(rapport, ensure_ascii=False, indent=2, default=str))
        return chemin


def resume(rapport: dict) -> str:
    """Les lignes que David lit dans le terminal — le détail est dans le JSON."""
    lignes = [f"Essai {rapport['compte']} · {rapport['fenetre'][0]} → {rapport['fenetre'][1]}"
              f" · N = {rapport['n']}"]
    for canal, raison in rapport["sautes"].items():
        lignes.append(f"  ·  {canal:<28} sauté — {raison}")
    for nom, r in rapport["api"].items():
        etat = "ok " if r["lu"] else "TROU"
        detail = f"{r['elements']} élément(s)" + (f" — {r['trous'][0]}" if r["trous"] else "")
        lignes.append(f"  {etat} {nom:<28} {detail}")
    for nom, c in rapport["controles"].items():
        if c["verdict"] == "non vérifiable":
            lignes.append(f"  ?    {nom:<28} non vérifiable — {c.get('raison')}")
        else:
            lignes.append(f"  {'=' if c['verdict'] == 'complet' else '≠'}    {nom:<28} "
                          f"{c['verdict']} : lu {c['lu']}, écart {c['ecart']}")
    return "\n".join(lignes)


def main(argv: list[str] | None = None) -> int:
    lecteur = argparse.ArgumentParser(description="Essai : N éléments par API, rien en base.")
    lecteur.add_argument("--user", metavar="UID", required=True)
    lecteur.add_argument("-n", type=int, default=5, help="éléments par API (défaut 5)")
    lecteur.add_argument("--plateforme", choices=PLATEFORMES, action="append",
                         help="à répéter ; défaut : toutes")
    args = lecteur.parse_args(argv)
    if not args.user.strip() or args.n < 1:
        print("!! --user non vide et -n ≥ 1.")
        return 1
    essai = Essai(args.user, args.n, args.plateforme or PLATEFORMES)
    rapport = essai.executer()
    chemin = essai.ecrire(rapport)
    print(resume(rapport))
    print(f"→ {chemin}")
    trou = any(not r["lu"] for r in rapport["api"].values()) or any(
        c["verdict"] != "complet" for c in rapport["controles"].values())
    return 1 if trou else 0


if __name__ == "__main__":
    sys.exit(main())
