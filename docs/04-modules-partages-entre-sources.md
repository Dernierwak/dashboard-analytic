# Ce qui est partagé entre les sources, et ce qui ne l'est pas encore

Pulse lit aujourd'hui trois sources — Meta, Google Ads, Instagram — et en
ajoutera d'autres (TikTok, LinkedIn, Pinterest…). Ce document répond à une
question précise, posée par David : **si on change 1 élément d'une source, où
faut-il le changer, et à combien d'endroits ?** Pour chaque module utilisé par
les pages `app/meta`, `app/google`, `app/instagram`, `app/page.tsx` (accueil) et
`app/couts`, il dit s'il est GÉNÉRIQUE (un seul composant, piloté par une
donnée ou un prop), DUPLIQUÉ (plusieurs copies qui devraient être une seule), ou
SPÉCIFIQUE PAR NATURE (aucune raison de l'unifier).

Ce n'est pas une doc concurrente de `docs/03-grammaire-des-modules.md` : celle-là
dit COMMENT un module doit être composé (l'ordre des neuf rangs) ; celle-ci dit
QUELS modules existent et OÙ vit la variation entre sources. Les contraintes par
plateforme (fenêtres de récolte, ce qu'une API refuse de donner) restent dans
`docs/references/plateformes.md` — citées ici, jamais recopiées.

Ce document décrit l'état du code au 25 août 2026. Il ne construit rien de
nouveau et ne corrige aucun des écarts qu'il liste — voir la section « Frictions »,
à traiter comme des tâches séparées.

---

## 1 · Ce qui est déjà générique

### `buildDash` — le moteur de données des canaux publicitaires

`saas/web/lib/channels.ts:531`. Une seule fonction construit le `ChannelDash`
(hero, KPIs, courbe, campagnes, écart) pour **n'importe quelle régie
publicitaire** : elle ne connaît ni Meta ni Google, seulement deux formes
neutres.

- `RawAd[]` — une ligne = `{ date, campaign, adset, ad, spend, clicks,
  impressions, reach }`. `reach` vaut 0 pour une source qui n'a pas de portée
  (Google).
- `Cfg` — une `Map` clé de campagne → `{ name, label, labelSource, status }`,
  construite depuis la table de configuration de la campagne (thème posé,
  statut).

`getMetaDash` (`lib/channels.ts:789`) et `getGoogleDash` (`lib/channels.ts:832`)
ne font qu'une chose : lire leurs tables Supabase respectives, les mettre en
forme dans ces deux types, et appeler `buildDash`. Toute la logique de fenêtre,
de filtres, de comparaison (`batirComparaison`), de KPI et de drill-down vit une
seule fois.

**Pour brancher une nouvelle régie publicitaire (TikTok Ads, LinkedIn Ads…)** :
écrire un `getXxxDash()` qui produit un `RawAd[]` + un `Cfg` dans ce format, et
appeler `buildDash`. Aucune ligne de `buildDash` n'a besoin de changer.

### `AdsKpis`, `MetricChart`, `MoyennesAds`, `ByLabelTable`, `CampaignTable` — les blocs d'affichage

`saas/web/components/channel-dash.tsx`. Tous prennent `d: ChannelDash` — le
même type, quelle que soit la régie qui l'a produit — et s'affichent à
l'identique sur `app/meta/page.tsx` et `app/google/page.tsx` (les deux pages
sont, ligne pour ligne, la même composition : comparer `app/meta/page.tsx` et
`app/google/page.tsx` le montre directement). Trois d'entre eux
(`MetricChart`, `MoyennesAds`, `ByLabelTable`) ne prennent même **aucun** prop
de canal : rien à propos de Meta ou Google n'entre dans leur code, ils lisent
seulement les champs de `ChannelDash`.

Deux composants prennent un prop `channel?: "meta" | "google"` pour les
quelques mots ou colonnes qui diffèrent réellement :

- `AdsKpis` (`channel-dash.tsx:61`) — Google n'a pas de portée, la première
  tuile affiche son CPC à la place.
- `CampaignTable` (`channel-dash.tsx:1046`) — colonne « Portée » affichée ou
  non (`isMeta`), mot « adset » vs « groupe », et une largeur minimale de
  colonnes différente entre les deux jeux (`COLS`, `channel-dash.tsx:1108`).

**Pour une nouvelle régie** : ces deux endroits (et seulement ceux-là, dans ce
fichier) demandent une branche explicite si la nouvelle source a, comme Google,
une donnée que Meta a et qu'elle n'a pas (ou l'inverse). Voir la friction sur le
type `"meta" | "google"` plus bas : l'ajout d'une clé ne se fait pas au même
endroit pour tout le monde.

### `Moyennes` — le moteur d'agrégation par unité

`channel-dash.tsx:293`. Composant entièrement neutre : `unite` (le
dénominateur, « jour », « mois », « publication »…), `n`, `fenetre`,
`chiffres: ChiffreMoyen[]` (chacun avec sa nature `somme`/`taux` et sa fonction
de format). Il ne sait rien de la source qui l'appelle.

`MoyennesAds` (`channel-dash.tsx:479`) et `MoyennesInsta` (`channel-dash.tsx:565`)
sont deux enveloppes minces : chacune construit son propre tableau de
`ChiffreMoyen` à partir de sa forme de données (`DayPoint[]` côté pub,
`InstaPost[]` côté Instagram), puis rend `<Moyennes>`. C'est le patron exact à
suivre pour une nouvelle source : écrire `MoyennesXxx`, pas toucher `Moyennes`.

### `ecart.tsx` — la colonne d'écart entre deux périodes

`components/ecart.tsx`. `ouvrirEcart`, `EnteteEcart`, `CelluleEcart`,
`phraseEcart`, `trierParEcart` forment un moteur générique piloté par un
descripteur `MetriqueEcart` (`ecart.tsx:57` : titre, fonction de valeur,
format, `ramenerAuJour`, `baisseEstBonne`). `ByLabelTable` et `CampaignTable`
définissent `METRIQUES_ECART` pour la pub (`channel-dash.tsx:754`),
`ByLabelInsta` définit `METRIQUES_INSTA` pour Instagram
(`channel-dash.tsx:877`) — même moteur, deux dictionnaires. Une nouvelle source
écrit son propre dictionnaire de `MetriqueEcart`, rien d'autre.

### `SOURCE` / `CANAL` — l'identité visuelle d'une source

`components/etat-action.tsx:171`. La table canonique : glyphe, couleur,
`surSombre` (la teinte claire pour fond sombre), nom, pour chaque source qui
peut produire un chiffre dans Pulse (`meta`, `google`, `instagram`, `site` pour
GA4). `CANAL` (ligne 182) en est le sous-ensemble « peut porter un changement
de plateforme » (Meta, Google). C'est la doc en place, dans le code, qui dit
elle-même que cette convention « était recopiée dans quatre fichiers ; elle se
tient ici » — **c'est le point d'entrée pour ajouter le glyphe/la couleur d'une
nouvelle source**, à condition de ne pas laisser une cinquième copie ailleurs
(voir Frictions, §2).

### `ThemeDonut` — l'anneau de répartition

`components/theme-donut.tsx`. Prend `rows: { label, spend }[]` — n'importe
quelle donnée qui prend cette forme peut s'y brancher, quelle que soit sa
provenance. Utilisé tel quel sur le rapport hebdomadaire (par thème) et sur
`app/couts/page.tsx` (par thème ET par plateforme, avec le prop `teintes` qui
force les couleurs de canal sur le second anneau — voir `couts/page.tsx:79`,
`TEINTE_CANAL`). Une nouvelle source qui doit apparaître dans un anneau n'a
besoin de rien de plus qu'un objet `{label, spend}` et, si elle a une couleur
de convention, une entrée dans le `teintes` qu'on lui passe.

### Primitives sans aucune conscience de la source

`components/chiffre.tsx` (`Chiffre`), `components/pente.tsx` (`Pente`,
`Triangle`, `sensPente`), `components/line-chart.tsx` (`LineChart`,
`Sparkline`), `components/date-range.tsx` (`DateRange`),
`components/filter-bar.tsx` (`FilterBar`). Aucun de ces cinq fichiers ne
contient le mot « meta », « google » ou « instagram ». Ils sont pilotés
uniquement par les données qu'on leur passe (`FilterBar` reçoit ses options
`statusOptions`/`campOptions`/`labels` depuis `ChannelDash`, sans prop de
canal — Meta et Google les utilisent identiquement). C'est la preuve que la
variation entre sources n'a pas besoin de vivre dans le composant d'affichage :
elle peut toujours être poussée dans la donnée qu'on lui donne.

---

## 2 · Ce qui est dupliqué (frictions)

Ces endroits cassent la promesse « on change 1 élément, ça change partout » :
une quatrième source qui les traverse sans les toucher hérite d'un
comportement à corriger à N endroits au lieu d'un. **Rien ci-dessous n'est
corrigé dans cette tâche** — à journaliser séparément.

### Le type `channel: "meta" | "google"` (et ses variantes) n'a pas UNE source de vérité

Recherche du littéral exact `"meta" | "google"` dans `saas/web/` : il apparaît
tel quel, retapé, dans au moins ces quinze endroits — `app/actions.ts:819` et
`:936`, `app/comptes/actions.ts:129`, `components/frise-semaine.tsx:241`,
`components/campaign-label-select.tsx:17`, `components/channel-dash.tsx:61` et
`:1052`, `components/deconnecter-bouton.tsx:10`, `lib/changements-api.ts:34`,
`lib/couts.ts:311`, `lib/report.ts:245`, `lib/channels.ts:1292`,
`lib/budgets.ts:31` — plus une variante à trois valeurs
(`lib/report.ts:25` : `"instagram" | "meta" | "google" | "pub" | "ia"`).

Deux alias existent déjà et auraient pu servir de référence unique —
`Fournisseur` (`lib/oauth.ts:31`) et `CanalLabel`
(`components/labels-modele.tsx:15`) — mais la plupart des quinze sites
ci-dessus retapent le littéral au lieu de les importer. **Ajouter une
quatrième régie publicitaire veut dire retrouver et élargir chacun de ces
littéraux à la main** ; TypeScript empêchera d'en oublier un dans une fonction
déjà typée sur `"meta" | "google"`, mais rien n'empêche d'oublier un site qui
prend encore `string`.

### `CampaignLabelSelect` vs `PostLabelSelect` — même composant, deux fichiers

`components/campaign-label-select.tsx` et `components/post-label-select.tsx`
sont, ligne pour ligne, le même sélecteur (menu déroulant de thème + pastille
« IA » si `source === "ai"`) — ils ne diffèrent que par l'identifiant qu'ils
portent (`campaignKey`+`campaignName`+`channel` contre `postId`) et la server
action qu'ils appellent (`setCampaignLabel` contre `setPostLabel`). Une
troisième source à étiqueter (posts TikTok, par exemple) copierait
vraisemblablement l'un des deux plutôt que de factoriser un `LabelSelect`
générique piloté par une fonction `assign(id, label) => Promise<void>`.

### `PeriodPills` (partagé) vs `PeriodPillsInsta` (copie locale)

`PeriodPills` (`channel-dash.tsx:33`) est exporté et partagé par Meta et
Google. `app/instagram/page.tsx:38` définit `PeriodPillsInsta`, une fonction
locale non exportée qui rend exactement le même balisage (mêmes classes, même
structure de pastilles 7/14/30/90/Tout) pour construire ses propres liens via
`lienDash`. Deux implémentations de la même pastille de période.

### La table de glyphes/couleurs `SOURCE`/`CANAL` a au moins deux copies concurrentes

`components/labels-modele.tsx:62` (`GLYPHE`) est une redite assumée et
commentée de `SOURCE` — la raison est écrite dans le fichier : `labels-listes.tsx`
est un composant client, `etat-action.tsx` type-importe depuis `lib/report.ts`
qui dépend de `next/headers`, et le commentaire pose donc cette duplication
comme la seule qui soit voulue.

`components/frise-semaine.tsx:57` définit lui aussi sa propre table locale
(`const CANAL: Record<string, string> = { meta: "▣", google: "◆" }`), **sans
commentaire justificatif** — et sans que la même contrainte semble s'appliquer :
`components/rail-entree.tsx` est lui aussi un composant sans directive
(`"use client"` absente) qui importe directement `CANAL` depuis
`@/components/etat-action` (`rail-entree.tsx:2`) sans qu'aucune erreur ne soit
documentée. `frise-semaine.tsx`, lui, porte `"use client"` — mais
`etat-action.tsx` n'importe rien d'exécutable de `lib/report.ts` (seulement des
`import type`, effacés à la compilation), donc l'argument qui justifie la copie
de `labels-modele.tsx` ne semble pas s'appliquer ici de la même façon. À
vérifier avant de fusionner — c'est peut-être un oubli, peut-être une
contrainte réelle non écrite.

### `lib/couts.ts` et `app/couts/page.tsx` codent « Meta » et « Google » en dur, pas une liste de canaux

Les types `ParCanal` (`lib/couts.ts:102`, `{ meta: number; google: number }`),
`CoutDay` (`:96`) et `PointSerie` (`:99`) portent chacun deux champs nommés,
pas une carte `Record<string, number>`. La ventilation par plateforme
(`parCanalPeriode`, `parJourMois`, `parMoisCanal`…) additionne ligne à ligne
`if (l.canal === "meta") … else …` (`lib/couts.ts:347` et suivantes). Et
`app/couts/page.tsx:79` (`TEINTE_CANAL`) comme le tableau `rows` de l'anneau
« Dépensé par plateforme » (`couts/page.tsx:267`) écrivent littéralement
`"Meta"` et `"Google"`. Ajouter une troisième régie publicitaire au module
Coûts demande de toucher ces types, ces sommes et ce tableau — pas un prop à
faire varier, un vrai chantier dans plusieurs fichiers.

---

## 3 · Ce qui est spécifique par nature (à ne pas unifier)

- **`InstaDash` n'hérite pas de `ChannelDash`, et c'est juste.** Un post n'a ni
  dépense, ni statut, ni budget, ni hiérarchie campagne → adset → annonce.
  `getInstaDash` (`lib/channels.ts:971`) reconstruit son propre type parce que
  la donnée qu'il porte n'est pas la même famille d'objet — pas parce que
  personne n'a généralisé.
- **`FilterBar` n'est pas utilisé par Instagram.** Un post n'a ni statut
  (actif/en pause) ni campagne : la page Instagram filtre par période et trie
  par métrique (`PeriodPillsInsta`, le tri des colonnes), un besoin différent
  de « Statut / Campagne / Thème ». Ce n'est pas un oubli, la donnée ne porte
  pas ces axes.
- **`CourbeAbonnes` (`channel-dash.tsx:1390`) est propre à Instagram.** Aucune
  régie publicitaire de Pulse ne suit un stock cumulatif comparable à un
  nombre d'abonnés ; le composant porte d'ailleurs une particularité
  documentée dans son propre en-tête (`socle="bas"` : un cumul ne part pas de
  zéro comme un flux quotidien).
- **Les modules « Ce qui marche pour toi » (formats), « Quand publier ? »
  (heatmap jour × créneau) et « Top 3 posts » (`app/instagram/page.tsx`)**
  n'ont pas d'équivalent publicitaire : ils répondent à des questions qui
  n'existent que pour du contenu organique publié à une heure choisie, pas
  pour une campagne qui tourne en continu selon un budget.
- **Le ROAS confondu Meta/Google n'est pas une dette de code.** GA4 rend le
  revenu au niveau du compte, jamais par régie (`docs/references/plateformes.md`,
  section « Ce qui est impossible ») — un ROAS par canal serait une valeur
  inventée, pas un module mal généralisé.

---

## 4 · Gabarit — brancher une nouvelle source

### Cas A — une régie publicitaire (TikTok Ads, LinkedIn Ads, Pinterest Ads…)

Déjà prêts, à réutiliser sans y toucher :

- `buildDash` (`lib/channels.ts:531`) — écrire `getXxxDash()` qui produit
  `RawAd[]` + `Cfg` dans le format attendu (voir §1) et l'appelle.
- `MetricChart`, `MoyennesAds` (via une éventuelle enveloppe si la forme des
  chiffres diffère), `ByLabelTable`, `DateRange`, `FilterBar`, `ThemeDonut`,
  `Chiffre`, `Pente`, `LineChart` — aucun changement.
- `ecart.tsx` — définir son propre `METRIQUES_ECART` si les métriques
  diffèrent (ex. pas de CPM).

À étendre, endroit par endroit (voir §2 pour la liste précise) :

- élargir le littéral `"meta" | "google"` partout où il apparaît (ou, mieux,
  d'abord le regrouper en un seul type exporté — une tâche préalable, pas un
  prérequis technique bloquant) ;
- ajouter la source à `SOURCE`/`CANAL` (`components/etat-action.tsx`) — une
  fois la duplication de `frise-semaine.tsx` clarifiée, sinon l'ajouter aussi
  là-bas ;
- `AdsKpis` et `CampaignTable` (`channel-dash.tsx`) : ajouter la branche si la
  nouvelle source, comme Google avec la portée, n'a pas une donnée que Meta a
  (ou en a une que ni Meta ni Google n'ont) ;
- si la source doit apparaître dans le module Coûts : étendre les types de
  `lib/couts.ts` (§2) et `TEINTE_CANAL` / le tableau de l'anneau plateforme
  dans `app/couts/page.tsx` — un vrai chantier, pas une ligne ;
- créer `app/xxx/page.tsx` en suivant `app/meta/page.tsx` quasiment à
  l'identique (mêmes imports depuis `channel-dash.tsx`).

### Cas B — une source organique (posts TikTok, LinkedIn, Pinterest…)

Déjà prêts, à réutiliser :

- `Moyennes`, `ThemeDonut`, `LineChart`/`Sparkline`, `Pente`, `ecart.tsx` (avec
  son propre dictionnaire de métriques, sur le modèle de `METRIQUES_INSTA`).

À écrire, faute d'un type neutre existant :

- un `getXxxDash()` qui produit une forme comparable à `InstaDash` — il n'y a
  pas aujourd'hui d'`OrganicDash` générique, seulement le patron qu'`InstaDash`
  donne à suivre ;
- un sélecteur de thème pour ses éléments — **avant de copier une troisième
  fois `CampaignLabelSelect`/`PostLabelSelect`**, trancher si cette tâche est
  le bon moment pour les factoriser en un seul composant piloté par une
  fonction d'assignation, ou si la copie reste le choix assumé ;
- une entrée dans `SOURCE` (`components/etat-action.tsx`) pour son glyphe et
  sa couleur.

---

## Sources

Ce document a été construit par lecture directe du code au 25 août 2026 :
`saas/web/app/{meta,google,instagram,couts}/page.tsx`, `app/page.tsx`,
`components/channel-dash.tsx`, `components/ecart.tsx`,
`components/etat-action.tsx`, `components/theme-donut.tsx`,
`components/chiffre.tsx`, `components/campaign-label-select.tsx`,
`components/post-label-select.tsx`, `components/frise-semaine.tsx`,
`components/labels-modele.tsx`, `components/date-range.tsx`,
`components/filter-bar.tsx`, `lib/channels.ts`, `lib/couts.ts`, `lib/oauth.ts`,
et une recherche exhaustive du littéral `"meta" | "google"` dans `saas/web/`.
