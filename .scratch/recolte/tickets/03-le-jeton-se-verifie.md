# 03: Le jeton se vérifie avant la récolte

Type: task
Status: ready-for-human
Blocked by: 07

**What to build:** avant de récolter une plateforme, la récolte vérifie son
jeton. Mort → la plateforme est sautée, la connexion est marquée « à
reconnecter », et **plus rien n'est récolté** sur elle tant que le client ne
s'est pas reconnecté.

- `meta/auth/jeton.py` : `debug_token` dit si le jeton est valide et quand il
  expire. Expiration proche (seuil à fixer et justifier) → prévenir sans sauter.
- `google/auth/jeton.py` (ex `collecte/commun/fetch_token.py`) : le refresh
  token qui ne rend plus de jeton d'accès (`invalid_grant`) → à reconnecter.
  Une panne réseau n'est PAS un jeton mort : elle ne marque rien.
- En base : un état par connexion (`connected_accounts`), par exemple
  `a_reconnecter_depuis timestamptz` + la raison. Ajout de colonnes dans
  `000_run_me_all.sql`, **rejouable, rien de détruit** — David la joue.
- L'état ne se lit qu'avec les droits du propriétaire (§7 : un invité ne voit
  jamais de quoi aller chercher les chiffres). Vérifier la politique RLS de
  `connected_accounts` avant d'ajouter la colonne.
- La reconnexion remet l'état à zéro (`saas/web/app/api/oauth/*/callback`).

- [x] Harnais hors ligne : jeton valide, expiré, révoqué, réseau coupé → seul
      les deux du milieu marquent « à reconnecter »
- [x] Migration écrite et signalée
- [ ] Migration jouée par David (`ready-for-human`)
- [x] `python3.12 -m py_compile` ; `tsc` + `build` verts si le web est touché
- [ ] **Essai (ticket 08)** sur un vrai compte : un jeton valide ne change rien
- [ ] **À la fusion** : branchement dans la récolte (voir le commentaire)

## Comment

**2026-10-07 — construit en parallèle de la restructuration, sur la branche
`recolte/jeton-comptes` (worktree `.claude/worktrees/jeton-comptes`), non
commité. Périmètre ADAPTÉ : les modules de vérification, la migration et la
page Comptes (ticket 04) sont faits ; le BRANCHEMENT dans la récolte attend la
fusion avec `recolte/restructuration`, qui réécrit `fetch_all.py`.**

Fichiers (dans le worktree) :
- `saas/collecte/etat_jeton.py` — `EtatJeton(etat, raison, expire_le)`, trois
  états `valide` / `mort` / `inconnu`. Vit à la racine de `collecte/` faute de
  `socle/` sur cette branche : **à déplacer dans `collecte/socle/` à la fusion**.
- `saas/collecte/meta/auth/jeton.py` — `verifier(jeton)` par `/debug_token`
  (https://developers.facebook.com/docs/graph-api/reference/debug_token/ :
  jeton d'APP requis, réponse `is_valid`, `expires_at`,
  `data_access_expires_at`, `error`). `data_access_expires_at` échu = mort
  aussi. `expires_at = 0` : la doc ne dit pas ce qu'il veut dire → traité
  « échéance non communiquée », pas « n'expire jamais ». `expire_bientot()` avec
  `PREAVIS_JOURS = 14` (deux Jours de travail avant la panne, le compte n'étant
  récolté qu'une fois par semaine).
- `saas/collecte/google/auth/jeton.py` — `verifier(refresh) -> (état, jeton
  d'accès)` : `invalid_grant` et `admin_policy_enforced` = mort
  (https://developers.google.com/identity/protocols/oauth2, « Refresh token
  expiration ») ; réseau, 5xx, `invalid_client`, identifiants absents =
  inconnu, ne marque rien. Rend le jeton d'accès pour ne pas le redemander.
- `meta/auth/__init__.py`, `google/auth/__init__.py` vides — identiques à ceux
  que la restructuration crée, donc pas de conflit attendu.
- `supabase/migrations/000_run_me_all.sql` — section **4bis** :
  ```sql
  ALTER TABLE public.connected_accounts
      ADD COLUMN IF NOT EXISTS a_reconnecter_depuis timestamptz,
      ADD COLUMN IF NOT EXISTS a_reconnecter_raison text;
  ```
  + les deux colonnes dans le tableau de contrôle final, + la ligne d'en-tête.
  Ajout seul, rien de détruit, rejouable. RLS : `connected_accounts` n'a que des
  politiques « chacun ses lignes », aucune de partage (section 15.2 le vérifie à
  chaque passage) — les colonnes en héritent, un invité ne les lit pas.
- Harnais `.scratch/recolte/harnais/03_jeton.py` (dans le worktree).

Vérifié : `python3.12 -m py_compile` sur les trois modules ;
`python3.12 .scratch/recolte/harnais/03_jeton.py` → `meta ok / google ok /
TOUT VERT` (Meta : valide, bientôt, expiré, révoqué, accès aux données échu,
`expires_at=0`, réseau coupé — le jeton n'apparaît pas dans la raison —, jeton
d'app refusé, jeton absent, secret d'app absent ; Google : valide,
`invalid_grant`, `invalid_client`, 503, réseau coupé, jeton vide).

Pas vérifié : un vrai appel à `debug_token` ou à Google (aucun réseau réel).

**Reste à faire à la fusion** :
1. `etat_jeton.py` → `collecte/socle/`, et les deux `jeton.py` sur
   `socle/http.py` (429, `sans_jeton`) au lieu de `requests` direct.
2. Dans `plan.py` : vérifier le jeton AVANT chaque plateforme ; mort → écrire
   `a_reconnecter_depuis = coalesce(a_reconnecter_depuis, now())` et
   `a_reconnecter_raison`, sauter la plateforme (`suivi.saute`) ; inconnu → ne
   rien écrire, récolter quand même ; valide → récolter, et remettre les deux
   colonnes à NULL. Une plateforme déjà marquée ne se récolte pas.
   `google/auth/oauth.py` (ex `fetch_token.py`) garde le flux OAuth ; la
   vérification passe par `google/auth/jeton.py`.
3. **David : ajouter `META_APP_ID` et `META_APP_SECRET` aux secrets GitHub
   Actions** (mêmes valeurs que sur Vercel) et à l'`env:` de
   `weekly-fetch.yml`. Sans eux, Meta rend « inconnu » à chaque passage et rien
   n'est marqué.
4. Jouer la section 4bis de `000_run_me_all.sql`.

Observé en chemin, hors périmètre : aucune ligne de `saas/collecte/` n'écrit
`followers_history` (lu par `commun/fetch_data.py`, `web/lib/channels.ts`,
`web/lib/report.ts`) — à vérifier : la courbe d'abonnés est-elle encore
alimentée ?
