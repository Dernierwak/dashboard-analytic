# `/meta` demande 12 000 lignes et n'en reçoit que 1 000

Type: task
Status: resolved
Blocked by: —
Venu de : la carte `.scratch/meta-ads/` — rangé ici le 2026-10-01 : c'est une réparation, pas une décision.
Rangé dans `meta-ads/tickets/` le 2026-10-05 (depuis `.scratch/corrections/`, supprimé).

## Question

Trouvé en chemin par « Les 3-4 modules du dashboard, et leur ordre ».

`saas/web/lib/channels.ts:706-708` lit `meta_ads_insights` avec
`.order("date_start", { ascending: false }).limit(12000)`. PostgREST plafonne à
**1 000 lignes** (`supabase/config.toml:18`, `max_rows = 1000` ; `CLAUDE.md` §8)
et tronque **sans erreur**. Le tri décroissant garde les jours les plus récents :
avec 20 annonces actives, 1 000 lignes font **50 jours**. Toute période plus
longue (« 90 jours », « Tout ») s'arrête donc là sans le dire, et l'écart contre
la période d'avant compare à une période à moitié vide.

À vérifier d'abord : la valeur `max_rows` du projet **hébergé** (celle de
`config.toml` ne vaut que pour la base locale) — l'interface Supabase, *Settings
› API › Max rows*. David la lit, rien ne se devine.

**Le correctif** : paginer (`.range()` par tranches de 1 000 jusqu'à une page
courte), comme ailleurs dans le dépôt. Vérifier au passage les autres lectures
de `lib/channels.ts` qui posent un `.limit()` supérieur à 1 000.

**Vérification** : `npx tsc --noEmit`, `npm run build`, puis `/meta` en
« Tout » sur un compte de plus de 1 000 lignes : la première date affichée doit
reculer.

## Answer

`/meta` : réglé par la page neuve — `lireToutesLesPages`
(`lib/meta/lecture.ts`) pagine `meta_ads_insights` par 1 000 avec un ordre
total (`date_start`, `id`).

**Les autres lectures** que le ticket demandait de vérifier avaient le même
défaut, corrigé le 2026-10-05 dans `lib/channels.ts` avec le même
`lireToutesLesPages` et un ordre total par `id` :
- `/google` — `google_ads_insights` et `google_ads_ad_insights`
  (`.limit(12000)`) ;
- `/instagram` — `instagram_organic_posts` (`.limit(5000)`).

Une erreur de lecture rend toujours « aucune ligne », comme avant : le
correctif ne change que la troncature. `followers_history` garde son
`.limit(90)`, voulu et sous le plafond.

Vérifié : `npx tsc --noEmit` et `npm run build` verts, 18 routes. **Pas
vérifié** : la valeur `max_rows` du projet hébergé (Supabase, *Settings › API
› Max rows*) et la recette sur un compte de plus de 1 000 lignes — à voir en
cliquant après le déploiement, en « Tout » sur `/google` : la première date
doit reculer.
