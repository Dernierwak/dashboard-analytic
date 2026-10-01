"""Construit et publie le rapport hebdo précalculé (weekly_reports.payload) — headless.

Seul producteur de weekly_reports.payload : ce worker publie après le fetch
cron → Pulse est frais le lundi matin sans que personne n'ouvre quoi que ce soit.
Fenêtre de 7 jours pleins ancrés sur la dernière donnée, jamais aujourd'hui.

CE RAPPORT NE CONSEILLE RIEN, IL CONSTATE. Le moteur de recommandations, les
règles payantes, les constats « ce qui marche », le brief rédigé par Gemini et
le suivi des actions ont été retirés du produit. Ce qui reste est ce qui se
mesure : le verdict de la semaine, la boussole, la frise et ce qui a bougé sur
les plateformes. Le thème — l'étiquette posée sur des campagnes et des
publications — est parti à son tour, et rien ne l'a remplacé.

Usage :
  python saas/traitement/build_report.py --user <uuid> [--print]
  python saas/traitement/build_report.py --all
"""

from __future__ import annotations
import sys
import json
from datetime import date, timedelta
from pathlib import Path

# Permet d'importer saas/ (compat) et la racine du dépôt, quel que soit le cwd
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

import pandas as pd  # noqa: E402

from saas.commun.app_secrets import secret  # noqa: E402
from saas.commun.insert_data import (upsert_envoi_email,  # noqa: E402
                                     upsert_weekly_report)
from saas.traitement.lecteur import Lecteur, LecteurSupabase  # noqa: E402
from saas.traitement.matrice import build_matrix  # noqa: E402

MONTHS_FR = {1: "jan", 2: "fév", 3: "mar", 4: "avr", 5: "mai", 6: "jun",
             7: "jul", 8: "aoû", 9: "sep", 10: "oct", 11: "nov", 12: "déc"}

# Le nom qu'un canal porte DEVANT LE CLIENT. `meta` et `ga4` sont des noms de
# colonnes ; personne n'a connecté « ga4 ». Posé au niveau module parce que le
# verdict et la liste `canaux_muets` doivent nommer la même panne du même mot
# (ticket 20).
NOMS_CANAUX = {"meta": "Meta Ads", "google": "Google Ads",
               "instagram": "Instagram", "ga4": "Google Analytics"}

# À PARTIR DE COMBIEN DE RAPPORTS MUETS L'ESCALADE SORT DU CYCLE HEBDOMADAIRE.
# Deux, et pas un : une panne d'une SEULE semaine se rattrape toute seule au
# prochain passage réussi — `_depart_recolte` déduit le point de reprise des
# lignes réellement écrites, moins le recouvrement (7 jours côté Meta, 30 côté
# Google), donc la semaine trouée est réécrite (ADR 0005). Sonner à la première
# transférerait simplement le papier peint du client à David.
#
# LU PAR IMPORT LOCAL DEPUIS `saas/collecte/automatisation/fetch_all.py`
# (`_note_canaux_qui_durent`) : aucun appelant ne se voit dans ce fichier.
SEUIL_ESCALADE = 2


def semaines_muettes(canal: str, historique: list[dict]) -> int:
    """Depuis combien de rapports publiés d'affilée ce canal est muet, CELUI
    QU'ON FABRIQUE COMPRIS. Vaut donc 1 à la première semaine.

    `historique` est ce que rend `lecteur.rapports_publies` : des lignes
    `{week_start, payload}`, la semaine en cours exclue. L'ordre de lecture
    n'est pas supposé — il est refait ici. La base trie déjà par `week_start`
    décroissant, mais une série comptée du mauvais bout tiendrait jusqu'au jour
    où cette lecture changerait d'ordre, et personne ne le verrait.
    """
    n = 1
    for _h in sorted(historique or [],
                     key=lambda r: str(r.get("week_start") or ""), reverse=True):
        _muets = (_h.get("payload") or {}).get("canaux_muets")
        # Deux absences se rejoignent ici, et elles s'arrêtent toutes les deux :
        # une LISTE VIDE répond vraiment « aucun trou cette semaine-là », donc
        # le canal était revenu et la série est cassée ; une clé ABSENTE est un
        # payload d'avant le ticket 20, qui ne dit pas « aucun trou » mais « je
        # ne sais pas répondre ». Le compte est alors SOUS-ESTIMÉ, jamais
        # inventé (`CLAUDE.md` §7) — c'est le seul sens où se tromper est permis.
        if not _muets:
            break
        if canal not in {str(_m.get("canal")) for _m in _muets}:
            break
        n += 1
    return n


def build_payload(lecteur: Lecteur) -> dict | None:
    """Prépare le payload du rapport hebdo. None si pas assez de données.

    Une seule fonction, des sections marquées `# ── ... ──` et des variables
    partagées d'un bout à l'autre. Carte pour naviguer sans tout lire :

      1.  Chargement           — Meta / Google / Instagram / abonnés
      2.  Canal muet           — jusqu'où chaque canal payant a réellement écrit
      3.  Fenêtre              — 7 jours pleins, jamais le jour du fetch
      4.  Meta Ads, Google Ads — agrégats de la semaine et de la précédente
      5.  Instagram            — agrégats posts
      6.  Profil + GA4
      7.  Matrice full-history — formats, campagnes, créneaux, couverture
      8.  Dates déclarées      — par les plateformes
      9.  Rapports publiés     — lus une seule fois
      10. Verdict déterministe
      11. Matrice compacte et métriques de lecture rapide
      12. Boussole             — LE chiffre qui compte, avec son échelle
      13. Frise                — ce qui tournait pendant ces semaines, dates
                                  déclarées, ce qui a bougé sur les plateformes
      14. Canaux muets         — ce qu'on n'a pas pu lire, dit au client
    """
    today = lecteur.aujourd_hui()

    # ── Chargement (mêmes fetchers que le rapport) ────────────────────────────
    df_meta_raw = None
    df_insta = pd.DataFrame()
    df_follows = pd.DataFrame()
    try:
        meta_data = lecteur.meta_ads()
        if meta_data:
            df_meta_raw = pd.DataFrame(meta_data)
    except Exception:
        pass
    try:
        df_insta = pd.DataFrame(lecteur.publications() or [])
    except Exception:
        pass
    try:
        df_follows = pd.DataFrame(lecteur.abonnes() or [])
    except Exception:
        pass
    df_google = pd.DataFrame()
    try:
        df_google = pd.DataFrame(lecteur.google_ads() or [])
    except Exception:
        pass
    # ── LE CANAL MUET : ce qui n'a pas été écrit, et que rien ne doit combler ──
    #
    # Tranché le 2026-09-14 avec `vision-produit`, ticket 20 de la construction
    # (`.scratch/construction/issues/20-rapport-publie-sur-un-canal-muet.md`).
    #
    # LA DÉCISION : on publie TOUJOURS, et ce qui dépend de la donnée absente
    # devient `None` — jamais 0, jamais une baisse. Retenir le rapport (ce que
    # faisait la garde `ad_id`) est un silence que le client ne sait pas lire ;
    # or le rapport est le SEUL canal par lequel on peut lui dire de reconnecter.
    # La règle n'est donc pas « canal tombé → rapport dégradé », c'est
    # **chaque mesure se tait si sa source est muette**, mesure par mesure : un
    # compte dont la boussole est l'engagement garde un rapport entier et bon
    # quand Meta Ads tombe, parce qu'aucun de ses chiffres ne touche la dépense.
    #
    # POURQUOI ÇA PRESSE, ET DANS L'AUTRE SENS QU'ON CROIT. Le trou n'est pas
    # symétrique : GA4 tourne dans son propre fil et écrit normalement pendant
    # que Meta ou Google échoue. Le revenu reste donc ENTIER pendant que le
    # dénominateur est amputé — le ROAS ne s'effondre pas, **il gonfle**. Le
    # rapport n'a pas l'air cassé, il a l'air excellent, et la règle `scaler`
    # conseille d'augmenter le budget sur un chiffre fabriqué par une panne.
    #
    # CE N'EST PAS UN COMPTE À ZÉRO. Trois états rendent le même nombre de
    # lignes et se traitent à l'opposé — jamais connecté, échec, zéro mesuré :
    # la distinction est faite en amont par `fetch_canaux_muets`
    # (`saas/commun/fetch_data.py`), qui ne lit QUE l'état `echec` du dernier
    # passage. Ici, on ne se demande plus pourquoi : on se demande jusqu'à quelle
    # date le canal a écrit.
    try:
        canaux_muets = dict(lecteur.canaux_muets() or {})
    except Exception:
        canaux_muets = {}
    # Seule la pub creuse un trou dans un CHIFFRE. Instagram muet coûte des
    # posts, pas une division fausse ; GA4 muet est déjà traité par `_rev is
    # None` (le ROAS se tait de lui-même, il ne gonfle pas).
    _PUB_MUETTE = ("meta", "google")
    pub_muette = {c: m for c, m in canaux_muets.items() if c in _PUB_MUETTE}

    # JUSQU'OÙ CHAQUE CANAL A RÉELLEMENT ÉCRIT. Le trou ne couvre pas tout
    # l'historique : les semaines d'avant ont été écrites par les passages
    # réussis d'avant, et elles restent bonnes. Un canal muet est aveugle
    # APRÈS sa dernière date connue, et nulle part ailleurs — c'est ce qui
    # permet aux fenêtres de référence (4 semaines, 84 jours) de rester des
    # chiffres pendant que la semaine en cours se tait.
    #
    # La date se DÉDUIT des lignes écrites, elle ne se stocke pas : c'est le
    # même raisonnement que `_depart_recolte` côté récolte — une date lue dans
    # les lignes réellement présentes ne peut pas mentir sur ce qui a été fait.
    def _derniere_date(df, col="date_start"):
        if df is None or getattr(df, "empty", True) or col not in df.columns:
            return None
        _d = pd.to_datetime(df[col], errors="coerce").max()
        return _d.date() if pd.notna(_d) else None

    _bord_muet: dict[str, object] = {}
    if "meta" in pub_muette:
        _bord_muet["meta"] = _derniere_date(df_meta_raw)
    if "google" in pub_muette:
        _bord_muet["google"] = _derniere_date(df_google)

    def _pub_aveugle(d1, d2) -> set:
        """Les canaux payants muets dont la donnée manque SUR CETTE FENÊTRE.

        Un canal muet qui n'a jamais rien écrit (`None`) est aveugle sur toute
        fenêtre : on ne peut pas prouver qu'il n'a pas dépensé.
        """
        aveugles = set()
        for _c in pub_muette:
            _bord = _bord_muet.get(_c)
            if _bord is None or d2 > _bord:
                aveugles.add(_c)
        return aveugles

    # ── Fenêtre : 7 jours pleins ancrés sur la dernière donnée (jamais aujourd'hui)
    yesterday = today - timedelta(days=1)
    # UN CANAL MUET N'ANCRE PAS LA FENÊTRE (ticket 20). Sa dernière date est
    # périmée PAR DÉFINITION — c'est le jour où il a cessé d'écrire. L'ancrer
    # dessus revient à décider que « la dernière donnée » remonte à une semaine,
    # donc à REPUBLIER LA SEMAINE PRÉCÉDENTE sous sa propre clé : le client ne
    # reçoit pas un rapport troué, il reçoit l'ancien, et la panne devient
    # invisible pour tout le monde, lui comme nous. C'est la porte de sortie la
    # plus discrète du ticket, et c'est un compte SANS Instagram — celui qui ne
    # fait que de la pub — qui l'emprunte, faute d'une autre source pour ancrer.
    _data_dates = []
    if ("meta" not in pub_muette
            and df_meta_raw is not None and "date_start" in df_meta_raw.columns):
        _d = pd.to_datetime(df_meta_raw["date_start"], errors="coerce").max()
        if pd.notna(_d):
            _data_dates.append(_d.date())
    if not df_insta.empty and "date" in df_insta.columns:
        _d = pd.to_datetime(df_insta["date"], errors="coerce", utc=True).max()
        if pd.notna(_d):
            _data_dates.append(_d.date())
    if not df_follows.empty and "fetched_at" in df_follows.columns:
        _d = pd.to_datetime(df_follows["fetched_at"], errors="coerce", utc=True).max()
        if pd.notna(_d):
            _data_dates.append(_d.date())
    last_data_date = max(_data_dates) if _data_dates else yesterday

    last_full_day = min(last_data_date, yesterday)
    cur_since = last_full_day - timedelta(days=6)
    prev_until = cur_since - timedelta(days=1)
    prev_since = prev_until - timedelta(days=6)

    # ── LA SEMAINE DE CE RAPPORT SORT DE LA FENÊTRE MESURÉE, PLUS DE `today` ──
    #
    # `week_start` était le lundi d'AUJOURD'HUI, et le numéro de semaine du
    # libellé aussi. Republier le même rapport dans une semaine calendaire
    # différente écrivait donc une DEUXIÈME ligne (la clé est
    # `(user_id, week_start)`) et le renumérotait, alors que les chiffres sont
    # identiques — deux lignes pour une même semaine, c'est deux vérités.
    # Le défaut est mesuré dans `.scratch/refonte/issues/13-entre-deux-jours-de-travail.md`
    # (« le piège à connaître si un rapport est republié à la main »).
    #
    # Ancrer sur la fenêtre rend la publication IDEMPOTENTE : tant que la
    # dernière donnée n'a pas bougé, republier écrase sa propre ligne, quel que
    # soit le jour où on le fait. C'est le même invariant que la fenêtre
    # elle-même, qui est ancrée sur la dernière donnée et non sur le jour de
    # fabrication (l. ci-dessus) — les deux se tenaient déjà, seule la clé
    # d'écriture ne suivait pas.
    #
    # CE QUE ÇA DÉPLACE EN SERVICE, une fois et une seule : pour un compte dont
    # le Jour de travail est le LUNDI, la fenêtre finit le dimanche, donc dans
    # la semaine ISO précédente — son `week_start` recule de sept jours. La
    # publication suivante tombe alors sur la ligne que la précédente occupait
    # et l'écrase (upsert, aucune suppression) : on perd le payload d'UNE
    # semaine d'historique, jamais une ligne de suivi ni une décision. Pour tous
    # les autres jours, hier est dans la même semaine ISO qu'aujourd'hui et
    # rien ne bouge.
    week_start_rapport = last_full_day - timedelta(days=last_full_day.weekday())

    # LES CANAUX PAYANTS MUETS SUR LA SEMAINE DU RAPPORT (ticket 20). Posé ICI,
    # dès que la fenêtre est connue et avant le premier chiffre qui en dépend :
    # tout ce qui publie une dépense, un CPC ou un ROAS de cette semaine le
    # teste, jusqu'aux KPI de l'email. Vide = rien à taire.
    _aveugle_semaine = _pub_aveugle(cur_since, last_full_day)

    # ── Meta Ads : agrégats de la semaine et de la précédente ────────────────
    total_spend = 0.0
    total_clicks = 0
    total_impr = 0
    m_clicks_prev = 0
    m_impr_prev = 0
    avg_ctr = 0.0
    clicks_delta_pct = None
    if df_meta_raw is not None and not df_meta_raw.empty:
        for col in ["impressions", "clicks", "spend"]:
            if col in df_meta_raw.columns:
                df_meta_raw[col] = pd.to_numeric(df_meta_raw[col], errors="coerce").fillna(0)
        df_meta_raw["date_start"] = pd.to_datetime(df_meta_raw["date_start"], errors="coerce")
        df_meta = df_meta_raw[
            (df_meta_raw["date_start"] >= pd.Timestamp(cur_since))
            & (df_meta_raw["date_start"] <= pd.Timestamp(last_full_day))
        ]
        df_meta_prev = df_meta_raw[
            (df_meta_raw["date_start"] >= pd.Timestamp(prev_since))
            & (df_meta_raw["date_start"] <= pd.Timestamp(prev_until))
        ]
        if not df_meta.empty:
            total_spend = float(df_meta["spend"].sum())
            total_clicks = int(df_meta["clicks"].sum())
            total_impr = int(df_meta["impressions"].sum())
            avg_ctr = (total_clicks / total_impr * 100) if total_impr > 0 else 0.0
            if not df_meta_prev.empty:
                prev_clicks = int(df_meta_prev["clicks"].sum())
                m_clicks_prev = prev_clicks
                m_impr_prev = int(df_meta_prev["impressions"].sum())
                if prev_clicks > 0:
                    clicks_delta_pct = round((total_clicks - prev_clicks) / prev_clicks * 100)

    # ── Google Ads : mêmes fenêtres (KPIs email) ─────────────────────────────
    g_spend = 0.0
    g_clicks = 0
    g_impr = 0
    g_clicks_prev = 0
    g_impr_prev = 0
    if not df_google.empty and "date_start" in df_google.columns:
        df_google["date_start"] = pd.to_datetime(df_google["date_start"], errors="coerce")
        for col in ["cost_micros", "clicks", "impressions"]:
            if col in df_google.columns:
                df_google[col] = pd.to_numeric(df_google[col], errors="coerce").fillna(0)
        df_g = df_google[
            (df_google["date_start"] >= pd.Timestamp(cur_since))
            & (df_google["date_start"] <= pd.Timestamp(last_full_day))
        ].copy()
        # Fenetre precedente : sert uniquement aux reperes du bloc metriques.
        df_g_prev = df_google[
            (df_google["date_start"] >= pd.Timestamp(prev_since))
            & (df_google["date_start"] <= pd.Timestamp(prev_until))
        ]
        if not df_g_prev.empty:
            g_clicks_prev = int(df_g_prev["clicks"].sum())
            g_impr_prev = int(df_g_prev["impressions"].sum())
        if not df_g.empty:
            g_spend = float(df_g["cost_micros"].sum()) / 1_000_000.0
            g_clicks = int(df_g["clicks"].sum())
            g_impr = int(df_g["impressions"].sum())

    # ── Instagram ─────────────────────────────────────────────────────────────
    followers_current = 0
    followers_delta = 0
    avg_engagement = 0.0
    week_eng = None
    week_reach = None
    hist_reach = None
    df_week_posts = pd.DataFrame()
    df_prev_posts = pd.DataFrame()
    if not df_follows.empty and "followers" in df_follows.columns:
        df_follows = df_follows.sort_values("fetched_at", ascending=False)
        followers_current = int(df_follows.iloc[0]["followers"])
        if len(df_follows) >= 7:
            followers_delta = followers_current - int(df_follows.iloc[6]["followers"])
    if not df_insta.empty:
        for col in ["likes", "reach", "comments", "saved"]:
            if col in df_insta.columns:
                df_insta[col] = pd.to_numeric(df_insta[col], errors="coerce").fillna(0)
        if "reach" in df_insta.columns:
            df_insta["eng"] = df_insta.apply(
                lambda r: (r.get("likes", 0) + r.get("comments", 0) + r.get("saved", 0)) / r["reach"] * 100
                if r["reach"] > 0 else 0, axis=1)
            avg_engagement = float(df_insta["eng"].mean())
            hist_reach = float(df_insta["reach"].mean())
            if "date" in df_insta.columns:
                _dt = pd.to_datetime(df_insta["date"], errors="coerce")
                mask_week = (_dt.dt.date >= cur_since) & (_dt.dt.date <= last_full_day)
                mask_prev = (_dt.dt.date >= prev_since) & (_dt.dt.date <= prev_until)
                df_week_posts = df_insta[mask_week]
                df_prev_posts = df_insta[mask_prev]
                if len(df_week_posts) > 0:
                    week_eng = float(df_week_posts["eng"].mean())
                    week_reach = float(df_week_posts["reach"].mean())

    # UN CANAL MUET EST UNE DONNÉE, PAS UNE ABSENCE DE DONNÉE (ticket 20).
    # Sans cette clause, le pire cas se refermait sur lui-même : un compte qui
    # ne fait QUE du Meta Ads et dont le jeton Meta vient d'expirer a
    # `total_spend == 0` sur la fenêtre, donc `has_data` faux, donc AUCUN
    # rapport et aucun email — exactement le silence que ce ticket existe pour
    # supprimer, reconstitué par une autre porte. Le rapport publié alors ne
    # porte aucun chiffre de pub (ils se taisent tous, plus haut) : il porte
    # ce qu'on n'a pas pu lire et le geste qui le répare.
    has_data = (total_spend > 0 or g_spend > 0 or followers_current > 0
                or bool(pub_muette))
    if not has_data:
        return None

    # Le numéro suit la fenêtre, pas le jour de fabrication : « Semaine 38 ·
    # 7 → 13 septembre » se contredisait tout seul pour un compte servi le
    # lundi, et republier un mardi renumérotait le même rapport.
    week_num = week_start_rapport.isocalendar()[1]
    week_label = (
        f"Semaine {week_num} · {cur_since.day} → {last_full_day.day} "
        f"{MONTHS_FR[last_full_day.month]} · 7 jours pleins"
    )

    # ── Profil + GA4 ─────────────────────────────────────────────────────────
    objectif = None
    try:
        objectif = lecteur.objectif()
    except Exception:
        pass
    try:
        ga4_ctx = lecteur.ga4_contexte(cur_since, last_full_day)
    except Exception:
        ga4_ctx = None
    # Meme contexte sur la fenetre precedente — sert le repere du bloc metriques.
    try:
        ga4_prev = lecteur.ga4_contexte(prev_since, prev_until)
    except Exception:
        ga4_prev = None

    # ── Les noms des campagnes Google — la matrice les affiche ───────────────
    # `google_ads_insights` ne porte que l'identifiant de campagne : le nom que
    # le client reconnaît vit dans `google_campaign_config`.
    try:
        goog_cfg = {str(k): v for k, v in (lecteur.config_google() or {}).items()}
    except Exception:
        goog_cfg = {}

    # ── Matrice full-history ─────────────────────────────────────────────────
    # Toute la profondeur disponible (Ads depuis le 1er janvier, posts stockés),
    # pas la fenêtre 7 jours.
    matrix = None
    try:
        hist_since = date(today.year, 1, 1)
        try:
            ga4_full = lecteur.ga4_contexte(hist_since, last_full_day)
        except Exception:
            ga4_full = None
        matrix = build_matrix(df_meta_raw, df_google,
                              df_insta if not df_insta.empty else None,
                              goog_cfg, ga4_full, last_full_day)
    except Exception:
        matrix = None

    # ── Les dates DÉCLARÉES par les plateformes ──────────────────────────────
    # Lues UNE fois, ici, parce que deux blocs en ont besoin : la veille des
    # campagnes neuves juste en dessous, et la frise tout en bas. Elles ne se
    # déduisent pas de la dépense — c'est justement leur intérêt : la dépense
    # dit qu'une campagne TOURNE, la date déclarée dit qu'elle DEVAIT tourner.
    # Voir supabase/migrations/campagnes_dates_declarees.sql.
    def _dates_declarees():
        out = {}
        for _table, _canal in (("meta_campaign_config", "meta"),
                               ("google_campaign_config", "google")):
            try:
                _rows = lecteur.dates_declarees(_table)
            except Exception:
                _rows = []   # migration pas encore passée — on reste muet
            for _row in _rows:
                _nom = (_row.get("campaign_name") or "").strip()
                if _nom:
                    # Même troncature que partout ailleurs : les deux côtés
                    # doivent porter la même forme du nom, sinon une campagne au
                    # nom long perd sa date déclarée sans que rien ne le dise.
                    out[(_canal, str(_nom)[:60])] = {"start": _row.get("start_date"),
                                                     "end": _row.get("end_date")}
        return out

    _declare_camp = _dates_declarees()

    # ── LES RAPPORTS DÉJÀ PUBLIÉS, LUS UNE SEULE FOIS ────────────────────────
    #
    # L'escalade du canal muet (ticket 47) en a besoin pour compter depuis
    # combien de rapports un canal se tait.
    #
    # LA SEMAINE EN COURS EST EXCLUE, et ce n'est pas un détail : ce worker
    # publie au cron du Jour de travail, et une republication à la main
    # (GitHub Actions, `report_only`) repasse par-dessus. Sans ce filtre, un
    # rapport republié l'après-midi se compterait lui-même dans sa propre série.
    #
    # LA BORNE EST CELLE DU RAPPORT QU'ON FABRIQUE, pas le lundi d'aujourd'hui :
    # c'est sous `week_start_rapport` que cette publication va s'écrire, donc
    # c'est cette ligne-là — et elle seule — qu'il faut tenir hors de son propre
    # historique. Les deux valeurs ne diffèrent que pour un compte servi le
    # lundi, mais c'est exactement le compte qui se serait relu lui-même.
    #
    # LES LIGNES SONT GARDÉES ENTIÈRES, `week_start` COMPRIS : compter une série
    # sur une liste dont on a jeté la date reviendrait à faire confiance à
    # l'ordre d'une requête.
    _historique_publie = []
    try:
        _historique_publie = list(
            lecteur.rapports_publies(week_start_rapport.isoformat()))
    except Exception:
        _historique_publie = []

    # ── Les campagnes lancées DEPUIS PEU (≤ 14 jours) ────────────────────────
    # Rien de nouveau n'est demandé à personne : le premier jour où une campagne
    # a dépensé est déjà en base. Deux populations, et la seconde est la plus
    # intéressante — une campagne déclarée qui n'a jamais dépensé n'apparaît
    # dans aucun chiffre du rapport, et c'est exactement pour ça qu'on ne la
    # voit jamais.
    def _campagnes_par_nom():
        agg = {}

        def _ajoute(nom, canal, jour, depense, clics, impr):
            if not nom or jour is None:
                return
            c = agg.setdefault((canal, str(nom)[:60]), {
                "nom": str(nom)[:60], "canal": canal, "debut": jour,
                "jours": set(), "depense": 0.0, "clics": 0, "impressions": 0})
            c["debut"] = min(c["debut"], jour)
            c["jours"].add(jour)
            c["depense"] += float(depense or 0)
            c["clics"] += int(clics or 0)
            c["impressions"] += int(impr or 0)

        if df_meta_raw is not None and not df_meta_raw.empty:
            _m = df_meta_raw.copy()
            _m["jourdt"] = pd.to_datetime(_m["date_start"], errors="coerce")
            for _r in _m.itertuples():
                if pd.isna(_r.jourdt) or float(getattr(_r, "spend", 0) or 0) <= 0:
                    continue
                _ajoute(getattr(_r, "campaign_name", None), "meta", _r.jourdt.date(),
                        getattr(_r, "spend", 0), getattr(_r, "clicks", 0),
                        getattr(_r, "impressions", 0))
        if not df_google.empty and "campaign_name" in df_google.columns:
            _g = df_google.copy()
            _g["jourdt"] = pd.to_datetime(_g["date_start"], errors="coerce")
            for _r in _g.itertuples():
                _cout = float(getattr(_r, "cost_micros", 0) or 0) / 1_000_000.0
                if pd.isna(_r.jourdt) or _cout <= 0:
                    continue
                _ajoute(getattr(_r, "campaign_name", None), "google", _r.jourdt.date(),
                        _cout, getattr(_r, "clicks", 0), getattr(_r, "impressions", 0))
        return agg

    # ── Verdict déterministe (même logique que le rapport) ───────────────────
    _signals = []
    if week_eng is not None and avg_engagement > 0:
        _signals.append(((week_eng - avg_engagement) / avg_engagement * 100,
                         "l'engagement Instagram"))
    if week_reach is not None and hist_reach:
        _signals.append(((week_reach - hist_reach) / hist_reach * 100,
                         "la portée de tes posts"))
    # LE VERDICT EST L'ENDROIT OÙ LE TROU DEVIENT UN MENSONGE LISIBLE
    # (ticket 20). `clicks_delta_pct` compare les clics de la semaine à ceux de
    # la précédente ; un canal muet met le numérateur à zéro et rend -100 %,
    # que la phrase publie en toutes lettres : « Semaine en retrait — les clics
    # publicitaires (-100 %) ». C'est LE faux verdict que ce ticket vise, servi
    # en tête du rapport et repris tel quel dans l'email.
    #
    # Les signaux Instagram, eux, restent : leur source a écrit. C'est toute la
    # doctrine — chaque mesure se tait si SA source est muette, et le verdict
    # d'un compte dont la boussole est l'engagement reste entier et bon.
    if clicks_delta_pct and not _aveugle_semaine:
        _signals.append((clicks_delta_pct, "les clics publicitaires"))
    # Le verdict sort d'ici en DEUX formes. La phrase, pour la lire ; et ses
    # trois ingredients bruts, pour que le front puisse afficher l'ecart en
    # grand. Une phrase de 26 px ne peut pas etre le niveau 1 d'une page ou un
    # autre module affiche un chiffre de 46 px : c'est la typographie qui
    # decide de la hierarchie, pas l'intention.
    verdict_pct = None
    verdict_metric = None
    verdict_tone = "stable"
    if _signals:
        _val, _name = max(_signals, key=lambda s: abs(s[0]))
        verdict_pct = round(float(_val), 1)
        verdict_metric = _name
        verdict_tone = "pos" if _val >= 10 else ("neg" if _val <= -10 else "stable")
        if _val >= 10:
            verdict = f"Semaine en progression — portée par {_name} ({_val:+.0f} %)."
        elif _val <= -10:
            verdict = f"Semaine en retrait — {_name} ({_val:.0f} %), le reste tient."
        else:
            verdict = "Semaine stable — dans tes normes habituelles."
        if followers_delta and abs(followers_delta) >= 5:
            verdict += f" {'+' if followers_delta > 0 else ''}{followers_delta} abonnés."
    elif followers_delta:
        verdict = f"{'+' if followers_delta > 0 else ''}{followers_delta} abonnés cette semaine."
    elif _aveugle_semaine:
        # Sans ce cas, un compte qui ne fait que de la pub et dont le canal
        # vient de tomber lirait « Première semaine de données » — faux, et
        # rassurant à contretemps. On nomme la panne ; le détail et le geste
        # sont dans `canaux_muets`, que l'écran et l'email affichent.
        verdict = ("Semaine incomplète — "
                   + " et ".join(NOMS_CANAUX.get(_c, _c)
                                 for _c in sorted(_aveugle_semaine))
                   + " n'a pas répondu, les chiffres de pub manquent.")
    else:
        verdict = "Première semaine de données — le rapport s'affinera avec l'historique."
    # ── Matrice compacte pour le payload ─────────────────────────────────────
    matrice = None
    if matrix:
        matrice = {
            "period": matrix["period"],
            "formats": matrix["formats"][:6],
            "campaigns": matrix["campaigns"][:6],
            "slots": matrix["slots"][:3],
            "coverage": matrix["coverage"],
        }

    # LES TROIS CHIFFRES QUE L'EMAIL MET EN GROS — dépense, clics, CTR — et
    # les premiers que le client lit. Les additionner sur une semaine trouée
    # publierait un total partiel sous l'étiquette « Meta + Google » : un
    # chiffre faux, pas une approximation (ticket 20, `_aveugle_semaine`).
    _all_clicks = None if _aveugle_semaine else total_clicks + g_clicks
    _all_impr = None if _aveugle_semaine else total_impr + g_impr
    _spend_compte = None if _aveugle_semaine else round(total_spend + g_spend, 2)

    # Bloc « lecture simple » des métriques clés de la semaine (section Où on en est).
    _vues = None
    if df_week_posts is not None and not df_week_posts.empty and "views" in df_week_posts.columns:
        _vues = int(pd.to_numeric(df_week_posts["views"], errors="coerce").fillna(0).sum())
    _trafic = None
    try:
        if ga4_ctx:
            _s = ga4_ctx.get("total_sessions")
            _trafic = int(_s) if _s else None
    except Exception:
        _trafic = None
    metrics_read = {
        "trafic": _trafic,   # sessions GA4 (None tant que Google muet)
        "vues": _vues,       # vues Instagram de la semaine
        "clics": _all_clicks,
        "ctr": (round((_all_clicks / _all_impr * 100), 2)
                if _all_impr else None),
    }

    # Les memes metriques sur la fenetre PRECEDENTE : un chiffre sans repere ne
    # dit rien, le lecteur invente une conclusion. None = pas comparable, et la
    # tuile reste alors muette plutot que d'afficher une variation inventee.
    _vues_prev = None
    if df_prev_posts is not None and not df_prev_posts.empty and "views" in df_prev_posts.columns:
        _vues_prev = int(pd.to_numeric(df_prev_posts["views"], errors="coerce").fillna(0).sum())
    _trafic_prev = None
    try:
        if ga4_prev:
            _sp = ga4_prev.get("total_sessions")
            _trafic_prev = int(_sp) if _sp else None
    except Exception:
        _trafic_prev = None
    _clicks_prev = m_clicks_prev + g_clicks_prev
    _impr_prev = m_impr_prev + g_impr_prev
    metrics_prev = {
        "trafic": _trafic_prev,
        "vues": _vues_prev,
        "clics": _clicks_prev or None,
        "ctr": round((_clicks_prev / _impr_prev * 100), 2) if _impr_prev > 0 else None,
    }

    # ── Ta boussole : LE chiffre qui compte, avec son échelle ────────────────
    # Un nombre seul ne dit rien. Ce module donne les trois choses qui le
    # rendent lisible d'un coup d'oeil : sa valeur, sa trajectoire sur 10
    # semaines, et surtout la ZONE où il se situe (« tu perds » / « sain » /
    # « scalable ») — c'est la zone qui transforme un chiffre en décision.
    def _semaines(nb=10):
        out = []
        for k in range(nb):
            fin = last_full_day - timedelta(days=7 * (nb - 1 - k))
            out.append((fin - timedelta(days=6), fin))
        return out

    def _pub_semaine(d1, d2, canal=None):
        """Depense, clics et impressions d'une semaine. `canal` restreint a une
        regie — sans lui, les deux sont additionnees comme avant.

        Les deux regies vivent dans deux dataframes distincts : separer par
        plateforme ne demande donc aucune donnee de plus, seulement de ne pas
        additionner. C'est ce qui rend possible « ▣ Meta » et « ◆ Google » en
        deux rangees dans la boussole.
        """
        sp = cl = im = 0.0
        if canal in (None, "meta") and df_meta_raw is not None and not df_meta_raw.empty:
            m = df_meta_raw[(df_meta_raw["date_start"] >= pd.Timestamp(d1))
                            & (df_meta_raw["date_start"] <= pd.Timestamp(d2))]
            sp += float(m["spend"].sum()); cl += float(m["clicks"].sum()); im += float(m["impressions"].sum())
        if (canal in (None, "google") and df_google is not None
                and not df_google.empty and "date_start" in df_google.columns):
            g = df_google[(df_google["date_start"] >= pd.Timestamp(d1))
                          & (df_google["date_start"] <= pd.Timestamp(d2))]
            sp += float(g["cost_micros"].sum()) / 1_000_000.0
            cl += float(g["clicks"].sum()); im += float(g["impressions"].sum())
        return sp, cl, im

    def _insta_semaine(d1, d2):
        if df_insta is None or df_insta.empty or "date" not in df_insta.columns:
            return None, None, 0
        dt = pd.to_datetime(df_insta["date"], errors="coerce")
        w = df_insta[(dt.dt.date >= d1) & (dt.dt.date <= d2)]
        if len(w) == 0:
            return None, None, 0
        eng = float(w["eng"].mean()) if "eng" in w.columns else None
        rch = float(w["reach"].mean()) if "reach" in w.columns else None
        return eng, rch, len(w)

    # Revenu payant par semaine : UNE seule lecture GA4 pour les 10 fenêtres.
    _rev_par_sem = {}
    _sess_par_jour = {}
    try:
        for _r in (lecteur.ga4_insights() or []):
            _d = str(_r.get("date") or "")[:10]
            if not _d:
                continue
            _sess_par_jour[_d] = _sess_par_jour.get(_d, 0) + int(_r.get("sessions") or 0)
            _m = str(_r.get("medium") or "").lower()
            if any(k in _m for k in ("cpc", "ppc", "paid")):
                _rev_par_sem[_d] = _rev_par_sem.get(_d, 0.0) + float(_r.get("revenue") or 0)
    except Exception:
        _rev_par_sem, _sess_par_jour = {}, {}

    def _revenu_semaine(d1, d2):
        if not _rev_par_sem:
            return None
        tot, j = 0.0, d1
        while j <= d2:
            tot += _rev_par_sem.get(j.isoformat(), 0.0)
            j += timedelta(days=1)
        return tot

    _BANDES = {
        "roas": [(1, "tu perds", "neg"), (2, "fragile", "warn"),
                 (3, "sain", "pos"), (None, "tu peux scaler", "pos")],
        "eng": [(1, "faible", "neg"), (3, "correct", "warn"),
                (6, "bon", "pos"), (None, "excellent", "pos")],
        "ctr": [(1, "faible", "neg"), (2, "moyen", "warn"),
                (5, "bon", "pos"), (None, "excellent", "pos")],
    }

    kpi_focus = None
    metrics_series = None
    try:
        _sems = _semaines(10)
        _pts, _lab = [], []
        _cle = _unite = _titre = _repere = None
        _sens = "up"
        for (d1, _d2) in _sems:
            # Fin de semaine, pas début (TASK-039) : le dernier point doit
            # porter `last_full_day`, pas une date jusqu'à 6 jours plus vieille.
            _lab.append(f"{_d2.day} {MONTHS_FR[_d2.month]}")
        _rev_now = _revenu_semaine(*_sems[-1])
        if objectif == "ventes" and _rev_now is not None and _rev_now > 0:
            _cle, _titre, _unite = "roas", "ROAS", ""
            _repere = ("Sous 1 tu perds de l'argent. Entre 1 et 2, la pub s'autofinance "
                       "à peine. Au-dessus de 3, tu peux augmenter les budgets.")
            for (d1, d2) in _sems:
                sp, _, _ = _pub_semaine(d1, d2)
                rv = _revenu_semaine(d1, d2)
                _pts.append(round(rv / sp, 2) if (sp > 0 and rv is not None) else None)
        elif objectif == "engagement":
            _cle, _titre, _unite, _sens = "eng", "Engagement moyen", " %", "up"
            _repere = ("Part de ton audience touchée qui réagit. Sous 1 % le contenu "
                       "glisse ; au-dessus de 3 % il accroche vraiment.")
            for (d1, d2) in _sems:
                e, _, _ = _insta_semaine(d1, d2)
                _pts.append(round(e, 2) if e is not None else None)
        elif objectif == "notoriete":
            _cle, _titre, _unite = "reach", "Portée moyenne par post", ""
            _repere = ("Nombre de comptes touchés par publication. Ce qui compte n'est "
                       "pas le niveau absolu mais sa pente sur plusieurs semaines.")
            for (d1, d2) in _sems:
                _, r, _ = _insta_semaine(d1, d2)
                _pts.append(round(r) if r is not None else None)
        else:
            _cle, _titre, _unite = "ctr", "CTR publicitaire", " %"
            _repere = ("Part des gens qui cliquent après avoir vu ta pub. Sous 1 % le "
                       "message ne parle pas à l'audience visée.")
            for (d1, d2) in _sems:
                _, cl, im = _pub_semaine(d1, d2)
                _pts.append(round(cl / im * 100, 2) if im > 0 else None)

        # Toutes les metriques suivables, pour que le module soit pilotable :
        # on ne sait jamais mieux que l'utilisateur ce qu'il veut regarder ce
        # jour-la. Celle de son objectif reste celle ouverte par defaut.
        def _serie(f):
            return [f(d1, d2) for (d1, d2) in _sems]

        def _f_roas(d1, d2):
            sp, _, _ = _pub_semaine(d1, d2)
            rv = _revenu_semaine(d1, d2)
            return round(rv / sp, 2) if (sp > 0 and rv is not None) else None

        def _f_ctr(d1, d2):
            _, cl, im = _pub_semaine(d1, d2)
            return round(cl / im * 100, 2) if im > 0 else None

        def _f_cpc(d1, d2):
            sp, cl, _ = _pub_semaine(d1, d2)
            return round(sp / cl, 2) if cl > 0 else None

        def _f_eng(d1, d2):
            e, _, _ = _insta_semaine(d1, d2)
            return round(e, 2) if e is not None else None

        def _f_reach(d1, d2):
            _, r, _ = _insta_semaine(d1, d2)
            return round(r) if r is not None else None

        # LES QUATRE INDICATEURS DE REGIE SE DEDOUBLENT PAR PLATEFORME.
        #
        # « Meta + Google confondus » cachait exactement ce qu'on cherche : un
        # CTR global de 9,8 % peut etre 2 % chez l'un et 15 % chez l'autre, et
        # la moyenne ne dit pas laquelle des deux il faut aller regarder.
        #
        # LE ROAS, LUI, RESTE COMMUN, ET CE N'EST PAS UN OUBLI. Le revenu vient
        # de GA4 (`_revenu_semaine`), qui le donne par JOUR pour tout le compte
        # — sans dimension de regie. Un « ROAS Meta » se calculerait donc en
        # divisant le revenu de TOUT le compte par la seule depense Meta : un
        # chiffre faux, et flatteur. On ne le fabrique pas.
        def _par_canal(f, canal):
            return lambda d1, d2: f(d1, d2, canal)

        def _f_ctr_c(d1, d2, canal=None):
            _, cl, im = _pub_semaine(d1, d2, canal)
            return round(cl / im * 100, 2) if im > 0 else None

        def _f_cpc_c(d1, d2, canal=None):
            sp, cl, _ = _pub_semaine(d1, d2, canal)
            return round(sp / cl, 2) if cl > 0 else None

        def _f_spend_c(d1, d2, canal=None):
            sp, _, _ = _pub_semaine(d1, d2, canal)
            return round(sp, 2) if sp > 0 else None

        def _f_clics_c(d1, d2, canal=None):
            _, cl, _ = _pub_semaine(d1, d2, canal)
            return int(cl) if cl > 0 else None

        _PAR_REGIE = [
            ("ctr", "CTR", " %", "up", _f_ctr_c,
             "Part des gens qui cliquent apres avoir vu ta pub. Sous 1 % le message "
             "ne parle pas a l'audience visee."),
            ("cpc", "Coût par clic", " CHF", "down", _f_cpc_c,
             "Ce que te coûte une visite. Plus il baisse a volume egal, mieux ton "
             "ciblage et ta creation travaillent."),
            ("spend", "Dépense", " CHF", "up", _f_spend_c,
             "Ce que tu investis chaque semaine sur cette regie."),
            ("clics", "Clics", "", "up", _f_clics_c,
             "Clics sur tes publicites de cette regie."),
        ]
        _REGIES = [("meta", "Meta"), ("google", "Google")]

        _CANDIDATS = [
            ("roas", "ROAS", "", "up", _f_roas,
             "Ce que chaque franc de pub te rapporte, toutes régies confondues. "
             "Sous 1 tu perds de l'argent ; au-dessus de 3 tu peux augmenter les budgets."),
            ("eng", "Engagement moyen", " %", "up", _f_eng,
             "Part de ton audience touchee qui reagit. Sous 1 % le contenu glisse ; "
             "au-dessus de 3 % il accroche vraiment."),
            ("reach", "Portée moyenne par post", "", "up", _f_reach,
             "Nombre de comptes touches par publication. Ce qui compte n'est pas le "
             "niveau absolu mais sa pente sur plusieurs semaines."),
        ]

        def _ajoute_option(dest, ck, ct, cu, cd, cf, cr, bandes_de=None):
            pts = _serie(cf)
            reels = [v for v in pts if v is not None]
            if len(reels) < 2:
                return
            val = pts[-1] if pts[-1] is not None else reels[-1]
            prev = next((v for v in reversed(pts[:-1]) if v is not None), None)
            dest.append({
                "key": ck, "titre": ct, "unite": cu, "direction": cd,
                "valeur": val, "precedent": prev, "repere": cr,
                "points": pts,
                "bandes": [{"max": m, "label": l, "tone": t}
                           for (m, l, t) in _BANDES.get(bandes_de or ck, [])],
            })

        _options = []
        for (ck, ct, cu, cd, cf, cr) in _CANDIDATS:
            _ajoute_option(_options, ck, ct, cu, cd, cf, cr)

        # Une regie sans donnees ne produit aucune option : un compte qui n'a
        # que Meta n'aura donc jamais de rangee Google vide. C'est
        # `_ajoute_option` qui s'en charge — moins de deux points, on n'ecrit
        # rien. La cle porte la regie (`ctr:meta`) pour que l'affichage puisse
        # regrouper sans avoir a deviner.
        for _cid, _cnom in _REGIES:
            for (ck, ct, cu, cd, cf, cr) in _PAR_REGIE:
                _ajoute_option(_options, f"{ck}:{_cid}", f"{ct} {_cnom}", cu, cd,
                               _par_canal(cf, _cid), cr, bandes_de=ck)

        if _options:
            _def = next((o for o in _options if o["key"] == _cle), _options[0])
            kpi_focus = {
                "labels": _lab,
                "defaut": _def["key"],
                "options": _options,
            }

        # Les memes 10 semaines pour les quatre tuiles de lecture rapide.
        def _f_trafic(d1, d2):
            if not _sess_par_jour:
                return None
            tot, j = 0, d1
            while j <= d2:
                tot += _sess_par_jour.get(j.isoformat(), 0)
                j += timedelta(days=1)
            return tot or None

        def _f_vues(d1, d2):
            if df_insta is None or df_insta.empty or "views" not in df_insta.columns:
                return None
            dt = pd.to_datetime(df_insta["date"], errors="coerce")
            w = df_insta[(dt.dt.date >= d1) & (dt.dt.date <= d2)]
            if len(w) == 0:
                return None
            return int(pd.to_numeric(w["views"], errors="coerce").fillna(0).sum())

        def _f_clics(d1, d2):
            _, cl, _ = _pub_semaine(d1, d2)
            return int(cl) if cl > 0 else None

        metrics_series = {
            "labels": _lab,
            "trafic": _serie(_f_trafic),
            "vues": _serie(_f_vues),
            "clics": _serie(_f_clics),
            "ctr": _serie(_f_ctr),
        }

        # Ces trois-la rejoignent la boussole : un seul module pour tout suivre,
        # au lieu de tuiles qui repetaient la meme information a cote.
        if kpi_focus:
            _EXTRAS = [
                ("trafic", "Trafic (sessions)", "", metrics_series["trafic"],
                 "Visites sur ton site, tous canaux confondus (GA4)."),
                ("vues", "Vues Instagram", "", metrics_series["vues"],
                 "Vues de tes posts Instagram, semaine par semaine."),
                # `clics` global ne rejoint plus la boussole : il y vit
                # maintenant dedouble par regie (`clics:meta`, `clics:google`).
                # Il reste dans `metrics_series`, que d'autres modules lisent.
            ]
            for ck, ct, cu, pts, cr in _EXTRAS:
                reels = [v for v in pts if v is not None]
                if len(reels) < 2:
                    continue
                val = pts[-1] if pts[-1] is not None else reels[-1]
                prev = next((v for v in reversed(pts[:-1]) if v is not None), None)
                kpi_focus["options"].append({
                    "key": ck, "titre": ct, "unite": cu, "direction": "up",
                    "valeur": val, "precedent": prev, "repere": cr,
                    "points": pts, "bandes": [],
                })
    except Exception:
        kpi_focus = None
        metrics_series = None

    # ── Frise : ce qui TOURNAIT pendant ces semaines ─────────────────────────
    # Les chiffres disent ce que la semaine a donne. Ils ne disent pas ce qui
    # etait en l'air pour l'obtenir. Une campagne lancee le mercredi n'a eu que
    # la moitie de la semaine, et on lui compare pourtant des chiffres de
    # semaine pleine ; un creux de portee suivi de dix jours sans publication
    # n'est pas un probleme d'algorithme.
    #
    # Fenetre d'un AN. Une campagne dure 82 jours en mediane sur le compte
    # reel, et la saisonnalite — printemps, ete, fetes — ne se lit pas sur un
    # trimestre. L'affichage defile horizontalement et s'ouvre sur aujourd'hui ;
    # la semaine du rapport est marquee a part pour qu'on la retrouve sans
    # chercher.
    #
    # Aucune requete supplementaire : les jours ou une campagne a DEPENSE sont
    # deja en base, et ils donnent son debut et sa fin de diffusion reels —
    # mieux que des dates declarees, qui ne disent pas si elle a tourne.
    frise = None
    changements = []
    try:
        # De janvier de l'annee PRECEDENTE a fin decembre de l'annee EN COURS —
        # deux ans, et les deux bornes viennent des donnees reelles : des
        # campagnes ont demarre le 1er janvier 2025, que la fenetre glissante de
        # 365 jours coupait net, et d'autres sont programmees jusqu'a fin 2026,
        # ou l'on doit pouvoir aller regarder.
        #
        # La borne de gauche se resserre sur le premier evenement : sans ca, un
        # compte ouvert en mars afficherait quatorze mois de vide avant sa
        # premiere campagne. La borne de droite, elle, ne bouge pas : c'est le
        # futur, il est vide par nature. Ce qui suit la derniere donnee recoltee
        # est marque « a venir » a l'affichage — jamais presente comme mesure.
        _f_fin = date(today.year, 12, 31)
        _f_debut = date(today.year - 1, 1, 1)

        _camps = {}

        def _ajoute(nom, canal, jour, montant):
            if not nom or jour is None:
                return
            if not (_f_debut <= jour <= _f_fin):
                return
            c = _camps.setdefault((canal, str(nom)), {
                "nom": str(nom)[:60], "canal": canal,
                "debut": jour, "fin": jour, "jours": set(), "depense": 0.0,
                # Le montant JOUR PAR JOUR. La frise n'en a pas besoin, le
                # registre des changements si : un budget doublé ne se voit
                # nulle part ailleurs — aucune API ne nous donne le budget.
                "parjour": {},
            })
            c["debut"] = min(c["debut"], jour)
            c["fin"] = max(c["fin"], jour)
            c["jours"].add(jour)
            c["depense"] += float(montant or 0)
            c["parjour"][jour] = c["parjour"].get(jour, 0.0) + float(montant or 0)

        if df_meta_raw is not None and not df_meta_raw.empty:
            _m = df_meta_raw.copy()
            _m["jourdt"] = pd.to_datetime(_m["date_start"], errors="coerce")
            for _r in _m.itertuples():
                if pd.isna(_r.jourdt) or float(getattr(_r, "spend", 0) or 0) <= 0:
                    continue
                _ajoute(getattr(_r, "campaign_name", None), "meta",
                        _r.jourdt.date(), getattr(_r, "spend", 0))

        if not df_google.empty and "campaign_name" in df_google.columns:
            _g = df_google.copy()
            _g["jourdt"] = pd.to_datetime(_g["date_start"], errors="coerce")
            for _r in _g.itertuples():
                _cost = float(getattr(_r, "cost_micros", 0) or 0) / 1_000_000.0
                if pd.isna(_r.jourdt) or _cost <= 0:
                    continue
                _ajoute(getattr(_r, "campaign_name", None), "google", _r.jourdt.date(), _cost)

        # ── Les dates DECLAREES dans la plateforme ────────────────────────
        # Elles ne se deduisent pas de la depense, d'ou la lecture separee. La
        # distinction qui compte : une ligne SANS end_date veut dire « declaree
        # sans date de fin » ; PAS de ligne du tout veut dire « on ne sait
        # pas ». Le premier cas s'affiche, le second reste muet.
        #
        # Lues une seule fois pour tout le rapport (voir `_dates_declarees`,
        # plus haut) : la veille des campagnes neuves s'appuie sur exactement
        # les memes lignes, et deux lectures de la meme table pouvaient rendre
        # deux verites differentes si une recolte passait entre les deux.
        _declare = _declare_camp

        # Une campagne DECLAREE mais qui n'a rien depense n'existe nulle part
        # dans les insights : elle n'aurait aucune barre. C'est pourtant celle
        # qu'on veut le plus voir — elle est programmee et elle arrive.
        _deja = {(c["canal"], c["nom"]) for c in _camps.values()}
        for (_canal, _nom), _d in _declare.items():
            if (_canal, _nom) in _deja or not _d["start"]:
                continue
            try:
                _dep = date.fromisoformat(str(_d["start"])[:10])
            except ValueError:
                continue
            if not (_f_debut <= _dep <= _f_fin):
                continue
            _camps[(_canal, _nom)] = {
                "nom": str(_nom)[:60], "canal": _canal,
                "debut": _dep, "fin": _dep, "jours": set(), "depense": 0.0,
                "parjour": {}, "planifiee": True,
            }

        _campagnes = sorted(_camps.values(), key=lambda c: -c["depense"])

        def _sortie(c):
            out = {
                "nom": c["nom"], "canal": c["canal"],
                "debut": c["debut"].isoformat(), "fin": c["fin"].isoformat(),
                "jours": len(c["jours"]),
                # Un trou au milieu d'une diffusion (campagne coupee puis
                # relancee) doit se voir : sinon la barre ment sur la
                # continuite.
                "continu": len(c["jours"]) == (c["fin"] - c["debut"]).days + 1,
                "depense": round(c["depense"], 2),
            }
            if c.get("planifiee"):
                out["planifiee"] = True
            _d = _declare.get((c["canal"], c["nom"]))
            if _d is not None:
                # `None` est une VALEUR ici (« sans date de fin »), pas une
                # absence : la cle est donc toujours ecrite quand la ligne
                # existe, et jamais quand elle n'existe pas.
                out["fin_prevue"] = str(_d["end"])[:10] if _d["end"] else None
            return out

        _campagnes = [_sortie(c) for c in _campagnes]

        _pubs = []
        if not df_insta.empty and "date" in df_insta.columns:
            _i = df_insta.copy()
            _i["jourdt"] = pd.to_datetime(_i["date"], errors="coerce", utc=True)
            for _r in _i.itertuples():
                if pd.isna(_r.jourdt):
                    continue
                _dj = _r.jourdt.date()
                if not (_f_debut <= _dj <= _f_fin):
                    continue
                _pubs.append({
                    # La plateforme est portee explicitement, meme si une seule
                    # source existe aujourd'hui : le jour ou TikTok ou LinkedIn
                    # arrivent, la frise les distingue sans changer de format de
                    # payload — et tant qu'il n'y en a qu'une, l'affichage se
                    # rabat sur le format du post, qui lui differencie vraiment.
                    "plateforme": "instagram",
                    "date": _dj.isoformat(),
                    "type": str(getattr(_r, "type", "") or ""),
                })
        _pubs.sort(key=lambda x: x["date"])

        # Jusqu'ou chaque source est REELLEMENT a jour. Sans cette limite, une
        # barre qui s'arrete au dernier jour recolte se lit « campagne
        # terminee » alors que ce sont les donnees qui s'arretent — les canaux
        # ne se rafraichissent pas tous le meme jour. C'est la regle maison :
        # aucun chiffre non mesure presente comme mesure.
        def _dernier(df, col, utc=False):
            try:
                if df is None or df.empty or col not in df.columns:
                    return None
                _d = pd.to_datetime(df[col], errors="coerce", utc=utc).max()
                return _d.date().isoformat() if pd.notna(_d) else None
            except Exception:
                return None

        _couverture = {
            "meta": _dernier(df_meta_raw, "date_start"),
            "google": _dernier(df_google, "date_start"),
            "instagram": _dernier(df_insta, "date", utc=True),
        }

        # La borne de gauche se cale sur le premier evenement reel, sans jamais
        # depasser la semaine du rapport (qui doit rester dans le cadre).
        _premiers = [c["debut"] for c in _camps.values()]
        _premiers += [date.fromisoformat(p["date"]) for p in _pubs]
        if _premiers:
            _f_debut = max(_f_debut, min(min(_premiers), cur_since))

        # ── CE QUI A BOUGÉ SUR TES PLATEFORMES ────────────────────────────
        #
        # Le fil d'actions ne voyait que ce qu'on décide DANS Pulse. Or
        # l'essentiel se fait ailleurs : une campagne lancée un mardi soir dans
        # le gestionnaire Meta, une autre coupée, un budget doublé. Sans ça, le
        # fil raconte un tiers de l'histoire — et quand la courbe bouge, rien
        # n'explique pourquoi.
        #
        # Tout ce qui suit est DÉDUIT de la dépense quotidienne, jamais d'un
        # champ d'API : aucune plateforme ne nous dit « le budget a changé le
        # 2 août ». On écrit donc ce qu'on observe (« la dépense est passée de
        # 30 à 75 CHF par jour »), pas ce qu'on suppose (« tu as doublé le
        # budget »). C'est plus prudent et c'est plus utile : c'est la dépense
        # qui compte, pas le réglage.
        _FENETRE_CHG = 60      # jours d'historique — au-delà, ce n'est plus une nouvelle
        _SAUT = 0.6            # ±60 % de dépense quotidienne pour parler d'un saut
        _chg = []
        _borne = last_full_day - timedelta(days=_FENETRE_CHG)

        def _couv_canal(canal):
            _c = _couverture.get(canal)
            try:
                return date.fromisoformat(_c) if _c else last_full_day
            except Exception:
                return last_full_day

        for _c in _camps.values():
            _canal, _nom = _c["canal"], _c["nom"]
            _base = {"canal": _canal, "campagne": _nom}

            if _c.get("planifiee"):
                # « PROGRAMMÉE » PROMET UN ÉVÉNEMENT À VENIR. Le test ne portait
                # que sur « déclarée et n'a jamais dépensé », et ce type-là
                # échappait en plus à la fenêtre de 60 jours qui borne tous les
                # autres. Résultat vu chez un client en août 2026 : vingt lignes
                # « est programmée — aucune dépense encore », dont une campagne
                # de Noël 2025 et une campagne saisonnière 2025. Elles ne sont
                # pas programmées, elles n'ont jamais tourné — et elles
                # noyaient les trois faits de la semaine.
                #
                # Deux cas, deux phrases, et le troisième ne s'écrit pas :
                #   · début À VENIR              → elle arrive, c'est une nouvelle ;
                #   · début passé, moins de 60 j → elle devait démarrer et n'a
                #     rien dépensé : ça, c'est un problème, pas une annonce ;
                #   · début passé de plus de 60 j → rien. Ce n'est plus une
                #     nouvelle, c'est un état, et un état ne se raconte pas.
                if _c["debut"] > last_full_day:
                    _chg.append(dict(_base, date=_c["debut"].isoformat(), type="planifiee"))
                elif _c["debut"] >= _borne:
                    _chg.append(dict(_base, date=_c["debut"].isoformat(), type="jamais_lancee"))
                continue

            _jours = sorted(_c["jours"])
            if not _jours:
                continue

            if _jours[0] >= _borne:
                _chg.append(dict(_base, date=_jours[0].isoformat(), type="lancee"))

            # ARRÊTÉE : plus de dépense depuis 3 jours pleins alors que le canal,
            # lui, a des données plus récentes. Sans cette seconde condition on
            # annoncerait un arrêt à chaque fois qu'un canal prend du retard.
            _fin, _couv = _jours[-1], _couv_canal(_canal)
            if _fin >= _borne and (_couv - _fin).days >= 3:
                _chg.append(dict(_base, date=_fin.isoformat(), type="arretee"))

            # REPRISE : un trou d'au moins 3 jours refermé. On ne signale que la
            # dernière — une campagne en pointillé produirait sinon dix lignes.
            _reprise = None
            for _a, _b in zip(_jours, _jours[1:]):
                if (_b - _a).days >= 4 and _b >= _borne:
                    _reprise = (_b, (_b - _a).days - 1)
            if _reprise:
                _chg.append(dict(_base, date=_reprise[0].isoformat(), type="reprise",
                                 detail=f"après {_reprise[1]} jours d'arrêt"))

            # SAUT DE DÉPENSE : la moyenne des 7 derniers jours actifs contre les
            # 7 précédents. Sept jours de chaque côté, parce qu'un seul jour se
            # laisse emporter par un week-end.
            if len(_jours) >= 10:
                _av = [_c["parjour"].get(j, 0.0) for j in _jours[-14:-7]]
                _ap = [_c["parjour"].get(j, 0.0) for j in _jours[-7:]]
                _ma = sum(_av) / len(_av) if _av else 0.0
                _mb = sum(_ap) / len(_ap) if _ap else 0.0
                if _ma > 1 and _jours[-1] >= _borne and abs(_mb - _ma) / _ma >= _SAUT:
                    _chg.append(dict(
                        _base, date=_jours[-7].isoformat(), type="depense",
                        detail=f"{_ma:.0f} → {_mb:.0f} CHF par jour",
                    ))

        _chg.sort(key=lambda x: x["date"], reverse=True)
        changements = _chg[:40]

        if _campagnes or _pubs:
            frise = {
                "debut": _f_debut.isoformat(),
                "fin": _f_fin.isoformat(),
                "semaine_debut": cur_since.isoformat(),
                "couverture": _couverture,
                "campagnes": _campagnes,
                "posts": _pubs,
            }
    except Exception:
        frise = None
        changements = []

    # ── CE QU'ON N'A PAS PU LIRE, DIT AU CLIENT (ticket 20) ──────────────────
    # Le payload porte le trou lui-même, pas seulement ses conséquences. Sans
    # cette liste, l'écran et l'email verraient des `None` sans savoir les
    # expliquer — et un « — » sans raison se lit comme un bug de Pulse, pas
    # comme une connexion à refaire. C'est la moitié qui transforme un silence
    # en geste : le client doit comprendre POURQUOI il ne voit rien, sinon on a
    # juste déplacé le silence.
    #
    # `mot` vient de `fetch_progress.mot_de_fin`, c'est-à-dire de la ligne que
    # le worker a déjà imprimée dans son journal. On ne la réécrit pas : elle
    # nomme l'exception telle qu'elle est tombée. Le NOM DE VARIABLE peut y
    # apparaître, jamais sa valeur (`CLAUDE.md` §7).
    canaux_muets_payload = [
        {
            "canal": _c,
            "nom": NOMS_CANAUX.get(_c, _c),
            "mot": _m,
            # Le dernier jour que ce canal a réellement écrit — ce qui borne le
            # trou. `None` quand il n'a jamais rien écrit.
            "depuis": (_bord_muet.get(_c).isoformat()
                       if _bord_muet.get(_c) else None),
            # `True` quand ce canal fait taire des chiffres de CETTE semaine.
            # Un canal en échec dont la dernière date couvre déjà la fenêtre
            # n'a rien creusé : il est signalé, mais il ne tait rien.
            "chiffres_tus": _c in _aveugle_semaine,
            # Depuis combien de rapports publiés d'affilée ce canal est muet,
            # celui-ci compris — donc 1 la première semaine (ticket 47). C'est
            # ce qui permet à la note de changer de registre au lieu de répéter
            # la même phrase, et à la run de finir rouge quand la panne dure.
            # INDÉPENDANT DE `chiffres_tus` : un Google Ads mort sur un compte
            # organique ne cache rien aujourd'hui et cassera tout le jour où ce
            # client lancera sa première campagne.
            "semaines_muettes": semaines_muettes(_c, _historique_publie),
        }
        for _c, _m in sorted(pub_muette.items())
    ]

    return {
        "version": 2,
        # La liste est TOUJOURS présente, vide quand tout va bien : un écran qui
        # doit distinguer « pas de trou » de « payload d'avant le ticket 20 »
        # lirait autrement une absence comme une absence de trou.
        "canaux_muets": canaux_muets_payload,
        "changements": changements,
        "matrice": matrice,
        "metrics_read": metrics_read,
        "metrics_prev": metrics_prev,
        "kpi_focus": kpi_focus,
        "frise": frise,
        "metrics_series": metrics_series,
        "kpis": {
            # Chiffres bruts (l'email les met en forme) — mêmes fenêtres que Pulse
            # `None` et jamais 0 quand un canal payant est muet : l'email
            # affiche alors « — » (voir `saas/emailing/render.py`), ce qu'il
            # savait déjà faire. Un 0 se lirait « tu n'as rien dépensé ».
            "spend": _spend_compte,
            "clicks": _all_clicks,
            "ctr": ((_all_clicks / _all_impr * 100) if _all_impr else None),
            "followers_delta": followers_delta,
            "followers_total": followers_current,
        },
        "week_label": week_label,
        # LA LIGNE SOUS LAQUELLE CE PAYLOAD DOIT S'ÉCRIRE — dérivée de la
        # fenêtre mesurée, jamais du jour de fabrication. C'est ce qui rend la
        # republication idempotente (voir le bloc `week_start_rapport`).
        # `publish_weekly_report` la lit ; personne d'autre n'en a besoin, mais
        # elle voyage dans le payload parce que c'est `build_payload` qui
        # connaît la fenêtre.
        "week_start": week_start_rapport.isoformat(),
        "since": cur_since.isoformat(),
        "until": last_full_day.isoformat(),
        "verdict": verdict,
        # Les ingredients du verdict, pour l'afficher en grand. Absents des
        # payloads deja publies → le front retombe sur la phrase seule.
        "verdict_pct": verdict_pct,
        "verdict_metric": verdict_metric,
        "verdict_tone": verdict_tone,
    }


def _display_name(sb, user_id: str, fallback_email: str | None) -> str:
    """Nom pour le « Bonjour … » : compte Instagram connecté, sinon début de l'email."""
    try:
        rows = (sb.table("connected_accounts")
                .select("account_name, instagram_business_id")
                .eq("user_id", user_id).execute().data) or []
        for r in rows:
            if r.get("instagram_business_id") and r.get("account_name"):
                return r["account_name"]
    except Exception:
        pass
    return (fallback_email or "").split("@")[0] or "toi"


def publish_weekly_report(sb, user_id: str,
                          email_to: str | None = None) -> tuple[str, list[dict]]:
    """Construit + publie le rapport d'un utilisateur ; envoie l'email si email_to.

    L'email lit le MÊME payload que Pulse (une seule source de vérité).
    Sans RESEND_API_KEY, send_email passe en dry-run → aucun envoi, juste un log.

    REND AUSSI LES CANAUX MUETS DU RAPPORT PUBLIÉ, avec leur compteur de
    semaines (ticket 47). C'est ce que l'orchestrateur a besoin de savoir pour
    faire finir la run en rouge quand une panne dure — et ça part d'ici parce
    qu'ici seulement on a le payload sous la main : le relire depuis
    `weekly_reports` coûterait une requête par compte pour un fait qu'on vient
    d'écrire. La LISTE est rendue telle quelle, sans seuil : cette fonction
    publie, elle n'arbitre pas. Le seuil est la doctrine de l'appelant.
    """
    payload = build_payload(LecteurSupabase(sb, user_id))
    if payload is None:
        return "rapport: pas de données", []
    # LA SEMAINE VIENT DU PAYLOAD, donc de la FENÊTRE MESURÉE : republier ne
    # doit jamais créer une deuxième ligne pour les mêmes chiffres (la clé est
    # `(user_id, week_start)`). Le repli sur le lundi d'aujourd'hui ne sert que
    # si `build_payload` n'a pas posé la clé — il la pose toujours depuis le
    # ticket 13 de la construction ; garder le repli évite qu'un payload forgé
    # par un test fasse tomber la publication.
    week_start = (payload.get("week_start")
                  or (date.today() - timedelta(days=date.today().weekday())).isoformat())
    upsert_weekly_report(sb, user_id, week_start, payload)
    log = "rapport publié"

    if email_to:
        import os
        from emailing.render import email_from_payload
        from emailing.send import send_email
        app_url = os.getenv("EMAIL_APP_URL", "https://dashboard-analytic-green.vercel.app")
        subject, html = email_from_payload(_display_name(sb, user_id, email_to), payload, app_url)
        res = send_email(to=email_to, subject=subject, html=html)
        # ON RANGE L'ENVOI, PAS SEULEMENT SON RÉSUMÉ (ticket 50). Cette ligne
        # est la seule trace qui survivra à la run : c'est elle qu'on relira au
        # passage suivant pour demander au fournisseur ce que l'email est
        # devenu. Le journal, lui, disparaît avec le run GitHub.
        upsert_envoi_email(sb, user_id, week_start, res)
        log += (f" · email {res['provider']}: "
                f"{'envoyé' if res['ok'] and res['provider'] != 'dry' else res['detail']}")
    return log, list(payload.get("canaux_muets") or [])


def _service_client():
    import os
    from supabase import create_client
    url = os.getenv("SUPABASE_URL") or secret("supabase.url")
    key = os.getenv("SUPABASE_SERVICE_KEY") or secret("supabase.service_role")
    if not url or not key:
        raise SystemExit("SUPABASE_URL / SUPABASE_SERVICE_KEY manquants (env ou secrets.toml)")
    return create_client(url, key)


if __name__ == "__main__":
    args = sys.argv[1:]
    sb = _service_client()
    if "--all" in args:
        profiles = (sb.table("profiles").select("id").execute().data) or []
        for p in profiles:
            print(f"{p['id']} → {publish_weekly_report(sb, p['id'])[0]}")
    elif "--user" in args:
        uid = args[args.index("--user") + 1]
        if "--print" in args:
            payload = build_payload(LecteurSupabase(sb, uid))
            print(json.dumps(payload, ensure_ascii=False, indent=2, default=str))
        else:
            print(publish_weekly_report(sb, uid)[0])
    else:
        print(__doc__)
