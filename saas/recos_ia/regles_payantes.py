"""Les conseils payants qui descendent SOUS la campagne — déterministe, zéro IA.

POURQUOI CE FICHIER EXISTE. On récolte chaque jour le détail annonce par
annonce, Meta et Google, et jusqu'ici aucune règle de conseil ne le lisait :
`grep ad_name` ne renvoyait rien sur les trois moteurs. Un compte qui ne fait
que de la publicité recevait donc UN conseil par semaine — `roas`, et lui seul
(mesuré dans `.scratch/refonte/issues/22-rebrancher-le-plan-de-theme.md`).
Ces quatre règles ferment ce trou, et elles le ferment sans récolte nouvelle ni
migration : la donnée était déjà en base.

CE QUI CHANGE D'ÉCHELLE. À l'intérieur d'un thème, la campagne n'a plus
personne à qui se comparer — on l'a justement filtrée. L'unité de comparaison
devient l'**Annonce** et le **Groupe d'annonces** (`CONTEXT.md`). C'est aussi
pour ça que `_rule_gaspillage` et `_rule_scaler`, qui comparaient à la médiane
des campagnes, ne pouvaient pas être rebranchés tels quels.

AUCUN SEUIL N'EST INVENTÉ ICI : tous sortent de `SEUILS` (`reco_engine.py`),
déjà calibrés et déjà en service ailleurs. Une règle qui aurait eu besoin d'un
nombre neuf attend de voir tourner un vrai compte
(`.scratch/construction/issues/10-six-regles-payantes-restantes.md`).

LES DEUX GARDE-FOUS DU GESTE « COUPER », posés par David
(`.scratch/refonte/issues/24-conseils-payants-manquants.md`, décision 4) :
  · **jamais sur une campagne jeune** — un test a le droit d'être mauvais le
    temps de tourner, et rien en base ne dit qu'une campagne EST un test :
    l'âge est le seul proxy honnête ;
  · **jamais fondé sur une part de budget** — seulement sur un résultat mesuré.
Le second se lit dans le code : aucune des règles ci-dessous ne regarde ce
qu'une annonce pèse dans le budget, elles regardent toutes ce qu'elle a rendu.

CE MODULE EST PUR. Il prend des listes de dicts, il rend des dicts : ni base,
ni réseau, ni pandas, ni notion de thème au-delà de son nom dans les phrases.
C'est l'appelant (`saas/traitement/build_report.py`) qui sait rattacher une
annonce à un thème — même partage que `_orga_recos` et `_reco_evenements`.
"""

from statistics import median

from .reco_engine import SEUILS, _reco


def _cpc(a: dict) -> float:
    clics = int(a.get("clics") or 0)
    return float(a.get("depense") or 0) / clics if clics > 0 else 0.0


def _ctr(a: dict) -> float:
    im = int(a.get("impressions") or 0)
    return int(a.get("clics") or 0) / im * 100 if im > 0 else 0.0


def _nom(a: dict) -> str:
    return str(a.get("nom") or "")[:40]


def _designe(annonce: dict, reco: dict) -> dict:
    """Note QUELLE Annonce ce conseil nomme, pour que l'orchestrateur puisse
    voir quand deux règles parlent de la même.

    Clé PRIVÉE : `_annonce` n'est pas dans `RECO_FIELDS`, donc `_strip_reco`
    (`saas/traitement/build_report.py`) ne la recopie pas dans le payload. Elle
    ne sort jamais de ce module ni de son appelant immédiat.
    """
    reco["_annonce"] = annonce.get("cle")
    return reco


def _par_groupe(annonces: list[dict]) -> list[list[dict]]:
    """Les Annonces rangées par Groupe d'annonces, groupes d'au moins deux.

    LA SEULE UNITÉ OÙ DEUX ANNONCES SONT VRAIMENT COMPARABLES, et c'est un
    défaut trouvé en revue de code : les trois règles ci-dessous comparaient
    d'abord toutes les Annonces du thème entre elles. Un thème qui tourne sur
    Google Search ET sur Display, ou sur Meta ET Google une fois la migration
    du ticket 03 jouée, n'a pas un prix du clic ni un taux de clic — il en a
    deux, et ils n'ont rien à voir :

      · un clic Search se paie plusieurs fois un clic Display ou Meta ;
      · un taux de clic Search tourne entre 3 et 10 %, un taux de clic sur un
        fil social autour de 1 %.

    L'annonce la plus chère du thème était donc mécaniquement une annonce
    Search, et la « locomotive » aussi — le ratio mesurait le MÉLANGE DE
    CANAUX, pas la créa. À `ctr_ratio = 1.5`, la règle de la locomotive aurait
    désigné la même annonce Search toutes les semaines.

    Deux Annonces d'un même Groupe, elles, partagent leur audience, leur
    placement et leur enchère : ce qui les sépare est ce qu'elles montrent.
    C'est exactement ce que le champ `pourquoi` de ces règles affirme — et
    c'est maintenant vrai.

    Une Annonce sans Groupe connu n'entre dans aucune comparaison : on ne sait
    pas contre qui elle courait.
    """
    groupes: dict = {}
    for a in annonces:
        g = str(a.get("groupe") or "").strip()
        if g:
            groupes.setdefault((a.get("canal"), g), []).append(a)
    return [v for v in groupes.values() if len(v) >= 2]


# ── 1 · L'ANNONCE QUI COÛTE CHER ─────────────────────────────────────────────

def regle_annonce_chere(theme: str, annonces: list[dict]) -> dict | None:
    """Une Annonce paie son clic bien plus cher que ses voisines du même thème.

    LA COMPARAISON SE FAIT DANS UN GROUPE D'ANNONCES, jamais sur tout le thème
    — voir `_par_groupe`.

    Les annonces des campagnes JEUNES sortent de la comparaison des deux côtés —
    candidate et médiane. Pas seulement parce qu'on ne coupe pas un test : une
    campagne en apprentissage paie ses premiers clics plus cher, la laisser dans
    la médiane remonterait le repère et masquerait la vraie annonce chère.

    Quand plusieurs Groupes ont chacun leur annonce chère, on ne sert que celle
    qui COÛTE LE PLUS : trois fois le même conseil sur trois Groupes remplirait
    la carte du thème, et c'est l'argent en jeu qui décide lequel se lit.
    """
    candidats = []
    for groupe in _par_groupe(annonces):
        comparables = [a for a in groupe
                       if not a.get("jeune") and int(a.get("clics") or 0) > 0]
        if len(comparables) < 2:
            continue  # une seule annonce n'a personne à qui se comparer
        mediane = median(_cpc(a) for a in comparables)
        if mediane <= 0:
            continue
        pire = max(comparables, key=_cpc)
        if (_cpc(pire) >= mediane * SEUILS["cpc_ratio"]
                and float(pire.get("depense") or 0) >= SEUILS["cpc_spend_min"]):
            candidats.append((pire, mediane, len(comparables)))
    if not candidats:
        return None

    pire, mediane, n_voisines = max(candidats,
                                    key=lambda c: float(c[0].get("depense") or 0))
    cpc = _cpc(pire)
    depense = float(pire["depense"])
    nom = _nom(pire)
    groupe_nom = str(pire.get("groupe") or "")[:40]
    return _designe(pire, _reco(
        "annonce_chere", pire.get("canal") or "pub",
        f"« {nom} » te coûte {cpc:.2f} CHF le clic, les autres {mediane:.2f}",
        f"Sur « {theme} », l'annonce « {nom} » a dépensé {depense:,.0f} CHF cette "
        f"semaine pour {int(pire['clics'])} clics, soit {cpc:.2f} CHF le clic — "
        f"{cpc / mediane:.1f}× la médiane des {n_voisines} annonces du Groupe "
        f"« {groupe_nom} » ({mediane:.2f} CHF).",
        "Ces annonces tournent dans le même Groupe : même audience, même "
        "placement, même enchère. Ce qui les sépare est donc ce qu'elles "
        "montrent — le visuel ou l'accroche, pas le ciblage.",
        f"Mets « {nom} » en pause dans le gestionnaire, et laisse les autres "
        "tourner. Si le coût par clic du thème redescend la semaine prochaine, "
        "c'est bien elle qui le tirait vers le haut.",
        "Je compare le prix du clic, pas ce qui se passe après : une annonce "
        "chère qui vend mieux que les autres reste rentable. Regarde ses "
        "conversions avant de la couper si tu les suis.",
        "solide", 1,
        repere="Le repère : c'est l'ÉCART DANS SON GROUPE qui compte, pas le "
               "montant. Une annonce au-dessus de 2× la médiane de ses voisines a "
               "un problème de créa ; un clic cher partagé par tout le Groupe est "
               "un problème d'audience, et ça ne se règle pas en coupant.",
        # Geste invariable : cette branche ne s'ouvre que sur une annonce
        # mesurée, hors campagne jeune. La pause se constate demain à l'œil.
        nature="couper", role="generale",
    ))


# ── 2 · L'ANNONCE LOCOMOTIVE ─────────────────────────────────────────────────

def regle_annonce_locomotive(theme: str, annonces: list[dict]) -> dict | None:
    """Une Annonce accroche nettement mieux que ses voisines → financer SON Groupe.

    LE GESTE DÉSIGNE LE GROUPE D'ANNONCES, JAMAIS L'ANNONCE : on ne finance pas
    une Annonce, ni chez Meta ni chez Google — le budget se pose au-dessus
    (`.scratch/refonte/issues/24-conseils-payants-manquants.md`, décision 1).
    Une annonce dont on ne connaît pas le Groupe ne peut donc rien demander.

    LA COMPARAISON SE FAIT DANS CE MÊME GROUPE, et c'est le défaut que la revue
    de code a trouvé — ici plus grave qu'ailleurs, parce que `ctr_ratio` ne vaut
    que 1,5 : un taux de clic Search (3 à 10 %) dépasse un taux de clic social
    (~1 %) sans qu'aucune créa n'y soit pour rien. La règle aurait désigné la
    même annonce Search chaque semaine et demandé de monter son budget de
    +20 % à chaque fois. Voir `_par_groupe`.

    Entre plusieurs Groupes qui ont chacun leur locomotive, on sert celle qui a
    été VUE LE PLUS : c'est le signal le moins fragile.
    """
    candidats = []
    for groupe_ads in _par_groupe(annonces):
        eligibles = [a for a in groupe_ads
                     if int(a.get("impressions") or 0) >= SEUILS["ctr_impressions_min"]]
        if len(eligibles) < 2:
            continue
        best = max(eligibles, key=_ctr)
        autres = [a for a in eligibles if a is not best]
        im_autres = sum(int(a.get("impressions") or 0) for a in autres)
        if im_autres <= 0:
            continue
        ctr_autres = sum(int(a.get("clics") or 0) for a in autres) / im_autres * 100
        if ctr_autres > 0 and _ctr(best) >= ctr_autres * SEUILS["ctr_ratio"]:
            candidats.append((best, ctr_autres, len(autres)))
    if not candidats:
        return None

    best, ctr_autres, n_autres = max(
        candidats, key=lambda c: int(c[0].get("impressions") or 0))
    ctr = _ctr(best)
    groupe = str(best.get("groupe") or "").strip()
    nom = _nom(best)
    return _designe(best, _reco(
        "annonce_locomotive", best.get("canal") or "pub",
        f"« {nom} » accroche {ctr / ctr_autres:.1f}× mieux que ses voisines",
        f"Sur « {theme} », dans le Groupe « {groupe[:40]} », « {nom} » fait "
        f"{ctr:.2f} % de clics sur {int(best['impressions']):,} impressions, "
        f"contre {ctr_autres:.2f} % pour les {n_autres} autres annonces du même "
        f"Groupe.",
        "Ces annonces sont montrées aux mêmes gens, au même endroit, à la même "
        "enchère : un écart d'accroche de cette taille veut dire que le message "
        "de celle-ci porte. C'est le moment de lui donner plus de place — "
        "doucement.",
        f"Monte le budget du Groupe « {groupe[:40]} » de +20 % maximum, puis "
        "attends 3 jours. Si le coût par clic ne s'envole pas, recommence. Un saut "
        "plus brutal relance l'apprentissage et casse la performance.",
        "Je vois l'accroche (le clic), pas ce qui se passe après. Une annonce qui "
        "fait cliquer sans faire acheter existe : vérifie ses conversions avant de "
        "pousser fort.",
        "creuser", 2,
        repere="Le repère pour amplifier sans casser : +20 % de budget par palier, "
               "tous les 3-4 jours. Et c'est le GROUPE qu'on finance, pas l'annonce — "
               "aucune plateforme ne prend un budget au niveau de l'annonce.",
        nature="augmenter", role="generale",
    ))


# ── 3 · L'ANNONCE QUI DÉPENSE SANS RIEN RAPPORTER ────────────────────────────

def regle_annonce_sans_conversion(theme: str, annonces: list[dict]) -> dict | None:
    """Une Annonce dépense sans une conversion pendant qu'une voisine en rapporte.

    LA VOISINE EST LA CONDITION, PAS LA DÉCORATION. Zéro conversion partout ne
    dit rien sur l'annonce — ça dit que le thème, l'offre ou la mesure ne vont
    pas, et `roas` porte déjà ce conseil-là. C'est l'ÉCART entre deux annonces
    qui partagent la même audience qui désigne la créa — donc **deux annonces
    d'un même Groupe** (voir `_par_groupe`), et pas deux annonces du thème :
    une annonce Search qui convertit et une annonce Display qui ne convertit
    pas est un fait de canal, pas un fait de créa.

    `conversions` vaut `None` sur les canaux qui ne la mesurent pas au niveau de
    l'Annonce — une absence de mesure n'est pas un zéro (`CLAUDE.md` §7) : ces
    annonces sortent de la comparaison au lieu d'y entrer à zéro.
    """
    candidats = []
    for groupe in _par_groupe(annonces):
        mesurees = [a for a in groupe if a.get("conversions") is not None]
        if len(mesurees) < 2:
            continue
        gagnantes = [a for a in mesurees if float(a["conversions"]) > 0]
        muettes = [a for a in mesurees
                   if float(a["conversions"]) == 0
                   and float(a.get("depense") or 0) >= SEUILS["roas_spend_min"]
                   and not a.get("jeune")]
        if not gagnantes or not muettes:
            continue
        candidats.append((max(muettes, key=lambda a: float(a["depense"])),
                          max(gagnantes, key=lambda a: float(a["conversions"]))))
    if not candidats:
        return None

    # Entre plusieurs Groupes, celui dont l'annonce muette coûte le plus.
    pire, voisine = max(candidats, key=lambda c: float(c[0]["depense"]))
    nom, nom_v = _nom(pire), _nom(voisine)
    conv = float(voisine["conversions"])
    return _designe(pire, _reco(
        "annonce_sans_conversion", pire.get("canal") or "pub",
        f"« {nom} » a dépensé {float(pire['depense']):,.0f} CHF sans une conversion",
        f"Sur « {theme} », « {nom} » a coûté {float(pire['depense']):,.0f} CHF cette "
        f"semaine pour {int(pire['clics'])} clics et zéro conversion. Dans le même "
        f"Groupe « {str(pire.get('groupe') or '')[:40]} », « {nom_v} » en a "
        f"rapporté {conv:.0f} pour {float(voisine['depense']):,.0f} CHF.",
        "Deux annonces d'un même Groupe sont montrées aux mêmes gens : quand "
        "l'une convertit et l'autre pas, ce qui les sépare est ce qu'elles "
        "montrent — le visuel, l'accroche, la promesse.",
        f"Coupe « {nom} » et remets sa dépense sur « {nom_v} ». Puis reprends ce "
        f"qui distingue les deux créas : c'est la seule chose qui a changé entre "
        "une conversion et zéro.",
        "Je compte les conversions que la régie attribue à l'annonce. Une vente "
        "conclue plus tard par un autre chemin n'y est pas : le vrai apport de "
        "cette annonce est au moins celui-ci, jamais moins.",
        "solide", 1,
        repere="Le repère : compare deux annonces à dépense comparable avant de "
               "conclure. Une annonce qui a eu 20 CHF n'a pas eu sa chance ; à "
               "50 CHF sans rien, l'écart n'est plus du hasard.",
        # « Coupe et remets la dépense sur l'autre » : la coupe se constate
        # demain. Le levier reste le CONTENU — c'est la créa qu'on met en cause,
        # pas le montant (`_LEVIER_REGLE`, build_report.py).
        nature="couper", role="generale",
    ))


# ── 4 · LE THÈME QUI VA DÉPASSER CE QUI ÉTAIT PRÉVU ──────────────────────────

def regle_theme_hors_budget(theme: str, budget: dict) -> dict | None:
    """Au rythme de la semaine, ce thème finira le mois au-dessus du budget POSÉ.

    LE PASSÉ EST MESURÉ, SEUL L'AVENIR EST PROJETÉ. `depense_mois` est ce qui a
    réellement été dépensé du 1er au dernier jour plein ; seuls les jours qui
    RESTENT sont estimés, et au rythme que le rapport mesure déjà — sa fenêtre
    de sept jours pleins. Extrapoler aussi le passé aurait fabriqué un chiffre
    là où on en a un vrai (`CLAUDE.md` §7).

    `prevu_mois` n'est pas une estimation non plus : c'est la somme des budgets
    POSÉS sur les campagnes du thème, ramenée au mois par la même règle de
    prorata que la page Coûts (`saas/web/lib/budgets.ts`). Son angle mort est
    réel et se dit : une photo hebdomadaire ne sait pas ce que le budget valait
    il y a trois semaines — aucune API ne le donne.

    `budget` : {prevu_mois, depense_mois, depense_semaine, jours_restants,
                jours_fenetre, releve_le}.
    """
    prevu = float(budget.get("prevu_mois") or 0)
    depense_mois = float(budget.get("depense_mois") or 0)
    depense_sem = float(budget.get("depense_semaine") or 0)
    restants = int(budget.get("jours_restants") or 0)
    fenetre = int(budget.get("jours_fenetre") or 0)
    if prevu <= 0 or restants <= 0 or fenetre <= 0:
        return None
    # Le même plancher que `_rule_connecter_ga4` : sous 50 CHF sur la semaine,
    # il n'y a pas assez d'argent en jeu pour que le dépassement mérite une des
    # places du client.
    if depense_sem < SEUILS["cpc_spend_min"]:
        return None
    projection = depense_mois + (depense_sem / fenetre) * restants
    if projection <= prevu:
        return None

    ecart = projection - prevu
    releve = budget.get("releve_le")
    return _reco(
        "theme_hors_budget", "pub",
        f"« {theme} » : {prevu:,.0f} CHF prévus, tu finiras le mois à {projection:,.0f}",
        f"Les campagnes de « {theme} » portent un budget posé de {prevu:,.0f} CHF "
        f"sur le mois. {depense_mois:,.0f} CHF sont déjà dépensés, et au rythme de "
        f"cette semaine ({depense_sem / fenetre:,.0f} CHF par jour) les "
        f"{restants} jours qui restent ajouteront de quoi finir à "
        f"{projection:,.0f} CHF — {ecart:,.0f} CHF au-dessus.",
        "Un dépassement vient rarement d'une décision : une campagne relancée, une "
        "enchère qui monte parce que la concurrence paie plus, ou un budget "
        "journalier que la régie a le droit de dépasser certains jours pour "
        "rattraper les autres.",
        "Ouvre les campagnes de ce thème et compare leur budget journalier à ce "
        f"qu'elles dépensent vraiment. Baisse celui de la plus gourmande de "
        f"{ecart:,.0f} CHF répartis sur les {restants} jours restants, ou assume le "
        "dépassement en connaissance de cause — les deux sont des décisions, "
        "s'en apercevoir le 31 n'en est pas une.",
        "Je ne connais le budget posé qu'au jour du relevé"
        + (f" ({releve})" if releve else "")
        + " : aucune plateforme ne dit ce qu'il valait il y a trois semaines. Si tu "
          "l'as changé depuis le début du mois, le chiffre « prévu » est celui "
          "d'aujourd'hui appliqué à tout le mois.",
        "creuser", 1,
        repere="Le repère : un écart sous 10 % entre posé et dépensé est normal — "
               "les régies lissent sur la semaine. C'est la TENDANCE sur un mois "
               "plein qui dit si le budget est tenu.",
        nature="corriger", role="generale",
    )


def _arbitrer_collisions(recos: list[dict]) -> list[dict]:
    """Trois règles peuvent tomber sur LA MÊME Annonce. Deux cas, deux issues.

    · **Locomotive ET chère.** Une annonce qui accroche deux fois mieux et paie
      son clic deux fois plus cher reçoit deux conseils qui se contredisent :
      « monte le budget de son Groupe » et « coupe-la ». On ne sert ni l'un ni
      l'autre. Arbitrer entre les deux demanderait une règle qui dit lequel des
      deux signaux l'emporte, et cette règle n'existe pas — l'inventer serait
      trancher à la place du client sur un cas où la donnée ne tranche pas.
      C'est aussi le cas le plus rare : la meilleure accroche et le clic le plus
      cher sont rarement la même créa.
    · **Muette ET chère.** Les deux disent de couper la même annonce, pour deux
      raisons dont une est plus forte : zéro conversion pendant qu'une voisine
      en rapporte est une preuve, un clic cher n'est qu'un prix. On garde la
      preuve et on retire le prix — sinon la carte du thème dépense deux de ses
      trois places à dire la même chose.
    """
    par_cle = {r["key"]: r for r in recos}
    chere = par_cle.get("annonce_chere")
    if not chere:
        return recos

    loco = par_cle.get("annonce_locomotive")
    if loco and loco.get("_annonce") == chere.get("_annonce"):
        return [r for r in recos if r["key"] not in ("annonce_chere",
                                                     "annonce_locomotive")]

    muette = par_cle.get("annonce_sans_conversion")
    if muette and muette.get("_annonce") == chere.get("_annonce"):
        return [r for r in recos if r["key"] != "annonce_chere"]

    return recos


def regles_payantes(theme: str, annonces: list[dict],
                    budget: dict | None = None) -> list[dict]:
    """Les quatre règles, évaluées sur un thème. Une règle qui plante est ignorée.

    Même contrat défensif que `build_recos` : le rapport ne casse jamais parce
    qu'une règle a trébuché sur une donnée qu'elle n'attendait pas.
    """
    candidates = [
        lambda: regle_annonce_sans_conversion(theme, annonces),
        lambda: regle_annonce_locomotive(theme, annonces),
        lambda: regle_annonce_chere(theme, annonces),
        lambda: regle_theme_hors_budget(theme, budget or {}),
    ]
    out = []
    for regle in candidates:
        try:
            r = regle()
        except Exception:
            r = None
        if r:
            out.append(r)
    return _arbitrer_collisions(out)
