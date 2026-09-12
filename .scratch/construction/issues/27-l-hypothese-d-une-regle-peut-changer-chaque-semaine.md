# L'Hypothèse d'une règle peut changer de théorie toutes les semaines

Type: task
Status: open

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
