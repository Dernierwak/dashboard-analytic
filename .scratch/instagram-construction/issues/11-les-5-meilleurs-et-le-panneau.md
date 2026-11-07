# 11: Les 5 meilleurs et le Panneau « lire un post »

**What to build:** à droite du module, la liste collante des 5 meilleurs posts
de la période sur la métrique choisie ; un clic (liste, nuage, Tableau) ouvre
le Panneau latéral `?post=` qui lit le post dans Pulse.

Spec : § La page — « Tes posts face à ton année », dernier point (la liste) ;
§ Panneau latéral ; § La lecture, « les 5 meilleurs » ; § Notes, « La forme de
la Sélection reste amendable ».

**Blocked by:** 10

**Status:** resolved

- [x] Liste : vignette, valeur, place, mini-moustache, légende, « Lire le
      post » ; numéros reportés sur le nuage ; sans les moins de 48 h ni les
      sans valeur.
- [x] Panneau : lecteur public Instagram depuis `permalink` (rien sans lui),
      légende, lien, valeur et moustache, place sur **chaque** métrique,
      temps de visionnage pour un Reel.
- [x] La phrase de l'écart avec l'hebdo quand un rapport a lu ce post.
- [x] Le lien `?post=` ne change que `post` et garde le reste de l'URL.
- [x] `tsc` et `build` verts.

## Réponse

**Ce qui est fait.**

- `saas/web/lib/instagram/meilleurs.ts` (sans directive) — `meilleursDe(posts,
  m, periode, ctx)` : posts de la période, plus de 48 h, valeur non vide (un 0
  mesuré entre, un vide non), tri décroissant, à égalité le plus récent ;
  chaque meilleur porte son rang, sa place (`placeDuPost`, la même foule que
  le module) et la moustache des 12 mois de son format. `rangsDe` → ID → rang
  pour le nuage. Aucun filtre propre : les Règles (12) retireront les écartés
  avant l'appel.
- `saas/web/lib/instagram/panneau.ts` (sans directive) — `lecteurDe` (le
  lecteur `…/embed` pour un Reel ou une vidéo du fil, depuis le permalink ;
  `null` sans lui, pour une image/un carrousel, ou hors de
  `https://www.instagram.com` — une iframe ne s'ouvre pas sur une URL
  quelconque venue de la base) ; `lecturePostDe` (valeur, place et moustache
  sur la métrique choisie, place sur chacune des 12 métriques, visionnage
  pour un Reel, âge « moins de 48 h » / « J+n » sous 7 jours) ;
  `jourDuRapport` et `phraseEcartHebdo` (la phrase de la spec).
- `lib/instagram/donnees.ts` — `jourDuPremierRapportQuiListe(permalink)` :
  une requête `weekly_reports` filtrée par inclusion JSON
  (`payload @> {"frise":{"posts":[{"lien": permalink}]}}`), le plus ancien
  `week_start`, une ligne rapatriée ; lue seulement quand le Panneau est
  ouvert sur un post qui a un permalink. Erreur → `null`, le Panneau tient.
- Retouches : `moustacheDe` et `jourLong` exportés d'`annee.ts` ;
  `visionnageDe` sorti de `tableauDe` (`tableau.ts`) pour que le Tableau et
  le Panneau convertissent les ms au même endroit.
- Composants : `components/instagram/annee/meilleurs.tsx` (liste collante en
  `xl`, cartes, « Boosté » s'il y a lieu) ;
  `annee/mini-moustache.tsx` (couchée, axe depuis 0, le post en point noir,
  flèche au bord au-delà du bout haut, « n / 6 … pas encore de moustache »
  sous 6) ; `annee/nuage.tsx` (numéro à droite du point, chaque point est un
  `Link` `?post=` `scroll={false}`, cible de 11 px) ; `module.tsx` et
  `rangee.tsx` font passer `params` et `rangs` ; `components/instagram/tableau.tsx`
  (la cellule Post ouvre le Panneau) ; `components/instagram/panneau-post.tsx`
  (dans `PanneauLateral` de Meta, tel quel : Échap, voile, fermer =
  `replace` vers le lien sans `post`) et un panneau « Post introuvable »
  pour un `?post=` qui ne désigne aucun post du compte.
- `app/instagram/page.tsx` — la liste dans l'emplacement `aside`, le Panneau
  rendu quand `?post=` est là.

**Arbitrages pris en construisant (à relire).**

- Le rapport retenu pour la phrase est le **premier** qui liste le post
  (chaque payload porte la frise de toute l'année : tous les suivants le
  listent aussi). Sa date = le Jour de travail, lendemain de
  `payload.semaine.fin` — pas `updated_at`, qu'un `report_only` réécrit.
- Pas de phrase quand le rapport n'est pas antérieur au jour du dernier
  relevé (aucun écart à dire), ni sans `releve_a` (« Chiffres au … » serait
  inventé).
- « Boosté » et la ligne « Chiffres organiques, hors boost » sont déjà posés
  dans la liste et le Panneau (la donnée `booste_vu_le` existe) ; le ticket
  12 garde les filtres, l'anneau du nuage et les écartés.
- L'âge au Panneau est la forme simple (« J+n · peut encore changer ») ; le
  ticket 13 en fera la version commune à toute la page.
- Un post de format inconnu peut entrer dans la liste (la spec ne l'exclut
  pas) : sans moustache, sa place dit « format inconnu ».
- Hauteur du lecteur : 520 px, celle du prototype D.

**Vérifié.**

- `sh .scratch/instagram-construction/harnais/11-les-5-meilleurs-et-le-panneau/lancer.sh`
  → 15 tests, 15 verts (top 5 et rangs ; hors période / < 48 h / sans valeur
  exclus ; un 0 entre ; place + moustache du meilleur ; égalité ; rangs du
  nuage ; lecteur Reel et vidéo du fil, `?igsh` retiré ; rien sans permalink,
  pour une image, hors d'Instagram ; place sur chaque métrique, null reste
  null ; visionnage Reel seul ; âge ; jour du rapport ; phrase ; pas de
  phrase sans rapport / sans relevé / rapport non antérieur ; `?post=` ne
  change que `post`).
- Harnais 09 : 28 / 28 ; harnais 10 : 15 / 15.
- `rm -rf .next tsconfig.tsbuildinfo && npx tsc --noEmit` vert ;
  `npm run build` vert, 18 routes.

**Ce qui ne se vérifie qu'en vrai.** Rien n'a été regardé dans un navigateur
(pas de session sur la machine de construction) : le `Link` de Next posé dans
un SVG (le clic sur un point du nuage), la liste collante, le lecteur
Instagram dans l'iframe. La requête par inclusion JSON sur `weekly_reports`
n'a pas tourné contre Supabase : si elle échoue, l'erreur est journalisée
(`[instagram] weekly_reports illisible pour le Panneau`) et la phrase manque.
Rien à attendre du worker pour la liste et le Panneau (ils lisent la base) ;
la phrase ne paraît que pour un post dont le permalink est dans un rapport
publié **et** relevé après ce rapport — donc après un passage du worker
postérieur au rapport : le **cron de 07:00 UTC** suffit, ou un lancement à
la main depuis l'onglet GitHub Actions (`weekly-fetch.yml`). Le temps de
visionnage reste « – » tant que la section 23 n'est pas jouée.
