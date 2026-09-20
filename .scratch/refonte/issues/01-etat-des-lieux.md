# État des lieux : ce que Pulse fait aujourd'hui, module par module

Type: task
Status: resolved

## Question

Rien à décider ici. Ce ticket **produit le document que David n'a plus** : la
carte du projet tel qu'il est, pour qu'on puisse enfin dire où on va sans
deviner. Il débloque tous les autres tickets de la carte — on ne tranche aucun
périmètre avant lui.

Livrable : `.scratch/refonte/etat-des-lieux.md`, lisible d'une traite par
David, écrit pour un humain qui a perdu le fil de son propre projet — pas un
rapport d'audit technique.

### Ce que le document doit contenir

1. **Une ligne par page** (10 routes) : ce qu'elle montre, quelle décision elle
   permet de prendre, et — honnêtement — si elle en permet une. Une page qui ne
   change aucune décision doit être nommée comme telle.

2. **Le chemin d'une donnée, de bout en bout** : d'un `fetch` Meta jusqu'au
   chiffre affiché à l'écran. Qui écrit quoi dans Supabase, qui le relit. C'est
   ce qui manque le plus à David pour savoir « où on va travailler ».

3. **La carte des dépendances entre modules** : qui ne peut pas exister sans
   quoi. En particulier, mesurer (pas estimer) le couplage entre le rapport
   hebdo, les recos et les thèmes — les 425 mentions de `label`/`theme` dans
   `build_report.py` sont un compte de `grep`, pas une analyse. Question précise
   à laquelle répondre par un fait : **si les thèmes disparaissaient, que
   resterait-il d'affichable dans le rapport, et qu'est-ce qui casserait ?**

4. **Les monolithes et ce qu'ils cachent** : `build_report.py` (4 775 lignes),
   `report.ts` (973), `components/` (56+). Quelles sont les grandes sections de
   `build_report.py`, dans l'ordre où elles s'exécutent. Un sommaire, pas une
   revue de code.

5. **Ce qui est mort ou orphelin** : composants non montés, code laissé après le
   retrait du Graphe A et de `reco_news`, prototypes non commités
   (`proto-parcours-themes.tsx`, `prototype-switcher.tsx` — dire s'ils sont
   branchés). Ne rien supprimer : lister.

6. **Ce qui existe en triple** : `/meta`, `/google`, `/instagram` sont trois
   dashboards jumeaux. Dire ce qui est réellement partagé (`lib/channels.ts`) et
   ce qui est dupliqué.

7. **L'état de la carte du savoir** : 6 des 7 fichiers de `CLAUDE.md` §6
   n'existent plus (commit `7f188f3`). Dire ce que chacun portait, à partir du
   contenu récupérable en git, et lequel mérite d'être reconstruit.

### Contraintes

- **Aucun chiffre fabriqué.** Chaque mesure citée est reproductible par une
  commande écrite à côté d'elle. Ce qui n'a pas pu être vérifié se dit.
- **Vocabulaire `CONTEXT.md`** : « thème », jamais « label » hors nom de colonne.
- **Rien de destructeur.** Ce ticket lit et écrit un seul fichier neuf.
- On ne recommande rien ici. Pas de « il faudrait » — le document décrit, les
  tickets suivants décident.

## Answer

Livrable écrit : [`.scratch/refonte/etat-des-lieux.md`](../etat-des-lieux.md),
619 lignes, mesuré sur `main` à `cf84957` le 2026-09-08. Chaque chiffre y porte
la commande qui le reproduit.

**Les huit points du ticket sont couverts.** Ce qui en ressort, dans l'ordre où
ça compte :

1. **Un seul cerveau.** `build_payload` fait **3 060 lignes** (l. 1651-4710),
   soit 64 % de `build_report.py`, en 30 sections. Deux sections font 787
   lignes à elles deux : « ce qui passe par un thème » (487) et « la
   boussole » (366).

2. **Un gros fichier que la carte ignorait** : `saas/web/app/actions.ts`,
   **1 840 lignes, 39 actions serveur** — plus gros que `channels.ts` (1 637)
   et que `report.ts` (973). Tout ce que le client *fait* passe par là.

3. **Le web ne calcule jamais.** Les quatre boutons (« Mes données »,
   « Classer mes contenus », « Classer mes conversions », « Recharger mes
   conseils ») font tous un `POST` sur l'API GitHub pour déclencher le **même**
   workflow avec un `input` différent. Le rendu lit `weekly_reports`, il ne
   recalcule rien — c'est la raison mécanique de la règle « ça ne se voit
   qu'après un ↻ ».

4. **Réponse à la question posée : oui, un rapport sans thèmes tient debout.**
   `rule_recos = build_recos(...)` (l. 2048) tourne **sur le compte entier,
   sans argument `theme`**, et alimente `recos`, `todo` et `reglages`.
   Survivraient aussi `verdict`, `kpi_focus`, `brief`, `frise`, `changements`,
   `preuve`, tous les `metrics_*`. **Casseraient net** : `themes_focus`,
   `themes_intro`, `themes_tips`, `themes`, `top_recos` (construit
   exclusivement en itérant sur `themes_focus`, l. 3707-3711), et les axes
   thème de `vision`/`matrice`. C'est une lecture du code, pas une exécution.

5. **Deux chiffres de la carte étaient faux, corrigés :** il y a **3 appels
   réels** à `_call_gemini` (l. 1470, 1612, 3178), pas 6 — le 6 comptait la
   définition et deux commentaires ; et le couplage aux thèmes est de **670
   lignes sur 4 775 (14 %), 809 occurrences**, pas 425.

6. **`recos_ia/` ne dépend pas de Gemini.** `user_persona.py` et
   `theme_memoire.py` reçoivent un `call_ai` injecté ; `reco_engine.py` et
   `insights.py` ne contiennent pas une occurrence de « gemini ». Seul
   `labeling.py` tient un client, prêté à `categorizing.py`.

7. **Sur 10 pages, une seule est décisionnelle** (`/`). Trois sont des réglages
   qu'on visite une fois, deux sont en amont de l'analyse, **trois sont des
   explorateurs qui ne concluent rien** (`/meta`, `/google`, `/instagram`).

8. **« Trois dashboards jumeaux » est inexact : c'est deux jumeaux et un
   cousin.** `/meta` (81 l.) et `/google` (73 l.) partagent déjà type,
   composants et barre de filtres — 48 lignes diffèrent sur 154. `/instagram`
   fait 635 lignes, a son propre type `InstaDash` et son propre chargeur de
   284 lignes. L'unification Meta/Google est faite ; celle avec Instagram n'a
   jamais été tentée.

9. **Mort ou orphelin, listé sans rien supprimer :** un composant jamais monté
   (`comparaison.tsx`, 479 l., exporte `Comparer`) ; deux prototypes **non
   suivis par git mais importés par un fichier suivi et modifié**
   (`app/labels/page.tsx` l. 59-60) — `tsc` passe aujourd'hui *parce que les
   fichiers sont là* ; **32 worktrees pesant 8,6 Go**, dont plusieurs portent
   l'ancienne arborescence (`saas/worker/`, `saas/core/`, `scripts/`), ce qui
   noie toute recherche récursive ; et **aucun email hebdomadaire n'est
   envoyé** — `saas/emailing/` n'est atteint que par `run_weekly.py`, que
   personne n'appelle.

10. **La carte du savoir : 6 fichiers sur 7 manquent, tous récupérables** par
    `git show 7f188f3^:<chemin>`. Le plus gros était
    `docs/03-grammaire-des-modules.md` (**1 075 lignes**), toujours invoqué par
    `CLAUDE.md` racine §6 et par `saas/web/CLAUDE.md` — un agent qui obéit à
    l'instruction cherche un fichier absent, puis improvise.

**Non vérifié, dit dans le document** : le compte de 16 routes de `CLAUDE.md` §9
(pas de `npm run build` lancé — les fichiers en déclarent 14) ; le comportement
réel d'un rapport sans thèmes (lecture, pas exécution) ; le contenu détaillé des
documents effacés (titres de section seulement). Aucune base Supabase n'a été
interrogée : ce document décrit du code, jamais des chiffres de client.

`npx tsc --noEmit` sort en code 0 sur l'arbre de travail actuel (vérifié).
