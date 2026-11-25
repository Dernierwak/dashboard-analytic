# 03: La journée de stories

Type: grilling
Status: resolved
Blocked by: 02
Assignee: —

## Question

David a tranché (2026-11-25) : les stories se lisent **regroupées par jour**.
Reste à dire ce qu'est une journée et ce qu'elle porte, sans fabriquer de
chiffre.

1. **Quel jour ?** Le jour de publication, dans quel fuseau — celui du
   compte, comme le reste de la page ? Une story publiée à 23:50 et vue
   surtout le lendemain appartient à son jour de publication ?
2. **Quels chiffres pour une journée ?**
   - les comptes (clics sur le lien, abonnés gagnés, visites de profil,
     partages, vues, navigation) **s'additionnent** ;
   - **la portée ne s'additionne pas** : la même personne voit toute la
     séquence. Candidats : la portée du compte ventilée `STORY` du jour
     (dédoublonnée, essai réel des posts point 8 — à confirmer par
     [l'essai](02-l-essai-reel-d-une-story.md)), ou la portée de la première
     story, ou « – ». Une somme est exclue.
   - Une journée dont une story a moins de 5 spectateurs : la somme devient
     partielle — l'écrire, ou « – » ?
3. **La place d'une journée** : contre les journées de stories des 12
   derniers mois, comme un post contre son format ? Une journée vaut-elle
   pour une séquence de 2 comme de 10 stories, ou faut-il un taux (par
   story, pour 1 000 comptes touchés) ? Et tant qu'il y a trop peu de journées
   en base : quelle phrase ?
4. **Le taux de sortie de la séquence** (sorties ÷ vues de la première
   story ?) a-t-il un sens mesurable, ou est-ce une estimation ?

## Answer

Tranché par Claude le 2026-11-25, sur délégation de David (« fait le tout je
te fais confiance ») ; à revoir s'il n'est pas d'accord.

1. **Le jour est celui de la publication**, dans le même calendrier que les
   posts de la page. Une journée est **complète** quand toutes ses stories ont
   été relues après 20 h de vie ; avant, elle est « en cours » et ne se compare
   pas (§7, le jour en cours est exclu).
2. **Les chiffres d'une journée** :
   - **se somment** sur les stories de la journée : vues, partages,
     interactions, abonnés gagnés, visites de profil, clics sur le lien,
     navigation par action ;
   - **la portée de la journée est celle du compte ventilée `STORY`**
     (`instagram_compte_jours.reach_story`), dédoublonnée par Instagram.
     Elle compte les comptes touchés **ce jour-là** par des stories, celles de
     la veille encore en ligne comprises : l'écran l'écrit (« comptes touchés
     par tes stories ce jour-là »). Une somme des portées est exclue ;
   - **aucun ratio entre ces deux bases** (portée du jour d'affichage, sommes
     du jour de publication) : ce serait un chiffre construit sur deux
     périmètres différents. Seul ratio gardé : **sorties pour 100 vues**
     (`tap_exit` ÷ `views`, mêmes stories) ;
   - une story sans chiffres (moins de 5 spectateurs, ou jamais relue) rend
     la somme **partielle** : la journée l'écrit (« 1 story sans chiffres »),
     les sommes restent ce qui a été mesuré, jamais complétées.
3. **La place d'une journée** se calcule contre les journées de stories des
   12 derniers mois, sur la métrique choisie, avec la mécanique et le minimum
   des formats (spec Instagram) ; le nombre de stories de la journée
   s'affiche à côté. Sous le minimum : la phrase existante des formats trop
   peu fournis.
4. **Le taux de sortie** : oui, sous la forme « sorties pour 100 vues »
   ci-dessus — deux comptes rendus par Instagram sur les mêmes stories, sans
   estimation.
