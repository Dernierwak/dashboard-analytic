# 19: Le jour où une annonce commence à diffuser

Type: task
Status: needs-triage
Blocked by: None

## Le constat

David, le 2026-10-14, en comparant l'historique d'Ads Manager d'une annonce
avec le panneau de Pulse : Ads Manager montre « Publicité distribuée — Début
de la distribution » (le 27 août, par « Meta »), et Pulse ne le montre pas.
Les cinq autres événements de cette annonce sont en base, avec les mêmes
heures et le même avant → après.

## Pourquoi il manque

La récolte ne garde qu'une liste fermée de types (`_ACTIVITES`,
`saas/data/fetch_data/sources/meta/ads/fetchers/activities.py`), faite des
gestes du client. Le début de la distribution est écrit par Meta. C'est très
probablement `first_delivery_event`, que la recherche
(`recherche/activities.md`) range parmi les types existants non retenus. Le nom
exact n'est **pas vérifié** sur un vrai compte.

## À trancher

- Le montrer ? C'est un fait de la plateforme, pas un geste : Pulse montre
  « les faits survenus sur les plateformes » (CLAUDE.md §1), mais a écarté
  la revue de Meta (`ad_review_*`) pour la raison inverse.
- Si oui, sous quelle catégorie : une nouvelle (`diffusion` ?) demande de
  toucher la CHECK de `categorie` dans le `000`, et l'écran doit savoir
  l'afficher.
- Vérifier d'abord le nom du type par un essai local
  (`check_data_collection.py`).
