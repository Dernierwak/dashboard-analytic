# Les tableaux de bord lisent le trou en direct, sans passer par le rapport

Type: task
Status: open

## Question

**Trouvé en réalisant [20](20-rapport-publie-sur-un-canal-muet.md).** Le
ticket 20 a fait taire les mesures trouées **dans le payload** — donc dans le
rapport hebdo et dans l'email, qui le lisent tous les deux. Les pages de
l'application, elles, **ne lisent pas le payload** : elles interrogent les tables
brutes elles-mêmes.

`getWeeklyData` (`saas/web/lib/report.ts`) recalcule `spend`, `clicks`, `ctr` et
le ROAS depuis `meta_ads_insights` et `google_ads_insights`. Les mêmes lignes,
donc **le même trou**, par un autre chemin — et aucune des protections du ticket
20 ne s'applique sur ce chemin-là. Concrètement, la semaine où Meta est muet :

- l'en-tête du rapport dit « — » (payload, corrigé) pendant que les **tuiles
  KPI** de la même page affichent un total amputé (calcul direct, pas corrigé) :
  deux chiffres contradictoires à trente pixels d'écart ;
- `/couts` additionne jour, mois et année sur une dépense incomplète, et
  surtout **l'alerte de dépassement de budget se désarme toute seule** — une
  semaine creuse fait repasser le compte du bon côté et fabrique un « tu es dans
  ton budget » faux ;
- `/meta` et `/google` montrent des courbes qui tombent à zéro sur la semaine,
  ce qui se lit comme un arrêt de campagne.

Le `ChannelSpend` de `report.ts` est le cas le plus net : il pose `spend: mSpend`
et `spend: gSpend` par canal, donc il affiche **zéro** en face du canal tombé —
exactement ce que `CLAUDE.md` §7 interdit.

### Ce qu'il faudrait faire

Le signal existe déjà et il est lisible côté web : `fetch_canaux_muets`
(`saas/commun/fetch_data.py`) lit `fetch_progress`, et la table a déjà ses
policies de partage. Il n'y a rien à mesurer de plus, seulement à faire
traverser une deuxième fois — cette fois vers `lib/report.ts`, `lib/couts.ts` et
les pages canal.

La règle à appliquer est celle qui est déjà écrite :
`docs/adr/0005-un-canal-muet-fait-taire-sa-mesure-pas-le-rapport.md` — chaque
mesure se tait si sa source est muette, et l'alerte de budget **se désarme**
plutôt que de se prononcer sur une dépense incomplète.

Attention au piège des trois états (ADR 0005) : « jamais connecté », « échec »
et « zéro mesuré » rendent le même nombre de lignes. Le web ne doit pas essayer
de deviner lequel — seul `fetch_progress` le sait.

### Ce qui est déjà vrai et ne change pas

Le rapport hebdo et l'email sont corrigés et vérifiés
(`.scratch/construction/harnais/20-canal-muet/`). Ce ticket ne porte que sur les
écrans qui court-circuitent le payload.
