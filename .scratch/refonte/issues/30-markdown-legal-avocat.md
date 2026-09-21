# La page légale rend six constructions ; l'avocat n'en connaît pas la liste

Type: task
Status: open

## Question

**Découvert en vérifiant [18](18-passer-en-production.md) le 2026-09-21, pas
demandé.** Rien à décider sur le fond : la page publie ce que le `.md` contient,
et il existe des `.md` valides qu'elle abîme en silence.

`saas/web/lib/legal.ts` `decouper()` (l. 99-168) reconnaît **six**
constructions : titres `#` à `###`, paragraphes, listes `-`/`*`, tableaux GFM,
traits, et le gras / italique / code / liens en ligne. Tout le reste retombe
dans le sac des paragraphes.

Le README de `saas/web/legal/` promet pourtant l'inverse à David, l. 73 :
*« Tu édites le `.md`, la page suit »* — et il l'invite explicitement à faire
relire les documents par un avocat.

### Ce que ça fait, mesuré

Sonde du 2026-09-21 sur `decouper()` compilé, entrée / sortie :

| Entrée | Sortie |
|---|---|
| `1.` `2.` `3.` sur trois lignes | **un seul paragraphe**, « 1. Write to us at … 2. We confirm … 3. We answer … » |
| `> This is the strongest action` | paragraphe, le `>` affiché tel quel |
| `#### 10.1 Scope` puis une ligne de texte | paragraphe, les `####` affichés **et le titre collé au texte qui suit** |

Les trois sont des constructions que porte n'importe quelles CGU relues par un
juriste — une clause numérotée, un avertissement en exergue, un sous-sous-titre.
Aucune ne lève d'erreur, aucune n'échoue au build : **la page répond 200 et
publie du markdown en clair sur l'URL donnée au reviewer Google.**

Ce n'est pas théorique aujourd'hui seulement parce que les trois `.md` servis
n'emploient, vérifié le 2026-09-21, aucune de ces constructions. Cet équilibre
tient jusqu'à la première relecture d'avocat, c'est-à-dire jusqu'à l'étape que
le README réclame.

### Les deux réponses possibles, et pourquoi la seconde

**Bloquer** — traiter une construction inconnue comme la garde traite un
`<PLACEHOLDER>` : la page refuse de servir. C'est cohérent avec 18, c'est trois
lignes, et c'est **trop brutal ici** : le jour où un avocat ajoute une clause
numérotée, la politique s'éteint sur une URL qu'un reviewer tient déjà. Éteindre
est pire que rendre.

**Rendre** — ajouter au découpage les listes ordonnées, les citations et les
titres de niveau 4. Le composant `document-legal.tsx` gagne trois cas de rendu,
son commentaire l. 5 passe de « six » à ce qu'il rend vraiment. C'est la voie à
suivre.

Une garde reste utile **en complément** et sans éteindre la page : ce qui n'est
toujours pas reconnu se signale dans les journaux du serveur, comme le fait déjà
`DocumentNonPublie`.

### Ce que ça ne doit pas devenir

**Pas une bibliothèque markdown.** Le choix de lire le `.md` plutôt que de le
recopier est bon et se garde ; y brancher `remark` pour trois constructions
apporterait un arbre de dépendances et une surface d'injection HTML sur les
seules pages du produit qui répondent **sans session**. Le découpage maison rend
du JSX typé, jamais du HTML brut — c'est une propriété, pas un accident.

### Condition d'entrée

Aucune. Indépendant de la création de l'entreprise et du palier Gemini ; se
traite avant ou après que David remplisse les placeholders. **À traiter avant la
relecture d'avocat**, pas avant le dépôt.

### Consigne de repli

Si la session est coupée : rendre les listes ordonnées seules, et laisser les
citations et `####` — c'est le cas le plus probable et le plus abîmé (trois
clauses fondues en une phrase). Ne pas laisser le composant à moitié câblé.


## La liste complète, après revue de code — 2026-09-21

La revue du diff de [18](18-passer-en-production.md) a trouvé **cinq cas de plus
du même défaut**, et un qui n'en relève pas. Chacun a été confronté aux trois
`.md` réellement servis : **aucun n'est déclenché aujourd'hui**, ce qui explique
que les pages rendent juste (vérifié le même jour, 0 fragment manquant sur 3
pages). Tous le seront par une édition banale.

| # | Ce qui casse | Déclenché aujourd'hui ? |
|---|---|---|
| a | **Une puce qui passe à la ligne.** `decouper()` l. 152 n'accepte `- ` qu'en colonne 0 : la suite de la puce ferme la liste et devient un paragraphe détaché — une clause coupée en plein milieu. | **Non** — 0 continuation dans les trois documents. Mais le dépôt entier est composé à 80 colonnes. |
| b | **Un commentaire HTML entre deux puces.** Il est retiré avant le découpage, laisse une ligne vide, et scinde la liste en deux `<ul>`. | **Non pour ce qui sera publié.** Observé dans mon rendu de test sur les trois puces Gemini de `PRIVACY_POLICY.md` §3.1 (`<ul>` de 1 puis `<ul>` de 2) — mais ce commentaire-là est un marqueur `À VÉRIFIER`, donc il bloque la page tant qu'il existe et disparaît quand [26](26-gemini-palier-payant.md) le lève. Les deux commentaires NON bloquants du dépôt ne sont pas entre des puces. |
| c | **Un `\|` échappé dans un tableau.** `decouperRangee` l. 170 découpe sur tous les `\|` : la rangée gagne une cellule, se désaligne de l'en-tête, et le `\` s'affiche. | **Non** — aucun tableau servi n'en contient. |
| d | **Un lien interne `#ancre` ou relatif.** `document-legal.tsx` l. 32 ne tient pour interne que `href.startsWith("/")` : un renvoi `[§6](#retention)`, la façon naturelle dont un juriste croise ses articles, part en `target="_blank"` au lieu de faire défiler la page. | **Non** — les liens servis sont tous des chemins de site ou des URL absolues. |
| e | **Le filet à placeholders attrape trop large.** `PLACEHOLDER` l. 67 (`<[A-Z][A-Z0-9_]*…>`) prend aussi `<ANNEX I>`, `<BR>` ou une adresse en chevrons, y compris dans un bloc de code. | **Non.** Mais son échec va dans le mauvais sens : une page vivante s'éteint après une édition, avec la raison seulement dans les journaux. C'est précisément ce que ce ticket refuse plus haut. |

**Ce qui ne relève pas de ce ticket et a été corrigé dans 18 le même jour :** la
lecture du `.md` n'était pas gardée — un fichier absent du bundle serverless
remontait hors du composant serveur, et sans `error.tsx` la page servait le 500
par défaut de Next sur l'URL déposée chez Google. `chargerDocumentLegal` rend
maintenant le message « pas encore publié », vérifié en retirant le fichier
serveur tournant : **200**, raison dans les journaux. Ça appartenait à 18, pas
ici : la garde est la promesse même de 18, pas une construction markdown.

**Reste sans suite, noté sans être corrigé :** `DocumentNonPublie`
(`document-legal.tsx` l. 150) appelle `console.warn` dans le corps du composant.
C'est un effet de bord dans un rendu, et il part à chaque requête non
authentifiée. Le volume est voulu — la raison DOIT aller aux journaux et pas à
l'écran — donc le déplacer ne gagnerait que la pureté. À faire en passant, pas
pour lui-même.

### Ce que ça change pour la suite de ce ticket

Le §« les deux réponses possibles » tient, et la liste à rendre s'allonge : aux
listes ordonnées, citations et `####` s'ajoutent **la continuation de puce (a)**
— le cas le plus probable de tous, puisque c'est la mise en page par défaut du
dépôt — et **le lien `#ancre` (d)**, deux lignes dans `document-legal.tsx`.
Les cas (c) et (e) sont à juger à ce moment-là, pas avant.
