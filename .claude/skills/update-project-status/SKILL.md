---
name: update-project-status
description: Régénère PROJECT_STATUS.html, le dashboard HTML autonome de ce projet (tâches, agents, coûts, historique git, retours terrain qa-testeur, "ce qui me dirige"). Déclenche quand David demande de mettre à jour, rafraîchir ou synchroniser PROJECT_STATUS.html / le dashboard / son "copilote", après un cycle LOOP.md validé (nouvelle tâche terminée), après un passage de l'agent qa-testeur, ou quand CLAUDE.md / un agent / une skill / docs/ a changé. Ne PAS utiliser pour LOOP.md lui-même (c'est la source de vérité des tâches, jamais généré) ni pour du code applicatif.
---

# Mettre à jour PROJECT_STATUS.html

`PROJECT_STATUS.html` est un dashboard HTML **autonome** (une seule page, aucune
dépendance externe, ouvrable en `file://`) qui sert de tableau de bord humain
+ note de reprise pour le LLM. Il avait été supprimé sur `origin/main` lors du
retrait de Streamlit (commit `569e7ae`, au profit du seul workflow LOOP.md) ;
David a demandé de le faire revivre le 2026-08-31 (voir `LOOP.md`). Ce fichier
existe donc **seulement dans ce checkout racine**, pas sur `origin/main` — ne
pas s'étonner de son absence si tu travailles dans un worktree.

Toute la donnée du fichier vit dans des `const` JS au milieu du `<script>` —
il n'y a pas de backend, pas de fetch. Certains blocs sont **générés**
(remplacés en entier par un script), d'autres sont **édités à la main** (jugement
éditorial nécessaire, pas mécanique). Ne confonds jamais les deux catégories.

## Ce qui est généré — ne jamais éditer à la main

Deux scripts, à relancer avec `python3.12` (jamais `python3`) :

```
python3.12 scripts/build_project_history.py     # bloc GIT_HISTORY
python3.12 scripts/build_llm_context.py          # bloc LLM_CONTEXT
```

- `build_project_history.py` lit `git log origin/main` (l'historique **réel**
  du produit — pas le `main` local de ce checkout, qui est frozen à des
  centaines de commits de retard) et remplace tout ce qui est entre
  `/* GIT_HISTORY_START */` et `/* GIT_HISTORY_END */`.
- `build_llm_context.py` relit CLAUDE.md + `.claude/agents/*.md` (projet et
  `~/.claude/agents/*.md` utilisateur) + `.claude/skills/*/SKILL.md` (idem) +
  `docs/**/*.md` **tels qu'ils sont sur le disque au moment de l'exécution**,
  et remplace tout ce qui est entre `/* LLM_CONTEXT_START */` et
  `/* LLM_CONTEXT_END */`. Un dossier absent (ex. `docs/` n'existe pas dans ce
  checkout) donne `"present": false` et une liste vide — c'est correct, ne
  jamais fabriquer une entrée pour un fichier qui n'existe pas réellement.

Lance les deux à chaque régénération, même si tu ne modifies "que" les tâches —
ils sont rapides et gardent le fichier honnête.

**Piège déjà rencontré** : si tu réécris un jour ces scripts, ne construis
jamais la chaîne de remplacement comme deuxième argument positionnel de
`re.sub()` — le JSON contient des `\"` et `\n` échappés que `re.sub` réinterprète
comme des échappements regex (un `\n` de JSON devient un vrai saut de ligne, ce
qui corrompt le JSON). Utilise toujours `pattern.sub(lambda m: remplacement, html)`.

## Ce qui se met à jour à la main — jugement éditorial requis

### Tâches (`SEED_TASKS`, `HISTORIC_TASKS`, `PROJECTS`, `PROJECT_BY_TASK`)

La source de vérité des tâches en cours est **LOOP.md**, pas ce fichier. À
chaque régénération :

1. Lis `LOOP.md` (queue + historique) — c'est dense, lis par sections avec
   `offset`/`limit` plutôt que le fichier entier.
2. Pour chaque tâche LOOP.md qui n'a pas encore d'entrée ici, ajoute un objet
   `{ id, category, title, description, priority, status }` dans `SEED_TASKS`
   (en cours/à faire) ou `HISTORIC_TASKS` (terminée, testée par David) —
   **condense** le paragraphe LOOP.md en une description d'une phrase, garde
   le raisonnement détaillé dans LOOP.md, ne le duplique pas ici.
3. **Garde les `id` stables** pour toute tâche déjà présente — le navigateur
   du client garde le statut par `id` dans `localStorage` ; changer un `id`
   fait disparaître son état côté client. N'ajoute que du nouveau, ne
   renumérote jamais l'existant.
4. Statut : `"todo"` (LOOP.md = à_faire), `"in_progress"` (en_cours,
   en_attente_réponse_humaine, checker_approuvé-en_attente_test_humain),
   `"done"` avec `verifiedBy: "llm"` **seulement** si LOOP.md dit
   explicitement le test humain concluant et la tâche classée terminée dans
   son historique.
5. `PROJECTS` : ajoute une entrée seulement pour un vrai nouveau thème de
   projet, pas pour chaque tâche.

### Agents à main levée (`AGENTS`, `LLM_REVIEWS`)

`AGENTS` (méthode, à éviter) et `LLM_REVIEWS` (auto-revue, apprentissages)
restent écrits à la main — c'est la partie subjective que `build_llm_context.py`
ne peut pas déduire d'un fichier `.md`. Ajoute une entrée `AGENTS` pour tout
nouvel agent trouvé par `build_llm_context.py` mais absent de la liste (son
`id` doit correspondre exactement au `nom` généré, sinon `renderAgents()` ne
fusionnera pas les deux sources). N'invente jamais une `LLM_REVIEWS` sans
signal réel (retour de David, désaccord constaté) — un tableau vide est
honnête, une entrée fabriquée ne l'est pas.

### Retours terrain (`QA_FEEDBACK`)

Rempli après un passage de l'agent `qa-testeur` (`.claude/agents/qa-testeur.md`).
Cet agent n'a pas d'outil d'écriture — il rapporte, l'orchestrateur transcrit.
Reprends son rapport **texte pour texte**, sans l'adoucir ni le résumer :

```js
{
  date: "2026-08-31",                 // date du passage, pas de la tâche testée
  url: "https://…",                   // ce que qa-testeur a réellement ouvert
  page: "Rapport hebdomadaire",       // une entrée par page testée
  forces: ["…"],                       // section "Points forts" du rapport, telle quelle
  faiblesses: [
    { vu: "…", pourquoi: "…", nature: "trou de données réel" }
    // nature ∈ "trou de données réel" | "bug d'affichage" | "bug de calcul" | "incompréhension"
    // — reprends exactement l'étiquette que qa-testeur a donnée, ne réinterprète pas
  ],
  verdict: "…"                        // phrase de verdict global de la page
}
```

Ajoute un objet par page testée, ne remplace jamais un passage précédent —
`QA_FEEDBACK` est un historique (trié par date décroissante à l'affichage).
Une faiblesse déjà connue et non corrigée qui reste vue au passage suivant
doit être reportée à nouveau, pas supprimée silencieusement.

## Après toute édition

1. Valide que les deux blocs générés restent du JSON strict :
   ```
   python3.12 -c "
   import re, json
   html = open('PROJECT_STATUS.html', encoding='utf-8').read()
   for name, pattern in [('GIT_HISTORY', r'const GIT_HISTORY = (\[.*?\]);'), ('LLM_CONTEXT', r'const LLM_CONTEXT = (\{.*?\});')]:
       json.loads(re.search(pattern, html, re.S).group(1))
       print(name, 'OK')
   "
   ```
2. Valide que le `<script>` entier reste syntaxiquement correct :
   ```
   node -e "new Function(require('fs').readFileSync('PROJECT_STATUS.html','utf8').match(/<script>([\s\S]*)<\/script>/)[1]); console.log('OK')"
   ```
3. Ne fais jamais de rapport "PROJECT_STATUS.html à jour" sans avoir vraiment
   lancé ces deux validations — un JSON cassé rend tout le dashboard blanc
   silencieusement (pas d'erreur visible sans ouvrir la console navigateur).

**Piège vécu (2026-09-01), à ne jamais reproduire** : `node -e "new Function(code)"`
valide la SYNTAXE, pas l'EXÉCUTION. Un commentaire `/* … */` mal refermé peut
avaler silencieusement un `const` entier (le bloc devient un commentaire, donc
toujours syntaxiquement valide) — `new Function()` dit "OK" alors que la
variable n'existera jamais à l'exécution (`ReferenceError` seulement au
runtime, dans la vraie page). C'est exactement ce qui est arrivé en écrivant
`QA_FEEDBACK` : le marqueur `/* QA_FEEDBACK_START — …` sur plusieurs lignes a
été rouvert sans être refermé avant le `const`. Après toute édition qui touche
un bloc de commentaire multi-lignes suivi d'un `const`, valide en EXÉCUTANT
réellement le script (pas seulement en le parsant) :

```
node -e "
const fs = require('fs');
const code = fs.readFileSync('PROJECT_STATUS.html','utf8').match(/<script>([\s\S]*)<\/script>/)[1];
global.document = { getElementById: () => ({ innerHTML:'', style:{}, addEventListener:()=>{}, querySelectorAll:()=>[], appendChild:()=>{}, dataset:{}, value:'', reset:()=>{}, closest:()=>null }), querySelectorAll: () => [], addEventListener: () => {} };
global.window = { addEventListener: () => {}, location: { search: '' } };
global.localStorage = { getItem: () => null, setItem: () => {} };
try { new Function(code)(); console.log('EXEC OK'); } catch(e) { console.log('EXEC FAIL:', e.message); }
"
```
Ce stub est grossier (pas de vraies propriétés SVG/DOM) — une erreur qui *n'est
pas* `ReferenceError`/`is not defined` peut venir du stub, pas du fichier.
Mais un `ReferenceError` sur une variable que tu viens d'ajouter est TOUJOURS
un vrai signal : creuse-le. Le check définitif reste d'ouvrir la page dans un
vrai navigateur (`python3.12 -m http.server` dans le dossier du projet, jamais
`file://` à cause de restrictions d'extension navigateur) et de lire la
console — c'est ce qui a détecté ce bug-ci, le stub Node ne l'aurait pas fait
avec certitude.
