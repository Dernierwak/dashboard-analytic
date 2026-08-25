# Plan de retrait de Streamlit

Ce document est l'inventaire de sécurité du nettoyage. Une case n'est cochée
qu'après vérification dans la branche de référence.

**Statut : retrait terminé** (TASK-016). Streamlit est entièrement retiré du
dépôt — zéro import réel restant, worker et build Next.js vérifiés verts.

## Zone protégée — ne pas supprimer

- [x] `.claude/`
- [x] `CLAUDE.md`
- [x] `memory/`
- [x] `docs/`
- [x] `handoff/`
- [x] `BACKLOG.md`
- [x] règles métier et commentaires porteurs d'un arbitrage

## À extraire avant suppression

- [x] Déplacer `components/ga4.py` vers une couche headless de `saas`.
      → `saas/core/ga4.py`. Imports mis à jour dans `saas/worker/fetch_all.py`
      et `saas/worker/build_report.py` (plusieurs imports locaux).
- [x] Déplacer le moteur partagé de `components/reco_engine.py` vers `saas/core`.
      → `saas/core/reco_engine.py` REMPLACÉ (l'ancienne copie y était stale —
      dix règles vs les règles à jour dont `_rule_roas`, `_rule_funnel`,
      `_rule_ga4_muet`). Imports mis à jour dans `saas/worker/build_report.py`
      et `saas/worker/insights.py`. `saas/worker/run_weekly.py` pointait déjà
      vers ce chemin (`from core.reco_engine import ...`, résolu via son propre
      `sys.path`) — aucun changement nécessaire là, le contenu est maintenant à jour.
- [x] Déplacer les accès aux données utiles de `scripts/` vers `saas`.
      → Décision, motivée dans le corps de la tâche : `scripts/fetch_data.py`,
      `scripts/insert_data.py`, `scripts/app_secrets.py`, `scripts/labels.py`
      étaient déjà 100% headless (zéro import Streamlit) et déjà appelés
      directement par le worker depuis leur emplacement racine — confirmé par
      `saas/worker/fetch_all.py` qui les importe tel quel et par le
      `CLAUDE.md` déjà réécrit qui documente `scripts/` comme emplacement
      cible permanent. Aucun déplacement physique n'était donc nécessaire ni
      cohérent avec l'architecture déjà en place ; seuls les deux fichiers
      réellement liés à Streamlit (`scripts/ai_reco.py`, `scripts/stripe.py`)
      ont été supprimés (section suivante). `scripts/app_secrets.py` a en plus
      été nettoyé de son fallback `st.secrets` (mort, plus aucun Streamlit à lire).
- [x] Séparer la collecte de l'interface dans `meta_script/fetch_meta_ads.py`.
      → Classe UI `PaidMeta` et le bloc `__main__` de debug (tous deux
      Streamlit, tous deux inutilisés par le worker) supprimés. Les fonctions
      headless (`fetch_campaign_budgets`, `fetch_activities`, helpers) étaient
      déjà séparées dans le fichier (section « Récolte headless ») — elles
      restent, désormais seules dans le module. Zéro import Streamlit restant.
- [x] Séparer la collecte de l'interface dans `meta_script/fetch_instagram.py`.
      → Méthodes UI (`_fetch_id_instagram`, `_fetch_id_business` — session
      Streamlit et flux de sélection de Page, superseded par
      `saas/web/lib/oauth-api.ts` côté Next.js —, `fetch_insta_post_insight`,
      `show_insta_data`) supprimées. `fetch_headless()` (utilisée par le
      worker) et ses dépendances directes restent, inchangées dans leur
      logique. Zéro import Streamlit restant.
- [x] Rediriger tous les imports de `saas/worker` vers les nouveaux modules.
      → `fetch_all.py`, `build_report.py`, `insights.py` mis à jour
      (`components.ga4` → `saas.core.ga4`, `components.reco_engine` →
      `saas.core.reco_engine`). `google_script/*`, `scripts/*`,
      `meta_script/*` restent importés depuis la racine (déjà la bonne
      architecture, voir plus haut).
- [x] Vérifier qu'aucun import de `saas/` ne charge `streamlit`.
      → `grep -rn streamlit saas/ --include=*.py` : zéro résultat.

⚠ Point de vigilance du plan, vérifié à l'état réel avant de commencer :
`google_script/fetch_google_ads.py` était déjà 100% headless (confirmé par
grep : aucun import Streamlit) — rien à en extraire. `meta_script/fetch_instagram.py`,
lui, avait bien encore du Streamlit mélangé à la collecte (traité ci-dessus,
extraction faite). `meta_script/fetch_meta_ads.py` avait sa collecte déjà
séparée dans le fichier (section « Récolte headless »), mais gardait encore
la classe UI `PaidMeta` et un bloc `__main__` Streamlit — retirés.

## Suppressions après extraction et validation

- [x] `landing.py`
- [x] `pages/` (`main.py`, `privacy.py`, `rapport.py`)
- [x] `pages.toml`
- [x] `.streamlit/config.toml`
- [x] composants d'interface restants dans `components/` — dossier entier
      supprimé après extraction de `ga4.py`, `reco_engine.py` et, en plus du
      plan (trouvaille pendant l'audit), `user_persona.py` (headless, logique
      de profil utilisateur IA non dupliquée ailleurs — voir `BACKLOG.md`).
- [x] `scripts/stripe.py`
- [x] `scripts/ai_reco.py` (+ `components/ai_reco.py`, la moitié UI du même
      système, supprimée avec le reste de `components/`)
- [x] anciens callbacks OAuth exclusivement Streamlit — `components/callbacks.py`,
      `components/auth.py`, `components/reset_pass.py`,
      `meta_script/callback_server.py`, `meta_script/fetch_token.py`
      (celui-ci chargeait `st.secrets` au niveau module — ne pouvait déjà plus
      être importé sans Streamlit configuré). Confirmé superseded par
      `saas/web/app/api/oauth/*` et `saas/web/lib/oauth-api.ts` (même logique
      de repli Business Manager, même ordre « sauver avant de choisir »).
- [x] dépendances Streamlit, Plotly et Flask devenues inutiles — `requirements.txt`
      réduit à `supabase`, `pandas`, `requests` (plus `streamlit`, `plotly`,
      `stripe`, `flask`, `openai`, `anthropic` — ces deux derniers étaient déjà
      morts, seule référence dans `scripts/ai_reco.py` supprimé).

## Documentation à actualiser, pas à jeter

- [x] Réécrire `CLAUDE.md` autour de Pulse et de l'architecture Next.js. —
      déjà fait par une session précédente ; corrigé ici : ligne `components/ga4.py`
      → `saas/core/ga4.py`, ligne racine Streamlit retirée (fichiers
      n'existent plus), ajout d'une ligne `saas/core/`, compte de routes
      Next.js (13 → 16, réel).
- [x] Actualiser les agents et skills dont les chemins pointent vers l'ancien
      emplacement du moteur. — `.claude/agents/recos.md` (`components/reco_engine.py`
      → `saas/core/reco_engine.py`), `.claude/agents/vision-produit.md`
      (« Sortir de Streamlit » → fait), `.claude/launch.json` (config de lancement
      Streamlit retirée, ne pointait plus que sur un fichier supprimé).
- [x] Actualiser `GOOGLE_ADS_SETUP.md` et les documents légaux. —
      `GOOGLE_ADS_SETUP.md` réécrit (redirect URIs Next.js, variables Vercel
      vs GitHub Actions séparées, `000_run_me_all.sql`). `legal/PRIVACY_POLICY.md`
      (hébergement Streamlit → Vercel) et `legal/README.md` (option de
      publication Streamlit → Next.js) corrigés.
- [x] Actualiser les README de `saas/` et `saas/web/`. — les deux réécrits :
      plus de cadre « strangler pattern à côté du Streamlit », état réel des
      pages Next.js (comptes/couts/labels/équipe/meta/google/instagram/conversions
      existent déjà), `saas/core/` documenté comme emplacement définitif (plus
      une « copie isolée »), `run_weekly.py` requalifié en démo non câblée
      (honnête sur son état réel, `run()` reste `NotImplementedError`).
- [x] Extraire des anciens fichiers toute règle métier encore unique. —
      voir ga4.py / reco_engine.py / user_persona.py ci-dessus. Auditées et
      confirmées superseded (pas d'extraction nécessaire, logique déjà
      reconstruite côté Next.js ou déjà dupliquée dans le worker) : OAuth Meta/Google
      (`components/callbacks.py`), pacing budget (`components/couts.py`,
      Next.js a un système différent et plus complet dans `app/couts/`),
      panneau insights IA (`components/insights_panel.py`, système IA plus
      ancien que `reco_engine.py`, même famille que `ai_reco.py`), fetch manuel
      UI (`components/meta_ads.py::run_meta_ads_fetch`,
      `components/google_ads.py::run_google_ads_fetch`,
      `components/instagram_tab.py::run_instagram_fetch` — le worker a ses
      propres fonctions `_fetch_meta`/`_fetch_google`/`_fetch_instagram` dans
      `fetch_all.py`, jamais ces variantes UI).
      Mailing : `saas/emailing/` (Resend) couvrait déjà tout — aucune logique
      de mailing trouvée côté Streamlit à extraire.
      `handoff/README.md` : section obsolète (équivalences design → widgets
      Streamlit) remplacée par une note historique, le fichier lui-même
      conservé (zone protégée).

## Validation avant suppression définitive

- [x] Compilation de tous les modules Python headless. —
      `python3.12 -m py_compile` vert sur `scripts/`, `meta_script/`,
      `google_script/`, `saas/core/`, `saas/emailing/`, `saas/worker/`.
- [x] Exécution contrôlée des tests ou contrôles du worker. — import réel
      (`importlib.import_module`) de tous les modules `saas/worker/*.py` +
      `saas/core/*.py` + `scripts/*.py` + `meta_script/*.py` +
      `google_script/*.py` : tous verts. `saas/worker/run_weekly.py` exécuté
      en mode démo (`__main__`, dry-run) : fonctionne.
- [x] Build Next.js réussi. — `rm -rf .next tsconfig.tsbuildinfo`,
      `npx tsc --noEmit` (0 erreur), `npm run build` (succès), **16 routes**.
- [x] Recherche globale sans import `streamlit` dans le code conservé. —
      `grep -rn "^import streamlit"` sur tout le dépôt : zéro résultat.

      Recherche élargie, VRAIMENT globale (tous types de fichiers, pas
      seulement `.py`) : `git grep -ril streamlit -- . ':!node_modules'
      ':!saas/web/node_modules'`. 30 fichiers restants, tous relus un par un.
      Aucun n'est un import, une instruction à exécuter, ou un chemin/comportement
      encore présenté comme actuel — chacun est soit un document de suivi
      historique, soit un commentaire de code au passé (« autrefois »,
      « ancien », « historique », « de l'époque Streamlit », « même base/
      convention que ») qui explique une origine ou une décision, sans prétendre
      que Streamlit tourne encore. Deux exceptions trouvées ET corrigées pendant
      cette relecture (comportement décrit au présent, donc faux) :
      `saas/web/app/page.tsx` et `saas/web/lib/report.ts` disaient encore que
      le rapport était « publié par le rapport Streamlit » — corrigés en
      « publié en headless par `saas/worker/build_report.py` ». Même correction
      dans `supabase/migrations/weekly_reports.sql` et sa copie dans
      `supabase/migrations/000_run_me_all.sql` (« Écrit par le Streamlit à
      l'ouverture du rapport » → « Écrit en headless par
      `saas/worker/build_report.py`, au fetch cron »).

      Liste complète des 30 fichiers restants (état après ces corrections —
      `app/page.tsx` et `weekly_reports.sql` sont SORTIS de cette liste : ils
      ont été corrigés ci-dessus et ne contiennent plus le mot) :
      - **Suivi/historique** (mentionnent Streamlit pour mémoire, pas d'action
        requise) : `DECISIONS.md`, `STATUS.md`, `BACKLOG.md`,
        `STREAMLIT_REMOVAL.md` (ce fichier), `PROJECT_STATUS.html`.
      - **Docs/config, actualisées dans cette tâche ou déjà correctes** :
        `CLAUDE.md`, `GOOGLE_ADS_SETUP.md`, `handoff/README.md`, `saas/README.md`,
        `.claude/agents/vision-produit.md`, `.claude/skills/hebdo/SKILL.md`
        (chemin `.streamlit/secrets.toml`, toujours réel), `.gitignore` (même
        chemin), `saas/requirements.txt` (« indépendant du Streamlit », vrai).
      - **Migrations SQL** : `supabase/migrations/000_run_me_all.sql` (corrigé
        ci-dessus, mention restante ailleurs dans le fichier), `labels_origine.sql`
        (corrigé au passé, voir plus bas), `partage_tables_manquantes.sql`
        (« l'ancien Streamlit », tables mortes).
      - **Code Next.js conservé** (`saas/web/`), tous des commentaires de lignage
        design/logique au passé, relus et confirmés exacts : `lib/report.ts`
        (corrigé ci-dessus), `app/actions.ts`,
        `app/google/page.tsx`, `app/meta/page.tsx`, `components/channel-dash.tsx`,
        `components/filter-bar.tsx`, `lib/account.ts`, `lib/channels.ts`,
        `tailwind.config.ts`.
      - **Code Python conservé** : `saas/emailing/render.py`
        (lignage du design du rapport), `saas/worker/fetch_all.py` (raison
        d'être du rapporteur d'étapes par défaut), `saas/worker/build_report.py`
        (docstring de tête, « l'ancien Streamlit (retiré) »),
        `scripts/app_secrets.py` (chemin `.streamlit/secrets.toml`),
        `scripts/insert_data.py` (format de données hérité de l'ancienne
        écriture Streamlit).
- [x] Relis toi-même le diff complet de suppression avant de conclure. —
      chaque fichier supprimé a été ouvert et son contenu confirmé
      (UI Streamlit pure, ou logique déjà dupliquée/supersédée côté Next.js)
      avant suppression, dossier par dossier (`components/`, `pages/`,
      `scripts/`, `meta_script/`).
