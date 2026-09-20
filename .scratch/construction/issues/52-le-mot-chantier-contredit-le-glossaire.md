# Le mot « chantier » contredit le glossaire

Type: task
Status: open

## Question

**Trouvé en réalisant [51](51-les-tuiles-kpi-du-rapport-ne-sont-lues-par-personne.md),
par sa revue de code.**

`CONTEXT.md` l. 201 écarte le mot explicitement :

> **Action suivie** : […] _Avoid_: Tâche, **chantier** — le mot qui porte la
> mesure est « action suivie ».

Or c'est exactement ce que le rail de la page d'accueil contient — des actions
suivies encore ouvertes — et « chantier » est le mot employé partout pour le
dire :

```
saas/web/lib/a-faire.ts:97      export function chantiersEnCours(...)
saas/web/lib/a-faire.ts:75      LE RAIL DES CHANTIERS EN COURS
saas/web/app/page.tsx:493,505   rail des chantiers
saas/web/app/page.tsx:534       LE RAIL DES CHANTIERS EN COURS
saas/web/components/rail-actions.tsx:15,61
saas/web/components/action-vivante.tsx:11
saas/web/components/alerte-themes.tsx:28
```

**Le client ne le lit jamais** : les sept occurrences sont des commentaires et
un nom de fonction exporté. C'est une dérive de vocabulaire interne, pas un
défaut visible à l'écran — d'où un ticket plutôt qu'une correction.

`docs/agents/domain.md` : *« Don't drift to synonyms the glossary explicitly
avoids. »* Un agent qui lit `CONTEXT.md` puis `a-faire.ts` reçoit deux mots pour
une seule chose, et c'est le genre d'écart qui finit par sortir à l'écran.

### Ce qu'il faudrait faire

Trancher lequel des deux a raison — et les deux sorties sont défendables :

- **Le glossaire a raison** : `chantiersEnCours` devient `actionsEnCours`, et
  les sept commentaires suivent. Attention, `actions` est déjà le nom de la
  liste complète dans `WeeklyData` — il faut un nom qui distingue *ouvertes* de
  *toutes*.
- **Le code a raison** : « chantier » a pris un sens propre — *une action suivie
  encore ouverte, vue depuis le rail* — que « action suivie » ne porte pas. Il
  entre alors dans `CONTEXT.md` comme entrée, et sort de l'_Avoid_ de l. 201
  (il reste écarté l. 221, où il désignerait une Stratégie).

### Ce qui n'est PAS dans ce ticket

L'_Avoid_ de `CONTEXT.md` l. 221 — « chantier » comme synonyme de **Stratégie** —
n'est contredit nulle part dans le code. Rien à y reprendre.
