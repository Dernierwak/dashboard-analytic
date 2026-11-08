# 12: Les Règles de lecture

**What to build:** le client retire les boostés ou les hors norme de la
métrique affichée ; la page dit quel filtre tourne et combien de posts il
écarte, avec un lien pour revenir aux règles standard. Un post boosté se
reconnaît partout.

Spec : § La page — Bandeau (« Règles de lecture »), ligne « Lu sans … »,
§ L'état de la page vit dans l'URL ; § La lecture, « sans les hors norme »,
« sans les boostés », « La mention sous 6 posts » ; User Stories 23 à 25, 28.

**Blocked by:** 10, 02

**Status:** resolved

- [x] Deux filtres dans l'URL, jamais mémorisés ; compteur « · n ».
- [x] Tukey en une passe sur la référence de la métrique affichée ; minimum 6
      jugé après le retrait ; raison gardée dans la mention sous 6.
- [x] Écartés gris au nuage, grisés au Tableau avec leur raison, hors de la
      liste des 5.
- [x] Anneau fin au nuage, étiquette « Boosté » à la liste, au Tableau, au
      Panneau (« Chiffres organiques, hors boost — Instagram les rend
      ainsi »), sans budget.
- [x] « Revenir aux règles standard » ne retire que les deux filtres.
- [x] Harnais : Tukey une passe, retrait des boostés, raison sous 6.

## Réponse

**Ce qui est fait.**

- `saas/web/lib/instagram/regles.ts` (sans directive) — `reglesDe(params)`
  (`?sansBoostes=1`, `?sansHorsNorme=1`, rien d'autre ne les allume, rien
  n'est mémorisé) ; `ecartesDe(posts, m, regles, ctx)` décide les écartés
  UNE fois par lecture : les boostés d'abord (toutes métriques), puis Tukey
  en une passe sur la référence 12 mois de la métrique affichée, format par
  format, sans recommencer ; `retenus` les retire avant `fouleDe` ;
  `placeLue` (un écarté dit pourquoi, une foule mince dit combien un filtre
  lui a pris) ; `ligneRegles`, `mentionSousSix`, `texteEcart`, `SANS_REGLES`
  (le patch de « Revenir aux règles standard »).
- `lecture.ts` : `PlaceDuPost` gagne `{ etat: "ecarte", raison }` et
  `foule_mince.ecartes?` (absent sans filtre : harnais 09 inchangé).
- `annee.ts` (`moduleAnneeDe(…, ecartes)`), `tableau.ts` (`tableauDe(…,
  ecartes)`), `panneau.ts` (`lecturePostDe(…, regles)`) : paramètre
  optionnel, défaut = règles standard. Les écartés sortent des foules
  (moustaches, post type, pastilles, total) mais restent au nuage et au
  Tableau. `meilleursDe` reçoit `retenus(...)` depuis la page.
- Écran : bouton « Règles de lecture · n » dans le Bandeau
  (`components/instagram/regles.tsx`, menu du Bandeau Meta — `Menu`,
  `BoutonMenu`, `useFermeture` désormais exportés de
  `components/meta/bandeau.tsx`) ; ligne « Lu sans … — n posts écartés.
  Revenir aux règles standard » dans le module ; écarté gris au nuage et
  ligne grisée au Tableau avec « écarté : boosté » / « écarté : hors norme
  sur les j'aime » ; anneau fin d'un boosté au nuage, « Boosté » dans
  l'infobulle. L'étiquette « Boosté » de la liste, du Tableau et du Panneau
  (et la ligne « Chiffres organiques, hors boost ») était déjà posée par
  09/11, vérifiée. La Tendance ne reçoit rien.

**Arbitrages pris en construisant (à relire).**

- N'est « écarté » qu'un post qui serait entré dans une foule (format
  connu, 12 mois, ≥ 48 h) : un boosté d'il y a deux ans ou de moins de 48 h
  n'est pas compté — le compter gonflerait « n posts écartés ».
- Les deux filtres ensemble : les boostés partent d'abord, Tukey se calcule
  sur le reste ; un post boosté ET hors norme est dit « boosté ».
- Au Panneau, chaque ligne « sa place sur chaque métrique » applique le
  filtre hors norme de SA métrique (elle se lit comme la colonne Place si
  l'on choisissait cette métrique).
- L'anneau d'un écarté boosté est gris comme son point.
- Basculer un filtre pousse dans l'historique (comme la période) : Retour
  l'annule.

**Vérifié.**

- `sh .scratch/instagram-construction/harnais/12-les-regles-de-lecture/lancer.sh`
  → 12 tests, 12 verts (Tukey une passe : [1…6, 13, 100] n'écarte que 100,
  post type 4 ensuite ; bornes qui suivent la métrique ; boostés retirés
  quelle que soit la métrique, l'ancien non compté ; deux filtres ; minimum
  6 après retrait et « 5 Reels, il en faut 6 — 1 est écarté par ton
  filtre », aussi au Tableau ; raisons au Tableau ; écarté au nuage et hors
  des 5 ; écarté au Panneau ; URL ; ligne « Lu sans … » ; « Revenir aux
  règles standard » ne retire que les deux filtres).
- Harnais 09 : 28/28 ; 10 : 15/15 ; 11 : 15/15 ; 14 : 23/23.
- `rm -rf .next tsconfig.tsbuildinfo && npx tsc --noEmit` vert ;
  `npm run build` vert, 18 routes.

**Ce qui ne se vérifie qu'en vrai.** Rien n'a été regardé dans un
navigateur : le menu du bouton dans le Bandeau (largeur sur téléphone),
l'anneau à côté du numéro d'un meilleur, la lisibilité des lignes grisées.
Rien à attendre du worker pour les filtres eux-mêmes (ils lisent la base) ;
« sans les boostés » n'écarte quelque chose qu'une fois `booste_vu_le`
rempli par un relevé (ticket 02) — le **cron de 07:00 UTC** suffit, ou un
lancement à la main depuis l'onglet GitHub Actions (`weekly-fetch.yml`).
