# 23: Une fenêtre entièrement vide perd ses repères de changement

Type: task
Status: needs-triage
Blocked by: —

**Trouvé en revue** du ticket 18 (pas demandé, donc un ticket — `CLAUDE.md` §4.4).

Quand aucune des deux séries de la Tendance ne porte une seule valeur, `Courbe`
(`saas/web/components/courbe.tsx`) rend une phrase à la place du graphe, et les
repères du journal des changements partent avec lui. Or le commentaire de
`yRepere` le dit lui-même : « une mise en pause rend justement les jours suivants
vides, et c'est le changement qu'on cherche ». Une campagne mise en pause avant
la fenêtre regardée, puis un changement pendant la fenêtre, et le client ne voit
ni courbe ni point à cliquer.

Ce n'est pas une régression : l'esquive du ticket 10 dans `tendance.tsx` avait
déjà ce défaut. Le ticket 18 l'a seulement déplacé dans `Courbe`.

À trancher : où les changements d'une fenêtre sans chiffre se lisent — une
frise de repères sans axe des valeurs, ou un lien vers le Panneau latéral sous
la phrase.

- [ ] Une fenêtre sans aucun chiffre garde l'accès aux jours où le compte a changé
