"""Rejoue tous les harnais de la construction, chacun dans son dossier.

Aucun runner n'est installé dans le dépôt (ticket 16) : chaque harnais est un
script qu'on lance à la main depuis son dossier. Celui-ci ne fait que les
enchaîner et rendre un code de sortie, pour qu'une régression se voie d'un coup
au lieu de dix-huit.
"""
import subprocess
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent
echecs = []
for dossier in sorted(p for p in RACINE.iterdir() if p.is_dir()):
    for fichier in sorted(dossier.glob("test_*.py")):
        r = subprocess.run([sys.executable, fichier.name], cwd=dossier,
                           capture_output=True, text=True)
        ligne = next((l for l in r.stdout.splitlines() if "vérifications" in l),
                     "(aucun bilan)")
        etat = "ok " if r.returncode == 0 else "ÉCHEC"
        print(f"{etat} {dossier.name}/{fichier.name} — {ligne.strip()}")
        if r.returncode != 0:
            echecs.append(f"{dossier.name}/{fichier.name}")
            print((r.stdout + r.stderr).strip()[-1500:])

print(f"\n{len(echecs)} harnais en échec" if echecs else "\nTout passe")
sys.exit(1 if echecs else 0)
