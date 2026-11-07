# 10: L'Objectif et « Tes posts face à ton année »

**What to build:** le client choisit une période et un Objectif (Portée,
Engagement, Abonnés) puis une métrique, et voit chaque format en rangée : le
nuage des posts de la période posé sur la bande 25-75 % de ses 12 derniers
mois, les moustaches pesées 12 / 3 / 1 mois, les pastilles d'évolution.

Spec : § La page — Bandeau de commandes (la période), Sélecteur de vue,
« Tes posts face à ton année » (sauf la liste des 5 meilleurs, 11) ; § La
lecture, lignes « 3 mois, 1 mois » ; User Stories 11 à 18 et 22.

**Blocked by:** 09

**Status:** resolved

- [x] Valeurs à l'ouverture : Engagement / taux, période comme Meta
      (`periodeDe`).
- [x] Rangées en ordre fixe ; format sans post sur 12 mois → pas de rangée ;
      sans post sur la période → bande et « aucun post sur la période ».
- [x] En-tête : post type et `n`, total pour ce qui se compte, « x sur n » ;
      pastilles 3 mois / 1 mois signées avec leur nombre de posts, aucune
      sous 6, en valeur quand le post type des 12 mois vaut 0.
- [x] Moustaches pesées (largeur et encre selon `n`), valeurs écrites,
      hors norme comptés sans étirer l'axe, « 5 / 6 posts » sous 6 ; le Reel
      en Abonnés reçoit une phrase, jamais une moustache à zéro.
- [x] La ligne de référence, et sa version partielle (« tes posts du … au …
      (n) ») ; changer la période ne bouge pas les quartiles (harnais).
- [x] Une métrique pas encore en base est grisée avec sa raison.
- [x] `tsc` et `build` verts.

## Réponse

**Ce qui est fait.**

- `saas/web/lib/instagram/annee.ts` (sans directive) — le calcul du module,
  posé sur `fouleDe` sans le dupliquer : `moduleAnneeDe(posts, m, periode,
  ctx)` rend la ligne de référence (`complete`, ou `debut/fin/n`), une rangée
  par format présent sur 12 mois en ordre fixe (`sans_metrique` + phrase pour
  le Reel en Abonnés), et par rangée : post type, `n`, `sur`, total
  (`totalDe` sur les éligibles de l'année), deux pastilles (`mince`,
  `sans_reference`, `pourcent`, `valeur` quand le post type vaut 0), trois
  moustaches (`mince` sous 6 ou `boite` : quartiles, bouts dans les limites
  de Tukey, hors norme comptés, points, `poids` = √(n ÷ n de l'année)), le
  nuage de la période (jeune, hors de l'axe, place) et `axeMax`.
  `raisonIndisponible(posts, m)` grise une métrique qu'aucun post n'a et
  nomme ce qui manque en base (« Pas encore en base : les partages. ») ;
  `textePastille`, `texteReference` écrivent.
- `lib/instagram/lecture.ts` : `eligiblesDe` sorti de `fouleDe` (même
  filtre, réutilisé pour « x sur n » et le total). Rien d'autre ne change.
- `lib/instagram/liens.ts` — `lienInstagram(params, patch)`, calqué sur
  `lienMeta` : garde tout paramètre inconnu (prêt pour `?post=` du 11 et les
  filtres du 12), n'écrit pas le défaut `metrique=taux`.
- `lib/instagram/couleurs.ts` — `COULEUR_FORMAT` (violet, bleu, ambre,
  turquoise de `lib/palette.ts`, les teintes du prototype D).
- `lib/instagram/donnees.ts` — prend `{from, to}` et rend `periode`
  (`periodeDe` de Meta : 7 jours finissant la veille du dernier Jour de
  travail), `raccourcis`, `hier`.
- Composants : `components/instagram/bandeau.tsx` (période via
  `ChoixPeriode`, désormais exporté de `components/meta/bandeau.tsx` ; slot
  `reglages` pour le 12) ; `selecteur.tsx` (3 Objectifs puis leurs
  métriques ; grisée = non cliquable, raison au survol ET écrite dessous) ;
  `annee/module.tsx` (slots `aside` pour la liste du 11, `regles` pour la
  ligne « Lu sans … » du 12), `annee/rangee.tsx`, `annee/nuage.tsx`,
  `annee/moustaches.tsx`, `annee/dessin.ts` (axe commun, bas à 0).
- `app/instagram/page.tsx` : l'ancien `BandeauCommandes` (`?d=`), « Tes
  posts, un par un » (`?m=`) et le « Top 3 » partent — ils répondaient à la
  même question avec une autre période et une autre métrique. « Ta page » et
  « Tes moyennes » restent jusqu'aux tickets 14/15, nourries par
  `getInstaDash({from, to})` de la même période.

**Arbitrages pris en construisant (à relire).**

- Pastilles d'une seule encre, pas de vert/rouge : la couleur jugerait
  l'écart à la place du client (user story 4).
- « Référence complète » = la base contient un post antérieur aux 12 mois ;
  sinon `(n)` compte les posts de format connu des 12 mois, toutes rangées.
- Le total d'en-tête porte sur l'année (comme le post type), pas la période.
- Bouts de moustache = la valeur la plus extrême encore dans les limites de
  Tukey (pas la limite elle-même : aucun trait sans post au bout).
- Axe : de 0 au plus haut bout de moustache ou point de la période resté
  dans les limites de l'année ; un point au-delà = flèche en haut, valeur
  écrite.
- Pastille en valeur, ratio : « 0,4 % de plus » ; compte : « 2 abonnés
  gagnés de plus ».
- Le Reel en Abonnés : phrase pour les trois métriques de l'objectif (les
  visites de profil non plus ne sont pas rendues pour un Reel).

**Vérifié.**

- `sh .scratch/instagram-construction/harnais/10-l-objectif-et-l-annee/lancer.sh`
  → 15 tests, 15 verts (période sans effet sur les quartiles ; ordre fixe et
  rangée absente ; « aucun post sur la période » ; en-tête et « x sur n » ;
  pastilles +50 % / mince / en valeur ; « 5 / 6 » ; hors norme compté, axe à
  6 et point hors de l'axe ; poids √(6/12) ; phrase du Reel ; point jeune ;
  référence partielle / complète ; textes ; lien qui garde le reste ;
  métrique grisée avec sa raison, taux compris).
- Harnais 09 toujours vert : 28 / 28.
- `rm -rf .next tsconfig.tsbuildinfo && npx tsc --noEmit` vert ;
  `npm run build` vert, 18 routes.

**Ce qui ne se vérifie qu'en vrai.** Le rendu n'a pas été regardé dans un
navigateur (pas de session sur la machine de construction) : lisibilité des
SVG sur téléphone, chevauchement d'étiquettes quand q1, médiane et q3 sont
très proches. Sur les vraies données, tant que la section 23 n'est pas jouée
et qu'un passage du worker n'a pas relevé les partages, **le taux (défaut à
l'ouverture) est vide partout et grisé** avec « Pas encore en base : les
partages » — c'est la vérité (§7), pas un bug ; le **cron de 07:00 UTC**
suffit, ou un lancement à la main depuis l'onglet GitHub Actions
(`weekly-fetch.yml`). La ligne de référence partielle ne se verra que si la
base ne remonte pas à 12 mois (Rattrapage, ticket 08).
