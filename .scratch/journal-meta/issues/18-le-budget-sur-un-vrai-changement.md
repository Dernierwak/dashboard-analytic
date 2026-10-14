# 18: Le budget vu sur un vrai changement

Type: task
Status: resolved
Blocked by: 16 ; pour l'écran, un changement de budget dans la fenêtre de 180 jours
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

- [x] Un vrai changement de budget est en base. Son `extra_data` est
      comparé à ce que Meta renvoie pour la même activité (forme décrite,
      noms et IDs remplacés : le dépôt est public).
- [x] Sur `/meta`, la carte affiche l'avant et l'après avec la devise donnée
      par Meta, ou « budget modifié » quand les montants manquent. Aucune
      devise n'est supposée.
- [x] Si la forme réelle diffère de la forme documentée, la récolte ou la
      lecture est corrigée, et le harnais du ticket couvre la forme réelle.
- [x] La mention « non testé » est retirée de la spec (ticket 14), de la
      carte et des commentaires du code.

## Avancement — 2026-10-14

**Le vrai changement existe.** David l'a trouvé dans l'historique d'Ads
Manager : le 2026-02-12 à 15:18 (heure de Zurich), deux ensembles de
publicités sont passés d'un budget global de 350,00 à 750,00 CHF. Le
constat du ticket 07 (« aucun depuis le 2026-01-11 ») était donc faux.

**Ce que Meta renvoie.** David a lancé un script en lecture seule, gardé hors
du dépôt. Il appelle `/activities` du 11 au 14 février avec le vrai fetcher,
pour les deux connexions. Les deux changements arrivent en
`update_ad_set_budget` avec la forme documentée :

    {"old_value": {"type": "payment_amount", "currency": "CHF", "old_value": 35000,
                   "additional_type": "status_string", "additional_value": ""},
     "new_value": {"type": "payment_amount", "currency": "CHF", "new_value": 75000,
                   "additional_type": "status_string", "additional_value": "<type de budget>"},
     "type": "composite_data"}

Les montants sont en centimes et la devise vient de Meta. `additional_value`
porte le type de budget dans la langue du jeton : « Laufzeitbudget » sur une
connexion, « Budget global » sur l'autre. La lecture actuelle n'en a pas
besoin et ne le lit pas. Elle écrit, pour les deux : « le budget du groupe
d'annonces "…" est passé de 350,00 à 750,00 CHF ». **Aucune correction
n'est nécessaire.**

**Harnais** (`harnais/18/`). `verifier.py` passe la forme réelle (noms et
IDs remplacés) dans le vrai `lignes_activites` : 10/10. Il vérifie la
phrase, la catégorie, le niveau, la campagne, `extra_data` gardé tel quel,
l'absence de devise (aucune n'est supposée) et l'absence de montant
d'arrivée (« modifié »). `budget.test.ts` vérifie que l'écran
(`lib/meta/rubriques.ts`) n'a pas de lecteur pour le budget : il rend
`phrase`, donc le panneau écrit ce `resume`. Les harnais 12 et 13
passent toujours.

« Non testé » est retiré du docstring de `_montant`, de la spec (histoire 42
et section Budget), de la carte et de l'étiquette du harnais 12.

**Ce qui reste ouvert : les critères 1 et 2.** Ces changements sont **hors
de la fenêtre de 180 jours** (`_CHANGES_JOURS_META`, qui commence
aujourd'hui au 2026-04-17). Aucun passage du worker ne les a récoltés ni
ne les récoltera, et `depuis` ne déplace pas cette fenêtre. Ils ne sont
donc ni en base ni sur `/meta`. La carte n'a pas été vue à l'écran ; elle
n'est vérifiée que par les harnais, sur la forme réelle.

Pour les fermer, deux possibilités :
- attendre un changement de budget récent, puis faire un passage du worker
  (un lancement à la main de `weekly-fetch.yml`, car le passage long du
  cron n'a lieu que le samedi) ;
- ou que David décide d'élargir la fenêtre, ce qui touche le coût de
  chaque passage.

## Réponse

La lecture du budget est confirmée sur deux vrais `update_ad_set_budget` du
2026-02-12 (350 → 750 CHF). Meta envoie la forme documentée et la phrase dit
l'avant, l'après et la devise de Meta. Aucune correction n'a été nécessaire,
et « non testé » est retiré partout.

Les critères 1 et 2 sont acceptés par David le 2026-10-14 sur la foi des
harnais (« les harnais me suffisent »), et non sur une ligne en base ni sur
un écran. L'`extra_data` a été comparé à la réponse directe de Meta, pas à
une ligne de `platform_changes`. La carte de `/meta` n'a pas été vue : ces
changements sont hors de la fenêtre de 180 jours.
