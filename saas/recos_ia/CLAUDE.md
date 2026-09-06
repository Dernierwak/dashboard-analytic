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
| `insights.py` | **Non** — déterministe | La matrice full-history + les constats (« Ce qui fonctionne pour toi »). |
| `labeling.py` | Oui — Gemini | Pose un thème sur chaque post/campagne qui n'en a pas. |
| `categorizing.py` | Oui — Gemini | Catégorise chaque événement GA4 du catalogue qui n'en a pas. |
| `user_persona.py` | Oui — IA injectée (`call_ai`, pas un import direct de Gemini) | Le **profil client vivant** : synthétise un profil pour personnaliser le TON et le NIVEAU des recos. |

Le nom du dossier dit « recos IA » au sens large : *tout ce qui fabrique la
recommandation*, pas seulement ce qui appelle un modèle. `reco_engine.py` et
`insights.py` le disent eux-mêmes en tête de fichier (« déterministe, zéro
IA ») — c'est assumé, pas une erreur de rangement.

## `reco_engine.py` — le moteur

Dix règles déterministes : `_rule_roas`, `_rule_gaspillage`, `_rule_scaler`,
`_rule_silence`, `_rule_format_gagnant`, `_rule_page_endormie`,
`_rule_creneau`, `_rule_funnel`, `_rule_ga4_muet`, `_rule_connecter_ga4`.
Chacune passe par `_reco()`, qui impose la grammaire à quatre champs. Chaque
conseil porte aussi un niveau de confiance (**solide / creuser / piste**), qui
dépend de la taille de l'échantillon, de la complétude de la vue (a-t-on GA4
ou juste le coût ?) et de la franchise du signal.

`build_recos()` évalue les dix règles, applique `OBJECTIFS` (l'objectif du
compte remonte les conseils qui le servent), le `feedback` (`not_for_me`
recule de 6, `done` de 2) et les constats de `vision` (venus d'`insights.py`)
— puis trie par priorité. **Une règle qui plante est ignorée : le rapport ne
casse jamais pour un conseil.** Le moteur ne connaît ni les thèmes, ni les
dates déclarées — ça reste hors de sa portée.

Les recos pub sont **plafonnées à « creuser »** tant que GA4 n'est pas
connecté : on voit le coût, jamais le retour, donc jamais de certitude du
type « coupe cette campagne ».

## `insights.py` — les constats

Croise TOUT l'historique disponible (Ads depuis le 1er janvier, posts
Instagram stockés) par thème / format / campagne / créneau, avec le revenu
GA4 quand il existe. `build_matrix` construit la matrice, `build_constats` en
tire 3-5 phrases chiffrées à **clés stables** : un constat rejeté par le
client (`insight_feedback`) reste écarté quand il se régénère à l'identique.
L'IA ne formule jamais ces phrases — elle les reçoit ensuite comme contexte
pour le brief.

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
`'user'`. Voir l'en-tête de `triggerClassify` dans `saas/web/app/actions.ts`
pour pourquoi ce second classifieur (conversions) ne contredit pas la règle
« une seule classification IA ».

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

## Qui appelle ce dossier

`saas/collecte/automatisation/fetch_all.py` déclenche `labeling.py` et
`categorizing.py` en fin de récolte (imports locaux, pour éviter un cycle).
`saas/traitement/build_report.py` appelle `reco_engine.py` et `insights.py`
pour construire le payload du rapport, et `user_persona.py` pour calibrer le
brief IA sur le profil client vivant.
