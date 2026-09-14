# Harnais 20 — le canal muet

```
cd .scratch/construction/harnais/20-canal-muet && python3.12 test_canal_muet.py
```

Ni base, ni secret, ni réseau. Il fait tourner `build_payload` pour de vrai,
à travers le seam du ticket 16.

## Ce qu'il prouve

Qu'un canal payant dont la récolte a **échoué** ne fabrique plus de chiffre :
dépense, clics, CTR, ROAS, verdict et conseils payants se taisent au lieu de se
recalculer sur ce qui reste. Et qu'il ne fait taire **que** ça — un compte sain,
un canal jamais connecté et un canal tombé après avoir tout écrit gardent leurs
chiffres intacts.

## Les deux choses qu'il fallait gréer, et pourquoi

**① Le canal muet garde son historique.** Une récolte qui échoue ne vide pas la
table : le canal a écrit jusqu'au dernier passage réussi, puis plus rien. Ses
lignes s'arrêtent donc **avant** la fenêtre du rapport pendant que celles des
autres canaux vont au bout. C'est cette forme-là qui produit le faux verdict ;
un compte simplement vide ne la reproduit pas. D'où `LecteurMuet._tronque`
(`gree.py`) plutôt qu'une liste vidée.

**② GA4 continue d'écrire, et c'est tout l'intérêt.** `LecteurFige.ga4_contexte`
calcule le revenu depuis les campagnes décrites, sans regarder si leurs lignes de
dépense sont là. C'est exactement l'asymétrie du terrain — **revenu entier,
dénominateur amputé** — et c'est elle qui fait **gonfler** le ROAS au lieu de le
faire tomber. Le harnais n'a rien eu à truquer pour l'obtenir : il suffisait de
ne pas la corriger.

## Chaque test tient son témoin

Le même compte, aux mêmes chiffres, une fois sain (`compte_sain`) et une fois
troué (`compte_muet`). Sans le témoin, un `None` pourrait venir d'un compte mal
gréé plutôt que du trou, et le test passerait pour une mauvaise raison.

## Ce que le harnais a trouvé et qui n'était pas dans le ticket

**La fenêtre reculait.** Elle s'ancre sur la dernière donnée toutes sources ;
un canal muet y apportait sa date périmée, et sur un compte **sans Instagram**
— celui qui ne fait que de la pub, donc le plus exposé — c'était la seule source.
Résultat : la fenêtre reculait jusqu'au jour où le canal s'était tu, le rapport
republiait **la semaine précédente** sous sa propre clé, et la panne devenait
invisible. Le trou se refermait sur lui-même. Corrigé dans `build_report.py` ;
c'est `test_la_semaine_declaree_ne_bouge_pas_parce_qu_un_canal_est_tombe` qui
tient la propriété.

## Ce qu'il ne couvre pas

Les pages `/`, `/couts`, `/meta` et `/google` calculent leurs chiffres **depuis
les tables brutes**, pas depuis le payload : elles ont le même trou, par un autre
chemin, et ce harnais ne les voit pas. Ticket
[48](../../issues/48-les-tableaux-de-bord-lisent-le-trou-en-direct.md).
