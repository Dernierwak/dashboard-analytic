"""Le petit vérificateur : pas de runner dans le dépôt (ticket 16 pas encore fait)."""
_N, _KO = 0, []


def ok(nom, condition, detail=""):
    global _N
    _N += 1
    if not condition:
        _KO.append(f"{nom} — {detail}")


def egal(nom, obtenu, attendu):
    ok(nom, obtenu == attendu, f"obtenu {obtenu!r}, attendu {attendu!r}")


def proche(nom, obtenu, attendu, marge=0.011):
    if obtenu is None or attendu is None:
        egal(nom, obtenu, attendu)
        return
    ok(nom, abs(float(obtenu) - float(attendu)) <= marge,
       f"obtenu {obtenu!r}, attendu {attendu!r}")


def bilan(titre):
    print(f"\n{titre} : {_N - len(_KO)}/{_N} vérifications passent")
    for m in _KO:
        print(f"  ✗ {m}")
    return not _KO
