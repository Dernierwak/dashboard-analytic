# 14: Le prototype part, et la page se recette dans Chrome

Type: task
Status: ready-for-agent
Blocked by: 07, 08, 09, 10, 11, 12, 13

**What to build:** le dashboard Meta Ads est livré, vérifié en vrai, et rien de son
échafaudage ne reste. Spec : § « Testing Decisions », « Ce qui ne se teste qu'en
vrai ».

- [ ] La route `/meta/prototype-modules` et tout son code sont supprimés ;
      `git grep` est propre
- [ ] `rm -rf .next tsconfig.tsbuildinfo`, `npx tsc --noEmit` et `npm run build`
      verts, **18 routes**
- [ ] Recette dans Chrome sur le site déployé : les trois vues ; le filtre
      campagne ; la barre détachée ; un point → le panneau du jour ; « Lire » → le
      panneau d'une annonce ; un lien partagé qui rouvre le même état
- [ ] Les chiffres d'un jour de plus de 28 jours sont comparés à Ads Manager, et
      l'écart (ou son absence) est écrit ici
- [ ] Les tickets `.scratch/corrections/` 01, 02 et 03, qui réparaient la page
      remplacée, sont fermés en renvoyant ici
- [ ] `CLAUDE.md` §9 ne parle plus de 19 routes ni du prototype
