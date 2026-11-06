"""Le relevé du compte Instagram : la journée d'hier, et la portée des 7 jours.

Spec `.scratch/instagram/spec.md` § La récolte — « Le relevé du compte, pour
hier » et R5 ; ticket 05 de `.scratch/instagram-construction/`. Appelé par le
passage léger quotidien (`orchestration/account_sync.leger`), donc chaque jour,
Jour de travail ou non.

Trois règles tiennent ce fichier :
· LE JOUR EN COURS N'EST JAMAIS ÉCRIT (`CLAUDE.md` §7) : seul hier l'est.
· UNE ABSENCE MESURÉE EST NULL, UNE PANNE N'ÉCRIT RIEN. Meta rend un jeu vide,
  ou une ventilation sans `AD` → la colonne part à NULL. Un appel en erreur →
  la colonne n'est PAS envoyée : l'upsert garde la valeur déjà en base, jamais
  un NULL par-dessus une bonne valeur (arbitrage du chantier).
· UN JOUR NON LU N'A PAS DE LIGNE : tous les appels en erreur → rien d'écrit.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from saas.data.fetch_data.sources.meta.graph_client import AccesMeta
from saas.data.fetch_data.sources.meta.instagram.fetchers import account_insights as graph
from saas.data.supabase.source_data.instagram_compte import (
    ecrire_jour_du_compte, ecrire_periode_du_compte)

# La période que la page montre par défaut : les 7 jours finissant hier
# (spec § La page, Tendance). Sa portée dédoublonnée ne se reconstitue pas à
# partir des jours — on garde celle qu'Instagram rend (décision de
# construction du ticket 05).
_JOURS_DE_LA_PERIODE = 7


def valeur_totale(reponse: dict) -> int | None:
    """`data[0].total_value.value`, ou None si Meta ne l'a pas rendu."""
    lignes = reponse.get("data") or []
    return ((lignes[0].get("total_value") or {}).get("value")) if lignes else None


def valeur_ventilee(reponse: dict, dimension: str) -> int | None:
    """La valeur de `dimension` dans la ventilation, ou None si elle n'y est pas.

    Une dimension absente n'est pas un zéro : Meta n'énumère pas les produits
    sans activité, et rien ne garantit qu'il le fasse pour `AD` — le ticket
    tranche « `AD` absent → NULL ».
    """
    lignes = reponse.get("data") or []
    if not lignes:
        return None
    for ventilation in (lignes[0].get("total_value") or {}).get("breakdowns") or []:
        for resultat in ventilation.get("results") or []:
            if resultat.get("dimension_values") == [dimension]:
                return resultat.get("value")
    return None


def ligne_du_jour(uid: str, jour: date, reponses: dict[str, tuple]) -> dict | None:
    """Les réponses Graph du jour → la ligne de `instagram_compte_jours`, ou None.

    `reponses` : `{nom: (objet, erreur)}` pour `reach`, `reach_ventile`,
    `interactions`, `interactions_ventile`, `follows`, `abonnes`.
    """
    lecteurs = {
        "reach": ("reach", valeur_totale),
        "reach_ad": ("reach_ventile", lambda r: valeur_ventilee(r, "AD")),
        "total_interactions": ("interactions", valeur_totale),
        "interactions_ad": ("interactions_ventile", lambda r: valeur_ventilee(r, "AD")),
        # FOLLOWER = gagnés, NON_FOLLOWER = perdus (essai réel, `issues/17` point 3).
        "gagnes": ("follows", lambda r: valeur_ventilee(r, "FOLLOWER")),
        "perdus": ("follows", lambda r: valeur_ventilee(r, "NON_FOLLOWER")),
        "abonnes": ("abonnes", lambda r: r.get("followers_count")),
    }
    ligne = {}
    for colonne, (nom, lecteur) in lecteurs.items():
        objet, erreur = reponses[nom]
        if erreur is None:
            ligne[colonne] = lecteur(objet)
    if not ligne:
        return None
    return {"user_id": uid, "jour": jour.isoformat(), **ligne}


def releve_du_compte(sb, uid: str, acces: AccesMeta,
                     maintenant: datetime | None = None) -> str:
    """Relève hier et la portée des 7 jours finissant hier → le mot du journal.

    Ne lève pas sur une réponse Meta en erreur : le relevé des posts du même
    passage léger ne doit pas tomber pour le compte, et inversement.

    `abonnes` reçoit le `followers_count` DU PASSAGE (07:00 UTC le lendemain)
    sur la ligne d'hier, comme le veut la spec (« followers_count du
    passage ») : c'est la seule ligne que le passage écrit, et le jour en cours
    n'en a jamais. La remontée des abonnés (ticket 06) s'ancre sur ce total.
    """
    if not acces.instagram:
        raise ValueError("instagram_business_id requis en mode headless")
    aujourdhui = (maintenant or datetime.now(timezone.utc)).astimezone(timezone.utc).date()
    hier = aujourdhui - timedelta(days=1)
    reponses = {
        "reach": graph.total(acces, "reach", hier, aujourdhui),
        "reach_ventile": graph.total(acces, "reach", hier, aujourdhui, "media_product_type"),
        "interactions": graph.total(acces, "total_interactions", hier, aujourdhui),
        "interactions_ventile": graph.total(acces, "total_interactions", hier, aujourdhui,
                                            "media_product_type"),
        "follows": graph.total(acces, "follows_and_unfollows", hier, aujourdhui, "follow_type"),
        "abonnes": graph.abonnes(acces),
    }
    debut = aujourdhui - timedelta(days=_JOURS_DE_LA_PERIODE)
    periode, erreur_periode = graph.total(acces, "reach", debut, aujourdhui)

    erreurs = [nom for nom, (_, err) in reponses.items() if err]
    ligne = ligne_du_jour(uid, hier, reponses)
    if ligne:
        ecrire_jour_du_compte(sb, ligne)
    # Une période sans valeur ne s'écrit pas : la table est en ajout seul, une
    # ligne NULL bloquerait la bonne valeur d'un passage suivant.
    reach_periode = None if erreur_periode else valeur_totale(periode)
    if reach_periode is not None:
        ecrire_periode_du_compte(sb, {"user_id": uid, "debut": debut.isoformat(),
                                      "fin": hier.isoformat(), "reach": reach_periode})

    if not ligne:
        return f"compte: {hier} non relevé — erreur Meta sur tous les appels ({reponses['reach'][1]})"
    mot = f"compte: {hier} relevé"
    if erreurs:
        mot += f" (erreur Meta sur {', '.join(erreurs)} — valeurs en base gardées)"
    if reach_periode is None:
        mot += " ; portée des 7 jours non rendue"
    return mot
