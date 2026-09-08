# Résumé narratif du Plan de thème — la couche mémoire

Status: implemented — en attente de la vérification manuelle (voir `## Answer`)

Origine : wayfinder `.scratch/recos-labels/` — dernier morceau non construit du
ticket [Plan par thème](../recos-labels/issues/05-plan-par-theme.md). La couche
**état** (déterministe) de ce ticket est codée et branchée depuis le 6 septembre
2026 ; c'est la couche **mémoire lisible** qui manque, et c'est l'objet de cette
spec.

Vocabulaire : les termes **Thème**, **Hypothèse**, **Verdict**, **Levier** et
**Plan de thème** sont ceux du glossaire (`CONTEXT.md`), pas des synonymes libres.

---

## Problem Statement

Chaque semaine, Pulse rédige pour chaque Thème prioritaire une **Hypothèse** —
une piste moins sûre, taguée d'un **Levier** (argent, contenu, tempo, audience),
dont on ne saura qu'à son échéance si elle a marché. À l'échéance, un **Verdict**
tombe (`better` / `worse` / `stable`), il est persisté, et il sert aujourd'hui à
deux choses : débloquer la génération d'une Hypothèse suivante, et repondérer le
poids d'un conseil `done` dans le moteur déterministe.

Ce que le Verdict ne fait **pas** : revenir jusqu'à l'IA qui rédige l'Hypothèse
suivante. Le prompt de rédaction des pistes d'un Thème reçoit les chiffres de la
semaine, les 4 semaines précédentes, les conversions GA4 du Thème, et le texte
des idées que le client a écartées ou déjà mises en place. Il ne reçoit **aucune
trace de ce que le Thème a déjà tenté ni de ce que ça a donné**.

Conséquence concrète, du point de vue du client : Pulse peut lui proposer une
troisième Hypothèse « argent » sur le même Thème alors que les deux premières
ont été mesurées `worse`. Le produit a l'information, l'a persistée, et ne s'en
sert pas pour éviter de refaire la même erreur. Le client, lui, voit un outil
qui ne retient rien de ce qu'il a essayé avec lui — exactement ce que la promesse
« suivre une théorie » prétend corriger.

Un simple déversement de l'historique brut dans le prompt ne règle pas le
problème : il grossit à chaque cycle, coûte des jetons à chaque rapport, et noie
le signal (« la tendance ») sous le détail (« la liste »). C'est pourquoi la
décision du ticket 05 parle d'un **plan condensé**, pas d'un journal.

## Solution

Le Plan de thème gagne sa **seconde couche** : un **résumé narratif** court, une
à deux phrases, propre à un (client, Thème), qui dit *où en est ce Thème* en
matière d'Hypothèses — ce qui a été tenté, sur quels Leviers, et ce que ça a
donné. Par exemple : « Trois Hypothèses "argent" testées depuis le 2 août, aucune
n'a bougé l'indicateur — le Levier "contenu" n'a jamais été essayé sur ce
Thème. »

Ce résumé est **rédigé par l'IA**, mais uniquement en **reformulation** : il
reçoit des chiffres et des verdicts **déjà calculés** par du code déterministe et
n'a le droit d'en produire aucun. C'est la contrainte structurante de la
fonctionnalité, pas un garde-fou décoratif (`CLAUDE.md` § 7 : aucun chiffre
fabriqué).

Il n'est **pas** recalculé à chaque rapport. Il n'est réécrit qu'au moment où un
**nouveau Verdict tombe** sur ce Thème — le seul instant où la mémoire du Thème
change réellement. Entre deux Verdicts, le résumé stocké est relu tel quel. Le
coût IA est donc proportionnel au nombre de Verdicts, pas au nombre de rapports.

Il est ensuite **injecté dans le prompt** qui rédige les pistes du Thème, en
texte libre. L'IA reste libre d'en faire ce qu'elle veut : aucune règle
d'exclusion codée n'interdit un Levier déjà échoué (décision du ticket
[Hypothèse générique](../recos-labels/issues/02-hypothese-generique.md) — le
mécanisme actuel est bon, c'est l'absence d'historique qui était le manque).

Le résumé est une **mémoire interne**, pas un élément d'interface : il n'est
affiché nulle part dans `saas/web/` par cette spec.

## User Stories

1. En tant que client d'une PME, je veux que Pulse se souvienne des Hypothèses
   déjà testées sur un Thème, afin qu'il ne me repropose pas une idée dont on
   sait déjà qu'elle n'a rien donné.
2. En tant que client, je veux que Pulse tienne compte du Levier des Hypothèses
   passées, afin qu'après trois échecs sur « argent » il aille explorer
   « contenu » plutôt que d'insister.
3. En tant que client, je veux que la mémoire d'un Thème soit propre à ce Thème,
   afin qu'un échec sur « Cours du soir » ne vienne pas plomber les idées sur
   « Location de salle ».
4. En tant que client, je veux que cette mémoire survive au remplacement d'une
   Hypothèse par la suivante, afin qu'elle raconte une tendance sur plusieurs
   cycles et pas seulement le dernier coup joué.
5. En tant que client, je veux que Pulse ne m'invente jamais un chiffre dans
   cette mémoire, afin de pouvoir continuer à faire confiance à tout ce qu'il
   m'affiche par ailleurs.
6. En tant que client dont un Thème n'a encore jamais reçu de Verdict, je veux
   que Pulse se comporte exactement comme aujourd'hui, afin que la nouveauté ne
   dégrade pas ma première semaine.
7. En tant que client dont un Thème a reçu son tout premier Verdict, je veux que
   la mémoire commence à exister à partir de là, afin qu'elle s'enrichisse au
   rythme réel de mes tests.
8. En tant que client, je veux que le rapport se publie même si l'appel IA de
   condensation échoue, afin qu'une panne de mémoire ne me prive jamais de mon
   rapport hebdomadaire.
9. En tant que client, je veux que le résumé précédent soit conservé si la
   nouvelle condensation échoue, afin de ne pas perdre une mémoire déjà
   constituée à cause d'un appel raté.
10. En tant que client, je veux que la mémoire d'un Thème ne coûte un appel IA
    que quand elle change vraiment, afin que le produit reste soutenable.
11. En tant que client qui a supprimé puis recréé un Thème du même nom, je veux
    que la mémoire suive le nom du Thème, afin de rester cohérent avec la façon
    dont tout le reste de Pulse identifie un Thème.
12. En tant que client, je veux que la mémoire distingue « aucune Hypothèse
    testée » de « des Hypothèses testées sans résultat », afin de ne pas lire un
    silence comme un échec.
13. En tant que client, je veux que cette mémoire soit privée à mon compte, afin
    qu'elle respecte les mêmes règles de partage que le reste du Plan de thème.
14. En tant que membre invité sur un compte partagé, je veux voir la même chose
    que le propriétaire en matière de conseils, afin que la mémoire ne crée pas
    deux qualités de rapport selon qui l'a généré.
15. En tant que développeur de Pulse, je veux que la condensation vive dans un
    module sans import de Gemini, afin de pouvoir la faire tourner avec un faux
    appel IA et vérifier ce qu'elle envoie au modèle.
16. En tant que développeur, je veux que le prompt de condensation ne reçoive que
    des valeurs déjà calculées, afin de pouvoir prouver par lecture qu'aucun
    chiffre ne peut être inventé.
17. En tant que développeur, je veux que la nouvelle Hypothèse d'un Thème
    n'efface pas le résumé narratif, afin que la mémoire ne se réinitialise pas à
    chaque cycle.
18. En tant que développeur, je veux que la migration soit rejouable sans risque
    et sans `DROP`, afin de respecter la règle du dépôt sur les migrations.
19. En tant que développeur, je veux que tout fonctionne à l'identique si la
    migration n'a pas encore été jouée, afin que le déploiement du code et celui
    du schéma puissent être désynchronisés sans casse.
20. En tant que développeur, je veux savoir explicitement à quel rapport la
    mémoire écrite cette semaine sera lue, afin de ne pas croire à un bug quand
    elle n'a pas d'effet immédiat.
21. En tant que David, je veux pouvoir constater l'effet en cliquant
    « ↻ Recharger mes conseils », afin de vérifier moi-même plutôt que de croire
    sur parole.
22. En tant que David, je veux que le Levier de chaque Hypothèse passée soit
    retrouvable, afin que la phrase « trois fois le même Levier » soit mesurée et
    non devinée.

## Implementation Decisions

### Où vit le résumé — deux colonnes sur `theme_plan`

Le Plan de thème reste **une seule ligne par (user_id, theme)**, conformément à
la décision du ticket 05. On lui ajoute la couche narrative en colonnes :

```sql
ALTER TABLE public.theme_plan
    ADD COLUMN IF NOT EXISTS resume     text,
    ADD COLUMN IF NOT EXISTS resume_at  timestamptz;
```

- `resume` : le texte condensé, 1 à 2 phrases.
- `resume_at` : quand il a été écrit — sert à savoir qu'une mémoire existe et
  depuis quand, sans avoir à interpréter le texte.

Migration **idempotente**, `ADD COLUMN IF NOT EXISTS` uniquement, aucun `DROP`,
aucun `DELETE`. Elle est reportée dans le fichier de migration dédié à
`theme_plan` **et** dans le fichier unique rejouable, comme les autres tables du
schéma.

Rejeté — le `snapshot` jsonb existant : il est la carte figée de l'Hypothèse,
réaffichée telle quelle au client pendant sa fenêtre d'attente. Y glisser la
mémoire la ferait fuir à l'écran et la ferait écraser à chaque nouvelle
Hypothèse, alors que sa raison d'être est précisément de survivre à plusieurs
cycles.

Rejeté — une table `theme_memoire` séparée : elle isolerait mieux, au prix d'une
seconde table, d'une seconde migration et d'une seconde lecture, pour un état qui
est conceptuellement la seconde couche du même Plan de thème.

### Le seam : un module headless dans `recos_ia/`

La condensation vit dans un **nouveau module** `saas/recos_ia/theme_memoire.py`,
calqué sur le patron déjà éprouvé de `user_persona.py` : il reçoit
`call_ai(prompt) -> str | None` en paramètre et **n'importe jamais Gemini**.
C'est le seam unique et le plus haut de cette fonctionnalité — tout le reste est
du branchement.

Interface visée (les noms exacts restent au jugement de l'implémenteur, la forme
compte) :

- une fonction de construction du prompt, **pure**, qui prend l'historique déjà
  calculé d'un Thème et rend une chaîne ;
- une fonction publique de condensation qui prend le client Supabase,
  `user_id`, le nom du Thème, `call_ai` et cet historique, appelle l'IA, écrit le
  résultat et le rend ; `None` si elle n'a pas de matière ou si l'IA échoue.

L'écriture en base passe par une fonction dédiée dans `saas/commun/insert_data.py`
(là où vivent déjà `upsert_theme_plan` et `save_user_profile`), pas par un accès
Supabase direct depuis le module de condensation.

### Ce que le module reçoit — et rien d'autre

L'appel IA reçoit exclusivement des valeurs **déjà calculées ailleurs**, jamais
de données brutes à agréger lui-même. Pour chaque Hypothèse passée du Thème :
son titre, son Levier, sa date de décision, son échéance, son Verdict
(`better` / `worse` / `stable`), et le triplet mesuré valeur de départ / valeur
constatée / variation en pourcentage, avec le libellé de l'indicateur.

Le prompt formule une consigne explicite de reformulation : **reformuler ces
chiffres, n'en produire aucun, ne rien affirmer qui ne soit dans les lignes
fournies**, et distinguer « aucune Hypothèse encore testée » de « des Hypothèses
testées sans effet mesuré ». Sortie attendue : 1 à 2 phrases, français, ton
factuel, sans intro ni guillemets — même registre que le profil client vivant.

### La source de l'historique : `suivi_actions`, déjà en mémoire

`build_payload` charge déjà, pour sa boucle de Verdict, l'ensemble des lignes de
`suivi_actions` du client aux statuts `running` / `done` / `auto`. L'historique
des Hypothèses d'un Thème s'en déduit par filtrage sur la colonne `theme` et sur
l'origine `auto` portée par le jsonb `detail` — **aucune requête supplémentaire
n'est nécessaire**.

Limite assumée et à documenter en commentaire : une Hypothèse que le client a
rangée (`archived`) ou abandonnée (`dropped`) ne figure pas dans cette liste et
sort donc de la mémoire. C'est cohérent — une Hypothèse abandonnée n'a pas de
Verdict à raconter — mais ce n'est pas neutre et ça doit être écrit, pas subi.

### Le Levier des Hypothèses passées : à porter dans `detail`

`suivi_actions` **ne stocke pas le Levier** aujourd'hui. Sans lui, la phrase
« trois Hypothèses argent d'affilée » serait devinée à partir de l'indicateur —
donc fabriquée. L'écriture d'une nouvelle Hypothèse auto ajoute donc `levier`
dans le jsonb `detail`, à côté de `origin`, `observation`, `pourquoi`,
`verifier` et `effort`.

Aucune migration : `detail` est un jsonb nullable déjà en place, et l'action
côté web qui résout une action ne réécrit jamais ce champ — le Levier y survit
donc à n'importe quel geste client ultérieur, pour la même raison que `origin`.

Conséquence temporelle à assumer : les Hypothèses écrites **avant** ce
changement n'ont pas de Levier dans `detail`. La condensation les traite comme
« Levier inconnu » plutôt que d'en inférer un.

### Le déclenchement : à la chute d'un nouveau Verdict, et seulement là

Dans la boucle de Verdict de `build_payload`, une ligne reçoit un Verdict
**nouveau** quand le Verdict vient d'être calculé **et** que la ligne relue en
base n'en portait pas encore. Les lignes de `suivi_actions` étant lues **avant**
l'écriture du Verdict, la valeur pré-écriture est disponible sans état
supplémentaire : c'est le test à utiliser. Pas de colonne « dernière
condensation », pas de comparaison de dates.

Quand ce test est vrai pour une ligne portant un Thème, la condensation est
appelée une fois pour ce Thème, et son résultat est écrit dans `resume` /
`resume_at`. Si plusieurs Thèmes reçoivent un Verdict le même jour, il y a un
appel par Thème — jamais un appel par ligne.

Aucun Verdict nouveau cette semaine ⇒ **zéro appel IA** ⇒ le `resume` stocké est
relu inchangé.

### L'écriture ne doit pas écraser l'état, ni l'inverse

Deux écritures visent la même ligne à deux moments différents du rapport :
l'upsert de nouvelle Hypothèse (couche état) et l'écriture du résumé (couche
mémoire). **Vérification obligatoire à l'implémentation** : confirmer sur la base
réelle qu'un upsert PostgREST ne portant qu'un sous-ensemble de colonnes laisse
les autres intactes. Tant que ce n'est pas constaté, écrire le résumé par un
`update` ciblé sur `(user_id, theme)` plutôt que par un upsert de ligne complète —
c'est la forme qui ne peut pas effacer l'état.

Rappel du dépôt qui s'applique ici : un refus RLS sur un `update` ne lève aucune
erreur, il touche zéro ligne. L'écriture du résumé doit donc être **constatée**,
pas supposée.

### La lecture : une porte déjà ouverte dans le prompt

`fetch_theme_plan` ajoute `resume` aux colonnes qu'il sélectionne — il ramène
alors l'état et la mémoire en une seule lecture, déjà appelée une fois par
rapport.

La fonction qui rédige les pistes d'un Thème gagne un paramètre optionnel
supplémentaire (`memoire: str | None = None`), traité exactement comme les
paramètres de contexte qu'elle reçoit déjà : un bloc de phrase inséré dans le
prompt quand il est non vide, rien du tout sinon. Aucune signature cassée, aucun
appelant existant à modifier au-delà du passage de l'argument.

Placement dans le prompt : **avant** la consigne de production des idées, à côté
du bloc des chiffres de la semaine — c'est du contexte sur le Thème, pas une
contrainte de format.

### Le décalage d'un rapport, à écrire noir sur blanc

Dans `build_payload`, la rédaction des pistes d'un Thème s'exécute **avant** la
boucle de Verdict. Un résumé écrit à la chute d'un Verdict est donc lu par la
rédaction du rapport **suivant**, jamais par celui en cours.

Ce n'est pas un défaut à corriger : la mémoire décrit un cycle qui vient de se
clore, et le cycle suivant est précisément celui qui doit en tenir compte. Mais
c'est contre-intuitif à la lecture du code, et ça doit être porté par un
commentaire à l'endroit du branchement — sinon le prochain agent qui passe
prendra ce décalage pour un bug d'ordonnancement et « corrigera » en remontant
l'appel.

### Dégradation : jamais bloquant, comme partout ailleurs

Chaque point de défaillance a son repli, aligné sur ce que fait déjà le reste du
produit :

- migration pas encore jouée (colonnes absentes) : la lecture rend l'état sans
  mémoire, l'écriture échoue en silence, le rapport se publie normalement ;
- appel IA en échec ou sans clé : le `resume` précédent est **conservé**, jamais
  écrasé par du vide ;
- aucune matière (Thème sans aucune Hypothèse passée) : pas d'appel IA du tout,
  `resume` reste `NULL`, le prompt de rédaction ne reçoit aucun bloc mémoire ;
- exception inattendue dans la condensation : capturée, le rapport continue.

### RLS

Deux colonnes ajoutées à une table existante héritent des politiques déjà en
place sur `theme_plan` — il n'y a pas de politique à écrire. Point à contrôler
et non à supposer : que le partage de compte s'applique à ces colonnes comme au
reste de la ligne, la table portant déjà un bloc de politiques de partage
conditionnel.

## Testing Decisions

**État réel du dépôt, à ne pas maquiller** : il n'existe aujourd'hui **aucune
suite de tests automatisés** — pas de `pytest`, aucun fichier de test hors
`.venv/`. Il n'y a donc pas de prior art de tests à imiter, et cette spec ne
prétend pas en créer une. La vérification du dépôt est celle de `CLAUDE.md` § 9 :
`python3.12 -m py_compile` sur les fichiers Python touchés, et — si du code web
avait été touché, ce qui n'est pas le cas ici — `npx tsc --noEmit` et
`npm run build` verts en 16 routes.

Ce que la spec garantit en revanche, c'est la **testabilité** : le seam a été
choisi pour ça. Le module de condensation reçoit `call_ai` en paramètre et
n'importe pas Gemini, donc il peut tourner hors ligne avec un faux appel qui
capture le prompt.

Ce qu'un test vaudrait la peine de vérifier, le jour où une suite existe — du
comportement externe, jamais des détails d'implémentation :

- avec un historique connu en entrée, le prompt produit **contient** les valeurs
  fournies et **ne contient aucun nombre absent** de l'entrée : c'est la
  propriété qui protège la règle « aucun chiffre fabriqué », et elle est
  vérifiable par simple inspection de la chaîne ;
- un faux `call_ai` qui rend `None` laisse le `resume` stocké inchangé ;
- un Thème sans aucune Hypothèse passée ne déclenche aucun appel — le faux
  `call_ai` n'est jamais invoqué ;
- une Hypothèse passée sans `levier` dans son `detail` est rendue comme Levier
  inconnu, pas silencieusement rattachée à un Levier ;
- deux Thèmes recevant un Verdict le même jour produisent exactement deux appels.

**Vérification manuelle attendue** de cette fonctionnalité, à faire et à
rapporter plutôt qu'à supposer : jouer la migration, générer un rapport pour un
compte dont au moins une Hypothèse arrive à échéance, constater que la ligne
`theme_plan` du Thème porte un `resume` non vide et un `resume_at`, puis générer
le rapport de la semaine suivante et constater que le bloc mémoire figure bien
dans le prompt. Le rappel du dépôt s'applique : **une correction du traitement ne
se voit qu'après un « ↻ Recharger mes conseils »**.

## Out of Scope

- **Afficher le résumé au client.** C'est une mémoire interne qui nourrit un
  prompt. Le montrer dans `saas/web/` est une décision produit distincte, avec sa
  propre question (« qu'est-ce que ça change pour son lundi matin ? »), et elle
  n'est pas tranchée ici.
- **Fusionner avec le profil client vivant.** Explicitement rejeté par le ticket
  05 : le profil de compte et le Plan de thème restent deux mécanismes séparés.
- **Coder une règle d'exclusion de Levier.** Interdire par code un Levier trois
  fois échoué contredirait la décision du ticket 02 (l'IA reste libre). La
  mémoire informe, elle ne contraint pas.
- **Remonter l'appel de condensation avant la rédaction des pistes** pour
  supprimer le décalage d'un rapport. Ce serait une réorganisation de
  `build_payload`, pour un gain d'une semaine, une seule fois.
- **Un historique complet et navigable des Hypothèses.** Le glossaire est
  formel : un Plan de thème est un état courant, pas un journal. La condensation
  lit l'historique, elle ne le republie pas.
- **Rattraper le Levier des Hypothèses déjà écrites** par une migration de
  données sur `detail`. Elles resteront « Levier inconnu » ; la mémoire se
  constituera correctement à partir des Hypothèses suivantes.
- **Récupérer les Hypothèses `archived` / `dropped`** dans la mémoire.
- **Toute reprise du Graphe C** (« Aller plus loin »), hors périmètre de l'effort
  d'origine.

## Further Notes

- La couche état du ticket 05 est **déjà en place** : `theme_plan` existe, est
  lue par `fetch_theme_plan`, écrite par `upsert_theme_plan`, et pilote déjà le
  blocage d'une nouvelle Hypothèse. Cette spec n'y touche que pour ajouter deux
  colonnes et un champ dans un jsonb — c'est un ajout, pas une refonte.
- Le ticket [Fenêtre débloquée par le verdict](../recos-labels/issues/06-fenetre-verdict.md)
  a fait du Verdict le vrai signal de déblocage, le calendrier n'étant plus qu'un
  plafond de secours. Cette spec s'appuie sur le même signal pour déclencher la
  condensation : **un seul événement, "un Verdict est tombé", pilote désormais et
  le déblocage et la mémoire.** Garder cette cohérence si l'un des deux évolue.
- Antécédent le plus proche à lire avant de coder : `saas/recos_ia/user_persona.py`.
  Il résout le même problème (condenser de l'historique en texte pour un prompt),
  avec les mêmes contraintes (module headless, `call_ai` injecté, repli sur la
  valeur stockée en cas d'échec). Le suivre de près plutôt que réinventer.
- Différence à ne pas rater avec ce précédent : le profil client vivant est
  recalculé **à chaque rapport** (son rythme d'appel est son rythme de mise à
  jour). La mémoire de Thème, elle, est **événementielle** — elle ne se recalcule
  qu'à la chute d'un Verdict. Copier le patron du module, pas sa cadence.
- Coût attendu : un appel Gemini léger par Thème et par Verdict. Un compte à
  4 Thèmes prioritaires dont les Hypothèses ont des fenêtres de 7 à 14 jours
  produit de l'ordre de quelques appels par mois, pas par rapport.
- La convention de triage du dépôt renvoie à un fichier `docs/agents/triage-labels.md`
  qui **n'existe pas** actuellement ; le `Status:` en tête de ce fichier suit la
  forme décrite par `docs/agents/issue-tracker.md`. À signaler à David plutôt qu'à
  inventer un vocabulaire de labels.

---

## Answer

Construit le 8 septembre 2026. La couche mémoire existe et est branchée de
bout en bout ; il reste **une vérification manuelle qui n'appartient pas au
code** (jouer la migration, puis regarder ce que la base contient).

### Ce qui a été écrit

| Fichier | Ce qu'il porte |
|---|---|
| `saas/recos_ia/theme_memoire.py` | **Le seam.** `build_prompt(theme, historique)` pure ; `condense_theme_memoire(client, user_id, theme, call_ai, historique)`. Aucun import de Gemini. |
| `saas/commun/insert_data.py` | `save_theme_resume()` — un `update` ciblé sur `(user_id, theme)`, qui **rend `False` si zéro ligne n'a été touchée** (un refus RLS ne lève rien). |
| `saas/commun/fetch_data.py` | `fetch_theme_plan()` ramène `resume` — avec repli sur l'ancienne liste de colonnes si la migration n'est pas jouée. |
| `saas/traitement/build_report.py` | Le `levier` dans `detail`, la lecture de `memoire` dans `_theme_ai_recos`, et le déclenchement dans la boucle de verdict. |
| `supabase/migrations/theme_plan.sql` + `000_run_me_all.sql` | `ADD COLUMN IF NOT EXISTS resume, resume_at`. Aucun `DROP`, aucun `DELETE`. |

### Les décisions de la spec, et où elles ont atterri

- **Déclenchement** : dans la boucle de verdict, le test « verdict nouveau »
  est `not a.get("verdict")` — `_sa` étant lu avant toute écriture de verdict,
  la valeur pré-écriture est disponible sans état supplémentaire, comme la
  spec le prescrivait. Les thèmes concernés sont accumulés dans un `set`, la
  condensation est appelée **une fois par thème** après la boucle.
- **Décalage d'un rapport** : commenté à l'endroit du branchement (juste
  au-dessus de l'appel à `_theme_ai_recos`), en disant explicitement que ce
  n'est pas un bug d'ordonnancement.
- **Hypothèses `archived`/`dropped`** : limite écrite en commentaire dans la
  boucle, pas subie.
- **RLS** : contrôlé, pas supposé — les politiques de `theme_plan` sont au
  niveau **ligne** (`a_acces(user_id)` / `peut_editer(user_id)`) et il n'existe
  aucun `GRANT` au niveau colonne dans le schéma. Les deux colonnes en héritent.

### Ce qui a été vérifié

- `python3.12 -m py_compile` vert sur les quatre fichiers Python touchés.
- Le seam a été exécuté **hors ligne**, avec un faux `call_ai` et un faux
  client Supabase, sur les propriétés que la spec nomme : aucun nombre du
  prompt absent de l'entrée ; les valeurs fournies présentes ; un `levier`
  absent rendu « levier inconnu » ; `call_ai → None` n'écrase rien ;
  historique vide ⇒ **aucun appel IA** ; `update` touchant zéro ligne ⇒ rend
  `None` ; colonnes absentes ⇒ rend `None` sans lever. Toutes passent.
  (Script jetable, non committé — le dépôt n'a pas de suite de tests.)
- Aucun code web touché : `npx tsc` / `npm run build` sans objet ici.

### Ce qui RESTE à vérifier, et qui ne peut pas l'être depuis le code

1. **Jouer `000_run_me_all.sql`** (ou `theme_plan.sql`).
2. **La question laissée ouverte par la spec** : un upsert PostgREST ne
   portant qu'un sous-ensemble de colonnes laisse-t-il les autres intactes ?
   Elle ne peut pas se constater tant que `resume` n'existe pas en base. Le
   chemin d'écriture de la mémoire prend déjà la forme sûre que la spec
   prescrivait dans ce cas (un `update` ciblé), donc **rien ne dépend de la
   réponse pour la mémoire elle-même** ; ce qui en dépend, c'est le sens
   inverse — que `upsert_theme_plan` (nouvelle hypothèse) n'efface pas
   `resume`/`resume_at`. C'est écrit noir sur blanc dans la docstring de
   `upsert_theme_plan`, avec le remède si l'observation contredit l'attente.
3. Générer un rapport pour un compte dont une hypothèse arrive à échéance,
   constater `resume` non vide + `resume_at` sur la ligne `theme_plan`, puis
   générer celui de la semaine suivante et constater le bloc mémoire dans le
   prompt. Rappel du dépôt : **ça ne se voit qu'après un
   « ↻ Recharger mes conseils »**.

### À signaler (comme la spec le demandait)

`docs/agents/triage-labels.md` n'existe toujours pas — aucun vocabulaire de
labels n'a été inventé ici, le `Status:` reste en clair.

### Ce que la revue de code a corrigé, après coup

Six points remontés, quatre corrigés dans le code, deux documentés.

1. **Un chiffre non mérité, et c'était le plus grave.** Une ligne `auto` reste
   « due » pour toujours : passé son `check_at`, elle était remesurée à chaque
   rapport contre le KPI du jour. Le `then/now/delta` d'une hypothèse de trois
   mois ne mesurait donc plus cette hypothèse mais trois mois de dérive du
   compte — et la mémoire l'aurait raconté comme son résultat. **Corrigé** : le
   triplet mesuré n'est retenu que le jour où le verdict tombe vraiment ;
   ensuite seul le verdict PERSISTÉ subsiste, lui n'a pas dérivé. La mémoire
   garde « trois hypothèses argent, deux worse une stable » sans jamais
   rattacher un pourcentage à la mauvaise cause.
2. **La troncature gardait les douze plus VIEILLES** hypothèses (`[:12]` sur
   une liste triée par `check_at` croissant), donc jetait précisément celles
   dont le verdict venait de tomber. **Corrigé** en `[-12:]`.
3. **Un seul timeout Gemini perdait le cycle définitivement** : un verdict
   n'est « nouveau » qu'une fois dans la vie d'une hypothèse. **Corrigé** par
   un rattrapage borné — on repasse aussi sur les thèmes qui ont de la matière
   mesurée et aucun `resume` stocké ; dès qu'une condensation réussit, ce
   second déclencheur s'éteint.
4. **Le repli de lecture avalait aussi les pannes réseau** : sur un timeout, la
   seconde requête (sans `resume`) pouvait réussir et publier un rapport sans
   mémoire alors que la base en avait une. **Corrigé** : le repli ne vaut plus
   que pour une colonne inconnue (`42703` / « does not exist »).
5. *Documenté, pas corrigé* — `save_theme_resume` rend `False` si aucune ligne
   `theme_plan` ne correspond (thème renommé : `suivi_actions` garde l'ancien
   libellé). C'est la conséquence directe de la décision « la mémoire suit le
   NOM du thème » (user story 11). Le rattrapage du point 3 fait retenter au
   rapport suivant. Passer à un upsert reprendrait le risque que la spec
   demande justement d'écarter.
6. *Documenté, pas corrigé* — si l'écriture du verdict échoue en silence, la
   ligne se represente comme neuve chaque semaine : un appel Gemini léger par
   thème et par semaine. C'est le symptôme d'une panne qui casse **déjà**
   `fetch_reco_verdicts` et la repondération des conseils ; le remède est
   là-bas, pas ici.
