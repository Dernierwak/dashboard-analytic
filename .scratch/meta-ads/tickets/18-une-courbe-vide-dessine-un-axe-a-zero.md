# 18: Une courbe vide dessine un axe à zéro

Type: task
Status: needs-triage
Blocked by: —

Trouvé en construisant le ticket 10, dans Chrome sur décembre 2025.
`components/courbe.tsx` dessine ses axes même quand toutes les valeurs sont
`null` : l'échelle tombe de 0 à 0 et l'axe écrit « 0,00 CHF ». Un client y lit
un zéro là où rien n'est mesuré (`CLAUDE.md` §7 : une absence n'est pas un
zéro).

Le ticket 10 l'esquive pour la seule Tendance (`components/meta/tendance.tsx` :
une phrase à la place du graphe quand les deux séries sont vides). La
Comparaison et les autres pages qui utilisent `Courbe` ont toujours le
défaut — par exemple une semaine sans aucune ligne.

- [ ] `Courbe` ne dessine ni axe ni graduation sans au moins une valeur, et le
      dit ; l'esquive du ticket 10 dans `tendance.tsx` part
