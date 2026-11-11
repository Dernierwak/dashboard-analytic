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

**Frontier (2026-11-11)** :
[L'Analyse Search en maquette](issues/20-l-analyse-search-en-maquette.md),
[Améliorer la Comparaison](issues/16-ameliorer-la-comparaison.md) — « plus
tard » selon David.

| Ticket | Type | Bloqué par |
|---|---|---|
| [Ce que l'API Google Ads donne, type de campagne par type](issues/01-ce-que-l-api-donne-par-type.md) | research ✓ | — |
| [Comment le marché présente un compte Google Ads à plusieurs types](issues/02-comment-le-marche-presente-google-ads.md) | research ✓ | — |
| [Les types de campagnes des comptes réels](issues/03-les-types-des-comptes-reels.md) | task ✓ | — |
| [L'axe de la vue dédiée](issues/04-l-axe-de-la-vue-dediee.md) | grilling ✓ | 01, 02 |
| [Ce qui s'additionne dans la vue générale](issues/05-ce-qui-s-additionne.md) | grilling ✓ | 01 |
| [Regrouper, garder ou reporter les types secondaires](issues/06-les-types-secondaires.md) | grilling ✓ | 01, 03 |
| [YouTube : une page à part ou une vue de la page Google](issues/07-youtube-page-a-part.md) | grilling ✓ | 01, 04 |
| [La Comparaison sur Google](issues/08-la-comparaison.md) | grilling ✓ | 04, 06 |
| [Le Tableau détaillé selon le type de campagne](issues/09-le-tableau-detaille.md) | grilling ✓ | 01, 04 |
| [L'essai réel des métriques Google](issues/10-l-essai-reel.md) | task ✓ | 01, 03 |
| [La page Google en maquette](issues/11-la-page-google-en-maquette.md) | prototype ✓ | — |
| [Le Panneau latéral sur Google](issues/12-le-panneau-lateral.md) | grilling ✓ | — |
| [Ce que l'interface Google Ads affiche, face à l'essai](issues/13-l-interface-face-a-l-essai.md) | task ✓ | — |
| [Demand Gen, cinquième type nommé ?](issues/14-demand-gen-nomme.md) | grilling ✓ | 15 (levé) |
| [Ce qu'on montre pour chaque type de campagne](issues/15-ce-qu-on-montre-par-type.md) | grilling ✓ | 11 |
| [Améliorer la Comparaison](issues/16-ameliorer-la-comparaison.md) | grilling | — |
| [Les mots-clés et les termes de recherche dans l'API Google Ads](issues/17-mots-cles-et-termes-dans-l-api.md) | research ✓ | — |
| [L'Analyse Search](issues/18-l-analyse-search.md) | grilling ✓ | 17 |
| [L'essai réel de l'Analyse Search](issues/19-l-essai-reel-de-l-analyse-search.md) | task ✓ | 18 |
| [L'Analyse Search en maquette](issues/20-l-analyse-search-en-maquette.md) | prototype | 18 |

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
  _Filtre et moustache suspendus par la maquette (11), repris au 15._
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
  modèle Instagram. _Demand Gen en est sorti au 14._
- [YouTube : une page à part ou une vue de la page Google](issues/07-youtube-page-a-part.md) :
  pas de page à part — **Vidéo** (nom Google Ads, le YouTube payant) est un
  type de `/google` comme les autres ; ses métriques (vues, CPV, quartiles)
  au `BACKLOG.md` avec l'analyse par type (révisé par 08) ;
  la vidéo de PMax reste à PMax ; « YouTube » seul = la future page
  organique (`BACKLOG.md`).
- [La Comparaison sur Google](issues/08-la-comparaison.md) :
  elle ne détaille pas les types — les moustaches le font déjà ; l'analyse
  propre à chaque type (mots-clés, audiences, emplacements, quartiles) part
  au `BACKLOG.md`, un type à la fois ; le module garde la mécanique Meta ;
  ses niveaux sur Google vont au Tableau (09), le classement entre types à
  la maquette (11).

- [Le Tableau détaillé selon le type de campagne](issues/09-le-tableau-detaille.md) :
  un seul tableau dépliant qui suit le filtre, et chaque ligne se déplie selon
  son type : Search, Display et Vidéo jusqu'à l'Annonce, PMax jusqu'au
  **Groupe d'éléments** (terme écrit dans `CONTEXT.md`) ; ni éléments ni
  mots-clés (`BACKLOG.md`) ; colonnes de la vue, « — » avec sa raison au
  survol, ratios recalculés par ligne, export CSV avec le type.

- [L'essai réel des métriques Google](issues/10-l-essai-reel.md) :
  API v26, deux comptes ; un compteur hors type revient à **0**, un taux
  revient **absent** → le « — » se décide par type dans Pulse, pas d'après
  Google ; portée rendue aussi sur Search et PMax, 92 j, **vide sans erreur**
  au-delà ; valeur de conversion jamais vide et souvent « 1 × conversions »
  (défaut imposé) → « sans valeur » se lit dans `conversion_action` (13) ;
  taux de Google = recalcul exact ; PMax par réseau oui, par audience non ;
  Demand Gen ≈ 50 900 CHF sur 36 mois chez A (14).
- [La page Google en maquette](issues/11-la-page-google-en-maquette.md) :
  validée au deuxième tour — **la page Meta avec les chiffres de Google**,
  mêmes modules, même ordre, **construite avec les modules Meta et non
  d'après la maquette** (« suis exactement comme on a fait sur Meta ») ; rien
  de propre aux types pour l'instant (filtre et moustache du 04 suspendus,
  15) ; en bas, « Analyser une campagne — à venir » ; la Comparaison reste
  celle de Meta, à améliorer plus tard (16).
- [Le Panneau latéral sur Google](issues/12-le-panneau-lateral.md) :
  comme Meta — « Lire » sur une annonce de la Comparaison, un point de la
  Tendance pour un jour ; le Groupe d'éléments PMax n'ouvre rien (ses
  éléments au `BACKLOG.md`) ; l'annonce montre tout ce qu'elle contient selon
  son type — titres et descriptions Search, images Display, la vidéo
  elle-même —, jamais une annonce recomposée, aucun chiffre ; le journal est
  déjà enregistré, seul l'avant-première-récolte (30 j) manque, dit au « ⓘ » ;
  champs de contenu à vérifier sur un appel réel.
- [Ce que l'interface Google Ads affiche, face à l'essai](issues/13-l-interface-face-a-l-essai.md) :
  relevé par l'API (Chrome n'atteint pas A) ; une action est **sans valeur**
  quand sa valeur est imposée à 0 ou 1 ; « — » seulement si toutes les
  actions converties sont sans valeur ; un compte mixte affiche le total de
  Google avec un « ⓘ » (une partie n'est qu'un comptage) ; ligne Total de
  l'écran non vue.
- [Demand Gen, cinquième type nommé ?](issues/14-demand-gen-nomme.md) :
  oui. Demand Gen est le 2ᵉ poste de A sur 36 mois, il ne reste donc pas sans
  nom sous « Autres types » ; il porte les seuls chiffres de base, sans vues
  vidéo ; rien ne change à l'écran tant que les types sont suspendus (15).
- [Ce qu'on montre pour chaque type de campagne](issues/15-ce-qu-on-montre-par-type.md) :
  rien, hors de l'Analyse — « on a la base de Meta qui doit être prise ».
  Ni module des types, ni moustache, ni filtre Type au Bandeau (04
  abandonné), ni dépense par type ; restent le repère de type au Tableau et,
  dans la Comparaison de Meta, le choix d'un type et d'une métrique (16). En
  bas, l'**Analyse** commence par Search — mots-clés, termes, nuage de points,
  spécialités des termes — et **entre dans la carte** (17, 18). Raison de fond :
  [Peut-on comparer des types de campagne Google entre eux ?](analyses/15-comparer-les-types.md).
- [Les mots-clés et les termes de recherche dans l'API Google Ads](issues/17-mots-cles-et-termes-dans-l-api.md) :
  nuage des mots-clés faisable par jour (couleur = campagne) ; mots-clés sans
  impression ou exclus absents de `keyword_view` ; termes avec mot-clé
  déclencheur, type d'appariement et statut actuel ; part masquée par la
  confidentialité calculable, pas lisible ; exclusions sur quatre niveaux ;
  incertitudes (part perdue budget, casse des termes) à un essai réel.
- [L'Analyse Search](issues/18-l-analyse-search.md) :
  une descente pilotée par le haut — onglets de type (Search seul actif),
  période et campagne du Bandeau, nuage dont les axes suivent la vue
  (Notoriété, Trafic, Conversion), niveau campagnes › groupes d'annonces ›
  annonces › éléments, onglet Étendue (« déclenché tout seul » = texte
  identique), listes mots-clés (niveau de qualité du jour) puis termes triés
  par coût, groupes de termes = **catégories de Google** sans coût, à
  condition qu'elles fassent ressortir un mot comme « gratuit » (19) ; choix
  des actions de conversion propre à l'Analyse ; aucun « mauvais », aucun
  « à supprimer ».
- [L'essai réel de l'Analyse Search](issues/19-l-essai-reel-de-l-analyse-search.md) :
  **catégories de Google retenues** — « gratuit » ressort dans ses propres
  catégories (72 clics sur 73), mais collé à un sujet et découpé par langue ;
  `id` stables d'une semaine à l'autre, pas de coût, série par jour une
  catégorie à la fois ; « déclenché tout seul » = appariement `EXACT` ; la
  somme par action redonne les conversions, mais ce qui compte se lit dans
  `campaign_conversion_goal` (94 % des conversions Search de A = « Page
  vue », non principale) ; éléments RSA remplis par jour mais non
  additionnables ; part perdue (budget) refusée sur `keyword_view` ; niveau
  de qualité pour les seuls mots-clés actifs (42 %) ; 44 à 61 % des clics
  Search viennent de termes masqués ; `EXCLUDED` non observable.

## Not yet specified

- **Le délai de stabilisation des conversions Google** : aucun documenté
  (ticket 01) ; ce qu'il fait à la Tendance et à la Comparaison des derniers
  jours. Un premier relevé jour par jour (27.10–09.11, compte A) est dans le
  ticket 10 ; il faut un second relevé des mêmes jours, une à deux semaines
  plus tard, pour mesurer ce qui a bougé.
- **Ce que la récolte et le traitement doivent calculer** — migration de
  `google_ads_insights` (type de campagne, les trois colonnes de conversions,
  valeur, portée par fenêtre de 92 j au plus), une table des Groupes
  d'éléments PMax (09 ; ≈ 600 lignes × jour sur 90 j), les réglages de valeur
  des actions de conversion et la répartition des conversions par action
  (13), le contenu des annonces et leurs images
  (12), reprise de l'historique (37 mois au plus
  par jour), passage de v25 à v26 (v26 répond, vérifié au 10), les
  mots-clés, termes, catégories (fenêtre agrégée ; par jour une catégorie par appel), conversions par action, objectifs de conversion par campagne (`campaign_conversion_goal`) et éléments RSA de l'Analyse Search (17, 18, 19 — ≈ 245 lignes d'éléments par jour chez A) ; les vidéos
  sont au `BACKLOG.md` (08). Piège relevé au 10 : avec
  `segments.date`, Google omet les jours dont toutes les métriques demandées
  sont à 0.
- **La spec de la page Google Ads** — la destination, une fois tout le reste
  tranché.

## Out of scope

- **La section Google du rapport hebdo.** Le rapport se refait ailleurs
  (`CLAUDE.md` §1).
- **Toute jointure GA4** pour compléter les conversions ou le revenu — ADR 0010.
- **Brancher TikTok** ou une autre plateforme — `BACKLOG.md`.
- **Thèmes, labels, recommandations** — retirés du produit, ne reviennent pas
  par la bande.
- **L'analyse propre aux autres types** (audiences et groupes d'éléments
  PMax, emplacements Display, quartiles Vidéo) — un type à la fois, plus tard ;
  [La Comparaison sur Google](issues/08-la-comparaison.md), `BACKLOG.md`.
  **Search en est sorti le 2026-11-11** : son Analyse entre dans la carte
  ([Ce qu'on montre pour chaque type de campagne](issues/15-ce-qu-on-montre-par-type.md)).
- **Regrouper les campagnes par thématique** — « plus intéressant », dit David,
  « dans un prochain temps » ; il recoupe le thème retiré du produit
  (`CLAUDE.md` §1) et ne revient que par une décision explicite (15).
