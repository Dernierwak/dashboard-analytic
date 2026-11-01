# CLAUDE.md — saas/data/supabase/processed_data/weekly_report/

Ce dossier **assemble et publie le rapport hebdo précalculé**
(`weekly_reports.payload`) à partir de ce que `saas/data/fetch_data/` a récolté. Il ne
va chercher aucune donnée à l'extérieur : il lit, il chiffre, il publie.

Le projet est **Pulse** (voir `CLAUDE.md` à la racine).

| Fichier | Ce qu'il fait |
|---|---|
| `reader.py` | Le `Lecteur` : tout ce que la construction lit dehors (Supabase, l'horloge), derrière un seul objet — le seam hors ligne. |
| `builder.py` | `build_payload(Lecteur)` : fixe la semaine, assemble les blocs, ne publie que si `sources` est écrit. |
| `publisher.py` | Interface appelée par l'orchestrateur pour publier le rapport. |
| `blocs/` | Un fichier par bloc du payload (`semaine`, `sources`, `canaux`, `changements`, `frise`, `posts`, `canaux_muets`), `assemble.py` qui les réunit, et `_commun.py` — jour, dépense par régie et filtre « dans la semaine », partagés par `sources`, `canaux` et `frise`. |

## Les clés du payload

Écrites par `blocs/assemble.py`, plus trois par `builder.py`. Un bloc qui rend
`None` n'écrit aucune clé : la page lit une clé absente comme « rien à montrer ».

| Clé | Bloc | Ce qu'elle porte |
|---|---|---|
| `semaine` | `semaine.py` | Début, fin et numéro de la semaine mesurée, calée sur le Jour de travail. |
| `sources` | `sources.py` | L'état de chaque source **branchée** (`recolte` / `panne` / `jeton_mort`), sa date de connexion, la couverture de son journal ; Instagram avec la plage de ses posts. Une source pas branchée n'a pas d'entrée — et n'apparaît nulle part ailleurs non plus (user story 48). |
| `totaux` | `sources.py` | Dépense et impressions de la semaine par régie, `null` hors `recolte` — jamais un 0 d'absence. |
| `canaux` | `canaux.py` + `changements.py` | Par régie au module (Meta aujourd'hui) : volumes, CTR / CPC / CPM face aux 12 semaines précédentes, et les changements de la semaine. |
| `frise` | `frise.py` + `posts.py` | L'année : `annee`, `campagnes` (une barre par campagne, identité par ID) et `posts` (sans chiffre). Seules les régies branchées y entrent. |
| `version`, `week_start` | `builder.py` | La forme du payload, et la clé d'écriture `(user_id, week_start)`. |
| `canaux_muets` | `canaux_muets.py` | **La page ne la lit plus.** Elle reste pour l'escalade de la récolte : `error_reporter.note_canaux_qui_durent` la reçoit, et `semaines_muettes` compte la série en relisant cette clé dans les rapports déjà publiés — la retirer remettrait le compte à 1 pour toujours, sans erreur. |

## CE DOSSIER NE CONSEILLE RIEN

Le moteur de recommandations (`saas/recos_ia/`) a été retiré du produit le
2026-09-21. Avec lui sont partis : les dix règles déterministes, les six règles
payantes, les constats « ce qui fonctionne pour toi », la composition de la
semaine, le profil client vivant, la mémoire d'un thème, le brief rédigé par
Gemini, le suivi des actions et le savoir-faire de fond.

`build_payload` est passée de 5 900 à ~2 200 lignes, puis le fichier à ~1 400
avec le départ du thème. **Aucun appel à un modèle
de langage ne subsiste** dans ce dossier.

Le thème — l'étiquette posée sur des campagnes et des publications, les
étoiles des thèmes prioritaires, la vue `theme_regroupement` — est parti à son
tour (`.scratch/meta-ads/issues/01-…`), **et rien ne l'a remplacé** : ni
cartes, ni anneau, ni regroupement, ni objectif ou événement GA4 par thème.

Le payload ne porte que les clés du tableau plus haut. Le verdict, la boussole
(`kpi_focus`), les métriques de lecture rapide (`metrics_*`) et l'ancienne
liste `changements` sont partis avec le ticket 10 du chantier hebdo.

**Les payloads DÉJÀ PUBLIÉS gardent leurs clés mortes** (`recos`, `brief`,
`tracking`, `vision`, `reglages`, `themes_tips`, `top_recos`, `themes_focus`,
`themes`, `matrice`, `verdict`, `kpi_focus`, `metrics_*`…). Plus personne ne
les lit ; elles s'éteignent d'elles-mêmes à la prochaine publication. Ne pas
écrire de migration pour les nettoyer : ça coûterait une réécriture de tous les
payloads pour gagner des octets que personne ne paie.

## Pourquoi ce n'est pas Next.js qui construit le rapport

Question légitime, et la réponse est un choix d'architecture assumé, pas un
oubli : `publisher.py` tourne **une fois par semaine**, déclenché par
`.github/workflows/weekly-fetch.yml` — jamais à la demande d'un visiteur.
Trois raisons de le garder hors de Next.js/Vercel :
1. **Le temps d'exécution.** Appeler Meta Ads + Google Ads + GA4 (retries,
   pagination) puis construire tout le payload peut prendre plusieurs
   minutes — au-delà des plafonds des fonctions serverless Vercel.
2. **Les secrets.** Les jetons d'accès aux comptes pub restent dans un
   runtime GitHub Actions séparé, jamais exposé au trafic public.
3. **Le déclenchement.** GitHub Actions fait du cron nativement.

`saas/web/` ne fait que **lire** `weekly_reports.payload` déjà écrit — schéma
classique « batch écrit, serverless lit ». Ne pas réintroduire de calcul de
rapport côté Next.js sans repasser par cette décision.

## Usage

`publisher.publish_weekly_report(sb, user_id)` est la
fonction appelée par `saas/data/fetch_data/orchestration/account_sync.py` en fin de
récolte — imports locaux dans `account_sync.py` pour éviter un cycle.

`SEUIL_ESCALADE` (`blocs/canaux_muets.py`) est lue par `saas/data/fetch_data/orchestration/error_reporter.py` **par
import local**, depuis `note_canaux_qui_durent`. Aucun appelant ne se voit dans ce fichier : une
analyse de code mort la déclarera inatteignable, et elle ne l'est pas.

## Le seam, et comment on le rejoue

`build_payload` prend un `Lecteur` (`reader.py`), pas un client Supabase :
**une propriété du payload s'exécute au lieu de se lire dans le texte.** Un
faux lecteur suffit à construire le rapport sans base, sans secret, sans réseau.

Les harnais qui le faisaient ont quitté l'arbre le 2026-10-01 ; ils restent dans
l'historique (`git log --diff-filter=D -- .scratch/construction`). Ceux du
chantier hebdo vivent dans `.scratch/hebdo/harnais/` (un dossier par ticket,
faux lecteur commun dans `commun/`). Toucher au traitement, c'est écrire le
harnais du ticket, pas en supposer un.
