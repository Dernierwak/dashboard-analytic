# 15: Le journal Meta rejoint `main`

Type: task
Status: resolved
Blocked by: None (can start immediately)
Spec : [14](14-spec-le-journal-meta.md), histoire 43.

## What to build

Le journal Meta construit sur `journal-meta/carte` (tickets 12 et 13) arrive
en production : Vercel sert le nouvel écran de `/meta`, et le cron du Jour de
travail (07:00 UTC, sur `main`) récolte avec le nouveau code.

L'ordre compte. Le `000` doit être joué sur Supabase **avant** tout passage
du worker qui écrit les nouvelles colonnes : sans lui, le premier changement
`objectif` ou `calendrier` fait refuser tout le lot Meta (vu le 2026-10-14).
C'est David qui joue le `000` et qui fusionne. L'agent prépare, vérifie et
ouvre la PR en brouillon, sans fusionner lui-même.

## Acceptance criteria

- [x] David confirme que le `000` a été joué sur Supabase. Vérifié en base :
      `platform_changes` porte `niveau`, `object_id`, `object_name`,
      `adset_id` et `extra_data`, et la CHECK de `categorie` accepte
      `objectif` et `calendrier`.
- [x] La branche est à jour avec `main` et fusionne sans conflit.
- [x] `saas/web` : sur un `.next` vidé, `npx tsc --noEmit` et
      `npm run build` sont verts, avec 18 routes.
- [x] `python3.12 -m py_compile` passe sur le Python touché par la branche.
- [x] `git grep` ne trouve aucune page de contrôle (`controle-`) ni
      échafaudage oublié.
- [x] Une PR en brouillon `journal-meta/carte` → `main` est ouverte. Sa
      description renvoie à la spec et rappelle que rien ne se voit en base
      avant un passage du worker (ticket 16).
- [x] David a fusionné, et le déploiement Vercel de `main` est vert.

## Avancement — 2026-10-14

- **Colonnes en base : vues.** Avec la clé anonyme, PostgREST répond 200 à
  `select=niveau,object_id,object_name,adset_id,extra_data` sur
  `platform_changes` (et 400 à une colonne inexistante, témoin). La CHECK de
  `categorie` ne se lit pas avec cette clé : David a rejoué le `000` en
  entier le 2026-10-14, ce qui la pose (`DROP CONSTRAINT IF EXISTS` puis
  `ADD`).
- **Branche à jour** : `main` est un ancêtre de `journal-meta/carte` (22
  commits d'avance, dont la réorganisation du pipeline `1b05a92`) — la
  fusion est une avance rapide, sans conflit.
- **`saas/web`** : `.next` vidé, `tsc --noEmit` vert, `npm run build` vert,
  18 routes.
- **Python** : `python3.12 -m py_compile` vert sur tout `saas/config` et
  `saas/data`.
- **`git grep controle-`** : seule la règle de `CLAUDE.md`, aucune page
  oubliée.
- **PR #6** fusionnée par David le 2026-10-14 (`9cf14a3`) ; le statut
  Vercel de ce commit est « Deployment has completed ».

## Réponse

Le journal Meta est sur `main` et déployé par Vercel. Rien n'est encore
visible en base : les lignes ne portent leur détail qu'après un passage du
worker (ticket 16).
