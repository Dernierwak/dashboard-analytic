"""Ticket 37 : la mémoire d'un thème lisait les 200 notes les plus VIEILLES.

Trois choses à prouver, et la troisième est celle qui compte :
 1. la requête demande `desc=True` — sans lui, PostgREST rend les plus vieilles ;
 2. ce qui sort est rendu du plus ANCIEN au plus RÉCENT, parce que tout le code
    en aval coupe par la fin (`faits[-8:]`, `historique[-12:]`) ;
 3. bout à bout, les huit faits donnés à Gemini sont les huit DERNIERS.
"""
import pulse  # noqa: F401  (pose `saas/` dans sys.path)
import t
from faux_sb import FauxSupabase
from saas.traitement.lecteur import LecteurSupabase
from saas.recos_ia.theme_memoire import build_prompt

COMPTE = "11111111-1111-4111-8111-111111111111"


def en_fait(ligne):
    """La mise en forme que `build_report.py` applique avant `build_prompt`."""
    return {"jour": str(ligne["decided_at"])[:10], "texte": ligne["title"]}


def notes(n):
    """`n` notes, de la plus VIEILLE à la plus récente — l'ordre chronologique."""
    return [{"title": f"note {i:03d}", "theme": "E-bike",
             "decided_at": f"2025-{1 + i // 28:02d}-{1 + i % 28:02d}"}
            for i in range(n)]


def main():
    # PostgREST rend les lignes DANS L'ORDRE DEMANDÉ : avec `desc=True`, la plus
    # récente d'abord. Le faux client le reproduit, sinon il prouverait le
    # contraire de ce qui se passe en vrai.
    toutes = notes(500)

    sb = FauxSupabase(list(reversed(toutes))[:200])
    lecteur = LecteurSupabase(sb, COMPTE)
    rendu = lecteur.notes_archivees()

    # ── 1) La demande ───────────────────────────────────────────────────────
    t.egal("la requête trie sur `decided_at` en DESCENDANT",
           sb.journal["order"], [("decided_at", True)])
    t.egal("elle plafonne à 200", sb.journal["limite"], 200)
    t.egal("elle ne lit que les notes archivées de ce compte",
           sb.journal["eq"],
           [("user_id", COMPTE), ("kind", "note"), ("status", "archived")])

    # ── 2) Ce qui sort ──────────────────────────────────────────────────────
    t.egal("200 notes rendues", len(rendu), 200)
    t.egal("la PREMIÈRE rendue est la 300ᵉ — pas la note 000",
           rendu[0]["title"], "note 300")
    t.egal("la DERNIÈRE rendue est la plus récente du compte",
           rendu[-1]["title"], "note 499")
    t.ok("l'ordre rendu est chronologique croissant",
         all(rendu[i]["decided_at"] <= rendu[i + 1]["decided_at"]
             for i in range(len(rendu) - 1)),
         "une note est rendue avant une plus vieille")

    # ── 3) Ce que Gemini reçoit ─────────────────────────────────────────────
    # `build_report` ne passe pas les lignes brutes : il les remet en forme
    # (`title` → `texte`, `decided_at` → `jour`) avant `build_prompt`. Le
    # harnais refait le même geste — passer les lignes brutes rendrait un
    # prompt de notes VIDES qui aurait l'air de passer.
    prompt = build_prompt("E-bike", [], [en_fait(r) for r in rendu])
    t.ok("les huit DERNIÈRES notes sont dans le prompt",
         all(f"note {i}" in prompt for i in range(492, 500)),
         "une des huit dernières manque")
    t.ok("aucune note du lot périmé n'y entre",
         "note 000" not in prompt and "note 199" not in prompt,
         "une note ancienne est encore citée")

    # ── Le témoin : la coupe d'avant rendait exactement l'inverse ────────────
    ancien = [en_fait(r) for r in toutes[:200]]
    t.egal("TÉMOIN — l'ancienne requête gardait la note 000",
           ancien[0]["texte"], "note 000")
    t.ok("TÉMOIN — et Gemini n'aurait jamais vu la note 499",
         "note 499" not in build_prompt("E-bike", [], ancien),
         "le témoin ne reproduit pas le défaut")

    return t.bilan("Les notes les plus récentes")


if __name__ == "__main__":
    import sys
    sys.exit(0 if main() else 1)
