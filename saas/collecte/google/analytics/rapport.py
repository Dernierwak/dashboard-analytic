"""Google Analytics 4 — les deux API REST, et le numéro de propriété.

Réutilise l'OAuth Google déjà en place (même refresh_token que Google Ads),
à condition que le consent inclue le scope `analytics.readonly`
(demandé dans `google/auth/oauth.py`).

Deux API :
  - Admin API  : lister les propriétés GA4 accessibles
      GET https://analyticsadmin.googleapis.com/v1beta/accountSummaries
  - Data API   : lire les métriques par jour × source/medium
      POST https://analyticsdata.googleapis.com/v1beta/properties/{id}:runReport

⚠ Pré-requis côté Google Cloud (une fois) :
  - activer "Google Analytics Admin API" + "Google Analytics Data API"
  - ajouter le scope analytics.readonly à l'écran de consentement OAuth

Aucun developer-token ici (c'est spécifique à Google Ads).
"""

ADMIN_BASE = "https://analyticsadmin.googleapis.com/v1beta"
DATA_BASE = "https://analyticsdata.googleapis.com/v1beta"


def numero_propriete(property_id: str) -> str:
    """Normalise 'properties/123' ou '123' → '123'."""
    return str(property_id or "").split("/")[-1].strip()


