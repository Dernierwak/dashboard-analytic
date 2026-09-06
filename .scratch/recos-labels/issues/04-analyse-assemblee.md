Type: grilling
Status: resolved
Blocked by: 01, 02, 03

## Question

Comment assembler, dans le module "Analyse" (3) du Graphe B, GA4 (conversions
et revenu du thème) + l'objectif spécifique du thème (vente, lead, followers,
vues — réponse initiale de David) + les résultats des modules 2A/2B en un
jugement explicite — sachant que ce jugement doit arriver *après* 2A/2B, pas
avant, et que les morceaux (`_kpis_du_theme()`, lecture de l'objectif)
existent déjà séparément sans être assemblés ?

**Mise à jour post-ticket 01** : la première sous-question est déjà répondue.
Un objectif propre par thème existe depuis le 27 août 2026 — `_obj_theme()`
(`build_report.py:1853-1865`, alimenté par `fetch_theme_objectifs`) — affiché
dans `theme-objectif-mini.tsx`, mais **strictement descriptif** ("Objectif :
Plus de ventes · Conversions : achat") : aucun calcul de progression, aucun
verdict. C'est un champ propre au thème, indépendant du profil compte de la
carte sœur — pas besoin d'attendre le ticket 05 de `recos-generales`.
Le vrai travail de ce ticket reste entier : personne n'assemble encore
`_kpis_du_theme()` + cet objectif + le verdict de l'hypothèse (ticket 03) en
un jugement du type "tu es à X % de ton objectif, voilà pourquoi".

À trancher avec David :
- Réponse initiale de David sur la priorisation : "on améliore le tout, ou
  les points les plus impactants pour arriver à l'objectif" — comment
  l'Analyse tranche entre ces deux modes selon la situation du thème ?
- Une fois le jugement rendu, comment il s'articule avec la règle de
  composition déjà décidée (2 recos de suivi + 1 idée neuve si pertinente,
  arbitrées par les retours client) — le jugement influence-t-il l'arbitrage
  des retours client, ou reste-t-il un filtre séparé en amont ?
- Comment ce jugement se distingue des 7 critères de tri du compte
  (`_importance()`, Graphe A) sans les dupliquer inutilement.

## Answer

Fait vérifié en cours de route : **aucune cible chiffrée n'existe nulle
part** pour un objectif de thème. `theme_objectifs.objectif`
(`000_run_me_all.sql:1280-1295`) est un enum catégoriel
(`ventes`/`notoriete`/`engagement`), pas un montant ou une quantité visée —
vérifié dans le schéma, `fetch_theme_objectifs`, `_obj_theme()`, et par grep
sur `saas/web/` (aucune saisie de valeur numérique).

Décisions de David :
1. **Le jugement affiche un vrai % mesuré d'amélioration** (pas un %
   fabriqué de complétion d'objectif, puisque cette cible n'existe pas) —
   basé sur la variation réelle de l'événement GA4 correspondant au type
   d'objectif du thème (ex. objectif `ventes` → événements catégorisés
   "Ventes" via `saas/recos_ia/categorizing.py`), comparée à la période
   précédente. Reste à vérifier au moment de construire : quel événement GA4
   représente `notoriete` et `engagement` (le catalogue actuel documente
   Ventes/Contacts/Engagement, pas explicitement "notoriété") — détail de
   construction, pas une nouvelle décision.
2. **Signal de bascule "améliorer tout" vs "cibler le plus impactant"** :
   l'état d'avancement vers l'objectif — loin de l'objectif avec le temps qui
   presse → cibler le levier le plus impactant ; en bonne voie → élargir.
3. **Le jugement influence la composition finale**, pas seulement un texte
   décoratif à côté : en mode "cibler le plus impactant", les recos
   alignées sur le levier le plus impactant vers l'objectif sont favorisées
   dans l'arbitrage (2 suivi + 1 idée neuve, retours client).
4. **Pas de chevauchement avec `_importance()` confirmé** : deux étages
   distincts — le tri du compte choisit *quels* thèmes sont couverts (jusqu'à
   3 thèmes favoris choisis par le client, **à égalité entre eux, aucune
   priorité relative**) ; ce jugement opère *à l'intérieur* de chaque thème
   déjà sélectionné, une fois le tri fait.

