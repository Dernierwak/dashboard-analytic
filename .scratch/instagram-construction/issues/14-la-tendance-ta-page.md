# 14: La Tendance « Ta page »

**What to build:** en tête, le compte seul : les abonnés en grand (courbe du
total, barres gagnés vers le haut, perdus vers le bas), la portée et les
interactions du compte jour par jour, la période d'avant en pointillé, les
jours de publication marqués et cliquables, un interrupteur Tout / Organique /
Boosté.

Spec : § La page — Tendance ; § La lecture, ligne « la Tendance » ; § Ce
qu'on ne mesure pas (portée organique du compte) ; User Stories 6 à 10.

**Blocked by:** 09, 05

**Status:** resolved

- [x] Trois sources des abonnés (`followers_history` jusqu'au 2026-09-04, la
      remontée, le relevé), un trou entre la première et la deuxième ; un
      jour sans donnée est un trou ; jour en cours exclu ; 48 dernières
      heures avec l'icône.
- [x] Portée de la période = `instagram_compte_periodes` (05) quand la
      période y est, sinon une phrase qui dit pourquoi ; jamais la somme des
      jours.
- [x] Interrupteur : Interactions total − `AD` / `AD` ; Portée boostée = `AD`,
      Organique grisé avec sa raison ; Abonnés sans effet.
- [x] Jours de publication sous l'axe ouvrent `?post=` ; pas de table sous la
      Tendance ; l'Objectif et les Règles de lecture ne la touchent pas.
- [x] Harnais : séries avec trous, période d'avant, interrupteur.
- [x] `tsc` et `build` verts.

## Réponse

**Ce qui est fait** (fichiers neufs seulement ; ni `page.tsx` ni `lecture.ts`
touchés, frontière avec le ticket 10).

- `saas/web/lib/instagram/tendance.ts` (sans directive) — le calcul pur
  `tendanceDe({ jours, historique, periodes, posts, periode, maintenant })` →
  `Tendance` (sérialisable) :
  - dates de la période et de la période d'avant, jour par jour ; un jour sans
    ligne ou une colonne vide = `null` (trou) ; le jour en cours toujours `null` ;
    `recents` = jours dont la fin date de moins de 48 h (hier et avant-hier
    à 07:00 UTC, `issues/04`) ;
  - abonnés : `abonnesParJourDe` de `lecture.ts` (followers_history jusqu'au
    2026-09-04, puis `instagram_compte_jours`, qui l'emporte) — le trou entre
    les deux sources se fait seul ; barres `gagnes` / `perdus` ; dernier total
    mesuré ; sommes « x jours lus des n » ;
  - portée de la période = la ligne `(debut, fin)` exacte de
    `instagram_compte_periodes`, la période d'avant pareil, écart seulement
    si les deux sont lues ; sinon une raison (période ≠ 7 jours, semaine pas
    relevée, avant le premier relevé avec sa date, aucune semaine, table
    illisible) ; jamais la somme des jours ;
  - interrupteur : interactions Tout / Organique (total − `AD`) / Boosté (`AD`) ;
    portée Tout / Boosté (`reach_ad`), Organique = seulement sa raison ;
    portée boostée de la période = une raison ; abonnés sans ventilation ;
  - jours de publication = posts de la période groupés par jour (id, format,
    légende coupée à 80) ; `lienDuPost(params, id)` ne change que `post`.
- `saas/web/lib/instagram/donnees-tendance.ts` — `getTendanceInstagram(posts,
  periode)` : `compte.uid`, `instagram_compte_jours` (bornée aux deux périodes),
  `followers_history` (bornée), `instagram_compte_periodes` (toutes : la plus
  ancienne date la raison), toutes paginées ; table de la § 23 illisible →
  `null` → trous et phrase, jamais zéros.
- `saas/web/components/instagram/tendance.tsx` — le module, prêt à monter :
  `<TendanceTaPage tendance={Tendance} params={searchParams} />` (`tendance` :
  la sortie de `getTendanceInstagram` ; `params` : les searchParams de la page,
  pour que les jours de publication ouvrent `?post=` en gardant le reste).
  Abonnés en grand à gauche, portée et interactions empilées à droite,
  interrupteur en état local (pas dans l'URL : la spec n'y met que les Règles et
  le post), aucune table.
- `saas/web/components/instagram/tendance-graphe.tsx` — le graphe : `courbe.tsx`
  (brique partagée avec Meta, ADR 0011) n'a ni barres sous la courbe, ni repères
  sous l'axe, ni 48 h ; elle n'est pas touchée. Mêmes règles : trou à chaque
  `null`, point isolé visible, pas d'`Intl`, pointillé gris = période d'avant.
  Barres gagnés (vert, haut) / perdus (rouge, bas) avec leur propre repère
  ±max, même axe des jours. Un jour à un post = lien ; plusieurs = liste.

**Branché** (après la fusion des tickets 10 et 11) dans `app/instagram/page.tsx` :
`getTendanceInstagram(posts, periode)` lu en parallèle de `getInstaDash`, et
`<TendanceTaPage>` sous le Bandeau à la place des trois tuiles et de
`CourbeAbonnes`. « Tes moyennes » et `getInstaDash` restent (ticket 15) ;
`CourbeAbonnes` n'a plus d'appelant, à retirer au 15 avec le reste.
`lienDuPost` délègue à `lienInstagram` (`lib/instagram/liens.ts`), que le
Panneau du 11 ferme avec le même lien.

**Date du dernier relevé** (user story 1) : une ligne discrète sous le titre,
« Relevé du jeu. 5 nov. à 07:02 UTC » = le `maj_a` le plus récent des lignes
lues d'`instagram_compte_jours` ; sans `maj_a`, « Chiffres jusqu'au … » = le
jour le plus récent présent (jamais le jour en cours) ; rien de lu, aucune
date.

**Vérifié**

- `sh .scratch/instagram-construction/harnais/14-la-tendance/lancer.sh` →
  23 tests, 23 verts (date du relevé : maj_a le plus récent, repli sur le
  dernier jour présent, aucune date sans donnée ; trous, 0 ≠ trou, jour en cours exclu, 48 h, trois sources
  et le trou, le compte l'emporte, sommes sans zéro, portée de période lue /
  absente et ses quatre raisons + table illisible, écart sur périodes
  complètes seulement, Organique = total − AD et AD absent → trou, compte
  sans boost qui dit pourquoi, portée organique sans série, abonnés sans
  ventilation, jours de publication, lien `?post=` qui garde l'URL).
- Harnais 09 : 28/28, 10 : 15/15, 11 : 15/15 verts (après branchement).
- `rm -rf .next tsconfig.tsbuildinfo && npx tsc --noEmit` vert ; `npm run build`
  vert, 18 routes.
- Rendu regardé dans Chrome sur une page de contrôle temporaire (données
  écrites à la main, `next dev` avec des variables Supabase factices) :
  courbes, trous, hachures 48 h, barres, infobulle, interrupteur Organique
  grisé. Page supprimée, `git grep controle-tendance` propre.

**À relire / arbitrer**

- Conséquence du ticket 05 (« `AD` absent → NULL ») : chez un compte qui ne
  booste pas, Instagram n'énumère probablement pas `AD`, donc Organique et
  Boosté des interactions sont vides — l'écran dit pourquoi au lieu d'un faux
  zéro. Si l'essai réel montre que Meta rend `AD = 0`, rien à changer ici.
- La remontée du premier passage n'écrit pas `reach_ad` / `interactions_ad` :
  ces jours-là, Boosté et Organique sont des trous.
- La portée de période n'existe que pour des fenêtres de 7 jours finissant la
  veille d'un passage : toute autre période choisie affiche « – » et la raison.
- La page branchée n'a pas été regardée sur de vraies données (seul le module
  l'a été, sur données écrites à la main).

**Ne se vérifie qu'en vrai** : après que David a joué la section 23, et
qu'un passage du worker a écrit `instagram_compte_jours` et
`instagram_compte_periodes` — le **cron de 07:00 UTC** suffit (le passage léger
tourne chaque jour), ou un lancement à la main depuis l'onglet GitHub Actions
(`weekly-fetch.yml`). La page lit ce qui est en base : rien d'autre à
attendre du worker.
