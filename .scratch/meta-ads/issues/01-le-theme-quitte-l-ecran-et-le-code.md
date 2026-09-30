# Le thème et le label quittent l'écran et le code

Type: task
Status: resolved
Blocked by: —

## Question

Rien à décider : retirer le thème et le label de tout `saas/web/`, de tout le
Python et de l'email, **sans toucher à la base** (c'est le ticket 02, et l'ordre
compte : on ne supprime pas une colonne que du code lit encore).

Mesuré le 2026-09-28 : 55 fichiers de `saas/web/` mentionnent `label`, 50
mentionnent « thème », 37 `theme` ; 10 fichiers Python et 14 migrations.

**Ce qui disparaît entièrement**
- La route `/labels` — le compte de routes passe de **19 à 18**, c'est le nouveau
  repère de vérification.
- `components/` : `theme-card.tsx`, `theme-donut.tsx`, `themes-carrousel.tsx`,
  `alerte-themes.tsx`, `theme-objectif-mini.tsx`, `label-manager.tsx`,
  `labels-listes.tsx`, `labels-couverture.tsx`, `labels-modele.tsx`,
  `campaign-label-select.tsx`, `post-label-select.tsx`, `conversions-themes.tsx`.
- Sur `app/page.tsx` : l'anneau (`ThemeDonut`), le carrousel, les cartes de thème,
  la section « Ce qu'aucun thème ne prend », l'alerte de couverture. **Rien ne les
  remplace** — décision de David : « on met vide, on supprime, il n'y a rien qui
  apparaît ».
- Dans `build_report.py` : `_labels_prioritaires`, les cartes par thème, la vision
  globale par thème, les objectifs par thème, les événements GA4 par thème.

**Ce qui survit mais doit être adapté, pas supprimé**
- `FriseSemaine` prend `univers={data.labels}` et colore ses événements par thème
  (`frise-semaine.tsx:236`, `teinteLabel`). La frise reste, sa coloration par
  thème part.
- `TroisDates`, `Verdict`, `KpiFocusCard`, `CanalMuetAlerte`, `TrouDeRecolte`,
  `SetupWizard`, `Changements` ne dépendent pas du thème et restent.
- La **mise en place** (`SetupWizard`) a une étape « premiers thèmes » et une
  étape « priorités » : `CONTEXT.md` dit quatre étapes, il n'en reste que deux.

**Ce qui se met à jour au lieu de disparaître**
- `CONTEXT.md` : retirer les entrées « Thème », « Classement », et corriger
  « Mise en place » (quatre étapes → deux).
- `CLAUDE.md` (racine) et `saas/web/CLAUDE.md` : le thème n'est plus le pivot du
  produit. La phrase produit du §1 est à réécrire.
- `docs/adr/0001`, `0002`, `0003` portent sur les thèmes. Une ADR ne se supprime
  pas : elle se marque **remplacée**, avec le renvoi vers cette carte.
- `BACKLOG.md` : y déposer ce qui part, pour que le travail de mesure ne soit pas
  refait (voir le ticket 02 pour la liste des objets de base).

**Repli si la session va être coupée** : finir `saas/web/` en entier et le dire,
plutôt que d'entamer le Python à moitié — un `npm run build` rouge laisse le
dépôt inutilisable.

**Vérification** : `rm -rf .next tsconfig.tsbuildinfo`, `npx tsc --noEmit`,
`npm run build` verts, **18 routes**, `python3.12 -m py_compile` sur le Python
touché, et les harnais de `.scratch/construction/harnais/16-le-seam-du-payload/`
rejoués (`build_payload` prend un `Lecteur`, une propriété du payload s'exécute
au lieu de se lire). Attention : ces harnais sont supprimés du disque mais encore
dans l'index git — les restaurer avant (`git checkout -- .scratch/construction`).

## Answer

Fait et vérifié le 2026-09-30, sur la branche
`worktree-meta-ads-01-theme-quitte-le-code`.

**Ce qui est parti.** La route `/labels`, les douze composants listés, l'anneau,
le carrousel, les cartes et l'alerte de l'accueil ; dans `/couts`, l'anneau par
thème, la section « Par thème » et le filtre de thème du bandeau (l'anneau par
plateforme reste, sur le composant générique `Anneau`) ; dans `actions.ts`, les
actions d'étoile, de liste maîtresse, de fusion, d'événement GA4 par thème,
d'objectif par thème et d'étiquette de campagne ou de post ; dans
`lib/report.ts`, les types de carte de thème et les lectures de
`profiles.labels` et `insight_feedback` ; `teinteLabel` ; le lien « Thèmes » de
la navigation. Côté Python, `_labels_prioritaires` et tout ce qui se construisait
par thème ; le `Lecteur` perd huit méthodes.

**Le point qui comptait le plus.** `lib/changements-api.ts` lisait encore
`meta_campaign_config.label` et `google_campaign_config.label`. Le jour où le
ticket 02 supprime ces colonnes, la requête échouait, le `catch` rendait `[]`,
et **la frise perdait tous ses faits sans rien dire**. La lecture est retirée.
Plus aucune requête de `saas/` ne touche un objet de base que le ticket 02
supprime (`git grep` propre) : l'ordre « code d'abord, base ensuite » tient.

**Les docs.** `CONTEXT.md`, `CLAUDE.md` (racine et `saas/web/`), les ADR 0001 à
0003 marquées remplacées, `BACKLOG.md` ; le repère de vérification passe à
**18 routes** dans les deux `CLAUDE.md`.

**Vérification.** `rm -rf .next tsconfig.tsbuildinfo`, `npx tsc --noEmit` vert,
`npm run build` vert, **18 routes** comptées. `python3.12 -m py_compile` vert
sur les dix fichiers Python touchés. Harnais du seam adaptés (le faux lecteur ne
grée plus de thème, les tests de ROAS par thème sont partis avec leur objet) et
rejoués : `test_le_seam.py` **71/71**, `test_chiffres_du_payload.py` **23/23**.

**Pas vérifié ici.** Aucun rapport n'a été reconstruit sur de vraies données :
ce changement de traitement ne se verra qu'au prochain passage du worker (cron
du Jour de travail, ou `weekly-fetch.yml` lancé à la main avec `report_only`).

**Trouvé en chemin, devenu ticket.**
- [Trois harnais testent ce qui est parti](13-trois-harnais-testent-ce-qui-est-parti.md)
  — 18, 20 et 47 tombent sur `Campagne(theme=…)` ; 20 et 47 couvrent le canal
  muet, fonction vivante.
- [La page d'arrivée d'une campagne n'a plus d'écran](14-la-page-d-arrivee-d-une-campagne-n-a-plus-d-ecran.md)
  — `setCampaignLanding` est gardée mais son seul appelant vivait sur `/labels`.
