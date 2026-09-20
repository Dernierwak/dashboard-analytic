# Les tuiles KPI du rapport ne sont lues par personne

Type: task
Status: open

## Question

**Trouvé en réalisant [48](48-les-tableaux-de-bord-lisent-le-trou-en-direct.md).**
Le ticket 48 décrivait « les **tuiles KPI** de la même page affichent un total
amputé (calcul direct, pas corrigé) : deux chiffres contradictoires à trente
pixels d'écart ». La contradiction ne peut pas se produire : **`WeeklyData.kpis`
et `WeeklyData.channels` ne sont lus par aucun composant.**

```
$ grep -rn "\.kpis\|\.channels\b\|ChannelSpend\|\bKpi\b" saas/web --include *.ts --include *.tsx
saas/web/lib/report.ts:13:export type Kpi = { …
saas/web/lib/report.ts:21:export type ChannelSpend = { …
saas/web/lib/report.ts:596:  kpis: Kpi[];
saas/web/lib/report.ts:597:  channels: ChannelSpend[];
saas/web/lib/report.ts:1046:  const kpiSpend: Kpi = { …
…
```

Sept déclarations, toutes dans `report.ts`. `app/page.tsx` ne lit de
`getWeeklyData` ni `kpis` ni `channels` — les tuiles ont quitté l'écran, le
calcul est resté.

C'est une centaine de lignes de `getWeeklyData` — trois branches d'objectif
(`ventes` / `notoriete` / `engagement`), le ROAS, la moyenne de portée par post,
le total d'interactions — qui s'exécutent à chaque affichage du rapport et dont
le résultat est jeté.

### Ce qui a été fait au ticket 48, et pourquoi ça ne suffit pas

Ces chiffres ont été rendus **honnêtes** : `ChannelSpend.spend` vaut désormais
`null` — et plus zéro — en face d'un canal muet, les tuiles affichent « — », et
le ROAS ne se calcule plus sur un dénominateur amputé. C'était le cas le plus
net cité par le ticket 48, il fallait le traiter.

Mais un calcul que personne ne lit ne se vérifie pas : **la correction est
invérifiable autrement qu'en la relisant.** Et il reste un piège armé — le jour
où quelqu'un rebranche ces tuiles, il hérite d'une arithmétique dont plus
personne ne connaît les hypothèses.

### Ce qu'il faudrait faire

Trancher entre deux sorties, et c'est une décision produit, pas technique :

- **Les tuiles reviennent** — alors il faut dire où, et ce qu'elles ajoutent à ce
  que le payload affiche déjà en tête de rapport. La refonte a justement déplacé
  ces chiffres ; les remettre demande de dire pourquoi.
- **Elles ne reviennent pas** — alors `kpis`, `channels`, `Kpi`, `ChannelSpend`
  et les branches d'objectif sortent de `getWeeklyData`. `hasData` reste : il
  est lu, lui, et il gouverne l'écran vide.

Tant que ce n'est pas tranché, on garde une arithmétique morte au milieu de la
fonction la plus lue du produit.

### Ce qui n'est PAS dans ce ticket

Les deux autres surfaces du ticket 48 — `/couts` et les pages canal — sont
vivantes, corrigées et vérifiées
(`.scratch/construction/harnais/48-trou-en-direct/`). Rien à y reprendre ici.
