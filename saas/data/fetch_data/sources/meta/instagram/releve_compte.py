"""Le relevé du compte Instagram : hier et avant-hier, la portée des 7 jours,
et au premier passage, 90 jours et la remontée des abonnés.

Spec `.scratch/instagram/spec.md` § La récolte — « Le relevé du compte, pour
hier », « Au premier passage d'un compte » et R5 ; tickets 05 et 06 de
`.scratch/instagram-construction/`. Appelé par le passage léger quotidien
(`orchestration/account_sync.leger`), donc chaque jour, Jour de travail ou non.

Quatre règles tiennent ce fichier :
· LE JOUR EN COURS N'EST JAMAIS ÉCRIT (`CLAUDE.md` §7) : hier au plus tard.
· AVANT-HIER EST RELU À CHAQUE PASSAGE : Meta documente jusqu'à 48 h de retard
  sur les chiffres du compte (`issues/04`) ; la ligne écrite la veille pouvait
  être partielle, l'upsert la complète (arbitrage du ticket 06).
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
    a_des_jours_avant, ecrire_jours_du_compte, ecrire_periode_du_compte)

UN_JOUR = timedelta(days=1)

# La période que la page montre par défaut : les 7 jours finissant hier
# (spec § La page, Tendance). Sa portée dédoublonnée ne se reconstitue pas à
# partir des jours — on garde celle qu'Instagram rend (ticket 05).
_JOURS_DE_LA_PERIODE = 7

# Premier passage (spec § La récolte, « Au premier passage d'un compte »).
_JOURS_DU_PREMIER_PASSAGE = 90
# Instagram ne rend gagnés et perdus que sur 30 jours (essai réel, `issues/17` ;
# spec § Ce qu'on ne mesure pas) : la remontée des abonnés s'arrête là.
_JOURS_DE_MOUVEMENTS = 30
# Une fenêtre de plus de 30 jours est refusée en entier (erreur 100) sur
# `follows_and_unfollows` (essai réel). Non essayé sur la portée : la spec
# compte « 1 appel » pour 90 jours, on en fait 3 plutôt que de risquer les
# 90 jours sur un refus.
_JOURS_PAR_SERIE = 30

_NOMS_DU_JOUR = ("reach", "reach_ventile", "interactions", "interactions_ventile", "follows")


def valeur_totale(reponse: dict) -> int | None:
    """`data[0].total_value.value`, ou None si Meta ne l'a pas rendu."""
    lignes = reponse.get("data") or []
    return ((lignes[0].get("total_value") or {}).get("value")) if lignes else None


def valeur_ventilee(reponse: dict, dimension: str) -> int | None:
    """La valeur de `dimension` dans la ventilation, ou None si elle n'y est pas.

    Une dimension absente n'est pas un zéro : Meta n'énumère pas les produits
    sans activité, et rien ne garantit qu'il le fasse pour `AD` — le ticket 05
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


def valeurs_par_jour(reponse: dict) -> dict[date, int | None]:
    """Une série `period=day` → `{jour: valeur}`.

    `end_time` marque la FIN de la journée comptée (relevé : J+1 à 07:00 ou
    08:00 +0000, `recolte.md` § 1) : le jour est celui qui précède `end_time`.
    Ancré sur la fin plutôt que sur l'heure, la règle donne le même jour que
    Meta compte en UTC ou en heure du Pacifique. Non vérifié sur une réponse
    brute de 90 jours.
    """
    lignes = reponse.get("data") or []
    jours: dict[date, int | None] = {}
    for point in (lignes[0].get("values") or []) if lignes else []:
        fin = datetime.fromisoformat(point["end_time"]).astimezone(timezone.utc)
        jours[(fin - UN_JOUR).date()] = point.get("value")
    return jours


def ligne_du_jour(uid: str, jour: date, reponses: dict[str, tuple]) -> dict | None:
    """Les réponses Graph d'un jour → la ligne de `instagram_compte_jours`, ou None.

    `reponses` : `{nom: (objet, erreur)}` parmi `reach`, `reach_ventile`,
    `interactions`, `interactions_ventile`, `follows`, `abonnes`. Un nom absent
    n'est pas lu ce jour-là : sa colonne n'est pas envoyée.
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
        objet, erreur = reponses.get(nom, (None, "non lu"))
        if erreur is None:
            ligne[colonne] = lecteur(objet)
    if not ligne:
        return None
    return {"user_id": uid, "jour": jour.isoformat(), **ligne}


def mouvements(reponse: tuple) -> tuple[int, int] | None:
    """`(gagnés, perdus)` d'un jour, ou None si l'un des deux manque — appel en
    erreur ou dimension absente : la remontée ne prend pas une absence pour 0."""
    objet, erreur = reponse
    if erreur:
        return None
    gagnes, perdus = valeur_ventilee(objet, "FOLLOWER"), valeur_ventilee(objet, "NON_FOLLOWER")
    return None if gagnes is None or perdus is None else (gagnes, perdus)


def remonter_abonnes(ancre_jour: date, ancre: int,
                     par_jour: dict[date, tuple[int, int] | None]) -> tuple[dict[date, int], date | None]:
    """Les totaux des jours passés, de proche en proche → `({jour: total}, arrêt)`.

    total(J − 1) = total(J) − gagnés(J) + perdus(J) (spec). Le premier jour
    sans mouvements connus ARRÊTE la courbe : rien n'est interpolé par-dessus
    (spec § La page, « un jour manquant dans la remontée l'arrête là »).
    `arrêt` = ce jour-là, ou None si toute la fenêtre est passée.
    """
    totaux: dict[date, int] = {}
    total, jour = ancre, ancre_jour
    for _ in range(len(par_jour)):
        mouvement = par_jour.get(jour)
        if mouvement is None:
            return totaux, jour
        gagnes, perdus = mouvement
        total = total - gagnes + perdus
        jour -= UN_JOUR
        totaux[jour] = total
    return totaux, None


def _reponses_du_jour(acces: AccesMeta, jour: date) -> dict[str, tuple]:
    """Les cinq appels d'un jour. Un appel par chiffre : un appel multi-métriques
    est refusé en entier dès qu'une métrique l'est (`account_insights`)."""
    lendemain = jour + UN_JOUR
    return {
        "reach": graph.total(acces, "reach", jour, lendemain),
        "reach_ventile": graph.total(acces, "reach", jour, lendemain, "media_product_type"),
        "interactions": graph.total(acces, "total_interactions", jour, lendemain),
        "interactions_ventile": graph.total(acces, "total_interactions", jour, lendemain,
                                            "media_product_type"),
        "follows": graph.total(acces, "follows_and_unfollows", jour, lendemain, "follow_type"),
    }


def premier_passage(uid: str, acces: AccesMeta, aujourdhui: date,
                    deja_lus: dict[date, dict[str, tuple]]) -> tuple[list[dict], str]:
    """Les 90 jours d'un compte neuf → `(lignes, mot du journal)`.

    `deja_lus` : les réponses d'hier et d'avant-hier, lues par le relevé du
    jour — ces deux jours ne sont pas redemandés. Portée en tranches de 30
    jours, interactions et gagnés / perdus un appel par jour. La part `AD`
    n'est pas remontée : la spec ne la demande pas au premier passage, et elle
    coûterait 176 appels de plus.
    """
    hier, avant_hier = aujourdhui - UN_JOUR, aujourdhui - 2 * UN_JOUR
    debut = aujourdhui - timedelta(days=_JOURS_DU_PREMIER_PASSAGE)
    jours = [debut + k * UN_JOUR for k in range((avant_hier - debut).days)]
    colonnes: dict[date, dict] = {j: {} for j in jours}

    for k in range(0, len(jours), _JOURS_PAR_SERIE):
        tranche = jours[k:k + _JOURS_PAR_SERIE]
        objet, erreur = graph.serie(acces, "reach", tranche[0], tranche[-1] + UN_JOUR)
        if erreur is None:
            valeurs = valeurs_par_jour(objet)
            for j in tranche:
                colonnes[j]["reach"] = valeurs.get(j)
    for j in jours:
        objet, erreur = graph.total(acces, "total_interactions", j, j + UN_JOUR)
        if erreur is None:
            colonnes[j]["total_interactions"] = valeur_totale(objet)

    par_jour: dict[date, tuple[int, int] | None] = {}
    for k in range(_JOURS_DE_MOUVEMENTS):
        j = hier - k * UN_JOUR
        reponse = (deja_lus[j]["follows"] if j in deja_lus else
                   graph.total(acces, "follows_and_unfollows", j, j + UN_JOUR, "follow_type"))
        par_jour[j] = mouvements(reponse)
        if j in colonnes and reponse[1] is None:
            colonnes[j]["gagnes"] = valeur_ventilee(reponse[0], "FOLLOWER")
            colonnes[j]["perdus"] = valeur_ventilee(reponse[0], "NON_FOLLOWER")

    # L'ancre est le `followers_count` du passage, posé sur hier (ticket 05).
    ancre_objet, ancre_erreur = deja_lus[hier]["abonnes"]
    ancre = None if ancre_erreur else ancre_objet.get("followers_count")
    totaux, arret = remonter_abonnes(hier, ancre, par_jour) if ancre is not None else ({}, None)
    for j, total in totaux.items():
        colonnes.setdefault(j, {})["abonnes"] = total

    lignes = [{"user_id": uid, "jour": j.isoformat(), **c} for j, c in sorted(colonnes.items()) if c]
    lus = sum(1 for j in jours if colonnes[j])
    mot = (f"premier passage : {lus}/{len(jours)} jours remontés avant avant-hier "
           f"(portée {sum('reach' in colonnes[j] for j in jours)}, "
           f"interactions {sum('total_interactions' in colonnes[j] for j in jours)})")
    if ancre is None:
        mot += ", abonnés non remontés — followers_count non rendu"
    else:
        mot += f", abonnés remontés sur {len(totaux)} jours"
        if arret is not None:
            mot += f", arrêtés au {arret} (gagnés / perdus non rendus ce jour-là)"
    return lignes, mot


def releve_du_compte(sb, uid: str, acces: AccesMeta,
                     maintenant: datetime | None = None) -> str:
    """Relève hier, avant-hier et la portée des 7 jours finissant hier — et
    tout le premier passage si le compte est neuf → le mot du journal.

    Ne lève pas sur une réponse Meta en erreur : le relevé des posts du même
    passage léger ne doit pas tomber pour le compte, et inversement.

    `abonnes` reçoit le `followers_count` DU PASSAGE (07:00 UTC le lendemain)
    sur la ligne d'hier, comme le veut la spec (« followers_count du
    passage ») ; avant-hier ne le reçoit pas : il garde celui du passage
    d'hier. La remontée des abonnés s'ancre sur ce total.

    PREMIER PASSAGE = aucune ligne avant avant-hier (arbitrage du ticket 06) :
    le léger écrit hier et avant-hier chaque jour, une ligne plus ancienne ne
    vient que d'une remontée déjà faite ou d'un passage d'il y a 3 jours.
    """
    if not acces.instagram:
        raise ValueError("instagram_business_id requis en mode headless")
    aujourdhui = (maintenant or datetime.now(timezone.utc)).astimezone(timezone.utc).date()
    hier, avant_hier = aujourdhui - UN_JOUR, aujourdhui - 2 * UN_JOUR
    lus = {hier: _reponses_du_jour(acces, hier), avant_hier: _reponses_du_jour(acces, avant_hier)}
    lus[hier]["abonnes"] = graph.abonnes(acces)
    debut = aujourdhui - timedelta(days=_JOURS_DE_LA_PERIODE)
    periode, erreur_periode = graph.total(acces, "reach", debut, aujourdhui)

    lignes = [ligne for jour, reponses in lus.items()
              if (ligne := ligne_du_jour(uid, jour, reponses))]
    try:
        neuf: bool | None = not a_des_jours_avant(sb, uid, avant_hier)
    except Exception as e:
        neuf = None
        erreur_base = type(e).__name__
    mot_premier = None
    if neuf:
        remontees, mot_premier = premier_passage(uid, acces, aujourdhui, lus)
        lignes += remontees
    if lignes:
        ecrire_jours_du_compte(sb, lignes)
    # Une période sans valeur ne s'écrit pas : la table est en ajout seul, une
    # ligne NULL bloquerait la bonne valeur d'un passage suivant.
    reach_periode = None if erreur_periode else valeur_totale(periode)
    if reach_periode is not None:
        ecrire_periode_du_compte(sb, {"user_id": uid, "debut": debut.isoformat(),
                                      "fin": hier.isoformat(), "reach": reach_periode})

    jours_ecrits = {ligne["jour"] for ligne in lignes}
    if hier.isoformat() in jours_ecrits:
        mot = f"compte: {hier} relevé"
    else:
        mot = f"compte: {hier} non relevé — erreur Meta sur tous les appels ({lus[hier]['reach'][1]})"
    mot += f", {avant_hier} relu" if avant_hier.isoformat() in jours_ecrits else f", {avant_hier} non relu"
    erreurs = [f"{nom} ({jour:%d/%m})" for jour, reponses in lus.items()
               for nom, (_, err) in reponses.items() if err]
    if erreurs and jours_ecrits:
        mot += f" (erreur Meta sur {', '.join(erreurs)} — valeurs en base gardées)"
    if reach_periode is None:
        mot += " ; portée des 7 jours non rendue"
    if neuf is None:
        mot += f" ; premier passage non vérifié — lecture de la base en erreur ({erreur_base})"
    elif mot_premier:
        mot += f" ; {mot_premier}"
    return mot
