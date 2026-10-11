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
- [Le budget sans exemple réel](issues/07-le-budget-sans-exemple-reel.md) : aucun
  changement de budget sur le compte depuis le 2026-01-11 ; montant lu selon la
  forme documentée, sinon « budget modifié », et dit non testé.
- [Les points de la Comparaison](issues/08-les-points-de-la-comparaison.md) : un
  point par ligne, de la couleur de la ligne ; le clic n'ouvre que cet élément.
- [Repartir d'une base saine](issues/09-repartir-d-une-base-saine.md) : les
  anciennes notes sont parties avec `1b05a92` ; le code reste.
- [Le prototype de l'écran](issues/10-le-prototype-de-l-ecran.md) : validé en
  version 8 — filtre groupe d'annonces, onglets « Changements » et « Aperçus »
  à droite, aucun point sur l'axe, ligne mise en avant sur la Comparaison,
  panneau statut › « Actuel » › avant / après.

## Pas encore spécifié

- **Les catégories de `platform_changes`.** L'objectif et le calendrier n'ont
  pas de catégorie dans la contrainte CHECK : à ranger au ticket 11, sans
  supprimer de ligne.
- **La vérification du budget** une fois qu'un vrai changement existera sur un
  compte.
- **Les lignes de plus de 180 jours**, que la récolte ne relit plus : elles
  gardent leur ancienne phrase, sauf si le brut est gardé (ticket 11).

## Hors périmètre

- **Mettre `CLAUDE.md` à jour** après le retrait de `CONTEXT.md`, `BACKLOG.md`
  et `docs/` : voulu par David, mais `CLAUDE.md` y renvoie encore. Chantier à
  part.
- **Traduire les valeurs de Meta** dans la langue de l'application : refusé
  (ticket 04).
- **Comparer des montants ou des nombres** entre avant et après : écarté comme
  une pièce fragile de plus (ticket 06). Seule la comparaison texte contre
  texte est en essai.
