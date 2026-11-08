# 01: La structure de la page

Type: grilling
Status: resolved
Blocked by: —
Assignee: Claude

## Question

Quels blocs la page `/instagram` porte-t-elle, dans quel ordre, et sous quel
nom ? Le point de départ est la liste de David (carte, Notes : la page →
les moyennes façon hebdo → le carré → l'aperçu → format → abonnés → tous les
posts) posée face au squelette de Meta (Bandeau de commandes, Sélecteur de vue,
Tendance, Comparaison, Tableau détaillé, Panneau latéral).

À trancher pour chaque module Meta : garde-t-il son **nom, son rôle et sa
place** en organique (ADR 0011), change-t-il de rôle (la Comparaison devient
le carré ?), ou disparaît-il (un Sélecteur de vue a-t-il un sens sans
objectif de campagne) ? Et pour chaque bloc actuel de
`saas/web/app/instagram/page.tsx` — « Ta page », moyennes, posts un par un,
Top 3, posts de la période, vue globale — il reste, il fond dans un module, ou
il part.

Ne tranche pas le contenu des modules (la place d'un post, l'âge, les formats
ont leur ticket) : seulement leur existence, leur ordre et leur nom.

## Grilling — série 1 (2026-11-02, réponses de David)

- **Bandeau de commandes** : oui, c'est le filtre.
- **Sélecteur de vue** : à garder sous une forme organique — « nous voulons
  souvent travailler sur un aspect » ; contenu exact non fixé.
- **Tendance = la page du compte**, premier module sous les filtres.
- **Panneau latéral** : oui, base ressemblant à Meta.
- **Tableau détaillé = tous les posts**, à la fin.
- **Il manque le fil conducteur** — Meta l'a, l'organique pas encore.
- **Moyennes + carré = un seul module** : la moustache **par format** (Reel,
  image, carrousel), avec un filtre pour écarter les aberrantes et un pour ne
  garder que Q1–Q3. Puis un **module posts** qui creuse : « les 3-5 meilleurs
  posts pour notre objectif ».
- **Formats** : oui à un module à part (a), « mais encore à améliorer ».

## Grilling — série 2 (2026-11-02, réponses de David)

- **Sélecteur de vue = l'objectif** (Portée / Engagement / Abonnés), placé
  sous la Tendance : oui — « apporte une bonne vision sur nos objectifs ».
- **Formats** : montre les moyennes par format et par métrique, pour choisir
  le format des prochains posts, **et filtre** vers les meilleurs posts de ce
  format sur cette métrique, avec leurs visuels.
- **Le carré** : « pas forcément » un module à part — peut-être avec les
  formats, les formats posés sur le carré ; « dur à dire encore ». → frontière
  Comparaison / Sélection laissée à la maquette du carré.

## Résolution (2026-11-02)

**Le fil conducteur est l'objectif** : le compte → la foule par format → les
posts zoomés → tout le détail, chaque étape lue sur la métrique de l'objectif
choisi. L'ordre, du haut en bas :

1. **Bandeau de commandes** — le filtre : titre, période.
2. **Tendance** — la page du compte, lue en entier ; l'objectif ne la
   gouverne pas.
3. **Sélecteur de vue** — l'objectif organique : **Portée**, **Engagement**,
   **Abonnés** (Reels exclus de cette vue : l'API ne leur rend pas `follows`).
   **Écart à l'ADR 0011** : placé *sous* la Tendance et non au-dessus, parce
   que le compte est le cadre et que l'objectif ne gouverne que la foule.
4. **Comparaison** — une moustache **par format** (Reel, image, carrousel) sur
   la métrique de la vue. Elle absorbe « Formats » : « quel format rapporte des
   abonnés », c'est la Comparaison en vue Abonnés — un module à part redirait
   la même chose, ce qui a tué « Tes formats » le 2026-09-12. Choisir un format
   filtre vers ses meilleurs posts.
5. **Sélection** — le carré : 3 à 5 posts côte à côte (meilleurs pour
   l'objectif, ou derniers), chacun sur la moustache de son format. Pas « Top » :
   les 5 derniers ne sont pas un classement. Pas une matrice 2×2 ni « SWOT » :
   un SWOT conseille (§1).
6. **Tableau détaillé** — tous les posts, à la fin.

Plus le **Panneau latéral** : l'aperçu d'un post, ouvert depuis un module.

**Les blocs actuels** de `page.tsx` : « Ta page » → Tendance ; « Tes
moyennes » → Comparaison ; « Top 3 » → Sélection ; « Posts de la période » et
« Vue globale » → un seul Tableau ; « Évolution des posts » part (une courbe de
posts dans le temps contredit « l'organique se lit dans la foule »).

**Laissé ouvert** : Comparaison et Sélection, un module ou deux (« dur à dire
encore », David) → [Le carré de sélection, en maquette](12-le-carre-en-maquette.md).
« À voir ensuite si cela tient la route » : l'ordre se rejuge sur
[la maquette de la page entière](13-la-page-entiere-en-maquette.md).

**Reporté ailleurs** (points pro validés par David) : portée rapportée aux
abonnés et `n` sur chaque moustache → [06](06-la-place-d-un-post.md) ;
réactions légères / fortes et Reel lu sur son temps de visionnage →
[09](09-les-formats-et-les-abonnes.md) ; lien qui garde la sélection →
[12](12-le-carre-en-maquette.md) ; compte gratuit à 10 posts →
[18](18-le-compte-gratuit-a-10-posts.md).
