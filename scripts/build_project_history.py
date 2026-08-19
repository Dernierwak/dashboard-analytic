"""Injecte l'historique Git complet dans PROJECT_STATUS.html.

Le dashboard reste un fichier HTML autonome. Relancer ce script après une série
de commits pour rafraîchir son archive sans toucher aux tâches ou aux statuts.
"""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DASHBOARD = ROOT / "PROJECT_STATUS.html"
START = "  /* GIT_HISTORY_START — généré par scripts/build_project_history.py */"
END = "  /* GIT_HISTORY_END */"


def git_history() -> list[dict[str, str]]:
    output = subprocess.check_output(
        [
            "git", "log", "--date=short",
            "--pretty=format:%ad%x1f%h%x1f%s%x1e",
        ],
        cwd=ROOT,
        text=True,
    )
    history = []
    for record in output.strip("\x1e\n").split("\x1e"):
        record = record.strip()
        if not record:
            continue
        date, commit_hash, subject = record.split("\x1f", 2)
        history.append(
            {
                "date": date,
                "month": date[:7],
                "hash": commit_hash,
                "subject": subject,
            }
        )
    return history


def main() -> None:
    html = DASHBOARD.read_text(encoding="utf-8")
    payload = json.dumps(git_history(), ensure_ascii=False, separators=(",", ":"))
    replacement = f"{START}\n  const GIT_HISTORY = {payload};\n{END}"
    pattern = re.compile(re.escape(START) + r".*?" + re.escape(END), re.DOTALL)
    updated, count = pattern.subn(replacement, html, count=1)
    if count != 1:
        raise RuntimeError("Marqueurs GIT_HISTORY introuvables ou dupliqués")
    DASHBOARD.write_text(updated, encoding="utf-8")
    print(f"{len(git_history())} commits injectés dans {DASHBOARD.name}")


if __name__ == "__main__":
    main()
