"""Tout ce que la construction du rapport touche DEHORS, derrière un seul objet.

POURQUOI CE FICHIER EXISTE. `build_payload` (`builder.py`) est le point le
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
avalerait les pannes changerait le comportement du rapport : chaque `except` d'un
bloc (`blocs/`) porte un commentaire qui dit quoi faire du vide — rester muet,
publier quand même, ne pas confondre une migration manquante avec une coupure
réseau.

IL PORTE AUSSI L'HORLOGE, alors qu'il s'appelle « lecteur » : sans elle, la
propriété « rejouer la construction un autre jour de la semaine ne change pas la
semaine déclarée » (§ Testing de `.scratch/construction/spec.md`) ne se vérifie
pas.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Protocol

from saas.data.supabase._queries import (
    fetch_meta_ads, fetch_google_ads, fetch_canaux_muets, _all_pages,
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
    def google_ads(self) -> list[dict]: ...

    # ── Les réglages du compte ───────────────────────────────────────────────
    def canaux_muets(self) -> dict[str, str]: ...
    def jour_de_travail(self) -> str | None: ...
    def connexions_etat(self) -> list[dict]: ...

    # ── Les rapports déjà publiés (escalade du canal muet) ───────────────────
    def rapports_publies(self, avant: str, limite: int = 8) -> list[dict]: ...

    # ── Les lectures des blocs neufs (`blocs/`, chantier hebdo) ──────────────
    def campagnes_config(self, table: str) -> list[dict]: ...
    def creas(self) -> list[dict]: ...
    def changements(self, debut: date, fin: date) -> list[dict]: ...
    def statuts_google(self) -> list[dict]: ...
    def couverture(self) -> list[dict]: ...

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
        """Paginée : 462 posts sur un compte réel, et PostgREST tronque à 1 000
        en silence (`CLAUDE.md` §8). `post_id` départage deux posts à la même
        date, sinon une page pourrait en répéter un et en perdre un autre."""
        return _all_pages(lambda: self.sb.table("instagram_organic_posts").select("*")
                          .eq("user_id", self.user_id)
                          .order("date", desc=True).order("post_id"))

    def google_ads(self) -> list[dict]:
        return fetch_google_ads(self.sb, self.user_id)

    # ── Les réglages du compte ───────────────────────────────────────────────

    def canaux_muets(self) -> dict[str, str]:
        """Les canaux dont la récolte a échoué au dernier passage, {canal: mot}.
        Seule l'escalade s'en sert (`blocs/canaux_muets.py`).

        Il passe par la base plutôt que par un paramètre de `publish_weekly_report` — pour que
        `report_only` (qui republie sans rien récolter) voie exactement le même
        trou que la récolte complète. Un seul chemin, donc un seul comportement
        à vérifier.
        """
        return fetch_canaux_muets(self.sb, self.user_id)

    def jour_de_travail(self) -> str | None:
        """`profiles.fetch_schedule`, en anglais (« Thursday »). `None` si le
        profil n'en porte pas : `blocs/semaine.py` retombe alors sur lundi."""
        rows = (self.sb.table("profiles").select("fetch_schedule")
                .eq("id", self.user_id).limit(1).execute().data) or []
        return rows[0].get("fetch_schedule") if rows else None

    def connexions_etat(self) -> list[dict]:
        """Une ligne par connexion BRANCHÉE : `source` (meta | google), depuis
        quand, et si la récolte l'a marquée à reconnecter.

        « Branchée » = le même tri que `execution_plan._plateforme` et
        `planifier` : Meta si la ligne porte un jeton Meta ; Google si la ligne
        `provider='google'` porte un refresh token ET un customer id — sans
        lui, `planifier` ne récolte pas Google Ads.

        AUCUNE COLONNE DE JETON N'EST LUE : leur présence se teste côté
        PostgREST (`not.is.null`), jamais leur valeur. Le payload est lu par les
        membres invités, et un jeton n'y entre jamais (`CLAUDE.md` §7)."""
        colonnes = "created_at, a_reconnecter_depuis"
        meta = (self.sb.table("connected_accounts").select(colonnes)
                .eq("user_id", self.user_id)
                .not_.is_("meta_token", "null").execute().data) or []
        google = (self.sb.table("connected_accounts").select(colonnes)
                  .eq("user_id", self.user_id).eq("provider", "google")
                  .not_.is_("google_refresh_token", "null")
                  .not_.is_("google_customer_id", "null").execute().data) or []
        return ([dict(l, source="meta") for l in meta]
                + [dict(l, source="google") for l in google])

    # ── Les rapports déjà publiés (escalade du canal muet) ───────────────────

    def rapports_publies(self, avant: str, limite: int = 8) -> list[dict]:
        """Les rapports déjà publiés, LA SEMAINE EN COURS EXCLUE.

        `avant` est le `week_start` du rapport qu'on fabrique : c'est cette
        ligne-là, et elle seule, qu'il faut tenir hors de son propre historique
        — sinon un rapport republié se compterait lui-même dans sa série."""
        return (self.sb.table("weekly_reports").select("week_start, payload")
                .eq("user_id", self.user_id)
                .lt("week_start", avant)
                .order("week_start", desc=True)
                .limit(limite).execute().data) or []

    # ── Les lectures des blocs neufs (`blocs/`, chantier hebdo) ──────────────

    def campagnes_config(self, table: str) -> list[dict]:
        """Identité par ID, statut et dates déclarées — la frise du ticket 07
        identifie une campagne par son ID, plus par son nom.

        PAGINÉE, DONC TRIÉE SUR UNE CLÉ TOTALE (`CLAUDE.md` §8) : sans ordre,
        PostgREST ne garantit pas le même ordre d'une page à l'autre, et une
        ligne peut sortir deux fois quand une autre se perd. `campaign_id` est
        la clé (`user_id`, `campaign_id`) des deux tables neuves ; une base Meta
        d'avant l'étape B garde la clé (`user_id`, `campaign_name`) avec des
        `campaign_id` nuls — `campaign_name` départage alors (migration,
        `meta_campaign_config`)."""
        return _all_pages(lambda: self.sb.table(table)
                          .select("campaign_id, campaign_name, effective_status, start_date, end_date")
                          .eq("user_id", self.user_id)
                          .order("campaign_id").order("campaign_name"))

    def creas(self) -> list[dict]:
        """Paginée : triée sur `ad_id`, la clé (`user_id`, `ad_id`) de la table."""
        return _all_pages(lambda: self.sb.table("meta_ads_creatives")
                          .select("ad_id, image_url, vignette_url")
                          .eq("user_id", self.user_id)
                          .order("ad_id"))

    def changements(self, debut: date, fin: date) -> list[dict]:
        """Le journal de la plateforme autour de la semaine.

        Un jour de plus de chaque côté : `occurred_at` est en UTC, la semaine se
        juge au fuseau de la ligne (`fuseau`), qui peut déborder d'un jour. Le
        bloc qui lit ces lignes refait le tri au bon fuseau.

        Deux changements à la même seconde sont courants (un lot de Meta) :
        `channel` puis `change_id` — la clé (`user_id`, `channel`, `change_id`)
        de la table — départagent, pour que la pagination ne répète ni ne perde
        une ligne (`CLAUDE.md` §8)."""
        depuis = (debut - timedelta(days=1)).isoformat()
        jusqu_a = (fin + timedelta(days=2)).isoformat()
        return _all_pages(lambda: self.sb.table("platform_changes")
                          .select("channel, occurred_at, fuseau, categorie, campaign_id, "
                                  "campaign_name, niveau, object_id, object_name, resume, extra_data")
                          .eq("user_id", self.user_id)
                          .gte("occurred_at", depuis).lt("occurred_at", jusqu_a)
                          .order("occurred_at").order("channel").order("change_id"))

    def statuts_google(self) -> list[dict]:
        """Les changements de statut des campagnes Google, sur tout le journal
        — pas la semaine : une campagne supprimée en mars finit en mars dans la
        frise d'octobre (ticket 09). Seules les lignes qui portent le statut
        structuré (`extra_data.statut`, écrit par `google/ads/fetchers/changes.py`)
        sont lues : la phrase `resume` ne se relit jamais. Le canal est fixé :
        `change_id` départage deux lignes à la même heure (`CLAUDE.md` §8)."""
        return _all_pages(lambda: self.sb.table("platform_changes")
                          .select("campaign_id, occurred_at, extra_data")
                          .eq("user_id", self.user_id).eq("channel", "google")
                          .not_.is_("extra_data->statut", "null")
                          .order("occurred_at").order("change_id"))

    def couverture(self) -> list[dict]:
        """La plage récoltée sans trou, par source et par flux
        (`couverture_recolte`, écrite par `source_data/couverture.py`). Au plus
        3 sources × 3 flux : pas de pagination."""
        return (self.sb.table("couverture_recolte")
                .select("source, flux, sans_trou_depuis, sans_trou_jusqu_au")
                .eq("user_id", self.user_id).execute().data) or []

    # ── L'horloge ────────────────────────────────────────────────────────────

    def aujourd_hui(self) -> date:
        return date.today()
