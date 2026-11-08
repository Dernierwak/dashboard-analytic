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
