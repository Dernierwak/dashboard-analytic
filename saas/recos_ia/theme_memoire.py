"""Mémoire d'un thème — la SECONDE couche du Plan de thème.

La première couche (`theme_plan.reco_key/levier/decided_at/snapshot`) porte
l'ÉTAT courant : quelle hypothèse tourne en ce moment. Elle est déterministe
et sert à bloquer une nouvelle hypothèse tant que la précédente n'a pas rendu
son verdict.

Ce module porte la seconde : un résumé narratif d'une à deux phrases, par
(user_id, thème), qui dit ce que ce thème a déjà TENTÉ, sur quels leviers, et
ce que ça a donné. Il est injecté dans le prompt qui rédige les pistes du
thème — sans lui, Pulse pouvait proposer une troisième hypothèse « argent »
sur un thème où les deux premières avaient été mesurées `worse` (spec
`.scratch/theme-memoire/spec.md`).

DEUX CONTRAINTES STRUCTURANTES, pas des garde-fous décoratifs :

1. L'IA REFORMULE, ELLE NE CALCULE PAS. `build_prompt` ne reçoit que des
   valeurs DÉJÀ calculées par `build_report.py` (verdict, baseline, valeur
   constatée, variation). Aucune donnée brute à agréger n'entre ici, donc
   aucun chiffre ne peut être fabriqué (`CLAUDE.md` § 7).
2. LA CADENCE EST ÉVÉNEMENTIELLE, pas hebdomadaire. C'est la différence à ne
   pas rater avec `user_persona.py`, dont ce module copie par ailleurs le
   patron : le profil client vivant est recalculé à CHAQUE rapport, cette
   mémoire-ci seulement quand un NOUVEAU verdict tombe sur le thème — le seul
   instant où elle change réellement. Le coût IA suit le nombre de verdicts,
   pas le nombre de rapports.

Module headless comme `user_persona.py` : on lui passe
`call_ai(prompt) -> str|None` (dans le rapport, c'est `_call_gemini`). Aucun
import de Gemini ici — c'est ce qui permet de le faire tourner hors ligne avec
un faux appel qui capture le prompt.
"""

from __future__ import annotations

from saas.commun.insert_data import save_theme_resume

# Ce qu'une hypothèse passée porte, tel que `build_report.py` le fournit —
# jamais recalculé ici. `levier` peut manquer : les hypothèses écrites avant
# que `detail.levier` soit posé n'en ont pas, et on ne le devine pas depuis
# l'indicateur (ce serait un chiffre — ici un fait — fabriqué).
_LEVIER_INCONNU = "levier inconnu"


def _ligne_historique(item: dict) -> str:
    """Une hypothèse passée, en une ligne de prompt. Chaque nombre écrit ici
    vient tel quel de `item` — c'est cette fonction qui rend vérifiable par
    simple lecture qu'aucun chiffre n'est inventé."""
    titre = str(item.get("titre") or "hypothèse sans titre").strip()
    levier = str(item.get("levier") or "").strip() or _LEVIER_INCONNU
    bits = [f"levier {levier}"]
    if item.get("decided_at"):
        bits.append(f"décidée le {item['decided_at']}")
    if item.get("check_at"):
        bits.append(f"échéance {item['check_at']}")
    if item.get("verdict"):
        bits.append(f"verdict {item['verdict']}")
    mesure = _mesure_txt(item)
    if mesure:
        bits.append(mesure)
    return f"- « {titre} » : " + ", ".join(bits)


def _mesure_txt(item: dict) -> str:
    """Le triplet mesuré (départ / constaté / variation), s'il existe.

    Une mesure absente n'est PAS un zéro (`CLAUDE.md` § 7) : on n'écrit rien
    plutôt que d'écrire « 0 % », et le prompt dit à l'IA de ne rien affirmer
    au-delà des lignes fournies."""
    depart, constate = item.get("depart"), item.get("constate")
    if depart is None or constate is None:
        return ""
    indicateur = str(item.get("indicateur") or "").strip()
    txt = f"{indicateur} passé de {depart} à {constate}" if indicateur \
        else f"passé de {depart} à {constate}"
    if item.get("variation") is not None:
        txt += f" ({item['variation']:+.1f} %)"
    return txt


def build_prompt(theme: str, historique: list[dict]) -> str:
    """Le prompt de condensation. Pure — aucun accès base, aucun appel IA.

    Séparée de `condense_theme_memoire` pour qu'on puisse l'inspecter dans un
    test : la propriété qui protège la règle « aucun chiffre fabriqué » est
    que la chaîne rendue ne contient aucun nombre absent de `historique`."""
    # LES DOUZE DERNIÈRES, PAS LES DOUZE PREMIÈRES. `historique` arrive dans
    # l'ordre de `suivi_actions` (`.order("check_at")`, croissant) : le plus
    # ancien d'abord. Un `[:12]` aurait gardé les hypothèses les plus VIEILLES
    # et jeté celles dont le verdict vient de tomber — la mémoire aurait décrit
    # exactement ce qui n'intéresse plus personne.
    lignes = "\n".join(_ligne_historique(h) for h in historique[-12:])
    return (
        "Tu tiens la MÉMOIRE d'un thème de communication pour un dashboard "
        f"marketing de PME. Le thème est « {theme} ».\n\n"
        "Voici les hypothèses déjà testées sur ce thème, avec leur verdict "
        "mesuré (better = l'indicateur a bougé dans le bon sens, worse = dans "
        "le mauvais, stable = il n'a pas bougé de façon mesurable) :\n"
        f"{lignes}\n\n"
        "Écris en 1 à 2 phrases où en est ce thème : combien d'hypothèses ont "
        "été tentées, sur quels leviers, et ce que ça a donné. Si un levier "
        "n'a jamais été essayé sur ce thème, tu peux le dire — mais seulement "
        "d'après la liste ci-dessus. Les quatre leviers possibles sont "
        "argent, contenu, tempo, audience.\n"
        "RÈGLES ABSOLUES : reformule les chiffres ci-dessus, n'en produis "
        "AUCUN autre, ne calcule rien, n'affirme rien qui ne soit écrit dans "
        "ces lignes. Ne confonds pas « aucune hypothèse encore testée » et "
        "« des hypothèses testées sans effet mesuré » (verdict stable) — ce "
        "n'est pas la même chose. Une hypothèse dont le levier est inconnu "
        "reste inconnue, ne lui en attribue aucun.\n"
        "Français, ton factuel, pas d'intro, pas de guillemets autour de ta "
        "réponse."
    )


def condense_theme_memoire(client, user_id, theme: str, call_ai,
                           historique: list[dict] | None) -> str | None:
    """Réécrit la mémoire du thème et la rend. `None` si rien n'a été écrit.

    Appelée UNIQUEMENT à la chute d'un nouveau verdict (voir la boucle de
    verdict de `build_report.py`), une fois par thème concerné — jamais une
    fois par ligne, jamais à chaque rapport.

    Trois replis, alignés sur le reste du produit — une panne de mémoire ne
    prive jamais le client de son rapport :
    · pas de matière (aucune hypothèse passée) → aucun appel IA, `resume`
      reste tel quel ;
    · l'IA échoue ou n'a pas de clé → le `resume` précédent est CONSERVÉ,
      jamais écrasé par du vide ;
    · l'écriture échoue (colonnes pas encore migrées, refus RLS) → silencieuse,
      le rapport continue.
    """
    if not (client and user_id and theme and callable(call_ai)):
        return None
    if not historique:
        return None  # rien à raconter — surtout pas un appel IA à vide
    resume = call_ai(build_prompt(theme, historique))
    if not resume:
        return None  # l'IA a échoué → on garde la mémoire déjà stockée
    resume = resume.strip()
    if not save_theme_resume(client, user_id, theme, resume):
        return None  # rien n'a été écrit : ne pas prétendre le contraire
    return resume
