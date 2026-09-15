"""Les conseils payants qui descendent SOUS la campagne — déterministe, zéro IA.

POURQUOI CE FICHIER EXISTE. On récolte chaque jour le détail annonce par
annonce, Meta et Google, et jusqu'ici aucune règle de conseil ne le lisait :
`grep ad_name` ne renvoyait rien sur les trois moteurs. Un compte qui ne fait
que de la publicité recevait donc UN conseil par semaine — `roas`, et lui seul
(mesuré dans `.scratch/refonte/issues/22-rebrancher-le-plan-de-theme.md`).
Ces dix règles ferment ce trou, et elles le ferment sans récolte nouvelle ni
migration : la donnée était déjà en base. Quatre sont arrivées par le ticket
`.scratch/construction/issues/07-quatre-regles-payantes.md` (aucun seuil neuf),
les six autres par le ticket
`.scratch/construction/issues/10-six-regles-payantes-restantes.md` (quatre
seuils neufs, tous sourcés dans `SEUILS`).

CE QUI CHANGE D'ÉCHELLE. À l'intérieur d'un thème, la campagne n'a plus
personne à qui se comparer — on l'a justement filtrée. L'unité de comparaison
devient l'**Annonce** et le **Groupe d'annonces** (`CONTEXT.md`). C'est aussi
pour ça que `_rule_gaspillage` et `_rule_scaler`, qui comparaient à la médiane
des campagnes, ne pouvaient pas être rebranchés tels quels.

AUCUN SEUIL N'EST INVENTÉ ICI. Tous vivent dans `SEUILS` (`reco_engine.py`),
et chacun y porte sa source — les onze du moteur étaient déjà calibrés et déjà
en service, les quatre que le ticket 10 a ajoutés portent la mesure ou la
documentation qui les a fixés, ET l'avertissement qui va avec : aucune règle
payante n'a jamais tourné sur un vrai compte (ticket 16, le seam du payload,
n'est pas ouvert). Ce sont des points de départ argumentés, pas des valeurs
observées, et c'est écrit là-bas comme ici.

LES DEUX GARDE-FOUS DU GESTE « COUPER », posés par David
(`.scratch/refonte/issues/24-conseils-payants-manquants.md`, décision 4) :
  · **jamais sur une campagne jeune** — un test a le droit d'être mauvais le
    temps de tourner, et rien en base ne dit qu'une campagne EST un test :
    l'âge est le seul proxy honnête ;
  · **jamais fondé sur une part de budget** — seulement sur un résultat mesuré.
Le second se lit dans le code : aucune des règles ci-dessous ne regarde ce
qu'une annonce pèse dans le budget, elles regardent toutes ce qu'elle a rendu.
La garde « jamais sur une campagne jeune » vaut aussi pour les gestes qui ne
coupent pas — `adset_inegal`, `budget_non_depense` et `annonce_usee` l'appliquent
toutes les trois : une campagne en rodage paie ses premiers clics plus cher et
consomme mal son budget, et la dénoncer pour ça serait dénoncer le rodage.

CE MODULE EST PUR. Il prend des listes de dicts, il rend des dicts : ni base,
ni réseau, ni pandas, ni notion de thème au-delà de son nom dans les phrases.
C'est l'appelant (`saas/traitement/build_report.py`) qui sait rattacher une
annonce à un thème — même partage que `_orga_recos` et `_reco_evenements`.
"""

from .reco_engine import SEUILS, _reco


def _cpc_groupe(lignes: list[dict]) -> float:
    """Le prix du clic d'un ENSEMBLE d'annonces : dépense totale sur clics totaux.

    C'EST LA SEULE FORMULE DU FICHIER, et `_cpc` n'en est que le cas à une
    ligne. Une annonce qui a reçu deux clics ne pèse pas autant qu'une qui en a
    reçu dix mille — la pondération est ce qui empêche un petit voisin de
    commander le repère des autres.
    """
    clics = sum(int(a.get("clics") or 0) for a in lignes)
    return sum(float(a.get("depense") or 0) for a in lignes) / clics if clics else 0.0


def _cpc(a: dict) -> float:
    return _cpc_groupe([a])


def _ctr_groupe(lignes: list[dict]) -> float:
    """Le taux de clic d'un ENSEMBLE d'annonces — le pendant exact de
    `_cpc_groupe`, pondéré par les impressions pour la même raison."""
    impressions = sum(int(a.get("impressions") or 0) for a in lignes)
    if impressions <= 0:
        return 0.0
    return sum(int(a.get("clics") or 0) for a in lignes) / impressions * 100


def _ctr(a: dict) -> float:
    return _ctr_groupe([a])


def _nom(a: dict) -> str:
    return str(a.get("nom") or "")[:40]


def _les_autres(n: int, mot: str) -> str:
    """« l'autre annonce » ou « les 3 autres annonces ».

    LE SINGULIER N'EST PAS UNE COQUETTERIE : depuis que le repère est celui des
    VOISINES et non plus une médiane, ces règles parlent enfin sur un Groupe de
    deux — et le cas le plus courant devient donc `n = 1`. Écrit sans ce helper,
    le conseil le plus fréquent du produit s'ouvrirait sur « les 1 autres
    annonces », ce qui est exactement le genre de détail qui fait douter du
    reste du chiffre.
    """
    return f"l'autre {mot}" if n == 1 else f"les {n} autres {mot}s"


def _designe(annonce: dict, reco: dict) -> dict:
    """Note QUELLE Annonce et QUEL Groupe ce conseil nomme, pour que
    l'orchestrateur puisse voir quand deux règles parlent de la même.

    Clés PRIVÉES : ni `_annonce` ni `_groupe` ne sont dans `RECO_FIELDS`, donc
    `_strip_reco` (`saas/traitement/build_report.py`) ne les recopie pas dans le
    payload. Elles ne sortent jamais de ce module ni de son appelant immédiat.

    `_groupe` est entré avec `adset_inegal` (ticket 10) : une règle qui accuse
    un Groupe entier et une règle qui accuse UNE de ses annonces ne disent pas
    deux choses, elles disent la même — voir `_arbitrer_collisions`.
    """
    reco["_annonce"] = annonce.get("cle")
    groupe = str(annonce.get("groupe") or "").strip()
    reco["_groupe"] = (annonce.get("canal"), groupe) if groupe else None
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

    LE REPÈRE EST CE QUE PAIENT LES AUTRES, jamais une médiane qui inclurait la
    candidate — voir le commentaire dans le corps, et le ticket
    `.scratch/construction/issues/30-la-mediane-sur-deux-valeurs-ne-parle-jamais.md`.

    Les annonces des campagnes JEUNES sortent de la comparaison des deux côtés —
    candidate et repère. Pas seulement parce qu'on ne coupe pas un test : une
    campagne en apprentissage paie ses premiers clics plus cher, la laisser dans
    le repère le remonterait et masquerait la vraie annonce chère.

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
        pire = max(comparables, key=_cpc)
        # UNE ANNONCE NE FAIT JAMAIS PARTIE DU REPÈRE QUI LA JUGE, et c'est
        # arithmétique, pas une préférence : une médiane calculée sur DEUX
        # valeurs tombe pile entre elles, donc la candidate devrait valoir deux
        # fois la moyenne des deux — ce qu'aucun prix du clic positif ne permet.
        # La règle était muette sur TOUT Groupe de deux annonces, c'est-à-dire
        # sur la forme la plus courante chez un petit annonceur et sur la forme
        # canonique d'un test A/B (mesuré dans
        # `.scratch/construction/harnais/30-le-repere-des-autres/`).
        # Le repère est donc celui qu'utilisent déjà `regle_annonce_locomotive`
        # et `regle_adset_inegal` : ce que paient les VOISINES, pondéré par
        # leurs clics. La mesure a écarté la médiane des autres, qui garde la
        # robustesse aux valeurs extrêmes mais se fait piéger par le déséquilibre
        # de VOLUME — or la livraison concentre les clics sur l'annonce qui
        # marche, donc c'est le déséquilibre de volume qui est la règle ici.
        repere = _cpc_groupe([a for a in comparables if a is not pire])
        if repere <= 0:
            continue
        if (_cpc(pire) >= repere * SEUILS["cpc_ratio"]
                and float(pire.get("depense") or 0) >= SEUILS["cpc_spend_min"]):
            candidats.append((pire, repere, len(comparables) - 1))
    if not candidats:
        return None

    pire, repere, n_voisines = max(candidats,
                                   key=lambda c: float(c[0].get("depense") or 0))
    cpc = _cpc(pire)
    depense = float(pire["depense"])
    nom = _nom(pire)
    groupe_nom = str(pire.get("groupe") or "")[:40]
    return _designe(pire, _reco(
        "annonce_chere", pire.get("canal") or "pub",
        f"« {nom} » te coûte {cpc:.2f} CHF le clic, les autres {repere:.2f}",
        f"Sur « {theme} », l'annonce « {nom} » a dépensé {depense:,.0f} CHF cette "
        f"semaine pour {int(pire['clics'])} clics, soit {cpc:.2f} CHF le clic — "
        f"{cpc / repere:.1f}× ce que paient {_les_autres(n_voisines, 'annonce')} "
        f"du Groupe « {groupe_nom} » ({repere:.2f} CHF).",
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
               "montant. Une annonce au-dessus de 2× ce que paient ses voisines a "
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
        ctr_autres = _ctr_groupe(autres)
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
        f"contre {ctr_autres:.2f} % pour {_les_autres(n_autres, 'annonce')} du "
        f"même Groupe.",
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
    """Dix règles, et plusieurs peuvent tomber sur LE MÊME objet. Cinq cas.

    LA CARTE D'UN THÈME N'A QUE TROIS PLACES : deux conseils qui disent la même
    chose en consomment deux, et deux conseils qui se contredisent en gaspillent
    deux ET laissent le client arbitrer à notre place. Ce qui suit règle les
    collisions QUE LA DONNÉE TRANCHE, et se tait sur celles qu'elle ne tranche
    pas — se taire des deux côtés est alors la seule réponse honnête.

    · **Locomotive ET chère, même Annonce.** « Monte le budget de son Groupe »
      et « coupe-la » se contredisent. On ne sert ni l'un ni l'autre : dire
      lequel des deux signaux l'emporte demanderait une règle qui n'existe pas,
      et l'inventer serait trancher à la place du client là où la donnée ne
      tranche pas.
    · **Muette ET chère, même Annonce.** Les deux disent de couper, pour deux
      raisons dont une est plus forte : zéro conversion pendant qu'une voisine
      en rapporte est une preuve, un clic cher n'est qu'un prix. On garde la
      preuve.
    · **Usée ET chère, même Annonce.** Les deux constatent le même clic trop
      cher ; une seule en donne la CAUSE et le geste qui la répare. On garde
      l'usure.
    · **Usée ET locomotive, même Annonce.** Même contradiction que le premier
      cas — « remplace-la » contre « finance son Groupe » — et même issue.
    · **Groupe inégal ET annonce chère DANS ce Groupe.** `adset_inegal` conclut
      que l'audience du Groupe coûte cher. Si le prix du Groupe est tiré par UNE
      de ses annonces, la conclusion est fausse : ce n'est pas l'audience, c'est
      la créa. On garde l'annonce, qui nomme ce qu'il faut faire.

    ET UNE SEULE STRATÉGIE À LA FOIS. `adset_inegal` et `theme_deux_regies`
    portent toutes deux `role="hypothese"` : servies ensemble, la carte du thème
    afficherait deux théories concurrentes et `theme_plan` n'en suivrait qu'une,
    au hasard de l'ordre de tri. On garde celle qui a le plus d'argent en jeu.
    LE CAS GÉNÉRAL SE RÈGLE AILLEURS, ET IL FALLAIT LES DEUX. Ce module ne voit
    que ses propres règles : `orga_essoufflement` et `page_endormie` entrent en
    concurrence avec elles sur le même thème sans jamais passer par ici. Cet
    arbitrage-là vit donc dans `build_report.py` (`_une_seule_hypothese`), une
    fois toutes les familles réunies, et il tranche sur `_importance` — l'ordre
    du rapport entier — parce qu'une règle organique ne déclare aucun `_enjeu`
    en francs. Celui d'ici reste : quand les deux candidates SONT payantes,
    l'argent en jeu dit mieux laquelle garder que le classement général.
    Mesuré et tranché par
    `.scratch/construction/issues/27-l-hypothese-d-une-regle-peut-changer-chaque-semaine.md`.
    """
    par_cle = {r["key"]: r for r in recos}
    retires: set = set()

    def _meme_annonce(a, b):
        ra, rb = par_cle.get(a), par_cle.get(b)
        return (ra and rb and ra.get("_annonce") is not None
                and ra.get("_annonce") == rb.get("_annonce"))

    if _meme_annonce("annonce_locomotive", "annonce_chere"):
        retires |= {"annonce_locomotive", "annonce_chere"}
    if _meme_annonce("annonce_locomotive", "annonce_usee"):
        retires |= {"annonce_locomotive", "annonce_usee"}
    if _meme_annonce("annonce_sans_conversion", "annonce_chere"):
        retires.add("annonce_chere")
    if _meme_annonce("annonce_usee", "annonce_chere"):
        retires.add("annonce_chere")

    groupe_accuse = (par_cle.get("adset_inegal") or {}).get("_groupe")
    if groupe_accuse:
        for _cle in ("annonce_chere", "annonce_usee"):
            _r = par_cle.get(_cle)
            if _r and _cle not in retires and _r.get("_groupe") == groupe_accuse:
                retires.add("adset_inegal")

    # « Ton budget dort » et « tu vas dépasser ton budget » sur le même thème :
    # le second est le fait du thème entier, le premier celui d'une campagne.
    # Servis ensemble ils se lisent comme une contradiction ; le fait du thème
    # gagne, parce que c'est lui qui a une date (la fin du mois).
    if "theme_hors_budget" in par_cle and "budget_non_depense" in par_cle:
        retires.add("budget_non_depense")

    vivants = [r for r in recos if r["key"] not in retires]

    hypotheses = [r for r in vivants if r.get("role") == "hypothese"]
    if len(hypotheses) > 1:
        garde = max(hypotheses, key=_argent_en_jeu)
        vivants = [r for r in vivants
                   if r.get("role") != "hypothese" or r is garde]
    return vivants


def _argent_en_jeu(reco: dict) -> float:
    """Ce que ce conseil met sur la table, en CHF — l'arbitre entre deux
    Stratégies concurrentes. Posé par la règle elle-même : le deviner depuis le
    texte serait un chiffre lu dans une phrase."""
    return float(reco.get("_enjeu") or 0)


def regles_payantes(theme: str, annonces: list[dict],
                    budget: dict | None = None,
                    faits: dict | None = None) -> list[dict]:
    """Les dix règles payantes, évaluées sur un thème. Une règle qui plante est
    ignorée.

    Même contrat défensif que `build_recos` : le rapport ne casse jamais parce
    qu'une règle a trébuché sur une donnée qu'elle n'attendait pas.

    `theme`, `annonces` et `budget` sont les trois entrées du ticket 07 et
    gardent leur place — le harnais de ce ticket les passe en positionnel.
    `faits` porte ce que les six règles du ticket 10 ont demandé en plus, et
    c'est un objet-paramètre plutôt que quatre arguments de plus :

      · `regies`    — {canal: {spend, revenue, complet}}, pour `theme_deux_regies`
      · `campagnes` — le budget posé par campagne, pour `budget_non_depense`
      · `usure`     — le détail Meta par Annonce avec sa portée, pour `annonce_usee`
      · `arrivee`   — clics payés contre visites GA4, pour `page_arrivee_muette`
      · `creneaux`  — la dépense Meta par jour de semaine, pour `creneau_pub`

    Une clé absente vaut « on n'a pas lu ça » : la règle qui la lit se tait, elle
    ne retombe pas sur un zéro (`CLAUDE.md` §7).
    """
    f = faits or {}
    candidates = [
        lambda: regle_annonce_sans_conversion(theme, annonces),
        lambda: regle_annonce_locomotive(theme, annonces),
        lambda: regle_annonce_chere(theme, annonces),
        lambda: regle_theme_hors_budget(theme, budget or {}),
        lambda: regle_adset_inegal(theme, annonces),
        lambda: regle_theme_deux_regies(theme, f.get("regies") or {}),
        lambda: regle_budget_non_depense(theme, f.get("campagnes") or []),
        lambda: regle_annonce_usee(theme, f.get("usure") or []),
        lambda: regle_page_arrivee_muette(theme, f.get("arrivee") or {}),
        lambda: regle_creneau_pub(theme, f.get("creneaux") or []),
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


# ═════════════════════════════════════════════════════════════════════════════
# LES SIX RÈGLES RESTANTES — ticket
# `.scratch/construction/issues/10-six-regles-payantes-restantes.md`
#
# CE QUI LES SÉPARE DES QUATRE D'AU-DESSUS, et c'est la seule chose : elles
# portent des seuils qui n'étaient pas dans `SEUILS`. Les quatre comparaisons de
# coût n'en ont finalement demandé aucun — `cpc_ratio` dit déjà « 2×, ce n'est
# plus du bruit » sur de l'argent, et un Groupe d'annonces, un jour de semaine
# ou un budget posé comparent exactement ça. Les quatre nombres neufs sont dans
# `SEUILS` (`reco_engine.py`), chacun avec sa source.
#
# DEUX D'ENTRE ELLES OUVRENT UNE STRATÉGIE (`role="hypothese"`) :
# `adset_inegal` et `theme_deux_regies`. C'est l'exigence n° 4 de
# `.scratch/refonte/issues/24-conseils-payants-manquants.md` — avant elles,
# seules deux clés ORGANIQUES pouvaient ouvrir une Stratégie, donc un compte qui
# ne fait que de la publicité n'en ouvrait jamais.
# ═════════════════════════════════════════════════════════════════════════════


# ── 5 · DEUX GROUPES D'ANNONCES QUI NE PAIENT PAS LE MÊME PRIX ───────────────

def regle_adset_inegal(theme: str, annonces: list[dict]) -> dict | None:
    """Dans une même campagne, un Groupe d'annonces paie son clic bien plus cher
    que ses voisins — et ce qui sépare deux Groupes, c'est À QUI ils parlent.

    LA COMPARAISON SE FAIT DANS UNE MÊME CAMPAGNE, et c'est la même leçon que
    `_par_groupe` un cran plus bas : deux Groupes d'une même campagne partagent
    l'objectif, l'optimisation et l'enchère de cette campagne — ce qui les
    sépare est leur audience. Deux Groupes de campagnes différentes, non : une
    campagne Search et une campagne Display n'ont pas un prix du clic, elles en
    ont deux, et le ratio mesurerait le mélange de campagnes au lieu du ciblage.

    C'EST UNE HYPOTHÈSE, PAS UN CONSTAT (`role="hypothese"`). Un Groupe cher
    n'est pas forcément un mauvais Groupe : une audience étroite se paie plus
    cher et peut convertir bien mieux. Le geste est donc `tester` — déplacer une
    part du budget et REGARDER — et la réponse arrive à la mesure suivante, pas
    demain à l'œil.

    Les annonces des campagnes JEUNES sortent des deux côtés, même raison que
    `regle_annonce_chere` : une campagne en apprentissage paie ses premiers
    clics plus cher et fausserait le repère autant que la candidate.
    """
    par_campagne: dict = {}
    for a in annonces:
        if a.get("jeune"):
            continue
        groupe = str(a.get("groupe") or "").strip()
        campagne = str(a.get("campagne") or "").strip()
        if not groupe or not campagne:
            continue   # sans campagne connue, on ne sait pas contre qui il courait
        par_campagne.setdefault((a.get("canal"), campagne), {}) \
                    .setdefault(groupe, []).append(a)

    candidats = []
    for (canal, campagne), groupes in par_campagne.items():
        mesures = {g: _cpc_groupe(lignes) for g, lignes in groupes.items()}
        mesures = {g: c for g, c in mesures.items() if c > 0}
        if len(mesures) < 2:
            continue
        pire = max(mesures, key=lambda g: mesures[g])
        # LE REPÈRE EST LE PRIX DU CLIC DES **AUTRES** GROUPES, PAS UNE MÉDIANE,
        # et c'est une différence qui compte. Une médiane calculée sur DEUX
        # valeurs tombe pile entre elles : le Groupe cher devrait alors valoir
        # deux fois la moyenne des deux, ce qu'aucun nombre positif ne permet —
        # la règle n'aurait jamais parlé sur une campagne à deux Groupes,
        # c'est-à-dire sur le cas le plus courant. Le repère est donc celui
        # qu'utilise déjà `regle_annonce_locomotive` : ce que les VOISINS
        # paient, pondéré par leurs clics. Un petit Groupe ne commande pas le
        # repère, et un Groupe ne se compare jamais à lui-même. Un Groupe sans
        # un seul clic reste dehors des deux côtés : sa dépense gonflerait le
        # repère sans y apporter de clics, et la règle se tairait pour une
        # raison qui n'a rien à voir avec le ciblage.
        autres = [a for g, lignes in groupes.items()
                  if g != pire and g in mesures for a in lignes]
        repere = _cpc_groupe(autres)
        if repere <= 0:
            continue
        depense = sum(float(a.get("depense") or 0) for a in groupes[pire])
        if (mesures[pire] >= repere * SEUILS["cpc_ratio"]
                and depense >= SEUILS["cpc_spend_min"]):
            meilleur = min(mesures, key=lambda g: mesures[g])
            candidats.append({
                "canal": canal, "campagne": campagne, "groupe": pire,
                "cpc": mesures[pire], "depense": depense,
                "voisin": meilleur, "cpc_voisin": repere,
                "n": len(mesures),
            })
    if not candidats:
        return None

    # Entre plusieurs campagnes, celle où l'écart coûte le plus cher.
    c = max(candidats, key=lambda x: x["depense"])
    pire, voisin = c["groupe"][:40], c["voisin"][:40]
    reco = _reco(
        "adset_inegal", c["canal"] or "pub",
        f"« {pire} » te coûte {c['cpc'] / c['cpc_voisin']:.1f}× le clic des autres Groupes",
        f"Sur « {theme} », dans la campagne « {c['campagne'][:40]} », le Groupe "
        f"« {pire} » a dépensé {c['depense']:,.0f} CHF cette semaine à "
        f"{c['cpc']:.2f} CHF le clic, contre {c['cpc_voisin']:.2f} CHF pour "
        f"{_les_autres(c['n'] - 1, 'Groupe')} de la même campagne — le moins "
        f"cher étant « {voisin} ».",
        "Ces Groupes tournent sous la même campagne : même objectif, même "
        "optimisation, même enchère. Ce qui les sépare est À QUI ils parlent — "
        "une audience plus étroite, plus disputée ou plus froide se paie plus "
        "cher au clic.",
        f"Déplace un quart du budget de « {pire} » vers « {voisin} » et laisse "
        "tourner deux semaines. Si le prix du clic du thème descend sans que le "
        "volume s'effondre, l'audience chère était le problème.",
        "Je compare un prix du clic, pas ce que chaque audience rapporte. Une "
        "audience chère qui convertit deux fois mieux reste la bonne : regarde "
        "ses conversions avant de la dégonfler.",
        "creuser", 2,
        repere="Le repère : c'est l'écart DANS UNE MÊME CAMPAGNE qui veut dire "
               "quelque chose. Deux Groupes de deux campagnes différentes ne "
               "jouent pas la même enchère, et leur écart ne dit rien du ciblage.",
        nature="tester", role="hypothese",
    )
    # Clé PRIVÉE, comme `_annonce` : elle sert à l'arbitrage des collisions et
    # ne franchit pas `_strip_reco` (`RECO_FIELDS` ne la contient pas).
    reco["_groupe"] = (c["canal"], c["groupe"])
    reco["_enjeu"] = c["depense"]
    reco["cible"] = f"{c['canal']}:{c['campagne']}:{c['groupe']}"
    return reco


# ── 6 · LE THÈME QUI NE REND PAS PAREIL SUR LES DEUX RÉGIES ─────────────────

def regle_theme_deux_regies(theme: str, regies: dict) -> dict | None:
    """Ce thème tourne sur Meta ET sur Google, et une des deux rend nettement
    mieux que l'autre.

    LA SEULE CHOSE QU'AUCUNE RÉGIE NE PEUT DIRE — ni Meta ni Google ne voient
    ce que l'autre a coûté ni rapporté
    (`.scratch/refonte/issues/02-sur-quoi-se-differencient-les-autres.md`).

    ELLE SE TAIT DÈS QUE L'ATTRIBUTION EST INCOMPLÈTE, et ce n'est pas une
    précaution de confort. Le revenu d'une campagne n'entre que si GA4 la
    retrouve par son nom ; une campagne étiquetée dont l'`utm_campaign` ne
    correspond plus (un renommage dans la régie suffit) verse sa dépense au
    dénominateur sans jamais verser son revenu au numérateur
    (`.scratch/construction/issues/18-revenu-google-non-rattachable.md`). La
    règle dirait alors « l'autre régie rend quatre fois mieux » alors qu'on a
    simplement perdu le revenu d'une campagne. `complet` est le drapeau que
    l'appelant pose quand TOUTES les campagnes dépensières du thème, sur ce
    canal, ont été retrouvées côté GA4 — sans lui, silence.

    `regies` : {"meta": {spend, revenue, complet}, "google": {...}}.
    """
    vivantes = {}
    for canal in ("meta", "google"):
        d = (regies or {}).get(canal) or {}
        depense = float(d.get("spend") or 0)
        if not d.get("complet") or depense < SEUILS["cpc_spend_min"]:
            continue   # pas d'argent en jeu, ou un revenu qu'on sait incomplet
        if d.get("revenue") is None:
            continue   # une absence de mesure n'est pas un zéro (`CLAUDE.md` §7)
        vivantes[canal] = {"spend": depense, "revenue": float(d["revenue"]),
                           "roas": float(d["revenue"]) / depense}
    if len(vivantes) < 2:
        return None

    fort = max(vivantes, key=lambda c: vivantes[c]["roas"])
    faible = min(vivantes, key=lambda c: vivantes[c]["roas"])
    r_fort, r_faible = vivantes[fort]["roas"], vivantes[faible]["roas"]
    if r_fort <= 0:
        return None   # aucune des deux ne rapporte : ce n'est pas un arbitrage
    if r_faible > 0:
        if r_fort < r_faible * SEUILS["regie_roas_ratio"]:
            return None
        titre = (f"« {theme} » : {fort.capitalize()} rapporte "
                 f"{r_fort / r_faible:.1f}× mieux que {faible.capitalize()}")
        chiffres = (f"{r_fort:.1f} CHF rapportés par franc investi sur {fort.capitalize()}, "
                    f"contre {r_faible:.1f} sur {faible.capitalize()}")
    else:
        # Un « ×∞ » n'existe pas (`CLAUDE.md` §7) : pas de multiplicateur, et le
        # titre s'écrit à part plutôt que d'essayer de se glisser dans le même
        # gabarit — « Meta rapporte, l'autre pas que Google » est la phrase que
        # ça produisait.
        titre = (f"« {theme} » : {fort.capitalize()} rapporte, "
                 f"{faible.capitalize()} pas encore")
        chiffres = (f"{r_fort:.1f} CHF rapportés par franc investi sur {fort.capitalize()}, "
                    f"et zéro revenu attribué sur {faible.capitalize()} pour "
                    f"{vivantes[faible]['spend']:,.0f} CHF")
    bascule = vivantes[faible]["spend"] / 4

    reco = _reco(
        "theme_deux_regies", "pub",
        titre,
        f"Sur « {theme} » cette semaine : {chiffres}. "
        f"{vivantes[fort]['spend']:,.0f} CHF sont partis sur {fort.capitalize()}, "
        f"{vivantes[faible]['spend']:,.0f} CHF sur {faible.capitalize()}.",
        "Deux régies ne touchent pas les mêmes gens au même moment : l'une "
        "attrape une intention déjà formée, l'autre va la chercher. "
        "ATTENTION AU BIAIS DE MESURE : Google Analytics attribue la vente au "
        "DERNIER clic. Une campagne Meta qui fait découvrir ta marque, suivie "
        "d'une recherche de ton nom sur Google, est comptée entièrement pour "
        "Google — l'écart que tu lis contient ce transfert, et il ne vient pas "
        "des campagnes.",
        f"Déplace environ {bascule:,.0f} CHF — un quart du budget "
        f"{faible.capitalize()} de ce thème — vers {fort.capitalize()}, et "
        "laisse tourner deux semaines. Si le retour du thème monte, l'écart "
        "était réel ; s'il ne bouge pas, c'était le dernier clic.",
        "Je ne sais pas ce qu'une régie apporte à l'autre. Couper celle qui "
        "semble faible peut faire tomber celle qui semble forte : c'est "
        "exactement pour ça que le geste est un TRANSFERT partiel et pas une "
        "coupe.",
        "creuser", 2,
        repere="Le repère : ne bascule jamais tout. Un quart du budget, deux "
               "semaines, puis on relit — c'est le seul protocole qui permette de "
               "distinguer un vrai écart d'un artefact d'attribution.",
        nature="tester", role="hypothese",
    )
    reco["_enjeu"] = vivantes[faible]["spend"]
    # LA CIBLE PORTE LE THÈME, sinon elle n'a que deux valeurs pour tout le
    # compte : `empreinte` est `(clé, cible)` et un conseil déjà servi ne
    # repasse pas (`saas/recos_ia/composition.py`). Sans le thème, un
    # « meta->google » servi sur « Été » musellerait le même déséquilibre,
    # réel et différent, sur « Hiver ».
    reco["cible"] = f"{theme}:{faible}->{fort}"
    return reco


# ── 7 · LE BUDGET POSÉ QUE LA CAMPAGNE NE DÉPENSE PAS ───────────────────────

def regle_budget_non_depense(theme: str, campagnes: list[dict]) -> dict | None:
    """Une campagne du thème porte un budget posé que sa dépense réelle n'approche
    même pas — l'argent est réservé et il dort.

    LE SEUIL EST CELUI DE DAVID, mot pour mot : *« tu as un budget quotidien de
    X, c'est 2 fois plus que la dépense moyenne »*
    (`.scratch/refonte/issues/24-conseils-payants-manquants.md`, décision 6).
    C'est `cpc_ratio`, lu dans l'autre sens : posé ≥ 2 × dépensé.

    DEUX GARDES, ET AUCUNE N'EST DÉCORATIVE :
      · la campagne doit être ACTIVE. Une campagne en pause ne dépense rien et
        c'est normal — le dire serait du bruit. C'est l'appelant qui le sait ;
      · la campagne ne doit pas être JEUNE. Une campagne qui démarre met
        quelques jours à consommer son budget, et rien en base ne dit qu'elle
        est en rodage : l'âge est le seul proxy honnête.

    ET UN PLANCHER : l'argent qui dort doit peser au moins `cpc_spend_min` sur
    la fenêtre. Deux francs par jour non dépensés ne valent pas une des places
    de la semaine.

    `campagnes` : [{canal, nom, pose_jour, depense_jour, jours, releve_le}].
    """
    candidats = []
    for c in campagnes or []:
        pose = float(c.get("pose_jour") or 0)
        depense = float(c.get("depense_jour") or 0)
        jours = int(c.get("jours") or 0)
        if pose <= 0 or jours <= 0:
            continue   # sans budget posé, il n'y a rien à comparer
        if depense > 0 and pose < depense * SEUILS["cpc_ratio"]:
            continue
        dort = (pose - depense) * jours
        if dort < SEUILS["cpc_spend_min"]:
            continue
        candidats.append((dort, c, pose, depense))
    if not candidats:
        return None

    dort, c, pose, depense = max(candidats, key=lambda x: x[0])
    nom = str(c.get("nom") or "")[:40]
    releve = c.get("releve_le")
    reco = _reco(
        "budget_non_depense", c.get("canal") or "pub",
        f"« {nom} » : {pose:,.0f} CHF/jour posés, {depense:,.0f} dépensés",
        f"Sur « {theme} », la campagne « {nom} » porte un budget de "
        f"{pose:,.0f} CHF par jour et en a dépensé {depense:,.0f} en moyenne sur "
        f"les {c.get('jours')} derniers jours — {dort:,.0f} CHF réservés et "
        "jamais partis.",
        "Une campagne qui ne consomme pas son budget est presque toujours "
        "bridée : une audience trop étroite, une enchère trop basse pour "
        "gagner les enchères, ou une annonce refusée dont la campagne continue "
        "d'exister. Ce n'est pas un budget économisé — c'est un budget qui "
        "ment sur ce que tu prévois.",
        f"Ouvre « {nom} » et regarde d'abord si ses annonces sont bien diffusées. "
        f"Si elles le sont, baisse le budget à ce qu'elle dépense vraiment et "
        f"remets les {dort:,.0f} CHF sur une campagne qui, elle, consomme le sien.",
        "Je ne vois pas POURQUOI le budget ne part pas — ni l'audience, ni "
        "l'enchère, ni le statut de tes annonces ne sont dans ce que je récolte. "
        "Je vois l'écart, et lui seul."
        + (f" Le budget posé est celui du relevé du {releve}." if releve else ""),
        "solide", 1,
        repere="Le repère : sous 10 % d'écart entre posé et dépensé, tout va "
               "bien — les régies lissent sur la semaine. C'est à partir du "
               "DOUBLE que le budget posé ne décrit plus rien.",
        nature="corriger", role="generale",
    )
    reco["cible"] = f"{c.get('canal')}:{c.get('nom')}"
    return reco


# ── 8 · L'ANNONCE USÉE — trop revue par les mêmes gens ──────────────────────

def regle_annonce_usee(theme: str, annonces: list[dict]) -> dict | None:
    """Une annonce Meta revient trop souvent devant les mêmes personnes, et son
    clic s'est renchéri d'une semaine sur l'autre.

    LE PIÈGE DE LA PORTÉE, NOMMÉ D'AVANCE PAR LE TICKET 10 : `reach` compte des
    personnes DÉDOUBLONNÉES, et deux jours de portée ne s'additionnent pas —
    quelqu'un touché lundi et mardi est une personne, pas deux. On ne peut donc
    PAS calculer la fréquence hebdomadaire, qui demande la portée unique de la
    semaine, et aucune API ne nous la donne par annonce et par jour.

    CE QU'ON CALCULE À LA PLACE, ET POURQUOI C'EST HONNÊTE : impressions de la
    semaine ÷ SOMME des portées quotidiennes. Cette somme est toujours PLUS
    GRANDE que la portée unique de la semaine (elle compte plusieurs fois qui
    revient), donc le rapport est toujours PLUS PETIT que la vraie fréquence.
    C'est un PLANCHER de fréquence, jamais son estimation. Quand ce plancher
    dépasse déjà `freq_plancher`, la vraie fréquence le dépasse aussi — la règle
    se tait donc plus souvent qu'elle ne le devrait, jamais l'inverse.

    LA FRÉQUENCE SEULE NE SUFFIT PAS. Une audience volontairement étroite (du
    retargeting) tourne haut en fréquence et marche très bien. C'est la fatigue
    qu'on cherche, c'est-à-dire la fréquence ET le prix du clic qui monte avec
    elle : `freq_cpc_hausse` compare l'annonce à ELLE-MÊME, la semaine d'avant.

    MÉTA SEULEMENT, et pas par choix : `google_ads_ad_insights` ne porte pas de
    portée. Sans portée, pas de fréquence — et une fréquence supposée serait un
    chiffre fabriqué.

    `annonces` : [{cle, nom, groupe, campagne, jeune, impressions,
                   portee_cumul, clics, depense, cpc_avant}].
    """
    candidats = []
    for a in annonces or []:
        if a.get("jeune"):
            continue
        portee = float(a.get("portee_cumul") or 0)
        clics = int(a.get("clics") or 0)
        depense = float(a.get("depense") or 0)
        cpc_avant = a.get("cpc_avant")
        if portee <= 0 or clics <= 0 or depense < SEUILS["cpc_spend_min"]:
            continue
        if cpc_avant is None or float(cpc_avant) <= 0:
            continue   # sans semaine d'avant, on ne sait pas si le clic MONTE
        plancher = float(a.get("impressions") or 0) / portee
        cpc = depense / clics
        if (plancher >= SEUILS["freq_plancher"]
                and cpc >= float(cpc_avant) * SEUILS["freq_cpc_hausse"]):
            candidats.append((a, plancher, cpc, float(cpc_avant)))
    if not candidats:
        return None

    a, plancher, cpc, cpc_avant = max(candidats, key=lambda x: float(x[0]["depense"]))
    nom = _nom(a)
    groupe = str(a.get("groupe") or "").strip()
    reco = _designe(a, _reco(
        "annonce_usee", "meta",
        f"« {nom} » : au moins {plancher:.1f} vues par personne, et le clic monte",
        f"Sur « {theme} », « {nom} » a été vue au moins {plancher:.1f} fois par "
        f"personne cette semaine, et son clic est passé de {cpc_avant:.2f} à "
        f"{cpc:.2f} CHF ({(cpc / cpc_avant - 1) * 100:+.0f} %) pour "
        f"{float(a['depense']):,.0f} CHF dépensés.",
        "C'est la signature de l'usure : les mêmes personnes revoient la même "
        "annonce, elles cliquent de moins en moins, et la régie doit payer plus "
        "cher chaque clic restant. Ce n'est pas le ciblage qui s'est dégradé, "
        "c'est le message qui a fini d'être neuf.",
        (f"Mets « {nom} » en pause et remets-en une variante dans le Groupe "
         f"« {groupe[:40]} » — même offre, autre visuel ou autre première "
         "phrase. Si le clic redescend la semaine prochaine, c'était bien "
         "l'usure." if groupe else
         f"Mets « {nom} » en pause et remets-en une variante — même offre, "
         "autre visuel ou autre première phrase. Si le clic redescend la "
         "semaine prochaine, c'était bien l'usure."),
        "Le chiffre que j'affiche est un MINIMUM : je somme des portées "
        "quotidiennes, qui comptent plusieurs fois quelqu'un touché plusieurs "
        "jours. La vraie fréquence est plus haute que celle-ci, jamais plus "
        "basse. Et je ne vois pas ton audience : si elle est volontairement "
        "petite, une fréquence élevée est normale — c'est la HAUSSE du clic qui "
        "fait le signal, pas la fréquence seule.",
        "solide", 1,
        repere="Le repère du métier : au-delà de 2,5 vues par personne et par "
               "semaine en prospection, une créa Meta commence à décrocher, et "
               "au-delà de 4 elle s'effondre. Sur du retargeting, ces nombres "
               "sont plus hauts — c'est la hausse du prix du clic qui tranche.",
        nature="créer", role="generale",
    ))
    reco["cible"] = str(a.get("cle") or nom)
    return reco


# ── 9 · LA PAGE D'ARRIVÉE QUI NE RÉPOND PAS ─────────────────────────────────

def regle_page_arrivee_muette(theme: str, arrivee: dict) -> dict | None:
    """Les régies facturent des clics que Google Analytics ne voit pas arriver.

    ELLE NOMME UN ÉCART, PAS UNE PAGE, et c'est une limite du ticket 10 écrite
    d'avance : GA4 n'a aujourd'hui AUCUNE dimension de page dans ce qu'on
    récolte (`saas/collecte/ga4/fetch_ga4.py`). Dire LAQUELLE de tes pages perd
    les gens serait un chiffre fabriqué — donc la règle ne le dit pas.

    C'EST UN PRÉREQUIS DE MESURE (levier `socle`), pas un conseil de pilotage :
    tant qu'on ne sait pas où passent les clics payés, tout ce que Pulse dit du
    retour de ce thème est bâti sur un revenu partiel. Sa place est dans le bloc
    « réglages », à côté de « connecte Google Analytics », pas dans les places
    de la semaine.

    `arrivee` : {clics, sessions, depense}. `sessions=None` veut dire « GA4 ne
    répond pas » et non « zéro session » : la règle se tait.
    """
    a = arrivee or {}
    clics = int(a.get("clics") or 0)
    sessions = a.get("sessions")
    depense = float(a.get("depense") or 0)
    if sessions is None:
        return None
    # `funnel_views_min` sert déjà de « assez d'observations pour juger un taux »
    # à `_rule_funnel` : c'est la même question, posée sur des clics.
    if clics < SEUILS["funnel_views_min"] or depense < SEUILS["cpc_spend_min"]:
        return None
    sessions = int(sessions)
    if sessions >= clics * SEUILS["arrivee_perte_max"]:
        return None

    perdus = clics - sessions
    reco = _reco(
        "page_arrivee_muette", "pub",
        f"« {theme} » : {clics:,} clics payés, {sessions:,} visites comptées",
        f"Les campagnes de « {theme} » ont fait payer {clics:,} clics cette "
        f"semaine pour {depense:,.0f} CHF. Google Analytics n'a enregistré que "
        f"{sessions:,} visites venues de ces campagnes — "
        f"{perdus:,} clics ({perdus / clics * 100:.0f} %) n'arrivent nulle part.",
        "Un écart de 10 à 20 % est normal : le bouton retour, un double clic, "
        "un bloqueur, quelqu'un qui part avant la fin du chargement. Au-delà, "
        "c'est presque toujours technique — une balise absente d'une page "
        "d'arrivée, une redirection qui efface les paramètres de campagne, ou "
        "un lien qui n'en porte pas.",
        "Clique une de tes annonces toi-même, et regarde dans Google Analytics "
        "→ Temps réel si ta visite apparaît avec la bonne campagne. Si elle "
        "n'apparaît pas, la balise manque sur la page d'arrivée ; si elle "
        "apparaît sans campagne, ce sont les paramètres du lien qui se perdent "
        "en route.",
        "Je ne peux pas te dire QUELLE page perd les gens : je ne récolte "
        "aucune dimension de page côté Google Analytics. Je compare un total de "
        "clics à un total de visites, rien de plus fin. Et tant que cet écart "
        "existe, le revenu que j'attribue à ce thème est un minimum.",
        "solide", 1,
        repere="Le repère : 10 à 20 % d'écart entre clics et visites est "
               "normal, au-dessus de 30 % Google lui-même parle d'un problème "
               "technique. Ici on a passé la moitié.",
        nature="corriger", role="generale",
    )
    # `_enjeu` départage deux thèmes qui portent le même écart : c'est celui qui
    # perd le plus de clics payés dont la réparation rapporte le plus.
    reco["_enjeu"] = perdus
    reco["cible"] = theme
    return reco


# ── 10 · LE JOUR DE LA SEMAINE QUI COÛTE LE PLUS CHER ───────────────────────

_JOURS = ("lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche")


def regle_creneau_pub(theme: str, creneaux: list[dict]) -> dict | None:
    """Un jour de la semaine paie son clic bien plus cher que les six autres.

    MÉTA SEULEMENT, et c'est une condition posée par
    `.scratch/refonte/issues/24-conseils-payants-manquants.md` : on ne récolte
    pas la stratégie d'enchère d'une campagne Google, et imposer une plage de
    diffusion par-dessus une enchère intelligente dégrade la performance au lieu
    de l'améliorer. Le conseil serait donc faux là où on ne sait pas.

    QUATRE SEMAINES, PAS UNE. Un jour de la semaine ne se juge pas sur une seule
    occurrence : `creneau_jours_min` exige quatre lundis avant de parler d'un
    lundi, et la fenêtre de 28 jours qui sert déjà de « norme » à un thème est
    exactement ce qu'il faut pour les avoir.

    `creneaux` : [{jour: 0=lundi..6, occurrences, depense, clics}].
    """
    jours = [c for c in (creneaux or []) if int(c.get("clics") or 0) > 0]
    total_clics = sum(int(c["clics"]) for c in jours)
    total_depense = sum(float(c.get("depense") or 0) for c in jours)
    if total_clics <= 0 or total_depense <= 0:
        return None

    candidats = []
    for c in jours:
        if int(c.get("occurrences") or 0) < SEUILS["creneau_jours_min"]:
            continue
        depense = float(c.get("depense") or 0)
        clics = int(c["clics"])
        if depense < SEUILS["cpc_spend_min"]:
            continue
        autres_clics = total_clics - clics
        autres_depense = total_depense - depense
        if autres_clics <= 0 or autres_depense <= 0:
            continue
        cpc, cpc_autres = depense / clics, autres_depense / autres_clics
        if cpc >= cpc_autres * SEUILS["cpc_ratio"]:
            candidats.append((c, cpc, cpc_autres, depense))
    if not candidats:
        return None

    c, cpc, cpc_autres, depense = max(candidats, key=lambda x: x[3])
    jour = _JOURS[int(c["jour"]) % 7]
    reco = _reco(
        "creneau_pub", "meta",
        f"Le {jour} te coûte {cpc / cpc_autres:.1f}× le clic des autres jours",
        f"Sur « {theme} », les {jour}s ont coûté {depense:,.0f} CHF pour "
        f"{int(c['clics']):,} clics sur les quatre dernières semaines, soit "
        f"{cpc:.2f} CHF le clic — contre {cpc_autres:.2f} CHF les autres jours. "
        f"Mesuré sur {int(c['occurrences'])} {jour}s.",
        "Le prix d'un clic est une enchère, et l'enchère n'a pas le même prix "
        "tous les jours : moins de monde disponible, ou plus d'annonceurs qui "
        "payent pour le même créneau. Ça peut aussi être ton public qui n'est "
        f"simplement pas là le {jour}.",
        f"Dans Meta, baisse la diffusion du {jour} sur les campagnes de ce thème "
        "— ou coupe-la — et regarde le prix du clic du thème la semaine "
        f"suivante. S'il descend sans que le volume s'effondre, le {jour} te "
        "coûtait vraiment cher.",
        "Je ne regarde que Meta : on ne récolte pas la stratégie d'enchère de "
        "Google, et brider les horaires d'une enchère automatique la dégrade au "
        "lieu de l'aider. Et je compte des clics, pas des ventes : un jour cher "
        "au clic peut très bien être ton meilleur jour de vente.",
        "creuser", 2,
        repere="Le repère : ne coupe jamais un jour entier d'un coup. Baisse-le "
               "d'abord, sur deux semaines — un jour supprimé emporte aussi "
               "l'apprentissage de la campagne, et ça se paie sur les six autres.",
        nature="corriger", role="generale",
    )
    # Même raison que `theme_deux_regies` : sans le thème, `cible` n'a que sept
    # valeurs pour tout le compte, et un dimanche cher servi sur un thème
    # musellerait le dimanche cher d'un autre.
    reco["cible"] = f"{theme}:{jour}"
    return reco
