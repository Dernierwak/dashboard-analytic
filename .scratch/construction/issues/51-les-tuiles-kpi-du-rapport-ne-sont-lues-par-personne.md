# Les tuiles KPI du rapport ne sont lues par personne

Type: task
Status: resolved

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


## Answer

**Elles ne reviennent pas.** Tranché par David le 2026-09-20, sur les deux
sorties que ce ticket posait. Les trois pièces qui ont porté la décision :

- l'ordre du premier écran est **déjà tranché** — verdict, bilan du Carnet, à
  faire, rail, résumé replié
  (`.scratch/refonte/issues/10-l-entree-premier-ecran.md`) — et une rangée de
  totaux tous canaux confondus n'y a pas de place ;
- les tuiles n'ont pas été oubliées, elles ont été **retirées** : `data.kpis`
  quitte `app/page.tsx` au commit `6e92303`, *« rapport hebdo organisé PAR
  THÈME »* ;
- la dépense par plateforme est **vivante ailleurs** — « Dépensé par
  plateforme » sur `/couts` (`app/couts/page.tsx:367`), corrigée et vérifiée au
  ticket 48.

### Ce qui sort

`Kpi`, `ChannelSpend`, les champs `kpis` et `channels` de `WeeklyData`, les
trois branches d'objectif (`ventes` / `notoriete` / `engagement`), le ROAS, la
portée moyenne par post, le total d'interactions, les sommes par canal et par
fenêtre, et `pctDelta`, qui n'avait plus d'appelant. `hasData` reste : il est lu
(`app/page.tsx:784`) et il gouverne l'écran vide.

**Deux lectures Supabase disparaissent** avec leurs seuls consommateurs —
`ga4_insights` (6 000 lignes) et `instagram_organic_posts` (300). **Trois autres
se réduisent à une ligne et une colonne** : ce qui reste de `meta_ads_insights`
et `google_ads_insights`, c'est l'ancre — la dernière date écrite, donc la
première ligne du tri — et de `followers_history`, l'existence seule.

Au passage, et c'est le plus instructif : le `limit(3000)` de ces deux lectures
était **une fiction**. PostgREST plafonne à 1 000 lignes et tronque en silence
(`CLAUDE.md` §8). L'ancre n'en souffrait pas, elle est la première ligne ; les
sommes, elles, se calculaient sur un mois tronqué **sans le dire**. Le défaut
part avec le code qui le portait — il n'a jamais rien affiché, faute de lecteur.

### Vérifié

`rm -rf .next tsconfig.tsbuildinfo`, `npx tsc --noEmit` et `npm run build`
verts, **19 routes**. **30 régressions rejouées** — les 26 du ticket 48
(`harnais/48-trou-en-direct/`) et les 4 du 46 — qui tiennent l'ADR 0005 et le
rognage de fenêtre. `git grep` ne rend plus **aucune** occurrence de `Kpi`,
`ChannelSpend`, `pctDelta` dans `saas/web`. `/couts`, `lib/couts.ts` et
`lib/channels.ts` ne sont pas touchés, comme ce ticket le demandait.

**Aucun harnais neuf, et c'est le point** : ce ticket ne corrige pas un calcul,
il en supprime un. Ce qui reste — l'ancre et `hasData` — était déjà couvert.

**Exception au §9** : tout est côté web. **Aucun passage du worker n'est
nécessaire** ; la page se relit au prochain déploiement. Rien ne change non plus
à l'écran — c'est exactement ce qu'on vérifie : du code que personne ne lisait
s'en va.

### Ce que la revue a rattrapé

- **Un commentaire rendu faux par ce ticket** : le bloc de `fetchCanauxMuets`
  disait que la lecture en direct sert à *« faire taire les chiffres recalculés
  à côté du payload »*. Ces chiffres sont partis ; il ne lui reste que l'ancre.
  Le même bloc affirmait *« ELLE NE RESSORT PAS DE `WeeklyData` »*, ce qui était
  **déjà faux avant ce ticket** — `canauxMuets` est dans le retour. Les deux
  sont corrigés.
- **Deux commentaires trop longs**, qui recensaient le code supprimé au lieu de
  dire pourquoi il ne revient pas. Git tient le recensement ; ils sont resserrés
  sur la règle.

Elle a ouvert un ticket :
[52 · Le mot « chantier » contredit le glossaire](52-le-mot-chantier-contredit-le-glossaire.md) —
`CONTEXT.md` l. 201 écarte « chantier » pour ce que le rail contient, et le code
l'emploie sept fois, dont un nom de fonction exporté. Jamais sous les yeux du
client, donc **écrit plutôt que corrigé** (§4) : renommer touche six fichiers
d'un autre chantier que celui-ci.
