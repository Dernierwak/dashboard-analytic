# La période de la page Coûts : une exception, ou un alignement ?

Type: grilling
Status: resolved
Blocked by: 27

## Question

[27](27-le-bandeau-partout.md) a posé le bandeau de commandes sur cinq pages et
**laissé `/couts` dehors**, parce que sa période n'est pas celle des autres.

### L'état mesuré

| | Présélections | Paramètre |
|---|---|---|
| `/meta`, `/google`, `/instagram` | 7 / 14 / 30 / 90 / Tout | `d` |
| `/couts` | 30 / 90 / **ce mois** / **cette année** | `p` |

Ce n'est pas un écart de vocabulaire, c'est un écart de **sujet**. L'en-tête de
`lib/couts.ts` le dit : *« l'horizon qui se pilote est l'année »*, et toute la
page en découle — `elapsedAn` (fraction de l'année écoulée), `budgetJour`
(budget mensuel ÷ jours du mois), `parMois` (la dépense de chaque mois de
l'année). « 7 derniers jours » n'a aucun sens contre un budget annuel ; « cette
année » n'en a aucun contre une courbe de CTR.

### Ce qu'il faut trancher

- **Le bandeau accepte-t-il deux jeux de présélections ?** S'il en accepte
  deux, il faut dire à quoi on reconnaît lequel s'applique — sinon on a deux
  barres qui se ressemblent et ne disent pas la même chose, exactement le défaut
  que le bandeau vient de réparer.
- **Ou `/couts` garde-t-elle sa propre commande ?** Alors on assume une
  exception, et il faut l'écrire quelque part où elle ne se perd pas.
- **Ou le budget se relit-il en jours glissants ?** C'est le seul chemin qui
  unifie vraiment, et il défait une décision prise et sourcée ailleurs.

Le ticket [12](12-module-de-commandes.md) §5 a unifié le **nom** du paramètre
(`d`), jamais ses **valeurs** : la question n'a jamais été posée.

### Ce qui n'est PAS dans ce ticket

Les thèmes : `/couts` les porte déjà en `l` multi-valeurs, dans la forme exacte
que le bandeau utilise. Seule la période bloque.

### Consigne de conduite

Ticket **HITL**. Skills : `vision-produit` (une information mérite-t-elle
d'exister sous deux formes), puis `grilling`.

## Prototype (2026-09-11) — quatre variantes comparables *(retiré : C a gagné)*

`/couts?variant=A|B|C|D`, flèches ← →, `PrototypeSwitcher` (invisible en
production). **À jeter quand une variante gagne** : `git grep "PROTO 28"`.

| | Titre | Commandes | Présélections |
|---|---|---|---|
| **A** | figé (`<h1>` de la page) | dans la section 2 | 30 / 90 / ce mois / cette année (`p`) |
| **B** | vivant (bandeau) | dans la section 2 | idem A |
| **C** | vivant | dans le bandeau | 7 / 14 / 30 / 90 / Tout (`d`) |
| **D** | vivant | dans le bandeau | 30 / 90 / ce mois / cette année (`p`) |

Fichiers touchés : `app/couts/page.tsx` (les variantes), `lib/couts.ts`
(`FiltreCouts.jours`, pour C), `lib/commandes.ts` + `components/bandeau-commandes.tsx`
(`presets` / `param` / `actif` — **le coût exact de D**, deux fonctions
`presetsDe` / `estActif`).

### Trois faits mesurés qui déplacent la question du ticket

1. **La période ne gouverne QU'UNE section sur trois.** Section 1 (l'enveloppe,
   `elapsedAn`, les alertes) et section 3 (les cartes par thème) sont sur
   l'année et ignorent `p`. Seule la section 2 (« Où ça part ») le lit. Le
   filtre est donc un contrôle **de section**, honnête aujourd'hui parce qu'il
   est posé *dans* la section. Le bandeau, lui, est page-level par construction
   (15 : « il n'est pas au-dessus du titre, il l'absorbe »).
2. **Les thèmes ne gouvernent que les sections 2 et 3.** Eux non plus ne
   touchent pas l'enveloppe de l'année — donc même « les thèmes seuls dans le
   bandeau » promet plus large qu'il ne rend.
3. **Le mot ne suffirait pas : l'ancre diffère.** `resoudrePeriode` fixe
   `to = aujourd'hui` (jour en cours **inclus**) ; `makeWindow` des pages canal
   ancre sur la veille ou le dernier jour de donnée. « 30 derniers jours »
   désignerait deux fenêtres différentes selon la page.

Et une limite de C : la récolte part du 1er janvier de l'année en cours
(`fetch_all.py` l. 242), donc **« Tout » et « cette année » coïncident
aujourd'hui** — mais divergeront au prochain 1er janvier, sur la page dont
l'horizon *est* l'année.

**Non vérifié :** la page n'a pas été ouverte. `/couts` est `force-dynamic` et
derrière l'authentification ; `npx tsc --noEmit` et `npm run build` sont verts
(19 routes). Le piège de `CLAUDE.md` §8 n'est pas armé ici — aucune constante ne
traverse la frontière client/serveur, `PRESETS_COUTS` est défini dans la page.

## Answer (2026-09-11)

**Alignement. `/couts` rejoint le bandeau — variante C, choisie par David après
comparaison des quatre sur de vraies données.** Période ET thèmes montent dans
l'en-tête vivant ; la page n'a plus ni `<h1>` ni filtre à elle.

### Ce qui a été construit

- **Un seul vocabulaire de période dans toute l'application** : 7 / 14 / 30 / 90
  / Tout, dans `d`, plus la plage sur mesure. « Ce mois » et « cette année »
  quittent l'écran ; `p=30|90|mois|an` reste **lu** pour qu'aucun favori ne
  casse, **plus jamais écrit** — même extinction que `label` (12 §5).
- **L'ancre s'aligne aussi, et ce n'était pas facultatif.** Aligner les mots
  sans aligner l'ancre aurait mis deux fenêtres différentes sous un seul
  libellé : `/couts` finissait sur **aujourd'hui**, les pages canal finissent
  sur la veille et reculent jusqu'au dernier jour de donnée (`makeWindow`). La
  page demande maintenant ses deux bornes à la base — quatre requêtes d'une
  ligne — au lieu de les approcher par une marge inventée. Conséquence directe
  de `CLAUDE.md` §7 : la journée en cours est incomplète, son point de courbe se
  lisait comme une chute et sa dépense manquait à la répartition.
- **La portée s'écrit, puisqu'elle ne se lit plus à la position.** La période ne
  commande qu'une section sur trois. Tant que le filtre était DANS la section 2,
  sa portée allait de soi ; en haut de page, elle doit se dire — une phrase, en
  tête de la section, et pas sous chaque module.
- **Nettoyage** : `components/filtre-couts.tsx` supprimé (son seul appelant),
  `monthLabel` et `MOIS_FULL` retirés de `lib/couts.ts` (le sur-titre est parti
  avec le `<h1>`), le pointeur mort de `lib/channels.ts` vers `filtre-couts.tsx`
  redirigé sur `lib/commandes.ts`.
- **`CONTEXT.md` est corrigé, pas seulement complété.** L'entrée **Bandeau de
  commandes** affirmait qu'il gouverne « ce que toute la page montre » : c'est
  faux depuis `/couts`. Elle dit maintenant que sa portée n'est pas toujours la
  page entière, et que là où elle ne l'est pas, la page l'écrit.

### Ce que la décision coûte, et qui est assumé

- **« Depuis le début » et « cette année » coïncident aujourd'hui** — la
  première récolte part du 1er janvier de l'année en cours (`fetch_all.py`,
  `depart_recolte`) — et **cesseront de coïncider au prochain 1er janvier**, sur
  la page dont l'horizon *est* l'année.
- **La fenêtre par défaut passe de « cette année » à 7 jours**, la présélection
  par défaut du bandeau (`d` absent = 7 partout).
- **Les thèmes perdent leur pastille de couleur dans le filtre** : le menu du
  bandeau les coche, il ne les colore pas. Les anneaux, eux, gardent les
  teintes.

### Vérifié / non vérifié

`npx tsc --noEmit` et `npm run build` verts, **19 routes**, `git grep "PROTO 28"`
propre. **La page n'a pas été ouverte** : `/couts` est `force-dynamic` et
derrière l'authentification, et l'extension Chrome n'atteint pas `localhost`.
Un serveur de dev tourne sur **:3001**.
