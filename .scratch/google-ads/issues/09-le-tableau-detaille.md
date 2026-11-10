# 09: Le Tableau détaillé selon le type de campagne

Type: grilling
Status: resolved
Blocked by: 01, 04
Assignee: Dernierwak

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

## Apport de la Comparaison (08, résolu)

La Comparaison ne détaille pas les types ; l'analyse propre à chaque type
(mots-clés, audiences, emplacements, quartiles) part au `BACKLOG.md`. Reste à
ce ticket : **les niveaux** que Google offre selon le type (PMax n'a ni groupe
d'annonces ni annonce) — la Comparaison, qui bascule entre niveaux comme sur
Meta, suivra ce qui est tranché ici.

## Answer

Grilling avec David, 2026-11-10. Trois questions, les trois recommandations
acceptées.

**Un seul tableau, dépliant, et c'est chaque ligne qui décide comment elle se
déplie.** Le Tableau suit le filtre du Bandeau ; sur « Tous les types »,
chaque campagne porte un repère de son type. Pas de tableau par type : ce
serait un écart à l'ADR 0011, et le type redeviendrait une structure, alors
que le marché en fait un filtre (02). David : « un tableau dépliant, on montre
tout ce que nous pouvons, et certains types n'ont pas de données car pas
présentes ».

**Les profondeurs** (David : « exact ») :
- **Search, Display, Vidéo** : Campagne › Groupe d'annonces › Annonce, comme
  Meta. Pas de quatrième niveau « vidéo » : l'annonce vidéo *est* l'annonce,
  et la vidéo se voit au Panneau latéral.
- **PMax** : Campagne › **Groupe d'éléments**, et rien en dessous. Les
  éléments ont des chiffres (`asset_group_asset`, 01), mais ce sont des titres
  et des images partagés entre groupes, pas des annonces : les lire relève de
  l'analyse PMax, au `BACKLOG.md` (08). Google ne rend aucune ligne PMax dans
  `ad_group` / `ad_group_ad`, et ne lève aucune erreur (01) : il faudra donc
  récolter `asset_group` à part.
- **Autres types** : jusqu'au Groupe d'annonces et à l'Annonce si le type en a
  (Demand Gen en a, 01), sinon la ligne Campagne seule.
- **Mots-clés et termes de recherche** : hors de ce chantier. Ils relèvent de
  l'analyse Search, au `BACKLOG.md` (08). Le « rang 5 » reste reporté.

**Les colonnes et les cellules** (David : « oui ») :
- les colonnes suivent la **vue active** (récit Meta 48), avec les mêmes
  métriques que les cartes. Aucune colonne propre à un type : les métriques
  Vidéo sont au `BACKLOG.md` ;
- une métrique qui n'existe pas pour une ligne s'écrit **« — »**, avec sa
  raison au survol, jamais 0 ni une cellule vide. Exemples : la portée sur
  Search ; la portée sous le niveau Campagne (elle ne se récolte que par
  campagne, 01) ; la portée que Google masque (avec la raison qu'il donne) ;
  la valeur de conversion quand aucune n'est déclarée (05) ;
- les ratios sont recalculés sur chaque ligne, total ÷ total (récit Meta 49),
  jamais comme une moyenne des enfants ;
- l'**export CSV** reprend le tableau tel qu'il est affiché, « — » compris,
  avec une colonne « Type de campagne ».

**Conséquences, non posées à David** :
- la Comparaison compare les niveaux que ce tableau offre. Son niveau
  « groupes » réunit Groupes d'annonces et Groupes d'éléments, avec le repère
  du type. Son niveau « annonces » n'a pas de PMax, et le dit au lieu de
  l'omettre. Le classement de campagnes de types différents sur « Tous les
  types » reste à la [maquette](11-la-page-google-en-maquette.md) ;
- le volume par annonce dépasse vite 1 000 lignes : la lecture doit paginer
  (`CLAUDE.md` §8). C'est de la construction, pas une décision.

**Vocabulaire** : **Groupe d'éléments** écrit dans `CONTEXT.md`, l'équivalent
PMax du Groupe d'annonces, à ne pas confondre avec lui.

Pas d'ADR : c'est l'ADR 0011 appliqué, et la profondeur se change sans coût.
