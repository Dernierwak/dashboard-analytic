"""Labels unifiés — opérations cross-canal (Meta + Google + Instagram).

La liste maîtresse vit dans profiles.labels. Les assignations vivent par canal :
  - Meta   : meta_campaign_config.label
  - Google : google_campaign_config.label
  - Insta  : instagram_organic_posts.labels (tableau)

Renommer / supprimer un label se propage partout pour rester cohérent.
"""

from saas.collecte.commun.fetch_data import fetch_labels
from saas.collecte.commun.insert_data import (
    update_labels,
    rename_campaign_label, clear_campaign_label,
    rename_google_campaign_label, clear_google_campaign_label,
)


# ── Création ──────────────────────────────────────────────────────────────────

def add_label(client, user_id: str, name: str) -> tuple[bool, str]:
    """Ajoute un label à la liste maîtresse. Retourne (ok, message)."""
    name = (name or "").strip()
    if not name:
        return False, "Nom vide."
    current = fetch_labels(client, user_id)
    if name in current:
        return False, f"« {name} » existe déjà."
    update_labels(client, user_id, current + [name])
    return True, f"« {name} » créé."


# ── Renommage (propagé partout) ───────────────────────────────────────────────

def rename_label_everywhere(client, user_id: str, old: str, new: str) -> tuple[bool, str]:
    new = (new or "").strip()
    if not new:
        return False, "Nouveau nom vide."
    if old == new:
        return True, ""
    current = fetch_labels(client, user_id)
    if new in current:
        return False, f"« {new} » existe déjà."
    # 1) liste maîtresse
    update_labels(client, user_id, [new if l == old else l for l in current])
    # 2) assignations par canal
    try:
        rename_campaign_label(client, user_id, old, new)
    except Exception:
        pass
    try:
        rename_google_campaign_label(client, user_id, old, new)
    except Exception:
        pass
    _rename_in_posts(client, user_id, old, new)
    return True, f"Renommé en « {new} » partout."


# ── Suppression (propagée partout) ────────────────────────────────────────────

def delete_label_everywhere(client, user_id: str, name: str) -> tuple[bool, str]:
    current = fetch_labels(client, user_id)
    update_labels(client, user_id, [l for l in current if l != name])
    try:
        clear_campaign_label(client, user_id, name)
    except Exception:
        pass
    try:
        clear_google_campaign_label(client, user_id, name)
    except Exception:
        pass
    _delete_in_posts(client, user_id, name)
    return True, f"« {name} » supprimé partout."


# ── Comptage d'usage par canal ────────────────────────────────────────────────

def label_usage_counts(client, user_id: str) -> dict[str, dict]:
    """Retourne {label: {"meta": n, "google": n, "instagram": n}}."""
    counts: dict[str, dict] = {}

    def _bump(label, channel):
        if not label:
            return
        counts.setdefault(label, {"meta": 0, "google": 0, "instagram": 0})
        counts[label][channel] += 1

    try:
        rows = client.table("meta_campaign_config").select("label").eq("user_id", user_id).execute().data
        for r in rows or []:
            _bump(r.get("label"), "meta")
    except Exception:
        pass
    try:
        rows = client.table("google_campaign_config").select("label").eq("user_id", user_id).execute().data
        for r in rows or []:
            _bump(r.get("label"), "google")
    except Exception:
        pass
    try:
        rows = client.table("instagram_organic_posts").select("labels").eq("user_id", user_id).execute().data
        for r in rows or []:
            for l in (r.get("labels") or []):
                _bump(l, "instagram")
    except Exception:
        pass
    return counts


# ── Helpers internes (posts Instagram) ────────────────────────────────────────

def _rename_in_posts(client, user_id: str, old: str, new: str) -> None:
    try:
        posts = (client.table("instagram_organic_posts").select("id,labels")
                 .eq("user_id", user_id).contains("labels", [old]).execute().data)
        for p in posts or []:
            updated = [new if l == old else l for l in (p.get("labels") or [])]
            client.table("instagram_organic_posts").update({"labels": updated}).eq("id", p["id"]).execute()
    except Exception:
        pass


def _delete_in_posts(client, user_id: str, name: str) -> None:
    try:
        posts = (client.table("instagram_organic_posts").select("id,labels")
                 .eq("user_id", user_id).contains("labels", [name]).execute().data)
        for p in posts or []:
            updated = [l for l in (p.get("labels") or []) if l != name]
            client.table("instagram_organic_posts").update({"labels": updated}).eq("id", p["id"]).execute()
    except Exception:
        pass
