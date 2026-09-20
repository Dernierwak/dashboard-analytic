# Rebrancher le plan de thème : la séquence sans l'IA qui l'alimentait

Type: grilling
Status: resolved
Blocked by: 14

## Question

Gradué par [14](14-le-conseil-facile-et-la-degradation.md), qui a découvert que
la machinerie de séquence existe **en entier** et n'a plus de fournisseur.

Ce qui est écrit, testé, et aujourd'hui orphelin :

- **`theme_plan`** — une ligne par thème (`reco_key`, `levier`, `decided_at`,
  `snapshot`, `resume`), l'état courant, jamais un historique.
- **`FENETRE_LEVIER`** — 7 j pour `contenu`/`tempo`, 14 j pour `argent`/`audience`
  (quand le verdict tombe).
- **`ATTENTE_MIN_NOUVELLE_HYPOTHESE`** — 14 à 21 j (quand on a le droit de
  changer de théorie). Plafond de secours, pas plancher, depuis
  `.scratch/recos-labels/issues/06-fenetre-verdict.md`.
- **`NATURES_IA`** — couper / augmenter / tester / créer / corriger, déjà exigées
  distinctes entre les trois idées d'un thème.
- **`ROLES_IA`** — `generale` (constatable demain à l'œil) / `hypothese` (entre
  dans `suivi_actions`, reçoit un verdict).
- **Le décompte 2 « générale » + 1 « hypothèse »**, forcé par le code, jamais
  laissé au texte libre de Gemini.

`upsert_theme_plan` n'est appelé que pour l'hypothèse IA (`build_report.py`
l. 3691), et [11](11-d-ou-viennent-les-conseils.md) coupe les pistes IA
(l. 1470). **La séquence survit à sa source.**

### Ce qu'il faut trancher

- **Comment une règle déterministe déclare `nature`, `role`, `metric` et
  `levier`.** Table par clé comme `EFFORT_BY_KEY`, ou champ dans `_reco()` ?
  Le second oblige à toucher les douze règles, le premier garde les
  déclarations au même endroit que `EFFORT_BY_KEY` et `LEVIER_BY_KEY`.
- **Ce que `theme_plan` porte maintenant** : la Marche courante d'une Stratégie.
  Une Stratégie a-t-elle une identité propre en base, ou n'existe-t-elle que
  comme la suite des Marches déjà servies sur un thème ?
- **Le décompte 2+1 par thème contre le plafond de 14** (jamais plus de deux
  `créer`/`corriger` à `effort ≥ 1 h`) et contre le plafond de 11 (cinq conseils
  par semaine sur tout le compte, tous thèmes confondus). Trois plafonds écrits
  à trois moments : lequel gouverne ?
- **Le point souple hérité de 14** : l'échelle des Marches est-elle écrite par
  Gemini (recommandation non contestée) ou en dur par nous ? 14 signale que
  David a recadré le périmètre sans trancher l'auteur.

### Consigne de conduite

Ticket **HITL**. Lire d'abord la résolution de 14, puis `build_report.py`
l. 114-220 (les listes fermées et les fenêtres) et l. 3600-3700 (l'écriture du
plan). Skills : `recos`, puis `grilling` + `domain-modeling`.

### Consigne de repli

Trancher d'abord qui gouverne entre les trois plafonds : sans ça, le reste
produit une composition indéfinie.

## Answer

### Deux prémisses du ticket étaient fausses, et les deux allègent le travail

**`LEVIER_BY_KEY` n'existe pas — mais la table, si.** Elle s'appelle
**`_LEVIER_REGLE`** (`build_report.py` l. 290), elle couvre les seize clés, et
elle porte un **cinquième levier que `LEVIERS_IA` n'a pas** : `socle`, pour les
prérequis (GA4, funnel, événement muet), *« qui ne se concurrencent pas entre
eux »*. Le patron « déclarer par clé, poser après coup » est donc déjà installé
**trois fois** : `EFFORT_BY_KEY` (l. 85) posé par `_attach_effort` (l. 3506),
`_LEVIER_REGLE` (l. 290), et `PROOF_KPI` (l. 3294) posé par `_attach_metric`
(l. 3474). Sur les cinq colonnes qu'il fallait donner à une règle
— durée · levier · indicateur · geste · preuve — **trois sont déjà écrites.**

**`_reco()` ne déclare rien de cette grammaire** (`reco_engine.py` l. 74 :
`key, platform, title, observation, pourquoi, verifier, repere, angle_mort,
confidence, priority`) — c'est bien la question du ticket, mais elle se règle
sans toucher aux douze règles.

### Le stock réel : sept conseils, dont six sur Instagram

14 comptait « douze règles survivantes ». En les lisant une par une, **quatre
sont des réparations de la mesure** (`connecter_ga4`, `ga4_muet`, `funnel`,
`theme_event_muet` — toutes déjà `socle` dans `_LEVIER_REGLE`, trois déjà dans
`SETUP_KEYS`), et **une cinquième n'est pas un conseil** : `theme_event_cout`
(l. 1278) ne demande aucun geste, il demande au client de **comparer un coût à
sa marge**. C'est un constat, et 11 a désigné `insights.py` comme la source
unique des constats.

**Reste sept clés qui concourent pour les cinq places** — et **six d'entre elles
ne parlent qu'à Instagram** :

| clé | geste | preuve | levier | indicateur | durée |
|---|---|---|---|---|---|
| `roas` ≥ 3 | **augmenter** | constatable | argent | roas | 30 min |
| `roas` 1–2 | **couper** | constatable | argent | roas | 30 min |
| `roas` < 1 | **couper** | constatable | argent | roas | 30 min |
| `silence` | **créer** | constatable | tempo | posts | 1 h |
| `orga_rythme` | **créer** | constatable | tempo | posts | 30 min |
| `orga_format` | **tester** | constatable | contenu | reach | 1 h |
| `orga_reaction` | **tester** | constatable | audience | reach | 1 h |
| `orga_essoufflement` | **couper** | à mesurer | contenu | reach | 1 h |
| `page_endormie` | **tester** | à mesurer | contenu | reach | 1 h |

Les trois dernières colonnes sont recopiées du code, pas inventées. Les deux
premières sont à écrire ; elles ne sortent pas d'une intuition mais du champ
`verifier` de chaque règle — `orga_essoufflement` dit *« reviens à ta cadence
d'avant pendant 4 semaines »* (donc **couper**, et rien à constater demain),
`page_endormie` dit *« teste les Reels sur 2 semaines »* (donc **tester**, et
rien à constater demain non plus).

**La conséquence est le fait le plus lourd de ce ticket : un compte sans
Instagram reçoit UN conseil par semaine — `roas`, et lui seul.** Le plafond de
cinq ne sera jamais approché par un client qui ne fait que de la pub. Et comme
les deux seules clés « à mesurer » sont organiques, **une Stratégie ne peut
aujourd'hui naître que sur Instagram.** → ticket [24](24-conseils-payants-manquants.md).

### Les décisions

**1 · Les cinq gouvernent ; les deux autres plafonds descendent d'un cran.**
Trois thèmes prioritaires × trois conseils = jusqu'à neuf candidats pour cinq
places : le « 2 générale + 1 hypothèse » ne peut donc plus être une garantie.
Il redevient la **forme de la fabrication par thème** — dont ne survit que
« **au plus une Hypothèse par thème** », ce que `theme_plan` garantit déjà par
sa contrainte `UNIQUE (user_id, theme)`. Le plafond de 14 (jamais plus de deux
`créer`/`corriger` à `effort ≥ 1 h`) n'est pas un troisième plafond mais un
**filtre appliqué à l'intérieur des cinq**. Séquence : fabriquer par thème →
trier par `_importance` → servir cinq en refusant le troisième gros chantier.
Mesuré sur le tableau ci-dessus, ce filtre ne mord aujourd'hui **jamais**
(un seul `créer` à 1 h) : il ne servira que lorsque les Marches de Gemini
ajouteront des `créer`/`corriger`.

**2 · Cinq est un plafond, jamais un quota — une semaine à deux conseils est une
semaine honnête.** David : *« oui »*. Remplir en descendant dans le fond du
panier, c'est du décor, et c'est exactement la mécanique qui avait fait calculer
trois fois « qu'est-ce qui marche chez toi » (11). Le point de vue de la semaine,
lui, est toujours là.

**3 · Une table par clé pour le geste et la preuve — mais c'est la règle qui
déclare, la table n'est qu'un défaut.** `roas` écrit **quatre textes selon le
chiffre du jour** : au-dessus de 3 *« monte SON budget de +20 % »*, entre 1 et 2
*« coupe la campagne au CPC le plus cher »*, sous 1 *« coupe ou réduis »*, et
sans revenu suivi *« configure la valeur dans GA4 »*. **Le geste est une
propriété de la branche, pas de la clé.** Découper `roas` en trois clés était
l'autre option : elle est refusée, parce que la clé est ce qui porte l'historique
des retours du client (`reco_feedback`, *« un constat rejeté reste écarté »*) —
la découper efface cet historique. `roas` est la seule règle concernée.
Le principe est déjà écrit dans `CONTEXT.md` pour le Levier : *« jamais deviné
après coup : il est déclaré, conseil par conseil, par ce qui l'écrit »*.

**4 · Pas de sixième geste « vérifier », et un critère d'entrée qui en découle :
un conseil sans geste n'est pas un conseil, c'est un constat.** Les cinq gestes
(`couper`, `augmenter`, `tester`, `créer`, `corriger`) existent pour une seule
raison, écrite au-dessus de `_LEVIER_REGLE` : empêcher que les conseils de la
semaine se ressemblent. Ajouter « vérifier » brouillerait exactement ça. Les
quatre réparations de la mesure restent dans leur circuit à part (`socle`,
`SETUP_KEYS`), hors des cinq places ; `theme_event_cout` rejoint les constats
d'`insights.py`. **Une règle qui ne sait pas déclarer son geste n'est jamais
servie** — même mécanique de rejet que `LEVIERS_IA`/`METRICS_IA`, jamais un
geste deviné.

**5 · `PROOF_KPI` disparaît.** La colonne « indicateur » suffit : libellé, unité,
direction et format se retrouvent tous dans **`METRIC_INFO_IA`** (l. 176), que
`PROOF_KPI` duplique déjà valeur pour valeur. Ce ticket **retire** dix-sept
lignes au lieu d'en ajouter.

**6 · Gemini écrit l'échelle des Marches — c'est le point que 14 laissait
ouvert, et il est tranché — sous trois barrières dures.** Il ne propose **que
la Marche suivante d'une Stratégie déjà ouverte par une règle** (il n'en ouvre
jamais une) · il déclare `nature`/`role`/`levier`/`metric` **dans les listes
fermées**, sous peine de rejet de la piste entière · il ne peut **nommer qu'un
objet présent dans les `facts` du thème**. La coupe de 11 reste intacte : elle
visait l'idée *inventée à partir de chiffres*, pas le savoir-faire — et elle a
explicitement épargné les astuces (l. 1612), qui sont le même bois. Aucune règle
déterministe ne sait que « refaire la page d'arrivée » se descend en appel à
l'action → titre → structure.

**7 · Plus rien n'entre au carnet sans un clic — l'entrée automatique meurt.**
Aujourd'hui (l. 3634-3684) l'Hypothèse d'un thème s'écrit dans `suivi_actions`
**à la publication**, `status: "auto"`, et reçoit un verdict à quatorze jours
**que le client l'ait faite ou non**. Un verdict rendu sur un geste que personne
n'a confirmé **attribue un mouvement de chiffres à une action qui n'a peut-être
jamais eu lieu** : c'est `CLAUDE.md` §7, et c'est le renversement de David en
[04](04-ce-qui-doit-etre-valide-en-premier.md) (*juger une note obligerait Pulse
à choisir le chiffre à sa place*). C'est aussi ce que 20 vient de trancher : le
module liste **ce qui attend une décision de TOI**.

**La séparation qui rend ça possible existe déjà : `theme_plan` n'est pas le
carnet.** `theme_plan` est la mémoire de Pulse (quelle Hypothèse tourne sur ce
thème, depuis quand) et continue de s'écrire **à la publication** — sinon un
thème changerait de théorie chaque semaine, ce que la fenêtre d'attente existe
précisément pour empêcher. `suivi_actions` est le carnet du client, et il ne
reçoit **qu'au clic « ✓ Je l'ai fait »**. Conséquence directe : l'échéance du
Verdict (`check_at`, `FENETRE_LEVIER`) se calcule **depuis la date du clic**, pas
depuis la publication. Le cas « jamais cliqué » a déjà sa sortie, écrite par 14 :
la **Mise en veille** à deux semaines de silence.

**8 · Une Stratégie n'est pas un objet en base — aucune table nouvelle, aucune
migration.** Une Stratégie, c'est la **suite des Marches déjà servies sur un
thème**. `theme_plan` garde la Marche courante (une ligne par thème, qui se
remplace) et sa mémoire narrative (`resume`, réécrite à la chute d'un Verdict et
qui **survit au remplacement** — c'est toute sa raison d'être). L'anti-répétition
se vérifie là où 14 l'a déjà placée : sur les rapports publiés
(`weekly_reports`), avec l'empreinte **clé + cible**. Lui donner une identité
propre en base coûterait une table, un historique à écrire et un à lire, pour
répondre à une question à laquelle deux sources répondent déjà.

### Ce qui sort en ticket

[24](24-conseils-payants-manquants.md) — **écrire les conseils payants qui
manquent**, à traiter avant qu'un client sans Instagram voie la v1. Ce n'est pas
un dommage collatéral de ce ticket : 14 l'avait annoncé mot pour mot (*« le
plancher devient un ticket d'écriture de règles, il ne se décrète pas »*), ce
ticket-ci ne fait que **mesurer combien il manque** — six conseils sur sept.

### Vocabulaire

`CONTEXT.md` gagne **Geste**. Trois entrées sont corrigées par la décision 7 :
**Action suivie** ne naît plus « de l'Hypothèse d'un thème » mais d'un clic ;
**Hypothèse** ne reçoit un Verdict que si le client la prend, sinon elle part en
Mise en veille ; **Verdict** compte son échéance depuis le « fait », pas depuis
la publication.
