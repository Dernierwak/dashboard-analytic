"""`FROM search_term_view` — les termes de recherche × jour → google_ads_search_terms.

Ce que les gens ont tapé avant de voir une annonce Search, avec le mot-clé qui
l'a déclenchée (texte, type de correspondance, critère) et le type
d'appariement du terme (carte google-ads, issues 17 et 19). Le module « Groupes
de termes » de la page les range sous leur mot-clé.

Volume : 10 106 lignes sur 90 jours chez le compte A (issue 19), au-delà d'un
lot de 10 000 — `searchStream` les rend en plusieurs lots, tous lus par
`resultats_de`, sans erreur ni troncature.

Les termes reviennent en minuscules, accents conservés (issue 19, 0 majuscule
sur 10 302 lignes) : ils sont recopiés tels quels, aucune normalisation maison.
"""
from __future__ import annotations

from datetime import date

from saas.data.fetch_data.sources.google.client import AccesGoogle
from saas.data.fetch_data.sources.google.ads.fetchers._query import BASE, entetes, mesure, resultats_de
from saas.data.fetch_data.shared import http_client as http
from saas.data.fetch_data.shared.date_ranges import Fenetre, tranches


def tranche(
    access_token: str,
    customer_id: str,
    since: date,
    until: date,
    login_customer_id: str | None = None,
) -> tuple[list[dict], str | None]:
    """Les termes × jour, demandés à Google → `lignes_de`.

    Aucun filtre sur le type de campagne : la récolte recopie ce que Google
    rend, c'est la page qui ne garde que les campagnes Search.
    """
    query = f"""
        SELECT
          campaign.id,
          ad_group.id,
          ad_group.name,
          search_term_view.search_term,
          segments.keyword.ad_group_criterion,
          segments.keyword.info.text,
          segments.keyword.info.match_type,
          segments.search_term_match_type,
          segments.date,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions
        FROM search_term_view
        WHERE segments.date BETWEEN '{since.isoformat()}' AND '{until.isoformat()}'
    """
    url = f"{BASE}/customers/{customer_id}/googleAds:searchStream"
    try:
        data = http.post(url, headers=entetes(access_token, login_customer_id),
                         # Le double des autres récoltes : plus de 10 000 lignes par
                         # tranche de 90 jours chez A (issue 19), en un seul flux.
                         json={"query": query}, timeout=120).json()
    except Exception as e:
        return [], f"Erreur API: {e}"
    return lignes_de(data)


def _critere_de(ressource: str | None) -> str:
    """`customers/1/adGroupCriteria/50~77` → `77` (unique dans son groupe
    d'annonces, qui fait partie de la clé)."""
    if not ressource:
        return ""
    return str(ressource).rsplit("~", 1)[-1] if "~" in str(ressource) else ""


def _entier(v) -> int | None:
    m = mesure(v)
    return None if m is None else int(m)


def lignes_de(reponse) -> tuple[list[dict], str | None]:
    """Le seam « réponse Google → lignes à écrire », sans réseau (harnais :
    `.scratch/google-ads/harnais/09-les-groupes-de-termes-mots-cles/`).

    Une ligne par résultat rendu, aucune pour un jour que Google a omis (issue
    10 : avec `segments.date`, un jour tout à 0 n'est pas rendu).
    Un même terme apparié par deux mots-clés revient en deux résultats : deux
    lignes, que la clé d'unicité distingue par le critère et l'appariement.
    Sans mot-clé déclencheur, les clés texte restent vides (`""`), jamais
    devinées : NULL casserait la contrainte d'unicité, donc l'upsert.
    Absence de métrique → `None`, jamais 0 (`CLAUDE.md` §7). Le coût reste en
    micros : la page le convertit, une seule fois.
    """
    resultats, err = resultats_de(reponse)
    if err:
        return [], err
    lignes = []
    for row in resultats:
        campagne = str(row.get("campaign", {}).get("id") or "") or None
        groupe = row.get("adGroup", {})
        groupe_id = str(groupe.get("id") or "") or None
        texte = row.get("searchTermView", {}).get("searchTerm")
        if campagne is None or groupe_id is None or not texte:
            continue
        seg = row.get("segments", {})
        mot = seg.get("keyword", {})
        info = mot.get("info", {})
        m = row.get("metrics", {})
        lignes.append({
            "date_start":             seg.get("date", ""),
            "campaign_id":            campagne,
            "ad_group_id":            groupe_id,
            "ad_group_name":          groupe.get("name", ""),
            "search_term":            texte,
            "keyword_criterion_id":   _critere_de(mot.get("adGroupCriterion")),
            "keyword_text":           info.get("text") or "",
            "keyword_match_type":     info.get("matchType") or "",
            "search_term_match_type": seg.get("searchTermMatchType") or "",
            "impressions":            _entier(m.get("impressions")),
            "clicks":                 _entier(m.get("clicks")),
            "cost_micros":            _entier(m.get("costMicros")),
            "conversions":            mesure(m.get("conversions")),
        })
    return lignes, None


def recuperer(acces: AccesGoogle, fenetre: Fenetre) -> tuple[list[dict], list[str]]:
    """Les tranches de 90 jours de la fenêtre → (lignes, trous). Une tranche
    refusée est NOMMÉE, jamais jetée en silence (même règle que `campaigns`)."""
    lignes, trous = [], []
    for debut, fin in tranches(fenetre.debut, fenetre.fin):
        lot, err = tranche(acces.jeton, acces.client, debut, fin, acces.login)
        if err:
            trous.append(f"{debut.isoformat()}→{fin.isoformat()} : {err}")
        else:
            lignes += lot
    return lignes, trous
