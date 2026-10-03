# 07: Le Bandeau de commandes complet

Type: task
Status: ready-for-human
Blocked by: 06

**What to build:** le client retrouve vite sa campagne, choisit n'importe quelle
durée, et ne perd jamais de vue ce qu'il regarde quand il descend dans la page.
Spec : § « Solution », module 1 ; user stories 6, 7, 8, 10, 11.

- [x] Menu des campagnes avec recherche, pastille de couleur et dépense de la période
- [x] Le choix d'une campagne resserre toute la page
- [x] Période : raccourcis de 7 jours à 12 semaines, et calendrier sur deux mois ;
      toujours comparée à la période d'avant de même durée
- [x] Au défilement, le bandeau se détache en pilule flottante, avec la vue active
      repliée dedans ; l'animation se coupe pour qui a réduit les animations
- [x] `min-w-0` / `min-h-0` sur les enfants de grille et de flex, jamais une police
      plus petite
- [x] Un lien partagé rouvre la page dans le même état
- [x] `tsc --noEmit` et `npm run build` verts, 19 routes

## Comments

**2026-10-03 — construit et vérifié hors ligne et dans Chrome, sur des lignes
fabriquées. Même verrou que le 06 : la page ne se voit sur la vraie base
qu'après le `000` du ticket 02.**

Ce qui a été fait :
- `lib/meta/lecture.ts` (pur) — `campagnesDe` compte la dépense de la
  **période seule**. Avant, le menu additionnait la période et celle d'avant,
  et une campagne qui n'avait tourné qu'avant affichait 0 au lieu de « — ».
  Chaque campagne porte sa pastille (`PALETTE_CAMPAGNES`, la palette du
  prototype, repassée au validateur `dataviz` : tout passe, trois teintes sous
  3:1, donc le nom est toujours écrit à côté). On y trouve aussi
  `raccourcisDe` (7 j, 14 j, 4, 8 et 12 semaines), `periodeAvant`,
  `periodeEntre`, `moisCalendrier` et `moisVoisin`.
- `components/meta/bandeau.tsx` réécrit. Menu des campagnes : combobox,
  recherche, flèches, Entrée et Échap. Menu de période : raccourcis, et deux
  mois qu'on fait défiler ; pendant le tracé, il annonce la période d'avant
  qu'on lira. Pilule détachée dès que les cartes du Sélecteur quittent l'écran
  (`ID_SELECTEUR_VUE`), avec les vues repliées en segment.
  `motion-reduce:transition-none` sur chaque transition.
- `app/meta/page.tsx` : plus de `key` sur le Bandeau. Il se remontait à chaque
  période, ce qui rattachait la pilule en plein défilement.

**Harnais** : `.scratch/meta-ads/harnais/07-le-bandeau/bandeau.test.ts`, lancé
par `node --test .scratch/meta-ads/harnais/07-le-bandeau/bandeau.test.ts` —
**18 verts**. Les 26 du 06 restent verts. Ils couvrent :
- la dépense de la période seule, « — » et non 0, et un vrai zéro qui reste
  un zéro ;
- la pastille qui ne suit ni le rang ni le filtre, huit teintes puis un gris ;
- les raccourcis, qui finissent à la fin de la semaine mesurée (ou au dernier
  jour lu si la récolte a échoué) ;
- l'aller-retour raccourci → URL → même période, même période d'avant, et le
  reste du lien gardé ;
- un lien qui ne glisse pas une semaine plus tard ;
- les mois (premier jour de semaine, année bissextile, passage d'année) ;
- deux clics à l'envers.

**Vu dans Chrome** sur une page de contrôle temporaire, supprimée (`git grep
controle-` propre) :
- recherche et Entrée → `?campagne=…`, la page se resserre ;
- deux clics dans le calendrier → `from`/`to`, campagne gardée ;
- défilement → la pilule apparaît, « Trafic » y change la vue en gardant le
  reste ;
- l'URL rechargée à froid rouvre le même état, sans erreur de console.

La fenêtre refusant encore de rétrécir, le téléphone a été vu dans un iframe de
390 px : aucun débordement horizontal, et le menu de période tient dans
l'écran. Ce passage a trouvé et corrigé deux défauts :
- le Bandeau collait à `top-0` par-dessus la barre du téléphone
  (`side-nav.tsx`, 53 px mesurés) et masquait le menu ;
- la pilule rognait la campagne et la période en « B… » / « 10 ao… ».

**Animations réduites** : la règle est présente dans la feuille et passe après
les utilitaires. Elle n'a **pas pu être vue en émulation** : l'extension ne
sait pas forcer `prefers-reduced-motion`.

`/code-review` (deux axes) : appliqué le seuil d'observation non sourcé
(retiré), un `min-w-0` manquant, et surtout « 7 derniers jours » qui
n'écrivait rien dans l'URL — le lien partagé aurait rouvert la semaine du jour
d'ouverture. Laissés : des jugements de style mineurs.

Choix faits, à renverser si David le veut :
- **La couleur d'une campagne** se donne dans l'ordre des IDs des campagnes
  présentes : elle ne bouge ni quand le menu se reclasse, ni quand on filtre.
  Elle **peut changer** quand la période fait entrer ou sortir une campagne. Un
  hachage de l'ID la rendrait fixe, mais deux campagnes pourraient alors
  partager une teinte parmi huit. Au-delà de huit, gris neutre.
- **`/meta` sans paramètre reste « la semaine mesurée »**, donc relative : une
  page jamais réglée qu'on partage montre la semaine de celui qui l'ouvre. Tout
  choix (raccourci ou calendrier), lui, écrit ses dates.
- **Les raccourcis finissent à la fin de la semaine mesurée, pas hier** : la
  récolte ne passe qu'au Jour de travail, et les jours suivants seraient des
  trous. Le calendrier, lui, laisse choisir jusqu'à hier, comme au 06.
- **La pilule porte toutes les vues** (comme le prototype), pas seulement
  l'active : on peut en changer sans remonter.

**Pour David** : rien de neuf à faire au-delà du 06. Après le `000` du
ticket 02, ouvrir `/meta`. Aucun passage du worker n'est nécessaire pour voir
le Bandeau.
