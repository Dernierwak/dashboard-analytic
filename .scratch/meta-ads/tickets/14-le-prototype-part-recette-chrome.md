# 14: Le prototype part, et la page se recette dans Chrome

Type: task
Status: ready-for-human
Blocked by: 07, 08, 09, 10, 11, 12, 13

**What to build:** le dashboard Meta Ads est livré, vérifié en vrai, et rien de son
échafaudage ne reste. Spec : § « Testing Decisions », « Ce qui ne se teste qu'en
vrai ».

- [x] La route `/meta/prototype-modules` et tout son code sont supprimés ;
      `git grep` est propre
- [x] `rm -rf .next tsconfig.tsbuildinfo`, `npx tsc --noEmit` et `npm run build`
      verts, **18 routes**
- [ ] Recette dans Chrome sur le site déployé : les trois vues ; le filtre
      campagne ; la barre détachée ; un point → le panneau du jour ; « Lire » → le
      panneau d'une annonce ; un lien partagé qui rouvre le même état
- [ ] Les chiffres d'un jour de plus de 28 jours sont comparés à Ads Manager, et
      l'écart (ou son absence) est écrit ici
- [ ] Les tickets `.scratch/corrections/` 01, 02 et 03, qui réparaient la page
      remplacée, sont fermés en renvoyant ici
- [x] `CLAUDE.md` §9 ne parle plus de 19 routes ni du prototype

## Comment

**2026-10-04 — la partie code est faite, la recette attend le déploiement.**

Ce qui est fait et vérifié :
- `saas/web/app/meta/prototype-modules/` supprimé (page + `prototype.tsx`,
  rien d'autre ne l'importait). `git grep prototype-modules` ne trouve plus
  rien hors de `.scratch/` : les mentions restantes sont l'historique de la
  carte (tickets clos, spec), on ne les réécrit pas.
- `CLAUDE.md` §9 : la phrase des 19 routes et du prototype est partie.
- `rm -rf .next tsconfig.tsbuildinfo`, `npx tsc --noEmit` et `npm run build`
  verts, **18 routes** — vérifié sur une copie propre de HEAD + ce changement,
  parce que `components/channel-dash.tsx` et `app/google/page.tsx` étaient en
  cours de modification par un autre travail dans le worktree (tsc rouge sur
  `channel` non défini à ce moment-là). Ces deux fichiers ne sont pas dans ce
  commit.

Ce qui reste, et pourquoi ce n'est pas fait :
- **Recette Chrome** : elle se fait sur le site déployé, et Vercel déploie
  `main`. La branche `worktree-meta-ads-tickets-construction` n'est pas
  mergée : le site déployé montre encore l'ancienne page `/meta`. À faire
  après le merge. Les tickets 10 et 12 demandent en plus un passage du worker
  **sur le code de cette branche** (onglet GitHub Actions, `weekly-fetch.yml`)
  pour que la vue Conversion et la lecture d'une annonce aient des données.
- **Comparaison avec Ads Manager** : demande l'accès d'Ads Manager de David,
  et le site déployé à jour. Après la recette.
- **`.scratch/corrections/` 01, 02, 03** : à fermer une fois la page neuve
  vue en vrai — pas avant, une page non déployée ne remplace rien. Note : dans
  le checkout principal, tout `.scratch/corrections/` est supprimé sans être
  commité ; à trancher par David avant de les fermer ici.
- Les bloqueurs 07 à 13 sont tous `ready-for-human`, pas `resolved`.

**2026-10-04, soir — PR #5 mergée dans `main`** (commit de merge `a6a45f9`),
déploiement Vercel de production vert. Le reste est bloqué, sans contournement :
- **Passage du worker** sur `main` pour `11043e9a…` : à lancer par David
  (onglet GitHub Actions, `weekly-fetch.yml`, `user_id` seul). Le lancement
  depuis la session a été refusé par les permissions.
- **Recette Chrome** : `/meta` redirige vers `/login`. Se connecter au site
  de production avec le vrai mot de passe de David n'est pas permis à un
  agent : David se connecte dans Chrome, puis la recette reprend.
- **Lire une annonce** (ticket 12) n'aura rien à montrer tant que le ticket
  05 (récolte des créas) n'est pas construit — et le 05 attend la décision
  de David : bucket public ou privé.
- **997** (ticket 13) : à jouer par David après le passage du worker.
