# Le gabarit d'une plateforme : brancher TikTok sans réécrire

Type: grilling
Status: resolved

## Question

Gradué de la brume par [03](03-le-but-de-pulse.md). David :

> *« L'application devrait grandir et ajouter des modules comme TikTok. C'est
> pour cela que j'aimerais avoir une structure de Meta Ads clean où on se dit
> "c'est super, cela fait sens", same pour Google Ads, probablement similaire.
> Organique on veut aussi une structure qui fait sens. […] Ensuite si le client
> utilise 1 ou 5, on s'en fiche, car on a une structure claire par plateforme.
> Très probablement différente entre organique et ads. Avec quelques nuances :
> Google Ads mots-clés, Meta pas besoin. »*

Quel est le gabarit d'une source, tel qu'ajouter TikTok soit un module et pas
une réécriture ?

### Le point de départ : ce n'est PAS une page blanche

**Le document qui répond à cette question existe, et il a été effacé.**
`docs/04-modules-partages-entre-sources.md` (323 l., supprimé au commit
`7f188f3`, récupérable par `git show 7f188f3^:docs/04-modules-partages-entre-sources.md`)
s'ouvre sur *la question de David, mot pour mot* :

> « Pulse lit aujourd'hui trois sources — Meta, Google Ads, Instagram — et en
> ajoutera d'autres (**TikTok, LinkedIn, Pinterest**…). Ce document répond à une
> question précise, **posée par David** : si on change 1 élément d'une source,
> où faut-il le changer, et à combien d'endroits ? »

Il classe chaque module en **générique / dupliqué / spécifique par nature** et
porte un gabarit pour brancher une nouvelle source. Son compagnon
`docs/03-grammaire-des-modules.md` (1 075 l., « les neuf rangs », « le rang 3
est le chiffre ») dit *comment* un module se compose.

**Il décrit l'état du code au 25 août 2026. Il a donc vieilli** — il doit être
re-vérifié avant d'être cru, pas recopié.

### Les faits déjà mesurés

- **`buildDash` (`lib/channels.ts:531`) ne connaît ni Meta ni Google.** Il prend
  deux formes neutres (`RawAd[]`, `Cfg`) et fabrique tout le `ChannelDash` ;
  `getMetaDash` (43 l.) et `getGoogleDash` (58 l.) ne font que lire leurs tables
  et l'appeler. **La généricité existe déjà côté ads.**
- `/meta` (81 l.) et `/google` (73 l.) partagent type, composants et barre de
  filtres — 48 lignes diffèrent sur 154.
- **`/instagram` (635 l.) est le cousin** : son propre type `InstaDash`, son
  propre chargeur `getInstaDash` (284 l.), et seulement 3 modules empruntés à
  `channel-dash.tsx`. C'est cohérent avec sa nature (ni dépense, ni adset, ni
  enchère) mais l'unification organique/ads n'a jamais été tentée.
- `saas/web/lib/channels.ts` fait **1 637 lignes** et porte en plus des lectures
  qui n'ont rien à voir avec un canal (`getLabelsData`, `getThemeEvenements`,
  `getThemeObjectifs`, `getConversionCategories`).

### Ce qu'il faut trancher

- **Le gabarit d'une source publicitaire** — ce qui est obligatoire, ce qui est
  optionnel (les mots-clés de Google, la portée de Meta), ce qu'une source a le
  droit de ne pas avoir.
- **Le gabarit d'une source organique**, et s'il est vraiment différent ou si
  c'est l'historique qui l'a fait diverger.
- **Ce qu'on demande à une nouvelle source pour être branchée** — la liste des
  champs, pas le code.
- **Ce qui vaut d'être unifié entre organique et ads, et ce qui ne le vaut pas.**

### Ce qui n'est PAS dans ce ticket

Le rôle des dashboards dans le parcours de la semaine — c'est
[06](06-le-parcours-comment-les-pages-se-parlent.md). Ici on décide de la
**forme** d'une plateforme, pas de sa place dans le fil. Le code de la refonte
non plus : cette carte produit un plan.

### Consigne de conduite

Ticket **HITL**. Commencer par sortir `docs/04` de git et le confronter au code
d'aujourd'hui — ne rien citer sur parole, il a deux semaines de retard. Skills :
`vision-ux` (uniformisation des modules entre dashboards), puis `grilling` +
`domain-modeling`.

## Answer

### Le gabarit d'une page plateforme — six rangs

Il vaut pour **toute** plateforme, payante ou organique, Meta comme TikTok. Ce
qui change d'une plateforme à l'autre, c'est le **contenu** d'un rang, jamais
l'ordre.

| Rang | Quoi | La règle |
|---|---|---|
| **0** | Les commandes — période, dates, thème | Ce n'est pas un rang de contenu : une barre **collante**, qui reste atteignable quand on est en bas de page |
| **1** | Les chiffres de tête | **Trois, quatre au maximum** |
| **2** | La courbe | La tendance sur la fenêtre |
| **3** | Par thème | Le seul rang qui parle la même langue sur toutes les plateformes |
| **4** | Ce qui marche pour toi | Le bloc qui **conclut** — il conclut sur le THÈME |
| **5** | Le détail ligne par ligne | L'« Excel ». Chaque plateforme descend aussi profond qu'elle peut |

### Ce qui a été vérifié, et contre quoi

**L'ordre est celui de la littérature, pas une intuition.** David a explicitement
demandé qu'on le challenge plutôt que de le croire.

- Le principe fondateur (Shneiderman, *The Eyes Have It*, 1996) est
  *« overview first, zoom and filter, then details-on-demand »*. **Il place le
  filtrage APRÈS la vue d'ensemble, pas avant** — d'où le rang 0 : les filtres
  ne sont pas la première chose qu'on lit, ce sont des commandes attachées à la
  page.
- L'ordre du contenu est confirmé par la recherche d'usage : KPI en haut,
  courbes de tendance au milieu, tableaux détaillés en bas. **Le « fichier
  Excel » à la fin est la bonne place**, pas un fourre-tout.

### Deux défauts mesurés sur les pages d'aujourd'hui

**1. Six tuiles en tête de `/meta` et `/google`** — Dépensé, Clics, CTR moyen,
une tuile variable, CPM moyen, CPC moyen (`components/channel-dash.tsx`,
`AdsKpis`). Dans une rangée d'éléments répétés, l'attention chute fortement
après les premiers : au-delà de quatre, les dernières tuiles ne sont pas lues.
**CPM et CPC ne sont pas lus.** D'où la règle « trois, quatre au maximum ».

**2. La barre de filtres n'est pas collante.** `sticky` n'apparaît que dans les
en-têtes de tableaux (`channel-dash.tsx` l. 797, 924, 1186 ; `app/instagram/page.tsx`
l. 220, 239). Sur une page Meta qui déplie campagne → adset → annonce, changer
la fenêtre oblige à remonter en haut.

### Les décisions de David

- **Le rang 4 s'ajoute au payant.** Instagram conclut (« ce qui marche par
  format », « quand publier », « top 3 posts ») ; Meta et Google ne concluent
  rien. **Mais le bloc du payant conclut sur le thème, pas sur l'annonce** :
  le fait de marché du ticket [02](02-sur-quoi-se-differencient-les-autres.md)
  est que Google Ads et Meta livrent déjà gratuitement des recommandations au
  niveau de l'annonce, dans l'écran où le clic s'applique. **Quel thème marche
  mieux sur quelle plateforme** est ce qu'aucune régie ne peut dire.
- **Le rang 5 garde sa profondeur par plateforme** : Meta descend campagne →
  adset → annonce, Google s'arrête à la campagne (plus `google_ads_ad_insights`),
  Instagram liste les posts. On n'aligne pas par le bas.
- **Un seul déplacement pour aligner les trois pages** : Instagram place
  aujourd'hui « ce qui marche » (rang 4) AVANT « par thème » (rang 3). À inverser.

### Ce qui est reporté, et pourquoi

**Brancher une nouvelle plateforme (TikTok) — pas maintenant.** David :
*« on sait qu'on va ajouter, mais on va attendre d'avoir une excellente
structure avant d'ajouter. »* Le critère d'entrée reste écrit ici pour le jour
où : une plateforme entre si elle fournit **une date**, **une identité**
(campagne ou post), **un thème possible**, **un chiffre d'effort** (dépense ou
portée) et **un chiffre de résultat** (clics, engagement, conversions). Sans le
thème, elle serait un îlot — c'est le rang 3 qui fait tenir l'ensemble.

**Les mots-clés Google — pas maintenant non plus.** David les avait cités comme
LA nuance Google ↔ Meta ; **ils n'existent dans aucune table** (aucun
`google_ads_keywords` dans `supabase/migrations/`). Ce n'est donc pas un
affichage à faire mais une récolte à ajouter. Fait qui rassure sur le gabarit :
**un mot-clé n'est pas un rang de plus, c'est le rang 5 de Google** — son
détail ligne par ligne, au même titre que l'adset chez Meta. Le gabarit tient
sans modification quand ils arriveront. Va dans `BACKLOG.md`.
