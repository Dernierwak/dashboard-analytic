# Spec — La page hebdomadaire (`/`)

Destination de la [carte hebdo](map.md), écrite le 2026-11-01 par
[La spec de la page hebdo](issues/15-la-spec-de-la-page-hebdo.md). Elle se
remet à la construction telle quelle : **plus rien n'y est à décider**. Ce
qu'elle ne fait que résumer vit dans son ticket, qui fait foi ; elle ne
recopie pas les raisons.

La page dit **ce qui a bougé cette semaine**, plateforme par plateforme,
sans rien conseiller (`CLAUDE.md` §1). Elle est **statique** : la
comparaison se lit sans régler de filtre ; défiler, zoomer, choisir une
semaine dans la frise, c'est permis ([La structure de la page](issues/01-la-structure-de-la-page.md)).

La maquette validée est dans l'historique :
`git show f83ca2f:.scratch/hebdo/prototype-08/index.html` (variante E ;
lancer avec `?variant=E`, les données se recréent avec `extraire.py` du même
commit). Ne pas reprendre son test « a répondu » ni ses couleurs.

---

## 1 · Les règles qui valent partout

- **Une absence s'écrit « — », jamais 0.** Un 0 ne s'écrit que si la source
  a répondu pour toute la semaine (`CLAUDE.md` §7).
- **La semaine** : 7 jours pleins qui finissent la veille du dernier Jour de
  travail, la même quel que soit le jour où le rapport est recalculé
  ([Le module des canaux](issues/02-les-metriques-de-la-semaine-face-a-la-precedente.md), point 6).
  Le jour en cours n'entre jamais.
- **Chaque plateforme se lit avec ses propres chiffres** ; seuls dépense et
  impressions s'additionnent entre canaux, dans le bandeau.
- **Une source pas branchée n'apparaît nulle part** (ni bandeau, ni rail,
  ni onglet).
- **Le client ne voit qu'une erreur : son jeton a expiré.** Toute autre
  panne est la nôtre ([Les états de la page](issues/13-les-etats-de-la-page.md)).
- **Style** : celui de l'hebdo actuel — jetons Tailwind (`border-line`,
  `rounded-xl`, `shadow-card`, `bg-brand`), mini-modules, icônes de
  plateforme (`PLATEFORME`, `components/frise-semaine.tsx:78`). Si cette
  table sert à plusieurs composants, elle part dans un module **sans**
  `"use client"` (`CLAUDE.md` §8).

## 2 · La page, de haut en bas

Forme validée par [La page entière, en maquette](issues/08-la-page-entiere-en-maquette.md),
section « Answer » : c'est le détail de référence pour chaque bloc.

| # | Bloc | Ce qu'il montre | Ticket qui fait foi |
|---|---|---|---|
| 0 | Fil de mise en place | En tête tant qu'il n'est pas fini (`SetupWizard`, inchangé). | 01, 13 (point 12) |
| 1 | **Titre** | « Semaine du 21 au 27 octobre », et la mention que le jour en cours n'est jamais compté. Dessous, en ligne discrète, la date de publication et celle du prochain passage, telles que `TroisDates` les écrit aujourd'hui (la carte ne les a pas retirées ; « mesuré du … au … » devient le titre). | 08, 01 |
| 2 | **Bandeau des totaux** | **Deux colonnes**, dépense et impressions, séparées par un filet : le grand chiffre, puis chaque canal en petit avec sa pastille. Ni barre, ni anneau, ni colonne portée. | 08, [16](issues/16-ce-que-montre-la-case-instagram-du-bandeau.md) |
| 3 | **Module des canaux**, en rail | Une carte par canal à 90 % de la largeur, la suivante dépasse ; ‹ › ou glisser. **Meta seul** aujourd'hui. Gauche : volumes (dépense, impressions, clics) sans comparaison, puis CTR, CPC, CPM avec état et moustache. Droite : les changements du canal, par catégorie, en liste qui défile à la hauteur de la carte (`components/scroll-list.tsx`), lien « journal → » sur la même semaine. Le nom du canal mène à sa page. | 08, [02](issues/02-les-metriques-de-la-semaine-face-a-la-precedente.md), [03](issues/03-ce-que-veut-dire-la-moyenne-du-compte.md), [05](issues/05-les-changements-de-la-semaine.md) (contenu) |
| 4 | **« Ce qui a été fait »** | À gauche la frise de l'année (rythme des posts en points sous les mois, campagnes groupées par plateforme en barres, zoom Année · Mois, Mois à l'ouverture) ; elle choisit la semaine (clic, ‹ ›, « revenir à la semaine mesurée »). À droite, collant, le panneau de la semaine choisie, en onglets Organique (Instagram…) · Campagnes (Meta, Google Ads). | 08, [04](issues/04-la-vue-des-campagnes-et-des-posts.md), [17](issues/17-le-statut-d-une-campagne-google-supprimee.md) |

**La moustache** (ticket 08, point 3) : de la moins bonne à la meilleure des
12 semaines, les semaines en points, la boîte = « tes habitudes » (q1 → q3),
la semaine type (médiane) nommée au-dessus, la semaine regardée en gros
point coloré selon son état. **Le mieux toujours à droite** : l'axe s'inverse
pour CPC et CPM. Couleurs en tons légers — vert doux mieux, rouge doux moins
bien, gris dans la bande (ticket 03, point 7). La carte dit sur combien de
semaines porte la comparaison.

**Une campagne dans la frise** : une barre par campagne, identifiée par ID
sous son nom actuel, sans pause dessinée ; trait plein jusqu'à la fin
déclarée, ou jusqu'à la fin de la semaine du rapport puis **pointillés
jusqu'au 31 décembre** si elle n'a pas de fin ; une supprimée finit à sa
suppression, sinon à son dernier jour de dépense (ticket 17). Premier visuel
en tête s'il existe — 3 campagnes Meta sur 10 en ont un, Google aucun.
**Filtre léger** par statut : terminée, supprimée, problème signalé par
Meta, en cours, en pause, prévue, statut inconnu ; tout visible par défaut.

**Le panneau** : posts en grille de deux colonnes (visuel 4:5, format,
jour, lien vers le post, **aucun chiffre**) ; campagnes en cartes (visuel ou
« pas de visuel », nom, dates, « lancée / terminée cette semaine », dépense
de la semaine au survol).

## 3 · Les états

Tranchés par [Les états de la page](issues/13-les-etats-de-la-page.md) ; le
numéro renvoie à son point.

| Cas | Bandeau | Carte du canal | Panneau |
|---|---|---|---|
| Jeton mort (3) | Total des sources qui ont répondu + note nommant l'absente (2) | Alerte + lien vers **Connexions** (son bouton « Reconnecter » relance la récolte) | inchangé |
| Panne interne, semaine partielle comprise (4, 5, 7) | idem | « — » partout, sans moustache, une phrase sans bouton : « Une erreur est survenue pendant la récolte de Meta. Nous la relançons dès que possible. » | onglet : « … en cours de récupération » |
| Historique < 6 semaines (6) | — | Valeur sans état ni couleur ; à la place de la moustache : « Semaine type dès 6 semaines d'historique — encore N » | — |
| Journal non couvert (8) | — | « Changements en cours de récupération », sans compte. Le vrai 0 : « Meta n'a écrit aucun changement cette semaine » | — |
| Semaine vide (9) | — | — | Onglet gardé, compte 0 : « Aucun post publié / aucune campagne active cette semaine » ; ou « … en cours de récupération » ; ou « Meta n'était pas encore connecté » avant `connecte_le` |
| `WITH_ISSUES` (10) | — | — | « problème signalé par Meta » |
| Changement hors campagne (11) | — | « Compte publicitaire » au niveau du compte, sinon le nom de l'objet ; jamais « Hors campagne » | — |
| Compte neuf (12) | rien | rien | rien : une seule carte « Ton premier rapport arrive le <date>. Il portera sur la semaine du <début> au <fin>. » |

Le bandeau rouge « n'a pas répondu » (`CanalMuetAlerte`) ne revient pas, ni
aucun bouton « relancer ».

## 4 · Ce que le traitement calcule

**La table clé → source → calcul → fenêtre est celle de
[Ce que le traitement doit calculer](issues/14-ce-que-le-traitement-doit-calculer.md)**,
§1 à §6, avec ces trois mises à jour :

1. **Pas de `totaux.portee`** (ticket 16) — déjà retiré de la table.
2. **`.statut`** gagne `supprimee`, testé **en premier** : `REMOVED` →
   `supprimee` ; puis fin déclarée passée → `terminee` ; puis `WITH_ISSUES`
   → `probleme` ; `ACTIVE`/`ENABLED` → `en_cours` ; `PAUSED` → `en_pause` ;
   début déclaré futur → `prevue` ; non récolté → absent (filtré « statut
   inconnu »).
3. **La méthode de quartile, tranchée ici** (14, §8) : celle du prototype
   que David a validé, `statistics.quantiles(valeurs, n=4,
   method="exclusive")`. Formule, pour qu'une autre implémentation la
   reproduise : valeurs triées x₁…xₙ, position p = k·(n+1)/4 pour k = 1, 2,
   3, interpolation linéaire entre x⌊p⌋ et x⌊p⌋₊₁. **Ce n'est pas
   `percentile_cont` de Postgres** (méthode inclusive). Avec 6 semaines
   [1…6] : q1 = 1,75, q3 = 5,25 (l'inclusive donnerait 2,25 et 4,75). La
   bande plus large convient à 6–12 points : elle ne déclare pas « hors
   habitudes » ce qui reste dans le bruit d'un historique court. La médiane
   est la même dans les deux méthodes.

Et ce qui la précise pour la frise :

4. **La date de suppression d'une campagne Google** (ticket 17, « Pour la
   spec ») se lit dans un **champ structuré**, jamais dans la phrase
   `resume` : la récolte du journal Google écrit dans
   `platform_changes.extra_data` l'ancien et le nouveau statut d'un
   changement de statut de campagne (`{"statut": {"avant": "ENABLED",
   "apres": "REMOVED"}}`, lus dans `old_resource` / `new_resource` que
   `fetchers/changes.py` lit déjà). La colonne existe (NULL pour Google
   aujourd'hui) : **aucune migration**. Le builder prend le plus récent
   `occurred_at` où `apres = REMOVED` ; sinon le dernier jour de dépense ;
   sinon un repère à la date de début. Aujourd'hui, aucune supprimée
   n'entre en 2026 : le repli suffit au lancement.

**Le `Lecteur` gagne** une méthode qui rend le Jour de travail
(`profiles.fetch_schedule`), une qui rend l'état de connexion
(`a_reconnecter_depuis`, `created_at`), une qui rend la couverture par flux,
et la lecture de `platform_changes` restreinte à la semaine. Les lectures
qui ne servaient qu'aux clés sortantes partent (14, §1).

## 5 · Ce que la récolte doit fournir d'abord

Repris de 14, §7, plus le point 4 ci-dessus. Sans eux, la page ment ou se
tait :

1. **Brancher `verifier()`** du jeton Meta et Google dans le plan de récolte :
   jeton mort → `a_reconnecter_depuis = coalesce(a_reconnecter_depuis,
   now())` et la raison, canal sauté ; jeton inconnu → rien.
2. **Un signal de couverture par source et par flux** (insights, journal,
   posts) : « récolté sans trou jusqu'au <date> », écrit seulement quand le
   flux a rendu sans tranche refusée, qui survit aux passages suivants. Une
   petite table créée par ajout seul (`CREATE TABLE IF NOT EXISTS`, aucun
   `DROP`) ; ses colonnes se fixent à la construction.
3. **`permalink` et `media_product_type`** des posts Instagram (deux colonnes
   ajoutées, même permission).
4. **`extra_data` du journal Google** pour les changements de statut de
   campagne (§4, point 4).

## 6 · Ce qui part du code de la page

`saas/web/app/page.tsx` perd `Verdict`, `KpiFocusCard`, `CanalMuetAlerte`,
le bloc `Changements`, l'ancienne `FriseSemaine`, `TroisDates` sous sa forme
actuelle (réabsorbée dans le titre), la lecture `getChangementsApi` (les
changements arrivent par le payload) et `TrouDeRecolte` sur cette page.
**Composants à supprimer** — ils ne servent qu'à l'hebdo (vérifié par
`grep` le 2026-11-01) : `kpi-focus.tsx`, `canal-muet.tsx`, `changements.tsx`,
`frise-semaine.tsx` (après en avoir sorti `PLATEFORME`), `trois-dates.tsx`.
**À garder** : `trou-recolte.tsx` et `pente.tsx` (servent ailleurs),
`setup-wizard.tsx`, `scroll-list.tsx`, et `lib/changements-api.ts`
(`lib/meta/lecture.ts` et `lib/fuseau.ts` le lisent aussi).

Côté traitement, les clés sortantes et leurs lectures : 14, §1.

## 7 · L'ordre de construction et comment le vérifier

1. **La récolte** (§5). Se vérifie par `python3.12 -m py_compile`, puis
   **après un passage du worker** : un lancement à la main depuis GitHub
   Actions (`weekly-fetch.yml`, avec `force`) remplit la couverture, les
   colonnes des posts et `extra_data`.
2. **Le traitement** (§4), avec son harnais hors ligne : partir de
   `.scratch/hebdo/harnais/14-ce-que-le-traitement-doit-calculer/test_payload.py`,
   (vert le 2026-11-01). Ses constats d'écart doivent **s'inverser** — les
   clés sortantes absentes, la semaine du samedi qui ne glisse plus, deux
   homonymes en deux barres et une renommée en une, ID et statut sur chaque
   campagne, visuel et lien sur chaque post, une seule année ; celui du
   jeudi reste vrai. Y ajouter les états de §3.
   Visible sur la page **après un passage du worker** : `report_only`
   suffit si la récolte est déjà passée.
3. **La page** (§2, §3, §6). `rm -rf .next tsconfig.tsbuildinfo`,
   `npx tsc --noEmit`, `npm run build` : le nombre de routes ne change pas
   (aucune route ajoutée ni retirée par ce chantier). Les états se
   contrôlent sur un payload construit par le harnais, pas en cliquant.

## 8 · Hors de cette spec

- **Google Ads et Instagram au module des canaux** : quand leurs pages
  seront finies ; Google reprendra les clés de Meta, Instagram rejugera vues
  et interactions (tickets 02, 16).
- **La page plateforme ouverte sur la semaine** : « journal → » ouvre le
  journal sur la semaine (ticket 08) ; le nom du canal mène simplement à sa
  page. Qu'elle s'ouvre elle aussi sur la semaine est l'affaire du chantier
  des pages plateformes.
- **Les campagnes Meta supprimées ou archivées** : la récolte ne les
  rapporte probablement pas (non vérifié) ; la frise montre ce que la
  récolte donne, avec les mêmes règles de statut. Une question de récolte,
  à ouvrir à part.
- Le reste : section « Out of scope » de la [carte](map.md).
