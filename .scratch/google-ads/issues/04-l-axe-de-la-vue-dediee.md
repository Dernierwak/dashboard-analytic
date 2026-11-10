# 04: L'axe de la vue dédiée

Type: grilling
Status: open
Blocked by: 01, 02
Assignee: —

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
