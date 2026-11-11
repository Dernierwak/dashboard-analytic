# 04: La page Comptes demande la reconnexion

Type: task
Status: claimed
Blocked by: 03

**What to build:** sur la page Comptes, une connexion « à reconnecter » le
dit, depuis quand, et propose le bouton de reconnexion. Se reconnecter **relance
la récolte**, et la récolte reprend d'avant la panne : pas de trou.

- Le déclenchement existe déjà pour une source qu'on branche
  (`saas/web/app/comptes/actions.ts` → `lancerWorkflow`,
  `lib/github-workflow.ts`). Vérifier qu'une RECONNEXION passe aussi par là ;
  sinon, l'y brancher.
- Le rattrapage est automatique : la mise à jour part de la dernière date en
  base moins le recouvrement. **Le dire dans le ticket avec le chemin du code,
  pas le supposer.**
- Exception à afficher honnêtement : `change_event` Google ne remonte que 30
  jours (`CLAUDE.md` §8). Une panne Google plus longue perd les changements
  d'avant — l'écran le dit au lieu de montrer une frise qui a l'air complète.
- Propriétaire seulement (§7).

- [x] `rm -rf .next tsconfig.tsbuildinfo`, `npx tsc --noEmit`, `npm run build`
      verts, **18 routes**
- [ ] Recette : un compte marqué à la main « à reconnecter » → le message
      s'affiche ; reconnexion → un run `weekly-fetch.yml` part
- [ ] Après ce run : les jours de la panne sont en base

## Comment

**2026-10-07 — construit sur la branche `recolte/jeton-comptes` (worktree
`.claude/worktrees/jeton-comptes`), non commité. Reste la recette, qui attend
la migration 4bis et le branchement du ticket 03.**

Fichiers (dans le worktree) :
- `saas/web/lib/connexions.ts` — `EtatCanal.aReconnecter`, et
  `reconnecterMeta` / `reconnecterGoogle` sur `Connexions`. Les deux colonnes
  sont lues dans une requête À PART qui tolère leur absence : sur une base où
  la 4bis n'est pas jouée, la page reste exactement celle d'aujourd'hui au lieu
  d'afficher les quatre canaux « à brancher ». Un canal à reconnecter n'est
  plus « prêt ».
- `saas/web/app/comptes/page.tsx` — un encart par plateforme en tête de page
  (« Pulse ne récolte plus … depuis le … », la raison de la plateforme, bouton
  « Reconnecter Meta/Google ») ; pastille et mention « à reconnecter » sur les
  lignes ; les canaux à reconnecter comptent dans « il reste N sources ». La
  page entière est déjà réservée au propriétaire (retour anticipé si
  `compte.uid !== compte.moi`). Exception Google : quand la panne a commencé
  il y a plus de 30 jours, l'encart dit « ceux du X au Y ne pourront pas être
  récupérés » (fenêtre de `change_event`, constante commentée avec la doc).
- **Bug trouvé et corrigé** : la reconnexion Meta était IMPOSSIBLE. Le choix de
  Page ne s'affichait que si Meta n'était PAS connecté
  (`jetonMeta && !cx.canaux[0].connecte`) ; un client déjà connecté repassait
  par Facebook, son jeton neuf restait dans le cookie de transit et l'ancien,
  mort, restait en base. Le choix s'affiche désormais dès qu'un jeton est en
  transit (le cookie est effacé par `connecterMeta` dès l'écriture).
- `saas/web/lib/reconnexion.ts` — `leverReconnexion()`, remise à NULL des deux
  colonnes, best-effort et séparée de l'écriture du jeton (une base sans 4bis
  ne doit pas faire perdre un jeton neuf). Module SANS directive : exportée
  depuis `actions.ts` (`"use server"`), elle serait devenue une action
  appelable par n'importe quel navigateur.
- `saas/web/app/comptes/actions.ts` — `connecterMeta` lève l'état après
  l'écriture.
- `saas/web/app/api/oauth/google/callback/route.ts` — sur une RECONNEXION
  (ligne Google existante avec un compte Ads ou une propriété déjà choisis) :
  lève l'état et relance la récolte (`lancerWorkflow({ user_id })`).

**La reconnexion relance-t-elle la récolte ? (lu dans le code)**
- Meta : oui, déjà. Reconnecter → Facebook → choix de la Page →
  `connecterMeta` (`app/comptes/actions.ts`) → `amorcerRecolte` →
  `lancerWorkflow({ user_id })` (`lib/github-workflow.ts`). Ce chemin était
  coupé par le bug ci-dessus ; il passe maintenant.
- Google : NON avant ce ticket. Le retour OAuth écrivait le refresh token et
  renvoyait sur `/comptes` ; le compte Ads et la propriété étant déjà choisis,
  aucun choix ne se reposait, donc aucun `amorcerRecolte`. Branché dans le
  callback.

**Le trou se rattrape-t-il ? (lu dans le code)** Oui pour les chiffres : la
récolte repart de la dernière date en base moins le recouvrement —
`_depart_recolte(latest, today, recouvrement)` dans
`saas/collecte/automatisation/fetch_all.py` (Meta : `fetch_meta_ads_latest_date`
− 28 j ; Google : `fetch_google_ads_latest_date` − 30 j) et
`saas/collecte/ga4/ga4.py` (GA4 : − 12 j). Ces chemins changent avec la
restructuration : à re-citer après la fusion. Non pour les changements Google
au-delà de 30 jours : dit à l'écran.

Vérifié (dans le worktree) : `npm ci`, `rm -rf .next tsconfig.tsbuildinfo`,
`npx tsc --noEmit` vert, `npm run build` vert, **18 routes**. Aucune variable
d'environnement manquante n'a bloqué le build. `.next` supprimé après.

Pas vérifié : l'affichage réel (pas de recette navigateur), le dispatch réel.
La recette demande la 4bis jouée et une ligne marquée à la main.
