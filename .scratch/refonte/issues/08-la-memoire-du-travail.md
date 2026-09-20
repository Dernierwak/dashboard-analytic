# La mémoire du travail : ce qui s'accumule, où on le relit, ce qu'il nourrit

Type: grilling
Status: resolved

## Question

Gradué par [06](06-le-parcours-comment-les-pages-se-parlent.md). C'est le
chemin qui porte le mécanisme de rétention que David a nommé lui-même :
*« tu as à la fin un peu tout ton historique de ce que tu fais pour travailler.
**Cela permet de garder le client.** »* — et que le ticket
[02](02-sur-quoi-se-differencient-les-autres.md) n'a trouvé chez **aucun** des
dix produits lus.

### Ce qui existe déjà et ne se défait pas

Le **rail des actions**, sur le tiers droit de chaque carte de thème : cycle de
vie complet et effet chiffré (« CTR 3,1 → 5,8 ▲ +87 % »). Il est le résultat
d'une fusion délibérée (commit `685a3e9`, 615 lignes supprimées) qui a réglé un
vrai problème : le conseil, la case à cocher et le verdict vivaient dans trois
sections, à 900 px les uns des autres. **La boucle par thème est bonne.**

`NoteAjout` écrit du texte libre (`saveNote(texte, theme, jour)`) avec sa propre
date — « on note souvent le lendemain ce qu'on a fait la veille ; jamais dans le
futur : une note est un fait, pas un projet ».

### Les deux trous mesurés

**1. `preuve` est calculé et jamais affiché.** 142 lignes de worker
(`build_report.py` 3282-3423), typé dans `report.ts` l. 454-458, et
`ProofOutcome` n'existe nulle part ailleurs que dans sa déclaration. C'est le
bilan des actions **au niveau du compte** — le rail le dit thème par thème,
rien ne le dit en général.

**2. Aucune semaine passée n'est lisible.** `weekly_reports` est lu `.limit(1)`
(`report.ts` l. 589-593). Un rapport par semaine est écrit depuis le début et
aucun n'est jamais relu. **La matière de l'historique est déjà en base** — ce
n'est pas une collecte à construire, c'est une lecture à ouvrir.

### Ce qu'il faut trancher

- **Ce qu'on relit d'une semaine passée** : la semaine entière telle qu'elle
  était, seulement ce que le client a fait et ce que ça a donné, ou seulement
  les verdicts ? Un rapport archivé porte des chiffres figés — attention à ne
  pas laisser croire qu'ils sont recalculés.
- **Où on y accède** : depuis un thème, depuis le point général, ou depuis une
  page à part ? (Rappel `CLAUDE.md` : une page de plus est la solution la plus
  coûteuse, pas la plus évidente.)
- **Ce que le point général doit dire de la preuve** : s'ouvre-t-il sur « voilà
  ce que tes actions ont donné », ou est-ce que ça reste l'affaire du thème ?
- **Ce qu'une note change dans le reste.** Aujourd'hui elle est écrite et
  stockée. Est-ce qu'elle nourrit les conseils de la semaine d'après (le worker
  sait déjà lire `suivi_actions`), apparaît sur la frise, ou reste-t-elle la
  mémoire privée du client ? Une note qui ne change rien est un champ de saisie,
  pas une mémoire.

### Le vocabulaire à trancher au passage

`suivi_actions` porte **deux objets différents sous le même toit** :
`saveNote(...)` y écrit une note en texte libre (un fait passé) et
`startTracking(...)` y écrit une action suivie (une hypothèse avec `baseline`,
métrique et verdict à échéance). `saveComment` en écrit un troisième ailleurs
(`reco_feedback`). David a employé « commentaire », « note », « tâche »,
« action » et « historique » pour cette famille ; `CONTEXT.md` n'en nomme aucun.

Appeler `domain-modeling` et écrire le résultat dans `CONTEXT.md`.

### Consigne de conduite

Ticket **HITL**. Leçon de [03](03-le-but-de-pulse.md) : **des questions qui
ouvrent, pas des questions qui élaguent.** Skills : `ux` (les quatre états d'un
composant : vide, chargement, erreur, plein), `hebdo` (où le bloc se pose), puis
`grilling` + `domain-modeling`.

### Consigne de repli

Écrire ce qui est tranché sur la relecture plutôt que d'entamer le vocabulaire.

## Answer

Trois prémisses du ticket étaient fausses, et les corriger a déplacé la
question : ce n'était pas « où afficher ce qui manque », c'était « lequel des
deux moteurs concurrents meurt ».

### Ce que le code disait, contre ce que le ticket supposait

- **La note est DÉJÀ sur la frise, deux fois.** `_markers` (`build_report.py`
  l. 2309) lit `suivi_actions` **sans filtrer `kind`** : une note devient un
  repère ▲ sur la frise du thème (l. 2496) *et* sur la courbe de la boussole en
  tête de rapport (l. 4248).
- **Mais elle ne peut atteindre ni l'IA ni le repondérage, par construction** :
  `saveNote` écrit `status: "archived"` (`actions.ts` l. 245) et la boucle de
  mesure lit `.in_("status", ["running","done","auto"])` (l. 3730).
- **« Aucune semaine passée n'est relue » est faux côté worker** : `build_report.py`
  l. 2169 relit **les 8 derniers rapports publiés**. C'est le client qui ne les
  voit jamais. Les semaines passées sont bien figées (l'upsert ne porte que sur
  la semaine courante).
- **`preuve` n'est pas un trou, c'est un moteur concurrent** — plus vieux et
  moins juste que le rail : il lit `reco_feedback.reaction='done'`, mesure sur
  le **compte entier** (`_kpis_window` sans `theme`), plafonne à 3, et n'accepte
  que les 16 clés-règles de `PROOF_KPI` — aucune piste IA, aucun `theme_event_*`,
  aucune veille. Le rail mesure **sur le thème** depuis le `_BASCULE_THEME`
  (12 août 2026) et accepte les pistes IA. Les deux peuvent rendre deux verdicts
  opposés sur la même action.
- **`CONTEXT.md` nommait déjà la moitié du vocabulaire** que le ticket croyait
  absent : **Note** et **Action suivie** y sont définis, avec la distinction
  note/commentaire. Il manquait trois termes, pas cinq.
- **Sur un compte partagé, une note n'a pas d'auteur** : `getCompteActif()`
  écrit sous l'`user_id` du propriétaire et `suivi_actions` n'a aucune colonne
  d'auteur.
- **Une note ne peut ni se modifier ni désigner une campagne** : `suivi_actions`
  porte `theme`, aucune colonne de campagne, et `NoteLigne` n'offre qu'« effacer ».

### Ce qui est tranché

**1. `preuve` meurt ; le bilan compte-entier se compte, il ne se remesure pas.**
Les 142 lignes (l. 3282-3423), `PROOF_KPI`, `ProofOutcome` et le champ
`payload.preuve` partent. Le bilan au niveau du compte devient un **comptage de
`suivi_actions.verdict`**, déjà persisté en base depuis
`suivi_actions_verdict.sql` — « ce mois-ci : 6 actions jugées, 4 ont marché ».
Aucune mesure nouvelle, donc aucune contradiction possible avec le rail. C'est
la décision de [11](11-d-ou-viennent-les-conseils.md) rejouée : quand deux
moteurs répondent à la même question avec des seuils différents, celui qui
mesure au bon endroit gagne et l'autre meurt.

**2. La mémoire est le fil continu, pas l'archive rejouée.** On ne rouvre aucune
semaine passée côté client. Un rapport archivé porte des chiffres figés qui
contrediraient le rail sur les mêmes jours — deux vérités à l'écran. Le fil,
lui, est déjà continu et porte ses verdicts chiffrés ; il est simplement enfermé
dans le tiers droit d'une carte de thème. `weekly_reports` reste ce qu'il est :
une source pour le worker (qui en relit 8), pas un écran.

**3. Une note entre dans la mémoire du thème, jamais dans le repondérage.**
Le filtre `status` de la l. 3730 doit laisser passer les notes du thème, et le
prompt de `theme_memoire.py` doit les présenter comme **faits déclarés**, jamais
comme hypothèses jugées. La limite est nette et tient à `CLAUDE.md` §7 : la
mémoire de thème est narrative — elle reformule, elle ne calcule pas — donc y
verser un fait déclaré ne fabrique aucun chiffre. Repondérer un conseil sur un
texte libre non mesuré, en revanche, ferait peser une phrase comme un verdict :
refusé.

**4. Le carnet devient un module unique posé partout**, sur le patron du module
de commandes de [12](12-module-de-commandes.md) — le même objet, filtré par le
contexte de la page. **Correction apportée par David** : les thèmes ne découpent
pas l'application en deux axes, ils **débloquent des modules**. *« Les thèmes
permettent d'augmenter les capacités des dashboards. On voit les coûts par
plateforme ; ajouter le thème débloque les coûts par thème. Sur Instagram
organique on voit les données individuelles ; ajouter le thème débloque la
moyenne par thématique et le filtre. »* Le carnet suit cette règle : une note
sans thème vit sur le dashboard de sa plateforme ; le thème débloque le tri et
le filtre par thématique. Il ne route pas le module, il l'enrichit.

**5. Le carnet est un vrai module, pas un champ de saisie.** Une note doit
pouvoir **se modifier**, **désigner une campagne**, et **se trier par campagne
ou par thème** (David). Deux changements de base : une colonne d'auteur et une
colonne de campagne sur `suivi_actions`. L'auteur ne s'affiche que sur les
comptes à plus d'un membre — « David » à côté de chaque ligne sur un compte solo
est du bruit permanent.

**6. Le retour sur un conseil reste séparé et reste basique.** Réaction
(utile / pas pour moi / trop compliqué) plus une phrase facultative, attachée au
conseil, nourrissant `user_persona.py`. On ne le fusionne pas avec la note : un
retour juge un conseil, une note raconte un fait. Le défaut à corriger n'est pas
qu'il y en ait deux, c'est qu'ils portent **la même icône ✎, le même verbe, à
400 px** — la personne ne peut pas savoir lequel choisir. Correction de libellé,
pas d'architecture.

**7. Le client ne déclenche plus rien : le Jour de travail est le seul moment où
quelque chose change.** Les **quatre** boutons — « ↻ Mes données », « ↻ Recharger
mes conseils », classement IA, catégorisation IA — passent en mode test.
C'était la source d'un défaut mesuré : la fenêtre est ancrée sur
`min(dernier jour de données, hier)` (l. 1736), donc cliquer « ↻ Recharger » un
samedi quand on a choisi jeudi décale la fenêtre de deux jours et **change tous
les écarts sans qu'aucune donnée n'ait bougé**. Conséquences : l'ancre se cale
sur le dernier passage du Jour de travail ; si les données s'arrêtent avant
l'ancre (récolte ratée) on le dit au lieu de mesurer une fenêtre trouée en
silence ; le préfixe « **Semaine 36** » du `week_label` (l. 1869) disparaît — un
numéro de semaine ISO collé devant une fenêtre glissante est un libellé qui ment ;
`weekly_reports.week_start` devient le jour d'ancre au lieu du lundi, et devient
du même coup une clé juste, une ligne par semaine-client. L'onboarding déclenche
la première récolte et fait choisir le Jour de travail — ce point atterrit dans
[10](10-l-entree-premier-ecran.md).

**La fenêtre de mesure était déjà glissante**, contrairement à ce que la demande
supposait : `cur_since = last_full_day − 6` (l. 1737), et le client lit déjà
« 28 → 3 sept · 7 jours pleins ». Ce qui manquait n'était pas le glissement,
c'était que l'ancre soit **stable**.

### Le vocabulaire, écrit dans `CONTEXT.md`

- **Carnet** (neuf) — tout ce que le compte a écrit et décidé, en une
  chronologie continue ; ni découpé en semaines, ni rejoué depuis une archive.
  Le mot était déjà employé dans la définition de « Compte » sans être défini.
- **Retour** (neuf) — ce que le client dit d'un conseil. « Commentaire » ne
  survit que dans `reco_feedback.comment`.
- **Jour de travail** (neuf) — le jour choisi, et le seul moment où Pulse
  récolte, recalcule et publie.
- **Note** (élargi) — se rattache désormais à un thème, une campagne, les deux
  ou rien ; se corrige et se supprime.

### Ce que ça fait naître

- [13](13-entre-deux-jours-de-travail.md) — ce que voit le client qui connecte
  un canal ou classe des campagnes entre deux Jours de travail, maintenant
  qu'aucun bouton ne lui rend la main.
- Pour [10](10-l-entree-premier-ecran.md) : l'onboarding doit déclencher la
  première récolte et faire choisir le Jour de travail.

## Comments

**Correction apportée par [13](13-entre-deux-jours-de-travail.md) (2026-09-10).**
La décision de ce ticket tient — le client ne déclenche plus rien — mais **sa
raison était trop large**. Il est écrit ici que cliquer « ↻ Recharger mes
conseils » un samedi « change tous les écarts sans qu'aucune donnée n'ait
bougé » : c'est faux pour ce bouton. La fenêtre du rapport est ancrée sur la
dernière donnée récoltée, pas sur le jour de fabrication
(`build_report.py` l. 1734 : `last_full_day = min(last_data_date, yesterday)`).
Republier sans récolter rend les mêmes 7 jours et les mêmes chiffres. Seul
« ↻ Mes données » déplaçait l'ancre, parce qu'il récolte.

Conséquence : la porte que cette raison avait fermée est rouverte par 13 —
**mettre à jour un regroupement par thème ne coûte ni récolte ni recalcul**, et
se fait à la lecture. Ne pas re-citer la phrase d'origine sans cette correction.
