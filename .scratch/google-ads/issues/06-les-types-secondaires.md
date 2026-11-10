# 06: Regrouper, garder ou reporter les types secondaires

Type: grilling
Status: resolved
Blocked by: 01, 03
Assignee: Dernierwak

## Question

Shopping, Demand Gen, App, Hotel, Local… **Que devient chacun** ?

- **regroupé** sous une étiquette (« Autres types ») quand ses données
  restent lisibles avec le reste ;
- **rangé avec un type proche** (Demand Gen avec YouTube ou Display ?) ;
- **reporté au `BACKLOG.md`** quand ses données sont trop différentes pour un
  tableau lisible et qu'aucun compte réel ne s'en sert — sans jamais sortir sa
  dépense du total (§7).

Décision de David au cadrage (2026-11-08) : regrouper si c'est lisible, sinon
reporter pour ne pas bloquer le chantier. Le poids réel (03) et les métriques
valides (01) départagent.

## Answer

Grilling avec David, 2026-11-10.

**Une seule règle pour tout ce qui sort des quatre types nommés** (Search,
PMax, Display, Vidéo) : la campagne tombe dans **« Autres types »** — une
option du filtre du Bandeau et un segment de la moustache, présents seulement
si ces campagnes ont diffusé sur la période. Leur dépense et leurs conversions
restent **toujours** dans les totaux (§7). Au Tableau détaillé, chaque
campagne garde son **vrai type Google** (« Shopping », « Demand Gen »…) : on
regroupe dans les commandes, on ne cache rien dans le détail.

**Demand Gen n'a pas de traitement à part** : il va dans « Autres types ». Ni
avec Vidéo (il diffuse aussi des images sur Discover et Gmail : ses vues vidéo
seraient partielles), ni avec Display, ni en cinquième entrée nommée — elle
viendra quand un compte réel y dépensera (ticket 03 : 2 campagnes actives,
zéro impression en 90 jours). Ce sera un ajout au filtre, pas une refonte.

**Les spécialités appartiennent aux quatre types nommés** : vues, CPV et
quartiles pour Vidéo ; répartition par réseau pour PMax ; mots-clés et part
d'impressions pour Search. « Autres types » ne porte que le socle commun
(impressions, clics, coût, conversions, valeur). Les spécialités de Shopping,
App, Local et Hotel vont au `BACKLOG.md` — **avec l'exigence de David** : elles
seront un jour détaillées **au même niveau** que les quatre types choisis, ce
n'est pas un renoncement.

**L'analyse par type (« comment on compare les types ») ne se tranche pas
ici** : elle part dans [La Comparaison sur Google](08-la-comparaison.md), dont
la question est réécrite sur la base d'Instagram — une rangée par type, ordre
fixe, jamais classée, chaque type face à son propre passé. Où vivent les
spécialités : Comparaison (08), YouTube (07), Tableau (09).

Terme **Autres types** ajouté à `CONTEXT.md` sous « Type de campagne ». Pas
d'ADR : réversible (ajouter une entrée nommée au filtre ne casse rien).
