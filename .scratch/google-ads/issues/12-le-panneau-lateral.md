# 12: Le Panneau latéral sur Google

Type: grilling
Status: claimed
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
