# La Marche suivante écrite par Gemini — la moitié IA du plan de thème

Type: task
Status: resolved
Blocked by: 08, 10

## Question

**Né du repli du ticket [06](06-rebrancher-le-plan-de-theme.md)**, qui autorisait
mot pour mot à livrer *« les cinq colonnes et la fin de l'entrée automatique,
**sans** la Marche suivante écrite par Gemini, plutôt que les deux à moitié »*.
06 a livré la partie déterministe, vérifiée ; celle-ci reste à faire.

Tranché par [22](../../refonte/issues/22-rebrancher-le-plan-de-theme.md),
décision 6 — **il n'y a rien à re-décider ici, seulement à bâtir.**

### Ce qu'il faut bâtir

Gemini n'écrit plus de piste libre : il écrit **la Marche SUIVANTE d'une
Stratégie déjà ouverte par une règle**, sous trois barrières dures :

- **il n'ouvre jamais une Stratégie** — seule une règle le fait, en posant une
  Hypothèse (`role="hypothese"`) sur un thème ;
- **il déclare `nature`/`role`/`levier`/`metric` dans les listes fermées**, sous
  peine de rejet de la piste entière — la mécanique existe déjà dans
  `_theme_ai_recos` ;
- **il ne nomme qu'un objet présent dans les `facts` du thème.**

La coupe de [11](../../refonte/issues/11-d-ou-viennent-les-conseils.md) reste
intacte : elle visait l'idée *inventée à partir de chiffres*, pas le savoir-faire
— et elle a explicitement épargné les astuces, qui sont le même bois. Aucune
règle déterministe ne sait que « refaire la page d'arrivée » se descend en appel
à l'action → titre → structure.

### Pourquoi il est bloqué par 08 et 10, et pas seulement rangé après

Deux faits mesurés pendant 06, pas deux préférences :

- **08 coupe les pistes IA libres.** Bâtir la Marche suivante avant que 08 ait
  coupé ferait cohabiter deux façons d'écrire une piste dans la même fonction
  (`_theme_ai_recos`), et la seconde vivrait quelques jours pour rien.
- **Une Stratégie ne peut naître aujourd'hui que sur Instagram.** Après 06, les
  seules règles qui posent une Hypothèse sont `orga_essoufflement` et
  `page_endormie` — les deux seules dont la preuve est « à mesurer », les deux
  organiques. Un compte sans Instagram n'ouvre **aucune** Stratégie, donc Gemini
  n'aurait **aucune** Marche à écrire. Ce sont les règles payantes de 07 et 10
  qui lui donnent de la matière.

### Consigne de repli

Livrer la restriction du prompt et le rejet **sans** toucher à la composition des
cinq : le tri appartient à 08, et deux tickets qui réordonnent la même liste se
marchent dessus.

---

## La réponse

### 1 · Ce qui a été écrit

**Un module neuf, `saas/recos_ia/marche_suivante.py`** — pur et headless, même
patron que `theme_memoire.py` : on lui passe `redige(prompt) -> str|None`,
aucun import de Gemini, donc il tourne hors ligne. Il expose
`objets_nommables`, `build_prompt`, `valider_marche`, `cle_de` (toutes pures)
et le pilote `marche_suivante`.

**Un branchement dans `build_report.py`**, dans la boucle des thèmes, sous
`if _conseille:` — donc jamais hors des thèmes que le client a désignés — et
**avant** le tri par `_importance` et la coupe à trois. La consigne de repli est
tenue : la composition des cinq n'est pas touchée, `composition.py` n'est pas
modifié d'une ligne.

`_theme_ai_recos`, que la question cite comme le lieu de la mécanique, **n'existe
plus** : 08 l'a supprimée. La mécanique de rejet a donc été réécrite, pas
reprise — mais au même endroit logique, et sur les mêmes listes.

### 2 · Les trois barrières, et comment chacune se ferme

**1 · Il n'ouvre jamais une Stratégie — deux verrous indépendants.**
Le branchement n'appelle Gemini que si une ligne `theme_plan` existe sur le
thème **avec une clé de règle** (une clé `ai_` est refusée : c'est une piste
d'avant la coupe de la refonte 11) **et** que le client a confirmé avoir fait la
Marche précédente. Et le module rejette toute piste qui ne déclare pas
`role="generale"` — or `generale` est très exactement ce que la boucle
`ecrire_plan_de_theme` ne ramasse pas (`next(... role == "hypothese")`). Rien
de ce qui sort de Gemini ne peut devenir la Marche courante d'un plan, même par
accident.

C'est le garde-fou de la refonte
[14](../../refonte/issues/14-le-conseil-facile-et-la-degradation.md),
décision 11 — *« la Marche proposée doit être `role: generale`, donc constatable
demain »* — que la décision 6 de 22 n'a pas renversé. **Sans lui, j'aurais
produit une Hypothèse**, et donc une Stratégie ouverte par Gemini : exactement
ce que la barrière interdit.

**2 · Les listes fermées, et le rejet de la piste entière.** `nature`, `role`,
`levier`, `metric` — plus `effort`. Une seule valeur hors liste, ou manquante,
et il ne reste **rien** : jamais une valeur corrigée, jamais une piste
rafistolée. Même mécanique que `_est_conseil` pour les règles. Les listes
arrivent **par paramètre** depuis `build_report.GRAMMAIRE` : les recopier dans
`recos_ia` aurait fait les deux tables qui finissent par ne plus dire la même
chose, ce qui a déjà coûté `PROOF_KPI` (22, décision 5).

**3 · Un objet présent dans les `facts`.** `cible` est obligatoire et doit se
retrouver dans les `nom` que la récolte a réellement rangés sous ce thème. Le
nom rendu est celui de la BASE, pas celui que Gemini a recopié : la cible entre
dans l'empreinte anti-répétition, et deux graphies du même objet y feraient deux
empreintes. Ce qui n'a pas de `nom` — un créneau (un numéro de jour), `arrivee`,
`regies` — n'est pas nommable : ce ne sont pas des objets qu'on ouvre pour les
corriger.

### 3 · Quatre décisions prises en construisant, toutes traçables

- **`effort` est une cinquième colonne déclarée**, alors que le ticket n'en
  nommait que quatre. Ce n'est pas une extension de périmètre : la décision 1
  de 22 écrit que le plafond des gestes lourds « ne servira que lorsque les
  Marches de Gemini ajouteront des `créer`/`corriger` [à 1 h] ». Sans effort
  déclaré, une Marche retombe sur le défaut « 30 min » d'`_attach_effort` et ce
  plafond ne peut **par construction** jamais la voir — la phrase serait fausse.
- **La clé porte l'ÉTAPE, pas la Stratégie** (`marche_<slug du titre>`).
  L'empreinte est (clé, cible) : une clé constante aurait bloqué « change le
  titre » après « change l'appel à l'action », les deux visant la même page.
  L'échelle se serait arrêtée à sa première marche.
- **La confiance est posée en dur (`creuser`), jamais déclarée par Gemini.**
  Une IA qui note sa propre fiabilité fabrique la seule chose dont le lecteur
  se sert pour la croire. `solide` est réservé à ce qu'une règle a mesuré ;
  `piste` dirait qu'on n'en sait rien, alors qu'on sait que le client a fait la
  Marche précédente — c'est un clic en base.
- **`repere` n'est pas un champ que Gemini peut remplir.** C'est la pastille
  « 💡 vise X », donc un seuil chiffré — exactement ce que `CLAUDE.md` §7
  interdit à ce module. Il n'est pas filtré après coup : il n'a pas de place.

### 4 · Deux défauts trouvés par ma propre relecture, pas par les tests

Les deux étaient écrits, compilaient, et passaient les tests que j'avais déjà.

- **Une Note cochée faisait avancer une Stratégie.** `suivi_actions` ramène des
  Notes depuis le ticket [12](12-le-carnet-et-la-mort-de-preuve.md), et la
  boucle de verdict les filtre déjà explicitement pour cette raison. Une Note
  n'a ni indicateur, ni baseline, ni Stratégie derrière elle : cocher un texte
  libre descendait une échelle que ce texte n'avait jamais ouverte.
- **Un seul vieux clic faisait écrire une étape neuve CHAQUE semaine.** Et comme
  chaque étape porte sa propre clé, l'empreinte anti-répétition ne les voyait
  jamais passer : on descendait une échelle que plus personne ne montait. La
  borne posée est le `week_start` du **dernier rapport publié** — « depuis la
  dernière fois qu'on t'a parlé », la seule fenêtre que ce produit sache définir
  sans inventer un seuil en jours. Aucun rapport publié = premier rapport du
  compte, et alors tout clic est nouveau. C'est la lecture littérale de la
  décision 9 de 14 : *« la Marche suivante arrive au « fait » »* — un clic, une
  Marche.

### 5 · Ce qui a été mesuré

**171 vérifications, toutes vertes**, dans
[`.scratch/construction/harnais/24-marche-suivante/`](../harnais/24-marche-suivante/LISEZMOI.md).

| Fichier | Ce qu'il prouve |
|---|---|
| **111** · `test_les_trois_barrieres.py` | Le module seul. Chaque barrière, **et son contraire** : la piste conforme passe entière. Pas de Marche faite → **aucun appel IA payé**. `role="hypothese"` rejeté *alors qu'il est dans la liste fermée*. Le prompt **ne contient aucun chiffre du compte** — vérifié valeur par valeur contre les `facts` d'entrée. |
| **60** · `test_branchement_de_la_marche.py` | `build_payload` **exécutée** via le seam du ticket [16](16-le-seam-du-payload.md), pas lue sur le texte. Les cinq cas où Gemini n'est pas appelé du tout ; le cas qui passe de bout en bout (grammaire intacte, canal hérité de la Stratégie, baseline mesurée par `_attach_metric`) ; et la vérification qui compte le plus — **rien n'entre dans `theme_plan`**, lu sur les écritures réellement tentées par la construction, pas supposé. |

**Les 48 autres fichiers de harnais du dépôt ont été rejoués : aucune
régression** (`python3.12 .scratch/construction/harnais/jouer_tout.py`, ajouté
par ce ticket — il les enchaîne au lieu de les lancer un par un).

`python3.12 -m py_compile` vert sur les deux fichiers Python touchés.
**`saas/web` n'est pas touché** — aucun fichier : rien à dire de `tsc`, de
`npm run build` ni des 19 routes.

### 6 · Ce qui reste, et qui ne pouvait pas être fait ici

- [ ] **Ça ne se verra qu'après un passage du worker** — le cron du Jour de
      travail (07:00 UTC) ou un lancement à la main depuis **GitHub Actions**
      (`weekly-fetch.yml`, `report_only`). Le client ne déclenche rien : aucun
      clic dans l'app ne fait apparaître une Marche.
- [ ] **Et il faut que le cas se produise.** Il faut une règle qui pose une
      Hypothèse (`orga_essoufflement`, `page_endormie`, `adset_inegal`,
      `theme_deux_regies`) **et** un clic « ✓ Je l'ai fait » dessus depuis le
      dernier rapport. Tant que ces deux-là ne se rencontrent pas, ce code ne
      tourne jamais — c'est la barrière 1, pas un défaut.
- [ ] **La qualité de ce que Gemini écrit n'est pas prouvée.** Le harnais prouve
      ce qui est accepté et ce qui est rejeté ; il fait dire au faux `redige`
      ce qu'on veut. Qu'un vrai modèle produise une étape pertinente ne se
      verra qu'au premier passage réel.
