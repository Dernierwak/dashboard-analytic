# 15: Les états de la page et le départ de l'ancienne lecture

**What to build:** la page tient dans ses trois états — compte neuf, jeton
mort, compte gratuit — et l'ancienne lecture Instagram quitte l'arbre.

Spec : § La page — Les états de la page ; § La lecture, « Ce qui part de la
lecture actuelle » ; § Testing Decisions, « Ce qui ne se vérifie qu'en vrai » ;
User Stories 30, 31.

**Blocked by:** 11, 12, 13, 14

**Status:** resolved

- [x] Compte neuf : un seul encart. Jeton mort : grand encart en tête,
      « figé au … », ce qui reste juste, ce qui manque, « Reconnecter
      Instagram », page grisée. Gratuit : aucun mode à part, aucun appel à
      l'achat.
- [x] Partent de `getInstaDash` tous les champs listés par la spec et
      `FORMAT_LABEL`, sans casser Google ni l'hebdo ; plus aucun appelant.
- [x] Les dossiers `_prototype-*` ne sont pas dans l'arbre ; `git grep`
      propre.
- [x] `rm -rf .next tsconfig.tsbuildinfo`, `tsc` et `build` verts, 18 routes.

## Réponse

**Ce qui est fait.**

- `saas/web/lib/instagram/etat.ts` (sans directive) — `etatDeLaPage({ posts,
  progres })` → `normale` | `neuf` (+ `motDuWorker`) | `jeton_mort` (+
  `figeAu`), et `texteFigeAu`.
  - **Jeton mort lu dans `fetch_progress`** (canal `instagram`, état `saute`,
    `mot_de_fin` qui commence par « jeton Meta à reconnecter », le mot de
    `execution_plan.py:_a_reconnecter`). Arbitrage : pas
    `weekly_reports.payload.sources`, figé au dernier rapport (jusqu'à une
    semaine de retard dans les deux sens) ; `fetch_progress` est réécrite à
    chaque passage, léger compris, et lisible par l'invité (liste 15.1).
    Aucun `connected_accounts`.
  - **« figé au … »** = le jour du `releve_a` le plus récent des posts ; sans
    aucun relevé daté, pas de date (« ne se mettent plus à jour »).
  - **Compte neuf** = aucun post ET aucun passage `fini` (un passage fini qui
    n'a rien trouvé n'est pas « en attente du worker »). Si le dernier passage
    a sauté Instagram pour une autre raison (pas de compte Business lié, pas
    de connexion Meta), l'encart rapporte ce mot au lieu de promettre une
    lecture. Jeton mort l'emporte sur neuf.
- `lib/instagram/donnees.ts` — `progres` lu (`fetch_progress`, une ligne) ;
  illisible → `null`, la page se rend normalement.
- `components/instagram/etats.tsx` — `EncartJetonMort` (pleine largeur, ambre,
  « Ce qui reste juste » / « Ce qui manque », bouton « Reconnecter
  Instagram » → `/comptes`), `BadgeFige`, `EncartCompteNeuf` (ce que le
  premier passage lira : posts récents, 90 jours de portée et
  d'interactions, 30 jours d'abonnés au plus).
- `app/instagram/page.tsx` — compte neuf : Bandeau + encart seul (ni Tendance
  ni relevés lus) ; jeton mort : encart, puis la page sous `opacity-60
  grayscale` avec le badge, toujours cliquable (Panneau, export). Le rapport
  hebdo du Panneau et la Tendance sont lus en parallèle.
- **Gratuit** : rien à construire — la page dit déjà « n / 6 » ; le harnais
  vérifie qu'aucun texte d'achat n'existe dans `app|components|lib/instagram`.
- **Départ de l'ancienne lecture** : de `lib/channels.ts`, `InstaPost`,
  `porteeRelevee`, `LECTURES_INSTA`, `valeurDe`, `FollowerPoint`,
  `InstaDash`, `FORMAT_LABEL`, `getInstaDash` (et avec elle l'appel Instagram
  de `batirComparaison`, qui reste pour Google), plus `trierDecroissant` et
  `moyenneMesuree`, devenus sans appelant ; de `components/channel-dash.tsx`,
  `MoyennesInsta` et `CourbeAbonnes`. « Tes moyennes » quitte la page.
  Appelants cherchés avant chaque retrait : Google (`buildDash`),
  `/conversions` et l'hebdo n'utilisaient rien de ce qui part.
- `_prototype-*` : jamais dans l'arbre ; deux commentaires (`annee.ts`,
  `panneau-post.tsx`) citaient `_prototype-page/maquette.tsx` → reformulés.
  La recherche ne trouve plus que la spec et les tickets.
- `saas/web/CLAUDE.md` : la ligne `/instagram` décrit la page construite
  (ordre des modules, fichiers, Règles, liens, trois états, source du jeton
  mort) ; `channels.ts` = Google et GA4.

**Laissé tel quel (à savoir).** `Moyennes` garde son unité « publication » et
`LineChart` son option `socle="bas"` : génériques, sans appelant Instagram
désormais ; quelques commentaires de modules partagés parlent encore
d'Instagram au passé. Le bouton « Reconnecter Instagram » est montré aussi à
l'invité, comme les autres liens « Reconnecter » de l'app.

**Vérifié.**

- `sh .scratch/instagram-construction/harnais/15-les-etats-de-la-page/lancer.sh`
  → 11 tests, 11 verts (jeton mort et sa date ; sans relevé, pas de date ;
  jeton mort > neuf ; saut sans Meta, jeton Google, `echec` ≠ jeton mort ;
  neuf et mot du worker ; passage fini sans post = normale ; gratuit =
  normale ; plus aucune citation de `getInstaDash`, `InstaDash`, `InstaPost`,
  `FORMAT_LABEL`, `MoyennesInsta`, `CourbeAbonnes`, `porteeRelevee` sous
  `saas/web` ; `batirComparaison` toujours appelé une fois pour Google ;
  aucun `_prototype-` ; aucun appel à l'achat).
- Harnais 09 : 28/28 ; 10 : 15/15 ; 11 : 15/15 ; 12 : 12/12 ; 13 : 10/10 ;
  14 : 23/23.
- `rm -rf .next tsconfig.tsbuildinfo && npx tsc --noEmit` vert ;
  `npm run build` vert, **18 routes**.

**Ce qui ne se vérifie qu'en vrai.** Rien n'a été regardé dans un navigateur
(encart, grisé, badge sur téléphone). L'encart jeton mort n'apparaît qu'après
un passage du worker qui trouve le jeton Meta mort et écrit `saute` dans
`fetch_progress` — le **cron de 07:00 UTC** (le passage léger tourne chaque
jour) ou un lancement à la main depuis l'onglet GitHub Actions
(`weekly-fetch.yml`) ; après reconnexion, il ne disparaît qu'au passage
suivant. Le mot exact n'a pas été relu dans une vraie ligne `fetch_progress` :
si `_a_reconnecter` change de texte, `MOT_JETON_MORT` (`etat.ts`) doit suivre.
La date « figé au » suppose `releve_a` rempli (section 23 jouée).
