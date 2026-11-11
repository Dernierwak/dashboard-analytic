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
