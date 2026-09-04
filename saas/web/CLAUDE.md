# CLAUDE.md — saas/web/

Ce dossier est **Pulse**, le produit que le client voit : Next.js 14 (App
Router), TypeScript, Tailwind, déployé sur Vercel depuis `main`. Il ne
calcule ni ne récolte rien lui-même — il **lit** ce que
`saas/collecte/`, `saas/recos_ia/` et `saas/traitement/build_report.py` ont
déjà écrit dans Supabase (`weekly_reports.payload` pour le rapport, les
tables par canal pour les dashboards). Voir `CLAUDE.md` § 7 pour pourquoi la
fabrication du rapport n'est PAS ici (temps d'exécution serverless, secrets,
déclenchement cron).

Le projet est **Pulse**, un SaaS d'analyse marketing (voir `CLAUDE.md` à la
racine du dépôt pour le produit dans son ensemble).

## Lancer en local

```bash
cd saas/web
npm install
# .env.local avec NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

Vérifier avant de dire que c'est fait (règle de la racine, rappelée ici parce
qu'elle s'applique à CHAQUE changement dans ce dossier) :
`rm -rf .next tsconfig.tsbuildinfo`, puis `npx tsc --noEmit` et `npm run build`
verts, **16 routes** — un écart signale une page de contrôle oubliée.

## Les pages (`app/`)

| Route | Ce qu'elle montre |
|---|---|
| `/` (`page.tsx`) | Le rapport hebdo — KPIs, recos, brief. Lit `weekly_reports`, publié par `saas/traitement/build_report.py`. |
| `/meta` | Dashboard Meta Ads — périodes 7→Tout, filtres, hero impressions, KPIs, évolution quotidienne, campagnes → adsets → annonces. |
| `/google` | Dashboard Google Ads — même structure que Meta, jusqu'aux annonces (`google_ads_ad_insights`). |
| `/instagram` | Dashboard Instagram organique — page, courbe abonnés, posts un par un, formats, créneaux, top posts, par label. |
| `/labels` | Le copilote des thèmes — sans eux, pas de bilan ni de conseil par thème. Une campagne non étiquetée disparaît de presque toute l'analyse. |
| `/conversions` | Sélection et catégorisation des conversions GA4 — vivait éclaté sur `/labels` avant, regroupé ici. |
| `/couts` | Budget publicitaire — un seul horizon piloté, l'année (pas jour ni mois). |
| `/comptes` | Brancher Meta/Google sur Pulse. Une autorisation OAuth accordée n'est pas une source de données branchée — voir le compte publicitaire ET la propriété Analytics, chacun sa propre étape. |
| `/equipe` | Inviter un membre. Les données ne sont jamais dupliquées (on élargit la règle de lecture) ; les jetons Meta/Google, eux, ne sont jamais partagés — voir `CLAUDE.md` § 7. |
| `/login` | Auth Supabase. |

## Auth et protection des routes

`middleware.ts` rafraîchit la session Supabase à chaque requête et protège
les routes : pas connecté → `/login` ; connecté sur `/login` → rapport. Toute
nouvelle route sous `app/` passe par ce middleware sans configuration
supplémentaire.

`app/api/oauth/{meta,google}/{start,callback}/route.ts` portent le parcours
OAuth des deux plateformes — permissions minimales demandées, voir les
commentaires en tête de chaque `start/route.ts` pour pourquoi elles ne
changent pas à la légère (un changement de scope oblige tous les comptes
déjà connectés à re-consentir).

## Conventions à connaître avant de toucher un module

- **La grammaire d'un module : neuf rangs, et le rang 3 est LE chiffre** —
  aucune forme graphique avant lui. Un module qu'on lit porte un titre
  (rang 1), une sortie/action (rang 2), le chiffre qui compte (rang 3), son
  contexte (rang 5), son pilotage (rang 8). Voir
  `saas/web/components/jour-recolte.tsx` (tête de fichier) pour un exemple
  commenté rang par rang — la référence complète (`docs/03-grammaire-des-modules.md`)
  n'existe plus sur le disque au moment où ce fichier est écrit (suppression
  non commitée, antérieure à cette réorganisation) ; si elle manque encore,
  ce n'est pas une nouvelle panne, le signaler à David plutôt que d'inventer
  une grammaire de mémoire.
- **En grille et en flex, `min-width`/`min-height` valent `auto` par défaut**
  — un élément refuse de rétrécir sans `min-w-0`/`min-h-0`. Jamais une police
  plus petite pour compenser.
- **Une constante exportée depuis un module `"use client"` devient une
  référence client côté serveur** — aucune erreur, TS passe, la valeur lue
  est un proxy. Les valeurs partagées vivent dans un module sans directive.
- **Un lien énumère ce qu'il CHANGE, jamais ce qu'il garde** — sinon il perd
  par construction tout paramètre ajouté après lui.
- **Un refus RLS sur un `update` ne renvoie aucune erreur** — il touche zéro
  ligne. Vérifier l'écriture, pas seulement la réponse « enregistré ».

## Structure

- `app/` — les pages (App Router) + `app/api/` (routes OAuth) + `actions.ts` /
  `actions-compte.ts` (server actions).
- `components/` — 56 composants, un par module d'écran en général.
- `lib/` — logique partagée : `channels.ts` (dashboards Meta/Google/Instagram),
  `report.ts` (payload `weekly_reports`), `budgets.ts`, `couts.ts`,
  `couverture.ts`, `changements-api.ts`, `oauth.ts`/`oauth-api.ts`, `account.ts`,
  `connexions.ts`, `palette.ts`, `liens.ts`, `nav-cookie.ts`, `nav-largeur.ts`.

## Déployer

Voir `saas/web/README.md` pour la procédure Vercel complète (Root Directory
`saas/web`, variables d'environnement, branche de prod).
