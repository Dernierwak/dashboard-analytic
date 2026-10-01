# CLAUDE.md — saas/traitement/

Ce dossier **assemble et publie le rapport hebdo précalculé**
(`weekly_reports.payload`) à partir de ce que `saas/collecte/` a récolté. Il ne
va chercher aucune donnée à l'extérieur : il lit, il chiffre, il publie.

Le projet est **Pulse** (voir `CLAUDE.md` à la racine).

| Fichier | Ce qu'il fait |
|---|---|
| `build_report.py` | Le payload entier, et sa publication (`publish_weekly_report`). |
| `lecteur.py` | **Le seam.** Toute lecture et toute écriture passent par lui, donc `build_payload` tourne sans base, sans secret et sans réseau dès qu'on lui donne un faux lecteur. |
| `matrice.py` | La matrice full-history — tout l'historique croisé par format, campagne et créneau. |

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

Ce que le payload porte encore, et rien d'autre : le verdict de la semaine
(déterministe), la boussole (`kpi_focus`), la frise (`frise`), les faits de
plateforme (`changements`), les canaux muets (`canaux_muets`), la matrice
compacte (`matrice` : formats, campagnes, créneaux, couverture) et les
métriques de lecture rapide (`metrics_read`, `metrics_prev`, `metrics_series`).

**Les payloads DÉJÀ PUBLIÉS gardent leurs clés mortes** (`recos`, `brief`,
`tracking`, `vision`, `reglages`, `themes_tips`, `top_recos`, `themes_focus`,
`themes`, `matrice.themes`, le `theme` des campagnes de la frise…). Plus personne ne
les lit ; elles s'éteignent d'elles-mêmes à la prochaine publication. Ne pas
écrire de migration pour les nettoyer : ça coûterait une réécriture de tous les
payloads pour gagner des octets que personne ne paie.

## Pourquoi ce n'est pas Next.js qui construit le rapport

Question légitime, et la réponse est un choix d'architecture assumé, pas un
oubli : `build_report.py` tourne **une fois par semaine**, déclenché par
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

```bash
python3.12 saas/traitement/build_report.py --user <uuid> [--print]
python3.12 saas/traitement/build_report.py --all
```

`publish_weekly_report(sb, user_id, email_to=None)` (fin de fichier) est la
fonction appelée par `saas/collecte/automatisation/fetch_all.py` en fin de
récolte — imports locaux dans `fetch_all.py` pour éviter un cycle.

`SEUIL_ESCALADE` est lue par `fetch_all.py` **par import local**, depuis
`_note_canaux_qui_durent`. Aucun appelant ne se voit dans ce fichier : une
analyse de code mort la déclarera inatteignable, et elle ne l'est pas.

## Le seam, et comment on le rejoue

`build_payload` prend un `Lecteur` (`lecteur.py`), pas un client Supabase :
**une propriété du payload s'exécute au lieu de se lire dans le texte.** Un
faux lecteur suffit à construire le rapport sans base, sans secret, sans réseau.

Les harnais qui le faisaient ont quitté l'arbre le 2026-10-01 ; ils restent dans
l'historique (`git log --diff-filter=D -- .scratch/construction`). Toucher au
traitement, c'est écrire le harnais du ticket, pas en supposer un.
