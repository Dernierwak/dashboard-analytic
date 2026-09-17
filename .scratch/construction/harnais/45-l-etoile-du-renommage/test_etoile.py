"""Ticket 45 — renommer un thème lui faisait perdre son étoile.

Deux moitiés, comme au ticket 19 :

  · ce qui s'EXÉCUTE — `verifier_deplacement.js` joue `lib/deplacer-theme.ts`
    tel quel, contre une fausse base qui refuse ce que PostgREST refuse ;
  · ce qui se LIT — le CÂBLAGE dans `actions.ts` : les étapes existent, elles
    sont dans la cascade, et elles passent AVANT la liste maîtresse. Rien ne
    s'exécute de ce fichier-là (`"use server"` + connexion Supabase au
    chargement), donc cette moitié-ci reste du texte.

    python3.12 test_etoile.py     # lance aussi verifier_deplacement.js
"""
import re
import subprocess
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI.parent / "19-ecritures"))

import pulse  # noqa: E402  — le même lecteur qu'au ticket 19, jamais recopié
import t  # noqa: E402

A = pulse.lire(pulse.SOURCE_ACTIONS)
CODE = pulse.sans_commentaires(A)
MODULE = pulse.lire(pulse.WEB / "lib" / "deplacer-theme.ts")
CODE_MODULE = pulse.sans_commentaires(MODULE)

RENAME = pulse.corps(CODE, "export async function renameLabel(")
DELETE = pulse.corps(CODE, "export async function deleteLabel(")
FUSION = pulse.corps(CODE, "async function _fusionnerLabels(")

# ── 1 · LE RENOMMAGE SIMPLE A RETROUVÉ SES DEUX ÉTAPES ─────────────────────
#
# Le défaut du ticket : la FUSION propageait sur neuf tables, le renommage
# simple sur sept, et les deux qui manquaient étaient exactement celles qui
# décident de ce que Pulse conseille. (Le ticket 45 écrit « huit » et « six » —
# il comptait les étapes de mémoire. Ces deux nombres-ci sont MESURÉS sur le
# fichier, leçon du ticket 44.)

etapes_rename = re.findall(r'nom: "([^"]+)"', RENAME)
t.ok("`renameLabel` déplace les retours sur les conseils",
     "retours sur les conseils" in etapes_rename)
t.ok("`renameLabel` déplace la priorité du thème",
     "priorité du thème" in etapes_rename)
t.egal("`renameLabel` compte maintenant neuf étapes", len(etapes_rename), 9)

# L'ORDRE EST LA SEULE CHOSE QUI REND UN ARRÊT RATTRAPABLE (ticket 19) : la
# liste maîtresse EN DERNIER, pour qu'un arrêt laisse l'ancien nom visible —
# donc relançable. Deux étapes ajoutées après elle auraient été perdues à la
# première panne.
t.egal("la liste maîtresse reste la DERNIÈRE étape du renommage",
       etapes_rename[-1], "liste des thèmes")
for etape in ("retours sur les conseils", "priorité du thème"):
    t.ok(f"« {etape} » passe avant la liste maîtresse",
         etapes_rename.index(etape) < etapes_rename.index("liste des thèmes"))

# ── 2 · LA SUPPRESSION EMPORTE L'ÉTOILE ────────────────────────────────────
etapes_delete = re.findall(r'nom: "([^"]+)"', DELETE)
t.ok("`deleteLabel` retire la priorité du thème",
     "priorité du thème" in etapes_delete)
t.egal("`deleteLabel` compte maintenant sept étapes", len(etapes_delete), 7)
t.egal("la liste maîtresse reste la DERNIÈRE étape de la suppression",
       etapes_delete[-1], "liste des thèmes")
t.ok("« priorité du thème » passe avant la liste maîtresse",
     etapes_delete.index("priorité du thème")
     < etapes_delete.index("liste des thèmes"))

# ── 3 · UN SEUL EXEMPLAIRE DE LA LOGIQUE, TROIS APPELANTS ──────────────────
#
# La fusion traitait déjà ces deux tables. Recopier ses blocs dans le renommage
# aurait posé deux fois la même gestion de conflit, donc deux fois l'occasion de
# diverger — et la divergence, c'est précisément ce ticket-ci.

t.ok("`actions.ts` importe le module partagé", 'from "@/lib/deplacer-theme"' in CODE)
for appelant, corps in [("renameLabel", RENAME), ("_fusionnerLabels", FUSION)]:
    t.ok(f"`{appelant}` passe par `deplacerRetoursConseils`",
         "deplacerRetoursConseils(" in corps)
    t.ok(f"`{appelant}` passe par `deplacerEtoile`", "deplacerEtoile(" in corps)
t.ok("`deleteLabel` passe par `retirerEtoile`", "retirerEtoile(" in DELETE)

# La clé `priority_label:` ne se compose plus à la main dans ces trois
# fonctions : elle a une seule fabrique, et cinq lecteurs en dépendent (dont
# `build_report.py`).
for nom, corps in [("renameLabel", RENAME), ("deleteLabel", DELETE),
                   ("_fusionnerLabels", FUSION)]:
    t.ok(f"`{nom}` ne compose plus la clé de l'étoile à la main",
         "priority_label:" not in corps)

# ── 4 · LE MODULE RESTE JOUABLE HORS LIGNE ────────────────────────────────
#
# C'est ce qui le sépare d'`actions.ts`, et donc ce qui permet à la moitié
# EXÉCUTÉE d'exister. Une directive ou un import de valeur, et tout retombe en
# lecture de texte.
t.ok("`lib/deplacer-theme.ts` n'a aucune directive",
     '"use client"' not in CODE_MODULE and '"use server"' not in CODE_MODULE)
t.ok("`lib/deplacer-theme.ts` n'importe QUE des types",
     all(l.startswith("import type ")
         for l in CODE_MODULE.split("\n") if l.startswith("import ")))
t.ok("le module rend une `Panne`, la monnaie de la cascade",
     CODE_MODULE.count("Promise<Panne>") == 3)

# UNE LECTURE RATÉE N'EST PAS « AUCUNE LIGNE » — le piège payé partout
# ailleurs dans ce fichier : sans ces gardes, l'étape resterait verte en ayant
# sauté tout le monde, et l'écran dirait « renommé partout ». Les gardes sont
# nommés un par un plutôt que comptés : un compte se périme au premier ajout, et
# c'est une valeur qu'on recopierait au lieu de la mesurer.
for garde in ("if (depart.error) return depart.error;",
              "if (arrivee.error) return arrivee.error;",
              "if (r.error) return r.error;"):
    t.ok(f"le module garde `{garde}`", garde in CODE_MODULE)

# ET UNE ÉCRITURE QUI TOUCHE ZÉRO LIGNE NE LÈVE RIEN (`CLAUDE.md` §8) : le seul
# moyen de la voir est de la relire, comme l'étape maîtresse de `renameLabel`
# le fait déjà.
t.ok("l'étoile relit ce qu'elle vient d'écrire", '.select("id")' in CODE_MODULE)

# PostgREST tronque à 1 000 lignes EN SILENCE : une lecture nue laisserait les
# retours au-delà sur l'ancien nom, sans rien dire.
t.ok("les retours se lisent page par page", ".range(debut, fin)" in CODE_MODULE)
t.egal("les deux lectures de `reco_feedback` sont paginées",
       CODE_MODULE.count("lireTout("), 2)  # les deux appels ; la définition
                                           # s'écrit `lireTout<T>(`

# ── 5 · LA PROPRIÉTÉ EXÉCUTÉE ──────────────────────────────────────────────
print("\n── lib/deplacer-theme.ts, joué pour de bon ──")
node = subprocess.run(["node", str(ICI / "verifier_deplacement.js")],
                      capture_output=True, text=True)
print(node.stdout.strip())
if node.returncode:
    print(node.stderr.strip())
t.ok("les 48 vérifications de `verifier_deplacement.js` passent",
     node.returncode == 0)

sys.exit(0 if t.bilan("Ticket 45 — l'étoile suit le thème qu'on renomme") else 1)
