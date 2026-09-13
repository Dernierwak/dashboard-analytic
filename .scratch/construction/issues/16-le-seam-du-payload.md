# Le seam du payload : rendre le rapport appelable hors ligne

Type: task
Status: resolved
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

---

## Réponse — 2026-09-13

**`build_payload` tourne hors ligne.** Pour la première fois du dépôt : elle
prend un `Lecteur` (`saas/traitement/lecteur.py`) au lieu d'un client Supabase,
et un faux lecteur gréé sur des lignes fixes la fait construire un payload
entier sans base, sans secret, sans réseau.

### Ce qui a été fait

**Un seul objet, `Lecteur`** — trente méthodes, une par source, aucune ne prend
`sb` ni `user_id`. Il porte les lectures, les quatre fenêtres GA4, les six
requêtes qui passaient par `sb.table(...)` en clair, les trois appels à Gemini,
**les deux écritures** (le plan de thème, le verdict persisté) et **l'horloge**.
Les deux dernières familles ne sont pas dans le mot « lecteur » et c'est écrit
dans l'en-tête du module : sans elles, un test hors ligne écrirait en base et
lirait la vraie date — la propriété « rejouer un autre jour ne change pas la
semaine déclarée » ne se vérifierait pas.

**Trente-six points d'appel réécrits, tous mécaniques**, plus
`_labels_prioritaires(lecteur, ins_fb)`. `publish_weekly_report` ne change pas de
signature et grée le lecteur ; `fetch_all.py` n'a pas été touché. **Les
`try/except` sont restés chez l'appelant, délibérément** : chacun porte un
commentaire qui dit quoi faire du vide, et `themes_regroupes()` laisse toujours
remonter `VueRegroupementAbsente`.

**Les sept `from saas.collecte…` cachés au milieu de la fonction ont disparu** —
chacun était un point de sortie qu'aucune signature n'annonçait.

**Le seam est prouvé fermé**, pas raconté : dans `build_payload` et
`_labels_prioritaires`, l'arbre ne porte plus aucune référence à `sb`,
`user_id`, un `fetch_*`, `_call_gemini`, `upsert_theme_plan` ou `date.today`.

### Le « rapport identique avant/après » n'existe pas, et voici ce qui le remplace

Le repli demandait « un rapport généré à l'identique avant/après ». **C'est
impossible, et pour une raison qui n'est pas l'absence de base** : avant
l'injection, la fonction ne pouvait pas tourner hors ligne du tout — il n'y a
pas de « avant » à comparer. Ce qui est vérifié à la place est une **équivalence
de routage** : chaque méthode du lecteur est jouée contre un espion et doit
atteindre la même fonction, la même table, la même chaîne PostgREST et les mêmes
arguments qu'au dernier commit, lu par `git show HEAD:…` — pas une liste écrite
de mémoire. Les deux écritures comprises.

### Ce que la fonction a dit une fois qu'elle a parlé

**298 vérifications neuves** (`.scratch/construction/harnais/16-le-seam-du-payload/`),
et la première est celle qui porte la phrase du produit :

- **aucun conseil ne porte un thème non étoilé** — deux portes, et il fallait les
  deux : un thème classé sans étoile n'a même pas de carte (`theme_list` vaut
  `priority_labels`), et au-delà de la troisième étoile la carte existe avec
  `conseille: false` et pas un conseil ;
- le **plafond de cinq** tient, une semaine calme rend **moins** de cinq et
  **rien ne vient compléter** ;
- **zéro étoile** rend zéro conseil, avec les cartes et le point de vue de la
  semaine quand même ;
- le **ROAS d'un thème bi-régie** porte les deux régies des deux côtés, un thème
  **sans revenu confirmé** ne porte ni zéro ni estimation sur sa carte, **deux
  Annonces homonymes restent deux** ;
- la **publication est idempotente** — la même construction rejouée le jour même,
  trois jours après et trois semaines après retombe sur la même ligne
  d'écriture. Le ticket 13 l'avait démontré sur un calcul recopié ; c'est
  maintenant mesuré.

**1 326 vérifications rejouées** (harnais 06 à 13), et **seize assertions ont dû
être réécrites** dans six fichiers : elles cherchaient dans le texte de
`build_report.py` des appels qui ont changé de point d'entrée, pas de
destination. Elles lisent maintenant la demande dans le worker **et** l'appel
dans le lecteur. C'étaient exactement les substituts de texte que ce seam
remplace par une exécution.

### La revue de code a trouvé un trou dans le seam, et il était réel

`_themes_tips` — une fonction du module, appelée **depuis** `build_payload` —
appelait `_call_gemini` **directement**. La construction partait donc sur le
réseau dès qu'une clé Gemini existait dans l'environnement, et un test « hors
ligne » devenait dépendant de la machine qui le joue. Elle prend maintenant
`redige` par paramètre, comme tout le reste.

**Le plus instructif n'est pas le trou, c'est pourquoi il est passé** : la
vérification ne regardait que le corps de `build_payload`, pas les fonctions
qu'il appelle. Le détecteur est donc devenu **transitif** — il suit les appels
vers les fonctions du module —, et cette version-là retrouve bien le défaut
quand on le remet en place. Un seam se vérifie sur ce que la fonction atteint,
pas sur ce qu'elle écrit.

### Deux prémisses du ticket étaient fausses

1. **« Aucune suite de tests n'existe dans ce dépôt »** — périmé. Neuf harnais
   vivaient déjà sous `.scratch/construction/harnais/`, ~1 300 vérifications,
   `python3.12 test_x.py`, rien à installer. Le harnais 16 suit la même
   convention (décidé avec David en ouvrant le ticket).
2. **« Les dix règles neuves des tickets 07 et 10 se vérifient une par une »** —
   déjà fait. C'est exactement ce que font `harnais/07-quatre-regles` (189) et
   `harnais/10-six-regles` (347). Rien n'a été refait ; ils ont été rejoués.

### Deux défauts trouvés en faisant tourner la fonction, aucun corrigé

Le ticket s'interdit toute correction de comportement, et `CLAUDE.md` §4 en fait
des tickets :

- **[40](40-un-theme-sans-revenu-confirme-est-publie-a-zero.md)** —
  `themes.rows[].rev` écrit `0.0` là où la carte et la matrice écrivent `null` :
  une absence de donnée publiée comme un zéro (§7). Vérifié côté web : **aucun
  écran ne le montre aujourd'hui**, et le ticket le dit plutôt que de gonfler.
- **[41](41-la-fenetre-ne-s-ancre-pas-sur-google.md)** — l'ancre de la fenêtre
  ne lit que Meta, Instagram et les abonnés. Un compte **Google seul** retombe
  sur « hier » et mesure des jours vides : mêmes lignes, même dépense,
  **210 CHF en Meta contre 90 CHF en Google**. C'est le plus lourd des deux, et
  il touche exactement le compte que la v1 promet de servir — celui qui n'a pas
  Instagram.

### Ce qui n'est pas vérifié, et qui se dit

- **Rien n'est joué en base** : aucun `upsert`, aucun décompte de lignes. Le
  faux lecteur **enregistre** les écritures au lieu de les jouer.
- **Aucun découpage** des 3 775 lignes, et le docstring garde son interdiction
  jusqu'à ce qu'un autre ticket s'en serve — ce ticket la lève, il ne l'utilise
  pas.
- **La moitié de la propriété d'empreinte** (« avec un chiffre différent, il
  réapparaît ») n'est pas vérifiable : aucune règle servie ne pose de `cible`,
  c'est le ticket [31](31-un-conseil-sans-cible-ne-sort-qu-une-fois.md).
- **Trois jeux de lignes ne sont pas encore gréés** par le faux lecteur — les
  publications Instagram, la portée quotidienne Meta, les événements GA4 par
  thème — donc les règles organiques, `annonce_usee` et `theme_event_cout` ne
  tournent pas ici. Ce n'est plus une limite de structure, c'est du gréement.
- **Aucun runner dans `saas/web`**, décision de David prise avec le seam.
  Conséquence assumée : **la garde de collision (02) et la date libre (11) ne
  sont couvertes par aucun test automatisé.**
- **Rien ne se voit à l'écran.** Ce ticket ne change aucun rendu et ne demande
  **aucun** passage du worker pour être constaté. Les corrections des tickets
  précédents, elles, attendent toujours le cron du Jour de travail (07:00 UTC)
  ou un lancement à la main depuis l'onglet **GitHub Actions**
  (`weekly-fetch.yml`, `report_only`).
