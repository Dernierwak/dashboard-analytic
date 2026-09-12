# Les six règles payantes restantes

Type: task
Status: open
Blocked by: 07

## Question

**Tranché par [24](../../refonte/issues/24-conseils-payants-manquants.md)**, qui
a décidé dix règles et en a fait livrer quatre d'abord (ticket **07**). Voici les
six autres.

| clé | ce que le client lit | geste | levier | preuve |
|---|---|---|---|---|
| `adset_inegal` | ton Groupe « Retargeting » coûte 3× « Lookalike » | tester | audience | **à mesurer** |
| `theme_deux_regies` | ce thème rend 4× mieux sur Google — bascule 25 % | tester | argent | **à mesurer** |
| `budget_non_depense` | 25 CHF/jour posés, 9 dépensés | corriger | argent | constatable |
| `annonce_usee` | même personne touchée 2,3×/jour, le clic double | créer | contenu | constatable |
| `page_arrivee_muette` | 640 clics envoyés, GA4 en compte 180 | corriger | socle | constatable |
| `creneau_pub` | le dimanche coûte 2× la semaine | corriger | tempo | constatable |

### Pourquoi elles passent en second

Elles ne se livrent pas seules : certaines portent un seuil qui n'est pas déjà
dans `SEUILS`, et les deux marquées **« à mesurer »** ouvrent une Stratégie — donc
elles dépendent du plan de thème rebranché (ticket **06**).

**Le fait qui les débloque** : `docs/mesures-impossibles.md` §1 était faux — la
date **EST** dans `ga4_insights`, c'est `build_ga4_context` qui l'écrase. Le
revenu hebdomadaire d'un thème devient mesurable, **donc un compte payant peut
enfin ouvrir une Stratégie**. Avant ce constat, seules les clés organiques le
pouvaient (22).

### Les deux pièges nommés d'avance

- **`annonce_usee` repose sur la fréquence, donc sur `reach`** — des personnes
  **dédoublonnées**, qui ne se somment pas. Toute tentative future d'ajouter un
  breakdown Meta à la même table la fausserait sans rien lever
  ([23](../../refonte/issues/23-recolte-des-quatre-manques.md), hors périmètre
  ici, mais le relevé vaut avertissement).
- **`page_arrivee_muette` nomme un écart, pas une page** : GA4 n'a aucune
  dimension de page aujourd'hui (`fetch_ga4.py:86`). La règle dit « ta page perd
  des gens », elle **ne peut pas dire laquelle** — et l'écrire quand même serait
  un chiffre fabriqué.

### Consigne de repli

Les quatre `constatable` d'abord, les deux `à mesurer` ensuite : elles dépendent
d'une Stratégie ouverte, donc du ticket 06 réellement en service.
