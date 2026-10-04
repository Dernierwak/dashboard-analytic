# 24: Le repère de la courbe pleine tait sa date au lecteur d'écran

Type: task
Status: needs-triage
Blocked by: —

**Trouvé en revue** du ticket 23 (pas demandé, donc un ticket — `CLAUDE.md` §4.4).

Depuis le ticket 23, `Courbe` (`saas/web/components/courbe.tsx`) rend ses
repères de deux façons. Dans la frise d'une fenêtre vide, un repère annonce
« date · libellé » et ouvre sa bulle au focus clavier. Sur la courbe pleine, il
n'annonce que le libellé (« 2 changements · clique pour les voir ») : un
lecteur d'écran ne sait pas de quel jour il s'agit. Et au clavier, le focus
grossit le point sans ouvrir de bulle.

Deux défauts plus petits, plus anciens que le ticket 23 :
- avec un seul jour, la date passe par la branche `i === n - 1`
  (`-translate-x-full`) et se cale à gauche du point au lieu de se centrer
  dessous (ligne de dates de `Courbe`) ;
- sans `onRepere`, un repère reste un bouton focalisable qui ne fait rien.

- [ ] Le repère de la courbe pleine dit sa date au lecteur d'écran
- [ ] Au clavier, le repère de la courbe pleine ouvre sa bulle, comme dans la frise
