"""Harnais du ticket 06, volet récolte : chaque catégorie que `_traduire_google`
émet figure dans `CE_QUE_PULSE_GARDE`, et la liste n'en annonce aucune que la
récolte n'émet pas — sinon la « ⓘ » de la Tendance mentirait dans un sens ou
dans l'autre.

Lancer depuis la racine du dépôt :
    python3.12 -I .scratch/google-ads/harnais/06-les-points-de-changement-et-le-panneau-du-jour/test_categories.py

Un événement `change_event` écrit à la main par branche de la traduction, sous
la forme REST (clés camelCase). Aucun réseau, aucun secret lu.
"""
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(RACINE))

from saas.data.fetch_data.sources.google.ads.fetchers import changes  # noqa: E402

ECHECS = []


def verifier(nom, obtenu, attendu):
    ok = obtenu == attendu
    print(("✓ " if ok else "✗ ") + nom + ("" if ok else f"\n    obtenu  : {obtenu!r}\n    attendu : {attendu!r}"))
    if not ok:
        ECHECS.append(nom)


def ev(typ, op="UPDATE", champs="", old=None, new=None):
    return {"changeResourceType": typ, "resourceChangeOperation": op, "changedFields": champs,
            "oldResource": old or {}, "newResource": new or {}}


EVENEMENTS = {
    "budget": ev("CAMPAIGN_BUDGET", champs="amountMicros",
                 old={"campaignBudget": {"amountMicros": "10000000"}},
                 new={"campaignBudget": {"amountMicros": "20000000"}}),
    "enchere": ev("CAMPAIGN", champs="biddingStrategyType"),
    "motcle": ev("AD_GROUP_CRITERION", op="CREATE",
                 new={"adGroupCriterion": {"keyword": {"text": "chaussures"}}}),
    "statut": ev("CAMPAIGN", champs="status", new={"campaign": {"status": "PAUSED"}}),
    "creatif": ev("ASSET", op="CREATE", new={"asset": {"type": "CALLOUT", "calloutAsset": {"calloutText": "Livraison"}}}),
    "autre": ev("CAMPAIGN", op="CREATE", new={"campaign": {"name": "Nouvelle"}}),
}

for attendue, e in EVENEMENTS.items():
    traduit = changes._traduire_google(e, "Search marque")
    verifier(f"{attendue} : émise par la traduction", traduit and traduit[0], attendue)

verifier("la liste gardée = les catégories émises, ni plus ni moins",
         sorted(changes.CE_QUE_PULSE_GARDE), sorted(EVENEMENTS))

# Ce que la ⓘ dit NE PAS couvrir n'est réellement pas écrit.
verifier("un ciblage par âge n'est pas gardé",
         changes._traduire_google(ev("AD_GROUP_CRITERION", op="CREATE",
                                     new={"adGroupCriterion": {"ageRange": {"type": "AGE_RANGE_25_34"}}}), "S"), None)
verifier("le contenu d'une annonce modifié n'est pas gardé",
         changes._traduire_google(ev("AD_GROUP_AD", op="UPDATE", champs="ad.finalUrls"), "S"), None)

# Toute catégorie émise doit être acceptée par le CHECK de la base.
schema = (RACINE / "saas/data/supabase/migrations/000_run_me_all.sql").read_text(encoding="utf8")
for cat in changes.CE_QUE_PULSE_GARDE:
    verifier(f"{cat} : acceptée par le CHECK de platform_changes", f"'{cat}'" in schema, True)

print("TOUT EST VERT" if not ECHECS else f"{len(ECHECS)} ÉCHEC(S)")
sys.exit(1 if ECHECS else 0)
