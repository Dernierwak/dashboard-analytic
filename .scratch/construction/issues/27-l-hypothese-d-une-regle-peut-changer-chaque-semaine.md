# L'Hypothèse d'une règle peut changer de théorie toutes les semaines

Type: task
Status: resolved

## Question

**Trouvé par la revue de code du ticket [07](07-quatre-regles-payantes.md)**,
mais la cause est dans le ticket [06](06-rebrancher-le-plan-de-theme.md) : ce
n'est pas un défaut des quatre règles payantes, qui sont **toutes
« constatable »** (`role="generale"`) et n'ouvrent donc aucune Stratégie.
`CLAUDE.md` §4 : ça devient un ticket, pas un détour silencieux.

### Le fait

Depuis 06, une reco-règle peut porter `role="hypothese"` — `_GESTE_REGLE` en
donne deux : `orga_essoufflement` et `page_endormie`. Une Hypothèse écrit
`theme_plan`, ouvre une Stratégie sur son thème et attend son Verdict.

La boucle d'écriture de `theme_plan` (`build_payload`, après `themes_focus`)
porte bien une garde anti-réécriture, **mais elle ne tient que sur la MÊME
clé** :

```python
if _plan and _plan.get("reco_key") == _hyp.get("key") and _plan.get("decided_at"):
    ...
    if _decided0 and (today - _decided0).days < _attente0:
        continue   # déjà suivie, rien à réécrire
```

Un thème organique dont les trois places alternent entre `page_endormie` une
semaine et `orga_essoufflement` la suivante change donc de `reco_key` à chaque
rapport, la garde ne s'applique jamais, et `theme_plan` repart sur un
`decided_at = today` neuf **chaque semaine**. C'est exactement ce que
`ATTENTE_MIN_NOUVELLE_HYPOTHESE` existe pour empêcher : *« ne pas changer de
théorie après un seul cycle, lui laisser 1 à 2 cycles pour prouver qu'elle ne
marche pas »*.

Le blocage qui, lui, tient compte du changement de clé — celui qui réaffiche
l'hypothèse du plan actif tant que son verdict n'est pas tombé — vit **à
l'intérieur de la branche `_ia_redigee`**. Le chemin des conseils-règles ne
l'a pas.

### Un second point, plus petit, même endroit

`_forcer_une_hypothese` n'est appelée que sur le chemin Gemini. Sur le chemin
des règles, `page_endormie` et `orga_essoufflement` peuvent sortir **toutes les
deux** dans les trois places d'un même thème : la carte porte alors deux
Hypothèses, et `next(...)` en retient une au hasard de l'ordre de tri pour
écrire `theme_plan`. Rien ne casse — la contrainte `UNIQUE (user_id, theme)`
tient — mais le client lit deux théories concurrentes sur le même thème, et
une seule est suivie sans que la carte dise laquelle.

### Ce qu'il faut trancher

- **La garde d'attente doit-elle porter sur le THÈME plutôt que sur la clé ?**
  « Une théorie par thème à la fois » se défendrait mieux que « une théorie par
  clé » — mais ça change ce qu'un Verdict mesure, et ça se vérifie avant de se
  décider.
- **Le chemin des règles doit-il forcer une seule Hypothèse**, comme le chemin
  Gemini ?

### Ce que ce ticket NE remet pas en cause

Le ticket 07 et ses quatre règles : aucune n'ouvre de Stratégie. Ce ticket ne
les touche pas.

### Consigne de repli

Rendre la mesure : combien de lignes `theme_plan` du compte de David portent un
`reco_key` de règle, et combien ont vu leur `decided_at` bouger d'une semaine à
l'autre. Sans ce compte, on ne sait pas si le problème est théorique ou vécu.

---

## Réponse

Mesuré d'abord, tranché ensuite. Le harnais
[`27-une-theorie-par-theme`](../harnais/27-une-theorie-par-theme/LISEZMOI.md)
porte les scripts de mesure, les 17 vérifications et le détail complet.

### Une correction de cap, avant tout le reste

Le ticket situait le blocage d'attente « à l'intérieur de la branche
`_ia_redigee` ». **Cette branche n'existe plus** — tout le bloc vit sous
`if _conseille:`, et le chemin des conseils-règles **a** l'épinglage. Le défaut
n'était donc pas son absence, mais son **désaccord** avec la garde d'écriture :
deux endroits répondaient à la même question avec deux conditions différentes.

### Ce que la mesure a montré

La base ne répond plus, donc le comptage sur le compte de David **n'a pas pu
être fait** — il reste à faire. À la place, la même construction a été rejouée
hors ligne, semaine après semaine. Trois défauts, dont un que le ticket ne
nommait pas :

1. **Deux théories sur le même thème, toutes les semaines** — `adset_inegal` et
   `page_endormie` ensemble ; `theme_plan` n'en suivait qu'une, et la carte ne
   disait pas laquelle. Le second point du ticket, confirmé.
2. **Le compteur repartait quand l'épinglage lâchait** — ligne sans `snapshot`,
   ou verdict tombé : la carte servait la règle la mieux classée pendant que la
   garde cherchait l'ancienne **clé**. Le premier point du ticket, confirmé.
3. **La Stratégie épinglée pouvait s'afficher DEUX FOIS** — quand le plan portait
   la *seconde* Hypothèse de la carte, sa version mémorisée remplaçait la
   *première*, et la règle du jour restait à côté. Trouvé en mesurant.

### Les deux questions, tranchées

**« La garde d'attente doit-elle porter sur le THÈME plutôt que sur la clé ? »
— oui, et ce n'est pas une règle nouvelle.** La question « cette Stratégie
tourne-t-elle encore ? » est maintenant produite **une seule fois**, là où
l'épinglage la calcule (`_plans_en_cours`), et la boucle d'écriture la **lit**
au lieu de la refaire.

Ça ne change pas ce qu'un Verdict mesure — l'inquiétude du ticket — et c'est
pour ça que cette forme-là a été retenue : un thème n'entre dans
`_plans_en_cours` que quand sa carte **rejoue** la Marche du plan, même
`reco_key`, même baseline. Quand la Stratégie est finie, le thème n'y est pas,
la nouvelle Hypothèse s'écrit avec sa propre date, et le Verdict suivant mesure
bien ce cycle-là.

**« Le chemin des règles doit-il forcer une seule Hypothèse ? » — oui.**
`_une_seule_hypothese` (`build_report.py`) tranche **entre** le classement et la
coupe à trois : après le tri, parce que « la meilleure » n'a de sens qu'une fois
`_importance` passé ; avant la coupe, pour que la place libérée revienne à un
vrai conseil au lieu d'amputer la carte. L'arbitre est `_importance` et pas
`_enjeu` — une règle organique ne déclare aucun enjeu en francs, et inventer une
échelle commune serait trancher là où la donnée ne tranche pas (`CLAUDE.md` §7).
L'arbitrage de `regles_payantes` reste : quand les deux candidates sont
payantes, l'argent en jeu dit mieux laquelle garder.

### Vérifié

`python3.12 -m py_compile` sur les deux fichiers touchés, les 17 vérifications
du harnais 27, et **les 56 fichiers de `jouer_tout.py` — tout passe**. Deux
assertions de texte des harnais 06 et 08 ont dû être réécrites : elles
recopiaient le code exact de deux lignes que ce ticket réécrit, et prouvent
maintenant la même chose sur des repères qui ne se périment plus.

**Rien ne se verra à l'écran avant un passage du worker** : cette correction
touche le traitement. Le cron du Jour de travail (07:00 UTC), ou un lancement à
la main depuis l'onglet **GitHub Actions** (`weekly-fetch.yml`, `report_only`).

### Ce qui reste ouvert

- **Le comptage sur le compte de production** demandé par la consigne de repli.
- Ticket [51](51-un-verdict-libere-la-strategie-d-un-autre-theme.md), ouvert en
  faisant celui-ci : le verdict qui lève l'épinglage est indexé par `reco_key`
  sur **tout le compte**, donc un verdict rendu sur un autre thème libère la
  Stratégie de celui-ci.
