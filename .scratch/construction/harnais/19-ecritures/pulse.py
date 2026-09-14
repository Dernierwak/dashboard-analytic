"""Rendre le dépôt lisible depuis ce dossier — rien n'est installé, rien n'est
importé de `saas/` côté Python : ce harnais lit du TEXTE et exécute du
JavaScript (`lib/cascade.ts`, importé tel quel par `verifier_cascade.js`)."""
import re
from pathlib import Path

RACINE = Path(__file__).resolve().parents[4]
WEB = RACINE / "saas" / "web"

SOURCE_ACTIONS = WEB / "app" / "actions.ts"
SOURCE_CASCADE = WEB / "lib" / "cascade.ts"
SOURCE_EQUIPE = WEB / "components" / "equipe-manager.tsx"
SOURCE_OBJECTIF = WEB / "components" / "objectif-select.tsx"
SOURCE_BUDGET = WEB / "components" / "budget-editor.tsx"
SOURCE_LABELS = WEB / "components" / "label-manager.tsx"


def lire(chemin):
    return chemin.read_text(encoding="utf-8")


def sans_commentaires(source: str) -> str:
    """Le CODE seul — `//`, `/* */` et `{/* */}` (JSX).

    Vital pour CE ticket : les commentaires posés dans `actions.ts` CITENT les
    écritures nues qu'ils viennent de supprimer (« elles étaient nues :
    `await supabase…` »). Chercher ces formes au grep sur le fichier entier
    ferait échouer le harnais sur la prose qui explique la correction — le piège
    déjà payé aux harnais 12 et 13.
    """
    source = re.sub(r"\{/\*.*?\*/\}", "", source, flags=re.S)
    source = re.sub(r"/\*.*?\*/", "", source, flags=re.S)
    source = re.sub(r"^\s*//.*$", "", source, flags=re.M)
    return source


def corps(source: str, signature: str) -> str:
    """Le corps d'une fonction de haut niveau, de sa signature à l'accolade
    fermante en colonne 0. Les vérifications de ce ticket portent sur UNE
    fonction à la fois — « aucune écriture nue » n'a de sens que par fonction,
    pas sur un fichier de deux mille lignes."""
    debut = source.index(signature)
    fin = source.index("\n}\n", debut)
    return source[debut:fin]
