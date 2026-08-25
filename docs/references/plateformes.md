# Les plateformes — contraintes vérifiées

Chaque ligne porte sa source. Ce qui vient d'un essai et non de la documentation
est marqué **[pari]**. Ce qu'aucune API ne donne est dans « Ce qui est
impossible », et cette section-là est la plus importante du fichier.

Dernière vérification : 19 août 2026.

---

## Meta — Marketing API

**Attribution : 7 jours après le clic, 1 jour après une vue.** `action_attribution_windows`
n'est pas envoyé par le code, donc c'est le défaut qui s'applique : la
documentation de `/act_<id>/insights` définit `default` comme
`["7d_click","1d_view"]`. **Conséquence directe** : les conversions d'un jour
déjà récolté continuent de bouger pendant une semaine. La dépense et les
impressions, elles, sont stables en un à deux jours.

**Profondeur d'historique : 37 mois.** « The start date of the time range cannot
be beyond 37 months. » Au-delà, la requête est refusée.

**Portée (`reach`) au-delà de 13 mois : à vérifier.** Annoncé par la presse
spécialisée, jamais retrouvé dans la documentation officielle. **[pari]** — ne
pas s'appuyer dessus sans essai réel.

**`/act_<id>/activities` — le journal des changements.** `since` vaut par défaut
sept jours avant l'appel. Aucune limite de rétention documentée ; la page de
documentation de cette edge ne documente **aucun** paramètre, ce qui rend toute
affirmation sur son comportement invérifiable sans essai. La fenêtre de 180 jours
utilisée par le worker est **[pari]**.

**Piège de pagination, déjà rencontré** : l'API peut renvoyer un curseur `next`
sur une page vide. Sans plafond de pages, la boucle ne s'arrête jamais, et un
seul compte bloque la récolte hebdomadaire de tout le monde. Un garde-fou existe
dans `meta_script/fetch_meta_ads.py`.

**Aucun marquage automatique vers GA4.** Le rattachement d'un événement GA4 à une
campagne Meta n'existe que si `utm_campaign` porte le nom de la campagne. Si
l'annonceur a écrit un slug à la main, rien ne se rattache — et c'est un `None`,
jamais un `0`.

**Instagram organique** : les métriques d'un post sont cumulées à vie et ne se
stabilisent jamais. Un post vu une seule fois à la récolte garde des chiffres
figés au jour où on l'a lu.

---

## Google Ads API

**`change_event` — quatre contraintes qui vont ensemble** : un filtre de date est
obligatoire, un `LIMIT` est obligatoire (≤ 10 000), la fenêtre ne peut pas
dépasser **30 jours**, et **la fenêtre doit être bornée des DEUX côtés** — un
simple `>= depuis` (sans borne haute) est pris pour « depuis X jusqu'à l'infini »
et rejeté avec `CHANGE_DATE_RANGE_INFINITE`, pas toléré ni tronqué. Confirmé en
conditions réelles le 24 août 2026 (TASK-007) : cette 4e contrainte, à elle
seule et indépendamment de toute autre cause, a fait échouer 100 % des requêtes
`change_event` — zéro changement Google Ads n'était jamais remonté, quelle que
soit la version d'API. La borne haute se met à `demain`, pas `aujourd'hui`, pour
couvrir toute la journée en cours. Une fenêtre plus large que 30 jours (les deux
bornes présentes mais trop écartées) **fait rejeter la requête entière** — elle
n'est pas tronquée. C'est pourquoi la fenêtre Google et la fenêtre Meta sont deux
constantes séparées dans `saas/worker/fetch_all.py`.

**Fenêtre de conversion : 30 jours par défaut**, jusqu'à 90. « If you don't
customize the click-through conversion window […] the default window is 30 days. »

**Fraîcheur des données** : clics, impressions et coût ont un objectif de service
d'une heure. **Mais les conversions attribuées autrement qu'au dernier clic —
c'est-à-dire l'attribution pilotée par les données, devenue le défaut — ne sont
recalculées qu'une fois par semaine, le lundi à 15 h heure de San Francisco.** La
documentation ajoute que les métriques « may occasionally be updated one or more
days after an event occurs ».

**Aucune profondeur d'historique documentée** sur `segments.date`.

**Marquage automatique** : avec l'auto-tagging et le lien GA4 actif,
`sessionCampaignName` porte le vrai nom de campagne. Le rattachement par thème
est donc fiable côté Google, contrairement à Meta.

---

## GA4

**Fraîcheur : 24 à 48 heures pour qu'une journée se pose.** « Data processing can
take 24-48 hours. During that time, data in your reports may change. » Les paliers
annoncés : temps réel « typically a few minutes », intraday 2-6 h en standard
(≈ 1 h en 360), quotidien 12 h / 18 h / 24 h+ selon le volume d'événements de la
propriété. Google précise que ces durées **« are not a guarantee, nor an SLA or an
SLO »** — elles peuvent donc être dépassées sans que rien ne le signale.

**Révision de l'attribution : jusqu'à 12 jours.** « Attribution credit for key
events can change for up to 12 days after the key event is recorded », au fur et à
mesure que la modélisation des événements clés s'affine. **Conséquence directe** :
un jour déjà récolté continue de bouger pendant douze jours sur les deux colonnes
qui comptent — `conversions` (les événements clés) et `totalRevenue`. C'est le
chiffre qui fixe `_RECOUVREMENT_JOURS_GA4` dans `saas/core/ga4.py`, et
contrairement aux 30 jours d'Instagram ce **n'est pas un pari** : c'est le délai
au-delà duquel Google n'annonce plus de révision.

Sources : [[GA4] Data freshness](https://support.google.com/analytics/answer/11198161) ·
[[GA4] Data freshness and Service Level Agreement constraints](https://support.google.com/analytics/answer/12233314)

**Aucune méthode pour savoir si un rapport est complet.** L'API Data ne dit pas si
tous les hits d'une plage ont fini d'être traités. On ne peut donc pas demander
« est-ce stable ? » — on relit la fenêtre, c'est tout.

**Un événement clé est un booléen, pas un rang.** La ressource Admin
`properties.keyEvents` porte `name`, `eventName`, `createTime`, `custom`,
`deletable`, `countingMethod` (`ONCE_PER_EVENT` ou `ONCE_PER_SESSION`) et
`defaultValue`. **Aucun champ de rang.** La dimension de reporting `isKeyEvent`
est décrite comme « the string `true` if the event is a key event » — binaire
elle aussi.

**Le couple principal/secondaire appartient à Google Ads**, sur ses *actions de
conversion* (`primary_for_goal`) : une action primaire est utilisée par les
enchères et comptée dans « Conversions » ; une secondaire est seulement observée.
Détail qui confirme la séparation : **un événement clé GA4 importé dans Google Ads
y arrive en secondaire par défaut**, pour ne pas compter deux fois la même
conversion dans les enchères.

**Conséquence pour Pulse** : le rang principal/secondaire d'un événement est un
choix du client, thème par thème. Il ne s'importe pas. La marque « événement clé »
de GA4 se lit et s'affiche, comme information, jamais comme rang.

**Le catalogue des noms d'événements** se lit en interrogeant la dimension
`eventName` **sans filtre** : quelques dizaines de lignes, un appel. À ne pas
confondre avec le détail quotidien, qui reste filtré — la table `ga4_events` est
déjà paginée pour cause de dizaines de milliers de lignes avec six événements.

---

## Ce qui est impossible — ne pas essayer de le reconstruire

**Le ROAS par canal.** GA4 rend le revenu **au niveau du compte**, pas par canal.
Répartir ce revenu entre Meta et Google serait une invention. C'est aussi
pourquoi un rapport ancien peut porter un ROAS « Meta et Google confondus » : il
l'est par nature, aucun rechargement ne les séparera.

**Le ROAS par thème et par semaine.** `by_campaign` n'a pas de dates. On peut
donc dire ce qu'une campagne a rapporté en tout, jamais son évolution
hebdomadaire.

**L'historique du budget planifié.** Seules des photographies successives
existent, prises à chaque récolte. Il n'y a pas de journal des changements de
budget.

**Plus de 30 jours de changements côté Google.** Voir `change_event` ci-dessus.

**Une conversion sur un thème purement organique.** Un post Instagram n'a pas de
campagne UTM, donc aucun pont vers GA4. Ce n'est pas un réglage manquant, c'est
une mesure impossible — et l'écran doit le dire ainsi plutôt qu'afficher un zéro.
