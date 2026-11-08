# 10: Le compte dans le temps

Type: grilling
Status: resolved
Blocked by: 04, 16, 17
Assignee: Claude

## Question

Le bloc « la page » montre aujourd'hui abonnés, croissance 30 j, engagement du
compte et la courbe des abonnés. **Que doit montrer le compte, jour par jour,
et sous quelle forme ?**

- y a-t-il un équivalent organique de la **Tendance** de Meta (un graphe par
  métrique, la période d'avant en pointillé, les jours de publication marqués
  comme Meta marque les jours de changement) — et sur quelles métriques de
  compte que l'API rend honnêtement ([Ce que l'API donne du compte](04-ce-que-l-api-donne-du-compte.md)) ;
- les abonnés : gagnés, perdus, net — ce qui se mesure ;
- la comparaison à la période d'avant et/ou à la semaine type du compte,
  comme l'hebdo ;
- « l'engagement du compte » actuel est une moyenne de taux par post : le
  garder, le renommer, ou le retirer.

## Grilling — série 1 (2026-11-04, réponses de David)

- **Trois courbes** : Portée (par jour, jamais un total), Interactions,
  Abonnés — « on peut mettre les trois métriques ». « Engagement du compte »
  (moyenne de taux par post) quitte ce bloc : c'est une statistique de la
  foule, elle se lit dans la Comparaison en vue Engagement.
- **Demande nouvelle : un interrupteur organique / boosté / les deux** —
  « pour voir vraiment que c'est organique et qu'on booste ». Fait relevé :
  `reach` a une ventilation `media_product_type` contenant `AD` (non
  documentée comme part boostée), `total_interactions` la même ventilation
  sans dire si `AD` y est, les abonnés aucune. Ajouté à l'essai réel (point 8).
- **Abonnés** : gagnés et perdus « si on arrive à les voir », le net de
  chaque jour, et le cumul. David a demandé si on parlait de la page ou des
  posts : ici, **la page** (le compte) ; les abonnés par post sont tranchés
  dans [Les formats et les abonnés](09-les-formats-et-les-abonnes.md).
- **Comparaison** : période d'avant en pointillé, publications marquées —
  « super ». **Demande nouvelle : les chiffres dans une table** quand le
  graphe ne les montre pas — « sinon on ne voit pas les données ».

## Grilling — série 2 (2026-11-04, réponses de David)

- **Le haut de la page ne montre que la page** : « comment la page
  fonctionne elle-même avec les métriques de la page, et pas les métriques
  des posts » — celles-là se lisent plus bas, dans l'analyse des posts.
- **Abonnés** : gagnés, perdus, le cumul en courbe et des barres « pour
  qu'on voie quand ils perdent » ; les jours sans donnée peuvent partir.
- **Interrupteur organique / boosté** : « pas une grosse question », un
  simple filtre, placé où il sert le mieux.
- **Pas de table jour par jour** : la seule table est celle des posts, tout
  en bas, **exportable vers Excel** (demande nouvelle).

## Série 3 (2026-11-05)

- Lire les 90 jours que Meta garde dès le premier passage : « oui exact ».

## Answer

**Le haut de la page montre la page seule** — trois courbes tirées des
métriques du compte (`/{ig-user-id}/insights`), jamais de sommes de posts :

1. **Portée** du compte, par jour (`reach` en `time_series`). Elle ne
   s'additionne pas : aucun total sur la période, au plus une moyenne par
   jour.
2. **Interactions** du compte, par jour (`total_interactions`).
3. **Abonnés** : le total cumulé en courbe ; en dessous, sur le même axe
   des jours, des barres — gagnés vers le haut, perdus vers le bas. Si
   l'essai réel montre que `follows_and_unfollows` ne les sépare pas, les
   barres montrent le **net**, différence de deux relevés du total, et une
   ligne dit pourquoi. Jamais de double axe.

Sur chaque courbe : **la période d'avant en pointillé** ; les **jours de
publication marqués** sous l'axe, cliquables vers le Panneau latéral — le
seul pont vers les posts. **Un jour sans donnée est un trou**, ni zéro ni
ligne tirée par-dessus (§7) ; le jour en cours est exclu, les 48 dernières
heures portent l'icône « peut encore changer ».

**Interrupteur Tout / Organique / Boosté** : un petit filtre dans l'en-tête
de la Tendance, conditionné au point 8 de
[L'essai réel](17-l-essai-reel-des-metriques.md) (une valeur `AD` dans la
ventilation `media_product_type`). Actif sur les Interactions (additives :
organique = tout sauf `AD`) et sur « Boosté » de la Portée. **La portée
organique du compte ne se mesure pas** — tout moins boosté compterait deux
fois les gens touchés des deux côtés : « Organique » y est grisé avec sa
raison, à inscrire aux mesures impossibles par la spec. Sans effet sur les
Abonnés, que Meta ne ventile pas. Sans valeur `AD`, l'interrupteur n'existe
pas et « boosts compris » s'écrit sous Portée et Interactions.

**Historique** : au premier passage, la récolte lit les **90 jours** que
Meta garde pour Portée (1 appel) et Interactions (un appel par jour, ~90,
une fois) — ses chiffres, pas un passé reconstitué. Ensuite, un relevé par
jour. Les abonnés n'ont pas d'historique chez Meta : leur courbe commence au
premier relevé de `followers_count` (déjà lu par `account.py`, jeté par
`sync.py`). Le sort des anciennes lignes de `followers_history` se tranche
avec [L'état des abonnés en base](16-l-etat-des-abonnes-en-base.md).

**Retiré du haut** : « Engagement du compte » (moyenne de taux par post,
une statistique de la foule — elle se lit dans la Comparaison en vue
Engagement) et « Croissance 30 j » (remplacée par la courbe et les barres).
**Pas de table sous la Tendance** : les valeurs sont dans l'infobulle.

**Reporté** : l'**export Excel** du Tableau des posts →
[La page entière, en maquette](13-la-page-entiere-en-maquette.md) et la spec.

**Résolu sous condition** : gagnés / perdus et l'interrupteur sont écrits
pour les deux issues de [L'essai réel](17-l-essai-reel-des-metriques.md) ;
il reste à savoir laquelle s'applique, aucune décision nouvelle.

> **Amendé par [La page entière, en maquette](13-la-page-entiere-en-maquette.md)
> (2026-11-06)** : l'ordre change — **les abonnés en grand à gauche**
> (cumul + barres gagnés / perdus), portée et interactions du compte
> empilées à droite. Le reste de cette réponse tient.

> **Éclairé par [L'essai réel](17-l-essai-reel-des-metriques.md)
> (2026-11-06)** : l'interrupteur Tout / Organique / Boosté **existe** —
> `AD` est rendu ; Organique se mesure pour les **Interactions** (la
> ventilation s'additionne au total), pas pour la **Portée** (ventilation
> dédoublonnée par produit, somme > total) : Boosté seul s'y lit. Abonnés :
> gagnés = `FOLLOWER`, perdus = `NON_FOLLOWER` de `follows_and_unfollows`
> (300 = la somme de `follower_count`), fenêtre de 30 jours au plus. Le
> départ de la courbe se rouvre dans [Ce que l'essai réel laisse à
> décider](22-ce-que-l-essai-laisse-a-decider.md).

> **Tranché par [Ce que l'essai réel laisse à décider](22-ce-que-l-essai-laisse-a-decider.md)
> (2026-11-06)** : la courbe des abonnés **remonte 30 jours** au premier
> passage (total du jour − gagnés + perdus, jour après jour) ; un jour
> manquant l'arrête là.
