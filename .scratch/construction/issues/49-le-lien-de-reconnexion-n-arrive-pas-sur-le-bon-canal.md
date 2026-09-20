# Le lien de reconnexion n'arrive pas sur le bon canal

Type: task
Status: open

## Question

**Né de la réalisation de [47](47-un-canal-muet-deux-semaines-de-suite.md)**, et
c'est le désaccord que `vision-produit` a posé en rendant son arbitrage.

Le ticket 47 suppose un problème d'**attention** : le client n'a pas vu la note,
donc on la dit plus haut, ou à quelqu'un d'autre. `vision-produit` parie que
c'est un problème de **friction** :

> reconnecter, c'est un parcours OAuth à plusieurs gestes qu'on ne fait pas
> debout dans le tram un lundi matin, et aucune escalade ne répare une friction.

Aujourd'hui, les deux chemins de reconnexion arrivent au même endroit générique :

- `saas/web/components/canal-muet.tsx` — « Reconnecter depuis Comptes → »
  pointe sur `/comptes` ;
- `saas/emailing/render.py` — la phrase d'alerte dit « Reconnecte depuis
  Comptes → Connexions », sans lien direct.

Dans les deux cas, le client sait **quel** canal est tombé (on le lui nomme) et
atterrit sur une page qui ne le sait pas. Il doit retrouver la bonne carte, le
bon bouton, et refaire le parcours entier.

### Ce qu'il faudrait décider

- Un paramètre d'URL (`/comptes?reconnecter=meta`) qui ouvre, déplie ou met en
  évidence la connexion du bon canal — et **jusqu'où** il va : mise en évidence,
  ou déclenchement direct du parcours OAuth ?
- Déclencher l'OAuth depuis un lien d'email est-il acceptable, ou faut-il
  toujours une page intermédiaire avec un clic délibéré ?
- Le piège de `CLAUDE.md` §8 s'applique en plein : **un lien énumère ce qu'il
  CHANGE, jamais ce qu'il garde.** Le lien devra être construit là-dessus,
  sinon il perdra par construction tout paramètre ajouté après lui.

### Ce qui est déjà vrai et ne change pas

L'escalade du ticket 47 reste : le compteur, le run rouge et le changement de
registre ne dépendent pas de ce lien. Ce ticket ne remplace pas l'escalade, il
teste l'hypothèse concurrente — et c'est **la mesure du ticket
[50](50-on-ne-sait-pas-si-l-email-est-ouvert.md)** qui dira laquelle des deux
avait raison.
