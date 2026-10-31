# Carte — La page hebdomadaire

Label : `wayfinder:map`

## Destination

Une **spec de la page hebdo** (`/`), prête à remettre à la construction : ce
qu'elle montre, dans quel ordre, sous quelle forme, et ce que le traitement
doit calculer pour ça. On part de **ce qui existe déjà** et on le retravaille —
le design, la présentation et le choix des éléments sont le cœur du chantier.

## Notes

- **Ce que David garde, dans ses mots (2026-10-28)** :
  1. la semaine écoulée **face à la précédente**, avec les métriques de
     **toutes les sources** ;
  2. le repère « **c'est une bonne moyenne, c'est la moyenne de notre compte,
     on est sur une bonne lancée** » ;
  3. la vue rapide de **toutes les campagnes et tous les posts** — en cours,
     publiés, et **à venir** (« les posts en dessous pas forcément idéaux ») ;
  4. **les changements effectués cette semaine** ;
  5. ~~peut-être **nos meilleurs X**~~ (retiré le 2026-10-31) — « la meilleure campagne, ce qui a le mieux
     fonctionné ».
- **La page est statique** au sens de David : la comparaison se voit **sans
  régler de filtre**. Bouger, zoomer, défiler, voir l'année : permis (ticket
  01). Pour en savoir plus, on va sur la page de la plateforme.
- **Vocabulaire** : « module des canaux », que David appelle aussi « la
  boussole » — la comparaison à la semaine type du compte, une carte par
  canal. Rien à voir avec l'ancienne boussole à bascule et à zones.
- **Pulse ne conseille rien** (`CLAUDE.md` §1) : la page dit ce qui a bougé,
  jamais quoi faire. « Meilleur » se mesure, il ne se recommande pas.
- **Chaque plateforme se lit avec ses propres chiffres** (règle de l'ADR 0010,
  rappelée par `CLAUDE.md` §1) — vaut pour la comparaison comme pour « le
  meilleur ».
- **§7 s'applique partout** : aucun chiffre fabriqué, une absence n'est pas un
  zéro, le jour en cours est exclu de toute comparaison.
- Skills à appeler : `grilling` + `domain-modeling` pour les grillings,
  `prototype` pour la maquette ; l'agent `vision-ux` pour la hiérarchie et la
  forme, `vision-produit` pour juger ce qui mérite d'exister.
- Point de départ dans le code : `saas/web/app/page.tsx` (la page),
  `saas/data/supabase/processed_data/weekly_report/builder.py` (ce qu'elle lit).
- `BACKLOG.md`, `CONTEXT.md` et `docs/` ont quitté l'arbre (1b05a92, b97e807) ;
  ce qu'ils disaient du rapport reste dans l'historique git
  (`git show a909601:BACKLOG.md`).

## Tickets

Format : un fichier par ticket sous `issues/`, en-tête `Type / Status /
Blocked by`. Le frontier = `Status: open`, rien d'ouvert dans `Blocked by`.

| Ticket | Type | Bloqué par |
|---|---|---|
| [La structure de la page](issues/01-la-structure-de-la-page.md) | grilling | — |
| [Le module des canaux](issues/02-les-metriques-de-la-semaine-face-a-la-precedente.md) | grilling | — |
| [Ce que veut dire « la moyenne du compte »](issues/03-ce-que-veut-dire-la-moyenne-du-compte.md) | grilling ✓ | — |
| [La vue des campagnes et des posts](issues/04-la-vue-des-campagnes-et-des-posts.md) | grilling ✓ | — |
| [Les changements de la semaine](issues/05-les-changements-de-la-semaine.md) | grilling ✓ | — |
| [Le verdict et la boussole dans une page statique](issues/06-le-verdict-et-la-boussole-dans-une-page-statique.md) | grilling | — |
| [Le meilleur du compte](issues/07-le-meilleur-du-compte.md) | prototype — hors périmètre | — |
| [La page entière, en maquette](issues/08-la-page-entiere-en-maquette.md) | prototype — maquette prête, attend David | 10, 11 (jugés dans la même maquette) |
| [Les posts à venir se lisent-ils chez Meta ?](issues/09-les-posts-a-venir-se-lisent-ils-chez-meta.md) | research ✓ | — |
| [La boussole et le haut de page, en maquette](issues/10-le-haut-de-page-en-maquette.md) | prototype | — |
| [La frise, en maquette](issues/11-la-frise-en-maquette.md) | prototype | — |

## Decisions so far

<!-- une ligne par ticket clos : [titre](lien) : l'essentiel de la réponse -->

- [La structure de la page](issues/01-la-structure-de-la-page.md) : des blocs,
  chacun lu par plateforme — titre et totaux (dépense, impressions ; portée
  côte à côte sans total) → module des canaux → campagnes et posts sur l'année
  ; changements en suspens. Le verdict, la boussole et le bandeau « n'a pas
  répondu » partent ; une absence s'écrit « — ». La boussole se juge en
  maquette. (Le meilleur du compte, d'abord retenu, est retiré ensuite — voir
  Out of scope.)
- [Le verdict et la boussole dans une page statique](issues/06-le-verdict-et-la-boussole-dans-une-page-statique.md) :
  tranché par le ticket 01 — verdict retiré, boussole fondue dans le module
  des canaux.
- [Le module des canaux](issues/02-les-metriques-de-la-semaine-face-a-la-precedente.md) :
  une carte par canal, Meta seul pour l'instant (dépense, impressions, clics,
  CTR, CPC), pas de ROAS ; la semaine se compare à la semaine type du
  compte, plus à la précédente ; semaine calée sur le Jour de travail.
- [Ce que veut dire « la moyenne du compte »](issues/03-ce-que-veut-dire-la-moyenne-du-compte.md) :
  la « semaine type » — médiane des ratios (CTR, CPC, CPM) sur les 12
  dernières semaines, 6 au minimum, écrite sur la carte ; trois états
  colorés en tons légers ; les volumes en totaux sans comparaison ; ni pente
  ni courbe sur l'hebdo.
- [Les posts à venir se lisent-ils chez Meta ?](issues/09-les-posts-a-venir-se-lisent-ils-chez-meta.md) :
  non pour Instagram (rien de programmé dans l'API) ; oui pour une Page
  Facebook, au prix d'un nouveau scope, d'un re-consentement général et d'une
  App Review. Avec les scopes actuels, « à venir » = les campagnes.
- [La vue des campagnes et des posts](issues/04-la-vue-des-campagnes-et-des-posts.md) :
  année en cours, zoom, défilement, cadrage Année · Mois · Semaine ; une
  campagne = nom, début, fin, statut (filtre léger), dépense au survol,
  reconnue par ID sous son nom actuel ; les posts plus grands, plateforme,
  format et visuels directs, sans chiffre ; à-venir pour les campagnes seules ;
  `permalink` et `media_product_type` à récolter. La forme se juge dans « La
  frise, en maquette ».
- [Les changements de la semaine](issues/05-les-changements-de-la-semaine.md) :
  gardés, réduits, sous le module des canaux — la semaine mesurée seule,
  seulement ce que la plateforme a écrit (plus rien de déduit), sans ce que
  la frise montre ; en-tête « Meta · 7 changements » par plateforme, chaque
  mention liée à son journal ; puis par jour, une campagne dépliable par
  ligne marquée « — Meta » ; « 0 » sur une semaine récoltée, « — » sinon.

## Not yet specified

- **Ce que le traitement doit calculer de neuf.** Dépend de ce que les
  grillings retiennent : la spec finira par une liste « clé du payload → d'où
  elle vient », mais on ne peut pas l'écrire avant de savoir quoi montrer.
  Elle dira aussi ce qui **sort** : `metrics_read/prev/series` et `kpis` ne
  sont lus par personne ([l'inventaire du 2026-10-28](inventaire-2026-10-28.md)) ; ils
  sortent, avec `canaux_muets` côté page.
  Sortent aussi les `changements` déduits ; entre un **signal de couverture
  du journal** de chaque plateforme, sans lequel « 0 changement » et une
  récolte en panne se confondent ([le ticket 05](issues/05-les-changements-de-la-semaine.md)).
- **Les états de la page** : une source pas branchée, une source muette cette
  semaine, un compte de moins de deux semaines (rien à comparer), une semaine
  sans aucune campagne. Chaque bloc retenu en aura, ils se trancheront avec la
  maquette.
- **Le passage vers la page plateforme** : depuis quel bloc, vers quoi, avec
  quel contexte (la même semaine ?). Ça dépend des blocs.
- **L'identité visuelle** de la page — typographie, densité, ce qui « fait
  waouh » sans casser la lecture. À voir quand la maquette existera.

## Out of scope

- **Google Ads et Instagram dans le module des canaux, pour l'instant** —
  leurs pages ne sont pas finies ; ils entrent quand elles le seront.

- **[Le meilleur du compte](issues/07-le-meilleur-du-compte.md)** — retiré
  devant le prototype (2026-10-31) : « il apporte pas grand-chose, c'est
  complexe, il y a 1000 filtres ». Un « meilleur » exige un critère, une
  période et des seuils que la page statique ne veut pas montrer.
- **L'email hebdo** — David : « on va l'ouvrir dans une autre section ».
- **Un connecteur LLM** pour poser des questions à ses données — David : « on
  verra dans une autre issue ». Un futur chantier, qui devra rouvrir
  explicitement la règle « aucun appel à un modèle de langage » de `CLAUDE.md`.
- **Le conseil** (« quoi faire cette semaine ») — retiré du produit le
  2026-09-21, ne revient pas par ce chantier.
- **Le thème et le regroupement** — partis le 2026-09-30, ne reviennent pas.
- **Les pages Meta / Google / Instagram** — elles ont leur propre chantier.
- **Les posts Facebook programmés dans la frise** — lisibles par
  `/{page-id}/scheduled_posts`, mais au prix de `pages_read_engagement`, d'un
  re-consentement de tous les comptes, d'une App Review et d'une nouvelle
  source à récolter ([la recherche](issues/09-les-posts-a-venir-se-lisent-ils-chez-meta.md)).
  À rouvrir comme chantier à part.
