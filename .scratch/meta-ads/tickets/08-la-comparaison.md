# 08: La Comparaison

Type: task
Status: ready-for-human
Blocked by: 06

**What to build:** le client compare ses groupes d'annonces ou ses annonces entre
eux — qui fait mieux que qui, et comment ça évolue. Mise en page **C2** : la liste
en haut sur deux colonnes, les deux graphes côte à côte dessous (choix par défaut
de la spec, que David peut renverser). Spec : § « Comparaison — la mécanique » ;
user stories 29 à 33, 35, 36.

La cible « Lire » n'est **pas** dans ce ticket (ticket 12). La bande « créas
comparées » ne se construit pas.

- [x] Bascule entre groupes d'annonces et annonces
- [x] Liste classée par la métrique 1 — décroissante, croissante pour un coût ;
      vignette pour une annonce, une barre et les deux valeurs
- [x] L'élément sans valeur pour la métrique de classement se range en bas avec
      « — » (testé)
- [x] Jusqu'à 4 éléments cochés, tracés dans deux graphes, un par métrique ; la
      5ᵉ case se refuse **visiblement**, sans en décocher une autre
- [x] Choisir pour une métrique celle de l'autre les échange
- [x] Deux annonces homonymes restent deux lignes (testé)
- [x] Niveau, métriques et éléments cochés vivent dans l'URL
- [x] `tsc --noEmit` et `npm run build` verts, 19 routes

## Answer

**Construit le 2026-10-03.** La Comparaison suit la Tendance sur `/meta`, en
mise en page C2.

**Le code** :
- `lib/meta/lecture.ts` (fonctions pures, section « La Comparaison ») —
  `comparaisonDe` regroupe les lignes de la période par ID (groupe ou annonce),
  recalcule les deux métriques total ÷ total, classe et trace les cochés ;
  `basculerCoche`, `choixMetrique`, `placesDe`, `placesVersUrl` sont les clics.
- `components/meta/comparaison.tsx` — réglages, liste sur deux colonnes (lue
  colonne après colonne), deux graphes côte à côte avec légende.
- `components/courbe.tsx` — une couleur par série, optionnelle (la Tendance ne
  change pas) ; des clés par index (deux homonymes = deux séries) ; une date
  qui ne s'écrit qu'une fois dans la bulle.
- `lib/meta/liens.ts` — un patch peut écrire un paramètre répété ;
  `niveau=annonces`, le défaut, ne s'écrit pas.
- `lib/meta/donnees.ts` — les vignettes lues dans `meta_ads_creatives`
  (`vignette_url`, à défaut `image_url`), par paquets de 200 IDs.

**L'URL** : `niveau` (`groupes` | `annonces`), `m1`, `m2`, `comparer` répété.

**Harnais** : `.scratch/meta-ads/harnais/08-la-comparaison/comparaison.test.ts`,
lancé par `node --test .scratch/meta-ads/harnais/08-la-comparaison/comparaison.test.ts`
— **25 verts** ; les 26 du 06 et les 18 du 07 restent verts (69 en tout). Ils
couvrent :
- le classement décroissant, croissant pour un coût ;
- « — » en bas dans les deux sens ; un vrai zéro classé au-dessus de « — » ;
- le CPC d'un groupe total ÷ total (100 ÷ 40 = 2,5, pas la moyenne 2) ;
- deux annonces homonymes = deux lignes et deux séries ; une renommée = une
  ligne ; une ligne sans ID jamais rattachée à une identifiée ;
- la 5ᵉ case refusée sans rien décocher ;
- une place libérée qui ne repeint pas les autres ;
- l'échange des métriques ; les métriques invalides de l'URL ;
- le trou dans une série ;
- l'aller-retour URL → contenu.

`tsc --noEmit` et `npm run build` verts, **19 routes**.

**Vu dans Chrome** sur une page de contrôle temporaire nourrie de lignes
fabriquées (supprimée, `git grep controle-` propre) :
- la liste classée, les barres, trois pré-cochés et leurs courbes ;
- CPC : du moins cher au plus cher, « Sans clic » en bas avec « — » ;
- un trou dans la courbe d'une annonce arrêtée deux jours ;
- la 5ᵉ case : ligne en rouge et phrase « 4 au maximum », URL inchangée ;
- les `href` de chaque case, métrique et niveau, lus un par un.

Le passage a trouvé et corrigé trois défauts :
- les deux « Promo » homonymes se confondaient dans la légende → le rang y est
  écrit ;
- cliquer le niveau déjà actif remettait les cases au pré-cochage ;
- à 390 px (iframe), les deux colonnes de valeurs ne laissaient que quatre
  lettres au nom → elles s'empilent au téléphone. Aucun débordement horizontal.

**Pas vu** : la page `/meta` sur de vraies données. La base de production
refuse la requête (`column meta_ads_insights.campaign_id does not exist`) :
le `000` du ticket 02 n'y est pas joué, comme le ticket 06 le disait. Pas vu
non plus : une vraie vignette — `meta_ads_creatives` est vide jusqu'au
ticket 05.

Choix faits, à renverser si David le veut :
- **Les cases occupent des places (1 à 4), et la couleur est celle de la
  place.** Décocher le premier ne repeint pas les autres (règle `dataviz` : la
  couleur suit l'élément, jamais son rang). Une place libérée s'écrit `-` dans
  l'URL ; `comparer=-` seul = « rien de coché, exprès ».
- **Sans `comparer`, les trois premiers du classement sont pré-cochés**, une
  case restant libre — comme le prototype. Changer de niveau repart de là.
- **Niveau par défaut : les annonces**, comme le prototype.
- **Quatre teintes** prises dans la palette des campagnes, mais pas les
  quatre premières : orange et jaune tombaient à ΔE 13,7 en vision normale
  quand les quatre partagent un graphe (validateur `--pairs all`, plancher 15).
  Retenu : bleu, orange, vert, violet, tout passe (pire paire 16,3 ; CVD 9,2).
  Le vert est sous 3:1, donc le nom est toujours écrit à côté.
- **Seuls les éléments qui ont des lignes sur la période** sont listés. Une
  annonce qui n'a tourné qu'avant n'apparaît pas, plutôt qu'une ligne de « — ».
- **La barre se rapporte à la plus grande valeur mesurée**, y compris pour un
  coût (la plus chère a la plus longue barre).
- **Une vignette absente** est une case neutre, « Aucun visuel lu pour cette
  annonce ». Un échec de lecture des créas ne coûte que les images, jamais la
  page.

**Pour David** : rien de neuf au-delà du 06 — jouer le `000` du ticket 02
avant que la page parte en production, puis ouvrir `/meta`. Aucun passage du
worker n'est nécessaire pour voir la Comparaison. Les vignettes, elles,
n'apparaîtront qu'après le ticket 05 **et** un passage du worker
(`weekly-fetch.yml` lancé à la main depuis l'onglet GitHub Actions).
