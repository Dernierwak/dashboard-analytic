"""Envoi d'email — agnostique du fournisseur (Resend par défaut).

Brancher un provider = variables d'environnement, sans toucher le code :
  EMAIL_PROVIDER = "resend"  (défaut) | "dry"  (n'envoie rien, log seulement)
  RESEND_API_KEY = "re_..."          (clé Resend)
  EMAIL_FROM     = "rapport@ton-domaine.ch"

Si aucune clé n'est configurée → mode "dry" automatique : on log au lieu d'envoyer,
pour pouvoir tout tester sans compte ni risque.
"""

import os
import requests


def _provider() -> str:
    p = os.getenv("EMAIL_PROVIDER", "").strip().lower()
    if p:
        return p
    # Auto : resend si une clé est là, sinon dry-run
    return "resend" if os.getenv("RESEND_API_KEY") else "dry"


def send_email(to: str, subject: str, html: str) -> dict:
    """Envoie un email. Retourne {ok: bool, provider: str, detail: str}."""
    provider = _provider()
    sender = os.getenv("EMAIL_FROM", "rapport@example.com")

    if provider == "dry":
        print(f"[dry-run] → {to} | {subject} | {len(html)} octets HTML (aucun envoi réel)")
        return {"ok": True, "provider": "dry", "detail": "non envoyé (mode test)"}

    if provider == "resend":
        api_key = os.getenv("RESEND_API_KEY")
        if not api_key:
            return {"ok": False, "provider": "resend", "detail": "RESEND_API_KEY manquante"}
        try:
            r = requests.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {api_key}",
                         "Content-Type": "application/json"},
                json={"from": sender, "to": [to], "subject": subject, "html": html},
                timeout=20,
            )
            if r.status_code in (200, 201):
                return {"ok": True, "provider": "resend", "detail": r.json().get("id", "")}
            return {"ok": False, "provider": "resend", "detail": f"HTTP {r.status_code}: {r.text[:200]}"}
        except Exception as e:
            return {"ok": False, "provider": "resend", "detail": str(e)}

    return {"ok": False, "provider": provider, "detail": f"provider inconnu: {provider}"}
