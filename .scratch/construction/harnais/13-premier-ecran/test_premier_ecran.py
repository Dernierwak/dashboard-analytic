"""L'ORDRE DU PREMIER ÉCRAN, ET LE DÉFAUT DE PUBLICATION.

Verdict → bilan du Carnet → À faire → rail des chantiers en cours → résumé IA
REPLIÉ (`.scratch/refonte/issues/10-l-entree-premier-ecran.md` point 6, confirmé
par le 20). Plus le fil de démarrage, qui était rendu sous deux écrans de
défilement.

Et le défaut que le ticket 13 de la refonte a noté sans le corriger : republier
dans une semaine calendaire différente écrivait une DEUXIÈME ligne pour les
mêmes chiffres.
"""
import re
import subprocess
import sys
from pathlib import Path

import pulse
import t

P = pulse.lire(pulse.SOURCE_PAGE)
CODE = pulse.sans_commentaires(P)
A = pulse.lire(pulse.SOURCE_A_FAIRE)
W = pulse.lire(pulse.SOURCE_RAPPORT)


def rang(marque, source=CODE):
    """Où un bloc est rendu dans la page. -1 s'il n'y est pas."""
    return source.find(marque)


# ── 1 · LES CINQ MARCHES, DANS L'ORDRE ──────────────────────────────────────

marches = [
    ("le fil de démarrage", "<SetupWizard"),
    ("le verdict", "<Verdict report={report}"),
    ("le bilan du Carnet", "<BilanDuCarnet />"),
    ("« À faire »", "<AFaire liste={aFaire}"),
    ("le rail des actions en cours", "<RailActions actions={enCours}"),
    ("le résumé IA", "<ResumeSemaine brief={report.brief}"),
    ("la section 1", "Ta semaine, tous"),
]
for (nom, marque) in marches:
    t.ok(f"{nom} est rendu", rang(marque) >= 0)
for (avant, apres) in zip(marches, marches[1:]):
    t.ok(f"{avant[0]} vient avant {apres[0]}",
         0 <= rang(avant[1]) < rang(apres[1]),
         f"{rang(avant[1])} vs {rang(apres[1])}")

# ── 2 · LE FIL DE DÉMARRAGE N'EST PLUS EN BAS DE PAGE ───────────────────────
#
# Défaut mesuré par le ticket 06 de la refonte : il était rendu après les deux
# sections du rapport, alors qu'il porte les seules actions qui débloquent le
# reste. Ce qu'on ne fait PAS ici : les quatre étapes avec la connexion en gate
# — c'est la brique « mise en place », hors v1.

t.ok("le fil n'est monté qu'une fois", CODE.count("<SetupWizard") == 1)
t.ok("le fil est le premier bloc rendu par la page",
     0 <= rang("<main") < rang("<SetupWizard")
     and not re.search(r"<\w", CODE[rang("<main") + len("<main"):rang("<SetupWizard")]),
     CODE[rang("<main"):rang("<SetupWizard")][:120])
t.ok("il passe avant la carte du verdict",
     rang("<SetupWizard") < rang('<div className="mb-7">'))
t.ok("le fil n'est pas devenu un écran à part", "app/mise-en-place" not in P)

# ── 3 · LE RÉSUMÉ IA EST DESCENDU, ET IL EST REPLIÉ ─────────────────────────
#
# « La prose IA est ce qu'il y a de moins vérifiable sur la page, et elle occupe
# aujourd'hui les pixels les plus chers » (plan de refonte §3 a).

t.ok("le résumé n'est plus dans le hero",
     rang("<ResumeSemaine") > rang("<BilanDuCarnet />"))
RESUME = CODE[CODE.find("function ResumeSemaine"):]
RESUME = RESUME[:RESUME.find("\n}")]
t.ok("le résumé est replié dans un `<details>`", "<details" in RESUME)
# L'attribut `open`, pas le mot : `group-open:` est la variante Tailwind qui
# bascule le libellé du geste, et elle n'ouvre rien.
t.ok("il est FERMÉ au chargement — pas d'attribut `open`",
     re.search(r"<details[^>]*\sopen[\s/>]", RESUME) is None)
t.ok("le repli porte son geste en toutes lettres", "Lire le résumé" in P)
t.ok("le texte reste dans le document, sans JavaScript",
     "useState" not in P and "whitespace-pre-line" in P)
t.ok("il dit toujours qui l'a écrit", "Résumé écrit par l&apos;IA" in P)

# ── 4 · LE RAIL DE L'ACCUEIL N'EST PAS UN DEUXIÈME OBJET ────────────────────

t.ok("c'est le module des cartes de thème, réutilisé",
     'import { RailActions } from "@/components/rail-actions"' in P)
t.ok("il ne reçoit AUCUN fait de plateforme",
     re.search(r"<RailActions actions=\{enCours\}[^>]*/>", CODE)
     and "changements=" not in CODE[rang("<RailActions actions={enCours}"):
                                    rang("<RailActions actions={enCours}") + 200])
t.ok("chaque ligne porte donc son thème (pas de thème courant)",
     "themeCourant" not in CODE[rang("<RailActions actions={enCours}"):
                                rang("<RailActions actions={enCours}") + 200])
t.ok("le tri est fait en amont, par le module de la frontière",
     "chantiersEnCours(data.actions)" in CODE and "export function chantiersEnCours" in A)
t.ok("le rail ne s'affiche pas vide", "enCours.length > 0 &&" in CODE)
t.ok("la frontière est écrite là où elle est calculée",
     "le rail montre le temps qui passe" in A)

js = Path(__file__).with_name("verifier_partition.js")
res = subprocess.run(["node", "--import", str(Path(__file__).with_name("alias.mjs")), str(js)],
                     capture_output=True, text=True)
print(res.stdout.rstrip())
t.ok("la partition tient (voir ci-dessus)", res.returncode == 0, res.stderr)

# ── 5 · LE DÉFAUT DE PUBLICATION EST RÉPARÉ ─────────────────────────────────
#
# `week_start` était le lundi d'AUJOURD'HUI : republier dans une autre semaine
# calendaire écrivait une deuxième ligne pour les mêmes chiffres, et
# renumérotait « Semaine N ». La clé sort maintenant de la FENÊTRE MESURÉE.

t.ok("la semaine du rapport sort de la fenêtre mesurée",
     "week_start_rapport = last_full_day - timedelta(days=last_full_day.weekday())" in W)
t.ok("le libellé « Semaine N » aussi",
     "week_num = week_start_rapport.isocalendar()[1]" in W)
t.ok("plus aucun numéro de semaine tiré d'aujourd'hui",
     "today.isocalendar()" not in W)
t.ok("la clé d'écriture voyage dans le payload",
     '"week_start": week_start_rapport.isoformat()' in W)
t.ok("la publication lit la clé du payload",
     'week_start = (payload.get("week_start")' in W)
# La borne voyage maintenant en ARGUMENT jusqu'au lecteur (ticket 16) : c'est
# lui qui pose le `.lt(…)`. Ce que la ligne prouve est inchangé.
LECTEUR = (pulse.RACINE / "saas" / "traitement" / "lecteur.py").read_text(encoding="utf-8")
t.ok("le rapport ne se relit plus lui-même dans son propre historique",
     "lecteur.rapports_publies(week_start_rapport.isoformat())" in W
     and '.lt("week_start", avant)' in LECTEUR)
t.ok("plus aucune borne d'historique tirée d'aujourd'hui",
     "week_start_monday" not in W)

# La conséquence, jouée sur les cas réels plutôt que racontée. Le calcul est
# celui du worker, recopié en trois lignes : ce qui est vérifié ici n'est pas le
# code (le texte ci-dessus s'en charge) mais la PROPRIÉTÉ — republier sans
# récolter retombe sur la même ligne, quel que soit le jour.
from datetime import date, timedelta


def semaine_du_rapport(today, derniere_donnee):
    dernier_jour_plein = min(derniere_donnee, today - timedelta(days=1))
    return dernier_jour_plein - timedelta(days=dernier_jour_plein.weekday())


jeudi = semaine_du_rapport(date(2026, 9, 17), date(2026, 9, 16))
t.egal("publié le jeudi", jeudi.isoformat(), "2026-09-14")
t.egal("republié le samedi — MÊME ligne",
       semaine_du_rapport(date(2026, 9, 19), date(2026, 9, 16)).isoformat(), "2026-09-14")
t.egal("republié le mardi SUIVANT — toujours la même ligne (c'était le défaut)",
       semaine_du_rapport(date(2026, 9, 22), date(2026, 9, 16)).isoformat(), "2026-09-14")
t.egal("un compte servi le lundi mesure la semaine ISO qui vient de finir",
       semaine_du_rapport(date(2026, 9, 14), date(2026, 9, 13)).isoformat(), "2026-09-07")
t.egal("une récolte en retard suit la donnée, pas le calendrier",
       semaine_du_rapport(date(2026, 9, 17), date(2026, 9, 11)).isoformat(), "2026-09-07")
t.ok("deux publications de la même fenêtre écrivent la même ligne",
     semaine_du_rapport(date(2026, 9, 17), date(2026, 9, 16))
     == semaine_du_rapport(date(2026, 10, 1), date(2026, 9, 16)))

sys.exit(0 if t.bilan("Le premier écran") else 1)
