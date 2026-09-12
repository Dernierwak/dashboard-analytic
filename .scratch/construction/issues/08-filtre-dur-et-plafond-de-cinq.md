# Le filtre dur sur les thèmes prioritaires, et le plafond de cinq

Type: task
Status: resolved
Blocked by: 06

## Question

**C'est la phrase du produit qui se bâtit ici.** Tranché par
[21](../../refonte/issues/21-le-document-de-refonte.md), obtenu en corrigeant le
produit — David, mot pour mot : *« Non putin. […] Les labels sont les recos pour
les labels prio. Fin. »*

**Pulse n'arbitre pas entre les thèmes** : le client désigne ses priorités (trois
au maximum), Pulse conseille dedans.

### Le défaut, à la ligne

`build_report.py` **l. 442 ne fait qu'un TRI** : `is_priority` passe en tête, mais
les conseils des thèmes non prioritaires **sortent quand même plus bas**. Il faut
un **filtre dur**. Ils disparaissent.

### Les décisions à bâtir

- **Cinq par semaine au maximum sur tout le compte** — aujourd'hui c'est 3 par
  thème sur un nombre de thèmes **illimité**, donc pas un plafond du tout.
  **Un plafond, jamais un quota : on ne complète pas avec du non-prioritaire.**
- **Zéro priorité = module VERROUILLÉ**, qui dit « désigne un thème prioritaire
  pour recevoir des conseils » — **jamais un module vide, jamais du décor**
  ([04](../../refonte/issues/04-ce-qui-doit-etre-valide-en-premier.md), patron des
  modules verrouillés : visible, verrouillé, avec ce qu'il débloque écrit dessus).
- **Un compte qui ne classe jamais reçoit le point de vue de la semaine et AUCUN
  conseil.** Le chemin compte-entier déterministe (`build_recos`, l. 2048) existe
  toujours et **n'est pas rebranché exprès** — c'est gratuit chez les régies
  ([02](../../refonte/issues/02-sur-quoi-se-differencient-les-autres.md)).
  **Ne pas le « réparer ».**
- **Le conseil naît sur la carte du thème** ; le renvoi devient une notification
  qui vit dans l'app, **hors du rapport**.
- **Les pistes inventées par l'IA sont coupées** — le seul endroit que rien ne
  peut vérifier.
- **La composition des cinq**
  ([14](../../refonte/issues/14-le-conseil-facile-et-la-degradation.md)) : 1 à 2
  Marches d'une Stratégie + des retouches à faible effort et fort enjeu.
  **Un plafond, pas un plancher** — jamais plus de deux `créer`/`corriger` à
  `effort ≥ 1 h`, parce qu'un plancher qu'on ne peut pas tenir se remplit de décor.
- **`too_hard` simplifie, le silence met en veille.** Lire une absence, c'est
  inventer une intention (§7).
- **Le moteur trie, l'IA explique** : `bloques` se branche (un argument), le
  persona garde le ton, **jamais le tri**.
- **L'empreinte = clé + cible** : le même conseil revient avec un autre chiffre,
  jamais à l'identique. David a renversé la recommandation qui voulait sortir la
  clé — **ne pas la re-proposer**.
- **Le résultat attendu ne s'affiche JAMAIS** : il pondère le tri en interne,
  comme `_importance` le fait déjà.

### Le cinquième tuyau mort à raccorder

**« ◇ Trop compliqué » (`too_hard`) est collecté depuis toujours et le moteur ne
le lit jamais** (12). Pire, il est **raccordé au mauvais bout** :
`_themes_tips(bloques=…)` porte le prompt exact, et **le seul appelant ne passe
que deux arguments** — pendant que `reco-actions.tsx:39` promet par écrit un
« Pour aller plus loin » **qui n'existe nulle part** (14). C'est un argument à
brancher, pas un champ à créer.

### Consigne de repli

Le **filtre dur** et le **module verrouillé** d'abord : ce sont eux qui portent la
phrase du produit. La composition des cinq et `bloques` peuvent suivre.

## Answer

**Le filtre dur existe en code, et le plafond de cinq aussi.** Un conseil ne
naît que sur un thème que le client a désigné ; il n'y en a jamais plus de cinq
sur tout le compte ; et les pistes que rien ne pouvait vérifier sont coupées.

### Ce qui a été bâti

**1 · Le filtre dur.** `_THEMES_IA` est devenu `_THEMES_CONSEILLES` et a changé
de métier : il ne comptait plus une facture, il compte les thèmes qu'on
travaille. `_conseille = nlbl in _themes_conseilles` se lit sur
`priority_labels[:3]`, **jamais sur `theme_list`** — cette dernière retombe sur
les trois plus gros thèmes quand rien n'est étoilé, et ce repli donne des
*cartes* par défaut, jamais des *priorités*. Hors du garde, **aucune règle ne
tourne** : `build_recos`, `_orga_recos`, `_reco_evenements` et
`regles_payantes` sont tous les quatre à l'intérieur de `if _conseille:`, et ce
`if` **n'a pas de `else`** — un plafond qui n'est pas un quota ne se complète
pas. Vérifié sur l'ARBRE, pas sur le texte (`test_filtre_dur.py`).

**Et le tri a perdu son premier critère.** `is_priority` était en tête
d'`_importance` : c'est exactement ce que le ticket dénonçait. Un filtre ne se
double pas d'un critère de tri — il ne reste rien à départager sur cet axe.

**2 · Le plafond de cinq.** Module **pur et neuf**,
`saas/recos_ia/composition.py` (même patron que `regles_payantes.py` au ticket
07) : `PLAFOND_SEMAINE = 5`, `MAX_MARCHES = 2`, `MAX_LOURDS = 2`
(`créer`/`corriger` à `effort ≥ 1 h`), et l'`empreinte`. Il **coupe, il ne trie
pas** — le tri connaît le rang du thème, qui ne se calcule pas dans un module
pur.

**Il s'applique à un endroit précis, et les trois raisons comptent** : APRÈS
`_attach_effort` (la composition lit l'effort, qui n'est posé que là), APRÈS le
jugement de thème (qui réordonne un thème qui se dégrade), et **AVANT
`upsert_theme_plan`** — une Marche que le plafond n'a pas retenue n'ouvre
**aucune** Stratégie, sinon la mémoire de Pulse porterait une théorie que
personne n'a lue.

**La coupe à trois par thème reste, et ce n'est plus le plafond** : elle
empêche seulement qu'un seul thème présente les cinq.

**3 · L'empreinte = clé + cible.** La clé reste dedans — la recommandation qui
voulait l'en sortir a été renversée par David, elle n'est pas re-proposée.
**Elle filtre AVANT la coupe à trois d'un thème, pas seulement au plafond** :
filtrer à la fin seulement aurait laissé la coupe se remplir de conseils déjà
servis, et le thème serait sorti muet alors qu'un quatrième, frais, attendait
derrière. **Horizon assumé : huit rapports** — ceux que `_rapports_publies`
relit déjà. Au-delà, une instruction identique peut revenir ; c'est une borne,
et elle est écrite. La semaine en cours est exclue, sinon « ↻ Recharger mes
conseils » se muselerait lui-même.

**4 · Les pistes IA sont coupées.** `_theme_ai_recos` (≈ 250 lignes, prompt
compris) et `_forcer_une_hypothese` sont supprimées, et avec elles le **second
chemin** : il n'y a plus qu'un thème, un code. Les quatre autres appels Gemini
restent — astuces, ton, résumé, mémoire : aucun ne touche un chiffre du compte.
Cinq constantes ont perdu leur suffixe en perdant Gemini : `LEVIERS_IA` →
`LEVIERS`, `METRICS_IA` → `METRICS_MESURABLES`, `NATURES_IA` → `NATURES`,
`ROLES_IA` → `ROLES`, `METRIC_INFO_IA` → `METRIC_INFO`. **Aucune valeur n'a
changé.** Les deux dernières ne sont plus décoratives : `_est_conseil` rejette
un geste hors de `NATURES`, `_attach_grammaire` **retire** un rôle hors de
`ROLES` plutôt que d'en deviner un.

**Le blocage de la Marche a été porté**, il n'a pas disparu avec le chemin qui
le portait : tant qu'aucun Verdict n'est tombé et que la fenêtre d'attente
court, la carte épinglée se réaffiche à l'identique, et son empreinte est
exemptée. **Une seule chose a changé** : un `snapshot` dont la clé commence par
`ai_` **ne se réaffiche jamais** — c'est une piste épinglée avant ce ticket, la
remettre à l'écran remettrait exactement ce que la décision retire. Et une
Marche épinglée ne fabrique pas une quatrième place : elle prend la dernière
des trois.

**5 · Le module verrouillé.** `components/conseils-verrouilles.tsx`, à la place
EXACTE des conseils dans la carte du thème. Deux états, parce que la phrase qui
déverrouille n'est pas la même : poser une première étoile, ou en échanger une
des trois. Il **ne mange pas la veille** — une carte hors priorités peut encore
signaler une campagne neuve, ça ne demande aucun geste, donc le filtre ne la
retire pas.

**6 · « ◇ Trop compliqué » est enfin lu, et à ses DEUX bouts.** Le worker
collecte les `too_hard` et les passe à `_themes_tips(bloques=…)` — l'argument
que le prompt attendait depuis toujours. Et `themes_tips`, **publié depuis des
mois et rendu par aucun composant**, s'affiche enfin :
`components/pour-aller-plus-loin.tsx`. La phrase de `reco-actions.tsx:39` est
vraie des deux côtés. `too_hard` **ne touche jamais le tri** (vérifié) : deux
destinataires séparés, pas deux moteurs.

**7 · Le renvoi sort du rapport.** « Si tu ne fais que trois choses » n'est plus
écrit ni rendu ; `_diversifier`, qui n'avait que cet appelant, meurt avec lui.
Le champ `top_recos` reste **lu** pour retrouver la photo d'un conseil dans un
payload déjà publié.

### Ce que la revue a rattrapé, et qui aurait menti à l'écran

Trois phrases étaient devenues fausses sans qu'une ligne de code les signale :

- **le filet** (`_reco_theme_calme`) dit « aucune de mes règles ne s'est
  déclenchée ici » et « rends son étoile » — sur un thème hors priorités,
  aucune règle n'a tourné et il n'y a pas d'étoile à rendre. Il ne se déclenche
  plus que sous le garde ;
- **la phrase de passage** annonçait « voilà les leviers sur A, B et C » en
  comptant les cartes. Un compte sans priorité n'a que des veilles : elle compte
  maintenant les conseils, et prend une forme sans levier quand il n'y en a pas ;
- **trois textes vus par le client** promettaient encore « des pistes rédigées
  par l'IA » (`setup-wizard.tsx`, `label-manager.tsx`, le message de
  `togglePriorityLabel`). Ce qui se perd au-delà de la 3ᵉ étoile n'est plus une
  piste, c'est **tout** le conseil.

### Ce qui se remonte à David, et ne se décide pas ici

**a · Le ticket [26](26-les-regles-payantes-n-atteignent-pas-le-rapport.md) est
répondu par construction, sans qu'on ait rouvert sa question.** Il demandait
« à qui appartiennent les trois places d'un thème étoilé ? ». Les pistes étant
coupées par la décision de [refonte 11](../../refonte/issues/11-d-ou-viennent-les-conseils.md),
il n'y a plus de porte à arbitrer : les places appartiennent aux règles, pour
tous les thèmes conseillés. **Les quatre règles payantes du ticket 07 sortent
donc dès la première étoile**, ce qui était le fait qu'il relevait. À fermer par
David, pas par une session.

**b · `CONTEXT.md` place le cas « zéro priorité » sur le module À faire**, pas
sur la carte d'un thème. Ce module n'existe pas encore — c'est le ticket
[11](11-module-a-faire-et-date-libre.md). En attendant, la phrase vit dans le
seul endroit où les conseils existent ; l'écart est écrit en tête de
`conseils-verrouilles.tsx`, et 11 doit la déménager.

**c · La notification « tu as encore X recos »** qui remplace le renvoi est le
module de commandes ([refonte 12](../../refonte/issues/12-module-de-commandes.md)),
**hors de cette carte**. Le renvoi est retiré sans que son remplaçant existe :
c'est un manque temporaire, assumé et dit.

**d · `_diversifier` est morte.** Elle garantissait trois clés / trois thèmes /
trois leviers distincts — mais **uniquement dans le renvoi**, jamais sur les
cartes. La variété est maintenant tenue là où elle mord : les deux plafonds de
composition, sur les cinq.

### Vérifications

**83 vérifications neuves** (`.scratch/construction/harnais/08-filtre-dur/`,
26 + 57), plus les **570** des harnais 04 à 07 rejouées sans régression — les
harnais 06 et 07 ont dû être renommés pour suivre les cinq constantes, aucune
valeur changée. `saas/web` : `rm -rf .next tsconfig.tsbuildinfo`, `npx tsc
--noEmit` et `npm run build` verts, **19 routes**. `python3.12 -m py_compile`
sur les deux fichiers Python touchés.

**CE QUI N'A PAS PU ÊTRE VÉRIFIÉ, ET IL FAUT LE LIRE** : `build_payload` prend
un client Supabase vivant — **le filtre dur, le plafond et l'empreinte n'ont
jamais tourné sur un vrai payload.** Aucune base, aucun secret, aucune récolte
n'a été touchée. Ce qui vit à l'intérieur de cette fonction est vérifié sur
l'arbre et sur le texte source : ça prouve qu'un appel est sous un garde, jamais
que le garde est vrai au bon moment. C'est exactement le seam du ticket
[16](16-le-seam-du-payload.md).

**Et ça ne se verra qu'après un « ↻ Recharger mes conseils »** : c'est une
correction du traitement, le payload déjà publié ne bouge pas tout seul.
