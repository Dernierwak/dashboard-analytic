"""Où en est la construction — lu sur les tickets, jamais tenu à la main.

Le tableau d'état de `map.md` se périmait à chaque ticket résolu, et un
tableau périmé est pire que pas de tableau : on le lit en croyant qu'il dit
vrai. Ce script le RECALCULE depuis les `Status:` des fichiers de
`issues/`, et le repose entre ses deux balises dans `map.md`.

    python3.12 .scratch/construction/etat.py          # réécrit map.md
    python3.12 .scratch/construction/etat.py --voir   # affiche sans écrire

Aucun chiffre n'est écrit ici : les comptes sortent des fichiers.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent
ISSUES = RACINE / "issues"
CARTE = RACINE / "map.md"

DEBUT = "<!-- ETAT:DEBUT — recalculé par `etat.py`, ne pas tenir à la main -->"
FIN = "<!-- ETAT:FIN -->"


def lire(chemin: Path) -> dict:
    lignes = chemin.read_text(encoding="utf-8").splitlines()
    titre = lignes[0].lstrip("# ").strip() if lignes else chemin.stem

    def champ(nom: str) -> str:
        for ligne in lignes[:10]:
            if ligne.startswith(f"{nom}:"):
                return ligne.split(":", 1)[1].strip()
        return ""

    return {
        "num": chemin.name.split("-", 1)[0],
        "titre": titre,
        "statut": champ("Status") or "?",
        "bloque": champ("Blocked by"),
        "fichier": chemin.name,
    }


def rendre(tickets: list[dict]) -> str:
    faits = [t for t in tickets if t["statut"] == "resolved"]
    restants = [t for t in tickets if t["statut"] != "resolved"]

    # Le statut de chaque numéro, pour savoir si un bloqueur est encore debout.
    par_num = {t["num"].lstrip("0") or "0": t["statut"] for t in tickets}

    def ligne(t: dict, *, avec_blocage: bool) -> str:
        # LE BLOCAGE NE S'AFFICHE QUE SUR UN TICKET OUVERT, et seulement s'il
        # tient ENCORE. Sur un ticket résolu c'est de l'histoire ; et « bloqué
        # par 06 » quand 06 est résolu se lit comme « on ne peut pas y aller »
        # alors que c'est exactement l'inverse — c'est le seul endroit de ce
        # tableau où une ligne périmée coûterait une décision.
        bloc = ""
        if avec_blocage and t["bloque"]:
            debout = [n.strip() for n in t["bloque"].split(",")
                      if n.strip() and par_num.get(n.strip().lstrip("0")) != "resolved"]
            if debout:
                bloc = f" — **bloqué par {', '.join(debout)}**"
        return f"| **{t['num']}** | [{t['titre']}](issues/{t['fichier']}){bloc} |"

    return "\n".join([
        DEBUT,
        "",
        "## Où on en est",
        "",
        f"**{len(faits)} tickets résolus, {len(restants)} ouverts** "
        f"(sur {len(tickets)}). Recalculé depuis les `Status:` des fichiers par "
        "[`etat.py`](etat.py) — `python3.12 .scratch/construction/etat.py`.",
        "",
        "⚠ **Ce que tu lis dépend de ta branche.** Les tickets sont des fichiers "
        "versionnés : un ticket résolu sur une branche non fusionnée reste "
        "`open` dans une copie de travail restée sur `main`. En cas de doute, "
        "`git log --oneline main..<branche>` dit ce qui n'est pas encore arrivé "
        "dans `main`.",
        "",
        "### Fait",
        "",
        "| № | Ticket |",
        "|---|---|",
        *[ligne(t, avec_blocage=False) for t in faits],
        "",
        "### Reste à faire",
        "",
        "| № | Ticket |",
        "|---|---|",
        *[ligne(t, avec_blocage=True) for t in restants],
        "",
        FIN,
    ])


def main() -> int:
    tickets = sorted((lire(p) for p in ISSUES.glob("*.md")),
                     key=lambda t: int(t["num"]))
    bloc = rendre(tickets)
    if "--voir" in sys.argv:
        print(bloc)
        return 0

    carte = CARTE.read_text(encoding="utf-8")
    if DEBUT in carte and FIN in carte:
        carte = re.sub(re.escape(DEBUT) + r".*?" + re.escape(FIN), bloc,
                       carte, flags=re.S)
    else:
        # Première pose : juste avant « ## Notes », qui suit la Destination.
        ancre = "## Notes"
        if ancre not in carte:
            print("map.md : section « ## Notes » introuvable, rien écrit")
            return 1
        carte = carte.replace(ancre, bloc + "\n\n" + ancre, 1)
    CARTE.write_text(carte, encoding="utf-8")
    faits = sum(1 for t in tickets if t["statut"] == "resolved")
    print(f"map.md à jour : {faits} résolus, {len(tickets) - faits} ouverts")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
