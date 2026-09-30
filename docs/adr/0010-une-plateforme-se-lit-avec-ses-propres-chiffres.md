# Une plateforme se lit avec ses propres chiffres

Le dashboard Meta Ads a besoin de conversions, et `meta_ads_insights` n'en porte
aucune : ses colonnes sont `impressions, clicks, reach, link_clicks, spend`. Or
`ga4_insights` est juste à côté, porte déjà `conversions`, `revenue`, et — depuis
la section 417 de `000_run_me_all.sql` — une colonne `campaign` remplie par l'UTM.
La jointure est à portée de main : un `campaign` GA4 contre un `campaign_name`
Meta, et la catégorie Conversion se remplit sans écrire une ligne de récolte.

**On ne la fait pas.** Les conversions viennent de l'API Meta, récoltées exprès.

## La jointure par nom échoue en rendant zéro

Une jointure `ga4_insights.campaign = meta_ads_insights.campaign_name` ne trouve
rien dès que l'UTM ne reprend pas exactement le nom de la campagne — c'est-à-dire
presque toujours, puisque l'un est saisi à la main dans une URL et l'autre est un
nom d'objet Meta. Et son échec ne se voit pas : la jointure rend **zéro
conversion**, indiscernable d'une campagne qui n'a vraiment rien converti.

Ce dépôt a déjà payé cette forme de défaut. `instagram_posts_par_user.sql` raconte
un upsert dont la clé était fausse : « chaque récolte ne créait pas une ligne, elle
VOLAIT celle de l'autre », et « du point de vue de la base tout s'était bien
passé ». La mesure en production : 200 posts sur 200 détenus par le mauvais compte.
Une jointure par nom est le même mécanisme — un écran faux, aucune erreur nulle
part.

`CLAUDE.md` §7 interdit ce résultat directement : « une absence de donnée n'est pas
un zéro ».

## Les deux nombres ne mesurent pas la même chose

Même quand la jointure trouve, elle ment sur la comparaison. Meta attribue à la
date du **clic** et selon sa propre fenêtre d'attribution ; GA4 attribue à la
session, selon son modèle. Les deux chiffres sont justes chacun chez lui et
diffèrent toujours.

Le client, lui, ouvre son Ads Manager. S'il y lit 12 conversions et 9 dans Pulse,
il ne conclut pas que les modèles d'attribution divergent : il conclut que Pulse se
trompe. La confiance dans tout le reste du produit part avec.

## Ce que la règle coûte

Il faut récolter les `actions` / `action_values` de l'API Meta Insights : de
nouveaux appels, de nouvelles colonnes, une décision sur le type d'action qui
compte comme « la » conversion. C'est le ticket
[04](../../.scratch/meta-ads/issues/04-les-champs-api-meta-pour-les-conversions-et-les-creas.md).

On perd aussi une lecture qui aurait eu de la valeur : le revenu réel, que Meta ne
connaît pas et que GA4 mesure. Elle n'est pas interdite pour toujours — elle
demande une clé fiable entre les deux mondes, pas un nom de campagne, et c'est un
chantier à part. Noté au `BACKLOG.md`.

## La portée

La règle ne vise pas que GA4. Elle dit : **un écran qui présente les chiffres d'une
plateforme n'affiche que ce que cette plateforme déclare.** Le dashboard Google Ads
ne complétera pas ses conversions avec GA4 non plus, et un futur dashboard TikTok
n'empruntera rien à Meta.

Ce qui reste permis, et qui est autre chose : **poser côte à côte** les chiffres de
deux plateformes en disant de qui vient chacun. Ce n'est pas une jointure, c'est une
juxtaposition étiquetée — et c'est ce que `/couts` fait déjà pour la dépense.

Décidé le 2026-09-28 avec David, en chartant
[la carte du dashboard Meta Ads](../../.scratch/meta-ads/map.md).
