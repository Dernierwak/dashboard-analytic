from supabase import Client
from datetime import date, timedelta


def insert_instagram_org(supabase: Client, results):
    """Écrit les posts récoltés — un jeu de lignes PAR UTILISATEUR.

    Le conflit porte sur (user_id, post_id) et surtout PAS sur post_id seul :
    deux comptes Pulse peuvent suivre la même page Instagram, et avec un
    conflit global l'upsert de l'un réécrivait le user_id des lignes de
    l'autre. Chaque récolte volait donc les posts du voisin au lieu d'ajouter
    les siens, sans lever la moindre erreur. Voir
    supabase/migrations/instagram_posts_par_user.sql.
    """
    if not results:
        return
    supabase.table("instagram_organic_posts").upsert(
        results, on_conflict="user_id,post_id"
    ).execute()


def insert_instagram_total_posts_id(supabase: Client, user_id, total_posts_id):
    supabase.table("connected_accounts").update({"total_posts_id_instagram": total_posts_id}).eq("user_id", user_id).execute()
    
    
def insert_schedule_data(supabase:Client, user_id, fetch_schedule):
    supabase.table("profiles").update({"fetch_schedule": fetch_schedule}).eq("id", user_id).execute()


# CE QUI BORNE UN LOT, ET POURQUOI IL Y A DEUX BORNES.
#
# Une récolte de routine demande ~35 jours : elle tient dans un lot et ces
# bornes ne se voient jamais. C'est le REJEU D'HISTORIQUE (`--meta-since`) qui
# les rend nécessaires, et l'avertissement était écrit d'avance dans la note
# PROFONDEUR D'HISTORIQUE de `fetch_all.py` : « upsert_meta_ads envoie TOUT en
# un seul appel PostgREST, et 22 500 lignes d'un coup n'ont jamais été
# essayées. À découper avant d'élargir quoi que ce soit. »
#
#  · les DATES, parce que le DELETE les met dans l'URL. `.in_("date_start", …)`
#    est un filtre de query-string : 1 100 dates font ~16 Ko d'URL, au-delà du
#    tampon d'en-têtes habituel (8 Ko) — le serveur répond 414 et l'effacement
#    échoue, donc RIEN n'est écrit après des minutes d'appels à Meta.
#  · les LIGNES, parce que l'upsert les met dans le corps. Un compte à 500
#    annonces × 90 jours ferait 45 000 lignes en un seul envoi.
#
# Les deux plafonds sont volontairement bas : un lot de plus coûte un
# aller-retour, une requête refusée coûte la récolte.
_LOT_DATES_MAX = 90
_LOT_LIGNES_MAX = 5000


def _lots_par_date(records: list[dict]) -> list[list[dict]]:
    """Découpe les lignes en lots, sans jamais séparer une même date.

    Une date doit rester entière dans son lot : son effacement et sa réécriture
    sont une paire (voir `upsert_meta_ads`), et une date à cheval sur deux lots
    verrait ses lignes sans `ad_id` effacées par le premier et une partie
    seulement réécrite.
    """
    par_date: dict[str, list[dict]] = {}
    for r in records:
        par_date.setdefault(r.get("date_start"), []).append(r)

    lots, lot, lignes = [], [], 0
    for jour in sorted(par_date, key=lambda d: (d is None, d)):
        du_jour = par_date[jour]
        trop_de_dates = len(lot) and len({r.get("date_start") for r in lot}) >= _LOT_DATES_MAX
        trop_de_lignes = lignes and lignes + len(du_jour) > _LOT_LIGNES_MAX
        if trop_de_dates or trop_de_lignes:
            lots.append(lot)
            lot, lignes = [], 0
        lot += du_jour
        lignes += len(du_jour)
    if lot:
        lots.append(lot)
    return lots


def upsert_meta_ads(supabase: Client, user_id: str, records: list[dict]):
    """Upsert des lignes de meta_ads_insights, déjà formées par
    `saas.collecte.meta.fetch_meta_ads.lignes_meta_ads`.
    Conflict sur (user_id, date_start, ad_id) — une ligne par annonce par jour.
    """
    if not records:
        return

    for lot in _lots_par_date(records):
        # LE DOUBLE COMPTAGE QU'IL FAUT ÉCARTER AVANT D'ÉCRIRE. Les lignes
        # antérieures au passage à `ad_id` le portent à NULL. Un upsert sur
        # (user_id, date_start, ad_id) ne les reconnaît pas — il ajouterait la
        # ligne neuve À CÔTÉ de l'ancienne, et la dépense de ces journées
        # compterait double, durablement. On efface donc les lignes sans ad_id
        # des SEULES dates qu'on s'apprête à réécrire, pour ce SEUL
        # utilisateur : ce sont exactement les lignes que l'upsert remplace.
        #
        # L'EFFACEMENT ET L'ÉCRITURE VONT PAR PAIRE, LOT PAR LOT. Les séparer
        # (tout effacer, puis tout écrire) rouvrirait la fenêtre sans donnée
        # qu'on a justement refusée en écartant le DELETE global.
        dates = sorted({r["date_start"] for r in lot if r.get("date_start")})
        if dates:
            (supabase.table("meta_ads_insights")
             .delete()
             .eq("user_id", user_id)
             .is_("ad_id", "null")
             .in_("date_start", dates)
             .execute())

        supabase.table("meta_ads_insights").upsert(
            lot,
            on_conflict="user_id,date_start,ad_id"
        ).execute()


# ── Tab Coût — budgets ─────────────────────────────────────────────────────────

def upsert_channel_budget(supabase: Client, user_id: str, channel: str, month_iso: str, amount: float) -> None:
    """Budget mensuel d'un canal (channel_budgets). month_iso = 'YYYY-MM-01'."""
    supabase.table("channel_budgets").upsert(
        {
            "user_id": user_id,
            "channel": channel,
            "month": month_iso,
            "amount": float(amount or 0),
        },
        on_conflict="user_id,channel,month",
    ).execute()


def upsert_weekly_report(supabase: Client, user_id: str, week_start_iso: str, payload: dict) -> None:
    """Publie le rapport hebdo précalculé (payload JSON) — lu par Pulse + l'email hebdo."""
    from datetime import datetime, timezone
    supabase.table("weekly_reports").upsert(
        {
            "user_id": user_id,
            "week_start": week_start_iso,
            "payload": payload,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        on_conflict="user_id,week_start",
    ).execute()


def update_meta_budget_global(supabase: Client, user_id: str, value: float) -> None:
    """Budget global → profiles.meta_budget_global."""
    supabase.table("profiles").update({"meta_budget_global": float(value or 0)}).eq("id", user_id).execute()


def upsert_campaign_config(
    supabase: Client,
    user_id: str,
    campaign_name: str,
    *,
    budget_max: float | None = None,
    effective_status: str | None = None,
) -> None:
    """Upsert ligne meta_campaign_config. Met à jour seulement les champs fournis."""
    payload: dict = {"user_id": user_id, "campaign_name": campaign_name}
    if budget_max is not None:
        payload["budget_max"] = float(budget_max or 0)
    if effective_status is not None:
        payload["effective_status"] = effective_status or None
    supabase.table("meta_campaign_config").upsert(
        payload, on_conflict="user_id,campaign_name"
    ).execute()


def upsert_campaign_statuses(
    supabase: Client,
    user_id: str,
    status_map: dict[str, str],
) -> None:
    """Met à jour statut ET dates déclarées, pour toutes les campagnes d'un coup.

    status_map accepte DEUX formes, parce que deux appelants coexistent :
      · {campaign_name: "ACTIVE"}                       (ancien, Streamlit)
      · {campaign_name: {"status":…, "start_date":…, "end_date":…}}  (worker)
    Une chaîne nue n'écrase donc jamais les dates par du vide — elle ne les
    mentionne simplement pas.
    """
    if not status_map:
        return
    records = []
    for name, v in status_map.items():
        if not name:
            continue
        if isinstance(v, dict):
            records.append({
                "user_id": user_id,
                "campaign_name": name,
                "effective_status": v.get("status") or None,
                "start_date": v.get("start_date") or None,
                "end_date": v.get("end_date") or None,
            })
        else:
            records.append({
                "user_id": user_id,
                "campaign_name": name,
                "effective_status": v or None,
            })
    if records:
        supabase.table("meta_campaign_config").upsert(
            records, on_conflict="user_id,campaign_name"
        ).execute()


# ── Budget PLANIFIÉ (photos) — platform_budgets ───────────────────────────────

def _table_absente(err: Exception, table: str) -> bool:
    """PostgREST répond 42P01 / « does not exist » quand la migration manque.

    On distingue ce cas d'une vraie panne : le premier se règle en lançant un
    fichier SQL, le second doit remonter tel quel.
    """
    msg = str(err).lower()
    return table in msg and ("does not exist" in msg or "42p01" in msg or "not find the table" in msg)


def upsert_platform_budgets(
    supabase: Client,
    user_id: str,
    channel: str,
    rows: list[dict],
    captured_on: str,
) -> None:
    """Écrit UNE PHOTO du budget planifié — une ligne par campagne, datée du relevé.

    On n'écrase jamais un relevé précédent : la clé porte `captured_on`, donc
    deux récoltes le même jour se remplacent (c'est voulu, la seconde est plus
    fraîche) mais deux jours différents s'empilent. C'est tout l'historique dont
    on disposera jamais — aucune API ne sait dire ce que valait un budget hier.

    `rows` : la sortie de collecte.google.fetch_google_ads.fetch_campaign_budgets
    ou de collecte.meta.fetch_meta_ads.fetch_campaign_budgets.
    """
    if not rows:
        return
    seen = set()
    records = []
    for r in rows:
        cid = str(r.get("campaign_id") or "")
        if not cid or cid in seen:
            continue
        seen.add(cid)
        jour = r.get("daily_budget")
        total = r.get("total_budget")
        records.append({
            "user_id":       user_id,
            "channel":       channel,
            "campaign_id":   cid,
            "campaign_name": r.get("campaign_name") or None,
            "captured_on":   captured_on,
            "daily_budget":  float(jour) if jour is not None else None,
            "total_budget":  float(total) if total is not None else None,
            "start_date":    r.get("start_date") or None,
            "end_date":      r.get("end_date") or None,
            "status":        r.get("status") or None,
        })
    if not records:
        return
    try:
        supabase.table("platform_budgets").upsert(
            records, on_conflict="user_id,channel,campaign_id,captured_on"
        ).execute()
    except Exception as e:
        if _table_absente(e, "platform_budgets"):
            raise RuntimeError(
                "table platform_budgets absente — lance "
                "supabase/migrations/platform_budgets.sql"
            ) from e
        raise


# ── Changements DÉCLARÉS par les plateformes — platform_changes ───────────────

def upsert_platform_changes(
    supabase: Client,
    user_id: str,
    channel: str,
    rows: list[dict],
) -> None:
    """Écrit le journal des changements déclarés par la plateforme.

    Idempotent par construction : `change_id` est un hachage stable de
    (canal, horodatage, ressource, champ), donc deux récoltes qui se recouvrent
    — et elles se recouvrent toujours, la fenêtre de Google fait trente jours —
    réécrivent les mêmes lignes au lieu d'en empiler des copies.

    Rien n'est inséré qui n'ait déjà un `resume` en français : le tri se fait à
    la récolte, jamais ici et jamais à l'affichage.
    """
    if not rows:
        return
    seen = set()
    records = []
    for r in rows:
        cle = str(r.get("change_id") or "")
        resume = (r.get("resume") or "").strip()
        if not cle or not resume or cle in seen:
            continue
        seen.add(cle)
        records.append({
            "user_id":       user_id,
            "channel":       channel,
            "change_id":     cle,
            "occurred_at":   r.get("occurred_at"),
            "categorie":     r.get("categorie") or "autre",
            "campaign_id":   str(r["campaign_id"]) if r.get("campaign_id") else None,
            "campaign_name": r.get("campaign_name") or None,
            "resume":        resume,
        })
    if not records:
        return
    try:
        supabase.table("platform_changes").upsert(
            records, on_conflict="user_id,channel,change_id"
        ).execute()
    except Exception as e:
        if _table_absente(e, "platform_changes"):
            raise RuntimeError(
                "table platform_changes absente — lance "
                "supabase/migrations/platform_changes.sql"
            ) from e
        raise


# ── Google Ads — helpers ──────────────────────────────────────────────────────

def upsert_google_ads(supabase: Client, user_id: str, rows: list[dict]) -> None:
    """Upsert google_ads_insights.
    Chaque row attend : campaign_id, campaign_name, date_start (YYYY-MM-DD),
    impressions, clicks, cost_micros, conversions, ctr, avg_cpc_micros.
    Conflict sur (user_id, date_start, campaign_id) : 1 ligne par campagne × jour.
    """
    if not rows:
        return
    seen = set()
    records = []
    for r in rows:
        key = (r.get("date_start"), str(r.get("campaign_id", "")))
        if key in seen:
            continue
        seen.add(key)
        records.append({
            "user_id":        user_id,
            "date_start":     r.get("date_start"),
            "campaign_id":    str(r.get("campaign_id", "")),
            "campaign_name":  r.get("campaign_name", ""),
            "impressions":    int(r.get("impressions") or 0),
            "clicks":         int(r.get("clicks") or 0),
            "conversions":    float(r.get("conversions") or 0),
            "cost_micros":    int(r.get("cost_micros") or 0),
            "ctr":            float(r.get("ctr") or 0),
            "avg_cpc_micros": int(r.get("avg_cpc_micros") or 0),
        })
    supabase.table("google_ads_insights").upsert(
        records, on_conflict="user_id,date_start,campaign_id"
    ).execute()


def upsert_google_ads_ad_insights(supabase: Client, user_id: str, rows: list[dict]) -> None:
    """Upsert google_ads_ad_insights (détail annonce × jour, pour le drill-down).
    Conflict sur (user_id, date_start, ad_id) : 1 ligne par annonce × jour.
    """
    if not rows:
        return
    seen = set()
    records = []
    for r in rows:
        key = (r.get("date_start"), str(r.get("ad_id", "")))
        if key in seen:
            continue
        seen.add(key)
        records.append({
            "user_id":       user_id,
            "date_start":    r.get("date_start"),
            "campaign_id":   str(r.get("campaign_id", "")),
            "campaign_name": r.get("campaign_name", ""),
            "ad_group_id":   str(r.get("ad_group_id", "")),
            "ad_group_name": r.get("ad_group_name", ""),
            "ad_id":         str(r.get("ad_id", "")),
            "ad_name":       r.get("ad_name", ""),
            "impressions":   int(r.get("impressions") or 0),
            "clicks":        int(r.get("clicks") or 0),
            "cost_micros":   int(r.get("cost_micros") or 0),
            "conversions":   float(r.get("conversions") or 0),
        })
    supabase.table("google_ads_ad_insights").upsert(
        records, on_conflict="user_id,date_start,ad_id"
    ).execute()


def update_google_budget_global(supabase: Client, user_id: str, value: float) -> None:
    supabase.table("profiles").update({"google_budget_global": float(value or 0)}).eq("id", user_id).execute()


def upsert_google_campaign_config(
    supabase: Client,
    user_id: str,
    campaign_id: str,
    *,
    campaign_name: str | None = None,
    budget_max: float | None = None,
    effective_status: str | None = None,
) -> None:
    payload: dict = {"user_id": user_id, "campaign_id": str(campaign_id)}
    if campaign_name is not None:
        payload["campaign_name"] = campaign_name
    if budget_max is not None:
        payload["budget_max"] = float(budget_max or 0)
    if effective_status is not None:
        payload["effective_status"] = effective_status or None
    supabase.table("google_campaign_config").upsert(
        payload, on_conflict="user_id,campaign_id"
    ).execute()


def upsert_google_campaign_statuses(supabase: Client, user_id: str, status_map: dict) -> None:
    """status_map : {campaign_id: (campaign_name, effective_status, start, end)}

    `end` à None veut dire « déclarée sans date de fin » : la sentinelle 2037
    de Google est déjà normalisée à la récolte.
    """
    if not status_map:
        return
    records = []
    for cid, v in status_map.items():
        cname, status = v[0], v[1]
        debut = v[2] if len(v) > 2 else None
        fin = v[3] if len(v) > 3 else None
        records.append({
            "user_id": user_id,
            "campaign_id": str(cid),
            "campaign_name": cname,
            "effective_status": status or None,
            "start_date": debut,
            "end_date": fin,
        })
    if records:
        supabase.table("google_campaign_config").upsert(
            records, on_conflict="user_id,campaign_id"
        ).execute()


def _upsert_google_account(supabase: Client, user_id: str, payload: dict) -> None:
    """Crée ou met à jour la ligne connected_accounts provider='google' (1 par user).

    Tous les tokens Google (Ads + GA4) vivent ici, plus sur profiles.
    """
    existing = (
        supabase.table("connected_accounts")
        .select("id")
        .eq("user_id", user_id)
        .eq("provider", "google")
        .limit(1)
        .execute()
    )
    if existing.data:
        supabase.table("connected_accounts").update(payload).eq("id", existing.data[0]["id"]).execute()
    else:
        supabase.table("connected_accounts").insert(
            {"user_id": user_id, "provider": "google", "account_name": "Google", **payload}
        ).execute()


def update_google_refresh_token(supabase: Client, user_id: str, refresh_token: str, customer_id: str | None = None) -> None:
    """Stocke le refresh_token OAuth Google + le customer_id du compte sélectionné
    (connected_accounts, provider='google')."""
    payload = {"google_refresh_token": refresh_token}
    if customer_id:
        payload["google_customer_id"] = str(customer_id)
    _upsert_google_account(supabase, user_id, payload)


# ── Google Analytics 4 (GA4) — helpers ────────────────────────────────────────

def update_ga4_property_id(supabase: Client, user_id: str, property_id: str | None) -> None:
    """Stocke le GA4 Property ID sélectionné (ex. 'properties/123456789')
    sur la ligne connected_accounts provider='google'."""
    _upsert_google_account(
        supabase, user_id,
        {"ga4_property_id": str(property_id) if property_id else None},
    )


def upsert_ga4_insights(supabase: Client, user_id: str, rows: list[dict]) -> None:
    """Upsert ga4_insights.
    Chaque row : date (YYYY-MM-DD), source, medium, campaign (utm), sessions,
    conversions, revenue. Conflict (user_id, date, source, medium, campaign).
    Fallback ancien schéma (sans campaign) si la migration ga4_events.sql
    n'est pas encore passée.
    """
    if not rows:
        return
    seen = set()
    records = []
    for r in rows:
        key = (r.get("date"), r.get("source", ""), r.get("medium", ""), r.get("campaign", ""))
        if key in seen:
            continue
        seen.add(key)
        records.append({
            "user_id":     user_id,
            "date":        r.get("date"),
            "source":      r.get("source", "") or "",
            "medium":      r.get("medium", "") or "",
            "campaign":    r.get("campaign", "") or "",
            "sessions":    int(r.get("sessions") or 0),
            "conversions": float(r.get("conversions") or 0),
            "revenue":     float(r.get("revenue") or 0),
        })
    try:
        supabase.table("ga4_insights").upsert(
            records, on_conflict="user_id,date,source,medium,campaign"
        ).execute()
    except Exception:
        # Ancien schéma : pas de colonne campaign → on agrège par (source, medium)
        legacy: dict = {}
        for rec in records:
            k = (rec["date"], rec["source"], rec["medium"])
            cur = legacy.setdefault(k, {**rec})
            if cur is not rec:
                cur["sessions"] += rec["sessions"]
                cur["conversions"] += rec["conversions"]
                cur["revenue"] += rec["revenue"]
        for rec in legacy.values():
            rec.pop("campaign", None)
        supabase.table("ga4_insights").upsert(
            list(legacy.values()), on_conflict="user_id,date,source,medium"
        ).execute()


def upsert_ga4_events(supabase: Client, user_id: str, rows: list[dict]) -> None:
    """Upsert ga4_events (funnel par événement × jour × source/medium/campagne).
    Conflict (user_id, date, source, medium, campaign, event_name).
    Silencieux si la table n'existe pas encore (migration non passée).
    """
    if not rows:
        return
    seen = set()
    records = []
    for r in rows:
        key = (r.get("date"), r.get("source", ""), r.get("medium", ""),
               r.get("campaign", ""), r.get("event_name", ""))
        if key in seen:
            continue
        seen.add(key)
        records.append({
            "user_id":     user_id,
            "date":        r.get("date"),
            "source":      r.get("source", "") or "",
            "medium":      r.get("medium", "") or "",
            "campaign":    r.get("campaign", "") or "",
            "event_name":  r.get("event_name", "") or "",
            "event_count": int(r.get("event_count") or 0),
            "event_value": float(r.get("event_value") or 0),
        })
    supabase.table("ga4_events").upsert(
        records, on_conflict="user_id,date,source,medium,campaign,event_name"
    ).execute()


# Ce que PostgREST répond quand la colonne visée n'existe pas. Deux codes, et
# ils ne veulent pas dire la même chose :
#  · PGRST204 — « Could not find the '<col>' column of '<table>' in the schema
#    cache ». C'est PostgREST qui refuse AVANT d'envoyer quoi que ce soit à
#    Postgres, sur la foi de son cache de schéma. C'est le code qu'on voit quand
#    la migration n'a jamais été jouée.
#  · 42703 — `undefined_column`, le code SQLSTATE de Postgres lui-même
#    (postgresql.org/docs/current/errcodes-appendix.html). C'est celui qui sort
#    quand le cache de PostgREST est en avance sur la base réelle.
# Les deux se traduisent par la même phrase pour David : la migration n'est pas
# passée. Mais il faut les distinguer de TOUT LE RESTE — un réseau coupé, une
# clé expirée, un jsonb trop gros — qui n'a rien à voir et qui se réparait
# jusqu'ici en silence, c'est-à-dire jamais.
_COLONNE_ABSENTE = ("PGRST204", "42703")


def upsert_ga4_event_catalog(supabase: Client, user_id: str, evenements: list[dict],
                             maj: str) -> str | None:
    """Remplace le catalogue des événements GA4 de la propriété.

    ON REMPLACE, ON NE FUSIONNE PAS : le catalogue dit ce que la propriété émet
    AUJOURD'HUI. Fusionner ferait survivre à l'écran un événement retiré du site
    il y a six mois, que le client pourrait encore cocher — et qui ne
    remonterait jamais aucune ligne.

    NE LÈVE JAMAIS, MAIS NE SE TAIT PLUS. La récolte ne doit pas échouer pour un
    cache — c'était déjà la règle, et elle ne change pas. Ce qui change, c'est
    qu'un `except: pass` rendait l'échec INVISIBLE : une colonne absente, et la
    récolte annonçait « terminé » sans avoir rien écrit. Le retour porte
    désormais la raison, en clair, pour que l'appelant la journalise.

    Returns: None si le catalogue a bien été écrit, sinon la phrase à afficher.
    """
    try:
        res = (
            supabase.table("profiles")
            .update({"ga4_event_catalog": {"maj": maj, "evenements": evenements or []}})
            .eq("id", user_id)
            .execute()
        )
    except Exception as e:
        code = str(getattr(e, "code", "") or "")
        # supabase-py n'expose pas `code` sur toutes les versions : le message
        # porte alors le code en clair. On regarde les deux plutôt que de faire
        # confiance à l'attribut.
        texte = str(e)
        if code in _COLONNE_ABSENTE or any(c in texte for c in _COLONNE_ABSENTE):
            return ("catalogue NON écrit : la colonne profiles.ga4_event_catalog "
                    "n'existe pas — la migration supabase/migrations/"
                    "000_run_me_all.sql n'a pas été jouée sur cette base")
        return f"catalogue NON écrit : {texte}"

    # UN UPDATE QUI NE TOUCHE AUCUNE LIGNE NE LÈVE PAS. C'est le piège RLS
    # documenté dans CLAUDE.md : une politique qui refuse l'écriture ne renvoie
    # pas d'erreur, elle renvoie zéro ligne. Le worker passe par la clé service
    # et ne devrait jamais tomber ici ; l'ancien chemin Streamlit, lui, écrivait
    # sous la session de l'utilisateur — et un refus y était parfaitement muet.
    if not (getattr(res, "data", None) or []):
        return ("catalogue NON écrit : aucune ligne profiles touchée pour cet "
                "utilisateur (ligne absente, ou écriture refusée par RLS)")
    return None


# ── Boucle de feedback (rapport hebdo) — helpers ──────────────────────────────

def update_objectif(supabase: Client, user_id: str, objectif: str | None) -> None:
    """Stocke l'objectif principal du compte ('ventes'|'notoriete'|'engagement'|None)."""
    supabase.table("profiles").update(
        {"objectif": objectif or None}
    ).eq("id", user_id).execute()


def save_user_profile(supabase: Client, user_id: str, profile_text: str | None) -> None:
    """Stocke le persona utilisateur dérivé par l'IA (profiles.user_profile)."""
    from datetime import datetime, timezone
    supabase.table("profiles").update(
        {
            "user_profile": (profile_text or "").strip() or None,
            "user_profile_updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", user_id).execute()


# CE QU'EST DEVENU L'EMAIL HEBDO (ticket 50). Deux écritures, à une semaine
# d'écart : l'envoi au moment où il part, l'événement au passage suivant du
# worker. Elles restent séparées parce que la seconde ne doit jamais pouvoir
# réécrire la première — `maj_evenement_email` fait un `update`, pas un upsert,
# donc un relevé arrivé sur une ligne disparue ne ressuscite pas un envoi.
def upsert_envoi_email(supabase: Client, user_id: str, week_start_iso: str,
                       envoi: dict) -> None:
    """Range l'envoi hebdo — `envoi` est le dict rendu par `send_email`.

    UNE LIGNE EST ÉCRITE MÊME EN DRY-RUN ET MÊME EN ÉCHEC, et c'est le point.
    Sans elle, une semaine où rien n'est parti serait indiscernable d'une
    semaine où le client n'a pas ouvert — on conclurait « il ignore ses emails »
    sur un email qui n'a jamais quitté la machine (`CLAUDE.md` §7).

    Ne lève jamais : l'email est parti, c'est le fait qui compte pour le
    client. Perdre sa trace ne doit pas faire échouer la publication du
    rapport qui vient de réussir.
    """
    from datetime import datetime, timezone
    try:
        supabase.table("email_envois").upsert(
            {
                "user_id": user_id,
                "week_start": week_start_iso,
                "fournisseur": envoi.get("provider") or "?",
                "message_id": envoi.get("id") or None,
                # UN DRY-RUN N'EST PAS UN ENVOI RÉUSSI. `send_email` rend
                # `ok: True` en mode `dry` — il veut dire « la fonction a fait
                # ce qu'on lui demandait », pas « l'email est parti ». Le
                # recopier tel quel ferait compter, dans un futur « quelles
                # semaines l'email est-il parti ? », une semaine où rien n'a
                # quitté la machine (`CLAUDE.md` §7).
                "envoi_ok": bool(envoi.get("ok")) and envoi.get("provider") != "dry",
                "envoye_a": datetime.now(timezone.utc).isoformat(),
                # Un nouvel envoi remplace la ligne de la semaine : le relevé de
                # l'envoi précédent ne vaut plus pour celui-ci.
                "dernier_evenement": None,
                "releve_a": None,
            },
            on_conflict="user_id,week_start",
        ).execute()
    except Exception as e:
        print(f"   (envoi email non rangé : {e})")


def maj_evenement_email(supabase: Client, user_id: str, week_start_iso: str,
                        evenement: str | None) -> None:
    """Range ce que le fournisseur a remonté sur cet envoi, tel quel.

    `releve_a` est posé MÊME QUAND `evenement` est None : « on a demandé et
    rien n'est venu » et « on n'a pas encore demandé » sont deux états
    différents, et les confondre ferait redemander chaque semaine un fait que
    le fournisseur ne rendra jamais.
    """
    from datetime import datetime, timezone
    try:
        res = (supabase.table("email_envois").update({
            "dernier_evenement": evenement or None,
            "releve_a": datetime.now(timezone.utc).isoformat(),
        }).eq("user_id", user_id).eq("week_start", week_start_iso).execute())
        # UN `update` QUI NE TOUCHE AUCUNE LIGNE NE LÈVE RIEN (`CLAUDE.md` §8).
        # Ici ce n'est pas un refus RLS — le worker écrit en service_role — mais
        # une ligne disparue entre l'envoi et le relevé. On le dit plutôt que de
        # laisser croire que le fait est rangé.
        if not res.data:
            print(f"   (relevé d'ouverture : aucune ligne {week_start_iso} à mettre "
                  f"à jour — l'envoi n'a jamais été rangé)")
    except Exception as e:
        print(f"   (relevé d'ouverture non rangé : {e})")
