"""La Marche SUIVANTE d'une Stratégie — la moitié IA du plan de thème.

Aucune règle déterministe ne sait que « refaire la page d'arrivée » se descend
en appel à l'action → titre → structure : ce n'est pas dans les chiffres, c'est
du savoir-faire. C'est le seul trou que
`.scratch/refonte/issues/22-rebrancher-le-plan-de-theme.md` (décision 6) laisse
à Gemini après que
`.scratch/refonte/issues/11-d-ou-viennent-les-conseils.md` a coupé les pistes
IA libres — et la coupe reste intacte : elle visait l'idée INVENTÉE À PARTIR DE
CHIFFRES, pas le savoir-faire, et elle a explicitement épargné les astuces
(`_themes_tips`), qui sont le même bois.

CE QUE CE MODULE N'ÉCRIT PAS, ET C'EST CE QUI LE REND ACCEPTABLE : il ne produit
aucun chiffre. `observation` reformule la Marche déjà faite, `verifier` dit où
regarder, `repere` est interdit. Les seuls nombres du conseil final sont posés
APRÈS coup par `build_report.py` (`_attach_metric` photographie la baseline du
thème lui-même) — donc mesurés, jamais rédigés (`CLAUDE.md` §7).

── LES TROIS BARRIÈRES DURES ────────────────────────────────────────────────

1. IL N'OUVRE JAMAIS UNE STRATÉGIE. Seule une règle le fait, en posant une
   Hypothèse (`role="hypothese"`) sur un thème. Deux verrous indépendants :
     · `marche_suivante()` rend `None` sans une Marche DÉJÀ FAITE — et une
       Marche n'existe que si une règle l'a ouverte puis que le client a cliqué
       « ✓ Je l'ai fait » ;
     · la piste est REJETÉE si elle ne déclare pas `role="generale"`. C'est le
       garde-fou de `.scratch/refonte/issues/14-le-conseil-facile-et-la-degradation.md`
       (décision 11 : *« la Marche proposée doit être `role: generale`, donc
       constatable demain »*), et il se referme tout seul en aval : la boucle
       qui écrit `theme_plan` ne retient que `role == "hypothese"`
       (`build_report.py`), donc rien de ce qui sort d'ici ne peut devenir la
       Marche courante d'un plan de thème, même par accident.

2. IL DÉCLARE SA GRAMMAIRE DANS LES LISTES FERMÉES, sous peine de rejet de la
   piste ENTIÈRE — jamais de correction, jamais de valeur devinée. Un geste
   deviné n'est pas un geste, c'est un mot (`_est_conseil`, même mécanique).

3. IL NE NOMME QU'UN OBJET PRÉSENT DANS LES `facts` DU THÈME. `cible` est
   obligatoire et doit se retrouver dans `objets_nommables(facts)` — les noms
   de campagnes et d'annonces que la récolte a réellement rangés sous ce thème.
   Sans ça, Gemini pouvait nommer une campagne qui n'existe pas, ou une qui
   appartient à un autre thème (`.scratch/refonte/issues/14-…`, décision 7 :
   une campagne ne se nomme que si elle appartient au thème traité).

── POURQUOI LES LISTES FERMÉES ARRIVENT PAR PARAMÈTRE ───────────────────────

Elles vivent dans `build_report.py`, et la dépendance court dans ce sens-là :
`build_report` importe `recos_ia`, jamais l'inverse. Les recopier ici ferait
exactement les deux tables qui finissent par ne plus dire la même chose — ce
qui a coûté `PROOF_KPI` (ticket 22, décision 5). L'appelant passe donc les
siennes, et `valider_marche` n'a aucune liste en propre à faire diverger.

Module headless comme `theme_memoire.py` et `user_persona.py` : on lui passe
`redige(prompt) -> str|None`. Aucun import de Gemini ici — c'est ce qui permet
de le faire tourner hors ligne avec un faux appel qui capture le prompt
(`.scratch/construction/harnais/24-marche-suivante/`).
"""

from __future__ import annotations

import json
import re
import unicodedata

# Le rôle exigé d'une Marche écrite par Gemini. Voir la barrière 1 : il n'est
# pas posé par nous, il est EXIGÉ de la déclaration — une piste qui déclare
# autre chose est rejetée, pas corrigée.
ROLE_EXIGE = "generale"

# La confiance d'une Marche, posée en dur ici et JAMAIS déclarée par Gemini.
# Une IA qui note sa propre fiabilité fabrique la seule chose que le lecteur
# utilise pour la croire. `creuser` est la valeur juste, et les deux voisines
# diraient faux : `solide` est réservé à ce qu'une règle a MESURÉ, et ce
# conseil-ci ne mesure rien ; `piste` dirait qu'on n'en sait rien, alors qu'on
# sait que le client a fait la Marche précédente — c'est un clic en base.
CONFIANCE = "creuser"

# Le poids d'impact, dernier départage d'`_importance` (plus petit = plus
# important). 50 place la Marche derrière les règles, qui déclarent 1 à 30 :
# une étape de savoir-faire ne passe pas devant un gaspillage mesuré.
PRIORITE = 50

# Les champs que Gemini a le droit de remplir. Tout le reste de `RECO_FIELDS`
# est posé par le code ou par `build_report.py`. `repere` n'y est PAS, et c'est
# volontaire : c'est la pastille « 💡 vise X » — un seuil chiffré, donc
# exactement ce que ce module n'a pas le droit d'écrire (`CLAUDE.md` §7).
CHAMPS_IA = ("titre", "observation", "pourquoi", "verifier", "angle_mort",
             "cible", "nature", "role", "levier", "metric", "effort")


def _nrm(txt) -> str:
    """Casse, accents et espaces neutralisés — la comparaison des noms d'objets.

    Un nom de campagne se compare comme `build_report.py` le compare partout
    ailleurs : « Rentrée 2026 » et « rentree 2026 » sont la même campagne, et
    rejeter la Marche pour un accent ferait perdre une étape valide.
    """
    s = unicodedata.normalize("NFKD", str(txt or ""))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return " ".join(s.lower().split())


def _slug(txt) -> str:
    return re.sub(r"[^a-z0-9]+", "-", _nrm(txt)).strip("-")[:40]


def cle_de(titre: str) -> str:
    """La clé d'une Marche : `marche_` + le titre réduit en slug.

    ELLE PORTE L'ÉTAPE, PAS LA STRATÉGIE, et c'est ce qui fait avancer
    l'échelle. L'empreinte anti-répétition est (clé, cible)
    (`composition.py::empreinte`) : une clé constante aurait bloqué « change le
    titre » après « change l'appel à l'action », les deux visant la même page —
    l'échelle se serait arrêtée à sa première marche. Deux instructions
    identiques rendent en revanche le même slug, et la seconde ne repasse pas.
    """
    return f"marche_{_slug(titre) or 'sans-titre'}"


def objets_nommables(facts: dict | None) -> list[str]:
    """Les objets que la Marche a le DROIT de nommer : tout `nom` des `facts`.

    Balayage récursif plutôt qu'une liste de chemins en dur — `facts` gagne une
    clé à chaque ticket de règles payantes (`campagnes`, `usure`, `creneaux`,
    `arrivee`, `regies` au dernier compte), et une liste de chemins aurait
    silencieusement cessé de couvrir la suivante.

    CE QUI N'A PAS DE `nom` N'EST PAS NOMMABLE, ET C'EST VOULU : `creneaux` ne
    porte qu'un numéro de jour, `arrivee` et `regies` sont des agrégats. Ce ne
    sont pas des objets qu'on ouvre pour les corriger — une Marche qui les
    désignerait ne pourrait être ni faite, ni constatée demain.
    """
    vus, out = set(), []

    def _descendre(n):
        if isinstance(n, dict):
            nom = str(n.get("nom") or "").strip()
            if nom and _nrm(nom) not in vus:
                vus.add(_nrm(nom))
                out.append(nom)
            for v in n.values():
                _descendre(v)
        elif isinstance(n, (list, tuple)):
            for v in n:
                _descendre(v)

    _descendre(facts or {})
    return out


def build_prompt(theme: str, marche_faite: dict, objets: list[str],
                 listes: dict, deja_faites: list[str] | None = None,
                 resume: str | None = None) -> str:
    """Le prompt de la Marche suivante. Pure — aucun accès base, aucun appel IA.

    Séparée du pilote pour la même raison que `theme_memoire.build_prompt` : la
    propriété qui protège « aucun chiffre fabriqué » est que la chaîne rendue
    ne demande AUCUN nombre, et ça se vérifie par lecture dans un test.

    `deja_faites` est l'anti-boucle. Sans elle, Gemini pouvait reformuler
    éternellement la même étape : le slug changeait, l'empreinte aussi, et
    `composer_la_semaine` laissait passer. Les étapes déjà faites sur ce thème
    sont donc écrites dans le prompt, avec l'ordre de ne pas les refaire.
    """
    _l = listes
    liste = lambda cle: ", ".join(_l.get(cle) or ())  # noqa: E731
    bloc_deja = ""
    if deja_faites:
        # Les huit dernières — même raison que dans `theme_memoire` : ce sont
        # les récentes qui risquent d'être répétées, pas les anciennes.
        bloc_deja = ("\nÉtapes DÉJÀ faites sur ce thème, à ne répéter sous "
                     "aucune forme, même reformulées :\n"
                     + "\n".join(f"- « {t} »" for t in deja_faites[-8:]) + "\n")
    bloc_resume = f"\nOù en est ce thème : {resume.strip()}\n" if resume else ""
    return (
        "Tu es un consultant marketing senior. Un client vient de terminer une "
        "étape d'un chantier en cours sur un de ses thèmes de communication, et "
        "tu écris L'ÉTAPE SUIVANTE — une seule.\n\n"
        f"Thème : « {theme} ».\n"
        f"Étape qu'il vient de terminer : « {str(marche_faite.get('title') or '').strip()} ».\n"
        f"{bloc_resume}{bloc_deja}\n"
        "Tu n'ouvres AUCUN nouveau chantier : tu continues celui-là, d'un cran. "
        "Un chantier se descend par marches — refaire une page d'arrivée, c'est "
        "l'appel à l'action, PUIS le titre, PUIS la structure. Donne la marche "
        "qui vient juste après celle qui est faite, et rien d'autre.\n\n"
        "Elle doit être CONSTATABLE DEMAIN : quelqu'un qui ouvre l'outil doit "
        "pouvoir voir à l'œil qu'elle a été faite. Pas une théorie à mesurer, "
        "pas « observe pendant deux semaines ».\n\n"
        "Tu ne peux désigner QUE l'un de ces objets, en le recopiant "
        "EXACTEMENT :\n"
        + "\n".join(f"- {o}" for o in objets) + "\n\n"
        "RÈGLES ABSOLUES — toute réponse qui en enfreint une est jetée en "
        "entier, donc dans le doute abstiens-toi :\n"
        "- N'ÉCRIS AUCUN CHIFFRE. Ni montant, ni pourcentage, ni seuil, ni "
        "durée chiffrée, ni objectif à atteindre. Tu n'as reçu aucune donnée "
        "du compte et tu n'en inventes pas.\n"
        "- N'affirme rien sur ce que l'étape précédente a donné : tu sais "
        "qu'elle a été faite, pas si elle a marché.\n"
        "- `cible` doit être l'un des objets listés ci-dessus, recopié tel "
        "quel. Si aucun ne convient, réponds exactement : RIEN.\n\n"
        "Réponds UNIQUEMENT avec un objet JSON, sans texte autour :\n"
        '{"titre":"…","observation":"…","pourquoi":"…","verifier":"…",'
        '"angle_mort":"…","cible":"…","nature":"…","role":"…","levier":"…",'
        '"metric":"…","effort":"…"}\n\n'
        f"`nature` (le geste demandé) — obligatoirement l'un de : {liste('natures')}.\n"
        f"`role` — obligatoirement : {ROLE_EXIGE}.\n"
        f"`levier` (ce sur quoi on agit) — obligatoirement l'un de : {liste('leviers')}.\n"
        f"`metric` (l'indicateur que cette marche fait bouger) — "
        f"obligatoirement l'un de : {liste('metrics')}.\n"
        f"`effort` (le temps que ça prend) — obligatoirement l'un de : {liste('efforts')}.\n\n"
        "`titre` : 8 mots au maximum, à l'impératif. `observation` : ce qui est "
        "fait et ce qui vient ensuite, 2 phrases. `pourquoi` : pourquoi cette "
        "marche-là maintenant, 1 phrase. `verifier` : où regarder pour voir "
        "qu'elle est faite, 1 phrase. `angle_mort` : ce que cette marche ne "
        "règle pas, 1 phrase. Français, ton direct, pas de guillemets."
    )


def valider_marche(brut: dict, objets: list[str], listes: dict) -> dict | None:
    """La piste validée, ou `None` — et le rejet porte sur la piste ENTIÈRE.

    Aucune valeur n'est corrigée, complétée ni devinée. C'est la mécanique que
    `_est_conseil` applique déjà aux règles, pour la même raison : une colonne
    de la grammaire qu'on rattrape après coup n'a pas été déclarée, et le seul
    intérêt de ces listes est qu'elles soient déclarées.
    """
    if not isinstance(brut, dict):
        return None
    txt = {c: str(brut.get(c) or "").strip() for c in CHAMPS_IA}

    # Les cinq textes sans lesquels la carte s'afficherait à trous.
    if not all(txt[c] for c in ("titre", "observation", "pourquoi", "verifier",
                                "angle_mort", "cible")):
        return None

    # BARRIÈRE 1 — il n'ouvre jamais une Stratégie.
    if txt["role"] != ROLE_EXIGE:
        return None

    # BARRIÈRE 2 — les listes fermées, telles que l'appelant les tient.
    for champ, cle in (("nature", "natures"), ("levier", "leviers"),
                       ("metric", "metrics"), ("effort", "efforts")):
        if txt[champ] not in (listes.get(cle) or ()):
            return None

    # BARRIÈRE 3 — un objet présent dans les `facts` du thème, et lui seul. On
    # rend le nom TEL QU'IL EST EN BASE, pas tel que Gemini l'a recopié : la
    # cible entre dans l'empreinte anti-répétition (`composition.py`), et deux
    # graphies du même objet y feraient deux empreintes — la même instruction
    # repasserait la semaine suivante à une majuscule près.
    cible = next((o for o in objets if _nrm(o) == _nrm(txt["cible"])), None)
    if not cible:
        return None

    return {
        "key": cle_de(txt["titre"]),
        "title": txt["titre"][:70],
        "observation": txt["observation"],
        "pourquoi": txt["pourquoi"],
        "verifier": txt["verifier"],
        "angle_mort": txt["angle_mort"],
        "repere": "",          # la pastille chiffrée, interdite ici
        "cible": cible,
        "nature": txt["nature"],
        "role": txt["role"],
        "levier": txt["levier"],
        "metric": txt["metric"],
        "effort": txt["effort"],
        "confidence": CONFIANCE,
        "priority": PRIORITE,
        "source": "ai",
    }


def _charger(raw: str | None) -> dict | None:
    """Le JSON de Gemini, clôtures markdown comprises. `None` si illisible.

    Même tolérance que `_themes_tips` : le modèle emballe régulièrement sa
    réponse dans ```json, et une panne de lecture ne doit jamais remonter — un
    rapport se publie sans sa Marche, jamais avec une exception.
    """
    if not raw:
        return None
    try:
        txt = raw.strip()
        if txt.startswith("```"):
            txt = txt.strip("`")
            txt = txt[4:] if txt.lower().startswith("json") else txt
        obj = json.loads(txt.strip())
        return obj if isinstance(obj, dict) else None
    except Exception:
        return None


def marche_suivante(theme: str, marche_faite: dict | None, facts: dict | None,
                    redige, listes: dict,
                    deja_faites: list[str] | None = None,
                    resume: str | None = None,
                    platform: str | None = None) -> dict | None:
    """La Marche suivante d'une Stratégie ouverte, ou `None`. Un appel Gemini.

    `marche_faite` est la Marche que le client a CONFIRMÉE avoir faite (une
    ligne `suivi_actions` à `status="done"` avec son `done_at`). Elle est la
    condition d'existence de tout ce module : « la suivante n'arrive que
    lorsque la précédente est faite — un Verdict ne fait pas avancer d'une
    marche, il dit si la Stratégie continue ou change » (`CONTEXT.md`, entrée
    Marche, et `.scratch/refonte/issues/14-…` décision 9).

    Quatre replis silencieux, alignés sur le reste du produit — une panne d'IA
    ne prive jamais le client de son rapport, elle lui retire une carte :
    · aucune Marche faite → aucun appel (il n'y a pas de Stratégie à continuer) ;
    · aucun objet nommable dans les `facts` → aucun appel (barrière 3 : il n'y
      aurait rien à nommer, donc rien qui puisse passer la validation) ;
    · Gemini échoue, n'a pas de clé, ou répond RIEN → `None` ;
    · la piste enfreint une barrière → `None`, jamais une piste rafistolée.
    """
    if not (theme and isinstance(marche_faite, dict) and callable(redige)):
        return None
    if not str(marche_faite.get("title") or "").strip():
        return None
    objets = objets_nommables(facts)
    if not objets:
        return None
    piste = valider_marche(
        _charger(redige(build_prompt(theme, marche_faite, objets, listes,
                                     deja_faites, resume))) or {},
        objets, listes,
    )
    if piste and platform:
        # La Marche suit la Stratégie : elle se range sur le même canal que
        # l'étape précédente. Jamais deviné depuis le texte — ce serait la même
        # erreur que `_LEVIER_MOTS`, gardé en repli défensif et pas en usage.
        piste["platform"] = platform
    return piste
