# 06: La récolte horaire et la réception du webhook

Type: task
Status: resolved
Blocked by: 01, 02
Assignee: —

## Question

Écrire le **plan technique** du circuit tranché (carte, Decisions so far),
assez précis pour qu'un agent le construise sans redécider :

1. **Le job horaire** : un workflow GitHub Actions à part (`schedule` toutes
   les heures) ou une commande de plus dans `saas/data/fetch_data/cockpit/` ?
   Ce qu'il lit, pour quels comptes, et la condition « story entre 22 h et
   23 h » qui déclenche l'unique lecture des chiffres. Que se passe-t-il si un
   passage saute (retard du cron GitHub) — la fenêtre doit-elle être plus
   large ?
2. **Le schéma** : la table des stories (clé : identifiant de la story et
   `user_id`), les colonnes des chiffres relevés et des chiffres du webhook
   séparées ou non, l'heure de chaque relevé ; la section du
   `migrations/000_run_me_all.sql` ; les politiques RLS (lecture pour les
   membres, aucune écriture client).
3. **Les images** : bucket Storage privé, chemin, taille attendue, lecture
   par URL signée ; ce que coûte une année de stories pour un compte.
4. **La route du webhook** sur Vercel : vérification `hub.challenge`,
   signature `X-Hub-Signature-256` sur le corps brut, correspondance compte →
   `connected_accounts`, upsert idempotent, exception au middleware, clé
   `service_role` côté serveur seulement, et les variables à créer par David
   (noms seulement, §7).
5. **L'abonnement par compte** au branchement (OAuth) et au débranchement.
6. **Ce qui se vérifie** : harnais hors ligne avec messages signés et non
   signés, `py_compile`, build à 18 routes — **19 avec la route du webhook**,
   à mettre à jour dans `CLAUDE.md` §9 au moment de la construction.

Réponses de [la recherche](01-le-webhook-et-l-api-des-stories.md) et de
[l'essai](02-l-essai-reel-d-une-story.md) en entrée.

## Answer

Plan tranché par Claude le 2026-11-25, sur délégation de David ; le détail
d'exécution est dans `../spec.md` § La récolte et `../tickets/`.

- **Pas de webhook** pour l'instant : l'essai (02) montre que tout se lit
  pendant la vie de la story avec les scopes actuels ; le webhook coûterait
  deux scopes (`pages_manage_metadata`, `pages_read_engagement`), l'app Live
  et la revue Meta (01) pour la seule dernière heure. Rien n'est demandé à
  Meta, rien ne change dans ce que l'app a le droit de faire.
- **Job horaire** : workflow GitHub Actions à part, cron à la minute 17 (loin
  de l'heure pile, où GitHub retarde le plus), commande
  `cockpit/instagram_stories.py`. Pour chaque compte Instagram branché : liste
  `/stories` ; une story inconnue → ligne créée + vignette copiée ; **toute
  story de 20 h de vie ou plus est relue à chaque passage** (au plus 4 fois),
  le dernier relevé écrase le précédent avec son `releve_a` et son âge —
  une fenêtre de 4 h tolère des retards du cron.
- **Schéma** : section 27 du `000`, table `instagram_stories`, colonnes
  `reach_story` et `interactions_story` sur `instagram_compte_jours` (écrites
  par le relevé quotidien, à partir des réponses qu'il lit déjà), bucket
  Storage privé `instagram-stories`.
- **Images** : la vignette seulement (`media_url` d'une image,
  `thumbnail_url` d'une vidéo), réduite à 720 px de large en JPEG — l'image
  de l'essai pesait 829 Ko, une vidéo jusqu'à 12 Mo.
- **Vérification** : harnais hors ligne du job (API simulée), `py_compile`,
  `tsc`, build à **18 routes** (aucune route ajoutée sans webhook).
