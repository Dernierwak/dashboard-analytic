"""Les données sources que Meta et Google partagent."""
from __future__ import annotations

from supabase import Client

from saas.data.fetch_data.shared.http_client import sans_jeton


def photo_budget(sb, uid, canal: str, recolte, jour) -> None:
    """Photographie le budget PLANIFIÉ du canal. Best-effort, JAMAIS bloquant.

    Un budget manquant coûte une case vide sur la page Coûts ; un budget qui
    fait échouer la récolte coûte une semaine entière d'insights. C'est pour ça
    que tout est attrapé ici plutôt que remonté à l'appelant.

    `recolte()` rend (lignes, trous) — trous : une liste de messages.
    """
    try:
        rows, trous = recolte()
        if rows:
            upsert_platform_budgets(sb, uid, canal, rows, jour.isoformat())
        elif trous:
            print(f"    budgets {canal} ignorés : {sans_jeton(' | '.join(map(str, trous)))}")
    except Exception as e:
        print(f"    budgets {canal} KO : {sans_jeton(str(e))}")


def journal_changements(sb, uid, canal: str, recolte) -> None:
    """Le journal des changements déclarés. Best-effort, JAMAIS bloquant —
    même raison que `photo_budget` : le fil se passe d'une ligne, pas la
    récolte d'une semaine d'insights.

    `recolte()` rend (lignes, trous).
    """
    try:
        rows, trous = recolte()
        if rows:
            upsert_platform_changes(sb, uid, canal, rows)
        elif trous:
            print(f"    changements {canal} ignorés : {sans_jeton(' | '.join(map(str, trous)))}")
    except Exception as e:
        print(f"    changements {canal} KO : {sans_jeton(str(e))}")


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
    ou de `fetch_data/sources/meta/ads/budgets.py` (`recuperer`).
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
                "saas/data/supabase/migrations/000_run_me_all.sql"
            ) from e
        raise


# ── Changements DÉCLARÉS par les plateformes — platform_changes ───────────────

def lots_sans_effacer_la_campagne(records: list[dict]) -> list[list[dict]]:
    """Range les changements en lots qui n'écrasent rien : rattachés à une
    campagne d'un côté, non rattachés de l'autre, et un lot par jeu de clés.

    Chaque passage relit tout le journal (180 jours chez Meta) et l'upsert
    réécrit chaque colonne envoyée. Un groupe d'annonces dont la campagne ne se retrouve
    plus ce jour-là (insights rejoués, compte reconnecté) remettrait donc à
    NULL un rattachement déjà acquis. Le lot sans campagne n'envoie pas ces
    colonnes : PostgREST ne met à jour que celles qu'il reçoit.
    """
    avec = [r for r in records if r.get("campaign_id")]
    sans = [{k: v for k, v in r.items() if k not in ("campaign_id", "campaign_name")}
            for r in records if not r.get("campaign_id")]
    # Même raison pour `fuseau` (ticket 17 de `.scratch/meta-ads/`) : PostgREST
    # écrit NULL pour une clé absente d'une ligne mais présente dans le lot.
    # Chaque lot n'a donc qu'un seul jeu de clés.
    lots: dict[frozenset, list[dict]] = {}
    for r in avec + sans:
        lots.setdefault(frozenset(r), []).append(r)
    return list(lots.values())


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
            # Seulement s'il est connu : un NULL envoyé effacerait le fuseau
            # déjà écrit (même raison que `lots_sans_effacer_la_campagne`).
            **({"fuseau": r["fuseau"]} if r.get("fuseau") else {}),
        })
    if not records:
        return
    try:
        for lot in lots_sans_effacer_la_campagne(records):
            supabase.table("platform_changes").upsert(
                lot, on_conflict="user_id,channel,change_id"
            ).execute()
    except Exception as e:
        if _table_absente(e, "platform_changes"):
            raise RuntimeError(
                "table platform_changes absente — lance "
                "saas/data/supabase/migrations/000_run_me_all.sql"
            ) from e
        raise
