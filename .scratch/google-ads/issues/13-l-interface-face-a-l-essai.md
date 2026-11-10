# 13: Ce que l'interface Google Ads affiche, face à l'essai

Type: task
Status: claimed
Blocked by: —
Assignee: David (relevé HITL)

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

## Relevé par l'API (2026-11-10)

David a demandé de passer par l'API plutôt que par l'interface : l'identité
Google ouverte dans Chrome n'atteint pas le compte A (seulement B, à 0 en
octobre). Script jetable, lecture seule, API v26, hors dépôt. Noms d'actions
anonymisés.

### 1 · Totaux d'octobre 2026, compte A

Impressions 182 679 · clics 15 688 · coût 8 703,37 CHF · conversions 303,69 ·
valeur 6 269,25 · CTR recalculé 8,5877 % (Google : 8,59 %) · CPC recalculé
0,5548 (Google : 0,55). **Non confronté à l'écran** : l'API est la source de
ce que montre l'interface, mais l'égalité avec la ligne Total n'a pas été vue.

Les 303,69 se décomposent en quatre actions principales :

| Action (anonymisée) | Réglage valeur API | Conversions | Valeur |
|---|---|---|---|
| achat (balise) | par événement (`always_use_default_value = false`) | 66,56 | 6 099,91 |
| achat (serveur, doublon du précédent) | 0 imposé | 66,79 | 0 |
| clic billet | **1 imposé** | 169,34 | **169,34** |
| formulaire newsletter | 0 imposé | 1,00 | 0 |

### 2 · Ce que font les réglages (35 actions actives)

- **Défaut imposé (`always_use_default_value = true`)** : la valeur rendue
  vaut **exactement défaut × conversions**, sur toutes les actions sans
  exception (ratio 1,000 avec 1, 0,000 avec 0). Avec 1, la « valeur » est le
  nombre de conversions déguisé en francs.
- **Par événement (`false`)** : vraie valeur, ratio 68 à 150 CHF par
  conversion — **sauf une action** (ratio 1,000) dont les événements arrivent
  sans valeur : le défaut 1 s'applique alors. `false` ne garantit donc pas une
  valeur réelle.
- La doc (`ConversionAction.ValueSettings`) ne nomme pas l'option de
  l'interface « Ne pas utiliser de valeur » ; la correspondance avec
  « 1 imposé » **reste non vérifiée**.
- En passant : l'achat est compté deux fois dans `metrics.conversions`
  (balise + serveur, les deux principales). Ticket 05 : pas de dédoublonnage
  maison — on affiche ce que Google affiche.
