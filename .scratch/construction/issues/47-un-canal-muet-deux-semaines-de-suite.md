# Un canal muet deux semaines de suite n'est plus une note, c'est une relance

Type: task
Status: open

## Question

**Né de la réalisation de [20](20-rapport-publie-sur-un-canal-muet.md)**, et
c'est le désaccord que `vision-produit` a posé en rendant son arbitrage.

Le ticket 20 a tranché : on publie le rapport, et chaque mesure dont la source
est muette se tait en nommant le canal tombé. **Ça suffit tant qu'on parle
d'une semaine. Ça ne suffit plus à la troisième.**

Un compte dont le jeton Meta est mort depuis un mois reçoit **quatre rapports
polis qui disent tous la même absence**. C'est du décor : le client s'habitue à
la note comme il s'habitue à un bandeau de cookies, la run reste verte, et
personne ne voit que le compte dérive. On aurait alors remplacé un chiffre faux
par un message que personne n'agit — le même échec, en plus poli.

Le fait est déjà disponible : `fetch_progress` porte l'état `echec` du dernier
passage, et les `weekly_reports` publiés portent `canaux_muets` semaine après
semaine. **Compter les semaines consécutives ne demande aucune récolte de plus.**

### Ce qu'il faudrait décider

À la **deuxième semaine muette consécutive**, autre chose qu'une note dans le
rapport — quelque chose qui sorte du cycle hebdomadaire et qui soit **adressé à
quelqu'un**. Reste à trancher quoi :

- un email dédié, hors du rapport, avec pour seul objet la reconnexion ?
- une alerte à David (run rouge, ou notification) plutôt qu'au client, au moins
  tant qu'il n'y a qu'une poignée de comptes ?
- les deux, à des seuils différents ?

Et la question qui commande les autres : **au bout de combien de temps arrête-t-on
d'envoyer le rapport hebdo**, si on l'arrête ? Le ticket 20 a refusé la retenue
parce qu'elle privait le client du seul message capable de lui demander de
reconnecter. Cet argument s'affaiblit à mesure que le message est ignoré.

À trancher avec `vision-produit` avant de coder.

### Ce qui est déjà vrai et ne change pas

La doctrine du ticket 20 (`docs/adr/0005-un-canal-muet-fait-taire-sa-mesure-pas-le-rapport.md`)
reste : on publie, et chaque mesure se tait si sa source est muette. Ce ticket
n'ajoute qu'une **escalade** au-dessus, il ne revient pas dessus.
