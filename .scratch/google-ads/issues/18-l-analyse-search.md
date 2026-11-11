# 18: L'Analyse Search

Type: grilling
Status: claimed
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
