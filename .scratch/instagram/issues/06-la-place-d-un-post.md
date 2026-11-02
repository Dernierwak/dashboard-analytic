# 06: La place d'un post

Type: grilling
Status: open
Blocked by: 02
Assignee: —

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
