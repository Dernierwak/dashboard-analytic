# Sur quoi se différencient les produits qui font ce que Pulse veut faire

Type: research
Status: resolved

## Question

David : *« il manque un vrai concept »*. Avant de nommer le but de Pulse
(ticket 03), il faut savoir ce que valent les buts déjà pris — sinon on
formulera une promesse que trois produits gratuits tiennent déjà.

Ce ticket est **AFK et parallèle** : il ne dépend pas de l'état des lieux et
peut tourner en même temps.

### Ce qu'il faut rapporter

1. **La ligne de flottaison.** Que donne gratuitement Looker Studio (+
   connecteurs Meta/Google/GA4) à une PME aujourd'hui ? C'est le plancher que
   Pulse doit dépasser pour exister. Répondre par des captures de la
   documentation, pas de mémoire.

2. **Les produits qui vendent une *réponse*, pas un tableau de bord** — la
   catégorie où Pulse dit vouloir jouer (« où mettre tes dix minutes cette
   semaine »). Qui promet ça, avec quels mots exacts sur leur page d'accueil, et
   à quel prix.

3. **Comment ils s'en sortent avec le regroupement par sujet.** Pulse appelle ça
   « thème ». Les autres : campagne, audience, produit, canal ? Est-ce que
   quelqu'un fait porter à l'utilisateur le travail de classement, et comment
   le vend-il ?

4. **Ce qu'ils livrent en premier à un compte neuf.** Ce que voit un utilisateur
   à la minute 1, au jour 7. C'est ce qui informera « qu'est-ce qui doit être
   validé en premier » (ticket 04).

5. **Le verdict utile** : sur quel axe un produit de la taille de Pulse peut
   réellement se différencier aujourd'hui, et lesquels sont des impasses parce
   que déjà commoditisés.

### Contraintes

- **Sources primaires uniquement** : pages produit, documentation, grilles
  tarifaires publiques. Chaque affirmation porte son lien. Aucune estimation de
  part de marché, aucun chiffre reconstitué.
- Dire franchement ce qui n'a pas pu être vérifié.
- Livrable : `.scratch/refonte/research/02-sur-quoi-se-differencient-les-autres.md`,
  puis résumé dans l'`## Answer` de ce ticket.

## Answer

Dossier complet et sourcé : `.scratch/refonte/research/02-sur-quoi-se-differencient-les-autres.md`
(collecte du 2026-09-08, sources primaires uniquement, trous nommés en fin de document).

1. **La ligne de flottaison est plus haute qu'un tableau de bord.** Looker Studio
   est documenté « no-cost » et ses connecteurs Google (Google Ads, GA4) sont
   gratuits ; seuls les connecteurs tiers « may cost money » — la moitié Meta du
   périmètre de Pulse coûte donc ~39-49 €/mois (Supermetrics). Mais surtout :
   Google Ads (Recommandations), Meta (Opportunity Score, « experimentally proven
   recommendations ») et GA4 (détection automatique d'anomalies) donnent **déjà
   gratuitement des conseils priorisés, dans l'interface où on les applique en un clic**.
2. **La promesse « on te dit quoi faire » est prise, avec nos mots.** GoodMorning :
   « The Meta Ads dashboard that **tells you what to do** », « **Action items, not
   analysis** », « Up to **5 urgency-ranked recommendations — Act today, This week,
   Monitor**. Each with what to do, why, expected impact », **199 $/mois** (159 $ en
   annuel), **Meta seulement**. Opteo : « smart recommendations », « sorted by
   priority and statistical confidence », **129 → 499 $/mois**, **Google Ads seulement**.
   Madgicx (« tell you exactly what to do next ») et Optmyzr ne publient pas leurs prix.
3. **Personne ne vend le classement manuel comme un bénéfice.** Les libellés
   Google Ads font déjà le regroupement manuel, gratuitement et nativement.
   Funnel vend le classement comme un chantier de gouvernance fondé sur les noms
   de campagne. Motion a les deux modèles : Custom Tagging (une étiquette à la
   fois, pas d'export CSV) **et** AI Tagging (« no manual labeling required »,
   4 familles, dans toutes les formules). Leçon dure : **le classement à la main
   est ce qu'on retire au client dès qu'on sait le faire à sa place.**
4. **Minute 1 = la connexion, pas la valeur — et tous l'assument.** GoodMorning :
   « Connect in 90 seconds », puis « **Connect tonight. First report arrives Monday
   at 7am.** » Opteo : « less than 5 minutes », moyen de paiement demandé avant la
   première reco. Optmyzr exige « at least 30 days of historical performance data ».
   Motion : étiquettes sous 24-36 h, minimum 10 créations sur 90 jours. Les
   conditions d'éligibilité sont publiées **avant** l'essai.
5. **Verdict.** Impasses (commoditisées) : afficher les chiffres, conseiller
   l'optimisation d'une régie, détecter une anomalie, étiqueter à la main,
   afficher un niveau de confiance, auto-étiqueter une création, envoyer un
   récapitulatif. Encore libres sur l'échantillon lu : **(a) l'arbitrage entre
   canaux dans une seule réponse** — tous les concurrents sont mono-régie par
   naissance, c'est l'axe le plus solide et c'est exactement ce que le thème
   transverse permet de dire ; (b) le regroupement dans le **vocabulaire du
   client** (une offre, un service) et non celui de la régie ; (c) organique et
   payant dans le même verdict ; (d) le prix, entre 49 € (connecteur) et 159 $
   (réponse mono-canal). Toute promesse « toutes vos données au même endroit » ou
   « des recos pour améliorer vos campagnes » est morte à l'écrit pour le ticket 03.

Non vérifié, à ne pas combler : prix de Looker Studio Pro, de Porter Metrics, du
plan principal Madgicx et d'Optmyzr ; corps des pages Meta sur l'Opportunity
Score ; Triple Whale (site en 403) ; corps des pages Funnel ; existence ou non
d'un équivalent des libellés côté Meta Ads Manager. Le constat « personne ne fait
l'arbitrage inter-canal » vaut **sur l'échantillon lu**, pas sur le marché entier.
