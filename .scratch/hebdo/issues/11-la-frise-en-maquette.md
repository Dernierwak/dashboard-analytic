# 11: La frise, en maquette

Type: prototype
Status: resolved
Blocked by: —

## Question

**Sous quelle forme se lisent les campagnes et les posts de l'année** sur la
page hebdo ? Une maquette jetable, à données réelles si possible (les visuels
sont dans le Storage : `ad-creatives`, `post-images`), à laquelle David réagit.

Ce qui est tranché ([La vue des campagnes et des posts](04-la-vue-des-campagnes-et-des-posts.md)) :
année en cours, zoom, défilement, cadrage Année · Mois · Semaine ; une
campagne = nom, début, fin, statut, dépense au survol ; aucun chiffre sur un
post ; à-venir pour les campagnes seulement ; identité par ID.

À trancher en réagissant :

- **la séparation** : campagnes et posts dans deux zones, et les posts par
  plateforme — sur un axe de dates commun ou non ;
- **les visuels directement dans la frise**, posts comme campagnes, comme sur
  la page Meta : à quelle taille, et ce qui se passe quand plusieurs posts
  tombent le même jour ou qu'on dézoome sur l'année ;
- **la couleur** : sert-elle encore (format, plateforme) ou les visuels
  suffisent-ils ;
- **le statut** sur la barre, et la forme du filtre léger par statut ;
- **la faisabilité** des visuels d'une campagne (plusieurs annonces, laquelle
  montrer) — à dire franchement si ça ne tient pas.

## Answer

Tranché avec la page entière, dans [La page entière, en maquette](08-la-page-entiere-en-maquette.md) (2026-10-31) :
- **séparation** : les posts sortent de la frise ; elle ne garde que leur rythme en petits
  points sous les mois. Les posts se voient en grand dans le panneau de la semaine, à droite,
  en onglets par source (Organique · Instagram…, Campagnes · Meta, Google Ads) ;
- **visuels** : le premier visuel en tête de barre dans la frise, et la carte de campagne dans
  le panneau. **Faisabilité** : en 2026, 33 des 86 annonces Meta ont une image ou une
  vignette, soit 3 campagnes sur 10 ; Google n'en a aucune. La carte dit « pas de visuel » ;
- **couleur** : la plateforme, pour l'instant ; les teintes de la maquette ne sont pas retenues ;
- **statut** : sur la carte du panneau, et seule une fin **déclarée** et passée fait
  « terminée ». Le filtre par statut n'a pas été redemandé ; `WITH_ISSUES` reste à nommer
  ([Les états de la page](13-les-etats-de-la-page.md)) ;
- la frise sert de navigateur : un clic ou ‹ › choisit la semaine montrée à droite.
