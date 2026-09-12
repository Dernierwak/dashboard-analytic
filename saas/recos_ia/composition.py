"""La composition de la semaine : cinq conseils au maximum, sur tout le compte.

Module PUR — aucune lecture, aucune écriture, aucun appel réseau. Il reçoit des
conseils déjà classés et rend ceux qui sortent. Même patron que
`regles_payantes.py` : ce qui se teste sans base vit ici.

Tranché par `.scratch/refonte/issues/11-d-ou-viennent-les-conseils.md` (le
plafond) et `.scratch/refonte/issues/14-le-conseil-facile-et-la-degradation.md`
(sa composition et l'empreinte), bâti par
`.scratch/construction/issues/08-filtre-dur-et-plafond-de-cinq.md`.

CE QUI N'EST PAS ICI, ET C'EST LE POINT LE PLUS IMPORTANT : le filtre des
thèmes. Un conseil ne naît QUE sur un thème que le client a mis en priorité —
ça se décide à la source, dans `build_payload`, en ne faisant pas tourner les
règles ailleurs. Ce module ne voit donc jamais un conseil hors priorité, et il
n'a aucun moyen d'en fabriquer un : **un plafond, jamais un quota.**
"""

# Cinq, sur TOUT le compte et tous thèmes confondus. Avant, c'était trois par
# thème sur un nombre de thèmes illimité — six thèmes étoilés donnaient jusqu'à
# dix-huit conseils. David : « dix minutes le lundi matin ne tiennent pas
# dix-huit conseils ».
PLAFOND_SEMAINE = 5

# LES DEUX PLAFONDS DE COMPOSITION, ET POURQUOI CE SONT DES PLAFONDS.
#
# Un PLANCHER (« au moins une retouche facile chaque semaine ») serait
# invérifiable la plupart des semaines — il n'y a qu'une poignée de candidats en
# stock — et un plancher qu'on ne peut pas tenir se remplit de décor. Un plafond
# se respecte toujours : il suffit d'arrêter de servir.
#
#   · MARCHES — une Marche est le pas suivant d'une Stratégie (`role`
#     « hypothese ») : elle ouvre un plan de thème et attend son Verdict. Une à
#     deux par semaine, jamais plus : trois théories en vol la même semaine, et
#     aucune ne se suit.
#   · LOURDS — un geste de fabrication (`créer`, `corriger`) qui demande une
#     heure ou plus. Deux au maximum : une semaine de trois demandes de
#     fabrication d'affilée est très exactement celle que David décrit comme
#     dégoûtante.
MAX_MARCHES = 2
MAX_LOURDS = 2

GESTES_LOURDS = ("créer", "corriger")
EFFORTS_LOURDS = ("1 h", "2 h+")


def empreinte(reco: dict) -> tuple[str, str]:
    """L'identité d'une instruction : sa CLÉ et sa CIBLE.

    David, mot pour mot : « mettre un objectif de CPC à X, dans deux semaines on
    peut refaire une reco mettre CPC objectif à X. Le X ne sera pas le même. […]
    On ne fait cependant pas revenir la même reco qui change exactement la même
    chose. » Même clé, cible différente → c'est une nouvelle Marche, elle passe.
    Même clé ET même cible qu'une semaine déjà servie → elle ne repasse pas.

    La CLÉ RESTE DANS L'EMPREINTE : la recommandation qui voulait l'en sortir a
    été renversée par David, et elle ne se re-propose pas. Sans elle, deux
    règles différentes visant la même campagne auraient la même empreinte et se
    seraient mutuellement muselées.
    """
    return (str(reco.get("key") or ""),
            str(reco.get("cible") or "").strip().lower())


def _est_lourd(reco: dict) -> bool:
    return (reco.get("nature") in GESTES_LOURDS
            and reco.get("effort") in EFFORTS_LOURDS)


def composer_la_semaine(conseils: list[dict],
                        deja_servies=(),
                        epinglees=()) -> list[dict]:
    """Les ≤ 5 conseils de la semaine, pris dans l'ordre où on les reçoit.

    `conseils` arrive DÉJÀ CLASSÉ par importance (`_importance`, dans
    `build_report.py`) : ce module ne re-trie rien, il coupe. Le tri connaît le
    rang du thème dans le compte, qui ne se calcule pas ici.

    `deja_servies` : les empreintes déjà servies dans un rapport publié.
    `epinglees`    : les empreintes exemptées de cette règle — la Marche d'une
                     Stratégie en cours se RÉAFFICHE exprès, à l'identique, tant
                     que son Verdict n'est pas tombé ; c'est le seul cas où
                     répéter est le comportement voulu.
    """
    deja, epingle = set(deja_servies), set(epinglees)
    retenus: list[dict] = []
    marches = lourds = 0
    for r in conseils:
        if len(retenus) >= PLAFOND_SEMAINE:
            break
        emp = empreinte(r)
        if emp in deja and emp not in epingle:
            continue
        marche = r.get("role") == "hypothese"
        if marche and marches >= MAX_MARCHES:
            continue
        lourd = _est_lourd(r)
        if lourd and lourds >= MAX_LOURDS:
            continue
        retenus.append(r)
        marches += 1 if marche else 0
        lourds += 1 if lourd else 0
    return retenus
