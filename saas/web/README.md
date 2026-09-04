# saas/web — Pulse, le portail moderne (Next.js)

La nouvelle interface : **Next.js 14 (App Router) + Tailwind**, mobile + desktop,
avec **ton design system** (couleurs, DM Sans/Mono, signes géométriques) porté tel quel.

## Lancer en local

Prérequis : **Node.js 18+** installé.

```bash
cd saas/web
npm install
# .env.local avec les 2 variables (voir « Variables d'environnement »)
npm run dev
```

Puis ouvre http://localhost:3000 — et réduis la fenêtre pour voir le rendu mobile.

## Où on en est

- ✅ Fondation Next.js + thème Tailwind (tes tokens)
- ✅ **Auth Supabase** (@supabase/ssr), middleware de protection des routes
- ✅ Rapport hebdo en **vraies données** : KPIs 7 jours pleins (ancrés dernière donnée), deltas vs 7 j précédents, dépense par canal
- ✅ **Conseils réels** via `weekly_reports` — payload publié en headless par `saas/traitement/build_report.py` (cron GitHub Actions), plus de pont
- ✅ **Réactions** ✓ Fait / ● Utile / ✕ Pas pour moi → `reco_feedback`
- ✅ Pages Coûts (`app/couts`), Labels (`app/labels`), Comptes (`app/comptes`), Équipe (`app/equipe`), Meta (`app/meta`), Google (`app/google`), Instagram (`app/instagram`), Conversions (`app/conversions`)
- ✅ OAuth Meta + Google (`app/api/oauth/`), Stripe non branché (voir `BACKLOG.md`)

## Variables d'environnement

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anon/publishable Supabase |

En local : mets-les dans `saas/web/.env.local` (gitignoré). Jamais la clé service_role ici.

## Déployer sur Vercel (10 minutes)

1. **vercel.com** → Log in (avec ton compte GitHub) → **Add New… → Project**
2. **Import** le repo `Dernierwak/dashboard-analytic`
3. Réglages du projet :
   - **Root Directory** : `saas/web` (clique Edit à côté de Root Directory)
   - **Framework Preset** : Next.js (détecté tout seul)
   - **Environment Variables** : ajoute les 2 variables du tableau ci-dessus
4. **Deploy** → tu obtiens une URL `https://….vercel.app` à ouvrir sur ton téléphone
5. (Réglage) **Settings → Git → Production Branch** : choisis la branche à déployer
   (celle qui contient `saas/web`, tant que ce n'est pas fusionné dans `main`)

Chaque `git push` sur la branche redéploie automatiquement. La migration
`supabase/migrations/000_run_me_all.sql` doit être passée pour que les conseils
et les réactions fonctionnent (table `weekly_reports` + `reco_feedback`).
