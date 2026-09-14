"""Ce que reçoit un compte à 0, 1, 2, 3 et 4 étoiles — mesuré, pas raconté.

CE N'EST PAS UN TEST, et c'est pour ça qu'il ne s'appelle pas `test_*.py` :
`jouer_tout.py` ne ramasse que ces derniers. Ce fichier n'affirme rien, il
AFFICHE. C'est la consigne de repli du ticket
[26](../../issues/26-les-regles-payantes-n-atteignent-pas-le-rapport.md) :
*« rendre la mesure et rien d'autre »*.

POURQUOI IL EXISTE. Le ticket 26 relevait une porte invisible : tant qu'un
client avait trois étoiles ou moins, ses trois places allaient aux pistes
rédigées par Gemini, et PAS UN conseil-règle n'atteignait le rapport — ni
`roas`, ni les quatre `orga_*`, ni les quatre règles payantes du ticket 07.
Le ticket 08 a coupé les pistes rédigées, donc la porte avec elles. Ce fichier
est ce qui le montre au lieu de l'affirmer : la colonne « 1 étoile » affichait
zéro conseil, elle en affiche deux.

Il emprunte le seam du ticket 16 (`saas/traitement/lecteur.py`) : `build_payload`
tourne sur un lecteur figé, sans base, sans secret, sans réseau.

    python3.12 mesure.py
"""
import sys
from datetime import date
from pathlib import Path

# Le faux lecteur du ticket 16 : on ne le recopie pas, on l'emprunte — deux
# gréements du même compte divergeraient au premier changement de schéma.
SEAM = Path(__file__).resolve().parent.parent / "16-le-seam-du-payload"
sys.path.insert(0, str(SEAM))

import pulse  # noqa: F401,E402  (rend `saas/` importable)
from lecteur_fige import compte, Campagne, Annonce  # noqa: E402
from saas.traitement.build_report import build_payload  # noqa: E402

# La date est FIGÉE. La fenêtre du rapport finit à la dernière donnée et
# n'atteint jamais aujourd'hui (ticket 13) : une mesure datée du jour où on la
# joue ne se compare à aucune autre.
AUJOURD_HUI = date(2026, 9, 13)
NOMS = ["Été", "Hiver", "Printemps", "Automne"]


def campagne(theme):
    """Une campagne Google qui dépense assez pour être jugée, et deux Annonces
    d'un même Groupe dont une seule convertit — de quoi faire parler au moins
    une règle payante du ticket 07 sur CHAQUE thème, ce qui est le point."""
    annonces = [Annonce(f"{theme} · visuel A", "Groupe 1", 140, 350, 14000, 7),
                Annonce(f"{theme} · visuel B", "Groupe 1", 70, 175, 7000, 0)]
    return Campagne(f"{theme} – Search", theme=theme, depense_jour=30.0,
                    clics_jour=100, impressions_jour=4000, revenu_jour=40.0,
                    annonces=annonces)


def mesurer(n_etoiles: int) -> None:
    etoiles = NOMS[:n_etoiles]
    payload = build_payload(compte([campagne(x) for x in NOMS],
                                   etoiles=etoiles, aujourd_hui=AUJOURD_HUI))
    cartes = {t["label"]: t for t in payload["themes_focus"]}
    total = 0

    print(f"\n=== {n_etoiles} ÉTOILE(S) : {etoiles or '—'} ===")
    print(f"  cartes rendues : {sorted(cartes) or '—'}")
    for lbl in NOMS:
        carte = cartes.get(lbl)
        if carte is None:
            print(f"  · {lbl:<10} pas de carte")
            continue
        # Une veille ne demande aucun geste : elle reste sur la carte de son
        # thème et ne prend aucune des cinq places (`build_report.py`, le
        # plafond de cinq). La compter ici gonflerait la mesure.
        conseils = [r for r in carte["recos"] if not r.get("veille")]
        veilles = [r for r in carte["recos"] if r.get("veille")]
        total += len(conseils)
        marque = "conseillé" if carte["conseille"] else "NON conseillé"
        print(f"  · {lbl:<10} {marque:<14} conseils={len(conseils)} "
              f"{[r['key'] for r in conseils]}")
        if veilles:
            print(f"    {'':<10} (+ veille, hors plafond) "
                  f"{[r['key'] for r in veilles]}")

    # Le socle (`reglages`) est hors plafond lui aussi : `page_arrivee_muette`
    # répare la MESURE dont les autres conseils dépendent, elle ne concourt pas
    # avec eux (ticket 24).
    socle = [r["key"] for r in (payload.get("reglages") or [])]
    print(f"  socle (réglages, hors plafond) : {socle}")
    print(f"  >>> CONSEILS SERVIS SUR TOUT LE COMPTE : {total}")


if __name__ == "__main__":
    for n in range(0, 5):
        mesurer(n)
