# Comment le marché présente un compte Google Ads à plusieurs types

Ticket : `.scratch/google-ads/issues/02-comment-le-marche-presente-google-ads.md`.
Lectures faites le **2026-11-08** (sauf mention « 11-09 »). Les pages ont été
lues par un outil de lecture web : les citations sont des extraits courts tirés
de la page. **Aucun outil n'a été ouvert connecté** — ce qui suit décrit ce que
les pages publiques disent, pas les écrans réels. Ce qu'une page ne dit pas est
écrit « non visible ».

On reste sur la **structure** : quels blocs, dans quel ordre, quel axe de
découpage. Rien ici ne conseille le client final.

---

## 1 · Google Ads lui-même

### Vue d'ensemble (Overview)

Source : [About the Overview page](https://support.google.com/google-ads/answer/7321090?hl=en) (lu 2026-11-08).

- Une Vue d'ensemble existe **à trois niveaux** : compte, campagne, groupe
  d'annonces. Elle est faite de **cartes** : « Performance summary » (niveau
  compte, résumé 7 jours vs 7 jours précédents, généré par IA), cartes
  « Summary » (dont une courbe), cartes « Insight » (qui « aren't related to the
  date range you selected »), carte App Connect.
- **Pas de carte par type de campagne** pour PMax. Des cartes propres à la
  vidéo existent (Top videos, Placements, Topics…) mais la page ne dit pas
  qu'elles forment un bloc YouTube séparé.
- **Le seul découpage transversal qu'elle propose n'est pas le type de
  campagne mais l'étape du parcours** : la carte « Cross-campaign impact » et la
  carte « Performance by stage » regroupent les campagnes en **Awareness /
  Consideration / Action**, « based on their bidding strategy and not marketing
  objective ». Chaque étape a **ses propres métriques** : Awareness →
  impressions, CPM, portée ; Consideration → vues, search lift ; Action →
  conversions, CPA (« only biddable conversions are included »).
  Conséquence : une même campagne Search peut tomber en Consideration ou en
  Action selon son enchère.

### Tableau des campagnes : sélecteur de type, colonnes

Sources : [View performance across campaign types](https://support.google.com/google-ads/answer/6162977?hl=en),
[Account, campaign, and ad group performance](https://support.google.com/google-ads/answer/2404036?hl=en) (lus 2026-11-08).

- **Sélecteur de type de campagne** dans la barre « Views » : « select the
  campaign type you want to view in your reports ». Seuls les types présents
  dans le compte sont proposés. La vue par défaut est « All campaigns », avec
  les totaux en bas du tableau.
- **Les colonnes suivent le type** : « Google Ads remembers your selections
  based on your campaign context » — exemple donné : la colonne CPM moy. sur les
  campagnes Display. Les colonnes par défaut de chaque type : **non visibles**
  dans l'aide.
- **Colonnes transversales** pour lire plusieurs types ensemble :
  *Interactions*, *Interaction rate*, *Average cost*. « The "Interactions"
  column counts different user actions depending on ad format » : clics pour
  texte/image, **vues** pour la vidéo TrueView, engagements pour d'autres.
  L'aide **ne dit pas** comment se lit leur total quand on mêle les types :
  dans la vue « All campaigns », une ligne de total additionne donc des clics
  Search et des vues YouTube sous un même nom de colonne. C'est la seule
  agrégation hétérogène documentée trouvée — et elle est **nommée** (« la
  principale action de chaque format »), pas cachée.

### Ce que Google fait d'une métrique qui ne s'additionne pas

- **Conversions** : [Understand your conversion tracking data](https://support.google.com/google-ads/answer/6270625?hl=en),
  section « Dashes in conversion data » (lu 2026-11-08) : « You may notice a
  dash ("-") instead of a numeric value for conversion totals or daily
  values » — dans les graphiques compte et les résumés de campagnes, quand la
  vue agrège des types qui mesurent les conversions autrement. **Google préfère
  un tiret à un total faux.** La page ne nomme pas les types concernés.
- **Segments** : [Account, campaign… performance](https://support.google.com/google-ads/answer/2404036?hl=en)
  et [Fix missing data](https://support.google.com/google-ads/answer/2404039?hl=en) :
  avec le segment « Click type », l'export affiche « -- » au lieu des totaux,
  « a sum total would be inaccurate because it would double-count ».
- **Formats** : [Analyze your performance by ad format](https://support.google.com/google-ads/answer/16923669?hl=en)
  (lu 2026-11-08) : le segment « Ad format » ne rend des lignes que pour Vidéo,
  Demand Gen et Search — les autres types sont « excluded from the results ».
  Le taux de vue global (VTR) « will no longer be shown », remplacé par des taux
  par format (In-stream, In-feed, Shorts). Viewable Rate s'affiche « -- » hors
  segmentation.
- Pour une colonne simplement inapplicable (ex. vues sur une campagne Search) :
  tiret, vide ou zéro — **non visible** dans l'aide.

### YouTube dans Google Ads

Sources : [About YouTube ads and view metrics](https://support.google.com/google-ads/answer/2375431?hl=en),
[Measure video performance with video analytics](https://support.google.com/google-ads/answer/6086441?hl=en) (lus 2026-11-08).

- YouTube n'a **pas d'espace séparé** pour lire les campagnes : ce sont des
  campagnes de type Vidéo dans le même tableau, filtrables par le sélecteur.
  Il existe en plus une page **Assets › Videos › Analytics** centrée sur la
  vidéo (l'objet), pas sur la campagne.
- Vocabulaire propre : *TrueView views* (ex-« Views »), *TrueView view rate*
  = vues / impressions, déclinés par format ; quartiles « Video played to » ;
  *YouTube public views* (non facturées). Bumper et in-stream non désactivable
  **ne produisent pas** de TrueView views.
- Une **impression** n'a pas la même définition selon le format (in-feed :
  vignette vue ; in-stream : annonce affichée).

### PMax : le rapport de performance par canal

Source : [About the channel performance report](https://support.google.com/google-ads/answer/16260130?hl=en) (lu 2026-11-08).

- Pour PMax, Google découpe **à l'intérieur** de la campagne par **canal** :
  Google Search, Display Network, **YouTube**, Discover, Maps, Gmail, Search
  partners.
- Ordre des blocs : résumé de la campagne (ROAS/CPA réel, cible, interactions,
  conversions, valeur, coût) → graphique « Channels-to-Goals » (filtres canal,
  format, conversions/résultats) → courbe temporelle **un canal à la fois** →
  tableau de distribution par canal (avec un **statut** par canal : « Not
  eligible », « Eligible (Limited) »…).
- Ce que la page ne dit pas : si les lignes canal s'additionnent en total, et
  comment s'affiche une métrique absente d'un canal.

---

## 2 · Looker Studio — gabarits officiels Google

- La galerie ([lookerstudio.google.com/gallery](https://datastudio.google.com/gallery?category=marketing),
  lu 2026-11-08) se charge en JavaScript : **aucun gabarit Google Ads
  lisible**, ni son auteur, ni ses pages. **Non visible.**
- Aucune recherche n'a fait remonter un gabarit Google Ads **signé Google** :
  tous les résultats sont de tiers (Supermetrics, Windsor.ai, Porter, Databloo,
  Two Minute Reports). Databloo affirme avoir été « featured by Google » — non
  vérifié.
- La doc du connecteur ([Connect to Google Ads](https://docs.cloud.google.com/looker/docs/studio/connect-to-google-ads), lu 2026-11-09)
  ne mentionne **aucun rapport modèle** ni la dimension type de campagne. Elle
  dit qu'une combinaison dimension × métrique invalide fait apparaître un
  **message d'avertissement** dans le graphique (pas un zéro).

---

## 3 · AgencyAnalytics

Sources : [Google Ads integration](https://agencyanalytics.com/integrations/google-ads),
[How to filter data](https://help.agencyanalytics.com/en/articles/4627988-how-to-filter-data-on-dashboards-and-reports),
[YouTube report template](https://agencyanalytics.com/report-templates/youtube),
[Google Ads client report (blog)](https://agencyanalytics.com/blog/google-ads-client-report) (lus 2026-11-08).

- Le tableau de bord Google Ads est **un seul bloc** : « Google Search,
  Display, YouTube, Performance Max, and other PPC campaigns » sont présentés
  ensemble. **Pas de section par type** décrite.
- Le **type de campagne est un filtre**, posé sur un widget ou sur tout le
  tableau de bord : « Google Ads has separate filters, such as Network and
  Campaign Type ».
- L'explorateur de métriques range les champs par **objet** (Ad, Keyword,
  **Video** (45), Asset Group, Shopping…), pas par type de campagne.
- Le gabarit **YouTube** est un rapport à part qui **mêle organique (chaîne)
  et payant (Google Ads)** : abonnés, vues, durée moyenne, engagement, puis
  impressions, coût publicitaire, conversions, clics. La page ne dit pas si les
  impressions sont celles de la chaîne, des annonces, ou leur somme — **non
  visible**.
- Le billet de blog recommande une synthèse « performance by campaign type »,
  sans décrire la forme.

## 4 · Whatagraph

Sources : [Google Ads reporting tool](https://whatagraph.com/google-ads-reporting-tool),
[PPC reporting examples](https://whatagraph.com/blog/articles/ppc-reporting-examples) (lus 2026-11-08).

- Gabarit Google Ads en **8 sections, dans cet ordre** : chiffres clés
  (conversions, taux, coût/conv., coût — puis impressions, clics, CTR, CPC plus
  petits) → composition des conversions par action → performance **par
  campagne** → audiences → mots-clés/termes → **visibilité PMax** → chiffres
  clés par semaine → synthèse rédigée.
- Le **seul découpage par type** est la section PMax, **conditionnelle** :
  « This section only appears when Performance Max campaigns are active ».
  Elle découpe PMax par **canal** (Search, Display, YouTube…) chaque mois, puis
  par groupe d'éléments.
- **YouTube n'a pas de section** : il n'apparaît que comme un canal de PMax.
  Les gabarits YouTube de Whatagraph sont organiques (chaîne).
- Additions d'impressions entre réseaux : **non dit**. Les chiffres clés du
  haut sont des totaux tous types confondus, sans mention de leur composition.

## 5 · Swydo

Sources : [Google Ads reporting](https://www.swydo.com/integrations/google-ads-reporting/),
[YouTube Ads report template](https://www.swydo.com/report-template/youtube-ads-report/) (lus 2026-11-08).

- **Un gabarit par type, pas une page à onglets** : « Google Ads Report »,
  « **Google Display Ads Report** », « **YouTube Ads Report** », « Google
  Shopping Ads Report », « PPC Report ».
- Pour isoler YouTube : filtrer un widget par « Advertising Channel Type =
  Video », ou construire une **section YouTube dédiée** (view rate, watch time,
  quartiles, CPV). PMax : un widget « PMax-only » (dépense, conversions, CPA
  par groupe d'éléments).
- Le gabarit YouTube Ads, dans l'ordre : synthèse (CPA, ROAS, taux de
  complétion, coût par vue) → analyse vidéo (complétion, view rate, **formats**
  bumper vs long) → attribution (conversions après visionnage) → audiences →
  coûts → métriques composées → recommandations. **Son axe interne est le
  format d'annonce**, pas le type de campagne.
- Métriques absentes d'un type : **non visible**.

## 6 · DashThis

Sources : [Google Ads campaign types and Performance Max reporting](https://help.dashthis.com/google-ads-campaign-types-and-performance-max),
[Google Ads report template](https://dashthis.com/adwords-report-template/),
[Google Ads dashboard](https://dashthis.com/google-ads-dashboards-for-agencies/) (lus 2026-11-08).

- Le gabarit Google Ads : Coût → Clics → Performance des annonces (par
  campagne, groupe, annonce, mot-clé) → Conversions. **Aucun découpage par
  type**, aucun widget vidéo. (La page cite encore « average position »,
  métrique retirée par Google : page probablement ancienne.)
- L'aide pose **deux gestes distincts** : **filtrer** (« add a Campaign
  Advertising Channel filter » pour un seul type) ou **comparer** (« break your
  widget down by the Campaign Type dimension »).
- Le canal Vidéo couvre les campagnes Vidéo autonomes, « not the video assets
  running inside a Performance Max campaign » — DashThis ne rapporte pas les
  vidéos de PMax à part.
- Métriques absentes : l'aide les traite **au cas par cas, par refus** —
  « Google does not return age or gender demographics for Performance Max » ;
  certaines dimensions « returns an error ». Elle note aussi que la somme des
  termes de recherche peut être **inférieure** au total campagne (Google masque
  les faibles volumes).
- YouTube : un gabarit séparé (orienté chaîne).

## 7 · Supermetrics

Sources : [Looker Studio Google Ads template](https://supermetrics.com/template-gallery/looker-studio-google-ads),
[Google Ads overview report](https://supermetrics.com/blog/google-ads-overview-report),
[Template gallery](https://supermetrics.com/template-gallery) (lus 2026-11-08).

- Le gabarit Google Ads est organisé en **questions**, dans cet ordre :
  clics et impressions → conversions → coûts → campagnes → clics par appareil
  et pays. Que ce soient des pages : **non confirmé**. Aucun découpage par
  type, aucune page vidéo **visibles**.
- Pas de gabarit « campagnes vidéo Google Ads » trouvé ; le gabarit YouTube de
  la galerie suit la **chaîne** (vues, abonnés, vidéos), organique et payant.

---

## Tableau — axe de découpage × outil

| Axe | Google Ads | Looker (officiel) | AgencyAnalytics | Whatagraph | Swydo | DashThis | Supermetrics |
|---|---|---|---|---|---|---|---|
| Vue générale tous types | Oui (« All campaigns », totaux) | non visible | Oui (bloc unique) | Oui (chiffres clés) | Oui (Google Ads Report) | Oui | Oui |
| Type de campagne comme **filtre** | Oui (barre Views) | non visible | Oui (widget ou tableau) | non visible | Oui (Advertising Channel Type) | Oui | non visible |
| Type de campagne comme **comparaison** côte à côte | Non documenté hors colonne « type » | non visible | non visible | Non | non visible | Oui (dimension Campaign Type) | non visible |
| Section / gabarit **par type** | Non (colonnes qui suivent le type) | non visible | Non | **PMax seul**, conditionnel | **Oui** : Display, YouTube, Shopping | Non | Non |
| YouTube **à part** | Non (page Videos = objet vidéo) | non visible | Gabarit YouTube orga + payant | Non (canal de PMax) | **Oui** (gabarit YouTube Ads) | Gabarit chaîne | Gabarit chaîne |
| PMax découpé **par canal** | Oui (rapport canaux) | non visible | non visible | Oui | non visible | Par placement | non visible |
| Étape de parcours (Awareness/Consideration/Action) | **Oui** (cartes Overview) | — | — | — | — | — | — |
| Par campagne | Oui | non visible | Oui | Oui | Oui | Oui | Oui |
| Par format d'annonce | Oui (segment) | — | — | — | Oui (dans YouTube) | — | — |

---

## Ce qui revient partout

1. **Une vue générale d'abord, tous types confondus**, avec les métriques
   communes (impressions, clics, coût, conversions). Aucun outil tiers ne
   commence par le type.
2. **Le type de campagne est un filtre, rarement une structure.** Chez Google,
   AgencyAnalytics, Swydo et DashThis, on choisit un type ; on ne voit pas les
   quatre types posés côte à côte par défaut.
3. **Le découpage le plus fin, par campagne, est universel** — c'est le bloc
   tableau de tous les gabarits.
4. **PMax, quand il est traité à part, l'est par canal** (Search / Display /
   YouTube…) — Google lui-même et Whatagraph. Le canal YouTube *dans PMax* et
   une campagne *Vidéo* sont deux choses distinctes (DashThis l'écrit).
5. **YouTube payant n'a pas d'onglet dans le tableau Google Ads** des outils ;
   quand il est isolé, c'est par un **gabarit séparé** (Swydo), et souvent ce
   gabarit « YouTube » mêle la chaîne organique et les annonces.

## Ce que personne ne fait (dans ce qui est visible)

- **Personne ne documente ce qui s'affiche pour une métrique inapplicable à un
  type** (vues sur Search, CPV sur Display) — tiret, vide ou zéro. Seul Google
  documente un **tiret** pour des **conversions non additionnables** et des
  totaux qui doubleraient. DashThis traite l'absence par erreur de widget.
- **Personne ne dit que les impressions du haut additionnent YouTube et
  Search.** Les chiffres clés de Whatagraph, DashThis, Supermetrics,
  AgencyAnalytics sont des totaux sans mention de composition. Google, lui,
  somme sous la colonne « Interactions » des clics et des vues — mais
  l'**annonce** (la colonne est définie comme « l'action principale de chaque
  format »). Que les impressions YouTube et Search aient des définitions
  différentes (in-feed : vignette vue) n'est rappelé **nulle part** dans une
  vue générale.
- **Personne ne pose les types en comparaison permanente** (Search vs PMax vs
  Display vs YouTube sur la même grille avec leurs métriques propres). DashThis
  le permet, ne le fait pas par défaut.
- **Aucun gabarit ne suit le découpage par étape de Google**
  (Awareness/Consideration/Action) ; il reste propre à l'Overview Google.

## Ce que ça implique pour la structure de la page `/google`

Constats, pas décisions — les décisions sont au ticket 04 (axe) et 05 (ce qui
s'additionne).

- Le schéma « vue générale → vue dédiée → table » de David correspond à ce que
  fait le marché pour la vue générale et la table ; la **vue dédiée par type**
  n'a pas de modèle établi hors de Swydo (gabarits séparés) et de PMax (par
  canal). Un Sélecteur de vue indexé sur le type serait **plus explicite** que
  ce que font les outils, qui se contentent d'un filtre.
- Une vue générale qui additionne les impressions de tous les types reproduit
  ce que fait tout le marché **sans l'écrire** ; le seul précédent d'honnêteté
  est le **tiret de Google** sur les conversions non additionnables.
- Si YouTube a sa propre page, aucun outil de référence ne trace la frontière
  entre campagnes Vidéo et canal YouTube de PMax à la place de Pulse : il
  faudra la trancher (DashThis exclut les vidéos de PMax de son canal Vidéo).
