# Le rapport se publie sur un canal muet, et l'email part avec

Type: task
Status: open

## Question

**Né de la revue de code de [03](03-identifiant-annonce-meta.md).** Le ticket 03
a posé une retenue étroite : si l'écriture Meta est sautée **parce que le schéma
est en retard** (colonne `ad_id` absente, ou contrainte pas encore déplacée), le
rapport de cet utilisateur n'est pas publié et son email ne part pas.

**La raison invoquée vaut bien plus largement que le cas traité.** Un rapport
publié sur une semaine sans dépense Meta présente un trou comme une **baisse** —
un faux verdict, livré au client. Or ce trou a bien d'autres causes que le
schéma, et **aucune** ne retient aujourd'hui la publication :

- jeton Meta expiré (le cas le plus courant — Google le fait déjà chaque semaine
  en statut *Testing*, cf. la note du `map.md`) ;
- Meta répond 500, ou refuse pour limite de débit ;
- n'importe quelle exception du canal, attrapée par `_fil`, qui marque le canal
  « echec » et **laisse la suite se dérouler normalement**.

Dans tous ces cas : `_ECRITURES_SAUTEES` reste vide, `publish_weekly_report`
tourne, `send_email` part, et la run finit **verte**.

### Ce qu'il faudrait décider

Le signal fiable n'est pas « le schéma est en retard », c'est **« le canal n'a
rien écrit alors qu'il aurait dû »**. `_fil` le sait déjà : il rend
`("meta", "meta KO: …")`. La même question se pose pour Google Ads, dont la
dépense compte tout autant dans le ROAS.

**Mais ce n'est pas une correction mécanique, c'est un arbitrage** : un compte
dont le jeton Meta est mort ne recevrait plus AUCUN rapport tant qu'il n'a pas
reconnecté. Est-ce mieux qu'un rapport qui ment sur la dépense ? Probablement
oui — §7 dit qu'une absence de donnée n'est pas un zéro — mais il faut alors que
le client comprenne pourquoi il ne reçoit rien, sinon on a juste déplacé le
silence. Un rapport qui DIT « la dépense Meta manque cette semaine, voici ce
qu'on sait quand même » est peut-être la vraie réponse.

À trancher avec `vision-produit` avant de coder.

### Ce qui est déjà vrai et ne change pas

La retenue étroite livrée par 03 reste : elle couvre le seul cas que 03 a
introduit (le déploiement à cheval sur la migration), et elle est bornée à
l'utilisateur concerné.
