# 04: La vue des campagnes et des posts

Type: grilling
Status: resolved
Blocked by: —

## Question

David aime voir d'un coup d'œil **les campagnes en cours, celles à venir, les
posts publiés et ceux à venir** — c'est la frise actuelle. Il trouve « les posts
en dessous pas forcément idéaux ». **Qu'est-ce qui ne va pas avec eux, et que
doit montrer cette vue ?**

Du ticket 01 : c'est le bloc que David tient le plus (« les campagnes en
cours et les prochaines qui vont arriver, c'est un module qui vaut
beaucoup »). Le zoom et la vue de l'année restent — « statique » n'interdit
que le filtre qu'on doit régler soi-même.

À trancher :

- ce qui gêne dans les posts aujourd'hui (lisibilité, nombre, ce qu'on en dit) ;
- ce qu'une campagne ou un post montre dans la frise (nom, dates, dépense,
  un chiffre ?) ;
- « à venir » : d'où on le sait (date de début déclarée, post programmé) et ce
  qu'on ne peut pas savoir ;
- l'identité d'une campagne : la frise rapproche aujourd'hui par **nom**, donc
  une campagne renommée fait deux barres et deux homonymes s'écrasent (ancien
  ticket 19 de la carte meta-ads, `git show a909601:.scratch/meta-ads/tickets/19-la-frise-du-rapport-rapproche-par-nom.md`).
  On le règle dans ce chantier ?

## Answer

Tranché avec David le 2026-10-30. Ce qui reste de forme se juge dans
[La frise, en maquette](11-la-frise-en-maquette.md).

**Ce qui n'allait pas avec les posts** : pas un manque de chiffre — « un mini
icône en bas, dur à voir, à cliquer, à avoir les informations du post ».
David veut un module **plus grand** pour les posts, qui montre leur
**plateforme** et leur **format**, et leurs **visuels directement**, comme la
page Meta montre ses créas (pas de panneau à ouvrir). **Aucune métrique sur un
post** dans la frise.

**Une campagne montre** son nom, son début, sa fin et son **statut** ; la
dépense au survol ; ses visuels si c'est simple — ça l'est sur le papier : les
créas sont déjà copiées dans le Storage (`meta_ads_creatives`, par `ad_id`), et
les insights portent `campaign_id` + `ad_id`, donc campagne → annonces → créas
se joint sans nouvelle récolte.

**Le statut** se lit chez la plateforme (`effective_status`, déjà récolté dans
`meta_campaign_config` / `google_campaign_config`, pas encore sorti par la
frise) : en cours, en pause, terminée, prévue. C'est le statut **d'aujourd'hui**
— on ne sait pas quand une campagne a été mise en pause, et on ne le prétend
pas. Un statut non récolté ne s'affiche pas. Un **filtre léger par statut**
s'y ajoute (David : « si filtre en léger »).

**L'identité d'une campagne** : par **ID**, affichée sous son **nom actuel**.
Deux homonymes restent deux barres ; une campagne renommée, une seule. L'ancien
ticket 19 de la carte meta-ads est donc réglé par ce chantier. Les insights
portent déjà `campaign_id` : aucune récolte nouvelle.

**« À venir »** : les campagnes seulement (début déclaré, `fin_prevue`). Les
posts Instagram programmés ne se lisent pas dans l'API
([la recherche](09-les-posts-a-venir-se-lisent-ils-chez-meta.md)) ; ceux d'une
Page Facebook coûteraient un scope, un re-consentement et une App Review — hors
chantier.

**Campagnes et posts séparés** : David veut les séparer, et sans doute les
posts par plateforme — « je sais pas comment, je veux avoir en prototype ».
L'utilité de la couleur (format, puis plateforme dès qu'il y en a deux) reste
ouverte. La frise reste prévue pour d'autres plateformes.

**La fenêtre** : l'**année en cours**. Zoom, défilement (horizontal et
vertical), et un cadrage **Année · Mois · Semaine** sur la période du rapport.
Ce cadrage ne compare rien : il ne contredit pas « statique » (ticket 01).

**À récolter en plus** : `permalink` (le lien vers le post) et
`media_product_type` (un Reel n'est pas une vidéo du fil ; sans lui,
l'étiquette « Reel » est une supposition). Même permission qu'aujourd'hui,
aucun re-consentement.
