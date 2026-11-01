# 02: Le module des canaux

Type: grilling
Status: resolved
Blocked by: —

## Question

David veut « la semaine qui s'est déroulée vs la semaine d'avant, avec toutes
les métriques des différentes sources ». **Quelles métriques, pour quelles
sources, et combien ?**

À trancher :

- la liste par plateforme (Meta Ads, Google Ads, Instagram, GA4) — chacune avec
  ses propres chiffres, sans total mélangé ;
- le nombre par source au-delà duquel ça devient un export plutôt qu'une
  lecture ;
- la forme de l'écart (absolu, %, les deux) et ce qu'on écrit quand la semaine
  d'avant est vide ou à zéro (pas de « +∞ % ») ;
- la semaine comparée : 7 jours pleins jusqu'à la veille du jour de travail,
  comme les trois dates actuelles ?

## Answer

Tranché avec David le 2026-10-28. Le titre d'origine (« Les métriques de la
semaine face à la précédente ») est tombé en route : on ne compare plus à la
semaine précédente.

1. **Un module des canaux** : une carte par canal ; chaque canal qui arrive
   s'y ajoute. Jamais de total entre canaux.
2. **Meta seul pour l'instant.** Google Ads et Instagram entrent quand leurs
   pages sont finies. Pistes notées : Google, les mêmes métriques que Meta ;
   Instagram, impressions, portée, engagement.
3. **Meta : cinq métriques, dans cet ordre** — dépense, impressions, clics,
   CTR, CPC. *Révisé par le ticket 03 (2026-10-30) : six métriques — les
   volumes dépense, impressions, clics en totaux sans comparaison, puis les
   ratios CTR, CPC, CPM face à la semaine type.* Les « résultats » restent sur `/meta` (ils ne comptent pas la
   même chose d'une campagne à l'autre).
4. **Pas de ROAS.**
5. **La référence n'est plus la semaine précédente, c'est la semaine moyenne
   du compte.** David : « on ne va pas comparer une campagne avec ce qu'elle a
   fait précédemment ». Les cas campagne lancée / arrêtée / budget changé
   sortent de la page hebdo — ils se lisent sur `/meta`. La définition de la
   moyenne est l'affaire du ticket 03.
6. **La semaine** : 7 jours pleins calés sur le Jour de travail (jeudi → du
   jeudi au mercredi, jamais lundi → lundi), et la même quel que soit le jour
   où le rapport est recalculé. Aujourd'hui le traitement ancre sur la veille
   du jour de fabrication (`builder.py`, `last_full_day`) : un rapport relancé
   à la main un samedi glisse — écart à corriger dans la spec.

Non tranché ici, renvoyé : comment voir l'évolution d'une métrique (petite
courbe sur place, lien vers `/meta`) → ticket 03 (pente) et maquette.
