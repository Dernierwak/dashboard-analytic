# Le repli de `poserNote` efface l'auteur même quand la base sait le porter

Type: task
Status: resolved

## Question

Trouvé par la revue de code lancée à la fin de [14](14-la-porte-vers-la-plateforme.md),
**vérifié**. `saas/web/app/actions.ts` l. 565-575.

Le test d'erreur couvre trois colonnes d'un coup — `/author_id|campaign_/` — mais
le repli en retire **trois** :

```ts
const { author_id, campaign_channel, campaign_key, ...sansColonnesNeuves } = ligne;
```

Sur une base où `author_id` existe et où la paire `campaign_*` manque — une
migration à moitié jouée — une note **sans campagne** est donc réinsérée **sans
auteur**. Elle ne devient pas orpheline par accident de l'histoire : on en crée
une neuve, aujourd'hui, sur une base qui savait la signer.

Ce que ça ouvre : `peutToucher` rend une note sans auteur modifiable et
supprimable **par tout membre du compte**. C'est exactement la règle que
[ADR 0004](../../../docs/adr/0004-une-note-a-un-auteur-un-statut-non.md) pose.

Probabilité faible — il faut une migration partielle — mais le repli doit retirer
**ce que la base a refusé**, pas tout ce qui est neuf : lire le message et ne
déposer que la paire `campaign_*` quand c'est elle qui manque.

## Answer

**Le repli retire désormais ce que la base a refusé, et rien d'autre.**
`saas/web/app/actions.ts` : au lieu de déposer les trois colonnes d'un bloc, il
lit le message d'erreur et ne retire que la colonne qu'il nomme.

**Un défaut de plus, trouvé en corrigeant** : PostgREST ne nomme **qu'une**
colonne à la fois. Un repli unique aurait échoué sur la seconde colonne
manquante quand les deux manquent — c'est-à-dire sur le cas le plus courant, une
migration pas jouée du tout — et aurait rendu « réessaie » à une note qui
pouvait parfaitement s'écrire. Le repli est donc une boucle bornée par les trois
colonnes connues : chaque tour en retire au moins une, et un tour qui ne retire
rien s'arrête plutôt que de deviner ce que la base sait porter.

Le refus quand une campagne est désignée n'a pas bougé : l'écran vient
d'afficher « rattachée à : campagne X ».

**Harnais** : `12-le-carnet/test_carnet_web.py` épinglait `sansColonnesNeuves`,
c'est-à-dire le défaut lui-même. Remplacé par trois vérifications qui décrivent
la règle — l'auteur ne part que si la base l'a refusé, la paire de campagne à la
même condition, et la boucle s'arrête quand elle ne retire plus rien. 107/107.

**§9 — exception, tout est côté web** : visible au prochain déploiement, sans
passage du worker. Mais le chemin ne s'atteint que sur une base où la migration
`suivi_actions_auteur_campagne.sql` n'est pas jouée : sur la production il est
mort, et c'est tant mieux.
