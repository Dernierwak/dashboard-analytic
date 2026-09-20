# Poser le bandeau de commandes dans l'application

Type: task
Status: resolved
Blocked by: 15

## Question

[15](15-le-bandeau-en-variantes.md) a tranché **la forme** : B, l'en-tête
vivant. Il reste à la **construire** — le prototype a été écrit sans filet (pas
de test, pas de gestion d'erreur, une seule page d'essai), il ne se promeut pas
tel quel.

### Ce qui est déjà décidé et ne se re-litige pas

Tout le cahier des charges de [12](12-module-de-commandes.md) : un seul objet
rendu par le layout ; la date et **plusieurs** thèmes partout ; statut et
campagne en plus sur `/meta` et `/google` ; un contrôle sans choix ne s'affiche
pas ; absent de `/`, `/comptes`, `/equipe` ; thèmes seuls sur `/labels` et
`/conversions` ; `d` et `l` dans l'URL, anciens noms lus mais plus jamais
écrits. Et la forme retenue par 15, avec sa règle de densité — une question, un
contrôle, et rien qui n'est pas posé ne s'affiche.

### Le travail

- **Réécrire B proprement** à partir de `components/proto-bandeau-commandes.tsx`
  (`EnteteB`, `MenuPeriode`, `MenuThemes`, `MenuChoix`, `Jeton`, `Flotte`), puis
  **supprimer le prototype** : A, C, `proto-bandeau-modele.ts`, les montages
  conditionnels de `app/meta/page.tsx` et le `PrototypeSwitcher`. `git grep
  proto-bandeau` doit être propre.
- **Le poser une seule fois**, comme `SideNav` (`app/layout.tsx`), et non par
  page. Il absorbe le titre de chaque page : le titre et son glyphe deviennent
  donc une donnée de route, pas un bloc recopié dans six fichiers.
- **`/instagram` et les pages canal doivent apprendre à additionner** plusieurs
  thèmes — `getInstaDash` n'en accepte aucun aujourd'hui. `buildDash` le sait
  déjà (`keep()`, fait en 15).
- **Retirer ce que le bandeau remplace** : `PeriodPills`, `PeriodPillsInsta`,
  `FilterBar`, et les appels à `DateRange` pour la période affichée — pas ceux
  du module de comparaison, qui gardent leurs propres paramètres.
- **Le rappel n'est PAS dans ce ticket** : c'est un objet séparé dans `SideNav`
  (12 §7).

### Le défaut à corriger en même temps, trouvé par 15

**`lienDash` jette tout paramètre absent de `DashParams`.** — *Affirmation
fausse, corrigée le 2026-09-11 : elle n'avait pas été testée.* La boucle
parcourt l'objet reçu, et Next y met tous les paramètres de l'URL ; rien n'est
perdu. Reste à écrire la limite du TYPE dans l'en-tête, pour qu'aucun lecteur
ne la redéduise de la signature.

### Ce qu'il faut vérifier, et que les contrôles habituels ne voient pas

Les pages canal sont en `force-dynamic` : **ni `tsc` ni `npm run build` ne les
exécutent**. Une référence client lue côté serveur (`CLAUDE.md` §8) n'y lève
qu'à la première vraie requête. Le contrôle de `CLAUDE.md` §9 est donc
insuffisant ici — il faut ouvrir chaque page.

### Consigne de repli

Livrer le bandeau posé et juste sur `/meta` et `/google` plutôt que six pages à
moitié branchées.

## Answer

**Le bandeau est posé sur cinq pages, le prototype est retiré, et deux pages
sont laissées dehors — avec leur raison.**

### Ce qui existe maintenant

- `lib/commandes.ts` — le vocabulaire : ce que le bandeau porte (`Commandes`),
  les présélections, le nom d'une période, et `themesChoisis` qui lit `l`
  (répété) puis retombe sur l'ancien `label`. **Sans directive**, parce que les
  pages serveur le lisent (la leçon de 15, `CLAUDE.md` §8).
- `components/bandeau-commandes.tsx` — la forme B, réécrite pour de bon.

### Où il est posé, et ce qu'il porte

| Page | Ce qu'il porte |
|---|---|
| `/meta`, `/google` | période · thèmes · statut · campagne |
| `/instagram` | période · thèmes |
| `/labels`, `/conversions` | thèmes seuls |
| `/`, `/comptes`, `/equipe` | rien — inchangées |

### Ce qui a disparu avec lui

`PeriodPills` (`channel-dash.tsx`), `PeriodPillsInsta` (écrite à l'identique
dans `app/instagram/page.tsx` — la copie que 12 avait mesurée), `filter-bar.tsx`
en entier, et les trois appels à `DateRange` pour la période affichée. `DateRange`
reste : le module de comparaison s'en sert avec ses propres paramètres.
`ChannelDash.filters` perd `label` — le thème vit dans l'URL et se lit avec
`themesChoisis`, l'avoir aussi dans le dashboard en aurait fait une seconde
source. Le prototype de 15 (variantes A et C, `proto-bandeau-*`) est supprimé.

### Instagram : le vrai travail du ticket

`getInstaDash` n'acceptait aucun thème. Il en accepte maintenant plusieurs, et
deux choses ont été tranchées en le faisant :

- **La fenêtre se calcule sur les posts NON filtrés.** Sinon « 30 j »
  désignerait trente jours différents selon le thème coché — l'ancre est la date
  du dernier post du compte, pas celle du dernier post du thème.
- **Le filtre s'applique à tout l'historique, pas seulement à la fenêtre.**
  Formats, créneaux et top 3 retombent sur l'historique quand la période est
  vide (`scope`) ; les laisser non filtrés aurait fait cohabiter deux
  périmètres dans une même page sans le dire.
- **Un post porte plusieurs thèmes** (`instagram_organic_posts.labels`), là où
  une campagne n'en porte qu'un : il suffit qu'un seul corresponde.
- **Les trois tuiles « Ta page » restent celles du compte** — un abonné ne
  s'attache à aucun thème, il n'y a rien à filtrer. Dès qu'un thème est posé, la
  page l'écrit au lieu de laisser lire ces chiffres comme ceux du thème
  (`CLAUDE.md` §7).

### Ce qui est laissé dehors, et pourquoi

- **`/couts`** — sa période n'est pas celle des autres pages : ses
  présélections sont `30 / 90 / ce mois / cette année`, et tout l'écran est bâti
  sur l'ANNÉE comme horizon qui se pilote (`elapsedAn`, `budgetJour`,
  `parMois` — voir l'en-tête de `lib/couts.ts`). Le ticket 12 a unifié le NOM du
  paramètre (`d`), jamais ses VALEURS. Lui imposer `7/14/30/90/Tout` casserait
  la prémisse de la page ; lui laisser ses propres présélections ferait deux
  bandeaux qui se ressemblent et ne disent pas la même chose. C'est une décision
  produit, pas une mécanique → ticket [28](28-la-periode-de-couts.md).
- **Les deux surtitres en capitales** de `/labels` (« Une liste, trois
  canaux ») et `/conversions` (« Ce que Google Analytics compte pour toi ») sont
  partis avec le titre que le bandeau absorbe. Le paragraphe qui suit dit déjà
  la même chose, mieux. À dire si tu les veux de retour.
- **`/labels` porte encore un prototype** (`proto-parcours-themes.tsx` +
  `PrototypeSwitcher`, `?variant=A|B|C`) issu de la carte `.scratch/themes-benefice/`
  que tu as supprimée le 2026-09-08. Son ticket n'existe plus, ses fichiers ne
  sont pas commités — **je n'y touche pas** : les supprimer serait irréversible.
  → ticket [29](29-le-prototype-orphelin-de-labels.md).

### Vérifié

`npx tsc --noEmit` vert, `npm run build` vert, **19 routes**. Les pages étant en
`force-dynamic`, le build ne les exécute pas : une page de contrôle temporaire a
rejoué les deux gestes serveur (`themesChoisis`, `PRESETS.find`) et les trois
formes du bandeau — trois réponses en 200, aucune référence client lue côté
serveur, et l'aller-retour complet vérifié (cocher un thème écrit
`?l=a&l=b&l=c`, le serveur le relit, les jetons suivent). Page supprimée,
`git grep controle-` ne rend que la règle de `CLAUDE.md`.

**Ce qui n'a PAS pu être vérifié ici :** les cinq vraies pages sont derrière le
middleware et je n'ai pas de session. `/meta`, `/google`, `/instagram`,
`/labels` et `/conversions` doivent être ouvertes une fois — c'est le seul
contrôle qui couvre une page `force-dynamic`.
