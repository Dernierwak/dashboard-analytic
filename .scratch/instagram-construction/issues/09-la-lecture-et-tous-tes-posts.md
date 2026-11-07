# 09: La lecture `lib/instagram/` et « Tous tes posts »

**What to build:** le calcul unique de la foule, neuf, et son premier écran :
le Tableau détaillé « Tous tes posts » — tout l'historique, triable par date
et par métrique, la Place sur la métrique choisie, la date du dernier relevé,
« plus d'un an », l'export `.csv` pour Excel.

Spec : § Implementation Decisions — la lecture (tout le tableau des calculs,
sauf l'âge égal et les filtres) ; § La page, Tableau détaillé ; vocabulaire ;
§ Testing Decisions, seam 2.

**Blocked by:** 01

**Status:** resolved

- [x] Fonctions pures sans `"use client"` : format (Vidéo du fil ≠ Reel,
      format inconnu hors foule), métriques brutes null = null, taux à quatre
      termes, réactions fortes, abonnés pour 1 000, portée ÷ abonnés,
      référence 12 mois glissants, quartiles exclusifs, place avec les bornes
      de la spec, rien sous 6, totaux sans portée ni taux.
- [x] Lecture paginée (`lireToutesLesPages`) des posts, `permalink` compris.
- [x] Le Tableau remplace le bas de la page actuelle : tri date (récent
      d'abord par défaut) et métriques, colonne Place, dernier relevé,
      « plus d'un an », temps de visionnage (« – » hors Reel), « – » pour
      toute absence.
- [x] Export `.csv` : point-virgule, Date en première colonne, absence =
      cellule vide.
- [x] Harnais : [1…6] → 1,75 / 3,5 / 5,25 ; null jamais compté 0 ; rien sous
      6 ; aucun total de portée ni de taux ; plus de 12 mois et moins de 48 h
      hors de la foule ; format inconnu hors foule ; l'export.
- [x] `tsc` et `build` verts.

## Réponse

**Ce qui est fait.**

- `saas/web/lib/instagram/lecture.ts` (sans directive ni import) — le socle
  des tickets 10 à 15, dans le vocabulaire de la spec :
  `formatDe` / `FORMATS` (ordre fixe des rangées) ; `postDe` (ligne de base →
  `Post`, null reste null, colonne absente = rien rendu) ; `METRIQUES`,
  `METRIQUES_DE` (objectif → métriques, défaut en tête), `metriqueDe`,
  `valeurDe` ; `abonnesParJourDe` (`followers_history` + `instagram_compte_jours`) ;
  `quartiles` (CPython ligne pour ligne), `limitesDe` (Tukey 1,5) ;
  `ageDe` / `maturiteDe` (jeune < 48 h ≤ âge égal < 7 j ≤ mûr ; sans
  `releve_a` = mûr) ; `dansLesMois` / `debutDesMois` ; `fouleDe` / `foulesDe`
  (prennent `mois`, donc 3 mois / 1 mois du ticket 10 sans rien changer) ;
  `bandeDe`, `estHorsNorme`, `placeDuPost` (union d'états : `place`,
  `plus_d_un_an`, `jeune`, `age_egal`, `format_inconnu`, `sans_valeur`,
  `foule_mince`) ; `totalDe`.
- `saas/web/lib/instagram/tableau.ts` — `tableauDe`, `trier` (sans valeur en
  bas dans les deux sens), `csvDuTableau`, `nomDuFichier`, et l'écriture
  (`formaterValeur`, `dateCourte`, `libellePlace`, `raisonPlace`, `TIRET`).
- `saas/web/lib/instagram/donnees.ts` — la seule couche qui touche la base :
  posts paginés (`select("*")`, ordre total `date, id`), abonnés paginés,
  compte regardé (`compte.uid`), aucun `connected_accounts`.
- `saas/web/components/instagram/tableau.tsx` — « Tous tes posts » : tri
  client par en-tête (date récent d'abord à l'ouverture), Place sur la
  métrique choisie (`?metrique=`, défaut taux), Boosté à côté du format,
  visionnage moyen (Reels), dernier relevé, export dans l'ordre affiché.
- `app/instagram/page.tsx` — « Posts de la période », « Vue globale » et leur
  pied sont remplacés par ce Tableau ; le haut reste jusqu'au ticket 15.

**Arbitrages pris en construisant (à relire).**

- Tiret « – » (demi-cadratin, celui de la spec), pas le « — » de Meta.
- Réactions fortes en % (× 100), comme le taux : un écran, une unité.
- 12 mois glissants = mois du calendrier (7 nov. → 7 nov. d'avant), finissant
  à l'instant de la lecture.
- Un post de 48 h à 7 jours compte dans la référence des autres mais n'a pas
  encore de place : la colonne écrit « J+n » et l'infobulle dit qu'elle se
  lira à âge égal (ticket 13). Le placer contre la référence aurait été une
  autre mesure que celle de la spec.
- Temps de visionnage converti ms → s d'après la doc Media Insights ; l'unité
  n'a jamais été vérifiée avec notre jeton (migration § 23) — la constante
  `MS_PAR_SECONDE` est l'unique endroit à corriger si la première vraie
  valeur dément.
- Pas de sélecteur de métrique ici : `?metrique=` est lu, le Sélecteur de vue
  qui l'écrit est le ticket 10.

**Vérifié.**

- `sh .scratch/instagram-construction/harnais/09-la-lecture/lancer.sh` →
  28 tests, 28 verts (quartiles contre `statistics.quantiles` de python3.12 ;
  null ≠ 0 ; taux à quatre termes ; rien sous 6 ; bornes de la place, pile au
  post type = haut, hors norme strict ; > 12 mois et < 48 h hors foule ;
  format inconnu hors foule ; totaux sans portée ni ratio ; tri ; export).
- `rm -rf .next tsconfig.tsbuildinfo && npx tsc --noEmit` vert ;
  `npm run build` vert, 18 routes.

**Ce qui ne se vérifie qu'en vrai.** La page sur les vraies données : rien à
attendre du worker pour la lecture elle-même (elle lit ce qui est en base),
mais `shares`, `profile_visits`, `avg_watch_time` et `releve_a` restent « – »
tant que la section 23 n'est pas jouée par David et qu'un passage du worker
n'a pas relevé les posts — le **cron de 07:00 UTC** suffit, ou un lancement à
la main depuis l'onglet GitHub Actions (`weekly-fetch.yml`). Le rendu (1 800
lignes, images paresseuses) n'a pas été regardé dans un navigateur.

Corrigé après revue : `?metrique=toString` ne fait plus de 500 (`Object.hasOwn` dans `metriqueDe`, et le même motif retiré de `liens.ts` et `tendance.ts`) ; `debutDesMois` borné au dernier jour du mois comme `_plus_mois` (31 mai − 3 mois = 28 février) ; `post_id` lu en texte (`post_id_texte:post_id::text` sur les posts, `post_id:post_id::text` sur les relevés) — 17854360229135493 reste intact. Harnais : `09-la-lecture/revue.test.ts`.
