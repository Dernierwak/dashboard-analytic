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


def upsert_meta_ads(supabase: Client, user_id: str, rows: list[dict], complet: bool = True):
    """Upsert des données Meta Ads dans meta_ads_insights.
    Conflict sur (user_id, date_start, ad_id) — une ligne par pub par jour.

    `complet` : True SEULEMENT si `rows` couvre la plage demandée EN ENTIER,
    sans page perdue en cours de route (voir `_meta_chunk`,
    saas/worker/fetch_all.py). Détermine si le DELETE de nettoyage (point 1
    ci-dessous) peut avoir lieu sans risque — voir ce point pour le pourquoi.

    `ad_id` est l'identifiant Meta VRAIMENT unique d'une annonce. `ad_name` ne
    l'est pas : deux annonces DISTINCTES peuvent porter le même nom dans la
    même campagne, rien ne l'interdit dans Meta Ads Manager — constaté en
    conditions réelles, campagne BW_Sommer_Traffic_2026, deux annonces
    "fr_awarness" avec des ad_id différents. Dédupliquer/upserter sur ad_name
    faisait donc écraser silencieusement l'une des deux par l'autre à chaque
    récolte (TASK-018 : ~17€ de dépense réelle perdue le 19/08, ~15€ le 20/08
    sur le compte de test — absente de la base alors que l'API la renvoie).

    DEUX PIÈGES TROUVÉS À LA RELECTURE DU PREMIER CORRECTIF — les deux se
    seraient traduits par de la donnée fausse, pas juste perdue :

    1. LE DOUBLE COMPTAGE SUR LA FENÊTRE DE RECOUVREMENT. La migration qui
       ajoute la colonne (meta_ads_ad_id.sql) laisse les lignes déjà en base
       avec `ad_id IS NULL` — c'est volontaire, NULL n'entre jamais en
       conflit avec une contrainte UNIQUE, donc l'ALTER passe. Mais ça veut
       dire aussi que quand la récolte SUIVANTE réécrit ces mêmes jours
       (`_RECOUVREMENT_JOURS_META = 7` jours, saas/worker/fetch_all.py) avec
       un ad_id RÉEL cette fois, l'upsert n'entre PAS en conflit avec la
       vieille ligne NULL : Postgres INSÈRE une seconde ligne au lieu de
       remplacer la première, et la dépense de ces jours serait comptée DEUX
       FOIS — indéfiniment, rien ne la nettoierait jamais. D'où le DELETE
       explicite plus bas, AVANT l'upsert : il retire, pour CET utilisateur
       et pour les dates EXACTEMENT couvertes par CE lot, toute ligne
       `ad_id IS NULL` qui y traînerait encore. Ce n'est sûr QUE SI la plage
       est effectivement redemandée et réécrite EN ENTIER (voir le
       commentaire de `_depart_recolte` dans fetch_all.py) : toute annonce
       ayant dépensé un de ces jours doit ressortir dans `rows` pour être
       réinsérée juste après avec son ad_id. C'EST TOUT L'INTÉRÊT DU
       PARAMÈTRE `complet` — relu par le checker sur le premier jet de ce
       correctif : `_meta_chunk` peut se tronquer en silence (erreur réseau
       en cours de pagination, ou Meta qui répond un JSON d'erreur plutôt
       qu'une page — ce dernier cas n'a NI exception NI `paging.next`, donc
       ressemble à une fin de pagination normale). Sans le signaler, le
       DELETE supprimerait les lignes héritées d'un jour dont on n'a reçu
       qu'une partie de la dépense, et l'upsert n'en réinsérerait qu'une
       partie : une perte de dépense réelle, exactement le bug que cette
       tâche doit supprimer. `complet=False` fait donc N'ÉCRIRE STRICTEMENT
       RIEN (ni DELETE ni upsert, la fonction retourne immédiatement) : les
       lignes historiques restent ce qu'elles étaient, `latest` n'avance pas
       côté appelant, et le passage suivant retentera naturellement la même
       plage jusqu'à obtenir une récolte complète. Les dates plus anciennes
       que la fenêtre de recouvrement ne sont, elles, jamais retouchées :
       leurs lignes NULL historiques restent seules, sans doublon possible
       puisque plus jamais réécrites.

    2. ad_id ABSENT OU VIDE DANS LA RÉPONSE DE L'API. Meta documente ad_id
       comme toujours présent au niveau `level=ad`
       (developers.facebook.com/docs/marketing-api/insights/), donc ce cas ne
       DEVRAIT jamais survenir — mais « ne devrait jamais » n'est pas une
       garantie testée. `row.get("ad_id", "")` renvoie None (pas "") si la clé
       existe avec une valeur null — un str() direct dessus écrirait la chaîne
       littérale "None" en base. Et une clé de dédup vide/commune pour toutes
       les lignes sans ad_id d'un même jour écraserait ces annonces les unes
       sur les autres — pire que le bug d'origine. Donc : si ad_id manque, la
       ligne n'est PAS écartée (ad_id reste NULL, jamais "None"), PAS
       dédupliquée sur une clé vide (on la garde telle quelle), et le fait est
       signalé bruyamment dans les logs du worker. Le DELETE du point 1
       ci-dessus nettoie aussi ces lignes-orphelines à chaque passage suivant
       sur la même fenêtre : elles ne s'accumulent donc pas semaine après
       semaine si le cas venait à se répéter.
    """
    if not rows:
        return

    seen = set()
    records = []
    orphelins = 0
    for row in rows:
        brut = row.get("ad_id")
        ad_id = str(brut).strip() if brut not in (None, "") else ""
        date_start = row.get("date_start")

        base = {
            "user_id": user_id,
            "date_start": date_start,
            "campaign_name": row.get("campaign_name", ""),
            "adset_name": row.get("adset_name", ""),
            "ad_name": row.get("ad_name", ""),
            "impressions": int(row.get("impressions") or 0),
            "clicks": int(row.get("clicks") or 0),
            "reach": int(row.get("reach") or 0) if row.get("reach") is not None else None,
            "link_clicks": int(row.get("link_clicks") or 0) if row.get("link_clicks") is not None else None,
            "spend": float(row.get("spend") or 0),
        }

        if not ad_id:
            # Pas de clé fiable pour dédupliquer cette ligne : on la GARDE
            # toujours, jamais de perte silencieuse (voir docstring, point 2).
            orphelins += 1
            records.append({**base, "ad_id": None})
            continue

        key = (date_start, ad_id)
        if key in seen:
            continue
        seen.add(key)
        records.append({**base, "ad_id": ad_id})

    if orphelins:
        print(f"    meta: {orphelins} ligne(s) reçues sans ad_id — écrites "
              f"quand même (ad_id NULL), voir upsert_meta_ads (TASK-018).")

    if not records:
        return

    # Voir le point 1 de la docstring : sans ce DELETE, réécrire une fenêtre
    # déjà connue avec les VRAIS ad_id compterait la dépense en double, la
    # vieille ligne (ad_id NULL) et la nouvelle (ad_id réel) n'étant jamais en
    # conflit l'une avec l'autre. Portée strictement bornée à CET utilisateur
    # et aux dates de CE lot — jamais un DELETE large.
    #
    # `complet` est le garde-fou : si la récolte qui a produit `rows` a été
    # tronquée en cours de route, ON NE SAIT PAS que toutes les annonces de
    # ces dates sont bien dans `records` — ni supprimer les lignes héritées
    # (on purgerait une dépense qu'on n'a que partiellement réinsérée), ni
    # upserter ce lot partiel (les lignes reçues, avec leur ad_id réel,
    # s'écriraient À CÔTÉ des lignes héritées ad_id NULL non supprimées :
    # double comptage permanent sur cette fenêtre). Donc : si `complet` est
    # faux, on n'écrit RIEN — ni DELETE ni upsert. `latest` en base n'avance
    # pas côté appelant, et le passage suivant retentera naturellement la
    # même plage jusqu'à obtenir une récolte complète.
    if not complet:
        print(f"    meta: récolte tronquée pour {user_id} — aucune écriture "
              f"ce passage (ni DELETE ni upsert), la plage sera retentée au "
              f"prochain passage (voir upsert_meta_ads).")
        return

    dates = sorted({r["date_start"] for r in records if r.get("date_start")})
    if dates:
        supabase.table("meta_ads_insights").delete() \
            .eq("user_id", user_id).in_("date_start", dates) \
            .is_("ad_id", "null").execute()

    supabase.table("meta_ads_insights").upsert(
        records,
        on_conflict="user_id,date_start,ad_id"
    ).execute()


# ── Tab Coût — labels & budgets ────────────────────────────────────────────────

def update_campaign_labels(supabase: Client, user_id: str, labels: list[str]) -> None:
    """Master list UNIFIÉE des labels → profiles.labels (partagée Meta/Google/Instagram)."""
    update_labels(supabase, user_id, labels)


def update_labels(supabase: Client, user_id: str, labels: list[str]) -> None:
    """Écrit la liste maîtresse unique des labels (profiles.labels)."""
    clean = sorted({str(l).strip() for l in labels if str(l).strip()})
    supabase.table("profiles").update({"labels": clean}).eq("id", user_id).execute()


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
    label: str | None = None,
    budget_max: float | None = None,
    effective_status: str | None = None,
) -> None:
    """Upsert ligne meta_campaign_config. Met à jour seulement les champs fournis."""
    payload: dict = {"user_id": user_id, "campaign_name": campaign_name}
    if label is not None:
        payload["label"] = label if label else None
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

    `rows` : la sortie de google_script.fetch_google_ads.fetch_campaign_budgets
    ou de meta_script.fetch_meta_ads.fetch_campaign_budgets.
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


def rename_campaign_label(supabase: Client, user_id: str, old_label: str, new_label: str) -> None:
    """Renomme un label dans toutes les lignes meta_campaign_config de l'utilisateur."""
    supabase.table("meta_campaign_config").update({"label": new_label}).eq("user_id", user_id).eq("label", old_label).execute()


def clear_campaign_label(supabase: Client, user_id: str, label: str) -> None:
    """Met à NULL le label dans meta_campaign_config (utilisé quand on supprime un label)."""
    supabase.table("meta_campaign_config").update({"label": None}).eq("user_id", user_id).eq("label", label).execute()


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


def update_google_campaign_labels(supabase: Client, user_id: str, labels: list[str]) -> None:
    """Master list UNIFIÉE → profiles.labels (partagée Meta/Google/Instagram)."""
    update_labels(supabase, user_id, labels)


def update_google_budget_global(supabase: Client, user_id: str, value: float) -> None:
    supabase.table("profiles").update({"google_budget_global": float(value or 0)}).eq("id", user_id).execute()


def upsert_google_campaign_config(
    supabase: Client,
    user_id: str,
    campaign_id: str,
    *,
    campaign_name: str | None = None,
    label: str | None = None,
    budget_max: float | None = None,
    effective_status: str | None = None,
) -> None:
    payload: dict = {"user_id": user_id, "campaign_id": str(campaign_id)}
    if campaign_name is not None:
        payload["campaign_name"] = campaign_name
    if label is not None:
        payload["label"] = label if label else None
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


def rename_google_campaign_label(supabase: Client, user_id: str, old: str, new: str) -> None:
    supabase.table("google_campaign_config").update({"label": new}).eq("user_id", user_id).eq("label", old).execute()


def clear_google_campaign_label(supabase: Client, user_id: str, label: str) -> None:
    supabase.table("google_campaign_config").update({"label": None}).eq("user_id", user_id).eq("label", label).execute()


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

    Le choix du client, lui, n'est pas touché : il vit dans `theme_ga4_events`
    et un événement disparu du catalogue y reste coché. C'est voulu — l'écran
    le signale plutôt que de décocher tout seul un réglage qu'on n'a pas posé.

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


def save_reco_feedback(
    supabase: Client, user_id: str, reco_key: str, reaction: str, week_start: str
) -> None:
    """Enregistre/écrase la réaction d'un conseil pour la semaine donnée.
    reaction : 'useful' | 'not_for_me' | 'done'. week_start : lundi (YYYY-MM-DD).
    """
    supabase.table("reco_feedback").upsert(
        {
            "user_id": user_id,
            "reco_key": str(reco_key),
            "reaction": str(reaction),
            "week_start": week_start,
        },
        on_conflict="user_id,reco_key,week_start",
    ).execute()


def save_reco_comment(
    supabase: Client, user_id: str, reco_key: str, week_start: str, comment: str | None
) -> None:
    """Enregistre/écrase le commentaire libre d'un conseil pour la semaine donnée.

    L'upsert ne touche QUE la colonne comment → ne pas écraser une réaction déjà
    posée. Un commentaire peut exister sans réaction (reaction est nullable).
    Ces commentaires alimentent le persona utilisateur ([[comment-profil-user-ia]]).
    """
    supabase.table("reco_feedback").upsert(
        {
            "user_id": user_id,
            "reco_key": str(reco_key),
            "week_start": week_start,
            "comment": (comment or "").strip() or None,
        },
        on_conflict="user_id,reco_key,week_start",
    ).execute()


def save_user_profile(supabase: Client, user_id: str, profile_text: str | None) -> None:
    """Stocke le persona utilisateur dérivé par l'IA (profiles.user_profile)."""
    from datetime import datetime, timezone
    supabase.table("profiles").update(
        {
            "user_profile": (profile_text or "").strip() or None,
            "user_profile_updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", user_id).execute()
