"""`/act_…/activities` — le journal des changements DÉCLARÉS par Meta → platform_changes."""
from __future__ import annotations

import json
from typing import NamedTuple

from saas.data.fetch_data.sources.meta.ads.fetchers.budgets import centimes
from saas.data.fetch_data.sources.meta.graph_client import GRAPH, AccesMeta, pages
from saas.data.fetch_data.shared.date_ranges import Fenetre

# ── Le journal des changements DÉCLARÉS (/activities) ────────────────────────
#
# Meta tient le journal de ce qui a été touché dans le compte publicitaire.
# C'est le pendant de `change_event` chez Google, et il comble le même angle
# mort : changer une audience ou remplacer un visuel ne bouge pas forcément la
# dépense du jour, donc rien ne le trahissait dans nos courbes.
#
# Chaque ligne garde l'élément touché et `extra_data` TEL QUE META L'ENVOIE
# (`.scratch/journal-meta/issues/11`) : l'écran y lit avant → après, et une
# phrase se réécrit sans redemander à Meta. La phrase `resume` reste écrite
# ici parce que le fil du rapport la lit.

# Une catégorie ajoutée ici s'ajoute aussi au CHECK `platform_changes_categorie_check`
# de `saas/data/supabase/migrations/000_run_me_all.sql` et à `CategorieChangement`
# de `saas/web/lib/changements-api.ts` : sinon Supabase refuse tout le lot Meta.
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
    # Vus sur un vrai compte et faits par le client
    # (`.scratch/journal-meta/issues/02`) : l'objectif d'un groupe, le ciblage
    # posé sur une annonce, les dates de diffusion.
    "update_ad_set_optimization_goal": "objectif",
    "update_ad_targets_spec":          "audience",
    "update_ad_set_duration":          "calendrier",
    # Le seul fait de Meta retenu (`.scratch/journal-meta/issues/19`, voulu par
    # David) : le jour où une annonce commence à diffuser explique le jour où
    # sa dépense démarre. Écrit par l'acteur « Meta », une fois par annonce
    # — 19 sur 88 activités lues du 26 au 29 août 2026. La revue reste écartée.
    "first_delivery_event":            "diffusion",
}

# Le niveau se lit dans le PRÉFIXE de `event_type`, jamais dans `object_type` :
# Meta y écrit « CAMPAIGN » pour un groupe d'annonces, son vocabulaire interne
# appelant « campaign » le groupe et « campaign group » la campagne
# (`.scratch/journal-meta/recherche/activities.md`, O2). L'ordre compte :
# `update_ad_set_` avant `update_ad_`. `first_delivery_event` n'a pas de
# préfixe : vu sur des annonces seulement (`object_type` ADGROUP, l'annonce
# dans ce même vocabulaire — `.scratch/journal-meta/issues/19`).
_NIVEAUX = (
    ("first_delivery_event",  "annonce"),
    ("create_campaign_group", "campagne"),
    ("update_campaign_",      "campagne"),
    ("create_ad_set",         "groupe"),
    ("update_ad_set_",        "groupe"),
    ("create_ad",             "annonce"),
    ("update_ad_",            "annonce"),
)

# Le complément s'écrit entier pour chaque niveau : « de » + « le groupe » se
# contracte en « du », et le participe s'accorde avec l'élément.
_DE_L_ELEMENT = {
    "campagne": "de la campagne",
    "groupe":   "du groupe d'annonces",
    "annonce":  "de l'annonce",
}
_CREATIONS = {
    "campagne": "la campagne {nom} a été créée",
    "groupe":   "le groupe d'annonces {nom} a été créé",
    "annonce":  "l'annonce {nom} a été créée",
}

# Ce que le type d'événement établit à lui seul. Avant → après, quand Meta le
# donne, se lit dans `extra_data` à l'affichage.
_GESTES = {
    "audience":   "le ciblage {de} a été modifié",
    "creatif":    "la créa {de} a été modifiée",
    "calendrier": "le calendrier {de} a été modifié",
    "enchere":    "l'enchère {de} a été modifiée",
}
_STRATEGIE = "la stratégie d'enchère {de} a été modifiée"


class Parent(NamedTuple):
    campaign_id: str
    campaign_name: str | None
    adset_id: str | None


# Groupe d'annonces ou annonce → sa campagne et son groupe : `hierarchie_depuis_insights`.
Parents = dict[str, Parent]


def _montant_fr(v: float) -> str:
    return f"{v:,.2f}".replace(",", " ").replace(".", ",")


def _extra_tel_quel(brut):
    """`extra_data` pour la colonne jsonb : ce que Meta envoie, sans rien
    retirer. Il arrive en CHAÎNE JSON, pas en objet — un json.loads de plus.
    Une chaîne qui n'est pas du JSON se garde comme chaîne — c'est encore ce
    que Meta a envoyé. Absent : None, et la colonne n'est pas envoyée.
    """
    if brut in (None, ""):
        return None
    if isinstance(brut, str):
        try:
            return json.loads(brut)
        except json.JSONDecodeError:
            return brut
    return brut


def _champs(extra) -> dict:
    """Les champs que la phrase et l'élément lisent dans `extra_data`.

    Sa forme n'est documentée nulle part ; celles vues sur un vrai compte sont
    dans `.scratch/journal-meta/issues/02`. Tout ce qui n'est pas un objet rend
    {} et la phrase dit « modifié » plutôt que d'inventer une valeur.
    """
    return extra if isinstance(extra, dict) else {}


def _cle_meta(quand: str, *parts) -> str:
    """Hachage stable de (canal, horodatage, ressource, champ) — même rôle que
    côté Google : deux récoltes sur la même semaine ne doivent rien dupliquer.

    La phrase n'entre pas dans le hachage : une reformulation ferait réinsérer
    en double tout l'historique au lieu de le mettre à jour."""
    import hashlib
    brut = "|".join(["meta", str(quand)] + [str(p or "") for p in parts])
    return hashlib.sha1(brut.encode("utf-8")).hexdigest()[:24]


def niveau_de(event_type: str) -> str | None:
    """`campagne`, `groupe` ou `annonce` — None pour un type sans préfixe connu."""
    for prefixe, niveau in _NIVEAUX:
        if event_type.startswith(prefixe):
            return niveau
    return None


def _nom(act: dict) -> str:
    """« "Acheteurs" », ou l'ID quand Meta omet le nom : un changement réel ne
    se jette pas pour un nom manquant."""
    nom = (act.get("object_name") or "").strip()
    if nom:
        return f'"{nom}"'
    return str(act.get("object_id") or "").strip() or "sans nom"


def _montant(extra: dict, cote: str) -> tuple[float, str] | None:
    """Le montant d'un côté (`old_value` / `new_value`) d'un `composite_data`.

    Forme vue sur deux vrais `update_ad_set_budget` du 2026-02-12
    (`.scratch/journal-meta/issues/18`, harnais `harnais/18/`) —
    `{"old_value": {"type": "payment_amount", "currency": "CHF", "old_value": 35000},
    "new_value": {…, "new_value": 75000}}`, en centimes : 350 → 750 CHF dans Ads
    Manager. Toute autre forme rend None, et la phrase dit « modifié ».
    """
    v = extra.get(cote)
    if not isinstance(v, dict) or v.get("type") != "payment_amount":
        return None
    montant = centimes(v.get(cote))
    if montant is None:
        return None
    return montant, str(v.get("currency") or "").strip()


def _phrase_budget(extra: dict, de: str) -> str:
    avant, apres = _montant(extra, "old_value"), _montant(extra, "new_value")
    if apres is None:
        return f"le budget {de} a été modifié"
    # La devise n'est écrite que si Meta la donne : aucune n'est supposée.
    devise = f" {apres[1]}" if apres[1] else ""
    if avant is None:
        return f"le budget {de} a été réglé à {_montant_fr(apres[0])}{devise}"
    return f"le budget {de} est passé de {_montant_fr(avant[0])} à {_montant_fr(apres[0])}{devise}"


def _texte(v) -> str | None:
    return v.strip() if isinstance(v, str) and v.strip() else None


def _phrase_de_a(extra: dict, rubrique: str, de: str) -> str:
    """« le statut … est passé de « Actif » à « En attente d'examen » ».

    Les valeurs sont recopiées comme Meta les envoie, dans la langue du jeton
    (`.scratch/journal-meta/issues/04`) : aucune décision ne se prend sur un
    libellé, donc un statut en français n'est plus jeté.
    """
    avant, apres = _texte(extra.get("old_value")), _texte(extra.get("new_value"))
    if avant and apres:
        return f"{rubrique} {de} est passé de « {avant} » à « {apres} »"
    if apres:
        return f"{rubrique} {de} a été réglé sur « {apres} »"
    return f"{rubrique} {de} a été modifié"


def _traduire_meta(act: dict, extra: dict) -> tuple[str, str] | None:
    """(categorie, resume) — None seulement pour un type que Pulse ne récolte pas.

    Un type retenu n'est jamais jeté : au pire la phrase dit « modifié ».
    `extra` : les champs de `extra_data`, déjà lus par `_champs`.
    """
    typ = str(act.get("event_type") or "")
    categorie = _ACTIVITES.get(typ)
    niveau = niveau_de(typ)
    if not categorie or not niveau:
        return None
    nom = _nom(act)
    de = f"{_DE_L_ELEMENT[niveau]} {nom}"

    if categorie == "creation":
        return ("creation", _CREATIONS[niveau].format(nom=nom))
    if categorie == "diffusion":
        return ("diffusion", f"l'annonce {nom} a commencé à diffuser")
    if categorie == "budget":
        return ("budget", _phrase_budget(extra, de))
    if categorie == "statut":
        return ("statut", _phrase_de_a(extra, "le statut", de))
    if categorie == "objectif":
        return ("objectif", _phrase_de_a(extra, "l'objectif", de))
    if typ == "update_ad_set_bid_strategy":
        return ("enchere", _STRATEGIE.format(de=de))
    return (categorie, _GESTES[categorie].format(de=de))


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
        # `actor_id` et jamais `actor_name` : « une personne » ou « Meta »
        # suffit à l'écran, et le nom d'un tiers n'a pas à quitter Meta
        # (`.scratch/journal-meta/issues/20`).
        "fields": "event_type,event_time,object_id,object_name,extra_data,actor_id",
        "since": fenetre.debut.isoformat(),
        "until": fenetre.fin.isoformat(),
        "limit": 500,
    }
    actes, err = pages(f"{GRAPH}/{acces.compte}/activities", params, timeout=45,
                       pages_max=_ACTIVITES_PAGES_MAX, limite=limite)
    return actes, ([err] if err else [])


def hierarchie_depuis_insights(lignes: list[dict]) -> Parents:
    """Les lignes de meta_ads_insights → {id de groupe d'annonces ou d'annonce : Parent}.

    Pure. Meta numérote groupes d'annonces et annonces dans un même espace d'IDs, d'où
    un seul dictionnaire. Une ligne sans `campaign_id` (d'avant le rejeu du
    ticket 03) ne rattache rien : on ne reconstitue jamais une campagne depuis
    un nom. Le nom gardé est le plus récent, pour qu'une campagne renommée se
    lise sous un seul nom (spec, user story 51).

    Le groupe d'une annonce sert au filtre « Groupe d'annonces » : seul
    `create_ad` le porte dans son `extra_data`, les autres gestes sur une
    annonce le retrouvent ici.
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
        adset = str(r["adset_id"]) if r.get("adset_id") else None
        for oid in (r.get("adset_id"), r.get("ad_id")):
            if oid:
                parents[str(oid)] = Parent(cid, noms[cid], adset)
    return parents


def _groupe_dans_extra(extra: dict) -> str | None:
    """Le `campaign_id` d'un geste sur une annonce est l'ID de son GROUPE
    (vérifié contre `meta_ads_insights`, `.scratch/journal-meta/issues/02`).
    Vu sous la forme `{"campaign_id": {"new": <ID>}}` sur `create_ad`, et en
    nombre nu `{"campaign_id": <ID>}` sur `first_delivery_event`
    (`.scratch/journal-meta/issues/19`)."""
    v = extra.get("campaign_id")
    if isinstance(v, dict):
        v = v.get("new")
    return str(v) if v not in (None, "") else None


# L'`actor_id` de Meta elle-même : « 0 » sur les 291 activités signées
# « Meta » des 988 lues sur 180 jours, dans les deux langues de jeton, et sur
# aucune des 4 personnes du compte (`.scratch/journal-meta/issues/20`). Non
# documenté : c'est ce que Meta envoie, pas ce qu'elle promet.
_ACTEUR_META = "0"


def _acteur(act: dict) -> dict:
    """`{"acteur": "meta" | "personne"}`, ou {} sans `actor_id` — même règle
    que `_element` : un None effacerait par upsert ce qui est déjà écrit."""
    aid = act.get("actor_id")
    if aid in (None, ""):
        return {}
    return {"acteur": "meta" if str(aid) == _ACTEUR_META else "personne"}


def _element(act: dict, parents: Parents, extra: dict) -> dict:
    """L'élément touché, rangé sous sa campagne et son groupe.

    Seules les valeurs connues sont rendues : chaque passage relit 180 jours,
    et une clé à None effacerait par upsert ce qu'un passage précédent a écrit.
    """
    niveau = niveau_de(str(act.get("event_type") or ""))
    oid = str(act.get("object_id") or "")
    nom = (act.get("object_name") or "").strip()
    element = {"niveau": niveau, "object_id": oid or None, "object_name": nom or None}
    if niveau == "campagne":
        element.update(campaign_id=oid or None, campaign_name=nom or None)
        return {k: v for k, v in element.items() if v}
    adset = oid if niveau == "groupe" else _groupe_dans_extra(extra)
    parent = parents.get(oid) or (parents.get(adset) if adset else None)
    if parent:
        adset = adset or parent.adset_id
        element.update(campaign_id=parent.campaign_id, campaign_name=parent.campaign_name)
    element["adset_id"] = adset or None
    return {k: v for k, v in element.items() if v}


def lignes_activites(actes: list[dict], parents: Parents, fuseau: str | None = None) -> list[dict]:
    """La réponse de /activities → les lignes de platform_changes.

    Pure, sans réseau : c'est le seam de test du journal (harnais
    `.scratch/journal-meta/harnais/12/`). `parents` vient de
    `hierarchie_depuis_insights` ; un ID absent laisse la campagne vide, et le
    changement ne se lit alors que sans filtre campagne.

    `occurred_at` reste l'instant UTC écrit par Meta ; `fuseau` dit dans quel
    fuseau l'écran découpe son jour. Inconnu, il n'est PAS envoyé : chaque
    passage relit 180 jours, et un `None` effacerait par upsert le fuseau
    déjà écrit. Même règle pour l'élément et `extra_data`.
    """
    rows: list[dict] = []
    vus: set[str] = set()
    for a in actes:
        quand = a.get("event_time")
        if not quand:
            continue
        extra = _extra_tel_quel(a.get("extra_data"))
        champs = _champs(extra)
        traduit = _traduire_meta(a, champs)
        if not traduit:
            continue
        categorie, resume = traduit
        cle = _cle_meta(quand, a.get("event_type"), a.get("object_id"))
        if cle in vus:
            continue
        vus.add(cle)
        rows.append({
            "change_id":   cle,
            "occurred_at": str(quand),
            "categorie":   categorie,
            "resume":      resume,
            **_element(a, parents, champs),
            **_acteur(a),
            **({"extra_data": extra} if extra is not None else {}),
            **({"fuseau": fuseau} if fuseau else {}),
        })
    return rows
