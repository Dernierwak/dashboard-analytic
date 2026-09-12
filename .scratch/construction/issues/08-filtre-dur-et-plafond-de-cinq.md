# Le filtre dur sur les thèmes prioritaires, et le plafond de cinq

Type: task
Status: open
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
