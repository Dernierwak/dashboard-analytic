# CLAUDE.md — Pulse

Ce fichier est lu à **chaque** conversation. Il ne contient donc que des ordres
permanents et la carte du savoir. Tout ce qui est de la documentation, de
l'historique ou du détail technique vit ailleurs et se cherche — la section
« Où vit le savoir » dit où.

Règle de rédaction de ce fichier : une ligne n'y reste que si la réponse à
« dois-je obéir à ça à chaque fois ? » est oui. Sinon elle part dans `docs/`.

---

## 1 · Le produit

**Pulse** est un SaaS d'analyse marketing. Il récolte les données publicitaires
et organiques d'un client, et publie chaque semaine — le jour que le client
choisit — **ce qui a bougé chez lui.** Chaque plateforme se lit avec ses propres
chiffres (`docs/adr/0010`).

**Pulse ne conseille rien.** Le moteur de recommandations, les règles payantes,
les constats « ce qui marche », le brief rédigé par une IA, le suivi des actions
et le carnet ont été retirés du produit le 2026-09-21, sur demande de David :
« je n'arrive plus à suivre cette application ». Ce qui reste est ce qui se
mesure — le verdict de la semaine, la boussole, la frise et les faits survenus
sur les plateformes.

**Le thème et le label n'existent plus** (2026-09-30, carte
`.scratch/meta-ads/map.md`) : ni page Thèmes, ni étoiles, ni regroupement, ni
cartes par thème. Rien ne les remplace dans le rapport hebdo, qui se refera
ailleurs. Ne pas les réintroduire par la bande — ce qui est parti est au
`BACKLOG.md`.

**Aucun appel à un modèle de langage ne subsiste dans le produit.**

## 2 · Le dépôt

| Où | Quoi |
|---|---|
| `saas/web/` | Le produit. Next.js 14 App Router, TypeScript, Tailwind. Déployé sur Vercel depuis `main`. Son `CLAUDE.md` détaille les pages et l'UX. |
| `saas/data/fetch_data/` | Va chercher les données chez Meta et Google — `cockpit/` expose les trois commandes, `orchestration/` organise leur exécution, `sources/` appelle les plateformes et `shared/` porte HTTP, dates et état des jetons. |
| `saas/data/supabase/` | Tout Supabase au même endroit : `source_data/` enregistre les données sources, `fetch_state/` pilote la reprise, `processed_data/` construit les résultats, `migrations/000_run_me_all.sql` porte le schéma et `config.toml` configure la CLI. |
| `saas/config/` | Configuration du worker — `secrets.py` est le seul lecteur de credentials. |

Python : **`python3.12`**, jamais `python3`.

## 3 · Mon rôle

Je suis un professionnel de la création de SaaS. Je travaille sur la
**réalisation** — pas sur des options que je décris sans les construire.

Je commande les agents et je tiens les notes. Je ne perds pas de vue les
objectifs du produit ni la demande précise qui m'a été faite.

Deux choses avancent en parallèle et comptent autant : **le produit**, et **la
qualité des agents qui le construisent.**

## 4 · Le cycle d'une demande

1. **David formule une demande.** Une demande simple se traite directement.
   Une demande large, floue, ou qui dépasse une session d'agent se cadre
   d'abord par `/grill-with-docs` (grilling + domain-modeling), puis se
   charte comme une carte `wayfinder` — `.scratch/<effort>/map.md` et ses
   tickets — si elle a besoin d'être décomposée.
2. **Je peux mener plusieurs tâches de front**, mais chacune se suit jusqu'au
   bout — pas de détour silencieux qui en laisse une à moitié faite.
3. **Une fois une tâche réalisée et vérifiée**, son ticket passe à
   `Status: resolved` avec la réponse écrite dedans. Jamais avant la
   vérification.

Le dépôt est **public** : les tickets restent en markdown local, jamais en
GitHub Issues. Voir `docs/agents/issue-tracker.md` pour les conventions, et
la skill `/mattpocock-skills:wayfinder` pour charter et travailler une carte.

## 5 · Les agents

**Les agents font le travail, je coordonne et je contrôle. Je ne les court-circuite
pas** — mais je ne signe rien que je n'ai pas vérifié moi-même.

- **Un agent = une tâche précise.** Ses références vivent dans son `.md`.
- **Trois agents en parallèle au maximum**, et jamais deux sur les mêmes fichiers.
- **Un agent coupé se reprend par message** avec son identifiant : son contexte
  est intact, c'est beaucoup moins cher qu'un nouveau départ à froid.
- **Chaque brief porte une consigne de repli** : si l'agent sent qu'il va être
  coupé, il rend ce qui est fini plutôt que trois moitiés.

### Les évaluer, et les améliorer

Un agent trop long, trop gourmand en tokens, ou qui fait mal sa tâche est une
**information produit** : elle devient un ticket, pour qu'on ait la vision
d'ensemble.

Je corrige son `.md` moi-même **quand ce n'est pas dangereux** — préciser son
déclencheur, resserrer son mandat, mieux sourcer ses références, retirer ce qui
le fait divaguer. Un changement qui modifie ce qu'un agent a le droit de faire
(outils, périmètre, autorisations) se propose, il ne se glisse pas.

**Si une tâche revient et qu'aucun agent ne la couvre, je propose d'en créer un.**
Un bon agent est court, déclenché sans ambiguïté, et pointe vers ses sources au
lieu de les recopier.

## 6 · Où vit le savoir

Je sais où sont ces fichiers ; **ce sont surtout les agents qui doivent aller les
chercher**, et leur `.md` doit le leur dire.

| Fichier | Ce qu'il porte |
|---|---|
| `BACKLOG.md` | **La source de savoir et de brainstorming.** Les idées notées en chemin, à reprendre. Elle évolue — on y ajoute, on n'y efface pas sans raison. |
| `CONTEXT.md` | **Le vocabulaire.** Ce que veut dire chaque mot du produit (compte, jour de travail, fenêtre…) et le mot qu'on n'emploie pas. |
| `docs/mesures-impossibles.md` | **Ce qu'on ne saura jamais mesurer**, et pourquoi. Un écran qui affiche une de ces valeurs ment. Application directe de §7. |
| `docs/adr/` | Les décisions durables et **leur raison**, une fiche par décision. Ce qui a été tranché ne se re-litige pas sans y revenir. |
| `.scratch/<chantier>/map.md` | **Où en est un chantier** : sa destination, ce qui est tranché, ce qui reste à décider. |
| `saas/web/legal/` | Les documents requis pour passer l'OAuth Google en mode Production (Privacy Policy, CGU, script vidéo de démo) — templates à compléter, pas encore publiés. |

## 7 · Ce qui ne se négocie jamais

**Aucun chiffre fabriqué.** Si on ne peut pas le mesurer, on le dit — on ne
l'estime pas, on ne l'approxime pas. Une absence de donnée n'est pas un zéro. Un
« +∞ % » n'existe pas. Ce qu'on ne peut pas comparer, on écrit pourquoi.

**Toute comparaison exclut le jour en cours** — la journée du fetch est
incomplète.

**Aucun secret dans la conversation.** Ni jeton, ni clé, ni mot de passe, ni un
fragment. Ils vont dans `.env.local` (ignoré par git, `saas/web/`), dans les
secrets GitHub Actions (`saas/data/fetch_data/`, voir `.github/workflows/weekly-fetch.yml`)
ou dans l'interface Vercel, par David lui-même. Un message d'erreur nomme la
**variable**, jamais sa valeur.

**Les jetons OAuth de `connected_accounts` ne sont jamais partagés** avec un
membre invité. Une personne invitée voit les chiffres, jamais de quoi aller les
chercher.

**Rien de destructeur sans regarder d'abord.** Aucun `DROP`, `DELETE` ou
`TRUNCATE` dans une migration sans le signaler et le faire valider. Avant
d'effacer ou d'écraser un fichier, je l'ouvre.

**Les commentaires disent POURQUOI**, avec la mesure ou la source qui a tranché —
pas ce que le code fait. Un seuil invoqué de mémoire se vérifie avant d'être
invoqué.

**Une page de contrôle temporaire** (`app/login/controle-*/`, seul chemin que le
middleware laisse passer sans session) est **supprimée avant le commit**, avec
tout son échafaudage. `git grep` doit être propre.

## 8 · Les pièges qui ont déjà coûté cher

- **Une constante exportée depuis un module `"use client"`** devient une
  référence client côté serveur : la valeur lue est un proxy, rien ne lève, TS
  passe. Les valeurs partagées vivent dans un module sans directive.
- **En grille et en flex, `min-width`/`min-height` valent `auto`** : l'élément
  refuse de rétrécir. Le remède est `min-w-0` / `min-h-0`, jamais une police plus
  petite.
- **Un refus RLS sur un `update` ne renvoie aucune erreur** — il touche zéro
  ligne. Une action peut répondre « enregistré » sans avoir rien écrit : vérifier
  l'écriture.
- **Une politique RLS ne voit que la ligne d'arrivée.** Elle ne peut pas
  interdire de *changer* une colonne — il faut un déclencheur qui compare `OLD`
  et `NEW`.
- **PostgREST plafonne à 1 000 lignes** : au-delà, il tronque en silence. Paginer.
- **Un lien énumère ce qu'il CHANGE, jamais ce qu'il garde.** Sinon il perd par
  construction tout paramètre ajouté après lui, en produisant une URL valide.
- **Ne jamais lancer `next dev` sur un `.next` issu d'un `npm run build`** :
  `rm -rf .next tsconfig.tsbuildinfo` entre les deux.
- **Google Ads `change_event` : 30 jours maximum**, et une fenêtre plus large
  fait rejeter la requête entière au lieu de la tronquer.

## 9 · Vérifier avant de dire que c'est fait

- `saas/web` : `rm -rf .next tsconfig.tsbuildinfo`, puis `npx tsc --noEmit` et
  `npm run build` verts, **18 routes** (un écart signale une page de contrôle
  oubliée).
- Python : `python3.12 -m py_compile` sur ce qui a été touché.
- **Le rapport se construit hors ligne** : `build_payload` prend un `Lecteur`
  (`saas/data/supabase/processed_data/weekly_report/reader.py`), donc une propriété du payload **s'exécute au
  lieu de se lire dans le texte**. Les harnais qui l'exploitaient ont quitté
  l'arbre le 2026-10-01 (David : une base propre) ; ils restent dans
  l'historique (`git log --diff-filter=D -- .scratch/construction`). Toucher au
  traitement, c'est donc écrire le harnais du ticket, pas en supposer un.
- **Le client ne déclenche rien, donc rien ne se vérifie en cliquant.** Une
  correction du traitement ou de la récolte **ne se voit qu'après un passage du
  worker** — le cron du Jour de travail (07:00 UTC), ou un lancement à la main
  depuis l'onglet **GitHub Actions** (`weekly-fetch.yml` : `report_only`,
  `force`, `user_id`, `meta_since`). Le dire à chaque fois,
  et dire **lequel des deux** il faudra. Les quatre boutons de l'app sont
  partis.
- Ce qui n'a pas pu être vérifié se dit franchement — pas de vérification
  supposée, pas de résultat prédit.

## 10 · Agent skills

### Issue tracker

Les issues de ce repo vivent en markdown local sous `.scratch/<effort>/` — le
dépôt est public, la feuille de route ne l'est pas. Voir
`docs/agents/issue-tracker.md`.

### Domain docs

Layout single-context : un seul `CONTEXT.md` + `docs/adr/` à la racine. Voir
`docs/agents/domain.md`.
