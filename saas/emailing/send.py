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
    """Envoie un email. Rend {ok, provider, detail, id}.

    `id` EST L'IDENTIFIANT DU FOURNISSEUR, et il est rendu à part de `detail`
    depuis le ticket 50 : c'est le seul moyen de lui redemander, au passage
    suivant du worker, ce que l'email est devenu. Il vivait jusqu'ici dans
    `detail`, une chaîne destinée à un journal — la lire pour en extraire un
    identifiant aurait fait dépendre une clé de base d'un texte d'affichage.
    `None` quand il n'y a rien à relire : dry-run, ou envoi en échec.
    """
    provider = _provider()
    # Sans domaine vérifié chez Resend, seul onboarding@resend.dev est accepté
    # (et uniquement vers l'email du compte Resend). Avec un domaine vérifié :
    # EMAIL_FROM="Pulse <rapport@ton-domaine.ch>".
    sender = os.getenv("EMAIL_FROM") or "Pulse <onboarding@resend.dev>"

    if provider == "dry":
        print(f"[dry-run] → {to} | {subject} | {len(html)} octets HTML (aucun envoi réel)")
        return {"ok": True, "provider": "dry", "detail": "non envoyé (mode test)", "id": None}

    if provider == "resend":
        api_key = os.getenv("RESEND_API_KEY")
        if not api_key:
            return {"ok": False, "provider": "resend",
                    "detail": "RESEND_API_KEY manquante", "id": None}
        try:
            r = requests.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {api_key}",
                         "Content-Type": "application/json"},
                json={"from": sender, "to": [to], "subject": subject, "html": html},
                timeout=20,
            )
            if r.status_code in (200, 201):
                envoi_id = r.json().get("id") or None
                return {"ok": True, "provider": "resend",
                        "detail": envoi_id or "", "id": envoi_id}
            return {"ok": False, "provider": "resend",
                    "detail": f"HTTP {r.status_code}: {r.text[:200]}", "id": None}
        except Exception as e:
            return {"ok": False, "provider": "resend", "detail": str(e), "id": None}

    return {"ok": False, "provider": provider,
            "detail": f"provider inconnu: {provider}", "id": None}
