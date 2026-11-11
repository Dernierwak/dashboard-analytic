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
