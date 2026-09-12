# Le seam du payload : rendre le rapport appelable hors ligne

Type: task
Status: open
Blocked by: 01

## Question

**C'est le seul ticket de cette carte qu'aucun ticket de la refonte n'a
tranché** — l'exception à la règle de fond de [`map.md`](../map.md). Il naît de
la session `/to-spec` du 2026-09-11, où David a choisi le seam de test de la v1
parmi quatre options : **le payload du rapport, seam unique, au point le plus
haut.** La décision et ses raisons vivent au §« Testing Decisions » de
[`spec.md`](../spec.md).

Il est ouvert ici plutôt que glissé dans un autre ticket parce que `CLAUDE.md`
§4 le demande : *ce qui n'était pas demandé et que je découvre devient un ticket,
pas un détour silencieux.*

### L'état réel, à ne pas maquiller

**Aucune suite de tests n'existe dans ce dépôt** — aucun fichier de test hors
`.venv/`, aucun runner dans `saas/web`. `pytest` est dans l'environnement virtuel
et n'a jamais servi. Ce ticket ne prétend pas créer une culture de test : il rend
**un** seam atteignable, celui que David a choisi.

### Ce qu'il faut faire

- **Injecter le lecteur.** `build_payload(sb, user_id)` prend un client Supabase
  vivant et va chercher ses données elle-même. Faire entrer par paramètre ce
  qu'elle importe aujourd'hui, pour qu'un faux lecteur gréé sur des lignes fixes
  la fasse tourner hors ligne.
- **Ne pas découper les 3 060 lignes.** On rend la fonction appelable, on ne la
  réécrit pas. Son propre docstring dit *« pas de découpage sûr sans tests de
  non-régression »* — ce ticket lève l'interdiction, il ne l'enjambe pas.
- **Écrire les premiers tests sur les propriétés du §Testing de la spec**, en
  commençant par celle qui porte la phrase du produit : *aucun conseil ne porte
  un thème non étoilé*. Du comportement externe — ce que le payload contient —,
  jamais un nom de fonction interne ni un ordre de section.
- **La couche de règles est déjà pure** (elle prend des DataFrames, zéro I/O) :
  elle se teste sans rien construire. C'est là que les dix règles neuves des
  tickets **07** et **10** se vérifient une par une.

### Ce qui n'est PAS dans ce ticket

- **Aucun runner de test dans `saas/web`** — arbitré par David dans la même
  session. Le web reste vérifié par `tsc`, `npm run build`, les **19 routes**, et
  le fil parcouru à la main. **Conséquence assumée** : la garde de collision
  (ticket **02**) et la date libre (ticket **11**) ne seront couvertes par aucun
  test automatisé, et leur rapport de vérification doit le dire.
- **Aucune correction de comportement.** Si l'injection du lecteur fait apparaître
  un défaut, c'est un ticket, pas une retouche en passant.

### Sa place dans la carte, et pourquoi elle est discutable

Il est posé après **01** parce que 01 *« passe avant tout le reste »* (un chiffre
faux est à l'écran) et qu'il touche le même fichier. Le mettre plus tard ferait
arriver les tests après le code qu'ils protègent ; le mettre plus tôt retarderait
une réparation qui ment. **C'est un arbitrage, pas une mesure** — David peut le
déplacer.

Attention au goulot : ce ticket touche `build_report.py`, comme **01**, **06**,
**08**, **13**. `CLAUDE.md` §5 — jamais deux agents sur les mêmes fichiers.

### Consigne de repli

Livrer **l'injection du lecteur seule, vérifiée par `py_compile` et par un
rapport généré à l'identique avant/après**, sans un seul test, plutôt que
l'injection et une poignée de tests à moitié. Un seam atteignable sans test est
utile ; un test sur un seam qui a changé le comportement du rapport est un
piège.
