"""Tout ce que la construction du rapport touche DEHORS, derrière un seul objet.

POURQUOI CE FICHIER EXISTE. `build_payload` (`build_report.py`) est le point le
plus haut de la v1 : tout ce que le worker calcule y passe et en ressort sous
forme de payload, que le web se contente de lire. Elle prenait un client
Supabase vivant et allait chercher ses données elle-même — donc elle n'a **jamais
tourné une seule fois** pendant toute la construction, et neuf harnais l'ont
écrit ticket après ticket (« `build_payload` n'a pas tourné — c'est le
ticket 16 »). Le filtre dur de l'ADR 0003, le plafond de cinq, les dix règles
payantes, le ROAS réparé et les trois dates étaient vérifiés sur le TEXTE du
fichier : un test de structure prouve qu'un appel est sous un garde, jamais que
le garde est vrai au bon moment.

Ce module fait entrer par paramètre ce que la fonction importait. Un faux lecteur
gréé sur des lignes fixes la fait alors tourner hors ligne — sans base, sans
secret, sans réseau. Décidé en session `/to-spec` du 2026-09-11 (seam unique, au
point le plus haut) et bâti par `.scratch/construction/issues/16-le-seam-du-payload.md`.

CE QU'IL N'EST PAS. Ce n'est pas une couche d'accès aux données : chaque méthode
est un **simple renvoi** vers l'appel d'hier, `sb` et `user_id` déjà en main.
Aucune logique n'a déménagé ici, et c'est ce qui rend le passage vérifiable — le
harnais 16 rejoue chaque méthode et compare la fonction atteinte et ses arguments
à ce que `build_payload` appelait avant l'injection.

LES `try/except` SONT RESTÉS CHEZ L'APPELANT, ET C'EST DÉLIBÉRÉ. Un lecteur qui
avalerait les pannes changerait le comportement du rapport : chaque `except` de
`build_payload` porte un commentaire qui dit quoi faire du vide — rester muet,
publier quand même, ne pas confondre une migration manquante avec une coupure
réseau. `themes_regroupes()` laisse donc remonter `VueRegroupementAbsente` : une
vue absente ne doit pas publier un rapport sans aucune carte de thème, qui se
lirait comme un compte qui n'a rien fait (`saas/commun/fetch_data.py`).

IL PORTE AUSSI DEUX ÉCRITURES ET L'HORLOGE, alors qu'il s'appelle « lecteur ».
Les deux écritures (le plan de thème, le verdict persisté) sont ce qui reste de
sortant dans `build_payload` : les laisser dehors ferait écrire en base un test
censé tourner hors ligne. L'horloge est du même genre — sans elle, la propriété
« rejouer la construction un autre jour de la semaine ne change pas la semaine
déclarée » (§ Testing de `.scratch/construction/spec.md`) ne se vérifie pas.
"""

from __future__ import annotations

from datetime import date
from typing import Protocol

from saas.commun.fetch_data import (
    fetch_meta_ads, fetch_post_metrics, fetch_daily_followers,
    fetch_objectif, fetch_theme_objectifs, fetch_google_ads,
    fetch_campaign_config, fetch_google_campaign_config,
    fetch_insight_feedback, fetch_theme_regroupement,
    fetch_ga4_events, fetch_ga4_insights,
    fetch_canaux_muets,
)


class Lecteur(Protocol):
    """Le contrat de `build_payload` avec l'extérieur, et rien d'autre.

    Une méthode par source. Aucune ne prend `sb` ni `user_id` : l'implémentation
    les tient, ce qui permet au corps de `build_payload` de n'en porter aucune
    trace — c'est cet invariant que le harnais 16 vérifie sur l'arbre du fichier.
    """

    # ── La récolte ───────────────────────────────────────────────────────────
    def meta_ads(self) -> list[dict]: ...
    def publications(self) -> list[dict]: ...
    def abonnes(self) -> list[dict]: ...
    def google_ads(self) -> list[dict]: ...

    # ── Les réglages du compte ───────────────────────────────────────────────
    def objectif(self) -> str | None: ...
    def objectifs_par_theme(self) -> dict[str, str]: ...
    def config_meta(self) -> dict[str, dict]: ...
    def config_google(self) -> dict[str, dict]: ...
    def themes_regroupes(self) -> list[dict]: ...
    def canaux_muets(self) -> dict[str, str]: ...

    def insight_feedback(self) -> dict[str, str]: ...
    def priorites_datees(self) -> list[dict]: ...

    # ── GA4 ──────────────────────────────────────────────────────────────────
    def ga4_contexte(self, since: date, until: date) -> dict | None: ...
    def ga4_evenements_par_theme(self) -> dict[str, list[dict]]: ...
    def ga4_lignes(self) -> list[dict]: ...
    def ga4_insights(self) -> list[dict]: ...

    # ── Les lectures qui passaient par `sb.table(...)` en clair ──────────────
    def dates_declarees(self, table: str) -> list[dict]: ...
    def rapports_publies(self, avant: str, limite: int = 8) -> list[dict]: ...



    # ── L'horloge ────────────────────────────────────────────────────────────
    def aujourd_hui(self) -> date: ...


class LecteurSupabase:
    """Le lecteur du service : un client Supabase vivant et un compte.

    C'est lui que `publish_weekly_report` grée. Chaque méthode reproduit à
    l'identique l'appel que `build_payload` faisait en clair — même fonction,
    mêmes arguments, même table, même filtre.
    """

    def __init__(self, sb, user_id: str):
        self.sb = sb
        self.user_id = user_id

    # ── La récolte ───────────────────────────────────────────────────────────

    def meta_ads(self) -> list[dict]:
        return fetch_meta_ads(self.sb, self.user_id)

    def publications(self) -> list[dict]:
        return fetch_post_metrics(self.sb, self.user_id)

    def abonnes(self) -> list[dict]:
        return fetch_daily_followers(self.sb, self.user_id)

    def google_ads(self) -> list[dict]:
        return fetch_google_ads(self.sb, self.user_id)

    # ── Les réglages du compte ───────────────────────────────────────────────

    def objectif(self) -> str | None:
        return fetch_objectif(self.sb, self.user_id)


    def objectifs_par_theme(self) -> dict[str, str]:
        return fetch_theme_objectifs(self.sb, self.user_id)

    def config_meta(self) -> dict[str, dict]:
        return fetch_campaign_config(self.sb, self.user_id)

    def config_google(self) -> dict[str, dict]:
        return fetch_google_campaign_config(self.sb, self.user_id)


    def themes_regroupes(self) -> list[dict]:
        """La vue `theme_regroupement`. LAISSE REMONTER `VueRegroupementAbsente`
        — voir l'en-tête du module : une migration qui manque n'est pas un
        compte sans données."""
        return fetch_theme_regroupement(self.sb, self.user_id)

    def canaux_muets(self) -> dict[str, str]:
        """Les canaux dont la récolte a échoué au dernier passage.

        LE SEUL ÉTAT QUE `build_payload` LIT DE LA RÉCOLTE, et il passe par la
        base plutôt que par un paramètre de `publish_weekly_report` — pour que
        `report_only` (qui republie sans rien récolter) voie exactement le même
        trou que la récolte complète. Un seul chemin, donc un seul comportement
        à vérifier.
        """
        return fetch_canaux_muets(self.sb, self.user_id)





    def insight_feedback(self) -> dict[str, str]:
        return fetch_insight_feedback(self.sb, self.user_id)

    def priorites_datees(self) -> list[dict]:
        """Les étoiles, DANS L'ORDRE OÙ ELLES ONT ÉTÉ POSÉES.

        C'est cet ordre — et pas l'alphabétique — qui décide des thèmes qui
        reçoivent des conseils (`_labels_prioritaires`, `build_report.py`)."""
        return (self.sb.table("insight_feedback")
                .select("insight_key, created_at")
                .eq("user_id", self.user_id)
                .like("insight_key", "priority_label:%")
                .order("created_at")
                .execute().data) or []

    # ── GA4 ──────────────────────────────────────────────────────────────────

    def ga4_contexte(self, since: date, until: date) -> dict | None:
        # Import local : `saas.collecte.ga4.ga4` tire la récolte entière, et ce
        # module est chargé par le web comme par le worker.
        from saas.collecte.ga4.ga4 import build_ga4_context
        return build_ga4_context(self.sb, self.user_id, since, until)

    def ga4_evenements_par_theme(self) -> dict[str, list[dict]]:
        from saas.collecte.ga4.ga4 import fetch_theme_ga4_events
        return fetch_theme_ga4_events(self.sb, self.user_id)

    def ga4_lignes(self) -> list[dict]:
        return fetch_ga4_events(self.sb, self.user_id)

    def ga4_insights(self) -> list[dict]:
        return fetch_ga4_insights(self.sb, self.user_id)

    # ── Les lectures qui passaient par `sb.table(...)` en clair ──────────────

    def dates_declarees(self, table: str) -> list[dict]:
        """Les dates que les plateformes DÉCLARENT, par table de configuration.

        Elles ne se déduisent pas de la dépense, et c'est leur intérêt : la
        dépense dit qu'une campagne TOURNE, la date déclarée dit qu'elle DEVAIT
        tourner."""
        return (self.sb.table(table)
                .select("campaign_name, start_date, end_date")
                .eq("user_id", self.user_id).execute().data) or []

    def rapports_publies(self, avant: str, limite: int = 8) -> list[dict]:
        """Les rapports déjà publiés, LA SEMAINE EN COURS EXCLUE.

        `avant` est le `week_start` du rapport qu'on fabrique : c'est cette
        ligne-là, et elle seule, qu'il faut tenir hors de son propre historique
        — sinon un thème calme le matin se compterait lui-même l'après-midi."""
        return (self.sb.table("weekly_reports").select("week_start, payload")
                .eq("user_id", self.user_id)
                .lt("week_start", avant)
                .order("week_start", desc=True)
                .limit(limite).execute().data) or []









    # ── L'horloge ────────────────────────────────────────────────────────────

    def aujourd_hui(self) -> date:
        return date.today()
