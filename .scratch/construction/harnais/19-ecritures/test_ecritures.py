"""TRENTE ÉCRITURES QUI NE RELISAIENT JAMAIS CE QU'ELLES AVAIENT ÉCRIT.

Ce fichier lit du TEXTE (aucun runner dans `saas/web` — décision de David au
ticket 16). La seule propriété qui se PROUVE au lieu de se lire, l'enchaînement
qui s'arrête à la première panne, est exécutée pour de bon par
`verifier_cascade.js`, que ce fichier lance sous node.
"""
import re
import subprocess
import sys
from pathlib import Path

import pulse
import t

A = pulse.lire(pulse.SOURCE_ACTIONS)
CODE = pulse.sans_commentaires(A)
CASCADE = pulse.lire(pulse.SOURCE_CASCADE)

# ── 1 · L'INVENTAIRE EST ÉPUISÉ, ET IL NE SE REMPLIT PAS TOUT SEUL ──────────
#
# Une écriture NUE, c'est `await supabase…` en début d'instruction : son
# résultat n'est pas capturé, donc ni l'erreur ni le compte de lignes ne peuvent
# être lus. Le ticket en comptait 30. Il n'en reste que celles dont le fichier
# ÉCRIT la raison — et cette vérification-ci est ce qui empêche une trente et
# unième d'arriver en silence.

NUES = [l.strip() for l in CODE.split("\n") if re.match(r"^\s*await supabase", l)]
t.egal("il ne reste que deux écritures nues dans actions.ts", len(NUES), 2)
t.ok("la première est le repli de `marquerApplique`",
     NUES[0].startswith('await supabase.from("reco_feedback").upsert('))
t.ok("la seconde est l'amorce de persona de l'onboarding",
     'user_profile: seed' in NUES[1])
t.ok("la première dit noir sur blanc pourquoi elle reste nue",
     "LA SEULE ÉCRITURE DE CE FICHIER QUI A LE DROIT DE RESTER NUE" in A)
t.ok("la seconde aussi", "Nue, et c'est la seconde des deux seules du fichier" in A)

# ── 2 · FAMILLE 1 · UNE COLLISION SE VOIT — LE COMPTE DE LIGNES SE LIT ──────
#
# `.eq("id", …)` vise UNE ligne. Si elle n'est plus là, PostgREST touche zéro
# ligne et ne lève AUCUNE erreur (`CLAUDE.md` §8). Sans `.select(…)`, PostgREST
# ne dit même pas combien il en a touché : les deux vont ensemble, l'un sans
# l'autre ne vaut rien — c'est la leçon écrite au ticket 02.

for nom, signature in [
    ("changerRoleMembre", "export async function changerRoleMembre("),
    ("revoquerMembre", "export async function revoquerMembre("),
]:
    corps = pulse.corps(CODE, signature)
    t.ok(f"`{nom}` demande à PostgREST ce qu'il a touché", '.select("id")' in corps)
    t.ok(f"`{nom}` traite le zéro ligne", "length === 0" in corps)
    t.ok(f"`{nom}` lit toujours l'erreur", "r.error" in corps)

# Le message NOMME L'ÉTAT, jamais une personne (ADR 0004 : un statut n'a pas
# d'auteur). Le seul moyen sûr de le vérifier est d'interdire les mots qui
# nommeraient quelqu'un.
EQUIPE_MSG = pulse.corps(CODE, "export async function changerRoleMembre(") + \
             pulse.corps(CODE, "export async function revoquerMembre(")
for mot in ("quelqu'un d'autre", "un autre membre", "l'autre propriétaire",
            "member_email", "compte.email"):
    t.ok(f"aucun message d'équipe ne nomme « {mot} »", mot not in EQUIPE_MSG)

# ── 3 · FAMILLE 2 · UN REFUS RLS EST INVISIBLE, DONC IL SE COMPTE ──────────
#
# `profiles` porte `partage_select USING a_acces(id)` et
# `partage_update USING peut_editer(id)` (section 15 du SQL) : un membre
# « Lecture seule » LIT le profil du propriétaire et n'y ÉCRIT pas. L'écran
# répondait « enregistré » à ce refus-là.

for nom, signature in [
    ("saveObjectif", "export async function saveObjectif("),
    ("createLabel", "export async function createLabel("),
]:
    corps = pulse.corps(CODE, signature)
    t.ok(f"`{nom}` compte les lignes écrites sur profiles", '.select("id")' in corps)
    t.ok(f"`{nom}` traite le zéro ligne", "length === 0" in corps)
    t.ok(f"`{nom}` explique le zéro ligne en RELISANT", "profilMuet" in corps)

MUET = pulse.corps(CODE, "async function profilMuet(")
t.ok("`profilMuet` relit avant de parler", 'select("id")' in MUET)
t.ok("`profilMuet` distingue « illisible » de « non autorisé »",
     "n'est plus accessible" in MUET and "ne t'autorise pas à écrire" in MUET)
t.ok("`profilMuet` ne nomme personne",
     not re.search(r"propriétaire s'appelle|member_email|compte\.email", MUET))

# ── 4 · FAMILLE 3 · UNE CASCADE S'ARRÊTE, ET ELLE LE DIT ───────────────────
#
# Quatre fonctions propagent un nom sur plusieurs tables sans transaction. Les
# quatre passent par le MÊME enchaînement, pour que la propriété ne soit à
# prouver qu'une fois (`verifier_cascade.js`).

CASCADES = {
    "renameLabel": ("export async function renameLabel(", "liste des thèmes"),
    "deleteLabel": ("export async function deleteLabel(", "liste des thèmes"),
    "renameConversionCategory":
        ("export async function renameConversionCategory(", "liste des catégories"),
    "deleteConversionCategory":
        ("export async function deleteConversionCategory(", "liste des catégories"),
}
for nom, (signature, maitresse) in CASCADES.items():
    corps = pulse.corps(CODE, signature)
    t.ok(f"`{nom}` passe par `enchainer`", "await enchainer([" in corps)
    t.ok(f"`{nom}` n'a plus une seule écriture nue",
         not re.search(r"^\s*await supabase", corps, re.M))
    t.ok(f"`{nom}` rend un message d'arrêt", "arretCascade(" in corps)
    # L'ORDRE EST LA SEULE CHOSE QUI REND UN ARRÊT RATTRAPABLE : la liste
    # maîtresse en DERNIER, pour qu'un arrêt laisse le nom visible — donc
    # relançable — au lieu de le faire disparaître en laissant des campagnes
    # pointer vers un nom introuvable.
    etapes = re.findall(r'nom: "([^"]+)"', corps)
    t.ok(f"`{nom}` a bien plusieurs étapes nommées", len(etapes) >= 2)
    t.egal(f"`{nom}` écrit la liste maîtresse EN DERNIER", etapes[-1], maitresse)
    # Une seule fois : sans ça, une étape ajoutée en tête sous le même nom
    # laisserait la vérification au-dessus verte tout en cassant l'ordre.
    t.egal(f"`{nom}` n'écrit la liste maîtresse qu'UNE fois",
           etapes.count(maitresse), 1)
    # Un nom d'étape est du français, jamais un nom de table : personne ne sait
    # ce qu'est `meta_campaign_config`, et ce nom-là part à l'écran.
    t.ok(f"`{nom}` ne montre aucun nom de table au client",
         not any("_" in e for e in etapes))

# L'ÉTAPE MAÎTRESSE COMPTE SES LIGNES COMME LES AUTRES. C'est le dernier
# maillon, et il portait encore le piège à lui seul : un refus RLS y touche zéro
# ligne SANS erreur, la cascade voyait toutes ses étapes vertes, et l'écran
# disait « renommé partout ». Trouvé par la revue, pas par la relecture.
for nom, signature, cle in [
    ("renameLabel", "export async function renameLabel(", "listeRefusee"),
    ("deleteLabel", "export async function deleteLabel(", "listeRefusee"),
    ("renameConversionCategory",
     "export async function renameConversionCategory(", "listeRefusee"),
    ("deleteConversionCategory",
     "export async function deleteConversionCategory(", "listeRefusee"),
]:
    corps = pulse.corps(CODE, signature)
    t.ok(f"`{nom}` compte les lignes de son étape maîtresse",
         re.search(r'\.select\("(id|name)"\);?\s*\n\s*if \((maj|sup)\.error\)', corps))
    t.ok(f"`{nom}` traite le zéro ligne de son étape maîtresse",
         "length === 0" in corps and cle in corps)
    t.ok(f"`{nom}` dit autre chose qu'un arrêt ordinaire sur ce refus-là",
         re.search(r"%s\s*\n?\s*\?" % cle, corps))

# Et ce refus-là ne se DIAGNOSTIQUE pas : sur les catégories on relit, sur les
# thèmes on ne dit que ce qu'on a lu — le compte de lignes, pas la raison.
MUETTE = pulse.corps(CODE, "async function categorieMuette(")
t.ok("`categorieMuette` relit avant de parler", 'select("name")' in MUETTE)
t.ok("`categorieMuette` distingue « disparue » de « refusée »",
     "ne s'appelle plus" in MUETTE and "n'a pas accepté" in MUETTE)
t.ok("le refus sur la liste des thèmes dit que le RESTE est écrit",
     "Tout le reste est écrit" in A)
t.ok("et il n'invente pas la raison du refus",
     "n'a pas accepté cette écriture-là" in A)

# La lecture qui SERT DE BASE à l'écriture de la liste maîtresse est vérifiée :
# `_labels` replie un SELECT en échec sur `[]`, et écrire `labels: []` effacerait
# TOUS les thèmes du compte.
for nom, signature in [
    ("renameLabel", "export async function renameLabel("),
    ("deleteLabel", "export async function deleteLabel("),
]:
    corps = pulse.corps(CODE, signature)
    t.ok(f"`{nom}` relit la liste maîtresse dans l'étape qui l'écrit",
         "const { data: liste, error } = await _labels(supabase, user.id);" in corps)
    t.ok(f"`{nom}` refuse d'écrire sur une lecture ratée",
         "if (error) return error;" in corps)
t.ok("`renameLabel` refuse aussi de DÉCIDER sur une lecture ratée",
     "if (lectureError)" in pulse.corps(CODE, "export async function renameLabel("))
t.ok("`_categories` rend son erreur comme `_labels`",
     "error: r.error," in pulse.corps(CODE, "async function _categories("))

# Le renommage d'une catégorie propage AVANT d'écrire la liste maîtresse, et
# l'inverse rendait l'arrêt irrattrapable — plus aucune ligne ne répond à
# `name = oldName`, donc relancer ne peut plus finir.
RCC = pulse.corps(CODE, "export async function renameConversionCategory(")
t.ok("les événements sont renommés avant la liste des catégories",
     RCC.index('"événements classés"') < RCC.index('"liste des catégories"'))

# La boucle sur les posts Instagram : une LECTURE ratée ne vaut pas « aucun
# post ». Sans ce garde l'étape restait verte en ayant sauté tous les posts.
for nom, signature in [
    ("renameLabel", "export async function renameLabel("),
    ("deleteLabel", "export async function deleteLabel("),
]:
    corps = pulse.corps(CODE, signature)
    t.ok(f"`{nom}` arrête l'étape Instagram sur une lecture ratée",
         "if (posts.error) return posts.error;" in corps)
    t.ok(f"`{nom}` arrête l'étape Instagram sur une écriture ratée",
         "if (r.error) return r.error;" in corps)

# ── 5 · LE MODULE DE CASCADE EST PUR — c'est ce qui le rend jouable ────────
t.ok("`lib/cascade.ts` n'a aucune directive",
     '"use client"' not in pulse.sans_commentaires(CASCADE)
     and '"use server"' not in pulse.sans_commentaires(CASCADE))
t.ok("`lib/cascade.ts` n'importe rien", "import " not in pulse.sans_commentaires(CASCADE))
t.ok("`lib/cascade.ts` ne connaît pas Supabase", "supabase" not in CASCADE.lower())
t.ok("`lib/cascade.ts` écrit pourquoi ce n'est PAS une fonction SQL",
     "SECURITY DEFINER" in CASCADE)
t.ok("`actions.ts` importe le module partagé", 'from "@/lib/cascade"' in CODE)

# ── 6 · L'AUTRE MOITIÉ DU DÉFAUT : L'ÉCRAN JETAIT LA RÉPONSE ───────────────
#
# Corriger l'action sans lire sa réponse n'aurait RIEN changé pour le client :
# les quatre écrans concernés faisaient `await action(…)` sans en rien faire.

ECRANS = {
    "equipe-manager.tsx": (pulse.SOURCE_EQUIPE,
                           ["changerRoleMembre", "revoquerMembre"]),
    "objectif-select.tsx": (pulse.SOURCE_OBJECTIF, ["saveObjectif"]),
    "budget-editor.tsx": (pulse.SOURCE_BUDGET, ["saveBudget"]),
    "label-manager.tsx": (pulse.SOURCE_LABELS, ["deleteLabel"]),
}
for fichier, (chemin, appels) in ECRANS.items():
    src = pulse.sans_commentaires(pulse.lire(chemin))
    for appel in appels:
        t.ok(f"{fichier} ne jette plus la réponse de `{appel}`",
             not re.search(r"^\s*await %s\(" % appel, src, re.M))
        t.ok(f"{fichier} capture la réponse de `{appel}`",
             re.search(r"const r = await %s\(" % appel, src))
    t.ok(f"{fichier} a de quoi afficher un échec", "echec" in src)

BUDGET = pulse.sans_commentaires(pulse.lire(pulse.SOURCE_BUDGET))
t.ok("« ✓ enregistré » ne s'écrit plus sans avoir regardé",
     "setSaved(r.ok)" in BUDGET and "setSaved(true)" not in BUDGET)
OBJ = pulse.sans_commentaires(pulse.lire(pulse.SOURCE_OBJECTIF))
t.ok("la date de prise en compte ne s'écrit plus sur un refus",
     "setEchec(!r.ok)" in OBJ and "r.ok ? (quand ? prisEnCompteLe(quand)" in OBJ)

# ── 7 · LES REPLIS NE MENTENT PLUS NON PLUS ────────────────────────────────
#
# Une seconde chance qui rate est un échec. Ces replis étaient nus : les DEUX
# tentatives pouvaient rater et l'action répondait `{ ok: true }`.
for nom, signature in [
    ("saveRecoFeedback", "export async function saveRecoFeedback("),
    ("saveComment", "export async function saveComment("),
    ("setCampaignLabel", "export async function setCampaignLabel("),
    ("setPostLabel", "export async function setPostLabel("),
]:
    corps = pulse.corps(CODE, signature)
    t.ok(f"`{nom}` lit l'erreur de son repli", "repli.error" in corps)
for nom, signature in [
    ("saveInsightFeedback", "export async function saveInsightFeedback("),
    ("togglePriorityLabel", "export async function togglePriorityLabel("),
    ("saveBudget", "export async function saveBudget("),
    ("startTracking", "export async function startTracking("),
]:
    corps = pulse.corps(CODE, signature)
    t.ok(f"`{nom}` lit l'erreur de son écriture", re.search(r"\br\.error|retire\.error", corps))

ST = pulse.corps(CODE, "export async function startTracking(")
t.ok("`startTracking` relit avant de dire pourquoi rien n'a été retiré",
     'select("status")' in ST and "DEJA[" in ST)
t.ok("`startTracking` ne se plaint pas quand l'état voulu est déjà atteint",
     "if (!reste.error && ligne)" in ST)

# ── 8 · AUCUN CHIFFRE, AUCUN FAIT FABRIQUÉ DANS LES NOUVEAUX MESSAGES ──────
#
# `CLAUDE.md` §7 : ce qu'on n'a pas lu ne s'affirme pas. Un message d'échec ne
# doit ni compter des lignes qu'il n'a pas comptées, ni promettre une
# réparation qui n'existe pas.
NOUVEAUX = [
    "Cet accès n'existe plus", "Cet accès avait déjà été retiré",
    "ne t'autorise pas à écrire", "Ce compte n'est plus accessible",
]
for m in NOUVEAUX:
    t.ok(f"« {m} » est bien dans le code", m in A)
t.ok("aucun message ne promet une réparation automatique",
     not re.search(r"(répar|corrig)\w*\s+(automatiqu|tout seul)", A, re.I))

# ── 9 · LA PROPRIÉTÉ EXÉCUTÉE ──────────────────────────────────────────────
print("\n── lib/cascade.ts, joué pour de bon ──")
node = subprocess.run(["node", str(Path(__file__).parent / "verifier_cascade.js")],
                      capture_output=True, text=True)
print(node.stdout.strip())
if node.returncode:
    print(node.stderr.strip())
t.ok("les 23 vérifications de `verifier_cascade.js` passent", node.returncode == 0)

sys.exit(0 if t.bilan("Ticket 19 — les écritures qui se relisent") else 1)
