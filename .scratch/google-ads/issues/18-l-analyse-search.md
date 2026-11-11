# 18: L'Analyse Search

Type: grilling
Status: resolved
Blocked by: 17
Assignee: Claude (session 2026-11-11)

## Question

En bas de la page `/google`, l'**Analyse** remplace « Analyser une campagne —
à venir » et commence par les campagnes Search
([Ce qu'on montre pour chaque type de campagne](15-ce-qu-on-montre-par-type.md),
réponse). **Que montre l'Analyse Search, et sous quelle forme ?**

Ce que David a dit (2026-11-11) : mots-clés et termes de recherche ; tous
les mots-clés du compte, sauf si on filtre par campagne ; « peut-être un
scatter plot avec les mots-clés, comme ça on voit les meilleurs mots-clés où
ils sont », la couleur pour les campagnes ; son message s'arrête sur « et puis
peut-être » — reprendre la suite avec lui.

La suite, dans un second message le même jour — des **spécialités des termes
de recherche** :
- « est-ce que ce mot-clé est souvent déclenché **tout seul**, ou est-ce que
  c'est beaucoup des termes de recherche » — la part d'un mot-clé qui vient
  du terme identique, face à la variété des termes qu'il attrape ;
- « est-ce qu'il y a **beaucoup de mauvais termes** de recherche » ;
- **grouper les termes par mot récurrent** : « on voit souvent le mot
  gratuit, est-ce qu'on peut le ressortir pour que les gens voient et puis
  après les excluent ».

Et le périmètre : « on est censé le faire maintenant, parce que je n'ai pas
l'impression que sinon on arrive à quoi que ce soit ». Son message s'arrête
encore (« on commence un peu à rentrer dans le ») : reprendre avec lui.

Bornes (`CLAUDE.md` §1) : « mauvais » ne s'écrit pas — un terme se montre par
ses faits (« 312 CHF, 0 conversion »), et le mot récurrent par ce qu'il coûte
et rapporte ; exclure est la décision du client, l'écran ne la propose pas.

À trancher :
- les deux **axes** du nuage (coût × conversions ? CTR × CPC ? volume × coût
  par conversion ?) et la **taille** des points, sans que l'écran classe ni
  conseille (`CLAUDE.md` §1 : « les meilleurs » se lit sur des chiffres, pas
  dans une phrase) ;
- ce qui accompagne le nuage : la **liste** des mots-clés, celle des
  **termes**, le lien entre un terme et son mot-clé ;
- le **filtre par campagne** : celui du Bandeau, ou un filtre propre à
  l'Analyse ? Et la **période**, celle du Bandeau ?
- les **spécialités** ci-dessus : comment se mesure « déclenché tout seul »
  (terme identique au mot-clé ? type de correspondance ?), ce qui définit un
  terme « qui ne rapporte rien » sans juger (coût sans conversion, sur quelle
  fenêtre, sous quel seuil de clics), et le **découpage des termes en mots**
  — fait par Pulse, pas par Google : quels mots on écarte (« de », « le »…),
  dans quelles langues (comptes FR et DE) ;
- ce qui reste hors de l'Analyse Search : les termes de PMax (le type est
  PMax, pas Search), le niveau de qualité si l'API ne le rend que sur une
  période (17).

S'appuie sur ce que l'API rend (17). Une maquette suivra probablement ; la
leçon des tickets 08 et 15 : montrer la seule section en question, dans la
page, et partir de la grammaire Meta.

## Answer

Grilling avec David, 2026-11-11, cinq séries (détail sous `## Comments`).
L'Analyse Search est une **descente pilotée par le haut de page** : la vue du
Sélecteur fixe ce qu'on regarde, le Bandeau la période et la campagne, puis
l'Analyse descend des campagnes aux éléments. Ni classement, ni étiquette
« mauvais », ni « à supprimer » — le client lit les faits et décide (§1).

**Structure, de haut en bas**
1. **Onglets de type** en tête : Search · PMax · Display · Vidéo · Demand Gen.
   Search seul actif, les autres grisés « à venir » (`BACKLOG.md`). Ce n'est
   pas le filtre Type du Bandeau abandonné au 15 : il ne change que l'Analyse.
   Une campagne choisie au Bandeau active l'onglet de son type.
2. **Période et campagne = celles du Bandeau** ; aucun contrôle propre.
3. **Nuage Performance**, dont les axes suivent le **Sélecteur de vue** —
   Notoriété : impressions × CPM ; Trafic : clics × CTR (coût en taille) ;
   Conversion : coût × conversions (clics en taille). Une phrase de lecture
   dit ce qu'on y voit, sans juger. Choix libre des axes : `BACKLOG.md`.
4. **Niveau** : par défaut on compare les **campagnes** ; « comme sur Meta »,
   on choisit de descendre aux **Groupes d'annonces**, aux **Annonces** et aux
   **Éléments** (titres, descriptions) — les mots-clés ne sont alors plus
   regroupés par campagne. Les chiffres d'Éléments ne s'additionnent pas
   pour redonner l'Annonce (servis ensemble) : l'écran le dit.
5. **Nuage Étendue** (onglet à côté, axes fixes) : par mot-clé, nombre de
   termes différents attrapés × part de ses clics venant du terme **au texte
   identique** (casse ignorée, accents gardés), coût en taille — la mesure de
   « déclenché tout seul » ; une variante proche compte comme un autre terme,
   la phrase de lecture le dit.
6. **Liste des mots-clés** (suit le nuage ; sans impression = listés sans
   chiffres, jamais à 0) avec la colonne **« Niveau de qualité
   (aujourd'hui) »**, « — » quand Google n'en rend pas. Puis **liste des
   termes**, chacun avec son mot-clé déclencheur et le statut « déjà exclu » ;
   cliquer un mot-clé filtre ses termes. Tri initial : coût décroissant — en
   vue Conversion, les termes qui ont coûté sans convertir sont en tête, sans
   bloc à part ni seuil inventé.
7. **Groupes de termes = les catégories de Google** (cliquer une catégorie
   montre ses termes) : impressions, clics, conversions, **sans coût** (Google
   ne le rend pas), sans comparaison semaine à semaine (stabilité non
   garantie). **Condition de David** : qu'elles fassent ressortir un mot
   récurrent comme « gratuit » (« si c'est les catégories que Google donne,
   on est super, on peut partir avec ça »). Si l'essai réel montre que non,
   le groupement par mot fait par Pulse revient (mots ajoutés au mot-clé,
   sans les mots de liaison FR/DE/EN, avec le coût).

**Conversions** : en vue Conversion, l'Analyse **nomme les actions comptées**
et le client **choisit lesquelles analyser** (cases à cocher, par défaut ce
que compte Google ; le titre écrit la sélection). Ce choix est propre à
l'Analyse ; le même sur toute la page reste au `BACKLOG.md`. Sans aucune action
de conversion déclarée, une phrase remplace le nuage Conversion.

**Couleurs** : une par campagne, toutes visibles ; la règle au-delà de
8 campagnes se décide au prototype.

**Hors de l'Analyse Search** : les termes de PMax (onglet PMax, à venir).

**Faits d'API qui en découlent** (doc v26, sans appel réel — détail sous
`## Comments`) : conversions par action = requête séparée des impressions /
clics / coût, jointure et coût par conversion calculés par Pulse ; éléments
RSA chiffrés par jour (`ad_group_ad_asset_view`), plus de label Google depuis
v23 ; catégories (`customer_search_term_insight`,
`campaign_search_term_insight`) sans coût. À éprouver par
[L'essai réel de l'Analyse Search](19-l-essai-reel-de-l-analyse-search.md).

Vocabulaire écrit dans `CONTEXT.md` : Élément, Mot-clé, Terme de recherche,
Catégorie de termes. Pas d'ADR : rien de difficile à défaire.

## Comments

### Série 1 — 2026-11-11

- **Q1, période et campagne** : oui. Elles viennent du Bandeau ; « l'effet du
  haut, ça prend pour ceux du bas ».
- **Q2, axes du nuage** : pas d'axes fixes. Des **préréglages** (« pour
  trafic, on voit quel mot-clé apporte le plus de trafic », impressions ou CTR
  en hauteur ; « conversion serait bien »), voire un choix libre, avec « des
  petites indications » de ce qu'on y lit. Coût × conversions imposé « ne sert
  à rien du tout » si on ne sait pas quelle conversion le client a déclarée.
  David hésite entre « un simple déjà » et « le fait qu'on peut choisir ».
- **Q3, listes reliées** : oui, mots-clés puis termes. En plus : un **nuage du
  nombre de termes de recherche par mot-clé**, et « des petits trucs en plus »
  sur les termes qui apportent peu de trafic (« qu'est-ce qu'on peut
  supprimer ») → série suivante, borné par §1 : on montre les faits, pas
  « à supprimer ».

### Série 2 — 2026-11-11

- **Q4, préréglages** : oui, le Sélecteur de vue pilote l'Analyse — « si on
  switch, on passe par trafic, bah, l'analyse sera différente ». Ajout : la
  structure dépend ensuite de « dans quelle sous-catégorie, donc type de
  campagne on est » → série 3 (où se choisit le type dans l'Analyse).
- **Q5, conversions** : oui, on nomme les actions comptées. Ajout : « il
  faudrait qu'on puisse aussi les sélectionner, qu'on choisisse quelles
  conversions exactement on veut regarder » → série 3.
- **Q6, Étendue** : oui pour abscisse, ordonnée, taille. Couleur : « une
  couleur par campagne si on les met tous » ; filtrer une campagne simplifie.
  Le nombre de couleurs → série 3.

### Série 3 — 2026-11-11

- **Q7, onglets de type** : oui — « on est dans la section notoriété et
  ensuite on peut choisir comme GUI un tab qui choisit, ok, maintenant on
  travaille dans search ».
- **Q8, actions de conversion** : oui — « c'est important de pouvoir choisir
  quelle conversion on veut traquer ou en tout cas analyser ».
- **Q9, couleurs** : à trancher au prototype ; d'ici là, une couleur par
  campagne, toutes visibles (« il y a 8 campagnes search »). Ajout : l'Analyse
  doit descendre sous la campagne — « on devrait voir aussi les adsets et voir
  assets […] pour voir lesquels fonctionnent le mieux. On ne doit pas faire
  que campagne » (message coupé) → série 4.

### Recherche — 2026-11-11 (doc API v26, aucun appel réel)

- **Conversions par action** : `segments.conversion_action(_name)` est
  sélectionnable avec `keyword_view`, `search_term_view` et `segments.date`,
  mais **seulement avec les métriques de conversion** (`conversions`,
  `conversions_value`, `all_conversions`…) — impressions, clics, coût et CTR
  en sont exclus (listes « Selectable with » lues dans les deux sens). D'où
  deux requêtes à joindre, et le coût par conversion d'une action calculé par
  Pulse. Sources : `developers.google.com/google-ads/api/fields/v26/keyword_view`,
  `…/v26/search_term_view`.
- **Éléments d'une RSA** : `ad_group_ad_asset_view` rend par élément et par
  annonce, par jour, impressions, clics, coût, conversions, avec `field_type`
  (HEADLINE, DESCRIPTION) et `pinned_field` (guide
  `…/docs/assets/fetching-assets`). `performance_label` n'est **plus rendu**
  pour Search depuis la v23 (2026-01-28). `ad_group_ad_asset_combination_view`
  ne rend que des impressions. _Déduit_ : les éléments étant servis ensemble,
  leur somme ne redonne pas le total de l'annonce.
- **Groupe d'annonces** : métriques habituelles par jour avec `ad_group`,
  vérifié.

### Série 4 — 2026-11-11

- **Q10, vocabulaire** : oui — « adsets » = groupes d'annonces, « assets » =
  éléments, « ou en tout cas annonces ».
- **Q11, sélecteur de niveau** : pas compris. David voit une **descente** :
  « soit on compare les campagnes, et puis on a les éléments, soit on descend
  plus bas, et puis après on a les mêmes […] mais c'est mieux dispatché ».
- **Q12, mots récurrents** : pas compris (« son petit mot, ça veut rien
  dire »). Questions trop denses — à reposer une idée à la fois, avec un
  exemple.

### Série 5 — 2026-11-11 (Q11 et Q12 reposées avec un exemple)

- **Q11, niveau** : par défaut on compare **les campagnes** ; « comme sur
  Meta », on peut choisir les groupes d'annonces ou les annonces / éléments et
  descendre — « les mots-clés ne sont plus regroupés sur une campagne, on voit
  un peu les différences, ça je trouve que c'est important ».
- **Q12, mots récurrents** : « ce serait cool », mais « c'est tout un autre
  truc ». Question de David : « est-ce que Google nous fait les groupes
  maintenant ? […] comme dans les PMax. Si on peut prendre tous les termes de
  recherche et ce que Google Ads leur associe, là c'est super » (message
  coupé) → recherche sur les catégories de termes de Google.

### Recherche — catégories de termes (doc API v26, aucun appel réel)

- `customer_search_term_insight` (par campagne) et
  `campaign_search_term_insight` (par groupe d'annonces ou groupe d'éléments) ;
  Search, PMax et Shopping (aide Google). `category_label` (vide = fourre-tout),
  `id` ; `segments.search_subcategory` toujours vide depuis le 2025-03-03.
- Les termes d'une catégorie se lisent (`segments.search_term`) ; une
  catégorie compte aussi des termes masqués → la somme des termes listés ne
  fait pas son total.
- Métriques : clics, impressions, CTR, conversions, valeur, taux de
  conversion, volume de recherche en fourchette. **Pas de coût**
  (`cost_micros` non sélectionnable). Par jour depuis mars 2023. Chiffres
  « traités différemment » du rapport des termes : petits écarts attendus.
- **Stabilité des catégories non documentée** : regroupements automatiques,
  `id` comme seule clé, sans garantie. Filtres obligatoires, limites de période
  et `RESOURCE_EXHAUSTED` à éprouver par un essai réel.
- Sources : `…/fields/v26/campaign_search_term_insight`,
  `…/fields/v26/customer_search_term_insight`,
  `support.google.com/google-ads/answer/11386930`,
  `ads-developers.googleblog.com/2025/01/google-ads-api-and-google-ads-scripts.html`.
