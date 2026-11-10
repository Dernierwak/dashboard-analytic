# Carte — La page Google Ads

Label : `wayfinder:map`

## Destination

Une **spec de la page `/google`**, prête à remettre à la construction, sur le
modèle des specs Meta Ads (`.scratch/meta-ads/spec.md`) et Instagram : ce
qu'elle montre, dans quel ordre, sous quelle forme, pour **Search, PMax,
Display et YouTube** ; ce que la récolte doit aller chercher en plus et ce que
le traitement doit calculer. Elle tranche aussi **si YouTube a sa propre
page** — si oui, la spec couvre les deux.

## Notes

- **Ce que David veut, dans ses mots (2026-11-08)** : « une structure idéale »,
  qui **ressemble à Meta Ads** mais avec les types de Google — PMax, Search,
  Display, YouTube ; **« voir si YouTube doit avoir un dashboard dédié »**,
  parce que YouTube est très différent ; comprendre la structure **« entre vue
  générale, vue dédiée et la comparaison, et finir avec la table »**.
- **Tranché au cadrage (2026-11-08)** :
  - le livrable est la spec ; wayfinder d'abord, les tickets de construction
    ensuite (`tickets/`, jamais `issues/`) ;
  - **récolter plus est dans le périmètre** : chaque nouvelle métrique passe
    par une recherche dans la doc de l'API, puis par un essai réel ;
  - les types couverts sont Search, PMax, Display, YouTube. Les autres
    (Shopping, Demand Gen, App…) : **regroupés** si leurs données restent
    lisibles ensemble, sinon **reportés au `BACKLOG.md`** pour ne pas bloquer
    ce chantier — jamais cachés du total (§7).
- **Le socle est fixé** : ADR 0011 — mêmes modules, même nom, même rôle, même
  place que Meta (Bandeau de commandes, Sélecteur de vue, Tendance,
  Comparaison, Tableau détaillé, Panneau latéral), code propre à Google. Un
  écart se justifie dans un ticket, comme Instagram l'a fait pour son
  Sélecteur. ADR 0010 : la page n'affiche que ce que **Google** déclare —
  aucune conversion empruntée à GA4.
- **Ce que la spec Meta a déjà prévu pour Google** (`.scratch/meta-ads/spec.md`,
  § « Ce que Google Ads met dans chaque module ») : deuxième niveau = groupe
  d'annonces ; `cost_micros` ; conversions en nombre, **taux Google à vérifier
  avant de choisir un dénominateur** ; `change_event` limité à 30 jours ;
  contenu d'annonce via `ad_group_ad`. Elle supposait **« les trois vues »
  inchangées** — c'est précisément ce que la carte remet en question.
- **Faits relevés au cadrage** (code de `main`, `a909601`) :
  - `google_ads_insights` : par campagne et par jour, `impressions, clicks,
    conversions, cost_micros, ctr, avg_cpc_micros` — **aucun type de
    campagne**, aucune valeur de conversion, aucune vue vidéo, aucune portée ;
  - `google_ads_ad_insights` : campagne › groupe › annonce — **PMax n'y entre
    pas**, il n'a ni groupe d'annonces ni annonce, mais des groupes d'éléments ;
  - les **mots-clés** ne sont pas récoltés (reporté le 2026-09-08 : « le rang 5
    de Google », `BACKLOG.md`) ;
  - `change_event` est déjà récolté (`sources/google/ads/fetchers/changes.py`) ;
  - la page actuelle `saas/web/app/google/page.tsx` est l'ancienne
    structure — KPIs, moyennes, graphe, table — **sans** Sélecteur de vue,
    Tendance, Comparaison ni Panneau latéral.
- **Vocabulaire proposé, à trancher au ticket de l'axe** : **Type de
  campagne** (Search, PMax, Display, Vidéo/YouTube — le
  `advertising_channel_type` de Google). _À éviter_ : « format » — sur
  Instagram il désigne Reel / Carrousel, et chez Google il désigne le format
  d'annonce (responsive, in-stream, bumper…) ; « canal » — il désigne déjà une
  plateforme dans Pulse.
- **Pulse ne conseille rien** (`CLAUDE.md` §1). **§7 partout** : aucun chiffre
  fabriqué, une absence n'est pas un zéro, le jour en cours est exclu ; une
  métrique qui n'existe pas pour un type s'écrit « — » avec sa raison, jamais 0.
- **Grilling : trois questions au plus par série** (David, 2026-10-31).
- Skills : `grilling` + `domain-modeling` pour les grillings, `prototype` pour
  les maquettes, `research` pour les recherches ; agents `vision-ux` (ordre et
  forme) et `vision-produit` (ce qui mérite d'exister).

## Tickets

Format : un fichier par ticket sous `issues/`, en-tête `Type / Status /
Blocked by / Assignee`. Le frontier = `Status: open`, rien d'ouvert dans
`Blocked by`, pas d'`Assignee`.

**Frontier (2026-11-10)** : [YouTube : une page à part ou une vue de la page Google](issues/07-youtube-page-a-part.md)
— le prochain par numéro —,
[La Comparaison sur Google](issues/08-la-comparaison.md),
[Le Tableau détaillé selon le type de campagne](issues/09-le-tableau-detaille.md),
[L'essai réel des métriques Google](issues/10-l-essai-reel.md),
[La page Google en maquette](issues/11-la-page-google-en-maquette.md) — à prendre
tôt, David veut un prototype vite.

| Ticket | Type | Bloqué par |
|---|---|---|
| [Ce que l'API Google Ads donne, type de campagne par type](issues/01-ce-que-l-api-donne-par-type.md) | research ✓ | — |
| [Comment le marché présente un compte Google Ads à plusieurs types](issues/02-comment-le-marche-presente-google-ads.md) | research ✓ | — |
| [Les types de campagnes des comptes réels](issues/03-les-types-des-comptes-reels.md) | task ✓ | — |
| [L'axe de la vue dédiée](issues/04-l-axe-de-la-vue-dediee.md) | grilling ✓ | 01, 02 |
| [Ce qui s'additionne dans la vue générale](issues/05-ce-qui-s-additionne.md) | grilling ✓ | 01 |
| [Regrouper, garder ou reporter les types secondaires](issues/06-les-types-secondaires.md) | grilling ✓ | 01, 03 |
| [YouTube : une page à part ou une vue de la page Google](issues/07-youtube-page-a-part.md) | grilling | 01, 04 |
| [La Comparaison sur Google](issues/08-la-comparaison.md) | grilling | 04, 06 |
| [Le Tableau détaillé selon le type de campagne](issues/09-le-tableau-detaille.md) | grilling | 01, 04 |
| [L'essai réel des métriques Google](issues/10-l-essai-reel.md) | task | 01, 03 |
| [La page Google en maquette](issues/11-la-page-google-en-maquette.md) | prototype | — |

## Decisions so far

<!-- une ligne par ticket clos : [titre](lien) : l'essentiel de la réponse -->

- [Comment le marché présente un compte Google Ads à plusieurs types](issues/02-comment-le-marche-presente-google-ads.md) :
  vue générale tous types puis tableau par campagne ; le type est un filtre,
  jamais une structure ; Google découpe sa Vue d'ensemble par **étape**
  (Awareness / Consideration / Action, ≈ les vues de Meta) ; PMax isolé se lit
  par canal ; YouTube payant n'a d'onglet nulle part sauf chez Swydo ; seul
  Google affiche un tiret pour un total non additionnable.
- [Ce que l'API Google Ads donne, type de campagne par type](issues/01-ce-que-l-api-donne-par-type.md) :
  l'API contrôle par ressource, pas par type (une métrique hors type n'est pas
  rejetée → « ? » à l'essai) ; socle commun = impressions, clics, coût,
  conversions et valeur ; vidéo = vues TrueView, quartiles, CPV (v26) ;
  portée non additionnable, 92 j ; PMax absent de `ad_group_ad` sans erreur,
  lisible par groupe d'éléments et par réseau ; Demand Gen est un type à part.

- [Les types de campagnes des comptes réels](issues/03-les-types-des-comptes-reels.md) :
  2 comptes annonceurs (un seul utilisateur) ; sur 90 jours, **Search et PMax
  = 100 % de la dépense** (A : 69 / 31 %, B : 15 / 85 %) ; Display, Vidéo
  (`VIDEO_ACTION`) et Demand Gen existent mais n'ont rien diffusé ; aucun
  Shopping, App ni Smart. Échantillon mince, relevé à refaire.

- [L'axe de la vue dédiée](issues/04-l-axe-de-la-vue-dediee.md) :
  le Sélecteur garde l'étape (Notoriété / Trafic / Conversion, comme Meta,
  aucun écart à l'ADR 0011) ; le **Type de campagne** est un filtre du Bandeau
  (« Tous les types » par défaut) qui resserre les courbes sans changer les
  métriques des cartes ; une **moustache** par type sous chaque carte garde la
  vision de tous (à éprouver au prototype) ; « vue générale / dédiée » sont des
  états du filtre, pas des modules. Terme écrit dans `CONTEXT.md`.
- [Ce qui s'additionne dans la vue générale](issues/05-ce-qui-s-additionne.md) :
  « on prend ce que Google Ads montre » — tout ce qui se compte est totalisé
  tous types confondus, la moustache fait la différence ; la portée ne se
  totalise pas ; les taux (CTR, CPC, CPM, coût par conversion, ROAS) sont
  calculés sur les totaux, recalculés à chaque filtre ; conversions =
  `metrics.conversions` sans dédoublonnage maison, les trois colonnes
  récoltées, une seule affichée (le choix au `BACKLOG.md`) ; valeur et ROAS
  en vue Conversion, « — » sans valeur déclarée.

- [Regrouper, garder ou reporter les types secondaires](issues/06-les-types-secondaires.md) :
  tout type hors Search / PMax / Display / Vidéo va sous **Autres types**
  (une entrée du filtre, jamais hors des totaux, vrai type au Tableau),
  Demand Gen compris ; les spécialités appartiennent aux quatre types nommés,
  celles des autres vont au `BACKLOG.md` — à détailler un jour au même
  niveau ; l'analyse par type part dans la Comparaison (08), réécrite sur le
  modèle Instagram.

## Not yet specified

- **Le Panneau latéral sur Google** : l'aperçu d'une annonce Search
  (titres/descriptions d'une RSA), Display (images), YouTube (la vidéo) et
  PMax (des éléments, pas une annonce) ; les changements du jour depuis
  `change_event`, limités à 30 jours. Dépend de ce que l'API rend (01) et des
  niveaux retenus (09).
- **Les mots-clés et les termes de recherche** : récoltés pour la vue Search
  seulement, ou au Tableau ; volume de lignes (PostgREST plafonne à 1 000).
  Probablement absorbé par le Tableau détaillé (09).
- **Le délai de stabilisation des conversions Google** : aucun documenté
  (ticket 01) ; ce qu'il fait à la Tendance et à la Comparaison des derniers
  jours — le reste des conversions est tranché (05), sa vérification va au 10.
- **Ce que la récolte et le traitement doivent calculer** — migration de
  `google_ads_insights`, nouvelles tables (groupes d'éléments, vidéos,
  mots-clés), reprise de l'historique.
- **La spec de la page Google Ads** — la destination, une fois tout le reste
  tranché.

## Out of scope

- **La section Google du rapport hebdo.** Le rapport se refait ailleurs
  (`CLAUDE.md` §1).
- **Toute jointure GA4** pour compléter les conversions ou le revenu — ADR 0010.
- **Brancher TikTok** ou une autre plateforme — `BACKLOG.md`.
- **Thèmes, labels, recommandations** — retirés du produit, ne reviennent pas
  par la bande.
