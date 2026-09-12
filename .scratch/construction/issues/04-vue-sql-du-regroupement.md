# La vue SQL du regroupement par thème — le socle du reste

Type: task
Status: open
Blocked by: 03

## Question

**Tranché par [17](../../refonte/issues/17-ce-qui-se-regroupe-et-ce-qui-est-mesure.md).**
Le plan l'appelle *« le socle du reste »* : c'est le seul endroit où Python et
TypeScript partagent **une** implémentation au lieu d'en entretenir deux qui
dérivent.

La règle que 13 puis 17 ont établie : **ce qui se REGROUPE se recalcule à la
lecture, tout de suite, partout ; ce qui se RÉCOLTE ou se RÉDIGE attend le Jour
de travail.** Une étiquette ne produit aucune donnée — elle change par quoi on
regroupe des chiffres déjà en base. **Une courbe n'est qu'une suite de sommes**,
donc un Regroupement : David l'a corrigé, *« la courbe se met à jour et les
records sur l'ancienne semaine »*. **Tout l'historique du thème se recompose**,
semaines passées comprises.

### Les décisions à bâtir, telles quelles

- **Une vue SQL `security_invoker`.** Un module TS aurait réimplémenté
  `build_matrix` — soit le défaut à trois moteurs de
  [11](../../refonte/issues/11-d-ou-viennent-les-conseils.md), en pire.
- **La vue ne couvre QUE les thèmes.** `formats`, `slots`, `campaigns`,
  `coverage` n'alimentent que des constats écrits, qui attendent le Jour de
  travail. Ne pas élargir.
- **Le seuil des 100 CHF descend dans la vue**, qui expose un `roas` déjà filtré
  et un drapeau `juge` ; `C_SEUILS["theme_spend_min"]` **disparaît de Python**.
- **`revenuTheme()` meurt.** Son « max de deux sources » était un pansement
  capable d'afficher un revenu que la vue ne confirme pas (§7). **Sans réponse de
  la vue, pas de revenu — et on le dit.** Pas de zéro, pas d'estimation.

### Les deux limites qui tiennent, à ne pas déborder

- **Le `jugement` attend le Jour de travail en ENTIER** : son chiffre et sa
  phrase sont le même objet, et il réordonne les conseils (l. 3539-3540).
- **Un Verdict déjà rendu ne se recalcule pas** — il jugeait une action sur le
  périmètre qui existait alors.

### Les pièges nommés d'avance

- **PostgREST plafonne à 1 000 lignes et tronque en silence** (§8) : la
  pagination est **obligatoire**, pas optionnelle.
- **`/` ne lit pas aujourd'hui ce que la règle exige** : un mois de GA4, 3 000
  lignes d'annonces sans pagination, sans colonnes de campagne.
- **Le précédent de 13 ne se transporte pas gratuitement.** `lblAgg`
  (`lib/channels.ts` l. 653-659) marche parce que les pages canal sont
  **fenêtrées** ; le rapport ne l'est pas.
- **`ga4_insights` porte bien `campaign`** (migration l. 419) : le revenu par
  thème est regroupable en base. Fait vérifié, pas une hypothèse.

### Ce qui n'est PAS dans ce ticket

`setCampaignLabel` appelle `revalidatePath("/")` avec un commentaire qui dit que
le rapport regroupe par thème — **l'appel est un no-op documenté comme s'il
marchait** (13). Le rebrancher est la moitié web de ce chantier : à faire ici
seulement si la vue est en service, sinon en ticket séparé.

### Consigne de repli

Livrer la vue **avec sa pagination et son drapeau `juge`**, sans la moitié
TypeScript, plutôt que les deux à moitié. La vue sans consommateur est
vérifiable ; un consommateur sans vue ne l'est pas.


## Avancement — session du 2026-09-11 (construction)

**La vue existe, elle est vérifiée contre `build_matrix` sur un vrai
PostgreSQL, et Python la lit. Le SQL n'est PAS joué — je n'ai pas d'accès à la
base. La moitié TypeScript part en [22](22-pulse-lit-la-vue.md), repli appliqué
tel que ce ticket le prévoyait.**

Le critère que ce ticket posait lui-même pour la moitié web — *« à faire ici
seulement si la vue est en service »* — ne pouvait pas être rempli : la vue ne
peut pas être en service dans une session qui ne joue pas de SQL.

### 1 · Ce qui a été construit

**La vue `theme_regroupement`** — `supabase/migrations/theme_regroupement.sql`
(source de vérité), recopiée en **section 24** de `000_run_me_all.sql`. Une
ligne par (compte, thème) : `spend`, `clicks`, `impressions`, `ctr`, `revenue`,
`posts`, `reach_avg`, `eng_avg`, **`juge`** et un **`roas` déjà filtré par
`juge`**.

- **`security_invoker = true`**, et ce n'est pas une décoration : le harnais
  monte le témoin — **la même requête sans l'option rend les deux comptes**.
- **`C_SEUILS["theme_spend_min"]` a disparu de Python.** Les trois filtres de
  `insights.py` lisent `juge` (l. 264, 279, 305).
- **Aucun `DROP TABLE`, `DELETE` ni `TRUNCATE`.** Une vue ne stocke rien. Le
  `DROP VIEW IF EXISTS` ne touche qu'une définition — il existe parce que
  `CREATE OR REPLACE VIEW` refuse de changer le type ou l'ordre des colonnes,
  donc sans lui la moindre colonne ajoutée un jour ferait échouer le rejeu.
- **Le lecteur est paginé et borné au compte** — `fetch_theme_regroupement`
  (`saas/commun/fetch_data.py`), `_all_pages` + `.eq("user_id")` +
  `.order("label")`. L'ordre est posé **avant** la pagination : sans lui, deux
  pages successives peuvent se recouvrir ou sauter des lignes.
  ⚠ Le filtre `user_id` n'est pas décoratif : la vue protège l'appelant qui
  passe par un jeton (Pulse), pas le worker qui passe par la clé de service.
- **`build_matrix` ne calcule plus les thèmes** ; elle les reçoit. Son
  paramètre `theme_events` disparaît — il ne servait qu'au revenu d'un thème,
  qui vit maintenant dans la vue. Campagnes, formats, créneaux et couverture
  restent en Python : ils n'alimentent que des Écrits, qui attendent le Jour de
  travail de toute façon.

### 2 · La vérification : 102 contrôles sur un PostgreSQL 16 réel

Le dépôt n'a aucune suite de tests et [16](16-le-seam-du-payload.md) n'est pas
fait : ce sont des **vérifications jetables**, gardées rejouables dans
`.scratch/construction/harnais/04-vue-sql/` (`pgserver` embarque un PostgreSQL
complet — aucune connexion à Supabase, aucun secret).

| Ce qui est prouvé | |
|---|---|
| **58** · la vue rend **exactement** ce que `build_matrix` rendait | `build_matrix` est relue depuis `git show HEAD`, pas depuis le fichier de travail : comparer la vue au code qu'on vient de modifier ne prouverait rien. Deux comptes, deux régies, thème organique pur, campagnes sans étiquette, homonymes de casse. |
| **19** · les règles propres à la vue | journée en cours dehors sur les trois sources · seuil à 99,99 et 100,00 · conversion choisie (avec valeur / sans valeur / secondaire) · revenu inconnu ≠ revenu nul · tout l'historique |
| **17** · Python lit la vue | lecture filtrée, paginée, ordonnée · `build_matrix` trie et ne touche à rien · les constats suivent `juge` · la vue absente lève, une panne réseau non |
| **4** · l'isolement d'un compte | chacun ses thèmes, rien sans jeton, **et le témoin sans `security_invoker` qui fuite** |
| **2** · la copie de `000_run_me_all.sql` n'a pas dérivé | seul contrôle qui ne demande aucun PostgreSQL |
| **2** · le coût d'une lecture | 300 comptes puis 900 : **le même nombre de lignes lues** |

`python3.12 -m py_compile` passe sur les trois fichiers Python touchés ;
`pyflakes` est propre sur eux et sur le harnais ; les deux fichiers SQL passent
le parseur PostgreSQL réel (`pglast`, libpg_query).

**`saas/web` n'est pas touché** — aucun fichier, `git status` le confirme. Il
n'y a donc rien à dire de `tsc`, de `npm run build` ni des 19 routes ; ils
concerneront [22](22-pulse-lit-la-vue.md).

### 3 · Trois chiffres qui BOUGENT, et pourquoi c'est voulu

La vue n'est pas un copier-coller de `build_matrix` : trois de ses réponses
diffèrent, toutes dans le sens de §7.

**a · Le revenu d'un thème ne se compte plus une fois par campagne.** Google
Analytics n'attribue pas son revenu à une campagne, il l'attribue à un **nom
d'UTM**. `build_matrix` donnait ce revenu à *chaque* campagne portant ce nom,
puis les additionnait dans le thème : trois campagnes homonymes **triplaient**
le revenu, donc le ROAS, donc le Verdict rendu dessus. Mesuré sur le jeu de
vérification : **1 560 CHF affichés pour 520 CHF réellement attribués.**

**b · Deux orthographes d'un même nom ne se perdent plus.**
`rev_by_name = {_norm(k): v for …}` écrasait « Ete_Velo » par « ete_velo » : sur
400 + 120 CHF, **400 disparaissaient**. La vue additionne — c'est bien à ça que
sert la normalisation.

**c · La dépense et le revenu couvrent le même périmètre.** `build_matrix`
ouvrait sa fenêtre GA4 au 1er janvier pendant que la dépense partait du premier
jour connu : un ROAS qui divise le revenu de l'année par une dépense plus
ancienne. C'est exactement le défaut que le ticket **01** a réparé sur les KPI.
La vue prend **tout l'historique des deux côtés**, moins la journée en cours
(`CLAUDE.md` §7 — et la vue est lue à n'importe quelle heure, pas une fois par
semaine à 07:00 : un thème lu à 23:00 un jour de grosse dépense montrerait cette
dépense contre un revenu que GA4 n'a pas encore attribué).

**Conséquence à attendre en service : le revenu et le ROAS de certains thèmes
vont bouger.** Ce n'est pas une régression, ce sont les chiffres que Pulse
affichait sans pouvoir les expliquer.

### 4 · Deux autres écarts, plus petits, à connaître

- **`round()` de PostgreSQL arrondit au supérieur** sur un `numeric` exact, là
  où `round()` de Python travaille sur un flottant et penche vers le pair :
  4,125 % d'engagement donne 4,13 en SQL contre 4,12 en Python. Un centième au
  maximum, et c'est la version SQL qui est juste.
- **Les constats de thème lisent `revenue is not None`, plus `coverage.ga4`.**
  Les deux ne répondaient pas sur le même périmètre (la fenêtre du rapport
  contre tout l'historique) : début janvier, ou sur un compte dont l'attribution
  s'est arrêtée, les constats auraient écrit « revenu inconnu » sous un chiffre
  de revenu affiché par la carte.

### 5 · Une lecture ne coûte pas la clientèle

La vue est lue **à chaque affichage** — c'est tout son intérêt. La première
version lisait 36 000 lignes pour en rendre une : le filtre `user_id` de
l'appelant ne descendait pas jusqu'aux tables, bloqué par des CTE matérialisées
(défaut de PostgreSQL 12+ dès qu'une CTE est lue deux fois) et par un
`coalesce(pub.user_id, posts.user_id)` sur un `FULL OUTER JOIN` — la colonne
filtrée ne venait alors d'aucune table en particulier.

Corrigé par `NOT MATERIALIZED` et par un `UNION` des clés à la place du
`FULL OUTER JOIN`. **Mesuré : 520 lignes lues avec 300 comptes, 520 avec 900.**

### 6 · Ce qui reste, dans cet ordre — et un ordre qui ne se négocie pas

- [ ] **Jouer `000_run_me_all.sql`** (ou `theme_regroupement.sql` seul). Il n'y
      a rien à valider ici : la section 24 ne contient aucun `DROP` destructeur.
      ⚠ **Le fichier porte aussi le `DROP CONSTRAINT` du ticket 03, qui attend
      toujours ton feu vert** — jouer le fichier entier le joue aussi.
- [ ] **Déployer ce code dans la même fenêtre.** L'ordre est contraint :
      **ce code déployé sans la vue ne publie plus aucun rapport.** C'est
      volontaire — `fetch_theme_regroupement` lève `VueRegroupementAbsente`, le
      canal « rapport » finit en échec et le journal nomme la migration. Un repli
      qui recalcule les thèmes en Python ressusciterait la seconde
      implémentation que la vue existe pour supprimer, et elle dériverait en
      silence ; un rapport sans aucune carte de thème, lui, se lit comme un
      compte qui n'a rien fait.
- [ ] **Regarder bouger le revenu et le ROAS des thèmes** (§3). Comparer à
      l'ancien rapport avant de conclure à une panne.
- [ ] **[22](22-pulse-lit-la-vue.md)** — Pulse lit la vue, `revenuTheme()`
      meurt, les trois `revalidatePath` se rebranchent.

### 7 · Trois faits relevés en chemin, qui ne sont pas de ce ticket

- **Un « rapport KO » ne rend pas la run rouge.** `__main__` de `fetch_all.py`
  sort en 1 pour `_ECRITURES_SAUTEES` seulement : un rapport non publié laisse
  une run verte, avec un `echec` visible seulement dans `fetch_progress`. C'est
  le terrain de [20](20-rapport-publie-sur-un-canal-muet.md).
- **La section `ad_id` du ticket 03 est toujours NON COMMITÉE** dans
  `000_run_me_all.sql` : le commit b0624fb a livré le code, pas la migration.
  Je ne l'ai pas embarquée dans ce commit — elle appartient à 03. À committer à
  part, ou à jouer telle quelle depuis le fichier de travail.
- **La `series` d'un thème reste dans le payload.** 17 la range en Regroupement,
  mais la vue livrée est au grain du thème, pas de la semaine : lui donner un
  second grain aujourd'hui serait bâtir pour un consommateur qui n'existe pas.
  Écrit dans [22](22-pulse-lit-la-vue.md), à rouvrir quand la carte lira la vue.
