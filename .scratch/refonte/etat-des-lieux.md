# Pulse aujourd'hui — l'état des lieux

Ce document décrit. Il ne recommande rien : les tickets suivants décident.

Chaque chiffre porte la commande qui le reproduit. Toutes les commandes se
lancent depuis la racine du dépôt. Ce qui n'a pas pu être vérifié est dit.

Mesures prises le 2026-09-08, sur `main` à `cf84957`.

---

## 0 · Ce qu'il faut savoir avant de lire le reste

Trois faits cadrent tout le document.

**Il y a un seul cerveau, et c'est `build_payload`.** Une fonction de 3 060
lignes dans `saas/traitement/build_report.py` calcule *tout* le rapport hebdo.
Elle représente 64 % du fichier. Rien d'autre ne fabrique de rapport.

**Il y a un second gros fichier que la carte ne mentionnait pas** :
`saas/web/app/actions.ts`, 1 840 lignes, 39 actions serveur. C'est le plus gros
fichier du `saas/web/`, plus gros que `channels.ts` (1 637) et que
`report.ts` (973). Tout ce que le client *fait* passe par là.

**Le dépôt contient 32 copies de lui-même.** `.claude/worktrees/` pèse 8,6 Go et
garde des arborescences périmées (`saas/worker/`, `saas/core/`, `scripts/` —
des dossiers qui n'existent plus sur `main`). Un `grep -rn` sans pathspec, ou
n'importe quel outil qui descend récursivement, renvoie 32 réponses par
question, dont 31 fausses.

```bash
du -sh .claude/worktrees && ls .claude/worktrees | wc -l
git worktree list | wc -l
awk 'END{print NR}' saas/traitement/build_report.py
grep -n '^def build_payload' saas/traitement/build_report.py   # 1651
grep -n '^def _display_name' saas/traitement/build_report.py   # 4711
awk 'END{print NR}' saas/web/app/actions.ts
grep -c '^export async function' saas/web/app/actions.ts
```

---

## 1 · Les pages, une par une

`saas/web/app/` déclare **10 pages** et **4 routes API** (OAuth Meta et Google,
`start` + `callback` chacun).

```bash
find saas/web/app -name page.tsx | sort
find saas/web/app/api -name route.ts | sort
```

> `CLAUDE.md` §9 parle de « 16 routes » attendues au build. Le compte des
> fichiers en donne 14 ; les 2 restantes sont probablement ajoutées par Next
> lui-même (`/_not-found`, etc.). **Non vérifié** : je n'ai pas lancé
> `npm run build` pour trancher.

L'ordre dans la navigation (`saas/web/components/side-nav.tsx`, l. 75-98) n'est
pas l'ordre des fichiers ; c'est celui-ci que le client voit :

| Groupe | Page | Ce qu'elle montre | Quelle décision elle permet |
|---|---|---|---|
| — | `/` **Rapport** (706 l.) | Le rapport hebdo entier : verdict, boussole, résumé IA, cartes de thème, les 3 du moment, frise, preuve | **Oui — c'est la seule page décisionnelle du produit.** Elle dit quoi faire cette semaine. |
| Où va l'argent | `/labels` **Thèmes** (191 l.) | Le vocabulaire des thèmes : créer, renommer, étoiler, plus un parcours « ce qui n'est pas étiqueté » | **Oui, mais en amont** : elle ne décide rien sur la pub, elle rend possible tout le reste. Une campagne non étiquetée sort de presque toute l'analyse. |
| Où va l'argent | `/conversions` (211 l.) | Quels événements GA4 comptent pour quels thèmes, et de quel genre de conversion il s'agit | **Oui, en amont** — c'est un réglage, pas une lecture. Existe parce que ce réglage polluait `/labels`. |
| Où va l'argent | `/couts` (416 l.) | L'enveloppe publicitaire de l'année, dont le mois se déduit (÷ 12) | **Oui** : tient-on le budget, faut-il ralentir. Un seul horizon piloté, l'année. |
| Tes canaux | `/meta` (81 l.) | Périodes 7→Tout, filtres statut/campagne/thème, hero impressions, KPIs, évolution quotidienne, campagnes → adsets → annonces | **Faiblement.** Page d'exploration : elle répond à « montre-moi », pas à « que faire ». |
| Tes canaux | `/google` (73 l.) | Idem Meta, avec groupes d'annonces au lieu d'adsets | **Faiblement**, même raison. |
| Tes canaux | `/instagram` (635 l.) | Abonnés, courbe, moyennes, posts un par un, formats, quand publier, top 3, comparaison au post moyen, par thème | **Faiblement**, même raison — mais c'est la page canal la plus riche, et la seule écrite sur mesure. |
| Réglages | `/comptes` **Connexions** (429 l.) | Brancher Meta et Google, puis choisir le compte publicitaire et la propriété Analytics | **Oui, une fois.** Page d'installation : elle sépare « j'ai dit oui à Google » de « la source est branchée ». |
| Réglages | `/equipe` (61 l.) | Inviter quelqu'un en lecture ou en édition sur son compte | **Oui, rarement.** Les jetons OAuth ne sont jamais partagés. |
| (hors nav) | `/login` (188 l.) | Connexion | — |

**Honnêtement** : sur 10 pages, **une seule** répond à la promesse écrite dans
`CLAUDE.md` (« où mettre ses dix minutes cette semaine »). Trois pages sont des
réglages qu'on visite une fois (`/comptes`, `/equipe`, `/conversions`), deux
sont en amont de l'analyse (`/labels`, `/couts`), et **trois sont des
explorateurs de données qui ne concluent rien** (`/meta`, `/google`,
`/instagram`). Ce n'est pas un jugement de valeur : c'est le compte.

> **Correction du 2026-09-08, apportée par David pendant le ticket 03.**
> « Ne concluent rien » était mon cadrage, pas le sien. Il leur donne un rôle
> précis dans le parcours : *« il peut aussi analyser rapidement seul la
> plateforme sur laquelle il travaille »* — la porte pour creuser, en fin de
> parcours, après le point général et les thèmes. Ces trois pages ne sont donc
> pas décoratives : elles sont la **sortie** du fil hebdomadaire. Ce qui manque
> n'est pas leur contenu, c'est le fil qui y mène et qui en ramène quelque
> chose. Voir le ticket 06.

---

## 2 · Le chemin d'une donnée, de bout en bout

Prenons une dépense Meta du lundi. Voici tout ce qu'elle traverse.

### Étape 1 — Le déclencheur

Il n'y en a qu'**un seul**, et il est dans GitHub Actions :
`.github/workflows/weekly-fetch.yml`, `cron: "0 7 * * *"` — tous les jours à
07:00 UTC. Le worker ne traite que les utilisateurs dont c'est le jour
(`profiles.fetch_schedule`, défaut lundi).

Le même workflow porte **cinq modes**, choisis par ses `inputs` :

| Entrée | Bouton correspondant dans l'app |
|---|---|
| (aucune) | le cron quotidien |
| `user_id` | « ↻ Mes données » |
| `label_only` | « Classer mes contenus » |
| `categorize_only` | « Classer mes conversions » (`/conversions`) |
| `report_only` | « ↻ Recharger mes conseils » |

**Le web ne calcule jamais rien lui-même.** Les boutons de `saas/web/` font un
`POST` sur `https://api.github.com/repos/…/actions/workflows/…/dispatches`
(`saas/web/app/actions.ts`, l. 1496-1530 — commentaire : « Le seul chemin vers
GitHub »). C'est pour ça qu'une correction du traitement ne se voit qu'après un
« ↻ Recharger mes conseils », et une correction de récolte après « ↻ Mes
données » : le rendu lit une table, il ne recalcule pas.

```bash
sed -n '1,30p' .github/workflows/weekly-fetch.yml
sed -n '1496,1530p' saas/web/app/actions.ts
```

### Étape 2 — La récolte

`saas/collecte/automatisation/fetch_all.py` (835 l.) appelle les canaux :

| Canal | Fetcher | Écrit dans |
|---|---|---|
| Meta Ads | `collecte/meta/fetch_meta_ads.py` (332 l.) | `meta_ads_insights`, `meta_campaign_config` |
| Instagram | `collecte/meta/fetch_instagram.py` (332 l.) | `instagram_organic_posts`, `followers_history` |
| Google Ads | `collecte/google/fetch_google_ads.py` (1 079 l.) | `google_ads_insights`, `google_ads_ad_insights`, `google_campaign_config` |
| GA4 | `collecte/ga4/fetch_ga4.py` (462 l.) | `ga4_insights`, `ga4_events` |

Toutes les écritures passent par `saas/commun/insert_data.py` (759 l., 39
fonctions `upsert_*`/`update_*`). Deux mécanismes s'y ajoutent à chaque
passage : `_photo_budget` (photo du budget du jour) et `_journal_changements`
(journal des changements plateforme → `platform_changes`).

### Étape 3 — L'IA de classement (optionnelle)

`saas/recos_ia/labeling.py` (290 l.) pose des thèmes sur les campagnes et les
posts ; `categorizing.py` (143 l.) range les événements GA4 en catégories.
**`labeling.py` est le seul module de `recos_ia/` qui tient un client Gemini**
(`call_gemini_json`) — `categorizing.py` le lui emprunte.

### Étape 4 — La fabrication du rapport

`fetch_all.py` importe `publish_weekly_report` à trois endroits (l. 584, 600,
787) selon le mode. Cette fonction appelle `build_payload`, puis écrit **une
seule ligne** : `weekly_reports(user_id, week_start, payload)` — un gros JSON.

```bash
grep -n "publish_weekly_report" saas/collecte/automatisation/fetch_all.py
grep -n 'table("weekly_reports")' saas/commun/insert_data.py
```

### Étape 5 — L'affichage

`saas/web/lib/report.ts::getWeeklyData()` (l. 561) lit `weekly_reports`, et
`saas/web/app/page.tsx` rend le JSON. Le fichier `report.ts` (973 l.) est
**presque entièrement du typage** : il déclare la forme du payload
(`ReportPayload`, `ThemeFocus`, `Frise`, `KpiFocus`, `TopReco`,
`TrackedAction`, `VisionBlock`, `ProofOutcome`, `MatriceCoverage`…) plus une
poignée de calculs (`revenuTheme`, `noteSerie`, `estDecisionClient`,
`feedbackKey`, `fmtCHF`).

Les **pages canal ne passent pas par là** : `/meta`, `/google` et `/instagram`
lisent Supabase directement via `saas/web/lib/channels.ts`.

### En une ligne

```
cron 07:00 UTC  →  fetch_all.py  →  fetchers par canal  →  insert_data.py
   →  Supabase (tables brutes)  →  labeling.py (IA, optionnel)
   →  build_payload()  →  weekly_reports.payload (1 ligne JSON)
   →  report.ts::getWeeklyData()  →  app/page.tsx
```

Et en parallèle, sans jamais toucher au rapport :

```
Supabase (tables brutes)  →  lib/channels.ts  →  /meta, /google, /instagram
```

### Qui écrit, qui lit

Il y a **deux clients Supabase distincts**, et ils ne voient pas les mêmes
tables :

| Table | Écrite par | Lue par Python | Lue par le web |
|---|---|---|---|
| `meta_ads_insights`, `google_ads_insights`, `google_ads_ad_insights`, `instagram_organic_posts`, `followers_history`, `ga4_insights` | collecte | oui | oui |
| `meta_campaign_config`, `google_campaign_config` | collecte + web | oui | oui |
| `ga4_events` | collecte | oui | **non** |
| `theme_plan` | `build_report` | oui | **non** |
| `theme_ga4_events`, `theme_objectifs`, `conversion_categories`, `ga4_event_categories` | web | partiellement | oui |
| `weekly_reports` | `build_report` | non | oui |
| `reco_feedback`, `insight_feedback`, `suivi_actions` | web | oui | oui |
| `platform_budgets`, `platform_changes`, `channel_budgets`, `fetch_progress`, `dashboard_members`, `profiles`, `connected_accounts` | mixte | partiellement | oui |

```bash
grep -ohE '\.table\("[a-z_0-9]+"' saas/commun/insert_data.py | sort -u
grep -ohE '\.table\("[a-z_0-9]+"' saas/commun/fetch_data.py | sort -u
grep -rohE 'from\("[a-z_0-9]+"\)' saas/web/app saas/web/lib --include='*.ts*' | sort -u
```

`ga4_events` et `theme_plan` sont **invisibles depuis le web** : elles n'existent
que dans le raisonnement du worker.

---

## 3 · Les dépendances entre modules

### La forme générale

```
                    ┌─────────────────┐
                    │  Supabase       │  (~30 tables)
                    └────────┬────────┘
             ┌───────────────┼───────────────┐
             │               │               │
      commun/fetch_data  commun/insert_data  web/lib/*  (client JS séparé)
             │               │                  │
    ┌────────┴───────┐   collecte/         ┌────┴──────────────┐
    │                │                     │                   │
recos_ia/       traitement/            channels.ts        report.ts
  reco_engine ──► build_report.py ──► weekly_reports ──► app/page.tsx
  insights                                                     ▲
  labeling ◄── (Gemini)                                        │
  user_persona ◄─ call_ai injecté ──────────────────────────── ┘
  theme_memoire ◄─ call_ai injecté
```

Trois faits mesurés là-dessus :

**a. `recos_ia/` ne dépend pas de Gemini — c'est `build_report` qui l'injecte.**
`user_persona.py` et `theme_memoire.py` n'importent aucun client Gemini : ils
reçoivent un `call_ai(prompt) -> str|None` en paramètre. Leur docstring le dit
en toutes lettres (« Aucun import de Gemini ici — c'est ce qui permet de le
faire tourner hors ligne »). `reco_engine.py` (757 l.) et `insights.py`
(459 l.) ne contiennent **pas une seule occurrence** de « gemini ».

```bash
grep -c "gemini\|Gemini" saas/recos_ia/reco_engine.py saas/recos_ia/insights.py
grep -n "call_ai" saas/recos_ia/user_persona.py saas/recos_ia/theme_memoire.py
```

**b. Il y a exactement 3 appels réels à l'IA dans le rapport**, pas 6.
`_call_gemini` apparaît 6 fois dans le fichier : 1 définition (l. 53), 3 appels
(l. 1470, 1612, 3178) et 2 mentions en commentaire. Les trois appels sont : les
pistes IA d'un thème (`_theme_ai_recos`), les astuces de thèmes
(`_themes_tips`), et le résumé de la semaine (`brief`). Le profil client vivant
en consomme un quatrième par injection (`build_user_persona(sb, user_id,
_call_gemini, …)`, l. 2040).

> **Correction à la carte** : `map.md` annonce « 6 appels `_call_gemini` ».
> C'est le compte des occurrences de la chaîne, pas des appels.

```bash
grep -n '_call_gemini(' saas/traitement/build_report.py
```

**c. Le couplage aux thèmes, mesuré.** La carte annonçait 425 mentions ; le
chiffre reproduit (`grep -c 'theme'` + `grep -c 'label'` = 291 + 133 = 424),
mais il sous-compte : la mesure honnête est **670 lignes concernées sur 4 775
(14 %), pour 809 occurrences.**

```bash
grep -icE 'label|theme|thème' saas/traitement/build_report.py   # 670
grep -oiE 'label|theme|thème' saas/traitement/build_report.py | wc -l   # 809
```

Réparties par section de `build_payload` :

| Lignes | Section | Mentions |
|---|---|---|
| 2584-3070 | ce qui passe par un thème, semaine par semaine | **138** |
| 2066-2283 | recos par thème + poids d'un thème | **64** |
| 2284-2583 | frise phase 2 (série de la métrique du thème) | 47 |
| 3724-3935 | suivi des actions (`tracking`) | 37 |
| 1934-1998 | configs campagnes + événements + objectifs par thème | 35 |
| 3424-3523 | suivi « ▶ Je le teste » | 35 |
| 3282-3423 | boucle de la preuve | 31 |
| 3524-3695 | jugement d'un thème + hypothèse de la semaine | 30 |
| 4005-4370 | boussole (`kpi_focus`) + intro thèmes | 25 |
| 4371-4711 | frise + changements | 23 |
| 1695-1933 | chargement + KPI canaux | 22 |
| 3220-3281 | thèmes (dépense × revenu GA4) | 21 |
| 1999-2065 | vision + matrice + persona | 15 |
| 3071-3219 | verdict + sélection + brief IA | **8** |
| 3696-3723 | les 3 du moment (`top_recos`) | 8 |
| 3936-4004 | vision + matrice pour le payload | 7 |

### La question précise : et si les thèmes disparaissaient ?

Le payload publié compte **29 clés** (`build_report.py`, l. 4659-4708). Voici
lesquelles survivraient et lesquelles casseraient. C'est une lecture du code,
pas une simulation : je n'ai pas exécuté de variante sans thèmes.

**Ce qui reste affichable — le chemin sans thème existe déjà et il est
déterministe.** `rule_recos = build_recos(...)` (l. 2048) est appelé **sur le
compte entier**, sans argument `theme` — son commentaire le dit : « Pas de
`theme` ici : les "réglages" (GA4, funnel) sont compte entier, pas par thème ».
Il alimente `recos`, `todo` et `reglages` via `by_section` (l. 3114). Aucun de
ces trois blocs ne passe par un thème.

Survivent donc, sans modification :

- `verdict`, `verdict_pct`, `verdict_metric`, `verdict_tone` — calculé sur les
  abonnés et les KPIs du compte (l. 3103-3105) ;
- `kpi_focus` — la boussole, calculée sur les dataframes bruts Meta/Google
  (`_pub_semaine`, l. 4016) ;
- `kpis`, `metrics_read`, `metrics_prev`, `metrics_series`, `week_label`,
  `since`, `until`, `version` ;
- `changements` — construit sur les dates de campagne, pas sur les thèmes ;
- `recos`, `todo`, `reglages` — le moteur déterministe compte entier ;
- `brief` — l'appel Gemini de la l. 3178, nourri par les KPIs ;
- `frise` (la frise du payload, l. 4648) — liste les campagnes et posts qui
  tournaient, sans regroupement par thème ;
- `preuve` et `suivi` — re-mesure d'un KPI de compte à échéance ;
- `tracking` — l'objet suivi porte un contexte de thème mais mesure un KPI.

**Ce qui casse net**, parce que ces blocs *sont* les thèmes :

- `themes_focus` — le cœur du rapport v2, les cartes de thème ;
- `themes_intro`, `themes_tips` — l'habillage et les astuces IA de ces cartes ;
- `themes` — dépense par thème × revenu GA4 ;
- `top_recos` — « les 3 du moment » est construit **exclusivement** par
  itération sur `themes_focus` (l. 3707-3711). Sans thèmes, la liste est vide ;
- `vision` et `matrice` — perdent leur axe `priorities`/`themes` (les axes
  formats, campagnes et créneaux, eux, restent).

**Le fait à retenir** : un rapport hebdo sans thèmes tiendrait techniquement
debout — verdict, boussole, courbes, conseils déterministes par canal — mais il
perdrait **la totalité de ce qui a été construit depuis le rapport v2**, y
compris la seule liste qui dit « si tu ne fais que trois choses ». Le chemin
compte-entier existe, il n'a jamais été supprimé, et il est déterministe. Ce
que ça implique n'est pas décidé ici.

---

## 4 · Les monolithes

### `saas/traitement/build_report.py` — 4 775 lignes

**29 fonctions au niveau module**, dont une qui pèse 64 % du fichier.

| Lignes | Fonction | Rôle |
|---|---|---|
| 53 | `_call_gemini` | le seul client Gemini du rapport |
| 227-473 | `_forcer_une_hypothese`, `_effort_de`, `_est_veille`, `_veille_urgente`, `_levier`, `_diversifier`, `_importance` | le tri et la sélection des conseils |
| 473-727 | `_orga_prep`, `_orga_rythme`, `_art`, `_orga_format`, `_orga_reaction`, `_orga_recos` | les conseils organiques |
| 727-1338 | `_labels_prioritaires`, `_reco_veille`, `_reco_theme_arret`, `_reco_theme_calme`, `_reco_dict`, `_reco_evenements`, `_strip_reco`, `_compares_channels`, `_theme_conversions_txt` | les règles de conseil par thème |
| 1339-1650 | `_theme_ai_recos`, `_themes_tips` | les deux appels IA de thème |
| **1651-4710** | **`build_payload`** | **tout le reste** |
| 4711-4771 | `_display_name`, `publish_weekly_report`, `_service_client` | la publication |

`build_payload` se lit par ses **30 sections commentées**, dans l'ordre
d'exécution :

```
1695 Chargement (mêmes fetchers que le rapport)
1719 Fenêtre : 7 jours pleins ancrés sur la dernière donnée
1741 Meta Ads : agrégats + par campagne
1782 Google Ads : mêmes fenêtres + FUSION dans df_camp
1830 Instagram
1874 Profil + GA4 + recos (même moteur que le rapport)
1934 Configs campagnes (thèmes)
1941 Les événements GA4 rattachés aux thèmes
1955 L'objectif propre d'un thème
1999 Vision globale : matrice full-history + constats
2031 Profil client vivant (calibre le ton de l'IA)
2066 Recos PAR THÈME (cross-canal)
2086 Le poids d'un thème
2123 Les dates déclarées par les plateformes
2151 Les rapports déjà publiés
2178 Les campagnes lancées depuis peu (≤ 14 j)
2246 Une campagne neuve n'ajoute plus son thème
2284 Frise (Phase 2) : série hebdo de la métrique du thème
2584 Ce qui passe par un thème, semaine par semaine   ← 487 lignes
3071 Verdict déterministe
3113 Sélection (2 insta + 3 pub, digest 3)
3125 Brief IA + fallback déterministe
3220 Thèmes : dépense × revenu GA4
3282 Boucle de la preuve
3424 Suivi des actions « ▶ Je le teste »
3524 Le jugement de chaque thème
3542 L'hypothèse de la semaine entre en suivi
3696 Les 3 du moment
3936 Vision + matrice compactes
4005 Ta boussole : LE chiffre qui compte
4371 Frise : ce qui TOURNAIT pendant ces semaines
```

Deux sections font à elles seules 787 lignes : « ce qui passe par un thème »
(487) et « la boussole » (366).

```bash
grep -n '^def \|^class ' saas/traitement/build_report.py
awk 'NR>=1651 && NR<=4711 && /^    # ──/ {print NR": "$0}' saas/traitement/build_report.py
```

### `saas/web/app/actions.ts` — 1 840 lignes, 39 actions serveur

Absent de la carte, c'est pourtant le plus gros fichier du web. Ses 39 actions
se rangent en 7 familles :

| Famille | Actions | Lignes |
|---|---|---|
| Suivi d'une action | `startTracking`, `resolveAction`, `saveNote`, `deleteNote` | 31-279 |
| Retours du client | `saveRecoFeedback`, `saveInsightFeedback`, `saveComment` | 280-506 |
| Réglages du compte | `togglePriorityLabel`, `saveObjectif`, `saveBudget`, `saveOnboarding` | 402-634 |
| Vocabulaire des thèmes | `createLabel`, `renameLabel`, `deleteLabel`, `setCampaignLabel`, `setPostLabel`, `setThemeEvent`, `saveThemeObjectif`, `setCampaignLanding`, `saveSiteClient` | 635-1342 |
| Conversions | `createConversionCategory`, `renameConversionCategory`, `deleteConversionCategory`, `saveCategoryForEvent` | 909-1001 |
| Étiquetage IA | `compterEtiquettesIA`, `annulerEtiquettesIA`, `compterCategoriesIA`, `annulerCategoriesIA` | 1343-1433 |
| Pont GitHub Actions | `lancerWorkflow`, `triggerFetch`, `triggerClassify`, `triggerCategorize`, `triggerReport`, `checkFetchStatus`, `checkFetchProgress` | 1449-1748 |
| Équipe | `listerMembres`, `inviterMembre`, `changerRoleMembre`, `revoquerMembre`, `choisirCompte` | 1749-1848 |

### `saas/web/lib/channels.ts` — 1 637 lignes

Le second plus gros. Il porte **toute** la lecture des pages canal, plus des
lectures qui n'ont rien à voir avec un canal : `getLabelsData`,
`getThemeEvenements`, `getThemeObjectifs`, `getConversionCategories`. C'est le
fichier fourre-tout de la lecture Supabase côté web.

### `saas/web/components/channel-dash.tsx` — 1 475 lignes

Le composant partagé des dashboards. Il exporte les modules montés par `/meta`
et `/google`, **et** trois modules montés par `/instagram` (`ByLabelInsta`,
`CourbeAbonnes`, `MoyennesInsta`).

### `saas/web/lib/report.ts` — 973 lignes

Presque tout du typage du payload (25 types exportés) plus 6 fonctions.

### Les 58 composants

```bash
ls saas/web/components/*.tsx | wc -l          # 58
find saas/web/app saas/web/lib saas/web/components -name '*.ts*' | xargs wc -l | sort -rn | head -20
```

Les 10 plus gros : `channel-dash` (1 475), `line-chart` (782),
`frise-semaine` (757), `couts-modules` (743), `theme-card` (652),
`fetch-button` (590), `side-nav` (533), `kpi-focus` (520),
`proto-parcours-themes` (491), `comparaison` (479).

---

## 5 · Ce qui est mort ou orphelin

**Rien n'a été supprimé. Ceci est une liste.**

### a. Un composant jamais monté : `components/comparaison.tsx` (479 l.)

Il exporte `Comparer` (l. 177). Aucun fichier de `saas/web/` n'importe ce
symbole. Le mot « Comparer » n'apparaît ailleurs que dans des commentaires de
`ecart.tsx`, `channel-dash.tsx` et `channels.ts` qui décrivent « le module
Comparer » comme s'il existait encore.

```bash
grep -rn "Comparer" saas/web --include='*.tsx' --include='*.ts' | grep -v '^saas/web/components/comparaison.tsx'
```

C'est le seul composant orphelin des 58.

### b. Deux prototypes non commités, mais **branchés dans un fichier suivi**

`components/proto-parcours-themes.tsx` (491 l.) et
`components/prototype-switcher.tsx` sont **non suivis par git** (`??` dans
`git status`). Ils sont pourtant importés par `saas/web/app/labels/page.tsx`
(l. 59-60), qui est **suivi et modifié** (`M`).

Ils sont derrière une garde : `variante` est lu dans les paramètres d'URL et
validé contre `VARIANTES` (l. 75) ; sans ce paramètre, `parcours` vaut `null`
et rien ne s'affiche (l. 98, 184). Le commentaire l. 183 dit « invisible en
production ».

**Le fait à signaler** : `npx tsc --noEmit` passe aujourd'hui (`EXIT=0`, vérifié)
**parce que les fichiers sont là**. Committer `app/labels/page.tsx` sans eux
casserait le build. Ce n'est pas exactement le cas visé par `CLAUDE.md` §7 (une
page `app/login/controle-*/`), mais c'est le même piège : de l'échafaudage
temporaire greffé sur du code permanent.

### c. Le chemin email n'est branché sur rien

`saas/emailing/` (`render.py` 195 l., `send.py`) n'est appelé que par
`saas/collecte/automatisation/run_weekly.py` (135 l.), lui-même appelé par
personne. `saas/collecte/CLAUDE.md` l. 73 le confirme : « `run_weekly.py` est un
chemin séparé et **pas encore câblé au cron** : démo de prévisualisation ».
`fetch_all.py` ne contient aucune référence à `emailing`.

**Aucun email hebdomadaire n'est envoyé aujourd'hui.**

```bash
grep -n "emailing\|send_email" saas/collecte/automatisation/fetch_all.py   # vide
```

### d. Les résidus du Graphe A et de `reco_news` sont propres

Deux commentaires historiques dans `build_report.py` (l. 3209-3210) et le
`DROP TABLE IF EXISTS public.reco_news` daté dans `000_run_me_all.sql`
(l. 1428-1445). `adhesion.py`, ajouté au commit `7f188f3`, n'existe plus.
**Rien à nettoyer ici.**

### e. 32 worktrees, 8,6 Go

C'est le plus gros bruit du dépôt, et de loin. `git worktree list` en renvoie
32 ; l'un est marqué `prunable`. Plusieurs portent l'**ancienne arborescence** —
`.claude/worktrees/task-032-couts-pie-chart/saas/worker/build_report.py`,
`saas/core/reco_engine.py`, `scripts/fetch_data.py` — des chemins qui n'existent
plus sur `main`.

Conséquence directe et mesurable : une recherche de `build_report` sans
pathspec renvoie ~20 résultats, **tous** venant de worktrees périmés, avant
d'atteindre le vrai code. C'est une cause matérielle de « je n'arrive plus à
voir où sont les problèmes ».

---

## 6 · Ce qui existe en triple — et ce qui n'existe qu'en double

La carte parlait de « trois dashboards jumeaux ». **La mesure dit deux jumeaux
et un cousin.**

### `/meta` et `/google` sont bien jumeaux, et déjà factorisés

81 et 73 lignes. Ils importent tous les deux `FilterBar`, `DateRange` et le même
groupe de modules de `channel-dash.tsx`, et ne diffèrent que par leur fonction
de chargement (`getMetaDash` / `getGoogleDash`), toutes deux retournant le
**même type** `ChannelDash`.

```bash
diff saas/web/app/meta/page.tsx saas/web/app/google/page.tsx | grep -c '^[<>]'   # 48
grep -n 'getMetaDash\|getGoogleDash\|^export type ChannelDash' saas/web/lib/channels.ts
```

48 lignes diffèrent sur 154. `getMetaDash` fait 43 lignes, `getGoogleDash` 58.
Le partage est réel : type commun, composants communs, barre de filtres commune.

### `/instagram` n'est pas un jumeau

635 lignes de page (8× celle de Meta), son propre type `InstaDash`, son propre
chargeur `getInstaDash` (284 l., l. 971-1254), et ses propres modules
(`PostLabelSelect`, `BarChart`, `ScrollList`). Il n'emprunte à `channel-dash`
que trois modules : `ByLabelInsta`, `CourbeAbonnes`, `MoyennesInsta`.

C'est cohérent avec sa nature — l'organique n'a ni dépense, ni adset, ni
enchère — mais il faut le dire : **l'unification Meta/Google est faite ;
l'unification avec Instagram n'a jamais été tentée.**

### Ce qui est réellement partagé

| Brique | Meta | Google | Instagram |
|---|---|---|---|
| Type de chargement | `ChannelDash` | `ChannelDash` | `InstaDash` |
| Page | 81 l. | 73 l. | 635 l. |
| `FilterBar` / `DateRange` | oui / oui | oui / oui | non / oui |
| Modules `channel-dash` | tous | tous | 3 sur N |
| Fenêtres et comparaisons (`periodDays`, `customWindow`, `pct`, `modeCompare`, `batirComparaison`) | oui | oui | oui |

Le socle **fenêtre + comparaison** de `channels.ts` (l. 24-428), lui, est
partagé par les trois.

---

## 7 · L'état de la carte du savoir

`CLAUDE.md` §6 liste 7 fichiers. **Un seul répond encore** (`BACKLOG.md`), plus
le dossier `saas/web/legal/`. Les 6 autres ont été supprimés au commit
`7f188f3` — un commit intitulé « feat(recos): file reco_news + hypothèse de
thème persistante (theme_plan), **nettoyage docs obsolètes** ».

**Tout est récupérable** : `git show 7f188f3^:<chemin>`.

| Fichier | Taille | Ce qu'il portait (sommaire récupéré) |
|---|---|---|
| `docs/03-grammaire-des-modules.md` | **1 075 l.** | Les neuf rangs · Les interdits en toutes lettres · Les règles de fond qui priment sur l'esthétique · Le graphe : géométrie en SVG, caractères en HTML · Le lexique des signes · Où on en est · Une fusion à ne PAS faire · Ce qu'on gamifie et ce qu'on ne gamifie jamais · Journal |
| `docs/04-modules-partages-entre-sources.md` | 323 l. | Ce qui est déjà générique · Ce qui est dupliqué (frictions) · Ce qui est spécifique par nature · Gabarit pour brancher une nouvelle source |
| `STREAMLIT_REMOVAL.md` | 205 l. | Zone protégée · À extraire avant suppression · Suppressions après validation · Doc à actualiser · Validation finale |
| `docs/references/plateformes.md` | 152 l. | Meta Marketing API · Google Ads API · GA4 · **Ce qui est impossible — ne pas essayer de le reconstruire** |
| `DECISIONS.md` | 59 l. | 5 décisions du 19 août 2026 (Pulse remplace Streamlit ; le savoir des agents est protégé ; une seule branche de référence ; le suivi est versionné ; mode de travail économe pour les LLM) |
| `STATUS.md` | 49 l. | Produit actif · Travail en cours · Prochaine étape · Règle de fin de session |
| `docs/references/README.md` | 32 l. | Comment se servir des références |

Deux autres fichiers sont partis au même commit sans être listés par `CLAUDE.md`
§6 : `GOOGLE_ADS_SETUP.md` (87 l., la procédure complète d'obtention du
developer token, 24-48 h d'attente) et `BACKLOG.md` — celui-ci a été
**recréé depuis** (2 425 octets aujourd'hui, contre 139 lignes supprimées).

### Ce que la perte casse concrètement

`saas/web/CLAUDE.md` continue d'invoquer « la grammaire des modules » et son
« rang 3 est le chiffre ». `CLAUDE.md` racine §6 l'invoque aussi, en imposant
que « tout module créé ou restructuré met à jour sa section *Où on en est* dans
le même commit ». **Cette section n'existe plus.** Un agent qui suit
l'instruction cherche un fichier absent, puis improvise — ce qui est
exactement le mécanisme par lequel des modules cessent de se ressembler.

Même chose pour `docs/references/plateformes.md`, dont une section s'appelait
« Ce qui est impossible — ne pas essayer de le reconstruire ». `CLAUDE.md` §8
en garde une trace (« Google Ads `change_event` : 30 jours maximum ») ; le reste
n'est plus lisible que par `git show`.

---

## 8 · Ce que j'ai vérifié, et ce que je n'ai pas vérifié

**Vérifié, commande à l'appui** : les comptes de lignes, de fichiers, de
fonctions, de tables et d'occurrences ; les imports et les orphelins ; le
chemin de déclenchement du workflow ; les sommaires des documents effacés ; le
fait que `npx tsc --noEmit` sort en code 0 sur l'arbre de travail actuel.

**Non vérifié, dit franchement** :

- **Le compte de 16 routes** de `CLAUDE.md` §9 : je n'ai pas lancé
  `npm run build`. Les fichiers en déclarent 14.
- **Le comportement d'un rapport sans thèmes** (§3) est une lecture du code, pas
  une exécution. Je n'ai fait tourner aucune variante.
- **Aucune donnée réelle n'a été lue.** Je n'ai interrogé aucune base Supabase :
  tout ce document décrit du code, jamais des chiffres de client.
- **Le contenu des documents effacés** n'est connu que par leurs titres de
  section. Je n'ai pas relu leurs 1 800 lignes ; si l'un devient décisif, il
  faudra le sortir de git et le lire.
- **La qualité** de quoi que ce soit. Ce document dit ce qu'il y a et comment
  c'est branché. Il ne dit pas si c'est bien.
