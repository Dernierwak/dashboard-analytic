"""Rendre le dépôt lisible depuis ce dossier — rien n'est installé, rien n'est
importé de `saas/` ici : ce harnais lit du texte et exécute du JavaScript."""
from pathlib import Path

RACINE = Path(__file__).resolve().parents[4]

SOURCE_RAPPORT = RACINE / "saas" / "traitement" / "build_report.py"

WEB = RACINE / "saas" / "web"
SOURCE_PAGE = WEB / "app" / "page.tsx"
SOURCE_REPORT_TS = WEB / "lib" / "report.ts"
SOURCE_A_FAIRE = WEB / "lib" / "a-faire.ts"
SOURCE_JOUR = WEB / "lib" / "jour-de-travail.ts"
SOURCE_TROIS_DATES = WEB / "components" / "trois-dates.tsx"
SOURCE_JOUR_RECOLTE = WEB / "components" / "jour-recolte.tsx"
SOURCE_RAIL = WEB / "components" / "rail-actions.tsx"


def lire(chemin):
    return chemin.read_text(encoding="utf-8")


def sans_commentaires(source: str) -> str:
    """Le CODE seul, commentaires retirés — `//`, `/* */` et `{/* */}` (JSX).

    Indispensable ici : ce ticket écrit noir sur blanc dans ses commentaires les
    mots qu'un écran n'a PAS le droit d'afficher (« périmé », « il y a … »), et
    il explique pourquoi un module n'a pas de directive `"use client"`. Chercher
    ces mots au grep ferait échouer le harnais sur la prose qui les interdit —
    le piège déjà vu au ticket 12 avec les pierres tombales.
    """
    import re
    source = re.sub(r"\{/\*.*?\*/\}", "", source, flags=re.S)
    source = re.sub(r"/\*.*?\*/", "", source, flags=re.S)
    source = re.sub(r"^\s*//.*$", "", source, flags=re.M)
    return source
