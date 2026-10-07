"""`/act_…/activities` — le journal des changements DÉCLARÉS par Meta → platform_changes."""
from __future__ import annotations

import json

from saas.data.fetch_data.sources.meta.ads.fetchers.budgets import centimes
from saas.data.fetch_data.sources.meta.graph_client import GRAPH, AccesMeta, pages
from saas.data.fetch_data.shared.date_ranges import Fenetre

# ── Le journal des changements DÉCLARÉS (/activities) ────────────────────────
#
# Meta tient le journal de ce qui a été touché dans le compte publicitaire.
# C'est le pendant de `change_event` chez Google, et il comble le même angle
# mort : changer une audience ou remplacer un visuel ne bouge pas forcément la
# dépense du jour, donc rien ne le trahissait dans nos courbes.

_ACTIVITES = {
    "update_campaign_budget":     "budget",
    "update_ad_set_budget":       "budget",
    "update_campaign_run_status": "statut",
    "update_ad_set_run_status":   "statut",
    "update_ad_set_target_spec":  "audience",
    "update_ad_creative":         "creatif",
    # Élargis par la carte meta-ads (décision `.scratch/meta-ads/issues/08`, construite
    # au ticket 04) : ce sont les gestes courants
    # d'Ads Manager, et `/activities` les documente
    # (https://developers.facebook.com/docs/marketing-api/reference/ad-activity/).
    # La revue de Meta (`ad_review_*`) n'est pas retenue : ce n'est pas un
    # geste du client.
    "update_ad_run_status":       "statut",
    "update_ad_set_bidding":      "enchere",
    "update_ad_set_bid_strategy": "enchere",
    "update_ad_bid_info":         "enchere",
    "create_campaign_group":      "creation",
    "create_ad_set":              "creation",
    "create_ad":                  "creation",
}

# LES NOUVEAUX TYPES NE LISENT PAS `extra_data`. Sa forme n'est documentée nulle
# part et aucun exemple réel n'a encore été lu pour eux : la phrase dit ce que
# le type d'événement établit à lui seul, sans valeur avant/après. Une valeur ne
# s'ajoute qu'une fois un `extra_data` réel recopié dans le ticket 04.
_PHRASES_SANS_VALEUR = {
    "update_ad_run_status":       'le statut de l\'annonce "{nom}" a été modifié',
    "update_ad_set_bidding":      'l\'enchère du groupe d\'annonces "{nom}" a été modifiée',
    "update_ad_set_bid_strategy": 'la stratégie d\'enchère du groupe d\'annonces "{nom}" a été modifiée',
    "update_ad_bid_info":         'l\'enchère de l\'annonce "{nom}" a été modifiée',
    "create_campaign_group":      'la campagne "{nom}" a été créée',
    "create_ad_set":              'le groupe d\'annonces "{nom}" a été créé',
    "create_ad":                  'l\'annonce "{nom}" a été créée',
}

# Les événements portés par la campagne elle-même : leur `object_id` EST la
# campagne. Pour les autres, `object_id` est un groupe d'annonces ou une annonce, et la
# campagne se retrouve par l'ID dans la hiérarchie des insights
# (`hierarchie_depuis_insights`) — jamais en rangeant l'ID d'un groupe d'annonces dans
# `campaign_id`, ce qui rattacherait le changement sur une clé fausse.
_NIVEAU_CAMPAGNE = {"update_campaign_budget", "update_campaign_run_status",
                    "create_campaign_group"}

# Groupe d'annonces ou annonce → (campaign_id, campaign_name) : `hierarchie_depuis_insights`.
Parents = dict[str, tuple[str, str | None]]

# (campagne, groupe d'annonces) : le participe s'accorde avec le sujet, et le
# groupe d'annonces est masculin (CONTEXT.md, **Groupe d'annonces**).
_ETATS_META = {
    "PAUSED":   ("a été mise en pause", "a été mis en pause"),
    "ACTIVE":   ("a été réactivée",     "a été réactivé"),
    "ARCHIVED": ("a été archivée",      "a été archivé"),
    "DELETED":  ("a été supprimée",     "a été supprimé"),
}


def _chf_fr(v: float) -> str:
    return f"{v:,.2f}".replace(",", " ").replace(".", ",")


def _extra(brut) -> dict:
    """`extra_data` arrive en CHAÎNE JSON, pas en objet — un json.loads de plus.

    Hypothèse sur sa forme : Meta ne la documente pas, on observe
    {"old_value": …, "new_value": …}. Quand elle n'est pas là ou pas lisible, on
    écrit la phrase sans les valeurs plutôt que d'inventer des chiffres.
    """
    if isinstance(brut, dict):
        return brut
    if not brut:
        return {}
    try:
        d = json.loads(brut)
        return d if isinstance(d, dict) else {}
    except Exception:
        return {}


def _cle_meta(quand: str, *parts) -> str:
    """Hachage stable de (canal, horodatage, ressource, champ) — même rôle que
    côté Google : deux récoltes sur la même semaine ne doivent rien dupliquer.

    La phrase n'entre pas dans le hachage : une reformulation ferait réinsérer
    en double tout l'historique au lieu de le mettre à jour."""
    import hashlib
    brut = "|".join(["meta", str(quand)] + [str(p or "") for p in parts])
    return hashlib.sha1(brut.encode("utf-8")).hexdigest()[:24]


def _traduire_meta(act: dict) -> tuple[str, str] | None:
    """(categorie, resume) — ou None quand on ne sait pas nommer le fait."""
    typ = str(act.get("event_type") or "")
    categorie = _ACTIVITES.get(typ)
    if not categorie:
        return None
    nom = (act.get("object_name") or "").strip()
    # Sans le nom de l'objet touché, la phrase se réduirait à « une campagne a
    # changé » — un bruit qui chasse les lignes utiles du fil.
    if not nom:
        return None
    if typ in _PHRASES_SANS_VALEUR:
        return (categorie, _PHRASES_SANS_VALEUR[typ].format(nom=nom))
    extra = _extra(act.get("extra_data"))
    avant, apres = extra.get("old_value"), extra.get("new_value")
    est_campagne = typ in _NIVEAU_CAMPAGNE
    # « de » + « le groupe » se contracte en « du » : le complément s'écrit
    # entier pour chaque niveau plutôt que d'accoler « de » à l'objet.
    du_objet = f'de la campagne "{nom}"' if est_campagne else f'du groupe d\'annonces "{nom}"'

    if categorie == "budget":
        a, b = centimes(avant), centimes(apres)
        if a is not None and b is not None and a != b:
            return ("budget", f"le budget {du_objet} est passé de {_chf_fr(a)} à {_chf_fr(b)} CHF")
        if b is not None:
            return ("budget", f"le budget {du_objet} a été réglé à {_chf_fr(b)} CHF")
        return ("budget", f"le budget {du_objet} a été modifié")

    if categorie == "statut":
        etat = str(apres or "").upper()
        if etat in _ETATS_META:
            feminin, masculin = _ETATS_META[etat]
            if est_campagne:
                return ("statut", f'la campagne "{nom}" {feminin}')
            return ("statut", f'le groupe d\'annonces "{nom}" {masculin}')
        return None

    if categorie == "audience":
        return ("audience", f"le ciblage du groupe d'annonces \"{nom}\" a été modifié")

    if categorie == "creatif":
        return ("creatif", f"le visuel de l'annonce \"{nom}\" a été remplacé")

    return None


# Le worker demande six mois d'activités à chaque passage hebdomadaire, à 500
# par page. La boucle de pagination ne s'arrêtait que quand Meta cessait de
# rendre un `paging.next` — or le Graph API sait rendre un curseur `next` sur
# une page VIDE, et rien ici n'empêchait alors la boucle de tourner sans fin sur
# un seul compte, en mangeant le passage de tous les autres.
#
# 40 pages = 20 000 activités, soit ~110 changements par jour, tous les jours,
# pendant six mois. Au-delà on n'apprend plus rien d'utile : le fil n'affiche
# que 60 jours et l'écriture est idempotente. Le chiffre borne aussi le pire cas
# en temps — 40 requêtes à 45 s de timeout, pas une boucle infinie.
_ACTIVITES_PAGES_MAX = 40


def recuperer(acces: AccesMeta, fenetre: Fenetre,
              limite: int | None = None) -> tuple[list[dict], list[str]]:
    """Les activités BRUTES du compte entre `fenetre.debut` et `fenetre.fin`.

    Rendues telles que Meta les écrit : la traduction en phrases
    (`lignes_activites`) a besoin de la hiérarchie et du fuseau, que
    l'appelant connaît. Une liste tronquée (plafond, pagination coupée) rend ce
    qu'elle a lu ET le trou : ce qui a été lu est bon et s'écrit.
    """
    if not (acces.jeton and acces.compte):
        return [], ["token ou ad_account_id manquant"]
    params = {
        "access_token": acces.jeton,
        "fields": "event_type,event_time,object_id,object_name,extra_data",
        "since": fenetre.debut.isoformat(),
        "until": fenetre.fin.isoformat(),
        "limit": 500,
    }
    actes, err = pages(f"{GRAPH}/{acces.compte}/activities", params, timeout=45,
                       pages_max=_ACTIVITES_PAGES_MAX, limite=limite)
    return actes, ([err] if err else [])


def hierarchie_depuis_insights(lignes: list[dict]) -> Parents:
    """Les lignes de meta_ads_insights → {id de groupe d'annonces ou d'annonce : (campaign_id, campaign_name)}.

    Pure. Meta numérote groupes d'annonces et annonces dans un même espace d'IDs, d'où
    un seul dictionnaire. Une ligne sans `campaign_id` (d'avant le rejeu du
    ticket 03) ne rattache rien : on ne reconstitue jamais une campagne depuis
    un nom. Le nom gardé est le plus récent, pour qu'une campagne renommée se
    lise sous un seul nom (spec, user story 51).
    """
    noms: dict[str, str | None] = {}
    for r in sorted(lignes, key=lambda r: str(r.get("date_start") or "")):
        if r.get("campaign_id"):
            noms[str(r["campaign_id"])] = r.get("campaign_name") or None
    parents: Parents = {}
    for r in lignes:
        if not r.get("campaign_id"):
            continue
        cid = str(r["campaign_id"])
        for oid in (r.get("adset_id"), r.get("ad_id")):
            if oid:
                parents[str(oid)] = (cid, noms[cid])
    return parents


def _campagne_de(act: dict, parents: Parents) -> tuple[str | None, str | None]:
    oid = str(act.get("object_id") or "")
    if not oid:
        return None, None
    if str(act.get("event_type") or "") in _NIVEAU_CAMPAGNE:
        return oid, (act.get("object_name") or None)
    return parents.get(oid, (None, None))


def lignes_activites(actes: list[dict], parents: Parents, fuseau: str | None = None) -> list[dict]:
    """La réponse de /activities → les lignes de platform_changes.

    Pure, sans réseau : c'est le seam de test du journal (harnais
    `.scratch/meta-ads/harnais/04-le-journal/`). `parents` vient de
    `hierarchie_depuis_insights` ; un ID absent laisse la campagne vide, et le
    changement ne se lit alors que sans filtre campagne.

    `occurred_at` reste l'instant UTC écrit par Meta ; `fuseau` dit dans quel
    fuseau l'écran découpe son jour. Inconnu, il n'est PAS envoyé : chaque
    passage relit 180 jours, et un `None` effacerait par upsert le fuseau
    déjà écrit.
    """
    rows: list[dict] = []
    vus: set[str] = set()
    for a in actes:
        quand = a.get("event_time")
        if not quand:
            continue
        traduit = _traduire_meta(a)
        if not traduit:
            continue
        categorie, resume = traduit
        cle = _cle_meta(quand, a.get("event_type"), a.get("object_id"))
        if cle in vus:
            continue
        vus.add(cle)
        campaign_id, campaign_name = _campagne_de(a, parents)
        rows.append({
            "change_id":     cle,
            "occurred_at":   str(quand),
            "categorie":     categorie,
            "campaign_id":   campaign_id,
            "campaign_name": campaign_name,
            "resume":        resume,
            **({"fuseau": fuseau} if fuseau else {}),
        })
    return rows

