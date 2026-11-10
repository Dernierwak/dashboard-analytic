# 09: Le Tableau détaillé selon le type de campagne

Type: grilling
Status: open
Blocked by: 01, 04
Assignee: —

## Question

Le **Tableau détaillé** se déplie sur Meta : campagne › ensemble › annonce.
Sur Google, la hiérarchie dépend du type :
- Search : campagne › groupe d'annonces › annonce — et **mots-clés / termes
  de recherche** (le « rang 5 », reporté le 2026-09-08, `BACKLOG.md`) ;
- Display : campagne › groupe d'annonces › annonce ;
- YouTube : campagne › groupe › annonce › **vidéo** ;
- PMax : campagne › **groupe d'éléments** › éléments (avec ou sans métriques).

**Un seul tableau qui se déplie différemment selon la ligne, ou un tableau
par type ?** Quelles colonnes par type, que montre une cellule pour une
métrique qui n'existe pas (« — » et sa raison) ? Les mots-clés entrent-ils
dans ce chantier ? Le volume reste sous le plafond PostgREST (1 000 lignes :
paginer).

Dépend des niveaux que l'API rend (01) et de l'axe retenu (04).

## Ce que l'axe apporte (04, résolu)

Le type de campagne est un filtre du Bandeau : le Tableau suit le filtre, et
sur « Tous les types » chaque ligne porte un repère de son type. Les métriques
propres à un type (vidéo notamment) ne passent pas par les cartes du
Sélecteur : le Tableau est un candidat naturel pour les porter.
