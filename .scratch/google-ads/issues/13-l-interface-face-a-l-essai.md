# 13: Ce que l'interface Google Ads affiche, face à l'essai

Type: task
Status: open
Blocked by: —
Assignee: —

## Question

L'essai réel (ticket 10) a lu l'API ; deux faits ne se lisent que dans
**l'interface Google Ads**, que l'agent ne peut pas ouvrir. HITL : David relève,
sur le compte choisi dans Pulse (compte A du ticket 03).

1. **Totaux d'octobre 2026** — Campagnes, période du 1ᵉʳ au 31 octobre 2026,
   ligne Total : impressions, clics, coût, **colonne « Conversions »**, CTR,
   CPC moyen. L'API rend : 182 679 · 15 688 · 8 703,37 CHF · 303,69 · 8,59 % ·
   0,55. Égal → `metrics.conversions` est bien la colonne « Conversions » et
   les taux calculés sur les totaux (05) retrouvent l'interface.
2. **Ce que veulent dire les valeurs par défaut** — Objectifs › Conversions ›
   Résumé, pour deux ou trois actions **principales** : le réglage « Valeur »
   affiché (« Utiliser la même valeur pour chaque conversion », « Utiliser des
   valeurs différentes », **« Ne pas utiliser de valeur »**). L'API rend, pour
   8 des 13 actions principales, une valeur par défaut de 1 imposée ; pour 4,
   de 0. Il s'agit de savoir si « 1 imposé » veut dire « aucune valeur » :
   c'est ce qui décidera quand la page affichera « — » au lieu d'une valeur et
   d'un ROAS (ticket 05).

## Rendu attendu

Les deux relevés, écarts compris, et la règle qui en sort pour détecter
« aucune valeur de conversion déclarée ».
