"""`canaux_muets` : les canaux payants dont la récolte a échoué au dernier passage.

LA PAGE NE LA LIT PLUS — l'état d'une source vit dans `sources` (ticket 04).
La clé reste dans le payload pour L'ESCALADE de la récolte (décision du
coordinateur, ticket 10) : `publish_weekly_report` la rend à
`account_sync`, qui la passe à `error_reporter.note_canaux_qui_durent` ; et
`semaines_muettes` compte la série EN RELISANT cette clé dans les rapports
déjà publiés. La sortir du payload remettrait le compte à 1 pour toujours,
sans aucune erreur.

D'où vient l'échec : `fetch_canaux_muets` (`saas/data/supabase/fetch_state/state.py`)
ne lit que l'état `echec` du dernier passage — jamais connecté et zéro mesuré
n'y entrent pas.
"""

from __future__ import annotations

from datetime import date

from saas.data.supabase.processed_data.weekly_report.blocs.semaine import Semaine

# Le nom porté devant le client : `meta` est un nom de colonne.
NOMS_CANAUX = {"meta": "Meta Ads", "google": "Google Ads"}

# À PARTIR DE COMBIEN DE RAPPORTS MUETS L'ESCALADE SORT DU CYCLE HEBDOMADAIRE.
# Deux, et pas un : une panne d'une SEULE semaine se rattrape toute seule au
# prochain passage réussi — `depart_recolte` (`saas/data/fetch_data/shared/date_ranges.py`)
# déduit le point de reprise des lignes réellement écrites, moins le
# recouvrement (28 jours côté Meta, 30 côté Google), donc la semaine trouée est
# réécrite (ADR 0005). Sonner à la première transférerait simplement le papier
# peint du client à David.
#
# LU PAR IMPORT LOCAL DEPUIS `saas/data/fetch_data/orchestration/error_reporter.py`
# (`note_canaux_qui_durent`) : aucun appelant ne se voit dans ce fichier.
SEUIL_ESCALADE = 2


def semaines_muettes(canal: str, historique: list[dict]) -> int:
    """Depuis combien de rapports publiés d'affilée ce canal est muet, CELUI
    QU'ON FABRIQUE COMPRIS. Vaut donc 1 à la première semaine.

    `historique` est ce que rend `lecteur.rapports_publies` : des lignes
    `{week_start, payload}`, la semaine en cours exclue. L'ordre est refait
    ici : une série comptée du mauvais bout tiendrait jusqu'au jour où la
    lecture changerait d'ordre, et personne ne le verrait.
    """
    n = 1
    for rapport in sorted(historique or [],
                          key=lambda r: str(r.get("week_start") or ""), reverse=True):
        muets = (rapport.get("payload") or {}).get("canaux_muets")
        # Une LISTE VIDE dit « aucun trou cette semaine-là » : la série est
        # cassée. Une clé ABSENTE (payload d'avant le ticket 20) ne sait pas
        # répondre : on s'arrête aussi — le compte est sous-estimé, jamais
        # inventé (`CLAUDE.md` §7).
        if not muets or canal not in {str(m.get("canal")) for m in muets}:
            break
        n += 1
    return n


def canaux_muets(lecteur, semaine: Semaine, week_start: str) -> list[dict]:
    """Toujours une liste, vide quand la récolte a tout lu : l'escalade lit une
    liste vide comme « revenu », une clé absente comme « je ne sais pas »."""
    try:
        echecs = dict(lecteur.canaux_muets() or {})
    except Exception:
        echecs = {}
    # Seule la pub creuse un trou dans un chiffre : Instagram muet coûte des
    # posts, pas une division fausse.
    echecs = {c: mot for c, mot in echecs.items() if c in NOMS_CANAUX}
    if not echecs:
        return []

    # La semaine en cours est exclue de son propre historique : republier
    # (`report_only`) ne doit pas compter ce rapport deux fois.
    try:
        historique = list(lecteur.rapports_publies(week_start))
    except Exception:
        historique = []

    sortie = []
    for canal, mot in sorted(echecs.items()):
        bord = _derniere_date(lecteur, canal)
        sortie.append({
            "canal": canal,
            "nom": NOMS_CANAUX[canal],
            # Le mot de la fin du worker : il nomme la variable, jamais sa valeur.
            "mot": mot,
            # Le dernier jour réellement écrit, déduit des lignes (même
            # raisonnement que `depart_recolte`) ; `None` s'il n'a rien écrit.
            "depuis": bord.isoformat() if bord else None,
            # Le trou touche-t-il CETTE semaine ? Un canal tombé après avoir
            # tout écrit est signalé sans rien taire.
            "chiffres_tus": bord is None or semaine.fin > bord,
            # Indépendant de `chiffres_tus` : un Google Ads mort sur un compte
            # organique ne cache rien aujourd'hui et cassera tout le jour de sa
            # première campagne (ticket 47).
            "semaines_muettes": semaines_muettes(canal, historique),
        })
    return sortie


def _derniere_date(lecteur, canal: str) -> date | None:
    try:
        lignes = lecteur.meta_ads() if canal == "meta" else lecteur.google_ads()
    except Exception:
        return None
    jours = []
    for ligne in lignes or []:
        try:
            jours.append(date.fromisoformat(str(ligne.get("date_start") or "")[:10]))
        except ValueError:
            continue
    return max(jours) if jours else None
