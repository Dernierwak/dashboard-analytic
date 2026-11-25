# Spec — Les stories Instagram

Carte : `map.md`. Décisions et leurs raisons : tickets `issues/01` à `06`.
Tranché le 2026-11-25 ; 03 à 06 par Claude sur délégation de David (« fait le
tout je te fais confiance »).

## Vocabulaire

| Mot | Sens | À éviter |
|---|---|---|
| **Story** | Un format de plus de la page, `media_product_type = STORY`. | « stories » comme page à part |
| **Journée de stories** | Les stories publiées un même jour (calendrier de la page). L'unité qui se lit, se compare, se classe. | « séquence », « lot » |
| **Journée complète** | Toutes ses stories ont un relevé à 20 h de vie ou plus. Seule une journée complète se compare. | — |
| **Relevé final** | Le dernier relevé d'une story, pris entre 20 h et 24 h de vie. | « chiffres définitifs » (il manque la dernière heure) |

## User stories

1. En tant que client, je veux voir mes stories dans la page Instagram, à côté
   de mes posts, afin de ne pas aller chercher ailleurs.
2. En tant que client, je veux lire une journée de stories comme un tout, afin
   de juger ce que j'ai publié ce jour-là et non dix morceaux.
3. En tant que client, je veux les clics sur le lien de mes stories, afin de
   savoir si elles amènent du trafic.
4. En tant que client, je veux qu'un chiffre qu'Instagram ne donne pas pour une
   story s'écrive en phrase, jamais en zéro.
5. En tant que client, je veux voir les images de mes stories après leur
   disparition d'Instagram.
6. En tant que David, je veux que rien ne change dans les permissions Meta de
   l'app pour récolter les stories.

## Ce que la page montre (`/instagram`)

- **Format Story** ajouté en dernier à l'ordre fixe (Reel, Carrousel, Image,
  Vidéo du fil, **Story**), avec sa couleur. Partout où la page parle d'un
  post, la rangée Story parle d'une **journée**.
- **Objectifs et métriques pour la rangée Story** :

| Objectif | Story (journée) | Autres formats |
|---|---|---|
| Portée | **portée du jour** (`reach_story` du compte, par défaut) ; vues (somme) ; sorties pour 100 vues | inchangé |
| Engagement | phrase « Instagram ne donne ni j'aime, ni commentaires, ni enregistrements pour une story » ; partages et interactions (sommes) quand ils sont choisis | inchangé |
| Abonnés | abonnés gagnés (somme, par défaut) ; visites de profil (somme). Pas de « pour 1 000 » : portée et sommes n'ont pas la même base | inchangé |
| **Trafic** (nouveau) | **clics sur le lien** (somme) | phrase « Instagram ne donne de clics sur le lien que pour les stories » |

- **« Tes posts face à ton année »** : rangée Story, un point = une journée
  complète ; même place (bandes des 12 mois), même minimum que les formats.
- **Les 5 meilleurs** : les journées y entrent, libellées « Stories du 24 nov.
  · 5 stories ».
- **Le Tableau** : une ligne par journée (format Story, nombre de stories) ;
  cliquable vers le Panneau. **Export `.csv`** : une ligne par journée.
- **Le Panneau d'une journée** : en tête, la portée du jour (« comptes touchés
  par tes stories ce jour-là ») et les sommes ; puis les vignettes dans
  l'ordre, chacune avec portée, vues, clics, navigation (avancer, revenir,
  quitter, story suivante) et « relevé à N h de vie ».
- **Les cas sans chiffres** :
  - story sous 5 spectateurs ou jamais relue → « – » et la raison (« Pulse n'a
    pas pu relire cette story avant sa disparition ») ; la journée dit
    « N story(s) sans chiffres » et ses sommes restent partielles, jamais
    complétées ;
  - journée incomplète → « en cours », hors comparaison ;
  - `reach_story` absent pour un jour → « – » ;
  - un 0 de clics porte « Instagram rend aussi 0 pour une story sans lien ».
- **Jamais** : `replies` (0 en Europe), une somme de portées, un ratio entre la
  portée du jour et une somme.

## La récolte

**Job horaire** — `.github/workflows/instagram-stories.yml`, cron
`17 * * * *`, `workflow_dispatch` en plus, `concurrency` sans annulation,
mêmes secrets que `weekly-fetch.yml` (Supabase, Meta). Commande
`python3.12 saas/data/fetch_data/cockpit/instagram_stories.py`. Pour chaque
connexion avec `instagram_business_id` et un jeton :

1. `GET /{ig}/stories?fields=id,media_type,media_product_type,media_url,thumbnail_url,timestamp,permalink`
   (pagination par curseur `after`, jamais `paging.next`).
2. Story inconnue → ligne `instagram_stories` ; vignette copiée dans le
   bucket (`media_url` pour une image, `thumbnail_url` pour une vidéo ;
   aucune des deux → `image_path` NULL), réduite à 720 px de large en JPEG.
3. Story de **20 h de vie ou plus** → relevé des insights, **une métrique par
   appel** (une métrique refusée ne fait pas tomber les autres) : `reach`,
   `views`, `shares`, `total_interactions`, `follows`, `profile_visits`,
   `link_clicks`, `navigation` ventilée par `story_navigation_action_type`.
   Le relevé écrase le précédent, avec `releve_a` et `age_heures`. Une erreur
   ou un jeu vide → NULL, jamais 0.
4. Erreurs : le jeton n'apparaît dans aucun message (`sans_jeton`) ; une
   connexion en erreur n'arrête pas les autres ; le journal dit, par compte,
   stories vues / nouvelles / relues.

Deux connexions peuvent porter le même compte Instagram (constaté le
2026-11-25) : comme pour les posts, chaque `user_id` a ses lignes.

**Relevé quotidien** — `releve_compte.py` lit déjà `reach` et
`total_interactions` ventilés par `media_product_type` ; il écrit en plus
`reach_story` et `interactions_story` (valeur `STORY`, NULL si absente),
comme il écrit `reach_ad`.

## La base (section 27 du `000_run_me_all.sql`)

La section 26 existe sur la branche `meta/objectif-et-compte` : prendre 27.

- `instagram_stories` — clé `(user_id, story_id)` ; `story_id text`,
  `publiee_a timestamptz NOT NULL`, `media_type text`, `permalink text`,
  `image_path text`, `vue_le timestamptz NOT NULL DEFAULT now()`,
  `releve_a timestamptz`, `age_heures numeric`, puis `reach`, `views`,
  `shares`, `total_interactions`, `follows`, `profile_visits`, `link_clicks`,
  `nav_tap_forward`, `nav_tap_back`, `nav_tap_exit`, `nav_swipe_forward`
  (bigint, NULL = non rendu). Pas de colonne `replies`. Index
  `(user_id, publiee_a)`.
- `instagram_compte_jours` : `reach_story bigint`, `interactions_story
  bigint`, NULL par défaut.
- Bucket privé `instagram-stories`, chemin `{user_id}/{story_id}.jpg`.
- RLS : lecture par `a_acces(user_id)` sur la table et sur
  `storage.objects` du bucket (premier segment du chemin) ; aucune politique
  d'écriture, seul le worker écrit. Ajout seul, aucun `DROP`/`DELETE`.
- Le tableau CONTRÔLE de fin de fichier liste la table, les colonnes et le
  bucket.

## Ce qu'on ne mesure pas

À reporter dans `docs/mesures-impossibles.md` :
- les **réponses** à une story (0 pour les stories créées en Europe) ;
- la **portée des stories publiées un jour donné** : Instagram donne celle des
  stories vues ce jour-là ;
- les stories publiées **avant la mise en route**, et la **dernière heure**
  de vie d'une story.

## Comment on verra que ça marche

Rien ne se vérifie en cliquant (`CLAUDE.md` §9) :
1. jouer la section 27 dans le SQL editor de Supabase (David) ;
2. **lancer à la main** `instagram-stories.yml` depuis l'onglet GitHub Actions :
   le journal doit dire « N stories vues, N nouvelles » pour le compte ;
3. le lendemain, après le cron de 07:00 UTC, `reach_story` est rempli pour
   la veille ; après 20 h de vie, les stories ont leurs chiffres ;
4. la rangée Story apparaît sur `/instagram` dès qu'une journée est complète.

## Hors périmètre

Le webhook `story_insights` (ticket 01 : deux scopes de plus, app Live, revue
Meta) ; les vidéos ; l'onglet Organique de l'hebdo ; `profile_activity`.
