"""Le plan d'un passage : quels canaux tournent, dans quel fil, et pourquoi les autres non.

PUR, SANS RÉSEAU NI BASE : il lit les lignes de `connected_accounts` et rend un
`ExecutionPlan`. C'est ce qui permet d'annoncer à l'écran les canaux « en attente » AVANT
que le premier appel ne parte, et de tester le choix hors ligne
(`.scratch/recolte/harnais/07_execution_plan.py`).

L'ORDRE DES APPELS À L'INTÉRIEUR D'UN CANAL n'est pas ici : il est écrit dans le
`sync.py` de chaque canal, à côté de la dépendance qui l'impose (les statuts
Google avant `change_event`, qui a besoin des noms ; la hiérarchie Meta avant
les activités). Ici, on décide l'ordre des CANAUX : Meta Ads puis Instagram en
série (même jeton, même API), Google Ads et GA4 chacun dans son fil.

Ce choix vivait dans `run()` de `fetch_all.py` jusqu'au ticket 07 de
`.scratch/recolte/`. Les raisons des sauts sont recopiées mot pour mot : le
panneau de suivi et le journal les affichent.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from saas.data.fetch_data.shared.token_status import INCONNU, MORT, TokenStatus


@dataclass(frozen=True)
class IngestionTask:
    """Un canal à récolter, et la ligne de `connected_accounts` qui le permet."""
    canal: str
    connexion: dict


@dataclass
class ExecutionPlan:
    """`fils` : les tâches, groupées par fil ; `sautes` : (canal, raison) des
    canaux volontairement NON appelés ; `journal` : (canal, ligne) écrits au
    journal sans passer par une récolte — le saut de GA4, et ce que la
    vérification des jetons a trouvé ; `a_marquer` : (connexion, raison) des
    lignes dont le jeton est mort, à marquer « à reconnecter »."""
    fils: list[list[IngestionTask]] = field(default_factory=list)
    sautes: list[tuple[str, str]] = field(default_factory=list)
    journal: list[tuple[str, str]] = field(default_factory=list)
    a_marquer: list[tuple[dict, str]] = field(default_factory=list)

    @property
    def a_tente(self) -> bool:
        """Au moins une plateforme est appelée.

        CE QUI DÉCLENCHE LE RAPPORT, ET POURQUOI CE N'EST PAS « le journal n'est
        pas vide ». Depuis qu'un saut de GA4 s'y journalise, le journal n'est
        plus jamais vide : un compte sans aucune connexion déclencherait un
        rapport et un email sur zéro donnée.
        """
        return bool(self.fils)

    @property
    def prevus(self) -> list[str]:
        """Les canaux annoncés, DÉDOUBLONNÉS dans l'ordre : `Suivi.planifie`
        envoie un upsert unique, et Postgres refuse un `ON CONFLICT DO UPDATE`
        qui toucherait deux fois la même ligne — deux comptes Meta sur un même
        utilisateur feraient échouer TOUTE l'annonce."""
        canaux = list(dict.fromkeys(t.canal for f in self.fils for t in f))
        return canaux + (["rapport"] if self.a_tente else [])


_SANS_META = "aucune connexion Meta sur ce compte → Comptes → Connexions"

# UN JETON SERT DEUX CANAUX : le jeton utilisateur Meta lit Meta Ads et
# Instagram, le refresh token Google lit Google Ads et GA4. Mort, il les fait
# sauter tous les deux.
_NOM = {"meta": "Meta", "google": "Google"}


def _plateforme(connexion: dict) -> str | None:
    """Le jeton que porte la ligne — le même tri que `planifier` plus bas."""
    if connexion.get("meta_token"):
        return "meta"
    if connexion.get("provider") == "google" and connexion.get("google_refresh_token"):
        return "google"
    return None


def _a_reconnecter(plateforme: str, raison: str) -> str:
    return f"jeton {_NOM[plateforme]} à reconnecter — {raison} → Comptes → Connexions"


def _trier_par_jeton(plan: ExecutionPlan, connexions: list[dict],
                     jetons: dict[str, TokenStatus]) -> tuple[list[dict], dict[str, str]]:
    """Écarte les lignes au jeton MORT → (lignes à récolter, plateforme → raison).

    Trois états, trois gestes (`shared/token_status.py`) : MORT → la ligne est
    à marquer et n'est pas récoltée ; INCONNU → rien n'est marqué, on récolte
    comme avant la vérification, et le journal dit pourquoi on n'a pas su ;
    VALIDE, ou pas d'état → on récolte. Une ligne sans état est une ligne que
    l'appelant n'a pas vérifiée : le plan reste celui d'avant.
    """
    vivantes: list[dict] = []
    morts: dict[str, str] = {}
    for a in connexions:
        plateforme, etat = _plateforme(a), jetons.get(a.get("id"))
        if plateforme is None or etat is None:
            vivantes.append(a)
            continue
        if etat.etat == MORT:
            raison = etat.raison or f"jeton {_NOM[plateforme]} refusé"
            plan.a_marquer.append((a, raison))
            morts[plateforme] = raison
            plan.journal.append((plateforme, f"{plateforme}: jeton {_NOM[plateforme]} "
                                             f"mort — {raison} ; connexion marquée "
                                             f"à reconnecter"))
            continue
        if etat.etat == INCONNU:
            plan.journal.append((plateforme, f"{plateforme}: jeton {_NOM[plateforme]} "
                                             f"non vérifié — {etat.raison} ; "
                                             f"récolte tentée quand même"))
        vivantes.append(a)
    return vivantes, morts


def planifier(connexions: list[dict],
              jetons: dict[str, TokenStatus] | None = None) -> ExecutionPlan:
    """Les lignes `connected_accounts` d'un utilisateur → le plan du passage.

    `jetons` : l'état du jeton de chaque ligne, par `id`, tel que la
    vérification l'a rendu AVANT le plan — l'appel réseau vit dans
    `account_sync`, le plan reste pur."""
    plan = ExecutionPlan()
    connexions, morts = _trier_par_jeton(plan, connexions, jetons or {})
    fil_meta: list[IngestionTask] = []      # même jeton, même API → en série
    fil_google: list[IngestionTask] = []
    fil_ga4: list[IngestionTask] = []

    # Meta Ads + Instagram (token utilisateur) — la ligne google n'a pas de
    # meta_token. S'il y avait plusieurs comptes Meta, leurs tâches
    # s'empileraient dans le même fil et se partageraient une seule ligne de
    # suivi par canal ; le journal, lui, garderait les deux lignes.
    meta_vu = False
    for a in connexions:
        if not a.get("meta_token"):
            continue
        meta_vu = True
        fil_meta.append(IngestionTask("meta", a))
        if a.get("instagram_business_id"):
            fil_meta.append(IngestionTask("instagram", a))
        else:
            plan.sautes.append(("instagram",
                                "aucun compte Instagram Business lié — colonne vide "
                                "dans connected_accounts : instagram_business_id"))
    if not meta_vu:
        # Un compte Meta encore vivant fait tourner le canal : le saut ne
        # s'annonce que si AUCUNE ligne Meta n'est récoltée.
        pourquoi = _a_reconnecter("meta", morts["meta"]) if "meta" in morts else _SANS_META
        plan.sautes.append(("meta", pourquoi))
        plan.sautes.append(("instagram", pourquoi))

    # Connexion Google (provider='google') → Ads + GA4 partagent le jeton, mais
    # ni l'API ni le quota : ils peuvent tourner dans deux fils.
    g = next((a for a in connexions if a.get("provider") == "google"), {})
    if "google" in morts:
        pourquoi = _a_reconnecter("google", morts["google"])
        plan.sautes.append(("google", pourquoi))
        plan.sautes.append(("ga4", pourquoi))
    elif g.get("google_refresh_token") and g.get("google_customer_id"):
        fil_google.append(IngestionTask("google", g))
    else:
        plan.sautes.append(("google", "aucune connexion Google Ads sur ce compte "
                                      "→ Comptes → Connexions"))

    # LE SAUT DE GA4 SE JOURNALISE. Quand l'une des deux conditions manquait,
    # GA4 n'était pas appelé ET rien n'était écrit : la récolte annonçait
    # « terminé », et personne ne pouvait savoir que GA4 n'avait jamais été
    # demandé. On nomme la COLONNE qui manque, jamais son contenu — un
    # refresh_token ne s'écrit nulle part.
    # Un jeton Google mort a déjà annoncé le saut de GA4, avec sa raison.
    if g.get("ga4_property_id") and g.get("google_refresh_token"):
        fil_ga4.append(IngestionTask("ga4", g))
    elif "google" not in morts:
        if not g:
            mot = ("ga4 SAUTÉ : aucune connexion Google sur ce compte "
                   "(aucune ligne connected_accounts avec provider='google') "
                   "→ Comptes → Connexions")
        else:
            absents = [c for c in ("ga4_property_id", "google_refresh_token")
                       if not g.get(c)]
            quoi = {
                "ga4_property_id": "aucune propriété GA4 choisie",
                "google_refresh_token": "aucun jeton Google (reconnexion à faire)",
            }
            mot = ("ga4 SAUTÉ : " + " et ".join(quoi[c] for c in absents)
                   + " — colonne(s) vide(s) dans connected_accounts : "
                   + ", ".join(absents))
        plan.sautes.append(("ga4", mot))
        plan.journal.append(("ga4", mot))

    plan.fils = [f for f in (fil_meta, fil_google, fil_ga4) if f]
    return plan
