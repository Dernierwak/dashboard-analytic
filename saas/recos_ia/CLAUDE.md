# CLAUDE.md — saas/recos_ia/

Ce dossier décide **quoi recommander** à partir de ce que `saas/collecte/` a
écrit. Il ne va chercher aucune donnée à l'extérieur (ça, c'est `collecte/`)
et il ne construit pas le payload du rapport ni ne le publie (ça, c'est
`saas/traitement/build_report.py`, qui APPELLE ce dossier). Sa seule
responsabilité : transformer des lignes brutes en conseils, thèmes,
catégories et profil — chacun avec sa raison d'être.

Le projet est **Pulse** (voir `CLAUDE.md` à la racine). La grammaire d'un
conseil (observation / pourquoi / vérifier / angle mort) et les chiffres
qu'on n'a jamais le droit de fabriquer sont des règles du produit entier,
pas propres à ce dossier — voir `CLAUDE.md` § 7.

## Deux familles, et la distinction compte

| Fichier | Appelle l'IA ? | Rôle |
|---|---|---|
| `reco_engine.py` | **Non** — déterministe | Le moteur de recos : dix règles sur les chiffres, zéro modèle de langage. |
| `regles_payantes.py` | **Non** — déterministe | Les quatre règles qui descendent **sous la campagne** : Annonce, Groupe d'annonces, budget posé d'un thème. |
| `insights.py` | **Non** — déterministe | La matrice full-history + les constats (« Ce qui fonctionne pour toi »). |
| `composition.py` | **Non** — pur, zéro I/O | **Ce qui sort de la semaine** : cinq conseils au maximum sur tout le compte, ≤ 2 Marches, ≤ 2 fabrications à une heure ou plus, et l'**empreinte** (clé + cible) qui empêche la même instruction de revenir. Il coupe, il ne trie pas. |
| `labeling.py` | Oui — Gemini | Pose un thème sur chaque post/campagne qui n'en a pas. |
| `categorizing.py` | Oui — Gemini | Catégorise chaque événement GA4 du catalogue qui n'en a pas. |
| `user_persona.py` | Oui — IA injectée (`call_ai`, pas un import direct de Gemini) | Le **profil client vivant** : synthétise un profil pour personnaliser le TON et le NIVEAU des recos. |
| `theme_memoire.py` | Oui — IA injectée (même patron que `user_persona.py`) | La **mémoire d'un thème** : condense ce qu'il a déjà tenté et ce que ça a donné. |
| `marche_suivante.py` | Oui — IA injectée (même patron) | La **Marche suivante** d'une Stratégie déjà ouverte par une règle : l'étape d'après, sous trois barrières dures. Il n'ouvre jamais une Stratégie, il ne déclare que dans les listes fermées, il ne nomme qu'un objet des `facts` du thème. |

**Aucun conseil n'est rédigé par un modèle de langage À PARTIR DES CHIFFRES DU
COMPTE.** Les « pistes » de thème — un appel Gemini par thème, trois idées
écrites à partir de ses chiffres — sont coupées depuis le ticket 08 de la
construction : c'était le seul endroit où Pulse disait quelque chose que **rien
ne pouvait vérifier**, ni un chiffre du compte ni une règle. **Le moteur trie,
l'IA explique** — elle garde le ton (`user_persona.py`), le savoir-faire de fond
(`_themes_tips`, dans `saas/traitement/`), le résumé de la semaine et la mémoire
d'un thème.

**La seule exception est `marche_suivante.py`, et elle n'en est pas vraiment
une** (ticket 22 de la refonte, décision 6). Aucune règle déterministe ne sait
que « refaire la page d'arrivée » se descend en appel à l'action → titre →
structure : c'est du savoir-faire, le même bois que les astuces, que la coupe a
explicitement épargnées. Il ne lit **aucun chiffre du compte** — son prompt n'en
contient pas un — et il ne peut écrire que l'étape d'après d'une Stratégie
**qu'une règle a ouverte** et dont le client a **confirmé** avoir fait la
précédente.

Le nom du dossier dit « recos IA » au sens large : *tout ce qui fabrique la
recommandation*, pas seulement ce qui appelle un modèle. `reco_engine.py` et
`insights.py` le disent eux-mêmes en tête de fichier (« déterministe, zéro
IA ») — c'est assumé, pas une erreur de rangement.

## `reco_engine.py` — le moteur

Huit règles déterministes : `_rule_roas`, `_rule_gaspillage`, `_rule_scaler`,
`_rule_silence`, `_rule_page_endormie`, `_rule_funnel`, `_rule_ga4_muet`,
`_rule_connecter_ga4`.

**Elles étaient dix.** `_rule_format_gagnant` et `_rule_creneau` sont mortes le
2026-09-12 : elles répondaient à « qu'est-ce qui marche chez toi », la question
d'`insights.py`, sur une fenêtre plus courte et avec d'autres seuils. Ce sont des
CONSTATS, pas des conseils — voir la pierre tombale dans le fichier.
Chacune passe par `_reco()`, qui impose la grammaire à quatre champs. Chaque
conseil porte aussi un niveau de confiance (**solide / creuser / piste**), qui
dépend de la taille de l'échantillon, de la complétude de la vue (a-t-on GA4
ou juste le coût ?) et de la franchise du signal.

`build_recos()` évalue les huit règles, applique `OBJECTIFS` (l'objectif du
compte remonte les conseils qui le servent), le `feedback` (`not_for_me`
recule de 6, `done` de 2) et les constats de `vision` (venus d'`insights.py`)
— puis trie par priorité. **Une règle qui plante est ignorée : le rapport ne
casse jamais pour un conseil.** Le moteur ne connaît ni les thèmes, ni les
dates déclarées — ça reste hors de sa portée.

Les recos pub sont **plafonnées à « creuser »** tant que GA4 n'est pas
connecté : on voit le coût, jamais le retour, donc jamais de certitude du
type « coupe cette campagne ».

## `regles_payantes.py` — sous la campagne

Quatre règles, et un périmètre que `reco_engine.py` n'a pas :
`annonce_sans_conversion`, `annonce_locomotive`, `annonce_chere`,
`theme_hors_budget`. À l'intérieur d'un thème, une campagne n'a plus personne à
qui se comparer — on l'a justement filtrée : **l'unité de comparaison devient
l'Annonce et le Groupe d'annonces** (`CONTEXT.md`). C'est pour ça que
`_rule_gaspillage` et `_rule_scaler`, qui comparent des campagnes à leur
médiane, ne pouvaient pas simplement être rebranchés par thème.

**Aucun seuil n'y est inventé** : tous sortent de `SEUILS` (`reco_engine.py`).
Le module est **pur** — listes de dicts en entrée, dicts en sortie, ni base, ni
réseau, ni pandas. Il ne sait pas rattacher une Annonce à un thème : c'est
`build_report.py` qui le fait et lui passe la liste (même partage que
`_orga_recos` et `_reco_evenements`, qui vivent là-bas pour la même raison).

**Deux choses à savoir avant d'y toucher** :

- **Le geste « couper » a deux garde-fous**, posés par David : jamais sur une
  campagne **jeune** (rien en base ne dit qu'une campagne est un test, l'âge est
  le seul proxy honnête) et jamais fondé sur une **part de budget** — seulement
  sur un résultat mesuré.
- **`conversions=None` n'est pas `conversions=0`.** `meta_ads_insights` ne porte
  pas la conversion au niveau de l'Annonce, `google_ads_ad_insights` si. Une
  annonce non mesurée n'est ni dénoncée ni utilisée comme preuve — la compter à
  zéro ferait couper une annonce Meta qui vend très bien (`CLAUDE.md` § 7).

## `insights.py` — les constats

Croise TOUT l'historique disponible (Ads depuis le 1er janvier, posts
Instagram stockés) par format / campagne / créneau, avec le revenu GA4 quand
il existe. `build_matrix` construit la matrice, `build_constats` en tire 3-5
phrases chiffrées à **clés stables** : un constat rejeté par le client
(`insight_feedback`) reste écarté quand il se régénère à l'identique. L'IA ne
formule jamais ces phrases — elle les reçoit ensuite comme contexte pour le
brief.

**C'est la SEULE réponse à « qu'est-ce qui marche chez toi » depuis le
2026-09-12**, et elle s'AFFICHE enfin : chaque constat porte sa `platform`, et
Pulse le rend au rang 4 de `/meta`, `/google`, `/instagram` et `/labels`
(`components/ce-qui-marche.tsx`). Elle se calculait avant trois fois, dans deux
langages — ici, dans deux règles du moteur, et en TypeScript sur `/instagram`.
Un cinquième genre de constat vient d'ailleurs : `cout_conversion`, que
`build_report.py` récolte sur la carte d'un thème (`_constat_cout`).

**Le croisement par THÈME ne se calcule plus ici.** Il vit dans la vue
`theme_regroupement` (`supabase/migrations/theme_regroupement.sql`), que
`build_matrix` reçoit toute lue. C'est le seul endroit où Python et TypeScript
partagent une implémentation au lieu d'en entretenir deux qui dérivent : un
Thème ne produit aucune donnée, son total se recalcule à la lecture
(`CONTEXT.md`, « Regroupement »). Le seuil des 100 CHF qui autorise à juger un
thème y vit aussi, rendu avec la ligne sous le nom `juge` — il ne s'écrit plus
en clair dans `C_SEUILS`.

## `labeling.py` et `categorizing.py` — même patron, et c'est voulu

Un seul appel Gemini **batch** (tranches de 80 items pour `labeling.py` ; un
seul appel pour `categorizing.py`, le catalogue GA4 tenant en quelques
dizaines de lignes). Les deux réutilisent une liste maîtresse existante
(`profiles.labels` pour les thèmes, `conversion_categories` pour les
catégories) et l'IA peut en proposer de nouvelles.

**La règle d'or, identique dans les deux fichiers** : une valeur posée par un
humain (`label_source='user'` / `category_source='user'`) n'est **jamais**
réécrite par l'IA. L'IA marque les siennes `'ai'`, corrigibles depuis
l'interface (`/labels`, `/conversions`) — corriger repasse la ligne en
`'user'`.

**Pourquoi DEUX classifieurs ne contredisent pas « une seule classification
IA » :** ils portent sur des contenus DIFFÉRENTS — `labeling.py` sur les
campagnes et les posts, `categorizing.py` sur les événements GA4. Ce qui est
proscrit, c'est d'écrire un second classifieur sur les MÊMES contenus (par
exemple un classement de thèmes côté web) : on aurait deux classements
divergents. Ce raisonnement vivait dans l'en-tête de `triggerClassify`
(`saas/web/app/actions.ts`), partie avec les quatre boutons de déclenchement
(`.scratch/construction/issues/15-le-client-ne-declenche-plus-rien.md`) ; il
vit ici désormais.

**Les deux tournent dans la récolte, jamais sur un clic.** Le client n'a plus
de bouton pour les lancer : ils passent au Jour de travail, avec le reste.

Tout est **best-effort** : sans clé Gemini, sans données, ou sur JSON
invalide, les deux fichiers logguent et continuent — la récolte n'échoue
jamais à cause d'un label ou d'une catégorie manquante.

## `user_persona.py` — le profil client vivant

Deux couches : une base **fixe** (onboarding — secteur, budget, temps,
frustration — saisie une fois, jamais redérivée) et un état **évolutif**
(niveau de maîtrise, ton, priorités, à éviter), recalculé par l'IA à partir
des commentaires, réactions (`reco_feedback`), verdicts mesurés
(`suivi_actions`), avis sur les constats généraux (`insight_feedback`) et
avis par thème (`reco_feedback.theme`) — ces deux derniers gardés
**séparés** dans le prompt, pas fondus, pour qu'un rejet de thème ne se
confonde pas avec un rejet de constat. Le module est **découplé de l'appel
IA concret** : on lui passe `call_ai(prompt) -> str|None` (dans le rapport,
c'est `_call_gemini`) — aucun import de Gemini ici, module headless.
**Branché** dans le brief IA de `build_report.py`, recalculé une fois par
semaine (le rythme d'appel du module EST le rythme de mise à jour — pas de
cache interne séparé).

## `theme_memoire.py` — la mémoire d'un thème

La **seconde couche** du Plan de thème. La première (`theme_plan.reco_key/
levier/decided_at/snapshot`, déterministe) dit quelle hypothèse tourne en ce
moment ; celle-ci dit ce que le thème a **déjà tenté**, sur quels leviers, et
ce que ça a donné — une à deux phrases stockées dans `theme_plan.resume`,
injectées dans le prompt de `_theme_ai_recos`. Sans elle, Pulse pouvait
proposer une troisième hypothèse « argent » là où les deux premières avaient
été mesurées `worse`.

**Même patron que `user_persona.py`** (module headless, `call_ai` injecté,
repli sur la valeur stockée si l'IA échoue) mais **PAS la même cadence**, et
c'est la différence à ne pas rater : le profil client vivant est recalculé à
CHAQUE rapport ; la mémoire d'un thème ne l'est qu'à la chute d'un **nouveau
verdict** — le seul instant où elle change. Zéro verdict cette semaine, zéro
appel IA.

**L'IA reformule, elle ne calcule pas** : `build_prompt` ne reçoit que des
valeurs déjà calculées par `build_report.py` (verdict, baseline, valeur
constatée, variation), jamais de données brutes à agréger. C'est ce qui rend
vérifiable par simple lecture qu'aucun chiffre n'est fabriqué.

**Ce qu'elle lit a changé** (ticket 06 de la construction) : elle se nourrissait
des hypothèses que le worker posait tout seul dans `suivi_actions`
(`detail.origin == "auto"`). Cette écriture automatique est morte — un verdict
rendu sur un geste que personne n'a confirmé attribue un mouvement de chiffres à
une action qui n'a peut-être jamais eu lieu (`CLAUDE.md` § 7). La mémoire lit
maintenant **les actions que le client a confirmées** et dont un verdict est
tombé. Le `levier` continue d'arriver par `detail`, écrit cette fois au clic
(`startTracking`, `saas/web/app/actions.ts`) : sans lui, la mémoire ne saurait
plus dire « trois hypothèses argent d'affilée » sans le déduire de l'indicateur,
c'est-à-dire sans le fabriquer.

Deux conséquences à connaître avant d'y toucher : la mémoire écrite cette
semaine est lue par le rapport **suivant** (la rédaction des pistes s'exécute
avant la boucle de verdict — voir le commentaire au branchement, ce n'est pas
un bug d'ordonnancement) ; et une action `archived`/`dropped` sort de la
mémoire, faute de verdict à raconter.

## `marche_suivante.py` — l'étape d'après

Le seul endroit où l'IA écrit encore un conseil, et le seul qu'elle sache
écrire. Tranché par `.scratch/refonte/issues/22-rebrancher-le-plan-de-theme.md`
(décision 6), bâti par le ticket 24 de la construction.

**Trois barrières dures**, chacune un rejet, jamais une correction :

1. **Il n'ouvre jamais une Stratégie.** Seule une règle le fait, en posant une
   Hypothèse (`role="hypothese"`). Deux verrous : pas d'appel sans une Marche
   déjà FAITE (un `done_at` en base, la preuve d'un clic), et rejet de toute
   piste qui ne déclare pas `role="generale"` — or `generale` est précisément
   ce que la boucle `ecrire_plan_de_theme` ne ramasse pas.
2. **Grammaire dans les listes fermées** (`nature`, `role`, `levier`, `metric`,
   `effort`). Une seule valeur hors liste et la piste ENTIÈRE tombe. Les listes
   arrivent **par paramètre** depuis `build_report.py` (`GRAMMAIRE`) : les
   recopier ici ferait les deux tables qui finissent par ne plus dire la même
   chose, ce qui a déjà coûté `PROOF_KPI`.
3. **Il ne nomme qu'un objet présent dans les `facts` du thème** — les noms de
   campagnes et d'annonces que la récolte y a réellement rangés.

**Il n'écrit aucun chiffre**, et ça se vérifie par lecture du prompt : aucune
donnée du compte n'y entre, seulement des NOMS. Le seul nombre de la carte est
la baseline, photographiée après coup par `_attach_metric`.

**Il ne réserve aucune place.** Sa Marche entre dans le vivier du thème AVANT le
tri par importance et le plafond de cinq : elle passe les mêmes filtres que
n'importe quelle règle, empreinte anti-répétition comprise, et peut très bien ne
pas sortir.

## Qui appelle ce dossier

`saas/collecte/automatisation/fetch_all.py` déclenche `labeling.py` et
`categorizing.py` en fin de récolte (imports locaux, pour éviter un cycle).
`saas/traitement/build_report.py` appelle `reco_engine.py`,
`regles_payantes.py` (une fois par thème, sur le chemin des conseils-règles) et
`insights.py` pour construire le payload du rapport, `user_persona.py` pour calibrer le
brief IA sur le profil client vivant, `theme_memoire.py` depuis sa boucle
de verdict, une fois par thème dont un verdict vient de tomber, et
`marche_suivante.py` depuis la boucle des thèmes — au plus une fois par thème
CONSEILLÉ, et seulement quand une Stratégie y est ouverte ET que sa Marche
précédente a été confirmée faite. Sur la plupart des comptes, il n'est donc
jamais appelé.
