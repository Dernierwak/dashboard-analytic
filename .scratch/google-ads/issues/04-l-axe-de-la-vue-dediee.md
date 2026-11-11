# 04: L'axe de la vue dédiée

Type: grilling
Status: resolved
Blocked by: 01, 02
Assignee: Dernierwak

## Question

Sur Meta, le **Sélecteur de vue** découpe par **objectif** : Notoriété,
Trafic, Conversion (`CONTEXT.md`, entrée Module). Sur Google, les métriques
valides changent surtout avec le **type de campagne** — une « vue
Notoriété » d'une campagne Search, ou une vue Conversion d'une campagne
YouTube de notoriété, n'a guère de sens.

**Qu'est-ce que la « vue dédiée » de Google ?**
- le **type de campagne** (Ensemble · Search · PMax · Display · YouTube),
  écart à l'ADR 0011 justifié comme Instagram a justifié le sien ;
- l'**objectif**, comme Meta, avec le type en filtre du Bandeau ;
- les **deux** (objectif au Sélecteur, type en filtre, ou l'inverse) — et ce
  que ça coûte en lisibilité.

Et dans la foulée : **qu'est-ce que la « vue générale »** — une entrée du
Sélecteur (« Ensemble »), ou la Tendance au-dessus du Sélecteur ? Le mot
« vue » est déjà pris par le Sélecteur (`CONTEXT.md`) : trancher le
vocabulaire (« Type de campagne », les mots qu'on évite) et l'écrire dans
`CONTEXT.md`.

S'appuie sur ce que l'API rend par type (01) et sur ce que fait le marché
(02). Agents utiles : `vision-ux` (forme et ordre), `vision-produit`.

## Ce que les recherches apportent (01 et 02, résolus)

- **Google découpe sa propre Vue d'ensemble par étape du parcours** —
  Awareness / Consideration / Action, selon la stratégie d'enchère, avec des
  métriques propres à chaque étape. C'est presque mot pour mot le Sélecteur
  de Meta (Notoriété / Trafic / Conversion) : l'axe « objectif » a un
  précédent chez Google même.
- **Le marché traite le type de campagne comme un filtre**, jamais comme une
  structure ; personne ne pose les types côte à côte par défaut. Un Sélecteur
  indexé sur le type serait plus explicite que le marché, sans modèle établi.
- **L'API ne refuse rien hors type** : une métrique vidéo sur du Search n'est
  pas rejetée. Quel que soit l'axe, c'est Pulse qui décide quelles métriques
  vont avec quel type.
- **Les types ne se recouvrent pas proprement avec les étapes** : PMax couvre
  tous les réseaux (Search, YouTube, Display…), YouTube sert aussi bien la
  notoriété que la conversion, Demand Gen est un type à part.
- **Socle commun à tous les types** : impressions, clics, coût, conversions,
  valeur de conversion — ce qu'une vue « Ensemble » peut porter.

Détail : `issues/01-ce-que-l-api-donne-par-type.md` et
`issues/02-comment-le-marche-presente-google-ads.md`, section `## Answer`.

## Answer

Grilling avec David, 2026-11-10.

**Le Sélecteur de vue garde l'étape, comme Meta** — Notoriété / Trafic /
Conversion, trois cartes qui **reconfigurent** la page et ne filtrent rien.
Aucun écart à l'ADR 0011. C'est aussi le découpage de la propre Vue d'ensemble
de Google (Awareness / Consideration / Action, ticket 02).

**Le type de campagne est un filtre du Bandeau de commandes**, à côté de la
campagne et de la période : choix unique, « Tous les types » par défaut, puis
seulement les types qui ont diffusé sur la période. Le menu des campagnes se
resserre sur le type choisi, et toute la page suit (Sélecteur, Tendance,
Comparaison, Tableau), comme le choix d'une campagne sur Meta (récit 7).

**Une moustache par type sous chaque carte du Sélecteur** — c'est elle qui
garde la vision de tous les types sans avoir à filtrer (« pas besoin de filtrer
par type, garder cette vision de tous ») :
- ce qui s'additionne (impressions, clics, coût, conversions) : une barre fine
  en parts (« Search 69 % · PMax 31 % ») ;
- les taux (CPM, CTR, CPC, coût par conversion) : la valeur de chaque type côte
  à côte — un taux ne se découpe pas en parts ;
- seulement quand au moins deux types ont diffusé sur la période (filtrer sur
  un type la fait donc disparaître — _supposé_, non posé à David).
David la juge « limite » : à éprouver au prototype avant de la spécifier.

**Les métriques d'une carte ne changent pas avec le type filtré** (David a
écarté la proposition inverse). La carte Notoriété porte les mêmes métriques
quel que soit le filtre ; on lit le fonctionnement de chaque type dans la
moustache, et le filtre ne fait que **resserrer les courbes** de la Tendance
(et le reste de la page) sur ce type. Conséquence : les métriques propres à la
Vidéo (vues, CPV, quartiles) n'entrent pas dans les cartes par le filtre — où
elles vivent, c'est la question de YouTube (07).

**« Vue générale » et « vue dédiée » ne sont pas des modules** : ce sont deux
états du filtre (« tous les types » / « filtré sur Search »). Pas de carte
« Ensemble ». Ces deux expressions n'entrent pas dans `CONTEXT.md` — « vue »
désigne déjà Notoriété / Trafic / Conversion. L'ordre dont parlait David
(vue générale → vue dédiée → comparaison → table) devient : Sélecteur +
Tendance (tous types ou un type), Comparaison, Tableau.

**Vocabulaire** : **Type de campagne** écrit dans `CONTEXT.md` — Search, PMax,
Display, Vidéo ; il filtre, la vue reconfigure ; « Vidéo » et pas « YouTube » ;
à éviter : « format », « canal ».

Pas d'ADR : rien ici n'est un écart, c'est l'ADR 0011 appliqué.

_Révisé le 2026-11-11 par [Ce qu'on montre pour chaque type de campagne](15-ce-qu-on-montre-par-type.md)_ :
le filtre Type de campagne du Bandeau et la moustache par type sont
**abandonnés**. Le Sélecteur reste l'étape ; le type ne se choisit plus que
dans la Comparaison (16).
