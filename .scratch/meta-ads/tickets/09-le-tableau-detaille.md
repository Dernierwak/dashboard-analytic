# 09: Le Tableau détaillé, exporté en CSV

Type: task
Status: ready-for-human
Blocked by: 06

**What to build:** le client retrouve tout le détail, Campagne › Groupe d'annonces
› Annonce, et l'emporte dans son tableur tel qu'il le voit. Export en **CSV**
(choix par défaut de la spec). Spec : § « Solution », module 5 ; user stories 47
à 51.

- [x] Tableau dépliable sur trois niveaux ; colonnes de la vue active
- [x] Les ratios de chaque ligne sont recalculés sur la ligne : une ligne parent
      n'est jamais la moyenne de ses enfants (testé)
- [x] Une campagne renommée reste une seule ligne, sous son nom le plus récent (testé)
- [x] L'export rend ce qui est affiché — vue, filtre, période — et « — » reste
      « — », pas un zéro
- [x] `tsc --noEmit` et `npm run build` verts, 19 routes

## Comments

**2026-10-03 — construit et vérifié hors ligne et dans Chrome, sur des lignes
fabriquées. Même verrou que le 06 : la page ne se voit sur la vraie base
qu'après le `000` du ticket 02** (`/meta` en local : « column
meta_ads_insights.campaign_id does not exist », comme attendu).

Ce qui a été fait :
- `lib/meta/tableau.ts` (pur, sans directive) — `tableauDe` construit l'arbre
  Campagne › Groupe d'annonces › Annonce à partir des mêmes lignes que le reste
  de la page : chaque élément est son ID, sous le nom de sa ligne la plus
  récente ; un élément sans ID n'est regroupé par son nom qu'avec ses
  homonymes sans ID **du même parent**. Chaque ligne recalcule ses ratios sur
  ses propres totaux. `csvDuTableau` et `nomDuFichier` font l'export.
- `components/meta/tableau.tsx` — le module : dépliage ligne par ligne
  (`aria-expanded`), « Tout déplier », « Exporter en CSV », état vide.
- `lib/meta/donnees.ts` (un champ `tableau`) et `app/meta/page.tsx` (le module
  après la Comparaison), édités après le commit du 08 (coordonné avec sa
  session).

**Harnais** : `.scratch/meta-ads/harnais/09-le-tableau/tableau.test.ts`, lancé
depuis la racine par
`node --import ./.scratch/meta-ads/harnais/09-le-tableau/resoudre.mjs --test .scratch/meta-ads/harnais/09-le-tableau/tableau.test.ts`
— **20 verts**. `tableau.ts` importe `./lecture` sans extension (Next le veut) ;
`resoudre.mjs` la rajoute pour Node, rien n'est ajouté au projet. Une mutation
(nom le plus récent, totaux) en fait tomber 4. Les harnais 06, 07 et 08
restent verts (26, 18, 25). Ils couvrent : CTR et CPM d'un parent total ÷
total contre la moyenne des enfants ; « — » à l'écran et dans le CSV, un vrai
zéro qui reste zéro ; campagne et groupe renommés = une ligne sous le nom
récent ; annonces homonymes = deux lignes ; ligne sans ID jamais rattachée à
une campagne identifiée, ni à un homonyme d'une autre campagne ; colonnes
selon la vue ; période seule, jour en cours exclu, écart contre la période
d'avant ; filtre campagne, campagne inconnue → aucune ligne ; CSV (en-têtes,
chemins, échappement, injection de formule, écart négatif resté nombre).

`tsc --noEmit` et `npm run build` verts, **19 routes**.

**Vu dans Chrome** sur une page de contrôle temporaire (supprimée, `git grep
controle-tableau` propre) : trois niveaux dépliés, ratios du parent différents
de la moyenne des enfants, campagne renommée sur une ligne, homonymes séparés,
« — » sur une campagne sans impression. Le CSV, capté sans téléchargement :
BOM, nom de fichier, lignes identiques à l'écran. Téléphone (iframe de
390 px) : aucun débordement de la page, le tableau défile dans son cadre.

`/code-review` (deux axes) : corrigé un vrai défaut — la protection contre
l'injection de formule mettait une apostrophe devant un écart négatif, qui
arrivait en texte dans le tableur (test ajouté). Aussi : le slug du fichier
extrait, des noms éclaircis, un intermédiaire inutile retiré. Laissés : le
filtre de période recopié de `contenuPage` (trois lignes, `lecture.ts` était
en travail au 08) et les couleurs de fond en dur, reprises des modules voisins.

Choix faits, à renverser si David le veut :
- **L'export sort toutes les lignes, dépliées ou non**, avec une colonne
  « Niveau » : le dépliage n'est pas un état de la page (la spec ne le met pas
  dans l'URL), et une somme filtrée sur un niveau ne compte rien deux fois. Vue,
  campagne et période sont respectées, et écrites dans le nom du fichier.
- **CSV pour un tableur en français** : `;`, virgule décimale, pas de
  séparateur de milliers, unité dans l'en-tête, BOM UTF-8 ; les décimales de
  l'écran. Plus une colonne « ID Meta » pour départager deux homonymes.
- **Un nom commençant par `=`, `+`, `-` ou `@` prend une apostrophe** dans le
  CSV : sans elle le tableur l'exécute comme une formule. C'est le seul écart
  avec l'écran.
- **Seul ce qui a tourné sur la période est une ligne** ; classé par le chiffre
  principal de la vue, « — » en bas. Pas de colonne Dépense : les colonnes sont
  celles de la vue (story 48).

**Pour David** : rien de neuf au-delà du 06. Après le `000` du ticket 02,
ouvrir `/meta`. Aucun passage du worker n'est nécessaire.
