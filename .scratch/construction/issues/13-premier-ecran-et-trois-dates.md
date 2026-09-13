# Le premier écran de celui qui revient, et les trois dates en tête

Type: task
Status: resolved
Blocked by: 12

## Question

Deux décisions qui vivent sur la même page et se bâtissent ensemble —
[10](../../refonte/issues/10-l-entree-premier-ecran.md) point 6, et
[13](../../refonte/issues/13-entre-deux-jours-de-travail.md).

### L'ordre du premier écran

**Verdict → bilan du carnet → rail des chantiers en cours → résumé IA REPLIÉ.**

La raison, écrite au plan §3 a : **la prose IA est ce qu'il y a de moins
vérifiable sur la page, et elle occupe aujourd'hui les pixels les plus chers.**

Deux défauts mesurés en 06 à corriger dans le même passage :
- **`SetupWizard` est rendu en bas de page**, sous deux écrans de défilement.
- **Le rapport ne renvoie jamais vers `/meta`, `/google`, `/instagram`** — ses
  seuls liens sortants vont vers `/labels`. (La porte est le ticket **14**.)

### Les trois dates

**Mesuré du X au X · publié le X · mis à jour le X.** `updated_at` **existe et
n'est jamais lu**. Toute la clarté du décalage entre deux Jours de travail tient
dans ces trois dates — et dans rien d'autre.

**Ce qui a été refusé, deux fois, et ne se re-propose pas :**
- **Rien à annoncer au client qui classe** : pas de bandeau « mise à jour en
  cours », **pas de mention d'âge par carte**.
- **Un rapport ne se déclare JAMAIS « périmé »** : vieux ≠ faux (§7).

### Le défaut de publication, à réparer ici

**Republier dans une autre semaine calendaire crée une DEUXIÈME ligne** —
`week_start` est dérivé de `today` (`build_report.py` l. 2164), pas de la fenêtre
mesurée. Deux lignes pour une même semaine, c'est deux vérités.

### Ce que 13 a corrigé de 08, et qui évite une fausse piste

**« ↻ Recharger mes conseils » ne déplaçait aucun écart** : la fenêtre est ancrée
sur **la dernière donnée** (`build_report.py` l. 1734), pas sur le jour de
fabrication. Seul « ↻ Mes données » bougeait l'ancre, parce qu'il récolte.
La décision de 08 tient (ticket **15**), **sa raison était trop large**.

### Le piège de §8 qui mord ici

**Une constante exportée depuis un module `"use client"`** devient une référence
client côté serveur : la valeur lue est un proxy, **rien ne lève, TS passe**.
Les valeurs partagées vivent dans un module **sans directive**.

### Consigne de repli

Les **trois dates** d'abord — petites, isolées, et elles répondent à la seule
question que le décalage pose. L'ordre du premier écran ensuite, **en variantes
comparables** : c'est de la hiérarchie, donc de la forme.

## Avancement — session du 2026-09-13 (construction)

Les deux décisions sont construites et vérifiées. **Repli appliqué dans son
ordre** : les trois dates d'abord, l'ordre du premier écran ensuite — mais il
n'a pas eu à s'arrêter là, les deux tiennent dans le même passage.

### 1 · Les trois dates, en tête du rapport

**Mesuré du 7 au 13 septembre · publié le 14 septembre · mis à jour le lundi
21 septembre.** `weekly_reports.updated_at` existait depuis toujours et n'était
jamais lu (`lib/report.ts` ne sélectionnait que `week_start, payload`) : il est
la deuxième date. La troisième sort de `profiles.fetch_schedule` — le Jour de
travail **du compte regardé**, jamais celui de la personne qui regarde : c'est
`user_id` que `_due_today` compare, donc un Membre invité lit les dates du
compte dont il voit les chiffres.

**Elles PRENNENT LA PLACE du libellé de semaine, elles ne s'y ajoutent pas.**
`week_label` disait déjà « Semaine 37 · 7 → 13 septembre · 7 jours pleins » : la
fenêtre mesurée se serait lue deux fois à trente pixels d'écart, sur les pixels
les plus chers de la page. Le libellé reste le **repli** des payloads publiés
avant que `since`/`until` existent — et les deux ne se lisent jamais ensemble.

**Ce que la ligne n'a pas le droit de dire, et qu'un test garde** : jamais
« périmé », « obsolète », « il y a N jours », aucune couleur d'alerte, aucun
bandeau. Vieux ≠ faux (§7), et David l'a refusé deux fois. **Chaque date peut
manquer et alors elle ne s'écrit pas** : la fenêtre ne s'écrit qu'entière (une
moitié de fenêtre ne dit pas sur quoi les chiffres portent), une date illisible
vaut `null` et jamais « NaN septembre ».

**Le piège du §8 était armé, il est désarmé.** Le calcul du prochain passage
vivait dans `components/jour-recolte.tsx`, qui porte `"use client"` ; les trois
dates sont rendues par le **serveur**. Les sept jours, `prochainPassage`,
`enFrancais` et `delai` ont déménagé dans **`lib/jour-de-travail.ts`, sans
directive**, et le module client les lit de là — il n'en garde aucune copie.
Tout se calcule en **UTC**, comme le cron (`0 7 * * *`) et comme `_due_today`.

### 2 · L'ordre du premier écran, les cinq marches en place

**Fil de démarrage → Verdict → bilan du Carnet → À faire → rail des chantiers
en cours → résumé IA replié → la section 1.**

- **`SetupWizard` remonte en tête** — le défaut mesuré en 06 : il était rendu
  sous deux écrans de défilement alors qu'il porte les seules actions qui
  débloquent le reste. **Seule sa place bouge** : le passage aux quatre étapes
  avec la connexion en gate est la brique « mise en place », hors v1
  (`plan-de-refonte.md` §3). Le composant décide toujours lui-même s'il a
  quelque chose à dire, donc pour un compte installé rien ne change à l'écran.
- **Le résumé IA descend et se replie** derrière « Lire le résumé de la
  semaine » — un `<details>` fermé, sans état React : le texte reste dans le
  document. C'est la raison du plan §3 a, mot pour mot.
- **Le rail des chantiers en cours existe enfin sur l'accueil.** C'était le
  rang 4 de l'ordre depuis 10 point 6, confirmé par 20 (« il se pose après le
  bilan du carnet, dans l'ordre déjà arrêté par 10 »), et **la seule marche que
  personne n'avait construite** : la règle « une action décidée vit en haut
  jusqu'à être faite » n'était appliquée nulle part ici — il fallait entrer dans
  la carte d'un thème pour revoir ce qu'on avait lancé.

**Ce rail n'est PAS un deuxième objet** : c'est `RailActions`, le module des
cartes de thème, servi sans thème courant (chaque ligne porte donc le sien) et
**sans aucun fait de plateforme** — ceux-là racontent ce qui a bougé sur un
thème et se lisent dans sa carte ; les remonter referait la chronologie entière
en tête de page, c'est-à-dire ce que `685a3e9` avait défait.

**Et il ne double pas « À faire ».** La frontière de 20 devient un invariant
vérifiable le jour où les deux se lisent sur le même écran : `chantiersEnCours`
(`lib/a-faire.ts`) est le **complément exact** de ce que le module liste, calculé
au même endroit que lui. Un test l'exécute : aucune action des deux côtés,
aucune action perdue entre les deux.

### 3 · Le défaut de publication est réparé

`week_start` était le lundi d'**aujourd'hui** : republier dans une semaine
calendaire différente écrivait une **deuxième ligne** pour les mêmes chiffres et
renumérotait « Semaine N ». Il sort maintenant de la **fenêtre mesurée** —
`week_start_rapport = last_full_day - last_full_day.weekday()` — et voyage dans
le payload jusqu'à `publish_weekly_report`. Le numéro de semaine du libellé suit,
et **la borne qui empêche un rapport de se relire lui-même** dans son propre
historique aussi (elle était sur le lundi d'aujourd'hui, elle est sur celui du
rapport).

La publication devient **idempotente** : tant que la dernière donnée n'a pas
bougé, republier le samedi, le mardi suivant ou trois semaines plus tard écrase
sa propre ligne. C'est le même invariant que la fenêtre, qui est ancrée sur la
dernière donnée depuis toujours — seule la clé d'écriture ne suivait pas.

**Ce que ça déplace en service, une fois et une seule.** Pour un compte dont le
Jour de travail est le **lundi**, la fenêtre finit le dimanche, donc dans la
semaine ISO précédente : son `week_start` recule de sept jours. La publication
suivante tombe alors sur la ligne qu'occupait la précédente et l'**écrase**
(upsert, aucune suppression, aucune ligne de suivi touchée) — on perd le payload
d'**une** semaine d'historique, et cette semaine-là est invisible de
`_rapports_publies` pendant une run. Pour tous les autres jours, hier est dans
la même semaine ISO qu'aujourd'hui et rien ne bouge. Dit ici plutôt que découvert
plus tard.

### 4 · Ce qui a été vérifié

**77 vérifications neuves** — harnais
[`13-premier-ecran`](../harnais/13-premier-ecran/LISEZMOI.md), sans base, sans
secret, sans réseau. Et une nouveauté : **deux modules purs de `saas/web`
tournent pour de bon**, importés tels quels (node 22+ retire les types
lui-même) — plus aucune copie du code à vérifier dans le harnais. Les 26 cas de
calcul de dates et les 7 cas de la partition sont exécutés, pas lus.

**Rejoués** : harnais 06 (342), 07 (189), 08 (83), 09 (108), 10 (343), 12 (179),
tous verts. 04 et 05 demandent un PostgreSQL, non rejoués.

`saas/web` : `rm -rf .next tsconfig.tsbuildinfo`, `npx tsc --noEmit` vert,
`npm run build` vert, **19 routes**. Python : `python3.12 -m py_compile` sur
`build_report.py`.

**Les trois dates et le rail se voient tout de suite** (ils lisent la ligne et
les actions). **Le `week_start` et le numéro de semaine ne se voient qu'après un
« ↻ Recharger mes conseils »** — c'est le worker qui les écrit.

### 5 · Ce qui n'est PAS vérifié

- **Rien n'a été vu à l'écran.** La page est derrière `middleware.ts` et lit un
  vrai compte : ni l'ordre des blocs à 390 px, ni le repli du résumé, ni la
  ligne des trois dates n'ont été regardés dans un navigateur.
- **`build_payload` n'a pas tourné** (ticket 16) : la dérivation de `week_start`
  est vérifiée sur le texte du worker et sa **propriété** sur les dates, jamais
  à l'exécution. **Aucun `upsert` n'a été joué** — que deux publications de la
  même fenêtre écrivent la même ligne est démontré sur le calcul, pas en base.
- **`weekly_reports.updated_at` n'a jamais été lu sur une vraie ligne**, ni
  `fetch_schedule` sur un vrai profil.

### 6 · Ce qui n'a pas été touché, et pourquoi

**Les trois défauts de rafraîchissement** que la refonte 13 a mesurés —
`setCampaignLabel` qui ne rafraîchit pas `/couts`, `setPostLabel` qui ne
rafraîchit pas `/`, et le `revalidatePath("/")` commenté *« le rapport regroupe
les campagnes par thème »* alors que les blocs par thème sortent d'un payload
figé (toujours à `app/actions.ts` l. 1609). Ils appartiennent à
[refonte 17](../../refonte/issues/17-ce-qui-se-regroupe-et-ce-qui-est-mesure.md),
que le plan place **hors v1** : « le rapport se refait au Jour de travail, c'est
une discontinuité, pas une rupture ». Vus, non corrigés, non oubliés.
