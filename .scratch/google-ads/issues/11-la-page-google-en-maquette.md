# 11: La page Google en maquette

Type: prototype
Status: resolved
Blocked by: —
Assignee: Dernierwak

## Question

À quoi ressemble la page `/google` avec l'axe tranché (04) — et **la moustache
par type tient-elle sa place** sous les cartes du Sélecteur ?

Une maquette grossière, sur données plausibles calquées sur les comptes réels
(Search + PMax, ticket 03), qui montre :
- le Bandeau de commandes avec le filtre **Type de campagne** (« Tous les
  types » par défaut, seulement les types présents) ;
- les trois cartes Notoriété / Trafic / Conversion, avec la **moustache** :
  parts pour ce qui s'additionne, valeurs côte à côte pour les taux ;
- la Tendance qui se resserre quand on filtre sur un type ;
- la Comparaison et le Tableau esquissés, un repère de type par ligne.

À faire réagir David : la moustache est-elle lisible ou du bruit (il la juge
« limite ») ? le filtre se trouve-t-il ? manque-t-il quelque chose qu'on
attendait d'une « vue dédiée » ? Les réponses nourrissent 05, 08 et 09 — la
maquette ne les tranche pas.

Pas bloqué : David veut un prototype tôt (2026-11-10). Agent utile :
`vision-ux`.

## Apport de la Comparaison (08, résolu)

La Comparaison s'esquisse avec la mécanique de Meta, **sans spécialité par
type** — les moustaches portent la lecture par type. À faire réagir David :
sur « Tous les types », des campagnes de types différents se classent-elles
ensemble ? Une première maquette, centrée sur ce seul module, a été rejetée
pour avoir déroulé toutes les spécialités par type
(`issues/08-la-comparaison.md`, réponse) : **montrer la page, pas un catalogue
de variantes.**

## Premier tour, rejeté (2026-11-10)

Maquette dans l'app, `/google?maquette=page`, chiffres fictifs, branche jetable
`prototype/google-page` (`1a2a683`) : filtre Type de campagne au Bandeau,
moustaches par type (avec ou sans), 2 ou 4 types, Comparaison qui classe
Search et PMax ensemble, Tableau dépliant jusqu'au Groupe d'éléments.

David : « on veut pas pour l'instant aller dans les détails pour les search
pmax etc. » — ce qui a été proposé « c'est pas du tout dans les normes de ce
que j'aimerais. Donc ça on le laisse. » Les questions posées sur la moustache
et sur le classement mélangé des types partaient dans ce détail.

**Ce qui en sort** : ce qu'on montre pour chaque type (PMax, Search…) quitte
ce ticket pour [Ce qu'on montre pour chaque type de campagne](15-ce-qu-on-montre-par-type.md).
La maquette est à refaire, sans détail par type ; ce qu'elle montre à la
place reste à préciser avec David.

## Answer

Validé par David le 2026-11-10 au deuxième tour : « oui, on peut partir avec
ça ». Maquette : branche jetable `prototype/google-page` (`b19d03f`),
`app/google/_prototype-page/maquette.tsx`, ouverte en dev par
`/google?maquette=page`, chiffres fictifs.

**La page Google est la page Meta, avec les chiffres de Google.** Mêmes
modules, dans le même ordre (ADR 0011) : Bandeau de commandes (période,
campagne), Sélecteur de vue (Notoriété / Trafic / Conversion), Tendance
(total jour par jour, période d'avant en pointillé), Comparaison, Tableau
détaillé (ligne Total, chaque campagne dépliable jusqu'au détail : groupe
d'annonces et annonce, ou Groupe d'éléments pour PMax, ticket 09).

**Rien de propre aux types de campagne pour l'instant** : ni filtre Type de
campagne, ni moustache, ni repère de type. Le filtre et la moustache tranchés
au ticket 04 sont suspendus, pas défaits : ils reviennent, ou non, avec
[Ce qu'on montre pour chaque type de campagne](15-ce-qu-on-montre-par-type.md).

**En bas de page, un emplacement réservé** : « Analyser une campagne — à
venir », la future analyse par campagne et par type (`BACKLOG.md`, ticket 15).

**Construire comme Meta, pas comme la maquette.** David : « suis exactement
comme on a fait sur Meta, parce que tu changes 2-3 trucs ». La maquette fixe
la structure, pas le format. La construction reprend les modules de
`components/meta/` et leur grammaire, pas les dessins de la maquette, qui
s'en écartaient sur plusieurs points :
- la **Comparaison** de Meta : réglages (niveau, métriques 1 et 2) en tête,
  liste classée sur deux colonnes, les deux graphes côte à côte en pleine
  largeur, une cible « Lire » par ligne. La maquette avait mis la liste à
  gauche et les graphes empilés à droite, sans réglage ni « Lire » ;
- le **Tableau** de Meta garde le dépliage hors de l'URL (la maquette l'y
  mettait) ;
- le **Bandeau** de Meta : raccourcis de période, date de lecture, pilule qui
  se détache au défilement, absents de la maquette.

**La Comparaison est à améliorer, plus tard** : David veut l'avoir en tête
sans savoir encore comment. Elle part dans
[Améliorer la Comparaison](16-ameliorer-la-comparaison.md) ; en attendant,
c'est celle de Meta.

Aucun terme nouveau dans `CONTEXT.md`, aucun ADR : c'est l'ADR 0011 appliqué
à la lettre.
