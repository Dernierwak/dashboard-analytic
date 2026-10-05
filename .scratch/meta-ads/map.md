# Carte — Le dashboard Meta Ads, et le socle des autres plateformes

Label: `wayfinder:map`
Chartée le 2026-09-28, à partir du brief « Projet Pulse : dashboards social ads
et organique » et de quatre tours de questions avec David.

## Destination

Une **spec exécutable du dashboard Meta Ads refondu** — ses 3-4 modules, leur
ordre, ce que chacun montre — posée sur un **socle que Google Ads reprendra sans
refonte**, dans un produit **débarrassé du thème et du label**.

La carte est finie quand un agent peut construire le dashboard sans plus rien
avoir à décider.

## Notes

**Ce que cette carte exécute, et ce qu'elle ne fait que décider.** Wayfinder
planifie par défaut. Ici, deux choses s'exécutent vraiment parce que la
destination l'exige : la **purge du thème** (tickets 01 et 02 — David : « on
supprime de partout ») et la **fondation de données** qui en découle. Le
dashboard lui-même s'arrête à la spec.

**Cette carte ne porte que des décisions** (et les deux exécutions ci-dessus).
Une réparation trouvée en chemin — un bug du `/meta` actuel, un test à
reprendre — part dans `.scratch/corrections/`, pas ici (supprimé le 2026-10-05 : ses tickets ouverts sont `tickets/30` à `34`). Quatre tickets y ont
été rangés le 2026-10-01 : `link_click` absent compté zéro, portée additionnée
jour par jour, `/meta` tronqué à 1 000 lignes, harnais 18/20/47 à reprendre.

**Le brief d'origine est dans [`brief.md`](brief.md).** Tout prototype ou
spec de cette carte part de LUI, bloc par bloc et dans son ordre — pas des
résumés que les tickets en font. Deux prototypes ont été rejetés le 2026-09-30
pour avoir remplacé sa structure par une autre.

**Le domaine.** `CONTEXT.md` pour le vocabulaire — il est à corriger par le
ticket 01, le thème n'en fait plus partie. `docs/mesures-impossibles.md` pour ce
qu'on ne saura jamais mesurer. `docs/adr/` pour les décisions durables, dont la
0010 posée par cette carte.

**Skills à appeler à chaque session.** `grilling` et `domain-modeling` en cas de
doute. `research` pour les tickets 03, 04 et 15. `prototype` pour 05, 06 et 08.

**Les règles qui ne se négocient pas dans cette carte.**
- **Meta et rien que Meta.** Aucune jointure GA4, aucun chiffre d'une autre
  plateforme. Voir `docs/adr/0010`.
- **Une absence n'est pas un zéro.** Une campagne de notoriété dans le module
  Conversion affiche « — », jamais « 0 ». `CLAUDE.md` §7.
- **Toute comparaison exclut le jour en cours.** `CLAUDE.md` §7.
- **Rien de destructeur sans validation.** Le ticket 02 propose une migration,
  David la joue.
- **Vérifier avant de dire que c'est fait.** `rm -rf .next tsconfig.tsbuildinfo`,
  puis `npx tsc --noEmit` et `npm run build`. Le compte de routes passe de 19 à
  **18** dès que `/labels` disparaît (ticket 01) : c'est le nouveau repère.

**Préférences de David pour cet effort.** Rendre quelque chose de **fini**, pas
une option de plus décrite sans être construite. Le brief d'origine est une base
à challenger, pas un cahier des charges à exécuter tel quel.

## Décisions déjà prises

<!-- l'index : une ligne par ticket clos, puis on zoome le lien -->

- **La destination** : une spec du dashboard Meta Ads, exécutable, socle de
  Google Ads. Instagram et l'organique sortent du périmètre.
- **Le thème et le label quittent tout le produit.** Réaffirmé après objection :
  le rayon de souffle est de 55 fichiers web, 50 mentions de « thème », 14
  migrations. Ce qui part est mémorisé dans `BACKLOG.md`, pas perdu.
- **Le rapport hebdo se vide, il ne se retravaille pas ici.** Ce qui dépendait du
  thème disparaît sans remplacement. Le refaire est un chantier à part.
- **Trois modules, bascule libre, toutes les campagnes dans chacun.** Notoriété /
  Trafic / Conversion reconfigurent l'affichage ; on ne filtre PAS sur l'objectif
  déclaré de la campagne. Le tri par objectif déclaré part au `BACKLOG.md`.
- **Les conversions viennent de l'API Meta**, pas de GA4 — une jointure par nom
  rend zéro sans le dire, et le client compare Pulse à son Ads Manager.
  Fiche : `docs/adr/0010-une-plateforme-se-lit-avec-ses-propres-chiffres.md`.
- **Lire le texte d'un asset ≠ mesurer un asset.** Le premier est du contenu,
  toujours disponible ; le second est une métrique, peut-être absente hors créa
  dynamique. On récolte et on affiche le contenu ; on ne prétend mesurer qu'après
  le ticket 03.
- **Les métriques par asset ne sont pas exploitables**, donc le tableau s'arrête à
  l'annonce. [Meta donne-t-il des métriques par asset ?](issues/03-meta-donne-t-il-des-metriques-par-asset.md)
  — huit breakdowns existent mais ne rendent que l'**ID** de l'asset, six métriques
  seulement, et **rien n'est documenté pour une annonce à créa unique** : une ligne
  « Asset » serait vide pour le cas courant. Effet de bord utile : le contenu d'un
  asset vient de l'endpoint des créas, pas des insights — donc lire le texte ne
  dépend plus de cette recherche.
- **Les conversions ne coûtent aucun appel de plus** : ce sont des champs de la
  requête `/insights` déjà faite. [Les champs API Meta pour les conversions et les
  créas](issues/04-les-champs-api-meta-pour-les-conversions-et-les-creas.md) — mais
  les cinq champs candidats sont des **listes de types d'action**, jamais un nombre ;
  il n'existe **aucun** « taux de conversion » chez Meta ; les `action_type`
  **s'emboîtent** (`link_click` ⊂ `post_engagement` ⊂ `page_engagement`), donc les
  sommer compte plusieurs fois ; et les URL d'image de Meta **expirent**, il faut les
  téléverser dans Storage en gardant `image_hash`. Forme de stockage proposée : 3
  colonnes + 3 tables neuves, à valider au ticket 07.
- **Ce qui se réutilise, c'est une liste ordonnée de 3-4 modules** — mêmes blocs,
  même ordre, même endroit où on trouve l'info, sur Meta comme sur Google. La
  grammaire existe déjà (`CLAUDE.md` § conventions, réf.
  `saas/web/components/jour-recolte.tsx`) : on s'appuie dessus.

- **La structure du dashboard est validée**, dans l'ordre du brief : barre
  collante, choix de la vue sur trois cartes, vue d'ensemble du total, comparaison
  classée avec deux métriques, tableau jusqu'à l'annonce (l'asset en est sorti au ticket 06).
  [Les 3-4 modules du dashboard, et leur ordre](issues/05-les-modules-du-dashboard-et-leur-ordre.md)
  — la mise en page de la comparaison (C1 ou C2) reste à choisir.

- **Le thème a quitté l'écran et le code**, base intacte : 18 routes, plus
  aucune requête sur un objet que la migration supprime — la frise, qui lisait
  encore `*_campaign_config.label`, aurait perdu tous ses faits en silence.
  [Le thème et le label quittent l'écran et le code](issues/01-le-theme-quitte-l-ecran-et-le-code.md)

- **La base perd le thème par une migration à jouer à la main**, `998`, hors du
  `000` qui cesse de l'installer. Sans archive (« rien, on perd ») et avec
  `insight_feedback` en entier — validés par David. Vérifiée sur un PostgreSQL
  jetable ; reste à la **jouer** sur Supabase, après un passage du worker.
  [La migration qui retire le thème de la base](issues/02-la-migration-qui-retire-le-theme-de-la-base.md)

- **Le texte d'une annonce se lit dans le panneau latéral, ouvert depuis le
  module Comparaison et nulle part ailleurs** — une cible de clic visible,
  distincte de la case qui coche ; pas de bande de créas sous les graphes ; le
  tableau reste une table d'export qui s'arrête à l'annonce ; un seul panneau,
  partagé avec les changements.
  [Aller lire le texte d'un asset sans quitter Pulse](issues/06-aller-lire-le-texte-d-un-asset-sans-quitter-pulse.md)

- **Le socle est une structure de modules nommés, pas une forme de données
  commune**, et chaque niveau Meta est identifié par son ID. Mêmes noms, rôles et
  places sur toutes les plateformes, code propre à chacune ; ratios recalculés
  total ÷ total ; le clic = tous les clics ; les conversions = « Résultats »
  d'Ads Manager ; portée et fréquence retirées ; migration en deux étapes,
  proposée et non jouée. Fiche : `docs/adr/0011`.
  [Le socle commun Meta / Google : des modules nommés, et la clé par ID](issues/07-le-contrat-de-donnees-commun-meta-google.md)

- **Un petit point par jour sur la courbe, un clic ouvre le jour dans le
  panneau partagé** ; sous un filtre, seulement la campagne filtrée, ensembles
  et annonces compris — la récolte devra retrouver le parent par l'ID. Meta
  déclarait bien enchères et créations : c'est la récolte qui les jetait, elle
  s'élargit aux enchères, au statut des annonces et aux créations. Ce que le
  journal ne couvre pas se dit dans une info-bulle « ⓘ ».
  [Les changements posés sur les courbes](issues/08-les-changements-poses-sur-les-courbes.md)

- **La colonne « Résultats » d'Ads Manager, c'est le champ `results`** — une
  liste, pas un nombre, qui suit l'attribution de l'ensemble de publicités. Sa
  forme exacte et ce qu'il rend en notoriété ne sont pas documentés.
  [Quel champ de l'API Meta rend la colonne « Résultats »](issues/15-quel-champ-de-l-api-rend-la-colonne-resultats.md)

- **`results` se stocke brut, sans appel préalable** : la liste telle que Meta
  la rend, `NULL` si le champ manque, jamais `0`. Sa forme se lira dans la base
  après le premier passage du worker.
  [L'appel réel qui donne la forme de `results`](issues/16-l-appel-reel-qui-donne-la-forme-de-results.md)

- **Pulse recopie Meta pendant 28 jours, et dit à quelle date il l'a lu.** Le
  recouvrement Meta passe de 7 à 28 jours — au-delà, Meta ne corrige plus rien,
  donc un jour ancien est identique à Ads Manager. L'écran écrit « Chiffres
  Meta au <Jour de travail> » ; aucune zone « provisoire », la règle du jour en
  cours ne s'élargit pas ; `attribution_setting` se dit dans l'info-bulle
  « ⓘ ». L'appel en direct à Meta est écarté.
  [La fenêtre de recouvrement, et les 21 jours de conversions qu'on ne verra jamais](issues/09-la-fenetre-de-recouvrement-des-conversions.md)

- **La page d'arrivée ne se saisit plus, elle se lit dans la créa Meta, annonce
  par annonce** — un lien sortant dans le panneau latéral, à côté du texte. La
  saisie par campagne, sans lecteur et au mauvais niveau, a quitté le code ; la
  `998` détruit `landing_url` avec le thème. Exécuté sur demande de David.
  [La page d'arrivée d'une campagne n'a plus d'écran](issues/14-la-page-d-arrivee-d-une-campagne-n-a-plus-d-ecran.md)

- **La spec est écrite** : [`spec.md`](spec.md), `ready-for-agent`, 60 user
  stories, deux seams de test (récolte « réponse Meta → lignes », page « lignes →
  modules »). Trois choix y sont tranchés **par défaut**, à confirmer par David :
  comparaison en **C2** ; **pas de période « Tout »**, la semaine mesurée par
  défaut ; le tableau **s'exporte en CSV**. Ce que Google met dans chaque module y
  est noté.

- **La spec est découpée en 14 tickets de construction**, rangés dans
  [`tickets/`](tickets/README.md), à part des décisions de la carte. 01 et
  13 attendent David (jouer la `998`, jouer l'étape B) ; après le schéma (02),
  03, 05 et 06 avancent de front. Le choix du bucket des visuels est posé au
  ticket 05.

## Pas encore spécifié

- **Le bucket des visuels d'annonces : public comme `post-images`, ou privé** avec
  URL signées. Noté dans la spec, à trancher au ticket de construction.
- **Les quotas de l'API Meta : mesurés, et ce n'est pas eux qui coûtent.** 7 appels
  Graph par passage pour 20 annonces, soit 2,4 % du plafond Ads Management standard.
  **Le poste cher est le stockage des images**, pas l'API — ce qui déplace la question
  vers Supabase Storage, et reste dans le brouillard pour l'instant.
- **Le tier d'accès de l'app Pulse est inconnu**, et il change le plafond de quota.
  Fait à établir avant de dimensionner quoi que ce soit.

## Hors périmètre

- **Le dashboard organique / Instagram.** La moitié « DASHBOARD 2 » du brief
  d'origine. Décision de David : « Instagram, tu peux l'oublier ». Les trous
  mesurés au passage (la portée de la page n'est pas récoltée, les stories
  n'existent nulle part et disparaissent en 24 h) sont notés au `BACKLOG.md` pour
  que la mesure ne soit pas refaite.
- **La construction du dashboard Google Ads.** Le socle est conçu pour lui, il
  n'est pas construit ici.
- **L'abstraction TikTok / Pinterest.** Généralisation prématurée avec une seule
  plateforme branchée.
- **Toute jointure GA4.** Voir `docs/adr/0010`.
- **La refonte du rapport hebdo.** Il se vide ici, il se refait ailleurs.
- **Les métriques par asset dans le tableau.** Mesuré, pas supposé : la doc Meta ne
  documente aucune ventilation par asset pour une annonce à créa unique, et n'en
  donne que six métriques pour les annonces bâties sur un `asset_feed_spec`. Le
  **contenu** des assets reste, lui, dans le périmètre (ticket 06). Ticket clos :
  [Meta donne-t-il des métriques par asset ?](issues/03-meta-donne-t-il-des-metriques-par-asset.md)
- **La portée et la fréquence.** Retirées du dashboard au ticket 07 : la somme
  des portées journalières est fausse, et la vraie demande un appel par période.
  Au `BACKLOG.md` avec les deux voies honnêtes.
- **Le tri des campagnes par objectif déclaré.** Bonne idée, trop de complexité
  pour maintenant. Au `BACKLOG.md`.
