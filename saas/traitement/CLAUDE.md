# CLAUDE.md — saas/traitement/

Ce dossier a un seul fichier, `build_report.py`, et un seul travail :
**assembler et publier le rapport hebdo précalculé** (`weekly_reports.payload`)
à partir de ce que `saas/collecte/` a récolté et de ce que `saas/recos_ia/` a
décidé de recommander. Il ne va chercher aucune donnée à l'extérieur et ne
décide pas lui-même des règles de reco (`_rule_*` vit dans
`saas/recos_ia/reco_engine.py`) — il les appelle et met en forme le résultat
pour l'écran (`saas/web/`) et l'email (`saas/emailing/`).

Le projet est **Pulse** (voir `CLAUDE.md` à la racine).

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
python saas/traitement/build_report.py --user <uuid> [--print]
python saas/traitement/build_report.py --all
```

`publish_weekly_report(sb, user_id, email_to=None)` (fin de fichier) est la
fonction appelée par `saas/collecte/automatisation/fetch_all.py` en fin de
récolte — imports locaux dans `fetch_all.py` pour éviter un cycle.

## `build_payload` — le cœur, et il est gros

`build_payload(sb, user_id)` fait à peu près tout le travail (plusieurs
milliers de lignes) : KPIs 7 jours pleins ancrés sur la dernière donnée
(jamais aujourd'hui — la comparaison exclut toujours le jour du fetch, voir
`CLAUDE.md` § 7), deltas vs la période précédente, dépense par canal, recos
par thème (organiques ET pub, via `saas/recos_ia/reco_engine.py`),
diversification des recos affichées (`_diversifier`), brief IA
(`_call_gemini`, calibré par le profil client vivant de
`saas/recos_ia/user_persona.py`, fallback déterministe si Gemini échoue ou
n'a pas de clé), contexte GA4 par thème
(`saas/collecte/ga4/ga4.py::build_ga4_context`).

**Ne pas essayer de tout retenir de ce fichier avant d'y toucher** — il est
dense et chaque fonction `_reco_*` / `_orga_*` porte sa propre justification
en commentaire à côté d'elle. Chercher la fonction concernée plutôt que lire
le fichier en entier.

## Le profil client vivant calibre le brief IA

Le brief IA de `build_report.py` est calibré par le profil client vivant
(`saas/recos_ia/user_persona.py::build_user_persona`) — onboarding, objectif,
réactions/verdicts, avis sur les constats généraux et avis par thème
(gardés séparés, pas fondus), recalculé une fois par semaine puisque ce
module n'est appelé qu'à la génération du rapport. Fallback déterministe si
Gemini échoue, comme partout ailleurs dans le produit : jamais d'erreur qui
casse le rapport pour un conseil manqué.
