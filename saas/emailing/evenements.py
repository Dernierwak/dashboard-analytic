"""Ce qu'est devenu un email déjà envoyé — relu chez le fournisseur (ticket 50).

TROISIÈME FICHIER DE CE DOSSIER, et il garde la règle des deux autres :
`render.py` met en forme, `send.py` envoie, celui-ci relit. **Aucun des trois
ne touche Supabase** — ranger le fait est le travail de `saas/commun/`, le
composer celui de l'orchestrateur (`saas/collecte/automatisation/passage.py`).

POURQUOI RELIRE L'API PLUTÔT QU'UN WEBHOOK. Un webhook demanderait une route
publique, un secret de signature et une vérification — de l'outillage
d'exploitation pour un fait qu'on ne consulte qu'une fois par semaine, au
passage du worker. C'est la même doctrine que le ticket 47 : le tuyau est celui
qui existe déjà, et on ne construit le suivant qu'avec la preuve qu'il manque.

CE QUE CE MODULE NE DIRA JAMAIS : « pas ouvert ». Une ouverture est un pixel
chargé ; un pixel bloqué, un volet de prévisualisation ou un client mail qui
précharge la faussent dans les deux sens. Le vocabulaire ci-dessous n'a donc
pas de valeur « fermée » : il a `SANS_REPONSE`, qui veut dire « le fournisseur
n'a rien remonté », et `INCONNU`, qui veut dire « on n'a pas su demander ». Ce
qu'on a le droit d'en conclure est écrit dans `docs/mesures-impossibles.md`.
"""

import os
import requests

# LES RÉPONSES POSSIBLES, et aucune ne dit « pas ouvert ».
#
# CE NE SONT PAS DES NUANCES DE CONFORT : chacune répond DIFFÉREMMENT à la
# question du ticket 47 (« le client a-t-il été prévenu ? »), et les rabattre
# les unes sur les autres perdrait exactement ce pour quoi ce module existe.
#
#   · `CLIQUE` est un GESTE, pas un pixel : le lien a été suivi, et pourtant le
#     canal n'est toujours pas reconnecté → la friction du 49 est démontrée.
#   · `SIGNALE_SPAM` est la réponse la PLUS FORTE du lot, et la plus
#     contre-intuitive : marquer un email comme indésirable prouve qu'il est
#     arrivé ET qu'un humain l'a regardé. Le ranger avec les rebonds ferait
#     chercher un problème d'adresse sur le seul événement qui répond déjà.
#   · `PAS_ARRIVE` dit que l'email n'a jamais atterri → aucune des deux
#     hypothèses du ticket 50 ne tient, c'est l'adresse qu'il faut regarder.
#   · `EN_ROUTE` n'est pas un silence : l'envoi est encore en cours chez le
#     fournisseur. Le confondre avec « livré sans réaction » ferait lire une
#     absence d'ouverture sur un email qui n'est pas encore arrivé.
CLIQUE = "clique"
OUVERT = "ouvert"
SIGNALE_SPAM = "signale_spam"
PAS_ARRIVE = "pas_arrive"
EN_ROUTE = "en_route"
SANS_REPONSE = "sans_reponse"
INCONNU = "inconnu"

# CE QU'ON SAIT RELIRE. `send.py` est écrit pour accepter un autre fournisseur
# « sans que le reste bouge » ; ce module-ci, lui, ne parle qu'à Resend. Le jour
# où `EMAIL_PROVIDER` change, redemander à Resend un identifiant qui n'est pas
# le sien rendrait un 404 par semaine, et personne ne saurait pourquoi. C'est
# `a_relever` (`releve.py`) qui s'en sert pour ne pas appeler dans le vide.
FOURNISSEURS_RELISIBLES = ("resend",)

# Les noms d'événements de Resend, sans leur préfixe `email.` — c'est sous
# cette forme que `last_event` les rend (vérifié le 2026-09-20 sur
# resend.com/docs/dashboard/webhooks/event-types et .../api-reference/emails/
# retrieve-email).
_EVENEMENTS = {
    "clicked": CLIQUE,
    "opened": OUVERT,
    "complained": SIGNALE_SPAM,
    "bounced": PAS_ARRIVE,
    "failed": PAS_ARRIVE,
    # `suppressed` = le fournisseur a REFUSÉ d'envoyer (adresse déjà sur sa
    # liste de suppression). L'email n'est donc jamais parti : c'est bien un
    # « pas arrivé », et non un silence.
    "suppressed": PAS_ARRIVE,
    "scheduled": EN_ROUTE,
    "delivery_delayed": EN_ROUTE,
    "sent": SANS_REPONSE,
    "delivered": SANS_REPONSE,
    "received": SANS_REPONSE,
}

# LES ÉTATS QUI NE CHANGERONT PLUS. Une fois l'un d'eux remonté, redemander
# coûterait un appel pour la même réponse. Tout le reste — un silence, un
# envoi en cours, un événement qu'on ne sait pas lire — peut encore devenir
# une ouverture, donc se redemande au passage suivant.
ETATS_DEFINITIFS = (CLIQUE, OUVERT, SIGNALE_SPAM, PAS_ARRIVE)


def etat_ouverture(evenement: str | None) -> str:
    """Traduit le dernier événement du fournisseur en une des cinq réponses.

    UN ÉVÉNEMENT QU'ON NE CONNAÎT PAS REND `INCONNU`, jamais `SANS_REPONSE`.
    La différence n'est pas cosmétique : le jour où Resend ajoute un nom
    d'événement, le ranger par défaut dans « rien n'est remonté » ferait lire
    un fait qu'on vient de recevoir comme une absence de fait — et c'est
    précisément l'absence qu'on est en train d'interpréter.
    """
    if not evenement:
        return INCONNU
    return _EVENEMENTS.get(str(evenement).strip().lower().removeprefix("email."), INCONNU)


def phrase_ouverture(evenement: str | None) -> str:
    """La ligne que David lit dans le journal du run. Factuelle, avec sa réserve.

    ELLE N'EST APPELÉE QUE QUAND ON A DEMANDÉ — `relever_ouverture` (`passage.py`) sort avant
    sinon. Ses phrases peuvent donc parler de ce que le fournisseur a répondu ;
    aucune ne doit laisser croire que l'appel a échoué quand il a abouti.
    """
    etat = etat_ouverture(evenement)
    if etat == CLIQUE:
        return "il a CLIQUÉ dans l'email — le message est passé, le geste n'a pas suivi"
    if etat == OUVERT:
        return "email ouvert (pixel chargé — une prévisualisation compte aussi)"
    if etat == SIGNALE_SPAM:
        return ("il l'a marqué comme INDÉSIRABLE — donc reçu et regardé, et le "
                "fournisseur ne lui écrira plus")
    if etat == PAS_ARRIVE:
        return f"l'email N'EST PAS ARRIVÉ ({evenement}) — c'est l'adresse qu'il faut regarder"
    if etat == EN_ROUTE:
        return f"l'envoi est encore en cours chez le fournisseur ({evenement})"
    if etat == SANS_REPONSE:
        return ("aucune ouverture remontée — ça ne prouve PAS qu'il n'a pas lu "
                "(pixel bloqué, suivi non activé sur le domaine)")
    if evenement:
        return (f"événement inconnu du code ({evenement}) — rien n'en est conclu, "
                f"ni dans un sens ni dans l'autre")
    return ("aucun événement remonté par le fournisseur — ni lu, ni pas lu "
            "(le suivi d'ouverture n'est peut-être pas activé)")


def etat_email(message_id: str | None) -> dict:
    """Redemande au fournisseur ce qu'est devenu cet envoi.

    Rend {ok, provider, evenement, detail}. `evenement` est la chaîne BRUTE du
    fournisseur, rangée telle quelle : la traduire avant de la stocker
    perdrait ce qu'on n'a pas encore appris à lire.

    UN ÉCHEC D'APPEL N'EST PAS UNE NON-OUVERTURE — il rend `ok: False` et
    `evenement: None`, que l'appelant range en `INCONNU`. Sans ça, une coupure
    réseau se lirait comme un client qui n'ouvre pas son courrier.
    """
    if not message_id:
        return {"ok": False, "provider": "", "evenement": None,
                "detail": "aucun identifiant d'envoi à relire"}
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        return {"ok": False, "provider": "resend", "evenement": None,
                "detail": "RESEND_API_KEY manquante"}
    try:
        r = requests.get(
            f"https://api.resend.com/emails/{message_id}",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=20,
        )
        if r.status_code == 200:
            return {"ok": True, "provider": "resend",
                    "evenement": r.json().get("last_event") or None, "detail": ""}
        return {"ok": False, "provider": "resend", "evenement": None,
                "detail": f"HTTP {r.status_code}: {r.text[:200]}"}
    except Exception as e:
        return {"ok": False, "provider": "resend", "evenement": None, "detail": str(e)}
