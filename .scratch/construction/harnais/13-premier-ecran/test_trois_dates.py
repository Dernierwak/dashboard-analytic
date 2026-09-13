"""LES TROIS DATES EN TÊTE DU RAPPORT.

« Mesuré du X au X · publié le X · mis à jour le X » — et rien d'autre : un
rapport ne se déclare jamais « périmé », et aucune carte ne porte son âge.

Ce fichier lit du TEXTE (pas de runner dans `saas/web`, décision de David au
ticket 16). Le CALCUL des dates, lui, est exécuté pour de bon par
`verifier_dates.js`, que ce fichier lance sous node.
"""
import re
import subprocess
import sys
from pathlib import Path

import pulse
import t

R = pulse.lire(pulse.SOURCE_REPORT_TS)
D = pulse.lire(pulse.SOURCE_TROIS_DATES)
J = pulse.lire(pulse.SOURCE_JOUR)
JR = pulse.lire(pulse.SOURCE_JOUR_RECOLTE)
P = pulse.lire(pulse.SOURCE_PAGE)
W = pulse.lire(pulse.SOURCE_RAPPORT)

# ── 1 · LES TROIS DATES SONT LUES, ET AUCUNE N'EST INVENTÉE ─────────────────

t.ok("`updated_at` entre enfin dans la lecture du rapport",
     re.search(r'from\("weekly_reports"\)\s*\n\s*\.select\("week_start, payload, updated_at"\)', R))
t.ok("le Jour de travail est lu sur le profil du compte REGARDÉ",
     'select("objectif, business_type, labels, fetch_schedule")' in R)
t.ok("`publieLe` est exposé par la couche de données", "publieLe: string | null;" in R)
t.ok("`jourDeTravail` est exposé par la couche de données", "jourDeTravail: string;" in R)
t.ok("`publieLe` sort de la LIGNE, pas du payload",
     'reportRes.data?.[0]?.updated_at as string | undefined' in R)
t.ok("aucune date de publication n'est fabriquée quand la ligne n'en a pas",
     re.search(r"publieLe: string \| null =\s*\n?\s*\(reportRes\.data\?\.\[0\]\?\.updated_at[^\n]*\n?\s*\?\? null;", R))
t.ok("le défaut du jour est celui du worker, pas un choix d'écran",
     'profRow?.fetch_schedule || JOUR_DEFAUT' in R and 'JOUR_DEFAUT = "Monday"' in J)

# ── 2 · LE PIÈGE DU §8 EST TENU ─────────────────────────────────────────────
#
# Le calcul du prochain passage vit dans un module SANS directive, parce que
# deux mondes le lisent : `jour-recolte.tsx` (client) et `trois-dates.tsx`
# (serveur). Une constante exportée d'un module `"use client"` arriverait côté
# serveur sous forme de proxy, sans que rien ne lève.

t.ok("le module partagé n'a AUCUNE directive",
     '"use client"' not in pulse.sans_commentaires(J)
     and '"use server"' not in pulse.sans_commentaires(J))
t.ok("le composant des trois dates est rendu par le serveur",
     '"use client"' not in pulse.sans_commentaires(D))
t.ok("le module client lit le module partagé", 'from "@/lib/jour-de-travail"' in JR)
t.ok("le module client ne garde PAS sa propre copie des sept jours",
     "const JOURS = [" not in JR and "function prochainPassage" not in JR)
t.ok("les sept jours ne vivent qu'à un endroit", J.count("const JOURS = [") == 1)
t.ok("le module partagé dit pourquoi il n'a pas de directive", "§8" in J)

# ── 3 · CE QUE LA LIGNE N'A PAS LE DROIT DE DIRE ────────────────────────────
#
# Refusé deux fois par David, et écrit au §7 : vieux ≠ faux. Aucun mot d'alarme
# n'entre dans ce composant, et aucune mention d'âge par carte n'existe.

ECRAN = pulse.sans_commentaires(D).lower()
for mot in ("périmé", "perime", "obsolète", "dépassé", "plus à jour", "il y a ",
            "attention", "mise à jour en cours"):
    t.ok(f"la ligne ne dit jamais « {mot.strip()} »", mot not in ECRAN)
t.ok("aucun bandeau « mise à jour en cours » sur la page",
     "mise à jour en cours" not in pulse.sans_commentaires(P).lower())
t.ok("aucune couleur d'alerte sur les trois dates",
     "text-neg" not in ECRAN and "text-warn" not in ECRAN)

# ── 4 · CHAQUE DATE PEUT MANQUER, ET ALORS ELLE NE S'ÉCRIT PAS ──────────────

t.ok("la fenêtre ne s'écrit qu'entière", "d1 && d2 ?" in D)
t.ok("« publié le » ne s'écrit que si la ligne le sait", "if (pub)" in D)
t.ok("une date illisible vaut `null`, pas « NaN »",
     "return isNaN(d.getTime()) ? null : d;" in J)
t.ok("le libellé de semaine reste le repli des payloads sans fenêtre",
     "report?.week_label ?? data.weekLabel" in P)
t.ok("les trois dates ne s'affichent que si la fenêtre existe",
     "report?.since && report?.until ?" in P)
t.ok("le libellé et les trois dates ne se lisent JAMAIS ensemble",
     P.count("report?.week_label ?? data.weekLabel") == 1)

# ── 5 · LA TROISIÈME DATE EST UN RENDEZ-VOUS, PAS UN DÉLAI ESTIMÉ ───────────

t.ok("le prochain passage sort du jour choisi", "prochainPassage(jourDeTravail" in D)
t.ok("l'heure du rendu est passée par la page, lue une seule fois",
     "maintenant: Date;" in D and "const maintenant = new Date();" in P)
t.ok("tout se calcule en UTC, comme le cron", "getUTC" in J and "HEURE_UTC = 7" in J)
t.ok("l'heure du cron est celle du workflow, et elle est sourcée",
     "weekly-fetch.yml" in J)

# ── 6 · LE CALCUL, EXÉCUTÉ POUR DE BON ──────────────────────────────────────

js = Path(__file__).with_name("verifier_dates.js")
res = subprocess.run(["node", str(js)], capture_output=True, text=True)
print(res.stdout.rstrip())
t.ok("les dates se calculent juste (voir ci-dessus)", res.returncode == 0, res.stderr)

sys.exit(0 if t.bilan("Les trois dates") else 1)
