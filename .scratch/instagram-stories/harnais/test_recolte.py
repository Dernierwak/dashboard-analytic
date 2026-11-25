"""Ticket 01 — la récolte des stories, sans réseau et sans base.

Lancer depuis la racine du dépôt :

    python3.12 -I .scratch/instagram-stories/harnais/test_recolte.py

L'API Graph, le CDN des vignettes et Supabase sont simulés. Les réponses Graph
reprennent la forme lue par l'essai réel du 2026-11-25 (`issues/02`) :
`data[0].values[0].value` pour une métrique, `total_value.breakdowns` pour
`navigation` ventilée. Rien ne part chez Meta, rien ne s'écrit chez Supabase.
"""
from __future__ import annotations

import contextlib
import io
import json
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

RACINE = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(RACINE))

from PIL import Image  # noqa: E402

from saas.data.fetch_data.cockpit import instagram_stories as cockpit  # noqa: E402
from saas.data.fetch_data.shared import http_client  # noqa: E402
from saas.data.fetch_data.sources.meta.instagram import releve_compte  # noqa: E402
from saas.data.supabase.source_data import instagram_compte  # noqa: E402

JETON = "JETON-SIMULE-7f3a9c"      # cherché dans toutes les sorties à la fin
JETON_B = "JETON-SIMULE-B-41d2"
UID, UID_B, UID_C = ("11111111-1111-1111-1111-111111111111",
                     "22222222-2222-2222-2222-222222222222",
                     "33333333-3333-3333-3333-333333333333")
MAINTENANT = datetime(2026, 11, 25, 15, 17, tzinfo=timezone.utc)

ECHECS: list[str] = []


def verifier(nom, obtenu, attendu):
    ok = obtenu == attendu
    print(("✓ " if ok else "✗ ") + nom + ("" if ok else f"\n    obtenu  : {obtenu!r}\n    attendu : {attendu!r}"))
    if not ok:
        ECHECS.append(nom)


def ts(heures_de_vie: float) -> str:
    return (MAINTENANT - timedelta(hours=heures_de_vie)).strftime("%Y-%m-%dT%H:%M:%S+0000")


def jpeg(largeur: int, hauteur: int) -> bytes:
    sortie = io.BytesIO()
    Image.new("RGB", (largeur, hauteur), (200, 30, 90)).save(sortie, format="PNG")
    return sortie.getvalue()


# ── L'API Graph et le CDN simulés ────────────────────────────────────────────

class Reponse:
    def __init__(self, corps=None, status=200, contenu=None):
        self._corps, self.status_code = corps, status
        self.content = contenu if contenu is not None else json.dumps(corps).encode()
        self.headers = {}

    def json(self):
        return self._corps


def valeur(nom, v):
    return {"data": [{"name": nom, "period": "lifetime", "values": [{"value": v}],
                      "id": f"x/insights/{nom}/lifetime"}]}


NAV = {"data": [{"name": "navigation", "values": [{"value": 373}], "total_value": {
    "value": 373, "breakdowns": [{"dimension_keys": ["story_navigation_action_type"], "results": [
        {"dimension_values": ["swipe_forward"], "value": 4},
        {"dimension_values": ["tap_forward"], "value": 307},
        {"dimension_values": ["tap_exit"], "value": 47},
        {"dimension_values": ["tap_back"], "value": 15}]}]}}]}

STORIES_A = {
    "page1": [
        # Nouvelle, 2 h de vie, image de 1080 px : ajoutée, vignette réduite.
        {"id": "S_NEUVE", "media_type": "IMAGE", "media_product_type": "STORY",
         "media_url": "https://cdn.test/neuve.jpg", "timestamp": ts(2), "permalink": "https://ig/neuve"},
        # 21 h de vie, déjà en base : relue, une métrique en erreur, une vide.
        {"id": "S_21H", "media_type": "IMAGE", "media_product_type": "STORY",
         "media_url": "https://cdn.test/21h.jpg", "timestamp": ts(21), "permalink": "https://ig/21h"},
    ],
    "page2": [
        # Vidéo sans media_url (son sous droits, essai point 1) : la vignette
        # vient de thumbnail_url ; 22 h de vie et nouvelle : ajoutée ET relevée.
        {"id": "S_VIDEO", "media_type": "VIDEO", "media_product_type": "STORY",
         "thumbnail_url": "https://cdn.test/video-thumb.jpg", "timestamp": ts(22),
         "permalink": "https://ig/video"},
        # Vidéo sans aucune URL d'image : image_path NULL.
        {"id": "S_SANS_IMAGE", "media_type": "VIDEO", "media_product_type": "STORY",
         "timestamp": ts(5), "permalink": "https://ig/sans"},
        # 23 h, Meta refuse TOUT (jeton) : relevé précédent gardé.
        {"id": "S_PANNE", "media_type": "IMAGE", "media_product_type": "STORY",
         "media_url": "https://cdn.test/panne.jpg", "timestamp": ts(23), "permalink": "https://ig/panne"},
    ],
}

APPELS: list[tuple[str, dict]] = []


def faux_get(url, *, timeout, params=None, headers=None):
    assert timeout, "timeout obligatoire"
    params = dict(params or {})
    APPELS.append((url, params))
    if "access_token=" in url:
        raise AssertionError("une URL `paging.next` a été suivie")
    hote = urlparse(url).hostname
    if hote == "cdn.test":
        if url.endswith("video-thumb.jpg"):
            return Reponse(contenu=jpeg(480, 854))
        return Reponse(contenu=jpeg(1080, 1920))
    jeton = params.get("access_token")
    chemin = urlparse(url).path.split("/v24.0/")[-1]
    if chemin == "IG_B/stories":
        # Connexion B : Meta cite le jeton NU dans son message d'erreur.
        return Reponse({"error": {"code": 190, "message": f"Invalid OAuth access token {jeton}"}})
    if chemin == "IG_C/stories":
        # Connexion C : coupure réseau, l'exception recopie l'URL et le jeton.
        raise ConnectionError(f"Max retries exceeded with url: /v24.0/IG_C/stories?access_token={jeton}")
    if chemin == "IG_A/stories":
        if params.get("after") == "CURSEUR2":
            return Reponse({"data": STORIES_A["page2"],
                            "paging": {"cursors": {"before": "B", "after": "FIN"}}})
        return Reponse({"data": STORIES_A["page1"], "paging": {
            "cursors": {"before": "A", "after": "CURSEUR2"},
            "next": f"https://graph.facebook.com/v24.0/IG_A/stories?access_token={jeton}&after=CURSEUR2"}})
    if chemin.endswith("/insights"):
        story, metrique = chemin.split("/")[0], params["metric"]
        if story == "S_PANNE":
            return Reponse({"error": {"code": 190, "message": f"Error validating access token: {jeton}"}})
        if story == "S_21H" and metrique == "shares":
            return Reponse({"error": {"code": 100, "message": "(#100) metric not available"}})
        if story == "S_21H" and metrique == "follows":
            return Reponse({"data": []})
        if metrique == "navigation":
            return Reponse(NAV)
        return Reponse(valeur(metrique, {"reach": 346, "views": 461, "link_clicks": 0}.get(metrique, 3)))
    raise AssertionError(f"appel inattendu : {chemin}")


http_client.get = faux_get


# ── Supabase simulé ──────────────────────────────────────────────────────────

class Requete:
    def __init__(self, base, table):
        self.base, self.table, self.filtres, self.op = base, table, [], None
        self.negation = False

    def select(self, colonnes):
        self.op = ("select", colonnes)
        return self

    @property
    def not_(self):
        self.negation = True
        return self

    def is_(self, colonne, valeur):
        neg, self.negation = self.negation, False
        self.filtres.append(lambda r: (r.get(colonne) is None) != neg)
        return self

    def eq(self, colonne, valeur):
        self.filtres.append(lambda r: r.get(colonne) == valeur)
        return self

    def in_(self, colonne, valeurs):
        self.filtres.append(lambda r: r.get(colonne) in valeurs)
        return self

    def upsert(self, lignes, on_conflict=None, ignore_duplicates=False):
        self.op = ("upsert", lignes, on_conflict, ignore_duplicates)
        return self

    def update(self, valeurs):
        self.op = ("update", valeurs)
        return self

    def execute(self):
        return self.base.executer(self)


class Resultat:
    def __init__(self, data):
        self.data = data


class Stockage:
    def __init__(self):
        self.fichiers = {}

    def from_(self, bucket):
        stockage = self

        class Seau:
            def upload(self, path, file, file_options):
                stockage.fichiers[(bucket, path)] = (file, file_options)
        return Seau()


class FausseBase:
    def __init__(self, tables, absentes=(), colonnes_absentes=()):
        self.tables, self.absentes, self.colonnes_absentes = tables, set(absentes), set(colonnes_absentes)
        self.storage, self.ecritures = Stockage(), []

    def table(self, nom):
        return Requete(self, nom)

    def executer(self, q):
        if q.table in self.absentes:
            raise Exception("{'code': 'PGRST205', 'message': \"Could not find the table "
                            f"'public.{q.table}' in the schema cache\"}}")
        lignes = self.tables.setdefault(q.table, [])
        if q.op[0] == "select":
            return Resultat([dict(r) for r in lignes if all(f(r) for f in q.filtres)])
        if q.op[0] == "update":
            touchees = [r for r in lignes if all(f(r) for f in q.filtres)]
            for r in touchees:
                r.update(q.op[1])
            self.ecritures.append((q.table, "update", q.op[1]))
            return Resultat(touchees)
        _, envoi, conflit, ignorer = q.op
        envoi = envoi if isinstance(envoi, list) else [envoi]
        for ligne in envoi:
            for c in self.colonnes_absentes:
                if c in ligne:
                    raise Exception("{'code': 'PGRST204', 'message': \"Could not find the "
                                    f"'{c}' column of '{q.table}' in the schema cache\"}}")
        cles = conflit.split(",")
        for ligne in envoi:
            self.ecritures.append((q.table, "upsert", dict(ligne)))
            existante = next((r for r in lignes if all(r.get(k) == ligne.get(k) for k in cles)), None)
            if existante is None:
                lignes.append({"vue_le": "now()", **ligne} if q.table == "instagram_stories" else dict(ligne))
            elif not ignorer:
                existante.update(ligne)
        return Resultat(envoi)


def connexions_de_test():
    return [
        {"id": 1, "user_id": UID, "instagram_business_id": "IG_A", "meta_token": JETON},
        # Doublon exact de la connexion A : relu une seule fois.
        {"id": 2, "user_id": UID, "instagram_business_id": "IG_A", "meta_token": JETON},
        {"id": 3, "user_id": UID_B, "instagram_business_id": "IG_B", "meta_token": JETON_B},
        {"id": 4, "user_id": UID_C, "instagram_business_id": "IG_C", "meta_token": JETON},
        # Sans jeton : ignorée.
        {"id": 5, "user_id": UID_C, "instagram_business_id": "IG_D", "meta_token": None},
        # Sans Instagram : ignorée.
        {"id": 6, "user_id": UID_C, "instagram_business_id": None, "meta_token": JETON},
    ]


def stories_en_base():
    # S_21H et S_PANNE déjà vues à une heure précédente ; S_PANNE porte un
    # relevé d'il y a une heure, qui ne doit pas être écrasé par des NULL.
    return [
        {"user_id": UID, "story_id": "S_21H", "publiee_a": ts(21), "image_path": f"{UID}/S_21H.jpg"},
        {"user_id": UID, "story_id": "S_PANNE", "publiee_a": ts(23), "image_path": f"{UID}/S_PANNE.jpg",
         "releve_a": ts(1), "age_heures": 22.0, "reach": 999},
    ]


SORTIES: list[str] = []


def lancer(base, argv=None):
    tampon = io.StringIO()
    with contextlib.redirect_stdout(tampon), contextlib.redirect_stderr(tampon):
        code = cockpit.main(argv or [], sb=base, maintenant=MAINTENANT)
    SORTIES.append(tampon.getvalue())
    return code, tampon.getvalue()


# ── 1. Le passage horaire complet ────────────────────────────────────────────

base = FausseBase({"connected_accounts": connexions_de_test(), "instagram_stories": stories_en_base()})
code, sortie = lancer(base)
print("── journal du passage simulé ──")
print(sortie.rstrip())
print("───────────────────────────────")
lignes = {r["story_id"]: r for r in base.tables["instagram_stories"]}

verifier("code de sortie 0 : une connexion sur trois tient", code, 0)
verifier("connexions retenues : doublon et sans-jeton écartés",
         len([l for l in sortie.splitlines() if "→" in l]), 3)
verifier("journal du compte A : vues / nouvelles / relues",
         "stories: 5 vues, 3 nouvelles, 2 relues" in sortie, True)

pages = [p for u, p in APPELS if u.endswith("IG_A/stories")]
verifier("pagination : deuxième page par le curseur `after`",
         [p.get("after") for p in pages], [None, "CURSEUR2"])
verifier("pagination : `paging.next` jamais suivi",
         any("access_token=" in u for u, _ in APPELS), False)

# Story nouvelle
neuve = lignes.get("S_NEUVE", {})
verifier("story nouvelle : ligne ajoutée avec sa date et son lien",
         (neuve.get("publiee_a"), neuve.get("permalink"), neuve.get("media_type")),
         ("2026-11-25T13:17:00+00:00", "https://ig/neuve", "IMAGE"))
verifier("story nouvelle : chemin {user_id}/{story_id}.jpg", neuve.get("image_path"), f"{UID}/S_NEUVE.jpg")
fichier, options = base.storage.fichiers[("instagram-stories", f"{UID}/S_NEUVE.jpg")]
with Image.open(io.BytesIO(fichier)) as im:
    verifier("vignette : JPEG de 720 px de large", (im.format, im.size), ("JPEG", (720, 1280)))
verifier("vignette : content-type image/jpeg", options.get("content-type"), "image/jpeg")
verifier("story de 2 h : pas relevée", neuve.get("releve_a"), None)

# Story de 21 h relue
r21 = lignes["S_21H"]
verifier("story de 21 h : relevé daté de l'heure du passage",
         (r21.get("releve_a"), r21.get("age_heures")), (MAINTENANT.isoformat(), 21.0))
verifier("story de 21 h : chiffres rendus", (r21.get("reach"), r21.get("views")), (346, 461))
verifier("story de 21 h : un 0 rendu reste 0 (link_clicks)", r21.get("link_clicks"), 0)
verifier("métrique en erreur → NULL (shares)", ("shares" in r21, r21.get("shares")), (True, None))
verifier("métrique au jeu vide → NULL (follows)", ("follows" in r21, r21.get("follows")), (True, None))
verifier("les autres métriques tiennent (profile_visits)", r21.get("profile_visits"), 3)
verifier("navigation ventilée → quatre colonnes",
         [r21.get(c) for c in ("nav_tap_forward", "nav_tap_back", "nav_tap_exit", "nav_swipe_forward")],
         [307, 15, 47, 4])
verifier("pas de colonne replies", "replies" in r21, False)
verifier("une métrique par appel", all("," not in p.get("metric", "") for u, p in APPELS
                                       if u.endswith("/insights")), True)
verifier("replies jamais demandé", any(p.get("metric") == "replies" for _, p in APPELS), False)
verifier("story déjà en base : pas réinsérée",
         [e for e in base.ecritures if e[1] == "upsert" and e[2].get("story_id") == "S_21H"
          and "releve_a" not in e[2]], [])

# Vidéos
video = lignes["S_VIDEO"]
verifier("vidéo sans media_url : vignette depuis thumbnail_url", video.get("image_path"), f"{UID}/S_VIDEO.jpg")
with Image.open(io.BytesIO(base.storage.fichiers[("instagram-stories", f"{UID}/S_VIDEO.jpg")][0])) as im:
    verifier("vignette plus étroite que 720 px : pas agrandie", im.size, (480, 854))
verifier("vidéo nouvelle de 22 h : ajoutée ET relevée", (video.get("age_heures"), video.get("reach")), (22.0, 346))
verifier("vidéo sans aucune URL d'image : image_path NULL",
         ("image_path" in lignes["S_SANS_IMAGE"], lignes["S_SANS_IMAGE"].get("image_path")), (True, None))
verifier("aucun téléchargement de la vidéo elle-même",
         [u for u, _ in APPELS if urlparse(u).hostname == "cdn.test" and "thumb" not in u
          and "neuve" not in u], [])

# Panne totale sur une story
panne = lignes["S_PANNE"]
verifier("métriques toutes refusées : relevé précédent gardé, pas de NULL par-dessus",
         (panne.get("reach"), panne.get("age_heures")), (999, 22.0))
verifier("journal : la panne se dit", "refusé(s) en entier par Meta" in sortie, True)

# Connexions en erreur
verifier("connexion B (jeton nu dans le message Meta) : en erreur, journalisée",
         "stories KO" in sortie and UID_B in sortie, True)
verifier("connexion C (exception avec l'URL) : en erreur, journalisée",
         sortie.count("stories KO"), 2)

# ── 2. Base sans la section 27 ───────────────────────────────────────────────
base_vide = FausseBase({"connected_accounts": connexions_de_test()[:1]}, absentes={"instagram_stories"})
code, sortie = lancer(base_vide)
verifier("table absente : code 1 et message qui nomme la section 27",
         (code, "section 27" in sortie), (1, True))

# ── 3. Toutes les connexions en erreur → code 1 ─────────────────────────────
base_ko = FausseBase({"connected_accounts": connexions_de_test()[2:4], "instagram_stories": []})
code, _ = lancer(base_ko)
verifier("toutes les connexions en erreur : code 1", code, 1)

# ── 4. Le relevé quotidien : reach_story depuis la réponse ventilée ─────────

def ventilee(*paires):
    return {"data": [{"name": "reach", "total_value": {"breakdowns": [{
        "dimension_keys": ["media_product_type"],
        "results": [{"dimension_values": [d], "value": v} for d, v in paires]}]}}]}


hier = date(2026, 11, 24)
ligne = releve_compte.ligne_du_jour(UID, hier, {
    "reach": ({"data": [{"total_value": {"value": 9000}}]}, None),
    "reach_ventile": (ventilee(("POST", 3000), ("STORY", 2088), ("AD", 500)), None),
    "interactions": ({"data": [{"total_value": {"value": 120}}]}, None),
    "interactions_ventile": (ventilee(("POST", 100), ("REEL", 20)), None),
})
verifier("relevé quotidien : reach_story = la part STORY", ligne.get("reach_story"), 2088)
verifier("relevé quotidien : reach_ad inchangé", ligne.get("reach_ad"), 500)
verifier("relevé quotidien : STORY absente → interactions_story NULL",
         ("interactions_story" in ligne, ligne.get("interactions_story")), (True, None))
ligne_panne = releve_compte.ligne_du_jour(UID, hier, {
    "reach": ({"data": [{"total_value": {"value": 9000}}]}, None),
    "reach_ventile": (None, "erreur Meta"),
})
verifier("relevé quotidien : appel ventilé en erreur → colonne non envoyée",
         "reach_story" in ligne_panne, False)

base_sans_27 = FausseBase({}, colonnes_absentes={"reach_story", "interactions_story"})
tampon = io.StringIO()
with contextlib.redirect_stdout(tampon):
    ecrit = instagram_compte.ecrire_jours_du_compte(base_sans_27, [ligne])
SORTIES.append(tampon.getvalue())
verifier("colonnes de la section 27 absentes : le jour s'écrit sans elles",
         (ecrit, base_sans_27.tables["instagram_compte_jours"][0].get("reach"),
          "reach_story" in base_sans_27.tables["instagram_compte_jours"][0]), (True, 9000, False))
verifier("colonnes absentes : le message nomme la section 27", "section 27" in tampon.getvalue(), True)

# ── 4bis. Moins de 5 spectateurs, et vignette rattrapée ────────────────────
from saas.data.fetch_data.sources.meta.instagram.fetchers import stories as graph_stories  # noqa: E402

r10 = graph_stories.Releve()
for m in graph_stories.METRIQUES + ("navigation",):
    r10.refus[m], r10.codes[m] = "Not enough viewers", 10
verifier("code 10 partout (moins de 5 spectateurs) : absence mesurée, pas une panne",
         r10.en_panne(), False)
r190 = graph_stories.Releve()
for m in graph_stories.METRIQUES + ("navigation",):
    r190.refus[m], r190.codes[m] = "jeton", 190
verifier("code 190 partout : panne", r190.en_panne(), True)

base_vignette = FausseBase({"connected_accounts": connexions_de_test()[:1], "instagram_stories": [
    {"user_id": UID, "story_id": "S_NEUVE", "publiee_a": ts(2), "image_path": None}]})
lancer(base_vignette)
verifier("vignette ratée à l'arrivée : rattrapée au passage suivant",
         next(r for r in base_vignette.tables["instagram_stories"] if r["story_id"] == "S_NEUVE")
         .get("image_path"), f"{UID}/S_NEUVE.jpg")

# ── 5. Le jeton n'apparaît nulle part ────────────────────────────────────────
# `connected_accounts` est l'entrée simulée (elle porte le jeton par
# construction) : on cherche dans tout ce que la récolte a produit.
produit = {t: l for t, l in base.tables.items() if t != "connected_accounts"}
tout = "\n".join(SORTIES) + json.dumps(produit, default=str) + json.dumps(
    base.ecritures, default=str) + repr(base.storage.fichiers.keys())
verifier("jeton absent de toute sortie et de toute écriture",
         (JETON in tout, JETON_B in tout), (False, False))

print()
print(f"{'AUCUN ÉCHEC' if not ECHECS else f'{len(ECHECS)} ÉCHEC(S)'}")
sys.exit(1 if ECHECS else 0)
