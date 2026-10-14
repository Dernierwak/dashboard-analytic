# Carte — Le journal Meta qui dit ce qui a changé

Label: `wayfinder:map`
Chartée le 2026-10-11, à partir de la demande de David (le journal Meta dit
« le ciblage du groupe d'annonces X a été modifié » sans dire quoi) et de cinq
tours de questions.

## Destination

Sur `/meta`, en production : chaque changement Meta dit **quel élément**
(campagne, groupe d'annonces ou annonce, avec son nom), **ce qui a été fait**,
et **de quoi à quoi** quand Meta le donne. Les changements se lisent depuis
chaque ligne des graphiques de la Comparaison, et depuis un onglet qui montre
tous les changements de la période, filtrés comme la page — filtre par groupe
d'annonces compris.

## Notes

**Cette carte va jusqu'à la construction.** David : « finir ce qui manque » sur
la base actuelle. Les tickets de décision d'abord ; une fois le prototype
validé et le schéma tranché, les tickets de construction s'ajoutent ici.

**On repart du code, pas des anciennes notes.** Les notes de la refonte Meta Ads
(`.scratch/meta-ads/`) ont quitté l'arbre avec `1b05a92`, voulu par David. Le
code de `/meta` est la base ; on ne rouvre pas ses décisions.

**Le dépôt est public.** Aucun ID de compte, aucun nom de campagne du client
dans ces fichiers : les exemples Meta sont décrits par leur forme, noms
remplacés. Les vraies réponses restent dans la conversation et dans le
prototype (privé).

**Où vit le code touché.**
- Récolte : `saas/data/fetch_data/sources/meta/ads/fetchers/activities.py`
  (`_ACTIVITES`, `_traduire_meta`, `lignes_activites`).
- Schéma : `saas/data/supabase/migrations/000_run_me_all.sql`, table
  `platform_changes`.
- Écran : `saas/web/lib/meta/changements.ts`, `components/meta/panneau.tsx`,
  `journal-du-jour.tsx`, `tendance.tsx`, `comparaison.tsx`, `bandeau.tsx`.

**Règles qui ne se négocient pas ici.** Rien de traduit dans l'application
(ticket 04). Un changement réel n'est jamais jeté sans rien dire : au pire,
« modifié ». Aucune valeur inventée. Les colonnes s'ajoutent, rien ne se
supprime. Une correction de la récolte ne se voit qu'après un passage du worker
(`weekly-fetch.yml` à la main, ou le cron du Jour de travail).

**Skills.** `grilling` et `domain-modeling` en cas de doute ; `prototype` pour
le ticket 10.

## Décisions déjà prises

- [Ce que le panneau dit d'un changement](issues/01-ce-que-le-panneau-dit-d-un-changement.md) :
  l'élément et son nom, le geste, et avant → après quand Meta le donne ; sinon
  « modifié ».
- [Les exemples réels de `extra_data`](issues/02-les-exemples-reels-d-extra-data.md) :
  obtenus par l'Explorateur Graph ; statut = libellé localisé + code chiffré,
  ciblage = listes lisibles, créa = image/titre/texte, et le `campaign_id` d'un
  changement d'annonce est l'ID du **groupe d'annonces**.
- [Ce que l'API `/activities` documente](issues/03-ce-que-l-api-activities-documente.md) :
  presque rien sur `extra_data` ; `object_type` n'est pas fiable pour le niveau ;
  le filtre `category` existe dans le SDK.
- [La langue des valeurs](issues/04-la-langue-des-valeurs.md) : on affiche ce
  que Meta envoie, sans traduire ; la logique se fonde sur les codes chiffrés.
- [Le statut regroupé](issues/05-le-statut-regroupe.md) : une ligne par élément
  et par jour, qui montre le chemin avec ses heures.
- [Les modifications sans différence](issues/06-les-modifications-sans-difference.md) :
  aucun filtre — Meta ne donne aucun champ qui dise « rien n'a changé ».
  Rouvert en partie : le résumé de ce qui a changé compare avant et après,
  texte contre texte (à confirmer, voir le prototype).
- [Le budget sans exemple réel](issues/07-le-budget-sans-exemple-reel.md) : montant
  lu selon la forme documentée, sinon « budget modifié ». Forme confirmée sur
  deux vrais changements du 2026-02-12 ([ticket 18](issues/18-le-budget-sur-un-vrai-changement.md)).
- [Les points de la Comparaison](issues/08-les-points-de-la-comparaison.md) : un
  point par ligne, de la couleur de la ligne ; le clic n'ouvre que cet élément.
- [Repartir d'une base saine](issues/09-repartir-d-une-base-saine.md) : les
  anciennes notes sont parties avec `1b05a92` ; le code reste.
- [Le prototype de l'écran](issues/10-le-prototype-de-l-ecran.md) : validé en
  version 11 — filtre groupe d'annonces, onglets « Changements » et
  « Aperçus » à droite, ligne mise en avant sur la Comparaison, une carte par
  changement : statut › « Actuel » › avant / après.
- [Le schéma de `platform_changes`](issues/11-le-schema-de-platform-changes.md) :
  l'élément touché (`object_id`, `object_name`, `niveau`, `adset_id`) et
  `extra_data` tel que Meta l'envoie ; tout se lit à l'affichage ; catégories
  `objectif` et `calendrier`.
- [La récolte garde l'élément et ce que Meta envoie](issues/12-la-recolte-ecrit-les-phrases-precises.md) :
  construite et éprouvée hors ligne (harnais 24/24) ; le groupe d'une annonce
  vient aussi de la hiérarchie des insights ; attend le `000` et un passage du
  worker pour se voir en base.
- [L'écran du journal](issues/13-l-ecran-du-journal.md) : construit sur
  `journal-meta/carte`, vu avec les vraies données et validé par David le
  2026-10-14 ; reste à rejoindre `main`.
- [La spec du journal Meta](issues/14-spec-le-journal-meta.md) : la
  fonctionnalité entière en une page — histoires, décisions, les trois
  coutures de test (récolte, lecture d'`extra_data`, mise en page du
  journal) et ce qui reste à faire.

## À construire

Découpés depuis la spec (ticket 14) le 2026-10-14, validés par David.

- [Le journal Meta rejoint `main`](issues/15-le-journal-rejoint-main.md) —
  **fait** le 2026-10-14 : PR #6 fusionnée, Vercel vert.
- [Les 180 derniers jours portent leur détail en production](issues/16-les-180-jours-en-production.md) —
  **fait** le 2026-10-14 : passage lancé à la main sur `main`, vérifié en
  base et dans Chrome ; 18 lignes de l'ancien code effacées avec l'accord de David.
- [Le panneau qui met deux secondes à s'ouvrir](issues/17-le-panneau-en-deux-secondes.md) —
  **fait** le 2026-10-14 : 1,7–2,1 s → 12–25 ms, le journal s'ouvre sans
  repasser par le serveur ; à fusionner sur `main`.
- [Le budget vu sur un vrai changement](issues/18-le-budget-sur-un-vrai-changement.md) —
  **fait** le 2026-10-14 : forme confirmée sur deux vrais changements du
  2026-02-12, rien à corriger ; accepté par David sur la foi des harnais (hors
  de la fenêtre de 180 jours, donc ni en base ni à l'écran).

- [Le jour où une annonce commence à diffuser](issues/19-le-debut-de-la-distribution.md) —
  **fait** le 2026-10-14 : `first_delivery_event` vérifié sur un vrai
  compte, montré sous la nouvelle catégorie `diffusion` (décision de David),
  `000` appliqué ; accepté par David sur la foi des harnais, pas encore vu en
  base (fusion et passage du worker reportés).
- [Qui a fait le changement — une personne ou Meta](issues/20-qui-a-fait-le-changement.md) —
  à trancher par David.

## Hors périmètre

- **Mettre `CLAUDE.md` à jour** après le retrait de `CONTEXT.md`, `BACKLOG.md`
  et `docs/` : voulu par David, mais `CLAUDE.md` y renvoie encore. Chantier à
  part.
- **Traduire les valeurs de Meta** dans la langue de l'application : refusé
  (ticket 04).
- **Comparer des montants ou des nombres** entre avant et après : écarté comme
  une pièce fragile de plus (ticket 06). Seule la comparaison texte contre
  texte est en essai.
