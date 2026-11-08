# 06: La place d'un post

Type: grilling
Status: resolved
Blocked by: 02
Assignee: Claude

## Question

« Sur les 5 premiers, 2 sont dans la moyenne, 2 sur les 50-75 % et 1 valeur
aberrante » (David). **Comment se définit la place d'un post dans la foule des
posts du compte ?**

- **Quelle foule** : tous les posts relus, les N derniers, ceux d'une période,
  ou seulement ceux du **même format** (un Reel face aux Reels) ?
- **Sur quelle métrique** : celle choisie par le client, ou une place par
  métrique ?
- **Quelles bandes** : quartiles (sous 25 %, 25-50, 50-75, au-dessus de 75),
  la médiane plutôt que la moyenne, et la règle d'**aberrante** (au-delà de
  1,5 × l'écart interquartile, comme la moustache de l'hebdo ?) ;
- **Combien de posts au minimum** pour qu'une place ait un sens — et ce
  qu'affiche un compte qui ne les a pas ;
- **« Les moyennes façon hebdo »** : est-ce la même chose que la place (le
  post sur la moustache du compte), ou un bloc à part ?

Et le mot : **« la place »** convient-il, ou un autre ? Référence de forme :
la moustache du rail des canaux de l'hebdo (`saas/web/components/hebdo/`).

> **Éclairé par [La structure de la page](01-la-structure-de-la-page.md)
> (2026-11-02)** : « les moyennes façon hebdo » et la place sont **un seul
> module**, la Comparaison — une moustache **par format**, sur la métrique de
> l'objectif choisi (Portée, Engagement, Abonnés). La question « quelle
> foule » penche donc vers le même format. Deux points pro ajoutés par David :
> - **la portée rapportée aux abonnés le jour de la publication** — un post
>   publié à 2 000 abonnés ne part pas de la même ligne qu'un post à 5 000 ;
>   dépend de [L'état des abonnés en base](16-l-etat-des-abonnes-en-base.md) ;
> - **le `n` écrit sur chaque moustache** — 3 Reels ne valent pas 40 images.

## Grilling — trois séries (2026-11-03, réponses de David)

Fait vérifié avant la séance : la moustache de l'hebdo
(`saas/data/supabase/processed_data/weekly_report/blocs/canaux.py:15-18`,
`:103-118`) prend des quartiles en méthode exclusive, juge à partir de **6**
valeurs, a trois états (au-dessus de q3 / dans / sous q1) et **aucune règle
d'aberrante** — ses traits vont du min au max (`moustache.tsx:43-52`).

1. **La foule = les posts du même format**, sur la période du Bandeau de
   commandes. « Il faut absolument comparer la même chose » (David).
2. **Quatre bandes** en quartiles exclusifs (sous q1, q1→médiane,
   médiane→q3, au-dessus de q3) ; le repère est la **médiane**, jamais la
   moyenne ; **aberrante = règle de Tukey** (au-delà de q3 + 1,5 × IQR ou en
   deçà de q1 − 1,5 × IQR), signalée, jamais écartée seule. Règle nouvelle
   dans Pulse — l'hebdo n'en a pas. Réserve notée : sur des chiffres de posts
   asymétriques, Tukey brut marquera surtout vers le haut ; à revoir au mode
   « plus pro » si ça sonne trop souvent.
3. **Minimum : 6 posts du même format**, le seuil de l'hebdo. En dessous, les
   points et le `n` restent, sans boîte ni place, et **une mention le dit** —
   avec le nombre manquant, et le fait qu'une période plus longue en
   contiendrait assez : « sur une semaine ça ne marchera peut-être pas, sur un
   mois oui — il faut que ce soit dit » (David).
4. **Le post compte dans sa propre foule** : quartiles calculés une fois par
   format, chaque post situé dessus — le chiffre écrit est celui qu'on voit
   sur la moustache. (L'hebdo, lui, compare la semaine aux 12 *précédentes* ;
   ici une seule moustache par format est dessinée pour tous ses posts.)
5. **Une place par métrique, pas seulement celle de l'objectif** (David :
   « si on change de métrique, la moustache change… voir Reels avec les
   likes, Reels avec la portée »). Engagement se lit **en taux**
   (interactions ÷ portée du post, vide si la portée manque) ; Portée en
   **brut**, la portée ÷ abonnés du jour de publication venant en variante
   « plus pro » quand [L'état des abonnés en base](16-l-etat-des-abonnes-en-base.md)
   la permettra — un jour sans abonnés connus ne donne aucun ratio.
6. **Les mots** : le concept est **la place** d'un post. À l'écran : médiane
   = « post type » ; sous q1 « en dessous », q1→médiane « bas de tes
   habitudes », médiane→q3 « haut de tes habitudes », au-dessus de q3
   « au-dessus » ; aberrante = « hors norme » (neutre dans les deux sens ;
   « aberrant » sonne comme une erreur).
7. **Le choix de la métrique se fait dans l'objectif** : l'objectif donne la
   métrique par défaut, la Comparaison offre ensuite les métriques de cet
   objectif, **chacune séparément** — Portée : portée, vues ; Engagement :
   taux (par défaut), likes, commentaires, partages, enregistrements ;
   Abonnés : `follows`, visites de profil. David : « j'aimerais pas qu'en
   engagement on n'ait que le taux ». Un format qui n'a pas la métrique voit
   sa moustache remplacée par une phrase (« Instagram ne donne pas les
   abonnés gagnés pour les Reels »), jamais une moustache à zéro. Liste à
   confirmer par [L'essai réel des métriques](17-l-essai-reel-des-metriques.md).
8. **Un nuage à côté de la moustache** : date de publication × métrique
   choisie, une couleur par format, les posts jeunes en creux. **Réserve de
   David, ouverte** : la Comparaison compare des *formats*, le nuage montre des
   *posts* — deux niveaux dans un module, « ça peut poser problème ». Se juge
   sur maquette ([La page entière, en maquette](13-la-page-entiere-en-maquette.md)).
9. **Une place à la fois, sur la métrique choisie, partout** — la Sélection et
   le Tableau détaillé suivent la métrique ; pas de grille de places sur
   toutes les métriques. « Si on travaille sur les likes, tout est filtré sur
   les likes » — à éprouver en maquette.

## Résolution (2026-11-03)

**La place d'un post** = sa bande dans la foule des posts **de son format**,
sur la **période du Bandeau de commandes**, lui compris, **sur la métrique
choisie**. Quartiles en méthode exclusive (le calcul de l'hebdo) ; quatre
bandes autour du **post type** (la médiane) ; **hors norme** au-delà de
1,5 × IQR (Tukey), signalé, jamais écarté seul. Pas de place sous **6 posts du
format** : les points et le `n` restent, une mention dit combien il en manque
et qu'une période plus longue en contiendrait assez.

« Les moyennes façon hebdo » = la Comparaison : une moustache par format, qui
change avec la métrique ; la métrique se choisit **dans l'objectif**, chacune
séparément. Un nuage date × métrique l'accompagne, sous réserve de la maquette.

Répercuté sur : la carte (Decisions so far, vocabulaire) ;
[Écarter un post](08-ecarter-un-post.md),
[Les règles d'analyse réglables](11-les-regles-d-analyse-reglables.md),
[Le carré en maquette](12-le-carre-en-maquette.md),
[La page entière en maquette](13-la-page-entiere-en-maquette.md),
[Ce que le traitement doit calculer](14-ce-que-le-traitement-doit-calculer.md),
[Le compte gratuit à 10 posts](18-le-compte-gratuit-a-10-posts.md),
[Les posts boostés](19-les-posts-boostes.md).

> **Amendé par [La page entière, en maquette](13-la-page-entiere-en-maquette.md)
> (2026-11-06)** : la foule d'un post n'est plus « ceux de son format sur la
> période » mais **ses pareils des 12 derniers mois glissants** (plus de
> 48 h), quelle que soit la période affichée — elle ne choisit plus que les
> posts posés sur le nuage. Quartiles exclusifs, Tukey 1,5, minimum 6 :
> inchangés. À côté, deux moustaches d'évolution (3 derniers mois, dernier
> mois), sans place calculée contre elles. Un post plus vieux que 12 mois :
> [La place d'un post hors de l'année](20-la-place-d-un-post-hors-de-l-annee.md).
