# Le parcours : comment les pages travaillent ensemble

Type: grilling
Status: resolved

## Question

Gradué de la brume par [03](03-le-but-de-pulse.md). Trois zones de brume
distinctes — « comment on structure les dashboards », « comment le classement
s'imbrique dans le workflow », « comment le rapport hebdo doit être présenté » —
se sont révélées être **une seule question**, et c'est David qui l'a nommée :

> *« Je veux qu'on sache comment on structure les dashboards, comment on
> travaille sur ce workflow de l'onboarding, le hebdomadaire, les recos thèmes
> sélectionnés, et le résumé de la semaine. **Tout cela avec une idée de comment
> tout parle entre eux.** »*

### Le constat qui rend la question urgente

**8 des 9 étapes du parcours existent déjà.** `SetupWizard` (245 l.) mène du
profil à la première étoile en 3 étapes, état déduit des données, quittable et
reprenable — et affiche la récompense du classement à l'endroit même où il
demande l'effort.

**Puis il lâche l'utilisateur.** Au-delà de l'étape 3 : 29 blocs sur une page,
trois dashboards à côté, un carnet où l'on écrit sans pouvoir relire. Le
workflow n'a jamais été perdu — **il n'a jamais existé au-delà de l'onboarding.**

C'est la cause directe du *« on crée des modules sur des modules et on perd ce
workflow »* de David. Le rapport publie 29 blocs ; le parcours qu'il décrit en
a 6 étapes.

### Ce que ce ticket doit produire

Le **fil de la semaine** : par où on entre, dans quel ordre, et par où on sort
vers autre chose. Pour chaque module, la grammaire que David a lui-même posée —
**on le voit où · comment il parle aux autres · comment on l'enregistre.**

Les modules à déplier, dans ses mots :

1. **Le carnet** — on les voit où, ces notes ? Qu'est-ce qui change dans le
   reste quand on en écrit une ? Est-ce qu'une note nourrit les recos de la
   semaine d'après, ou reste-t-elle la mémoire du client ?
2. **Le hebdo** — le point général, c'est un verdict, des chiffres, les deux ?
   Qu'est-ce qui est visible avant le premier défilement ? Par où on en sort ?
3. **Les recos** — fabriquées à partir de quoi maintenant (le profil, les
   chiffres, les notes) ? Combien par semaine ? Elles vivent sur le hebdo, sur
   la carte du thème, ou aux deux ?
4. **Les dashboards plateforme** — le client y arrive quand, pour répondre à
   quelle question, et il ramène quoi où ?
5. **Le thème** — le parcours de la semaine se fait-il *par thème*, ou le thème
   est-il un filtre ?

### Une ambiguïté de vocabulaire à trancher au passage

`suivi_actions` porte **deux choses différentes sous le même toit** :
`saveNote(texte, theme, jour)` y écrit une note en texte libre (un fait passé),
et `startTracking(...)` y écrit une action suivie (une hypothèse avec sa
`baseline`, sa métrique et son verdict à échéance). `saveComment` en écrit une
troisième ailleurs (`reco_feedback`). Dans la conversation, David a employé
« commentaire », « note », « tâche », « action » et « historique » pour parler
de tout ça.

`CONTEXT.md` ne nomme aujourd'hui aucun de ces objets. Les trancher fait partie
de ce ticket — appeler `domain-modeling` et écrire le résultat dans
`CONTEXT.md`.

### Ce qui est DÉJÀ acquis et ne se rediscute pas

De [03](03-le-but-de-pulse.md) :

- Le compte appartient à **l'entreprise**, plusieurs personnes autour.
- Le point se fait **le jour que le client choisit** — déjà construit
  (`profiles.fetch_schedule`).
- **Le carnet ET les recos sont tous les deux le produit.** David a refusé
  explicitement de choisir entre les deux.
- Le carnet est le **seul mécanisme de rétention** identifié : aucun des 10
  produits lus au [02](02-sur-quoi-se-differencient-les-autres.md) n'en a un.
- **Le carnet n'a pas de page de relecture** — c'est le trou mesuré le plus net.

### Consigne de conduite

Ticket **HITL**, et la leçon de 03 s'applique : **poser des questions qui
ouvrent, pas des questions qui élaguent.** David, mot pour mot : *« tu me poses
des questions pour faire des choses précises alors que le projet est encore
flou »*. On déplie un module à la fois, dans l'ordre qu'il choisit.

Skills : `ux` (une action de bout en bout), `vision-ux` (hiérarchie et
uniformisation), `hebdo` (structure du rapport), puis `grilling` +
`domain-modeling`.

### Consigne de repli

Si la session approche de sa limite, écrire le fil des modules déjà dépliés
plutôt que d'en entamer un de plus. Un parcours partiel et net vaut mieux que
cinq modules à moitié.

## Answer

**Ce ticket était mal calibré.** Il demandait de déplier cinq modules — donc cinq
décisions — en une session. Ce qu'il a réellement produit, c'est **la carte du
fil tel qu'il existe**, et cette carte montre que « comment les pages se
parlent » n'est pas une décision mais **quatre**. Elles sortent en tickets 08 à
11 ; ce ticket-ci est le relevé qui les rend formulables.

### 1 · La carte du fil réel (`app/page.tsx`)

Ordre à l'écran, et la question à laquelle chaque bloc répond :

| Où | Bloc | Question du lecteur |
|---|---|---|
| en-tête | `VersLaction` (l. 407) | « j'ai des trucs en cours ? » — pastille + ancre |
| en-tête | `Verdict` (411) | **« ma semaine a été bonne ? »** |
| | `ResumeSemaine` (418) | « pourquoi ? » — texte IA |
| **1 · Ta semaine, tous thèmes confondus** | `KpiFocusCard` (464) | « c'est grave ou c'est normal ? » — la zone |
| | `HorsTheme` (473) | « qu'est-ce qui échappe à mes thèmes ? » |
| | `ThemeDonut` (486) | « où part l'argent ? » |
| | `FriseSemaine` (493) | « qu'est-ce qui tournait ? » |
| | `AlerteThemes` (527) | « combien il m'en reste à classer ? » |
| **2 · Tes thèmes prioritaires** | `ThemeCard` (612) | « je fais quoi ? » **+ le rail : « ce que j'ai fait a donné quoi ? »** |
| bas de page | `SetupWizard` (641) | « par où je commence ? » |

Croisé avec le parcours décrit par David en [03](03-le-but-de-pulse.md) :
point général ✓ · les thèmes ✓ · « ce que j'ai fait a aidé » ✓ (par thème) ·
« je fais ça » ✓ · **analyser seul la plateforme ∅**.

### 2 · Une correction : le carnet SE RELIT déjà

L'`## Answer` de 03 dit que le carnet n'a « pas de page de relecture ». **C'est
trop fort.** Le bloc « Ton historique d'actions » a existé puis a été **fusionné
délibérément** dans la carte du thème (commit `685a3e9`, 615 lignes supprimées).
Sa raison est écrite : *« le conseil était dans la carte du thème, la case à
cocher dans "Ce que tu dois faire", le verdict dans "Ton historique d'actions"
[…] il fallait traverser 900 px pour relier un conseil à ce qu'il a donné »*.

Chaque carte de thème porte aujourd'hui, sur son tiers droit, **le rail des
actions** : cycle de vie complet et effet chiffré (« CTR 3,1 → 5,8 ▲ +87 % »).
La boucle existe et elle est bien faite. **Ne pas la défaire** — les trous sont
ailleurs, et ils sont plus nets.

### 3 · Les quatre trous, vérifiés

**a. `preuve` est calculé et n'est affiché nulle part.** 142 lignes de worker
(`build_report.py` 3282-3423, « Boucle de la preuve »), typé dans `report.ts`
l. 454-458 — et `ProofOutcome` n'apparaît nulle part ailleurs que dans sa propre
déclaration. C'est le bilan des actions au niveau du **compte** ; le rail le dit
par thème, personne ne le dit en général.

**b. Aucune semaine passée n'est lisible.** `weekly_reports` est lu `.limit(1)`
(`report.ts` l. 589-593). Pulse écrit un rapport par semaine depuis le début et
n'en relit jamais aucun. L'« historique de ce que tu fais pour travailler » que
David décrit est **déjà en base**, jamais ouvert.

**c. Le rapport ne renvoie jamais vers `/meta`, `/google` ni `/instagram`.**
Ses seuls liens sortants vont vers `/labels` (l. 499, 507, 673) ; le reste sont
des ancres internes. La dernière étape du parcours de David n'a pas de porte :
on y arrive par la barre de gauche, sans rien emporter du fil ni rien en
ramener.

**d. `SetupWizard` est rendu en bas de page** (l. 641), après les deux sections.
Le guide qui prend le nouveau venu par la main est sous deux écrans de
défilement — alors qu'un commentaire voisin (l. 636-638) montre qu'on a déjà
remonté un autre bloc pour exactement cette raison.

### 4 · Les quatre chemins qui en sortent

- **[La mémoire du travail](08-la-memoire-du-travail.md)** — ce qui s'accumule,
  où on le relit, ce qu'il nourrit. Porte (a), (b) et le vocabulaire
  note/action/commentaire.
- **[La porte vers la plateforme](09-la-porte-vers-la-plateforme.md)** — (c).
- **[L'entrée : le premier écran](10-l-entree-premier-ecran.md)** — (d), et ce
  que voit celui qui revient le jour qu'il a choisi.
- **[D'où viennent les conseils](11-d-ou-viennent-les-conseils.md)** — le seul
  module de la liste d'origine qu'aucun fait de cette session n'a éclairé.

### Ce qui reste NON décidé

Le fil tel qu'il **devrait** être. Ce ticket a relevé celui qui existe et nommé
ses trous ; le dessin se fait dans les quatre tickets ci-dessus, puis se
recompose dans [04](04-ce-qui-doit-etre-valide-en-premier.md).
