# 07: Le budget sans exemple réel

Type: task
Status: resolved

## Question

Peut-on lire « budget 20 → 35 CHF » sans avoir vu un vrai changement de budget ?

## Answer

Aucun exemple : `platform_changes` n'a jamais gardé de changement de budget
Meta, et `/activities` depuis le 2026-01-11 n'en rend aucun (vérifié par David
le 2026-10-11 ; `category=BUDGET` ne rend que la facturation). Décision : la
récolte lit le montant selon la forme `composite_data` (vue sur `create_ad_set`,
centimes) ; si elle ne le trouve pas, « budget modifié ». Le ticket de
construction le dit **non testé** jusqu'au premier vrai changement.

## Correction — 2026-10-14

Le constat « aucun depuis le 2026-01-11 » est faux : deux budgets d'ensembles
de publicités sont passés de 350 à 750 CHF le 2026-02-12. Meta les renvoie en
`update_ad_set_budget`, dans la forme documentée. La lecture est donc
confirmée (ticket 18).
