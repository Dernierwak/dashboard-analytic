# 03: La récolte des insights recopie Meta

Type: task
Status: ready-for-human
Blocked by: 02

**What to build:** chaque ligne d'insights récoltée porte l'identité Meta de sa
campagne et de son groupe d'annonces, la colonne « Résultats » d'Ads Manager telle
que Meta la rend, et son réglage d'attribution ; et un jour récolté est relu tant
que Meta le corrige. Spec : § « Les conversions », § « La fraîcheur »,
§ « L'identité par ID » ; user stories 2, 52, 57, 58.

Seam de test : « réponse Meta → lignes à écrire », sans appel réseau. Le ticket
**écrit son harnais** (prior art : `_traduire_meta`, déjà pur ; style des harnais
du traitement, dans l'historique git).

- [x] La requête `/insights` demande `campaign_id`, `adset_id`, `results` et
      `attribution_setting` — zéro appel de plus
- [x] `results` absent → `NULL` ; liste vide → liste vide ; jamais `0` (testé)
- [x] Deux annonces homonymes restent deux lignes (testé)
- [x] Le recouvrement Meta passe de 7 à 28 jours ; son commentaire dit la vraie
      raison (Meta corrige jusqu'à 28 jours, `action_report_time=mixed`) et l'ancien
      (« conversion au jour du CLIC ») disparaît
- [x] `python3.12 -m py_compile` sur ce qui a été touché
- [x] **Après un passage du worker** — `weekly-fetch.yml` lancé à la main avec
      `force` : les 28 derniers jours portent IDs, `results` et attribution dans la
      base ; la forme réelle d'un élément de `results` est recopiée dans ce ticket
      (elle fixe le ticket 10)
- [x] **Rejeu** (compte `11043e9a` seulement, voir plus bas) — `weekly-fetch.yml` avec `meta_since` à la plus vieille date en
      base : les lignes anciennes ont leurs IDs. Aucune n'est remplie par une
      jointure sur le nom. Le nombre de lignes encore sans ID est écrit ici

## Comment

**2026-10-03 — écrit et vérifié hors ligne. Reste le passage du worker, qui
attend le `000` du ticket 02.**

Ce qui a changé :
- `saas/collecte/meta/fetch_meta_ads.py` : **`lignes_meta_ads(user_id, reponse)`**,
  le seam « réponse Meta → lignes à écrire », pur, à côté de `_traduire_meta`.
  Il recopie `campaign_id`, `adset_id`, `attribution_setting` et `results` tels
  que Meta les rend (absent → `None`, liste vide → `[]`), dédoublonne sur
  `(date_start, ad_id)` et compte les lignes sans `ad_id`. Le calcul de
  `link_clicks` y a déménagé depuis `fetch_all`, **sans changement** : son
  `else 0` est le défaut déjà ouvert en `.scratch/corrections/issues/01`.
- `saas/commun/insert_data.py` : `upsert_meta_ads` ne fait plus qu'écrire des
  lignes déjà formées (la revue a relevé que la lecture du JSON Meta n'avait
  rien à faire dans `commun/`, qui « lit et écrit, point »).
- `saas/collecte/automatisation/fetch_all.py` :
  - `_meta_chunk` demande `campaign_id,adset_id,results,attribution_setting`
    dans la même requête `/insights` ;
  - `_RECOUVREMENT_JOURS_META = 28`, commentaire réécrit (borne « do not change
    after 28 days », `action_report_time=mixed`, sources de
    `recherche/champs-api-meta.md` §3) ; « conversion au jour du CLIC » a disparu
    pour Meta ;
  - le coût est recompté honnêtement : ~700 lignes pour 20 pubs, donc **une
    page de pagination de plus** par passage (pas une tranche de plus) ; même
    correction dans `saas/collecte/CLAUDE.md` ;
  - le garde-fou de schéma (`_colonnes_meta_presentes`) vérifie désormais les
    cinq colonnes écrites, pas seulement `ad_id`.

**⚠ Conséquence du garde-fou, à lire avant de merger.** Tant que le `000` du
ticket 02 n'est pas joué sur Supabase, chaque passage du worker finit **rouge**
et n'écrit **aucune** ligne d'insights Meta (budgets et changements, eux,
passent). C'est voulu : sans garde-fou, PostgREST refuserait l'upsert entier
(PGRST204) et la semaine de dépense disparaîtrait de façon moins lisible. Mais
**l'ordre est donc : David joue le `000` (ticket 02), puis on merge dans `main`.**

**Vérifié** : harnais ci-dessous, **39/39** (rouge avant l'implémentation) ;
`python3.12 -m py_compile` sur les quatre fichiers touchés. Revue de code en
deux axes : spec — rien de manquant ni de faux ; normes — placement corrigé,
nom de constante, sources citées en chemin complet, « 28 » lu dans la constante.
Laissé en l'état et signalé : `impressions`, `clicks`, `spend` gardent leur
`or 0` d'avant ce ticket (même famille que le défaut `link_clicks`).

**Pas vérifié** — et ne peut l'être que par un passage du worker :
1. David joue le `000` (ticket 02) ;
2. GitHub Actions → `weekly-fetch.yml` → *Run workflow* avec **`force`** :
   les 28 derniers jours doivent porter IDs, `results` et attribution ; copier
   ici la forme réelle d'un élément de `results` (elle fixe le ticket 10) ;
3. puis **`meta_since`** à la plus vieille date en base (le rejeu) ; compter
   ici les lignes encore sans `campaign_id` :
   `select count(*) from meta_ads_insights where campaign_id is null;`

<details><summary>Le harnais (hors de l'arbre, comme celui du ticket 02) — à
coller dans un fichier et à lancer depuis la racine du dépôt avec
<code>python3.12</code></summary>

```python
"""Harnais du ticket 03 — « réponse Meta → lignes à écrire », sans réseau.

Hors de l'arbre, comme celui du ticket 02 (la base propre du 2026-10-01).
Se joue depuis la racine du worktree :
    python3.12 <chemin>/test_insights_meta.py
"""
import json
import os
import sys
from datetime import date

sys.path.insert(0, os.getcwd())

from saas.commun import insert_data                       # noqa: E402
from saas.collecte.meta import fetch_meta_ads            # noqa: E402
from saas.collecte.automatisation import fetch_all        # noqa: E402

_N, _KO = 0, []


def egal(nom, obtenu, attendu):
    global _N
    _N += 1
    if obtenu != attendu:
        _KO.append(f"{nom} — obtenu {obtenu!r}, attendu {attendu!r}")


def ligne_meta(**k):
    """Une ligne de /insights au niveau `ad`. La forme de `results` est
    INVENTÉE — la vraie se lit après le passage du worker ; le seam la recopie
    sans la lire, donc le test ne dépend pas d'elle."""
    base = {
        "campaign_name": "Camp A", "campaign_id": "120001",
        "adset_name": "Groupe 1", "adset_id": "230001",
        "ad_name": "Video 1", "ad_id": "340001",
        "impressions": "1000", "clicks": "12", "reach": "800", "spend": "16.40",
        "actions": [{"action_type": "link_click", "value": "9"}],
        "attribution_setting": "7d_click_1d_view",
        "results": [{"indicator": "actions:link_click", "values": [{"value": "9"}]}],
        "date_start": "2026-09-30", "date_stop": "2026-09-30",
    }
    base.update(k)
    return base


lignes = fetch_meta_ads.lignes_meta_ads


# ── L'identité Meta voyage sur chaque ligne ──────────────────────────────────
(l,), _ = lignes("u1", [ligne_meta()])
egal("campaign_id recopié", l["campaign_id"], "120001")
egal("adset_id recopié", l["adset_id"], "230001")
egal("ad_id recopié", l["ad_id"], "340001")
egal("attribution recopiée", l["attribution_setting"], "7d_click_1d_view")
egal("results recopié brut", l["results"],
     [{"indicator": "actions:link_click", "values": [{"value": "9"}]}])
egal("dépense", l["spend"], 16.40)
egal("link_clicks lu dans actions", l["link_clicks"], 9)
egal("date_stop ne se stocke pas", "date_stop" in l, False)
egal("actions ne se stocke pas", "actions" in l, False)

# ── results : absent → NULL, vide → vide, jamais 0 ───────────────────────────
sans = ligne_meta()
del sans["results"]
(l,), _ = lignes("u1", [sans])
egal("results absent → None", l["results"], None)
(l,), _ = lignes("u1", [ligne_meta(results=[])])
egal("results vide → liste vide", l["results"], [])
egal("results vide n'est pas 0", l["results"] == 0, False)
egal("results vide s'écrit [] en JSON", json.dumps(l["results"]), "[]")

# ── attribution absente → NULL, pas une valeur par défaut ────────────────────
sans = ligne_meta()
del sans["attribution_setting"]
(l,), _ = lignes("u1", [sans])
egal("attribution absente → None", l["attribution_setting"], None)

# ── IDs absents → NULL, jamais reconstitués depuis le nom ────────────────────
sans = ligne_meta()
del sans["campaign_id"], sans["adset_id"]
(l,), _ = lignes("u1", [sans])
egal("campaign_id absent → None", l["campaign_id"], None)
egal("adset_id absent → None", l["adset_id"], None)

# ── Deux annonces homonymes restent deux lignes ──────────────────────────────
rec, _ = lignes("u1", [
    ligne_meta(ad_id="340001", adset_id="230001", spend="17.00"),
    ligne_meta(ad_id="340002", adset_id="230002", spend="15.00"),
])
egal("homonymes : deux lignes", len(rec), 2)
egal("homonymes : la dépense de la seconde entre",
     sorted(r["spend"] for r in rec), [15.0, 17.0])
egal("homonymes : chacune son groupe", sorted(r["adset_id"] for r in rec),
     ["230001", "230002"])

# ── Une même annonce un même jour ne s'écrit qu'une fois ; sans ad_id, écartée
rec, sans_id = lignes("u1", [ligne_meta(), ligne_meta(), ligne_meta(ad_id=None)])
egal("doublon (jour, annonce) dédoublonné", len(rec), 1)
egal("ligne sans ad_id comptée", sans_id, 1)

# ── La requête /insights demande les quatre champs, en UN appel ──────────────
appels = []


class _Rep:
    def __init__(self, d):
        self._d = d

    def json(self):
        return self._d


def faux_get(url, params=None, timeout=None):
    appels.append((url, params))
    return _Rep({"data": [ligne_meta()]})


vrai_get = fetch_all.requests.get
fetch_all.requests.get = faux_get
try:
    rows, err = fetch_all._meta_chunk("JETON", "act_42", "2026-09-01", "2026-09-30")
finally:
    fetch_all.requests.get = vrai_get
egal("une seule requête", len(appels), 1)
egal("vers /insights", appels[0][0].endswith("/act_42/insights"), True)
champs = set(appels[0][1]["fields"].split(","))
for c in ("campaign_id", "adset_id", "results", "attribution_setting", "ad_id"):
    egal(f"le champ {c} est demandé", c in champs, True)
egal("pas de date_stop demandé", "date_stop" in champs, False)
egal("la tranche est complète", err, None)

# ── Le recouvrement : 28 jours ───────────────────────────────────────────────
egal("recouvrement Meta = 28", fetch_all._RECOUVREMENT_JOURS_META, 28)
egal("reprise à latest − 28",
     fetch_all._depart_recolte("2026-09-30", date(2026, 10, 3),
                               fetch_all._RECOUVREMENT_JOURS_META),
     date(2026, 9, 2))


# ── Le garde-fou de schéma voit les colonnes neuves ──────────────────────────
class _Err(Exception):
    def __init__(self, code):
        self.code = code


class _FauxSb:
    def __init__(self, colonnes):
        self.colonnes = colonnes
        self.lu = None

    def table(self, _):
        return self

    def select(self, cols):
        self.lu = cols
        return self

    def limit(self, _):
        return self

    def execute(self):
        if any(c.strip() not in self.colonnes for c in self.lu.split(",")):
            raise _Err("42703")
        return None


toutes = {"ad_id", "campaign_id", "adset_id", "attribution_setting", "results"}
egal("schéma complet → présent",
     fetch_all._colonnes_meta_presentes(_FauxSb(toutes)), True)
egal("000 du ticket 02 pas joué → absent",
     fetch_all._colonnes_meta_presentes(_FauxSb({"ad_id"})), False)


# ── Jusqu'au lot réellement envoyé à la base ─────────────────────────────────
class _SbEcrit:
    def __init__(self):
        self.envoye = []
        self.conflit = None

    def table(self, _):
        return self

    def delete(self):
        return self

    def eq(self, *_):
        return self

    def is_(self, *_):
        return self

    def in_(self, *_):
        return self

    def upsert(self, lot, on_conflict=None):
        self.envoye += lot
        self.conflit = on_conflict
        return self

    def execute(self):
        return None


sans = ligne_meta(ad_id="340002")
del sans["results"]
rec, _ = lignes("u1", [ligne_meta(results=[]), sans])
sb = _SbEcrit()
insert_data.upsert_meta_ads(sb, "u1", rec)
par_ad = {r["ad_id"]: r for r in sb.envoye}
egal("envoyé : deux lignes", len(sb.envoye), 2)
egal("envoyé : clé de conflit", sb.conflit, "user_id,date_start,ad_id")
egal("envoyé : results vide reste []", par_ad["340001"]["results"], [])
egal("envoyé : results absent reste None", par_ad["340002"]["results"], None)
egal("envoyé : IDs et attribution",
     (par_ad["340001"]["campaign_id"], par_ad["340001"]["adset_id"],
      par_ad["340001"]["attribution_setting"]),
     ("120001", "230001", "7d_click_1d_view"))

print(f"\nticket 03 : {_N - len(_KO)}/{_N} vérifications passent")
for m in _KO:
    print(f"  ✗ {m}")
sys.exit(1 if _KO else 0)
```

</details>

**2026-10-03/04 — passage du worker et rejeu faits, sur le code de la branche.**

Le `000` est joué (ticket 02). Deux lancements de `weekly-fetch.yml` à la main,
`--ref worktree-meta-ads-tickets-construction`, compte `11043e9a-…` seulement
(choisi par David) — **pas `force`**, qui fait passer tous les comptes et
publie leur rapport. Le journal dit « email dry : non envoyé (mode test) ».
- run `37156455844`, `user_id` : vert, 269 lignes Meta (28 jours) ;
- run `37156805694`, `user_id` + `meta_since=2025-05-18` : vert, 5 751 lignes.

**La forme réelle de `results`** (elle fixe le ticket 10) — toujours une liste
d'UN élément :
```json
[{"indicator": "actions:omni_landing_page_view",
  "values": [{"attribution_windows": ["default"], "value": "45"}]}]
[{"indicator": "actions:omni_landing_page_view"}]
[{"indicator": "total_profile_visits", "values": [{"value": "57"}]}]
```
- Meta n'écrit **jamais `"0"`** : un zéro est l'indicateur sans `values`
  (1 698 lignes de vues de page de destination ; les 8 lignes d'appels n'ont
  jamais de nombre).
- Types vus : `actions:omni_landing_page_view` (5 310 lignes),
  `actions:link_click` (418), `actions:click_to_call_native_call_placed` (8),
  `total_profile_visits` (15). Un groupe d'annonces n'a jamais qu'un type ;
  une campagne peut en mêler (`BW_traffic_2025` : trois).
- `attribution_setting` : `1d_view_7d_click` partout, `1d_click` pour
  « Velöle Socken » ; `attribution_windows` absent sous `1d_click`.
- **Aucune campagne de notoriété dans tout l'historique**, aucune liste vide,
  aucun `results` NULL après le rejeu.

**Le rejeu** : `11043e9a` — 5 751 lignes, **0 sans `campaign_id`**, aucune
remplie par le nom. ⚠ L'historique a changé de taille : 1 847 lignes avant,
5 751 après, et des dépenses de campagne bougent fort (`BW_Frühling_Familien_2026`
10 499 → 14 499 CHF, `BW_traffic_ebike_2025` 206 → 3 163 CHF). Les anciennes
lignes sans `ad_id` étaient incomplètes ; les chiffres d'avant le rejeu ne
correspondaient donc pas à Ads Manager. **Pas vérifié contre Ads Manager.**

**Reste** : le compte `0b83e564-…` (le même compte publicitaire) a encore ses
**1 626 lignes sans ID ni `results`** — même rejeu à lancer pour lui, quand
David le voudra.
