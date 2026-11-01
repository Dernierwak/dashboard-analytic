# Carte — La page Instagram organique

Label : `wayfinder:map`

## Destination

Une **spec de la page `/instagram`**, prête à remettre à la construction, sur
le modèle de la spec Meta Ads (`git show 1b05a92^:.scratch/meta-ads/spec.md`) :
ce qu'elle montre, dans quel ordre, sous quelle forme, ce que la récolte doit
aller chercher en plus et ce que le traitement doit calculer.

## Notes

- **Ce que David veut, dans ses mots (2026-11-01)**, de haut en bas :
  1. **la page** du compte ;
  2. **les moyennes dans le style de l'hebdo** — « voir que notre nouveau post
     est plus performant » ;
  3. **le carré** : « les 5 du haut que nous allons travailler », ou « les 5
     derniers », qu'on sélectionne, qu'on voit et dont on discute — en voyant
     que « 2 sont dans la moyenne, 2 sur les 50-75 %, 1 valeur aberrante » ;
  4. **l'aperçu du post**, comme celui d'une annonce Meta ;
  5. **format → abonnés** : « si je veux plus de followers, sur quel format me
     concentrer » ;
  6. **tous les posts** en dessous.
- **Le concept du chantier : le payant se lit dans le temps, l'organique se
  lit dans la foule.** Une campagne est une série continue : on suit peu
  d'éléments jour après jour (Tendance, Comparaison de courbes). Un post est un
  événement, il y en a beaucoup, et ils sont « plus aléatoires » (David) : on le
  lit face à la **distribution des posts du compte** — la moustache du rail des
  canaux de l'hebdo, appliquée post par post. Mot proposé : **la place d'un
  post** (à valider dans le ticket qui la définit).
- **Tranché au cadrage (2026-11-01)** :
  - le livrable est la spec ;
  - le squelette de Meta (Bandeau de commandes, Tendance, Comparaison, Tableau
    détaillé, Panneau latéral — ADR 0011) est la référence ; un module ne reste
    que s'il a un sens en organique, chaque écart se justifie dans un ticket ;
  - **le groupe est le format** (Reel, Carrousel, Image — un fait rendu par
    Meta), jamais un thème ;
  - **récolter plus est dans le périmètre** dès que l'utilité est vue — chaque
    nouvelle métrique passe par une recherche puis un essai réel ;
  - un post neuf se compare **à âge égal** ; un post trop **jeune** est marqué
    et attend un seuil de maturité tiré de ce qu'Instagram documente, réglable
    par filtre ;
  - une **valeur aberrante est signalée par la mesure, jamais écartée seule** ;
    on peut l'écarter par un filtre, avec une note, pour les moyennes comme pour
    « les 5 meilleurs » ;
  - les règles d'analyse se règlent en **mode « plus pro »** pour qui veut
    aller plus loin.
- **Faits relevés au cadrage** (code de `main`, `df48d2b`) :
  - la récolte **écrase** les chiffres d'un post à chaque passage (upsert
    `(user_id, post_id)`, `saas/data/supabase/source_data/meta.py`) : aucun
    historique, l'âge égal n'existe pas encore ;
  - un passage relit les nouveaux posts + jusqu'à 40 rafraîchis, parmi les 200
    derniers (payant) ou les **10** derniers (gratuit) —
    `saas/data/fetch_data/sources/meta/instagram/sync.py:_a_relire` ;
  - `follows` par post est **déjà demandé**, mais écrit `0` quand Meta ne le
    rend pas (`sync.py`, `m.get("follows", 0)`) — contraire à §7 ;
  - la page actuelle : `saas/web/app/instagram/page.tsx` (484 lignes d'un
    tenant), calcul dans `lib/channels.ts`, partagé avec Google ;
  - **« Tes formats » a déjà existé** et est parti le 2026-09-12 : il
    recalculait en TypeScript une réponse que deux autres moteurs posaient
    autrement. Le rouvrir exige de décider **où il se calcule, une seule fois**.
- **Pulse ne conseille rien** (`CLAUDE.md` §1) : « l'image rapporte plus
  d'abonnés » se mesure et s'affiche ; « concentre-toi sur les images » ne
  s'écrit jamais.
- **§7 partout** : aucun chiffre fabriqué, une absence n'est pas un zéro, le
  jour en cours est exclu. Des portées de posts ne s'additionnent pas
  (`.scratch/hebdo/issues/12-la-portee-organique-du-compte.md`).
- **Grilling : trois questions au plus par série** (David, 2026-10-31).
- Skills : `grilling` + `domain-modeling` pour les grillings, `prototype` pour
  les maquettes, `research` pour les recherches ; agents `vision-ux` (ordre et
  forme) et `vision-produit` (ce qui mérite d'exister).
- Pas de `CONTEXT.md` dans l'arbre : le vocabulaire tranché vit dans ces Notes,
  puis dans la spec.

## Tickets

Format : un fichier par ticket sous `issues/`, en-tête `Type / Status /
Blocked by / Assignee`. Le frontier = `Status: open`, rien d'ouvert dans
`Blocked by`, pas d'`Assignee`.

| Ticket | Type | Bloqué par |
|---|---|---|
| [La structure de la page](issues/01-la-structure-de-la-page.md) | grilling | — |
| [Ce que l'API Instagram donne d'un post](issues/02-ce-que-l-api-donne-d-un-post.md) | research | — |
| [Quand les chiffres d'un post se figent](issues/03-quand-les-chiffres-d-un-post-se-figent.md) | research | — |
| [Ce que l'API Instagram donne du compte, jour par jour](issues/04-ce-que-l-api-donne-du-compte.md) | research | — |
| [Garder l'historique des chiffres d'un post](issues/05-garder-l-historique-d-un-post.md) | grilling | Quand les chiffres d'un post se figent |
| [La place d'un post](issues/06-la-place-d-un-post.md) | grilling | Ce que l'API Instagram donne d'un post |
| [L'âge d'un post](issues/07-l-age-d-un-post.md) | grilling | Quand les chiffres se figent ; Garder l'historique |
| [Écarter un post de la lecture](issues/08-ecarter-un-post.md) | grilling | La place d'un post |
| [Les formats et les abonnés](issues/09-les-formats-et-les-abonnes.md) | grilling | Ce que l'API Instagram donne d'un post |
| [Le compte dans le temps](issues/10-le-compte-dans-le-temps.md) | grilling | Ce que l'API donne du compte |
| [Les règles d'analyse réglables](issues/11-les-regles-d-analyse-reglables.md) | grilling | La place ; L'âge ; Écarter un post |
| [Le carré de sélection, en maquette](issues/12-le-carre-en-maquette.md) | prototype | La place ; Écarter un post |
| [La page entière, en maquette](issues/13-la-page-entiere-en-maquette.md) | prototype | La structure ; Les formats ; Le compte dans le temps ; Le carré |
| [Ce que la récolte et le traitement doivent calculer](issues/14-ce-que-le-traitement-doit-calculer.md) | task | L'âge ; Les règles ; La page entière |
| [La spec de la page Instagram](issues/15-la-spec-de-la-page-instagram.md) | task | Ce que la récolte et le traitement doivent calculer |

## Decisions so far

<!-- une ligne par ticket clos : [titre](lien) : l'essentiel de la réponse -->

## Not yet specified

- **Le Panneau latéral « lire un post »** : ce qu'on a (image, légende, lien
  public) suffit-il, ou faut-il la vidéo, le carrousel entier, les
  commentaires ? Se précise avec la maquette de la page.
- **Les états de la page** : compte gratuit à 10 posts (une foule trop maigre
  pour une distribution ?), compte neuf, jeton mort, format qui n'a que 2 posts.
- **Les posts boostés** : un post sponsorisé garde-t-il des chiffres
  organiques purs, ou faut-il le marquer — dépend des recherches sur le post et
  sur le compte.
- **Les stories** : non récoltées aujourd'hui ; utiles ou non, selon la
  recherche sur le post.
- **La cohérence avec l'hebdo** : l'onglet Organique de la frise et la page
  Instagram doivent parler des mêmes posts avec les mêmes mots.

## Out of scope

- **Les labels / thèmes** : retirés le 2026-09-30 ; s'ils reviennent, ce sera
  une issue séparée (David, 2026-11-01).
- **Le dashboard Google Ads** et toute refonte de Meta.
