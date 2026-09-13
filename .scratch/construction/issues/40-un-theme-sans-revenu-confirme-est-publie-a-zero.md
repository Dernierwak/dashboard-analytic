# Un thème sans revenu confirmé est publié à zéro franc

Type: task
Status: open

## Question

**Trouvé en faisant tourner `build_payload` pour la première fois**, au
ticket [16](16-le-seam-du-payload.md). `CLAUDE.md` §4 : ça devient un ticket, pas
une retouche en passant — et le ticket 16 s'interdit explicitement toute
correction de comportement.

### Le fait, mesuré

`saas/traitement/build_report.py`, section « Thèmes » :

```python
t_rows = sorted(
    ({"label": lbl, "spend": round(s, 2), "rev": round(rv_lbl.get(lbl, 0.0), 2)}
     for lbl, s in sp_lbl.items() if s > 0),
    key=lambda r: -r["spend"],
)
```

`rv_lbl` est bâti à partir de `ga4_ctx["by_campaign"]`. Un thème dont GA4 ne
rattache **aucune** campagne n'y a pas d'entrée — et `rv_lbl.get(lbl, 0.0)`
écrit alors **`0.0`** dans le payload publié.

Reproduit hors ligne, deux thèmes, un seul avec du revenu attribué
(`harnais/16-le-seam-du-payload/`) :

| Endroit du payload | Thème « Été » (revenu attribué) | Thème « Muet » (aucun) |
|---|---|---|
| `themes_focus[].summary.revenue` | `9600.0` | **`null`** ✓ |
| `matrice.themes[].revenue` | `9600.0` | **`null`** ✓ |
| `themes.rows[].rev` | `560.0` | **`0.0`** ✗ |

Les deux premiers passent par la vue `theme_regroupement` depuis le
ticket [04](04-vue-sql-du-regroupement.md), qui a posé la règle : *« sans réponse
de la vue, pas de revenu — et on le dit. Pas de zéro, pas d'estimation. »* Le
troisième n'a jamais été converti : il calcule encore son revenu lui-même, à
côté de la vue.

C'est `CLAUDE.md` §7 mot pour mot : **une absence de donnée n'est pas un zéro.**

### Ce que ça change à l'écran aujourd'hui : rien, et il faut le dire

Vérifié ligne à ligne côté web :

- `ThemeDonut` (`components/theme-donut.tsx`) ne lit **que** `label` et `spend`.
  Le `rev` ne l'atteint pas.
- `revenuTheme` (`lib/report.ts`) est le seul lecteur : il prend
  `Math.max(summary.revenue, rows[].rev)` en ramenant chaque absence à zéro de
  son côté. Un zéro de plus ne déplace donc pas son résultat.
- `theme-card.tsx` n'affiche la case « Revenu » que si `summary.roas` existe,
  donc jamais pour un thème sans revenu confirmé.

**Le défaut est à la source, pas à l'écran.** Il ne se répare pas parce qu'il
ment aujourd'hui, mais parce que le payload est ce qui est *publié* — et que le
prochain lecteur de `themes.rows[].rev` n'aura aucun moyen de distinguer « zéro
franc de vente » de « GA4 ne rattache rien ». Les deux se lisent déjà
différemment partout ailleurs dans le produit.

### Ce qu'il faudrait faire

- Écrire `None` plutôt que `0.0` quand aucune campagne du thème n'est rattachée,
  et **distinguer** ce cas de « rattaché, et la somme vaut zéro ».
- Question ouverte, à trancher dans le ticket : ce bloc devrait-il simplement
  **lire la vue** comme les deux autres, au lieu d'entretenir un troisième
  chemin de revenu ? C'est le motif exact du ticket 04 — une seule
  implémentation — et ce chemin-ci lui a survécu.
- `ThemeRow.rev` devient `number | null` côté TypeScript, et `revenuTheme` cesse
  de confondre `null` et `0`.

### Ce qui n'est PAS demandé

- **Ne pas toucher `summary.revenue` ni `matrice.themes[].revenue`** : ils sont
  corrects, et ils viennent de la vue.
- Aucun rejeu d'historique : un payload déjà publié garde son zéro. On ne
  réécrit pas une semaine passée
  ([spec](../spec.md), « la mémoire est le fil continu »).
