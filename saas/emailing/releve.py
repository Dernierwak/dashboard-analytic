"""QUAND relever un email déjà envoyé, et comment le dire — sans toucher Supabase.

QUATRIÈME FICHIER DE CE DOSSIER, et il garde la règle des trois autres : aucun
ne touche Supabase. Il porte les décisions PURES du relevé (ticket 50) — faut-il
redemander au fournisseur, quelle ligne écrire au journal. Lire la ligne
d'envoi, appeler `etat_email` et ranger le fait, c'est le travail de
l'orchestrateur (`saas/collecte/automatisation/passage.py`, `relever_ouverture`),
qui passe par `saas/commun/`. Ces fonctions vivaient dans `fetch_all.py`
jusqu'au ticket 07 de `.scratch/recolte/`.
"""
from __future__ import annotations

from datetime import datetime, timedelta

# ON NE RELIT PAS UN EMAIL PARTI IL Y A UNE HEURE, et on ne redemande pas deux
# fois le même jour. Le cas n'est pas théorique — un `--force` relancé le jour
# même repasse sur le compte quelques minutes après l'envoi, et un `report_only`
# lancé à la main peut repasser dix fois dans l'après-midi.
_DELAI_RELEVE_H = 24


def _assez_vieux(iso: str | None, maintenant: datetime) -> bool:
    """Cet horodatage a-t-il au moins `_DELAI_RELEVE_H` ? Absent ou illisible → oui.

    UN HORODATAGE AVEC FUSEAU SE RAMÈNE EN UTC AVANT D'ÊTRE COMPARÉ. Postgres
    rend `timestamptz` avec un décalage (`+02:00`) ou un `Z` ; le comparer tel
    quel à un `utcnow()` naïf lève `TypeError`, que le `try` de
    `relever_ouverture` (`saas/collecte/automatisation/passage.py`) avalerait — le relevé ne partirait alors jamais, en
    silence.
    """
    if not iso:
        return True
    try:
        quand = datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
    except ValueError:
        return True
    if quand.tzinfo is not None:
        quand = quand.replace(tzinfo=None) - quand.utcoffset()
    return (maintenant - quand) >= timedelta(hours=_DELAI_RELEVE_H)


def a_relever(envoi: dict | None, maintenant: datetime) -> bool:
    """Faut-il redemander au fournisseur ce qu'est devenu cet envoi ?

    Quatre non, et chacun pour une raison différente :
      · rien à relire — pas de `message_id` (dry-run, envoi en échec), ou un
        fournisseur que ce code ne sait pas interroger. Il ne faut surtout pas
        en conclure une non-ouverture ;
      · la réponse est DÉFINITIVE — ouvert, cliqué, signalé, pas arrivé :
        redemander paierait un appel pour la même réponse ;
      · l'envoi est trop récent — voir `_DELAI_RELEVE_H` ;
      · on a déjà demandé il y a moins de `_DELAI_RELEVE_H`.

    ET UN SILENCE N'EST PAS UNE RÉPONSE DÉFINITIVE, c'est ce qui commande tout
    le reste. La plupart des ouvertures arrivent APRÈS le premier jour : figer
    la réponse au premier relevé — comme le faisait la version d'avant, qui
    s'arrêtait dès que `releve_a` était posé — perdrait systématiquement le
    fait qu'on cherche, et d'autant plus sûrement qu'un `report_only` lancé à
    la main 25 h après l'envoi suffisait à le figer pour de bon.
    """
    from saas.emailing.evenements import (ETATS_DEFINITIFS,
                                          FOURNISSEURS_RELISIBLES,
                                          etat_ouverture)
    if not envoi or not envoi.get("message_id"):
        return False
    if (envoi.get("fournisseur") or "") not in FOURNISSEURS_RELISIBLES:
        return False
    if etat_ouverture(envoi.get("dernier_evenement")) in ETATS_DEFINITIFS:
        return False
    return (_assez_vieux(envoi.get("envoye_a"), maintenant)
            and _assez_vieux(envoi.get("releve_a"), maintenant))


def mot_du_releve(envoi: dict, evenement: str | None) -> str:
    """La ligne de journal : de quand datait l'email, et ce qu'il est devenu.

    LA SEMAINE EST NOMMÉE, parce que le relevé porte sur l'email de la semaine
    PRÉCÉDENTE — celui de cette semaine vient à peine de partir. Sans la date,
    la ligne se lirait comme un verdict sur l'email du jour.
    """
    from saas.emailing.evenements import phrase_ouverture
    return f"email du {envoi.get('week_start')} : {phrase_ouverture(evenement)}"
