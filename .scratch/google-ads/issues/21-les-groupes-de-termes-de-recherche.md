# 21: Les groupes de termes de recherche

Type: prototype
Status: claimed
Blocked by: —
Assignee: Claude (session 2026-11-11)

## Question

**Les groupes de termes que Google fait déjà (les catégories de termes)
donnent-ils une lecture utile d'une campagne Search, vus comme des grappes
reliées ?** David, 2026-11-11 : « on retrouve des clusters de termes de
recherche […] on pourrait partir avec ça dans les search et on essaye avec
ça » — un graphe « comme un Obsidian » : chaque catégorie avec ses termes
reliés autour, une couleur par catégorie, et l'on voit quelle catégorie pèse le
plus ; filtrable par campagne. « Juste des couleurs », joli à lire.

C'est le premier morceau de l'Analyse Search ; le reste (nuage des mots-clés,
listes de termes, éléments) attend ce verdict
([L'Analyse Search en maquette](20-l-analyse-search-en-maquette.md)).

Ce que les essais réels ont établi
([L'essai réel de l'Analyse Search](19-l-essai-reel-de-l-analyse-search.md),
dont le complément) :
- une catégorie est un sujet et une langue, nommée par son terme principal ;
  `id` stables sur 90 jours glissants ; une catégorie fourre-tout (≈ 16 à
  32 % des clics) sans terme listé ;
- **le lien terme → catégorie** : Google donne la liste des termes de chaque
  catégorie (une requête par catégorie), pas la catégorie d'un terme ; en
  croisant les textes, **83 % des clics du rapport des termes** retrouvent leur
  catégorie chez B (toutes catégories lues), un terme sur 166 tombe dans deux ;
- **par campagne : oui** (les termes d'une catégorie se lisent dans une
  campagne) ; **par groupe d'annonces : non** (refusé par l'API) ;
- clics, impressions, conversions ; **pas de coût** ; une catégorie liste
  une partie de ses termes seulement (le reste est masqué).

À éprouver avec David, sur une maquette dans la page Google (chiffres fictifs,
jamais ceux du client — le dépôt est public) :
- la forme : graphe de grappes reliées, ou une forme plus simple qui dit la
  même chose (catégories en blocs proportionnels, termes dedans) ;
- la taille d'un nœud (clics ? impressions ?), la couleur (une par catégorie,
  au-delà de combien ?), la place de la fourre-tout et des termes masqués,
  dits sans être inventés ;
- où il vit : en bas de la page, après le choix d'une campagne.

## Comments

- 2026-11-11 — **Maquette, premier tour.** Branche jetable
  `prototype/groupes-de-termes` (`3e8264c`), partie du deuxième tour validé de
  la page (`b19d03f`, via `5e2def8`) : le module « Ce que les gens ont
  cherché » remplace l'Analyse en bas de page. Fichiers
  `saas/web/app/google/_prototype-page/groupes-*.ts(x)`. Ouverte en dev par
  `/google?maquette=page&gv=A#groupes` (`gv=A|B|C`, ou flèches ← →) ;
  chiffres fictifs (même location de vélos, 6 campagnes Search).

  **Commun aux trois** : filtre par campagne au-dessus (« Toutes les
  campagnes Search » = les catégories du compte, où Google fusionne un même
  sujet venu de plusieurs campagnes) ; taille Clics / Impressions /
  Conversions, **par défaut celle de la vue** du Sélecteur ; une phrase de
  tête — « X pèse N % des clics » ; dessous, la part listée, celle masquée, les
  termes rangés dans deux catégories, et « pas de coût » ; **8 couleurs aux
  plus grosses catégories, le reste gris** ; « Sans catégorie » (la
  fourre-tout) et « N petites catégories » (≤ 5 clics, regroupées) hachurées
  et toujours en dernier, avec leur raison.

  | | A · Constellation | B · Blocs | C · Barres |
  |---|---|---|---|
  | Forme | le graphe « comme Obsidian » : un rond par catégorie, ses termes reliés autour ; un terme rangé dans deux catégories relie les deux grappes | un bloc proportionnel par catégorie (treemap), ses termes en pastilles dedans | une ligne par catégorie, la barre découpée en ses termes |
  | Taille | aire du rond | aire du bloc | longueur de la barre |
  | Termes masqués | ligne « Termes masqués par Google » dans la fiche de la grappe | bande hachurée au pied du bloc, à sa proportion exacte | segment hachuré au bout de la barre |
  | Lire une catégorie | survol ou clic → fiche à droite (total, part, termes, masqué) ; légende classée dessous | tout est écrit dans le bloc | survol d'un segment ; nom du terme écrit s'il a la place |

  Questions pour David : laquelle des trois (ou quel mélange) ; la taille
  suit-elle la vue, ou toujours les clics ; « Toutes les campagnes » a-t-il
  un sens, ou n'ouvre-t-on qu'après le choix d'une campagne ; faut-il montrer
  les termes des catégories grises, ou seulement ceux des 8 colorées.
- 2026-11-11 — **Deuxième tour.** David sur le premier : « fais-moi un truc
  simple, je sais pas ce que tu essayes de me dire ». Les trois formes sont
  remplacées par **une seule liste** (`4d395ba`, `groupes-simple.tsx`) : les
  8 plus gros groupes de Google en clics, une barre colorée, le nombre de clics
  et la part, leurs principaux termes en gris dessous, puis une ligne « + N
  clics dans des groupes plus petits, ou sur des recherches que Google n'a pas
  regroupées » (le total retombe juste). Seul réglage : la campagne. Plus de
  taille au choix, de hachures ni de graphe. A, B et C restent sur la branche,
  sans être affichées. En attente du verdict de David.
- 2026-11-11 — **Troisième tour.** David sur la liste : « complètement
  nul », un bar plot sans vision ; **une seule métrique alors que deux, trois
  comptent** ; il faut **le cluster**, et pouvoir **choisir entre mots-clés et
  cluster pour voir les termes de recherche** ; il redemande si l'API donne
  ces clusters. Réponse rappelée : oui, `campaign_search_term_insight` /
  `customer_search_term_insight`, vérifié au 19 — libellé, termes, clics,
  impressions, conversions, **pas de coût**, une campagne par requête, pas par
  groupe d'annonces.

  Maquette `87a4b5c` (`groupes-cluster.tsx`, `groupes-graphe.tsx`) : **le
  graphe en grappes** ; en haut, **Mots-clés | Clusters Google** (`gm=`) — les
  mêmes termes rangés sous leur mot-clé déclencheur (avec le coût, type de
  correspondance affiché) ou sous le cluster de Google (coût « — ») ;
  campagne (`gc=`) ; taille des ronds au choix (`gt=`, Coût barré en mode
  Clusters) ; une ligne de totaux sur **toutes les métriques** ; à droite, la
  **fiche de la grappe** (clics, impressions, conversions, coût, terme par
  terme, ligne « Masqués par Google ») et un **classement** clics · conv. ·
  coût. Ce que la maquette fait voir en mode Mots-clés : les recherches
  « gratuit » arrivent par la requête large. Les formes du premier et du
  deuxième tour sont retirées de la branche (dans l'historique). En attente du
  verdict de David.
