# Le repli de `poserNote` efface l'auteur même quand la base sait le porter

Type: task
Status: open

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
