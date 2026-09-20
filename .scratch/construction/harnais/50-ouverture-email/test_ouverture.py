"""Ticket 50 — on ne sait pas si l'email hebdo est ouvert.

CE QUE CE HARNAIS PROUVE. Que le relevé d'ouverture ne fabrique jamais le seul
chiffre qu'il serait tentant de fabriquer : **« il n'a pas ouvert »**. Aucune
entrée — silence du fournisseur, événement inconnu, appel raté, dry-run — ne
doit produire cette conclusion, parce qu'aucune ne la démontre.

Et qu'il garde les deux faits qui, eux, sont vrais et tranchent vraiment : un
CLIC (un geste, pas un pixel) et un REBOND (l'email n'est jamais arrivé).

Ni base, ni secret, ni réseau : tout ce qui est vérifié ici est pur.
"""
from datetime import datetime, timedelta

import pulse  # noqa: F401
from t import ok, egal, bilan

from saas.emailing.evenements import (
    CLIQUE, OUVERT, SIGNALE_SPAM, PAS_ARRIVE, EN_ROUTE, SANS_REPONSE, INCONNU,
    etat_ouverture, phrase_ouverture,
)
import saas.collecte.automatisation.fetch_all as fetch_all


MAINTENANT = datetime(2026, 9, 20, 7, 0, 0)


def envoi(**kw) -> dict:
    """Une ligne d'`email_envois` telle que `fetch_dernier_envoi_email` la rend."""
    ligne = {
        "week_start": "2026-09-14",
        "fournisseur": "resend",
        "message_id": "4ef9a417-02e9-4d39-ad75-9611e0fcc33c",
        "envoi_ok": True,
        "envoye_a": (MAINTENANT - timedelta(days=7)).isoformat(),
        "dernier_evenement": None,
        "releve_a": None,
    }
    ligne.update(kw)
    return ligne


# ── 1. La traduction des événements du fournisseur ───────────────────────────

def test_les_evenements_connus_se_rangent_chacun_dans_sa_case():
    egal("clicked", etat_ouverture("clicked"), CLIQUE)
    egal("opened", etat_ouverture("opened"), OUVERT)
    egal("bounced", etat_ouverture("bounced"), PAS_ARRIVE)
    egal("failed", etat_ouverture("failed"), PAS_ARRIVE)
    egal("suppressed", etat_ouverture("suppressed"), PAS_ARRIVE)
    egal("delivered", etat_ouverture("delivered"), SANS_REPONSE)
    egal("sent", etat_ouverture("sent"), SANS_REPONSE)


def test_une_plainte_pour_spam_n_est_pas_un_rebond():
    """LA RÉPONSE LA PLUS FORTE DU LOT, et la plus contre-intuitive. Marquer un
    email comme indésirable prouve qu'il est ARRIVÉ et qu'un humain l'a
    REGARDÉ — c'est-à-dire exactement ce que le ticket cherche à savoir. Le
    ranger avec les rebonds ferait chercher un problème d'adresse sur le seul
    événement qui répond déjà à la question."""
    egal("complained", etat_ouverture("complained"), SIGNALE_SPAM)
    phrase = phrase_ouverture("complained").lower()
    ok("la phrase dit qu'il l'a reçu", "reçu" in phrase, phrase)
    ok("et pas qu'il n'est pas arrivé", "pas arriv" not in phrase, phrase)


def test_un_envoi_encore_en_cours_n_est_pas_un_silence():
    """`delivery_delayed` veut dire que le fournisseur réessaie encore. Le
    ranger dans « rien remonté » ferait lire une absence d'ouverture sur un
    email qui n'est même pas arrivé — deux axes différents, confondus."""
    egal("delivery_delayed", etat_ouverture("delivery_delayed"), EN_ROUTE)
    egal("scheduled", etat_ouverture("scheduled"), EN_ROUTE)
    phrase = phrase_ouverture("delivery_delayed").lower()
    ok("la phrase parle de l'envoi, pas de la lecture",
       "en cours" in phrase and "ouverture" not in phrase, phrase)


def test_le_prefixe_email_du_webhook_ne_change_rien():
    """Les webhooks nomment `email.opened`, l'API rend `opened`. Le jour où le
    fait entre par l'autre porte, il ne doit pas devenir inconnu."""
    egal("email.opened", etat_ouverture("email.opened"), OUVERT)
    egal("EMAIL.BOUNCED", etat_ouverture("EMAIL.BOUNCED"), PAS_ARRIVE)
    egal("  delivered  ", etat_ouverture("  delivered  "), SANS_REPONSE)


def test_un_evenement_inconnu_ne_tombe_pas_dans_sans_reponse():
    """LE PIÈGE DE CE TICKET. Le jour où Resend ajoute un nom d'événement, le
    ranger par défaut dans « rien n'est remonté » ferait lire un fait qu'on
    vient de RECEVOIR comme une ABSENCE de fait — et c'est précisément cette
    absence qu'on est en train d'interpréter."""
    egal("événement neuf", etat_ouverture("archived_by_resend_2027"), INCONNU)
    egal("rien du tout", etat_ouverture(None), INCONNU)
    egal("chaîne vide", etat_ouverture(""), INCONNU)


def test_aucune_entree_ne_produit_jamais_un_pas_ouvert():
    """La propriété centrale, vérifiée sur TOUT ce qui peut entrer : aucune
    valeur ne vaut « pas ouvert », et aucune phrase ne l'affirme."""
    entrees = [None, "", "delivered", "sent", "delivery_delayed", "opened",
               "clicked", "bounced", "failed", "complained", "suppressed",
               "scheduled", "n_importe_quoi"]
    for e in entrees:
        phrase = phrase_ouverture(e).lower()
        ok(f"« pas ouvert » absent de la phrase de {e!r}",
           "pas ouvert" not in phrase and "jamais ouvert" not in phrase,
           f"phrase = {phrase!r}")


def test_le_silence_dit_qu_il_ne_prouve_rien():
    """Une phrase qui dirait seulement « aucune ouverture » se lirait comme un
    verdict. Elle doit porter sa réserve AVEC elle, là où elle est lue."""
    phrase = phrase_ouverture("delivered").lower()
    ok("le silence porte sa réserve", "prouve pas" in phrase, phrase)
    ok("et il en nomme une cause", "pixel" in phrase or "suivi" in phrase, phrase)


def test_un_silence_du_fournisseur_ne_se_dit_pas_comme_un_appel_rate():
    """`phrase_ouverture` n'est appelée QUE quand on a demandé. Dire « rien n'a
    pu être relu chez le fournisseur » sur un appel qui a ABOUTI ferait chercher
    une panne réseau là où il n'y a qu'un suivi désactivé."""
    phrase = phrase_ouverture(None).lower()
    ok("pas de panne inventée", "n'a pu être relu" not in phrase, phrase)
    ok("mais la vraie cause est nommée", "suivi" in phrase, phrase)
    inconnu = phrase_ouverture("nom_que_le_code_ignore").lower()
    ok("un nom inconnu est cité tel quel",
       "nom_que_le_code_ignore" in inconnu, inconnu)


def test_le_clic_et_le_rebond_ne_se_confondent_avec_rien():
    """Les deux seuls faits qui tranchent. S'ils se rabattaient sur « ouvert »
    et « rien remonté », ce relevé ne servirait plus à rien."""
    ok("le clic est nommé comme un geste",
       "cliqu" in phrase_ouverture("clicked").lower(),
       phrase_ouverture("clicked"))
    ok("le rebond dit que l'email n'est pas arrivé",
       "pas arriv" in phrase_ouverture("bounced").lower(),
       phrase_ouverture("bounced"))


# ── 2. Quand on redemande au fournisseur, et quand on s'en abstient ──────────

def test_un_envoi_d_il_y_a_une_semaine_se_releve():
    ok("relevé", fetch_all.a_relever(envoi(), MAINTENANT) is True)


def test_un_dry_run_ne_se_releve_jamais():
    """SANS `message_id`, IL N'Y A RIEN À RELIRE — et surtout rien à en
    conclure. Un dry-run lu comme un envoi ferait conclure « jamais ouvert »
    sur un email qui n'a pas quitté la machine."""
    ok("dry-run", fetch_all.a_relever(
        envoi(fournisseur="dry", message_id=None), MAINTENANT) is False)


def test_un_envoi_en_echec_ne_se_releve_pas():
    ok("envoi raté", fetch_all.a_relever(
        envoi(envoi_ok=False, message_id=None), MAINTENANT) is False)


def test_une_reponse_definitive_ne_se_redemande_pas():
    for e in ("opened", "clicked", "complained", "bounced"):
        ok(f"{e} : plus rien à demander", fetch_all.a_relever(
            envoi(releve_a="2026-09-15T07:00:00", dernier_evenement=e),
            MAINTENANT) is False, e)


def test_un_silence_SE_redemande_au_passage_suivant():
    """LE PIÈGE QUE LA REVUE A TROUVÉ. La plupart des ouvertures arrivent APRÈS
    le premier jour. S'arrêter dès que `releve_a` est posé — ce que faisait la
    première version — perdait systématiquement le fait cherché : un
    `label_only` lancé à la main 25 h après l'envoi suffisait à figer la
    semaine sur « delivered », pour de bon."""
    for e in ("delivered", "sent", "delivery_delayed", None, "nom_inconnu"):
        ok(f"{e} : on redemande", fetch_all.a_relever(
            envoi(releve_a="2026-09-15T07:00:00", dernier_evenement=e),
            MAINTENANT) is True, e)


def test_on_ne_redemande_pas_deux_fois_dans_la_journee():
    """Sinon un `report_only` relancé dix fois dans l'après-midi paierait dix
    appels et imprimerait dix lignes identiques."""
    ok("relevé il y a une heure", fetch_all.a_relever(
        envoi(releve_a=(MAINTENANT - timedelta(hours=1)).isoformat(),
              dernier_evenement="delivered"), MAINTENANT) is False)


def test_un_fournisseur_qu_on_ne_sait_pas_relire_ne_se_relit_pas():
    """`send.py` est écrit pour accepter un autre fournisseur ; `evenements.py`
    ne parle qu'à Resend. Redemander à Resend un identifiant qui n'est pas le
    sien rendrait un 404 par semaine, sans que personne sache pourquoi."""
    ok("postmark", fetch_all.a_relever(
        envoi(fournisseur="postmark"), MAINTENANT) is False)
    ok("fournisseur inconnu", fetch_all.a_relever(
        envoi(fournisseur="?"), MAINTENANT) is False)


def test_un_email_parti_il_y_a_dix_minutes_ne_se_releve_pas():
    """LE CAS QUI FAIT VRAIMENT MAL. `--force` relancé le jour même repasse sur
    le compte quelques minutes après l'envoi. Relever là écrirait « aucune
    ouverture remontée » sur un email que personne n'a eu le temps d'ouvrir —
    et `releve_a` étant posé, cette ligne ne se redemande PLUS JAMAIS."""
    frais = envoi(envoye_a=(MAINTENANT - timedelta(minutes=10)).isoformat())
    ok("trop frais", fetch_all.a_relever(frais, MAINTENANT) is False)


def test_le_seuil_est_a_vingt_quatre_heures_pile():
    juste_avant = envoi(envoye_a=(MAINTENANT - timedelta(hours=23, minutes=59)).isoformat())
    juste_apres = envoi(envoye_a=(MAINTENANT - timedelta(hours=24, minutes=1)).isoformat())
    ok("23h59 : pas encore", fetch_all.a_relever(juste_avant, MAINTENANT) is False)
    ok("24h01 : oui", fetch_all.a_relever(juste_apres, MAINTENANT) is True)


def test_un_horodatage_avec_fuseau_se_compare_quand_meme():
    """Postgres rend `timestamptz` en ISO avec décalage (`+00:00`), parfois
    avec un `Z`. Comparer ça à un `utcnow()` naïf lève `TypeError` — et
    l'exception serait avalée par le `try` de `_relever_ouverture`, donc le
    relevé ne partirait jamais, en silence."""
    ok("suffixe Z", fetch_all.a_relever(
        envoi(envoye_a="2026-09-13T07:00:00Z"), MAINTENANT) is True)
    ok("décalage +00:00", fetch_all.a_relever(
        envoi(envoye_a="2026-09-13T07:00:00+00:00"), MAINTENANT) is True)
    # CE CAS-CI EST LE SEUL QUI DISCRIMINE : 08:30+02:00 le 19, c'est 06:30
    # UTC, donc 24 h 30 avant maintenant → on relève. Lu naïvement, en jetant
    # le décalage, ça ferait 22 h 30 → on ne relèverait pas, et la ligne
    # attendrait une semaine de plus.
    ok("le décalage est retiré, pas ignoré", fetch_all.a_relever(
        envoi(envoye_a="2026-09-19T08:30:00+02:00"), MAINTENANT) is True)
    ok("et dans l'autre sens", fetch_all.a_relever(
        envoi(envoye_a="2026-09-19T05:30:00-02:00"), MAINTENANT) is False)


def test_une_ligne_absente_ou_illisible_ne_releve_rien():
    """Premier passage d'un compte : aucun email n'est encore parti."""
    ok("aucune ligne", fetch_all.a_relever(None, MAINTENANT) is False)
    ok("dict vide", fetch_all.a_relever({}, MAINTENANT) is False)


def test_une_date_d_envoi_illisible_releve_plutot_que_de_se_taire():
    """Sans date lisible on ne peut pas juger de l'âge. Ne rien faire
    laisserait la ligne muette pour toujours ; relever coûte un appel."""
    ok("date cassée", fetch_all.a_relever(
        envoi(envoye_a="pas une date"), MAINTENANT) is True)
    ok("date absente", fetch_all.a_relever(
        envoi(envoye_a=None), MAINTENANT) is True)


# ── 3. La ligne de journal ───────────────────────────────────────────────────

def test_la_ligne_de_journal_nomme_la_semaine_relevee():
    """Le relevé porte sur l'email de la semaine PRÉCÉDENTE — celui de cette
    semaine vient à peine de partir. Sans la date, la ligne se lirait comme un
    verdict sur l'email du jour."""
    mot = fetch_all.mot_du_releve(envoi(), "opened")
    ok("la semaine est nommée", "2026-09-14" in mot, mot)
    ok("et l'état avec", "ouvert" in mot, mot)


def test_la_ligne_de_journal_ne_conclut_pas_sur_un_silence():
    mot = fetch_all.mot_du_releve(envoi(), "delivered").lower()
    ok("pas de verdict", "pas ouvert" not in mot, mot)
    ok("mais une réserve", "prouve pas" in mot, mot)


# ── 4. Le tour complet, avec un faux fournisseur et une fausse base ─────────
#
# `_relever_ouverture` compose trois modules ; ce qui casse dans une compo,
# c'est l'ORDRE et les arguments, pas les briques. Les trois fonctions
# importées le sont DANS le corps de la fonction, donc les remplacer sur leur
# module suffit — aucun réseau, aucune base.

class FaussesLectures:
    """Remplace les trois portes de sortie de `_relever_ouverture`."""

    def __init__(self, ligne, evenement=None, casse=False, rate=False):
        self.ligne, self.evenement = ligne, evenement
        self.casse, self.rate = casse, rate
        self.range = []

    def __enter__(self):
        import saas.commun.fetch_data as fd
        import saas.commun.insert_data as idata
        import saas.emailing.evenements as ev
        self._vrais = (fd.fetch_dernier_envoi_email,
                       idata.maj_evenement_email, ev.etat_email)
        fd.fetch_dernier_envoi_email = lambda sb, uid: self.ligne
        idata.maj_evenement_email = lambda sb, uid, semaine, e: self.range.append(
            (uid, semaine, e))
        def _etat(mid):
            if self.casse:
                raise RuntimeError("réseau coupé")
            if self.rate:
                return {"ok": False, "provider": "resend", "evenement": None,
                        "detail": "HTTP 500: upstream"}
            return {"ok": True, "provider": "resend", "evenement": self.evenement,
                    "detail": ""}
        ev.etat_email = _etat
        return self

    def __exit__(self, *_):
        import saas.commun.fetch_data as fd
        import saas.commun.insert_data as idata
        import saas.emailing.evenements as ev
        (fd.fetch_dernier_envoi_email,
         idata.maj_evenement_email, ev.etat_email) = self._vrais
        return False


def test_le_tour_complet_range_l_evenement_sur_la_bonne_semaine():
    fetch_all._OUVERTURES.clear()
    logs = []
    with FaussesLectures(envoi(), evenement="opened") as faux:
        fetch_all._relever_ouverture(object(), "compte-1", logs)
    egal("une écriture, sur la semaine relevée", faux.range,
         [("compte-1", "2026-09-14", "opened")])
    ok("la ligne de journal est là", len(logs) == 1, logs)
    ok("et l'ouverture est retenue pour la ligne rouge",
       "compte-1" in fetch_all._OUVERTURES, fetch_all._OUVERTURES)


def test_un_silence_du_fournisseur_se_range_quand_meme():
    """`releve_a` doit être posé MÊME sans événement : « on a demandé et rien
    n'est venu » n'est pas « on n'a pas encore demandé ». Sans ça, on
    redemanderait chaque semaine un fait qui ne viendra jamais."""
    fetch_all._OUVERTURES.clear()
    logs = []
    with FaussesLectures(envoi(), evenement=None) as faux:
        fetch_all._relever_ouverture(object(), "compte-1", logs)
    egal("l'écriture part quand même", faux.range,
         [("compte-1", "2026-09-14", None)])


def test_rien_ne_part_quand_il_n_y_a_rien_a_relever():
    fetch_all._OUVERTURES.clear()
    logs = []
    with FaussesLectures(envoi(fournisseur="dry", message_id=None)) as faux:
        fetch_all._relever_ouverture(object(), "compte-1", logs)
    egal("aucune écriture", faux.range, [])
    egal("aucune ligne de journal", logs, [])
    ok("et rien pour la ligne rouge", "compte-1" not in fetch_all._OUVERTURES)


def test_une_panne_du_fournisseur_ne_fait_pas_tomber_la_recolte():
    """Une mesure d'exploitation ne casse pas un passage du worker. Elle le dit
    dans le journal et s'arrête là."""
    fetch_all._OUVERTURES.clear()
    logs = []
    with FaussesLectures(envoi(), casse=True) as faux:
        fetch_all._relever_ouverture(object(), "compte-1", logs)
    egal("rien n'a été rangé", faux.range, [])
    ok("mais la panne est dite", logs and "KO" in logs[0], logs)
    ok("et surtout : rien n'a été conclu",
       "compte-1" not in fetch_all._OUVERTURES, fetch_all._OUVERTURES)


def test_un_appel_rate_ne_fige_pas_la_ligne():
    """SI ON ÉCRIVAIT ICI, `releve_a` serait posé sur une coupure réseau : la
    ligne serait « demandée » pour toujours, et une panne de vingt secondes se
    lirait ensuite comme un client qui n'ouvre pas."""
    fetch_all._OUVERTURES.clear()
    logs = []
    with FaussesLectures(envoi(), rate=True) as faux:
        fetch_all._relever_ouverture(object(), "compte-1", logs)
    egal("rien n'est rangé", faux.range, [])
    ok("la panne est dite", logs and "non relevée" in logs[0], logs)
    ok("et rien n'est conclu", "compte-1" not in fetch_all._OUVERTURES)


def test_un_fait_deja_range_se_relit_sans_rien_redemander():
    """LE CAS DU `report_only` LANCÉ LE MATIN. Il relève et fige `releve_a` ; la
    récolte qui suit ne redemanderait rien, et la ligne rouge perdrait
    l'ouverture alors qu'elle est en base depuis une heure."""
    fetch_all._OUVERTURES.clear()
    logs = []
    deja = envoi(releve_a="2026-09-20T06:00:00+00:00", dernier_evenement="clicked")
    with FaussesLectures(deja, evenement="opened") as faux:
        fetch_all._relever_ouverture(object(), "compte-1", logs)
    egal("aucune écriture de plus", faux.range, [])
    egal("aucune ligne de journal en double", logs, [])
    ok("mais la ligne rouge sait, et sait le BON fait",
       "cliqu" in fetch_all._OUVERTURES.get("compte-1", "").lower(),
       fetch_all._OUVERTURES)


# ── 5. Ce qui est RANGÉ au moment de l'envoi ────────────────────────────────

class FausseBase:
    """Assez de PostgREST pour voir la ligne qu'on écrirait."""

    def __init__(self):
        self.ecrit = []

    def table(self, _nom):
        return self

    def upsert(self, ligne, on_conflict=None):
        self.ecrit.append(ligne)
        return self

    def execute(self):
        return type("Reponse", (), {"data": [{}]})()


def ligne_rangee(reponse_envoi: dict) -> dict:
    from saas.commun.insert_data import upsert_envoi_email
    base = FausseBase()
    upsert_envoi_email(base, "compte-1", "2026-09-14", reponse_envoi)
    return base.ecrit[0]


def test_un_dry_run_n_est_pas_un_envoi_reussi():
    """`send_email` rend `ok: True` en mode `dry` : il veut dire « la fonction a
    fait ce qu'on lui demandait », pas « l'email est parti ». Le recopier tel
    quel ferait compter, dans un futur « quelles semaines l'email est-il
    parti ? », une semaine où rien n'a quitté la machine."""
    ligne = ligne_rangee({"ok": True, "provider": "dry",
                          "detail": "non envoyé (mode test)", "id": None})
    egal("envoi_ok", ligne["envoi_ok"], False)
    egal("le fournisseur le dit aussi", ligne["fournisseur"], "dry")
    egal("et il n'y a rien à relire", ligne["message_id"], None)


def test_un_envoi_reel_est_range_comme_tel():
    ligne = ligne_rangee({"ok": True, "provider": "resend",
                          "detail": "abc-123", "id": "abc-123"})
    egal("envoi_ok", ligne["envoi_ok"], True)
    egal("l'identifiant est là", ligne["message_id"], "abc-123")
    ok("et le relevé repart de zéro",
       ligne["dernier_evenement"] is None and ligne["releve_a"] is None, ligne)


def test_un_envoi_rate_est_range_lui_aussi():
    """Sans cette ligne, une semaine où l'envoi a échoué serait indiscernable
    d'une semaine où le client n'a pas ouvert."""
    ligne = ligne_rangee({"ok": False, "provider": "resend",
                          "detail": "HTTP 422: domaine non vérifié", "id": None})
    egal("envoi_ok", ligne["envoi_ok"], False)
    egal("la semaine est quand même nommée", ligne["week_start"], "2026-09-14")


if __name__ == "__main__":
    import sys
    for nom, fn in sorted(list(globals().items())):
        if nom.startswith("test_") and callable(fn):
            fn()
    sys.exit(0 if bilan("Ticket 50 — le relevé d'ouverture") else 1)
