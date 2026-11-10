# 08: La Comparaison sur Google

Type: grilling
Status: open
Blocked by: 04, 06
Assignee: —

## Question

Le module **Comparaison** dit « ce qui fait mieux que quoi ». Sur Google,
**qu'est-ce qu'on met face à face** ?

- des campagnes **du même type** seulement (Search contre Search), ou des
  types entre eux (part de dépense, coût par conversion par type) ?
- en vue générale, une comparaison **entre types** a-t-elle un sens, ou
  seulement la **répartition** de la dépense ?
- la mécanique de Meta (période contre période, deux courbes) se reprend-elle
  telle quelle ?

Dépend de l'axe de la vue dédiée (04).

## Ce que l'axe apporte (04, résolu)

Le Sélecteur reste l'étape ; le type de campagne est un filtre du Bandeau ; une
moustache sous chaque carte donne déjà la répartition (parts) ou la valeur par
type (taux). La Comparaison n'a donc pas à porter la répartition entre types —
reste à dire si elle compare des types entre eux ou seulement des campagnes /
groupes. Chaque ligne porte un repère de son type.

## Réécrite après les types secondaires (06, résolu)

David : « on commence à avoir des spécialités par type de campagne […]
comment on analyse les différents types ; Instagram a une base qui permet de
faire ça ». La question devient : **comment analyse-t-on les types de
campagne**, en partant du modèle Instagram (sa spec, retirée de l'arbre, se
lit au commit `9562713`, `.scratch/instagram/spec.md`, l.71-134 et 252-286) :

- **une rangée par type** (Search, PMax, Display, Vidéo, Autres types), ordre
  fixe, jamais triée par valeur, aucune phrase qui les classe ;
- chaque type situé **face à son propre passé**, pas face aux autres ;
- un type sans diffusion sur la période garde-t-il sa rangée (« aucune
  diffusion sur la période »), comme un format sans post sur Instagram ?
- ses **spécialités** sur sa rangée (Vidéo : vues, CPV, quartiles ; PMax :
  réseaux ; Search : mots-clés, part d'impressions) ; une métrique qu'un type
  n'a pas s'écrit en phrase, jamais 0 ; « Autres types » n'a que le socle ;
- la Comparaison de Meta (période contre période) se reprend-elle **à
  l'intérieur** de chaque rangée ?

Bornes : ne rien conseiller (`CLAUDE.md` §1) — comparer le coût par conversion
de Search et de PMax pousserait à une conclusion qu'ils ne permettent pas, ils
ne jouent pas le même rôle. YouTube (07) et le Tableau (09) disent ce qui
leur revient.

## Apport de YouTube (07, résolu)

Les métriques propres à la **Vidéo** (vues, taux de vue, CPV, quartiles)
vivent ici, **au même niveau** que les autres types — pas de page ni de carte
Vidéo. David décrit ce module comme celui « où l'on choisit le type et où l'on
analyse dedans » — à confronter au modèle Instagram (une rangée par type)
plutôt qu'à supposer. Ce qu'il attend de chaque type :

- **Search** : les mots-clés et les termes de recherche ;
- **PMax** : les audiences — **mesurabilité non vérifiée**, voir l'essai réel
  (10) ; à défaut, les groupes d'éléments et les réseaux (la vidéo diffusée par
  PMax se lit ici, dans ses réseaux, jamais sous Vidéo) ;
- **Display** : les sites (emplacements) qui ont amené le plus de trafic ;
- **Vidéo** : vues, taux de vue, CPV, quartiles ;
- **Autres types** : le socle seul (06) ; Shopping et App, la vente des
  produits, au `BACKLOG.md`.

Borne : « les sites qui ont le mieux fonctionné » se montre sans conseiller
(`CLAUDE.md` §1) — un classement par trafic mesuré, pas un verdict.
