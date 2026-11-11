# 20: L'Analyse Search en maquette

Type: prototype
Status: resolved
Blocked by: 18
Assignee: Claude (session 2026-11-11)

## Question

**À quoi ressemble l'Analyse Search, et se lit-elle ?** La structure est
tranchée ([L'Analyse Search](18-l-analyse-search.md), réponse) : onglets de
type, nuage Performance piloté par le Sélecteur de vue, niveau (campagnes ›
groupes d'annonces › annonces › éléments), onglet Étendue, listes mots-clés
puis termes, catégories de termes, choix des actions de conversion.

À éprouver avec David :
- la **règle des couleurs** au-delà de 8 campagnes (le compte A en a 21
  actives) ;
- la **phrase de lecture** de chaque nuage, sans juger ;
- la descente de niveau : où se place le contrôle, comment on remonte ;
- la place du menu des actions de conversion.

La leçon des tickets 08 et 15 : montrer **la seule section**, dans la page, en
partant de la grammaire Meta. Chiffres fictifs, plausibles, jamais présentés
comme ceux du client.

## Answer

Premier tour vu par David le 2026-11-11. **Aucune des trois variantes telle
quelle : la maquette déplace les choses d'un étage.**

- **La descente et le nuage des campagnes montent dans la Comparaison.** « Là,
  on voit l'évolution de la campagne, on peut les comparer entre les unes et
  les autres. » Le choix des campagnes reste **au-dessus**, comme sur Meta ;
  dessous, côte à côte, un **nuage des campagnes sur la période** choisie (trois
  mois si on filtre trois mois) et la **courbe** jour par jour. Les deux suivent
  la même sélection, et on descend d'un cran à la fois. Suite :
  [Améliorer la Comparaison](16-ameliorer-la-comparaison.md).
- **Les Éléments (titres, descriptions) ne vont pas dans la Comparaison** :
  « ça, on n'a pas besoin de le mettre là, ce sera dans analyse ».
- **L'Analyse en bas est trop poussée pour commencer.** « Je sais même pas si
  c'est intéressant de déjà partir sur l'analyse, il me semble que c'est déjà
  beaucoup trop poussé. » On part de **ce qui l'intéresse en Search : les
  groupes de termes de recherche** que Google fait déjà (les catégories), vus
  comme des grappes reliées, par campagne — « on essaye avec ça ». Suite :
  [Les groupes de termes de recherche](21-les-groupes-de-termes-de-recherche.md).
- **Ce qui attend** que les groupes de termes soient éprouvés : choisir une
  campagne et l'analyser — nuage de ses mots-clés, ses termes, ses éléments.
  Noté dans la carte (« Not yet specified ») et au `BACKLOG.md`.

Les questions du ticket (couleurs au-delà de 8, phrase de lecture, place du
menu des actions) ne sont pas tranchées : elles repartent avec les modules
qu'elles concernent. Prototype conservé sur la branche jetable
`prototype/analyse-search` (`5e2def8`).

## Comments

- 2026-11-11 — Contraintes posées par
  [L'essai réel de l'Analyse Search](19-l-essai-reel-de-l-analyse-search.md),
  à respecter dans la maquette :
  - au niveau **éléments**, chaque point se lit seul : leurs chiffres ne
    s'additionnent pas (≈ 5 fois les clics réels), donc ni total, ni part ;
  - les **catégories** n'ont pas de coût ; un même sujet y est découpé par
    langue ; la catégorie fourre-tout (≈ 16 % des clics) ne liste aucun terme ;
  - la liste des **termes** n'est jamais le tout : 44 à 61 % des clics Search
    viennent de termes masqués, et la part masquée s'affiche ;
  - **niveau de qualité** « — » pour les mots-clés sans note (58 % des
    mots-clés actifs chez A) et pour tout mot-clé inactif ;
  - le **menu des actions** part des objectifs de chaque campagne : une
    action « non principale » peut porter l'essentiel des conversions.
- 2026-11-11 — **Maquette, premier tour.** Branche jetable
  `prototype/analyse-search` (`5e2def8`), partie du deuxième tour validé de
  la page (`b19d03f`) : l'Analyse remplace « Analyser une campagne — à
  venir ». Fichiers `saas/web/app/google/_prototype-page/analyse*.ts(x)`.
  Ouverte en dev par `/google?maquette=page&av=A#analyse` (`av=A|B|C`, ou
  flèches ← →) ; chiffres fictifs (location de vélos inventée, 12
  campagnes Search). Trois réponses aux quatre questions :

  | | A · Pas à pas | B · Plonger dans le nuage | C · La liste pilote |
  |---|---|---|---|
  | Couleurs > 8 campagnes | 8 teintes aux plus dépensières, « Autres (4) » en gris, légende qui met une campagne en avant | tout gris, les 5 plus gros points en noir et nommés ; une couleur une fois descendu | jusqu'à 8 lignes cochées dans la liste, colorées ; le reste gris |
  | Phrase de lecture | mode d'emploi des axes, au-dessus | constat (le plus à droite, le plus haut), dessous | constat en titre du module, mode d'emploi dessous |
  | Descente de niveau | onglets Campagnes › … › Éléments au-dessus du nuage | clic sur un point, fil d'Ariane pour remonter | pastilles en tête de la liste |
  | Menu des actions | rangée de pastilles au-dessus du nuage | colonne à gauche, toujours visible | menu déroulant dans l'en-tête |
  | Listes | empilées | mots-clés et termes côte à côte, catégories en cartes | en onglets |

  Remarqué en vérifiant : au niveau Éléments, ≈ 250 points se serrent dans
  le coin bas-gauche — la densité est une question en soi.
