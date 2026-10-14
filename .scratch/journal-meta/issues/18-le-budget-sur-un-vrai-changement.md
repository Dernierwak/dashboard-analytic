# 18: Le budget vu sur un vrai changement

Type: task
Status: ready-for-agent
Blocked by: 16, et un vrai changement de budget sur un compte (aucun depuis le 2026-01-11)
Spec : [14](14-spec-le-journal-meta.md), histoires 15, 42 ; ticket [07](07-le-budget-sans-exemple-reel.md).

## What to build

La lecture d'un changement de budget suit la forme documentée par Meta
(montants dans `composite_data`, en centimes, avec la devise que Meta donne),
sinon « budget modifié ». Faute d'exemple, elle n'a jamais été éprouvée sur un
vrai changement. Dès qu'un changement de budget existe sur un compte et qu'un
passage du worker l'a récolté, le ticket vérifie que la carte du journal dit
les montants et la devise envoyés par Meta. Ensuite, il retire la mention
« non testé ».

Le ticket attend : il ne se travaille qu'une fois l'événement survenu. Aucune
valeur ne se fabrique pour le simuler.

## Acceptance criteria

- [ ] Un vrai changement de budget est en base. Son `extra_data` est
      comparé à ce que Meta renvoie pour la même activité (forme décrite,
      noms et IDs remplacés : le dépôt est public).
- [ ] Sur `/meta`, la carte affiche l'avant et l'après avec la devise donnée
      par Meta, ou « budget modifié » quand les montants manquent. Aucune
      devise n'est supposée.
- [ ] Si la forme réelle diffère de la forme documentée, la récolte ou la
      lecture est corrigée, et le harnais du ticket couvre la forme réelle.
- [ ] La mention « non testé » est retirée de la spec (ticket 14), de la
      carte et des commentaires du code.

## Avancement — 2026-10-14

Toujours en attente. David confirme qu'aucun budget Meta n'a été changé
depuis le 2026-10-11 ; le dernier passage du worker (run `38502344781`,
2026-10-14) n'a donc rien pu récolter de tel. Rien n'est construit ni retiré
tant que l'événement n'existe pas.

Pour reprendre : un budget changé dans Meta, puis un lancement à la main de
`weekly-fetch.yml` (`force`, `user_id` du compte) — le cron ne fait son
passage long que le samedi. Ensuite, chercher en base la ligne Meta
`categorie = budget` et comparer son `extra_data` à la forme documentée
(`_phrase_budget`, `saas/data/fetch_data/sources/meta/ads/fetchers/activities.py`).
