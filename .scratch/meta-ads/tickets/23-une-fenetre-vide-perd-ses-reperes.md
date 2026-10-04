# 23: Une fenêtre entièrement vide perd ses repères de changement

Type: task
Status: resolved
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

- [x] Une fenêtre sans aucun chiffre garde l'accès aux jours où le compte a changé

## Réponse

Tranché : **une frise de repères sans axe des valeurs**, dans `Courbe`
(`saas/web/components/courbe.tsx`). Le lien vers le Panneau a été écarté parce
qu'il n'ouvre qu'un jour, alors qu'une fenêtre peut en porter plusieurs. La
frise garde le geste de la courbe pleine : un point orange par jour, qui se
clique et se prend au clavier, avec la même bulle.

Une fenêtre sans aucun chiffre rend toujours « Aucun chiffre à tracer sur cette
période. ». Si elle porte des repères, ils s'alignent **sous la phrase**, avec
les dates de la fenêtre juste dessous. Ils ne sont pas au pied du cadre, là où
la courbe pose le zéro, sinon on les lirait comme une valeur nulle. Il n'y a
pas de ligne de base non plus. Chaque point dit sa date et son libellé au
lecteur d'écran, et un clic ouvre le jour dans le Panneau (`onRepere`, sans
changement côté `tendance.tsx`). Sans repère, la phrase reste seule, comme au
ticket 18.

La revue a fait sortir le bouton de repère et sa ligne de bulle en
`BoutonRepere` / `PastilleRepere`, partagés par les deux rendus, et le seuil
de bascule de la bulle en `bulleAGauche`.

Vérifié :
- harnais de rendu serveur jetable (`typescript.transpileModule` +
  `renderToStaticMarkup`) : 9/9 sur le nouveau code. Sur `courbe.tsx` de HEAD,
  il échouait sur 3 points (aucun bouton de repère dans une fenêtre vide). La
  courbe pleine rend toujours son SVG et son repère ;
- `npx tsc --noEmit` et `npm run build` verts, 18 routes.

Non vérifié dans Chrome : le placement et la bulle n'ont été vus que dans le
markup rendu. Rien ne passe par le worker : le changement se voit dès le
déploiement de la page, sans relancer `weekly-fetch.yml`.

Les écarts que la revue a relevés sur la courbe pleine sont au ticket 24.
