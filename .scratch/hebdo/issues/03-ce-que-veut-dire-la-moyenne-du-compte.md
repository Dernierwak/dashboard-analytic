# 03: Ce que veut dire « la moyenne du compte »

Type: grilling
Status: resolved
Blocked by: —

## Déjà tranché (pendant le ticket 02, 2026-10-28)

- **Ce qui est comparé** : la semaine du compte face à **une semaine moyenne
  du compte** — « 12 400 impressions cette semaine, pour 9 800 en moyenne ».
  Pas chaque campagne face à la campagne moyenne (ça, c'est la vue des
  campagnes / le meilleur).
- Les métriques : celles du module des canaux (ticket 02) — Meta : dépense,
  impressions, clics, CTR, CPC.
- David veut un garde-fou contre les **valeurs aberrantes** (« pour pas qu'à
  chaque fois on soit toujours en dessous ») : filtrer, ou prendre le mode.
- La période de la moyenne : **mensuelle ou annuelle**, à trancher.

## Question

David : « c'est une bonne moyenne, c'est la moyenne de notre compte, on est sur
une bonne lancée ». **Qu'est-ce qui est comparé à quoi ?**

À trancher :

- la référence : la moyenne des N dernières semaines du compte ? N combien, et
  pourquoi ce N ?
- « bonne lancée » est une **pente** (plusieurs semaines qui montent), pas un
  niveau — les deux se montrent-ils, et comment sans se contredire ?
- à quelles métriques ce repère s'applique (toutes celles du ticket 02, ou
  quelques-unes) ;
- la phrase : déterministe, sans conseil — « au-dessus de ta moyenne de 10
  semaines », jamais « continue comme ça » ;
- l'existant : la boussole porte déjà une trajectoire 10 semaines et des zones,
  la page Meta un Croisement « face à la moyenne ». Réutiliser ou remplacer ?

## Answer

Tranché avec David le 2026-10-28 → 2026-10-30.

1. **Deux sortes de chiffres sur la carte.** Les **volumes** (dépense,
   impressions, clics) s'affichent en **totaux de la semaine, sans aucune
   comparaison** — David : « on ne peut pas comparer une impression avec un
   budget qui est différent ». Les **ratios** (CTR, CPC, CPM) se comparent à
   la semaine type.
2. **La semaine type** = pour chaque ratio, la **médiane** des valeurs
   hebdomadaires sur les **12 dernières semaines complètes**, sans la semaine
   regardée, chacune calée sur le Jour de travail. Le mot « moyenne » ne
   s'écrit pas : c'est une médiane, choisie pour qu'une semaine exceptionnelle
   ne déplace pas le repère. Le mode est écarté (aucune valeur ne se répète sur
   des chiffres continus).
3. **Un ratio se calcule semaine par semaine sur ses propres totaux**, puis on
   prend la médiane (version (a)). Jamais « clics type ÷ impressions type ».
4. **Une semaine en pause** : ses volumes s'écrivent tels quels (0 impression,
   0 CHF) et ses ratios « — ». Logique simple : les 12 semaines restent
   12 semaines de calendrier ; une semaine sans ratio n'entre simplement pas
   dans la médiane. Le 0 n'est écrit que si Meta a répondu : une source qui
   n'a pas répondu reste « — » partout (§7).
5. **Minimum 6 semaines avec un ratio** dans la fenêtre ; en dessous, « — ».
   La carte **dit sur quoi porte la comparaison** : « comparé à ta semaine
   type — la médiane de tes 6 dernières semaines (12 dès que l'historique le
   permet) », avec le nombre réel de semaines.
6. **Trois états** : au-dessus / dans / en dessous de tes habitudes. La bande
   « dans tes habitudes » est l'écart interquartile des semaines de la
   fenêtre — mesurée sur le compte, aucun seuil inventé.
7. **Couleur selon le sens**, en **tons légers** : vert doux quand c'est
   mieux (CTR plus haut, CPC ou CPM plus bas), rouge doux quand c'est moins
   bien, gris dans la bande. Aucun mot de conseil.
8. **Ni pente, ni série, ni courbe** sur la page hebdo. David : « on est plus
   censé le voir sur Meta ». La page hebdo dit la santé générale.

Existant : rien n'est réutilisé. La boussole (trajectoire + zones) part déjà
avec le ticket 01 ; le Croisement de `/meta` compare des campagnes entre elles
sur une même période, pas une semaine à son historique.
