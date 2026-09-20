# Sur quoi se différencient les produits qui font ce que Pulse veut faire

Recherche du ticket `.scratch/refonte/issues/02-sur-quoi-se-differencient-les-autres.md`.
Date de la collecte : **2026-09-08**. Les prix bougent : toute réutilisation
au-delà de quelques semaines doit revérifier les grilles.

## Méthode et honnêteté

- Une affirmation = un lien vers la page qui la porte (page produit, page
  tarifaire, documentation de l'éditeur).
- Les prix cités sont ceux **affichés publiquement** sur la page tarifaire de
  l'éditeur au moment de la lecture. Quand un éditeur ne publie pas son prix,
  c'est écrit tel quel — aucun prix n'est reconstitué.
- Aucune part de marché, aucun volume d'utilisateurs, aucun classement : ces
  chiffres n'existent pas en source primaire.
- La section finale liste **ce qui n'a pas pu être vérifié**. Rien n'a été
  comblé.

Limite de méthode à connaître : le lecteur de pages utilisé rend le texte
principal d'une page, pas toujours la page entière (contenus injectés en
JavaScript, pages tronquées). Quand une page a résisté, c'est signalé au lieu
d'être contourné par une source secondaire.

---

## 1 · La ligne de flottaison : ce qu'une PME obtient gratuitement aujourd'hui

Le plancher n'est pas « Looker Studio ». Le plancher est **la somme de trois
gratuits** : l'outil de dataviz de Google, les connecteurs natifs Google, et —
surtout — **les recommandations que les régies elles-mêmes donnent déjà, gratuitement,
dans leur propre interface**. C'est le point le plus important de cette section.

### 1.1 Looker Studio : gratuit, et documenté comme tel

La documentation Google décrit l'outil comme :

> « Data Studio is a no-cost tool that turns your data into informative, easy to
> read, easy to share, and fully customizable dashboards and reports. »
>
> — [Looker Studio overview, docs Google Cloud](https://docs.cloud.google.com/looker/docs/studio)

(La documentation Google est en cours de migration `support.google.com` →
`cloud.google.com` → `docs.cloud.google.com`, d'où des pages encore intitulées
« Data Studio ». Ce sont les pages officielles.)

### 1.2 Les connecteurs Google sont gratuits, les autres non

C'est la phrase qui décide de tout, et elle vient de Google :

> « You can use **free connectors built by Google** to access data such as Google
> Sheets, Google Ads, Google Analytics, and other Google Marketing Platform
> products, and more. »
>
> « You can also use connectors built by Data Studio partners through the
> Community Connectors developer program. […] **Community connectors may cost
> money to use.** If you have issues using a community connector, please contact
> that connector's developer directly. »
>
> — [About data sources, docs Google Cloud](https://docs.cloud.google.com/looker/docs/studio/about-data-sources)

**Conséquence directe pour Pulse :** la moitié Google du périmètre de Pulse
(Google Ads + GA4) est **gratuite et native** dans Looker Studio. La moitié Meta
(Meta Ads + Instagram) **ne l'est pas** : elle passe obligatoirement par un
connecteur tiers payant. Prix publics relevés :

| Connecteur | Entrée de gamme affichée | Ce que l'entrée de gamme donne | Source |
|---|---|---|---|
| Supermetrics | **49 €/mois** (mensuel) ou **39 €/mois** (annuel), plan *Starter* | 3 sources de données au choix, 1 destination principale (Looker Studio en fait partie) ; Facebook Ads listé comme connecteur payant « Most popular » | [supermetrics.com/pricing](https://supermetrics.com/pricing) |

La page tarifaire de Porter Metrics (l'autre connecteur Meta→Looker Studio
couramment cité) **n'a pas pu être lue** — voir « Non vérifié ».

### 1.3 Looker Studio Pro : Google ne publie pas de prix unitaire public

Google renvoie sa propre documentation vers sa page marketing, sans chiffre :

> « For Data Studio Pro pricing, visit our Marketing page. »
> « You'll be billed monthly for the number of Pro licenses in the subscription,
> regardless of whether or not those licenses are used. »
>
> — [Pro subscription overview, docs Google Cloud](https://docs.cloud.google.com/looker/docs/studio/looker-studio-pro-subscription-overview)

Et la page marketing `cloud.google.com/looker-studio` n'a pas rendu de bloc
tarifaire lisible. **Le prix de Looker Studio Pro est donc non vérifié.** Ça
n'a pas d'importance pour Pulse : Pro achète de la **gouvernance d'entreprise**
(propriété des rapports par l'organisation, workspaces d'équipe, support), pas
de l'intelligence — cf. la même page. La menace pour Pulse est la version
gratuite, pas Pro.

### 1.4 Le vrai plancher : les régies donnent déjà des recommandations, gratuitement

C'est ce que le ticket appelait « le plancher que Pulse doit dépasser », et il
est plus haut qu'un tableau de bord.

**Google Ads — page Recommandations.** Google décrit une page qui propose
d'« améliorer vos enchères, vos mots clés et vos annonces » et de faire
« augmenter la performance et l'efficacité globales de vos campagnes », avec
« des estimations de performance basées sur des données historiques » et la
promesse de « faire des améliorations sans y passer beaucoup de temps ».
— [Recommandations et score d'optimisation, aide Google Ads](https://support.google.com/google-ads/answer/3448398)

**Meta — Opportunity Score.** Meta a un produit dédié dans Ads Manager, et son
propre cours Blueprint le décrit :

> « Opportunity score: **experimentally proven recommendations** to help improve
> your campaign performance »
> « get an overview of opportunity score, discover how it can benefit you and
> find out **how recommendations are selected** »
>
> — [Cours Meta Blueprint « Opportunity score »](https://www.facebookblueprint.com/student/path/253172-opportunity-score-course)

Les pages du Meta Business Help Center existent
([About Opportunity Score](https://www.facebook.com/business/help/804913634782260),
[Types of Opportunity Score Recommendations](https://www.facebook.com/business/help/2086509315182746))
mais **leur corps n'a pas pu être lu** (rendu JavaScript). Le détail du barème
0-100 et la liste des types de recommandations sont donc **non vérifiés** ; le
fait que Meta livre gratuitement des recommandations classées, lui, l'est.

**GA4 — Analytics Intelligence.** Google décrit une détection automatique :

> « Analytics Intelligence is a set of features that uses machine learning and
> conditions you configure to help you understand and act on your data. »
> « Analytics Intelligence **detects unusual changes or emerging trends** in your
> data and **notifies you automatically**, on the Insights dashboard. »
>
> — [Analytics Intelligence, aide Google Analytics](https://support.google.com/analytics/answer/9443595)

**Verdict de section.** Une PME obtient gratuitement, sans aucun abonnement :
des tableaux de bord Google Ads + GA4 illimités, une détection automatique
d'anomalies GA4, et des recommandations priorisées côté Google Ads **et** côté
Meta, dans les interfaces mêmes où elle peut les appliquer en un clic.
**Le seul trou payant du gratuit, c'est de faire tenir Meta et Google dans la
même page** (≈ 39-49 €/mois de connecteur). Un produit dont la promesse est
« vous voyez vos chiffres Meta et Google au même endroit » vend ce trou-là, et
rien d'autre.

---

## 2 · Ceux qui vendent une réponse, pas un tableau de bord

La catégorie existe, elle est occupée, et elle est **chère**. Mots exacts et
prix publics.

### 2.1 GoodMorning — le plus proche de Pulse, mot pour mot

C'est la découverte la plus importante de cette recherche : un produit dont la
promesse est presque littéralement celle de `CLAUDE.md`.

> Titre de page : « **Meta Ads reporting software — action items, not analysis** »
> Titre principal : « **The Meta Ads dashboard that tells you what to do.** »
> Sous-titre : « **Log in and the decisions are already made for you. Pause, scale, iterate.** »
> Argument : « ✦ **Action items, not analysis** » — « **No analysis. No charts to interpret.** »
> Livrable : « **Up to 5 urgency-ranked recommendations — Act today, This week, Monitor.
> Each with what to do, why, expected impact.** »
> Cadence : « **Every Monday** » à « **7am** », « a complete diagnosis of your Meta Ads account »
> Branchement : « **Connect in 90 seconds** » (accès Meta Ads en lecture seule)
>
> — [goodmorningco.com](https://goodmorningco.com/)

Prix publics, **par compte publicitaire** :

| Formule | Prix affiché | Facturation |
|---|---|---|
| Monthly | **199 $/mois** par compte | 199 $ tous les mois |
| Quarterly | **179 $/mois** par compte | 537 $ tous les 3 mois (« MOST POPULAR ») |
| Annual | **159 $/mois** par compte | 1 908 $ une fois par an |

Membres d'équipe au-delà de deux : **50 $/mois** chacun.
— [goodmorningco.com/pricing](https://goodmorningco.com/pricing)

À retenir : **Meta seulement**. Pas de Google Ads, pas de GA4, pas d'organique.

### 2.2 Opteo — la même promesse côté Google Ads

> « **The smarter way to manage Google Ads** »
> « Opteo gives you **smart recommendations** that improve Google Ads performance.
> **Spend less time buried in performance data** and more time doing meaningful
> work that drives conversions. »
> « Improvements are smart recommendations that can be **pushed live to Google Ads
> in seconds**. »
> « Opteo continuously monitors Google Ads accounts for **statistically significant
> patterns**. »
>
> — [opteo.com](https://opteo.com/)

Sur la page dédiée :

> « **Smart suggestions based on your Google Ads performance data** »
> « **more than 40 different Improvement types** »
> Les améliorations sont « **sorted by priority and statistical confidence** »
> « Many Improvements can be **pushed to Google Ads with a single click** »
>
> — [opteo.com/features/improvements](https://opteo.com/features/improvements)

Prix publics — « Simple pricing based on your Opteo usage » :

| Formule | Prix | Comptes | Dépense pub couverte |
|---|---|---|---|
| Basic | **129 $/mois** | 10 | 25 000 $/mois |
| Professional | **249 $/mois** | 25 | 100 000 $/mois |
| Agency | **499 $/mois** | 75 | 250 000 $/mois |
| Enterprise | sur devis | — | — |

Essai gratuit proposé sur chaque formule. — [opteo.com/pricing](https://opteo.com/pricing)

Point de vocabulaire à noter pour Pulse : **« sorted by priority and statistical
confidence »**. La notion de confiance affichée à côté d'un conseil, que Pulse
matérialise en ●◐○, est déjà une convention de la catégorie — pas un
différenciateur.

### 2.3 Madgicx — la même promesse, vendue comme un agent

> « **Dominate AI Ads Results** »
> « You just found Madgicx. **The secret AI Ads Manager top ad agencies use** to run
> all accounts. »
> « The AI Marketer works like your personal AI Ad Agency… and **tell you exactly
> what to do next!** »
> « understand **exactly where your budget is working—and where it's not** »
> Offre affichée en page d'accueil : « Early-Bird Offer: accurate data analysis for
> **$29/mo forever!** »
>
> — [madgicx.com](https://madgicx.com/)

Sur la page tarifaire, l'éditeur **ne publie pas de grille chiffrée** :
« Start for Free, Choose Your Plan Later », prix « shown inside the app », par
paliers de dépense mensuelle (« Less than $1K » → « $30K+ »), avec un essai
gratuit de 7 jours et un module additionnel « Tracking Pro » à **49 $/mois**.
— [madgicx.com/pricing](https://madgicx.com/pricing)
Le prix du plan principal est donc **non vérifiable** en source primaire.

### 2.4 Optmyzr — outils d'optimisation, prix non publié

> « Optmyzr is simple. **Pick a plan, connect your ad accounts, and unlock dozens of
> insight, optimization, and automation tools.** »
>
> — [optmyzr.com/pricing](https://www.optmyzr.com/pricing/)

Formules *Essentials* / *Premium* / *Enterprise*, par paliers de dépense
mensuelle (25 K$ → 500 K$+), remise annuelle « Save 30% ». **Les montants
n'apparaissent pas** dans la page telle qu'elle a été lue : prix **non vérifié**.

### 2.5 Markifact — l'agent qui exécute, facturé au crédit

> « **AI Automation. Built for Marketers.** »
> « Use agents & workflows to **analyze performance, create campaigns, automate
> reports, and run approved actions** across your marketing stack. »
> Sources : Google Ads, Meta Ads, TikTok, LinkedIn, Shopify, HubSpot, GA4, Sheets,
> Slides, Slack, « 20+ » autres.
> Prix : **Pro 79 $/mois** (2 000–5 000 crédits, 1 utilisateur) ; **Team 249 $/mois**
> (10 000–100 000 crédits, 10–50 sièges) ; **Managed** sur devis. Palier gratuit
> avec 200 crédits offerts à l'inscription.
>
> — [markifact.com](https://www.markifact.com/)

### 2.6 Databox — le récapitulatif périodique, sans conseil

Databox vend la **cadence** sans vendre la recommandation :

> « **Get daily, weekly, or monthly recaps on your most important metrics,
> delivered to you.** »
>
> — [databox.com/product/scorecards](https://databox.com/product/scorecards)

Positionnement plateforme : « Bring connected data, governed metrics, business
contexts, and AI together in one platform. » Prix publics (facturation
annuelle) : **Free 0 $** (3 sources, 1 utilisateur, 1 tableau de bord, 50 crédits
IA/mois) ; **Analyst 64 $/mois** ; **Pro 159 $/mois** ; **Growth 399 $/mois** ;
**Custom** sur devis. — [databox.com/pricing](https://databox.com/pricing)

### 2.7 Ce qui n'est pas dans la catégorie : Metricool

Utile comme repère de prix pour une PME multi-canal (Meta Ads + Google Ads +
réseaux sociaux) : **Free 0 €** (1 marque, 20 publications/mois, 30 jours
d'historique) ; **Starter à partir de 20 €/mois** ; **Advanced à partir de
54 €/mois** (connecteur Looker Studio inclus) ; **Custom** sur devis.
Titre de la page : « Plans designed to give you peace of mind ».
— [metricool.com/pricing](https://metricool.com/pricing/)
Metricool vend de la **publication et du reporting**, pas une réponse.

### Lecture de la section 2

Trois choses sautent aux yeux.

1. **La promesse « on vous dit quoi faire » n'est pas libre.** Elle est prise, et
   elle est prise avec les mêmes mots que Pulse : *tells you what to do*,
   *what to do, why, expected impact*, *exactly what to do next*.
2. **Elle est prise par canal, pas en travers des canaux.** GoodMorning = Meta.
   Opteo, Optmyzr = Google Ads. Madgicx = Meta. Personne dans cet échantillon ne
   livre **une seule réponse hebdomadaire qui arbitre entre payant et organique,
   entre Meta et Google**. C'est le trou le plus visible.
3. **Le prix de cette promesse est de 129 à 499 $/mois**, sur un seul canal.
   Le prix d'un simple regroupement de données (connecteur) est de 39-49 €/mois.
   L'écart entre les deux, c'est exactement ce que le marché facture pour « la
   réponse ».

---

## 3 · Le regroupement par sujet : qui fait le travail, et comment il est vendu

Pulse appelle « thème » une étiquette que **l'utilisateur** pose sur ses
campagnes et ses publications. Voici ce que font les autres.

### 3.1 Les régies : le regroupement manuel existe déjà, gratuitement, côté Google

Google Ads a un objet natif exactement équivalent :

> « **Labels allow you to organize your campaigns, ad groups, ads, and keywords
> into groups. Labels are customizable, and you can change them around at any
> time.** »
>
> — [Créer, utiliser et gérer les libellés, aide Google Ads](https://support.google.com/google-ads/answer/7486653)

Ils servent au filtrage : « any of the labels », « all of the labels », « none of
the labels ». Et une limite structurelle importante, documentée par Google :

> « Labels aren't inherited down throughout the campaign — if you apply a label to
> a campaign, the label only applies to that campaign, not the ad groups and
> keywords that are within that campaign. »

**Ce que ça veut dire pour Pulse :** le regroupement manuel côté Google Ads
n'est pas une invention de Pulse, c'est une fonctionnalité gratuite de Google
depuis des années. La valeur ne peut donc pas être « vous pouvez étiqueter vos
campagnes ». Elle ne peut être que dans ce que Google ne fait pas : **traverser
les plateformes** (un même thème sur une campagne Google, une campagne Meta et
une publication Instagram) et **remonter au niveau d'un résultat business**.
L'équivalent natif côté Meta n'a pas pu être vérifié (voir « Non vérifié »).

### 3.2 Motion : le seul cas où l'on voit les deux modèles côte à côte

Motion (analytique créative Meta) a **les deux**, et la comparaison est
instructive.

**Le modèle « c'est l'utilisateur qui classe » — Custom Tagging :**

> « **Custom tagging lets you organize and analyze your creative based on anything
> you notice** (seasonal elements, etc.) that isn't covered in your naming
> conventions. »
> Bénéfice vendu : « **It's much easier to take insights back to your creative team
> with actual data, not just gut feelings.** »
> Coût réel documenté : les étiquettes sont **appliquées une par une** à chaque
> création ; aucun étiquetage en masse ni automatisation par règle n'est décrit,
> et les étiquettes personnalisées **ne s'exportent pas en CSV**.
>
> — [Getting started with Custom Tagging, aide Motion](https://help.motionapp.com/en/articles/8022621-getting-started-with-custom-tagging-in-motion)

**Le modèle « c'est l'outil qui classe » — AI Tagging :**

> Motion « **automatically analyze[s] your Meta ad creative and appl[ies] descriptive
> tags** », avec « **no manual labeling required** ».
> Quatre familles d'étiquettes : **Visual** (type d'asset : UGC, lifestyle, haute
> production ; format : listicle, skit, podcast), **Persona** (audience visée),
> **Messaging** (thème, saisonnalité, type d'offre), **Hook** (question, callout,
> contrarian).
> Limites documentées : créations **Meta uniquement**, ayant dépensé **dans les 90
> derniers jours** ; 100+ langues analysées, étiquettes rendues en anglais.
>
> — [Getting started with AI Tagging, aide Motion](https://help.motionapp.com/en/articles/12461770-getting-started-with-ai-tagging-in-motion)

D'après la page de nouveautés de l'éditeur, l'AI Tagging est **inclus dans toutes
les formules** — [motionapp.com/releases](https://motionapp.com/releases) (page
listée par la recherche, corps **non lu** : à revérifier avant citation).

**La leçon la plus dure de cette recherche pour Pulse :** un acteur qui a
construit le classement manuel a ensuite construit le classement automatique
et l'a mis dans toutes ses formules. Le classement à la main n'est pas ce qu'on
vend ; c'est ce qu'on retire au client dès qu'on sait le faire à sa place.

### 3.3 Le modèle « gouvernance » : Funnel

Funnel vend explicitement le travail de classement comme une discipline, sous
deux noms : **Conventions** (définir une structure de nommage : nombre de
parties, séparateur, plateformes concernées, puis créer des dimensions à partir
des variables du motif) et **Custom dimensions** (règles de découpe, expressions
régulières, enchaînement de fonctions pour dériver une catégorie à partir des
noms de campagne).

- [Conventions, base de connaissances Funnel](https://help.funnel.io/en/articles/11325592-conventions)
- [Custom dimensions explained – The Basics](https://help.funnel.io/en/articles/1622167-custom-dimensions-explained-the-basics)
- [Campaign dimensions in Funnel](https://help.funnel.io/en/articles/1269137-campaign-dimensions-in-funnel)

**Attention :** ces trois pages existent et sont bien celles de l'éditeur, mais
**leur corps n'a pas pu être lu** (le lecteur n'a rendu que l'index de la base
de connaissances). La description ci-dessus vient des extraits renvoyés par la
recherche, pas d'une lecture complète. **À revérifier avant d'être citée dans
un document produit.**

Ce qui est sûr et suffisant : Funnel range ces pages sous une rubrique
« Plan & govern ». Le classement y est un **chantier d'installation**, pas un
geste hebdomadaire, et il repose sur les **noms de campagne** — donc sur une
discipline de nommage que la PME cible de Pulse n'a, par construction, pas.

### Lecture de la section 3

- **Personne ne vend le classement manuel comme un bénéfice.** Il est soit natif
  et gratuit (Google Ads), soit un chantier de mise en place (Funnel), soit un
  reliquat que l'IA remplace (Motion).
- **Le classement automatique est déjà commoditisé sur la dimension créative**
  (Motion, Meta uniquement) : format, angle, persona, accroche.
- **Ce qu'aucun produit lu ici ne fait :** un regroupement **choisi par
  l'utilisateur**, **transverse Meta + Google + organique**, et exprimé dans le
  vocabulaire de son activité (une gamme, une offre, un service) plutôt que dans
  celui de la régie (campagne, audience, création). C'est le seul territoire du
  « thème » qui reste vide dans cet échantillon.

---

## 4 · Ce qu'un compte neuf voit à la minute 1, puis au jour 7

Tous les produits qui vendent une réponse ont le même problème : **une réponse
demande de l'historique, et un compte neuf n'en a pas.** Quatre façons de le
traiter, toutes documentées.

| Produit | Minute 1 | Ce qu'il faut attendre / fournir | Source |
|---|---|---|---|
| **GoodMorning** | « Connect in 90 seconds » (lecture seule Meta) ; puis « While you sleep, our pipeline pulls **the last 7 days** of performance data at the campaign, ad set, and ad level » | « **Connect tonight. First report arrives Monday at 7am.** » Le diagnostic tourne le dimanche. Aucun minimum d'historique annoncé. | [how-it-works](https://goodmorningco.com/how-it-works) |
| **Opteo** | « **Get started with Opteo in less than 5 minutes** » — 4 étapes : créer le compte, connecter Google Ads, **ajouter un moyen de paiement**, commencer à pousser des améliorations | Le moyen de paiement est demandé **avant** la première recommandation | [opteo.com](https://opteo.com/) |
| **Optmyzr** | Message « no activity » si le compte est trop jeune | « **Optmyzr requires at least 30 days of historical performance data in the connected account to complete setup.** » Sinon : connecter un autre compte, ou attendre plusieurs semaines. | [FAQ Optmyzr](https://help.optmyzr.com/en/articles/3072987-general-faqs) |
| **Motion (AI Tagging)** | Rien d'immédiat | « For new accounts, tags appear **within 24-36 hours** after data source connection » ; le compte doit avoir lancé **au moins 10 créations dans les 90 derniers jours** | [aide Motion](https://help.motionapp.com/en/articles/12461770-getting-started-with-ai-tagging-in-motion) |
| **Madgicx** | « **Start for Free, Choose Your Plan Later** », essai 7 jours avec accès complet | — | [madgicx.com/pricing](https://madgicx.com/pricing) |

### Lecture de la section 4

Trois choses utiles au ticket 04.

1. **Personne ne prétend livrer la réponse à la minute 1.** Le meilleur cas de
   l'échantillon, GoodMorning, assume franchement l'attente et en fait un
   argument : *« Connect tonight. First report arrives Monday at 7am. »* Le délai
   est transformé en rituel au lieu d'être caché.
2. **Ce qui est validé à la minute 1, c'est la connexion — pas la valeur.**
   GoodMorning chronomètre le branchement (90 secondes), Opteo chronomètre
   l'inscription (moins de 5 minutes). Les deux vendent la **facilité d'entrer**,
   puis annoncent quand la valeur arrive.
3. **Les conditions d'éligibilité sont écrites noir sur blanc**, avant l'essai :
   30 jours d'historique (Optmyzr), 10 créations sur 90 jours (Motion). Personne
   ne laisse un compte trop maigre découvrir tout seul qu'il n'aura rien. Cela
   confirme le constat hérité de la carte supprimée (« le plus proche publie son
   plancher et assume l'écran vide ») sur un échantillon différent.

---

## 5 · Le verdict : ce qui est libre, ce qui est une impasse

### Commoditisé — n'y mettre aucun euro de différenciation

- **Afficher les chiffres, tracer les courbes.** Gratuit et illimité dans Looker
  Studio, connecteurs Google inclus ([source](https://docs.cloud.google.com/looker/docs/studio/about-data-sources)).
  Le seul coût résiduel est le connecteur Meta (à partir de **39 €/mois** annuel
  chez Supermetrics).
- **Donner des recommandations d'optimisation publicitaire.** Google Ads et Meta
  le font gratuitement, dans l'interface où le clic s'applique
  ([Google](https://support.google.com/google-ads/answer/3448398),
  [Meta](https://www.facebookblueprint.com/student/path/253172-opportunity-score-course)).
  Un conseil du type « augmente ce budget », « exclue ce mot clé » est perdu
  d'avance : la régie le dit avant nous et l'applique en un clic.
- **Détecter une anomalie ou une tendance.** GA4 le fait automatiquement et le
  notifie ([source](https://support.google.com/analytics/answer/9443595)).
- **Étiqueter à la main ses campagnes.** Natif et gratuit dans Google Ads
  ([source](https://support.google.com/google-ads/answer/7486653)).
- **Afficher un niveau de confiance à côté d'un conseil.** Opteo trie déjà
  « by priority and statistical confidence »
  ([source](https://opteo.com/features/improvements)). C'est une bonne pratique
  d'honnêteté, pas un argument de vente.
- **Étiqueter automatiquement une création (format, angle, persona, accroche).**
  Motion le fait, en 4 familles, « no manual labeling required »
  ([source](https://help.motionapp.com/en/articles/12461770-getting-started-with-ai-tagging-in-motion)).
- **Envoyer un récapitulatif périodique par e-mail.** Databox le vend nu
  ([source](https://databox.com/product/scorecards)).

### Encore libre dans cet échantillon — les seuls axes qui portent

1. **L'arbitrage entre canaux, dans une seule réponse.** GoodMorning s'arrête à
   Meta ; Opteo et Optmyzr s'arrêtent à Google Ads. Aucun produit lu ne répond à
   « **cette semaine, mon effort va-t-il sur Meta, sur Google ou sur l'organique ?** ».
   C'est structurel, pas conjoncturel : chacun est né dans une régie. Une régie ne
   dira jamais d'aller dépenser ailleurs, et un outil mono-canal non plus.
   **C'est l'axe le plus solide, et c'est exactement ce que le « thème »
   transverse de Pulse permet de dire.**

2. **Le regroupement dans le vocabulaire du client, pas dans celui de la régie.**
   Google Ads regroupe des campagnes, Motion regroupe des créations, Funnel
   regroupe des noms. Personne ne regroupe une **offre** ou un **service**
   d'artisan ou de commerçant à travers une campagne Meta, une campagne Google et
   un post Instagram. Réserve honnête : cet axe repose sur un travail que
   l'utilisateur doit fournir, et la section 3 montre que **le marché considère ce
   travail comme un coût à supprimer, pas comme une valeur à vendre**. Il ne tient
   que si le classement est quasi gratuit pour l'utilisateur (proposé, pas
   demandé) et si le bénéfice apparaît immédiatement — la rétroactivité déjà
   vérifiée dans la carte est l'argument à jouer ici.

3. **L'organique et le payant dans le même verdict.** Metricool couvre
   l'organique mais ne conclut rien ; GoodMorning, Opteo, Madgicx, Optmyzr ne
   couvrent que le payant. Le croisement « ce post a marché, la campagne sur le
   même sujet aussi » n'est vendu par aucun produit lu.

4. **Le prix.** La réponse mono-canal se paie **159 à 499 $/mois** (GoodMorning,
   Opteo). Le simple regroupement de données se paie **39-49 €/mois**
   (Supermetrics). Un produit multi-canal qui répond en dessous de 159 $/mois
   occupe une case que personne, dans cet échantillon, n'occupe. Ce n'est pas une
   étude de marché — c'est ce que les grilles publiques affichent.

### Ce que ces produits enseignent sur la forme, à copier sans hésiter

- **Nommer le nombre de conseils et leur urgence.** GoodMorning : « Up to **5**
  urgency-ranked recommendations — **Act today, This week, Monitor**. Each with
  **what to do, why, expected impact**. » Trois rangs, cinq items maximum, trois
  colonnes obligatoires. C'est une grammaire, et elle est publique.
- **Assumer le délai en le ritualisant.** « Connect tonight. First report arrives
  Monday at 7am. »
- **Chronométrer le branchement, pas la valeur.** 90 secondes, moins de 5 minutes.
- **Publier ses conditions d'éligibilité avant l'essai** (30 jours d'historique,
  10 créations).

### La formulation à éviter au ticket 03

Toute promesse de la forme « **voyez toutes vos données au même endroit** » ou
« **recevez des recommandations pour améliorer vos campagnes** » est morte à
l'écrit : la première coûte 39 €/mois en connecteur, la seconde est gratuite
dans Google Ads et dans Meta Ads Manager. La promesse doit contenir **l'arbitrage
entre des choses que personne d'autre ne met dans la même phrase** — sinon elle
décrit une catégorie, pas un produit.

---

## Ce qui n'a pas pu être vérifié

À traiter comme des trous, pas comme des approximations.

1. **Prix de Looker Studio Pro.** La documentation Google renvoie à sa page
   marketing sans chiffre, et la page marketing n'a pas rendu de bloc tarifaire
   lisible. Aucun montant n'est avancé ici.
2. **Prix de Porter Metrics** (connecteur Meta → Looker Studio) : page tarifaire
   non lisible. Seul Supermetrics est cité, avec ses montants publics.
3. **Corps des pages Meta sur l'Opportunity Score** (barème 0-100, liste des
   types de recommandations) : pages rendues en JavaScript, non lues. Seul le
   descriptif du cours Blueprint est cité.
4. **Prix du plan principal de Madgicx** : l'éditeur ne le publie pas hors de
   l'application. Seuls le module « Tracking Pro » (49 $/mois) et l'offre
   d'accroche affichée en page d'accueil (« $29/mo forever ») sont sourcés.
5. **Montants d'Optmyzr** : la grille est structurée par paliers de dépense mais
   les prix n'apparaissent pas dans la page telle qu'elle a été lue.
6. **Triple Whale** : site inaccessible au lecteur (HTTP 403). Le produit n'est
   pas couvert par cette recherche.
7. **Pages Funnel (Conventions, Custom dimensions, Campaign dimensions)** : les
   URL sont bonnes mais seuls des extraits de recherche ont été obtenus, pas le
   texte complet. La description en §3.3 est à revérifier avant citation
   ailleurs.
8. **« AI Tagging inclus dans toutes les formules Motion »** : affirmation issue
   d'un extrait de la page de nouveautés de l'éditeur, corps non lu.
9. **Équivalent natif des libellés côté Meta Ads Manager.** Aucune source
   primaire n'a été trouvée établissant que Meta propose — ou ne propose pas —
   un objet équivalent aux libellés Google Ads. **On ne peut donc pas écrire que
   Meta n'a pas de libellés.** À vérifier dans la documentation Marketing API
   avant toute affirmation.
10. **« Personne ne fait l'arbitrage inter-canal »** : vrai **sur l'échantillon
    lu** (GoodMorning, Opteo, Optmyzr, Madgicx, Markifact, Databox, Motion,
    Metricool, Funnel, Supermetrics). Ce n'est pas une revue exhaustive du
    marché, et ça ne peut pas en être une. C'est un constat d'échantillon, à
    présenter comme tel.
11. **Aucune donnée d'usage, de rétention, de satisfaction ou de part de marché**
    n'a été cherchée ni citée : ces chiffres n'existent pas en source primaire.

## Toutes les sources, en un bloc

- https://docs.cloud.google.com/looker/docs/studio
- https://docs.cloud.google.com/looker/docs/studio/about-data-sources
- https://docs.cloud.google.com/looker/docs/studio/looker-studio-pro-subscription-overview
- https://support.google.com/google-ads/answer/3448398
- https://support.google.com/google-ads/answer/7486653
- https://support.google.com/analytics/answer/9443595
- https://www.facebookblueprint.com/student/path/253172-opportunity-score-course
- https://www.facebook.com/business/help/804913634782260 (existe, corps non lu)
- https://www.facebook.com/business/help/2086509315182746 (existe, corps non lu)
- https://supermetrics.com/pricing
- https://goodmorningco.com/ · https://goodmorningco.com/pricing · https://goodmorningco.com/how-it-works
- https://opteo.com/ · https://opteo.com/pricing · https://opteo.com/features/improvements
- https://madgicx.com/ · https://madgicx.com/pricing
- https://www.optmyzr.com/pricing/ · https://help.optmyzr.com/en/articles/3072987-general-faqs
- https://www.markifact.com/
- https://databox.com/pricing · https://databox.com/product/scorecards
- https://metricool.com/pricing/
- https://help.motionapp.com/en/articles/8022621-getting-started-with-custom-tagging-in-motion
- https://help.motionapp.com/en/articles/12461770-getting-started-with-ai-tagging-in-motion
- https://help.funnel.io/en/articles/11325592-conventions (corps non lu)
- https://help.funnel.io/en/articles/1622167-custom-dimensions-explained-the-basics (corps non lu)
- https://help.funnel.io/en/articles/1269137-campaign-dimensions-in-funnel (corps non lu)
