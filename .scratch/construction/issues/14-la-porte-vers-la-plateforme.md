# La porte vers la plateforme : le thème ET la fenêtre

Type: task
Status: resolved

## Question

**Tranché par [09](../../refonte/issues/09-la-porte-vers-la-plateforme.md).**
Le rapport ne renvoie **jamais** vers `/meta`, `/google`, `/instagram` — ses seuls
liens sortants vont vers `/labels` (mesuré en 06). C'est un cul-de-sac du fil,
et c'est le profil n°2 de 04 qui le paie : *celui qui se sert de l'hebdo comme
travail prémâché puis va creuser seul.*

### Pourquoi ce ticket est presque gratuit

**Rien à construire côté données.** `ThemeCampaign` porte **déjà** `channel` et la
clé de chaque campagne, et `label` est **déjà** un paramètre reconnu des pages
canal — **`/meta?label=…` marche aujourd'hui.**

### Les décisions

- **La porte part de la carte du thème, et d'elle seule** (David) : un chiffre du
  point général ne désigne aucune plateforme, le lien serait vague.
- **Le lien emporte le thème ET la fenêtre du rapport.** Sinon « 4 520 CHF »
  devient « 103 CHF » au clic, **et ça se lit comme un bug**.
- **On ne ramène rien** — écrire depuis une page canal appartient au carnet
  (ticket **12**) — **mais la page dit d'où on vient et propose d'y retourner**.
- **`/instagram` devient filtrable par thème** : `ByLabelInsta` existe déjà, **il
  manque le paramètre**. Sans ça, le rang 3 de
  [07](../../refonte/issues/07-gabarit-de-plateforme.md) ne tient pas — c'est le
  seul rang qui parle la même langue sur les trois pages, donc le seul qui empêche
  `/meta`, `/google` et `/instagram` d'être trois produits séparés.

### Les deux pièges, tous deux déjà écrits

- **Un lien énumère ce qu'il CHANGE, jamais ce qu'il garde** (§8) — sinon il perd
  par construction tout paramètre ajouté après lui, **en produisant une URL
  valide**. C'est l'en-tête de `lib/liens.ts`, et `lienDash` est là pour ça.
- **Le piège des pastilles inertes est déjà couvert** par `exclusifs()` dans
  `lib/liens.ts`. Ne pas le réécrire.

### Ce qui n'est PAS dans ce ticket

Le module de commandes unique — [12](../../refonte/issues/12-module-de-commandes.md)
et [15](../../refonte/issues/15-le-bandeau-en-variantes.md), **brique 4, hors
périmètre de cette carte**. Ici on ouvre une porte avec `?label=` et la fenêtre,
rien de plus. Le vocabulaire d'URL `d` / `l` appartient au bandeau, pas ici.

### Consigne de repli

Le paramètre de thème sur `/instagram` d'abord si la porte prend du temps : c'est
lui qui manque en base de code, le reste marche déjà.

## Answer

### Ce qui a été construit

**La porte** — `components/porte-canal.tsx`, posée en pied de la carte de thème,
juste au-dessus de « Ses campagnes ». Elle n'ouvre que vers les plateformes où le
thème a vraiment quelque chose : une régie n'apparaît que s'il y porte au moins
une campagne (`theme.campaigns`, qui porte déjà `channel`), Instagram que s'il a
au moins une publication (`summary.posts`).

**Elle n'affiche aucun chiffre**, et c'est une correction en cours de route : le
premier jet écrivait « ▣ Meta · 3 campagnes ». `theme.campaigns` est **plafonné à
huit** par le worker (`t_camps[:8]`), donc ce compte vaut « trois ou plus » sans
le dire dès qu'un thème dépasse le plafond — un chiffre qu'on ne peut pas tenir
(§7). Le compte exact existe (`summary.n_campaigns`) et s'affiche déjà trente
pixels plus bas. La porte dit OÙ le thème tourne, pas combien il y porte.

**Le lien** — `porteVersCanal` dans `lib/liens.ts`, bâti sur `lienDash`, donc les
deux pièges restent couverts sans être réécrits : `exclusifs()` fait que poser
une plage efface la présélection, et on énumère ce qu'on CHANGE.

**Le retour** — `components/retour-rapport.tsx`, rendu par `/meta`, `/google` et
`/instagram` sous le bandeau. Il ne s'affiche que si on vient vraiment du
rapport, et il **survit à l'exploration** : vérifié en exécutant `lienDash`, un
clic sur « 30 j » depuis une page ouverte par la porte donne
`/meta?l=X&de=X&d=30` — la fenêtre libre tombe (c'est le but), le fil d'Ariane
reste.

### Trois écarts avec le ticket, tous assumés

- **`l` et non `label`.** Le ticket décrivait l'état du code au moment où il a été
  écrit. Depuis, le bandeau de commandes a tranché un nom unique — `l`, répété —
  et `label` est devenu un ancien nom qu'on lit encore mais **qu'on n'écrit plus
  jamais** (`lib/commandes.ts`, §5 du ticket 12 de la refonte). Écrire `label`
  ici aurait fait de la porte le seul producteur d'un paramètre qu'on éteint.
- **`/instagram` était DÉJÀ filtrable par thème.** La consigne de repli est sans
  objet : `lib/channels.ts` l. 1036-1038 filtre les posts sur `themesChoisis`, et
  la page passe déjà ses thèmes au bandeau. C'est le bandeau qui l'a apporté.
- **La fenêtre emportée est `matrice.period`, pas `since`/`until`.** `since` et
  `until` du payload sont ceux de la SEMAINE ; les chiffres du bilan d'une carte
  (« 4 520 CHF dépensé ») viennent tous de `matrix_themes_by`, donc de
  `matrice.period`. Emporter la semaine aurait reproduit exactement l'écart que
  le ticket interdit. Le champ était publié depuis toujours (`insights.py`) mais
  n'était pas déclaré côté TypeScript ; il l'est maintenant.

**Pas de fenêtre, pas de porte.** Sur un payload v1 sans `matrice.period`, la
porte ne s'affiche pas du tout, plutôt que de s'ouvrir sur une autre période que
celle qu'on vient de lire.

### Un défaut trouvé en chemin, corrigé ici

`de` est typé `string`, mais Next rend un **tableau** dès qu'un paramètre est
répété : `?de=a&de=b` s'écrit à la main, et `.trim()` sur un tableau aurait fait
tomber la page entière pour un fil d'Ariane. `RetourRapport` prend le premier,
comme `themesChoisis`.

### Vérifié / pas vérifié

- `rm -rf .next tsconfig.tsbuildinfo`, puis `npx tsc --noEmit` **vert** et
  `npm run build` **vert, 19 routes**.
- `porteVersCanal` et `ancreTheme` **exécutés** (module compilé à part, lancé
  sous node) : la porte produit
  `/meta?l=Formation+continue&from=2026-01-01&to=2026-09-12&de=Formation+continue`,
  l'ancre `theme-cafe-the-eclairs` pour « Café, thé & Éclairs ».
- **Pas vérifié à l'écran sur de vraies données** : ces pages sont derrière le
  middleware et demandent une session Supabase. La forme de la porte et du
  bandeau de retour n'a été jugée par personne.
- Rien ici ne touche au traitement ni à la récolte : **aucun « ↻ Recharger mes
  conseils » n'est nécessaire** pour voir la porte — mais elle n'apparaît que sur
  un rapport dont le payload porte `matrice.period`.

### Ce qui reste ouvert, et qui n'est pas de ce ticket

**Le plafond de huit est un défaut à lui seul** → ticket
[34](34-ses-campagnes-plafonnees-a-huit.md). La carte écrit aujourd'hui « Ses
campagnes (8) » sur un thème qui en porte douze, en lisant la liste plafonnée au
lieu de `n_campaigns`, qui est juste à côté. Et le plafond mord aussi sur la
porte : les huit gardées sont les huit plus grosses dépenses, donc une régie où
le thème dépense peu peut ne pas ouvrir de porte sur un thème qui porte plus de
huit campagnes. Rien dans le payload ne dit mieux.

**`HEAD` ne construit pas.** `app/meta`, `app/google` et `app/instagram` sont
commitées en important `@/components/bandeau-commandes` et `@/lib/commandes`, qui
ne sont **pas suivis par git** (de même que la suppression de `filter-bar.tsx` et
`filtre-couts.tsx`, jamais commitée). Le travail construit et vérifié ici l'a été
sur l'arbre de travail, qui est complet. À signaler à David : ces fichiers
doivent entrer dans un commit.
