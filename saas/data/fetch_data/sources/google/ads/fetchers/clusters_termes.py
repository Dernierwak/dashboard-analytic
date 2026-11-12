"""`FROM campaign_search_term_insight` / `customer_search_term_insight` — les
Clusters de Google → google_ads_search_term_clusters.

Les groupes que Google forme avec les termes de recherche (un sujet, une
langue), lus pour le mode « Clusters Google » du module Groupes de termes.
Faits relevés sur deux comptes réels en v26 (carte google-ads, issue 19) :

  · **pas de coût** — `metrics.cost_micros` est refusé
    (`PROHIBITED_METRIC_IN_SELECT_OR_WHERE_CLAUSE`) ;
  · **une campagne par requête** au niveau campagne
    (`REQUIRES_FILTER_BY_SINGLE_RESOURCE` sans filtre de campagne) ;
  · la série par jour (`segments.date` sélectionné) exige un seul cluster par
    requête — ≈ 960 requêtes par jour de fenêtre chez A. On lit donc la
    **fenêtre agrégée** des 90 derniers jours pleins, sans `segments.date`
    dans le SELECT, relue en entier à chaque passage (spec, Further Notes 1) ;
  · `segments.search_term` ne va qu'avec `segments.search_subcategory`
    (`MISSING_FIELD_IN_SELECT_CLAUSE`), qui revient toujours vide ;
  · le fourre-tout a un libellé vide et ne liste aucun terme ;
  · le niveau compte mêle Search et PMax (35 076 clics pour 16 224 Search chez A).
"""
from __future__ import annotations

from datetime import date, timedelta

from saas.data.fetch_data.sources.google.client import AccesGoogle
from saas.data.fetch_data.sources.google.ads.fetchers._query import BASE, entetes, mesure, resultats_de
from saas.data.fetch_data.shared import http_client as http
from saas.data.fetch_data.shared.date_ranges import Fenetre

# La fenêtre de l'essai réel (issue 19, 13.08 → 10.11) : c'est sur elle que la
# stabilité des `id` (956 sur 959 d'une semaine à l'autre) a été mesurée.
JOURS_FENETRE = 90


def fenetre_de(aujourdhui: date) -> Fenetre:
    """Les 90 derniers jours pleins : le jour en cours, incomplet, n'y entre pas
    (`CLAUDE.md` §7)."""
    fin = aujourdhui - timedelta(days=1)
    return Fenetre(fin - timedelta(days=JOURS_FENETRE - 1), fin)


def _ressource(campagne: str | None) -> str:
    return "campaign_search_term_insight" if campagne else "customer_search_term_insight"


def _filtres(campagne: str | None, fenetre: Fenetre, cluster: str | None = None) -> str:
    """La date en WHERE seulement : sélectionnée, elle exigerait un seul
    cluster par requête (issue 19)."""
    r = _ressource(campagne)
    morceaux = [f"segments.date BETWEEN '{fenetre.debut.isoformat()}' AND '{fenetre.fin.isoformat()}'"]
    if campagne:
        morceaux.append(f"{r}.campaign_id = {campagne}")
    if cluster:
        morceaux.append(f"{r}.id = {cluster}")
    return " AND ".join(morceaux)


def requete_clusters(campagne: str | None, fenetre: Fenetre) -> str:
    r = _ressource(campagne)
    return f"""
        SELECT
          {r}.id,
          {r}.category_label,
          metrics.impressions,
          metrics.clicks,
          metrics.conversions
        FROM {r}
        WHERE {_filtres(campagne, fenetre)}
    """


def requete_termes(campagne: str | None, fenetre: Fenetre, cluster: str | None = None) -> str:
    r = _ressource(campagne)
    return f"""
        SELECT
          {r}.id,
          segments.search_term,
          segments.search_subcategory,
          metrics.impressions,
          metrics.clicks,
          metrics.conversions
        FROM {r}
        WHERE {_filtres(campagne, fenetre, cluster)}
    """


def _envoyer(acces: AccesGoogle, requete: str):
    url = f"{BASE}/customers/{acces.client}/googleAds:searchStream"
    try:
        return http.post(url, headers=entetes(acces.jeton, acces.login),
                         json={"query": requete}, timeout=120).json()
    except Exception as e:
        return {"error": {"message": f"Erreur API: {e}"}}


def _entier(v) -> int | None:
    m = mesure(v)
    return None if m is None else int(m)


def _insight(row: dict) -> dict:
    return row.get("campaignSearchTermInsight") or row.get("customerSearchTermInsight") or {}


def _somme(a, b):
    """Une absence rend la somme absente : un terme vu deux fois dont une sans
    conversions n'a pas de total de conversions connu."""
    return None if a is None or b is None else a + b


def lignes_de(rep_clusters, rep_termes, campagne: str | None, fenetre: Fenetre) -> tuple[list[dict], str | None]:
    """Le seam « réponses Google → lignes à écrire », sans réseau (harnais :
    `.scratch/google-ads/harnais/10-les-groupes-de-termes-clusters/`).

    `rep_termes` : une réponse, ou la liste des réponses lues un cluster à la
    fois. Une erreur, où qu'elle soit, annule tout : un cluster écrit sans ses
    termes ferait passer toute sa part pour « masquée par Google ».
    Aucun coût n'est écrit (Google le refuse). Le fourre-tout au libellé vide
    est gardé tel quel. Absence de métrique → `None`, jamais 0 (`CLAUDE.md` §7).
    `campagne` None = niveau compte, écrit `""` (NULL casserait l'unicité).
    """
    clusters, err = resultats_de(rep_clusters)
    if err:
        return [], err
    termes_par_cluster: dict[str, dict[str, dict]] = {}
    for rep in rep_termes if isinstance(rep_termes, tuple) else (rep_termes,):
        resultats, err = resultats_de(rep)
        if err:
            return [], err
        for row in resultats:
            cid = str(_insight(row).get("id") or "")
            texte = row.get("segments", {}).get("searchTerm")
            if not cid or not texte:
                continue
            m = row.get("metrics", {})
            chiffres = {"impressions": _entier(m.get("impressions")), "clicks": _entier(m.get("clicks")),
                        "conversions": mesure(m.get("conversions"))}
            deja = termes_par_cluster.setdefault(cid, {}).get(texte)
            if deja is None:
                termes_par_cluster[cid][texte] = {"term": texte, **chiffres}
            else:
                for k, v in chiffres.items():
                    deja[k] = _somme(deja[k], v)
    lignes = []
    for row in clusters:
        ins = _insight(row)
        cid = str(ins.get("id") or "")
        if not cid:
            continue
        m = row.get("metrics", {})
        lignes.append({
            "campaign_id":    campagne or "",
            "cluster_id":     cid,
            "category_label": ins.get("categoryLabel") or "",
            "impressions":    _entier(m.get("impressions")),
            "clicks":         _entier(m.get("clicks")),
            "conversions":    mesure(m.get("conversions")),
            "terms":          list(termes_par_cluster.get(cid, {}).values()),
            "window_start":   fenetre.debut.isoformat(),
            "window_end":     fenetre.fin.isoformat(),
        })
    return lignes, None


def _niveau(acces: AccesGoogle, campagne: str | None, fenetre: Fenetre) -> tuple[list[dict], str | None]:
    """Un niveau (le compte, ou une campagne) : ses clusters, puis leurs termes.

    La doc v26 ne dit pas si `segments.search_term` exige un seul cluster dans
    le WHERE ; l'essai réel (issue 19) les a lus cluster filtré. On tente donc
    la requête sans filtre de cluster, et si Google la refuse, on relit un
    cluster à la fois (≈ 25 par campagne, ≈ 960 au compte chez A).
    """
    rep_clusters = _envoyer(acces, requete_clusters(campagne, fenetre))
    clusters, err = resultats_de(rep_clusters)
    if err:
        return [], err
    rep_termes = _envoyer(acces, requete_termes(campagne, fenetre))
    if resultats_de(rep_termes)[1]:
        ids = [str(_insight(r).get("id") or "") for r in clusters]
        rep_termes = tuple(_envoyer(acces, requete_termes(campagne, fenetre, i)) for i in ids if i)
    return lignes_de(rep_clusters, rep_termes, campagne, fenetre)


def campagnes_search(acces: AccesGoogle, fenetre: Fenetre) -> tuple[list[str], str | None]:
    """Les campagnes Search qui ont eu des impressions dans la fenêtre : une
    campagne sans impression n'a pas de cluster, inutile de l'interroger."""
    requete = f"""
        SELECT campaign.id, metrics.impressions
        FROM campaign
        WHERE campaign.advertising_channel_type = 'SEARCH'
          AND segments.date BETWEEN '{fenetre.debut.isoformat()}' AND '{fenetre.fin.isoformat()}'
          AND metrics.impressions > 0
    """
    resultats, err = resultats_de(_envoyer(acces, requete))
    if err:
        return [], err
    ids = [str(r.get("campaign", {}).get("id") or "") for r in resultats]
    return sorted({i for i in ids if i}), None


def recuperer(acces: AccesGoogle, fenetre: Fenetre) -> tuple[list[dict], list[str]]:
    """Le compte, puis chaque campagne Search → (lignes, trous). Un niveau
    refusé est NOMMÉ et n'écrit rien : ses lignes d'avant gardent leur
    ancienne fenêtre, que la page lit et affiche."""
    lignes, trous = [], []
    campagnes, err = campagnes_search(acces, fenetre)
    if err:
        trous.append(f"liste des campagnes Search : {err}")
    for campagne in [None, *campagnes]:
        lot, err = _niveau(acces, campagne, fenetre)
        if err:
            trous.append(f"{'campagne ' + campagne if campagne else 'compte'} : {err}")
        else:
            lignes += lot
    return lignes, trous
