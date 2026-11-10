# 12: Le Panneau latéral sur Google

Type: grilling
Status: resolved
Blocked by: —
Assignee: David

## Question

Le **Panneau latéral** s'ouvre soit sur une annonce (son contenu et la page
vers laquelle elle envoie), soit sur un jour (ses changements), comme sur Meta.
Sur Google, **que montre-t-il pour chaque niveau que le Tableau ouvre**
([Le Tableau détaillé selon le type de campagne](09-le-tableau-detaille.md)) ?

- une annonce **Search** (RSA) : ses titres et descriptions, sa page de
  destination ;
- une annonce **Display** : ses images ;
- une annonce **Vidéo** : la vidéo YouTube rattachée ;
- un **Groupe d'éléments** PMax : il n'a pas d'annonce. Le panneau
  s'ouvre-t-il sur lui, pour montrer ses éléments sans leurs chiffres (les
  chiffres des éléments sont au `BACKLOG.md`), ou ne s'ouvre-t-il pas ?
- un **jour** : les changements tirés de `change_event`, limités à 30 jours
  (`CLAUDE.md` §8). Que dit le panneau pour un jour plus ancien ?

Ce que l'API rend pour le contenu (`ad_group_ad.ad`, `asset_group_asset`) se
vérifie avec [l'essai réel](10-l-essai-reel.md) s'il le faut. Rien n'est
conseillé (`CLAUDE.md` §1).

## Answer

Grilling avec David, 2026-11-10. Trois questions, les trois recommandations
acceptées. David : « pour l'instant, les panneaux, on va pas aller plus en
détail ».

**D'où il s'ouvre — rien ne change par rapport à Meta.** Une annonce s'ouvre
par « Lire » dans la Comparaison, au niveau « annonces » ; un jour, par un
point de la Tendance. Le Tableau n'ouvre pas le panneau (il ne l'ouvre pas
chez Meta). Le niveau « groupes » n'a pas de « Lire » : ni le groupe
d'annonces, ni le **Groupe d'éléments** PMax n'ouvrent de panneau. Ses
éléments relèvent de l'analyse PMax, au `BACKLOG.md` (entrée du ticket 12).
Conséquence : sur un compte tout PMax, aucune annonce ne s'ouvre, et le niveau
« annonces » de la Comparaison le dit déjà (09).

**L'annonce, type par type — tout ce qu'elle contient, tel que Google l'a
reçu.** David : « quand tu ouvres, tu vois la vidéo, à quoi ça ressemble avec
tous les éléments qu'il y a dedans. Même chose pour les autres ».
- **Search (RSA)** : tous les titres (jusqu'à 15) et toutes les descriptions
  (jusqu'à 4), en entier, numérotés comme les variantes Meta (récit Meta 38),
  avec « épinglé en position N » quand un élément l'est ; le chemin
  d'affichage.
- **Display** : ses images, titres et textes, numérotés.
- **Vidéo** : la vidéo YouTube elle-même, qu'on peut lire dans le panneau,
  avec ses titres et textes s'il y en a.
- **Tous** : le lien sortant « l'annonce envoie vers… », lu dans `final_urls`,
  et pas de lien quand l'annonce n'en porte pas (récit 41) ; aucun chiffre à
  côté d'un élément, et une phrase qui dit pourquoi (récit 42) ; un champ
  absent reste vide, un montage que la récolte ne sait pas lire le dit.
- **« À quoi ça ressemble », c'est la vraie vidéo et les vraies images, jamais
  une annonce Google recomposée.** C'est Google qui assemble les combinaisons
  titre + description et les formats Display : en dessiner une serait la
  fabriquer (§7). _Lecture de la réponse de David, notée sans lui être
  reposée._

**Le jour — comme Meta.** Les changements du jour, rangés par campagne, tirés
de `platform_changes` : la récolte les **enregistre déjà** à chaque passage
(upsert), si bien que le journal remonte au-delà de 30 jours, sauf **avant la
première récolte Google** : `change_event` ne rend que les 30 derniers jours
(`CLAUDE.md` §8). Plus tôt, pas de point, donc aucun jour à ouvrir.
L'info-bulle « ⓘ » de la légende reste le seul endroit qui dit ce que le
journal ne couvre pas : la date où il commence, et les catégories que Pulse
garde pour Google (mots-clés compris), à aligner sur la récolte comme la liste
Meta l'est sur `_ACTIVITES`. Un jour hors période ne s'ouvre pas (récit 46).

**Pour la spec et la construction, non posé à David** :
- les champs de contenu ne sont **pas vérifiés sur un appel réel** — la
  recherche 01 ne les a pas couverts. Pistes :
  `ad_group_ad.ad.responsive_search_ad` (headlines, descriptions,
  `pinned_field`, path1/2), `responsive_display_ad`, `video_ad` /
  `video_responsive_ad`, `ad.final_urls`, et la ressource `asset` pour l'URL
  d'une image ou l'identifiant YouTube. Le premier passage le confirme ; rien
  ne se fabrique ;
- les images doivent rester lisibles dans six mois (récit 43). Savoir si l'URL
  d'un asset Google expire, comme celles de Meta, ou s'il faut la téléverser
  dans Storage se tranche au ticket de construction, avec la même question
  bucket public ou privé que Meta.

Aucun terme nouveau dans `CONTEXT.md`, aucun ADR : c'est l'ADR 0011 appliqué.
