#!/usr/bin/env python3.12
"""Injecte dans PROJECT_STATUS.html le panneau « ce qui me dirige ».

Le panneau répond à une seule question : *que dois-je modifier pour améliorer
ce que le LLM sait faire ?* Il montre trois familles de fichiers :

  ① les ordres permanents      → CLAUDE.md          (appliqué à chaque conversation)
  ② les spécialistes           → .claude/agents/*.md et .claude/skills/*/SKILL.md
  ③ les documents de référence → docs/*.md          (l'archive du pourquoi)

RIEN ICI N'EST UN RÉSUMÉ ÉCRIT À LA MAIN. Tout ce qui s'affiche est lu dans les
fichiers au moment de l'exécution : titres, texte verbatim, numéros de ligne,
en-têtes YAML. Un résumé recopié serait une deuxième source de vérité, et une
deuxième source de vérité dérive. Si CLAUDE.md est périmé, le panneau doit le
montrer périmé — c'est précisément le signal recherché.

Même mécanique que scripts/build_project_history.py : le script remplace le
contenu entre deux marqueurs par une constante JavaScript, et le HTML reste un
fichier unique qu'on ouvre sans serveur. Relancer le script est idempotent.

    python3.12 scripts/build_llm_context.py


--------------------------------------------------------------------------
POURQUOI L'IDENTIFIANT D'UNE RÈGLE EST UN SLUG ET PAS UN NUMÉRO
--------------------------------------------------------------------------
David doit pouvoir dire « telle règle est mauvaise » sans la recopier. Il faut
donc un identifiant stable. Trois candidats :

  1. Le rang de lecture (1, 2, 3…).
     Rejeté. Insérer une règle en tête décale toutes les suivantes : « la règle
     4 » désignera demain une AUTRE règle, en silence, et le LLM corrigera la
     mauvaise. C'est exactement la classe de bug qui a déjà mordu ce dépôt.

  2. Une empreinte du texte de la règle (hash).
     Rejeté. Stable au déplacement, mais illisible, et il change dès qu'on
     reformule un mot — alors que la règle, elle, n'a pas changé de nature.

  3. Le slug du titre de la section qui porte la règle.  ← RETENU
     Il survit au déplacement de la section et à la réécriture de son contenu
     (même règle, éditée → même identifiant). Il disparaît quand le titre est
     renommé ou supprimé — et c'est le bon comportement : l'ancien identifiant
     devient INTROUVABLE au lieu de pointer discrètement sur autre chose. Une
     panne bruyante vaut mieux qu'une confusion silencieuse. Bonus : il se lit
     et se prononce (« la règle R/approche-pédagogique »).

Limite assumée : deux sections portant exactement le même titre reçoivent un
suffixe -2, -3… attribué dans l'ordre de lecture. Ce cas est rare, et il est le
seul endroit où une position réapparaît.
"""

from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DASHBOARD = ROOT / "PROJECT_STATUS.html"
START = "  /* LLM_CONTEXT_START — généré par scripts/build_llm_context.py */"
END = "  /* LLM_CONTEXT_END */"

CLAUDE_MD = ROOT / "CLAUDE.md"
AGENTS_DIR = ROOT / ".claude" / "agents"
SKILLS_DIR = ROOT / ".claude" / "skills"
DOCS_DIR = ROOT / "docs"

FENCE = re.compile(r"^\s*(?:```|~~~)")
HEADING = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$")
# Les descriptions d'agents et de skills annoncent leur déclenchement par une
# de ces formules. Si aucune n'est présente, le panneau le dit au lieu
# d'inventer un déclencheur.
DECLENCHEURS = re.compile(
    r"(À utiliser|A utiliser|Utilise cette skill|Utilise cette compétence|Utiliser dès)",
    re.IGNORECASE,
)
EXTRAIT_MAX = 420
SECTIONS_MAX = 40


# --------------------------------------------------------------------------
# Petits outils de lecture Markdown
# --------------------------------------------------------------------------

def slug(titre: str, pris: dict[str, int]) -> str:
    """Identifiant lisible et déterministe dérivé d'un titre de section."""
    base = titre.lower().replace("'", " ").replace("’", " ")
    base = re.sub(r"[`*_]", "", base)
    base = re.sub(r"[^0-9a-zà-öø-ÿ]+", "-", base).strip("-")
    if len(base) > 40:
        coupe = base[:40].rsplit("-", 1)[0]
        base = coupe or base[:40]
    base = base or "sans-titre"
    pris[base] = pris.get(base, 0) + 1
    return base if pris[base] == 1 else f"{base}-{pris[base]}"


def decouper_regles(texte: str) -> list[dict]:
    """Découpe un Markdown en règles : une section = son titre + son texte direct.

    Les blocs de code sont traversés sans être interprétés (une ligne
    « # commentaire » dans un bloc bash n'est pas un titre). Le texte placé
    avant tout titre n'est pas perdu : il devient la règle « (préambule) ».
    """
    lignes = texte.splitlines()
    pris: dict[str, int] = {}
    pile: list[tuple[int, str]] = []
    regles: list[dict] = []
    courant: dict | None = {
        "titre": "(préambule)", "niveau": 0, "chemin": [], "ligne": 1, "brut": [],
    }
    dans_bloc = False

    def clore() -> None:
        nonlocal courant
        if courant is None:
            return
        corps = "\n".join(courant.pop("brut")).strip("\n")
        if corps.strip():
            courant["texte"] = corps
            courant["lignes"] = len(corps.splitlines())
            courant["id"] = slug(courant["titre"], pris)
            regles.append(courant)
        courant = None

    for numero, ligne in enumerate(lignes, start=1):
        if FENCE.match(ligne):
            dans_bloc = not dans_bloc
            if courant is not None:
                courant["brut"].append(ligne)
            continue
        titre = None if dans_bloc else HEADING.match(ligne)
        if titre:
            clore()
            niveau = len(titre.group(1))
            intitule = titre.group(2).strip()
            while pile and pile[-1][0] >= niveau:
                pile.pop()
            courant = {
                "titre": intitule,
                "niveau": niveau,
                "chemin": [t for _, t in pile],
                "ligne": numero,
                "brut": [],
            }
            pile.append((niveau, intitule))
        elif courant is not None:
            courant["brut"].append(ligne)
    clore()
    return regles


def entete_yaml(texte: str) -> tuple[dict[str, str], str]:
    """Lit l'en-tête `---` d'un fichier d'agent ou de skill. Pas de dépendance."""
    lignes = texte.splitlines()
    if not lignes or lignes[0].strip() != "---":
        return {}, texte
    fin = next((i for i in range(1, len(lignes)) if lignes[i].strip() == "---"), None)
    if fin is None:
        return {}, texte
    donnees: dict[str, str] = {}
    cle: str | None = None
    for ligne in lignes[1:fin]:
        paire = re.match(r"^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$", ligne)
        if paire:
            cle = paire.group(1)
            donnees[cle] = paire.group(2).strip()
        elif cle and ligne.strip():
            donnees[cle] = f"{donnees[cle]} {ligne.strip()}".strip()
    for cle, valeur in donnees.items():
        if len(valeur) > 1 and valeur[0] == valeur[-1] and valeur[0] in "\"'":
            donnees[cle] = valeur[1:-1]
    return donnees, "\n".join(lignes[fin + 1:])


def premier_titre(texte: str) -> str:
    for ligne in texte.splitlines():
        trouve = HEADING.match(ligne)
        if trouve:
            return trouve.group(2).strip()
    return ""


def premier_paragraphe(texte: str) -> str:
    """Premier paragraphe hors titre et hors bloc de code, tronqué s'il est long."""
    tampon: list[str] = []
    dans_bloc = False
    for ligne in texte.splitlines():
        if FENCE.match(ligne):
            dans_bloc = not dans_bloc
            continue
        if dans_bloc or HEADING.match(ligne):
            if tampon:
                break
            continue
        if ligne.strip():
            tampon.append(ligne.strip())
        elif tampon:
            break
    paragraphe = " ".join(tampon).strip()
    if len(paragraphe) > EXTRAIT_MAX:
        paragraphe = paragraphe[:EXTRAIT_MAX].rsplit(" ", 1)[0] + " […]"
    return paragraphe


def mandat_et_declenchement(description: str) -> tuple[str, str]:
    """Coupe la description à l'endroit où elle passe du mandat au déclencheur.

    Découpage mécanique, pas de reformulation : le mandat est la première
    phrase telle qu'elle est écrite, le déclenchement est la suite à partir de
    la formule d'usage.
    """
    if not description.strip():
        return ("(aucune description dans l'en-tête du fichier)",
                "(aucune description : le déclenchement n'est pas déclaré)")
    trouve = DECLENCHEURS.search(description)
    if trouve:
        avant = description[:trouve.start()].strip()
        declenchement = description[trouve.start():].strip()
    else:
        avant = description.strip()
        declenchement = "(non déclaré dans la description — c'est elle qui décide du chargement)"
    phrase = re.match(r"\s*(.+?[.!?])(?:\s|$)", avant, re.DOTALL)
    mandat = (phrase.group(1) if phrase else avant).strip() or avant
    return mandat, declenchement


def poids(chemin: Path) -> str:
    octets = chemin.stat().st_size
    return f"{octets / 1024:.1f} ko" if octets >= 1024 else f"{octets} o"


# --------------------------------------------------------------------------
# ① Les ordres permanents
# --------------------------------------------------------------------------

def lire_ordres() -> dict:
    relatif = CLAUDE_MD.relative_to(ROOT).as_posix()
    if not CLAUDE_MD.exists():
        return {
            "chemin": relatif,
            "present": False,
            "note": f"{relatif} est introuvable : aucune règle permanente n'est chargée.",
        }
    texte = CLAUDE_MD.read_text(encoding="utf-8")
    return {
        "chemin": relatif,
        "present": True,
        "lignes": len(texte.splitlines()),
        "poids": poids(CLAUDE_MD),
        "regles": decouper_regles(texte),
    }


# --------------------------------------------------------------------------
# ② Les spécialistes : agents et skills
# --------------------------------------------------------------------------

def lire_agents() -> dict:
    relatif = AGENTS_DIR.relative_to(ROOT).as_posix()
    if not AGENTS_DIR.is_dir():
        return {"dossier": relatif, "present": False,
                "note": f"{relatif} est introuvable : aucun agent spécialisé n'est disponible."}
    items = []
    for fichier in sorted(AGENTS_DIR.glob("*.md")):
        texte = fichier.read_text(encoding="utf-8")
        entete, corps = entete_yaml(texte)
        mandat, declenchement = mandat_et_declenchement(entete.get("description", ""))
        outils = entete.get("tools", "").strip()
        modele = entete.get("model", "").strip()
        items.append({
            "genre": "agent",
            "nom": entete.get("name", fichier.stem) or fichier.stem,
            "fichier": fichier.relative_to(ROOT).as_posix(),
            "titre": premier_titre(corps),
            "mandat": mandat,
            "declenchement": declenchement,
            "description": entete.get("description", "") or "(aucune description)",
            "portee": " · ".join(filter(None, [
                f"modèle {modele}" if modele else "modèle hérité de la session",
                f"outils : {outils}" if outils else "tous les outils",
                f"{len(texte.splitlines())} lignes",
            ])),
        })
    return {"dossier": relatif, "present": True, "items": items}


def lire_skills() -> dict:
    relatif = SKILLS_DIR.relative_to(ROOT).as_posix()
    if not SKILLS_DIR.is_dir():
        return {"dossier": relatif, "present": False,
                "note": f"{relatif} est introuvable : aucune skill n'est disponible."}
    items = []
    for dossier in sorted(p for p in SKILLS_DIR.iterdir() if p.is_dir()):
        fichier = dossier / "SKILL.md"
        if not fichier.exists():
            items.append({
                "genre": "skill",
                "nom": dossier.name,
                "fichier": (dossier / "SKILL.md").relative_to(ROOT).as_posix(),
                "titre": "",
                "mandat": "(SKILL.md manquant : le dossier existe mais la skill ne peut pas se charger)",
                "declenchement": "(introuvable)",
                "description": "(SKILL.md manquant)",
                "portee": "dossier présent, fichier absent",
            })
            continue
        texte = fichier.read_text(encoding="utf-8")
        entete, corps = entete_yaml(texte)
        mandat, declenchement = mandat_et_declenchement(entete.get("description", ""))
        annexes = [p for p in dossier.rglob("*") if p.is_file() and p != fichier]
        items.append({
            "genre": "skill",
            "nom": entete.get("name", dossier.name) or dossier.name,
            "fichier": fichier.relative_to(ROOT).as_posix(),
            "titre": premier_titre(corps),
            "mandat": mandat,
            "declenchement": declenchement,
            "description": entete.get("description", "") or "(aucune description)",
            "portee": " · ".join(filter(None, [
                f"{len(texte.splitlines())} lignes",
                f"{len(annexes)} fichier(s) joint(s)" if annexes else "",
            ])),
        })
    return {"dossier": relatif, "present": True, "items": items}


# --------------------------------------------------------------------------
# ③ Les documents de référence
# --------------------------------------------------------------------------

def lire_references() -> dict:
    relatif = DOCS_DIR.relative_to(ROOT).as_posix()
    if not DOCS_DIR.is_dir():
        return {"dossier": relatif, "present": False,
                "note": f"{relatif} est introuvable : aucun arbitrage archivé n'est consultable."}
    items = []
    for fichier in sorted(DOCS_DIR.rglob("*.md")):
        texte = fichier.read_text(encoding="utf-8")
        _, corps = entete_yaml(texte)
        sections = []
        dans_bloc = False
        for ligne in corps.splitlines():
            if FENCE.match(ligne):
                dans_bloc = not dans_bloc
                continue
            trouve = None if dans_bloc else HEADING.match(ligne)
            if trouve and len(trouve.group(1)) == 2:
                sections.append(trouve.group(2).strip())
        items.append({
            "fichier": fichier.relative_to(ROOT).as_posix(),
            "titre": premier_titre(corps) or fichier.stem,
            "extrait": premier_paragraphe(corps) or "(document vide)",
            "sections": sections[:SECTIONS_MAX],
            "sections_total": len(sections),
            "lignes": len(texte.splitlines()),
            "poids": poids(fichier),
        })
    return {"dossier": relatif, "present": True, "items": items}


# --------------------------------------------------------------------------
# Injection
# --------------------------------------------------------------------------

def construire() -> dict:
    return {
        "genere_le": date.today().isoformat(),
        "ordres": lire_ordres(),
        "specialistes": {"agents": lire_agents(), "skills": lire_skills()},
        "references": lire_references(),
    }


def encoder(donnees: dict) -> str:
    """JSON sûr à l'intérieur d'une balise <script> d'un HTML autonome."""
    charge = json.dumps(donnees, ensure_ascii=False, separators=(",", ":"))
    return (charge
            .replace("</", "<\\/")
            .replace("\u2028", "\\u2028")
            .replace("\u2029", "\\u2029"))


def main() -> None:
    if not DASHBOARD.exists():
        raise SystemExit(f"{DASHBOARD} introuvable")
    html = DASHBOARD.read_text(encoding="utf-8")
    donnees = construire()
    remplacement = f"{START}\n  const LLM_CONTEXT = {encoder(donnees)};\n{END}"
    motif = re.compile(re.escape(START) + r".*?" + re.escape(END), re.DOTALL)
    # Remplacement par fonction : le contenu JSON contient des antislashs que
    # re.sub interpréterait comme des références de groupe.
    modifie, trouves = motif.subn(lambda _: remplacement, html, count=1)
    if trouves != 1:
        raise RuntimeError("Marqueurs LLM_CONTEXT introuvables ou dupliqués dans PROJECT_STATUS.html")
    if modifie != html:
        DASHBOARD.write_text(modifie, encoding="utf-8")

    ordres = donnees["ordres"]
    agents = donnees["specialistes"]["agents"]
    skills = donnees["specialistes"]["skills"]
    refs = donnees["references"]
    print(
        f"{len(ordres.get('regles', []))} règle(s) · "
        f"{len(agents.get('items', []))} agent(s) · "
        f"{len(skills.get('items', []))} skill(s) · "
        f"{len(refs.get('items', []))} document(s) → {DASHBOARD.name}"
    )
    for bloc, etiquette in ((ordres, "ordres"), (agents, "agents"),
                            (skills, "skills"), (refs, "références")):
        if not bloc.get("present", True):
            print(f"  ⚠ {etiquette} : {bloc.get('note')}")


if __name__ == "__main__":
    main()
