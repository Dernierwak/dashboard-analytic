"""Worker hebdomadaire — récolte les données + envoie le rapport, sans personne connecté.

À brancher sur un cron (Railway cron / Supabase scheduled / GitHub Actions),
typiquement lundi 07:00. Tourne tout seul → c'est le « ça marche sans moi ».

Flux :
  1. lister les utilisateurs (Supabase) ayant un email + des comptes connectés
  2. pour chacun : charger ses données (Meta/Insta/GA4) sur la fenêtre 7 jours pleins
  3. calculer les conseils (core.reco_engine.build_recos)
  4. construire wins + à-faire, rendre l'email (emailing.render)
  5. envoyer (emailing.send)

État : la chaîne recos → rendu → envoi est RÉELLE et testable (voir __main__).
Le chargement Supabase multi-users est balisé TODO (besoin de la service key +
réutiliser les requêtes de `scripts/fetch_data.py`, déjà headless).
"""

from __future__ import annotations
import sys
from datetime import date, timedelta
from pathlib import Path

# Permet d'importer core/ et emailing/ quel que soit le cwd
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.reco_engine import build_recos          # noqa: E402
from emailing.render import build_email_html       # noqa: E402
from emailing.send import send_email               # noqa: E402


def build_wins_text(followers_delta: int, avg_engagement: float, ctr: float) -> str:
    """Synthèse déterministe de 'ce qui a marché' (fallback sans IA).
    Plus tard : remplaçable par un appel IA (même logique que `_call_gemini`
    dans `saas/worker/build_report.py`).
    """
    bits = []
    if followers_delta > 0:
        bits.append(f"+{followers_delta} abonnés cette semaine")
    if avg_engagement >= 3:
        bits.append(f"engagement à {avg_engagement:.1f}% (solide pour ta taille)")
    if ctr >= 2:
        bits.append(f"un CTR pub de {ctr:.1f}%")
    if not bits:
        return "Semaine calme — rien de marquant, mais rien qui dérape non plus."
    return "Bonne nouvelle : " + ", ".join(bits) + ". Continue dans cette direction."


def weekly_for_user(user: dict) -> dict:
    """Génère + envoie le rapport d'UN utilisateur à partir de données déjà chargées.

    user attend : email, account_name, df_camp, avg_ctr, df_insta, df_week_posts,
                  followers_current, followers_delta, avg_engagement, kpis, ga4, objectif, feedback, app_url
    """
    recos = build_recos(
        df_camp=user.get("df_camp"),
        avg_ctr=user.get("avg_ctr", 0.0),
        df_insta=user.get("df_insta"),
        df_week_posts=user.get("df_week_posts"),
        followers_current=user.get("followers_current", 0),
        ga4=user.get("ga4"),
        objectif=user.get("objectif"),
        feedback=user.get("feedback"),
    )
    todos = [{"title": r["title"], "channel": r["platform"]} for r in recos][:4]

    wins = user.get("wins_text") or build_wins_text(
        user.get("followers_delta", 0), user.get("avg_engagement", 0.0), user.get("avg_ctr", 0.0)
    )

    html = build_email_html(
        account_name=user.get("account_name", "—"),
        week_label=user.get("week_label", ""),
        kpis=user.get("kpis", {}),
        wins_text=wins,
        todos=todos,
        app_url=user.get("app_url", "#"),
    )
    return send_email(user["email"], "Ta semaine en bref", html)


def run() -> None:
    """Point d'entrée cron : itère tous les utilisateurs. (chargement Supabase = TODO)"""
    # TODO Phase 1 :
    #   from supabase import create_client
    #   sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    #   users = sb.table("profiles").select("id,email,...").execute().data
    #   pour chaque user : charger df_camp / df_insta / df_follows (mêmes requêtes que
    #   scripts/fetch_data.py), calculer la fenêtre 7 jours pleins, puis weekly_for_user(...)
    raise NotImplementedError("Chargement Supabase multi-users à câbler (Phase 1).")


# ── Démo de bout en bout (recos → email → envoi dry-run) ──────────────────────
if __name__ == "__main__":
    import pandas as pd

    today = date.today()
    last_full_day = today - timedelta(days=1)
    cur_since = last_full_day - timedelta(days=6)

    df_camp = pd.DataFrame({
        "campaign_name": ["BW_Frühling", "Branding", "Soldes"],
        "spend": [120.0, 30.0, 80.0], "clicks": [20, 60, 400],
        "impressions": [5000, 4000, 9000],
    })
    df_camp["ctr"] = df_camp["clicks"] / df_camp["impressions"] * 100
    df_camp["cpc"] = df_camp["spend"] / df_camp["clicks"]

    demo_user = {
        "email": "pilote@exemple.ch",
        "account_name": "Boulangerie Demo",
        "week_label": f"Semaine {today.isocalendar()[1]} · jusqu'au {last_full_day:%d.%m}",
        "df_camp": df_camp,
        "avg_ctr": 1.8,
        "followers_current": 1000,
        "followers_delta": 119,
        "avg_engagement": 6.0,
        "kpis": {"spend": "CHF 465", "clicks": "3 342", "ctr_sub": "CTR 3.59%", "followers": "+119"},
        "objectif": "ventes",
        "feedback": {},
        "app_url": "https://app.ton-domaine.ch/rapport",
    }

    result = weekly_for_user(demo_user)
    print("Résultat envoi :", result)
    # Écrit aussi un aperçu HTML pour l'ouvrir dans un navigateur
    preview = build_email_html(
        demo_user["account_name"], demo_user["week_label"], demo_user["kpis"],
        build_wins_text(119, 6.0, 3.59),
        [{"title": "« BW_Frühling » coûte plus que tes autres campagnes", "channel": "meta"},
         {"title": "Connecte Google Analytics pour juger le vrai retour", "channel": "google"},
         {"title": "Ton meilleur créneau : jeudi entre 16-19h", "channel": "instagram"}],
        demo_user["app_url"],
    )
    Path(__file__).resolve().parent.joinpath("_preview.html").write_text(preview, encoding="utf-8")
    print("Aperçu écrit : saas/worker/_preview.html (ouvre-le dans un navigateur)")
