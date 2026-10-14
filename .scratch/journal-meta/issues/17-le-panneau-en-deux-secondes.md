# 17: Le panneau qui met deux secondes à s'ouvrir

Type: task
Status: resolved
Blocked by: 16
Spec : [14](14-spec-le-journal-meta.md), Further Notes.

## What to build

En local, le panneau du journal met environ deux secondes à s'ouvrir après un
clic sur un point (ticket 13). Le ticket mesure ce délai en production, avec
les vraies données. Si la lenteur se confirme, il en trouve la cause et la
corrige, pour que le panneau s'ouvre sans attente perceptible.

L'état du panneau (jour, élément) vit dans l'URL, et ça ne se négocie pas
(histoire 36) : la correction garde le lien partagé et le retour arrière.

## Acceptance criteria

- [x] Le temps entre le clic et le panneau ouvert est mesuré sur `/meta` en
      production, sur au moins trois ouvertures. Les chiffres sont écrits
      dans la réponse.
- [x] Si le délai est imperceptible, le ticket se ferme avec la mesure,
      sans rien changer au code.
- [x] Sinon, la cause est nommée avec sa preuve (requête réseau, rendu
      serveur, volume lu…), et non supposée. La correction est mesurée
      avant/après sur la même page.
- [x] Après correction : le panneau ouvert reste dans l'URL, un lien
      partagé ou un retour arrière rouvre le même jour et le même élément,
      et un second clic sur l'onglet actif referme le panneau.
- [x] `tsc` et `build` verts sur un `.next` vidé, 18 routes.

## Mesure avant — production, 2026-10-14

Chronométrée dans Chrome sur `/meta` en production : du `router.push` du point
jusqu'au panneau à l'écran, à froid.

| Jour | Panneau ouvert | Requête RSC (1er octet → fin) |
|---|---|---|
| 8 oct. | 1 720 ms | 366 → 1 708 ms, 6 Ko |
| 10 oct. | 1 982 ms | 307 → 1 969 ms, 6 Ko |
| 12 oct. | 2 124 ms | 315 → 2 107 ms, 6 Ko |

Un jour déjà visité se rouvrait en 17 ms, servi par le cache du routeur.

## La cause, avec sa preuve

Le témoin : `/meta?temoin=1` puis `?temoin=2`, **sans aucun panneau**, mettent
2 906 et 1 797 ms (premier octet à 425 et 285 ms). Le panneau ne coûte donc
rien en lui-même. Chaque `router.push` relance le rendu serveur complet
d'une page `force-dynamic` : `getDonneesMeta` relit toutes les données pour
renvoyer 6 Ko de différence.

## La correction

Le panneau du journal (jour d'un point, élément de la Comparaison, onglet
« Changements ») se calcule dans le navigateur, depuis le journal de la
période que la page a déjà lu (`components/meta/journal-ouvert.tsx`). L'URL
change par `history.pushState` / `replaceState`, que Next 14.2.5 synchronise
avec `useSearchParams` et recopie dans l'historique (`lib/meta/sur-place.ts`).
Aperçus et l'annonce lue restent rendus par le serveur.

La relecture (deux agents : règles du dépôt, et ticket) a trouvé deux défauts,
corrigés dans `adeb7e3` :
- un lien construit sur les paramètres du dernier rendu serveur rouvrait un
  jour refermé sur place. La page donne désormais à ses liens les
  paramètres sans l'état du journal (`sansJournal`) ;
- avec un journal illisible, l'onglet « Changements » s'allumait pour un
  panneau absent.

La règle « ce que l'URL ouvre », écrite trois fois, vit maintenant dans
`panneauDemandeDe` (`lib/meta/changements.ts`).

## Mesure après — preview de la branche, mêmes données

Sur la preview `journal-meta/carte` (même base Supabase), période du 30 sept.
au 6 oct., de vrais clics à la souris, chronométrés du `pointerdown` à
l'apparition du panneau :

| Ouverture | Panneau ouvert | Requêtes au serveur |
|---|---|---|
| Point de la Tendance, 30 sept. (18 changements) | 25 ms | 0 |
| Le même, 2e fois | 15 ms | 0 |
| Le même, 3e fois | 12 ms | 0 |
| Point de la Comparaison (une annonce) | 12 ms | 0 |
| Onglet « Changements » (toute la période) | 16 ms | 0 |
| Fermeture par la croix | 3 ms | 0 |

Vérifié au même passage :
- « retour » referme le panneau et « suivant » le rouvre, sans requête au
  serveur ;
- un rechargement de `?jour=2026-09-30`, l'équivalent d'un lien partagé,
  rend le panneau au rendu serveur, avec l'onglet allumé ;
- un clic sur l'onglet actif referme le panneau, et l'URL perd `jour` ;
- après ce rechargement suivi d'une fermeture, le lien « Voir cette vue »
  ne porte plus `jour` : le défaut de la relecture ne se reproduit pas ;
- l'URL porte `jour` et `element`, rien ne déborde à droite (bord du
  panneau à 1 780 px pour 1 792), aucun défilement horizontal.

`tsc` et `build` sont verts sur un `.next` vidé, avec 18 routes.

## Réponse

Le panneau mettait 1,7 à 2,1 s à s'ouvrir parce que chaque clic relisait
toute la page sur le serveur. Il s'ouvre maintenant en 12 à 25 ms, sans
aucune requête au serveur, et garde son URL, le retour arrière et le lien
partagé.

Écrit tel quel :
- la mesure « après » est faite sur la preview de la branche, pas sur le
  domaine de production. Elle se refait sur la production une fois la PR
  fusionnée ;
- non traité : ouvrir un jour pendant que le panneau Aperçus ou l'annonce
  lue est ouvert (rendu serveur) afficherait deux panneaux. À la souris,
  c'est impossible, puisque le voile du panneau couvre les graphes ;
- Aperçus et l'annonce lue gardent leur délai d'environ 2 s : ils sont rendus
  par le serveur, et hors du périmètre de ce ticket.
